import pandas as pd
from datetime import datetime, timedelta
import openai
import time
import re
import os
from homes_db import homes_dict
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))

def get_poa_contact_status(text):
    """
    Use OpenAI API to determine if POA was contacted based on text description.
    
    Parameters:
    text (str): Text describing POA contact
    
    Returns:
    str: 'yes' or 'no'
    """

    text = str(text).lower().strip()
    yes_keywords = ['yes', 'notified']
    if any(keyword in text for keyword in yes_keywords):
        print("poa YES found, not sending to api")
        return 'yes'
    else:
        print("no YES found, sending to API")
        try:
            prompt = f"""Based on the following text, determine if the POA (Power of Attorney) was contacted.
    Text: {text}

    Answer only with 'yes' or 'no'. If unclear or not mentioned, answer 'no'."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a healthcare analyst determining if POA was contacted. Answer only with 'yes' or 'no'."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=10
            )
            
            result = response.choices[0].message.content.strip().lower()
            time.sleep(0.5)  # Rate limiting
            
            return 'yes' if result == 'yes' else 'no'
        
        except Exception as e:
            print(f"Error getting POA contact status from OpenAI: {str(e)}")
            return 'no'
    
def get_behaviour_summary(data, openai_api_key):
    """Extracts the text between 'Describe the behaviour :' and 'Disruptiveness (Data)/Consequences to the behaviour :' and summarizes it using ChatGPT."""
    data = str(data)
    match = re.search(r"Describe the behaviour :(.*?)(Disruptiveness \(Data\)/Consequences to the behaviour :|$)", data, re.DOTALL)
    behaviour_text = match.group(1).strip() if match else ''
    if not behaviour_text:
        return ''
    openai.api_key = openai_api_key
    prompt = f"Summarize the following behaviour description in 1-2 sentences:\n{behaviour_text}"
    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a healthcare analyst summarizing behaviour incidents."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=60
        )
        summary = response.choices[0].message.content.strip()
        return summary
    except Exception as e:
        print(f"Error getting behaviour summary from OpenAI: {str(e)}")
        return ''

def check_poa_contact(df_notes, incident_index, resident_name, initial_poa_status):
    """
    Check for POA contact in incident note and associated post-fall notes.
    Returns updated POA contact status.
    """
    current_status = initial_poa_status
    
    # Check post-fall notes
    current_index = incident_index - 1
    while current_index >= 0:
        current_row = df_notes.iloc[current_index]
        
        if current_row['Resident Name'] == resident_name:
            if current_row['Type'] == 'Incident - Falls':
                break
            elif current_row['Type'] == 'Post Fall - Nursing':
                note_text = str(current_row['Data']).lower()
                
                # Look for sentences containing "poa"
                sentences = note_text.split('.')
                for sentence in sentences:
                    if 'poa' in sentence:
                        poa_status = get_poa_contact_status(sentence)
                        if poa_status == 'yes':
                            return 'yes'
        
        current_index -= 1
    
    return current_status

def clean_name(name):
    """Clean and standardize resident name format."""
    if pd.isna(name):
        return ''
    name = str(name).strip()
    if ',' in name:
        last, first = name.split(',', 1)
        return f"{last.strip()}, {first.strip()}"
    return name

def gpt_determine_who_affected(row, openai_api_key):
    """
    Use OpenAI API to determine who was affected by the incident based on the incident's information.
    Returns a comma-separated list of any of: Resident Initiated, Resident Received, Staff Received.
    """
    prompt = f"""
    Based on the following incident information, classify who was affected. Choose ALL that apply from the following categories and answer with a comma-separated list:
    - Resident Initiated
    - Resident Received
    - Staff Received

    Incident Type: {row.get('incident_type', '')}
    Behaviour Type: {row.get('behaviour_type', '')}
    Description: {row.get('description', '')}
    Consequences: {row.get('consequences', '')}
    Interventions: {row.get('interventions', '')}
    
    Answer with a comma-separated list of the categories above. If unclear, answer with the most likely categories.
    """
    try:
        openai.api_key = openai_api_key
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a healthcare analyst classifying who was affected in a behaviour incident. Answer with a comma-separated list of the four categories, choosing all that apply."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            max_tokens=20
        )
        result = response.choices[0].message.content.strip()
        # Validate and clean result
        valid_categories = [
            "Resident Initiated",
            "Resident Received",
            "Staff Received",
            "Staff Initiated"
        ]
        # Split and clean
        selected = [cat.strip() for cat in result.split(',') if cat.strip() in valid_categories]
        if selected:
            return ', '.join(selected)
        else:
            return "Resident Initiated"  # Default fallback
    except Exception as e:
        print(f"Error getting who_affected from OpenAI: {str(e)}")
        return "Resident Initiated"

def check_code_white(row):
    """Check if 'code white' is mentioned in any of the text fields."""
    # Fields to check for code white
    fields_to_check = ['description', 'consequences', 'interventions', 'behaviour_type']
    
    for field in fields_to_check:
        text = str(row.get(field, '')).lower()
        if 'code white' in text.replace('-', ' ').replace('_', ' '):
            return 'yes'
    
    return 'no'

def check_prn(row):
    """Check if 'PRN' is mentioned in any of the text fields."""
    # Fields to check for PRN
    fields_to_check = ['description', 'consequences', 'interventions', 'medication_changes', 'outcome']
    
    for field in fields_to_check:
        text = str(row.get(field, '')).lower()
        if 'prn' in text:
            return 'yes'
    
    return 'no'

def extract_field(text, field_name):
    """Extract field value from the text with specific end markers for each field."""
    try:
        text = str(text)
        start_idx = text.index(field_name) + len(field_name)
        
        # Define specific end markers for different fields
        end_markers = {
            'Type of Behaviour :': ['Antecedent/Triggers', 'Page'],
            'Antecedent/Triggers :': ['Describe the behaviour', 'Page'],
            'Describe the behaviour :': ['Disruptiveness', 'Page'],
            'Disruptiveness (Data)/Consequences to the behaviour :': ['Interventions', 'Page'],
            'Interventions (review/update care plan) (Action) :': ['Change in medication', 'Page'],
            'Change in medication :': ['What are the risks and causes', 'Page'],
            'What are the risks and causes :': ['Outcome(s)(Result)', 'Page'],
            'Outcome(s)(Result) :': ['Substitute Decision Maker', 'Page'],
            'Substitute Decision Maker notified (if not, explain) :': ['Page', 'Range']
        }
        
        markers = end_markers.get(field_name, [])
        if not markers:
            return text[start_idx:].strip() or "No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM Within 24hrs of RIM"
        
        end_positions = []
        for marker in markers:
            try:
                pos = text.index(marker, start_idx)
                end_positions.append(pos)
            except ValueError:
                continue
        
        if end_positions:
            end_idx = min(end_positions)
            result = text[start_idx:end_idx].strip()
        else:
            result = text[start_idx:].strip()
        
        return result if result else "No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM Within 24hrs of RIM"
        
    except (ValueError, AttributeError):
        return "No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM Within 24hrs of RIM"

def check_hir_status(df_notes, incident_index, resident_name):
    """Check for HIR status in incident note and associated post-fall notes."""
    hir_keywords = ['hir initiated', 'hir continued','head injury routine']
    incident_note = df_notes.iloc[incident_index]['Data'].lower()
    
    if any(keyword in incident_note for keyword in hir_keywords):
        return True
        
    current_index = incident_index - 1
    while current_index >= 0:
        current_row = df_notes.iloc[current_index]
        
        if current_row['Resident Name'] == resident_name:
            if current_row['Type'] == 'Incident - Falls':
                break
            elif current_row['Type'] == 'Post Fall - Nursing':
                note_text = str(current_row['Data']).lower()
                if 'hir' in note_text:
                    return True
        
        current_index -= 1
    
    return False

def check_hospital_transfer(df_notes, incident_index, resident_name):
    """Check for hospital transfer keywords in incident note and associated post-fall notes."""
    hospital_keywords = ['hospital', 'ambulance', '911']
    incident_note = df_notes.iloc[incident_index]['Data'].lower()
    
    if any(keyword in incident_note for keyword in hospital_keywords):
        return True
    
    current_index = incident_index - 1
    while current_index >= 0:
        current_row = df_notes.iloc[current_index]
        
        if current_row['Resident Name'] == resident_name:
            if current_row['Type'] == 'Incident - Falls':
                break
            elif current_row['Type'] == 'Post Fall - Nursing':
                note_text = str(current_row['Data']).lower()
                if any(keyword in note_text for keyword in hospital_keywords):
                    return True
        
        current_index -= 1
    
    return False

def count_post_fall_notes(df_notes, incident_index):
    """Count post-fall notes starting from an incident until the next incident."""
    count = 0
    current_index = incident_index - 1
    resident_name = df_notes.iloc[incident_index]['Resident Name']
    
    while current_index >= 0:
        current_row = df_notes.iloc[current_index]
        
        if current_row['Resident Name'] == resident_name:
            if current_row['Type'] == 'Incident - Falls':
                break
            elif current_row['Type'] == 'Post Fall - Nursing': 
                count += 1
        
        current_index -= 1
    
    return count

def get_injuries_from_notes(df_notes, incident_index, resident_name):
    """
    Get all unique injuries from incident note and subsequent post-fall notes until next incident.
    Returns concatenated string of all unique injuries found.
    """
    unique_injuries = set()  # Use a set to track unique injuries
    
    # Get injuries from incident note
    incident_injuries = df_notes.iloc[incident_index]['Injuries']
    if incident_injuries and incident_injuries != "No Injury":
        # Split multiple injuries and add each one
        for injury in incident_injuries.lower().split(','):
            unique_injuries.add(injury.strip())
    
    # Check subsequent post-fall notes
    current_index = incident_index - 1
    while current_index >= 0:
        current_row = df_notes.iloc[current_index]
        
        if current_row['Resident Name'] == resident_name:
            if current_row['Type'] == 'Incident - Falls':
                break
            elif current_row['Type'] == 'Post Fall - Nursing':
                note_injuries = current_row['Injuries']
                if note_injuries and note_injuries != "No Injury":
                    # Split multiple injuries and add each one
                    for injury in note_injuries.lower().split(','):
                        unique_injuries.add(injury.strip())
        
        current_index -= 1
    
    # Convert back to a sorted list and join with commas
    if unique_injuries:
        # Capitalize first letter of each injury
        formatted_injuries = [injury.capitalize() for injury in sorted(unique_injuries)]
        return ', '.join(formatted_injuries)
    return "No Injury"

def check_rnao_assessment(df_notes, incident_index, resident_name):
    """Check if an RNAO post fall assessment was completed after the fall incident."""
    current_index = incident_index - 1
    while current_index >= 0:
        current_row = df_notes.iloc[current_index]
        
        if current_row['Resident Name'] == resident_name:
            if current_row['Type'] == 'Incident - Falls':
                break
            elif current_row['Type'] == 'RNAO - Post Fall Assessment':
                return True
        
        current_index -= 1
    
    return False

def process_behaviour_notes(df_notes):
    """Process behaviour notes to extract required information."""
    incidents = []
    
    for index, row in df_notes.iterrows():
        if row['Type'] == 'Behaviour - Responsive Behaviour':
            data = row['Data']
            
            incident = {
                'name': clean_name(row['Resident Name']),
                'datetime': pd.to_datetime(row['Effective Date']),
                'date': pd.to_datetime(row['Effective Date']).strftime('%Y-%m-%d'),
                'time': pd.to_datetime(row['Effective Date']).strftime('%H:%M:%S'),
                'behaviour_type': extract_field(data, 'Type of Behaviour :'),
                'triggers': extract_field(data, 'Antecedent/Triggers :'),
                'description': extract_field(data, 'Describe the behaviour :'),
                'consequences': extract_field(data, 'Disruptiveness (Data)/Consequences to the behaviour :'),
                'interventions': extract_field(data, 'Interventions (review/update care plan) (Action) :'),
                'medication_changes': extract_field(data, 'Change in medication :'),
                'risks': extract_field(data, 'What are the risks and causes :'),
                'outcome': extract_field(data, 'Outcome(s)(Result) :'),
                'poa_notified': extract_field(data, 'Substitute Decision Maker notified (if not, explain) :'),
                'injuries': row.get('Injuries', 'No Injury') if pd.notna(row.get('Injuries')) else 'No Injury'
            }
            incidents.append(incident)
    
    # Ensure DataFrame has expected columns even when empty
    if not incidents:
        return pd.DataFrame(columns=['name', 'datetime', 'date', 'time', 'behaviour_type', 'triggers', 
                                      'description', 'consequences', 'interventions', 'medication_changes', 
                                      'risks', 'outcome', 'poa_notified', 'injuries'])
    return pd.DataFrame(incidents)

def collect_other_notes(row, df_notes):
    """Find and match other note types for a specific incident within a 48-hour window."""
    other_note_types = ['Behaviour - Follow up']
    collected_notes = []
    
    
    family_resident_headers = [
        "Data :", 
        "Action :", 
        "Response :"
    ]
    
    physician_headers = [
        "Note Text :"
    ]
    
    follow_up_headers = [
        "Note Text :"
    ]

    for index, r in df_notes.iterrows():
        if (r['Type'] in other_note_types and 
            r['Resident Name'] == row['name']):
            note_datetime = pd.to_datetime(r['Effective Date'])
            time_diff = abs(note_datetime - row['datetime'])
            
            if time_diff <= timedelta(hours=48):
                # Add note to list, with formatted date and type
                note_date = note_datetime.strftime('%Y-%m-%d %H:%M')
                
                # Clean data, remove "Facility #" or "Effective Date Range" sections up to the next header
                junk_markers = ["Facility #", "Effective Date Range"]
                for marker in junk_markers:
                    if marker in r['Data']:
                        marker_index = r['Data'].find(marker)
                        
                        # Find the next valid header after the marker
                        next_header_index = len(r['Data'])  # default to end of string
                        
                        # Check all header types to find the closest one after the marker
                        for header in family_resident_headers + physician_headers + follow_up_headers:
                            header_index = r['Data'].find(header, marker_index)
                            if header_index != -1 and header_index < next_header_index:
                                next_header_index = header_index
                        
                        # Remove from marker to next header (or end if no header found)
                        r['Data'] = r['Data'][:marker_index] + r['Data'][next_header_index:]
                            
                note_entry = f"{r['Type']} ({note_date}): {r['Data']}"
                collected_notes.append(note_entry)
    
    # Format notes with date, type, and data 
    return '<br>'.join(collected_notes) if collected_notes else 'No other notes'

def gpt_summarize_incident(row, openai_api_key):
    """
    Use OpenAI API to summarize the incident in 1-2 sentences using the specified columns.
    """
    # If all relevant fields indicate missing progress note, return short message
    default_indicators = [
        "No Progress Note Found Within 24hrs of RIM",
        "No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM",
        "No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM Within 24hrs of RIM"
    ]
    relevant_fields = ['behaviour_type', 'description', 'outcome']
    if all(any(indicator in str(row.get(field, '')) for indicator in default_indicators) for field in relevant_fields):
        return "No Progress within 24hrs of RIM"

    prompt = f"""
    Summarize the following incident in 1-2 sentences for a report, nothing more. Use the information provided:
    Behaviour Type: {row.get('behaviour_type', '')}
    Description: {row.get('description', '')}
    Outcome: {row.get('outcome', '')}
    """
    try:
        openai.api_key = openai_api_key
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a healthcare analyst summarizing behaviour incidents for a report. Summarize the incident in 1-2 sentences, include details. Do not include any other text."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.15,
            max_tokens=60
        )
        summary = response.choices[0].message.content.strip()
        return summary
    except Exception as e:
        print(f"Error getting summary from OpenAI: {str(e)}")
        return "No Progress within 24hrs of RIM"

def gpt_determine_intent(summary, openai_api_key):
    """
    Use OpenAI API to determine if there was intent behind the incident based on the summary.
    """
    prompt = f"""
    Based on the following incident summary, determine if the resident's actions were intentional.
    The resident's actions are considered intentional if they are goal-oriented, premeditated, or if the resident is cognitively aware and directing their actions towards a specific person or object.
    Actions that are unintentional may be described as random, purposeless, a result of confusion, or without a clear target.

    Summary: "{summary}"

    Based on this, was the action intentional? Answer only with 'yes' or 'no'.
    """
    try:
        openai.api_key = openai_api_key
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a healthcare analyst determining intent in a resident's actions. Answer only with 'yes' or 'no'."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            max_tokens=5
        )
        result = response.choices[0].message.content.strip().lower()
        return 'yes' if result == 'yes' else 'no'
    except Exception as e:
        print(f"Error getting intent from OpenAI: {str(e)}")
        return 'no'

def determine_ci_status(row, openai_api_key):
    """Determines the CI status based on incident_type, who_affected, and summary."""
    incident_type = str(row.get('incident_type', '')).lower()
    who_affected = str(row.get('who_affected', '')).lower()
    summary = str(row.get('summary', ''))

    # Condition 1: 'Physical Aggression Initiated' in incident_type
    cond1 = 'physical aggression initiated' in incident_type

    # Condition 2: 'Resident Initiated' and 'Resident Received' in who_affected
    cond2 = 'resident initiated' in who_affected and 'resident received' in who_affected

    if cond1 and cond2:
        # Condition 3: GPT determines intent from summary
        if summary and "no progress" not in summary.lower():
            intent = gpt_determine_intent(summary, openai_api_key)
            if intent == 'yes':
                return 'yes'

    return 'no'

def save_followup_notes_csv(behaviour_csv, output_file):
    """Save all followup-type notes from the original notes into a separate CSV file (no time filtering)."""
    
    print(f"\nExtracting follow-up notes for {output_file}...")
    followup_records = []

    target_types = { 'Behaviour - Follow up'}
    extra_target_types = {'Family/Resident Involvment', 'Physician Note',}

    # Read the behaviour CSV
    df_notes = pd.read_csv(behaviour_csv)
    
    # Ensure Effective Date is datetime
    if not pd.api.types.is_datetime64_any_dtype(df_notes['Effective Date']):
        df_notes = df_notes.copy()
        df_notes['Effective Date'] = pd.to_datetime(df_notes['Effective Date'])

    # Find follow up notes
    for _, note in df_notes.iterrows():
        if note['Type'] in target_types:
            note_dt = pd.to_datetime(note['Effective Date'])

            # Clean data similar to collect_other_notes
            data_text = note['Data']
            junk_markers = ["Facility #", "Effective Date Range"]
            for marker in junk_markers:
                if marker in data_text:
                    marker_index = data_text.find(marker)
                    next_header_index = len(data_text)
                    for header in ["Data :", "Action :", "Response :", "Note Text :"]:
                        header_index = data_text.find(header, marker_index)
                        if header_index != -1 and header_index < next_header_index:
                            next_header_index = header_index
                    data_text = data_text[:marker_index] + data_text[next_header_index:]

            # Generate AI summary of the follow-up note
            # try:
            #     print(f"Generating summary for follow-up note: {data_text}")
            #     response = openai.chat.completions.create(
            #         model="gpt-3.5-turbo",
            #         messages=[
            #             {"role": "system", "content": "You are a medical assistant summarizing nursing notes about resident behaviour follow-ups. Provide a concise summary in 1-2 sentences. If data is missing, note that the data format is invalid"},
            #             {"role": "user", "content": f"Summarize this follow-up note:\n\n{data_text}"}
            #         ],
            #         temperature=0.3,
            #         max_tokens=100
            #     )
            #     summary = response.choices[0].message.content.strip()
            # except Exception as e:
            #     print(f"Error generating summary for follow-up note: {str(e)}")
            #     summary = data_text
            
            followup_records.append({
                'id': '',  # not linked to incident id when exporting all followups
                'resident_name': clean_name(note['Resident Name']),
                'date': note_dt.strftime('%Y-%m-%d'),
                'time': note_dt.strftime('%H:%M:%S'),
                'other_notes': '',
                'summary_of_behaviour': data_text.split("Note Text :", 1)[1].strip() if "Note Text :" in data_text else data_text
            })
            
    # Build quick index for closest-match lookups by resident
    if followup_records:
        record_datetimes = [pd.to_datetime(r['date'] + ' ' + r['time']) for r in followup_records]
        name_to_indices = {}
        for i, r in enumerate(followup_records):
            name_to_indices.setdefault(r['resident_name'], []).append(i)
            


        # For each extra note, find closest prior Behaviour - Follow up for same resident
        print(f"Finding matching follow-up notes for extra notes...")
        for _, fam_note in df_notes.iterrows():
            if fam_note['Type'] in extra_target_types:
                resident = clean_name(fam_note['Resident Name'])
                if resident not in name_to_indices:
                    continue
                fam_dt = pd.to_datetime(fam_note['Effective Date'])

                # Clean data similar to above
                fam_text = fam_note['Data']
                junk_markers = ["Facility #", "Effective Date Range"]
                for marker in junk_markers:
                    if marker in fam_text:
                        marker_index = fam_text.find(marker)
                        next_header_index = len(fam_text)
                        for header in ["Data :", "Action :", "Response :", "Note Text :"]:
                            header_index = fam_text.find(header, marker_index)
                            if header_index != -1 and header_index < next_header_index:
                                next_header_index = header_index
                        fam_text = fam_text[:marker_index] + fam_text[next_header_index:]

                # Choose closest follow-up record that occurred BEFORE the extra note 
                candidate_indices = name_to_indices[resident]
                candidate_indices_pre = [i for i in candidate_indices if record_datetimes[i] <= fam_dt]
                if not candidate_indices_pre:
                    continue
                # Among prior follow-ups, choose the one with the smallest positive time difference
                closest_idx = min(candidate_indices_pre, key=lambda i: (fam_dt - record_datetimes[i]))
                append_text = f"{fam_note['Type']}: {fam_text}"
                if followup_records[closest_idx]['other_notes']:
                    followup_records[closest_idx]['other_notes'] += '<br>' + append_text
                else:
                    followup_records[closest_idx]['other_notes'] = append_text
                print(f"Added follow-up note for {resident} at {fam_dt} to {followup_records[closest_idx]['date']} {followup_records[closest_idx]['time']}")

    if followup_records:
        df_followup = pd.DataFrame(followup_records)
        df_followup.to_csv(output_file, index=False)
        print(f"Successfully saved followup notes to {output_file}")
        return output_file
    return None

def merge_behaviour_data(processed_csv, behaviour_csv, output_file, openai_api_key=None):
    """Merge processed incidents with detailed behaviour data."""
    
    # Read the CSVs
    df_processed = pd.read_csv(processed_csv)
    df_behaviour = pd.read_csv(behaviour_csv)
    
    # Clean names in both dataframes
    df_processed['name'] = df_processed['name'].apply(clean_name)
    
    # Convert dates to datetime
    df_processed['datetime'] = pd.to_datetime(df_processed['date'] + ' ' + df_processed['time'])
    df_behaviour['Effective Date'] = pd.to_datetime(df_behaviour['Effective Date'])
    
    # Process behaviour notes
    df_behaviour_processed = process_behaviour_notes(df_behaviour)
    
    # Initialize the merged dataframe with processed data
    df_merged = df_processed.copy()
    
    # Initialize columns that would come from behaviour notes with default values
    missing_note_defaults = {
        'behaviour_type': 'No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM Within 24hrs of RIM',
        'triggers': 'No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM Within 24hrs of RIM',
        'description': 'No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM',
        'consequences': 'No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM',
        'interventions': 'No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM',
        'medication_changes': 'No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM',
        'risks': 'No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM',
        'outcome': 'No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM',
        'poa_notified': 'No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM'
    }
    
    for column, default_value in missing_note_defaults.items():
        df_merged[column] = default_value
    
    # Function to find matching behaviour note within 3-hour window
    def find_matching_behaviour(row, df_behaviour):
        incident_time = row['datetime']
        name = row['name']
        
        # Filter behaviour notes for the same resident
        resident_notes = df_behaviour[df_behaviour['name'] == name]
        
        if resident_notes.empty:
            return None
        
        # Calculate time differences
        time_diffs = abs(resident_notes['datetime'] - incident_time)
        
        # Find closest note within 3 hours
        within_window = time_diffs[time_diffs <= timedelta(hours=20)]
        
        if not within_window.empty:
            closest_idx = within_window.idxmin()
            return resident_notes.loc[closest_idx]
        
        return None
    
    # Update merged dataframe with matching behaviour data
    print("\nMatching incidents with behaviour notes...")
    for idx, row in df_merged.iterrows():
        try:
            matching_behaviour = find_matching_behaviour(row, df_behaviour_processed)
            
            if matching_behaviour is not None:
                print(f"Found matching behaviour note for {row['name']} at {row['datetime']}")
                # Update all relevant columns from the behaviour note
                for column in missing_note_defaults.keys():
                    df_merged.at[idx, column] = matching_behaviour[column]
            else:
                print(f"No matching behaviour note found for {row['name']} at {row['datetime']}")
        except Exception as e:
            print(f"ERROR in matching loop at index {idx}: {str(e)}")
            print(f"Row keys: {row.keys().tolist()}")
            raise
    
    # Add new columns
    print("\nAdding who affected, code white, PRN, and other notes columns...")
    default_no_progress = "No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM"
    relevant_fields = ['behaviour_type', 'description', 'outcome']
    if openai_api_key:
        def who_affected_logic(row):
            if all(str(row.get(field, '')) == default_no_progress for field in relevant_fields):
                return default_no_progress
            return gpt_determine_who_affected(row, openai_api_key)
        df_merged['who_affected'] = df_merged.apply(who_affected_logic, axis=1)
    else:
        df_merged['who_affected'] = 'Resident Initiated'  # fallback if no key provided
    df_merged['code_white'] = df_merged.apply(check_code_white, axis=1)
    df_merged['prn'] = df_merged.apply(check_prn, axis=1)
    
    # Add other_notes column
    df_merged['other_notes'] = df_merged.apply(
        collect_other_notes, 
        axis=1,
        df_notes=df_behaviour
    )
    # Add summary column using OpenAI
    if openai_api_key:
        print("\nGenerating summaries for each incident using OpenAI...")
        df_merged['summary'] = df_merged.apply(lambda row: gpt_summarize_incident(row, openai_api_key), axis=1)
    else:
        df_merged['summary'] = ''
    
    # Add CI column
    if openai_api_key:
        print("\nDetermining CI status for each incident...")
        df_merged['CI'] = df_merged.apply(lambda row: determine_ci_status(row, openai_api_key), axis=1)
    else:
        df_merged['CI'] = 'no'
    
    # Clean up the dataframe
    df_merged = df_merged.drop(columns=['datetime'])  # Remove the datetime column used for matching
    
    # Ensure date and time columns are properly formatted
    df_merged['date'] = pd.to_datetime(df_merged['date']).dt.strftime('%Y-%m-%d')
    df_merged['Day of the Week'] = pd.to_datetime(df_merged['date']).dt.day_name()
    
    # Fill any remaining NA values
    df_merged = df_merged.fillna('No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM Within 24hrs of RIM')
    
    # Add id column starting from 0
    df_merged['id'] = range(len(df_merged))
    
    # Reorder columns to ensure date, time, and day of the week are at the beginning
    cols = df_merged.columns.tolist()
    cols = ['id', 'date', 'time', 'Day of the Week'] + [col for col in cols if col not in ['id', 'date', 'time', 'Day of the Week']]
    df_merged = df_merged[cols]

    # Drop columns not needed in the final CSV
    columns_to_drop = [
        'description',
        'consequences',
        'medication_changes',
        'risks',
        'outcome'
    ]
    df_merged = df_merged.drop(columns=[col for col in columns_to_drop if col in df_merged.columns])

    # Sort by date and time descending (most recent first)
    df_merged = df_merged.sort_values(by=['date', 'time'], ascending=[False, False]).reset_index(drop=True)

    df_merged.to_csv(output_file, index=False)
    print(f"\nSuccessfully merged data and saved to {output_file}")
    
    return df_merged

def extract_info_from_filename(filename):
    match = re.search(r'(?P<dashboard>[\w_]+)_(?P<month>\d{2})-(?P<day>\d{2})-(?P<year>\d{4})', filename)
    if match:
        dashboard = homes_dict.get(match.group('dashboard'), 'unknown')  
        year = match.group('year')
        month = match.group('month')
        day = match.group('day')
        return dashboard, year, month, day
    return None, None, None, None

def process_directory(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith("processed_incidents.csv"):
                processed_file = os.path.join(root, file)
                
                try:
                    # Construct corresponding behaviour file path
                    base_name = os.path.basename(processed_file).replace("processed_incidents.csv", "")
                    behaviour_file_path = os.path.join(root, f"{base_name}behaviour_incidents.csv")

                    if not os.path.exists(behaviour_file_path):
                        print(f"Skipping: Could not find corresponding behaviour file for {processed_file}")
                        continue

                    output_file = os.path.join(root, f"{base_name}merged.csv")
                    
                    print(f"Merging: {processed_file} and {behaviour_file_path}")
                    openai_api_key = os.getenv("OPENAI_API_KEY")
                    if not openai_api_key:
                        raise ValueError("OPENAI_API_KEY not found in .env file")
                    
                    merge_behaviour_data(processed_file, behaviour_file_path, output_file, openai_api_key=openai_api_key)
                    print(f"Successfully created merged file: {output_file}\n")

                except Exception as merge_error:
                    print(f"Error merging file {processed_file}: {str(merge_error)}\n")
                    continue
            
            if file.endswith("behaviour_incidents.csv"):
                behaviour_file_path = os.path.join(root, file)
                try:
                    # Save followup notes CSV
                    output_file = behaviour_file_path.replace("behaviour_incidents.csv", "follow.csv")
                    save_followup_notes_csv(behaviour_file_path, output_file)
                except Exception as follow_error:
                    print(f"Error creating followup notes for {behaviour_file_path}: {str(follow_error)}\n")
                    continue

if __name__ == "__main__":
    process_directory("analyzed")