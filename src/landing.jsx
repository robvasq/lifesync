import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qrtdvkzaffzhhyebnnof.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFydGR2a3phZmZ6aGh5ZWJubm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTM5OTMsImV4cCI6MjA4ODIyOTk5M30.ex7LNx7Fl8GR8CpAf4vXwUlOLl3qGWxLGkxuE194pkE"
);
// useNavigate available for routing to /app

const PARTICLE_COUNT = 40;

function useCountUp(target, duration = 2000, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      setVal(Math.round(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return val;
}

export default function LifeSyncLanding() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef(null);
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particles = useRef([]);

  const count1 = useCountUp(2847, 2000, statsVisible);
  const count2 = useCountUp(94, 1800, statsVisible);
  const count3 = useCountUp(4, 1500, statsVisible);

  // Mouse parallax
  useEffect(() => {
    const handler = (e) => setMousePos({ x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Intersection observer for stats
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true); }, { threshold: 0.3 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  // Canvas particle system
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    particles.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      a: Math.random() * 0.4 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(74, 222, 128, ${p.a})`;
        ctx.fill();
        // Connect nearby particles
        for (let j = i + 1; j < particles.current.length; j++) {
          const q = particles.current[j];
          const dist = Math.hypot(p.x - q.x, p.y - q.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(74, 222, 128, ${0.05 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(animRef.current); };
  }, []);

  const handleSubmit = async () => {
    if (!email.trim()) { setError("Enter your email to join."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email."); return; }
    setError(""); setLoading(true);
    try {
      const { error: dbError } = await supabase.from("waitlist").insert([{ email: email.trim().toLowerCase() }]);
      if (dbError) {
        if (dbError.code === "23505") { setError("You're already on the list! 🎉"); }
        else { setError("Something went wrong — try again."); }
        setLoading(false); return;
      }
      setSubmitted(true);
    } catch(e) { setError("Connection issue — try again."); }
    setLoading(false);
  };

  const features = [
    { icon: "◈", title: "Life Score", desc: "One number that reflects your real situation — habits, health, finances, and wellbeing all rolled in.", color: "#4ade80" },
    { icon: "🏆", title: "Compete With Friends", desc: "Everyone starts at 50. Who actually has their life together? The leaderboard doesn't lie.", color: "#facc15" },
    { icon: "🔒", title: "Private By Design", desc: "Your income, debt, and health data stays yours. Friends only see your score and streaks.", color: "#60a5fa" },
    { icon: "🔥", title: "Habit Streaks", desc: "Gym, sleep, budget, meditation — build streaks that actually move your score.", color: "#f97316" },
    { icon: "💬", title: "League Chat", desc: "Talk trash. Give props. Your group chat but the receipts are your life choices.", color: "#a78bfa" },
    { icon: "📈", title: "Weekly Progress", desc: "Track your score week by week. See who's climbing and who's slipping.", color: "#22d3ee" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#04090f", color: "#e2e8f0", fontFamily: "'Syne', sans-serif", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #04090f; }
        ::-webkit-scrollbar-thumb { background: #1a3356; border-radius: 2px; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(74,222,128,0.3); } 50% { box-shadow: 0 0 40px rgba(74,222,128,0.6), 0 0 80px rgba(74,222,128,0.2); } }

        .fade-up { animation: fadeUp 0.8s ease forwards; }
        .fade-up-1 { animation: fadeUp 0.8s 0.1s ease both; }
        .fade-up-2 { animation: fadeUp 0.8s 0.25s ease both; }
        .fade-up-3 { animation: fadeUp 0.8s 0.4s ease both; }
        .fade-up-4 { animation: fadeUp 0.8s 0.55s ease both; }
        .fade-up-5 { animation: fadeUp 0.8s 0.7s ease both; }

        .hero-title {
          font-size: clamp(52px, 9vw, 130px);
          font-weight: 800;
          line-height: 0.92;
          letter-spacing: -3px;
        }

        .shimmer-text {
          background: linear-gradient(90deg, #4ade80 0%, #22d3ee 25%, #4ade80 50%, #facc15 75%, #4ade80 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }

        .cta-btn {
          background: linear-gradient(135deg, #4ade80, #22d3ee);
          color: #04090f;
          border: none;
          border-radius: 14px;
          padding: 16px 36px;
          font-size: 15px;
          font-weight: 800;
          font-family: 'Syne', sans-serif;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.5px;
          animation: glow 3s ease-in-out infinite;
          white-space: nowrap;
        }
        .cta-btn:hover { transform: translateY(-2px) scale(1.03); }
        .cta-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .email-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(74,222,128,0.25);
          border-radius: 14px;
          padding: 16px 20px;
          color: #e2e8f0;
          font-size: 15px;
          font-family: 'DM Mono', monospace;
          outline: none;
          width: 100%;
          transition: border-color 0.2s, background 0.2s;
          backdrop-filter: blur(10px);
        }
        .email-input:focus { border-color: rgba(74,222,128,0.6); background: rgba(255,255,255,0.07); }
        .email-input::placeholder { color: #334155; }

        .feature-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 28px;
          transition: all 0.3s;
          backdrop-filter: blur(10px);
          position: relative;
          overflow: hidden;
        }
        .feature-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(74,222,128,0.03), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .feature-card:hover { border-color: rgba(74,222,128,0.2); transform: translateY(-4px); }
        .feature-card:hover::before { opacity: 1; }

        .score-ring { animation: float 4s ease-in-out infinite; }

        .demo-btn {
          background: transparent;
          color: #4ade80;
          border: 1px solid rgba(74,222,128,0.4);
          border-radius: 14px;
          padding: 16px 36px;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Syne', sans-serif;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }
        .demo-btn:hover { background: rgba(74,222,128,0.08); transform: translateY(-2px); border-color: rgba(74,222,128,0.7); }

        .grid-bg {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(74,222,128,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }

        .rank-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(250,204,21,0.1);
          border: 1px solid rgba(250,204,21,0.3);
          border-radius: 99px;
          padding: 6px 16px;
          font-size: 12px;
          font-weight: 700;
          color: #facc15;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        @media (max-width: 768px) {
          .hero-title { letter-spacing: -2px; }
          .hide-mobile { display: none !important; }
        }
      `}</style>

      {/* Canvas particles */}
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />

      {/* Orbs */}
      <div className="orb" style={{ width: 600, height: 600, background: "rgba(74,222,128,0.06)", top: -200, left: -100, zIndex: 0 }} />
      <div className="orb" style={{ width: 400, height: 400, background: "rgba(96,165,250,0.05)", bottom: 200, right: -100, zIndex: 0 }} />

      {/* Grid */}
      <div className="grid-bg" style={{ zIndex: 0 }} />

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(90deg,#4ade80,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>◈ LifeSync</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="demo-btn" style={{ padding: "8px 20px", fontSize: 13 }} onClick={() => navigate("/app")}>
            Try Demo →
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="nav-dot" />
            <span style={{ fontSize: 12, color: "#4ade80", fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>Early Access Open</span>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 24px 80px", textAlign: "center" }}>

        <div className="fade-up-1" style={{ marginBottom: 24 }}>
          <div className="rank-badge">✦ Built for your 20s & 30s</div>
        </div>

        <h1 className="hero-title fade-up-2" style={{ marginBottom: 28, maxWidth: 900 }}>
          Your life has a<br />
          <span className="shimmer-text">score.</span><br />
          Start improving it.
        </h1>

        <p className="fade-up-3" style={{ fontSize: "clamp(16px,2.5vw,22px)", color: "#64748b", maxWidth: 580, lineHeight: 1.7, marginBottom: 48, fontFamily: "'DM Mono', monospace", fontWeight: 400 }}>
          LifeSync turns your habits, finances, and health into one number — then helps you grow it. Track your progress, stay consistent, and challenge the people around you to do the same.
        </p>

        {/* Email capture */}
        <div className="fade-up-4" style={{ width: "100%", maxWidth: 480, marginBottom: 16 }}>
          {!submitted ? (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <input
                  className="email-input"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                />
                <button className="cta-btn" onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <span style={{ display: "inline-block", width: 18, height: 18, border: "2px solid #04090f", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  ) : "Join Waitlist"}
                </button>
              </div>
              {error && <div style={{ fontSize: 13, color: "#f87171", textAlign: "left", paddingLeft: 4 }}>{error}</div>}
              <div style={{ fontSize: 12, color: "#334155", fontFamily: "'DM Mono', monospace" }}>No spam. Just your invite when we launch. 🔒</div>
            </div>
          ) : (
            <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 16, padding: "24px 28px", animation: "fadeUp 0.5s ease" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#4ade80", marginBottom: 6 }}>You're on the list!</div>
              <div style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>We'll send your invite before anyone else. Your growth journey starts soon.</div>
            </div>
          )}
        </div>

        {/* Social proof */}
        <div className="fade-up-5" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex" }}>
              {["#1d4ed8","#7c3aed","#059669","#dc2626"].map((c, i) => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${c},${c}99)`, border: "2px solid #04090f", marginLeft: i > 0 ? -8 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>
                  {["AJ","MK","SR","DW"][i]}
                </div>
              ))}
            </div>
            <span style={{ fontSize: 13, color: "#475569", fontFamily: "'DM Mono', monospace" }}>+2,800 people already waiting</span>
          </div>
          <span style={{ color: "#1e293b" }}>·</span>
          <button className="demo-btn" style={{ padding: "8px 20px", fontSize: 13 }} onClick={() => navigate("/app")}>
            👀 Explore the app
          </button>
        </div>

        {/* Floating score preview */}
        <div className="score-ring hide-mobile" style={{ position: "absolute", right: "8%", top: "50%", transform: "translateY(-50%)", opacity: 0.15 }}>
          <svg width="200" height="200">
            <circle cx="100" cy="100" r="80" fill="none" stroke="#1e293b" strokeWidth="12" />
            <circle cx="100" cy="100" r="80" fill="none" stroke="#4ade80" strokeWidth="12"
              strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 80}`}
              strokeDashoffset={`${2 * Math.PI * 80 * 0.35}`}
              transform="rotate(-90 100 100)" />
            <text x="100" y="95" textAnchor="middle" fill="#4ade80" fontSize="42" fontWeight="800" fontFamily="Syne">65</text>
            <text x="100" y="118" textAnchor="middle" fill="#64748b" fontSize="13" fontFamily="Syne">LIFE SCORE</text>
          </svg>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ position: "relative", zIndex: 1, padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 12, color: "#4ade80", fontFamily: "'DM Mono', monospace", fontWeight: 500, letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>How it works</div>
          <h2 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>Simple to start.<br /><span style={{ color: "#4ade80" }}>Hard to ignore.</span></h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 16 }}>
          {[
            { step: "01", title: "Track what matters", desc: "Log your habits, monitor your finances, and check in on your health. LifeSync builds your Life Score from your real daily actions.", color: "#4ade80" },
            { step: "02", title: "Watch yourself grow", desc: "Your score updates every week. See exactly what's moving it up — and what's holding you back. Personal insights, no judgment.", color: "#facc15" },
            { step: "03", title: "Challenge your circle", desc: "Invite friends to a league. Everyone starts at 50. Scores are public, personal data stays private. Who's really doing the work?", color: "#60a5fa" },
          ].map((s, i) => (
            <div key={i} className="feature-card" style={{ textAlign: "center", padding: "40px 28px" }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: s.color, opacity: 0.2, fontFamily: "'DM Mono', monospace", marginBottom: 16, lineHeight: 1 }}>{s.step}</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{s.title}</div>
              <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, fontFamily: "'DM Mono', monospace" }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES GRID */}
      <section style={{ position: "relative", zIndex: 1, padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 12, color: "#4ade80", fontFamily: "'DM Mono', monospace", fontWeight: 500, letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>Features</div>
          <h2 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>Everything you need<br /><span style={{ color: "#4ade80" }}>to level up.</span></h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
          {[
            { icon: "◈", title: "Life Score", desc: "One number that captures your real progress — habits, finances, health, and wellbeing. Watch it grow week over week.", color: "#4ade80" },
            { icon: "📈", title: "Personal Growth Tracking", desc: "See your trajectory over time. Are you trending up? What changed last week? Your score history tells the real story.", color: "#60a5fa" },
            { icon: "🔥", title: "Habit Streaks", desc: "Gym, sleep, budget, meditation — build streaks that actually move your score. Miss a day, feel it. Stay consistent, own it.", color: "#f97316" },
            { icon: "💰", title: "Financial Health", desc: "Track your budget, debt, credit score, and savings in one place. No more ignoring the numbers — just steady progress.", color: "#facc15" },
            { icon: "🗓️", title: "Scheduling & Reminders", desc: "Never miss a bill, a refill, or a habit. Smart reminders keep your streak alive and your score moving without you having to think about it.", color: "#a78bfa" },
            { icon: "🏆", title: "Friend Leagues", desc: "Challenge your friends to a 4-month season. Everyone starts equal. Your score is public, your personal data never is.", color: "#22d3ee" },
          ].map((f, i) => (
            <div key={i} className="feature-card">
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: f.color }}>{f.title}</div>
              <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, fontFamily: "'DM Mono', monospace" }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section ref={statsRef} style={{ position: "relative", zIndex: 1, padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.12)", borderRadius: 28, padding: "60px 40px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 40, textAlign: "center" }}>
          {[
            { val: count1, suffix: "+", label: "On the waitlist", color: "#4ade80" },
            { val: count2, suffix: "%", label: "Hit their goals weekly", color: "#facc15" },
            { val: count3, suffix: " pillars", label: "Health, Finance, Habits, Wellness", color: "#60a5fa" },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: "clamp(40px,6vw,72px)", fontWeight: 800, color: s.color, letterSpacing: -2, lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>{s.val}{s.suffix}</div>
              <div style={{ fontSize: 14, color: "#64748b", marginTop: 8, fontFamily: "'DM Mono', monospace" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ position: "relative", zIndex: 1, padding: "80px 24px 120px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(36px,6vw,80px)", fontWeight: 800, lineHeight: 1, letterSpacing: -2, marginBottom: 24 }}>
          Ready to see<br />
          <span className="shimmer-text">who you're becoming?</span>
        </h2>
        <p style={{ fontSize: 16, color: "#64748b", marginBottom: 40, fontFamily: "'DM Mono', monospace" }}>
          Join the waitlist. Be the first to track your Life Score.
        </p>
        {!submitted ? (
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", maxWidth: 480, margin: "0 auto" }}>
            <input
              className="email-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              style={{ maxWidth: 280 }}
            />
            <button className="cta-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "..." : "Get Early Access"}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 18, color: "#4ade80", fontWeight: 700 }}>🎉 You're on the list — we'll be in touch!</div>
        )}
      </section>

      {/* FOOTER */}
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.05)", padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, background: "linear-gradient(90deg,#4ade80,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>◈ LifeSync</div>
        <div style={{ fontSize: 12, color: "#334155", fontFamily: "'DM Mono', monospace" }}>© 2026 LifeSync. All rights reserved.</div>
        <div style={{ fontSize: 12, color: "#334155", fontFamily: "'DM Mono', monospace" }}>Built different. 🔥</div>
      </footer>
    </div>
  );
}
