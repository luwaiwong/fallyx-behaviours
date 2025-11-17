import pdfplumber
import re
import openai
import os
import logging
import pandas as pd
from datetime import datetime, timedelta
import glob
from homes_db import homes, homes_dict
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))

client = None

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def extract_text_from_pdf(pdf_path: str, max_pages: int = 500) -> list:
    """
    Extract text from a PDF file, returning a list of page contents.
    Each element in the list represents one page's text.
    """
    pagesText = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                if i >= max_pages:
                    break
                text = page.extract_text(x_tolerance=3, y_tolerance=3)
                if text:
                    pagesText.append(text)
        return pagesText
    except Exception as e:
        logging.error(f"Error extracting text from PDF: {str(e)}")
        return []

#get the resident name from each page header
def getResidentNameFromHeader(pageText: str) -> str:
    # Look for "Resident Name" followed by ":" and capture everything up to the first number
    nameMatch = re.search(r"Resident Name\s*:\s*([^0-9]+?)\d", pageText)
    if nameMatch:
        # Get the matched name and clean it up
        name = nameMatch.group(1).strip()
        
        # Remove any remaining brackets and trailing spaces
        name = re.sub(r'\s*\(+\s*$', '', name).strip()
        
        return name
    return "Unknown"

#find the page associated with each effective date
def findPosition(pagesText: list, targetP: int) -> tuple:
    currentPosition = 0
    for i, pageText in enumerate(pagesText):
        pageLength = len(pageText) + 2  # +2 for the '\n\n' we add between pages
        if currentPosition <= targetP < currentPosition + pageLength:
            return i, targetP - currentPosition, currentPosition
        currentPosition += pageLength
    return -1, -1, -1

#get the positions of the words "effective date" from the pdf
def findEffectiveDates(allText: str) -> list:
    return [m.start() for m in re.finditer(r'Effective Date:', allText)]

def getAllFallNotesInfo(pagesText: list):
    entries = []
    allText = "\n\n".join(pagesText)
    effectiveDatePositions = findEffectiveDates(allText)

    for i, pos in enumerate(effectiveDatePositions):
        pageIndex, rel_pos, page_start = findPosition(pagesText, pos)
        if pageIndex == -1:
            continue
        endOfNote = effectiveDatePositions[i + 1] if i < len(effectiveDatePositions) - 1 else len(allText)
        section = allText[pos:endOfNote].strip()

        dateMatch = re.search(r"Effective Date:\s*(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})", section)
        if not dateMatch:
            continue
        noteDate = dateMatch.group(1)

        typeMatch = re.search(r"Type:\s*(Behaviour - Responsive Behaviour|Family/Resident Involvement|Physician Note|Behaviour - Follow up)", section)
        if not typeMatch:
            continue
        
        # Skip if this is the false match line with multiple types listed together
        type_line_start = typeMatch.start()
        type_line_end = section.find('\n', type_line_start)
        if type_line_end == -1:
            type_line_end = len(section)
        type_line = section[type_line_start:type_line_end].strip()
        
        if "Type: Behaviour - Follow up, Behaviour - Responsive Behaviour" in type_line or \
           type_line.count(',') > 0:  # Skip if the Type line contains commas (multiple types)
            continue
        
        noteType = typeMatch.group(1)

        # Try to get resident name from current, next, or next-next page
        residentName = getResidentNameFromHeader(pagesText[pageIndex])
        if residentName == "Unknown" and pageIndex + 1 < len(pagesText):
            residentName = getResidentNameFromHeader(pagesText[pageIndex + 1])
        if residentName == "Unknown" and pageIndex + 2 < len(pagesText):
            residentName = getResidentNameFromHeader(pagesText[pageIndex + 2])

        # Extract note content robustly, skipping headers/footers after page breaks
        typeEnd = typeMatch.end()
        noteContent = section[typeEnd:].strip()
        # Split on double newlines (page breaks)
        noteContentParts = noteContent.split("\n\n")
        cleanedParts = []
        for part in noteContentParts:
            lines = part.splitlines()
            # Remove lines that look like headers/footers
            lines = [line for line in lines if not re.match(r"^(Facility #|Date:|Time:|Primary Physician:|User:|Progress Notes|Admission|Date of Birth|Gender|Allergies|Diagnoses|Location|Medical Record #|Physician|Pharmacy|Page \\d+ of \\d+|Author:|Signature:)", line.strip())]
            cleaned = " ".join(lines).strip()
            if cleaned:
                cleanedParts.append(cleaned)
        noteContent = " ".join(cleanedParts)
        noteContent = re.sub(r'\s+', ' ', noteContent).strip()

        if noteType in ["Behaviour - Responsive Behaviour", "Family/Resident Involvement", "Physician Note", "Behaviour - Follow up"]:
            entry = {
                "Effective Date": noteDate,
                "Resident Name": residentName,
                "Type": noteType,
                "Data": noteContent
            }
            entries.append(entry)
            logging.info(f"found entry - Date: {noteDate}, Resident: {residentName}, Type: {noteType}")
    return entries

