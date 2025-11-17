import csv
import firebase_admin
from firebase_admin import credentials, db
import re  
import os  
from homes_db import homes_dict
from dotenv import load_dotenv

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
    print("Error: Missing required environment variables:")
    for var in missing_vars:
        print(f"- {var}")
    print("\nPlease create a .env file with these variables. You can copy them from your Firebase service account JSON file.")
    exit(1)

# Initialize Firebase Admin SDK with environment variables
try:
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
except Exception as e:
    print(f"Error initializing Firebase: {str(e)}")
    print("\nPlease check your .env file and make sure all variables are set correctly.")
    exit(1)

#Function: uploading merged.csv to dashboard in order to display the data on the dashboard
#Input: merged.csv

# Function to upload CSV data to Firebase
def upload_csv_to_firebase(csv_file_path, dashboard, year, month):
    # Construct the database reference path
    ref_path = f'{dashboard}/{year}/{month}'
    ref = db.reference(ref_path)

    try:
        # Remove existing data at the reference
        ref.delete()
        print(f'Removed existing data at {ref_path}')
    except firebase_admin.exceptions.UnauthenticatedError as e:
        print(f'Authentication error: {e}')
        return
    except Exception as e:
        print(f'Error deleting data: {e}')
        return

    # Read and upload CSV data
    with open(csv_file_path, mode='r', encoding='utf-8') as csv_file:
        csv_reader = csv.DictReader(csv_file)
        for index, row in enumerate(csv_reader):
            ref.child(str(index)).set(row)
            print(f'Uploaded row {index} to {ref_path}/{index}')

def extract_info_from_filename(filename):
    match = re.search(r'(?P<dashboard>[\w_]+)_(?P<month>\d{2})-(?P<day>\d{2})-(?P<year>\d{4})', filename)
    if match:
        dashboard = homes_dict.get(match.group('dashboard'), 'unknown')  
        year = match.group('year')
        month = match.group('month')
        return dashboard, year, month
    return None, None, None

def process_csv_files(base_directory):
    # Dictionary to store files by dashboard and date
    files_by_dashboard = {}

    for root, dirs, files in os.walk(base_directory):
        for file in files:
            if file.endswith('_merged.csv') or file.endswith('_follow.csv'):
                filename = os.path.join(root, file)
                dashboard, year, month = extract_info_from_filename(filename)

                if dashboard and year and month:
                    # Create a key for the dashboard
                    if dashboard not in files_by_dashboard:
                        files_by_dashboard[dashboard] = []
                    
                    # Add the file to the list for this dashboard
                    files_by_dashboard[dashboard].append((filename, year, month))

    # Process all files for each dashboard
    for dashboard, files in files_by_dashboard.items():
        print(f'\nProcessing Dashboard: {dashboard}')
        for filename, year, month in files:
            print(f'\nUploading file: {filename}')
            print(f'Year: {year}, Month: {month}')
            
            
            if dashboard != 'unknown':
                if filename.endswith('merged.csv'):
                    print("Uploading to behaviours")
                    upload_csv_to_firebase(filename, f'{dashboard}/behaviours', year, month)
                    print(f"Successfully uploaded to firebase at {dashboard}/behaviours/{year}/{month}")
                elif filename.endswith('follow.csv'):
                    print("Uploading to follow")
                    upload_csv_to_firebase(filename, f'{dashboard}/follow', year, month)
                    print(f"Successfully uploaded to firebase at {dashboard}/follow/{year}/{month}")
                
            else:
                print(f"Skipping unknown dashboard for file: {filename}")

# Example usage
base_directory = 'analyzed'
process_csv_files(base_directory)  