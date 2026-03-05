import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "./supabase";

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
function calcLifeScoreBreakdown(habits, finances = {}) {
  const { totalDebt = 0, income = 0, savings = 0, overdueCheckups = 0, lowRefillMeds = 0 } = finances;

  // ── FINANCIAL HEALTH (max 25 pts) ──
  const annualIncome = income * 12;
  const dtiRatio = annualIncome > 0 ? totalDebt / annualIncome : 0;
  const debtPenalty = dtiRatio > 0.5 ? -12 : dtiRatio > 0.3 ? -6 : dtiRatio > 0 ? -2 : 0;
  const savingsBonus = savings > 10000 ? 6 : savings > 3000 ? 4 : savings > 500 ? 2 : 0;
  const paymentHabits = habits.filter(h => h.id === "cardpay" || h.id === "savings");
  const paymentBonus = Math.min(8, paymentHabits.reduce((a, h) => a + Math.min(h.streak * 1.5, 6), 0));
  const financeScore = Math.max(0, Math.min(25, 16 + debtPenalty + savingsBonus + paymentBonus));

  // ── HEALTH (max 25 pts) ──
  const checkupPenalty = Math.max(-12, overdueCheckups * -4);
  const medPenalty = lowRefillMeds > 0 ? -2 : 0;
  const healthHabits = habits.filter(h => HABIT_TEMPLATES.find(x => x.id === h.id)?.category === "health");
  const habitBonus = Math.min(10, healthHabits.reduce((acc, h) => {
    const t = HABIT_TEMPLATES.find(x => x.id === h.id);
    return acc + Math.min(h.streak * (t?.scorePerStreak || 1), 6);
  }, 0));
  const healthScore = Math.max(0, Math.min(25, 20 + checkupPenalty + medPenalty + habitBonus));

  // ── HABITS & DISCIPLINE (max 25 pts) ──
  const allHabitBonus = habits.reduce((acc, h) => {
    const t = HABIT_TEMPLATES.find(x => x.id === h.id);
    if (!t) return acc;
    return acc + Math.min(h.streak * t.scorePerStreak * 0.4, 4);
  }, 0);
  const disciplineScore = Math.max(0, Math.min(25, Math.round(allHabitBonus)));

  // ── WELLBEING (max 25 pts) ──
  const wellnessHabits = habits.filter(h => HABIT_TEMPLATES.find(x => x.id === h.id)?.category === "wellness");
  const wellnessBonus = Math.min(10, wellnessHabits.reduce((acc, h) => {
    const t = HABIT_TEMPLATES.find(x => x.id === h.id);
    return acc + Math.min(h.streak * (t?.scorePerStreak || 1), 5);
  }, 0));
  const stressPenalty = dtiRatio > 0.5 ? -5 : dtiRatio > 0.3 ? -2 : 0;
  const wellbeingScore = Math.max(0, Math.min(25, 14 + wellnessBonus + stressPenalty));

  const total = Math.min(100, financeScore + healthScore + disciplineScore + wellbeingScore);

  return {
    total: Math.round(total),
    pillars: [
      { label: "Financial Health", score: financeScore, max: 25, color: "#818cf8",
        detail: debtPenalty < 0 ? "Debt load pulling score down" : savings > 0 ? "Finances on track" : "Add your financial info",
        factors: [
          { text: totalDebt > 0 ? `Debt load ($${totalDebt.toLocaleString()})` : "No debt", pts: debtPenalty, bad: debtPenalty < 0 },
          { text: "Savings cushion", pts: savingsBonus, bad: false },
          { text: "Payment habits", pts: Math.round(paymentBonus), bad: false },
        ]
      },
      { label: "Health", score: healthScore, max: 25, color: "#fb7185",
        detail: overdueCheckups > 0 ? `${overdueCheckups} overdue checkup${overdueCheckups>1?"s":""}` : "Health tracking looks good",
        factors: [
          { text: overdueCheckups > 0 ? `${overdueCheckups} overdue checkup${overdueCheckups>1?"s":""}` : "No overdue checkups", pts: checkupPenalty, bad: overdueCheckups > 0 },
          { text: lowRefillMeds > 0 ? "Medication refill due soon" : "Medications on track", pts: medPenalty, bad: lowRefillMeds > 0 },
          { text: "Health habits", pts: habitBonus, bad: false },
        ]
      },
      { label: "Habits & Discipline", score: disciplineScore, max: 25, color: "#fbbf24",
        detail: disciplineScore >= 15 ? "Strong consistency" : disciplineScore > 0 ? "Build more streaks" : "Start tracking habits",
        factors: habits.slice(0,4).map(h => {
          const t = HABIT_TEMPLATES.find(x => x.id === h.id);
          const pts = Math.min(h.streak * (t?.scorePerStreak||1) * 0.4, 4);
          return { text: `${t?.label||h.id} (${h.streak} streak)`, pts: Math.round(pts), bad: false };
        })
      },
      { label: "Wellbeing", score: wellbeingScore, max: 25, color: "#c084fc",
        detail: stressPenalty < -2 ? "Financial stress impacting wellbeing" : "Wellbeing looks good",
        factors: [
          { text: stressPenalty < 0 ? "Financial stress" : "Low financial stress", pts: stressPenalty, bad: stressPenalty < 0 },
          { text: "Wellness habits", pts: wellnessBonus, bad: false },
        ]
      },
    ]
  };
}

function calcLifeScore(habits, finances) {
  return calcLifeScoreBreakdown(habits, finances).total;
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
      <span style={{fontSize:18,fontWeight:900,color:color}}>{streak}</span>
      <span style={{fontSize:10,color:"#64748b",fontWeight:600}}>streak</span>
    </div>
  );
};

// ── DEMO PROFILES (outside component to avoid hook order issues) ─────────────
const DEMO_PROFILES = [
  {
    username: "jordan_m",
    creditScore: 694, creditHistory: [
      {month:"Sep",score:651},{month:"Oct",score:658},{month:"Nov",score:663},
      {month:"Dec",score:670},{month:"Jan",score:680},{month:"Feb",score:694},
    ],
    monthlyIncome: 5200, monthlyExpenses: 3800, savings: 4100,
    habits: [
      { id:"gym",     streak:8,  weekCount:4, history:[1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,0,1], active:true },
      { id:"water",   streak:12, weekCount:7, history:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1], active:true },
      { id:"budget",  streak:5,  weekCount:3, history:[0,0,1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,0], active:true },
      { id:"cardpay", streak:9,  weekCount:1, history:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], active:true },
      { id:"meditate",streak:3,  weekCount:3, history:[0,0,0,1,1,0,1,0,0,1,1,0,1,0,0,1,0,1,0,0,1,0,0,1,1,0,0,1], active:true },
    ],
    debts: [
      {id:"d1",name:"Credit Card",balance:1800,monthly_payment:90,apr:"21.9%"},
      {id:"d2",name:"Student Loan",balance:22000,monthly_payment:240,apr:"5.8%"},
    ],
    bills: [
      {id:"b1",name:"Rent",amount:1400,due_day:1,status:"paid"},
      {id:"b2",name:"Car Insurance",amount:142,due_day:5,status:"upcoming"},
      {id:"b3",name:"Phone",amount:85,due_day:14,status:"upcoming"},
      {id:"b4",name:"Streaming",amount:47,due_day:22,status:"upcoming"},
    ],
    medications: [
      {id:"m1",name:"Adderall XR 20mg",dose:"20mg",schedule:"Daily",refill_days:18},
      {id:"m2",name:"Vitamin D3",dose:"2000 IU",schedule:"Daily",refill_days:45},
    ],
    supplements: [
      {id:"s1",name:"Creatine",dose:"5g",timing:"Morning",icon:"⚡",streak:14,takenToday:false,history:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1]},
      {id:"s2",name:"Omega-3",dose:"1000mg",timing:"With meals",icon:"🫚",streak:6,takenToday:false,history:[0,0,0,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,0,1]},
      {id:"s3",name:"Magnesium",dose:"400mg",timing:"Evening",icon:"🌿",streak:3,takenToday:false,history:[0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,1,1,0,0,1,0,0,1,1,0,0,1,1]},
    ],
    moodHistory: [
      {day:"Mon",score:7},{day:"Tue",score:6},{day:"Wed",score:8},{day:"Thu",score:7},
      {day:"Fri",score:9},{day:"Sat",score:8},{day:"Sun",score:7},
      {day:"Mon",score:6},{day:"Tue",score:7},{day:"Wed",score:8},{day:"Thu",score:6},
      {day:"Fri",score:9},{day:"Sat",score:9},{day:"Sun",score:8},
      {day:"Mon",score:7},{day:"Tue",score:8},{day:"Wed",score:7},{day:"Thu",score:8},
      {day:"Fri",score:9},{day:"Sat",score:8},{day:"Sun",score:7},
      {day:"Mon",score:6},{day:"Tue",score:7},{day:"Wed",score:8},{day:"Thu",score:7},
      {day:"Fri",score:8},{day:"Sat",score:null},
    ],
  },
  {
    username: "sam_r",
    creditScore: 731, creditHistory: [
      {month:"Sep",score:695},{month:"Oct",score:703},{month:"Nov",score:710},
      {month:"Dec",score:715},{month:"Jan",score:724},{month:"Feb",score:731},
    ],
    monthlyIncome: 7500, monthlyExpenses: 4900, savings: 11200,
    habits: [
      { id:"sleep",   streak:15, weekCount:6, history:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1], active:true },
      { id:"savings", streak:7,  weekCount:3, history:[0,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0], active:true },
      { id:"cardpay", streak:14, weekCount:1, history:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], active:true },
      { id:"veggies", streak:4,  weekCount:5, history:[1,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,1,1,0,1,0,1,1,1,0,1], active:true },
      { id:"meditate",streak:10, weekCount:5, history:[1,1,0,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1], active:true },
    ],
    debts: [
      {id:"d1",name:"Mortgage",balance:284000,monthly_payment:1650,apr:"6.8%"},
      {id:"d2",name:"Car Loan",balance:11400,monthly_payment:320,apr:"4.9%"},
    ],
    bills: [
      {id:"b1",name:"Mortgage",amount:1650,due_day:1,status:"paid"},
      {id:"b2",name:"Utilities",amount:195,due_day:8,status:"upcoming"},
      {id:"b3",name:"Gym",amount:55,due_day:10,status:"paid"},
      {id:"b4",name:"Subscriptions",amount:82,due_day:18,status:"upcoming"},
      {id:"b5",name:"Life Insurance",amount:120,due_day:25,status:"upcoming"},
    ],
    medications: [],
    supplements: [
      {id:"s1",name:"Ashwagandha",dose:"600mg",timing:"Evening",icon:"🌿",streak:21,takenToday:false,history:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1]},
      {id:"s2",name:"Lion's Mane",dose:"500mg",timing:"Morning",icon:"🍄",streak:9,takenToday:false,history:[1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,0,1,1,1,1,1]},
      {id:"s3",name:"Vitamin C",dose:"1000mg",timing:"Morning",icon:"🍋",streak:5,takenToday:false,history:[0,0,1,1,1,0,0,1,1,1,0,0,1,1,0,1,1,1,0,0,1,0,1,1,1,0,0,1]},
    ],
    moodHistory: [
      {day:"Mon",score:8},{day:"Tue",score:7},{day:"Wed",score:8},{day:"Thu",score:9},
      {day:"Fri",score:8},{day:"Sat",score:9},{day:"Sun",score:9},
      {day:"Mon",score:7},{day:"Tue",score:8},{day:"Wed",score:8},{day:"Thu",score:9},
      {day:"Fri",score:9},{day:"Sat",score:10},{day:"Sun",score:8},
      {day:"Mon",score:8},{day:"Tue",score:7},{day:"Wed",score:9},{day:"Thu",score:8},
      {day:"Fri",score:9},{day:"Sat",score:8},{day:"Sun",score:9},
      {day:"Mon",score:7},{day:"Tue",score:8},{day:"Wed",score:8},{day:"Thu",score:9},
      {day:"Fri",score:9},{day:"Sat",score:8},{day:"Sun",score:null},
    ],
  },
  {
    username: "alex_k",
    creditScore: 612, creditHistory: [
      {month:"Sep",score:588},{month:"Oct",score:590},{month:"Nov",score:597},
      {month:"Dec",score:601},{month:"Jan",score:607},{month:"Feb",score:612},
    ],
    monthlyIncome: 3800, monthlyExpenses: 3200, savings: 850,
    habits: [
      { id:"gym",     streak:2,  weekCount:2, history:[0,0,1,0,0,1,1,0,0,0,1,1,0,0,1,0,0,1,1,0,0,1,0,0,1,1,0,0], active:true },
      { id:"cardpay", streak:3,  weekCount:1, history:[1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], active:true },
      { id:"water",   streak:1,  weekCount:4, history:[0,1,1,0,0,1,0,1,0,0,1,0,0,1,1,0,0,0,1,1,0,0,1,0,0,0,1,1], active:true },
      { id:"nosmoke", streak:0,  weekCount:3, history:[1,1,0,1,0,1,1,0,0,1,1,0,1,0,0,1,1,0,1,0,0,0,1,1,0,0,1,0], active:true },
    ],
    debts: [
      {id:"d1",name:"Credit Card 1",balance:3200,monthly_payment:95,apr:"24.9%"},
      {id:"d2",name:"Credit Card 2",balance:1100,monthly_payment:45,apr:"22.4%"},
      {id:"d3",name:"Personal Loan",balance:6500,monthly_payment:180,apr:"12.5%"},
      {id:"d4",name:"Student Loan",balance:31000,monthly_payment:195,apr:"6.1%"},
    ],
    bills: [
      {id:"b1",name:"Rent",amount:950,due_day:1,status:"paid"},
      {id:"b2",name:"Electric",amount:72,due_day:9,status:"overdue"},
      {id:"b3",name:"Phone",amount:95,due_day:15,status:"upcoming"},
      {id:"b4",name:"Car Insurance",amount:188,due_day:20,status:"upcoming"},
    ],
    medications: [
      {id:"m1",name:"Metformin 500mg",dose:"500mg",schedule:"Twice daily",refill_days:4},
      {id:"m2",name:"Lisinopril 10mg",dose:"10mg",schedule:"Daily",refill_days:22},
    ],
    supplements: [
      {id:"s1",name:"Vitamin D3",dose:"2000 IU",timing:"Morning",icon:"💛",streak:2,takenToday:false,history:[0,0,0,1,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1]},
    ],
    moodHistory: [
      {day:"Mon",score:5},{day:"Tue",score:4},{day:"Wed",score:5},{day:"Thu",score:6},
      {day:"Fri",score:6},{day:"Sat",score:7},{day:"Sun",score:5},
      {day:"Mon",score:4},{day:"Tue",score:3},{day:"Wed",score:5},{day:"Thu",score:4},
      {day:"Fri",score:6},{day:"Sat",score:6},{day:"Sun",score:5},
      {day:"Mon",score:4},{day:"Tue",score:5},{day:"Wed",score:4},{day:"Thu",score:5},
      {day:"Fri",score:6},{day:"Sat",score:7},{day:"Sun",score:5},
      {day:"Mon",score:4},{day:"Tue",score:5},{day:"Wed",score:5},{day:"Thu",score:6},
      {day:"Fri",score:5},{day:"Sat",score:null},
    ],
  },
];
const PICKED_DEMO = DEMO_PROFILES[Math.floor(Math.random() * DEMO_PROFILES.length)];


