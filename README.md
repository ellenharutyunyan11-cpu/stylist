# Stylist

A demo web app: add your clothes, get AI outfit ideas for an occasion or around a piece you found online, and save the ones you like.

## What's in this folder

- `index.html` – the whole app: the look (CSS), the screens and the behavior (JavaScript)
- `images/` – the 12 sample clothing photos and the Google logo
- `README.md` – this file

## Open it on your computer

Double-click `index.html`, or ask Claude Code: "run a local preview of this folder".

## What only works inside Claude (for now)

These two parts use Claude's built-in page features, so they switch off when the page runs anywhere else:

1. **AI styling and photo labelling.** Outside Claude, the app falls back to "Demo mode" (simple color matching).
2. **Your name and photo after "Continue with Google".**

Everything else works anywhere: wardrobe, onboarding, sign-up screens, saved outfits.

## Next steps (do them in this order, one at a time in Claude Code)

1. **Save your work with git.** Ask: "set up git for this folder and make a first save".
2. **Split the file.** Ask: "split index.html into index.html, styles.css and app.js without changing how it looks or works".
3. **Real AI.** Ask: "add a Netlify Function that calls the Claude API for outfit suggestions and photo labelling, and make the page use it when window.claude isn't available. Keep the API key in a Netlify environment variable, never in the page."
4. **Real sign-in.** Ask: "replace the simulated sign-in with Supabase Auth (email code + Google). Keep my current screens and design."
5. **Real data.** Ask: "store each user's wardrobe and saved outfits in Supabase instead of the browser".
6. **Put it online.** Connect the folder to GitHub, then connect GitHub to Netlify.

After each step: open the app, click through it, and save with git before the next step.
