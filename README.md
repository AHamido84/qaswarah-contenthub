# Qaswarah Content Hub · منصة المحتوى

A web app for planning and tracking content ideas across the Qaswarah group companies. People
add, edit and view ideas in the app, and the Google Sheet
**«أفكار الشركات | التخطيط والتنفيذ»** stays the database. Every change is written straight to the
sheet, and changes made directly in the sheet appear in the app within about 30 seconds.

- **Overview**: KPIs across all companies, overdue and upcoming deadlines, team workload, platform mix.
- **Company workspace** (one per tab): Board (drag a card between status columns), Table
  (sortable, inline status), Calendar (by target date). Filters are kept in the URL, so a filtered view can be shared as a link.
- **Idea panel**: create, edit and delete ideas. It checks the sheet's own dropdown lists and handles edit conflicts.
- **Command palette** (`⌘K` / `Ctrl+K`): search every idea in every company.
- **Data health**: what the app found in the sheet's structure, and a safe fix for the duplicate columns.
- Arabic RTL, light and dark themes, works on mobile.

## Quick start (demo data, no credentials)

```bash
npm install
cp .env.example .env.local   # then set DATA_SOURCE=demo and AUTH_MODE=demo
npm run dev                  # http://localhost:3000 – pick a role on the sign-in page
```

The demo dataset copies the real sheet's layout: row 1 is empty, the headers are on row 2 starting at B,
there are placeholder rows with empty dropdown chips, and «قسورة العقارية» has the duplicate K–N
columns. Demo sign-in is turned off when `NODE_ENV=production`.

## Connecting the real sheet

1. **Service account** (the server uses it to read and write the sheet)
   - In Google Cloud Console, create a project and enable the **Google Sheets API**.
   - Create a service account, then add a JSON key.
   - **Share the spreadsheet** with the service account's `client_email` as **Editor**.
   - Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` (keep the `\n`s and wrap it in quotes).
2. **Google sign-in** (how people log in)
   - Create an OAuth client ID of type *Web application*.
   - Authorised redirect URI: `https://<your-domain>/api/auth/callback/google` (and the
     `http://localhost:3000/...` equivalent for local use).
   - Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `NEXTAUTH_SECRET` (`openssl rand -base64 32`).
3. **Roles**: put email addresses in `ADMIN_EMAILS`, `EDITOR_EMAILS` and `VIEWER_EMAILS`, and optionally set
   `VIEWER_DOMAIN`. Anyone not on these lists is refused. Roles are checked again on every request, so
   removing someone takes effect immediately.
4. Set `DATA_SOURCE=google` and `AUTH_MODE=google`, then check the connection without changing anything:

   ```bash
   npm run inspect:sheet
   ```

   This prints each tab's header row, which column holds which field, the dropdown option lists
   it read from the sheet's Data Validation, the duplicate columns, and the proposed fix.

| Role   | View | Add / edit ideas | Delete ideas | Add companies | Apply data fixes |
|--------|:---:|:---:|:---:|:---:|:---:|
| مشاهد viewer | ✓ | | | | |
| محرر editor  | ✓ | ✓ | | | |
| مدير admin   | ✓ | ✓ | ✓ | ✓ | ✓ |

## How it reads the sheet

- **Tabs → companies.** Every visible tab with a «الفكرة» header counts as a company, so new tabs
  show up on their own. Hidden tabs, tabs whose names start with `_`, and backup tabs are skipped. A company is
  identified by its `gid`, so renaming a tab doesn't break links.
- **Header row** is found automatically: it is the row among the first 10 that matches the most known
  headers, normally row 2. Columns are matched by their Arabic header, not by position. Spaces, tatweel
  and invisible bidi marks are ignored when matching. Unknown columns are reported and left alone.
- **Merged cells** (for example a «الفكرة» header merged across B:C): values are read from any cell in
  the merge and written to its first cell.
- **Empty placeholder rows** (dropdown chips with no values) and rows with an empty «الفكرة» are ignored.
- **Dropdown options** for المنصة / الأولوية / حالة التنفيذ / المسؤول come from the sheet's
  Data Validation, including range-based lists. If a list is *strict*, the app only offers its
  values. If a field has no list, the app suggests defaults (shown on the Data health page) and also offers
  any values already used in the sheet.
