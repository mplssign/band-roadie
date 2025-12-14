import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      return NextResponse.json({ 
        authenticated: false, 
        error: error.message,
        user: null 
      });
    }

    return NextResponse.json({ 
      authenticated: !!user, 
      user: user ? {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        profile_completed: user.user_metadata?.profile_completed
      } : null 
    });
  } catch (error) {
    return NextResponse.json({ 
      authenticated: false, 
      error: 'Server error',
      user: null 
    });
  }
}