// Update the import path below if your supabase client is located elsewhere
import { createClient } from '../../../lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-4">Welcome to Band Roadie!</h1>
      <p className="text-gray-400 mb-4">Logged in as: {user.email}</p>
      <form action="/api/auth/logout" method="post">
        <button 
          type="submit"
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Log Out
        </button>
      </form>
    </div>
  );
}