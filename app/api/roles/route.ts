import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  try {
    const { data, error } = await supabase.from('roles').select('id, name').order('name');
    if (error) throw error;
    return new Response(JSON.stringify(data || []), { status: 200 });
  } catch (err) {
    console.error('Failed to fetch roles', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch roles' }), { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = createClient();
  try {
    const body = await req.json();
    const name = (body?.name || '').trim();
    if (!name) return new Response(JSON.stringify({ error: 'Missing role name' }), { status: 400 });

    const { data, error } = await supabase.from('roles').insert({ name }).select('id, name').limit(1);
    if (error) {
      // If conflict due to unique index, attempt to fetch existing by case-insensitive name
      const isErrWithMessage = (e: unknown): e is { message: unknown } => !!e && typeof e === 'object' && 'message' in e;
      const message = isErrWithMessage(error) && typeof error.message === 'string' ? error.message : '';
      if (message.includes('duplicate') || message.includes('unique')) {
        const { data: existing } = await supabase.from('roles').select('id, name').ilike('name', name).limit(1);
        return new Response(JSON.stringify(existing?.[0] || null), { status: 200 });
      }
      throw error;
    }

    return new Response(JSON.stringify(data?.[0] || null), { status: 201 });
  } catch (err) {
    console.error('Failed to create role', err);
    return new Response(JSON.stringify({ error: 'Failed to create role' }), { status: 500 });
  }
}
