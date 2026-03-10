import { useState, useEffect } from "react";
import supabase from "./supabase";

// ─── ONBOARDING STEPS ────────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    key: "age_range",
    emoji: "🎂",
    question: "How old are you?",
    subtitle: "Helps us tailor your Life Score benchmarks.",
    type: "single",
    options: ["18–24", "25–29", "30–34", "35–39", "40+"],
  },
  {
    key: "income_range",
    emoji: "💰",
    question: "What's your monthly income range?",
    subtitle: "Ranges only — your exact number stays private.",
    type: "single",
    options: ["Under $2k", "$2k–$4k", "$4k–$7k", "$7k–$10k", "$10k+"],
  },
  {
    key: "has_debt",
    emoji: "💳",
    question: "Do you currently have any debt?",
    subtitle: "Student loans, credit cards, car payments — all counts.",
    type: "bool",
    options: ["Yes", "No"],
  },
  {
    key: "debt_range",
    emoji: "📉",
    question: "Roughly how much debt?",
    subtitle: "No judgment. This helps calculate your financial health score.",
    type: "single",
    options: ["Under $5k", "$5k–$20k", "$20k–$50k", "$50k–$100k", "$100k+"],
    conditional: (answers) => answers.has_debt === true,
  },
  {
    key: "has_savings",
    emoji: "🏦",
    question: "Do you have any savings?",
    subtitle: "Emergency fund, investments, or just a savings account.",
    type: "bool",
    options: ["Yes", "No"],
  },
  {
    key: "savings_range",
    emoji: "📈",
    question: "What's your savings range?",
    subtitle: "Approximate is totally fine.",
    type: "single",
    options: ["Under $1k", "$1k–$5k", "$5k–$20k", "$20k–$50k", "$50k+"],
    conditional: (answers) => answers.has_savings === true,
  },
  {
    key: "credit_range",
    emoji: "⭐",
    question: "What's your credit score range?",
    subtitle: "Not sure? Check Credit Karma — it's free.",
    type: "single",
    options: ["Below 580", "580–669", "670–739", "740–799", "800+", "I don't know"],
  },
  {
    key: "financial_goal",
    emoji: "🎯",
    question: "What's your #1 financial goal right now?",
    subtitle: "We'll weight your score toward what matters most to you.",
    type: "single",
    options: ["Pay off debt", "Build savings", "Start investing", "Stick to a budget", "Improve credit score"],
  },
  {
    key: "body_goal",
    emoji: "💪",
    question: "What's your physical health goal?",
    subtitle: "This unlocks your body stats tracker and calorie targets.",
    type: "single",
    options: ["🔥 Fat Loss", "💪 Muscle Gain", "🏃 General Fitness", "⚖️ Maintenance", "🎯 Custom Goal", "Skip for now"],
  },
  {
    key: "current_weight",
    emoji: "⚖️",
    question: "What's your current weight?",
    subtitle: "In pounds. Only you can see this — ever.",
    type: "number",
    placeholder: "e.g. 185",
    unit: "lbs",
    conditional: (answers) => answers.body_goal && answers.body_goal !== "Skip for now",
  },
  {
    key: "goal_weight",
    emoji: "🎯",
    question: "What's your goal weight?",
    subtitle: "We'll track your progress and show weekly targets.",
    type: "number",
    placeholder: "e.g. 165",
    unit: "lbs",
    conditional: (answers) => answers.body_goal && answers.body_goal !== "Skip for now",
  },
  {
    key: "height",
    emoji: "📏",
    question: "How tall are you?",
    subtitle: "Used to calculate BMI and calorie targets.",
    type: "height",
    conditional: (answers) => answers.body_goal && answers.body_goal !== "Skip for now",
  },
];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,300&family=DM+Serif+Display:ital@0;1&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #f5f4f0; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 2px; }

  @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes slideIn  { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:translateX(0)} }
  @keyframes pop      { 0%{transform:scale(0.9);opacity:0} 70%{transform:scale(1.03)} 100%{transform:scale(1);opacity:1} }

  .auth-fade  { animation: fadeUp 0.45s ease both; }
  .step-slide { animation: slideIn 0.35s ease both; }

  .auth-input {
    width: 100%;
    background: #f5f4f0;
    border: 1px solid rgba(0,0,0,0.1);
    border-radius: 10px;
    padding: 12px 16px;
    color: #111010;
    font-size: 15px;
    font-family: 'DM Sans', sans-serif;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .auth-input:focus {
    border-color: #d4860a;
    box-shadow: 0 0 0 3px rgba(212,134,10,0.12);
  }
  .auth-input::placeholder { color: #b0aca8; }

  .auth-btn {
    width: 100%;
    background: #d4860a;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 13px;
    font-size: 15px;
    font-weight: 700;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    letter-spacing: 0.01em;
    box-shadow: 0 4px 20px rgba(212,134,10,0.3);
    transition: opacity 0.15s;
  }
  .auth-btn:hover   { opacity: 0.88; }
  .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .option-card {
    background: #f5f4f0;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px;
    padding: 14px 18px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: #111010;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .option-card:hover   { border-color: rgba(212,134,10,0.4); background: rgba(212,134,10,0.05); }
  .option-card.selected {
    border-color: #d4860a;
    background: rgba(212,134,10,0.08);
    box-shadow: 0 0 0 1px #d4860a;
  }

  .progress-bar {
    height: 3px;
    background: rgba(0,0,0,0.07);
    border-radius: 99px;
    overflow: hidden;
    margin-bottom: 32px;
  }
  .progress-fill {
    height: 100%;
    background: #d4860a;
    border-radius: 99px;
    transition: width 0.4s ease;
  }

  .error-msg {
    background: rgba(192,57,43,0.08);
    border: 1px solid rgba(192,57,43,0.2);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    color: #c0392b;
    font-weight: 500;
    animation: fadeIn 0.3s ease;
  }

  .link-btn {
    background: none;
    border: none;
    color: #d4860a;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }
  .link-btn:hover { opacity: 0.8; }

  button:disabled { cursor: not-allowed; }
`;

// ─── SHARED HEADER ────────────────────────────────────────────────────────────
function AuthHeader({ onBack, rightLabel, onRight }) {
  return (
    <div style={{
      background: "#f5f4f0", borderBottom: "1px solid rgba(0,0,0,0.07)",
      padding: "0 24px", height: 58,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 50,
    }}>
      <button onClick={onBack} style={{
        background: "transparent", border: "none", cursor: "pointer",
        fontSize: 13, color: "#9a9590", fontWeight: 500,
        display: "flex", alignItems: "center", gap: 5,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </button>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#111010", letterSpacing: "-0.02em", fontFamily: "'DM Sans', sans-serif" }}>LifeSync</div>
      {onRight
        ? <button className="link-btn" onClick={onRight}>{rightLabel}</button>
        : <div style={{ width: 60 }} />
      }
    </div>
  );
}

// ─── FIELD LABEL ─────────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 12, color: "#9a9590", fontWeight: 600, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
    </div>
  );
}

// ─── SIGN UP ─────────────────────────────────────────────────────────────────
function SignUp({ onSwitch, onSuccess, onBack }) {
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const passwordStrength = (p) => {
    if (!p) return null;
    if (p.length < 6)  return { label: "Too short", color: "#c0392b", width: "20%" };
    if (p.length < 8)  return { label: "Weak",      color: "#c0392b", width: "35%" };
    const score = [/[A-Z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
    if (score === 0)   return { label: "Fair",   color: "#d4860a", width: "50%" };
    if (score === 1)   return { label: "Good",   color: "#d4860a", width: "70%" };
    return               { label: "Strong", color: "#3a7d5c", width: "100%" };
  };
  const strength = passwordStrength(password);

  const handleSignUp = async () => {
    if (!username.trim())                        { setError("Username is required."); return; }
    if (username.length < 3)                     { setError("Username must be at least 3 characters."); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username))       { setError("Username can only contain letters, numbers, and underscores."); return; }
    if (!email.trim())                           { setError("Email is required."); return; }
    if (password.length < 8)                     { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)                    { setError("Passwords don't match."); return; }

    setError(""); setLoading(true);
    try {
      const { data: existing } = await supabase.from("profiles").select("username").eq("username", username.toLowerCase()).single();
      if (existing) { setError("That username is taken. Try another."); setLoading(false); return; }

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username.toLowerCase() } },
      });
      if (authError) { setError(authError.message); setLoading(false); return; }
      onSuccess(data.user);
    } catch { setError("Something went wrong. Try again."); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "'DM Sans', sans-serif" }}>
      <AuthHeader onBack={onBack} rightLabel="Sign in" onRight={onSwitch} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 16px 60px", minHeight: "calc(100vh - 58px)" }}>
        <div className="auth-fade" style={{
          background: "#fff", border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 20, padding: "40px 36px",
          width: "100%", maxWidth: 420,
          boxShadow: "0 8px 40px rgba(0,0,0,0.07)",
        }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, fontWeight: 400, letterSpacing: "-0.02em", color: "#111010", marginBottom: 8 }}>
              Create your account
            </h1>
            <p style={{ fontSize: 14, color: "#9a9590", lineHeight: 1.5 }}>Get your Life Score in minutes. Free, forever.</p>
          </div>

          {error && <div className="error-msg" style={{ marginBottom: 20 }}>{error}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <FieldLabel>Username</FieldLabel>
              <input className="auth-input" placeholder="your_handle" value={username}
                onChange={e => { setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "")); setError(""); }} autoFocus />
              <div style={{ fontSize: 11, color: "#9a9590", marginTop: 5 }}>Letters, numbers, and underscores only.</div>
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input className="auth-input" type="email" placeholder="you@example.com" value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }} />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <input className="auth-input" type="password" placeholder="Min. 8 characters" value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }} autoComplete="new-password" />
              {strength && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ background: "rgba(0,0,0,0.07)", borderRadius: 99, height: 4, overflow: "hidden" }}>
                    <div style={{ width: strength.width, background: strength.color, height: "100%", borderRadius: 99, transition: "width 0.3s ease" }} />
                  </div>
                  <div style={{ fontSize: 11, color: strength.color, fontWeight: 600, marginTop: 4 }}>{strength.label}</div>
                </div>
              )}
            </div>
            <div>
              <FieldLabel>Confirm password</FieldLabel>
              <input className="auth-input" type="password" placeholder="••••••••" value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleSignUp()}
                autoComplete="new-password"
                style={{ borderColor: confirm && confirm !== password ? "rgba(192,57,43,0.4)" : undefined }} />
              {confirm && confirm !== password && (
                <div style={{ fontSize: 11, color: "#c0392b", marginTop: 5, fontWeight: 500 }}>Passwords don't match</div>
              )}
            </div>

            <button className="auth-btn" onClick={handleSignUp} disabled={loading} style={{ marginTop: 6 }}>
              {loading
                ? <span style={{ display: "inline-block", width: 18, height: 18, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                : "Create account →"}
            </button>
          </div>

          {/* What you get */}
          <div style={{ marginTop: 24, padding: "14px 16px", background: "#f5f4f0", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9a9590", marginBottom: 10 }}>What you get</div>
            {["Life Score across 4 pillars", "Habit streaks + templates", "Finance & credit dashboard", "Mood tracking + AI coach"].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < 3 ? 7 : 0 }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#3a7d5c" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                <span style={{ fontSize: 13, color: "#111010", fontWeight: 500 }}>{item}</span>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <span style={{ fontSize: 13, color: "#9a9590" }}>Already have an account? </span>
            <button className="link-btn" onClick={onSwitch}>Sign in →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SIGN IN ─────────────────────────────────────────────────────────────────
function SignIn({ onSwitch, onSuccess, onBack, onDemo }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields."); return; }
    setError(""); setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError("Invalid email or password."); setLoading(false); return; }
    onSuccess(data.user);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "'DM Sans', sans-serif" }}>
      <AuthHeader onBack={onBack} rightLabel="Create account" onRight={onSwitch} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 16px 60px", minHeight: "calc(100vh - 58px)" }}>
        <div className="auth-fade" style={{
          background: "#fff", border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 20, padding: "40px 36px",
          width: "100%", maxWidth: 420,
          boxShadow: "0 8px 40px rgba(0,0,0,0.07)",
        }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, fontWeight: 400, letterSpacing: "-0.02em", color: "#111010", marginBottom: 8 }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: "#9a9590", lineHeight: 1.5 }}>Sign in to continue tracking your Life Score.</p>
          </div>

          {error && <div className="error-msg" style={{ marginBottom: 20 }}>{error}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input className="auth-input" type="email" placeholder="you@example.com" value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }} autoFocus />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <input className="auth-input" type="password" placeholder="••••••••" value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleSignIn()} />
            </div>

            <button className="auth-btn" onClick={handleSignIn} disabled={loading} style={{ marginTop: 6 }}>
              {loading
                ? <span style={{ display: "inline-block", width: 18, height: 18, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                : "Sign in →"}
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0 18px" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
            <span style={{ fontSize: 12, color: "#9a9590" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
          </div>

          <button onClick={onDemo} style={{
            width: "100%", background: "#f5f4f0",
            border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10,
            padding: "12px 20px", cursor: "pointer",
            fontWeight: 600, fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: "#111010",
          }}>Try the demo</button>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <span style={{ fontSize: 13, color: "#9a9590" }}>Don't have an account? </span>
            <button className="link-btn" onClick={onSwitch}>Create one →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({ user, onComplete }) {
  const [answers, setAnswers]   = useState({});
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving]     = useState(false);
  const [key, setKey]           = useState(0);

  const visibleSteps = ONBOARDING_STEPS.filter(s => !s.conditional || s.conditional(answers));
  const step     = visibleSteps[stepIndex];
  const progress = (stepIndex / visibleSteps.length) * 100;
  const isLast   = stepIndex === visibleSteps.length - 1;

  const select = (value) => {
    const parsed = step.type === "bool" ? value === "Yes" : value;
    setAnswers(prev => ({ ...prev, [step.key]: parsed }));
  };

  const next = async () => {
    if (answers[step.key] === undefined) return;
    if (isLast) {
      setSaving(true);
      try {
        if (user?.id) {
          await supabase.from("profiles").update({ ...answers, onboarding_complete: true }).eq("id", user.id);
          if (answers.body_goal && answers.body_goal !== "Skip for now") {
            const goalTypeMap = { "🔥 Fat Loss":"fat_loss","💪 Muscle Gain":"muscle_gain","🏃 General Fitness":"general_fitness","⚖️ Maintenance":"maintenance","🎯 Custom Goal":"custom" };
            const heightInches = answers.height_ft && answers.height_in
              ? parseInt(answers.height_ft) * 12 + parseInt(answers.height_in)
              : answers.height_ft ? parseInt(answers.height_ft) * 12 : null;
            await supabase.from("body_stats").upsert({
              user_id: user.id,
              goal_type: goalTypeMap[answers.body_goal] || "general_fitness",
              current_weight: parseFloat(answers.current_weight) || null,
              goal_weight: parseFloat(answers.goal_weight) || null,
              height_in: heightInches,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });
            if (answers.current_weight) {
              await supabase.from("weight_log").insert([{ user_id: user.id, weight: parseFloat(answers.current_weight) }]);
            }
          }
        }
      } catch(e) { console.error("Profile save error:", e); }
      setSaving(false);
      onComplete();
    } else {
      setKey(k => k + 1);
      setStepIndex(i => i + 1);
    }
  };

  const back = () => {
    if (stepIndex > 0) { setKey(k => k + 1); setStepIndex(i => i - 1); }
  };

  const currentVal = answers[step.key];
  const displayVal = step.type === "bool"
    ? (currentVal === true ? "Yes" : currentVal === false ? "No" : undefined)
    : currentVal;

  const canAdvance = step.type === "number" ? !!answers[step.key]
    : step.type === "height" ? !!answers.height_ft
    : displayVal !== undefined;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{STYLES}</style>
      {/* Header */}
      <div style={{
        background: "#f5f4f0", borderBottom: "1px solid rgba(0,0,0,0.07)",
        padding: "0 24px", height: 58,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#111010", letterSpacing: "-0.02em" }}>LifeSync</div>
        <button onClick={onComplete} style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 13, color: "#9a9590", fontFamily: "'DM Sans', sans-serif",
        }}>Skip for now →</button>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px 60px" }}>
        {/* Progress */}
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>

        {/* Counter */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, fontSize: 12, color: "#9a9590", fontWeight: 500 }}>
          <span>Step {stepIndex + 1} of {visibleSteps.length}</span>
          <span style={{ color: "#d4860a", fontWeight: 600 }}>{Math.round(progress)}% complete</span>
        </div>

        {/* Card */}
        <div key={key} className="step-slide" style={{
          background: "#fff", border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 20, padding: "36px 28px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)", marginBottom: 16,
        }}>
          <div style={{ fontSize: 44, marginBottom: 16, textAlign: "center" }}>{step.emoji}</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8, textAlign: "center", lineHeight: 1.25, color: "#111010" }}>{step.question}</h2>
          <p style={{ fontSize: 13, color: "#9a9590", textAlign: "center", marginBottom: 24, lineHeight: 1.6 }}>{step.subtitle}</p>

          {/* Number input */}
          {step.type === "number" && (
            <div>
              <input type="number" value={answers[step.key] || ""} onChange={e => setAnswers(prev => ({ ...prev, [step.key]: e.target.value }))}
                placeholder={step.placeholder} className="auth-input"
                style={{ fontSize: 28, fontWeight: 700, textAlign: "center", padding: "18px" }} autoFocus />
              <div style={{ textAlign: "center", marginTop: 8, fontSize: 13, color: "#9a9590" }}>{step.unit}</div>
            </div>
          )}

          {/* Height input */}
          {step.type === "height" && (
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <input type="number" value={answers.height_ft || ""} onChange={e => setAnswers(prev => ({ ...prev, height_ft: e.target.value }))}
                  placeholder="5" className="auth-input" style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }} autoFocus />
                <div style={{ textAlign: "center", marginTop: 6, fontSize: 12, color: "#9a9590" }}>feet</div>
              </div>
              <div style={{ flex: 1 }}>
                <input type="number" value={answers.height_in || ""} onChange={e => setAnswers(prev => ({ ...prev, height_in: e.target.value }))}
                  placeholder="10" className="auth-input" style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }} />
                <div style={{ textAlign: "center", marginTop: 6, fontSize: 12, color: "#9a9590" }}>inches</div>
              </div>
            </div>
          )}

          {/* Single / bool */}
          {(step.type === "single" || step.type === "bool") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {step.options.map(opt => (
                <button key={opt} className={`option-card ${displayVal === opt ? "selected" : ""}`} onClick={() => select(opt)}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${displayVal === opt ? "#d4860a" : "rgba(0,0,0,0.15)"}`,
                    background: displayVal === opt ? "#d4860a" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {displayVal === opt && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          {stepIndex > 0 && (
            <button onClick={back} style={{
              flex: 1, background: "#fff", border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 10, padding: "13px", color: "#9a9590",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
              fontSize: 14, cursor: "pointer",
            }}>← Back</button>
          )}
          <button className="auth-btn" onClick={next} disabled={saving || !canAdvance} style={{ flex: 2 }}>
            {saving
              ? <span style={{ display: "inline-block", width: 18, height: 18, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              : isLast ? "Finish & See My Score 🎉" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN AUTH WRAPPER ────────────────────────────────────────────────────────
export default function Auth({ onAuthenticated, onBack, onDemo }) {
  const [mode, setMode]                   = useState("signup");
  const [user, setUser]                   = useState(null);
  const [checkingProfile, setCheckingProfile] = useState(false);

  const handleAuthSuccess = async (authUser) => {
    setUser(authUser);
    setCheckingProfile(true);
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("onboarding_complete").eq("id", authUser.id).maybeSingle();
    setCheckingProfile(false);
    if (profileError || !profile || profile?.onboarding_complete) {
      onAuthenticated(authUser);
    } else {
      setMode("onboarding");
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user ?? user;
      if (authUser) onAuthenticated(authUser);
      else setMode("signin");
    } catch { setMode("signin"); }
  };

  if (checkingProfile) {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f4f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <style>{STYLES}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <span style={{ display: "inline-block", width: 32, height: 32, border: "3px solid #d4860a", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <div style={{ fontSize: 14, color: "#9a9590" }}>Loading your profile…</div>
        </div>
      </div>
    );
  }

  if (mode === "onboarding") {
    return (
      <>
        <style>{STYLES}</style>
        <Onboarding user={user} onComplete={handleOnboardingComplete} />
      </>
    );
  }

  return (
    <>
      <style>{STYLES}</style>
      {mode === "signup"
        ? <SignUp onSwitch={() => setMode("signin")} onSuccess={handleAuthSuccess} onBack={onBack} />
        : <SignIn onSwitch={() => setMode("signup")} onSuccess={handleAuthSuccess} onBack={onBack} onDemo={onDemo} />
      }
    </>
  );
}
