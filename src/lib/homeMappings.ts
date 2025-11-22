/**
 * Centralized Home Name Mappings
 * 
 * This file provides mappings between different naming conventions used throughout the system:
 * - Home IDs (used in Firebase/database): e.g., "millCreek", "berkshire"
 * - Python Directory Names (used in python/ folder): e.g., "millcreek", "berkshire"
 * - Home Names (used in UI/forms): e.g., "mill_creek_care", "berkshire_care"
 * 
 * Mappings are now stored in Firebase and auto-generated when creating homes via the UI.
 * The hardcoded mappings below serve as fallback for backwards compatibility.
 */

export interface HomeMapping {
  /** Home ID used in Firebase/database (camelCase) */
  firebaseId: string;
  /** Python directory name (lowercase, no underscores) */
  pythonDir: string;
  /** Home name used in UI/forms (snake_case) */
  homeName: string;
  /** Display name for UI */
  displayName: string;
}

// Cache for Firebase mappings to avoid repeated reads
let firebaseMappingsCache: Record<string, HomeMapping> = {};
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load mappings from Firebase (with caching)
 */
async function loadFirebaseMappings(): Promise<Record<string, HomeMapping>> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (Object.keys(firebaseMappingsCache).length > 0 && (now - cacheTimestamp) < CACHE_TTL) {
    return firebaseMappingsCache;
  }

  try {
    // Only import Firebase admin on the server side
    if (typeof window === 'undefined') {
      const { adminDb } = await import('@/lib/firebase-admin');
      const mappingsRef = adminDb.ref('/homeMappings');
      const snapshot = await mappingsRef.once('value');
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        firebaseMappingsCache = (data || {}) as Record<string, HomeMapping>;
        cacheTimestamp = now;
        return firebaseMappingsCache;
      }
    }
  } catch (error) {
    console.warn('Failed to load Firebase mappings, using fallback:', error);
  }

  firebaseMappingsCache = {};
  return {};
}

/**
 * Get all mappings (Firebase + fallback)
 */
async function getAllMappings(): Promise<Record<string, HomeMapping>> {
  const firebaseMappings = await loadFirebaseMappings();
  return { ...HOME_MAPPINGS, ...(firebaseMappings || {}) };
}

/**
 * Get mappings synchronously (uses fallback only, for client-side)
 */
function getMappingsSync(): Record<string, HomeMapping> {
  return HOME_MAPPINGS;
}

/**
 * Complete mapping of all homes in the system.
 * When adding a new home, add an entry here with all four identifiers.
 */
export const HOME_MAPPINGS: Record<string, HomeMapping> = {
  // Mill Creek
  mill_creek_care: {
    firebaseId: 'millCreek',
    pythonDir: 'millcreek',
    homeName: 'mill_creek_care',
    displayName: 'Mill Creek Care'
  },
  MCB: {
    firebaseId: 'millCreek',
    pythonDir: 'millcreek',
    homeName: 'mill_creek_care',
    displayName: 'Mill Creek Care'
  },
  
  // Berkshire
  berkshire_care: {
    firebaseId: 'berkshire',
    pythonDir: 'berkshire',
    homeName: 'berkshire_care',
    displayName: 'Berkshire Care'
  },
  berkshire: {
    firebaseId: 'berkshire',
    pythonDir: 'berkshire',
    homeName: 'berkshire_care',
    displayName: 'Berkshire Care'
  },
  
  // Banwell
  banwell_gardens: {
    firebaseId: 'banwell',
    pythonDir: 'banwell',
    homeName: 'banwell_gardens',
    displayName: 'Banwell Gardens'
  },
  banwell: {
    firebaseId: 'banwell',
    pythonDir: 'banwell',
    homeName: 'banwell_gardens',
    displayName: 'Banwell Gardens'
  },
  
  // The O'Neill
  the_oneill: {
    firebaseId: 'oneill',
    pythonDir: 'oneill',
    homeName: 'the_oneill',
    displayName: 'The O\'Neill'
  },
  ONCB: {
    firebaseId: 'oneill',
    pythonDir: 'oneill',
    homeName: 'the_oneill',
    displayName: 'The O\'Neill'
  },
  oneill: {
    firebaseId: 'oneill',
    pythonDir: 'oneill',
    homeName: 'the_oneill',
    displayName: 'The O\'Neill'
  },
  
  // Franklin Gardens
  franklingardens: {
    firebaseId: 'franklingardens',
    pythonDir: 'franklingardens',
    homeName: 'franklingardens',
    displayName: 'Franklin Gardens'
  },
};

