# LifeSync — Claude Code Guide

## Project Structure
```
lifesync/
├── api/
│   └── claude.js      ← Vercel serverless proxy for Anthropic API
├── src/
│   ├── LifeSync.jsx   ← Main dashboard (all tabs live here)
│   ├── App.js         ← Router — handles all routes and auth state
│   ├── Auth.jsx       ← All auth flows (sign up, sign in, onboarding)
│   ├── LandingPage.jsx← Public landing page
│   ├── supabase.js    ← Supabase client
│   └── index.js       ← React root
├── public/
│   └── index.html
├── .env.local         ← Contains Vercel env vars (do not commit)
├── .gitignore         ← Includes node_modules/ and .env
├── package.json
└── CLAUDE.md          ← You are here
```

## Running the app
```bash
npm install
npm start       ← NOT npm run dev
```

## Deploying
```bash
# Deploy to production (lifesync.to)
npx vercel --prod

# Push to GitHub (code backup)
git add .
git commit -m "message"
git push
```

## Tech Stack
- React (Create React App, react-scripts)
- React Router DOM v7
- Supabase (auth + database)
- Vercel (hosting at lifesync.to)
- Anthropic API (via /api/claude proxy)

## Design System
- Background: #f5f4f0 (warm off-white)
- Accent: #d4860a (amber/gold)
- Text: #111010 (near black)
- Muted: #9a9590 (warm gray)
- Green: #3a7d5c, Red: #c0392b
- Fonts: DM Sans + DM Serif Display (Google Fonts)
- Shared styles live in the `C` object around line 407 of LifeSync.jsx

## AI Features
- All 3 AI fetch calls in LifeSync.jsx point to `/api/claude` (NOT api.anthropic.com directly)
- `api/claude.js` proxies to Anthropic using `process.env.ANTHROPIC_API_KEY`
- `ANTHROPIC_API_KEY` is set in Vercel environment variables dashboard
- Never hardcode the API key in any source file

## Routing (App.js)
- `/`      → LandingPage (props: onGetStarted, onSignIn, onDemo)
- `/login` → Auth (props: onAuthenticated, onBack, onDemo)
- `/demo`  → LifeSync isDemo={true}
- `/app`   → LifeSync user={user} onSignOut={handleSignOut}
- `*`      → Navigate to /

## Auth (Auth.jsx)
- Handles signup, signin, and onboarding in one file
- Internal mode state: "signup" | "signin" | "onboarding"
- Onboarding saves to: profiles, body_stats, weight_log tables
- Styled to match LifeSync design system (DM Sans, #f5f4f0, #d4860a)

## Supabase Tables
- profiles — username, onboarding_complete, age_range, income_range, etc.
- body_stats — user_id, goal_type, current_weight, goal_weight, height_in
- weight_log — user_id, weight
- habits, moods, finances, debts, bills, medications, checkups
- supplements, recovery_trackers, goals, user_progress, score_history

## Key things to know
- All tabs are in src/LifeSync.jsx — search for tab==="league" to find tabs
- LandingPage uses callback props (onGetStarted, onDemo) not useNavigate
- node_modules/ is in .gitignore — never commit it
- Always use `npx vercel --prod` if GitHub push fails for any reason
- GitHub repo: https://github.com/robvasq/lifesync
- Live site: https://www.lifesync.to
