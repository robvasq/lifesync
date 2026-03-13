const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userData, mode, userMessage, conversationHistory } = req.body;

  const buildContext = (data) => {
    if (!data) return "No user data available.";
    const lines = [];

    if (data.profile) {
      lines.push(`USER: ${data.profile.username || "User"}, Age range: ${data.profile.age_range || "unknown"}, Goal: ${data.profile.goal_type || "general wellness"}, Life Score: ${data.profile.lifeScore ?? "unknown"}/100`);
    }

    if (data.habits?.length) {
      const habitLines = data.habits.map(h =>
        `  • ${h.label} — streak: ${h.streak}d, this period: ${h.weekCount}/${h.target}, logged today: ${h.loggedToday ? "yes" : "no"}`
      );
      lines.push(`HABITS (${data.habits.length} active):\n${habitLines.join("\n")}`);
    }

    if (data.goals?.length) {
      const goalLines = data.goals.map(g =>
        `  • ${g.title} (${g.category}): ${g.current_value ?? "?"}/${g.target_value ?? "?"} ${g.unit || ""}${g.deadline ? `, due ${g.deadline}` : ""}`
      );
      lines.push(`GOALS (${data.goals.length} active):\n${goalLines.join("\n")}`);
    }

    if (data.finances) {
      const f = data.finances;
      lines.push(`FINANCES: Income $${(f.monthlyIncome || 0).toLocaleString()}/mo, Expenses $${(f.monthlyExpenses || 0).toLocaleString()}/mo, Cashflow $${(f.cashflow || 0).toLocaleString()}/mo, Savings: $${(f.savings || 0).toLocaleString()}`);
      if (f.debts?.length) {
        lines.push(`DEBTS (${f.debts.length}): ${f.debts.map(d => `${d.name} $${(d.balance || 0).toLocaleString()}${d.rate ? ` @ ${d.rate}%` : ""}`).join(", ")}`);
      }
    }

    if (data.supplements?.length) {
      lines.push(`SUPPLEMENTS: ${data.supplements.map(s => `${s.name} (${s.streak}d streak, ${s.takenToday ? "taken" : "not yet"} today)`).join(", ")}`);
    }

    if (data.moods?.length) {
      const recent = data.moods.slice(-7);
      const avg = (recent.reduce((a, b) => a + (b.score || 0), 0) / recent.length).toFixed(1);
      lines.push(`MOOD (last 7 entries): avg ${avg}/10 — scores: ${recent.map(m => m.score).join(", ")}`);
    }

    if (data.bodyStats) {
      lines.push(`BODY: ${data.bodyStats.current_weight}lbs → goal ${data.bodyStats.goal_weight}lbs, height ${data.bodyStats.height_in}in, goal type: ${data.bodyStats.goal_type || "general"}`);
    }
    if (data.weightLog?.length) {
      lines.push(`WEIGHT LOG (last 7): ${data.weightLog.slice(-7).map(w => w.weight).join(" → ")} lbs`);
    }

    if (data.scoreHistory?.length) {
      lines.push(`LIFE SCORE TREND (recent weeks): ${data.scoreHistory.join(" → ")}`);
    }

    return lines.join("\n");
  };

  const systemPrompt = `You are LifeSync Coach — a sharp, warm, and genuinely insightful personal AI coach embedded in the LifeSync app. You have access to the user's real data across habits, mood, finances, health, and sleep.

Your personality:
- Direct but caring — like a trusted friend who happens to be an expert
- You notice CROSS-DOMAIN patterns others miss (e.g., "you spend more when your mood is low" or "your sleep suffers after skipping your evening habit")
- You give ONE clear, actionable insight — not a list of generic tips
- You're honest, not just positive — if something looks off, you say so tactfully
- Keep responses conversational, 2-4 sentences max unless asked for more
- Never say "Great question!" or use filler phrases
- Use the user's actual data in your responses — be specific, not generic

USER DATA SNAPSHOT:
${buildContext(userData)}

When in "daily_insight" mode: Analyze ALL data and surface the single most interesting cross-domain pattern or insight. Lead with the insight, not a greeting.
When in "open_greeting" mode: Give a brief, personalized check-in based on recent patterns. 2 sentences max.
When in "morning_briefing" mode: Generate a warm, personalized good morning message. Open with their name and a one-line observation. Then list exactly 3 specific priorities for today drawn directly from their data (habit streaks at risk, bills due, goals near deadline, supplements not taken, etc.). Close with one sharp motivating sentence. Under 120 words total. Be concrete — use real numbers and names from their data.
When in "chat" mode: Respond to the user's message using their data as context.`;

  try {
    const messages = mode === "chat" && conversationHistory?.length
      ? [...conversationHistory, { role: "user", content: userMessage }]
      : [{ role: "user", content: mode === "daily_insight"
          ? "Analyze my data and give me your single most valuable cross-domain insight today. Be specific to my numbers."
          : mode === "open_greeting"
          ? "Give me a brief personalized check-in based on my recent patterns. 2 sentences max."
          : mode === "morning_briefing"
          ? "Generate my personalized good morning briefing with my top 3 priorities for today."
          : userMessage }];

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: systemPrompt,
      messages,
    });

    res.status(200).json({ content: response.content[0].text, usage: response.usage });
  } catch (err) {
    console.error("Coach API error:", err);
    res.status(500).json({ error: err.message });
  }
};
