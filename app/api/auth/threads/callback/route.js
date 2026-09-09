import { NextResponse } from 'next/server';
import {
  exchangeCodeForToken,
  exchangeLongLivedToken,
  getMe,
  getTokenScopes,
} from '@/lib/threads-api';
import {
  getServerConfig,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
} from '@/lib/config';
import { encryptSession } from '@/lib/session';

function home(origin, status, extra = {}) {
  const url = new URL('/', origin);
  url.searchParams.set('oauth', status);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

export async function GET(request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const config = getServerConfig();

  if (!config.configured) {
    return NextResponse.redirect(home(origin, 'config_missing'));
  }

  const oauthError = url.searchParams.get('error');
  const oauthErrorReason =
    url.searchParams.get('error_reason') || url.searchParams.get('error_description');
  if (oauthError) {
    return NextResponse.redirect(
      home(origin, 'denied', { reason: oauthErrorReason || oauthError })
    );
  }

  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const savedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code) {
    return NextResponse.redirect(home(origin, 'missing_code'));
  }

  if (!savedState || !returnedState || savedState !== returnedState) {
    return NextResponse.redirect(home(origin, 'state_error'));
  }

  const redirectUri = `${origin}/api/auth/threads/callback`;

  try {
    const shortLived = await exchangeCodeForToken({
      appId: config.appId,
      appSecret: config.appSecret,
      code,
      redirectUri,
    });

    let token = shortLived.access_token;
    let expiresIn = 60 * 60;

    try {
      const longLived = await exchangeLongLivedToken({
        token,
        appSecret: config.appSecret,
      });
      token = longLived.access_token || token;
      expiresIn = Number(longLived.expires_in) || 60 * 24 * 60 * 60;
    } catch {
      // Short-lived token remains usable. Do not fail the login solely because
      // Meta's long-lived exchange is temporarily unavailable.
    }

    const [profile, scopes] = await Promise.all([
      getMe(token),
      getTokenScopes({
        token,
        appId: config.appId,
        appSecret: config.appSecret,
      }),
    ]);

    const expiresAt = Date.now() + Math.max(300, expiresIn - 300) * 1000;
    const session = encryptSession(
      {
        token,
        profile: {
          id: profile.id,
          username: profile.username,
          name: profile.name || profile.username,
        },
        scopes,
        expiresAt,
      },
      config.appSecret
    );

    const response = NextResponse.redirect(home(origin, 'connected'));
    response.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max(300, Math.floor((expiresAt - Date.now()) / 1000)),
    });
    response.cookies.set(OAUTH_STATE_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return NextResponse.redirect(
      home(origin, 'exchange_error', { code: error?.code || 'OAUTH_ERROR' })
    );
  }
}
