import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "./supabase";

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError(err.message);
    // On success, auth state change in App will redirect automatically
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

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", color: "#111010", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,300&family=DM+Serif+Display:ital@0;1&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .auth-card { animation: fadeUp 0.4s ease both; }
        input:focus { outline: none; border-color: #d4860a !important; box-shadow: 0 0 0 3px rgba(212,134,10,0.12) !important; }
        input::placeholder { color: #b0aca8; }
        button:hover { opacity: 0.86; }
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
        <button onClick={() => navigate("/signup")} style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 13, color: "#d4860a", fontWeight: 600, fontFamily: "inherit",
        }}>Create account</button>
      </header>

      {/* ── CARD ── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: isMobile ? "40px 16px" : "60px 24px",
        minHeight: "calc(100vh - 58px)",
      }}>
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
            }}>Welcome back</h1>
            <p style={{ fontSize: 14, color: "#9a9590", lineHeight: 1.5 }}>
              Sign in to continue tracking your Life Score.
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
          <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: "#9a9590", fontWeight: 600, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</div>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inp} autoComplete="email" autoFocus
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#9a9590", fontWeight: 600, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</div>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inp} autoComplete="current-password"
              />
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
                  Signing in…
                </>
              ) : "Sign in →"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "24px 0 20px" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
            <span style={{ fontSize: 12, color: "#9a9590" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
          </div>

          {/* Demo */}
          <button onClick={() => navigate("/demo")} style={{
            width: "100%", background: "#f5f4f0",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 10, padding: "12px 20px",
            cursor: "pointer", fontWeight: 600, fontSize: 14,
            fontFamily: "inherit", color: "#111010",
          }}>Try the demo</button>

          {/* Create account */}
          <div style={{ textAlign: "center", marginTop: 22 }}>
            <span style={{ fontSize: 13, color: "#9a9590" }}>Don't have an account? </span>
            <button onClick={() => navigate("/signup")} style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 13, color: "#d4860a", fontWeight: 600, fontFamily: "inherit",
            }}>Create one →</button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
