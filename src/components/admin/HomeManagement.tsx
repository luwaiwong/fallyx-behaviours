'use client';

import { useState, useEffect } from 'react';

interface Home {
  id: string;
  name: string;
  chainId?: string | null;
}

interface Chain {
  id: string;
  name: string;
  homes: string[];
}

export default function HomeManagement() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newHomeName, setNewHomeName] = useState('');
  const [selectedChainId, setSelectedChainId] = useState('');
  const [pythonDir, setPythonDir] = useState('');
  const [creating, setCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    fetchHomes();
    fetchChains();
  }, []);

  const fetchChains = async () => {
    try {
      const response = await fetch('/api/admin/chains');
      const data = await response.json();
      
      if (data.success) {
        setChains(data.chains || []);
      }
    } catch (error) {
      console.error('Error fetching chains:', error);
    }
  };

  const handleMigrate = async () => {
    if (!confirm('This will create/update existing homes (Berkshire Care, Mill Creek Care, etc.) and chains (Kindera, Responsive). Continue?')) {
      return;
    }

    try {
      setMigrating(true);
      setError('');
      setSuccessMessage('');

      const response = await fetch('/api/admin/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const results = data.results;
        const messages = [];
        if (results.chainsCreated.length > 0) {
          messages.push(`Created ${results.chainsCreated.length} chain(s)`);
        }
        if (results.homesCreated.length > 0) {
          messages.push(`Created ${results.homesCreated.length} home(s)`);
        }
        if (results.homesUpdated.length > 0) {
          messages.push(`Updated ${results.homesUpdated.length} home(s)`);
        }
        setSuccessMessage(`Migration completed! ${messages.join(', ')}.`);
        fetchHomes();
        fetchChains();
      } else {
        setError(data.error || 'Failed to run migration');
      }
    } catch (err) {
      console.error('Error running migration:', err);
      setError('Failed to run migration');
    } finally {
      setMigrating(false);
    }
  };

  const fetchHomes = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/admin/homes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setHomes(data.homes || []);
      } else {
        setError(data.error || 'Failed to fetch homes');
      }
    } catch (err) {
      console.error('Error fetching homes:', err);
      setError('Failed to fetch homes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHome = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newHomeName.trim()) {
      setError('Home name is required');
      return;
    }

    try {
      setCreating(true);
      setError('');
      setSuccessMessage('');

      if (!selectedChainId) {
        setError('Please select a chain');
        return;
      }

      const response = await fetch('/api/admin/homes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          homeName: newHomeName, 
          chainId: selectedChainId,
          pythonDir: pythonDir.trim() || undefined // Only send if provided
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage(`Home "${data.displayName}" created successfully! Python directory: ${data.mapping?.pythonDir || 'auto-generated'}`);
        setNewHomeName('');
        setSelectedChainId('');
        setPythonDir('');
        setShowCreateForm(false);
        fetchHomes();
        fetchChains();
      } else {
        setError(data.error || 'Failed to create home');
      }
    } catch (err) {
      console.error('Error creating home:', err);
      setError('Failed to create home');
    } finally {
      setCreating(false);
    }
  };

  if (loading && homes.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Home Management</h3>
          <p className="mt-2 text-sm text-gray-600">
            View and manage behaviour-enabled homes. Use "Seed Existing Homes" to populate Berkshire Care, Mill Creek Care, and other existing homes with their chain associations.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="text-white px-4 py-2 rounded-md text-sm font-medium transition-all hover:shadow-lg disabled:opacity-50"
            style={{ 
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            }}
            onMouseEnter={(e) => {
              if (!migrating) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!migrating) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {migrating ? 'Migrating...' : 'Seed Existing Homes'}
          </button>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-white px-4 py-2 rounded-md text-sm font-medium transition-all hover:shadow-lg"
            style={{ 
              background: 'linear-gradient(135deg, #06b6d4 0%, #0cc7ed 100%)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #06b6d4 0%, #0cc7ed 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {showCreateForm ? 'Cancel' : 'Create Home'}
          </button>
          <button
            onClick={fetchHomes}
            className="text-white px-4 py-2 rounded-md text-sm font-medium transition-all hover:shadow-lg"
            style={{ 
              background: 'linear-gradient(135deg, #06b6d4 0%, #0cc7ed 100%)',
              boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(6, 182, 212, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #06b6d4 0%, #0cc7ed 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 182, 212, 0.3)';
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-md p-4" style={{ backgroundColor: '#e0f7fa', border: '1px solid #b2ebf2' }}>
          <div style={{ color: '#0e7490' }}>{successMessage}</div>
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Create New Home</h4>
          <form onSubmit={handleCreateHome} className="space-y-4">
            <div>
              <label htmlFor="homeName" className="block text-sm font-medium text-gray-700 mb-2">
                Home Name
              </label>
              <input
                type="text"
                id="homeName"
                value={newHomeName}
                onChange={(e) => setNewHomeName(e.target.value)}
                placeholder="e.g., Mill Creek Care"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={creating}
              />
              <p className="mt-1 text-xs text-gray-500">
                This will create a Firebase structure and Python processing directory
              </p>
            </div>
            <div>
              <label htmlFor="pythonDir" className="block text-sm font-medium text-gray-700 mb-2">
                Python Directory Name <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                id="pythonDir"
                value={pythonDir}
                onChange={(e) => setPythonDir(e.target.value)}
                placeholder="e.g., millcreek (auto-generated if left blank)"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={creating}
              />
              <p className="mt-1 text-xs text-gray-500">
                Directory name in the python/ folder. If left blank, will auto-generate from home name (lowercase, no spaces/underscores).
                <br />
                <span className="font-medium">Example:</span> "Mill Creek Care" → "millcreek" (auto) or specify custom like "millcreekcare"
              </p>
            </div>
            <div>
              <label htmlFor="chainId" className="block text-sm font-medium text-gray-700 mb-2">
                Chain
              </label>
              <select
                id="chainId"
                value={selectedChainId}
                onChange={(e) => setSelectedChainId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={creating}
                required
              >
                <option value="">Select a chain</option>
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Select the chain this home belongs to
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewHomeName('');
                  setSelectedChainId('');
                  setPythonDir('');
                  setError('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={creating || !newHomeName.trim() || !selectedChainId}
              >
                {creating ? 'Creating...' : 'Create Home'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Home Name
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {homes.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">
                      No behaviour-enabled homes found
                    </td>
                  </tr>
                ) : (
                  homes.map((home, index) => (
                    <tr key={home.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {home.name}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {homes.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Total Homes:</span> {homes.length}
          </div>
        </div>
      )}
    </div>
  );
}