def csvLook(csv_file="behaviour_incidents.csv"):
    """
    Reads the CSV file and updates the Type column from 'Incident - Falls' to 'Post Fall - Nursing'
    if 5 or more specified fields appear consecutively with no content between them.
    
    Args:
        csv_file (str): Path to the CSV file. Defaults to 'behaviour_incidents.csv'
    """
    try:
        # Read the CSV file
        df = pd.read_csv(csv_file)
        
        # Fields to check, in order they typically appear
        fields_to_check = [
            r"History of Falls\s*:",
            r"Resident activity/needs at the time of the fall[^:]*:",
            r"Location of Fall[^:]*:",
            r"What foot wear did the resident wear\s*:",
            r"Physical Status of Resident at time of fall[^:]*:",
            r"What mechanical devices were in use[^:]*:",
            r"Environmental status at time of fall[^:]*:",
            r"List any medication changes within the past week\s*:",
            r"Note if resident is on any anticoagulants:\s*:",
            r"Head to Toe Assessment findings:[^:]*:",
            r"Range of Motion and Weight bearing status\s*:",
            r"Fracture \(Shortening of limbs[^:]*:",
            r"Current Status of Resident[^:]*:"
        ]
        
        def check_consecutive_blank_fields(text):
            if pd.isna(text):
                return False
                
            # Convert text to single line to make pattern matching easier
            text = ' '.join(text.split())
            
            # Count fields that are effectively empty
            empty_fields = 0
            total_fields_found = 0
            
            for field in fields_to_check:
                # Find the current field in the text
                field_match = re.search(field, text)
                if not field_match:
                    continue
                    
                total_fields_found += 1
                current_pos = field_match.end()
                
                # Look for the next field or end of text
                next_pos = len(text)
                for next_field in fields_to_check:
                    next_match = re.search(next_field, text[current_pos:])
                    if next_match:
                        next_pos = current_pos + next_match.start()
                        break
                
                # Get content between fields
                content = text[current_pos:next_pos].strip()
                # Consider a field empty if it only contains ":" or "Yes." or very short content
                if not content or content in [':', 'Yes.', 'Yes'] or len(content) <= 5:
                    empty_fields += 1
            
            # If we found at least 8 fields and most are empty, consider it a Post Fall note
            return total_fields_found >= 8 and empty_fields >= (total_fields_found * 0.75)
        
        # Create a mask for rows that meet both conditions:
        # 1. Type is 'Incident - Falls'
        # 2. Has 5 or more consecutive blank fields
        mask = (df['Type'] == 'Incident - Falls') & \
               (df['Data'].apply(check_consecutive_blank_fields))
        
        # Update the Type column where the mask is True
        df.loc[mask, 'Type'] = 'Post Fall - Nursing'
        
        # Save the modified DataFrame back to CSV
        df.to_csv(csv_file, index=False)
        
        # Log the number of changes made
        changes_made = mask.sum()
        logging.info(f"Updated {changes_made} records in {csv_file}")
        
    except Exception as e:
        logging.error(f"Error processing CSV file: {str(e)}")
        
#save to a csv called behaviour_incidents.csv in the same directory that this file is run
def save_to_csv(entries, output_file="behaviour_incidents.csv"):
    if entries:
        df = pd.DataFrame(entries)
        df.to_csv(output_file, index=False)
        logging.info(f"Successfully saved {len(entries)} entries to {output_file}")
    else:
        logging.warning("No entries found to save")

