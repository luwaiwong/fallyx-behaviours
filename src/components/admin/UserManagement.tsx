'use client';

import { useState, useEffect } from 'react';
import HelpIcon from './HelpIcon';

interface User {
  id: string;
  username?: string | null;
  email?: string | null;
  role: string;
  loginCount?: number;
  createdAt?: string;
  homeId?: string;
  chainId?: string;
}

interface Chain {
  id: string;
  name: string;
  homes: string[];
}

interface Home {
  id: string;
  name: string;
  chainId?: string | null;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [homes, setHomes] = useState<Home[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'homeUser',
    chainId: '',
    homeId: '',
    createNewHome: false,
    newHomeName: ''
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchChains();
    fetchHomes();
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

  const fetchHomes = async () => {
    try {
      const response = await fetch('/api/admin/homes');
      const data = await response.json();
      
      if (data.success) {
        setHomes(data.homes || []);
      }
    } catch (error) {
      console.error('Error fetching homes:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.users || []);
      } else {
        showMessage('Failed to fetch users', 'error');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showMessage('Failed to fetch users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setMessage('');

    try {
      if (formData.password.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        setIsSubmitting(false);
        return;
      }

      if (!formData.role) {
        showMessage('Please select a role', 'error');
        setIsSubmitting(false);
        return;
      }

      // Validate homeUser requirements
      if (formData.role === 'homeUser') {
        if (!formData.chainId) {
          showMessage('Please select a chain', 'error');
          setIsSubmitting(false);
          return;
        }
        if (formData.createNewHome) {
          if (!formData.newHomeName.trim()) {
            showMessage('Home name is required when creating a new home', 'error');
            setIsSubmitting(false);
            return;
          }
        } else {
          if (!formData.homeId) {
            showMessage('Please select or create a home', 'error');
            setIsSubmitting(false);
            return;
          }
        }
      }

      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showMessage('User created successfully!', 'success');
        setFormData({
          username: '',
          password: '',
          role: 'homeUser',
          chainId: '',
          homeId: '',
          createNewHome: false,
          newHomeName: ''
        });
        setShowForm(false);
        fetchUsers();
        fetchChains();
        fetchHomes();
      } else {
        showMessage(data.error || 'Failed to create user', 'error');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      showMessage('Failed to create user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showMessage('User role updated successfully!', 'success');
        fetchUsers();
      } else {
        showMessage(data.error || 'Failed to update user role', 'error');
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      showMessage('Failed to update user role', 'error');
    }
  };

  const handleHomeChainChange = async (userId: string, homeId: string, chainId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/home-chain`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ homeId, chainId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showMessage(data.message || 'User updated successfully!', 'success');
        fetchUsers();
      } else {
        showMessage(data.error || 'Failed to update user home/chain', 'error');
      }
    } catch (error) {
      console.error('Error updating user home/chain:', error);
      showMessage('Failed to update user home/chain', 'error');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showMessage('User deleted successfully!', 'success');
        fetchUsers();
      } else {
        showMessage(data.error || 'Failed to delete user', 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showMessage('Failed to delete user', 'error');
    }
  };

  // Get homes for selected chain
  const getHomesForChain = (chainId: string) => {
    if (!chainId) return [];
    return homes.filter(home => home.chainId === chainId);
  };

  // Get display name for home
  const getHomeDisplayName = (homeId: string | undefined) => {
    if (!homeId) return 'N/A';
    const home = homes.find(h => h.id === homeId);
    return home ? home.name : homeId;
  };

  // Get display name for chain
  const getChainDisplayName = (chainId: string | undefined) => {
    if (!chainId) return 'N/A';
    const chain = chains.find(c => c.id === chainId);
    return chain ? chain.name : chainId;
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const availableRoles = ['admin', 'homeUser'];
  const availableHomesForChain = formData.chainId ? getHomesForChain(formData.chainId) : [];

  function userCreateForm() {
    return (
      <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
        <div className="flex items-center mb-4">
          <h4 className="text-lg font-medium text-gray-900">Add New User</h4>
          <HelpIcon 
            title="Add New User"
            content="Create a new user account. The username will be used to generate an email address (username@example.com). Passwords must be at least 6 characters long. Home users must be assigned to a chain and home."
          />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <HelpIcon 
                title="Username"
                content="The username for the account. This will be used to generate the email address: username@example.com"
              />
            </div>
            <input
              type="text"
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter username"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Email will be: {formData.username || 'username'}@example.com
            </p>
          </div>

          <div>
            <div className="flex items-center">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <HelpIcon 
                title="Password"
                content="Password must be at least 6 characters long. Choose a secure password for the user account."
              />
            </div>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter password (minimum 6 characters)"
              required
              minLength={6}
            />
            {formData.password.length > 0 && formData.password.length < 6 && (
              <p className="mt-1 text-xs text-red-600">
                Password must be at least 6 characters
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center">
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <HelpIcon 
                title="User Role"
                content="• Admin: Full access to admin dashboard (home management, user management, file uploads)

• Home User: Access only to their assigned home's dashboard to view behavioural data"
              />
            </div>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => {
                const newRole = e.target.value;
                setFormData({
                  ...formData,
                  role: newRole,
                  // Reset chain/home when switching to admin
                  chainId: newRole === 'admin' ? '' : formData.chainId,
                  homeId: newRole === 'admin' ? '' : formData.homeId
                });
              }}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="homeUser">homeUser</option>
              <option value="admin">admin</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {formData.role === 'admin' ? 'Admin users have access to the admin dashboard' : 'Home users have access to their home dashboard'}
            </p>
          </div>

          {/* Chain and Home fields - only for homeUser */}
          {formData.role === 'homeUser' && (
            <>
              <div className="border-t border-gray-200 pt-4">
                <div>
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700">
                      Chain
                    </label>
                    <HelpIcon 
                      title="Chain"
                      content="Select an existing chain. Chains group related care facilities together. To create a new chain, use the Home Management section."
                    />
                  </div>
                  <select
                    value={formData.chainId}
                    onChange={(e) => setFormData({
                      ...formData,
                      chainId: e.target.value,
                      homeId: '',
                      createNewHome: false
                    })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a chain</option>
                    {chains.map((chain) => (
                      <option key={chain.id} value={chain.id}>
                        {chain.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.chainId && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <label className="block text-sm font-medium text-gray-700">
                        Home
                      </label>
                      <HelpIcon 
                        title="Home"
                        content="Select an existing home from the selected chain, or create a new home. The home is the specific care facility the user will have access to."
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          createNewHome: false,
                          homeId: ''
                        })}
                        className={`text-xs px-2 py-1 rounded-md ${!formData.createNewHome ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}`}
                      >
                        Select Existing
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          createNewHome: true,
                          homeId: ''
                        })}
                        className={`text-xs px-2 py-1 rounded-md ${formData.createNewHome ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}`}
                      >
                        Create New
                      </button>
                    </div>
                  </div>

                  {formData.createNewHome ? (
                    <input
                      type="text"
                      value={formData.newHomeName}
                      onChange={(e) => setFormData({ ...formData, newHomeName: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter new home name (e.g., Berkshire Care, Mill Creek Care)"
                      required={formData.createNewHome}
                    />
                  ) : (
                    <select
                      value={formData.homeId}
                      onChange={(e) => setFormData({ ...formData, homeId: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required={!formData.createNewHome}
                    >
                      <option value="">Select a home</option>
                      {availableHomesForChain.map((home) => (
                        <option key={home.id} value={home.id}>
                          {home.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

            </>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormData({
                  username: '',
                  password: '',
                  role: 'homeUser',
                  chainId: '',
                  homeId: '',
                  createNewHome: false,
                  newHomeName: ''
                });
              }}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || formData.password.length < 6 || !formData.role}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <h3 className="text-xl font-semibold text-gray-900">User Management</h3>
          <HelpIcon 
            title="User Management"
            content="Manage users and their access to the system.

• Admin Users: Have full access to the admin dashboard, including home management, user management, and file uploads.

• Home Users: Have access only to their assigned home's dashboard. They can view behavioural data for their specific care facility.

Users are automatically assigned email addresses based on their username (username@example.com). Each home user must be associated with a chain and home."
          />
        </div>
        <button
          onClick={() => setShowForm(true)}
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
          Add New User
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-md ${
          messageType === 'error' ? 'bg-red-50 text-red-800' : ''
        }`} style={messageType !== 'error' ? { backgroundColor: '#e0f7fa', color: '#0e7490' } : {}}>
          {message}
        </div>
      )}

      {showForm && userCreateForm()}

      <div className="bg-white shadow overflow-hidden rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <h3 className="text-lg font-medium text-gray-900">All Users</h3>
            <HelpIcon 
              title="All Users"
              content="View and manage all users in the system. You can:

• Change user roles (admin/homeUser)
• Reassign homes and chains for home users
• Delete users

Note: When you change a home user's home, their chain will automatically update to match the home's chain."
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Home
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Login Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.username || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        {availableRoles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.homeId || ''}
                        onChange={(e) => {
                          const newHomeId = e.target.value;
                          if (newHomeId) {
                            const selectedHome = homes.find(h => h.id === newHomeId);
                            // Automatically set chain when home is selected
                            const newChainId = selectedHome?.chainId || '';
                            if (newChainId) {
                              handleHomeChainChange(user.id, newHomeId, newChainId);
                            } else {
                              handleHomeChainChange(user.id, newHomeId, user.chainId || '');
                            }
                          } else {
                            handleHomeChainChange(user.id, '', user.chainId || '');
                          }
                        }}
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-w-[150px]"
                        title="Select a home to assign. The chain will be automatically updated to match the home's chain."
                      >
                        <option value="">{user.homeId ? 'Remove home' : 'Select home'}</option>
                        {/* Show all homes - when a home is selected, chain will auto-update */}
                        {homes.map((home) => (
                          <option key={home.id} value={home.id}>
                            {home.name} {home.chainId ? `(${getChainDisplayName(home.chainId)})` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.chainId || ''}
                        onChange={(e) => {
                          const newChainId = e.target.value;
                          if (newChainId) {
                            // If current home doesn't belong to new chain, clear home selection
                            const currentHome = homes.find(h => h.id === user.homeId);
                            const newHomeId = (currentHome?.chainId === newChainId) ? (user.homeId || '') : '';
                            handleHomeChainChange(user.id, newHomeId, newChainId);
                          } else {
                            handleHomeChainChange(user.id, user.homeId || '', '');
                          }
                        }}
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-w-[120px]"
                        title="Select a chain to assign. If the current home doesn't belong to the new chain, it will be cleared."
                      >
                        <option value="">{user.chainId ? 'Remove chain' : 'Select chain'}</option>
                        {chains.map((chain) => (
                          <option key={chain.id} value={chain.id}>
                            {chain.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.loginCount || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {users.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Total Users:</span> {users.length}
          </div>
        </div>
      )}
    </div>
  );
}