// ─── LEAGUE DATA ──────────────────────────────────────────────────────────────
const LEAGUE_CODE = "SYNC-4829";
const LEAGUE_LINK = "https://lifesync.to/join/SYNC-4829";
const WEEKS = ["Week 1","Week 2","Week 3","Week 4 (Now)"];
const INITIAL_LEAGUE_MEMBERS = [
  { id:"you",    name:"You",        avatar:"ME", score:50, prevScore:50, streakHighlight:"Building...", weeklyHistory:[50,50,50,50], isYou:true },
  { id:"marcus", name:"Marcus T.",  avatar:"MT", score:58, prevScore:54, streakHighlight:"Budget 6🔥",  weeklyHistory:[50,51,53,58], isYou:false },
  { id:"priya",  name:"Priya K.",   avatar:"PK", score:55, prevScore:56, streakHighlight:"Meditate 9🔥",weeklyHistory:[50,52,56,55], isYou:false },
  { id:"deon",   name:"Deon W.",    avatar:"DW", score:62, prevScore:58, streakHighlight:"Water 14🔥",  weeklyHistory:[50,54,58,62], isYou:false },
  { id:"sofia",  name:"Sofia R.",   avatar:"SR", score:47, prevScore:49, streakHighlight:"Sleep 5🔥",   weeklyHistory:[50,48,49,47], isYou:false },
];
const INITIAL_TRASH_TALK = [
  { id:1, from:"Deon W.",  avatar:"DW", text:"Already at 62 and it's only week 4 👀 y'all better catch up", time:"2h ago",  likes:3 },
  { id:2, from:"Priya K.", avatar:"PK", text:"My meditation streak is unmatched 🧘 9 days running",           time:"5h ago",  likes:2 },
  { id:3, from:"Marcus T.",avatar:"MT", text:"Budget habit finally clicking. Finance pillar up huge 📊",       time:"1d ago",  likes:4 },
  { id:4, from:"Sofia R.", avatar:"SR", text:"Rough week ngl. Life's been busy but I'm not out yet 💪",        time:"1d ago",  likes:5 },
];

const calcCreditFactors = (debts, habits, monthlyIncome, creditDetails={}) => {
  const payHabit = habits.find(h=>h.id==="cardpay");
  const payStreak = payHabit?.streak||0;
  const payValue = Math.min(100, 60 + payStreak * 2);
  const payColor = payValue>=80?"#4ade80":payValue>=60?"#facc15":"#f87171";
  const payDesc = payStreak>0 ? `${payStreak}-month on-time streak` : "No payment history logged yet";
  const ccBal = creditDetails.cc_balance>0 ? creditDetails.cc_balance : debts.filter(d=>(d.name||"").toLowerCase().includes("credit")||(parseFloat(d.apr)>15)).reduce((a,d)=>a+(d.balance||0),0);
  const ccLim = creditDetails.cc_limit>0 ? creditDetails.cc_limit : Math.max(ccBal*2, 5000);
  const utilPct = ccLim>0 ? Math.round((ccBal/ccLim)*100) : 0;
  const utilValue = Math.max(0, 100-utilPct);
  const utilColor = utilPct<=30?"#4ade80":utilPct<=50?"#facc15":"#f87171";
  const utilDesc = ccBal>0 ? `$${ccBal.toLocaleString()} / $${ccLim.toLocaleString()} limit (${utilPct}%)` : "No credit card debt — great!";
  const totalDebt = debts.reduce((a,d)=>a+(d.balance||0),0);
  const dti = monthlyIncome>0 ? Math.round((totalDebt/(monthlyIncome*12))*100) : 0;
  const dtiValue = Math.max(0, 100-dti);
  const dtiColor = dti<=20?"#4ade80":dti<=50?"#facc15":"#f87171";
  const dtiDesc = totalDebt>0 ? `$${totalDebt.toLocaleString()} total debt (${dti}% DTI)` : "No debt — excellent!";
  return [
    { label:"Payment History",    weight:35, value:payValue,  desc:payDesc,  color:payColor  },
    { label:"Credit Utilization", weight:30, value:utilValue, desc:utilDesc, color:utilColor },
    { label:"Debt-to-Income",     weight:20, value:dtiValue,  desc:dtiDesc,  color:dtiColor  },
    { label:"Credit Age",         weight:15,
      value: creditDetails.credit_age_years>=7?90:creditDetails.credit_age_years>=4?75:creditDetails.credit_age_years>=2?60:creditDetails.credit_age_years>0?45:72,
      desc: creditDetails.credit_age_years>0?`Avg account age: ${creditDetails.credit_age_years} yrs`:"Enter your credit age below",
      color: creditDetails.credit_age_years>=7?"#4ade80":creditDetails.credit_age_years>=4?"#facc15":creditDetails.credit_age_years>0?"#f97316":"#64748b" },
    { label:"New Credit",         weight:10, value:90,        desc:"No hard inquiries (12mo)", color:"#a78bfa" },
  ];
};

// ─── GAMIFICATION ────────────────────────────────────────────────────────────
const LEVELS = [
  { name:"Rookie",   minXP:0,    color:"#64748b", icon:"⚪" },
  { name:"Hustler",  minXP:500,  color:"#60a5fa", icon:"🔵" },
  { name:"Pro",      minXP:1500, color:"#a78bfa", icon:"🟣" },
  { name:"Elite",    minXP:3000, color:"#facc15", icon:"🟡" },
  { name:"Legend",   minXP:6000, color:"#4ade80", icon:"🟢" },
];
const BADGES = [
  { id:"streak7",   label:"7-Day Streak",    icon:"🔥", desc:"Log 7 days in a row" },
  { id:"streak30",  label:"30-Day Streak",   icon:"⚡", desc:"Log 30 days in a row" },
  { id:"streak100", label:"100-Day Streak",  icon:"💎", desc:"Log 100 days in a row" },
  { id:"hustler",   label:"Hustler",         icon:"🔵", desc:"Reached Hustler level" },
  { id:"pro",       label:"Pro",             icon:"🟣", desc:"Reached Pro level" },
  { id:"elite",     label:"Elite",           icon:"🟡", desc:"Reached Elite level" },
  { id:"legend",    label:"Legend",          icon:"🟢", desc:"Reached Legend level" },
  { id:"first_log", label:"First Log",       icon:"✅", desc:"Logged your first activity" },
  { id:"week1",     label:"Week One",        icon:"📅", desc:"Used LifeSync for 7 days" },
];
const getLevel = (xp) => [...LEVELS].reverse().find(l => xp >= l.minXP) || LEVELS[0];
const getNextLevel = (xp) => LEVELS.find(l => l.minXP > xp) || null;
const XP_ACTIONS = { login:15, habit:10, mood:5, weight:5, supplement:3 };


