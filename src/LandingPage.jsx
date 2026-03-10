import { useState, useEffect } from "react";

export default function LandingPage({ onGetStarted, onDemo }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const pillars = [
    { label: "Habits & Discipline", icon: "·", desc: "Build streaks that stick. Track daily habits, log progress, and watch consistency compound over time." },
    { label: "Financial Health",    icon: "◎", desc: "Monitor income, expenses, debts, and credit score in one place. See your financial picture clearly." },
    { label: "Physical Health",     icon: "◉", desc: "Log weight, track medications and supplements, manage checkups, and follow recovery programs." },
    { label: "Mental Wellbeing",    icon: "◯", desc: "Daily mood check-ins, PHQ-2 and GAD-2 screenings, and AI-generated wellness insights." },
  ];

  const features = [
    { label: "Life Score",    desc: "A single 0–100 score across finances, health, habits, and wellbeing. Your real-time benchmark." },
    { label: "AI Coach",      desc: "Ask anything. Get personalized advice based on your actual data, not generic tips." },
    { label: "League",        desc: "Compete with friends. Trash talk included." },
    { label: "Daily Briefing",desc: "Start every morning with an AI-generated summary of what matters most today." },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f5f4f0",
      color: "#111010",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Serif+Display:ital@0;1&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button:hover{opacity:0.88}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp 0.5s ease forwards}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        background: "#f5f4f0",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        padding: isMobile ? "0 20px" : "0 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        minHeight: 58, position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>LifeSync</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {!isMobile && (
            <button onClick={onGetStarted} style={{
              background: "transparent", border: "1px solid rgba(0,0,0,0.12)",
              color: "#9a9590", borderRadius: 8, padding: "7px 16px",
              cursor: "pointer", fontSize: 13, fontWeight: 500,
            }}>Sign in</button>
          )}
          <button onClick={onGetStarted} style={{
            background: "#d4860a", color: "#fff", border: "none",
            borderRadius: 10, padding: "8px 18px",
            cursor: "pointer", fontWeight: 600, fontSize: 13,
          }}>Get started</button>
        </div>
      </div>

      {/* ── HERO ── */}
      <div style={{
        padding: isMobile ? "64px 24px 56px" : "96px 40px 80px",
        maxWidth: 760, margin: "0 auto", textAlign: "center",
        animation: "fadeUp 0.6s ease forwards",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(212,134,10,0.1)", border: "1px solid rgba(212,134,10,0.25)",
          borderRadius: 99, padding: "5px 14px", marginBottom: 28,
          fontSize: 11, fontWeight: 700, color: "#d4860a",
          letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          Your life, tracked
        </div>

        <h1 style={{
          fontSize: isMobile ? 38 : 56,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          marginBottom: 22,
          fontFamily: "'DM Serif Display', serif",
        }}>
          One score.<br />
          <span style={{ color: "#d4860a" }}>Every part of your life.</span>
        </h1>

        <p style={{
          fontSize: isMobile ? 16 : 18,
          color: "#6b6660",
          lineHeight: 1.65,
          maxWidth: 520,
          margin: "0 auto 40px",
          fontWeight: 400,
        }}>
          LifeSync tracks your habits, finances, health, and mental wellbeing — then turns it all into a single Life Score that moves when you do.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onGetStarted} style={{
            background: "#d4860a", color: "#fff", border: "none",
            borderRadius: 12, padding: isMobile ? "14px 28px" : "13px 28px",
            cursor: "pointer", fontWeight: 600, fontSize: 15,
            minWidth: 180, letterSpacing: "0.01em",
          }}>
            Create free account
          </button>
          <button onClick={onDemo} style={{
            background: "#ffffff", color: "#111010",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 12, padding: isMobile ? "14px 28px" : "13px 28px",
            cursor: "pointer", fontWeight: 500, fontSize: 15,
            minWidth: 140,
          }}>
            Try the demo
          </button>
        </div>
      </div>

      {/* ── SCORE VISUAL ── */}
      <div style={{
        margin: "0 auto 72px",
        maxWidth: isMobile ? "92vw" : 560,
        background: "#ffffff",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 20,
        padding: isMobile ? "24px 20px" : "32px 36px",
        boxShadow: "0 4px 32px rgba(0,0,0,0.07)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9a9590", marginBottom: 20 }}>
          Life Score breakdown
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 16 : 28, marginBottom: 24 }}>
          <ScoreRingStatic score={74} size={isMobile ? 90 : 110} />
          <div>
            <div style={{ fontSize: 13, color: "#6b6660", marginBottom: 4 }}>Your current score</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Building momentum</div>
            <div style={{ fontSize: 12, color: "#9a9590", marginTop: 4 }}>3 habits on track · 2 finance alerts</div>
          </div>
        </div>
        {[
          { label: "Financial Health", score: 18, max: 25, color: "#d4860a" },
          { label: "Physical Health",  score: 20, max: 25, color: "#c0392b" },
          { label: "Habits",           score: 19, max: 25, color: "#d4860a" },
          { label: "Wellbeing",        score: 17, max: 25, color: "#9a9590" },
        ].map(p => (
          <div key={p.label} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{p.label}</span>
              <span style={{ fontSize: 12, color: "#9a9590" }}>{p.score} / {p.max}</span>
            </div>
            <div style={{ background: "rgba(0,0,0,0.07)", borderRadius: 99, height: 6, overflow: "hidden" }}>
              <div style={{ width: `${(p.score / p.max) * 100}%`, background: p.color, height: "100%", borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── PILLARS ── */}
      <div style={{ padding: isMobile ? "0 20px 72px" : "0 40px 80px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9a9590", marginBottom: 12 }}>
            Four pillars
          </div>
          <h2 style={{ fontSize: isMobile ? 26 : 34, fontWeight: 700, letterSpacing: "-0.02em", fontFamily: "'DM Serif Display', serif" }}>
            Everything that makes up a life
          </h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap: isMobile ? 12 : 16,
        }}>
          {pillars.map(p => (
            <div key={p.label} style={{
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.07)",
              borderRadius: 16,
              padding: isMobile ? 20 : 26,
              boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: "rgba(212,134,10,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: "#d4860a", fontWeight: 700,
                }}>{p.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{p.label}</div>
              </div>
              <div style={{ fontSize: 13, color: "#6b6660", lineHeight: 1.6 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div style={{
        background: "#111010",
        padding: isMobile ? "56px 20px" : "72px 40px",
        margin: "0 0 0 0",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#d4860a", marginBottom: 12 }}>
              What's included
            </div>
            <h2 style={{ fontSize: isMobile ? 26 : 34, fontWeight: 700, letterSpacing: "-0.02em", color: "#f5f0e8", fontFamily: "'DM Serif Display', serif" }}>
              Built for people who take their life seriously
            </h2>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: isMobile ? 12 : 16,
          }}>
            {features.map(f => (
              <div key={f.label} style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14, padding: isMobile ? 16 : 22,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f0e8", marginBottom: 8 }}>{f.label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{
        padding: isMobile ? "64px 24px" : "88px 40px",
        textAlign: "center",
      }}>
        <h2 style={{
          fontSize: isMobile ? 28 : 40, fontWeight: 700,
          letterSpacing: "-0.025em", marginBottom: 16,
          fontFamily: "'DM Serif Display', serif",
        }}>
          Ready to see your Life Score?
        </h2>
        <p style={{ fontSize: 15, color: "#6b6660", marginBottom: 36 }}>
          Free to start. No credit card required.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onGetStarted} style={{
            background: "#d4860a", color: "#fff", border: "none",
            borderRadius: 12, padding: "14px 32px",
            cursor: "pointer", fontWeight: 600, fontSize: 15,
          }}>
            Get started free
          </button>
          <button onClick={onDemo} style={{
            background: "transparent", color: "#111010",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 12, padding: "14px 28px",
            cursor: "pointer", fontWeight: 500, fontSize: 15,
          }}>
            View demo
          </button>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        padding: isMobile ? "20px 24px" : "24px 40px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>LifeSync</div>
        <div style={{ fontSize: 12, color: "#9a9590" }}>Your life, in one place.</div>
      </div>
    </div>
  );
}

// Static score ring for landing (no animation dep on LifeSync)
function ScoreRingStatic({ score, size = 110 }) {
  const r = size / 2 - 12;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? "#3a7d5c" : score >= 60 ? "#d4860a" : "#c0392b";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="10" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px`, fill: color, fontSize: size * 0.21, fontWeight: 700, fontFamily: "inherit" }}>
        {score}
      </text>
    </svg>
  );
}
