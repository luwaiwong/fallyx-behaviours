# Chain-Based Processing Migration Summary

## Overview
Migrated from individual home Python directories to chain-based processing. All homes must now be assigned to a chain, and homes within the same chain share the same Python processing scripts.

## Changes Made

### 1. Updated `src/lib/homeMappings.ts`
- Added `getChainIdAsync()`: Gets chain ID for a home from Firebase
- Added `getChainPythonDirAsync()`: Returns chain Python directory path (e.g., `chains/responsive`, `chains/kindera`)
- Includes fallback mapping for known homes during migration

### 2. Updated `src/app/api/admin/process-behaviours/route.ts`
- Changed from using individual home Python directories (e.g., `python/millcreek/`) to chain directories (e.g., `python/chains/responsive/`)
- Updated all Python script calls to use chain directory
- Changed environment variable from `HOME_NAME` to `HOME_ID` (for consistency with chain scripts)
- Passes `home_id` as argument to Python scripts (for compatibility with `run_script.py`)

### 3. Created Test Files
- `src/lib/__tests__/chainProcessing.test.ts`: Tests chain mapping logic
- `src/lib/__tests__/homeMappings.test.ts`: Tests chain helper functions
- `scripts/validate-chains.ts`: Validation script to ensure all homes have chains

## Chain Structure

### Responsive Chain
- **Python Directory**: `python/chains/responsive/`
- **Homes**: 
  - `mill_creek_care`
  - `the_oneill`
  - `franklingardens`

### Kindera Chain
- **Python Directory**: `python/chains/kindera/`
- **Homes**:
  - `berkshire_care`
  - `banwell_gardens`

## Migration Requirements

### All Homes Must Have Chains
- Every home in Firebase must have a `chainId` field
- Homes without chains will cause processing to fail
- Use `scripts/validate-chains.ts` to verify all homes have chains

### Python Script Changes
- Chain scripts process all files in `downloads/` directory
- They determine the home from filenames automatically
- The `home_id` parameter is passed for compatibility but may not be used by all scripts

## Testing

1. **Validate Chains**: Run `npx tsx scripts/validate-chains.ts` to ensure all homes have chains
2. **Test API**: Upload files for a home and verify it uses the correct chain directory
3. **Verify Processing**: Check that files are processed correctly using chain-based scripts

## Next Steps

1. ✅ All homes assigned to chains
2. ✅ API updated to use chain directories
3. ⏳ Test with actual file uploads
4. ⏳ Remove/deprecate individual home directories (optional cleanup)

## Backward Compatibility

- Fallback mapping in `getChainPythonDirAsync()` supports known homes during migration
- Individual home directories still exist but are no longer used by the API
- Can be removed after verifying chain-based processing works correctly

