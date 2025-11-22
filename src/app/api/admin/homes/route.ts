import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const rootRef = adminDb.ref('/');
    const snapshot = await rootRef.once('value');
    
    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,
        homes: []
      });
    }

    const data = snapshot.val();
    const homes: Array<{ id: string; name: string; chainId?: string }> = [];

    for (const key in data) {
      if (key === 'users' || key === 'reviews' || key === 'chains') {
        continue;
      }

      const homeData = data[key];
      if (homeData && typeof homeData === 'object' && 'behaviours' in homeData) {
        homes.push({
          id: key,
          name: key,
          chainId: homeData.chainId || null
        });
      }
    }

    return NextResponse.json({
      success: true,
      homes: homes.sort((a, b) => a.name.localeCompare(b.name))
    });

  } catch (error) {
    console.error('Error fetching homes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to convert display name to camelCase for Firebase ID
function toCamelCase(str: string): string {
  return str
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/\s+/g, '')
    .replace(/^(.)/, (_, c) => c.toLowerCase());
}

// Helper function to generate Python directory name (lowercase, no spaces/underscores)
function generatePythonDir(homeName: string, pythonDirOverride?: string): string {
  if (pythonDirOverride) {
    return pythonDirOverride.trim().toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
  }
  // Auto-generate: lowercase, remove spaces and underscores
  return homeName.trim().toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { homeName, chainId } = body;

    if (!homeName || typeof homeName !== 'string') {
      return NextResponse.json(
        { error: 'Home name is required' },
        { status: 400 }
      );
    }

    if (!chainId || typeof chainId !== 'string') {
      return NextResponse.json(
        { error: 'Chain ID is required' },
        { status: 400 }
      );
    }

    const sanitizedName = homeName.trim().toLowerCase().replace(/\s+/g, '_');
    const displayName = homeName.trim();
    const firebaseId = toCamelCase(displayName);

    // Check if home already exists
    const homeRef = adminDb.ref(`/${sanitizedName}`);
    const snapshot = await homeRef.once('value');
    
    if (snapshot.exists()) {
      return NextResponse.json(
        { error: 'Home already exists' },
        { status: 409 }
      );
    }

    // Verify chain exists
    const chainRef = adminDb.ref(`/chains/${chainId}`);
    const chainSnapshot = await chainRef.once('value');
    
    if (!chainSnapshot.exists()) {
      return NextResponse.json(
        { error: 'Chain not found' },
        { status: 404 }
      );
    }

    // Create Firebase structure with mappings
    await homeRef.set({
      behaviours: {
        createdAt: new Date().toISOString()
      },
      chainId: chainId,
      createdAt: new Date().toISOString(),
      // Store mapping information (pythonDir no longer needed - uses chain directory)
      mapping: {
        firebaseId: firebaseId,
        homeName: sanitizedName,
        displayName: displayName
      }
    });

    // Store mapping in a centralized location for easy lookup
    const mappingsRef = adminDb.ref('/homeMappings');
    const mappingsSnapshot = await mappingsRef.once('value');
    const existingMappings = mappingsSnapshot.exists() ? mappingsSnapshot.val() : {};
    
    // Add multiple entry points for the same home
    const newMappings = {
      ...existingMappings,
      [sanitizedName]: {
        firebaseId: firebaseId,
        homeName: sanitizedName,
        displayName: displayName
      },
      [firebaseId]: {
        firebaseId: firebaseId,
        homeName: sanitizedName,
        displayName: displayName
      }
    };
    
    await mappingsRef.set(newMappings);

    // Add home to chain's homes list
    const chainData = chainSnapshot.val();
    const homes = chainData.homes || [];
    if (!homes.includes(sanitizedName)) {
      homes.push(sanitizedName);
      await chainRef.update({ homes });
    }

    console.log(`✅ Created home: ${displayName} (${sanitizedName}) in chain ${chainId}`);
    console.log(`📋 Mapping: firebaseId=${firebaseId}, will use chain's Python directory: chains/${chainId}`);

    return NextResponse.json({
      success: true,
      message: 'Home created successfully',
      homeName: sanitizedName,
      displayName: displayName,
      chainId: chainId,
      mapping: {
        firebaseId: firebaseId,
        homeName: sanitizedName,
        displayName: displayName
      }
    });

  } catch (error) {
    console.error('Error creating home:', error);
    return NextResponse.json(
      { error: 'Failed to create home', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

