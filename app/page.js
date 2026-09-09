'use client';

import { useEffect, useMemo, useState } from 'react';

const SAVED_KEY = 'threads-scout-v2-saved';

function fmtNumber(value) {
  if (typeof value !== 'number') return '—';
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function fmtDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function oauthMessage() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const status = params.get('oauth');
  if (!status) return null;

  const map = {
    connected: ['success', 'Threads connected successfully.'],
    config_missing: ['error', 'OAuth configuration is incomplete in Vercel.'],
    denied: ['error', 'Threads authorization was cancelled or denied.'],
    state_error: ['error', 'OAuth security check failed. Please reconnect.'],
    missing_code: ['error', 'Meta did not return an authorization code.'],
    exchange_error: ['error', 'Meta could not exchange the OAuth code for a token.'],
  };
  return map[status] || ['error', `OAuth status: ${status}`];
}

export default function HomePage() {
  const [status, setStatus] = useState(null);
  const [username, setUsername] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [saved, setSaved] = useState([]);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setNotice(oauthMessage());
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
    refreshStatus();
  }, []);

  async function refreshStatus() {
    try {
      const response = await fetch('/api/auth/threads/status', { cache: 'no-store' });
      setStatus(await response.json());
    } catch {
      setStatus({ configured: false, connected: false, missing: ['status endpoint'] });
    }
  }

  async function analyze({ demo = false } = {}) {
    const clean = username.replace(/^@/, '').trim();
    if (!clean) {
      setError({
        code: 'USERNAME_REQUIRED',
        message: 'Enter a Threads username first.',
        action: 'Example: threads',
      });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSort('recent');

    try {
      const params = new URLSearchParams({ username: clean });
      if (demo) params.set('demo', '1');
      const response = await fetch(`/api/threads?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error || { message: 'Research request failed.' });
      } else {
        setResult(data);
      }
    } catch {
      setError({
        code: 'NETWORK_ERROR',
        message: 'The browser could not reach Threads Scout.',
        action: 'Check the Vercel deployment and retry.',
        retryable: true,
      });
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    await fetch('/api/auth/threads/disconnect', { method: 'POST' });
    setResult(null);
    setError(null);
    await refreshStatus();
  }

  function savePost(post) {
    const item = {
      ...post,
      savedAt: Date.now(),
      sourceMode: result?.mode,
    };
    const next = [item, ...saved.filter((savedPost) => savedPost.id !== post.id)].slice(0, 200);
    setSaved(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  }

  const metricsAvailable = Boolean(result?.capabilities?.metricsAvailable);

  const posts = useMemo(() => {
    let list = [...(result?.posts || [])];
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((post) => (post.text || '').toLowerCase().includes(q));

    const numeric = (key) => (a, b) => (b[key] ?? -1) - (a[key] ?? -1);
    if (sort === 'recent') {
      list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    } else if (sort === 'viral') list.sort(numeric('viralIndex'));
    else if (sort === 'views') list.sort(numeric('views'));
    else if (sort === 'engagement') list.sort(numeric('engagement'));
    return list;
  }, [result, query, sort]);

  const outliers = (result?.posts || []).filter((post) => post.isOutlier).length;

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">THREADS CONTENT INTELLIGENCE · V2</div>
        <h1>
          Find content signals.<br />
          <span>Know what the API actually knows.</span>
        </h1>
        <p className="hero-copy">
          Research public Threads posts without fake competitor metrics. Analyze your own account with official insights when Meta grants them.
        </p>
      </section>

      <section className="panel connection-panel">
        <div>
          <div className="label">THREADS CONNECTION</div>
          {!status ? (
            <strong>Checking connection…</strong>
          ) : status.connected ? (
            <>
              <strong>Connected as @{status.profile?.username}</strong>
              <div className="subtle">
                {status.scopesKnown
                  ? `${status.scopes?.length || 0} granted permission(s)`
                  : 'Permission list unavailable — API calls will be tested directly'}
              </div>
            </>
          ) : (
            <>
              <strong>Not connected</strong>
              <div className="subtle">
                {status.configured
                  ? 'OAuth is configured and ready.'
                  : `Missing Vercel env: ${(status.missing || []).join(', ')}`}
              </div>
            </>
          )}
        </div>

        <div className="connection-actions">
          {status?.connected ? (
            <>
              <a className="button secondary" href="/api/auth/threads/start">Reconnect</a>
              <button className="button ghost" onClick={disconnect}>Disconnect</button>
            </>
          ) : (
            <a className="button" href="/api/auth/threads/start">Connect Threads</a>
          )}
        </div>
      </section>

      {notice ? (
        <div className={`notice ${notice[0]}`}>
          {notice[1]}
        </div>
      ) : null}

      <section className="search-panel panel">
        <div className="search-row">
          <span className="at">@</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') analyze();
            }}
            placeholder="threads"
            aria-label="Threads username"
          />
          <button className="button" disabled={loading} onClick={() => analyze()}>
            {loading ? 'Analyzing…' : 'Analyze account'}
          </button>
        </div>
        <button className="text-button" onClick={() => analyze({ demo: true })}>Try demo data</button>
      </section>

      {error ? (
        <section className="error-card">
          <div className="error-badges">
            <span className="badge danger">{error.code || 'ERROR'}</span>
            {error.retryable ? <span className="badge safe">Safe to retry</span> : null}
          </div>
          <h2>{error.message}</h2>
          {error.action ? <p><strong>Next:</strong> {error.action}</p> : null}
          <div className="error-actions">
            {error.retryable ? <button className="button secondary" onClick={() => analyze()}>Retry</button> : null}
            {error.code === 'NOT_CONNECTED' || error.code === 'TOKEN_INVALID' || error.code === 'PERMISSION_REQUIRED' ? (
              <a className="button" href="/api/auth/threads/start">Reconnect Threads</a>
            ) : null}
          </div>
          {error.requestId || error.diagnostics ? (
            <details>
              <summary>Diagnostics</summary>
              <pre>{JSON.stringify({ requestId: error.requestId, ...error.diagnostics }, null, 2)}</pre>
            </details>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <span>ACCOUNT</span>
              <strong>@{result.profile?.username}</strong>
              <small>{result.mode === 'own-account' ? 'Your account' : result.mode === 'public-account' ? 'Public research' : 'Demo'}</small>
            </article>
            <article className="stat-card">
              <span>POSTS</span>
              <strong>{result.posts?.length || 0}</strong>
              <small>loaded</small>
            </article>
            <article className="stat-card">
              <span>OUTLIERS</span>
              <strong>{metricsAvailable ? outliers : '—'}</strong>
              <small>{metricsAvailable ? '≥ 2× baseline' : 'Metrics unavailable'}</small>
            </article>
            <article className="stat-card">
              <span>SAVED</span>
              <strong>{saved.length}</strong>
              <small>this browser</small>
            </article>
          </section>

          <section className={`capability-banner ${metricsAvailable ? 'metrics' : 'content-only'}`}>
            <strong>{metricsAvailable ? 'Performance mode' : 'Content research mode'}</strong>
            <span>
              {metricsAvailable
                ? 'Official metrics are available, so ranking and outlier detection are enabled.'
                : 'No public competitor insights are fabricated. Analyze topic, hook and copy patterns from the posts themselves.'}
            </span>
          </section>

          {(result.warnings || []).map((warning, index) => (
            <div className="warning" key={`${warning}-${index}`}>{warning}</div>
          ))}

          <section className="panel results-panel">
            <header className="results-header">
              <div>
                <h2>Posts</h2>
                <p>{metricsAvailable ? 'Rank what actually stands out.' : 'Research the actual public post content.'}</p>
              </div>
              <div className="filters">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search post text…"
                />
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="recent">Most recent</option>
                  {metricsAvailable ? <option value="viral">Viral index</option> : null}
                  {metricsAvailable ? <option value="views">Views</option> : null}
                  {metricsAvailable ? <option value="engagement">Engagement</option> : null}
                </select>
              </div>
            </header>

            <div className="post-list">
              {posts.length ? posts.map((post) => (
                <article className="post-row" key={post.id}>
                  <div className="post-main">
                    <p className="post-text">{post.text || '[No text]'}</p>
                    <div className="post-meta">{fmtDate(post.timestamp)} · @{post.username || result.profile?.username}</div>
                  </div>

                  {metricsAvailable ? (
                    <div className="metrics-grid">
                      <div><span>Views</span><strong>{fmtNumber(post.views)}</strong></div>
                      <div><span>Likes</span><strong>{fmtNumber(post.likes)}</strong></div>
                      <div><span>Replies</span><strong>{fmtNumber(post.replies)}</strong></div>
                      <div><span>Reposts</span><strong>{fmtNumber(post.reposts)}</strong></div>
                      <div><span>Viral</span><strong>{post.viralIndex ?? '—'}{post.viralIndex ? '×' : ''}</strong></div>
                    </div>
                  ) : (
                    <div className="content-only-chip">Content only</div>
                  )}

                  <div className="post-actions">
                    <button className="text-button" onClick={() => savePost(post)}>Save</button>
                    {post.permalink ? (
                      <a className="open-link" href={post.permalink} target="_blank" rel="noreferrer">Open ↗</a>
                    ) : null}
                  </div>
                </article>
              )) : <div className="empty">No posts matched your filter.</div>}
            </div>
          </section>
        </>
      ) : null}

      <footer>
        Threads Scout V2 · Local research storage · No server-side user database
      </footer>
    </main>
  );
}
