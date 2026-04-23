# Snacc

A snack and drink logging web app with ratings, personal warehouse views, and lightweight authentication.

## Features

- Track snacks and drinks with editable ratings
- Personal warehouse dashboard with category and vibe breakdowns
- Passkey and PIN authentication flows
- Supabase-backed storage and serverless API functions
- OCR-assisted logging and item search endpoints

## Project structure

- `index.html`, `feed.html`, `drink.html`, `log.html` - core app pages
- `js/` - client-side logic (auth, modal interactions, Supabase client, UI behavior)
- `css/` - app styling
- `api/` - API handlers for search, OCR, rating updates, and deletion
- `supabase/` - migrations and edge function (`pin-auth`)

## Local development

1. Install and configure Supabase CLI if needed.
2. Ensure Supabase project settings and auth keys are configured.
3. Serve the project with any static web server.
4. Open `auth.html` and complete login/registration.

## Notes

- The app expects Supabase URL/anon key values in `js/supabase.js`.
- Keep production keys restricted with proper RLS policies in Supabase.

