import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qrtdvkzaffzhhyebnnof.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFydGR2a3phZmZ6aGh5ZWJubm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTM5OTMsImV4cCI6MjA4ODIyOTk5M30.ex7LNx7Fl8GR8CpAf4vXwUlOLl3qGWxLGkxuE194pkE"
);

const HABIT_TEMPLATES = [
  { id:"gym",      label:"Gym / Workout",      icon:"🏋️", category:"health",  target:5, unit:"times/week",  scorePerStreak:3 },
  { id:"water",    label:"Drink 8 Glasses",     icon:"💧", category:"health",  target:7, unit:"days/week",   scorePerStreak:2 },
  { id:"sleep",    label:"8 Hours Sleep",       icon:"😴", category:"health",  target:7, unit:"days/week",   scorePerStreak:2 },
  { id:"doctor",   label:"Doctor Checkup",      icon:"🩺", category:"health",  target:1, unit:"per quarter", scorePerStreak:5 },
  { id:"cardpay",  label:"Credit Card Payment", icon:"💳", category:"finance", target:1, unit:"per month",   scorePerStreak:4 },
  { id:"budget",   label:"Review Budget",       icon:"📊", category:"finance", target:4, unit:"times/month", scorePerStreak:3 },
  { id:"savings",  label:"Add to Savings",      icon:"🏦", category:"finance", target:4, unit:"times/month", scorePerStreak:3 },
  { id:"meditate", label:"Meditate / Mindful",  icon:"🧘", category:"wellness",target:5, unit:"times/week",  scorePerStreak:2 },
  { id:"veggies",  label:"Eat Vegetables",      icon:"🥦", category:"wellness",target:7, unit:"days/week",   scorePerStreak:2 },
  { id:"nosmoke",  label:"Smoke-Free Day",      icon:"🚭", category:"wellness",target:7, unit:"days/week",   scorePerStreak:4 },
];

const SUPP_ICONS = ["🌿","💊","🍋","🧠","🌸","⚡","🫚","🍄","🌱","💛","🔵","🟣"];

const INITIAL_SUPPLEMENTS = [];

const CREDIT_HISTORY = [];

const SCORE_FACTORS = [
  { label:"Payment History",    weight:35, value:88, desc:"14-month on-time streak",         color:"#4ade80" },
  { label:"Credit Utilization", weight:30, value:48, desc:"$2,400 / $5,000 limit (48%)",     color:"#f87171" },
  { label:"Credit Age",         weight:15, value:72, desc:"Avg account age: 4.2 years",       color:"#facc15" },
  { label:"Credit Mix",         weight:10, value:80, desc:"Card + auto + student loan",        color:"#60a5fa" },
  { label:"New Credit",         weight:10, value:90, desc:"No hard inquiries in 12 months",   color:"#a78bfa" },
];

const PHQ2 = [
  "Over the past 2 weeks, how often have you felt little interest or pleasure in doing things?",
  "Over the past 2 weeks, how often have you felt down, depressed, or hopeless?",
];
const GAD2 = [
  "Over the past 2 weeks, how often have you felt nervous, anxious, or on edge?",
  "Over the past 2 weeks, how often have you been unable to stop or control worrying?",
];
const PHQ_OPTS = ["Not at all","Several days","More than half the days","Nearly every day"];

const INITIAL_MOOD_HISTORY = [
  {day:"Mon",score:6},{day:"Tue",score:7},{day:"Wed",score:5},{day:"Thu",score:6},
  {day:"Fri",score:8},{day:"Sat",score:7},{day:"Sun",score:6},
  {day:"Mon",score:5},{day:"Tue",score:4},{day:"Wed",score:6},{day:"Thu",score:7},
  {day:"Fri",score:8},{day:"Sat",score:9},{day:"Sun",score:7},
  {day:"Mon",score:6},{day:"Tue",score:6},{day:"Wed",score:7},{day:"Thu",score:5},
  {day:"Fri",score:7},{day:"Sat",score:8},{day:"Sun",score:7},
  {day:"Mon",score:5},{day:"Tue",score:6},{day:"Wed",score:6},{day:"Thu",score:7},
  {day:"Fri",score:8},{day:"Sat",score:7},{day:"Sun",score:null},
];

const INITIAL_HABITS = [];

// ─── LIFE SCORE BREAKDOWN ─────────────────────────────────────────────────────
// Returns { total, pillars } where pillars shows per-category detail
function calcLifeScoreBreakdown(habits) {
  // ── FINANCIAL HEALTH (max 25 pts) ──
  // Debt-to-income: $29,100 total debt on $4,200/mo income = 6.9x annual — heavy penalty
  const totalDebt = 29100;
  const monthlyIncome = 4200;
  const dtiRatio = totalDebt / (monthlyIncome * 12); // ~0.58
  const debtPenalty = dtiRatio > 0.5 ? -12 : dtiRatio > 0.3 ? -6 : 0;
  // CC utilization 48% — high
  const utilPenalty = -6;
  // On-time payment streak = positive
  const paymentBonus = 8;
  // Savings progress ($2,340 / $5,000 = 47%)
  const savingsBonus = 4;
  const financeScore = Math.max(0, Math.min(25, 18 + debtPenalty + utilPenalty + paymentBonus + savingsBonus));

  // ── HEALTH (max 25 pts) ──
  // Overdue annual physical → big penalty
  const physicalPenalty = -8;
  // Overdue dental → penalty
  const dentalPenalty = -5;
  // Metformin refill almost out → minor warning
  const medPenalty = -2;
  // Habit health streaks (gym, etc.)
  const healthHabits = habits.filter(h => {
    const t = HABIT_TEMPLATES.find(x => x.id === h.id);
    return t?.category === "health";
  });
  const habitBonus = Math.min(10, healthHabits.reduce((acc, h) => {
    const t = HABIT_TEMPLATES.find(x => x.id === h.id);
    return acc + Math.min(h.streak * (t?.scorePerStreak || 1), 6);
  }, 0));
  const healthScore = Math.max(0, Math.min(25, 20 + physicalPenalty + dentalPenalty + medPenalty + habitBonus));

  // ── HABITS & DISCIPLINE (max 25 pts) ──
  const allHabitBonus = habits.reduce((acc, h) => {
    const t = HABIT_TEMPLATES.find(x => x.id === h.id);
    if (!t) return acc;
    return acc + Math.min(h.streak * t.scorePerStreak * 0.4, 4);
  }, 0);
  const disciplineScore = Math.max(0, Math.min(25, Math.round(allHabitBonus)));

  // ── WELLBEING (max 25 pts) ──
  const wellnessHabits = habits.filter(h => {
    const t = HABIT_TEMPLATES.find(x => x.id === h.id);
    return t?.category === "wellness";
  });
  const wellnessBonus = Math.min(10, wellnessHabits.reduce((acc, h) => {
    const t = HABIT_TEMPLATES.find(x => x.id === h.id);
    return acc + Math.min(h.streak * (t?.scorePerStreak || 1), 5);
  }, 0));
  // Financial stress penalty (high debt = stress)
  const stressPenalty = dtiRatio > 0.5 ? -5 : -2;
  const wellbeingScore = Math.max(0, Math.min(25, 14 + wellnessBonus + stressPenalty));

  const total = Math.min(100, financeScore + healthScore + disciplineScore + wellbeingScore);

  return {
    total: Math.round(total),
    pillars: [
      { label: "Financial Health", score: financeScore, max: 25, color: "#60a5fa",
        detail: debtPenalty < 0 ? "High debt load pulling score down" : "Finances on track",
        factors: [
          { text: "Heavy debt load ($29K)", pts: debtPenalty, bad: true },
          { text: "CC utilization 48%", pts: utilPenalty, bad: true },
          { text: "On-time payment streak", pts: paymentBonus, bad: false },
          { text: "Emergency fund progress", pts: savingsBonus, bad: false },
        ]
      },
      { label: "Health", score: healthScore, max: 25, color: "#f87171",
        detail: "2 overdue checkups are your biggest drag",
        factors: [
          { text: "Annual physical overdue", pts: physicalPenalty, bad: true },
          { text: "Dental cleaning overdue", pts: dentalPenalty, bad: true },
          { text: "Metformin refill low", pts: medPenalty, bad: true },
          { text: "Gym & health habits", pts: habitBonus, bad: false },
        ]
      },
      { label: "Habits & Discipline", score: disciplineScore, max: 25, color: "#facc15",
        detail: disciplineScore >= 15 ? "Strong consistency" : "Build more streaks",
        factors: habits.slice(0,4).map(h => {
          const t = HABIT_TEMPLATES.find(x => x.id === h.id);
          const pts = Math.min(h.streak * (t?.scorePerStreak||1) * 0.4, 4);
          return { text: `${t?.label} (${h.streak} streak)`, pts: Math.round(pts), bad: false };
        })
      },
      { label: "Wellbeing", score: wellbeingScore, max: 25, color: "#a78bfa",
        detail: stressPenalty < -2 ? "Financial stress impacting wellbeing" : "Wellbeing looks good",
        factors: [
          { text: "Financial stress (high debt)", pts: stressPenalty, bad: true },
          { text: "Wellness habits", pts: wellnessBonus, bad: false },
          { text: "Mental health practices", pts: 4, bad: false },
        ]
      },
    ]
  };
}

function calcLifeScore(habits) {
  return calcLifeScoreBreakdown(habits).total;
}

const ScoreRing = ({ score, size=120, doAnimate=true }) => {
  const [disp, setDisp] = useState(doAnimate ? 0 : score);
  useEffect(() => {
    if (!doAnimate) { setDisp(score); return; }
    let start = null;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      setDisp(Math.round(p * score));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [score, doAnimate]);
  const r = size/2 - 12, circ = 2*Math.PI*r;
  const color = disp>=80?"#4ade80":disp>=60?"#facc15":"#f87171";
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth="10"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-disp/100)}
        style={{transition:"stroke-dashoffset 0.1s"}}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{transform:`rotate(90deg)`,transformOrigin:`${size/2}px ${size/2}px`,
          fill:color,fontSize:size*0.21,fontWeight:800,fontFamily:"inherit"}}>
        {disp}
      </text>
    </svg>
  );
};

const Bar = ({ value, max, color="#60a5fa", h=8 }) => (
  <div style={{background:"#1e293b",borderRadius:99,height:h,overflow:"hidden"}}>
    <div style={{width:`${Math.min(100,(value/max)*100)}%`,background:color,height:"100%",borderRadius:99,transition:"width 0.8s ease"}}/>
  </div>
);

const Tag = ({ status }) => {
  const map = {eligible:["#4ade80","#052e16"],check:["#facc15","#1c1407"],ineligible:["#94a3b8","#0f172a"],paid:["#4ade80","#052e16"],upcoming:["#60a5fa","#0c1a2e"],overdue:["#f87171","#1c0a0a"]};
  const [bg,fg] = map[status]||["#64748b","#fff"];
  return <span style={{background:bg,color:fg,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:99,textTransform:"uppercase",letterSpacing:1}}>{status}</span>;
};

const HeatMap = ({ history }) => {
  const cells = [...history].slice(-28);
  while (cells.length < 28) cells.unshift(null);
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,14px)",gridTemplateRows:"repeat(7,14px)",gap:3}}>
      {cells.map((v,i) => (
        <div key={i} style={{width:14,height:14,borderRadius:3,
          background:v===null?"#0d1e35":v?"#4ade80":"#1e293b",
          opacity:v===null?0.3:1,border:v===null?"1px solid #1a3356":"none"}}/>
      ))}
    </div>
  );
};

const Flame = ({ streak }) => {
  const color = streak>=10?"#f97316":streak>=5?"#facc15":streak>=2?"#60a5fa":"#475569";
  const icon  = streak>=10?"🔥":streak>=5?"⚡":streak>=2?"✦":"○";
  return (
    <div style={{display:"flex",alignItems:"center",gap:4}}>
      <span style={{fontSize:16}}>{icon}</span>
      <span style={{fontSize:18,fontWeight:900,color}}>{streak}</span>
      <span style={{fontSize:10,color:"#64748b",fontWeight:600}}>streak</span>
    </div>
  );
};

