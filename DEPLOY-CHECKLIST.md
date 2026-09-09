# Deploy Checklist — Threads Scout V2

## 1. GitHub

Create a NEW empty repository, for example `threads-scout-v2`.
Upload the entire contents of this folder to the repository root.
Do not upload a real `.env` file.

## 2. Vercel

Import the new GitHub repository as a NEW Vercel project.

Add Production environment variables:

- `THREADS_APP_ID` = your Threads App ID
- `THREADS_APP_SECRET` = your Threads App Secret (Secret type)

Deploy.

## 3. Confirm the production URL

Open:

`https://YOUR-DOMAIN.vercel.app/api/health`

Expected:

`configured: true`

## 4. Meta Developer

Threads API > Settings:

Redirect Callback URL:
`https://YOUR-DOMAIN.vercel.app/api/auth/threads/callback`

Uninstall Callback URL:
`https://YOUR-DOMAIN.vercel.app/api/meta/deauthorize`

Delete Callback URL:
`https://YOUR-DOMAIN.vercel.app/api/meta/delete`

Save.

## 5. OAuth test

Open your new app and click `Connect Threads`.
Approve the requested permissions.

Then open:

`https://YOUR-DOMAIN.vercel.app/api/auth/threads/status`

Check:

- `connected: true`
- `scopesKnown: true` when Meta's token debugger endpoint returns scopes
- `threads_profile_discovery` should appear in `scopes`

If `threads_profile_discovery` is missing, STOP. Do not modify code or Vercel. The remaining issue is Meta permission access/testing/review.

## 6. Research test order

1. Your own username
2. `threads`
3. One target public account
4. Intentionally invalid username
5. Demo data

## 7. Never do these while debugging

- Do not rotate App Secret for a Meta 500 error
- Do not add random environment variables
- Do not edit individual production files as a first response
- Do not interpret missing public metrics as zero
