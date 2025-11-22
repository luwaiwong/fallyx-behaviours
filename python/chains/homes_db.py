# Central place for chains and homes configuration
from datetime import datetime

# Chain definitions
CHAINS = {
    'kindera': {
        'name': 'Kindera',
        'homes': ['berkshire_care', 'banwell_gardens'],
        'extraction_type': 'berkshire',  # Uses Berkshire extraction logic
        'supports_follow_up': {
            'berkshire_care': True,
            'banwell_gardens': False
        }
    },
    'responsive': {
        'name': 'Responsive',
        'homes': ['mill_creek_care', 'the_oneill', 'franklingardens'],
        'extraction_type': 'millcreek',  # Uses Millcreek/Oneill extraction logic
        'supports_follow_up': {
            'mill_creek_care': True,
            'the_oneill': True,
            'franklingardens': True
        }
    },
    'test': {
        'name': 'Test',
        'homes': ['test'],
        'extraction_type': 'test',  # Uses test extraction logic
        'supports_follow_up': {
            'test': False
        }
    }
}

# Home to chain mapping
HOME_TO_CHAIN = {}
for chain_id, chain_data in CHAINS.items():
    for home_id in chain_data['homes']:
        HOME_TO_CHAIN[home_id] = chain_id

# All homes list
ALL_HOMES = []
for chain_data in CHAINS.values():
    ALL_HOMES.extend(chain_data['homes'])

# Firebase related mappings
association_dict = {
    'iggh': 'ina_grafton_gage',
    'millCreek': 'mill_creek_care',
    'niagara': 'niagara_ltc',
    'wellington': 'the_wellington',
    'bonairltc': 'bon_air',
    'champlain': 'champlain_ltc',
    'lancaster': 'lancaster_ltc',
    'oneill': 'the_oneill',
    'vmltc': 'villa_marconi',
    'scarborough_retirement': 'srr',
    'shepherd': 'shepherd_lodge',
    'berkshire': 'berkshire_care',
    'banwell': 'banwell_gardens',
}

homes_dict = {
    'ina_grafton_gage': 'iggh',
    'mill_creek_care': 'millCreek',
    'niagara_ltc': 'niagara',
    'the_wellington': 'wellington',
    'bon_air': 'bonairltc',
    'champlain_ltc': 'champlain',
    'lancaster_ltc': 'lancaster',
    'the_oneill': 'oneill',
    'villa_marconi': 'vmltc',
    'generations': 'generations',
    'scarborough_retirement': 'srr',
    'shepherd_lodge': 'shepherd',
    'berkshire_care': 'berkshire',
    'banwell_gardens': 'banwell',
}

naming_dict = {
    'ina_grafton_gage': 'Ina Grafton',
    'mill_creek_care': 'Mill Creek',
    'niagara_ltc': 'Niagara',
    'the_wellington': 'Wellington',
    'bon_air': 'Bon Air',
    'champlain_ltc': 'Champlain',
    'lancaster_ltc': 'Lancaster',
    'the_oneill': 'The ONeill',
    'villa_marconi': 'Villa Marconi',
    'scarborough_retirement': 'SRR',
    'shepherd_lodge': 'Shepherd Lodge',
    'berkshire_care': 'Berkshire Care',
    'banwell_gardens': 'Banwell Gardens',
}

def get_chain_for_home(home_id: str) -> str:
    """Get chain ID for a given home ID."""
    return HOME_TO_CHAIN.get(home_id, None)

def get_extraction_type(home_id: str) -> str:
    """Get extraction type for a given home."""
    chain_id = get_chain_for_home(home_id)
    if chain_id:
        return CHAINS[chain_id]['extraction_type']
    return None

def supports_follow_up(home_id: str) -> bool:
    """Check if a home supports follow-up notes."""
    chain_id = get_chain_for_home(home_id)
    if chain_id:
        return CHAINS[chain_id]['supports_follow_up'].get(home_id, False)
    return False

def get_homes_for_chain(chain_id: str) -> list:
    """Get list of home IDs for a given chain."""
    if chain_id in CHAINS:
        return CHAINS[chain_id]['homes']
    return []


