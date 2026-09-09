import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getServerConfig } from '@/lib/config';
import { verifySignedRequest } from '@/lib/meta-signed-request';

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'delete' });
}

export async function POST(request) {
  const config = getServerConfig();
  const form = await request.formData().catch(() => null);
  const signedRequest = form?.get('signed_request');
  const payload = verifySignedRequest(signedRequest, config.appSecret);

  if (signedRequest && !payload) {
    return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 });
  }

  const confirmationCode = randomBytes(12).toString('hex');
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    url: `${origin}/deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
