# Tenant Management Process

## Overview

The system has been updated to use **chain-based processing** where homes (tenants) are grouped into chains that share the same Python processing logic. This eliminates the need for individual Python directories per home.

## New Home Creation Process

### Scenario 1: Creating a Home in an Existing Chain

**Steps:**
1. Go to **Tenant Management** (formerly "Home Management")
2. Click **"Create Home"**
3. Enter the **Home Name** (e.g., "Mill Creek Care")
4. Select an **existing chain** from the dropdown
5. Click **"Create Home"**

**What Happens:**
- ✅ Creates Firebase database structure for the home
- ✅ Associates the home with the selected chain
- ✅ **Automatically uses the chain's Python processing logic**
  - Processing scripts are located in `python/chains/{chainId}/`
  - Example: If assigned to "responsive" chain → uses `python/chains/responsive/`
- ❌ **No Python directory is created** - uses the chain's shared directory

**Example:**
- Home: "New Care Facility"
- Chain: "responsive" (existing)
- Result: Uses `python/chains/responsive/` for all file processing

---

### Scenario 2: Creating a New Chain

**Steps:**
1. Go to **Tenant Management**
2. Click **"Create Chain"**
3. Enter the **Chain Name** (e.g., "New Chain")
4. Select an **Extraction Strategy**:
   - **responsive**: Millcreek/Oneill-style extraction (used by Responsive chain)
   - **kindera**: Berkshire-style extraction (used by Kindera chain)
   - **test**: Test extraction logic (for development/testing)
5. Click **"Create Chain"**

**What Happens:**
- ✅ Creates a new chain in Firebase
- ✅ Stores the extraction strategy (`extractionType`)
- ✅ Creates `python/chains/{chainId}/` directory structure (needs to be set up manually with scripts)
- ✅ Chain is now available for assigning homes

**Important:** After creating a chain, you need to:
1. Create the Python directory: `python/chains/{chainId}/`
2. Copy/adapt the processing scripts from an existing chain (e.g., `python/chains/responsive/`)
3. Update `python/chains/homes_db.py` to include the new chain configuration

---

## Extraction Strategies

### 1. **responsive** (Millcreek/Oneill style)
- Used by: Responsive chain
- Python directory: `python/chains/responsive/`
- Characteristics:
  - Supports follow-up notes for all homes
  - Uses Millcreek/Oneill extraction logic
  - Processes Excel and PDF files with specific formatting

### 2. **kindera** (Berkshire style)
- Used by: Kindera chain
- Python directory: `python/chains/kindera/`
- Characteristics:
  - Supports follow-up notes for some homes (Berkshire Care: Yes, Banwell Gardens: No)
  - Uses Berkshire extraction logic
  - Processes Excel and PDF files with specific formatting

### 3. **test** (Development/Testing)
- Used by: Test chain
- Python directory: `python/chains/test/`
- Characteristics:
  - For development and testing purposes
  - Does not support follow-up notes
  - Uses test extraction logic

---

## Key Changes

### ✅ Removed
- **Python Directory Name field** - No longer needed since homes use chain directories
- **Individual home Python directories** - All homes in a chain share the same scripts
- **"Create Chain" from User Management** - Moved to Tenant Management only

### ✅ Added
- **"Create Chain" button** in Tenant Management
- **Extraction Strategy selection** when creating chains
- **Chain-based processing** - All homes automatically use their chain's Python logic

### ✅ Renamed
- **"Home Management"** → **"Tenant Management"**
- Better reflects that it manages both chains and homes (tenants)

---

## File Processing Flow

When files are uploaded for a home:

1. **API receives** home identifier
2. **Looks up** the home's chain ID from Firebase
3. **Determines** chain Python directory: `python/chains/{chainId}/`
4. **Processes files** using the chain's shared scripts
5. **Saves results** in chain's `analyzed/{homeId}/` subdirectory

**Example:**
- Upload files for "Mill Creek Care"
- System finds: `chainId = "responsive"`
- Uses: `python/chains/responsive/getExcelInfo.py`, `getPdfInfo.py`, etc.
- Saves to: `python/chains/responsive/analyzed/mill_creek_care/`

---

## Migration Notes

- Existing homes are automatically assigned to chains via "Seed Existing Homes"
- Legacy individual home directories (`python/millcreek/`, `python/berkshire/`, etc.) still exist but are no longer used
- All new homes must be assigned to a chain
- All chains must have an extraction strategy defined