def csvRemoveHeader(csv_file="behaviour_incidents.csv"):
    """
    Removes header information starting with 'Facility #' from the Data column 
    based on the note type and its specific headers.
    
    Args:
        csv_file (str): Path to the CSV file. Defaults to 'behaviour_incidents.csv'
    """
    try:
        # Read the CSV file
        df = pd.read_csv(csv_file)
        
        def clean_note(note, note_type):
            if pd.isna(note):
                return note
            
            # Base headers for each type
            post_fall_base = [
                "Data:", 
                "Action:", 
                "Response:"
            ]
            
            incident_base = [
                "Description and Time of Fall :",
                "History of Falls :",
                "Resident activity/needs at the time of the fall (i.e. getting in out of bed, chair, in pain etc.) :",
                "Location of Fall (room,dining room, toilet,shower etc) :",
                "What foot wear did the resident wear? :",
                "Physical Status of Resident at time of fall (i.e. pain, dizziness, change in lab values, drop in BS) :",
                "What mechanical devices were in use (i.e. high low bed, senor etc) :",
                "Environmental status at time of fall (i.e. w/c locked, room light, call bell accessible, etc.) :",
                "List any medication changes within the past week :",
                "Note if resident is on any anticoagulants: :",
                "Head to Toe Assessment findings: (soft tissue injury, bruising, laceration, hematoma, HIR etc.) :",
                "Range of Motion and Weight bearing status :",
                "Fracture (Shortening of limbs & external and/or internal rotation of limbs) :",
                "Current Status of Resident (is it safe to transfer resident?) :",
                "Interventions in place to prevent further falls :",
                "POA aware and response of POA :",
                "Notify Pharmacist if applicable :",
                "Physio Referral completed :"
            ]
            
            family_resident_base = [
                "Data :", 
                "Action :", 
                "Response :"
            ]
            
            physician_base = [
                "Note Text :"
            ]
            
            follow_up_base = [
                "Note Text :"
            ]
            # Check if note contains "LATE ENTRY"
            if "LATE ENTRY" in note:
                # Add "LATE ENTRY" as the first header
                if note_type == "Post Fall - Nursing":
                    headers = ["LATE ENTRY"] + post_fall_base
                elif note_type == "Family/Resident Involvement":
                    headers = ["LATE ENTRY"] + family_resident_base
                elif note_type == "Physician Note":
                    headers = ["LATE ENTRY"] + physician_base
                elif note_type == "Behaviour - Follow up":
                    headers = ["LATE ENTRY"] + follow_up_base
                else:
                    headers = ["LATE ENTRY"] + incident_base
                    
            else:
                if note_type == "Post Fall - Nursing":
                    headers = post_fall_base
                elif note_type == "Family/Resident Involvement":
                    headers = family_resident_base
                elif note_type == "Physician Note":
                    headers = physician_base
                elif note_type == "Behaviour - Follow up":
                    headers = follow_up_base
                else:
                    headers = incident_base
            
            # Remove repeated 'Facility #' sections
            while "Facility #" in note:
                facility_index = note.find("Facility #")
                
                # Find the next header or the last section
                next_header_index = len(note)
                section_end = None
                
                # Try to find the next section header
                for header in headers:
                    header_pos = note.find(header, facility_index)
                    if header_pos != -1 and header_pos < next_header_index:
                        next_header_index = header_pos
                        section_end = header_pos
                
                # If no header found, try to find POA section or last section
                if section_end is None:
                    poa_section = note.find("POA aware and response of POA", facility_index)
                    if poa_section != -1 and poa_section < next_header_index:
                        section_end = poa_section
                
                # If still no section end found, keep the entire note
                if section_end is None:
                    section_end = len(note)
                
                # Remove from Facility # to the next section
                note = note[:facility_index] + note[section_end:]
            
            return note.strip()
        
        # Apply the cleaning function to each row
        df['Data'] = df.apply(lambda row: clean_note(row['Data'], row['Type']), axis=1)
        
        # Save the modified DataFrame back to CSV
        df.to_csv(csv_file, index=False)
        
        logging.info(f"Cleaned header information from {csv_file}")
        
    except Exception as e:
        logging.error(f"Error cleaning CSV headers: {str(e)}")