// ─── GOAL CARD (reusable across tabs) ────────────────────────────────────────
function GoalCard({ g, onUpdate, onDelete, autoValue, autoLabel }) {
  const pct = g.target_value > 0 ? Math.min(100, Math.round(((autoValue ?? g.current_value) / g.target_value) * 100)) : 0;
  const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline) - new Date()) / (1000*60*60*24)) : null;
  const catColors = { fitness:"#4ade80", finance:"#60a5fa", health:"#f97316", personal:"#a78bfa" };
  const col = catColors[g.category] || "#818cf8";
  const displayVal = autoValue ?? g.current_value;
  return (
    <div style={{background:"#080f1e",border:`1px solid ${col}22`,borderRadius:14,padding:"16px 18px",borderLeft:`3px solid ${col}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontSize:11,fontWeight:700,color:col,background:`${col}18`,border:`1px solid ${col}30`,borderRadius:6,padding:"2px 8px",textTransform:"uppercase"}}>{g.category}</span>
            {autoLabel && <span style={{fontSize:10,color:"#4ade80",fontWeight:600}}>⚡ auto-tracking</span>}
            {daysLeft !== null && <span style={{fontSize:11,color:daysLeft<=7?"#f87171":daysLeft<=14?"#facc15":"#475569"}}>{daysLeft > 0 ? `${daysLeft}d left` : "⚠ Overdue"}</span>}
          </div>
          <div style={{fontSize:15,fontWeight:800}}>{g.title}</div>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          {!autoLabel && <button onClick={()=>onUpdate(g)} style={{background:`${col}18`,border:`1px solid ${col}44`,color:col,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:700}}>Update</button>}
          <button onClick={()=>onDelete(g.id)} style={{background:"transparent",border:"1px solid #1a3356",color:"#475569",borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>×</button>
        </div>
      </div>
      <div style={{background:"#1e293b",borderRadius:99,height:8,overflow:"hidden",marginBottom:6}}>
        <div style={{width:`${pct}%`,background:`linear-gradient(90deg,${col},${col}88)`,height:"100%",borderRadius:99,transition:"width 0.8s"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:"#64748b"}}>{displayVal.toLocaleString()} / {g.target_value.toLocaleString()} {g.unit}</span>
        <span style={{fontWeight:800,color:pct>=100?"#4ade80":col}}>{pct>=100?"✅ Complete!":pct+"%"}</span>
      </div>
    </div>
  );
}

export default function LifeSync({ user, onSignOut, isDemo = false }) {
  const navigate = useNavigate();
  const DEMO = isDemo ? PICKED_DEMO : DEMO_PROFILES[0];
  const [tab, setTab] = useState("overview");

  const [habits, setHabits] = useState(isDemo ? DEMO.habits : INITIAL_HABITS);
  const [showAdd, setShowAdd] = useState(false);
  const [logModal, setLogModal] = useState(null);
  const [logVal, setLogVal] = useState(1);
  const [justLogged, setJustLogged] = useState(null);
  const [creditScore, setCreditScore] = useState(isDemo ? DEMO.creditScore : 0);
  const [monthlyIncome, setMonthlyIncome] = useState(isDemo ? DEMO.monthlyIncome : 0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(isDemo ? DEMO.monthlyExpenses : 0);
  const [savings, setSavings] = useState(isDemo ? DEMO.savings : 0);
  const [debts, setDebts] = useState(isDemo ? [
    {id:"d1", name:"Credit Card", balance:2400, monthly_payment:120, apr:"19.9%"},
    {id:"d2", name:"Student Loan", balance:18500, monthly_payment:210, apr:"5.4%"},
    {id:"d3", name:"Car Loan", balance:8200, monthly_payment:285, apr:"7.1%"},
  ] : []);
  const [bills, setBills] = useState(isDemo ? [
    {id:"b1", name:"Rent", amount:1250, due_day:1, status:"paid"},
    {id:"b2", name:"Electric", amount:87, due_day:12, status:"upcoming"},
    {id:"b3", name:"Internet", amount:65, due_day:15, status:"upcoming"},
    {id:"b4", name:"Health Insurance", amount:220, due_day:20, status:"upcoming"},
  ] : []);
  const [medications, setMedications] = useState(isDemo ? DEMO.medications : []);
  const [checkups, setCheckups] = useState([]);
  const [showEditFinances, setShowEditFinances] = useState(false);
  const openEditFinances = () => { setFinanceForm({income: monthlyIncome||"", expenses: monthlyExpenses||"", savings: savings||""}); setShowEditFinances(true); };
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [showAddMed, setShowAddMed] = useState(false);
  const [showAddCheckup, setShowAddCheckup] = useState(false);
  const [newDebt, setNewDebt] = useState({name:"",balance:"",monthly_payment:"",apr:""});
  const [newBill, setNewBill] = useState({name:"",amount:"",due_day:"",status:"upcoming"});
  const [newMed, setNewMed] = useState({name:"",dose:"",schedule:"Daily",refill_days:30});
  const [newCheckup, setNewCheckup] = useState({name:"",last_date:"",urgent:false});
  const [financeForm, setFinanceForm] = useState({income:"",expenses:"",savings:""});
  const [creditDetails, setCreditDetails] = useState({ cc_balance:0, cc_limit:0, credit_age_years:0, num_accounts:0, hard_inquiries:0, family_size:1, has_student_loans:false, is_first_time_buyer:false, employer_has_401k:false });
  const [showEditCreditDetails, setShowEditCreditDetails] = useState(false);
  const [creditDetailForm, setCreditDetailForm] = useState({});
  const [creditHistory, setCreditHistory] = useState(isDemo ? DEMO.creditHistory : CREDIT_HISTORY);
  const creditFactors = calcCreditFactors(debts, habits, monthlyIncome, creditDetails);
  const [showUpdateScore, setShowUpdateScore] = useState(false);
  const [newScoreInput, setNewScoreInput] = useState("");
  const [simMode, setSimMode] = useState(false);
  const [simActions, setSimActions] = useState({ paydown: 0, newCard: false, missedPayment: false, oldAccount: false });
  // ── WELLNESS STATE ──
  const [moodHistory, setMoodHistory] = useState(isDemo ? DEMO.moodHistory : INITIAL_MOOD_HISTORY);
  const [todayMood, setTodayMood] = useState(null);
  const [todayNote, setTodayNote] = useState("");
  const [moodLogged, setMoodLogged] = useState(false);
  const [checkInStep, setCheckInStep] = useState(0); // 0=idle,1=mood,2=phq,3=gad,4=done
  const [phqAnswers, setPhqAnswers] = useState([null,null]);
  const [gadAnswers, setGadAnswers] = useState([null,null]);
  const [checkInResults, setCheckInResults] = useState(null);
  const [wellnessAiLoading, setWellnessAiLoading] = useState(false);
  const [wellnessMsg, setWellnessMsg] = useState(null);
  const [supplements, setSupplements] = useState(isDemo ? DEMO.supplements : INITIAL_SUPPLEMENTS);
  const [showAddSupp, setShowAddSupp] = useState(false);
  const [newSupp, setNewSupp] = useState({ name:"", dose:"", timing:"Morning", icon:"💊" });
  const [suppJustLogged, setSuppJustLogged] = useState(null);
  const [username, setUsername] = useState(isDemo ? DEMO.username : "You");
  // ── GAMIFICATION STATE ──
  const [progress, setProgress] = useState({ xp:0, level:"Rookie", daily_streak:0, longest_streak:0, last_active_date:null, badges:[] });
  const [xpPopup, setXpPopup] = useState(null); // { amount, reason }
  const [levelUpPopup, setLevelUpPopup] = useState(null);

  // ── BODY STATS & PROFILE ──
  const [bodyStats, setBodyStats] = useState({ age:"", height_in:"", current_weight:"", goal_weight:"", goal_type:"fat_loss", goal_date:"", goal_label:"" });
  const [weightLog, setWeightLog] = useState([]);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ age:"", height_in:"", current_weight:"", goal_weight:"", goal_type:"fat_loss", goal_date:"", goal_label:"" });
  const [logWeightVal, setLogWeightVal] = useState("");
  // ── GOALS STATE ──
  const [goals, setGoals] = useState([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showUpdateGoal, setShowUpdateGoal] = useState(null); // goal object
  const [goalUpdateVal, setGoalUpdateVal] = useState("");
  const [newGoal, setNewGoal] = useState({ title:"", category:"fitness", current_value:"0", target_value:"", unit:"", deadline:"" });

  // Auto-link goals to real data
  const getGoalAutoValue = (g) => {
    // Finance goals → use real savings
    if (g.category === "finance" && (g.unit==="$" || g.title.toLowerCase().includes("save"))) {
      return { value: savings, label: "from your savings" };
    }
    // Finance debt payoff → use total debt reduction
    if (g.category === "finance" && g.title.toLowerCase().includes("debt")) {
      return null; // manual for now
    }
    // Fitness/health goals with "lbs" → use weight log
    if ((g.category==="fitness"||g.category==="health") && g.unit==="lbs" && weightLog.length > 0) {
      const startW = weightLog[0]?.weight;
      const currW = weightLog[weightLog.length-1]?.weight;
      if (startW && currW) {
        const lost = parseFloat((startW - currW).toFixed(1));
        return { value: Math.max(0, lost), label: "from weight log" };
      }
    }
    // Fitness goals → link to habit streak (gym, cardio, run)
    if (g.category==="fitness" && g.unit==="days") {
      const fitnessHabit = habits.find(h => ["gym","cardio","run","walk","steps"].includes(h.id) && h.active);
      if (fitnessHabit) return { value: fitnessHabit.streak, label: `from ${HABIT_TEMPLATES.find(t=>t.id===fitnessHabit.id)?.label||"habit"} streak` };
    }
    return null;
  };
  const [showLogWeight, setShowLogWeight] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [msgs, setMsgs] = useState([
    {role:"assistant",text:"Hi! 👋 Welcome to LifeSync. Ask me anything about your habits, finances, or health — I'm here to help you grow your Life Score."}
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const chatRef = useRef(null);
  // ── LEAGUE STATE ──
  const [leagueMembers, setLeagueMembers] = useState(INITIAL_LEAGUE_MEMBERS);
  const [trashTalk, setTrashTalk] = useState(INITIAL_TRASH_TALK);
  const [trashInput, setTrashInput] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(null);
  const [leagueView, setLeagueView] = useState("leaderboard");
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const leagueWeek = 4;
  const leagueTotalWeeks = 16;
  const leagueEndsIn = leagueTotalWeeks - leagueWeek;
  const financeData = {
    totalDebt: debts.reduce((a, d) => a + (d.balance||0), 0),
    income: monthlyIncome,
    savings: savings,
    overdueCheckups: checkups.filter(ch => ch.urgent).length,
    lowRefillMeds: medications.filter(m => (m.refill_days||30) <= 7).length,
  };
  const streakBonus = Math.min(5, Math.floor((progress.daily_streak||0) / 7)); // +1 per 7-day streak, max +5
  const lifeScore = Math.min(100, calcLifeScore(habits, financeData) + streakBonus);
  const myLeagueScore = 50 + Math.max(0, lifeScore - 50);
  const scoreBreakdown = calcLifeScoreBreakdown(habits, financeData);

  // ── SUPABASE: Load user data on mount ──────────────────────────────────────
  useEffect(() => {
    if (!user || isDemo) return;
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
        .from("finances").select("*").eq("user_id", user.id).maybeSingle();
      if (finData) {
        if (finData.credit_score) setCreditScore(finData.credit_score);
        if (finData.monthly_income) setMonthlyIncome(finData.monthly_income);
        if (finData.monthly_expenses) setMonthlyExpenses(finData.monthly_expenses);
        if (finData.savings) setSavings(finData.savings);
        setFinanceForm({ income: finData.monthly_income||"", expenses: finData.monthly_expenses||"", savings: finData.savings||"" });
        setCreditDetails({
          cc_balance: finData.cc_balance||0,
          cc_limit: finData.cc_limit||0,
          credit_age_years: finData.credit_age_years||0,
          num_accounts: finData.num_accounts||0,
          hard_inquiries: finData.hard_inquiries||0,
          family_size: finData.family_size||1,
          has_student_loans: finData.has_student_loans||false,
          is_first_time_buyer: finData.is_first_time_buyer||false,
          employer_has_401k: finData.employer_has_401k||false,
        });
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

      // Load goals
      const { data: goalsData } = await supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (goalsData) setGoals(goalsData);

      // Load body stats
      const { data: bsData } = await supabase.from("body_stats").select("*").eq("user_id", user.id).maybeSingle();
      if (bsData) { setBodyStats(bsData); setProfileForm(bsData); }

      // Load weight log
      const { data: wlData } = await supabase.from("weight_log").select("*").eq("user_id", user.id).order("logged_at", { ascending: true });
      if (wlData) setWeightLog(wlData);

      // Load user progress
      const { data: progData } = await supabase.from("user_progress").select("*").eq("user_id", user.id).maybeSingle();
      if (progData) {
        setProgress({ ...progData, badges: progData.badges || [] });
      }

      // Load profile username
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) setUsername(profile.username);
    };
    loadData();
  }, [user]);

  // Award daily login XP whenever progress loads and it's a new day
  useEffect(() => { if (user && progress.xp !== undefined) awardDailyLogin(); }, [progress.last_active_date, user]);

  // ── SUPABASE: Save mood when logged ────────────────────────────────────────
  const saveMood = async (score, note) => {
    if (!user) return;
    await supabase.from("moods").insert([{ user_id: user.id, score, note: note || null }]);
    awardXP("mood");
  };

  // ── SUPABASE: Save habit log ────────────────────────────────────────────────
  const saveHabit = async (habitId, streak) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("habits")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", habitId)
      .maybeSingle();
    if (existing) {
      await supabase.from("habits").update({ streak, last_completed: new Date().toISOString().split("T")[0] }).eq("id", existing.id);
    } else {
      await supabase.from("habits").insert([{ user_id: user.id, name: habitId, streak, completed: true }]);
    }
    awardXP("habit");
  };

  // ── GOALS CRUD ────────────────────────────────────────────────────────────────
  const addGoal = async () => {
    if (!newGoal.title.trim() || !newGoal.target_value) return;
    const payload = {
      user_id: user?.id,
      title: newGoal.title.trim(),
      category: newGoal.category,
      current_value: parseFloat(newGoal.current_value) || 0,
      target_value: parseFloat(newGoal.target_value),
      unit: newGoal.unit.trim(),
      deadline: newGoal.deadline || null,
      completed: false,
    };
    if (user) {
      const { data } = await supabase.from("goals").insert([payload]).select().single();
      if (data) { setGoals(p => [data, ...p]); awardXP("habit"); }
    } else {
      setGoals(p => [{ ...payload, id: "g_" + Date.now() }, ...p]);
    }
    setNewGoal({ title:"", category:"fitness", current_value:"0", target_value:"", unit:"", deadline:"" });
    setShowAddGoal(false);
  };

  const updateGoalProgress = async (goal, newVal) => {
    const v = parseFloat(newVal);
    if (isNaN(v)) return;
    const completed = v >= goal.target_value;
    const updated = { ...goal, current_value: v, completed, updated_at: new Date().toISOString() };
    if (user) await supabase.from("goals").update({ current_value: v, completed, updated_at: updated.updated_at }).eq("id", goal.id);
    setGoals(p => p.map(g => g.id === goal.id ? updated : g));
    if (completed) awardXP("habit");
    setShowUpdateGoal(null);
    setGoalUpdateVal("");
  };

  const deleteGoal = async (id) => {
    if (user) await supabase.from("goals").delete().eq("id", id);
    setGoals(p => p.filter(g => g.id !== id));
  };

  // ── GAMIFICATION: Award XP + update streak ────────────────────────────────
  const awardXP = async (action) => {
    if (!user || isDemo) return;
    const amount = XP_ACTIONS[action] || 5;
    const today = new Date().toISOString().split("T")[0];
    const prev = progress;
    const prevLevel = getLevel(prev.xp);

    // Calculate new streak
    const lastDate = prev.last_active_date;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    let newStreak = prev.daily_streak || 0;
    if (lastDate === today) {
      newStreak = prev.daily_streak; // already logged today
    } else if (lastDate === yesterday) {
      newStreak = prev.daily_streak + 1; // consecutive day
    } else {
      newStreak = 1; // reset
    }
    const longestStreak = Math.max(newStreak, prev.longest_streak || 0);
    const newXP = (prev.xp || 0) + amount;
    const newLevel = getLevel(newXP);

    // Check for new badges
    const currentBadges = Array.isArray(prev.badges) ? prev.badges : [];
    const newBadges = [...currentBadges];
    if (!newBadges.includes("first_log")) newBadges.push("first_log");
    if (newStreak >= 7   && !newBadges.includes("streak7"))   newBadges.push("streak7");
    if (newStreak >= 30  && !newBadges.includes("streak30"))  newBadges.push("streak30");
    if (newStreak >= 100 && !newBadges.includes("streak100")) newBadges.push("streak100");
    if (newLevel.name === "Hustler" && !newBadges.includes("hustler")) newBadges.push("hustler");
    if (newLevel.name === "Pro"     && !newBadges.includes("pro"))     newBadges.push("pro");
    if (newLevel.name === "Elite"   && !newBadges.includes("elite"))   newBadges.push("elite");
    if (newLevel.name === "Legend"  && !newBadges.includes("legend"))  newBadges.push("legend");

    const updated = { user_id: user.id, xp: newXP, level: newLevel.name, daily_streak: newStreak, longest_streak: longestStreak, last_active_date: today, badges: newBadges, updated_at: new Date().toISOString() };
    await supabase.from("user_progress").upsert(updated, { onConflict: "user_id" });
    setProgress(updated);

    // Show XP popup
    setXpPopup({ amount, reason: action });
    setTimeout(() => setXpPopup(null), 2000);

    // Show level up popup
    if (newLevel.name !== prevLevel.name) {
      setLevelUpPopup(newLevel);
      setTimeout(() => setLevelUpPopup(null), 4000);
    }
  };

  // Award daily login XP once per day
  const awardDailyLogin = async () => {
    if (!user || isDemo) return;
    const today = new Date().toISOString().split("T")[0];
    if (progress.last_active_date === today) return; // already got it today
    await awardXP("login");
  };

  // ── SUPABASE: Save body stats ─────────────────────────────────────────────
  const saveBodyStats = async (form) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      age: parseInt(form.age)||null,
      height_in: parseFloat(form.height_in)||null,
      current_weight: parseFloat(form.current_weight)||null,
      goal_weight: parseFloat(form.goal_weight)||null,
      goal_type: form.goal_type||"fat_loss",
      goal_date: form.goal_date||null,
      goal_label: form.goal_label||null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("body_stats").upsert(payload, { onConflict: "user_id" });
    if (!error) setBodyStats(payload);
    else console.error("saveBodyStats:", error);
  };

  const logWeight = async () => {
    if (!user || !logWeightVal) return;
    const w = parseFloat(logWeightVal);
    if (!w) return;
    const { data } = await supabase.from("weight_log").insert([{ user_id: user.id, weight: w }]).select().single();
    if (data) {
      setWeightLog(p => [...p, data]);
      await saveBodyStats({ ...bodyStats, current_weight: w });
      setBodyStats(p => ({ ...p, current_weight: w }));
      awardXP("weight");
    }
    setLogWeightVal(""); setShowLogWeight(false);
  };

  // ── SUPABASE: Save finances ────────────────────────────────────────────────
  const saveCreditDetails = async (form) => {
    if (!user) return;
    const payload = {
      cc_balance: parseFloat(form.cc_balance)||0,
      cc_limit: parseFloat(form.cc_limit)||0,
      credit_age_years: parseFloat(form.credit_age_years)||0,
      num_accounts: parseInt(form.num_accounts)||0,
      hard_inquiries: parseInt(form.hard_inquiries)||0,
      family_size: parseInt(form.family_size)||1,
      has_student_loans: !!form.has_student_loans,
      is_first_time_buyer: !!form.is_first_time_buyer,
      employer_has_401k: !!form.employer_has_401k,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("finances").upsert({ user_id: user.id, ...payload }, { onConflict: "user_id" });
    setCreditDetails(payload);
  };

  const saveFinances = async (income, expenses, sav) => {
    if (!user) return;
    const inc = parseFloat(income)||0;
    const exp = parseFloat(expenses)||0;
    const savAmt = parseFloat(sav)||0;
    const { error } = await supabase.from("finances").upsert(
      { user_id: user.id, monthly_income: inc, monthly_expenses: exp, savings: savAmt, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (!error) {
      setMonthlyIncome(inc);
      setMonthlyExpenses(exp);
      setSavings(savAmt);
    } else {
      console.error("saveFinances error:", error);
    }
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
    await supabase.from("finances").upsert(
      { user_id: user.id, credit_score: score, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  };

  // ── SUPABASE: Save life score history weekly ────────────────────────────────
  const saveScoreHistory = async (score) => {
    if (!user) return;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStr = weekStart.toISOString().split("T")[0];
    const { data: existing } = await supabase.from("score_history").select("id").eq("user_id", user.id).eq("week_start", weekStr).maybeSingle();
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
      saveHabit(id, newStreak); // intentionally not awaited — fire and forget
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
    awardXP("supplement");
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

  const TABS=[{id:"overview",label:"Overview",icon:"◈"},{id:"profile",label:"Profile",icon:"👤"},{id:"habits",label:"Habits",icon:"🔥"},{id:"finances",label:"Finances",icon:"◎"},{id:"health",label:"Health",icon:"◉"},{id:"wellness",label:"Wellness",icon:"🧠"},{id:"league",label:"League",icon:"🏆"},{id:"ai",label:"AI Chat",icon:"✦"}];

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

      {isDemo && (
        <div style={{background:"linear-gradient(135deg,#1a1040,#0f0a2a)",borderBottom:"1px solid rgba(129,140,248,0.3)",padding:"10px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:16}}>👁️</span>
            <span style={{fontSize:13,color:"#c084fc",fontWeight:600}}>Demo mode — viewing @{username}'s account. Data is not real.</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>navigate("/login")} style={{background:"linear-gradient(135deg,#6366f1,#818cf8)",color:"#fff",border:"none",borderRadius:8,padding:"6px 16px",cursor:"pointer",fontSize:12,fontWeight:700}}>Create Your Account →</button>
            <button onClick={()=>navigate("/")} style={{background:"transparent",border:"1px solid #1e2240",color:"#64748b",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12}}>← Back</button>
          </div>
        </div>
      )}
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
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={C.cTitle}>Financial Snapshot</div>
                  <button style={{...C.ghost,padding:"4px 12px",fontSize:11}} onClick={openEditFinances}>✏ Edit</button>
                </div>
                {monthlyIncome===0&&monthlyExpenses===0?(
                  <div style={{textAlign:"center",padding:"20px 0"}}>
                    <div style={{fontSize:13,color:"#475569",marginBottom:10}}>No financial data yet.</div>
                    <button style={{...C.btn("#6366f1"),fontSize:12}} onClick={openEditFinances}>+ Add Your Numbers</button>
                  </div>
                ):(
                  <>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
                      {[["Income",`$${monthlyIncome.toLocaleString()}`,"#4ade80"],["Expenses",`$${monthlyExpenses.toLocaleString()}`,"#f87171"],["Saved",`$${Math.max(0,monthlyIncome-monthlyExpenses).toLocaleString()}`,"#60a5fa"]].map(([l,v,col])=>(
                        <div key={l} style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:col}}>{v}</div><div style={{fontSize:11,color:"#64748b"}}>{l}/mo</div></div>
                      ))}
                    </div>
                    <div style={{fontSize:12,color:"#64748b",marginBottom:4,display:"flex",justifyContent:"space-between"}}><span>Savings</span><span style={{color:"#e2e8f0"}}>${savings.toLocaleString()}</span></div>
                    <Bar value={savings} max={Math.max(savings*2,5000)} color="#60a5fa"/>
                  </>
                )}
              </div>
            </div>
            <div style={C.card}>
              <div style={C.cTitle}>Priority Actions</div>
              <div style={C.g()}>
                {(()=>{
                  const actions = [];
                  // Low medication refills
                  medications.filter(m=>(m.refill_days||30)<=7).forEach(m=>{
                    actions.push({icon:"💊",text:`${m.name} refill in ${m.refill_days} day${m.refill_days===1?"":"s"}`,color:"#f87171",action:"View",go:"health"});
                  });
                  // Overdue bills
                  bills.filter(b=>b.status==="overdue").forEach(b=>{
                    actions.push({icon:"🧾",text:`${b.name} bill is overdue — $${(b.amount||0).toLocaleString()}`,color:"#f87171",action:"View",go:"finances"});
                  });
                  // Overdue checkups
                  checkups.filter(ch=>ch.urgent).slice(0,2).forEach(ch=>{
                    actions.push({icon:"🏥",text:`${ch.name} is overdue`,color:"#facc15",action:"View",go:"health"});
                  });
                  // Habit streaks at risk (active habits with streak > 0, not logged today)
                  const topStreak = [...habits].filter(h=>h.active&&h.streak>0).sort((a,b)=>b.streak-a.streak)[0];
                  if (topStreak) {
                    const tmpl = HABIT_TEMPLATES.find(t=>t.id===topStreak.id);
                    actions.push({icon:"🔥",text:`Log ${tmpl?.label||topStreak.id} to keep your ${topStreak.streak}-day streak`,color:"#f97316",action:"Log now",go:"habits"});
                  }
                  // Low savings alert
                  if (monthlyIncome>0 && savings < monthlyIncome) {
                    actions.push({icon:"💰",text:`Savings ($${savings.toLocaleString()}) below 1 month income — consider boosting`,color:"#4ade80",action:"View",go:"finances"});
                  }
                  // High debt-to-income
                  const totalDebt = debts.reduce((a,d)=>a+(d.balance||0),0);
                  if (monthlyIncome>0 && totalDebt > monthlyIncome*12) {
                    actions.push({icon:"📉",text:`Debt ($${totalDebt.toLocaleString()}) exceeds annual income — focus on payoff`,color:"#a78bfa",action:"View",go:"finances"});
                  }
                  // Upcoming bills in next 3 days
                  const today = new Date().getDate();
                  bills.filter(b=>b.status==="upcoming"&&b.due_day>=today&&b.due_day<=today+3).forEach(b=>{
                    actions.push({icon:"📅",text:`${b.name} due in ${b.due_day-today} day${b.due_day-today===1?"":"s"} — $${(b.amount||0).toLocaleString()}`,color:"#60a5fa",action:"View",go:"finances"});
                  });
                  // No data state
                  if (actions.length===0) {
                    actions.push({icon:"✅",text:"Everything looks good! Keep building your streaks.",color:"#4ade80",action:"View habits",go:"habits"});
                  }
                  return actions.slice(0,5).map((a,i)=>(
                    <div key={i} style={{background:"#080f1e",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,border:"1px solid #0f2240"}}>
                      <span style={{fontSize:22}}>{a.icon}</span>
                      <div style={{flex:1,fontSize:13,fontWeight:600}}>{a.text}</div>
                      <button onClick={()=>setTab(a.go)} style={{background:"transparent",border:`1px solid ${a.color}`,color:a.color,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{a.action}</button>
                    </div>
                  ));
                })()}
              </div>
            </div>

          {/* Goals overview widget */}
          {goals.filter(g=>!g.completed).length > 0 && (
            <div style={C.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={C.cTitle}>🎯 Active Goals</div>
                <button onClick={()=>setTab("profile")} style={{...C.ghost,fontSize:11,padding:"4px 12px"}}>View all →</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {goals.filter(g=>!g.completed).slice(0,3).map(g=>{
                  const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current_value/g.target_value)*100)) : 0;
                  const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline)-new Date())/(1000*60*60*24)) : null;
                  const catColors = { fitness:"#4ade80", finance:"#60a5fa", health:"#f97316", personal:"#a78bfa" };
                  const col = catColors[g.category] || "#818cf8";
                  return (
                    <div key={g.id} style={{background:"#080f1e",borderRadius:12,padding:"12px 16px",border:"1px solid #0f2240"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:11,fontWeight:700,color:col,background:`${col}18`,border:`1px solid ${col}30`,borderRadius:6,padding:"2px 8px",textTransform:"uppercase"}}>{g.category}</span>
                          <span style={{fontSize:13,fontWeight:700}}>{g.title}</span>
                        </div>
                        <div style={{fontSize:12,fontWeight:800,color:col}}>{pct}%</div>
                      </div>
                      <div style={{background:"#1e293b",borderRadius:99,height:6,overflow:"hidden",marginBottom:4}}>
                        <div style={{width:`${pct}%`,background:`linear-gradient(90deg,${col},${col}99)`,height:"100%",borderRadius:99,transition:"width 0.8s"}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#475569"}}>
                        <span>{g.current_value} / {g.target_value} {g.unit}</span>
                        {daysLeft !== null && <span style={{color:daysLeft<=7?"#f87171":daysLeft<=30?"#facc15":"#475569"}}>{daysLeft > 0 ? `${daysLeft}d left` : "Overdue!"}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                {(debts.reduce((a,d)=>a+(d.balance||0),0)>0||checkups.filter(c=>c.urgent).length>0)&&(
                  <div style={{fontSize:12,color:"#f97316",marginTop:4,fontWeight:600}}>
                    ⚠ {[debts.reduce((a,d)=>a+(d.balance||0),0)>0&&"Debt load",checkups.filter(c=>c.urgent).length>0&&"overdue checkups"].filter(Boolean).join(" & ")} holding your score back
                  </div>
                )}
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
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={C.cTitle}>Monthly Budget</div>
                  <button style={{...C.ghost,padding:"4px 12px",fontSize:11}} onClick={openEditFinances}>✏ Edit</button>
                </div>
                {monthlyIncome===0&&monthlyExpenses===0?(
                  <div style={{textAlign:"center",padding:"20px 0"}}>
                    <div style={{fontSize:13,color:"#475569",marginBottom:10}}>Add your income & expenses to see your budget.</div>
                    <button style={{...C.btn("#6366f1"),fontSize:12}} onClick={openEditFinances}>+ Add Budget Info</button>
                  </div>
                ):(
                  <>
                    <div style={{marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:13}}><span style={{color:"#94a3b8"}}>Monthly Income</span><span style={{fontWeight:700,color:"#4ade80"}}>${monthlyIncome.toLocaleString()}</span></div>
                      <Bar value={monthlyIncome} max={Math.max(monthlyIncome,1)} color="#4ade80" h={6}/>
                    </div>
                    <div style={{marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:13}}><span style={{color:"#94a3b8"}}>Monthly Expenses</span><span style={{fontWeight:700,color:"#f87171"}}>${monthlyExpenses.toLocaleString()}</span></div>
                      <Bar value={monthlyExpenses} max={Math.max(monthlyIncome,1)} color="#f87171" h={6}/>
                    </div>
                    <div style={{marginBottom:4}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:13}}><span style={{color:"#94a3b8"}}>Savings</span><span style={{fontWeight:700,color:"#60a5fa"}}>${savings.toLocaleString()}</span></div>
                      <Bar value={savings} max={Math.max(monthlyIncome,1)} color="#60a5fa" h={6}/>
                    </div>
                    <div style={{marginTop:12,padding:"10px 14px",background:"#080f1e",borderRadius:10,display:"flex",justifyContent:"space-between",fontSize:13}}>
                      <span style={{color:"#64748b"}}>Left after expenses</span>
                      <span style={{fontWeight:800,color:monthlyIncome-monthlyExpenses>=0?"#4ade80":"#f87171"}}>${(monthlyIncome-monthlyExpenses).toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
              <div style={C.card}>
                <div style={C.cTitle}>Debt Overview</div>
                {debts.map(d=>(
                  <div key={d.id} style={{marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"flex-start"}}>
                      <div><div style={{fontSize:14,fontWeight:600}}>{d.name}</div><div style={{fontSize:11,color:"#64748b"}}>{d.apr||"—"} APR · ${(d.monthly_payment||0).toLocaleString()}/mo</div></div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{fontSize:16,fontWeight:800,color:"#fb7185"}}>${(d.balance||0).toLocaleString()}</div><button onClick={()=>removeDebt(d.id)} style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:16}}>×</button></div>
                    </div>
                    <Bar value={d.balance||0} max={Math.max((d.balance||0)*1.5,1000)} color="#fb7185" h={5}/>
                  </div>
                ))}
                {debts.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:"#475569",fontSize:13}}>No debts added yet.</div>}
                <button onClick={()=>setShowAddDebt(true)} style={{marginTop:8,background:"transparent",border:"1px solid #1e2240",color:"#818cf8",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,width:"100%"}}>+ Add Debt</button>
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

                {/* Credit Details Input */}
                <div style={C.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={C.cTitle}>📋 Your Credit Details</div>
                    <button style={{...C.ghost,fontSize:11,padding:"4px 12px"}} onClick={()=>{setCreditDetailForm({...creditDetails});setShowEditCreditDetails(true);}}>✏ Edit</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {[
                      ["CC Balance", creditDetails.cc_balance>0?`$${creditDetails.cc_balance.toLocaleString()}`:"Not set", creditDetails.cc_balance>0?"#e2e8f0":"#475569"],
                      ["CC Limit",   creditDetails.cc_limit>0?`$${creditDetails.cc_limit.toLocaleString()}`:"Not set",  creditDetails.cc_limit>0?"#e2e8f0":"#475569"],
                      ["Credit Age", creditDetails.credit_age_years>0?`${creditDetails.credit_age_years} yrs`:"Not set", creditDetails.credit_age_years>0?"#e2e8f0":"#475569"],
                      ["Accounts",   creditDetails.num_accounts>0?creditDetails.num_accounts:"Not set", creditDetails.num_accounts>0?"#e2e8f0":"#475569"],
                    ].map(([label,val,col])=>(
                      <div key={label} style={{background:"#080f1e",borderRadius:10,padding:"10px 14px"}}>
                        <div style={{fontSize:11,color:"#475569",marginBottom:3}}>{label}</div>
                        <div style={{fontSize:15,fontWeight:700,color:col}}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {(!creditDetails.cc_balance && !creditDetails.credit_age_years) && (
                    <div style={{marginTop:12,fontSize:12,color:"#475569",textAlign:"center"}}>Add your details above for more accurate score breakdown and personalized tips.</div>
                  )}
                </div>

                {/* Action Tips */}
                <div style={C.card}>
                  <div style={C.cTitle}>💡 Personalized Tips</div>
                  {(()=>{
                    const tips = [];
                    const util = creditDetails.cc_limit>0 ? Math.round((creditDetails.cc_balance/creditDetails.cc_limit)*100) : 0;
                    if (util > 30) tips.push({ impact:"+25–45 pts", tip:`Pay CC down to $${Math.round(creditDetails.cc_limit*0.3).toLocaleString()} (30% of your $${creditDetails.cc_limit.toLocaleString()} limit)`, urgent:true });
                    else if (util > 0) tips.push({ impact:"✅ Good", tip:`Utilization at ${util}% — keep it below 30% to maintain your score`, urgent:false });
                    const payHabit = habits.find(h=>h.id==="cardpay");
                    if (payHabit?.streak > 0) tips.push({ impact:"+10–20 pts", tip:`Keep your ${payHabit.streak}-month on-time streak — payment history is 35% of your score`, urgent:false });
                    else tips.push({ impact:"🔴 High Impact", tip:"Set up autopay to never miss a payment — payment history is 35% of your score", urgent:true });
                    if (creditDetails.hard_inquiries > 2) tips.push({ impact:"-5–10 pts", tip:`${creditDetails.hard_inquiries} hard inquiries detected — avoid new credit applications for 12 months`, urgent:true });
                    if (creditDetails.credit_age_years > 0 && creditDetails.credit_age_years < 4) tips.push({ impact:"+5–15 pts", tip:"Keep your oldest accounts open — closing them reduces average credit age", urgent:false });
                    if (!creditDetails.cc_limit) tips.push({ impact:"+5 pts", tip:"Request a credit limit increase (ask for soft pull only — won't affect your score)", urgent:false });
                    const totalDebt = debts.reduce((a,d)=>a+(d.balance||0),0);
                    if (monthlyIncome>0 && totalDebt > monthlyIncome*6) tips.push({ impact:"+15–30 pts", tip:`Focus on paying down $${totalDebt.toLocaleString()} total debt — high debt-to-income hurts your score`, urgent:true });
                    if (tips.length === 0) tips.push({ impact:"✅ Looking good", tip:"Add your credit details above for personalized tips", urgent:false });
                    return tips.map((t,i)=>(
                      <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid #0f2240",alignItems:"flex-start"}}>
                        <span style={{fontSize:12,fontWeight:800,color:t.urgent?"#f87171":"#4ade80",background:t.urgent?"rgba(248,113,113,0.1)":"rgba(74,222,128,0.1)",padding:"3px 8px",borderRadius:99,whiteSpace:"nowrap",marginTop:1}}>{t.impact}</span>
                        <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.5}}>{t.tip}</div>
                      </div>
                    ));
                  })()}
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


            {/* ── BENEFITS CHECKER ── */}
            <div style={C.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={C.cTitle}>💰 Benefits & Programs You May Qualify For</div>
                <button style={{...C.ghost,fontSize:11,padding:"4px 12px"}} onClick={()=>{setCreditDetailForm({...creditDetails});setShowEditCreditDetails(true);}}>Update Info</button>
              </div>
              <div style={{fontSize:12,color:"#475569",marginBottom:16}}>Based on your income, debt, and profile. Always verify eligibility directly with the program.</div>
              {(()=>{
                const annualIncome = monthlyIncome * 12;
                const totalDebt = debts.reduce((a,d)=>a+(d.balance||0),0);
                const fs = creditDetails.family_size || 1;
                const benefits = [];

                // EITC
                const eitcLimit = fs===1?17640:fs===2?46560:fs===3?52918:59187;
                const eitcStatus = annualIncome>0&&annualIncome<=eitcLimit?"qualify":annualIncome>0&&annualIncome<=eitcLimit*1.2?"maybe":"unlikely";
                benefits.push({ name:"Earned Income Tax Credit (EITC)", icon:"🏛️", category:"Tax Credit",
                  status: eitcStatus,
                  detail: eitcStatus==="qualify"?`Your income (~$${annualIncome.toLocaleString()}/yr) may qualify — up to $${fs===1?"560":fs===2?"3,995":fs===3?"6,604":"7,430"} back`:
                    eitcStatus==="maybe"?"Your income is near the limit — file and let the IRS determine eligibility":"Income likely too high for current household size",
                  action:"File Form 1040 — claim on your tax return", link:"https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit"});

                // Saver's Credit
                const saverLimit = fs===1?23000:fs===2?34500:46000;
                const saverStatus = annualIncome>0&&annualIncome<=saverLimit?"qualify":annualIncome>0&&annualIncome<=saverLimit*1.1?"maybe":"unlikely";
                benefits.push({ name:"Saver's Credit (Retirement)", icon:"🏦", category:"Tax Credit",
                  status: saverStatus,
                  detail: saverStatus==="qualify"?"Up to $1,000 credit for contributing to a 401(k) or IRA — free money for saving":saverStatus==="maybe"?"Near the income threshold — may qualify depending on filing status":"Income likely above Saver's Credit limit",
                  action:"Contribute to 401(k) or IRA and claim Form 8880"});

                // Student Loan Forgiveness
                if (creditDetails.has_student_loans) {
                  benefits.push({ name:"Income-Driven Repayment (IDR) Forgiveness", icon:"🎓", category:"Student Loans",
                    status: annualIncome>0&&totalDebt>annualIncome*0.5?"qualify":"maybe",
                    detail: "If payments under an IDR plan are less than interest, the remainder may be forgiven after 20–25 years. SAVE plan caps payments at 5–10% of discretionary income.",
                    action:"Apply at studentaid.gov/idr", link:"https://studentaid.gov/manage-loans/repayment/plans/income-driven"});
                  if (annualIncome < 60000) {
                    benefits.push({ name:"Public Service Loan Forgiveness (PSLF)", icon:"🏥", category:"Student Loans",
                      status:"maybe",
                      detail:"If you work for a government or nonprofit employer, remaining balance forgiven after 120 qualifying payments (10 years).",
                      action:"Check employer eligibility at studentaid.gov/pslf"});
                  }
                }

                // First-Time Homebuyer
                if (creditDetails.is_first_time_buyer) {
                  const hbLimit = fs===1?60000:fs===2?80000:100000;
                  benefits.push({ name:"First-Time Homebuyer Assistance", icon:"🏠", category:"Housing",
                    status: annualIncome<=hbLimit?"qualify":annualIncome<=hbLimit*1.3?"maybe":"unlikely",
                    detail: `Down payment assistance programs available in most states. FHA loans require only 3.5% down with a 580+ credit score. ${creditScore>=580?"Your credit score qualifies for FHA.":"Work on credit score to reach 580 for FHA eligibility."}`,
                    action:"Search your state's HFA program at hud.gov/buying"});
                }

                // 401k match
                if (creditDetails.employer_has_401k) {
                  benefits.push({ name:"401(k) Employer Match", icon:"💼", category:"Employer Benefits",
                    status: savings < monthlyIncome*3?"qualify":"maybe",
                    detail: `If your employer matches contributions, unclaimed match is free money. Common match: 50–100% of contributions up to 6% of salary. At $${monthlyIncome.toLocaleString()}/mo that's ~$${Math.round(monthlyIncome*0.06).toLocaleString()}/mo in free contributions.`,
                    action:"Contact HR to confirm match % and enroll"});
                  benefits.push({ name:"HSA / FSA Tax Savings", icon:"🏥", category:"Employer Benefits",
                    status:"qualify",
                    detail:"Health Savings Account (HSA) and Flexible Spending Account (FSA) reduce taxable income. HSA 2024 limit: $4,150 single / $8,300 family. Triple tax advantage.",
                    action:"Enroll during open enrollment or contact HR"});
                }

                // Credit card rewards
                benefits.push({ name:"Credit Card Rewards Optimization", icon:"💳", category:"CC Rewards",
                  status:"qualify",
                  detail: monthlyExpenses>2000?`At $${monthlyExpenses.toLocaleString()}/mo spending, a 2% cash back card earns ~$${Math.round(monthlyExpenses*0.02*12).toLocaleString()}/yr. Travel cards can earn 3–5x on dining/travel.`:
                    "Even at lower spending, the right rewards card can earn $200–500/yr with no extra effort.",
                  action: creditScore>=720?"You qualify for premium rewards cards (Chase Sapphire, Amex Gold)":creditScore>=670?"Good credit — qualify for most rewards cards":creditScore>=580?"Fair credit — secured cards with rewards available":"Build credit first with a secured card"});

                const statusColor = s => s==="qualify"?"#4ade80":s==="maybe"?"#facc15":"#475569";
                const statusLabel = s => s==="qualify"?"✅ Likely Qualify":s==="maybe"?"⚠️ Possibly Qualify":"❌ Unlikely";
                const statusBg = s => s==="qualify"?"rgba(74,222,128,0.08)":s==="maybe"?"rgba(250,204,21,0.08)":"rgba(71,85,105,0.08)";

                return benefits.map((b,i)=>(
                  <div key={i} style={{background:statusBg(b.status),border:`1px solid ${statusColor(b.status)}22`,borderRadius:14,padding:"16px 18px",marginBottom:10,borderLeft:`3px solid ${statusColor(b.status)}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,flexWrap:"wrap",gap:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:20}}>{b.icon}</span>
                        <div>
                          <div style={{fontSize:14,fontWeight:800}}>{b.name}</div>
                          <span style={{fontSize:10,fontWeight:700,color:"#64748b",background:"#080f1e",border:"1px solid #1a3356",borderRadius:6,padding:"2px 7px",textTransform:"uppercase"}}>{b.category}</span>
                        </div>
                      </div>
                      <span style={{fontSize:12,fontWeight:800,color:statusColor(b.status),background:statusBg(b.status),border:`1px solid ${statusColor(b.status)}44`,borderRadius:99,padding:"3px 10px",whiteSpace:"nowrap"}}>{statusLabel(b.status)}</span>
                    </div>
                    <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.6,marginBottom:8}}>{b.detail}</div>
                    <div style={{fontSize:12,color:"#60a5fa",fontWeight:600}}>→ {b.action}</div>
                  </div>
                ));
              })()}
            </div>
            {/* Finance Goals */}
            {goals.filter(g => g.category === "finance" && !g.completed).length > 0 && (
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={C.cTitle}>🎯 Finance Goals</div>
                  <button onClick={()=>setShowAddGoal(true)} style={{...C.ghost,fontSize:11,padding:"4px 12px"}}>+ Add</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {goals.filter(g => g.category === "finance" && !g.completed).map(g => {
                    const auto = getGoalAutoValue(g);
                    return <GoalCard key={g.id} g={g} onUpdate={(g)=>{setShowUpdateGoal(g);setGoalUpdateVal(String(g.current_value));}} onDelete={deleteGoal} autoValue={auto?.value} autoLabel={auto?.label}/>;
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── HEALTH ── */}
        {tab==="health"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={C.g()}>
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={C.cTitle}>Preventive Care Checklist</div>
                  <button style={{...C.btn("#6366f1"),fontSize:11,padding:"4px 12px"}} onClick={()=>setShowAddCheckup(true)}>+ Add</button>
                </div>
                {checkups.length===0?(
                  <div style={{textAlign:"center",padding:"20px 0"}}>
                    <div style={{fontSize:28,marginBottom:8}}>🩺</div>
                    <div style={{fontSize:13,color:"#475569",marginBottom:10}}>No checkups added yet.</div>
                    <button style={{...C.btn("#6366f1"),fontSize:12}} onClick={()=>setShowAddCheckup(true)}>+ Add Checkup</button>
                  </div>
                ):(
                  checkups.map(ch=>(
                    <div key={ch.id} style={{background:ch.urgent?"rgba(248,113,113,0.07)":"rgba(96,165,250,0.07)",border:`1px solid ${ch.urgent?"rgba(248,113,113,0.3)":"rgba(96,165,250,0.2)"}`,borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600}}>{ch.name}</div>
                        {ch.last_date&&<div style={{fontSize:11,color:"#64748b"}}>Last: {ch.last_date}</div>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <Tag status={ch.urgent?"overdue":"upcoming"}/>
                        <button onClick={()=>removeCheckup(ch.id)} style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:16}}>×</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={C.cTitle}>Medication Tracker</div>
                  <button style={{...C.btn("#6366f1"),fontSize:11,padding:"4px 12px"}} onClick={()=>setShowAddMed(true)}>+ Add</button>
                </div>
                {medications.length===0?(
                  <div style={{textAlign:"center",padding:"20px 0"}}>
                    <div style={{fontSize:28,marginBottom:8}}>💊</div>
                    <div style={{fontSize:13,color:"#475569",marginBottom:10}}>No medications added yet.</div>
                    <button style={{...C.btn("#6366f1"),fontSize:12}} onClick={()=>setShowAddMed(true)}>+ Add Medication</button>
                  </div>
                ):(
                  medications.map(m=>{
                    const days = m.refill_days||30;
                    const color = days<=7?"#f87171":days<=14?"#facc15":"#4ade80";
                    return(
                      <div key={m.id} style={{background:"#0a1929",border:"1px solid #1a3356",borderRadius:12,padding:"12px 16px",marginBottom:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <div><div style={{fontSize:14,fontWeight:700}}>{m.name}</div><div style={{fontSize:12,color:"#64748b"}}>{m.dose} · {m.schedule}</div></div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"#64748b"}}>Refill in</div><div style={{fontSize:18,fontWeight:800,color:color}}>{days}d</div></div>
                            <button onClick={()=>removeMed(m.id)} style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:16,padding:"0 4px"}}>×</button>
                          </div>
                        </div>
                        <div style={{marginTop:10}}><Bar value={days} max={30} color={color} h={5}/></div>
                      </div>
                    );
                  })
                )}
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

            {/* Health & Fitness Goals */}
            {goals.filter(g => (g.category === "fitness" || g.category === "health") && !g.completed).length === 0 && habits.filter(h=>h.active).length > 0 && (
              <div style={{...C.card,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"14px 18px"}}>
                <div style={{fontSize:13,color:"#475569"}}>🎯 Turn your habits into goals — track a milestone like "Run 30 days straight" or "Lose 10 lbs"</div>
                <button onClick={()=>{ setNewGoal(p=>({...p,category:"fitness"})); setShowAddGoal(true); }} style={{...C.btn("#4ade80"),fontSize:12,padding:"6px 14px",flexShrink:0}}>+ Set Goal</button>
              </div>
            )}
            {goals.filter(g => (g.category === "fitness" || g.category === "health") && !g.completed).length > 0 && (
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={C.cTitle}>🎯 Health & Fitness Goals</div>
                  <button onClick={()=>{ setNewGoal(p=>({...p,category:"fitness"})); setShowAddGoal(true); }} style={{...C.ghost,fontSize:11,padding:"4px 12px"}}>+ Add</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {goals.filter(g => (g.category === "fitness" || g.category === "health") && !g.completed).map(g => {
                    const auto = getGoalAutoValue(g);
                    return <GoalCard key={g.id} g={g} onUpdate={(g)=>{setShowUpdateGoal(g);setGoalUpdateVal(String(g.current_value));}} onDelete={deleteGoal} autoValue={auto?.value} autoLabel={auto?.label}/>;
                  })}
                </div>
                {goals.filter(g=>(g.category==="fitness"||g.category==="health")&&!g.completed).some(g=>getGoalAutoValue(g)) && (
                  <div style={{marginTop:12,padding:"10px 14px",background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:10,fontSize:12,color:"#64748b"}}>
                    ⚡ <strong style={{color:"#4ade80"}}>Auto-tracking</strong> — goals marked with ⚡ update automatically from your habits and weight log. No manual updates needed.
                  </div>
                )}
              </div>
            )}
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



        {/* ── PROFILE & BODY STATS ── */}
        {tab==="profile"&&(()=>{
          const bs = bodyStats;
          const hasStats = bs.height_in && bs.current_weight;
          const heightFt = bs.height_in ? Math.floor(bs.height_in/12) : null;
          const heightIn = bs.height_in ? Math.round(bs.height_in%12) : null;
          const bmi = hasStats ? (bs.current_weight / (bs.height_in * bs.height_in) * 703).toFixed(1) : null;
          const bmiLabel = bmi ? (bmi<18.5?"Underweight":bmi<25?"Healthy":bmi<30?"Overweight":"Obese") : null;
          const bmiColor = bmi ? (bmi<18.5?"#60a5fa":bmi<25?"#4ade80":bmi<30?"#facc15":"#f87171") : "#64748b";
          const tdee = (bs.age && bs.height_in && bs.current_weight) ?
            Math.round(10 * (bs.current_weight * 0.453592) + 6.25 * (bs.height_in * 2.54) - 5 * bs.age + 5) : null;
          const goalLbs = bs.goal_weight && bs.current_weight ? Math.abs(bs.current_weight - bs.goal_weight).toFixed(1) : null;
          const goalDir = bs.goal_weight && bs.current_weight ? (bs.goal_weight < bs.current_weight ? "lose" : "gain") : null;
          const weeklyChange = tdee && goalDir ? (goalDir==="lose" ? tdee - 500 : tdee + 300) : null; // moderate deficit/surplus
          const goalTypes = { fat_loss:"🔥 Fat Loss", muscle_gain:"💪 Muscle Gain", general_fitness:"🏃 General Fitness", maintenance:"⚖️ Maintenance", custom:"🎯 Custom Goal" };
          const wLogSorted = [...weightLog].sort((a,b) => new Date(a.logged_at)-new Date(b.logged_at));
          const startWeight = wLogSorted[0]?.weight || bs.current_weight;
          const totalChange = startWeight && bs.current_weight ? (bs.current_weight - startWeight).toFixed(1) : null;

          return (
            <div style={{display:"flex",flexDirection:"column",gap:18}}>

              {/* Hero */}
              {(()=>{
                const lvl = getLevel(progress.xp||0);
                const nextLvl = getNextLevel(progress.xp||0);
                const xpToNext = nextLvl ? nextLvl.minXP - (progress.xp||0) : 0;
                const xpPct = nextLvl ? Math.round(((progress.xp||0) - getLevel(progress.xp||0).minXP) / (nextLvl.minXP - getLevel(progress.xp||0).minXP) * 100) : 100;
                return (
                  <div style={{background:"linear-gradient(135deg,#0d1829,#0a1f3d)",border:"1px solid #1a3356",borderRadius:16,padding:"20px 28px",display:"flex",flexDirection:"column",gap:16}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:18}}>
                        <div style={{position:"relative"}}>
                          <div style={{width:64,height:64,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#4ade80)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:22}}>
                            {(username||"?").slice(0,2).toUpperCase()}
                          </div>
                          <div style={{position:"absolute",bottom:-4,right:-4,fontSize:16}}>{lvl.icon}</div>
                        </div>
                        <div>
                          <div style={{fontSize:22,fontWeight:900}}>@{username||"you"}</div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                            <span style={{fontSize:13,fontWeight:700,color:lvl.color}}>{lvl.name}</span>
                            <span style={{fontSize:11,color:"#475569"}}>·</span>
                            <span style={{fontSize:13,color:"#facc15",fontWeight:700}}>🔥 {progress.daily_streak||0} day streak</span>
                          </div>
                          {bs.goal_type && <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{goalTypes[bs.goal_type]||bs.goal_type}</div>}
                        </div>
                      </div>
                      <button style={{...C.btn("#6366f1")}} onClick={()=>{ setProfileForm({...bs}); setShowEditProfile(true); }}>✏ Edit Profile</button>
                    </div>
                    {/* XP bar */}
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#64748b",marginBottom:5}}>
                        <span style={{fontWeight:700,color:lvl.color}}>{(progress.xp||0).toLocaleString()} XP</span>
                        {nextLvl ? <span>{xpToNext.toLocaleString()} XP to {nextLvl.name}</span> : <span style={{color:"#4ade80"}}>Max level reached! 🏆</span>}
                      </div>
                      <div style={{background:"#1e293b",borderRadius:99,height:8,overflow:"hidden"}}>
                        <div style={{width:`${xpPct}%`,background:`linear-gradient(90deg,${lvl.color},#818cf8)`,height:"100%",borderRadius:99,transition:"width 0.8s"}}/>
                      </div>
                    </div>
                    {/* Streak stats */}
                    <div style={{display:"flex",gap:12}}>
                      {[["🔥 Current Streak",`${progress.daily_streak||0} days`,"#facc15"],["⚡ Longest Streak",`${progress.longest_streak||0} days`,"#60a5fa"],["✨ Total XP",`${(progress.xp||0).toLocaleString()}`,"#a78bfa"],["🏆 Life Score",`${lifeScore}/100`,"#4ade80"]].map(([label,val,color])=>(
                        <div key={label} style={{flex:1,background:"#080f1e",borderRadius:10,padding:"10px 12px",textAlign:"center",border:"1px solid #1a3356"}}>
                          <div style={{fontSize:15,fontWeight:800,color:color}}>{val}</div>
                          <div style={{fontSize:10,color:"#475569",marginTop:2}}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Stats row */}
              {hasStats && (
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
                  {[
                    ["Age", bs.age ? `${bs.age} yrs` : "—", "🎂", "#818cf8"],
                    ["Height", heightFt ? `${heightFt}'${heightIn}"` : "—", "📏", "#60a5fa"],
                    ["Current Weight", bs.current_weight ? `${bs.current_weight} lbs` : "—", "⚖️", "#4ade80"],
                    ["Goal Weight", bs.goal_weight ? `${bs.goal_weight} lbs` : "—", "🎯", "#facc15"],
                    ["BMI", bmi||"—", "📊", bmiColor],
                    ["Daily Calories", tdee ? `~${tdee.toLocaleString()}` : "—", "🔥", "#f97316"],
                  ].map(([label,val,icon,color])=>(
                    <div key={label} style={{background:"#080f1e",border:"1px solid #1a3356",borderRadius:14,padding:"14px 16px",textAlign:"center"}}>
                      <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
                      <div style={{fontSize:18,fontWeight:800,color:color}}>{val}</div>
                      <div style={{fontSize:11,color:"#475569",marginTop:3}}>{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Badges */}
              {progress.badges && progress.badges.length > 0 && (
                <div style={C.card}>
                  <div style={C.cTitle}>🏅 Badges Earned</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:8}}>
                    {progress.badges.map(bid=>{
                      const badge = BADGES.find(b=>b.id===bid);
                      if (!badge) return null;
                      return(
                        <div key={bid} title={badge.desc} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"8px 14px"}}>
                          <span style={{fontSize:20}}>{badge.icon}</span>
                          <div><div style={{fontSize:12,fontWeight:700,color:"#818cf8"}}>{badge.label}</div><div style={{fontSize:10,color:"#475569"}}>{badge.desc}</div></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Goals section */}
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={C.cTitle}>🎯 My Goals</div>
                  <button style={{...C.btn("#6366f1"),fontSize:11,padding:"5px 14px"}} onClick={()=>setShowAddGoal(true)}>+ Add Goal</button>
                </div>
                {goals.length === 0 ? (
                  <div style={{textAlign:"center",padding:"24px 0"}}>
                    <div style={{fontSize:36,marginBottom:10}}>🎯</div>
                    <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>No goals yet</div>
                    <div style={{fontSize:12,color:"#475569",marginBottom:16}}>Set a goal and track your progress here.</div>
                    <button style={C.btn("#6366f1")} onClick={()=>setShowAddGoal(true)}>+ Set Your First Goal</button>
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {/* Active goals */}
                    {goals.filter(g=>!g.completed).map(g=>{
                      const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current_value/g.target_value)*100)) : 0;
                      const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline)-new Date())/(1000*60*60*24)) : null;
                      const catColors = { fitness:"#4ade80", finance:"#60a5fa", health:"#f97316", personal:"#a78bfa" };
                      const col = catColors[g.category] || "#818cf8";
                      return (
                        <div key={g.id} style={{background:"#080f1e",border:"1px solid #1a3356",borderRadius:14,padding:"16px 18px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                            <div style={{flex:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                                <span style={{fontSize:11,fontWeight:700,color:col,background:`${col}18`,border:`1px solid ${col}30`,borderRadius:6,padding:"2px 8px",textTransform:"uppercase"}}>{g.category}</span>
                                {daysLeft !== null && <span style={{fontSize:11,color:daysLeft<=7?"#f87171":daysLeft<=14?"#facc15":"#475569"}}>{daysLeft > 0 ? `${daysLeft} days left` : "⚠ Overdue"}</span>}
                              </div>
                              <div style={{fontSize:16,fontWeight:800}}>{g.title}</div>
                            </div>
                            <div style={{display:"flex",gap:6,flexShrink:0}}>
                              <button onClick={()=>{setShowUpdateGoal(g);setGoalUpdateVal(String(g.current_value));}} style={{background:"rgba(99,102,241,0.15)",border:"1px solid #6366f1",color:"#818cf8",borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:700}}>Update</button>
                              <button onClick={()=>deleteGoal(g.id)} style={{background:"transparent",border:"1px solid #1a3356",color:"#475569",borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>×</button>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div style={{background:"#1e293b",borderRadius:99,height:10,overflow:"hidden",marginBottom:6}}>
                            <div style={{width:`${pct}%`,background:`linear-gradient(90deg,${col},${col}99)`,height:"100%",borderRadius:99,transition:"width 0.8s"}}/>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                            <span style={{color:"#64748b"}}>{g.current_value} / {g.target_value} {g.unit}</span>
                            <span style={{fontWeight:800,color:col}}>{pct}%</span>
                          </div>
                          {g.deadline && (
                            <div style={{fontSize:11,color:"#475569",marginTop:4}}>
                              Target: {new Date(g.deadline).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Completed goals */}
                    {goals.filter(g=>g.completed).length > 0 && (
                      <div>
                        <div style={{fontSize:11,color:"#4ade80",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10,marginTop:4}}>✅ Completed</div>
                        {goals.filter(g=>g.completed).map(g=>(
                          <div key={g.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:10,marginBottom:8,opacity:0.8}}>
                            <div>
                              <div style={{fontSize:13,fontWeight:700,color:"#4ade80"}}>✓ {g.title}</div>
                              <div style={{fontSize:11,color:"#475569"}}>{g.target_value} {g.unit} achieved</div>
                            </div>
                            <button onClick={()=>deleteGoal(g.id)} style={{background:"transparent",border:"none",color:"#334155",fontSize:16,cursor:"pointer"}}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!hasStats && (
                <div style={{...C.card,textAlign:"center",padding:"40px 20px"}}>
                  <div style={{fontSize:48,marginBottom:12}}>📊</div>
                  <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Set Up Your Body Profile</div>
                  <div style={{fontSize:13,color:"#475569",marginBottom:20,maxWidth:400,margin:"0 auto 20px"}}>Add your age, height, and weight to unlock BMI, calorie targets, and progress tracking.</div>
                  <button style={C.btn("#6366f1")} onClick={()=>{ setProfileForm({...bs}); setShowEditProfile(true); }}>+ Add Your Stats</button>
                </div>
              )}

              {/* Goal card */}
              {hasStats && bs.goal_type && (
                <div style={{...C.card}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                    <div>
                      <div style={C.cTitle}>Your Goal</div>
                      <div style={{fontSize:20,fontWeight:800,color:"#818cf8",marginTop:4}}>{goalTypes[bs.goal_type]||bs.goal_type}</div>
                      {bs.goal_label && <div style={{fontSize:13,color:"#94a3b8",marginTop:4}}>"{bs.goal_label}"</div>}
                    </div>
                    {bs.goal_date && (
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:11,color:"#64748b"}}>Target date</div>
                        <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{new Date(bs.goal_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
                        <div style={{fontSize:11,color:"#64748b",marginTop:2}}>
                          {Math.max(0,Math.ceil((new Date(bs.goal_date)-new Date())/(1000*60*60*24)))} days left
                        </div>
                      </div>
                    )}
                  </div>
                  {goalLbs && (
                    <>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}>
                        <span style={{color:"#64748b"}}>Need to {goalDir} <strong style={{color:"#e2e8f0"}}>{goalLbs} lbs</strong></span>
                        {weeklyChange && <span style={{color:"#4ade80"}}>~{Math.max(weeklyChange, 1600).toLocaleString()} cal/day target</span>}
                      </div>
                      <div style={{background:"#1e293b",borderRadius:99,height:10,overflow:"hidden",marginBottom:8}}>
                        {(() => {
                          const pct = startWeight && bs.goal_weight && bs.current_weight ?
                            Math.min(100, Math.max(0, Math.abs((bs.current_weight - startWeight) / (bs.goal_weight - startWeight)) * 100)) : 0;
                          return <div style={{width:`${pct}%`,background:"linear-gradient(90deg,#6366f1,#818cf8)",height:"100%",borderRadius:99,transition:"width 1s"}}/>;
                        })()}
                      </div>
                      {totalChange !== null && parseFloat(totalChange) !== 0 && (
                        <div style={{fontSize:12,color:goalDir==="lose"?(parseFloat(totalChange)<0?"#4ade80":"#f87171"):(parseFloat(totalChange)>0?"#4ade80":"#f87171")}}>
                          {parseFloat(totalChange) < 0 ? "▼" : "▲"} {Math.abs(totalChange)} lbs since you started
                        </div>
                      )}
                    </>
                  )}
                  {(bs.goal_type==="fat_loss"||bs.goal_type==="muscle_gain"||bs.goal_type==="general_fitness") && tdee && (
                    <div style={{marginTop:14}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
                        {bs.goal_type==="muscle_gain" ? [
                          ["Maintenance", tdee,      "#64748b", "maintain weight"],
                          ["Lean Bulk",   tdee+200,  "#818cf8", "~0.25 lb/week gain"],
                          ["Bulk",        tdee+400,  "#6366f1", "~0.5 lb/week gain"],
                        ] : bs.goal_type==="fat_loss" ? [
                          ["Maintenance", tdee,      "#64748b", "maintain weight"],
                          ["Mild Cut",    Math.max(tdee-300, 1600), "#facc15", "~0.5 lb/week loss"],
                          ["Moderate Cut",Math.max(tdee-500, 1600), "#818cf8", "~1 lb/week loss"],
                        ] : [
                          ["Light",       tdee-200,  "#64748b", "slight deficit"],
                          ["Maintenance", tdee,      "#4ade80", "maintain weight"],
                          ["Active",      tdee+200,  "#818cf8", "slight surplus"],
                        ]}.map(([label,cal,color,desc])=>(
                          <div key={label} style={{background:"#080f1e",border:"1px solid #1a3356",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                            <div style={{fontSize:16,fontWeight:800,color:color}}>{cal.toLocaleString()}</div>
                            <div style={{fontSize:11,color:"#94a3b8",marginTop:2,fontWeight:600}}>{label}</div>
                            <div style={{fontSize:10,color:"#475569",marginTop:1}}>{desc}</div>
                          </div>
                        ))}
                      </div>
                      {bs.goal_type==="fat_loss" && (
                        <div style={{background:"rgba(250,204,21,0.07)",border:"1px solid rgba(250,204,21,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#94a3b8",lineHeight:1.6}}>
                          ⚠️ <strong style={{color:"#facc15"}}>Never go below 1,600 cal/day</strong> without medical supervision. Aggressive cuts cause muscle loss and metabolic slowdown. Slow and steady wins.
                        </div>
                      )}
                      {bs.goal_type==="muscle_gain" && (
                        <div style={{background:"rgba(129,140,248,0.07)",border:"1px solid rgba(129,140,248,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#94a3b8",lineHeight:1.6}}>
                          💡 <strong style={{color:"#818cf8"}}>Lean bulking</strong> minimizes fat gain. A 200–400 cal surplus with consistent training is the sweet spot for most people.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Weight log */}
              {hasStats && (
                <div style={C.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <div style={C.cTitle}>⚖️ Weight Log</div>
                    <button style={{...C.btn("#6366f1"),fontSize:11,padding:"4px 12px"}} onClick={()=>setShowLogWeight(true)}>+ Log Weight</button>
                  </div>
                  {wLogSorted.length===0 ? (
                    <div style={{textAlign:"center",padding:"20px 0",color:"#475569",fontSize:13}}>No weight entries yet. Log your first weigh-in!</div>
                  ) : (
                    <>
                      {/* Mini chart */}
                      <div style={{position:"relative",height:120,marginBottom:16,paddingLeft:40}}>
                        {(() => {
                          const weights = wLogSorted.map(w=>w.weight);
                          const minW = Math.min(...weights) - 2;
                          const maxW = Math.max(...weights) + 2;
                          const range = maxW - minW || 1;
                          return (
                            <>
                              {[maxW, (maxW+minW)/2, minW].map((v,i)=>(
                                <div key={i} style={{position:"absolute",left:0,top:`${(i/2)*90}%`,fontSize:10,color:"#475569",transform:"translateY(-50%)"}}>{v.toFixed(0)}</div>
                              ))}
                              {weights.map((s,si)=>{
                                if(si===0) return null;
                                const x1=`${((si-1)/(weights.length-1||1))*100}%`,x2=`${(si/(weights.length-1||1))*100}%`;
                                const y1=`${((maxW-weights[si-1])/range)*90}%`,y2=`${((maxW-s)/range)*90}%`;
                                const col = goalDir==="lose"?(s<=weights[si-1]?"#4ade80":"#f87171"):(s>=weights[si-1]?"#4ade80":"#f87171");
                                return(
                                  <svg key={si} style={{position:"absolute",inset:0,width:"100%",height:"100%",overflow:"visible",pointerEvents:"none"}}>
                                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth="2" strokeLinecap="round"/>
                                    <circle cx={x2} cy={y2} r="4" fill={col}/>
                                  </svg>
                                );
                              })}
                              {bs.goal_weight && (
                                <div style={{position:"absolute",left:40,right:0,top:`${((maxW-bs.goal_weight)/range)*90}%`,height:1,background:"rgba(99,102,241,0.4)",borderTop:"1px dashed #6366f1"}}/>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      {/* Last 5 entries */}
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {[...wLogSorted].reverse().slice(0,5).map((entry,i)=>{
                          const prev = [...wLogSorted].reverse()[i+1];
                          const delta = prev ? (entry.weight - prev.weight).toFixed(1) : null;
                          const col = delta===null?"#64748b":goalDir==="lose"?(parseFloat(delta)<=0?"#4ade80":"#f87171"):(parseFloat(delta)>=0?"#4ade80":"#f87171");
                          return(
                            <div key={entry.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#080f1e",borderRadius:10}}>
                              <div style={{fontSize:13,color:"#94a3b8"}}>{new Date(entry.logged_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                {delta!==null && <div style={{fontSize:12,fontWeight:700,color:col}}>{parseFloat(delta)>0?"+":""}{delta} lbs</div>}
                                <div style={{fontSize:16,fontWeight:800,color:"#e2e8f0"}}>{entry.weight} lbs</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          );
        })()}

        {/* ── LEAGUE ── */}
        {tab==="league"&&(()=>{
          const sorted = [...leagueMembers].map(m => m.isYou ? {...m, score: myLeagueScore, name: username||"You", avatar: (username||"YO").slice(0,2).toUpperCase()} : m).sort((a,b)=>b.score-a.score);
          const myRank = sorted.findIndex(m=>m.isYou) + 1;
          const me = sorted.find(m=>m.isYou);
          const rankColor = (r) => r===1?"#facc15":r===2?"#94a3b8":r===3?"#cd7f32":"#4a7ab5";
          const rankMedal = (r) => r===1?"🥇":r===2?"🥈":r===3?"🥉":"";
          const scoreColor2 = (s) => s>=65?"#4ade80":s>=55?"#facc15":s>=45?"#f97316":"#f87171";
          const deltaColor = (d) => d>0?"#4ade80":d<0?"#f87171":"#64748b";
          const deltaIcon  = (d) => d>0?"▲":d<0?"▼":"—";
          const pct = (leagueWeek / leagueTotalWeeks) * 100;

          const postTrash = () => {
            if (!trashInput.trim()) return;
            setTrashTalk(p => [{id:Date.now(), from:username||"You", avatar:(username||"YO").slice(0,2).toUpperCase(), text:trashInput.trim(), time:"Just now", likes:0}, ...p]);
            setTrashInput("");
          };
          const copyToClipboard = (type) => {
            navigator.clipboard.writeText(type==="code"?LEAGUE_CODE:LEAGUE_LINK).catch(()=>{});
            setInviteCopied(type);
            setTimeout(()=>setInviteCopied(null), 2200);
          };

          return (
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              {/* Hero banner */}
              <div style={{background:"linear-gradient(135deg,#0e1a08,#1a2e0a)",border:"1px solid #2a4a1a",borderRadius:16,padding:"20px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
                <div>
                  <div style={{fontSize:11,color:"#4ade80",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>🏆 Life Score League — Season 1</div>
                  <div style={{fontSize:28,fontWeight:900}}>You're ranked <span style={{color:rankColor(myRank)}}>{myRank<=3?rankMedal(myRank):`#${myRank}`}</span> of {leagueMembers.length}</div>
                  <div style={{fontSize:13,color:"#64748b",marginTop:4}}>{leagueEndsIn} weeks left · Everyone starts at 50 · Private stats, public scores only</div>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                  <button style={{...C.btn("#059669"),fontSize:13}} onClick={()=>setShowInviteModal(true)}>+ Invite Friends</button>
                  <div style={{textAlign:"center",background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:12,padding:"8px 20px"}}>
                    <div style={{fontSize:11,color:"#4ade80",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Your Score</div>
                    <div style={{fontSize:28,fontWeight:900,color:scoreColor2(myLeagueScore)}}>{myLeagueScore}</div>
                  </div>
                </div>
              </div>

              {/* Season progress */}
              <div style={{...C.card,padding:"14px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontSize:12,color:"#64748b",fontWeight:700}}>Season Progress — Week {leagueWeek} of {leagueTotalWeeks}</div>
                  <div style={{fontSize:12,color:"#4ade80",fontWeight:700}}>{leagueEndsIn} weeks to go</div>
                </div>
                <div style={{background:"#1e293b",borderRadius:99,height:8,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,background:"linear-gradient(90deg,#4ade80,#22d3ee)",height:"100%",borderRadius:99}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#475569",marginTop:4}}>
                  <span>Start</span><span>Halfway</span><span>End 🏆</span>
                </div>
              </div>

              {/* Sub-nav */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[["leaderboard","🏅 Leaderboard"],["matchup","⚔️ Head-to-Head"],["history","📈 Score History"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setLeagueView(v)} style={{...C.ghost,color:leagueView===v?"#4ade80":"#64748b",border:`1px solid ${leagueView===v?"#4ade80":"#1a3356"}`,background:leagueView===v?"rgba(74,222,128,0.08)":"transparent",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:700}}>
                    {l}
                  </button>
                ))}
              </div>

              {/* LEADERBOARD */}
              {leagueView==="leaderboard"&&(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {sorted.map((m,i)=>{
                    const delta = m.score - (m.weeklyHistory?.[m.weeklyHistory.length-2]??50);
                    const isLeading = i===0;
                    return(
                      <div key={m.id} style={{background:m.isYou?"linear-gradient(145deg,#0a1e0f,#071510)":"linear-gradient(145deg,#0d1e35,#091629)",border:`1px solid ${m.isYou?"#1a4a2e":"#1a3356"}`,borderRadius:16,padding:"16px 20px",display:"flex",alignItems:"center",gap:16,position:"relative",overflow:"hidden"}}>
                        {isLeading&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#facc15,#f97316,#facc15)"}}/>}
                        <div style={{fontSize:24,width:36,textAlign:"center",flexShrink:0}}>{rankMedal(i+1)}</div>
                        <div style={{width:42,height:42,borderRadius:"50%",background:m.isYou?"linear-gradient(135deg,#1d4ed8,#4ade80)":"linear-gradient(135deg,#1a3356,#0f2240)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,flexShrink:0}}>{m.avatar}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                            <span style={{fontSize:15,fontWeight:800}}>{m.name}</span>
                            {m.isYou&&<span style={{fontSize:10,background:"rgba(74,222,128,0.15)",color:"#4ade80",padding:"2px 7px",borderRadius:99,fontWeight:700,border:"1px solid rgba(74,222,128,0.3)"}}>YOU</span>}
                            {isLeading&&!m.isYou&&<span style={{fontSize:10,background:"rgba(250,204,21,0.15)",color:"#facc15",padding:"2px 7px",borderRadius:99,fontWeight:700}}>LEADING</span>}
                          </div>
                          <div style={{fontSize:12,color:"#4a7ab5"}}>Top streak: <span style={{color:"#facc15",fontWeight:700}}>{m.streakHighlight}</span></div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:26,fontWeight:900,color:scoreColor2(m.score)}}>{m.score}</div>
                          <div style={{fontSize:12,fontWeight:700,color:deltaColor(delta)}}>{deltaIcon(delta)} {Math.abs(delta)} this wk</div>
                        </div>
                        <div style={{display:"flex",alignItems:"flex-end",gap:2,height:28,flexShrink:0}}>
                          {(m.weeklyHistory||[50]).map((s,si)=>{
                            const h = Math.max(4,Math.round(((s-45)/25)*26));
                            const isLast = si===(m.weeklyHistory.length-1);
                            return <div key={si} style={{width:6,height:h,borderRadius:"2px 2px 0 0",background:isLast?scoreColor2(s):"#1e3a5f"}}/>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* HEAD-TO-HEAD */}
              {leagueView==="matchup"&&(
                <div style={{display:"flex",flexDirection:"column",gap:18}}>
                  <div style={{fontSize:13,color:"#64748b"}}>Pick an opponent to compare your progress. Only Life Scores and streak highlights are visible — no personal finance or health data is shared.</div>
                  <div style={C.g()}>
                    {sorted.filter(m=>!m.isYou).map(opp=>{
                      const myS = myLeagueScore;
                      const diff = myS - opp.score;
                      const winning = diff >= 0;
                      return(
                        <div key={opp.id} onClick={()=>setSelectedMatchup(selectedMatchup===opp.id?null:opp.id)} style={{...C.card,cursor:"pointer",border:selectedMatchup===opp.id?"1px solid #4ade80":"1px solid #1a3356"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:selectedMatchup===opp.id?16:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:12}}>
                              <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#1a3356,#0f2240)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13}}>{opp.avatar}</div>
                              <div><div style={{fontSize:14,fontWeight:700}}>{opp.name}</div><div style={{fontSize:12,color:"#facc15"}}>{opp.streakHighlight}</div></div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:11,color:"#64748b"}}>Their score</div>
                              <div style={{fontSize:20,fontWeight:900,color:scoreColor2(opp.score)}}>{opp.score}</div>
                            </div>
                          </div>
                          {selectedMatchup===opp.id&&(
                            <div>
                              <div style={{background:"#080f1e",borderRadius:12,padding:"14px 16px",marginBottom:12}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                                  <div style={{textAlign:"center"}}><div style={{fontSize:11,color:"#4ade80",fontWeight:700,marginBottom:4}}>YOU</div><div style={{fontSize:32,fontWeight:900,color:scoreColor2(myS)}}>{myS}</div></div>
                                  <div style={{textAlign:"center"}}><div style={{fontSize:20,color:"#64748b"}}>⚔️</div><div style={{fontSize:13,fontWeight:800,color:winning?"#4ade80":"#f87171",marginTop:4}}>{winning?"You're ahead":"Behind by"} {Math.abs(diff)} pts</div></div>
                                  <div style={{textAlign:"center"}}><div style={{fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:4}}>{opp.name.split(" ")[0].toUpperCase()}</div><div style={{fontSize:32,fontWeight:900,color:scoreColor2(opp.score)}}>{opp.score}</div></div>
                                </div>
                                <div style={{marginBottom:8}}><div style={{fontSize:11,color:"#4a7ab5",marginBottom:4}}>You</div><div style={{background:"#1e293b",borderRadius:99,height:8,overflow:"hidden"}}><div style={{width:`${Math.min(100,myS)}%`,background:"#4ade80",height:"100%",borderRadius:99}}/></div></div>
                                <div><div style={{fontSize:11,color:"#4a7ab5",marginBottom:4}}>{opp.name}</div><div style={{background:"#1e293b",borderRadius:99,height:8,overflow:"hidden"}}><div style={{width:`${Math.min(100,opp.score)}%`,background:"#60a5fa",height:"100%",borderRadius:99}}/></div></div>
                              </div>
                              <div style={{fontSize:12,color:"#64748b",lineHeight:1.6,textAlign:"center"}}>
                                {winning?`You're ${diff} pts ahead of ${opp.name.split(" ")[0]}. Keep your streaks going! 🔥`:`${opp.name.split(" ")[0]} is ${-diff} pts ahead. Log your habits to close the gap! 💪`}
                              </div>
                            </div>
                          )}
                          {selectedMatchup!==opp.id&&<div style={{fontSize:12,color:"#4a7ab5",textAlign:"center",marginTop:10}}>Tap to compare →</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SCORE HISTORY */}
              {leagueView==="history"&&(
                <div style={C.card}>
                  <div style={C.cTitle}>Weekly Score History</div>
                  <div style={{marginBottom:16,fontSize:13,color:"#64748b"}}>All players start at 50. Scores reflect Life Score growth over the season.</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:18}}>
                    {sorted.map((m,i)=>{
                      const colors=["#4ade80","#facc15","#60a5fa","#f97316","#a78bfa"];
                      return(<div key={m.id} style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}><div style={{width:12,height:3,borderRadius:99,background:colors[i]}}/><span style={{color:m.isYou?"#4ade80":"#94a3b8",fontWeight:m.isYou?800:400}}>{m.name}{m.isYou?" (You)":""}</span></div>);
                    })}
                  </div>
                  <div style={{position:"relative",height:180,paddingLeft:32}}>
                    {[70,60,50,40].map(v=>(<div key={v} style={{position:"absolute",left:0,top:`${((70-v)/30)*100}%`,fontSize:10,color:"#475569",transform:"translateY(-50%)"}}>{v}</div>))}
                    {[70,60,50,40].map(v=>(<div key={v} style={{position:"absolute",left:32,right:0,top:`${((70-v)/30)*100}%`,height:1,background:"rgba(30,58,95,0.5)"}}/>))}
                    {sorted.map((m,mi)=>{
                      const colors=["#4ade80","#facc15","#60a5fa","#f97316","#a78bfa"];
                      const hist = m.isYou?[...(m.weeklyHistory||[50]).slice(0,-1),myLeagueScore]:(m.weeklyHistory||[50]);
                      return hist.map((s,si)=>{
                        if(si===0)return null;
                        const x1=`${((si-1)/(WEEKS.length-1))*100}%`,x2=`${(si/(WEEKS.length-1))*100}%`;
                        const y1=`${((70-hist[si-1])/30)*100}%`,y2=`${((70-s)/30)*100}%`;
                        return(<svg key={`${mi}-${si}`} style={{position:"absolute",inset:0,width:"100%",height:"100%",overflow:"visible",pointerEvents:"none"}}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors[mi]} strokeWidth={m.isYou?2.5:1.5} strokeLinecap="round"/><circle cx={x2} cy={y2} r={m.isYou?4:3} fill={colors[mi]}/></svg>);
                      });
                    })}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",paddingLeft:32,marginTop:8}}>
                    {WEEKS.map(w=><div key={w} style={{fontSize:10,color:"#475569",textAlign:"center"}}>{w}</div>)}
                  </div>
                </div>
              )}

              {/* LEAGUE CHAT */}
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={C.cTitle}>💬 League Chat</div>
                  <div style={{fontSize:11,color:"#4a7ab5"}}>{leagueMembers.length} members</div>
                </div>
                <div style={{display:"flex",gap:10,marginBottom:16}}>
                  <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#4ade80)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,flexShrink:0}}>{(username||"YO").slice(0,2).toUpperCase()}</div>
                  <div style={{flex:1,display:"flex",gap:8}}>
                    <input value={trashInput} onChange={e=>setTrashInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&postTrash()} placeholder="Talk your trash... or your motivation 😤" style={{...C.inp,flex:1,fontSize:13}}/>
                    <button style={{...C.btn("#1d4ed8"),padding:"8px 16px",fontSize:13}} onClick={postTrash}>Post</button>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {trashTalk.map(msg=>(
                    <div key={msg.id} style={{background:"#080f1e",borderRadius:12,padding:"12px 14px",border:"1px solid #0f2240"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                        <div style={{width:30,height:30,borderRadius:"50%",background:msg.isYou||msg.from===username?"linear-gradient(135deg,#1d4ed8,#4ade80)":"linear-gradient(135deg,#1a3356,#0f2240)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:11,flexShrink:0}}>{msg.avatar}</div>
                        <div style={{flex:1}}><span style={{fontSize:13,fontWeight:700,color:msg.from===username?"#4ade80":"#e2e8f0"}}>{msg.from}</span>{msg.from===username&&<span style={{fontSize:10,color:"#4ade80",marginLeft:6,fontWeight:600}}>you</span>}</div>
                        <span style={{fontSize:11,color:"#475569"}}>{msg.time}</span>
                      </div>
                      <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.5,marginBottom:8}}>{msg.text}</div>
                      <button onClick={()=>setTrashTalk(p=>p.map(m=>m.id===msg.id?{...m,likes:m.likes+1}:m))} style={{background:"transparent",border:"1px solid #1a3356",color:"#64748b",borderRadius:8,padding:"3px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>👍 {msg.likes}</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* INVITE MODAL */}
              {showInviteModal&&(
                <div style={C.overlay} onClick={()=>setShowInviteModal(false)}>
                  <div style={{...C.mbox,width:440}} onClick={e=>e.stopPropagation()}>
                    <div style={{fontSize:28,marginBottom:8}}>🏆</div>
                    <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Invite Friends to Your League</div>
                    <div style={{fontSize:13,color:"#64748b",marginBottom:20,lineHeight:1.6}}>Friends join and track their own private Life Score. Only scores and streak highlights are visible to the group — no personal finance or health data is ever shared.</div>
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:12,color:"#4a7ab5",fontWeight:700,marginBottom:8}}>League Code</div>
                      <div style={{display:"flex",gap:8}}>
                        <div style={{...C.inp,flex:1,fontSize:20,fontWeight:900,textAlign:"center",letterSpacing:4,color:"#4ade80",userSelect:"all"}}>{LEAGUE_CODE}</div>
                        <button style={{...C.btn("#059669"),padding:"8px 16px"}} onClick={()=>copyToClipboard("code")}>{inviteCopied==="code"?"✓ Copied!":"Copy"}</button>
                      </div>
                    </div>
                    <div style={{marginBottom:20}}>
                      <div style={{fontSize:12,color:"#4a7ab5",fontWeight:700,marginBottom:8}}>Invite Link</div>
                      <div style={{display:"flex",gap:8}}>
                        <div style={{...C.inp,flex:1,fontSize:12,color:"#60a5fa",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{LEAGUE_LINK}</div>
                        <button style={{...C.btn("#1d4ed8"),padding:"8px 16px"}} onClick={()=>copyToClipboard("link")}>{inviteCopied==="link"?"✓ Copied!":"Copy"}</button>
                      </div>
                    </div>
                    <div style={{background:"rgba(74,222,128,0.07)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#64748b",marginBottom:20,lineHeight:1.6}}>
                      🔒 <strong style={{color:"#94a3b8"}}>Privacy guarantee:</strong> Debt, income, credit score, and health data are never visible to other players. Only your Life Score and streak highlights are shared.
                    </div>
                    <button style={{...C.ghost,width:"100%",padding:"10px"}} onClick={()=>setShowInviteModal(false)}>Close</button>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

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




      {/* ── ADD GOAL MODAL ── */}
      {showAddGoal&&(
        <div style={C.overlay} onClick={()=>setShowAddGoal(false)}>
          <div style={{...C.mbox,width:460}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>🎯 Set a New Goal</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>Track any goal — fitness, money, health, or personal.</div>

            {/* Title */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>Goal title</div>
              <input value={newGoal.title} onChange={e=>setNewGoal(p=>({...p,title:e.target.value}))}
                placeholder='e.g. "Run a 5K" or "Save $10,000"'
                style={{...C.inp,width:"100%"}} autoFocus/>
            </div>

            {/* Category */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>Category</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                {[["fitness","🏃 Fitness","#4ade80"],["finance","💰 Finance","#60a5fa"],["health","❤️ Health","#f97316"],["personal","⭐ Personal","#a78bfa"]].map(([val,label,col])=>(
                  <button key={val} onClick={()=>setNewGoal(p=>({...p,category:val}))}
                    style={{background:newGoal.category===val?`${col}18`:"#080f1e",border:`1px solid ${newGoal.category===val?col:"#1a3356"}`,color:newGoal.category===val?col:"#64748b",borderRadius:10,padding:"8px 6px",cursor:"pointer",fontSize:12,fontWeight:700,textAlign:"center"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress values */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>Starting value</div>
                <input value={newGoal.current_value} onChange={e=>setNewGoal(p=>({...p,current_value:e.target.value}))}
                  placeholder="0" style={{...C.inp,width:"100%"}} type="number"/>
              </div>
              <div>
                <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>Target value *</div>
                <input value={newGoal.target_value} onChange={e=>setNewGoal(p=>({...p,target_value:e.target.value}))}
                  placeholder="100" style={{...C.inp,width:"100%"}} type="number"/>
              </div>
              <div>
                <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>Unit</div>
                <input value={newGoal.unit} onChange={e=>setNewGoal(p=>({...p,unit:e.target.value}))}
                  placeholder="lbs, $, km..." style={{...C.inp,width:"100%"}}/>
              </div>
            </div>

            {/* Deadline */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>Target date (optional)</div>
              <input value={newGoal.deadline} onChange={e=>setNewGoal(p=>({...p,deadline:e.target.value}))}
                style={{...C.inp,width:"100%"}} type="date"/>
            </div>

            {/* Quick templates */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>Quick templates</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {[
                  {title:"Run a 5K",category:"fitness",target_value:"5",unit:"km",current_value:"0"},
                  {title:"Save $10,000",category:"finance",target_value:"10000",unit:"$",current_value:"0"},
                  {title:"Lose 20 lbs",category:"fitness",target_value:"20",unit:"lbs",current_value:"0"},
                  {title:"Read 12 books",category:"personal",target_value:"12",unit:"books",current_value:"0"},
                  {title:"No missed workouts",category:"fitness",target_value:"30",unit:"days",current_value:"0"},
                ].map(t=>(
                  <button key={t.title} onClick={()=>setNewGoal(p=>({...p,...t}))}
                    style={{background:"#080f1e",border:"1px solid #1a3356",color:"#64748b",borderRadius:20,padding:"5px 12px",fontSize:11,cursor:"pointer",fontWeight:600}}>
                    {t.title}
                  </button>
                ))}
              </div>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#6366f1"),flex:1}} onClick={addGoal} disabled={!newGoal.title.trim()||!newGoal.target_value}>Add Goal →</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowAddGoal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPDATE GOAL PROGRESS MODAL ── */}
      {showUpdateGoal&&(
        <div style={C.overlay} onClick={()=>setShowUpdateGoal(null)}>
          <div style={{...C.mbox,width:360}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>📈 Update Progress</div>
            <div style={{fontSize:13,color:"#818cf8",fontWeight:700,marginBottom:4}}>{showUpdateGoal.title}</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Target: {showUpdateGoal.target_value} {showUpdateGoal.unit}</div>
            <div style={{position:"relative",marginBottom:6}}>
              <input value={goalUpdateVal} onChange={e=>setGoalUpdateVal(e.target.value)}
                placeholder={String(showUpdateGoal.current_value)}
                style={{...C.inp,width:"100%",fontSize:28,textAlign:"center",fontWeight:800}} type="number" autoFocus/>
            </div>
            <div style={{textAlign:"center",fontSize:12,color:"#475569",marginBottom:16}}>{showUpdateGoal.unit}</div>
            {/* Preview progress */}
            {goalUpdateVal && (
              <div style={{marginBottom:16}}>
                <div style={{background:"#1e293b",borderRadius:99,height:8,overflow:"hidden",marginBottom:4}}>
                  <div style={{width:`${Math.min(100,Math.round((parseFloat(goalUpdateVal)/showUpdateGoal.target_value)*100))}%`,background:"linear-gradient(90deg,#6366f1,#818cf8)",height:"100%",borderRadius:99}}/>
                </div>
                <div style={{textAlign:"center",fontSize:12,color:"#818cf8",fontWeight:700}}>
                  {Math.min(100,Math.round((parseFloat(goalUpdateVal)/showUpdateGoal.target_value)*100))}% complete
                  {parseFloat(goalUpdateVal)>=showUpdateGoal.target_value && <span style={{color:"#4ade80"}}> 🎉 Goal reached!</span>}
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#6366f1"),flex:1}} onClick={()=>updateGoalProgress(showUpdateGoal,goalUpdateVal)} disabled={!goalUpdateVal}>Save →</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowUpdateGoal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── XP POPUP ── */}
      {xpPopup&&(
        <div style={{position:"fixed",bottom:80,right:24,background:"linear-gradient(135deg,#1a1f3a,#0d1829)",border:"1px solid #6366f1",borderRadius:12,padding:"10px 18px",zIndex:9999,display:"flex",alignItems:"center",gap:10,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",animation:"slideIn 0.3s ease"}}>
          <span style={{fontSize:22}}>✨</span>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#818cf8"}}>+{xpPopup.amount} XP</div>
            <div style={{fontSize:11,color:"#64748b",textTransform:"capitalize"}}>{xpPopup.reason} logged</div>
          </div>
        </div>
      )}

      {/* ── LEVEL UP POPUP ── */}
      {levelUpPopup&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setLevelUpPopup(null)}>
          <div style={{background:"linear-gradient(135deg,#0d1829,#1a1040)",border:"2px solid #6366f1",borderRadius:20,padding:"40px 48px",textAlign:"center",maxWidth:360}}>
            <div style={{fontSize:64,marginBottom:12}}>{levelUpPopup.icon}</div>
            <div style={{fontSize:13,color:"#818cf8",fontWeight:700,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Level Up!</div>
            <div style={{fontSize:32,fontWeight:900,color:levelUpPopup.color,marginBottom:8}}>{levelUpPopup.name}</div>
            <div style={{fontSize:14,color:"#64748b",marginBottom:24}}>You've reached a new level. Keep the streak going!</div>
            <button style={C.btn("#6366f1")} onClick={()=>setLevelUpPopup(null)}>Let's Go 🚀</button>
          </div>
        </div>
      )}

      {/* ── EDIT PROFILE MODAL ── */}
      {showEditProfile&&(
        <div style={C.overlay} onClick={()=>setShowEditProfile(false)}>
          <div style={{...C.mbox,width:460,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>👤 Your Profile</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>Your stats are private — only you can see them.</div>

            {/* Basic stats */}
            <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Body Stats</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              {[["Age (years)","age","25"],["Height (inches)","height_in","70"],["Current Weight (lbs)","current_weight","175"],["Goal Weight (lbs)","goal_weight","160"]].map(([label,key,ph])=>(
                <div key={key}>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>{label}</div>
                  <input value={profileForm[key]||""} onChange={e=>setProfileForm(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}} type="number"/>
                </div>
              ))}
            </div>

            {/* Goal type */}
            <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Goal Type</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              {[["fat_loss","🔥 Fat Loss"],["muscle_gain","💪 Muscle Gain"],["general_fitness","🏃 General Fitness"],["maintenance","⚖️ Maintenance"],["custom","🎯 Custom Goal"]].map(([val,label])=>(
                <button key={val} onClick={()=>setProfileForm(p=>({...p,goal_type:val}))}
                  style={{background:profileForm.goal_type===val?"rgba(99,102,241,0.2)":"#080f1e",border:`1px solid ${profileForm.goal_type===val?"#6366f1":"#1a3356"}`,color:profileForm.goal_type===val?"#818cf8":"#64748b",borderRadius:10,padding:"10px 12px",cursor:"pointer",fontSize:13,fontWeight:profileForm.goal_type===val?700:400,textAlign:"left"}}>
                  {label}
                </button>
              ))}
            </div>

            {/* Custom goal label */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>Goal description (optional)</div>
              <input value={profileForm.goal_label||""} onChange={e=>setProfileForm(p=>({...p,goal_label:e.target.value}))} placeholder='e.g. "I want to reach 175 lbs by summer"' style={{...C.inp,width:"100%"}}/>
            </div>

            {/* Target date */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>Target date (optional)</div>
              <input value={profileForm.goal_date||""} onChange={e=>setProfileForm(p=>({...p,goal_date:e.target.value}))} style={{...C.inp,width:"100%"}} type="date"/>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#6366f1"),flex:1}} onClick={async()=>{ await saveBodyStats(profileForm); setShowEditProfile(false); }}>Save Profile →</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowEditProfile(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOG WEIGHT MODAL ── */}
      {showLogWeight&&(
        <div style={C.overlay} onClick={()=>setShowLogWeight(false)}>
          <div style={{...C.mbox,width:340}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>⚖️ Log Today's Weight</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Weigh yourself first thing in the morning for consistency.</div>
            <input value={logWeightVal} onChange={e=>setLogWeightVal(e.target.value)} placeholder="e.g. 174.5" style={{...C.inp,width:"100%",fontSize:24,textAlign:"center",fontWeight:800}} type="number" autoFocus/>
            <div style={{fontSize:11,color:"#475569",textAlign:"center",marginTop:6,marginBottom:16}}>lbs</div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#6366f1"),flex:1}} onClick={logWeight} disabled={!logWeightVal}>Save</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowLogWeight(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}


      {/* ── EDIT CREDIT DETAILS MODAL ── */}
      {showEditCreditDetails&&(
        <div style={C.overlay} onClick={()=>setShowEditCreditDetails(false)}>
          <div style={{...C.mbox,width:480,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>📋 Credit & Benefits Details</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>Used to calculate your real score breakdown and check benefit eligibility. Private — only you can see this.</div>

            <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Credit Card</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[["CC Balance ($)","cc_balance","2400"],["Credit Limit ($)","cc_limit","5000"]].map(([label,key,ph])=>(
                <div key={key}>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>{label}</div>
                  <input value={creditDetailForm[key]||""} onChange={e=>setCreditDetailForm(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}} type="number"/>
                </div>
              ))}
            </div>

            <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Credit History</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
              {[["Credit Age (yrs)","credit_age_years","4"],["# of Accounts","num_accounts","3"],["Hard Inquiries","hard_inquiries","1"]].map(([label,key,ph])=>(
                <div key={key}>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>{label}</div>
                  <input value={creditDetailForm[key]||""} onChange={e=>setCreditDetailForm(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}} type="number"/>
                </div>
              ))}
            </div>

            <div style={{fontSize:12,color:"#818cf8",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Benefits Eligibility Info</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>Household / family size</div>
              <input value={creditDetailForm.family_size||""} onChange={e=>setCreditDetailForm(p=>({...p,family_size:e.target.value}))} placeholder="1" style={{...C.inp,width:"100%"}} type="number"/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {[
                ["has_student_loans","I have student loans"],
                ["is_first_time_buyer","I am a first-time homebuyer (never owned a home)"],
                ["employer_has_401k","My employer offers a 401(k) or retirement plan"],
              ].map(([key,label])=>(
                <label key={key} style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",padding:"10px 14px",background:"#080f1e",borderRadius:10,border:`1px solid ${creditDetailForm[key]?"#6366f1":"#1a3356"}`}}>
                  <div onClick={()=>setCreditDetailForm(p=>({...p,[key]:!p[key]}))}
                    style={{width:20,height:20,borderRadius:5,border:`2px solid ${creditDetailForm[key]?"#6366f1":"#334155"}`,background:creditDetailForm[key]?"#6366f1":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
                    {creditDetailForm[key]&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}
                  </div>
                  <span style={{fontSize:13,color:creditDetailForm[key]?"#e2e8f0":"#64748b"}}>{label}</span>
                </label>
              ))}
            </div>

            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#6366f1"),flex:1}} onClick={async()=>{ await saveCreditDetails(creditDetailForm); setShowEditCreditDetails(false); }}>Save →</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowEditCreditDetails(false)}>Cancel</button>
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
// cache bust Thu Mar  5 13:15:05 PST 2026
