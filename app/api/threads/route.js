import { NextResponse } from 'next/server';
import { getServerConfig, SESSION_COOKIE } from '@/lib/config';
import { decryptSession } from '@/lib/session';
import { publicError, ThreadsScoutError } from '@/lib/errors';
import {
  addInsightsWithConcurrency,
  getMe,
  getOwnPosts,
  getPublicPosts,
  getPublicProfile,
} from '@/lib/threads-api';
import { scorePosts } from '@/lib/scoring';

function cleanUsername(value) {
  return String(value || '').replace(/^@/, '').trim();
}

function demoPayload(username) {
  const now = Date.now();
  return {
    ok: true,
    mode: 'demo',
    profile: { username, name: username },
    capabilities: {
      metricsAvailable: true,
      publicResearch: true,
      source: 'demo',
    },
    warnings: ['Demo data is synthetic and is not from Threads.'],
    posts: scorePosts([
      {
        id: 'demo-1',
        username,
        text: 'Most freelancers do not need another skill. They need proof that makes the skill easy to buy.',
        timestamp: new Date(now - 2 * 86400000).toISOString(),
        permalink: 'https://www.threads.com',
        views: 18400,
        likes: 1840,
        replies: 218,
        reposts: 331,
        quotes: 91,
      },
      {
        id: 'demo-2',
        username,
        text: 'Your portfolio is not a gallery. It is a sales argument.',
        timestamp: new Date(now - 5 * 86400000).toISOString(),
        permalink: 'https://www.threads.com',
        views: 5100,
        likes: 730,
        replies: 61,
        reposts: 82,
        quotes: 24,
      },
      {
        id: 'demo-3',
        username,
        text: 'I wasted months changing my Upwork profile when the real problem was the offer.',
        timestamp: new Date(now - 7 * 86400000).toISOString(),
        permalink: 'https://www.threads.com',
        views: 42200,
        likes: 3620,
        replies: 447,
        reposts: 615,
        quotes: 140,
      },
    ]),
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const username = cleanUsername(url.searchParams.get('username'));
  const demo = url.searchParams.get('demo') === '1';

  if (!username) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'USERNAME_REQUIRED',
          message: 'Enter a Threads username.',
          action: 'Use the exact public username without spaces.',
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  if (demo) return NextResponse.json(demoPayload(username));

  try {
    const config = getServerConfig();
    if (!config.configured) {
      throw new ThreadsScoutError(
        'CONFIG_MISSING',
        'Threads OAuth is not configured on this deployment.',
        {
          status: 503,
          action: `Add these Vercel environment variables: ${config.missing.join(', ')}.`,
        }
      );
    }

    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
    const session = decryptSession(sessionCookie, config.appSecret);
    if (!session?.token) {
      throw new ThreadsScoutError('NOT_CONNECTED', 'Threads is not connected.', {
        status: 401,
        action: 'Click Connect Threads first.',
      });
    }

    let me = session.profile;
    if (!me?.username) me = await getMe(session.token);

    const isOwnAccount =
      String(me.username || '').toLowerCase() === username.toLowerCase();
    const scopesKnown = Array.isArray(session.scopes);

    if (isOwnAccount) {
      const feed = await getOwnPosts(session.token, 25);
      let posts = feed.data || [];
      const warnings = [];

      const insightsAllowed = scopesKnown
        ? session.scopes.includes('threads_manage_insights')
        : true;

      if (insightsAllowed && posts.length) {
        const result = await addInsightsWithConcurrency(session.token, posts, 5);
        posts = result.posts;
        if (result.errors.length) {
          warnings.push(
            `${result.errors.length} post insight request(s) could not be loaded. Those metrics are shown as unavailable.`
          );
        }
      } else {
        posts = posts.map((post) => ({
          ...post,
          views: null,
          likes: null,
          replies: null,
          reposts: null,
          quotes: null,
        }));
        warnings.push(
          'threads_manage_insights was not granted, so own-account performance metrics are unavailable.'
        );
      }

      const scored = scorePosts(posts);
      return NextResponse.json({
        ok: true,
        mode: 'own-account',
        profile: me,
        capabilities: {
          metricsAvailable: scored.some((post) => post.hasMetrics),
          publicResearch: scopesKnown
            ? session.scopes.includes('threads_profile_discovery')
            : null,
          source: 'threads-api',
        },
        warnings,
        posts: scored,
      });
    }

    if (
      scopesKnown &&
      !session.scopes.includes('threads_profile_discovery')
    ) {
      throw new ThreadsScoutError(
        'PERMISSION_REQUIRED',
        'Public profile research is unavailable because Meta did not grant threads_profile_discovery to this token.',
        {
          status: 403,
          retryable: false,
          action:
            'Disconnect and reconnect Threads. If the scope is still missing, fix the permission access/testing status in Meta Developer before changing any code.',
          meta: {
            grantedScopes: session.scopes,
            requiredScope: 'threads_profile_discovery',
          },
        }
      );
    }

    const feed = await getPublicPosts(session.token, username, 50);
    const posts = (feed.data || []).map((post) => ({
      ...post,
      views: null,
      likes: null,
      replies: null,
      reposts: null,
      quotes: null,
    }));

    let profile = {
      username: posts[0]?.username || username,
      name: posts[0]?.username || username,
    };

    try {
      const lookup = await getPublicProfile(session.token, username);
      if (lookup && typeof lookup === 'object') {
        profile = { ...profile, ...lookup };
      }
    } catch {
      // Profile metadata enrichment is optional. Public posts remain useful.
    }

    return NextResponse.json({
      ok: true,
      mode: 'public-account',
      profile,
      capabilities: {
        metricsAvailable: false,
        publicResearch: true,
        source: 'threads-api',
      },
      warnings: [
        'Meta exposes the public post content here, but owner-only post insights are not treated as competitor metrics. Viral scores are intentionally disabled for public accounts.',
      ],
      posts: scorePosts(posts),
    });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