def detect_injuries(data, note_type, previous_injuries):
    """
    Detect injuries in the note using GPT API to analyze the content.
    Only process notes with no previous injuries.
    """
    # Skip processing if previous injuries exist
    if previous_injuries != "No Previous Injuries":
        return previous_injuries
    
    if pd.isna(data):
        return 'No Injury'
    
    data = str(data)
    
    # Define all possible injury categories (rest of the function remains the same as before)
    injury_group1 = [
        'abrasion', 'bleeding', 'broken skin', 'bruising', 'bruise', 'burn', 
        'dislocation', 'fracture', 'frostbite', 'hematoma', 
        'hypoglycemia', 'incision'
    ]
    
    injury_group2 = [
        'laceration', 'pain', 'redness', 'scratches', 'skin tear',
        'sprain', 'strain', 'swelling', 'unconscious', 'contusion'
    ]
    
    all_injury_types = set(injury_group1 + injury_group2)
    
    try:
        # First API call for injury group 1
        prompt1 = f"""
        Carefully review the following medical note and determine which of these specific injuries are present: 
        {', '.join(injury_group1)}
        
        Only list injuries that are actually present and current (not denied, not old injuries, not "no signs of"). 
        E.X. do not list pain as an injury if the note states the resident denies pain or if there was no noted sign of pain
        List ONLY the injury terms from the provided list, separated by commas. If none are present, respond with "None".
        
        Note: {data}
        """
        
        print(f"\nAnalyzing note: {data[:200]}...")  # Print first 200 chars of note
        
        response1 = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a medical assistant trained to detect specific injuries in medical notes."},
                {"role": "user", "content": prompt1}
            ],
            max_tokens=50,
            temperature=0.1
        )
        
        # Second API call for injury group 2
        prompt2 = f"""
        Carefully review the following medical note and determine which of these specific injuries are present: 
        {', '.join(injury_group2)}
        
        Only list injuries that are actually present and current (not denied, not old injuries, not "no signs of").
        E.X. do not list pain as an injury if the note states the resident denies pain or if there was no noted sign of pain
        List ONLY the injury terms from the provided list, separated by commas. If none are present, respond with "None".
        
        Note: {data}
        """
        
        response2 = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a medical assistant trained to detect specific injuries in medical notes."},
                {"role": "user", "content": prompt2}
            ],
            max_tokens=50,
            temperature=0.1
        )
        
        # Process responses and validate injuries
        def validate_injuries(response_text, valid_injuries):
            if response_text.lower() == "none":
                return []
            
            # Split the response and clean each term
            potential_injuries = [term.strip().lower() for term in response_text.split(',')]
            
            # Only keep terms that match our predefined injury categories
            valid_terms = [term for term in potential_injuries if term in valid_injuries]
            return valid_terms
        
        # Get validated injuries from both responses
        injuries1 = validate_injuries(response1.choices[0].message.content.strip(), all_injury_types)
        injuries2 = validate_injuries(response2.choices[0].message.content.strip(), all_injury_types)
        
        print(f"Group 1 validated injuries: {injuries1}")
        print(f"Group 2 validated injuries: {injuries2}")
        
        # Combine validated injuries from both responses
        all_injuries = sorted(set(injuries1 + injuries2))
        
        result = ', '.join(all_injuries) if all_injuries else 'No Injury'
        print(f"Final validated result: {result}\n")
        return result
        
    except Exception as e:
        print(f"Error in injury detection: {str(e)}")
        logging.error(f"Error in injury detection: {str(e)}")
        return 'No Injury'
    
def add_injuries_column(csv_file="behaviour_incidents.csv"):
    """
    Add or update the Injuries column in the CSV file using GPT detection.
    Only detect injuries for rows with no previous injuries.
    
    Args:
        csv_file (str): Path to the CSV file. Defaults to 'behaviour_incidents.csv'
    """
    try:
        # Read the CSV file
        df = pd.read_csv(csv_file)
        
        # Ensure Previous_Injuries column exists, default to 'No Previous Injuries' if not
        if 'Previous_Injuries' not in df.columns:
            df['Previous_Injuries'] = 'No Previous Injuries'
        
        # Process each row and print progress
        print(f"\nProcessing {len(df)} notes for injuries...")
        
        # Only use GPT for rows with no previous injuries
        df['Injuries'] = df.apply(
            lambda row: detect_injuries(row['Data'], row['Type'], row['Previous_Injuries']), 
            axis=1
        )
        
        # Save the updated DataFrame back to CSV
        df.to_csv(csv_file, index=False)
        
        logging.info(f"Updated injuries column in {csv_file}")
        
    except Exception as e:
        logging.error(f"Error updating injuries column: {str(e)}")

def checkForHeadInjury(note: str, previous_injuries: str) -> bool:
    """
    Use OpenAI's GPT API to check for potential head injuries in the note.
    Only process notes with no previous injuries.
    
    Args:
        note (str): The text content of the note
        previous_injuries (str): Previous injuries for the note
    
    Returns:
        bool: True if head injury is detected, False otherwise
    """
    # Skip processing if previous injuries exist
    if previous_injuries != "No Previous Injuries":
        return False
    
    try:
        # Prepare the prompt for GPT
        prompt = f"""
        Carefully review the following medical note and determine if there is any indication of a physical head injury. 
        Look for terms like head trauma, impact to head, head wound, scalp injury, etc. Any issues with cognition and imbalance and head nodding are not indications of head injury
        Do not confuse occurances of "head injury routine" with a current head injury, they are not the same.
        Analyze the note twice before giving an answer and don't confuse the fall note headings for head injury information.
        Respond with ONLY 'Yes' or 'No'.
        
        Note: {note}
        
        Are there any signs of a head injury in this note?
        """
        
        # Make API call
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a medical assistant trained to detect head injuries in medical notes."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=10,
            temperature=0.2
        )
        
        # Extract and process the response
        gpt_response = response.choices[0].message.content.lower().strip()
        
        return 'yes' in gpt_response
    
    except Exception as e:
        logging.error(f"Error in head injury detection: {str(e)}")
        return False

