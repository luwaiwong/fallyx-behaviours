# Custom Strategy Maker - Implementation Guide

## Overview

The Custom Strategy Maker allows you to create new chains with fully customizable extraction strategies. You can start from a template (Responsive, Kindera, Test) or build from scratch.

## How It Works

### 1. Creating a Chain with Custom Strategy

### Step 1: Start Chain Creation
1. Go to **Tenant Management**
2. Click **"Create Chain"**
3. Enter the **Chain Name** (e.g., "My Custom Chain")

### Step 2: Select Strategy Type
4. In the **Extraction Strategy** dropdown, select **"Custom Strategy (Configure parameters)"**
5. Click **"Configure Custom Strategy"** button

### Step 3: Configure Strategy
6. The Custom Strategy Form appears with all configurable parameters:
   - **Template Selection**: Start with Responsive, Kindera, Test, or Custom
   - **PDF Extraction**: Tolerance values, max pages
   - **Note Types**: Regex pattern, valid types list
   - **Follow-up Notes**: Enable/disable, select types
   - **Excel Processing**: Header row, injury columns, units list
   - **AI Processing**: Model, temperature, max tokens
   - **Advanced Features**: Kindera-style filtering and truncation

### Step 4: Save and Create
7. Click **"Save Strategy"** - this saves the configuration
8. Review the configuration summary
9. Click **"Create Chain"** to create the chain with your custom strategy

## Configuration Structure

The custom strategy is stored in Firebase under:
```
/chains/{chainId}/
  - name: "Chain Name"
  - extractionType: "custom"
  - extractionConfig: {
      pdfExtraction: { ... },
      noteTypes: { ... },
      followUpNotes: { ... },
      excelProcessing: { ... },
      contentCleaning: { ... },
      aiProcessing: { ... },
      kinderaFeatures: { ... } // optional
    }
```

## Parameterizable Components

### 1. PDF Extraction
- **xTolerance**: Horizontal text extraction tolerance (1-10)
- **yTolerance**: Vertical text extraction tolerance (1-10)
- **maxPages**: Maximum pages to process (1-1000)

### 2. Note Types
- **typePattern**: Regex pattern to match note types in PDF
- **validTypes**: Array of note type strings to extract
- **skipPatterns**: Patterns to skip (e.g., comma-separated types)

### 3. Follow-up Notes
- **enabled**: Boolean to enable/disable follow-up note extraction
- **types**: Array of note types to extract as follow-up notes

### 4. Excel Processing
- **headerRow**: Row number where headers are located (default: 7)
- **injuryColumnStart**: Starting column index for injuries (default: 13)
- **injuryColumnEnd**: Ending column index for injuries (default: 34 or 87)
- **units**: Array of valid unit/building names
- **filterStruckOut**: Boolean to filter out "Struck Out" incidents

### 5. AI Processing
- **model**: OpenAI model to use (gpt-3.5-turbo, gpt-4, gpt-4-turbo)
- **temperature**: AI temperature (0-1, default: 0.3)
- **maxTokens**: Maximum tokens for AI responses (1-4000)

### 6. Advanced Features (Kindera-style)
- **filterBehaviourNotes**: Enable behaviour note filtering
- **smartTruncate**: Enable smart truncation
- **truncationSettings**: 
  - **truncateAt**: String to truncate at (e.g., "Responsive Behaviour")
  - **keepAfter**: String to keep after (e.g., "Behaviour Displayed :")

## Template Presets

### Responsive Template
- xTolerance: 3, yTolerance: 3
- 4 note types (simple)
- Follow-up: Only "Behaviour - Follow up"
- Excel: 74 injury columns (13-87)
- No advanced features

### Kindera Template
- xTolerance: 1, yTolerance: 1
- 11 note types (detailed)
- Follow-up: "Behaviour - Follow up" + "Behaviour Note"
- Excel: 21 injury columns (13-34)
- Advanced features enabled

### Test Template
- xTolerance: 3, yTolerance: 3
- 1 note type ("Behaviour Note")
- Follow-up: Disabled
- Excel: 21 injury columns
- No advanced features

## Next Steps for Python Integration

To make the Python scripts use these configurations:

1. **Create config reader**: Python script to read `extractionConfig` from Firebase
2. **Parameterize scripts**: Update `getPdfInfo.py`, `getExcelInfo.py`, etc. to use config values
3. **Fallback logic**: If config missing, use hardcoded defaults (backward compatibility)

Example Python usage:
```python
# Read config from Firebase or JSON file
config = load_extraction_config(chain_id)

# Use config values
x_tolerance = config['pdfExtraction']['xTolerance']
valid_types = config['noteTypes']['validTypes']
```

## UI Features

- **Template Selection**: Start with a preset and customize
- **Real-time Validation**: Form validates inputs as you type
- **Visual Feedback**: Shows configured status before creating chain
- **Help Icons**: Contextual help for each parameter
- **Type Management**: Add/remove note types and units dynamically

## Storage

- Custom strategies are stored in Firebase under `/chains/{chainId}/extractionConfig`
- Template strategies (responsive, kindera, test) don't store config (use hardcoded defaults)
- Custom strategies store full configuration object

