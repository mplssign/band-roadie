'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function TestAuthPage() {
  const [authStatus, setAuthStatus] = useState<{data: unknown; error: unknown} | null>(null);
  const [profileStatus, setProfileStatus] = useState<{data: unknown; error: unknown} | null>(null);
  const [loading, setLoading] = useState(false);

  const checkAuth = async () => {
    setLoading(true);
    const supabase = createClient();
    
    try {
      // Check auth status
      const { data: authData, error: authError } = await supabase.auth.getUser();
      setAuthStatus({ data: authData, error: authError });

      if (authData?.user) {
        // Check profile in database
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();
        
        setProfileStatus({ data: profileData, error: profileError });
      }
    } catch (error) {
      console.error('Error:', error);
    }
    
    setLoading(false);
  };

  const createProfile = async () => {
    try {
      const response = await fetch('/api/users/create-profile', {
        method: 'POST',
      });
      await response.json();

      
      // Refresh profile status
      checkAuth();
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAuthStatus(null);
    setProfileStatus(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">� Authentication Debug</h1>
        
        <div className="flex gap-4 mb-8">
          <button 
            onClick={checkAuth}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check Auth Status'}
          </button>
          
          <button 
            onClick={createProfile}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Create Profile
          </button>
          
          <button 
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        {authStatus && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">🔐 Auth Status</h2>
            <pre className="bg-gray-800 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(authStatus, null, 2)}
            </pre>
          </div>
        )}

        {profileStatus && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">👤 Profile Status</h2>
            <pre className="bg-gray-800 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(profileStatus, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}