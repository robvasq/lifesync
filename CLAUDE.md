# LifeSync — Claude Code Guide

## Project Structure
```
lifesync/
├── src/
│   ├── LifeSync.jsx   ← Main dashboard (all tabs live here)
│   ├── App.js         ← Entry point
│   └── index.js       ← React root
├── public/
│   └── index.html
├── package.json
└── CLAUDE.md          ← You are here
```

## Running the app
```bash
npm install
npm start
```

## Key things to know
- All tabs are in `src/LifeSync.jsx` — search for `tab==="league"` to find the League tab, `tab==="habits"` for Habits, etc.
- Styles use inline style objects. The `C` object near line 407 holds all shared styles.
- The AI chat and wellness check-in call the Anthropic API directly via fetch.
- League data (members, chat, scores) is in the `INITIAL_LEAGUE_MEMBERS` and `INITIAL_TRASH_TALK` constants at the top of the file.

## Example Claude Code prompts
- "Add animations to the leaderboard when scores change"
- "Add a notification badge to the League tab when there are new chat messages"  
- "Let users set a custom avatar color when joining the league"
- "Add a countdown timer showing days left in the season"
- "Make the head-to-head matchup show a category-by-category breakdown"
