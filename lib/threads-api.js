import { classifyMetaError, ThreadsScoutError } from '@/lib/errors';

const API = 'https://graph.threads.net/v1.0';
const OAUTH_API = 'https://graph.threads.net';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function parseResponse(response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { error_message: raw.slice(0, 500) };
  }
}

export async function threadsRequest(
  path,
  { params = {}, token, method = 'GET', body, retries = 2 } = {}
) {
  if (!token) {
    throw new ThreadsScoutError('NOT_CONNECTED', 'Threads is not connected.', {
      status: 401,
      action: 'Connect Threads first.',
    });
  }

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const url = new URL(`${API}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
    url.searchParams.set('access_token', token);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        method,
        body,
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      const json = await parseResponse(response);
      if (response.ok && !json?.error) return json;

      const classified = classifyMetaError({
        status: response.status,
        body: json,
      });
      lastError = classified;

      if (!classified.retryable || attempt === retries) throw classified;
      await sleep(attempt === 0 ? 400 : 1000);
    } catch (error) {
      clearTimeout(timeout);
      if (error?.name === 'AbortError') {
        lastError = new ThreadsScoutError(
          'META_TIMEOUT',
          'Threads API did not respond before the request timed out.',
          {
            status: 504,
            retryable: true,
            action: 'Retry later.',
          }
        );
      } else if (error instanceof ThreadsScoutError) {
        lastError = error;
      } else {
        lastError = new ThreadsScoutError(
          'NETWORK_ERROR',
          'Could not reach the Threads API.',
          {
            status: 502,
            retryable: true,
            action: 'Retry later.',
          }
        );
      }

      if (!lastError.retryable || attempt === retries) throw lastError;
      await sleep(attempt === 0 ? 400 : 1000);
    }
  }

  throw lastError;
}

export async function exchangeCodeForToken({
  appId,
  appSecret,
  code,
  redirectUri,
}) {
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(`${OAUTH_API}/oauth/access_token`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = await parseResponse(response);
  if (!response.ok || !json?.access_token) {
    throw classifyMetaError({ status: response.status, body: json });
  }
  return json;
}

export async function exchangeLongLivedToken({ token, appSecret }) {
  const url = new URL(`${OAUTH_API}/access_token`);
  url.searchParams.set('grant_type', 'th_exchange_token');
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('access_token', token);

  const response = await fetch(url, { cache: 'no-store' });
  const json = await parseResponse(response);

  if (!response.ok || !json?.access_token) {
    throw classifyMetaError({ status: response.status, body: json });
  }
  return json;
}

export async function getTokenScopes({ token, appId, appSecret }) {
  try {
    const appTokenUrl = new URL(`${OAUTH_API}/oauth/access_token`);
    appTokenUrl.searchParams.set('grant_type', 'client_credentials');
    appTokenUrl.searchParams.set('client_id', appId);
    appTokenUrl.searchParams.set('client_secret', appSecret);

    const appTokenResponse = await fetch(appTokenUrl, { cache: 'no-store' });
    const appTokenJson = await parseResponse(appTokenResponse);
    if (!appTokenResponse.ok || !appTokenJson?.access_token) return null;

    const debugUrl = new URL(`${OAUTH_API}/debug_token`);
    debugUrl.searchParams.set('input_token', token);
    debugUrl.searchParams.set('access_token', appTokenJson.access_token);

    const debugResponse = await fetch(debugUrl, { cache: 'no-store' });
    const debugJson = await parseResponse(debugResponse);
    const scopes = debugJson?.data?.scopes;
    return Array.isArray(scopes) ? scopes : null;
  } catch {
    return null;
  }
}

export async function getMe(token) {
  return threadsRequest('/me', {
    token,
    params: {
      fields:
        'id,username,name,threads_profile_picture_url,threads_biography,is_verified',
    },
  });
}

export async function getOwnPosts(token, limit = 25) {
  return threadsRequest('/me/threads', {
    token,
    params: {
      fields:
        'id,media_type,permalink,username,text,timestamp,shortcode,is_quote_post,has_replies',
      limit,
    },
  });
}

export async function getPublicProfile(token, username) {
  return threadsRequest('/profile_lookup', {
    token,
    params: { username },
  });
}

export async function getPublicPosts(token, username, limit = 50) {
  return threadsRequest('/profile_posts', {
    token,
    params: {
      username,
      fields:
        'id,media_type,permalink,username,text,timestamp,shortcode,is_quote_post,has_replies',
      limit,
    },
  });
}

function insightValue(item) {
  if (typeof item?.total_value?.value === 'number') return item.total_value.value;
  if (Array.isArray(item?.values) && typeof item.values[0]?.value === 'number') {
    return item.values[0].value;
  }
  return null;
}

export async function getPostInsights(token, postId) {
  const json = await threadsRequest(`/${postId}/insights`, {
    token,
    params: { metric: 'views,likes,replies,reposts,quotes' },
    retries: 1,
  });

  const byName = Object.fromEntries(
    (json.data || []).filter((item) => item?.name).map((item) => [item.name, item])
  );

  return {
    views: insightValue(byName.views),
    likes: insightValue(byName.likes),
    replies: insightValue(byName.replies),
    reposts: insightValue(byName.reposts),
    quotes: insightValue(byName.quotes),
  };
}

export async function addInsightsWithConcurrency(token, posts, concurrency = 5) {
  const output = new Array(posts.length);
  const errors = [];
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= posts.length) return;

      const post = posts[index];
      try {
        output[index] = {
          ...post,
          ...(await getPostInsights(token, post.id)),
        };
      } catch (error) {
        output[index] = {
          ...post,
          views: null,
          likes: null,
          replies: null,
          reposts: null,
          quotes: null,
        };
        errors.push({ index, code: error?.code || 'INSIGHTS_ERROR' });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, posts.length || 1) }, () => worker())
  );

  return { posts: output, errors };
}
