import { NextResponse } from "next/server";
import { z } from "zod";

// Schema for creating a band
const createBandSchema = z.object({
  name: z.string().min(1, "Band name is required"),
  inviteEmails: z.array(z.string().email()).optional().default([]),
});

export type CreateBandPayload = z.infer<typeof createBandSchema>;
export type CreateBandResponse = {
  ok: boolean;
  band: { id: string; name: string } | null;
  invitesCreated: number;
  error?: string;
};

// POST /api/bands — create a band
export async function POST(req: Request): Promise<NextResponse<CreateBandResponse>> {
  try {
    const body = (await req.json()) as unknown;
    const parsed = createBandSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json(
        { ok: false, band: null, invitesCreated: 0, error: message },
        { status: 400 }
      );
    }

    const { name, inviteEmails } = parsed.data;

    // TODO: Replace with real DB create
    const bandId = crypto.randomUUID();

    // If/when you wire this up to invitations, keep this count to avoid the
    // previous "unused variable" lint on inviteEmails.
    const invitesCreated = inviteEmails.length;

    return NextResponse.json(
      { ok: true, band: { id: bandId, name }, invitesCreated },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, band: null, invitesCreated: 0, error: message },
      { status: 500 }
    );
  }
}

// GET /api/bands — lightweight health check / placeholder
export async function GET(): Promise<NextResponse<{ ok: true }>> {
  return NextResponse.json({ ok: true });
}
