/**
 * Tests for homeMappings.ts
 * Tests chain-based processing logic
 */

import { 
  getChainIdAsync, 
  getChainPythonDirAsync,
  getHomeNameAsync,
  getPythonDirNameAsync
} from '../homeMappings';

// Mock Firebase admin
jest.mock('../firebase-admin', () => ({
  adminDb: {
    ref: jest.fn((path: string) => ({
      once: jest.fn(() => Promise.resolve({
        val: jest.fn(() => {
          // Mock data
          if (path === '/mill_creek_care') {
            return { chainId: 'responsive', behaviours: {} };
          }
          if (path === '/berkshire_care') {
            return { chainId: 'kindera', behaviours: {} };
          }
          if (path === '/banwell_gardens') {
            return { chainId: 'kindera', behaviours: {} };
          }
          if (path === '/the_oneill') {
            return { chainId: 'responsive', behaviours: {} };
          }
          if (path === '/franklingardens') {
            return { chainId: 'responsive', behaviours: {} };
          }
          return null;
        }),
        exists: jest.fn(() => {
          const paths = ['/mill_creek_care', '/berkshire_care', '/banwell_gardens', '/the_oneill', '/franklingardens'];
          return paths.includes(path);
        })
      }))
    }))
  }
}));

describe('Chain-based processing', () => {
  describe('getChainIdAsync', () => {
    it('should return chain ID for mill_creek_care', async () => {
      const chainId = await getChainIdAsync('mill_creek_care');
      expect(chainId).toBe('responsive');
    });

    it('should return chain ID for berkshire_care', async () => {
      const chainId = await getChainIdAsync('berkshire_care');
      expect(chainId).toBe('kindera');
    });

    it('should return chain ID for banwell_gardens', async () => {
      const chainId = await getChainIdAsync('banwell_gardens');
      expect(chainId).toBe('kindera');
    });
  });

  describe('getChainPythonDirAsync', () => {
    it('should return chains/responsive for mill_creek_care', async () => {
      const chainDir = await getChainPythonDirAsync('mill_creek_care');
      expect(chainDir).toBe('chains/responsive');
    });

    it('should return chains/responsive for the_oneill', async () => {
      const chainDir = await getChainPythonDirAsync('the_oneill');
      expect(chainDir).toBe('chains/responsive');
    });

    it('should return chains/kindera for berkshire_care', async () => {
      const chainDir = await getChainPythonDirAsync('berkshire_care');
      expect(chainDir).toBe('chains/kindera');
    });

    it('should return chains/kindera for banwell_gardens', async () => {
      const chainDir = await getChainPythonDirAsync('banwell_gardens');
      expect(chainDir).toBe('chains/kindera');
    });

    it('should throw error for home without chain', async () => {
      await expect(getChainPythonDirAsync('unknown_home')).rejects.toThrow(
        'No chain found for home: unknown_home. All homes must be assigned to a chain.'
      );
    });
  });
});

