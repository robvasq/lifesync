import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "./supabase";

export default function CreateAccount() {
  const navigate = useNavigate();
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [username, setUsername]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);
  const [isMobile, setIsMobile]   = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim())            { setError("Email is required."); return; }
    if (!username.trim())         { setError("Username is required."); return; }
    if (username.length < 3)      { setError("Username must be at least 3 characters."); return; }
    if (password.length < 8)      { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)     { setError("Passwords don't match."); return; }

    setLoading(true);

    // Sign up with Supabase
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() } },
    });

    if (signUpErr) { setError(signUpErr.message); setLoading(false); return; }

    // Save username to profiles table
    if (data?.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        username: username.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    }

    setLoading(false);
    setSuccess(true);
  };

  const inp = {
    background: "#f5f4f0",
    border: "1px solid rgba(0,0,0,0.1)",
    borderRadius: 10,
    padding: "12px 16px",
    color: "#111010",
    fontSize: 15,
    width: "100%",
    fontFamily: "inherit",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const passwordStrength = (p) => {
    if (!p) return null;
    if (p.length < 6) return { label: "Too short", color: "#c0392b", width: "20%" };
    if (p.length < 8) return { label: "Weak",      color: "#c0392b", width: "35%" };
    const hasUpper  = /[A-Z]/.test(p);
    const hasNumber = /[0-9]/.test(p);
    const hasSymbol = /[^A-Za-z0-9]/.test(p);
    const score = [hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
    if (score === 0) return { label: "Fair",   color: "#d4860a", width: "50%" };
    if (score === 1) return { label: "Good",   color: "#d4860a", width: "70%" };
    return              { label: "Strong", color: "#3a7d5c", width: "100%" };
  };
  const strength = passwordStrength(password);

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", color: "#111010", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,300&family=DM+Serif+Display:ital@0;1&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes pop    { 0%{transform:scale(0.85);opacity:0} 70%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
        .auth-card  { animation: fadeUp 0.4s ease both; }
        .success-pop { animation: pop 0.4s ease both; }
        input:focus { outline: none; border-color: #d4860a !important; box-shadow: 0 0 0 3px rgba(212,134,10,0.12) !important; }
        input::placeholder { color: #b0aca8; }
        button:hover    { opacity: 0.86; }
        button:disabled { opacity: 0.5; cursor: not-allowed !important; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{
        background: "#f5f4f0", borderBottom: "1px solid rgba(0,0,0,0.07)",
        padding: isMobile ? "0 16px" : "0 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 58, position: "sticky", top: 0, zIndex: 50,
      }}>
        <button onClick={() => navigate("/")} style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 13, color: "#9a9590", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit",
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#111010", letterSpacing: "-0.02em" }}>LifeSync</div>
        <button onClick={() => navigate("/login")} style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 13, color: "#9a9590", fontWeight: 500, fontFamily: "inherit",
        }}>Sign in</button>
      </header>

      {/* ── CARD ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: isMobile ? "36px 16px 60px" : "60px 24px",
        minHeight: "calc(100vh - 58px)",
      }}>
        {success ? (
          /* ── SUCCESS STATE ── */
          <div className="success-pop" style={{
            background: "#fff", border: "1px solid rgba(0,0,0,0.07)",
            borderRadius: 20, padding: isMobile ? "36px 24px" : "48px 48px",
            width: "100%", maxWidth: 420, textAlign: "center",
            boxShadow: "0 8px 40px rgba(0,0,0,0.07)",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(58,125,92,0.1)", border: "2px solid rgba(58,125,92,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#3a7d5c" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", marginBottom: 10 }}>
              You're in, {username}!
            </h2>
            <p style={{ fontSize: 14, color: "#9a9590", lineHeight: 1.6, marginBottom: 28 }}>
              Check your email to confirm your account, then sign in to start building your Life Score.
            </p>
            <button onClick={() => navigate("/login")} style={{
              background: "#d4860a", color: "#fff", border: "none",
              borderRadius: 10, padding: "13px 28px", cursor: "pointer",
              fontWeight: 700, fontSize: 15, fontFamily: "inherit",
              boxShadow: "0 4px 20px rgba(212,134,10,0.3)",
              letterSpacing: "0.01em",
            }}>Sign in →</button>
          </div>
        ) : (
          /* ── CREATE FORM ── */
          <div className="auth-card" style={{
            background: "#fff", border: "1px solid rgba(0,0,0,0.07)",
            borderRadius: 20, padding: isMobile ? "28px 22px" : "40px 40px",
            width: "100%", maxWidth: 420,
            boxShadow: "0 8px 40px rgba(0,0,0,0.07)",
          }}>
            {/* Title */}
            <div style={{ marginBottom: 32 }}>
              <h1 style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 30, fontWeight: 400, letterSpacing: "-0.02em",
                color: "#111010", marginBottom: 8,
              }}>Create your account</h1>
              <p style={{ fontSize: 14, color: "#9a9590", lineHeight: 1.5 }}>
                Get your Life Score in minutes. Free, forever.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.2)",
                borderRadius: 10, padding: "10px 14px", marginBottom: 20,
                fontSize: 13, color: "#c0392b", fontWeight: 500,
              }}>{error}</div>
            )}

            {/* Form */}
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              <div>
                <div style={{ fontSize: 12, color: "#9a9590", fontWeight: 600, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</div>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inp} autoComplete="email" autoFocus
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#9a9590", fontWeight: 600, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>Username</div>
                <input
                  type="text" value={username} onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  placeholder="your_handle"
                  style={inp} autoComplete="username"
                />
                <div style={{ fontSize: 11, color: "#9a9590", marginTop: 5 }}>Letters, numbers, and underscores only.</div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#9a9590", fontWeight: 600, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</div>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={inp} autoComplete="new-password"
                />
                {/* Strength bar */}
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
                <div style={{ fontSize: 12, color: "#9a9590", fontWeight: 600, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>Confirm password</div>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    ...inp,
                    borderColor: confirm && confirm !== password ? "rgba(192,57,43,0.4)" : undefined,
                  }}
                  autoComplete="new-password"
                />
                {confirm && confirm !== password && (
                  <div style={{ fontSize: 11, color: "#c0392b", marginTop: 5, fontWeight: 500 }}>Passwords don't match</div>
                )}
              </div>

              <button type="submit" disabled={loading} style={{
                background: "#d4860a", color: "#fff", border: "none",
                borderRadius: 10, padding: "13px 20px", marginTop: 6,
                cursor: "pointer", fontWeight: 700, fontSize: 15,
                fontFamily: "inherit", letterSpacing: "0.01em",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 20px rgba(212,134,10,0.3)",
              }}>
                {loading ? (
                  <>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 0.8s linear infinite" }}>
                      <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
                    </svg>
                    Creating account…
                  </>
                ) : "Create account →"}
              </button>
            </form>

            {/* What you get */}
            <div style={{
              marginTop: 28, padding: "16px 18px",
              background: "#f5f4f0", borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.06)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9a9590", marginBottom: 10 }}>What you get</div>
              {[
                "Life Score across 4 pillars",
                "Habit streaks + templates",
                "Finance & credit dashboard",
                "Mood tracking + AI coach",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < 3 ? 7 : 0 }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#3a7d5c" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span style={{ fontSize: 13, color: "#111010", fontWeight: 500 }}>{item}</span>
                </div>
              ))}
            </div>

            {/* Sign in link */}
            <div style={{ textAlign: "center", marginTop: 22 }}>
              <span style={{ fontSize: 13, color: "#9a9590" }}>Already have an account? </span>
              <button onClick={() => navigate("/login")} style={{
                background: "transparent", border: "none", cursor: "pointer",
                fontSize: 13, color: "#d4860a", fontWeight: 600, fontFamily: "inherit",
              }}>Sign in →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