def add_head_injury_column(csv_file="behaviour_incidents.csv"):
    """
    Add a head injury column to the existing CSV file using GPT detection.
    Only detect head injuries for rows with no previous injuries.
    
    Args:
        csv_file (str): Path to the CSV file. Defaults to 'behaviour_incidents.csv'
    """
    try:
        # Read the CSV file
        df = pd.read_csv(csv_file)
        
        # Ensure Previous_Injuries column exists, default to 'No Previous Injuries' if not
        if 'Previous_Injuries' not in df.columns:
            df['Previous_Injuries'] = 'No Previous Injuries'
        
        # Add head injury detection
        df['Temp_Head_Injury'] = df.apply(
            lambda row: checkForHeadInjury(str(row['Data']), row['Previous_Injuries']), 
            axis=1
        )
        
        # Modify Injuries column if Head Injury is detected
        df['Injuries'] = df.apply(
            lambda row: row['Injuries'] + ', Head Injury' 
            if row['Temp_Head_Injury'] and row['Injuries'] != 'No Injury' 
            else ('Head Injury' if row['Temp_Head_Injury'] else row['Injuries']), 
            axis=1
        )
        
        # Drop the temporary column
        df = df.drop(columns=['Temp_Head_Injury'])
        
        # Save the updated DataFrame back to CSV
        df.to_csv(csv_file, index=False)
        
        logging.info(f"Added head injury detection to {csv_file}")
        
    except Exception as e:
        logging.error(f"Error adding head injury column: {str(e)}")

def clean_injury_list(csv_file="behaviour_incidents.csv"):
    """
    Clean the injuries column by verifying each listed injury actually appears in the note text.
    For Incident - Falls notes, only checks text between headers in their specific order.
    
    Args:
        csv_file (str): Path to the CSV file. Defaults to 'behaviour_incidents.csv'
    """
    try:
        # Read the CSV file
        df = pd.read_csv(csv_file)
        
        def verify_injuries(injuries_str, note_text, note_type):
            if pd.isna(injuries_str) or injuries_str == 'No Injury':
                return 'No Injury'
            
            note_text = note_text.lower()
            validated_injuries = []
            injuries = [inj.strip() for inj in injuries_str.split(',')]
            
            # For Incident - Falls, we need to check only the text between headers
            if note_type == "Incident - Falls":
                # Headers in their exact order
                headers = [
                    "Description and Time of Fall :",
                    "History of Falls :",
                    "Resident activity/needs at the time of the fall (i.e. getting in out of bed, chair, in pain etc.) :",
                    "Location of Fall (room,dining room, toilet,shower etc) :",
                    "What foot wear did the resident wear? :",
                    "Physical Status of Resident at time of fall (i.e. pain, dizziness, change in lab values, drop in BS) :",
                    "What mechanical devices were in use (i.e. high low bed, senor etc) :",
                    "Environmental status at time of fall (i.e. w/c locked, room light, call bell accessible, etc.) :",
                    "List any medication changes within the past week :",
                    "Note if resident is on any anticoagulants: :",
                    "Head to Toe Assessment findings: (soft tissue injury, bruising, laceration, hematoma, HIR etc.) :",
                    "Range of Motion and Weight bearing status :",
                    "Fracture (Shortening of limbs & external and/or internal rotation of limbs) :",
                    "Current Status of Resident (is it safe to transfer resident?) :",
                    "Interventions in place to prevent further falls :",
                    "POA aware and response of POA :",
                    "Notify Pharmacist if applicable :",
                    "Physio Referral completed :"
                ]
                
                # Extract text between headers
                relevant_text = ""
                for i, header in enumerate(headers):
                    header_pos = note_text.find(header.lower())
                    if header_pos != -1:
                        # Find the start of next header or end of text
                        if i < len(headers) - 1:
                            next_header_pos = note_text.find(headers[i + 1].lower())
                            if next_header_pos == -1:
                                section_text = note_text[header_pos + len(header):].strip()
                            else:
                                section_text = note_text[header_pos + len(header):next_header_pos].strip()
                        else:
                            section_text = note_text[header_pos + len(header):].strip()
                        
                        # Only add text from relevant sections where injuries might be documented
                        if any(key_header in header.lower() for key_header in [
                            "description", "head to toe assessment", 
                            "range of motion", "current status", 
                            "physical status", "fracture"
                        ]):
                            relevant_text += section_text + " "
                
                # Use only the relevant text for injury verification
                search_text = relevant_text.lower()
            else:
                # For other note types, use the entire note
                search_text = note_text.lower()
            
            # Verify each injury
            for injury in injuries:
                injury = injury.strip().lower()
                # Special case for 'bruising' to change to 'bruise'
                if injury == 'bruising':
                    injury = 'bruise'
                # Special case for 'broken skin'
                if injury == 'broken skin':
                    if any(term in search_text for term in ['broken skin', 'skin break', 'break in skin']):
                        validated_injuries.append(injury)
                # Special case for 'skin tear'
                elif injury == 'skin tear':
                    if 'skin tear' in search_text or ('skin' in search_text and 'tear' in search_text and len(search_text.split('skin')) == len(search_text.split('tear'))):
                        validated_injuries.append(injury)
                # Check for 'head injury' specifically
                elif injury == 'head injury':
                    if ('head injury' in search_text or 
                        'hit head' in search_text or 
                        'struck head' in search_text or 
                        'impact to head' in search_text):
                        validated_injuries.append(injury)
                # Regular injuries check
                elif injury in search_text:
                    # Additional verification to ensure it's not part of a negative statement
                    surrounding_text = search_text[max(0, search_text.find(injury) - 20):
                                                 min(len(search_text), search_text.find(injury) + len(injury) + 20)]
                    if not any(neg in surrounding_text for neg in ['no ', 'not ', 'denies ', 'negative for ', 'none', 'without']):
                        validated_injuries.append(injury)
            
            return ', '.join(validated_injuries) if validated_injuries else 'No Injury'
        
        # Process each row
        print("\nValidating injuries against note content...")
        df['Injuries'] = df.apply(lambda row: verify_injuries(row['Injuries'], str(row['Data']), row['Type']), axis=1)
        
        # Save the updated DataFrame back to CSV
        df.to_csv(csv_file, index=False)
        
        logging.info(f"Cleaned injuries column in {csv_file}")
        
    except Exception as e:
        logging.error(f"Error cleaning injuries column: {str(e)}")

