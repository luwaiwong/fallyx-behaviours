# Fallyx Behaviours - Setup Instructions

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.8+
- **Firebase** project with Authentication and Firestore enabled

## Installation

### 1. Clone and Install Node Dependencies

```bash
cd /home/luwai/projects/fallyx/fallyx-behaviours
npm install
```

### 2. Python Setup

#### Install Python Dependencies

```bash
# Install Python packages (use one of these methods)

# Option A: System-wide installation
pip3 install -r requirements.txt

# Option B: User installation (recommended on Linux)
pip3 install --user -r requirements.txt

# Option C: Virtual environment (best practice)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment Variables

#### Create `.env` file in project root:

```bash
cp .env.example .env
```

#### Required Variables:

```bash
# REQUIRED - OpenAI API Key for behaviour processing
OPENAI_API_KEY=sk-...your_openai_api_key

# Firebase Admin SDK (for Python scripts)
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=abc123...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Key_Here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/v1/metadata/x509/firebase-adminsdk%40your-project.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com

# Next.js Firebase Config (client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

#### Get Firebase Credentials:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. Extract values from JSON to `.env` file

#### Get OpenAI API Key:

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Navigate to **API Keys**
3. Click **Create new secret key**
4. Copy the key to `OPENAI_API_KEY` in `.env`

## Running the Application

### Development Mode

```bash
npm run dev
```

Application will be available at `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
fallyx-behaviours/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── api/          # API routes
│   │   │   └── admin/
│   │   │       └── process-behaviours/  # File processing endpoint
│   │   ├── upload/       # Upload page
│   │   └── login/        # Authentication
│   ├── components/       # React components
│   │   └── admin/
│   │       └── FileUpload.tsx  # File upload component
│   └── lib/              # Utilities and Firebase config
├── python/               # Python processing scripts
│   ├── banwell/
│   ├── berkshire/
│   ├── millcreek/
│   └── oneill/
│       ├── getPdfInfo.py        # Extract behaviour notes from PDFs
│       ├── getExcelInfo.py      # Process incident reports
│       ├── getBe.py             # Generate behaviour analysis
│       ├── upload_to_dashboard.py  # Upload to Firebase
│       └── update.py            # Sync with Firebase
├── .env                  # Environment variables (DO NOT COMMIT)
├── requirements.txt      # Python dependencies
└── package.json          # Node.js dependencies
```

## Usage

### Upload Behaviour Files

1. Navigate to `/upload` page
2. Select home from dropdown
3. Upload:
   - **PDF file**: Behaviour notes from care system
   - **Excel file**: Incident reports (.xls or .xlsx)
4. Click "Process Files"
5. Wait for processing to complete

### Processing Flow

1. Files saved to `python/{home}/downloads/`
2. Excel processed → `processed_incidents.csv`
3. PDF processed → `behaviour_incidents.csv`
4. Combined data generated → `merged.csv`
5. Results stored in `python/{home}/analyzed/{home}/{date}/`

## Troubleshooting

### Python Package Installation Issues

If you encounter permission errors:

```bash
# Use --user flag
pip3 install --user -r requirements.txt

# Or use --break-system-packages on Arch Linux
pip3 install --break-system-packages -r requirements.txt
```

### OpenAI API Errors

- Verify `OPENAI_API_KEY` is set correctly in `.env`
- Check API key has sufficient credits
- Ensure key has access to GPT-3.5-turbo model

### Firebase Connection Issues

- Verify all Firebase environment variables are set
- Check Firebase project has Authentication and Firestore enabled
- Ensure service account has proper permissions

### File Processing Fails

- Check Python scripts have execution permissions
- Verify all Python dependencies are installed
- Check logs in terminal for specific error messages
- Ensure files match expected format (PointClickCare exports)

## Development Notes

- Python scripts use OpenAI API for AI-powered injury detection
- File processing runs synchronously via Next.js API route
- Firebase used for data storage and authentication
- All homes share single `.env` configuration
- Python virtual environment recommended for isolation

## Support

For issues or questions, check:
- Application logs in browser console
- API logs in terminal running `npm run dev`
- Python script output in terminal