/**
 * Get Firebase ID from any home identifier (async - checks Firebase)
 */
export async function getFirebaseIdAsync(home: string): Promise<string> {
  const mappings = await getAllMappings();
  const mapping = mappings[home];
  return mapping?.firebaseId || home;
}

/**
 * Get Python directory name from any home identifier (async - checks Firebase)
 */
export async function getPythonDirNameAsync(home: string): Promise<string> {
  const mappings = await getAllMappings();
  const mapping = mappings[home];
  return mapping?.pythonDir || home;
}

/**
 * Get home name (snake_case) from any home identifier (async - checks Firebase)
 */
export async function getHomeNameAsync(home: string): Promise<string> {
  const mappings = await getAllMappings();
  const mapping = mappings[home];
  return mapping?.homeName || home;
}

/**
 * Get Firebase ID from any home identifier (sync - fallback only)
 */
export function getFirebaseId(home: string): string {
  const mapping = getMappingsSync()[home];
  return mapping?.firebaseId || home;
}

/**
 * Get Python directory name from any home identifier (sync - fallback only)
 */
export function getPythonDirName(home: string): string {
  const mapping = getMappingsSync()[home];
  return mapping?.pythonDir || home;
}

/**
 * Get home name (snake_case) from any home identifier
 */
export function getHomeName(home: string): string {
  const mapping = getMappingsSync()[home];
  return mapping?.homeName || home;
}

/**
 * Get display name from any home identifier
 */
export function getDisplayName(home: string): string {
  const mapping = getMappingsSync()[home];
  return mapping?.displayName || home;
}

/**
 * Validate that a home has all required mappings configured (async - checks Firebase)
 */
export async function validateHomeMappingAsync(home: string): Promise<{ valid: boolean; missing?: string[] }> {
  const mappings = await getAllMappings();
  const mapping = mappings[home];
  
  if (!mapping) {
    return { valid: false, missing: ['No mapping found'] };
  }
  
  const missing: string[] = [];
  if (!mapping.firebaseId) missing.push('firebaseId');
  if (!mapping.pythonDir) missing.push('pythonDir');
  if (!mapping.homeName) missing.push('homeName');
  if (!mapping.displayName) missing.push('displayName');
  
  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined
  };
}

/**
 * Validate that a home has all required mappings configured (sync - fallback only)
 */
export function validateHomeMapping(home: string): { valid: boolean; missing?: string[] } {
  const mapping = getMappingsSync()[home];
  
  if (!mapping) {
    return { valid: false, missing: ['No mapping found'] };
  }
  
  const missing: string[] = [];
  if (!mapping.firebaseId) missing.push('firebaseId');
  if (!mapping.pythonDir) missing.push('pythonDir');
  if (!mapping.homeName) missing.push('homeName');
  if (!mapping.displayName) missing.push('displayName');
  
  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined
  };
}

/**
 * Get chain ID for a home (async - checks Firebase)
 */
export async function getChainIdAsync(home: string): Promise<string | null> {
  try {
    if (typeof window === 'undefined') {
      const { adminDb } = await import('@/lib/firebase-admin');
      const homeName = await getHomeNameAsync(home);
      const homeRef = adminDb.ref(`/${homeName}`);
      const snapshot = await homeRef.once('value');
      
      if (snapshot.exists()) {
        const homeData = snapshot.val();
        return homeData.chainId || null;
      }
    }
  } catch (error) {
    console.warn('Failed to get chain ID from Firebase:', error);
  }
  return null;
}

/**
 * Get chain Python directory path (e.g., "chains/responsive" or "chains/kindera")
 */
export async function getChainPythonDirAsync(home: string): Promise<string> {
  const chainId = await getChainIdAsync(home);
  if (chainId) {
    return `chains/${chainId}`;
  }
  // Fallback: try to determine from home name (for backwards compatibility during migration)
  const homeName = await getHomeNameAsync(home);
  
  // Map known homes to their chains
  const homeToChainMap: Record<string, string> = {
    'mill_creek_care': 'responsive',
    'the_oneill': 'responsive',
    'franklingardens': 'responsive',
    'berkshire_care': 'kindera',
    'banwell_gardens': 'kindera',
    'test': 'test',
  };
  
  const mappedChain = homeToChainMap[homeName];
  if (mappedChain) {
    return `chains/${mappedChain}`;
  }
  
  throw new Error(`No chain found for home: ${home}. All homes must be assigned to a chain.`);
}

