import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};

const adminClient = () =>
  createAdminClient(env.url, env.service, {
    auth: { persistSession: false },
  });

export async function POST() {
  try {
    const supabase = createClient();
    const admin = adminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already exists in public.users
    const { data: existingUser } = await admin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (existingUser) {
      return NextResponse.json({ success: true, message: 'User already exists' });
    }

    // Create user profile in public.users table
    const { error: insertError } = await admin
      .from('users')
      .insert({
        id: user.id,
        email: user.email || '',
        profile_completed: false,
      });

    if (insertError) {
      console.error('Failed to create user profile:', insertError);
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'User profile created' });
    
  } catch (error) {
    console.error('Error creating user profile:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}