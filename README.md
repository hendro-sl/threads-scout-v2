# Threads Scout V2 Clean

A clean rebuild of Threads Scout for account-level content research.

## What it does

- OAuth connection to Threads (no manual access-token copy/paste)
- Explicitly requests:
  - `threads_basic`
  - `threads_manage_insights`
  - `threads_profile_discovery`
- Own account: loads posts and attempts official post insights
- Public account: loads public post content when Meta grants profile discovery
- Never invents competitor metrics when Meta does not expose them
- Structured errors and retry handling for rate limits / Meta 5xx
- Research saves locally in the browser only
- No external database required

## Required Vercel environment variables

Only two:

- `THREADS_APP_ID`
- `THREADS_APP_SECRET`

The OAuth redirect URL is derived automatically from the production domain, reducing configuration mistakes.

## Meta callback URLs

After Vercel gives the production URL, register:

- Redirect Callback URL: `https://YOUR-DOMAIN.vercel.app/api/auth/threads/callback`
- Uninstall Callback URL: `https://YOUR-DOMAIN.vercel.app/api/meta/deauthorize`
- Delete Callback URL: `https://YOUR-DOMAIN.vercel.app/api/meta/delete`

## Health checks

- `/api/health`
- `/api/auth/threads/status`
- `/api/meta/deauthorize`
- `/api/meta/delete`

## Important product constraint

Public-profile post content and owner post insights are different capabilities in the Threads API. Threads Scout therefore enables performance ranking only when real metrics are available. Public competitor posts are shown in content-research mode without fake viral scores.
