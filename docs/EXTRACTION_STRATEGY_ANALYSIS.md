# Extraction Strategy Analysis: Kindera vs Responsive

## Overview

This document analyzes the differences and commonalities between the **Kindera** and **Responsive** extraction strategies to identify parameterizable components for a custom strategy UI.

---

## Common Components (Shared Logic)

### 1. **PDF Text Extraction**
- **Function**: `extract_text_from_pdf()`
- **Common**: Both use `pdfplumber` library
- **Difference**: 
  - Responsive: `x_tolerance=3, y_tolerance=3`
  - Kindera: `x_tolerance=1, y_tolerance=1`
- **Parameterizable**: ✅ **Tolerance values** (x_tolerance, y_tolerance)

### 2. **Resident Name Extraction**
- **Function**: `getResidentNameFromHeader()`
- **Common**: Identical regex pattern: `r"Resident Name\s*:\s*([^0-9]+?)\d"`
- **Parameterizable**: ❌ **No differences** - can be shared

### 3. **Date/Position Finding**
- **Functions**: `findPosition()`, `findEffectiveDates()`
- **Common**: Identical logic for finding effective dates and page positions
- **Parameterizable**: ❌ **No differences** - can be shared

### 4. **Note Content Cleaning**
- **Common**: Both use identical header/footer removal regex:
  ```python
  r"^(Facility #|Date:|Time:|Primary Physician:|User:|Progress Notes|Admission|Date of Birth|Gender|Allergies|Diagnoses|Location|Medical Record #|Physician|Pharmacy|Page \\d+ of \\d+|Author:|Signature:)"
  ```
- **Parameterizable**: ✅ **Header/footer patterns** (could be configurable list)

### 5. **Excel Processing**
- **Function**: `process_excel_file()`
- **Common**: 
  - Both read Excel with `header=7`
  - Both filter out "Struck Out" incidents
  - Both split datetime into date/time
  - Both use same unit/building extraction logic
- **Difference**: 
  - Responsive: Injury columns `[13:87]` (74 columns)
  - Kindera: Injury columns `[13:34]` (21 columns)
- **Parameterizable**: ✅ **Excel header row**, ✅ **Injury column range**, ✅ **Units list**

### 6. **Follow-up Notes Processing**
- **Function**: `save_followup_notes_csv()`
- **Common**: Both extract follow-up notes and create separate CSV
- **Difference**:
  - Responsive: Only extracts `'Behaviour - Follow up'`
  - Kindera: Extracts `'Behaviour - Follow up'` AND `'Behaviour Note'`
- **Parameterizable**: ✅ **Follow-up note types** (list of types to extract)

### 7. **AI Processing**
- **Common**: Both use OpenAI for:
  - Injury detection
  - POA contact status
  - Note summarization
- **Parameterizable**: ✅ **AI model**, ✅ **Temperature**, ✅ **Max tokens**, ✅ **Prompts**

---

## Key Differences (Strategy-Specific)

### 1. **PDF Note Type Extraction** ⭐ **MAJOR DIFFERENCE**

#### Responsive Strategy:
```python
typeMatch = re.search(r"Type:\s*(Behaviour - Responsive Behaviour|Family/Resident Involvement|Physician Note|Behaviour - Follow up)", section)

# Valid types:
- "Behaviour - Responsive Behaviour"
- "Family/Resident Involvement"
- "Physician Note"
- "Behaviour - Follow up"
```

#### Kindera Strategy:
```python
typeMatch = re.search(r"Type:\s*(Responsive Behaviour - Physical Agression|Responsive Behaviour - Verbal|Responsive Behaviour - Potential to harm self|Responsive Behaviour - Wandering|Responsive Behaviours - Other|Behaviour - Responsive Behaviour|Family/Resident Involvement|Physician Note|Behaviour - Follow up|Responsive Behaviour Assessment Summary|Behaviour Note)", section)

# Valid types (11 types vs 4):
- "Responsive Behaviour - Physical Agression"
- "Responsive Behaviour - Verbal"
- "Responsive Behaviour - Potential to harm self"
- "Responsive Behaviour - Wandering"
- "Responsive Behaviours - Other"
- "Behaviour - Responsive Behaviour"
- "Family/Resident Involvement"
- "Physician Note"
- "Behaviour - Follow up"
- "Responsive Behaviour Assessment Summary"
- "Behaviour Note"
```

**Parameterizable**: ✅ **Note type regex patterns** (list of valid note types)

---

### 2. **Follow-up Note Types**

#### Responsive:
- Extracts only: `'Behaviour - Follow up'`

#### Kindera:
- Extracts: `'Behaviour - Follow up'` AND `'Behaviour Note'`

**Parameterizable**: ✅ **Follow-up note type list** (per home or per chain)

---

### 3. **Excel Injury Column Range**

#### Responsive:
- Injury columns: `[13:87]` (74 columns)

#### Kindera:
- Injury columns: `[13:34]` (21 columns)

