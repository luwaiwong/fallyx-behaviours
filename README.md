# Fallyx Behaviours Dashboard

A Next.js application for tracking and analyzing behaviour incidents in care facilities, with automated file processing using Python and AI-powered injury detection.

## Features

- **Behaviour Tracking**: Monitor and record behaviour incidents
- **File Upload & Processing**: Automated processing of PDF behaviour notes and Excel incident reports
- **AI-Powered Analysis**: OpenAI GPT-powered injury detection and classification
- **Analysis Charts**: Visualize behaviour patterns by time of day, type, location, etc.
- **Follow-up Management**: Track follow-up actions and notes
- **API Routes**: Server-side Firebase operations for data fetching and updates
- **Client-side Authentication**: Firebase authentication with role-based access
- **Multiple Facilities**: Support for MCB, ONCB, Berkshire, Banwell, and more

## Quick Setup

### Automated Setup (Recommended)

```bash
./setup.sh
```

This will install all Node.js and Python dependencies automatically.

### Manual Setup

See [SETUP.md](./SETUP.md) for detailed step-by-step instructions.

## Quick Start

### 1. Install Dependencies

```bash
# Node.js dependencies
npm install

# Python dependencies
pip3 install -r requirements.txt
```

### 2. Configure Environment Variables

Create a `.env.local` and `.env` file in the root directory based off `.env.local.example` and `.env.example`


### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

### 4. Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
fallyx-behaviours/
├── src/
│   ├── app/                     # Next.js app router pages
│   │   ├── api/                # API routes
│   │   │   ├── admin/          # Admin endpoints
│   │   │   │   └── process-behaviours/  # File processing endpoint
│   │   │   └── behaviours/     # Behaviour data endpoints
│   │   ├── upload/             # File upload page
│   │   ├── login/              # Login page
│   │   ├── admin/              # Admin dashboard
│   │   ├── MCB/                # Mill Creek dashboard
│   │   ├── ONCB/               # O'Neill Centre dashboard
│   │   ├── berkshire/          # Berkshire dashboard
│   │   └── banwell/            # Banwell dashboard
│   ├── components/             # React components
│   │   ├── admin/              # Admin components
│   │   │   ├── FileUpload.tsx  # File upload component
│   │   │   └── UserManagement.tsx
│   │   ├── behavioursDashboard/  # Behaviour-specific components
│   │   └── Modal.js            # Modal component
│   ├── lib/                    # Utility libraries
│   │   ├── firebase.ts         # Firebase client SDK
│   │   ├── firebase-admin.ts   # Firebase admin SDK
│   │   └── DashboardUtils.ts   # Dashboard utility functions
│   └── styles/                 # CSS modules
├── python/                     # Python processing scripts
│   ├── banwell/
│   ├── berkshire/
│   ├── millcreek/
│   └── oneill/
│       ├── getPdfInfo.py       # Extract behaviour notes from PDFs
│       ├── getExcelInfo.py     # Process incident reports
│       ├── getBe.py            # Generate behaviour analysis
│       ├── upload_to_dashboard.py  # Upload to Firebase
│       ├── update.py           # Sync with Firebase
│       └── downloads/          # Uploaded files stored here
├── .env                        # Environment variables
├── requirements.txt            # Python dependencies
├── setup.sh                    # Automated setup script
├── SETUP.md                    # Detailed setup guide
└── package.json                # Node.js dependencies
```

## Authentication

- Authentication is handled client-side using Firebase Authentication
- Users log in with username (converted to email format) and password
- Role-based routing directs users to their appropriate dashboard
- Protected routes redirect unauthenticated users to the login page

## API Routes

### GET `/api/behaviours/[name]`
Fetch behaviour data for a specific facility
- Query params: `month`, `year`

### POST `/api/behaviours/[name]`
Update behaviour records
- Body: `{ id, updates }`

### GET `/api/behaviours/follow-up/[name]`
Fetch follow-up data for a specific facility
- Query params: `month`, `year`

## Usage

### Upload & Process Behaviour Files

1. Navigate to `/upload` or admin dashboard
2. Select home from dropdown
3. Upload files:
   - **PDF**: Behaviour notes from PointClickCare
   - **Excel**: Incident reports (.xls or .xlsx)
4. Click "Process Files"
5. AI processes and analyzes data automatically

### View Dashboards

- Navigate to specific home dashboards (e.g., `/MCB`, `/berkshire`)
- View behaviour charts, incident summaries, and follow-ups
- Filter by date, resident, type, etc.

## Technologies

### Frontend
- **Next.js 15**: React framework with app router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Chart.js**: Data visualization
- **jsPDF**: PDF generation

### Backend
- **Python 3.8+**: File processing and AI analysis
- **OpenAI GPT-3.5**: AI-powered injury detection
- **Firebase**: Authentication, Firestore, and Storage
- **Node.js**: API routes and server-side rendering

### Python Libraries
- **pdfplumber**: PDF text extraction
- **pandas**: Data manipulation
- **openai**: AI analysis
- **firebase-admin**: Firebase integration

## License

Private - Fallyx Inc.