def searchFalls(csv_file="behaviour_incidents.csv"):
    """
    Look through CSV for Incident - Falls notes on the same day for the same resident.
    Compare against processed_incidents.csv to ensure we don't delete legitimate multiple falls.
    Remove only excess duplicate rows beyond the number of actual falls recorded.
    
    Args:
        csv_file (str): Path to the CSV file. Defaults to 'behaviour_incidents.csv'
    """
    try:
        # Read the current CSV file
        df = pd.read_csv(csv_file)
        
        # Get the original filename from the current CSV path
        # Remove '_behaviour_incidents.csv' to get the base filename
        base_filename = os.path.basename(csv_file).replace('_behaviour_incidents.csv', '')
        
        # Parse the date from the filename (format: home_unit_MM-DD-YYYY_xxxx)
        match = re.search(r'(\w+)_(\w+)_(\d{2})-(\d{2})-(\d{4})_', base_filename)
        if not match:
            logging.error(f"Could not parse filename format: {base_filename}")
            return
            
        home, unit, month, day, year = match.groups()
        home_unit = f"{home}_{unit}"

        full_csv_path = os.path.abspath(csv_file)
        currents_dir = os.path.dirname(full_csv_path)  # Gets the date directory
        homes_dir = os.path.dirname(currents_dir)       # Gets the home directory (niagara_ltc)
        base_dir = os.path.dirname(homes_dir)          # Gets the 'analyzed' directory

        # Construct the path to the processed_incidents.csv
        date_dir = f"{year}_{month}_{day}"
        processed_incidents_path = os.path.join(
            base_dir,
            home_unit,
            date_dir,
            f"{base_filename}_processed_incidents.csv"
        )
        
        # Check if processed_incidents.csv exists
        if not os.path.exists(processed_incidents_path):
            logging.warning(f"Processed incidents file not found: {processed_incidents_path}")
            return
            
        # Read the processed incidents file
        processed_df = pd.read_csv(processed_incidents_path)
        
        # Convert 'Effective Date' to datetime 
        df['Parsed_Date'] = pd.to_datetime(df['Effective Date'], format='%m/%d/%Y %H:%M')
        processed_df['date'] = pd.to_datetime(processed_df['date'])
        
        # Filter only 'Incident - Falls' type notes
        falls_df = df[df['Type'] == 'Incident - Falls'].copy()
        
        # Group by date (just the date part) and resident name
        falls_grouped = falls_df.groupby([falls_df['Parsed_Date'].dt.date, 'Resident Name'])
        
        rows_to_drop = []
        
        # For each group of falls on the same day for the same resident
        for (date, resident), group in falls_grouped:
            if len(group) > 1:  # If there are multiple falls recorded
                # Count actual falls in processed_incidents for this resident on this date
                actual_falls = len(processed_df[
                    (processed_df['date'].dt.date == date) & 
                    (processed_df['name'] == resident)
                ])
                
                if actual_falls == 0:
                    # If no falls recorded in processed_incidents, keep only the first entry
                    rows_to_drop.extend(group.iloc[1:].index.tolist())
                elif len(group) > actual_falls:
                    # If we have more fall notes than actual falls, keep only the first 'actual_falls' entries
                    # Sort by timestamp to keep the earliest entries
                    sorted_group = group.sort_values('Parsed_Date')
                    rows_to_drop.extend(sorted_group.iloc[actual_falls:].index.tolist())
        
        if rows_to_drop:
            # Drop the identified duplicate rows from the original dataframe
            df = df.drop(rows_to_drop)
            
            # Save the cleaned DataFrame back to CSV
            df.drop(columns=['Parsed_Date'], axis=1, inplace=True)
            df.to_csv(csv_file, index=False)
            
            print(f"Removed {len(rows_to_drop)} excess Incident - Falls entries")
            logging.info(f"Removed {len(rows_to_drop)} excess Incident - Falls entries")
        else:
            print("No excess Incident - Falls entries found")
            logging.info("No excess Incident - Falls entries found")
        
    except Exception as e:
        logging.error(f"Error searching and removing duplicate falls: {str(e)}")
        print(f"Error searching and removing duplicate falls: {str(e)}")

