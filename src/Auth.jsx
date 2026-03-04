import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qrtdvkzaffzhhyebnnof.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFydGR2a3phZmZ6aGh5ZWJubm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTM5OTMsImV4cCI6MjA4ODIyOTk5M30.ex7LNx7Fl8GR8CpAf4vXwUlOLl3qGWxLGkxuE194pkE"
);

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
];

// ─── STYLES ──────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes slideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-40px); } }

  .auth-card {
    background: #0e1120;
    border: 1px solid #1e2240;
    border-radius: 24px;
    padding: 48px;
    width: 100%;
    max-width: 460px;
    animation: fadeUp 0.6s ease both;
  }

  .auth-input {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid #1e2240;
    border-radius: 12px;
    padding: 14px 18px;
    color: #f1f5f9;
    font-size: 15px;
    font-family: 'DM Mono', monospace;
    outline: none;
    transition: border-color 0.2s, background 0.2s;
  }
  .auth-input:focus { border-color: #818cf8; background: rgba(129,140,248,0.06); }
  .auth-input::placeholder { color: #334155; }

  .auth-btn {
    width: 100%;
    background: linear-gradient(135deg, #6366f1, #c084fc);
    color: #fff;
    border: none;
    border-radius: 12px;
    padding: 15px;
    font-size: 15px;
    font-weight: 800;
    font-family: 'Syne', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 0.5px;
  }
  .auth-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,0.4); }
  .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  .option-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid #2d3260;
    border-radius: 14px;
    padding: 16px 20px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'Syne', sans-serif;
    font-size: 15px;
    font-weight: 600;
    color: #cbd5e1;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .option-card:hover { border-color: #818cf8; color: #f1f5f9; background: rgba(129,140,248,0.08); }
  .option-card.selected {
    border-color: #818cf8;
    background: rgba(129,140,248,0.15);
    color: #f1f5f9;
    box-shadow: 0 0 0 1px #818cf8;
  }

  .progress-bar {
    height: 3px;
    background: #1e2240;
    border-radius: 99px;
    overflow: hidden;
    margin-bottom: 40px;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #c084fc);
    border-radius: 99px;
    transition: width 0.4s ease;
  }

  .shimmer-text {
    background: linear-gradient(90deg, #818cf8 0%, #c084fc 50%, #fb7185 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 4s linear infinite;
  }

  .step-animate { animation: slideIn 0.4s ease both; }

  .nav-dot { width: 6px; height: 6px; border-radius: 50%; background: #818cf8; animation: pulse 2s ease-in-out infinite; display: inline-block; }

  .link-btn {
    background: none;
    border: none;
    color: #818cf8;
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: 0;
  }
  .link-btn:hover { color: #c084fc; }

  .error-msg {
    background: rgba(251,113,133,0.1);
    border: 1px solid rgba(251,113,133,0.3);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    color: #fb7185;
    font-family: 'DM Mono', monospace;
    animation: fadeIn 0.3s ease;
  }

  .success-msg {
    background: rgba(129,140,248,0.1);
    border: 1px solid rgba(129,140,248,0.3);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    color: #818cf8;
    font-family: 'DM Mono', monospace;
    animation: fadeIn 0.3s ease;
  }
`;

// ─── SIGN UP ─────────────────────────────────────────────────────────────────
function SignUp({ onSwitch, onSuccess }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async () => {
    if (!username.trim()) { setError("Username is required."); return; }
    if (username.length < 3) { setError("Username must be at least 3 characters."); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError("Username can only contain letters, numbers, and underscores."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }

    setError(""); setLoading(true);

    try {
      // Check username availability
      const { data: existing } = await supabase.from("profiles").select("username").eq("username", username.toLowerCase()).single();
      if (existing) { setError("That username is taken. Try another."); setLoading(false); return; }

      // Sign up
      const { data, error: authError } = await supabase.auth.signUp({ 
        email, 
        password, 
        options: { data: { username: username.toLowerCase() } } 
      });
      if (authError) { setError(authError.message); setLoading(false); return; }

      // Trigger handles profile creation automatically
      onSuccess(data.user);
    } catch (e) {
      setError("Something went wrong. Try again.");
    }
    setLoading(false);
  };

  return (
    <div className="auth-card">
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: "#818cf8", fontFamily: "'DM Mono', monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Create account</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>
          Start your<br /><span className="shimmer-text">journey.</span>
        </h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: 1 }}>USERNAME</div>
          <input className="auth-input" placeholder="coolperson123" value={username}
            onChange={e => { setUsername(e.target.value); setError(""); }} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: 1 }}>EMAIL</div>
          <input className="auth-input" type="email" placeholder="you@email.com" value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: 1 }}>PASSWORD</div>
          <input className="auth-input" type="password" placeholder="8+ characters" value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: 1 }}>CONFIRM PASSWORD</div>
          <input className="auth-input" type="password" placeholder="Same as above" value={confirm}
            onChange={e => { setConfirm(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSignUp()} />
        </div>

        {error && <div className="error-msg">{error}</div>}

        <button className="auth-btn" onClick={handleSignUp} disabled={loading} style={{ marginTop: 8 }}>
          {loading ? <span style={{ display: "inline-block", width: 18, height: 18, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : "Create Account →"}
        </button>

        <div style={{ textAlign: "center", fontSize: 14, color: "#475569", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
          Already have an account?{" "}
          <button className="link-btn" onClick={onSwitch}>Sign in</button>
        </div>
      </div>
    </div>
  );
}

// ─── SIGN IN ─────────────────────────────────────────────────────────────────
function SignIn({ onSwitch, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields."); return; }
    setError(""); setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError("Invalid email or password."); setLoading(false); return; }
    onSuccess(data.user);
    setLoading(false);
  };

  return (
    <div className="auth-card">
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: "#818cf8", fontFamily: "'DM Mono', monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Welcome back</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>
          Sign back<br /><span className="shimmer-text">in.</span>
        </h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: 1 }}>EMAIL</div>
          <input className="auth-input" type="email" placeholder="you@email.com" value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: 1 }}>PASSWORD</div>
          <input className="auth-input" type="password" placeholder="Your password" value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSignIn()} />
        </div>

        {error && <div className="error-msg">{error}</div>}

        <button className="auth-btn" onClick={handleSignIn} disabled={loading} style={{ marginTop: 8 }}>
          {loading ? <span style={{ display: "inline-block", width: 18, height: 18, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : "Sign In →"}
        </button>

        <div style={{ textAlign: "center", fontSize: 14, color: "#475569", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
          Don't have an account?{" "}
          <button className="link-btn" onClick={onSwitch}>Sign up</button>
        </div>
      </div>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({ user, onComplete }) {
  const [answers, setAnswers] = useState({});
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState(0);

  // Filter steps based on conditional logic
  const visibleSteps = ONBOARDING_STEPS.filter(s => !s.conditional || s.conditional(answers));
  const step = visibleSteps[stepIndex];
  const progress = ((stepIndex) / visibleSteps.length) * 100;
  const isLast = stepIndex === visibleSteps.length - 1;

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
          await supabase.from("profiles").update({
            ...answers,
            onboarding_complete: true,
          }).eq("id", user.id);
        }
      } catch(e) {
        console.error("Profile save error:", e);
      } finally {
        setSaving(false);
        onComplete();
      }
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

  return (
    <div style={{ width: "100%", maxWidth: 520, animation: "fadeUp 0.6s ease both" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(90deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>◈ LifeSync</div>
        <div style={{ fontSize: 13, color: "#475569", fontFamily: "'DM Mono', monospace" }}>Setting up your profile</div>
      </div>

      {/* Progress */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Step counter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono', monospace" }}>
          {stepIndex + 1} of {visibleSteps.length}
        </div>
        <button onClick={() => { onComplete(); }} style={{ background: "none", border: "none", color: "#334155", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>
          Skip for now →
        </button>
      </div>

      {/* Question card */}
      <div key={key} className="step-animate" style={{ background: "#0e1120", border: "1px solid #1e2240", borderRadius: 24, padding: "40px 36px" }}>
        <div style={{ fontSize: 48, marginBottom: 16, textAlign: "center" }}>{step.emoji}</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 8, textAlign: "center", lineHeight: 1.2 }}>{step.question}</h2>
        <p style={{ fontSize: 14, color: "#64748b", fontFamily: "'DM Mono', monospace", textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>{step.subtitle}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {step.options.map((opt) => (
            <button key={opt} className={`option-card ${displayVal === opt ? "selected" : ""}`}
              onClick={() => select(opt)}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", border: `2px solid ${displayVal === opt ? "#818cf8" : "#1e2240"}`,
                background: displayVal === opt ? "#818cf8" : "transparent",
                flexShrink: 0, transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {displayVal === opt && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
              </div>
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        {stepIndex > 0 && (
          <button onClick={back} style={{
            flex: 1, background: "transparent", border: "1px solid #1e2240", borderRadius: 12,
            padding: 14, color: "#64748b", fontFamily: "'Syne', sans-serif", fontWeight: 700,
            fontSize: 14, cursor: "pointer", transition: "all 0.2s",
          }}>← Back</button>
        )}
        <button className="auth-btn" onClick={next}
          disabled={displayVal === undefined || saving}
          style={{ flex: 2 }}>
          {saving ? (
            <span style={{ display: "inline-block", width: 18, height: 18, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          ) : isLast ? "Finish & See My Score 🎉" : "Next →"}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN AUTH WRAPPER ────────────────────────────────────────────────────────
export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState("signup"); // signup | signin | onboarding
  const [user, setUser] = useState(null);
  const [checkingProfile, setCheckingProfile] = useState(false);

  const handleAuthSuccess = async (authUser) => {
    setUser(authUser);
    setCheckingProfile(true);
    // Check if onboarding is complete
    const { data: profile } = await supabase.from("profiles").select("onboarding_complete").eq("id", authUser.id).single();
    setCheckingProfile(false);
    if (profile?.onboarding_complete) {
      onAuthenticated(authUser);
    } else {
      setMode("onboarding");
    }
  };

  const handleOnboardingComplete = async () => {
    // Re-fetch session to make sure we have a valid user
    const { data: { session } } = await supabase.auth.getSession();
    const authUser = session?.user || user;
    if (authUser) {
      onAuthenticated(authUser);
    } else {
      // Fallback: go back to sign in
      setMode("signin");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#07080f", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "24px",
      fontFamily: "'Syne', sans-serif", position: "relative", overflow: "hidden",
    }}>
      <style>{STYLES}</style>

      {/* Background orbs */}
      <div style={{ position: "fixed", width: 500, height: 500, borderRadius: "50%", background: "rgba(99,102,241,0.06)", filter: "blur(80px)", top: -100, left: -100, pointerEvents: "none" }} />
      <div style={{ position: "fixed", width: 400, height: 400, borderRadius: "50%", background: "rgba(192,132,252,0.05)", filter: "blur(80px)", bottom: -100, right: -100, pointerEvents: "none" }} />

      {/* Grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(129,140,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(129,140,248,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)",
      }} />

      {/* Nav logo */}
      {mode !== "onboarding" && (
        <div style={{ position: "fixed", top: 24, left: 40, fontSize: 20, fontWeight: 800, background: "linear-gradient(90deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          ◈ LifeSync
        </div>
      )}

      {checkingProfile ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <span style={{ display: "inline-block", width: 32, height: 32, border: "3px solid #818cf8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <div style={{ fontSize: 14, color: "#475569", fontFamily: "'DM Mono', monospace" }}>Loading your profile...</div>
        </div>
      ) : mode === "onboarding" ? (
        <Onboarding user={user} onComplete={handleOnboardingComplete} />
      ) : mode === "signup" ? (
        <SignUp onSwitch={() => setMode("signin")} onSuccess={handleAuthSuccess} />
      ) : (
        <SignIn onSwitch={() => setMode("signup")} onSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}
