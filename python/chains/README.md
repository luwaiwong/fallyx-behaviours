## Chain-Based Extraction Logic

This directory contains chain-based extraction logic for processing PDF and Excel files.

### Structure

- `kindera/` - Extraction logic for Kindera chain (Berkshire Care, Banwell Gardens)
- `responsive/` - Extraction logic for Responsive chain (Mill Creek Care, The O'Neill, Franklin Gardens)
- `homes_db.py` - Central configuration for chains and homes

### Usage

Each chain folder contains the extraction scripts that can be used for all homes in that chain.

To process files for a specific home:

```bash
cd chains/[chain_name]
python3 run_script.py [home_id]
```

Example:
```bash
cd chains/kindera
python3 run_script.py berkshire_care
```

### Chains

#### Kindera Chain
- **Homes:** Berkshire Care, Banwell Gardens
- **Extraction Type:** Berkshire format
- **Follow-up Notes:** Supported for Berkshire Care, not for Banwell Gardens

#### Responsive Chain
- **Homes:** Mill Creek Care, The O'Neill, Franklin Gardens
- **Extraction Type:** Millcreek/Oneill format
- **Follow-up Notes:** Supported for all homes

### Migration Notes

The old per-home structure (`python/berkshire/`, `python/millcreek/`, etc.) is being replaced by this chain-based structure. The extraction logic is shared within each chain, reducing code duplication.