def add_previous_day_injuries(csv_file="behaviour_incidents.csv"):
    """
    Add a 'previous_injuries' column by matching rows from the previous day's CSV
    exactly matching the effective date and time.
    
    Args:
        csv_file (str): Path to the current day's CSV file
    """
    try:
        # Get the full path of the current CSV file
        full_csv_path = os.path.abspath(csv_file)
        
        # Parse the current file path components
        current_dir = os.path.dirname(full_csv_path)  # Gets the date directory
        home_dir = os.path.dirname(current_dir)       # Gets the home directory (niagara_ltc)
        base_dir = os.path.dirname(home_dir)          # Gets the 'analyzed' directory
        
        # Get home name from the home directory
        home_name = os.path.basename(home_dir)
        
        # Extract date from the current directory name (format: YYYY_MM_DD)
        current_date_dir = os.path.basename(current_dir)
        year, month, day = current_date_dir.split('_')
        
        # Calculate previous day's date
        current_date = datetime.strptime(f"{year}-{month}-{day}", "%Y-%m-%d")
        prev_date = current_date - timedelta(days=1)
        
        # Format previous day's directory name
        prev_date_dir = prev_date.strftime("%Y_%m_%d")
        
        # Construct the previous day's directory path including home name
        prev_dir = os.path.join(base_dir, home_name, prev_date_dir)
        
        # Get the base filename without the timestamp and _behaviour_incidents.csv
        current_filename = os.path.basename(full_csv_path)

        # Find the matching home name from homes_dict by checking each key
        base_name = None
        for home_key in homes_dict.keys():
            if current_filename.startswith(home_key):
                base_name = home_key
                break
                
        if not base_name:
            logging.error(f"Could not determine home name from filename: {current_filename}")
            return
        
        # Create the pattern for the previous day's file
        prev_date_pattern = prev_date.strftime("%m-%d-%Y")
        prev_file_pattern = f"{base_name}_{prev_date_pattern}_*_behaviour_incidents.csv"
        
        # Search for matching files in the previous day's directory
        prev_file_path = os.path.join(prev_dir, prev_file_pattern)
        matching_files = glob.glob(prev_file_path)
        
        if not matching_files:
            logging.warning(f"No previous day's CSV file found matching pattern: {prev_file_path}")
            return
            
        # Use the first matching file
        previous_csv_path = matching_files[0]
        
        # Read both CSVs
        current_df = pd.read_csv(full_csv_path)
        previous_df = pd.read_csv(previous_csv_path)
        
        # Convert Effective Date to datetime for both dataframes
        current_df['Parsed_Date'] = pd.to_datetime(current_df['Effective Date'], format='%m/%d/%Y %H:%M')
        previous_df['Parsed_Date'] = pd.to_datetime(previous_df['Effective Date'], format='%m/%d/%Y %H:%M')
        
        def find_exact_previous_injuries(row):
            # Find EXACT matches in the previous day's data, matching both date and time
            matches = previous_df[
                (previous_df['Parsed_Date'] == row['Parsed_Date']) & 
                (previous_df['Resident Name'] == row['Resident Name'])
            ]
            
            # If matches exist, concatenate all their injuries
            if not matches.empty:
                unique_injuries = set()
                for injuries in matches['Injuries']:
                    # Split and add non-empty
                    if pd.notna(injuries):
                        unique_injuries.update(inj.strip() for inj in str(injuries).split(','))
                # Check for head injury specifically
                head_injury_exists = any('Head Injury' in str(injuries) for injuries in matches['Injuries'])
                
                # Ensure head injury is added if it exists
                if head_injury_exists:
                    unique_injuries.add('Head Injury')
                
                return ', '.join(unique_injuries) if unique_injuries else 'No Previous Injuries'
            
            return 'No Previous Injuries'
        
        # Add previous injuries column
        current_df['Previous_Injuries'] = current_df.apply(find_exact_previous_injuries, axis=1)
        
        # Drop the temporary parsed date column
        current_df = current_df.drop(columns=['Parsed_Date'], errors='ignore')
        
        # Save the updated DataFrame back to CSV
        current_df.to_csv(full_csv_path, index=False)
        
        logging.info(f"Added previous day's exact injuries to {full_csv_path} from {previous_csv_path}")
        print(f"Added previous day's exact injuries from {previous_csv_path}")
        
    except Exception as e:
        logging.error(f"Error adding previous day's exact injuries: {str(e)}")
        print(f"Error adding previous day's exact injuries: {str(e)}")

