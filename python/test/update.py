import csv
import firebase_admin
from firebase_admin import credentials, db
import os
import re
from datetime import datetime
import logging
from homes_db import association_dict, naming_dict, homes_dict
from dotenv import load_dotenv

class FirebaseSynchronizer:
   def __init__(self, credentials_path):
       try:
           firebase_admin.get_app()
       except ValueError:
           # Load environment variables
           load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))
           
           # Check if required environment variables are set
           required_vars = [
               'FIREBASE_TYPE',
               'FIREBASE_PROJECT_ID',
               'FIREBASE_PRIVATE_KEY_ID',
               'FIREBASE_PRIVATE_KEY',
               'FIREBASE_CLIENT_EMAIL',
               'FIREBASE_CLIENT_ID',
               'FIREBASE_AUTH_URI',
               'FIREBASE_TOKEN_URI',
               'FIREBASE_AUTH_PROVIDER_X509_CERT_URL',
               'FIREBASE_CLIENT_X509_CERT_URL',
               'FIREBASE_UNIVERSE_DOMAIN'
           ]

           missing_vars = [var for var in required_vars if not os.getenv(var)]
           if missing_vars:
               raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
           
           # Initialize Firebase Admin SDK with environment variables
           cred = credentials.Certificate({
               "type": os.getenv('FIREBASE_TYPE'),
               "project_id": os.getenv('FIREBASE_PROJECT_ID'),
               "private_key_id": os.getenv('FIREBASE_PRIVATE_KEY_ID'),
               "private_key": os.getenv('FIREBASE_PRIVATE_KEY').replace('\\n', '\n'),
               "client_email": os.getenv('FIREBASE_CLIENT_EMAIL'),
               "client_id": os.getenv('FIREBASE_CLIENT_ID'),
               "auth_uri": os.getenv('FIREBASE_AUTH_URI'),
               "token_uri": os.getenv('FIREBASE_TOKEN_URI'),
               "auth_provider_x509_cert_url": os.getenv('FIREBASE_AUTH_PROVIDER_X509_CERT_URL'),
               "client_x509_cert_url": os.getenv('FIREBASE_CLIENT_X509_CERT_URL'),
               "universe_domain": os.getenv('FIREBASE_UNIVERSE_DOMAIN')
           })

           firebase_admin.initialize_app(cred, {
               'databaseURL': 'https://fallyx-9d599-default-rtdb.firebaseio.com/'
           })

       self.db_ref = db.reference()

   def extract_home_name(self, filename):
       filename_lower = filename.lower()

       print("DEBUG: Filename:", filename_lower)
       print("DEBUG: Available association keys:", list(association_dict.keys()))

       for home_name, firebase_key in association_dict.items():
           if firebase_key.lower() in filename_lower:
               print(f"DEBUG: Matched home name: {home_name}, Firebase key: {firebase_key}")
               return home_name

       for home_name, firebase_key in association_dict.items():
           filename_parts = filename_lower.replace('-', '_').split('_')
           for part in filename_parts:
               if part in firebase_key.lower() or firebase_key.lower() in part:
                   print(f"DEBUG: Flexibly matched home name: {home_name}, Firebase key: {firebase_key}")
                   return home_name

       raise ValueError(f"Could not identify home name from filename: {filename}")

   def extract_month_from_filepath(self, filepath):
       match = re.search(r'/(\d{4})_(\d{2})_', filepath)
       if match:
           return match.group(2)

       return datetime.now().strftime("%m")

   def sync_firebase_with_csv(self, csv_filepath):
       logging.info(f"Processing file: {csv_filepath}")
       print("SYNCING:", csv_filepath)
       try:
           home_firebase_key = self.extract_home_name(os.path.basename(csv_filepath))
           home_display_name = naming_dict.get(home_firebase_key, home_firebase_key)

           #Get the Firebase key for the home
           firebase_home_key = homes_dict.get(home_firebase_key, home_firebase_key)

           #Extract year and month from filepath
           match = re.search(r'/(\d{4})_(\d{2})_', csv_filepath)
           current_year = match.group(1)
           current_month = match.group(2)

           print(f"\n{'='*50}")
           print(f"Processing data for {home_display_name}")
           firebase_path = f"{firebase_home_key}/{current_year}/{current_month}"
           print(f"Searching Firebase path: {firebase_path}")

           all_firebase_data = self.db_ref.child(firebase_path).get() or {}

            # Add this check and conversion
           if isinstance(all_firebase_data, list):
               # Convert list to dictionary with indices as keys
               all_firebase_data = {str(i): item for i, item in enumerate(all_firebase_data) if item is not None}


           update_field_mapping = {
               'isInjuryUpdated': 'injury',
               'isCauseUpdated': 'cause',
               'isHirUpdated': 'hir',
               'isHospitalUpdated': 'transfer_to_hospital',
               'isIncidentReportUpdated': 'incidentReport',
               'isInterventionsUpdated': 'interventions',
               'isPhysicianRefUpdated': 'physicianRef',
               'isPoaContactedUpdated': 'poaContacted',
               'isPostFallNotesUpdated': 'postFallNotes',
               'isPtRefUpdated': 'ptRef'
           }

           with open(csv_filepath, 'r', newline='', encoding='utf-8') as csvfile:
               print("OPENED CSV")
               csvreader = csv.DictReader(csvfile)

               original_fieldnames = list(csvreader.fieldnames)
               extended_fieldnames = original_fieldnames.copy()

               added_columns = []
               for update_flag in update_field_mapping.keys():
                   if update_flag not in extended_fieldnames:
                       extended_fieldnames.append(update_flag)
                       added_columns.append(update_flag)

               if added_columns:
                   print(f"Adding missing columns to CSV: {', '.join(added_columns)}")

               csv_rows = list(csvreader)[::-1]
               updated_rows = []

               for index, csv_row in enumerate(csv_rows):
                   for column in added_columns:
                       csv_row[column] = ''

                   matching_firebase_row = None
                   for firebase_doc_id, firebase_doc in all_firebase_data.items():
                       if (firebase_doc.get('date') == csv_row['date'] and
                           firebase_doc.get('name') == csv_row['name'] and
                           firebase_doc.get('time') == csv_row['time']):
                           matching_firebase_row = firebase_doc
                           break

                   if matching_firebase_row:
                       print(f"\nUpdating row for {csv_row['name']} on {csv_row['date']} at {csv_row['time']}")
                       updated_row = csv_row.copy()

                       for update_flag, field in update_field_mapping.items():
                           if update_flag in matching_firebase_row and matching_firebase_row[update_flag] == 'yes':
                               if field in matching_firebase_row and matching_firebase_row[field]:
                                   updated_row[field] = matching_firebase_row[field]
                                   updated_row[update_flag] = 'yes'

                                   if updated_row[field] != csv_row[field]:
                                       print(f"  {field}: '{csv_row[field]}' → '{updated_row[field]}' (Flag: {update_flag})")

                       updated_rows.append(updated_row)
                   else:
                       updated_rows.append(csv_row)
                       print(f"No matching Firebase record for {csv_row['name']} on {csv_row['date']} at {csv_row['time']}")

               self._write_updated_csv(csv_filepath, extended_fieldnames, updated_rows)

           print(f"{'='*50}\n")

       except Exception as e:
           logging.error(f"Error in sync_firebase_with_csv: {e}")
           import traceback
           logging.error(traceback.format_exc())

   def _identify_changes(self, existing_data, csv_data):
       changes = {}

       for key, csv_val in csv_data.items():
           existing_val = existing_data.get(key, '')
           existing_val_str = str(existing_val).strip()
           csv_val_str = str(csv_val).strip()

           if existing_val_str != csv_val_str and existing_val_str:
               changes[key] = (existing_val, csv_val)

       return changes

   def _write_updated_csv(self, filepath, fieldnames, rows):
       with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
           csvwriter = csv.DictWriter(csvfile, fieldnames=fieldnames)
           csvwriter.writeheader()
           csvwriter.writerows(rows[::-1])

       print(f"Updated CSV file saved: {filepath}")

def process_merged_csv_files(analyzed_folder, firebase_credentials_path):
    
   synchronizer = FirebaseSynchronizer(firebase_credentials_path)
   print("Processing")

   for root, dirs, files in os.walk(analyzed_folder):
       for file in files:
           if file.endswith('merged.csv'):
               full_filepath = os.path.join(root, file)
               print(f"Processing file: {full_filepath}")

               try:
                   synchronizer.sync_firebase_with_csv(full_filepath)
               except Exception as e:
                   print(f"Error processing {full_filepath}: {e}")
                   import traceback
                   traceback.print_exc()

def main():
   FIREBASE_CREDENTIALS_PATH = 'fallyx-9d599-firebase-adminsdk-9la8z-5a980c16fd.json'
   ANALYZED_FOLDER_PATH = 'analyzed'

   # Check if credentials file exists
#    if not os.path.exists(FIREBASE_CREDENTIALS_PATH):
#        print(f"Warning: Firebase credentials file not found at {FIREBASE_CREDENTIALS_PATH}")
#        print("Skipping Firebase sync operations.")
#        return
   print("HELLO")
   process_merged_csv_files(ANALYZED_FOLDER_PATH, FIREBASE_CREDENTIALS_PATH)

if __name__ == "__main__":
   main()