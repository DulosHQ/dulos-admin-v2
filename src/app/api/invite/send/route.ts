import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/invite/send
 * Sends beautiful Dulos invite email via Gmail API
 * This runs as a serverless function (App Router) — can use Node.js modules
 */
export async function POST(request: NextRequest) {
  try {
    const { email, name, role } = await request.json();
    if (!email || !name || !role) {
      return NextResponse.json({ error: 'Missing email, name, or role' }, { status: 400 });
    }

    // Dynamic import to avoid webpack bundling issues
    const { sendInviteEmail } = await import('@/lib/send-email');
    const result = await sendInviteEmail({ to: email, name, role });

    return NextResponse.json({
      emailSent: result.success,
      emailMethod: result.success ? 'gmail' : 'none',
      messageId: result.messageId,
      error: result.error,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Email send API error:', msg);
    return NextResponse.json({ emailSent: false, error: msg }, { status: 500 });
  }
}
