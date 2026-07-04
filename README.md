# CRM Project Board

Static GitHub Pages build for the Supabase-backed CRM/project board.

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