def extract_info_from_filename(filename):
    match = re.search(r'(?P<dashboard>[\w_]+)_(?P<month>\d{2})-(?P<day>\d{2})-(?P<year>\d{4})', filename)
    if match:
        dashboard = homes_dict.get(match.group('dashboard'), 'unknown')  
        year = match.group('year')
        month = match.group('month')
        day = match.group('day')
        return dashboard, year, month, day
    return None, None, None, None

def main(api_key: str):
    global client
    client = openai.OpenAI(api_key=api_key)

    pdf_files = glob.glob("downloads/*.pdf")

    if not pdf_files:
        logging.error("No PDF files found in the downloads directory.")
        return

    # Create the analyzed directory if it doesn't exist
    analyzed_dir = os.path.join(os.path.abspath(os.getcwd()), "analyzed")
    if not os.path.exists(analyzed_dir):
        os.makedirs(analyzed_dir)

    # Create subdirectories for each home
    for home in homes:
        home_dir = os.path.join(analyzed_dir, home.replace(" ", "_").replace("-", "_").lower())
        if not os.path.exists(home_dir):
            os.makedirs(home_dir)

    for pdf_path in pdf_files:
        logging.info(f"Starting PDF parsing process for: {pdf_path}")
        
        pagesText = extract_text_from_pdf(pdf_path)
        if not pagesText:
            logging.error(f"Failed to extract text from PDF: {pdf_path}")
            continue
        
        entries = getAllFallNotesInfo(pagesText)
        
        # Determine the home name from the PDF file name
        home_name = next((home for home in homes if home.lower().replace(" ", "_") in pdf_path.lower()), None)

        if home_name:
            home_dir = os.path.join(analyzed_dir, home_name.replace(" ", "_").replace("-", "_").lower())
            
            # Extract date information from the filename
            _, year, month, day = extract_info_from_filename(os.path.basename(pdf_path))
            if year and month and day:
                date_dir = os.path.join(home_dir, f"{year}_{month}_{day}")
                if not os.path.exists(date_dir):
                    os.makedirs(date_dir)
                
                # Save the CSV in the date-specific subdirectory
                output_csv = os.path.join(date_dir, f"{os.path.splitext(os.path.basename(pdf_path))[0]}_behaviour_incidents.csv")
                save_to_csv(entries, output_csv)
                csvLook(output_csv)
                csvRemoveHeader(output_csv)
                add_previous_day_injuries(output_csv)
                add_injuries_column(output_csv)
                clean_injury_list(output_csv)
                add_head_injury_column(output_csv)
                searchFalls(output_csv)
            else:
                logging.error(f"Date information not found in PDF file: {pdf_path}")
        else:
            logging.error(f"Home name not found in PDF file: {pdf_path}")
    
    logging.info("Process completed")

if __name__ == "__main__":
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY not found in .env file")
    main(openai_api_key)