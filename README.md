# Stylist

A web app: add your clothes (the background is removed and the color detected automatically), get outfit ideas for an occasion or around a piece you found online, see which pieces would be worth adding (with links to your favorite shops), and save the outfits you like.

## What's in this folder

- `index.html` – the whole app: the look (CSS), the screens and the behavior (JavaScript)
- `images/` – the 12 sample clothing photos, the Google logo and the email logos
- `netlify/functions/ai.mjs` – the AI server function (Claude), for signed-in users
- `netlify.toml`, `package.json` – Netlify settings and the Anthropic SDK dependency
- `supabase/wardrobe.sql` – database tables, security rules and photo storage (run once in Supabase)
- `emails/` – the sign-up and sign-in code emails (paste into Supabase → Authentication → Emails)
- `.claude/` – local preview server for Claude Code

## Services

- **Supabase** – accounts (email code sign-in), wardrobes, saved outfits and photos. Each person can only see their own data.
- **Resend** – sends the code emails (connected in Supabase → Authentication → Emails → SMTP Settings).
- **Netlify** – hosts the app and runs the AI function.
- **Anthropic** – Claude, for styling and photo labelling. The API key lives only in Netlify's environment variables.

## Run it on your computer

Ask Claude Code to "open the demo". On your computer AI runs in "Demo mode" (simple matching); the live site has real AI for signed-in users.

## Deploying (Netlify)

1. In Netlify, add a new site from GitHub and pick this repository. The settings come from `netlify.toml`.
2. In Site configuration → Environment variables, add `ANTHROPIC_API_KEY`.
3. In Supabase → Authentication → URL Configuration, set the Site URL to the live address and add it to Redirect URLs.
