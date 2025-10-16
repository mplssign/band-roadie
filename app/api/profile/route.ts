import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/client';
import { getBandMemberAddedEmailHtml } from '@/lib/email/templates/member-added';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { first_name, last_name, phone, address, zip, birthday, roles } = body;

    console.log('[PROFILE PATCH] Received roles:', roles);

    // Normalize roles: roles may be an array of role names. Ensure they exist in `roles` table
    let roleNames: string[] = [];
    if (Array.isArray(roles)) {
      roleNames = roles.filter((r: unknown): r is string => typeof r === 'string' && r.trim().length > 0).map((r) => r.trim());
    } else if (typeof roles === 'string' && roles.trim()) {
      roleNames = [roles.trim()];
    }
    
    console.log('[PROFILE PATCH] Normalized roleNames:', roleNames);

    const roleIds: string[] = [];

    try {
      if (roleNames.length > 0) {
        // Upsert roles (by name) and return ids
        const upsertRows = roleNames.map((name) => ({ name }));
        const { error: upsertErr } = await supabase
          .from('roles')
          .upsert(upsertRows, { onConflict: 'name' })
          .select('id, name');

        if (upsertErr) {
          console.warn('Failed to upsert roles:', upsertErr.message || upsertErr);
        }

        // Fetch role ids matching the names (case-insensitive)
        const { data: fetchedRoles, error: fetchErr } = await supabase
          .from('roles')
          .select('id, name')
          .in('name', roleNames);

        if (!fetchErr && Array.isArray(fetchedRoles)) {
          for (const r of fetchedRoles) {
            if (r?.id) roleIds.push(r.id);
          }
        }
      }
    } catch (err) {
      console.error('Error ensuring roles exist:', err);
    }

    // Update the users table in database and mark profile completed
    const { error: updateError } = await supabase
      .from('users')
      .update({
        first_name,
        last_name,
        phone,
        address,
        zip,
        birthday,
        roles: roleNames.length > 0 ? roleNames : null,
        profile_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    console.log('[PROFILE PATCH] Update completed with roles:', roleNames.length > 0 ? roleNames : null);

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Also update user metadata in Supabase Auth so middleware can see completion status
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        profile_completed: true
      }
    });

    if (metadataError) {
      console.error('Failed to update user metadata:', metadataError);
      // Don't fail the request since the profile was saved, just log the error
    }

    // Persist user_roles: replace user's roles with the normalized role ids
    try {
      // Remove existing user roles for this user
      const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', user.id);
      if (delErr) console.warn('Failed to clear existing user_roles:', delErr.message || delErr);

      if (roleIds.length > 0) {
        const inserts = roleIds.map((roleId) => ({ user_id: user.id, role_id: roleId }));
        const { error: insertErr } = await supabase.from('user_roles').insert(inserts);
        if (insertErr) console.warn('Failed to insert user_roles:', insertErr.message || insertErr);
      }
    } catch (err) {
      console.error('Error persisting user_roles:', err);
    }

    // After marking profile completed, accept any pending invitations for this user's email and add them as members
    try {
      // Fetch user's email (fresh)
      const { data: userRow, error: userFetchErr } = await supabase
        .from('users')
        .select('email')
        .eq('id', user.id)
        .limit(1)
        .single();

      if (!userFetchErr && userRow?.email) {
        const normalizedEmail = String(userRow.email).trim().toLowerCase();

        // Find pending or sent invitations matching this email
        const { data: invitations, error: invitesErr } = await supabase
          .from('band_invitations')
          .select('id, band_id, invited_by, status')
          .eq('email', normalizedEmail)
          .in('status', ['pending', 'sent']);

        if (!invitesErr && Array.isArray(invitations) && invitations.length > 0) {
          for (const inv of invitations) {
            try {
              // Ensure not already a member
              const { data: membershipRows, error: memErr } = await supabase
                .from('band_members')
                .select('id')
                .eq('band_id', inv.band_id)
                .eq('user_id', user.id)
                .limit(1);

              if (!memErr && Array.isArray(membershipRows) && membershipRows.length > 0) {
                // already a member
                // mark invite accepted
                await supabase.from('band_invitations').update({ status: 'accepted' }).eq('id', inv.id);
                continue;
              }

              // add member with default role 'member'
              const { error: addErr } = await supabase.from('band_members').insert({
                band_id: inv.band_id,
                user_id: user.id,
                role: 'member',
              });

              if (addErr) {
                console.warn('Failed to add band member on invite accept:', addErr.message || addErr);
                continue;
              }

              // mark invitation accepted
              await supabase.from('band_invitations').update({ status: 'accepted' }).eq('id', inv.id);

              // Fetch inviter name for email
              let inviterName = 'A band member';
              if (inv.invited_by) {
                const { data: inviterRow } = await supabase
                  .from('users')
                  .select('first_name, last_name')
                  .eq('id', inv.invited_by)
                  .limit(1)
                  .single();
                if (inviterRow?.first_name || inviterRow?.last_name) {
                  inviterName = `${inviterRow.first_name ?? ''} ${inviterRow.last_name ?? ''}`.trim() || inviterName;
                }
              }

              // Fetch band name for email
              let bandName = 'Your band';
              try {
                const { data: bandRow } = await supabase
                  .from('bands')
                  .select('name')
                  .eq('id', inv.band_id)
                  .limit(1)
                  .single();
                if (bandRow?.name) bandName = bandRow.name;
              } catch (err) {
                // ignore
              }

              // Send member-added email
              const emailHtml = getBandMemberAddedEmailHtml(bandName, inviterName, String(inv.band_id));
              await sendEmail({
                to: normalizedEmail,
                subject: `${inviterName} added you to ${bandName} on Band Roadie`,
                html: emailHtml,
              });
            } catch (err) {
              console.error('Error processing invitation for user:', err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error processing pending invitations after profile completion:', err);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile from database
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    console.log('[PROFILE GET] Retrieved roles:', profile?.roles);

    if (profileError) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
