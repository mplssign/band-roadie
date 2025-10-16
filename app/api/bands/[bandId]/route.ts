import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};

function makeAdmin() {
  return createAdminClient(env.url, env.service, { auth: { persistSession: false } });
}

async function getUser() {
  const cookieStore = cookies();
  const supa = createServerClient(env.url, env.anon, {
    cookies: {
      get(name) { return cookieStore.get(name)?.value; },
      set(name, value, options) { cookieStore.set({ name, value, ...options }); },
      remove(name, options) { cookieStore.delete({ name, ...options }); },
    },
  });
  const { data: { user } } = await supa.auth.getUser();
  return user ?? null;
}

async function requireBandMember(bandId: string, userId: string) {
  const admin = makeAdmin();
  const { data, error } = await admin
    .from("band_members")
    .select("role")
    .eq("band_id", bandId)
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function GET(_: Request, { params }: { params: { bandId: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mem = await requireBandMember(params.bandId, user.id);
  if (!mem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = makeAdmin();

  // 1) Fetch band members (no joins — keep it simple and reliable)
  const { data: memberRows, error: membersErr } = await admin
    .from("band_members")
    .select("user_id, role, joined_at")
    .eq("band_id", params.bandId)
    .order("joined_at", { ascending: true });

  if (membersErr) {
    return NextResponse.json({ error: "Failed to fetch band members" }, { status: 500 });
  }

  // 2) Fetch matching user records from *public.users*
  const userIds = Array.from(new Set((memberRows ?? []).map(m => m.user_id).filter(Boolean))) as string[];

  type UserRow = {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    address: string | null;
    zip: string | null;
    birthday: string | null;
    roles: string[] | null;
  };

  let usersById: Record<
    string,
    {
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
      address: string | null;
      zip: string | null;
      birthday: string | null;
      roles: string[] | null;
    }
  > = {};
  if (userIds.length) {
    const { data: userRows, error: usersErr } = await admin
      .from("users") // public.users
      .select("id, email, first_name, last_name, phone, address, zip, birthday, roles")
      .in("id", userIds);

    if (usersErr) {
      return NextResponse.json({ error: "Failed to fetch user profiles" }, { status: 500 });
    }

    usersById = Object.fromEntries(
      ((userRows ?? []) as UserRow[]).map((u) => [
        u.id,
        {
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
          phone: u.phone ?? null,
          address: u.address ?? null,
          zip: u.zip ?? null,
          birthday: u.birthday ?? null,
          roles: Array.isArray(u.roles)
            ? (u.roles as unknown[])
                .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
            : null,
        },
      ])
    );
  }

  // 3) Shape members like before: { user_id, role, joined_at, users: { email, first_name, last_name } }
  const members = (memberRows ?? []).map(m => ({
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    users: usersById[m.user_id] ?? null,
  }));

  // 4) Pending invites (straightforward select)
  const { data: invites, error: invitesErr } = await admin
    .from("band_invitations")
    .select("id,email,status,created_at,expires_at")
    .eq("band_id", params.bandId)
    .in("status", ["pending", "sent"]);

  if (invitesErr) {
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
  }

  return NextResponse.json({ members, invites: invites ?? [] });
}

// Update role
const putSchema = z.object({
  userId: z.string().uuid(),
  role: z.string(),
});
export async function PUT(req: Request, { params }: { params: { bandId: string } }) {
  const body = await req.json();
  const { userId, role } = putSchema.parse(body);

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await requireBandMember(params.bandId, user.id);
  if (!me || me.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const admin = makeAdmin();
  const { error } = await admin
    .from("band_members")
    .update({ role })
    .eq("band_id", params.bandId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Remove member
const delSchema = z.object({ userId: z.string().uuid() });
export async function DELETE(req: Request, { params }: { params: { bandId: string } }) {
  // Try to parse a JSON body. If it contains a userId we'll treat this as
  // "remove member". If there's no body (or no userId) we'll treat it as
  // "delete band" (admin-only).
  let body: unknown = null;
  try {
    body = await req.json();
  } catch (e) {
    body = null;
  }

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await requireBandMember(params.bandId, user.id);
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = makeAdmin();

  // MEMBER REMOVAL (existing behavior)
  if (body && typeof body === 'object' && body !== null && 'userId' in body && typeof (body as { userId?: unknown }).userId === 'string') {
    const parsedBody = body as { userId: string };
    const { userId } = delSchema.parse(parsedBody);

    const isSelfRemoval = userId === user.id;
    if (!isSelfRemoval && me.role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const { error } = await admin
      .from("band_members")
      .delete()
      .eq("band_id", params.bandId)
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // FULL BAND DELETION (no body.userId)
  // Only admins may delete a band
  if (me.role !== 'admin') {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  try {
    // Invoke the DB function to delete band and related rows atomically
    const { error: rpcErr } = await admin.rpc('delete_band', { band_uuid: params.bandId });
    if (rpcErr) {
      return NextResponse.json({ error: 'Failed to delete band (db)' }, { status: 500 });
    }

    // Also clean up any uploaded band images in storage that match the prefix
    try {
      const { data: files, error: listErr } = await admin.storage.from('band-images').list('', { search: `${params.bandId}-` });
      if (listErr) {
        return NextResponse.json({ error: 'Failed to list band images' }, { status: 500 });
      }

      type StorageFile = { name?: string; path?: string };
      const paths: string[] = (files ?? []).map((f: StorageFile) => f.name ?? f.path ?? '').filter(Boolean);
      if (paths.length > 0) {
        const { error: removeErr } = await admin.storage.from('band-images').remove(paths);
        if (removeErr) {
          return NextResponse.json({ error: 'Failed to remove band images from storage' }, { status: 500 });
        }
      }
    } catch (e) {
      return NextResponse.json({ error: 'Failed to remove band images from storage' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete band' }, { status: 500 });
  }
}

const patchSchema = z.object({
  name: z.string().min(1),
  avatarColor: z.string().min(1),
});

export async function PATCH(req: Request, { params }: { params: { bandId: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await requireBandMember(params.bandId, user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const name = formData.get("name");
  const avatarColor = formData.get("avatarColor");
  const image = formData.get("image");

  const parsed = patchSchema.safeParse({ name, avatarColor });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(", ") },
      { status: 400 },
    );
  }

  const admin = makeAdmin();
  let imageUrl: string | null = null;

  if (image instanceof File) {
    const ext = image.type.split("/")[1] ?? "jpg";
    const fileName = `${params.bandId}-${Date.now()}.${ext}`;
    const arrayBuffer = await image.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("band-images")
      .upload(fileName, Buffer.from(arrayBuffer), {
        contentType: image.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
    }

    const { data: publicUrl } = admin.storage.from("band-images").getPublicUrl(fileName);
    imageUrl = publicUrl?.publicUrl ?? null;
  }

  const { error: updateError } = await admin
    .from("bands")
    .update({
      name: parsed.data.name,
      avatar_color: parsed.data.avatarColor,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    })
    .eq("id", params.bandId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update band" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imageUrl });
}