export default function LifeSync({ user, onSignOut }) {
  const [tab, setTab] = useState("overview");
  const [habits, setHabits] = useState(INITIAL_HABITS);
  const [showAdd, setShowAdd] = useState(false);
  const [logModal, setLogModal] = useState(null);
  const [logVal, setLogVal] = useState(1);
  const [justLogged, setJustLogged] = useState(null);
  const [creditScore, setCreditScore] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [savings, setSavings] = useState(0);
  const [debts, setDebts] = useState([]);
  const [bills, setBills] = useState([]);
  const [medications, setMedications] = useState([]);
  const [checkups, setCheckups] = useState([]);
  const [showEditFinances, setShowEditFinances] = useState(false);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [showAddMed, setShowAddMed] = useState(false);
  const [showAddCheckup, setShowAddCheckup] = useState(false);
  const [newDebt, setNewDebt] = useState({name:"",balance:"",monthly_payment:"",apr:""});
  const [newBill, setNewBill] = useState({name:"",amount:"",due_day:"",status:"upcoming"});
  const [newMed, setNewMed] = useState({name:"",dose:"",schedule:"Daily",refill_days:30});
  const [newCheckup, setNewCheckup] = useState({name:"",last_date:"",urgent:false});
  const [financeForm, setFinanceForm] = useState({income:"",expenses:"",savings:""});
  const [creditHistory, setCreditHistory] = useState(CREDIT_HISTORY);
  const [creditFactors, setCreditFactors] = useState(SCORE_FACTORS);
  const [showUpdateScore, setShowUpdateScore] = useState(false);
  const [newScoreInput, setNewScoreInput] = useState("");
  const [simMode, setSimMode] = useState(false);
  const [simActions, setSimActions] = useState({ paydown: 0, newCard: false, missedPayment: false, oldAccount: false });
  // ── WELLNESS STATE ──
  const [moodHistory, setMoodHistory] = useState(INITIAL_MOOD_HISTORY);
  const [todayMood, setTodayMood] = useState(null);
  const [todayNote, setTodayNote] = useState("");
  const [moodLogged, setMoodLogged] = useState(false);
  const [checkInStep, setCheckInStep] = useState(0); // 0=idle,1=mood,2=phq,3=gad,4=done
  const [phqAnswers, setPhqAnswers] = useState([null,null]);
  const [gadAnswers, setGadAnswers] = useState([null,null]);
  const [checkInResults, setCheckInResults] = useState(null);
  const [wellnessAiLoading, setWellnessAiLoading] = useState(false);
  const [wellnessMsg, setWellnessMsg] = useState(null);
  const [supplements, setSupplements] = useState(INITIAL_SUPPLEMENTS);
  const [showAddSupp, setShowAddSupp] = useState(false);
  const [newSupp, setNewSupp] = useState({ name:"", dose:"", timing:"Morning", icon:"💊" });
  const [suppJustLogged, setSuppJustLogged] = useState(null);
  const [aiInput, setAiInput] = useState("");
  const [msgs, setMsgs] = useState([
    {role:"assistant",text:`Hi${username && username !== "You" ? " @"+username : ""}! 👋 Welcome to LifeSync. Ask me anything about your habits, finances, or health — I'm here to help you grow your Life Score.`}
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [username, setUsername] = useState("You");
  const chatRef = useRef(null);
  const lifeScore = calcLifeScore(habits);
  const scoreBreakdown = calcLifeScoreBreakdown(habits);

  // ── SUPABASE: Load user data on mount ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      // Load habits
      const { data: habitsData } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user.id);
      if (habitsData && habitsData.length > 0) {
        const mapped = habitsData.map(h => ({
          id: h.name,
          streak: h.streak || 0,
          weekCount: 0,
          history: Array(28).fill(0),
          active: true,
        }));
        setHabits(mapped);
      }

      // Load mood history
      const { data: moodData } = await supabase
        .from("moods")
        .select("*")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: true })
        .limit(28);
      if (moodData && moodData.length > 0) {
        const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const mapped = moodData.map(m => ({
          day: days[new Date(m.logged_at).getDay()],
          score: m.score,
        }));
        setMoodHistory(mapped);
      }

      // Load finances
      const { data: finData } = await supabase
        .from("finances").select("*").eq("user_id", user.id).single();
      if (finData) {
        if (finData.credit_score) setCreditScore(finData.credit_score);
        if (finData.monthly_income) setMonthlyIncome(finData.monthly_income);
        if (finData.monthly_expenses) setMonthlyExpenses(finData.monthly_expenses);
        if (finData.savings) setSavings(finData.savings);
        setFinanceForm({ income: finData.monthly_income||"", expenses: finData.monthly_expenses||"", savings: finData.savings||"" });
      }

      // Load debts
      const { data: debtsData } = await supabase.from("debts").select("*").eq("user_id", user.id).order("created_at");
      if (debtsData) setDebts(debtsData);

      // Load bills
      const { data: billsData } = await supabase.from("bills").select("*").eq("user_id", user.id).order("due_day");
      if (billsData) setBills(billsData);

      // Load medications
      const { data: medsData } = await supabase.from("medications").select("*").eq("user_id", user.id).order("created_at");
      if (medsData) setMedications(medsData);

      // Load checkups
      const { data: checkupsData } = await supabase.from("checkups").select("*").eq("user_id", user.id).order("created_at");
      if (checkupsData) setCheckups(checkupsData);

      // Load supplements from db
      const { data: suppData } = await supabase.from("supplements").select("*").eq("user_id", user.id).order("created_at");
      if (suppData && suppData.length > 0) {
        setSupplements(suppData.map(s => ({ ...s, takenToday: s.taken_today, history: Array(28).fill(0) })));
      }

      // Load profile username
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
      if (profile) setUsername(profile.username);
    };
    loadData();
  }, [user]);

  // ── SUPABASE: Save mood when logged ────────────────────────────────────────
  const saveMood = async (score, note) => {
    if (!user) return;
    await supabase.from("moods").insert([{
      user_id: user.id,
      score,
      note: note || null,
    }]);
  };

  // ── SUPABASE: Save habit log ────────────────────────────────────────────────
  const saveHabit = async (habitId, streak) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("habits")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", habitId)
      .single();
    if (existing) {
      await supabase.from("habits").update({ streak, last_completed: new Date().toISOString().split("T")[0] }).eq("id", existing.id);
    } else {
      await supabase.from("habits").insert([{ user_id: user.id, name: habitId, streak, completed: true }]);
    }
  };

  // ── SUPABASE: Save finances ────────────────────────────────────────────────
  const saveFinances = async (income, expenses, sav) => {
    if (!user) return;
    const { data: existing } = await supabase.from("finances").select("id").eq("user_id", user.id).single().catch(()=>({data:null}));
    const payload = { monthly_income: parseFloat(income)||0, monthly_expenses: parseFloat(expenses)||0, savings: parseFloat(sav)||0, updated_at: new Date().toISOString() };
    if (existing) { await supabase.from("finances").update(payload).eq("id", existing.id); }
    else { await supabase.from("finances").insert([{ user_id: user.id, ...payload }]); }
    setMonthlyIncome(parseFloat(income)||0);
    setMonthlyExpenses(parseFloat(expenses)||0);
    setSavings(parseFloat(sav)||0);
  };

  const addDebt = async () => {
    if (!newDebt.name.trim() || !user) return;
    const { data } = await supabase.from("debts").insert([{ user_id: user.id, name: newDebt.name, balance: parseFloat(newDebt.balance)||0, monthly_payment: parseFloat(newDebt.monthly_payment)||0, apr: newDebt.apr }]).select().single();
    if (data) setDebts(p => [...p, data]);
    setNewDebt({name:"",balance:"",monthly_payment:"",apr:""}); setShowAddDebt(false);
  };

  const removeDebt = async (id) => {
    await supabase.from("debts").delete().eq("id", id);
    setDebts(p => p.filter(d => d.id !== id));
  };

  const addBill = async () => {
    if (!newBill.name.trim() || !user) return;
    const { data } = await supabase.from("bills").insert([{ user_id: user.id, name: newBill.name, amount: parseFloat(newBill.amount)||0, due_day: parseInt(newBill.due_day)||1, status: newBill.status }]).select().single();
    if (data) setBills(p => [...p, data]);
    setNewBill({name:"",amount:"",due_day:"",status:"upcoming"}); setShowAddBill(false);
  };

  const removeBill = async (id) => {
    await supabase.from("bills").delete().eq("id", id);
    setBills(p => p.filter(b => b.id !== id));
  };

  const addMed = async () => {
    if (!newMed.name.trim() || !user) return;
    const { data } = await supabase.from("medications").insert([{ user_id: user.id, name: newMed.name, dose: newMed.dose, schedule: newMed.schedule, refill_days: parseInt(newMed.refill_days)||30 }]).select().single();
    if (data) setMedications(p => [...p, data]);
    setNewMed({name:"",dose:"",schedule:"Daily",refill_days:30}); setShowAddMed(false);
  };

  const removeMed = async (id) => {
    await supabase.from("medications").delete().eq("id", id);
    setMedications(p => p.filter(m => m.id !== id));
  };

  const addCheckup = async () => {
    if (!newCheckup.name.trim() || !user) return;
    const { data } = await supabase.from("checkups").insert([{ user_id: user.id, name: newCheckup.name, last_date: newCheckup.last_date, urgent: newCheckup.urgent }]).select().single();
    if (data) setCheckups(p => [...p, data]);
    setNewCheckup({name:"",last_date:"",urgent:false}); setShowAddCheckup(false);
  };

  const removeCheckup = async (id) => {
    await supabase.from("checkups").delete().eq("id", id);
    setCheckups(p => p.filter(c => c.id !== id));
  };

  // ── SUPABASE: Save credit score ─────────────────────────────────────────────
  const saveCreditScore = async (score) => {
    if (!user) return;
    const { data: existing } = await supabase.from("finances").select("id").eq("user_id", user.id).single();
    if (existing) {
      await supabase.from("finances").update({ credit_score: score, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("finances").insert([{ user_id: user.id, credit_score: score }]);
    }
  };

  // ── SUPABASE: Save life score history weekly ────────────────────────────────
  const saveScoreHistory = async (score) => {
    if (!user) return;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStr = weekStart.toISOString().split("T")[0];
    const { data: existing } = await supabase.from("score_history").select("id").eq("user_id", user.id).eq("week_start", weekStr).single();
    if (!existing) {
      await supabase.from("score_history").insert([{ user_id: user.id, score, week_start: weekStr }]);
    }
  };

  // Save score to history once on load
  useEffect(() => {
    if (user && lifeScore) saveScoreHistory(lifeScore);
  }, [user, lifeScore]);

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [msgs]);

  const tmpl = id => HABIT_TEMPLATES.find(t => t.id === id);
  const hdata = id => habits.find(h => h.id === id);

  const logHabit = (id, count) => {
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h;
      const t = tmpl(id);
      const newCount = Math.min(h.weekCount + count, t.target * 2);
      const done = newCount >= t.target;
      const newStreak = done ? h.streak+1 : h.streak;
      saveHabit(id, newStreak);
      return { ...h, weekCount: newCount, streak: newStreak, history: [...h.history, done?1:0].slice(-28) };
    }));
    setJustLogged(id);
    setTimeout(() => setJustLogged(null), 2200);
    setLogModal(null); setLogVal(1);
  };

  const addHabit = id => {
    if (habits.find(h => h.id === id)) return;
    setHabits(p => [...p, {id, streak:0, weekCount:0, history:Array(28).fill(0), active:true}]);
    setShowAdd(false);
  };

  const takeSupp = async (id) => {
    const newStreak = (supplements.find(s=>s.id===id)?.streak||0) + 1;
    if (user) await supabase.from("supplements").update({ streak: newStreak, taken_today: true }).eq("id", id);
    setSupplements(prev => prev.map(s => {
      if (s.id !== id || s.takenToday) return s;
      return { ...s, takenToday: true, streak: newStreak, history: [...s.history, 1].slice(-28) };
    }));
    setSuppJustLogged(id);
    setTimeout(() => setSuppJustLogged(null), 2200);
  };

  const addSupp = async () => {
    if (!newSupp.name.trim()) return;
    if (user) {
      const { data } = await supabase.from("supplements").insert([{ user_id: user.id, name: newSupp.name.trim(), dose: newSupp.dose.trim(), timing: newSupp.timing, icon: newSupp.icon, streak: 0, taken_today: false }]).select().single();
      if (data) setSupplements(prev => [...prev, { ...data, takenToday: false, history: Array(28).fill(0) }]);
    } else {
      const id = "supp_" + Date.now();
      setSupplements(prev => [...prev, { id, name: newSupp.name.trim(), dose: newSupp.dose.trim(), timing: newSupp.timing, icon: newSupp.icon, streak: 0, takenToday: false, history: Array(28).fill(0) }]);
    }
    setNewSupp({ name:"", dose:"", timing:"Morning", icon:"💊" });
    setShowAddSupp(false);
  };

  const removeSupp = async (id) => {
    if (user) await supabase.from("supplements").delete().eq("id", id);
    setSupplements(prev => prev.filter(s => s.id !== id));
  };

  const submitNewScore = () => {
    const s = parseInt(newScoreInput);
    if (isNaN(s) || s < 300 || s > 850) return;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const label = months[new Date().getMonth()];
    setCreditScore(s);
    setCreditHistory(prev => [...prev, { month: label, score: s }].slice(-12));
    saveCreditScore(s);
    setNewScoreInput(""); setShowUpdateScore(false);
  };

  const simScore = () => {
    let s = creditScore;
    const util = Math.max(0, 2400 - simActions.paydown * 100);
    if (util / 5000 < 0.1) s += 45;
    else if (util / 5000 < 0.3) s += 25;
    if (simActions.newCard) s -= 8;
    if (simActions.missedPayment) s -= 90;
    if (simActions.oldAccount) s -= 15;
    return Math.min(850, Math.max(300, s));
  };

  const scLabel = (s) => s>=800?"Exceptional":s>=740?"Very Good":s>=670?"Good":s>=580?"Fair":"Poor";
  const scColor = (s) => s>=740?"#4ade80":s>=670?"#facc15":s>=580?"#f97316":"#f87171";

  const logMood = () => {
    if (!todayMood) return;
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const today = days[new Date().getDay()];
    setMoodHistory(prev => {
      const next = [...prev];
      next[next.length - 1] = { day: today, score: todayMood };
      return next;
    });
    saveMood(todayMood, todayNote);
    setMoodLogged(true);
  };

  const finishCheckIn = async () => {
    const phqTotal = phqAnswers.reduce((a,b) => a + (b||0), 0);
    const gadTotal = gadAnswers.reduce((a,b) => a + (b||0), 0);
    const phqRisk  = phqTotal >= 3 ? "elevated" : phqTotal >= 1 ? "mild" : "low";
    const gadRisk  = gadTotal >= 3 ? "elevated" : gadTotal >= 1 ? "mild" : "low";
    setCheckInResults({ phqTotal, gadTotal, phqRisk, gadRisk, mood: todayMood });
    setCheckInStep(4);
    setWellnessAiLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 500,
          system: `You are a warm, empathetic wellness companion inside the LifeSync app. The user just completed a mental wellness check-in. Respond with 3–4 sentences: acknowledge their results gently, validate how they're feeling, offer one small actionable suggestion for today, and remind them you're here to talk. Keep it warm, human, and never clinical. Never diagnose. Always end by saying they can chat with you anytime in the AI tab.`,
          messages: [{ role: "user", content: `My mood today: ${todayMood}/10. PHQ-2 score: ${phqTotal}/6 (${phqRisk} depression indicators). GAD-2 score: ${gadTotal}/6 (${gadRisk} anxiety indicators). My note: "${todayNote || "no note"}". Please give me a short, warm, personalized response.` }]
        })
      });
      const d = await res.json();
      setWellnessMsg(d.content?.map(b => b.text||"").join("") || "Thank you for checking in. Remember, small steps every day add up.");
    } catch { setWellnessMsg("Thanks for checking in today. Whatever you're feeling is valid. Take it one moment at a time. 💙"); }
    setWellnessAiLoading(false);
  };

  const resetCheckIn = () => { setCheckInStep(0); setPhqAnswers([null,null]); setGadAnswers([null,null]); setCheckInResults(null); setWellnessMsg(null); setTodayNote(""); setTodayMood(null); setMoodLogged(false); };

  const avgMood = () => { const valid = moodHistory.filter(d=>d.score!==null); return valid.length ? (valid.reduce((a,b)=>a+b.score,0)/valid.length).toFixed(1) : "—"; };
  const moodTrend = () => { const valid = moodHistory.filter(d=>d.score!==null); if (valid.length < 7) return 0; const last7 = valid.slice(-7), prev7 = valid.slice(-14,-7); if (prev7.length < 7) return 0; const avgL = last7.reduce((a,b)=>a+b.score,0)/7, avgP = prev7.reduce((a,b)=>a+b.score,0)/7; return +(avgL - avgP).toFixed(1); };
  const moodColor = (s) => s>=8?"#4ade80":s>=6?"#facc15":s>=4?"#f97316":"#f87171";
  const moodEmoji = (s) => s>=9?"😄":s>=7?"🙂":s>=5?"😐":s>=3?"😔":"😞";

  const sendMsg = async () => {
    if (!aiInput.trim()) return;
    const um = {role:"user",text:aiInput};
    const next = [...msgs, um];
    setMsgs(next); setAiInput(""); setAiLoading(true);
    const hsum = habits.map(h=>`${tmpl(h.id)?.label}: ${h.streak} streak, ${h.weekCount}/${tmpl(h.id)?.target} this period`).join("; ");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:1000,
          system:`You are LifeSync AI — a warm, motivating personal life coach inside the LifeSync app. User: ${username}. Life Score: ${lifeScore}/100. Habits: ${hsum}. Finances: $${monthlyIncome} income, $${monthlyExpenses} expenses, ${creditScore} credit score, ${debts.length} debts totaling $${debts.reduce((a,b)=>a+(b.balance||0),0).toLocaleString()}. Savings: $${savings}. Medications: ${medications.map(m=>m.name).join(", ")||"none"}. Be warm, motivating, concise. Celebrate streaks. Give specific actionable advice based on their real data.`,
          messages:next.map(m=>({role:m.role,content:m.text}))
        })
      });
      const d = await res.json();
      setMsgs([...next,{role:"assistant",text:d.content?.map(b=>b.text||"").join("")||"Happy to help!"}]);
    } catch { setMsgs([...next,{role:"assistant",text:"Connection issue — try again in a moment."}]); }
    setAiLoading(false);
  };

  const scoreLabel = lifeScore>=80?"Excellent":lifeScore>=65?"Good":lifeScore>=50?"Fair":lifeScore>=35?"Needs Work":"Critical";
  const scoreColor = lifeScore>=80?"#4ade80":lifeScore>=65?"#facc15":lifeScore>=50?"#f97316":"#f87171";

  const C = {
    app:{minHeight:"100vh",background:"#060c18",color:"#e2e8f0",fontFamily:"'DM Sans',sans-serif",paddingBottom:60},
    hdr:{background:"linear-gradient(135deg,#0f1f3d,#0a1628)",borderBottom:"1px solid #1e3a5f",padding:"18px 28px",display:"flex",alignItems:"center",justifyContent:"space-between"},
    logo:{fontSize:22,fontWeight:800,background:"linear-gradient(90deg,#60a5fa,#4ade80)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
    nav:{display:"flex",gap:2,padding:"14px 28px 0",borderBottom:"1px solid #0f2240",overflowX:"auto"},
    navB:(a)=>({background:a?"#0f2240":"transparent",color:a?"#60a5fa":"#64748b",border:"none",borderBottom:a?"2px solid #60a5fa":"2px solid transparent",padding:"10px 18px",cursor:"pointer",fontSize:13,fontWeight:600,borderRadius:"8px 8px 0 0",transition:"all .2s",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6}),
    pg:{padding:"24px 24px 0"},
    g:(cols="repeat(auto-fit,minmax(300px,1fr))")=>({display:"grid",gridTemplateColumns:cols,gap:18}),
    card:{background:"linear-gradient(145deg,#0d1e35,#091629)",border:"1px solid #1a3356",borderRadius:16,padding:22},
    cTitle:{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:2,color:"#4a7ab5",marginBottom:14},
    row:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #0f2240"},
    btn:(col="#1d4ed8")=>({background:`linear-gradient(135deg,${col},${col}cc)`,color:"#fff",border:"none",borderRadius:10,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}),
    ghost:{background:"transparent",border:"1px solid #1a3356",color:"#94a3b8",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600},
    inp:{background:"#080f1e",border:"1px solid #1a3356",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:14,outline:"none"},
    bub:(r)=>({alignSelf:r==="user"?"flex-end":"flex-start",background:r==="user"?"linear-gradient(135deg,#1d4ed8,#2563eb)":"#0d1e35",border:r==="user"?"none":"1px solid #1a3356",borderRadius:r==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"10px 14px",maxWidth:"82%",fontSize:13,lineHeight:1.6}),
    overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(4px)"},
    mbox:{background:"#0d1e35",border:"1px solid #1a3356",borderRadius:20,padding:28,width:380,maxWidth:"92vw"},
  };

  const TABS=[{id:"overview",label:"Overview",icon:"◈"},{id:"habits",label:"Habits",icon:"🔥"},{id:"finances",label:"Finances",icon:"◎"},{id:"health",label:"Health",icon:"◉"},{id:"wellness",label:"Wellness",icon:"🧠"},{id:"ai",label:"AI Chat",icon:"✦"}];

  return (
    <div style={C.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#060c18}::-webkit-scrollbar-thumb{background:#1a3356;border-radius:2px}@keyframes pop{0%{transform:scale(1)}50%{transform:scale(1.13)}100%{transform:scale(1)}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.popped{animation:pop 0.35s ease}`}</style>

      {/* HEADER */}
      <div style={C.hdr}>
        <div>
          <div style={C.logo}>◈ LifeSync</div>
          <div style={{fontSize:12,color:"#4a7ab5",marginTop:2}}>Health · Finance · Habits</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:"#818cf8"}}>Life Score</div>
            <div style={{fontSize:20,fontWeight:900,color:scoreColor}}>{lifeScore} <span style={{fontSize:12,color:"#64748b",fontWeight:400}}>{scoreLabel}</span></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>@{username}</div>
              {onSignOut&&<button onClick={onSignOut} style={{background:"transparent",border:"none",color:"#475569",fontSize:11,cursor:"pointer",padding:0,fontWeight:600}}>Sign out</button>}
            </div>
            <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#c084fc)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,color:"#fff",flexShrink:0}}>
              {username.slice(0,2).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={C.nav}>
        {TABS.map(t=><button key={t.id} style={C.navB(tab===t.id)} onClick={()=>setTab(t.id)}><span>{t.icon}</span>{t.label}</button>)}
      </div>

      <div style={C.pg}>

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={C.g()}>
              <div style={C.card}>
                <div style={C.cTitle}>Life Score</div>
                <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:18}}>
                  <ScoreRing score={lifeScore} size={110}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:800,marginBottom:4,color:scoreColor}}>{scoreLabel}</div>
                    <div style={{fontSize:12,color:"#64748b",lineHeight:1.7,marginBottom:10}}>Score reflects your real situation — debt, overdue care, and habits all count.</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {scoreBreakdown.pillars.map(p=>(
                        <div key={p.label} style={{fontSize:11,background:"#080f1e",borderRadius:8,padding:"3px 8px",display:"flex",alignItems:"center",gap:4}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                          <span style={{color:"#94a3b8"}}>{p.label.split(" ")[0]}</span>
                          <span style={{fontWeight:800,color:p.color}}>{p.score}/{p.max}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Pillar bars */}
                {scoreBreakdown.pillars.map(p=>(
                  <div key={p.label} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                      <span style={{color:"#94a3b8"}}>{p.label}</span>
                      <span style={{fontWeight:700,color:p.color}}>{p.score}/{p.max}</span>
                    </div>
                    <Bar value={p.score} max={p.max} color={p.color} h={7}/>
                    <div style={{fontSize:11,color:p.score<p.max*0.6?"#f87171":"#4a7ab5",marginTop:3}}>{p.detail}</div>
                  </div>
                ))}
              </div>
              <div style={C.card}>
                <div style={C.cTitle}>Top Streaks</div>
                {[...habits].sort((a,b)=>b.streak-a.streak).slice(0,4).map(h=>{const t=tmpl(h.id);return(<div key={h.id} style={C.row}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>{t?.icon}</span><div><div style={{fontSize:13,fontWeight:600}}>{t?.label}</div><div style={{fontSize:11,color:"#64748b"}}>{h.weekCount}/{t?.target} {t?.unit}</div></div></div><Flame streak={h.streak}/></div>);})}
                <button style={{...C.btn(),marginTop:14,width:"100%",fontSize:13}} onClick={()=>setTab("habits")}>View All Habits →</button>
              </div>
              <div style={C.card}>
                <div style={C.cTitle}>Financial Snapshot</div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
                  {[["Income","$4,200","#4ade80"],["Expenses","$3,100","#f87171"],["Saved","$1,100","#60a5fa"]].map(([l,v,c])=>(
                    <div key={l} style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:11,color:"#64748b"}}>{l}/mo</div></div>
                  ))}
                </div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:4,display:"flex",justifyContent:"space-between"}}><span>Emergency Fund</span><span style={{color:"#e2e8f0"}}>$2,340 / $5,000</span></div>
                <Bar value={2340} max={5000} color="#60a5fa"/>
              </div>
            </div>
            <div style={C.card}>
              <div style={C.cTitle}>Priority Actions</div>
              <div style={C.g()}>
                {[{icon:"💊",text:"Metformin refill in 3 days",color:"#f87171",action:"Remind me",go:"health"},{icon:"💰",text:"$1,200 tax credit — you may qualify",color:"#4ade80",action:"Learn more",go:"ai"},{icon:"🏥",text:"Annual physical is overdue",color:"#facc15",action:"Find a clinic",go:"ai"},{icon:"🔥",text:"Log today's gym session to keep streak",color:"#f97316",action:"Log now",go:"habits"}].map((a,i)=>(
                  <div key={i} style={{background:"#080f1e",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,border:"1px solid #0f2240"}}>
                    <span style={{fontSize:22}}>{a.icon}</span>
                    <div style={{flex:1,fontSize:13,fontWeight:600}}>{a.text}</div>
                    <button onClick={()=>setTab(a.go)} style={{background:"transparent",border:`1px solid ${a.color}`,color:a.color,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{a.action}</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── HABITS ── */}
        {tab==="habits"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            {/* Banner */}
            <div style={{background:"linear-gradient(135deg,#0a1f3d,#0d2a1a)",border:"1px solid #1a4a2e",borderRadius:16,padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
              <div>
                <div style={{fontSize:12,color:"#4ade80",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>Habits &amp; Discipline Pillar</div>
                <div style={{fontSize:30,fontWeight:900}}>{scoreBreakdown.pillars[2].score}<span style={{fontSize:13,color:"#64748b",fontWeight:400}}> / 25 pts · Overall Score {lifeScore}/100</span></div>
                <div style={{fontSize:12,color:"#f97316",marginTop:4,fontWeight:600}}>⚠ Debt load &amp; overdue checkups are holding your total score back — habits alone can't fix them.</div>
              </div>
              <ScoreRing score={lifeScore} size={90} doAnimate={false}/>
            </div>

            {/* Header row */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <h2 style={{fontSize:18,fontWeight:800}}>Active Habits</h2>
              <button style={C.btn("#059669")} onClick={()=>setShowAdd(true)}>+ Add Habit</button>
            </div>

            {/* Habit cards */}
            <div style={C.g()}>
              {habits.map(h=>{
                const t=tmpl(h.id);
                const pct=Math.min(h.weekCount/t.target,1);
                const done=pct>=1;
                const pts=Math.min(h.streak*t.scorePerStreak,15);
                const logged=justLogged===h.id;
                return(
                  <div key={h.id} className={logged?"popped":""} style={{...C.card,border:done?"1px solid #1a4a2e":"1px solid #1a3356",background:done?"linear-gradient(145deg,#0a1e17,#071511)":C.card.background,transition:"border 0.3s"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:28}}>{t.icon}</span>
                        <div><div style={{fontSize:14,fontWeight:700}}>{t.label}</div><div style={{fontSize:11,color:"#64748b"}}>{t.target} {t.unit}</div></div>
                      </div>
                      <div style={{textAlign:"right"}}><Flame streak={h.streak}/><div style={{fontSize:11,color:"#4ade80",marginTop:2,fontWeight:700}}>+{pts} pts to score</div></div>
                    </div>
                    <div style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                        <span style={{color:"#64748b"}}>Progress this period</span>
                        <span style={{color:done?"#4ade80":"#e2e8f0",fontWeight:700}}>{h.weekCount}/{t.target}{done?" ✓":""}</span>
                      </div>
                      <Bar value={h.weekCount} max={t.target} color={done?"#4ade80":"#60a5fa"} h={8}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <HeatMap history={h.history}/>
                      <button onClick={()=>{setLogModal(h.id);setLogVal(1);}} style={{...C.btn(done?"#065f46":"#1d4ed8"),fontSize:12,padding:"7px 14px"}}>{done?"✓ Log More":"Log →"}</button>
                    </div>
                    {logged&&<div style={{marginTop:10,background:"rgba(74,222,128,0.1)",borderRadius:8,padding:"7px 10px",fontSize:12,color:"#4ade80",fontWeight:700,textAlign:"center",animation:"fadeUp 0.3s ease"}}>✦ Logged! Streak &amp; Life Score updated 🎉</div>}
                  </div>
                );
              })}
            </div>

            {/* Leaderboard */}
            <div style={C.card}>
              <div style={C.cTitle}>Your Streak Leaderboard</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[...habits].sort((a,b)=>b.streak-a.streak).map((h,i)=>{
                  const t=tmpl(h.id);
                  const medals=["🥇","🥈","🥉"];
                  const barColor=i===0?"#facc15":i===1?"#94a3b8":"#cd7f32";
                  return(
                    <div key={h.id} style={{display:"flex",alignItems:"center",gap:14,background:"#080f1e",borderRadius:12,padding:"12px 16px"}}>
                      <span style={{fontSize:20,width:28}}>{medals[i]||`#${i+1}`}</span>
                      <span style={{fontSize:22}}>{t.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{t.label}</div>
                        <Bar value={h.streak} max={Math.max(8,...habits.map(x=>x.streak))} color={barColor} h={4}/>
                      </div>
                      <Flame streak={h.streak}/>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scoring guide */}
            <div style={C.card}>
              <div style={C.cTitle}>How Habit Scoring Works</div>
              <div style={C.g("repeat(auto-fit,minmax(200px,1fr))")}>
                {[{icon:"🔥",title:"Streaks Add Points",desc:"Each period you hit your target, your streak grows — so does your Life Score bonus."},{icon:"📅",title:"Consistency Wins",desc:"Steady habits score higher than one-time bursts. Daily wins compound over time."},{icon:"⚡",title:"Category Bonuses",desc:"Health habits: 2–5 pts/streak. Finance habits: 3–4 pts. High-impact habits score most."},{icon:"💔",title:"Protect Your Streaks",desc:"Missing a full period resets your streak to 0. Partial progress doesn't count."}].map(s=>(
                  <div key={s.title} style={{background:"#080f1e",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:22,marginBottom:8}}>{s.icon}</div>
                    <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{s.title}</div>
                    <div style={{fontSize:12,color:"#64748b",lineHeight:1.6}}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FINANCES ── */}
        {tab==="finances"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>

            {/* TOP ROW */}
            <div style={C.g()}>
              <div style={C.card}>
                <div style={C.cTitle}>Monthly Budget</div>
                {[["Housing",1250,"#60a5fa"],["Food & Groceries",480,"#4ade80"],["Transportation",410,"#facc15"],["Health & Insurance",320,"#f87171"],["Entertainment",180,"#a78bfa"],["Other",460,"#94a3b8"]].map(([cat,amt,color])=>(
                  <div key={cat} style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:13}}><span style={{color:"#94a3b8"}}>{cat}</span><span style={{fontWeight:700}}>${amt}</span></div>
                    <Bar value={amt} max={4200} color={color} h={6}/>
                  </div>
                ))}
              </div>
              <div style={C.card}>
                <div style={C.cTitle}>Debt Overview</div>
                {[["Credit Card",2400,120,"19.9%",5000],["Student Loan",18500,210,"5.4%",25000],["Car Loan",8200,285,"7.1%",15000]].map(([name,bal,pay,rate,max])=>(
                  <div key={name} style={{marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><div><div style={{fontSize:14,fontWeight:600}}>{name}</div><div style={{fontSize:11,color:"#64748b"}}>{rate} APR · ${pay}/mo</div></div><div style={{fontSize:16,fontWeight:800,color:"#f87171"}}>${bal.toLocaleString()}</div></div>
                    <Bar value={bal} max={max} color="#f87171" h={5}/>
                  </div>
                ))}
              </div>
              <div style={C.card}>
                <div style={C.cTitle}>Upcoming Bills</div>
                {bills.map(b=>(
                  <div key={b.id} style={{...C.row,alignItems:"center"}}>
                    <div><div style={{fontSize:14,fontWeight:600}}>{b.name}</div><div style={{fontSize:11,color:"#64748b"}}>Due day {b.due_day}</div></div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:700}}>${(b.amount||0).toLocaleString()}</span><Tag status={b.status}/><button onClick={()=>removeBill(b.id)} style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:16}}>×</button></div>
                  </div>
                ))}
                {bills.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:"#475569",fontSize:13}}>No bills added yet.</div>}
                <button onClick={()=>setShowAddBill(true)} style={{marginTop:8,background:"transparent",border:"1px solid #1e2240",color:"#818cf8",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,width:"100%"}}>+ Add Bill</button>
              </div>
              <div style={C.card}>
                <div style={C.cTitle}>Benefits Checker</div>
                {[["Earned Income Tax Credit","$1,200","eligible"],["Utility Assistance (LIHEAP)","Up to $500","check"],["SNAP Food Benefits","$250/mo","ineligible"]].map(([name,amt,status])=>(
                  <div key={name} style={C.row}><div><div style={{fontSize:13,fontWeight:600}}>{name}</div><div style={{fontSize:12,color:"#4ade80",fontWeight:700}}>{amt}</div></div><Tag status={status}/></div>
                ))}
              </div>
            </div>

            {/* ── CREDIT SCORE TRACKER ── */}
            <div style={{borderTop:"1px solid #0f2240",paddingTop:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <h2 style={{fontSize:18,fontWeight:800}}>💳 Credit Score Tracker</h2>
                  <div style={{fontSize:12,color:"#64748b",marginTop:2}}>Update your score manually from Credit Karma, Experian, or your bank app.</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button style={{...C.ghost,color:"#facc15",border:"1px solid #facc15"}} onClick={()=>setSimMode(m=>!m)}>{simMode?"Hide Simulator":"Score Simulator"}</button>
                  <button style={C.btn("#0ea5e9")} onClick={()=>setShowUpdateScore(true)}>+ Update Score</button>
                </div>
              </div>

              <div style={C.g("repeat(auto-fit,minmax(300px,1fr))")}>

                {/* Score Gauge */}
                <div style={{...C.card,background:"linear-gradient(145deg,#071829,#050f1c)"}}>
                  <div style={C.cTitle}>Current Score</div>
                  <div style={{display:"flex",alignItems:"center",gap:20}}>
                    <div style={{position:"relative",width:110,height:110,flexShrink:0}}>
                      <svg width="110" height="110" style={{transform:"rotate(-90deg)"}}>
                        <circle cx="55" cy="55" r="43" fill="none" stroke="#1e293b" strokeWidth="10"/>
                        <circle cx="55" cy="55" r="43" fill="none" stroke={scColor(creditScore)} strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={2*Math.PI*43}
                          strokeDashoffset={2*Math.PI*43*(1-((creditScore-300)/550))}
                          style={{transition:"stroke-dashoffset 1s ease"}}/>
                      </svg>
                      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                        <div style={{fontSize:22,fontWeight:900,color:scColor(creditScore)}}>{creditScore}</div>
                        <div style={{fontSize:9,color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{scLabel(creditScore)}</div>
                      </div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{marginBottom:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#64748b",marginBottom:4}}><span>300</span><span>580</span><span>670</span><span>740</span><span>850</span></div>
                        <div style={{height:8,borderRadius:99,background:"linear-gradient(90deg,#f87171 0%,#f97316 25%,#facc15 45%,#4ade80 70%,#22d3ee 100%)",position:"relative"}}>
                          <div style={{position:"absolute",top:"50%",transform:"translate(-50%,-50%)",left:`${((creditScore-300)/550)*100}%`,width:14,height:14,borderRadius:"50%",background:"#fff",border:`3px solid ${scColor(creditScore)}`,boxShadow:"0 0 8px rgba(0,0,0,0.5)",transition:"left 0.8s ease"}}/>
                        </div>
                      </div>
                      <div style={{fontSize:12,color:"#64748b",lineHeight:1.7}}>
                        <span style={{color:"#4ade80",fontWeight:700}}>+31 pts</span> gained in 6 months<br/>
                        <span style={{color:"#facc15",fontWeight:700}}>Goal: 720</span> — {720-creditScore} pts to go
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score History Chart */}
                <div style={{...C.card,gridColumn:"span 2"}}>
                  <div style={C.cTitle}>Score History</div>
                  <div style={{display:"flex",alignItems:"flex-end",gap:8,height:100,paddingBottom:4}}>
                    {creditHistory.map((h,i)=>{
                      const pct = (h.score - 580) / 270;
                      const ht  = Math.max(12, Math.round(pct * 88));
                      const isLast = i === creditHistory.length - 1;
                      return(
                        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                          <div style={{fontSize:10,color:isLast?scColor(h.score):"#64748b",fontWeight:isLast?800:400}}>{h.score}</div>
                          <div style={{width:"100%",height:ht,borderRadius:"4px 4px 0 0",background:isLast?scColor(h.score):"#1e3a5f",transition:"height 0.6s ease",minHeight:12}}/>
                          <div style={{fontSize:10,color:isLast?"#e2e8f0":"#475569",fontWeight:isLast?700:400}}>{h.month}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Score Factors */}
                <div style={{...C.card,gridColumn:"span 2"}}>
                  <div style={C.cTitle}>Score Breakdown — What's Affecting You</div>
                  <div style={C.g("repeat(auto-fit,minmax(240px,1fr))")}>
                    {creditFactors.map(f=>(
                      <div key={f.label} style={{background:"#080f1e",borderRadius:12,padding:"14px 16px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:700}}>{f.label}</div>
                            <div style={{fontSize:11,color:"#64748b"}}>{f.weight}% of score · {f.desc}</div>
                          </div>
                          <div style={{fontSize:16,fontWeight:900,color:f.color}}>{f.value}</div>
                        </div>
                        <Bar value={f.value} max={100} color={f.color} h={6}/>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Tips */}
                <div style={C.card}>
                  <div style={C.cTitle}>Personalized Tips to Boost Your Score</div>
                  {[
                    {impact:"+25–45 pts", tip:"Pay credit card below 30% utilization ($1,500 balance)", urgent:true},
                    {impact:"+10–20 pts", tip:"Keep your 14-month on-time streak — don't miss any payments", urgent:false},
                    {impact:"+5–10 pts",  tip:"Avoid opening new credit lines in the next 6 months", urgent:false},
                    {impact:"+5 pts",     tip:"Request a credit limit increase (without hard inquiry)", urgent:false},
                  ].map((t,i)=>(
                    <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid #0f2240",alignItems:"flex-start"}}>
                      <span style={{fontSize:12,fontWeight:800,color:t.urgent?"#4ade80":"#60a5fa",background:t.urgent?"rgba(74,222,128,0.1)":"rgba(96,165,250,0.1)",padding:"3px 8px",borderRadius:99,whiteSpace:"nowrap",marginTop:1}}>{t.impact}</span>
                      <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.5}}>{t.tip}</div>
                    </div>
                  ))}
                </div>

                {/* Score Ranges Reference */}
                <div style={C.card}>
                  <div style={C.cTitle}>Score Ranges</div>
                  {[["Exceptional","800–850","#22d3ee",true],["Very Good","740–799","#4ade80",false],["Good","670–739","#facc15",false],["Fair","580–669","#f97316",false],["Poor","300–579","#f87171",false]].map(([label,range,color,top])=>{
                    const isCurrent = (label==="Good"&&creditScore>=670&&creditScore<740)||(label==="Fair"&&creditScore>=580&&creditScore<670)||(label==="Very Good"&&creditScore>=740&&creditScore<800)||(label==="Exceptional"&&creditScore>=800)||(label==="Poor"&&creditScore<580);
                    return(
                      <div key={label} style={{...C.row,background:isCurrent?"rgba(255,255,255,0.03)":"transparent",borderRadius:8,padding:"8px 10px",marginBottom:2}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:color}}/>
                          <div>
                            <div style={{fontSize:13,fontWeight:isCurrent?800:500}}>{label}{isCurrent&&<span style={{fontSize:10,color:color,marginLeft:6,fontWeight:700}}>← You are here</span>}</div>
                            <div style={{fontSize:11,color:"#64748b"}}>{range}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SCORE SIMULATOR */}
              {simMode&&(
                <div style={{...C.card,marginTop:18,border:"1px solid #2a2a0a",background:"linear-gradient(145deg,#141408,#0e0e05)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <div>
                      <div style={C.cTitle}>Score Simulator — What If?</div>
                      <div style={{fontSize:13,color:"#64748b"}}>Toggle actions below to see how your score would change.</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:11,color:"#64748b"}}>Simulated Score</div>
                      <div style={{fontSize:32,fontWeight:900,color:scColor(simScore())}}>{simScore()}</div>
                      <div style={{fontSize:12,color:simScore()>creditScore?"#4ade80":"#f87171",fontWeight:700}}>{simScore()>creditScore?`▲ +${simScore()-creditScore}`:simScore()<creditScore?`▼ ${simScore()-creditScore}`:""} pts</div>
                    </div>
                  </div>
                  <div style={C.g("repeat(auto-fit,minmax(220px,1fr))")}>
                    {[
                      {key:"paydown",    type:"range", label:"Pay down credit card",   desc:`Pay off $${simActions.paydown*100} → balance $${2400-simActions.paydown*100}`, min:0, max:24, color:"#4ade80"},
                      {key:"newCard",    type:"toggle",label:"Open a new credit card",  desc:"Hard inquiry + new account age", color:"#f87171"},
                      {key:"missedPayment",type:"toggle",label:"Miss a payment",        desc:"Biggest single-factor score killer", color:"#f87171"},
                      {key:"oldAccount", type:"toggle",label:"Close oldest account",    desc:"Reduces average credit age", color:"#f97316"},
                    ].map(a=>(
                      <div key={a.key} style={{background:"#0a0a04",border:"1px solid #1e1e08",borderRadius:12,padding:"14px 16px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                          <div><div style={{fontSize:13,fontWeight:700}}>{a.label}</div><div style={{fontSize:11,color:"#64748b",marginTop:2}}>{a.type==="range"?a.desc.replace("$0","$"+simActions.paydown*100):a.desc}</div></div>
                          {a.type==="toggle"&&(
                            <div onClick={()=>setSimActions(p=>({...p,[a.key]:!p[a.key]}))}
                              style={{width:40,height:22,borderRadius:99,background:simActions[a.key]?"#dc2626":"#1e293b",position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
                              <div style={{position:"absolute",top:3,left:simActions[a.key]?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                            </div>
                          )}
                        </div>
                        {a.type==="range"&&(
                          <div>
                            <input type="range" min={0} max={24} value={simActions.paydown}
                              onChange={e=>setSimActions(p=>({...p,paydown:parseInt(e.target.value)}))}
                              style={{width:"100%",accentColor:a.color}}/>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#64748b"}}><span>$0</span><span>$2,400</span></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HEALTH ── */}
        {tab==="health"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={C.g()}>
              <div style={C.card}>
                <div style={C.cTitle}>Preventive Care Checklist</div>
                {[["Annual Physical","8 months ago",true],["Dental Cleaning","14 months ago",true],["Eye Exam","1 year ago",false],["Blood Pressure Check","3 months ago",false]].map(([name,last,urgent])=>(
                  <div key={name} style={{background:urgent?"rgba(248,113,113,0.07)":"rgba(96,165,250,0.07)",border:`1px solid ${urgent?"rgba(248,113,113,0.3)":"rgba(96,165,250,0.2)"}`,borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><div style={{fontSize:13,fontWeight:600}}>{name}</div><div style={{fontSize:11,color:"#64748b"}}>Last: {last}</div></div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}><Tag status={urgent?"overdue":"upcoming"}/><button onClick={()=>setTab("ai")} style={C.ghost}>Get help →</button></div>
                  </div>
                ))}
              </div>
              <div style={C.card}>
                <div style={C.cTitle}>Medication Tracker</div>
                {[["Lisinopril 10mg","Daily",8,"#4ade80"],["Vitamin D3","Daily",22,"#60a5fa"],["Metformin 500mg","Twice daily",3,"#f87171"]].map(([name,sched,days,color])=>(
                  <div key={name} style={{background:"#0a1929",border:"1px solid #1a3356",borderRadius:12,padding:"12px 16px",marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:14,fontWeight:700}}>{name}</div><div style={{fontSize:12,color:"#64748b"}}>{sched}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:11,color:"#64748b"}}>Refill in</div><div style={{fontSize:18,fontWeight:800,color}}>{days}d</div></div></div>
                    <div style={{marginTop:10}}><Bar value={days} max={30} color={color} h={5}/></div>
                  </div>
                ))}
              </div>
              <div style={C.card}>
                <div style={C.cTitle}>Symptom Checker</div>
                <div style={{fontSize:13,color:"#64748b",marginBottom:14}}>Describe what you're feeling for AI guidance.</div>
                <textarea placeholder="e.g. I've had a headache and mild fever for 2 days..." style={{...C.inp,width:"100%",minHeight:100,resize:"vertical"}} onChange={e=>{window._sx=e.target.value;}}/>
                <button onClick={()=>{setAiInput(window._sx||"I have some symptoms I'd like to discuss");setTab("ai");}} style={{...C.btn(),marginTop:12,width:"100%"}}>Ask AI Assistant →</button>
                <div style={{marginTop:10,fontSize:11,color:"#4a7ab5",lineHeight:1.6}}>⚕️ Not a substitute for professional medical advice. In emergencies, call 911.</div>
              </div>
            </div>

            {/* ── SUPPLEMENT TRACKER ── */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <h2 style={{fontSize:18,fontWeight:800}}>🌿 Supplement Tracker</h2>
                  <div style={{fontSize:12,color:"#64748b",marginTop:2}}>Log your daily supplements and build a streak.</div>
                </div>
                <button style={C.btn("#7c3aed")} onClick={()=>setShowAddSupp(true)}>+ Add Supplement</button>
              </div>

              {/* Today's summary bar */}
              <div style={{background:"linear-gradient(135deg,#130d2a,#1a0d3a)",border:"1px solid #2d1f5e",borderRadius:14,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontSize:12,color:"#a78bfa",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4}}>Today's Progress</div>
                  <div style={{fontSize:22,fontWeight:900}}>{supplements.filter(s=>s.takenToday).length}<span style={{fontSize:14,color:"#64748b",fontWeight:400}}> / {supplements.length} taken</span></div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {supplements.map(s=>(
                    <div key={s.id} title={s.name} style={{width:36,height:36,borderRadius:"50%",background:s.takenToday?"rgba(167,139,250,0.2)":"#080f1e",border:`2px solid ${s.takenToday?"#a78bfa":"#1a3356"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,cursor:"pointer",transition:"all 0.2s"}} onClick={()=>!s.takenToday&&takeSupp(s.id)}>
                      {s.takenToday?"✓":s.icon}
                    </div>
                  ))}
                </div>
              </div>

              {/* Supplement cards grid */}
              <div style={C.g()}>
                {supplements.map(s=>{
                  const isNew = suppJustLogged === s.id;
                  const streakColor = s.streak>=14?"#f97316":s.streak>=7?"#facc15":s.streak>=3?"#a78bfa":"#475569";
                  const streakIcon  = s.streak>=14?"🔥":s.streak>=7?"⚡":s.streak>=3?"✦":"○";
                  return(
                    <div key={s.id} className={isNew?"popped":""} style={{...C.card, border:s.takenToday?"1px solid #2d1f5e":s.streak>0?"1px solid #1a2a4a":"1px solid #1a3356", background:s.takenToday?"linear-gradient(145deg,#130d2a,#0e0820)":C.card.background, transition:"all 0.3s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:48,height:48,borderRadius:12,background:s.takenToday?"rgba(167,139,250,0.15)":"#080f1e",border:`1px solid ${s.takenToday?"#7c3aed":"#1a3356"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>
                            {s.takenToday?"✅":s.icon}
                          </div>
                          <div>
                            <div style={{fontSize:15,fontWeight:800}}>{s.name}</div>
                            <div style={{fontSize:12,color:"#64748b"}}>{s.dose && <span style={{color:"#a78bfa",fontWeight:600}}>{s.dose}</span>}{s.dose && s.timing && " · "}{s.timing}</div>
                          </div>
                        </div>
                        <button onClick={()=>removeSupp(s.id)} style={{background:"transparent",border:"none",color:"#334155",cursor:"pointer",fontSize:16,padding:"2px 4px",lineHeight:1}} title="Remove">×</button>
                      </div>

                      {/* Streak */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:16}}>{streakIcon}</span>
                          <span style={{fontSize:20,fontWeight:900,color:streakColor}}>{s.streak}</span>
                          <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>day streak</span>
                        </div>
                        {s.takenToday
                          ? <span style={{fontSize:12,color:"#a78bfa",fontWeight:700,background:"rgba(124,58,237,0.15)",padding:"3px 10px",borderRadius:99}}>✓ Done today</span>
                          : <button onClick={()=>takeSupp(s.id)} style={{...C.btn("#7c3aed"),fontSize:12,padding:"6px 14px"}}>Take Now ✓</button>
                        }
                      </div>

                      {/* 28-day heatmap */}
                      <div style={{marginBottom:isNew?10:0}}>
                        <div style={{fontSize:11,color:"#4a7ab5",marginBottom:6,fontWeight:600}}>28-day consistency</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
                          {[...s.history].slice(-28).map((v,i)=>(
                            <div key={i} style={{height:10,borderRadius:3,background:v?"#a78bfa":"#1e293b",opacity:v?1:0.4,transition:"background 0.3s"}}/>
                          ))}
                        </div>
                      </div>

                      {isNew&&(
                        <div style={{marginTop:10,background:"rgba(167,139,250,0.1)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:8,padding:"7px 10px",fontSize:12,color:"#a78bfa",fontWeight:700,textAlign:"center",animation:"fadeUp 0.3s ease"}}>
                          ✦ Logged! Streak updated 🎉
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Empty state */}
                {supplements.length===0&&(
                  <div style={{...C.card,gridColumn:"1/-1",textAlign:"center",padding:40}}>
                    <div style={{fontSize:40,marginBottom:12}}>🌿</div>
                    <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>No supplements yet</div>
                    <div style={{fontSize:13,color:"#64748b",marginBottom:16}}>Add your first supplement to start tracking your daily consistency.</div>
                    <button style={C.btn("#7c3aed")} onClick={()=>setShowAddSupp(true)}>+ Add Supplement</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── WELLNESS ── */}
        {tab==="wellness"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>

            {/* Disclaimer banner */}
            <div style={{background:"rgba(96,165,250,0.07)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:12,padding:"12px 18px",fontSize:12,color:"#64748b",lineHeight:1.6}}>
              💙 <strong style={{color:"#94a3b8"}}>This is a self-reflection tool, not a clinical diagnosis.</strong> Results are for personal awareness only. If you're struggling, please reach out to a mental health professional or call/text <span style={{color:"#60a5fa"}}>988</span> (Suicide & Crisis Lifeline).
            </div>

            {/* TOP ROW */}
            <div style={C.g()}>

              {/* Mood Overview */}
              <div style={{...C.card,background:"linear-gradient(145deg,#0d1429,#090f22)"}}>
                <div style={C.cTitle}>Mood Overview</div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:32}}>{moodEmoji(parseFloat(avgMood()))}</div>
                    <div style={{fontSize:24,fontWeight:900,color:moodColor(parseFloat(avgMood()))}}>{avgMood()}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>28-day avg</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:24,fontWeight:900,color:moodTrend()>0?"#4ade80":moodTrend()<0?"#f87171":"#64748b"}}>
                      {moodTrend()>0?"▲":moodTrend()<0?"▼":"—"} {Math.abs(moodTrend())||""}
                    </div>
                    <div style={{fontSize:11,color:"#64748b"}}>vs last week</div>
                    <div style={{fontSize:11,color:moodTrend()>0?"#4ade80":moodTrend()<0?"#f87171":"#64748b",fontWeight:700}}>{moodTrend()>0?"Improving":moodTrend()<0?"Declining":"Stable"}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:24,fontWeight:900,color:"#a78bfa"}}>{moodHistory.filter(d=>d.score!==null).length}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>days logged</div>
                  </div>
                </div>
                {/* Spark line */}
                <div style={{display:"flex",alignItems:"flex-end",gap:3,height:56,marginBottom:6}}>
                  {moodHistory.slice(-14).map((d,i)=>{
                    const h = d.score ? Math.round((d.score/10)*50) : 4;
                    const col = d.score ? moodColor(d.score) : "#1e293b";
                    const isToday = i === 13;
                    return(
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                        <div style={{width:"100%",height:h,borderRadius:"3px 3px 0 0",background:col,opacity:d.score?1:0.3,border:isToday?`1px solid ${col}`:"none",boxSizing:"border-box"}}/>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#475569"}}>
                  <span>14 days ago</span><span>Today</span>
                </div>
              </div>

              {/* Daily Mood Log */}
              <div style={{...C.card,background:"linear-gradient(145deg,#0d1429,#090f22)"}}>
                <div style={C.cTitle}>Today's Mood Check-in</div>
                {!moodLogged ? (
                  <div>
                    <div style={{fontSize:13,color:"#64748b",marginBottom:16}}>How are you feeling today? Tap a number.</div>
                    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
                      {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                        <button key={n} onClick={()=>setTodayMood(n)}
                          style={{width:40,height:40,borderRadius:10,background:todayMood===n?moodColor(n):"#080f1e",border:`2px solid ${todayMood===n?moodColor(n):"#1a3356"}`,color:todayMood===n?"#000":"#94a3b8",fontWeight:900,fontSize:14,cursor:"pointer",transition:"all 0.15s"}}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {todayMood&&(
                      <div style={{fontSize:22,textAlign:"center",marginBottom:12}}>{moodEmoji(todayMood)} <span style={{fontSize:14,color:moodColor(todayMood),fontWeight:700}}>{todayMood >= 8?"Feeling good!":todayMood>=5?"Doing okay":todayMood>=3?"Rough day":"Tough time"}</span></div>
                    )}
                    <textarea value={todayNote} onChange={e=>setTodayNote(e.target.value)}
                      placeholder="Optional: anything on your mind today? (just for you)"
                      style={{...C.inp,width:"100%",minHeight:72,resize:"none",fontSize:13,marginBottom:12}}/>
                    <div style={{display:"flex",gap:8}}>
                      <button style={{...C.btn("#7c3aed"),flex:1,opacity:todayMood?1:0.4}} onClick={logMood} disabled={!todayMood}>Log Mood</button>
                      <button style={{...C.ghost}} onClick={()=>setCheckInStep(1)}>Full Check-in →</button>
                    </div>
                  </div>
                ) : (
                  <div style={{textAlign:"center",padding:"10px 0"}}>
                    <div style={{fontSize:40,marginBottom:8}}>{moodEmoji(todayMood)}</div>
                    <div style={{fontSize:28,fontWeight:900,color:moodColor(todayMood)}}>{todayMood}/10</div>
                    <div style={{fontSize:13,color:"#64748b",margin:"8px 0 16px"}}>Logged today ✓</div>
                    {todayNote&&<div style={{fontSize:12,color:"#94a3b8",background:"#080f1e",borderRadius:10,padding:"8px 12px",marginBottom:16,fontStyle:"italic"}}>"{todayNote}"</div>}
                    <button style={C.ghost} onClick={()=>{setMoodLogged(false);setTodayMood(null);setTodayNote("");}}>Edit</button>
                  </div>
                )}
              </div>

              {/* Weekly patterns */}
              <div style={C.card}>
                <div style={C.cTitle}>28-Day Mood Calendar</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:8}}>
                  {["M","T","W","T","F","S","S"].map((d,i)=><div key={i} style={{fontSize:10,color:"#475569",textAlign:"center",fontWeight:700}}>{d}</div>)}
                  {moodHistory.map((d,i)=>(
                    <div key={i} title={d.score?`${d.day}: ${d.score}/10`:d.day}
                      style={{height:28,borderRadius:6,background:d.score?moodColor(d.score):"#1e293b",opacity:d.score?0.85:0.3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#000",fontWeight:d.score?800:400}}>
                      {d.score||""}
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:10,marginTop:6,flexWrap:"wrap"}}>
                  {[["#f87171","Low (1–4)"],["#f97316","Okay (5–6)"],["#facc15","Good (7–8)"],["#4ade80","Great (9–10)"]].map(([c,l])=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#64748b"}}>
                      <div style={{width:10,height:10,borderRadius:2,background:c}}/>{l}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* WEEKLY CHECK-IN MODAL FLOW */}
            {checkInStep > 0 && checkInStep < 4 && (
              <div style={C.overlay} onClick={()=>{}}>
                <div style={{...C.mbox,width:480,maxHeight:"90vh",overflowY:"auto"}}>
                  {/* Progress */}
                  <div style={{display:"flex",gap:6,marginBottom:20}}>
                    {[1,2,3].map(s=>(
                      <div key={s} style={{flex:1,height:4,borderRadius:99,background:checkInStep>=s?"#a78bfa":"#1e293b",transition:"background 0.3s"}}/>
                    ))}
                  </div>

                  {checkInStep===1&&(
                    <div>
                      <div style={{fontSize:20,marginBottom:6}}>😊</div>
                      <div style={{fontSize:17,fontWeight:800,marginBottom:4}}>How are you feeling?</div>
                      <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Step 1 of 3 — Mood & note</div>
                      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                          <button key={n} onClick={()=>setTodayMood(n)}
                            style={{width:42,height:42,borderRadius:10,background:todayMood===n?moodColor(n):"#080f1e",border:`2px solid ${todayMood===n?moodColor(n):"#1a3356"}`,color:todayMood===n?"#000":"#94a3b8",fontWeight:900,fontSize:15,cursor:"pointer"}}>
                            {n}
                          </button>
                        ))}
                      </div>
                      <textarea value={todayNote} onChange={e=>setTodayNote(e.target.value)}
                        placeholder="Anything on your mind? (optional, private)"
                        style={{...C.inp,width:"100%",minHeight:80,resize:"none",fontSize:13,marginBottom:16}}/>
                      <div style={{display:"flex",gap:8}}>
                        <button style={{...C.btn("#7c3aed"),flex:1,opacity:todayMood?1:0.4}} onClick={()=>{if(todayMood){logMood();setCheckInStep(2);}}} disabled={!todayMood}>Next →</button>
                        <button style={C.ghost} onClick={()=>setCheckInStep(0)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {checkInStep===2&&(
                    <div>
                      <div style={{fontSize:20,marginBottom:6}}>💭</div>
                      <div style={{fontSize:17,fontWeight:800,marginBottom:4}}>Low mood screen</div>
                      <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Step 2 of 3 — PHQ-2 (2 quick questions)</div>
                      {PHQ2.map((q,qi)=>(
                        <div key={qi} style={{marginBottom:18}}>
                          <div style={{fontSize:13,fontWeight:600,marginBottom:10,lineHeight:1.5}}>{q}</div>
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {PHQ_OPTS.map((opt,oi)=>(
                              <button key={oi} onClick={()=>{const a=[...phqAnswers];a[qi]=oi;setPhqAnswers(a);}}
                                style={{textAlign:"left",background:phqAnswers[qi]===oi?"rgba(124,58,237,0.2)":"#080f1e",border:`1px solid ${phqAnswers[qi]===oi?"#7c3aed":"#1a3356"}`,borderRadius:8,padding:"8px 12px",color:phqAnswers[qi]===oi?"#a78bfa":"#94a3b8",fontSize:13,cursor:"pointer",fontWeight:phqAnswers[qi]===oi?700:400}}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div style={{display:"flex",gap:8,marginTop:4}}>
                        <button style={{...C.btn("#7c3aed"),flex:1,opacity:phqAnswers.every(a=>a!==null)?1:0.4}} onClick={()=>{if(phqAnswers.every(a=>a!==null))setCheckInStep(3);}} disabled={!phqAnswers.every(a=>a!==null)}>Next →</button>
                        <button style={C.ghost} onClick={()=>setCheckInStep(1)}>← Back</button>
                      </div>
                    </div>
                  )}

                  {checkInStep===3&&(
                    <div>
                      <div style={{fontSize:20,marginBottom:6}}>🫁</div>
                      <div style={{fontSize:17,fontWeight:800,marginBottom:4}}>Anxiety screen</div>
                      <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Step 3 of 3 — GAD-2 (2 quick questions)</div>
                      {GAD2.map((q,qi)=>(
                        <div key={qi} style={{marginBottom:18}}>
                          <div style={{fontSize:13,fontWeight:600,marginBottom:10,lineHeight:1.5}}>{q}</div>
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {PHQ_OPTS.map((opt,oi)=>(
                              <button key={oi} onClick={()=>{const a=[...gadAnswers];a[qi]=oi;setGadAnswers(a);}}
                                style={{textAlign:"left",background:gadAnswers[qi]===oi?"rgba(124,58,237,0.2)":"#080f1e",border:`1px solid ${gadAnswers[qi]===oi?"#7c3aed":"#1a3356"}`,borderRadius:8,padding:"8px 12px",color:gadAnswers[qi]===oi?"#a78bfa":"#94a3b8",fontSize:13,cursor:"pointer",fontWeight:gadAnswers[qi]===oi?700:400}}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div style={{display:"flex",gap:8,marginTop:4}}>
                        <button style={{...C.btn("#7c3aed"),flex:1,opacity:gadAnswers.every(a=>a!==null)?1:0.4}} onClick={()=>{if(gadAnswers.every(a=>a!==null))finishCheckIn();}} disabled={!gadAnswers.every(a=>a!==null)}>See Results →</button>
                        <button style={C.ghost} onClick={()=>setCheckInStep(2)}>← Back</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CHECK-IN RESULTS */}
            {checkInStep===4&&checkInResults&&(
              <div style={C.overlay}>
                <div style={{...C.mbox,width:500,maxHeight:"90vh",overflowY:"auto"}}>
                  <div style={{fontSize:24,marginBottom:8}}>✦</div>
                  <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Check-in Complete</div>
                  <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Here's a gentle summary of how you're doing.</div>

                  <div style={C.g("1fr 1fr")}>
                    {[
                      {label:"Mood Today",val:`${checkInResults.mood}/10`,sub:checkInResults.mood>=7?"Feeling good":"Could be better",color:moodColor(checkInResults.mood)},
                      {label:"Depression Screen",val:`${checkInResults.phqTotal}/6`,sub:checkInResults.phqRisk==="low"?"Low indicators":checkInResults.phqRisk==="mild"?"Mild indicators":"Elevated — consider support",color:checkInResults.phqRisk==="low"?"#4ade80":checkInResults.phqRisk==="mild"?"#facc15":"#f87171"},
                      {label:"Anxiety Screen",val:`${checkInResults.gadTotal}/6`,sub:checkInResults.gadRisk==="low"?"Low indicators":checkInResults.gadRisk==="mild"?"Mild indicators":"Elevated — consider support",color:checkInResults.gadRisk==="low"?"#4ade80":checkInResults.gadRisk==="mild"?"#facc15":"#f87171"},
                      {label:"Logged Streak",val:`${moodHistory.filter(d=>d.score!==null).length} days`,sub:"Keep checking in",color:"#a78bfa"},
                    ].map(r=>(
                      <div key={r.label} style={{background:"#080f1e",borderRadius:12,padding:"14px 16px",textAlign:"center"}}>
                        <div style={{fontSize:22,fontWeight:900,color:r.color}}>{r.val}</div>
                        <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",marginBottom:2}}>{r.label}</div>
                        <div style={{fontSize:11,color:r.color}}>{r.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* AI Response */}
                  <div style={{marginTop:16,background:"linear-gradient(135deg,#0d1429,#090f22)",border:"1px solid #2d1f5e",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:11,color:"#a78bfa",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>✦ LifeSync AI Response</div>
                    {wellnessAiLoading
                      ? <div style={{fontSize:13,color:"#4a7ab5"}}>Thinking of something kind to say...</div>
                      : <div style={{fontSize:13,lineHeight:1.7,color:"#e2e8f0"}}>{wellnessMsg}</div>
                    }
                  </div>

                  {(checkInResults.phqRisk==="elevated"||checkInResults.gadRisk==="elevated")&&(
                    <div style={{marginTop:12,background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#fca5a5",lineHeight:1.6}}>
                      🆘 Your responses suggest you may be struggling. You're not alone. Please consider talking to someone — call or text <strong>988</strong> (free, 24/7), or reach out to a therapist or trusted person.
                    </div>
                  )}

                  <button style={{...C.btn("#7c3aed"),width:"100%",marginTop:16}} onClick={resetCheckIn}>Done</button>
                </div>
              </div>
            )}

            {/* INSIGHTS + RESOURCES ROW */}
            <div style={C.g()}>
              <div style={C.card}>
                <div style={C.cTitle}>Patterns & Insights</div>
                {[
                  {icon:"📈",text:"Your mood improved by +1.2 pts over the last 7 days compared to the week before.",color:"#4ade80"},
                  {icon:"🏋️",text:"On days you go to the gym, your average mood is 7.4 vs 5.8 on non-gym days.",color:"#60a5fa"},
                  {icon:"😴",text:"Your mood dips slightly mid-week (Wed avg: 5.9). Consider a rest day or lighter schedule.",color:"#facc15"},
                  {icon:"💳",text:"Financial stress from high debt may be contributing to lower wellbeing scores.",color:"#f97316"},
                ].map((ins,i)=>(
                  <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid #0f2240",alignItems:"flex-start"}}>
                    <span style={{fontSize:18,marginTop:1}}>{ins.icon}</span>
                    <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.5}}>{ins.text}</div>
                  </div>
                ))}
              </div>

              <div style={C.card}>
                <div style={C.cTitle}>Weekly Check-in</div>
                <div style={{fontSize:13,color:"#64748b",marginBottom:16,lineHeight:1.6}}>Takes 2 minutes. Includes a mood log, a 2-question depression screen (PHQ-2), and a 2-question anxiety screen (GAD-2). Results are private and never shared.</div>
                <button style={{...C.btn("#7c3aed"),width:"100%",marginBottom:10}} onClick={()=>setCheckInStep(1)}>Start Weekly Check-in →</button>
                <div style={{fontSize:11,color:"#4a7ab5",lineHeight:1.6}}>Based on validated clinical screening tools. Not a diagnosis — for self-awareness only.</div>
              </div>

              <div style={C.card}>
                <div style={C.cTitle}>Mental Health Resources</div>
                {[
                  {name:"988 Suicide & Crisis Lifeline",desc:"Call or text 988 — free, 24/7",color:"#f87171",urgent:true},
                  {name:"Crisis Text Line",desc:"Text HOME to 741741",color:"#f97316",urgent:true},
                  {name:"NAMI Helpline",desc:"1-800-950-NAMI (6264)",color:"#facc15",urgent:false},
                  {name:"BetterHelp / Talkspace",desc:"Online therapy, affordable plans",color:"#4ade80",urgent:false},
                  {name:"Headspace / Calm",desc:"Guided meditation & sleep tools",color:"#60a5fa",urgent:false},
                  {name:"Talk to LifeSync AI",desc:"Available anytime in the AI tab",color:"#a78bfa",urgent:false},
                ].map(r=>(
                  <div key={r.name} style={C.row}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:r.urgent?"#fca5a5":"#e2e8f0"}}>{r.name}</div>
                      <div style={{fontSize:11,color:"#64748b"}}>{r.desc}</div>
                    </div>
                    {r.urgent&&<span style={{fontSize:10,background:"rgba(248,113,113,0.15)",color:"#f87171",padding:"2px 8px",borderRadius:99,fontWeight:700,border:"1px solid rgba(248,113,113,0.3)"}}>24/7</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── AI CHAT ── */}
        {tab==="ai"&&(
          <div style={{maxWidth:720,margin:"0 auto"}}>
            <div style={C.card}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#4ade80)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>✦</div>
                <div><div style={{fontWeight:800,fontSize:16}}>LifeSync AI</div><div style={{fontSize:12,color:"#4ade80"}}>● Online · Powered by Claude · Knows your full profile</div></div>
              </div>
              <div ref={chatRef} style={{height:360,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingRight:4}}>
                {msgs.map((m,i)=><div key={i} style={C.bub(m.role)}>{m.text}</div>)}
                {aiLoading&&<div style={{...C.bub("assistant"),color:"#4a7ab5"}}>Thinking...</div>}
              </div>
              <div style={{display:"flex",gap:10,marginTop:14}}>
                <input style={{...C.inp,flex:1}} value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Ask about habits, finances, health..."/>
                <button style={C.btn()} onClick={sendMsg} disabled={aiLoading}>{aiLoading?"...":"Send"}</button>
              </div>
              <div style={{marginTop:14}}>
                <div style={{fontSize:11,color:"#4a7ab5",marginBottom:8,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Quick Prompts</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {["How do I grow my Life Score faster?","Help me keep my gym streak going","How do I qualify for the tax credit?","What habits should I add next?"].map(q=>(
                    <button key={q} onClick={()=>setAiInput(q)} style={{background:"#080f1e",border:"1px solid #1a3356",color:"#94a3b8",borderRadius:20,padding:"6px 12px",fontSize:12,cursor:"pointer"}}>{q}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── LOG MODAL ── */}
      {logModal&&(()=>{
        const t=tmpl(logModal), h=hdata(logModal);
        return(
          <div style={C.overlay} onClick={()=>setLogModal(null)}>
            <div style={C.mbox} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:36,marginBottom:8}}>{t.icon}</div>
              <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>{t.label}</div>
              <div style={{fontSize:13,color:"#64748b",marginBottom:6}}>Current streak: <span style={{color:"#facc15",fontWeight:800}}>{h.streak} 🔥</span></div>
              <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Progress: <span style={{color:"#e2e8f0",fontWeight:700}}>{h.weekCount}/{t.target} {t.unit}</span></div>
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,color:"#4a7ab5",fontWeight:700,marginBottom:10}}>How many times?</div>
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <button onClick={()=>setLogVal(v=>Math.max(1,v-1))} style={{...C.ghost,fontSize:22,padding:"4px 16px"}}>−</button>
                  <span style={{fontSize:32,fontWeight:900,minWidth:48,textAlign:"center"}}>{logVal}</span>
                  <button onClick={()=>setLogVal(v=>v+1)} style={{...C.ghost,fontSize:22,padding:"4px 16px"}}>+</button>
                </div>
              </div>
              <div style={{display:"flex",gap:10}}>
                <button style={{...C.btn("#059669"),flex:1}} onClick={()=>logHabit(logModal,logVal)}>✓ Log &amp; Update Score</button>
                <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setLogModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── ADD HABIT MODAL ── */}
      {showAdd&&(
        <div style={C.overlay} onClick={()=>setShowAdd(false)}>
          <div style={{...C.mbox,width:460}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:800,marginBottom:16}}>Add a Habit</div>
            <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:380,overflowY:"auto"}}>
              {HABIT_TEMPLATES.filter(t=>!habits.find(h=>h.id===t.id)).map(t=>(
                <button key={t.id} onClick={()=>addHabit(t.id)} style={{background:"#080f1e",border:"1px solid #1a3356",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",color:"#e2e8f0",textAlign:"left"}}>
                  <span style={{fontSize:24}}>{t.icon}</span>
                  <div><div style={{fontSize:14,fontWeight:700}}>{t.label}</div><div style={{fontSize:11,color:"#64748b"}}>Target: {t.target} {t.unit} · +{t.scorePerStreak} pts/streak</div></div>
                </button>
              ))}
              {HABIT_TEMPLATES.filter(t=>!habits.find(h=>h.id===t.id)).length===0&&(
                <div style={{fontSize:14,color:"#64748b",textAlign:"center",padding:20}}>You're tracking all available habits! 🎉</div>
              )}
            </div>
            <button style={{...C.ghost,marginTop:16,width:"100%",padding:"10px"}} onClick={()=>setShowAdd(false)}>Close</button>
          </div>
        </div>
      )}

      {/* ── UPDATE SCORE MODAL ── */}
      {showUpdateScore&&(
        <div style={C.overlay} onClick={()=>setShowUpdateScore(false)}>
          <div style={{...C.mbox,width:400}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:28,marginBottom:8}}>💳</div>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Update Your Credit Score</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:6,lineHeight:1.6}}>Check your score for free on <span style={{color:"#60a5fa"}}>Credit Karma</span>, <span style={{color:"#60a5fa"}}>Experian</span>, or your bank app, then enter it below.</div>
            <div style={{fontSize:12,color:"#4a7ab5",marginBottom:20}}>Current score: <span style={{fontWeight:800,color:scColor(creditScore)}}>{creditScore}</span></div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,color:"#4a7ab5",fontWeight:700,marginBottom:8}}>Your new score (300–850)</div>
              <input
                type="number" min="300" max="850"
                value={newScoreInput}
                onChange={e=>setNewScoreInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&submitNewScore()}
                placeholder="e.g. 705"
                style={{...C.inp,width:"100%",fontSize:24,fontWeight:800,textAlign:"center",padding:"14px"}}
                autoFocus/>
              {newScoreInput&&(parseInt(newScoreInput)<300||parseInt(newScoreInput)>850)&&(
                <div style={{fontSize:12,color:"#f87171",marginTop:6}}>Score must be between 300 and 850.</div>
              )}
              {newScoreInput&&parseInt(newScoreInput)>=300&&parseInt(newScoreInput)<=850&&(
                <div style={{fontSize:13,marginTop:8,textAlign:"center",fontWeight:700,color:scColor(parseInt(newScoreInput))}}>
                  {parseInt(newScoreInput)} — {scLabel(parseInt(newScoreInput))}
                  {parseInt(newScoreInput)>creditScore&&<span style={{color:"#4ade80"}}> ▲ +{parseInt(newScoreInput)-creditScore} pts</span>}
                  {parseInt(newScoreInput)<creditScore&&<span style={{color:"#f87171"}}> ▼ {parseInt(newScoreInput)-creditScore} pts</span>}
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#0ea5e9"),flex:1}} onClick={submitNewScore} disabled={!newScoreInput||parseInt(newScoreInput)<300||parseInt(newScoreInput)>850}>Save Score</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowUpdateScore(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT FINANCES MODAL ── */}
      {showEditFinances&&(
        <div style={C.overlay} onClick={()=>setShowEditFinances(false)}>
          <div style={{...C.mbox,width:420}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>💰 Your Finances</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:18}}>Enter your monthly numbers. Only you can see these.</div>
            {[["Monthly Income","income","$4,200"],["Monthly Expenses","expenses","$3,100"],["Total Savings","savings","$2,000"]].map(([label,key,ph])=>(
              <div key={key} style={{marginBottom:14}}>
                <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:6}}>{label}</div>
                <input value={financeForm[key]} onChange={e=>setFinanceForm(p=>({...p,[key]:e.target.value}))}
                  placeholder={ph} style={{...C.inp,width:"100%"}} type="number"/>
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button style={{...C.btn("#6366f1"),flex:1}} onClick={async()=>{await saveFinances(financeForm.income,financeForm.expenses,financeForm.savings);setShowEditFinances(false);}}>Save →</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowEditFinances(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD DEBT MODAL ── */}
      {showAddDebt&&(
        <div style={C.overlay} onClick={()=>setShowAddDebt(false)}>
          <div style={{...C.mbox,width:420}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>💳 Add a Debt</div>
            {[["Name","name","Credit Card, Student Loan..."],["Balance ($)","balance","5000"],["Monthly Payment ($)","monthly_payment","150"],["APR (%)","apr","19.9%"]].map(([label,key,ph])=>(
              <div key={key} style={{marginBottom:12}}>
                <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:6}}>{label}</div>
                <input value={newDebt[key]} onChange={e=>setNewDebt(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}}/>
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button style={{...C.btn("#6366f1"),flex:1}} onClick={addDebt}>Add Debt</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowAddDebt(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD BILL MODAL ── */}
      {showAddBill&&(
        <div style={C.overlay} onClick={()=>setShowAddBill(false)}>
          <div style={{...C.mbox,width:420}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>🗓️ Add a Bill</div>
            {[["Name","name","Rent, Electric..."],["Amount ($)","amount","1200"],["Due Day of Month","due_day","1"]].map(([label,key,ph])=>(
              <div key={key} style={{marginBottom:12}}>
                <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:6}}>{label}</div>
                <input value={newBill[key]} onChange={e=>setNewBill(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}}/>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:6}}>Status</div>
              <div style={{display:"flex",gap:6}}>
                {["upcoming","paid","overdue"].map(s=>(
                  <button key={s} onClick={()=>setNewBill(p=>({...p,status:s}))} style={{flex:1,background:newBill.status===s?"rgba(129,140,248,0.2)":"#0b0d18",border:`1px solid ${newBill.status===s?"#818cf8":"#1e2240"}`,color:newBill.status===s?"#818cf8":"#64748b",borderRadius:8,padding:"7px",cursor:"pointer",fontSize:12,fontWeight:700,textTransform:"capitalize"}}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button style={{...C.btn("#6366f1"),flex:1}} onClick={addBill}>Add Bill</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowAddBill(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD MEDICATION MODAL ── */}
      {showAddMed&&(
        <div style={C.overlay} onClick={()=>setShowAddMed(false)}>
          <div style={{...C.mbox,width:420}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>💊 Add a Medication</div>
            {[["Name","name","Lisinopril, Metformin..."],["Dose","dose","10mg, 500mg..."]].map(([label,key,ph])=>(
              <div key={key} style={{marginBottom:12}}>
                <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:6}}>{label}</div>
                <input value={newMed[key]} onChange={e=>setNewMed(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}}/>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:6}}>Schedule</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["Daily","Twice daily","Weekly","As needed"].map(s=>(
                  <button key={s} onClick={()=>setNewMed(p=>({...p,schedule:s}))} style={{background:newMed.schedule===s?"rgba(129,140,248,0.2)":"#0b0d18",border:`1px solid ${newMed.schedule===s?"#818cf8":"#1e2240"}`,color:newMed.schedule===s?"#818cf8":"#64748b",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:6}}>Days until refill</div>
              <input value={newMed.refill_days} onChange={e=>setNewMed(p=>({...p,refill_days:e.target.value}))} placeholder="30" style={{...C.inp,width:"100%"}} type="number"/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#6366f1"),flex:1}} onClick={addMed}>Add Medication</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowAddMed(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD CHECKUP MODAL ── */}
      {showAddCheckup&&(
        <div style={C.overlay} onClick={()=>setShowAddCheckup(false)}>
          <div style={{...C.mbox,width:420}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>🩺 Add a Health Checkup</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:6}}>Checkup Name</div>
              <input value={newCheckup.name} onChange={e=>setNewCheckup(p=>({...p,name:e.target.value}))} placeholder="Annual Physical, Dental Cleaning..." style={{...C.inp,width:"100%"}}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:6}}>When was your last one?</div>
              <input value={newCheckup.last_date} onChange={e=>setNewCheckup(p=>({...p,last_date:e.target.value}))} placeholder="e.g. 6 months ago, Jan 2024..." style={{...C.inp,width:"100%"}}/>
            </div>
            <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <div onClick={()=>setNewCheckup(p=>({...p,urgent:!p.urgent}))} style={{width:40,height:22,borderRadius:99,background:newCheckup.urgent?"#dc2626":"#181b2e",position:"relative",cursor:"pointer",transition:"background 0.2s"}}>
                <div style={{position:"absolute",top:3,left:newCheckup.urgent?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </div>
              <span style={{fontSize:13,color:newCheckup.urgent?"#fb7185":"#64748b"}}>Mark as overdue</span>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#6366f1"),flex:1}} onClick={addCheckup}>Add Checkup</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowAddCheckup(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD SUPPLEMENT MODAL ── */}
      {showAddSupp&&(
        <div style={C.overlay} onClick={()=>setShowAddSupp(false)}>
          <div style={{...C.mbox,width:420}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>🌿 Add a Supplement</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:18}}>Track any vitamin, mineral, herb, or nootropic.</div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:"#4a7ab5",fontWeight:700,marginBottom:8}}>Choose an icon</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {SUPP_ICONS.map(ic=>(
                  <button key={ic} onClick={()=>setNewSupp(p=>({...p,icon:ic}))}
                    style={{width:36,height:36,borderRadius:10,background:newSupp.icon===ic?"rgba(124,58,237,0.3)":"#080f1e",border:`2px solid ${newSupp.icon===ic?"#7c3aed":"#1a3356"}`,fontSize:18,cursor:"pointer"}}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#4a7ab5",fontWeight:700,marginBottom:6}}>Supplement name *</div>
              <input value={newSupp.name} onChange={e=>setNewSupp(p=>({...p,name:e.target.value}))}
                placeholder="e.g. Vitamin C, Lion's Mane, Ashwagandha..."
                style={{...C.inp,width:"100%"}}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#4a7ab5",fontWeight:700,marginBottom:6}}>Dose (optional)</div>
              <input value={newSupp.dose} onChange={e=>setNewSupp(p=>({...p,dose:e.target.value}))}
                placeholder="e.g. 500mg, 1 capsule..."
                style={{...C.inp,width:"100%"}}/>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,color:"#4a7ab5",fontWeight:700,marginBottom:6}}>When do you take it?</div>
              <div style={{display:"flex",gap:6}}>
                {["Morning","Afternoon","Evening","With meals"].map(t=>(
                  <button key={t} onClick={()=>setNewSupp(p=>({...p,timing:t}))}
                    style={{flex:1,background:newSupp.timing===t?"rgba(124,58,237,0.2)":"#080f1e",border:`1px solid ${newSupp.timing===t?"#7c3aed":"#1a3356"}`,color:newSupp.timing===t?"#a78bfa":"#64748b",borderRadius:8,padding:"7px 2px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#7c3aed"),flex:1,opacity:newSupp.name.trim()?1:0.5}} onClick={addSupp} disabled={!newSupp.name.trim()}>+ Add Supplement</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowAddSupp(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
