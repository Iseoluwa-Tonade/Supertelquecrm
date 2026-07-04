# SuperTelque CRM

Static, single-file (`index.html`) web app for the Supabase-backed CRM: an
invite-only login screen, role-based dashboard, pipeline/project boards,
daily activities, document upload & preview, an approval workflow, team/role
management with per-teammate page access, HR profile fields, and an admin
pricing calculator.

## GitHub Pages

Use `index.html` as the site entry point.

Recommended Pages settings:

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/root`

## Supabase

Project URL:

`https://otpzsnsrxcfuysjfnguk.supabase.co`

After GitHub Pages gives you a URL, add it in Supabase:

Authentication > URL Configuration

Set:

- Site URL: your GitHub Pages URL
- Redirect URLs: your GitHub Pages URL

The frontend uses a publishable Supabase key only. Do not add a service role key to this repository.

### One-time setup

The app expects these tables to already exist from the original build:
`profiles`, `crm_board_items`, `crm_daily_activities`, `crm_change_requests`.

Run `supabase-schema.sql` once in the Supabase SQL editor (safe to re-run).
It:

- Creates the `crm_documents` table + row-level security policies.
- Creates a private `crm-documents` storage bucket + storage policies. If
  uploads fail with **"Bucket not found,"** this step hasn't run against your
  project yet — re-run the script, or create a private bucket named
  `crm-documents` by hand under Supabase → Storage.
- Widens the `profiles.role` check constraint to include `admin` and `viewer`.
- Adds `profiles.allowed_views` (per-teammate page restriction) and HR
  columns (`phone`, `department`, `job_title`, `start_date`, `employee_id`,
  `emergency_contact_name`, `emergency_contact_phone`, `address`).
- Adds policies so a `manager` or `admin` can read/update every teammate's
  profile (used by the Team page), and a trigger that stops anyone from
  granting themselves a higher role/status through that same self-update
  path (see **Security** below).
- Creates the `crm_services` table (the pricing calculator's service
  catalog), restricted entirely to the `admin` role.
- Adds `document_url` to `crm_board_items` (the sales document link).
- Adds `crm_documents` and `crm_services` to the realtime publication.

### Access is invite-only

There is no self-service sign-up and no demo/preview mode — the login screen
only offers **Sign in**. New teammates are added by an admin through the
Supabase dashboard (Authentication → Users → Add user), not by visiting the
site and creating an account. The first sign-in from the email(s) listed in
`ADMIN_BOOTSTRAP_EMAILS` (inside `index.html`) is treated as `admin` by
default until a `profiles` row exists; update that list (or the `profiles`
table directly) to change who bootstraps as admin. Consider also turning off
"Enable email signups" under Supabase → Authentication → Providers → Email,
so the auth API itself rejects self-registration, not just the UI.

### Roles

- **admin** — the only role with financial visibility: the **Pipeline** tab
  and every dollar figure in the app (Overview KPIs/charts, sidebar "Open
  value," card price tags, approval diffs) are admin-only. Also gets
  everything a manager can do, plus the Team page (change a teammate's role,
  suspend/reinstate accounts, restrict which pages they can see) and the
  Pricing calculator.
- **manager** — same Team page access as admin (view/manage every teammate),
  edits and deletes board items directly, approves or rejects pending change
  requests from owners — but does **not** see Pipeline or any dollar amount
  (deal cards show their due date instead of value, and an approval diff's
  value change is hidden). Does not get the Pricing calculator either.
- **owner** — day-to-day rep, same financial/Pipeline restriction as manager.
  Edits go through the approval queue unless reviewed by a manager/admin.
- **viewer** — read-only, same financial/Pipeline restriction. Can browse
  the board, activities, and documents but cannot create, edit, delete, or
  upload.

Editing a deal's Value while it's hidden doesn't erase it — the field is
kept as a hidden form input so saving preserves the existing amount, it's
just never rendered for non-admins to read.

On the Team page, a manager or admin can also click **Views** next to any
teammate to restrict which nav pages they're allowed to open (layered on top
of their role — e.g. a manager can still be kept out of Documents). Leaving
every box checked means "unrestricted": they see everything their role
allows. You can't restrict your own access this way, to avoid locking
yourself out.

### My Profile / HR fields

Every signed-in teammate (any role) has a **My Profile** page to view their
account info and edit their own contact/HR details — phone, job title,
department, employee ID, start date, address, and emergency contact. Role
and status are shown read-only there and can only be changed by a
manager/admin from the Team page; a database trigger blocks a direct API
call from changing your own role/status even if you're signed in.

### Documents

Files are uploaded straight to the `crm-documents` Supabase Storage bucket
and tracked in `crm_documents`. You can select or drag-and-drop multiple
files at once. Each file can optionally be linked to a deal or project;
linked files also show up in that record's detail panel. Images and PDFs
preview inline (via a short-lived signed URL); other file types show a
download link.

### Sales document link

Besides uploaded files, a deal/project can also carry a plain URL (e.g. a
Google Doc or DocuSign link) in its **Sales document link** field. It shows
as a small 🔗 on the card and an "Open sales document" button in the detail
panel that opens the link in a new tab. Only `http://`/`https://` links are
accepted, to keep a pasted link from being used to run script code when
someone else clicks it.

### Pricing calculator

Admin-only. The **Pricing** tab (hidden for every other role) lets an admin
manage a service catalog — name, unit price, and how it's billed (flat /
hourly / per seat / monthly) — stored in `crm_services`. Below the catalog,
a quote calculator lets the admin set a quantity per service plus a discount
% and tax %, and see a live subtotal/discount/tax/total. The calculator is
scratch space only — nothing about a quote is saved; it's meant for working
out a number while on a call, not for quote history.

### Deleting things

Every delete action (board items, activities, documents, catalog services)
asks for confirmation in a modal first — there's no accidental one-click
delete anywhere in the app.

### Security

- Access control is enforced by Supabase row-level security, not by the UI —
  hiding a button client-side is a UX nicety, the RLS policies in
  `supabase-schema.sql` are what actually stop a request. Review them before
  relying on this for anything sensitive.
- The frontend only ever holds a publishable Supabase key; never add a
  service role key to this repository.
- A CSP + `Referrer-Policy` meta tag is set in `index.html`. Because this is
  a single static file with no build step, the CSP allows `'unsafe-inline'`
  for its one inline `<script>`/`<style>` block — see the comment above that
  tag for the tradeoff and what a real server/CDN deployment could tighten.
- All user-entered text is HTML-escaped before being inserted into the page,
  and the sales document link is restricted to `http(s)://` URLs.
- **Manual step, not fixable via SQL:** Supabase Auth's leaked-password check
  (HaveIBeenPwned) is off by default. Turn it on under Authentication →
  Policies → Password in the Supabase dashboard — `get_advisors` flags this
  on every run until it's enabled there.
