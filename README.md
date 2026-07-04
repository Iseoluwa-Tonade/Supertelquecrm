# SuperTelque CRM

Static, single-file (`index.html`) web app for the Supabase-backed CRM: a
dedicated login screen, role-based dashboard, pipeline/project boards, daily
activities, document upload & preview, an approval workflow, team/role
management, and an admin pricing calculator.

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

### One-time setup for documents + roles + pricing

The app expects these tables to already exist from the original build:
`profiles`, `crm_board_items`, `crm_daily_activities`, `crm_change_requests`.

To enable the Documents tab, the expanded role model (admin / manager /
owner / viewer), and the admin Pricing calculator, run `supabase-schema.sql`
once in the Supabase SQL editor. It:

- Creates the `crm_documents` table + row-level security policies.
- Creates a private `crm-documents` storage bucket + storage policies.
- Widens the `profiles.role` check constraint to include `admin` and `viewer`.
- Adds policies so an `admin` can read/update every teammate's profile (used
  by the Team page).
- Creates the `crm_services` table (the pricing calculator's service
  catalog), restricted entirely to the `admin` role.
- Adds `crm_documents` and `crm_services` to the realtime publication.

### Roles

- **admin** — everything a manager can do, plus the Team page (change a
  teammate's role, suspend/reinstate accounts).
- **manager** — edits and deletes board items directly, approves or rejects
  pending change requests from owners.
- **owner** — day-to-day rep. Edits go through the approval queue unless
  reviewed by a manager/admin.
- **viewer** — read-only. Can browse the board, activities, and documents
  but cannot create, edit, delete, or upload.

The first sign-in from the email(s) listed in `ADMIN_BOOTSTRAP_EMAILS`
(inside `index.html`) is treated as `admin` by default until a `profiles`
row exists; update that list (or the `profiles` table directly) to change
who bootstraps as admin.

### Documents

Files are uploaded straight to the `crm-documents` Supabase Storage bucket
and tracked in `crm_documents`. Each file can optionally be linked to a deal
or project; linked files also show up in that record's detail panel. Images
and PDFs preview inline (via a short-lived signed URL); other file types
show a download link. Signed out, the Documents tab shows read-only sample
files so you can see the layout before connecting Supabase.

### Pricing calculator

Admin-only. The **Pricing** tab (hidden for every other role) lets an admin
manage a service catalog — name, unit price, and how it's billed (flat /
hourly / per seat / monthly) — stored in `crm_services`. Below the catalog,
a quote calculator lets the admin set a quantity per service plus a discount
% and tax %, and see a live subtotal/discount/tax/total. The calculator is
scratch space only — nothing about a quote is saved; it's meant for working
out a number while on a call, not for quote history.
