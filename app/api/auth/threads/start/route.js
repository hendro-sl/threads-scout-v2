import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import {
  getServerConfig,
  OAUTH_STATE_COOKIE,
  THREADS_SCOPES,
} from '@/lib/config';

export async function GET(request) {
  const config = getServerConfig();
  const origin = new URL(request.url).origin;

  if (!config.configured) {
    const url = new URL('/', origin);
    url.searchParams.set('oauth', 'config_missing');
    url.searchParams.set('missing', config.missing.join(','));
    return NextResponse.redirect(url);
  }

  const redirectUri = `${origin}/api/auth/threads/callback`;
  const state = randomBytes(24).toString('base64url');
  const authUrl = new URL('https://threads.net/oauth/authorize');
  authUrl.searchParams.set('client_id', config.appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', THREADS_SCOPES.join(','));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}
