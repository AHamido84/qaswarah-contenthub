# Deploying to Vercel

## Option A: import from GitHub (recommended)

1. In Vercel, go to **Add New → Project** and import `AHamido84/qaswarah-contenthub`.
2. Vercel detects the framework as **Next.js**. Keep the default build settings.
3. Add the environment variables listed below, then click **Deploy**.

After that, every push to `main` deploys automatically.

## Option B: upload this folder with the Vercel CLI

```bash
npm i -g vercel
```
```bash
cd qaswarah-contenthub && vercel
```

`vercel` creates a preview deployment, and `vercel --prod` deploys to production. Add the environment variables
in the project settings, or with `vercel env add NAME production`.

## Environment variables (Project → Settings → Environment Variables)

### Production with the real Google Sheet

| Name | Value |
|---|---|
| `DATA_SOURCE` | `google` |
| `SPREADSHEET_ID` | `1KE3W0hCZnX4G14WgHMKJtJ-ZwBMqtIBsafG8RrTlxnc` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | the service account's `client_email` |
| `GOOGLE_PRIVATE_KEY` | the service account's `private_key`. Paste it as-is; both real line breaks and `\n` work |
| `AUTH_MODE` | `google` |
| `NEXTAUTH_URL` | `https://<your-project>.vercel.app`, or your custom domain |
| `NEXTAUTH_SECRET` | a long random string (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from the OAuth client (type *Web application*) |
| `ADMIN_EMAILS` | e.g. `mr.ahamido@gmail.com` |
| `EDITOR_EMAILS` / `VIEWER_EMAILS` | comma-separated, optional |

You also need to do two things in Google Cloud:

- Share the spreadsheet with the service account email as **Editor**.
- Add `https://<your-project>.vercel.app/api/auth/callback/google` to the OAuth client's
  **Authorized redirect URIs**.

### Just to preview it (sample data, no Google setup)

| Name | Value |
|---|---|
| `DATA_SOURCE` | `demo` |
| `AUTH_MODE` | `demo` |
| `ALLOW_DEMO_AUTH_IN_PRODUCTION` | `true` |
| `NEXTAUTH_SECRET` | any long random string |

Anyone with the URL can sign in to a demo deployment, and its data resets when the server restarts.
Only use it as a preview.

## Notes

- To change environment variables after the first deploy, edit them and then **Redeploy**.
- Vercel can run several server instances at once. Writes are serialised within each instance, so if two
  people add an idea at the same moment, both could rarely land in the same empty row. At this team's size
  that is unlikely; see README → Deploying.
