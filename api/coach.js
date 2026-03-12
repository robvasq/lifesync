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
    if (data.profile) lines.push(`USER PROFILE: Age range: ${data.profile.age_range || "unknown"}, Goal: ${data.profile.goal_type || "general wellness"}`);
    if (data.habits?.length) {
      const recentHabits = data.habits.slice(0, 20);
      const completedCount = recentHabits.filter(h => h.completed).length;
      lines.push(`HABITS (last ${recentHabits.length} logs): ${completedCount}/${recentHabits.length} completed. Habit names: ${[...new Set(recentHabits.map(h => h.habit_name))].join(", ")}`);
    }
    if (data.moods?.length) {
      const moodMap = {};
      data.moods.slice(0, 14).forEach(m => { moodMap[m.mood] = (moodMap[m.mood] || 0) + 1; });
      lines.push(`MOOD (last 14 days): ${Object.entries(moodMap).map(([k,v]) => `${k}(${v}x)`).join(", ")}`);
    }
    if (data.finances?.length) {
      const total = data.finances.slice(0, 30).reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
      const categories = [...new Set(data.finances.map(f => f.category))].join(", ");
      lines.push(`FINANCES (last 30): Total spent $${total.toFixed(2)}, Categories: ${categories}`);
    }
    if (data.bodyStats) lines.push(`HEALTH: Current weight ${data.bodyStats.current_weight}lbs, Goal ${data.bodyStats.goal_weight}lbs, Height ${data.bodyStats.height_in}in`);
    if (data.weightLog?.length) {
      const weights = data.weightLog.slice(0, 7).map(w => w.weight);
      lines.push(`WEIGHT LOG (last 7): ${weights.join(", ")} lbs`);
    }
    if (data.recovery?.length) {
      const avgSleep = data.recovery.slice(0, 7).reduce((s, r) => s + (r.sleep_hours || 0), 0) / Math.min(data.recovery.length, 7);
      lines.push(`SLEEP/RECOVERY (avg last 7 days): ${avgSleep.toFixed(1)} hrs sleep`);
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
When in "chat" mode: Respond to the user's message using their data as context.`;

  try {
    const messages = mode === "chat" && conversationHistory?.length
      ? [...conversationHistory, { role: "user", content: userMessage }]
      : [{ role: "user", content: mode === "daily_insight"
          ? "Analyze my data and give me your single most valuable cross-domain insight today. Be specific to my numbers."
          : mode === "open_greeting"
          ? "Give me a brief personalized check-in based on my recent patterns. 2 sentences max."
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
