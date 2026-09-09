import { NextResponse } from 'next/server';
import { getServerConfig, SESSION_COOKIE, THREADS_SCOPES } from '@/lib/config';
import { decryptSession } from '@/lib/session';

export async function GET(request) {
  const config = getServerConfig();
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const session = config.configured
    ? decryptSession(cookie, config.appSecret)
    : null;

  const scopesKnown = Array.isArray(session?.scopes);
  const scopes = scopesKnown ? session.scopes : null;

  return NextResponse.json({
    ok: true,
    configured: config.configured,
    missing: config.missing,
    connected: Boolean(session?.token),
    profile: session?.profile || null,
    scopes,
    scopesKnown,
    requestedScopes: THREADS_SCOPES,
    capabilities: {
      basic: Boolean(session?.token),
      ownInsights: scopesKnown
        ? scopes.includes('threads_manage_insights')
        : null,
      publicProfileResearch: scopesKnown
        ? scopes.includes('threads_profile_discovery')
        : null,
    },
  });
}
