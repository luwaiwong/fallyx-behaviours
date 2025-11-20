import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Migration endpoint to seed existing homes and chains
 * This ensures existing homes (Berkshire, Mill Creek, etc.) are available
 * with proper chain associations
 */
export async function POST(request: NextRequest) {
  try {
    // Define existing chains and their homes
    const chainsToCreate = [
      {
        id: 'kindera',
        name: 'Kindera',
        homes: ['berkshire_care', 'banwell_gardens']
      },
      {
        id: 'responsive',
        name: 'Responsive',
        homes: ['mill_creek_care', 'the_oneill', 'franklingardens']
      }
    ];

    // Define existing homes with their chain associations
    const homesToCreate = [
      { id: 'berkshire_care', name: 'Berkshire Care', chainId: 'kindera' },
      { id: 'banwell_gardens', name: 'Banwell Gardens', chainId: 'kindera' },
      { id: 'mill_creek_care', name: 'Mill Creek Care', chainId: 'responsive' },
      { id: 'the_oneill', name: 'The O\'Neill', chainId: 'responsive' },
      { id: 'franklingardens', name: 'Franklin Gardens', chainId: 'responsive' }
    ];

    const results = {
      chainsCreated: [] as string[],
      chainsSkipped: [] as string[],
      homesCreated: [] as string[],
      homesSkipped: [] as string[],
      homesUpdated: [] as string[]
    };

    // Create chains
    for (const chain of chainsToCreate) {
      const chainRef = adminDb.ref(`/chains/${chain.id}`);
      const chainSnapshot = await chainRef.once('value');
      
      if (!chainSnapshot.exists()) {
        await chainRef.set({
          name: chain.name,
          homes: chain.homes,
          createdAt: new Date().toISOString()
        });
        results.chainsCreated.push(chain.id);
        console.log(`✅ Created chain: ${chain.name} (${chain.id})`);
      } else {
        // Update homes list if chain exists
        const existingData = chainSnapshot.val();
        const existingHomes = existingData.homes || [];
        const newHomes = chain.homes.filter(h => !existingHomes.includes(h));
        
        if (newHomes.length > 0) {
          await chainRef.update({ homes: [...existingHomes, ...newHomes] });
          console.log(`✅ Updated chain ${chain.id} with new homes: ${newHomes.join(', ')}`);
        }
        results.chainsSkipped.push(chain.id);
      }
    }

    // Create/update homes
    for (const home of homesToCreate) {
      const homeRef = adminDb.ref(`/${home.id}`);
      const homeSnapshot = await homeRef.once('value');
      
      if (!homeSnapshot.exists()) {
        // Create new home
        await homeRef.set({
          behaviours: {
            createdAt: new Date().toISOString()
          },
          chainId: home.chainId,
          createdAt: new Date().toISOString()
        });
        results.homesCreated.push(home.id);
        console.log(`✅ Created home: ${home.name} (${home.id}) in chain ${home.chainId}`);
      } else {
        // Update existing home with chainId if missing
        const existingData = homeSnapshot.val();
        if (!existingData.chainId || existingData.chainId !== home.chainId) {
          await homeRef.update({ chainId: home.chainId });
          results.homesUpdated.push(home.id);
          console.log(`✅ Updated home: ${home.name} (${home.id}) with chain ${home.chainId}`);
        } else {
          results.homesSkipped.push(home.id);
        }
      }

      // Ensure home is in chain's homes list
      const chainRef = adminDb.ref(`/chains/${home.chainId}`);
      const chainSnapshot = await chainRef.once('value');
      
      if (chainSnapshot.exists()) {
        const chainData = chainSnapshot.val();
        const homes = chainData.homes || [];
        if (!homes.includes(home.id)) {
          homes.push(home.id);
          await chainRef.update({ homes });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results
    });

  } catch (error) {
    console.error('Error running migration:', error);
    return NextResponse.json(
      { error: 'Failed to run migration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


