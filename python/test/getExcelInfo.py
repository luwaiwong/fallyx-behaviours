import pandas as pd
from datetime import datetime
import os
import logging
import shutil
from homes_db import homes
import re
from homes_db import homes_dict
import traceback

home = "test"

def extract_info_from_filename(filename):
    match = re.search(r'(?P<dashboard>[\w_]+)_(?P<month>\d{2})-(?P<day>\d{2})-(?P<year>\d{4})', filename)
    if match:
        dashboard = homes_dict.get(match.group('dashboard'), 'unknown')  
        year = match.group('year')
        month = match.group('month')
        day = match.group('day')
        return dashboard, year, month, day
    return None, None, None, None

def process_excel_file(input_file, output_file):
    """
    Process Excel file and create CSV with specified columns and formatting.
    """
    # Check if input file exists
    if not os.path.exists(input_file):
        logging.info(f"No file found for {input_file}. Skipping.")
        return
    
    # Read the Excel file
    df = pd.read_excel(input_file, header=7)
    
    # Remove rows where "Incident Status" is "Struck Out"
    df = df[df['Incident Status'] != 'Struck Out']
    
    # Split datetime into date and time
    df['date'] = pd.to_datetime(df['Incident Date/Time']).dt.strftime('%Y-%m-%d')
    df['time'] = pd.to_datetime(df['Incident Date/Time']).dt.strftime('%H:%M:%S')
    
    # List of all possible units
    units = [
        'Gage North', 'Gage West', 'Lawrence',
        'Ground W', '2 East', '2 West', '3 East', '3 West',
        'Shaw', 'Shaw Two', 'Shaw Three',
        'Pinery', 'Pinery Two', 'Pinery Three',
        'Wellington', 'Gage',
        'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4'
    ]

    def get_building(room):
        """
        Extract and process building name from room number.
        Handles special cases for floors.
        """
        if not pd.notna(room):
            return ''
            
        # Floor mapping
        floor_mapping = {
            'Floor 1': '1st Floor',
            'Floor 2': '2nd Floor',
            'Floor 3': '3rd Floor',
            'Floor 4': '4th Floor',
            'Ground': 'Ground W'  # Add mapping for Ground to Ground W
        }
        
        # Convert room to string and strip whitespace
        room_str = str(room).strip()
        
        # First check if it starts with "Floor"
        for floor_key in floor_mapping:
            if room_str.startswith(floor_key):
                return floor_mapping[floor_key]
        
        # Check for exact match with "Ground"
        if room_str == "Ground":
            return "Ground W"
        
        # If it's not a floor, process as before
        room_parts = room_str.split()
        if len(room_parts) <= 1:
            return ''
            
        building = ' '.join(room_parts[:-1])
        
        # Check if building exists in the units list
        if building in units:
            return building
        return building

    def get_injuries(row):
        # Get all columns from N1 to CO1 (injury columns)
        injury_cols = row[df.columns[13:34]]  # Verify these indices after loading the file
        injuries = set()  # Use a set to automatically remove duplicates
        
        # Check each injury column for 'Y'
        for col, value in injury_cols.items():
            if value == 'Y':
                # Remove the ".1" suffix if present
                injury_name = col.split('.')[0]
                injuries.add(injury_name)
                
        # Return injuries separated by periods, or "No Injury" if none found
        injury_string = '. '.join(sorted(injuries)) if injuries else "No Injury"
        
        # Replace "Unable to determine" with "No Injury"
        if injury_string == "Unable to determine":
            return "No Injury"
        return injury_string

    # Create new dataframe with required columns
    new_df = pd.DataFrame({
        'incident_number': df['Incident #'],
        'name': df['Resident Name'],
        'date': df['date'],
        'time': df['time'],
        'incident_location': df['Incident Location'],
        'room': df['Resident Room Number'],
        'injuries': df.apply(get_injuries, axis=1),
        'incident_type': df['Incident Type']
    })
    
    # Remove rows where name AND date are blank
    new_df = new_df.dropna(subset=['name', 'date'], how='all')
    
    # Create the analyzed directory if it doesn't exist
    analyzed_dir = os.path.join(os.path.abspath(os.getcwd()), "analyzed")
    if not os.path.exists(analyzed_dir):
        os.makedirs(analyzed_dir)

    # Create subdirectories for each home
    home_dir = os.path.join(analyzed_dir, home.replace(" ", "_").replace("-", "_").lower())
    if not os.path.exists(home_dir):
        os.makedirs(home_dir)

    # Extract date information from the filename
    _, year, month, day = extract_info_from_filename(os.path.basename(input_file))
    if year and month and day:
        date_dir = os.path.join(home_dir, f"{year}_{month}_{day}")
        if not os.path.exists(date_dir):
            os.makedirs(date_dir)
        
        # Save the CSV in the date-specific subdirectory
        new_df.to_csv(os.path.join(date_dir, f"{os.path.splitext(os.path.basename(input_file))[0]}_processed_incidents.csv"), index=False)
        logging.info(f"CSV file created successfully: {os.path.join(date_dir, f'{os.path.splitext(os.path.basename(input_file))[0]}_processed_incidents.csv')}")
    else:
        logging.info(f"Date information not found in file name: {input_file}")  

def main():
    # Get the downloads directory path
    downloads_dir = "downloads"
    
    # Check if downloads directory exists
    if not os.path.exists(downloads_dir):
        logging.info(f"No files found in downloads directory: {downloads_dir}")
        return
    
    # Look for XLS files directly in the downloads directory
    xls_files = [f for f in os.listdir(downloads_dir) if f.lower().endswith('.xls')]
    
    # Check if any XLS files exist
    if not xls_files:
        logging.info(f"No XLS files found in {downloads_dir}")
        return
    
    for xls_file in xls_files:
        xls_path = os.path.join(downloads_dir, xls_file)
        # Generate output CSV path in the same folder
        output_csv = os.path.join(downloads_dir, f"{os.path.splitext(xls_file)[0]}_processed_incidents.csv")
        
        logging.info(f"Starting Excel processing for: {xls_path}")
        
        try:
            process_excel_file(xls_path, output_csv)
        except Exception as e:
            logging.error(f"Error processing {xls_path}: {str(e)}")
            print(traceback.format_exc())
            continue

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    main()