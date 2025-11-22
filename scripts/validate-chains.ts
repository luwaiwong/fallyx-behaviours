/**
 * Validation script to ensure all homes are assigned to chains
 * Run with: npx tsx scripts/validate-chains.ts
 */

import { adminDb } from '../src/lib/firebase-admin';

interface Home {
  id: string;
  name: string;
  chainId?: string;
}

interface Chain {
  id: string;
  name: string;
}

async function validateChains() {
  console.log('🔍 Validating that all homes are assigned to chains...\n');

  try {
    // Get all homes
    const homesRef = adminDb.ref('/');
    const snapshot = await homesRef.once('value');
    const data = snapshot.val();

    if (!data) {
      console.log('❌ No data found in Firebase');
      return;
    }

    const homes: Home[] = [];
    const chains: Chain[] = [];

    // Extract homes and chains
    for (const key in data) {
      if (key === 'users' || key === 'reviews' || key === 'chains' || key === 'homeMappings') {
        if (key === 'chains') {
          const chainsData = data[key];
          for (const chainId in chainsData) {
            chains.push({
              id: chainId,
              name: chainsData[chainId].name || chainId
            });
          }
        }
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

    console.log(`📊 Found ${homes.length} homes and ${chains.length} chains\n`);

    // Check for homes without chains
    const homesWithoutChains = homes.filter(h => !h.chainId);
    
    if (homesWithoutChains.length > 0) {
      console.log('❌ Homes without chains:');
      homesWithoutChains.forEach(home => {
        console.log(`   - ${home.name} (${home.id})`);
      });
      console.log('\n⚠️  All homes must be assigned to a chain!\n');
      process.exit(1);
    }

    // Check for homes with invalid chains
    const validChainIds = chains.map(c => c.id);
    const homesWithInvalidChains = homes.filter(h => h.chainId && !validChainIds.includes(h.chainId));
    
    if (homesWithInvalidChains.length > 0) {
      console.log('❌ Homes with invalid chain IDs:');
      homesWithInvalidChains.forEach(home => {
        console.log(`   - ${home.name} (chain: ${home.chainId})`);
      });
      console.log('\n⚠️  All homes must have valid chain IDs!\n');
      process.exit(1);
    }

    // Show summary
    console.log('✅ All homes are assigned to valid chains:\n');
    const chainGroups: Record<string, Home[]> = {};
    homes.forEach(home => {
      if (!chainGroups[home.chainId!]) {
        chainGroups[home.chainId!] = [];
      }
      chainGroups[home.chainId!].push(home);
    });

    for (const chainId in chainGroups) {
      const chain = chains.find(c => c.id === chainId);
      console.log(`📦 ${chain?.name || chainId} (${chainId}):`);
      chainGroups[chainId].forEach(home => {
        console.log(`   - ${home.name}`);
      });
      console.log();
    }

    console.log('✅ Validation passed! All homes are properly assigned to chains.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error validating chains:', error);
    process.exit(1);
  }
}

validateChains();

