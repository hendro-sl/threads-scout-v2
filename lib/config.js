export const THREADS_SCOPES = [
  'threads_basic',
  'threads_manage_insights',
  'threads_profile_discovery',
];

export const SESSION_COOKIE = 'threads_scout_session';
export const OAUTH_STATE_COOKIE = 'threads_scout_oauth_state';

export function getServerConfig() {
  const appId = process.env.THREADS_APP_ID?.trim();
  const appSecret = process.env.THREADS_APP_SECRET?.trim();

  return {
    appId,
    appSecret,
    configured: Boolean(appId && appSecret),
    missing: [
      !appId ? 'THREADS_APP_ID' : null,
      !appSecret ? 'THREADS_APP_SECRET' : null,
    ].filter(Boolean),
  };
}
