import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const chainsRef = adminDb.ref('/chains');
    const snapshot = await chainsRef.once('value');
    
    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,
        chains: []
      });
    }

    const chainsData = snapshot.val();
    const chains = Object.keys(chainsData).map(chainId => ({
      id: chainId,
      name: chainsData[chainId].name || chainId,
      homes: chainsData[chainId].homes || []
    }));

    return NextResponse.json({
      success: true,
      chains: chains.sort((a, b) => a.name.localeCompare(b.name))
    });

  } catch (error) {
    console.error('Error fetching chains:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chains', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainName } = body;

    if (!chainName || typeof chainName !== 'string') {
      return NextResponse.json(
        { error: 'Chain name is required' },
        { status: 400 }
      );
    }

    const sanitizedName = chainName.trim().toLowerCase().replace(/\s+/g, '_');

    // Check if chain already exists
    const chainRef = adminDb.ref(`/chains/${sanitizedName}`);
    const snapshot = await chainRef.once('value');
    
    if (snapshot.exists()) {
      return NextResponse.json(
        { error: 'Chain already exists' },
        { status: 409 }
      );
    }

    // Create chain structure
    await chainRef.set({
      name: chainName,
      homes: [],
      createdAt: new Date().toISOString()
    });

    console.log(`✅ Created chain: ${chainName} (${sanitizedName})`);

    return NextResponse.json({
      success: true,
      message: 'Chain created successfully',
      chainId: sanitizedName,
      chainName: chainName
    });

  } catch (error) {
    console.error('Error creating chain:', error);
    return NextResponse.json(
      { error: 'Failed to create chain', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


