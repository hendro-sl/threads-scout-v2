import { NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/config';
import { verifySignedRequest } from '@/lib/meta-signed-request';

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'deauthorize' });
}

export async function POST(request) {
  const config = getServerConfig();
  const form = await request.formData().catch(() => null);
  const signedRequest = form?.get('signed_request');
  const payload = verifySignedRequest(signedRequest, config.appSecret);

  // Threads Scout V2 stores no server-side user database. The browser session
  // is an encrypted HttpOnly cookie, so there is no persistent account record
  // to remove on this server-to-server callback.
  return NextResponse.json({ ok: true, verified: Boolean(payload) });
}
