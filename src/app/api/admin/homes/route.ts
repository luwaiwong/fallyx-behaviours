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
    const homes: string[] = [];

    for (const key in data) {
      if (key === 'users' || key === 'reviews') {
        continue;
      }

      const homeData = data[key];
      if (homeData && typeof homeData === 'object' && 'behaviours' in homeData) {
        homes.push(key);
      }
    }

    return NextResponse.json({
      success: true,
      homes: homes.sort()
    });

  } catch (error) {
    console.error('Error fetching homes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { homeName } = body;

    if (!homeName || typeof homeName !== 'string') {
      return NextResponse.json(
        { error: 'Home name is required' },
        { status: 400 }
      );
    }

    const sanitizedName = homeName.trim().toLowerCase().replace(/\s+/g, '_');

    // Check if home already exists
    const homeRef = adminDb.ref(`/${sanitizedName}`);
    const snapshot = await homeRef.once('value');
    
    if (snapshot.exists()) {
      return NextResponse.json(
        { error: 'Home already exists' },
        { status: 409 }
      );
    }

    // Create Firebase structure
    await homeRef.set({
      behaviours: {
        createdAt: new Date().toISOString()
      },
    });
    

    console.log(`✅ Created home: ${homeName} (${sanitizedName})`);

    return NextResponse.json({
      success: true,
      message: 'Home created successfully',
      homeName: sanitizedName,
      displayName: homeName
    });

  } catch (error) {
    console.error('Error creating home:', error);
    return NextResponse.json(
      { error: 'Failed to create home', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