**Parameterizable**: ✅ **Injury column start/end indices**

---

### 4. **Kindera-Specific Features**

#### `filter_behaviour_note_data()` (Kindera only)
- Filters and truncates behaviour note data
- Uses `smart_truncate_behaviour_note()` function
- **Not present in Responsive**

**Parameterizable**: ✅ **Enable/disable filtering**, ✅ **Truncation settings**

---

## Parameterizable Configuration Structure

Based on the analysis, here's a proposed configuration structure for custom strategies:

```typescript
interface ExtractionStrategyConfig {
  // PDF Extraction
  pdfExtraction: {
    xTolerance: number;        // Default: 3 (responsive) or 1 (kindera)
    yTolerance: number;        // Default: 3 (responsive) or 1 (kindera)
    maxPages: number;          // Default: 500
  };
  
  // Note Type Patterns
  noteTypes: {
    // Regex pattern for matching note types
    typePattern: string;
    // List of valid note types to extract
    validTypes: string[];
    // Types to skip (e.g., comma-separated types)
    skipPatterns: string[];
  };
  
  // Follow-up Notes
  followUpNotes: {
    enabled: boolean;
    // Types to extract as follow-up notes
    types: string[];
  };
  
  // Excel Processing
  excelProcessing: {
    headerRow: number;          // Default: 7
    injuryColumnStart: number; // Default: 13
    injuryColumnEnd: number;   // Default: 87 (responsive) or 34 (kindera)
    units: string[];           // List of valid units/buildings
    filterStruckOut: boolean;  // Default: true
  };
  
  // Content Cleaning
  contentCleaning: {
    // Patterns to remove (headers/footers)
    removePatterns: string[];
  };
  
  // AI Processing
  aiProcessing: {
    model: string;             // Default: "gpt-3.5-turbo"
    temperature: number;       // Default: 0.3
    maxTokens: number;         // Default: varies
    // Custom prompts (optional)
    prompts?: {
      injuryDetection?: string;
      poaContact?: string;
      noteSummary?: string;
    };
  };
  
  // Kindera-Specific Features
  kinderaFeatures?: {
    filterBehaviourNotes: boolean;
    smartTruncate: boolean;
    truncationSettings?: {
      maxLength?: number;
      // ... other truncation params
    };
  };
}
```

---

## UI Design Proposal

### Strategy Configuration Form

1. **Basic Settings**
   - Strategy Name
   - Base Strategy (responsive/kindera/custom)
   - Description

2. **PDF Extraction Settings**
   - X Tolerance (slider: 1-5)
   - Y Tolerance (slider: 1-5)
   - Max Pages (number input)

3. **Note Types Configuration**
   - **Mode**: 
     - "Use Template" (responsive/kindera)
     - "Custom Pattern" (regex input)
   - Type Pattern (regex input with validation)
   - Valid Types (multi-select or comma-separated)
   - Skip Patterns (multi-select)

4. **Follow-up Notes**
   - Enable Follow-up Notes (toggle)
   - Follow-up Types (multi-select from note types)

5. **Excel Processing**
   - Header Row (number input)
   - Injury Column Range (start/end inputs)
   - Units List (multi-input or JSON editor)
   - Filter Struck Out (toggle)

6. **AI Settings**
   - Model Selection (dropdown)
   - Temperature (slider: 0-1)
   - Max Tokens (number input)
   - Custom Prompts (expandable section)

7. **Advanced Features**
   - Enable Behaviour Note Filtering (toggle - Kindera feature)
   - Enable Smart Truncation (toggle - Kindera feature)

---

## Implementation Approach

### Phase 1: Configuration Storage
- Store strategy configs in Firebase under `/chains/{chainId}/extractionConfig`
- Create TypeScript interfaces for type safety
- Add validation for config values

### Phase 2: Parameterized Scripts
- Refactor Python scripts to read config from JSON file
- Create shared base scripts that accept config
- Maintain backward compatibility with hardcoded strategies

### Phase 3: UI Implementation
- Create strategy configuration form in Tenant Management
- Add "Edit Strategy" button for existing chains
- Show strategy details in chain list
- Add validation and preview/testing

### Phase 4: Testing & Migration
- Test custom strategies with sample files
- Migrate existing chains to use config
- Document custom strategy creation process

---

## Why Home Folders Exist in `src/app/`

The folders in `src/app/` (e.g., `berkshire/`, `banwell/`, `franklingardens/`) are **Next.js route pages** for the individual home dashboards.

**Purpose:**
- Each home has its own dashboard route: `/berkshire`, `/banwell`, etc.
- These pages render the `BehavioursDashboard` component with home-specific props
- Used for routing users to their home's dashboard after login

**Not for data storage** - they're just UI routes. Data is stored in:
- Firebase Realtime Database
- Python `analyzed/` directories
- CSV files in chain directories

**Future Consideration:**
- Could potentially be dynamic routes: `/[homeId]/page.tsx`
- Would reduce code duplication
- But current structure is fine for explicit routing

