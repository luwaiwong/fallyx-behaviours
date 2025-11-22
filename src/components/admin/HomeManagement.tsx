'use client';

import { useState, useEffect } from 'react';
import HelpIcon from './HelpIcon';
import CustomStrategyForm from './CustomStrategyForm';
import { ExtractionStrategyConfig, StrategyTemplate } from '@/types/extractionStrategy';

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

export default function TenantManagement() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateChainForm, setShowCreateChainForm] = useState(false);
  const [newHomeName, setNewHomeName] = useState('');
  const [selectedChainId, setSelectedChainId] = useState('');
  const [creating, setCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [newChainName, setNewChainName] = useState('');
  const [newChainExtractionType, setNewChainExtractionType] = useState<StrategyTemplate>('responsive');
  const [creatingChain, setCreatingChain] = useState(false);
  const [showCustomStrategyForm, setShowCustomStrategyForm] = useState(false);
  const [customStrategyConfig, setCustomStrategyConfig] = useState<ExtractionStrategyConfig | null>(null);

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

  const handleCreateChain = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!newChainName.trim()) {
      setError('Please enter a chain name');
      return;
    }

    // If custom strategy, require config
    if (newChainExtractionType === 'custom' && !customStrategyConfig) {
      setError('Please configure the custom strategy first');
      return;
    }

    try {
      setCreatingChain(true);
      setError('');
      setSuccessMessage('');

      const response = await fetch('/api/admin/chains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          chainName: newChainName,
          extractionType: newChainExtractionType,
          extractionConfig: customStrategyConfig || undefined
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage(`Chain "${data.chainName}" created successfully with ${data.extractionType} extraction strategy!`);
        setNewChainName('');
        setNewChainExtractionType('responsive');
        setCustomStrategyConfig(null);
        setShowCreateChainForm(false);
        setShowCustomStrategyForm(false);
        fetchChains();
      } else {
        setError(data.error || 'Failed to create chain');
      }
    } catch (err) {
      console.error('Error creating chain:', err);
      setError('Failed to create chain');
    } finally {
      setCreatingChain(false);
    }
  };

  const handleSaveCustomStrategy = (config: ExtractionStrategyConfig) => {
    setCustomStrategyConfig(config);
    setShowCustomStrategyForm(false);
    // Don't auto-submit - let user review and click "Create Chain"
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
          chainId: selectedChainId
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage(`Home "${data.displayName}" created successfully! It will use the chain's Python processing logic.`);
        setNewHomeName('');
        setSelectedChainId('');
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
      <div>
        <div className="flex items-center">
          <h3 className="text-xl font-semibold text-gray-900">Tenant Management</h3>
          <HelpIcon 
            title="Tenant Management"
            content="Manage chains and homes (tenants) in the system.

• Chains: Groups of related care facilities that share the same Python processing logic. Each chain uses a specific extraction strategy (Kindera, Responsive, or Test).

• Homes: Individual care facilities that track behavioural data. Each home must belong to a chain.

• Seed Existing Homes: Automatically creates/updates existing homes (like Berkshire Care, Mill Creek Care) and their chain associations (Kindera, Responsive). Use this when setting up the system for the first time.

• Create Chain: Create a new chain with an extraction strategy. All homes in a chain share the same Python processing scripts.

• Create Home: Create a new home and assign it to an existing chain. The home will automatically use the chain's Python processing logic."
          />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          View and manage behaviour-enabled homes. Use "Seed Existing Homes" to populate Berkshire Care, Mill Creek Care, and other existing homes with their chain associations.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="text-white px-6 py-1 rounded-md text-sm font-medium transition-all hover:shadow-lg disabled:opacity-50 text-left min-w-[160px]"
            style={{ 
              background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
              boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (!migrating) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(6, 182, 212, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!migrating) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 182, 212, 0.3)';
              }
            }}
          >
            {migrating ? 'Migrating...' : 'Seed Existing Homes'}
          </button>
          <button
            onClick={() => setShowCreateChainForm(!showCreateChainForm)}
            className="text-white px-6 py-1 rounded-md text-sm font-medium transition-all hover:shadow-lg text-left min-w-[120px]"
            style={{ 
              background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
              boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(6, 182, 212, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 182, 212, 0.3)';
            }}
          >
            {showCreateChainForm ? 'Cancel' : 'Create Chain'}
          </button>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-white px-6 py-1 rounded-md text-sm font-medium transition-all hover:shadow-lg text-left min-w-[120px]"
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
            {showCreateForm ? 'Cancel' : 'Create Home'}
          </button>
          <button
            onClick={fetchHomes}
            className="text-white px-6 py-1 rounded-md text-sm font-medium transition-all hover:shadow-lg text-left min-w-[100px]"
            style={{ 
              background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
              boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #0e7490 0%, #155e75 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(6, 182, 212, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)';
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

      {showCreateChainForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Create New Chain</h4>
            <HelpIcon 
              title="Create New Chain"
              content="Create a new chain with an extraction strategy. Chains group related care facilities that share the same Python processing logic.

• Chain Name: The display name of the chain (e.g., 'Kindera', 'Responsive')

• Extraction Strategy: Choose the Python processing strategy:
  - kindera: Uses Berkshire-style extraction (for Kindera chain homes)
  - responsive: Uses Millcreek/Oneill-style extraction (for Responsive chain homes)
  - test: Uses test extraction logic (for testing/development)

All homes added to this chain will automatically use the selected extraction strategy."
            />
          </div>
          <form onSubmit={handleCreateChain} className="space-y-4">
            <div>
              <div className="flex items-center">
                <label htmlFor="chainName" className="block text-sm font-medium text-gray-700 mb-2">
                  Chain Name
                </label>
                <HelpIcon 
                  title="Chain Name"
                  content="Enter the display name of the chain. This name will appear in the dashboard. Example: 'Kindera', 'Responsive', 'Test'"
                />
              </div>
              <input
                type="text"
                id="chainName"
                value={newChainName}
                onChange={(e) => setNewChainName(e.target.value)}
                placeholder="e.g., Kindera, Responsive"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={creatingChain}
                required
              />
            </div>
            <div>
              <div className="flex items-center">
                <label htmlFor="extractionType" className="block text-sm font-medium text-gray-700 mb-2">
                  Extraction Strategy
                </label>
                <HelpIcon 
                  title="Extraction Strategy"
                  content="Select the Python processing strategy for this chain. All homes in this chain will use the same extraction logic:

• kindera: Berkshire-style extraction (used by Kindera chain)
• responsive: Millcreek/Oneill-style extraction (used by Responsive chain)
• test: Test extraction logic (for development/testing)"
                />
              </div>
              <select
                id="extractionType"
                value={newChainExtractionType}
                onChange={(e) => {
                  const newType = e.target.value as StrategyTemplate;
                  setNewChainExtractionType(newType);
                  if (newType === 'custom') {
                    setShowCustomStrategyForm(true);
                  } else {
                    setShowCustomStrategyForm(false);
                    setCustomStrategyConfig(null);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={creatingChain}
                required
              >
                <option value="responsive">Responsive (Millcreek/Oneill style)</option>
                <option value="kindera">Kindera (Berkshire style)</option>
                <option value="test">Test (Development/Testing)</option>
                <option value="custom">Custom Strategy (Configure parameters)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {newChainExtractionType === 'custom' 
                  ? 'Click "Configure Custom Strategy" to set up custom parameters'
                  : 'All homes in this chain will use this extraction strategy for processing files.'}
              </p>
              {newChainExtractionType === 'custom' && !showCustomStrategyForm && (
                <button
                  type="button"
                  onClick={() => setShowCustomStrategyForm(true)}
                  className="mt-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Configure Custom Strategy
                </button>
              )}
            </div>
            {customStrategyConfig && newChainExtractionType === 'custom' && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-sm text-green-800">
                  ✓ Custom strategy configured ({customStrategyConfig.noteTypes.validTypes.length} note types, 
                  {customStrategyConfig.followUpNotes.enabled ? ' follow-up enabled' : ' no follow-up'})
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomStrategyForm(true);
                    setCustomStrategyConfig(null);
                  }}
                  className="mt-2 text-xs text-green-600 hover:text-green-800 underline"
                >
                  Edit Configuration
                </button>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateChainForm(false);
                  setShowCustomStrategyForm(false);
                  setNewChainName('');
                  setNewChainExtractionType('responsive');
                  setCustomStrategyConfig(null);
                  setError('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={creatingChain}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={creatingChain || !newChainName.trim() || (newChainExtractionType === 'custom' && !customStrategyConfig)}
              >
                {creatingChain ? 'Creating...' : 'Create Chain'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showCustomStrategyForm && (
        <CustomStrategyForm
          onSave={handleSaveCustomStrategy}
          onCancel={() => {
            setShowCustomStrategyForm(false);
            if (!customStrategyConfig) {
              setNewChainExtractionType('responsive');
            }
          }}
          initialTemplate={newChainExtractionType === 'custom' ? 'custom' : newChainExtractionType}
        />
      )}

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Create New Home</h4>
            <HelpIcon 
              title="Create New Home"
              content="Create a new behaviour-enabled home in the system. This will:

• Create a Firebase database structure for the home
• Associate the home with a chain
• Automatically use the chain's Python processing logic

The home name should match the actual care facility name (e.g., 'Mill Creek Care'). The home will automatically use the processing scripts from its assigned chain's directory (e.g., python/chains/responsive/)."
            />
          </div>
          <form onSubmit={handleCreateHome} className="space-y-4">
            <div>
              <div className="flex items-center">
                <label htmlFor="homeName" className="block text-sm font-medium text-gray-700 mb-2">
                  Home Name
                </label>
                <HelpIcon 
                  title="Home Name"
                  content="Enter the display name of the care facility. This name will appear in the dashboard and throughout the system. Example: 'Mill Creek Care', 'Berkshire Care'"
                />
              </div>
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
                This will create a Firebase structure for the home. The home will use the chain's Python processing logic.
              </p>
            </div>
            <div>
              <div className="flex items-center">
                <label htmlFor="chainId" className="block text-sm font-medium text-gray-700 mb-2">
                  Chain
                </label>
                <HelpIcon 
                  title="Chain"
                  content="Select the chain this home belongs to. Chains group related care facilities together (e.g., 'Kindera', 'Responsive'). Each home must be associated with a chain."
                />
              </div>
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
                Select the chain this home belongs to. The home will automatically use the chain's Python processing scripts.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewHomeName('');
                  setSelectedChainId('');
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