- **Dates**: date cells are read as real dates. Dates typed as text are understood using the
  sheet's locale (m/d or d/m). Dates the app can't read are flagged rather than guessed.
- **Status meaning** (for board colours, "done" and "overdue") is inferred from the wording,
  for example «تم …» means done, «قيد …» means in progress and «مؤجل» means paused. Board columns follow the sheet's own status list.

## How it writes, and data safety

- **No silent overwrites.** Each idea carries a hash of its row. If someone changed that row in the
  sheet after you opened it, your save is rejected and the panel offers to load the current version.
  This check also catches rows that moved because someone inserted rows above them.
- **Only the fields you changed are written**, to their original columns, with `USER_ENTERED` so dates
  stay real dates. Text that Sheets would treat as a formula or number (`=…`, `+…`, `1/2`) is written
  as literal text, which prevents formula injection.
- **New ideas** go into the first fully empty row, so they inherit its dropdown chips. If there is none,
  they go below the data. Writes are serialised per server process.
- **Deleting an idea** (admins only) clears its values. The row itself stays, so nothing below it moves.
- **Audit log**: all writes go through the service account, so the sheet's own version history
  can't show who changed what. The app therefore adds rows to a hidden tab `_سجل_التطبيق`
  (time, user, action, company, row, details).
- **New company**: copies a healthy company tab (formatting, column widths, dropdowns) and clears its
  data rows. If no healthy tab exists, it creates a tab with the standard headers on row 2 from B to J.

### The duplicate K–N columns in «قسورة العقارية»

The app detects headers that appear more than once and **only ever reads and writes the first
(original) column**. It reports this on the Data health page and in `npm run inspect:sheet`.

**Proposed fix** (nothing happens until an admin reviews it and approves it on the Data health page,
by typing the company name):

1. Make a full **hidden backup copy** of the tab.
2. **Move** values that exist only in K–N into the empty original cells (G–J).
3. **Keep conflicting values**: where K–N differs from the original, the original stays and the
   K–N value is appended to «ملاحظات» as `[header (عمود مكرر): value]`.
4. **Empty K–N** (header, values, dropdowns). The columns are not deleted, so no other column moves.

Values in rows that have no idea title are kept only in the backup, and the preview lists them. If
the sheet changes between the preview and the approval, the fix is refused and the preview
reloads.

## Architecture

```
src/
  lib/sheets/
    schema.ts          canonical columns (Arabic headers), default options
    parse.ts           header detection, duplicates, merges, rows, options, issues (pure)
    dates.ts           serial/locale-aware date parsing
    gateway.ts         storage boundary
    google-gateway.ts  Sheets API v4 (one batched read per refresh)
    demo-gateway.ts    in-memory sheet with the same quirks
  lib/hub.ts           cache, write lock, create/update/delete, companies, duplicate fix, audit
  lib/auth/            NextAuth (Google SSO), env-based roles
  app/api/             thin route handlers (zod validation → hub)
  components/          UI (dashboard, workspace views, idea panel, data health)
```

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · TanStack Query (optimistic
  updates, 30 s background refresh) · Radix primitives · dnd-kit · cmdk.
- The Google credentials only exist on the server. The browser only talks to `/api/*`, and every
  route checks the user's role.
- Reads are cached for `SHEET_CACHE_TTL` seconds (default 15) and refreshed right after each write, which keeps
  usage well under the Sheets API quota (60 reads per minute per user).

## Scripts

```bash
npm run dev            # local development
npm run build && npm start
npm test               # unit + service tests (parsing, concurrency, duplicate fix, validation)
npm run lint           # type-check
npm run inspect:sheet  # read-only structure report of the configured sheet
```

## Deploying

The app runs on any Node 20+ host, and Vercel works without extra configuration. Set the environment variables from
`.env.example` (with `DATA_SOURCE=google` and `AUTH_MODE=google`) and add the production callback URL
to the OAuth client. The write lock is per process. If you run several instances that write at the
same time, a create can occasionally race for the same empty row. Running a single instance avoids this, as does moving the lock to
a shared store.
