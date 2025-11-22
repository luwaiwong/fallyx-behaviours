'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { db, auth } from '@/lib/firebase';
import HomeManagement from '@/components/admin/HomeManagement';
import UserManagement from '@/components/admin/UserManagement';
import FileUpload from '@/components/admin/FileUpload';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'homes' | 'users' | 'upload'>('homes');
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const userSnapshot = await get(ref(db, `users/${user.uid}`));
        
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          const role = userData.role;
          
          if (role !== 'admin') {
            router.push('/unauthorized');
            return;
          }
          
          setUserRole(role);
        } else {
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        router.push('/login');
        return;
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2" style={{ borderColor: '#06b6d4' }}></div>
      </div>
    );
  }

  if (!userRole || userRole !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <img 
                src="/assets/fallyxlogo.jpeg" 
                alt="Fallyx Logo" 
                className="h-12 w-auto"
              />
              <h1 className="text-2xl font-bold text-gray-900">
                Admin Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {auth.currentUser?.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all text-white"
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
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('homes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                activeTab === 'homes'
                  ? 'text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              style={activeTab === 'homes' ? { borderColor: '#06b6d4', color: '#06b6d4' } : {}}
              onMouseEnter={(e) => {
                if (activeTab !== 'homes') {
                  e.currentTarget.style.borderColor = '#bae6fd';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'homes') {
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              Tenant Management
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                activeTab === 'users'
                  ? 'text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              style={activeTab === 'users' ? { borderColor: '#06b6d4', color: '#06b6d4' } : {}}
              onMouseEnter={(e) => {
                if (activeTab !== 'users') {
                  e.currentTarget.style.borderColor = '#bae6fd';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'users') {
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                activeTab === 'upload'
                  ? 'text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              style={activeTab === 'upload' ? { borderColor: '#06b6d4', color: '#06b6d4' } : {}}
              onMouseEnter={(e) => {
                if (activeTab !== 'upload') {
                  e.currentTarget.style.borderColor = '#bae6fd';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'upload') {
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              File Upload
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {activeTab === 'homes' && <HomeManagement />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'upload' && <FileUpload />}
        </div>
      </main>
    </div>
  );
}

