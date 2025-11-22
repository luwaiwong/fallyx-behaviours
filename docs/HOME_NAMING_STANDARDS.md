# Home Naming Standards & File Upload Guidelines

## Problem Summary

The system uses multiple naming conventions for homes across different parts of the application:

1. **Firebase/Database IDs**: camelCase (e.g., `millCreek`, `berkshire`)
2. **Python Directory Names**: lowercase, no underscores (e.g., `millcreek`, `berkshire`)
3. **Home Names (UI/Forms)**: snake_case (e.g., `mill_creek_care`, `berkshire_care`)
4. **Display Names**: Human-readable (e.g., "Mill Creek Care", "Berkshire Care")

### What Went Wrong

When uploading files for **Mill Creek Care**:
- The form sent `home: "mill_creek_care"` (snake_case)
- The API tried to use `python/mill_creek_care/` directory
- But the actual Python directory is `python/millcreek/` (lowercase, no underscores)
- Result: **File not found error** - Python scripts couldn't be located

## Solution

We've implemented a centralized mapping system in `src/lib/homeMappings.ts` that:
- Maps any home identifier to the correct Python directory
- Validates mappings before processing files
- Provides clear error messages if mappings are missing

## For Developers: Adding a New Home

**✅ NEW: Mappings are now auto-generated when creating homes through the UI!**

When adding a new home to the system:

### Steps to Add a New Home:

1. **Go to Admin UI**: Navigate to the Admin page → Home Management
2. **Click "Create Home"**: Fill in the form:
   - **Home Name**: e.g., "Mill Creek Care" (display name)
   - **Python Directory** (Optional): e.g., "millcreek" 
     - If left blank, auto-generates from home name (lowercase, no spaces/underscores)
     - Only specify if you need a custom directory name
   - **Chain**: Select the chain this home belongs to
3. **Create Python Directory**: After creating the home, create `python/{pythonDir}/` with required scripts
4. **Test**: Upload a test file to verify the mapping works

### How Auto-Generation Works:

- **Firebase ID**: Auto-generated as camelCase (e.g., "Mill Creek Care" → "millCreek")
- **Python Directory**: Auto-generated as lowercase, no spaces/underscores (e.g., "Mill Creek Care" → "millcreek")
  - You can override this in the UI if needed
- **Home Name**: Auto-generated as snake_case (e.g., "Mill Creek Care" → "mill_creek_care")
- **Display Name**: Uses the exact name you entered

### Legacy: Manual Mapping (Not Recommended)

If you need to manually add mappings (for backwards compatibility), you can still add them to `src/lib/homeMappings.ts`, but **prefer using the UI** as it automatically stores mappings in Firebase and ensures consistency.

## For File Uploaders: File Naming Standards

### ✅ Simplified File Naming Format

**IMPORTANT**: You no longer need to include the home name in the filename! The system knows which home the files belong to because you select it in the UI.

**Format**: `{date}.{extension}` or `{date}_{time}.{extension}`

**Rules**:
- **Date format**: `MM-DD-YYYY` (e.g., `11-18-2025`) - **REQUIRED**
- **Time format**: `HHMM` (24-hour, e.g., `2358` for 11:58 PM) - **OPTIONAL**
- Use `.pdf` for PDF files and `.xls` or `.xlsx` for Excel files
- Home name is **NOT needed** in filename - it's selected in the UI

### Examples:

✅ **Correct** (Simple - just date):
- `11-18-2025.pdf`
- `11-18-2025.xls`
- `10-24-2025.pdf`

✅ **Also Correct** (Date + time):
- `11-18-2025_2358.pdf`
- `11-18-2025_1111.xls`

❌ **Incorrect**:
- `2025-11-18.pdf` (wrong date format - must be MM-DD-YYYY)
- `11-18-25.pdf` (wrong year format - must be YYYY)
- `mill_creek_care_11-18-2025.pdf` (home name not needed - but won't break, just unnecessary)

### Why This Matters

1. **Simplicity**: No need to remember home name formats - just include the date
2. **Reliability**: Home is selected in UI, so no parsing errors
3. **Date Extraction**: The system extracts the date (MM-DD-YYYY) to organize files by date
4. **Error Prevention**: Simpler naming = fewer mistakes

## Troubleshooting

### Error: "Home mapping not configured properly"

**Cause**: A new home was added but mappings weren't updated in `homeMappings.ts`

**Solution**: Contact the development team to add the home mapping

### Error: "can't open file ... No such file or directory"

**Cause**: Home name doesn't map to correct Python directory

**Solution**: 
1. Check if the home exists in `HOME_MAPPINGS`
2. Verify the Python directory exists in `python/` folder
3. Contact support if the issue persists

### Files Not Processing

**Check**:
1. Date format is `MM-DD-YYYY` (not `YYYY-MM-DD`) - this is the only required part of filename
2. Both PDF and Excel files are uploaded together
3. Home is correctly selected in the UI dropdown
4. Files have valid extensions (.pdf, .xls, or .xlsx)

## Best Practices

1. **Include date in filename** - always use `MM-DD-YYYY` format (e.g., `11-18-2025`)
2. **Optional: Include time** - helps track when files were generated (e.g., `11-18-2025_2358`)
3. **Select home in UI** - make sure you select the correct home from the dropdown
4. **Upload both files together** - PDF and Excel must be uploaded in the same request
5. **Keep it simple** - no need to include home name in filename anymore!

## Questions?

If you're unsure about:
- Which home name to use → Check the reference table above
- File naming format → Follow the examples
- Adding a new home → Contact the development team

---

**Last Updated**: 2025-01-XX  
**Maintained By**: Development Team

