import pandas as pd
from datetime import datetime, timedelta
import openai
import time
import re
import os
from homes_db import homes_dict
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))

home = "test"   

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
        
        # Define specific end markers for Behaviour Note format only
        end_markers = {
            'Behaviour Displayed :': ['Intervention :', 'Time, Frequency', 'Page'],
            'Intervention :': ['Time, Frequency', 'Evaluation of Intervention', 'Page'],
            'Time, Frequency and # of Staff :': ['Evaluation of Intervention', 'Resident Response', 'Page'],
            'Evaluation of Intervention :': ['Resident Response', 'Page', '________________'],
            'Resident Response :': ['Page', '________________', 'SIGNED]']
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
    
    # Get injuries from incident note - check if Injuries column exists
    if 'Injuries' in df_notes.columns:
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
                if 'Injuries' in df_notes.columns:
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
        # Only process 'Behaviour Note' type
        if row['Type'] == 'Behaviour Note':
            data = row['Data']
            
            # Extract information from Behaviour Note format
            behaviour_description = extract_field(data, 'Behaviour Displayed :')
            interventions = extract_field(data, 'Intervention :')
            time_frequency = extract_field(data, 'Time, Frequency and # of Staff :')
            evaluation = extract_field(data, 'Evaluation of Intervention :')
            resident_response = extract_field(data, 'Resident Response :')
            
            injuries = 'No Injury'
            if 'Injuries' in df_notes.columns and pd.notna(row['Injuries']):
                injuries = row['Injuries']
                
            incident = {
                'name': clean_name(row['Resident Name']),
                'datetime': pd.to_datetime(row['Effective Date']),
                'date': pd.to_datetime(row['Effective Date']).strftime('%Y-%m-%d'),
                'time': pd.to_datetime(row['Effective Date']).strftime('%H:%M:%S'),
                'behaviour_type': row['Type'],  # Use the Type column as behaviour type
                'triggers': 'Not specified in this format',
                'description': behaviour_description,
                'consequences': 'Not specified in this format',
                'interventions': interventions + ' Evaluation: ' + evaluation,
                'medication_changes': 'Not specified in this format',
                'risks': 'Not specified in this format',
                'outcome': resident_response,
                'poa_notified': 'Not specified in this format',
                'injuries': injuries,
                'time_frequency': time_frequency,
                'evaluation': evaluation
            }
            incidents.append(incident)
            
    return pd.DataFrame(incidents)

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
    relevant_fields = ['behaviour_type', 'description', 'time_frequency']
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
        'poa_notified': 'No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM',
        'time_frequency': 'No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM',
        'evaluation': 'No Progress Note Found Within 24hrs of RIM Within 24hrs of RIM'
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
        
        # Find closest note within 24 hours (behaviour incidents can have longer windows)
        within_window = time_diffs[time_diffs <= timedelta(hours=24)]
        
        if not within_window.empty:
            closest_idx = within_window.idxmin()
            print(f"Found matching behaviour note for {row['name']} at {row['datetime']}")
            return resident_notes.loc[closest_idx]
        
        return None
    
    # Update merged dataframe with matching behaviour data
    print("\nMatching incidents with behaviour notes...")
    for idx, row in df_merged.iterrows():
        matching_behaviour = find_matching_behaviour(row, df_behaviour_processed)
        
        if matching_behaviour is not None:
            print(f"Found matching behaviour note for {row['name']} at {row['datetime']}")
            # Update all relevant columns from the behaviour note
            for column in missing_note_defaults.keys():
                df_merged.at[idx, column] = matching_behaviour[column]
        else:
            print(f"No matching behaviour note found for {row['name']} at {row['datetime']}")
    
    # Add new columns
    print("\nAdding who affected, code white, and PRN columns...")
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
    home_dir = os.path.join(directory, home.replace(" ", "_").replace("-", "_").lower())
    if not os.path.exists(home_dir):
        os.makedirs(home_dir)
        
    for root, dirs, files in os.walk(home_dir):
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

if __name__ == "__main__":
    process_directory("analyzed")