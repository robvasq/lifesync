# LifeSync — Claude Session Context

## Stack
- React (Create React App)
- Supabase (auth + database)
- Vercel (hosting at lifesync.to)
- GitHub: github.com/robvasaq/lifesync

## File Structure
src/
  App.js        — routing, auth state
  Auth.jsx      — login/signup/onboarding
  LifeSync.jsx  — entire dashboard (2800+ lines)
  supabase.js   — shared supabase client

## Supabase Tables
habits, moods, finances, debts, bills, medications,
checkups, supplements, score_history, profiles,
body_stats, weight_log, user_progress

## What's Built
- Full auth + onboarding
- Life Score (100pt system across 4 pillars)
- Habits tracker with streaks + heatmaps
- Finances: income/expenses/savings/debts/bills
- Health: medications, checkups, supplements
- Wellness: mood tracking, PHQ-2, AI chat
- League: leaderboard, head-to-head, chat
- Profile: body stats, BMI, TDEE, weight log
- Gamification: XP, levels, daily streak, badges

## Next Up (priority order)
1. Custom Goals system
2. AI chat uses real data on first load
3. Mobile responsiveness
4. Share / social card

## Key Decisions
- No build tools in Claude sandbox — deploy by downloading files
- finances table has UNIQUE constraint on user_id (for upsert)
- body_stats table has UNIQUE constraint on user_id
- user_progress table has UNIQUE constraint on user_id
- Demo mode uses PICKED_DEMO (selected outside component to avoid hook issues)
- All Supabase calls use maybeSingle() not single()
