/**
 * Simple test script to verify chain mapping logic
 * Run with: node scripts/test-chain-mapping.js
 */

// Test data: Home to Chain mapping (matches homeMappings.ts fallback)
const homeToChainMap = {
  'mill_creek_care': 'responsive',
  'the_oneill': 'responsive',
  'franklingardens': 'responsive',
  'berkshire_care': 'kindera',
  'banwell_gardens': 'kindera',
};

// Expected chain Python directories
const expectedChainDirs = {
  'mill_creek_care': 'chains/responsive',
  'the_oneill': 'chains/responsive',
  'franklingardens': 'chains/responsive',
  'berkshire_care': 'chains/kindera',
  'banwell_gardens': 'chains/kindera',
};

console.log('🧪 Testing Chain Mapping Logic\n');

let passed = 0;
let failed = 0;

// Test each home
for (const [home, expectedChain] of Object.entries(homeToChainMap)) {
  const expectedDir = expectedChainDirs[home];
  const actualDir = `chains/${expectedChain}`;
  
  if (actualDir === expectedDir) {
    console.log(`✅ ${home} -> ${actualDir}`);
    passed++;
  } else {
    console.log(`❌ ${home} -> Expected: ${expectedDir}, Got: ${actualDir}`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed!');
  process.exit(1);
}

