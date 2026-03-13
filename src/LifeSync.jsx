import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "./supabase";

const HABIT_TEMPLATES = [
  // Health
  { id:"gym",      label:"Gym / Workout",      icon:"·", category:"health",   target:5, unit:"times/week",  scorePerStreak:3 },
  { id:"water",    label:"Drink 8 Glasses",    icon:"", category:"health",   target:7, unit:"days/week",   scorePerStreak:2 },
  { id:"sleep",    label:"8 Hours Sleep",      icon:"", category:"health",   target:7, unit:"days/week",   scorePerStreak:2 },
  { id:"steps",    label:"10k Steps",          icon:"", category:"health",   target:5, unit:"times/week",  scorePerStreak:2 },
  { id:"stretch",  label:"Stretch / Yoga",     icon:"", category:"health",   target:5, unit:"times/week",  scorePerStreak:2 },
  { id:"doctor",   label:"Doctor Checkup",     icon:"🩺", category:"health",   target:1, unit:"per quarter", scorePerStreak:5 },
  { id:"nojunk",   label:"No Junk Food",       icon:"", category:"health",   target:5, unit:"days/week",   scorePerStreak:2 },
  { id:"vitamins", label:"Take Vitamins",      icon:"", category:"health",   target:7, unit:"days/week",   scorePerStreak:1 },
  // Finance
  { id:"cardpay",  label:"Credit Card Payment",icon:"", category:"finance",  target:1, unit:"per month",   scorePerStreak:4 },
  { id:"budget",   label:"Review Budget",      icon:"", category:"finance",  target:4, unit:"times/month", scorePerStreak:3 },
  { id:"savings",  label:"Add to Savings",     icon:"", category:"finance",  target:4, unit:"times/month", scorePerStreak:3 },
  { id:"noimpulse",label:"No Impulse Buys",    icon:"", category:"finance",  target:7, unit:"days/week",   scorePerStreak:3 },
  // Wellness
  { id:"meditate", label:"Meditate",           icon:"", category:"wellness", target:5, unit:"times/week",  scorePerStreak:2 },
  { id:"veggies",  label:"Eat Vegetables",     icon:"", category:"wellness", target:7, unit:"days/week",   scorePerStreak:2 },
  { id:"nosmoke",  label:"Smoke-Free Day",     icon:"", category:"wellness", target:7, unit:"days/week",   scorePerStreak:4 },
  { id:"journal",  label:"Journal / Reflect",  icon:"", category:"wellness", target:5, unit:"times/week",  scorePerStreak:2 },
  { id:"noalcohol",label:"Alcohol-Free Day",   icon:"", category:"wellness", target:5, unit:"days/week",   scorePerStreak:3 },
  { id:"reading",  label:"Read 20 Minutes",    icon:"", category:"wellness", target:5, unit:"times/week",  scorePerStreak:2 },
  { id:"coldshow", label:"Cold Shower",        icon:"", category:"wellness", target:3, unit:"times/week",  scorePerStreak:2 },
  { id:"gratitude",label:"Gratitude Practice", icon:"", category:"wellness", target:7, unit:"days/week",   scorePerStreak:2 },
];

const SUPP_ICONS = ["","","","","","·","","","","","",""];

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
      { label: "Financial Health", score: financeScore, max: 25, color: "#d4860a",
        detail: debtPenalty < 0 ? "Debt load pulling score down" : savings > 0 ? "Finances on track" : "Add your financial info",
        factors: [
          { text: totalDebt > 0 ? `Debt load ($${totalDebt.toLocaleString()})` : "No debt", pts: debtPenalty, bad: debtPenalty < 0 },
          { text: "Savings cushion", pts: savingsBonus, bad: false },
          { text: "Payment habits", pts: Math.round(paymentBonus), bad: false },
        ]
      },
      { label: "Health", score: healthScore, max: 25, color: "#c0392b",
        detail: overdueCheckups > 0 ? `${overdueCheckups} overdue checkup${overdueCheckups>1?"s":""}` : "Health tracking looks good",
        factors: [
          { text: overdueCheckups > 0 ? `${overdueCheckups} overdue checkup${overdueCheckups>1?"s":""}` : "No overdue checkups", pts: checkupPenalty, bad: overdueCheckups > 0 },
          { text: lowRefillMeds > 0 ? "Medication refill due soon" : "Medications on track", pts: medPenalty, bad: lowRefillMeds > 0 },
          { text: "Health habits", pts: habitBonus, bad: false },
        ]
      },
      { label: "Habits & Discipline", score: disciplineScore, max: 25, color: "#d4860a",
        detail: disciplineScore >= 15 ? "Strong consistency" : disciplineScore > 0 ? "Build more streaks" : "Start tracking habits",
        factors: habits.slice(0,4).map(h => {
          const t = HABIT_TEMPLATES.find(x => x.id === h.id);
          const pts = Math.min(h.streak * (t?.scorePerStreak||1) * 0.4, 4);
          return { text: `${t?.label||h.id} (${h.streak} streak)`, pts: Math.round(pts), bad: false };
        })
      },
      { label: "Wellbeing", score: wellbeingScore, max: 25, color: "#9a9590",
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
  const color = disp>=80?"#3a7d5c":disp>=60?"#d4860a":"#c0392b";
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="10"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-disp/100)}
        style={{transition:"stroke-dashoffset 0.1s"}}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{transform:`rotate(90deg)`,transformOrigin:`${size/2}px ${size/2}px`,
          fill:color,fontSize:size*0.21,fontWeight:700,fontFamily:"inherit"}}>
        {disp}
      </text>
    </svg>
  );
};

const Bar = ({ value, max, color="#d4860a", h=6 }) => (
  <div style={{background:"rgba(0,0,0,0.07)",borderRadius:99,height:h,overflow:"hidden"}}>
    <div style={{width:`${Math.min(100,(value/max)*100)}%`,background:color,height:"100%",borderRadius:99,transition:"width 0.8s ease"}}/>
  </div>
);

const Tag = ({ status }) => {
  const map = {eligible:["#e6f4ee","#3a7d5c"],check:["#fef3e2","#d4860a"],ineligible:["#f0f0ef","#9a9590"],paid:["#e6f4ee","#3a7d5c"],upcoming:["#fef3e2","#d4860a"],overdue:["#fde8e8","#c0392b"]};
  const [bg,fg] = map[status]||["#f0f0ef","#9a9590"];
  return <span style={{background:bg,color:fg,fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:99,textTransform:"uppercase",letterSpacing:"0.08em"}}>{status}</span>;
};

const HeatMap = ({ history }) => {
  const cells = [...history].slice(-28);
  while (cells.length < 28) cells.unshift(null);
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,14px)",gridTemplateRows:"repeat(7,14px)",gap:3}}>
      {cells.map((v,i) => (
        <div key={i} style={{width:14,height:14,borderRadius:3,
          background:v===null?"rgba(0,0,0,0.04)":v?"#d4860a":"rgba(0,0,0,0.08)",
          opacity:v===null?0.5:1}}/>
      ))}

    </div>
  );
};

const Flame = ({ streak }) => {
  const color = streak>=10?"#c0392b":streak>=5?"#d4860a":streak>=2?"#3a7d5c":"#9a9590";
  return (
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <span style={{fontSize:18,fontWeight:700,color:color,fontFamily:"'DM Serif Display',serif"}}>{streak}</span>
      <span style={{fontSize:10,color:"#9a9590",fontWeight:500,letterSpacing:"0.08em",textTransform:"uppercase"}}>day streak</span>
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
    bodyStats: { age:27, height_in:70, current_weight:182, goal_weight:170, goal_type:"fat_loss", goal_date:"2025-08-01", goal_label:"Summer cut", sex:"male", activity_level:"moderate" },
    weightLog: [
      {id:"w1",weight:192,logged_at:"2024-10-01"},{id:"w2",weight:189,logged_at:"2024-11-01"},
      {id:"w3",weight:187,logged_at:"2024-12-01"},{id:"w4",weight:185,logged_at:"2025-01-01"},
      {id:"w5",weight:183,logged_at:"2025-02-01"},{id:"w6",weight:182,logged_at:"2025-03-01"},
    ],
    goals: [
      {id:"g1",title:"Lose 12 lbs",category:"fitness",target_value:12,current_value:10,unit:"lbs",deadline:"2025-08-01",completed:false},
      {id:"g2",title:"Save $10k Emergency Fund",category:"finance",target_value:10000,current_value:4100,unit:"$",deadline:"2025-12-31",completed:false},
      {id:"g3",title:"Run a 5K",category:"fitness",target_value:1,current_value:0,unit:"races",deadline:"2025-06-01",completed:false},
      {id:"g4",title:"Read 12 Books",category:"wellness",target_value:12,current_value:4,unit:"books",deadline:"2025-12-31",completed:false},
    ],
    recoveryTrackers: [
      {id:"r1",name:"Lower Back Pain",type:"injury",severity:3,start_date:"2025-01-10",streak:48,notes:"Foam rolling daily, seeing PT weekly"},
      {id:"r2",name:"Alcohol-Free",type:"habit",severity:null,start_date:"2025-02-01",streak:34,notes:"Cutting back for 90 days"},
    ],
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
      {id:"s1",name:"Creatine",dose:"5g",timing:"Morning",icon:"·",streak:14,takenToday:false,history:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1]},
      {id:"s2",name:"Omega-3",dose:"1000mg",timing:"With meals",icon:"",streak:6,takenToday:false,history:[0,0,0,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,0,1]},
      {id:"s3",name:"Magnesium",dose:"400mg",timing:"Evening",icon:"",streak:3,takenToday:false,history:[0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,1,1,0,0,1,0,0,1,1,0,0,1,1]},
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
    bodyStats: { age:34, height_in:65, current_weight:138, goal_weight:145, goal_type:"muscle_gain", goal_date:"2025-10-01", goal_label:"Build lean muscle", sex:"female", activity_level:"moderate" },
    weightLog: [
      {id:"w1",weight:133,logged_at:"2024-10-01"},{id:"w2",weight:134,logged_at:"2024-11-01"},
      {id:"w3",weight:135,logged_at:"2024-12-01"},{id:"w4",weight:136,logged_at:"2025-01-01"},
      {id:"w5",weight:137,logged_at:"2025-02-01"},{id:"w6",weight:138,logged_at:"2025-03-01"},
    ],
    goals: [
      {id:"g1",title:"Max Out 401k",category:"finance",target_value:23000,current_value:8400,unit:"$",deadline:"2025-12-31",completed:false},
      {id:"g2",title:"Gain 7 lbs Muscle",category:"fitness",target_value:7,current_value:5,unit:"lbs",deadline:"2025-10-01",completed:false},
      {id:"g3",title:"Meditate 200 Days",category:"wellness",target_value:200,current_value:162,unit:"days",deadline:"2025-12-31",completed:false},
      {id:"g4",title:"Pay Off Car Loan",category:"finance",target_value:11400,current_value:4800,unit:"$",deadline:"2026-06-01",completed:false},
      {id:"g5",title:"Cook at Home 5x/week",category:"health",target_value:260,current_value:174,unit:"meals",deadline:"2025-12-31",completed:false},
    ],
    recoveryTrackers: [
      {id:"r1",name:"Caffeine-Free",type:"habit",severity:null,start_date:"2025-01-01",streak:68,notes:"Switched to herbal tea — energy is more stable"},
      {id:"r2",name:"Shoulder Strain",type:"injury",severity:2,start_date:"2025-02-14",streak:24,notes:"No overhead press, doing band work instead"},
      {id:"r3",name:"Sugar Reduction",type:"habit",severity:null,start_date:"2024-12-15",streak:85,notes:"No added sugar, fruit is fine"},
    ],
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
      {id:"s1",name:"Ashwagandha",dose:"600mg",timing:"Evening",icon:"",streak:21,takenToday:false,history:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1]},
      {id:"s2",name:"Lion's Mane",dose:"500mg",timing:"Morning",icon:"",streak:9,takenToday:false,history:[1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,0,1,1,1,1,1]},
      {id:"s3",name:"Vitamin C",dose:"1000mg",timing:"Morning",icon:"",streak:5,takenToday:false,history:[0,0,1,1,1,0,0,1,1,1,0,0,1,1,0,1,1,1,0,0,1,0,1,1,1,0,0,1]},
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
    bodyStats: { age:23, height_in:68, current_weight:210, goal_weight:185, goal_type:"fat_loss", goal_date:"2025-11-01", goal_label:"Get healthy", sex:"male", activity_level:"light" },
    weightLog: [
      {id:"w1",weight:218,logged_at:"2024-10-01"},{id:"w2",weight:217,logged_at:"2024-11-01"},
      {id:"w3",weight:215,logged_at:"2024-12-01"},{id:"w4",weight:214,logged_at:"2025-01-01"},
      {id:"w5",weight:212,logged_at:"2025-02-01"},{id:"w6",weight:210,logged_at:"2025-03-01"},
    ],
    goals: [
      {id:"g1",title:"Lose 25 lbs",category:"fitness",target_value:25,current_value:8,unit:"lbs",deadline:"2025-11-01",completed:false},
      {id:"g2",title:"Pay Off Credit Cards",category:"finance",target_value:4300,current_value:1100,unit:"$",deadline:"2025-12-31",completed:false},
      {id:"g3",title:"Walk 8k Steps Daily",category:"health",target_value:90,current_value:27,unit:"days",deadline:"2025-06-30",completed:false},
      {id:"g4",title:"Build $1k Emergency Fund",category:"finance",target_value:1000,current_value:850,unit:"$",deadline:"2025-06-01",completed:false},
    ],
    recoveryTrackers: [
      {id:"r1",name:"Smoking Cessation",type:"habit",severity:null,start_date:"2025-02-20",streak:18,notes:"Using nicotine patches, down from 1 pack/day"},
      {id:"r2",name:"Knee Inflammation",type:"injury",severity:4,start_date:"2025-01-05",streak:63,notes:"Icing after workouts, avoiding impact"},
    ],
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
      {id:"s1",name:"Vitamin D3",dose:"2000 IU",timing:"Morning",icon:"",streak:2,takenToday:false,history:[0,0,0,1,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1]},
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
  { id:"marcus", name:"Marcus T.",  avatar:"MT", score:58, prevScore:54, streakHighlight:"Budget 6",  weeklyHistory:[50,51,53,58], isYou:false },
  { id:"priya",  name:"Priya K.",   avatar:"PK", score:55, prevScore:56, streakHighlight:"Meditate 9",weeklyHistory:[50,52,56,55], isYou:false },
  { id:"deon",   name:"Deon W.",    avatar:"DW", score:62, prevScore:58, streakHighlight:"Water 14",  weeklyHistory:[50,54,58,62], isYou:false },
  { id:"sofia",  name:"Sofia R.",   avatar:"SR", score:47, prevScore:49, streakHighlight:"Sleep 5",   weeklyHistory:[50,48,49,47], isYou:false },
];
const INITIAL_TRASH_TALK = [
  { id:1, from:"Deon W.",  avatar:"DW", text:"Already at 62 and it's only week 4  y'all better catch up", time:"2h ago",  likes:3 },
  { id:2, from:"Priya K.", avatar:"PK", text:"My meditation streak is unmatched  9 days running",           time:"5h ago",  likes:2 },
  { id:3, from:"Marcus T.",avatar:"MT", text:"Budget habit finally clicking. Finance pillar up huge ",       time:"1d ago",  likes:4 },
  { id:4, from:"Sofia R.", avatar:"SR", text:"Rough week ngl. Life's been busy but I'm not out yet ",        time:"1d ago",  likes:5 },
];

const calcCreditFactors = (debts, habits, monthlyIncome, creditDetails={}) => {
  const payHabit = habits.find(h=>h.id==="cardpay");
  const payStreak = payHabit?.streak||0;
  const payValue = Math.min(100, 60 + payStreak * 2);
  const payColor = payValue>=80?"#3a7d5c":payValue>=60?"#d4860a":"#c0392b";
  const payDesc = payStreak>0 ? `${payStreak}-month on-time streak` : "No payment history logged yet";
  const ccBal = creditDetails.cc_balance>0 ? creditDetails.cc_balance : debts.filter(d=>(d.name||"").toLowerCase().includes("credit")||(parseFloat(d.apr)>15)).reduce((a,d)=>a+(d.balance||0),0);
  const ccLim = creditDetails.cc_limit>0 ? creditDetails.cc_limit : Math.max(ccBal*2, 5000);
  const utilPct = ccLim>0 ? Math.round((ccBal/ccLim)*100) : 0;
  const utilValue = Math.max(0, 100-utilPct);
  const utilColor = utilPct<=30?"#3a7d5c":utilPct<=50?"#d4860a":"#c0392b";
  const utilDesc = ccBal>0 ? `$${ccBal.toLocaleString()} / $${ccLim.toLocaleString()} limit (${utilPct}%)` : "No credit card debt — great!";
  const totalDebt = debts.reduce((a,d)=>a+(d.balance||0),0);
  const dti = monthlyIncome>0 ? Math.round((totalDebt/(monthlyIncome*12))*100) : 0;
  const dtiValue = Math.max(0, 100-dti);
  const dtiColor = dti<=20?"#3a7d5c":dti<=50?"#d4860a":"#c0392b";
  const dtiDesc = totalDebt>0 ? `$${totalDebt.toLocaleString()} total debt (${dti}% DTI)` : "No debt — excellent!";
  return [
    { label:"Payment History",    weight:35, value:payValue,  desc:payDesc,  color:payColor  },
    { label:"Credit Utilization", weight:30, value:utilValue, desc:utilDesc, color:utilColor },
    { label:"Debt-to-Income",     weight:20, value:dtiValue,  desc:dtiDesc,  color:dtiColor  },
    { label:"Credit Age",         weight:15,
      value: creditDetails.credit_age_years>=7?90:creditDetails.credit_age_years>=4?75:creditDetails.credit_age_years>=2?60:creditDetails.credit_age_years>0?45:72,
      desc: creditDetails.credit_age_years>0?`Avg account age: ${creditDetails.credit_age_years} yrs`:"Enter your credit age below",
      color: creditDetails.credit_age_years>=7?"#3a7d5c":creditDetails.credit_age_years>=4?"#d4860a":creditDetails.credit_age_years>0?"#d4860a":"#9a9590" },
    { label:"New Credit",         weight:10, value:90,        desc:"No hard inquiries (12mo)", color:"#d4860a" },
  ];
};

// ─── GAMIFICATION ────────────────────────────────────────────────────────────
const LEVELS = [
  { name:"Rookie",   minXP:0,    color:"#9a9590", icon:"" },
  { name:"Hustler",  minXP:500,  color:"#d4860a", icon:"" },
  { name:"Pro",      minXP:1500, color:"#d4860a", icon:"" },
  { name:"Elite",    minXP:3000, color:"#d4860a", icon:"" },
  { name:"Legend",   minXP:6000, color:"#3a7d5c", icon:"" },
];
const BADGES = [
  { id:"streak7",   label:"7-Day Streak",    icon:"·", desc:"Log 7 days in a row" },
  { id:"streak30",  label:"30-Day Streak",   icon:"·", desc:"Log 30 days in a row" },
  { id:"streak100", label:"100-Day Streak",  icon:"", desc:"Log 100 days in a row" },
  { id:"hustler",   label:"Hustler",         icon:"", desc:"Reached Hustler level" },
  { id:"pro",       label:"Pro",             icon:"", desc:"Reached Pro level" },
  { id:"elite",     label:"Elite",           icon:"", desc:"Reached Elite level" },
  { id:"legend",    label:"Legend",          icon:"", desc:"Reached Legend level" },
  { id:"first_log", label:"First Log",       icon:"✓", desc:"Logged your first activity" },
  { id:"week1",     label:"Week One",        icon:"", desc:"Used LifeSync for 7 days" },
];
const getLevel = (xp) => [...LEVELS].reverse().find(l => xp >= l.minXP) || LEVELS[0];
const getNextLevel = (xp) => LEVELS.find(l => l.minXP > xp) || null;
const XP_ACTIONS = { login:15, habit:10, mood:5, weight:5, supplement:3 };


// ─── GOAL CARD (reusable across tabs) ────────────────────────────────────────
function GoalCard({ g, onUpdate, onDelete, autoValue, autoLabel }) {
  const pct = g.target_value > 0 ? Math.min(100, Math.round(((autoValue ?? g.current_value) / g.target_value) * 100)) : 0;
  const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline) - new Date()) / (1000*60*60*24)) : null;
  const catColors = { fitness:"#3a7d5c", finance:"#d4860a", health:"#d4860a", personal:"#d4860a" };
  const col = catColors[g.category] || "#d4860a";
  const displayVal = autoValue ?? g.current_value;
  return (
    <div style={{background:"#f5f4f0",border:`1px solid ${col}22`,borderRadius:14,padding:"16px 18px",borderLeft:`3px solid ${col}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontSize:11,fontWeight:700,color:col,background:`${col}18`,border:`1px solid ${col}30`,borderRadius:6,padding:"2px 8px",textTransform:"uppercase"}}>{g.category}</span>
            {autoLabel && <span style={{fontSize:10,color:"#3a7d5c",fontWeight:600}}> auto-tracking</span>}
            {daysLeft !== null && <span style={{fontSize:11,color:daysLeft<=7?"#c0392b":daysLeft<=14?"#d4860a":"#9a9590"}}>{daysLeft > 0 ? `${daysLeft}d left` : " Overdue"}</span>}
          </div>
          <div style={{fontSize:15,fontWeight:800}}>{g.title}</div>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          {!autoLabel && <button onClick={()=>onUpdate(g)} style={{background:`${col}18`,border:`1px solid ${col}44`,color:col,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:700}}>Update</button>}
          <button onClick={()=>onDelete(g.id)} style={{background:"transparent",border:"1px solid rgba(0,0,0,0.08)",color:"#9a9590",borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>×</button>
        </div>
      </div>
      <div style={{background:"rgba(0,0,0,0.07)",borderRadius:99,height:8,overflow:"hidden",marginBottom:6}}>
        <div style={{width:`${pct}%`,background:`linear-gradient(90deg,${col},${col}88)`,height:"100%",borderRadius:99,transition:"width 0.8s"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:"#9a9590"}}>{displayVal.toLocaleString()} / {g.target_value.toLocaleString()} {g.unit}</span>
        <span style={{fontWeight:800,color:pct>=100?"#3a7d5c":col}}>{pct>=100?" Complete!":pct+"%"}</span>
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
  const openEditFinances = () => { setFinanceForm({income: monthlyIncome||"", expenses: monthlyExpenses||"", savings: savings||"", pay_freq: paySchedule.freq||"biweekly", pay_day1: String(paySchedule.day1||1), pay_day2: String(paySchedule.day2||15), pay_weekday: String(paySchedule.weekday||5), pay_start: paySchedule.startDate||""}); setShowEditFinances(true); };
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [showAddMed, setShowAddMed] = useState(false);
  const [showAddCheckup, setShowAddCheckup] = useState(false);
  const [newDebt, setNewDebt] = useState({name:"",balance:"",monthly_payment:"",apr:""});
  const [newBill, setNewBill] = useState({name:"",amount:"",due_day:"",status:"upcoming",category:"other",autopay:false});
  const [editBill, setEditBill] = useState(null);
  const [spendingView, setSpendingView] = useState("bar"); // "bar" | "pie"
  const [debtMethod, setDebtMethod] = useState("avalanche"); // "avalanche" | "snowball"
  const [showDebtPlanner, setShowDebtPlanner] = useState(false);
  const [cfMonth, setCfMonth] = useState(new Date().getMonth());
  const [paySchedule, setPaySchedule] = useState({ freq: "biweekly", day1: 1, day2: 15, weekday: 5, startDate: "" });
  // freq: "weekly" | "biweekly" | "semimonthly" | "monthly"
  // semimonthly: day1 + day2 each month
  // monthly: day1 only
  // weekly/biweekly: weekday (1=Mon..5=Fri) + startDate to anchor
  const [newMed, setNewMed] = useState({name:"",dose:"",schedule:"Daily",refill_days:30});
  const [newCheckup, setNewCheckup] = useState({name:"",last_date:"",urgent:false});
  const [financeForm, setFinanceForm] = useState({income:"",expenses:"",savings:"",pay_freq:"biweekly",pay_day1:"1",pay_day2:"15",pay_weekday:"5",pay_start:""});
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
  const [newSupp, setNewSupp] = useState({ name:"", dose:"", timing:"Morning", icon:"" });
  const [suppJustLogged, setSuppJustLogged] = useState(null);
  const [username, setUsername] = useState(isDemo ? DEMO.username : "");
  const [avatarUrl, setAvatarUrl] = useState(null); // base64 or data URL
  // ── GAMIFICATION STATE ──
  const [progress, setProgress] = useState({ xp:0, level:"Rookie", daily_streak:0, longest_streak:0, last_active_date:null, badges:[] });
  const [xpPopup, setXpPopup] = useState(null); // { amount, reason }
  const [levelUpPopup, setLevelUpPopup] = useState(null);

  // ── BODY STATS & PROFILE ──
  const [bodyStats, setBodyStats] = useState(isDemo && DEMO.bodyStats ? DEMO.bodyStats : { age:"", height_in:"", current_weight:"", goal_weight:"", goal_type:"fat_loss", goal_date:"", goal_label:"", sex:"male", activity_level:"moderate" });
  const [weightLog, setWeightLog] = useState(isDemo && DEMO.weightLog ? DEMO.weightLog : []);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(isDemo && DEMO.bodyStats ? {...DEMO.bodyStats, age:String(DEMO.bodyStats.age||""), height_in:String(DEMO.bodyStats.height_in||""), current_weight:String(DEMO.bodyStats.current_weight||""), goal_weight:String(DEMO.bodyStats.goal_weight||"")} : { age:"", height_in:"", current_weight:"", goal_weight:"", goal_type:"fat_loss", goal_date:"", goal_label:"", sex:"male", activity_level:"moderate" });
  const [logWeightVal, setLogWeightVal] = useState("");
  // ── GOALS STATE ──
  const [goals, setGoals] = useState(isDemo && DEMO.goals ? DEMO.goals : []);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showUpdateGoal, setShowUpdateGoal] = useState(null); // goal object
  const [goalUpdateVal, setGoalUpdateVal] = useState("");
  const [newGoal, setNewGoal] = useState({ title:"", category:"fitness", current_value:"0", target_value:"", unit:"", deadline:"" });
  const [recoveryTrackers, setRecoveryTrackers] = useState(isDemo && DEMO.recoveryTrackers ? DEMO.recoveryTrackers : []);
  const [showAddRecovery, setShowAddRecovery] = useState(false);
  const [habitTab, setHabitTab] = useState("templates"); // "templates" | "custom"
  const [customHabit, setCustomHabit] = useState({ label:"", icon:"⭐", target:"5", unit:"times/week" });
  const [editHabit, setEditHabit] = useState(null); // habit object being edited
  const [deleteHabitId, setDeleteHabitId] = useState(null);
  const [newRecovery, setNewRecovery] = useState({ substance:"alcohol", custom:"", start_date: new Date().toISOString().split("T")[0] });

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
    {role:"assistant",text:"Hi!  Welcome to LifeSync. Ask me anything about your habits, finances, or health — I'm here to help you grow your Life Score."}
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  // ── COACH STATE ──
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachMsgs, setCoachMsgs] = useState([]);
  const [coachInput, setCoachInput] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachPulse, setCoachPulse] = useState(true);
  const [coachInsight, setCoachInsight] = useState("");
  const [coachInsightLoading, setCoachInsightLoading] = useState(false);
  const [coachInsightDismissed, setCoachInsightDismissed] = useState(false);
  const coachBottomRef = useRef(null);
  const coachInputRef = useRef(null);
  // ── DAILY BRIEFING STATE ──
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingDate, setBriefingDate] = useState(null);
  const [briefingExpanded, setBriefingExpanded] = useState(false);
  const [briefingDismissed, setBriefingDismissed] = useState(false);
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
        const today = new Date();
        const dow = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
        startOfWeek.setHours(0,0,0,0);
        const todayStr = new Date().toISOString().split('T')[0];
        const mapped = habitsData.map(h => {
          const lastReset = h.last_week_reset ? new Date(h.last_week_reset) : null;
          const isNewWeek = !lastReset || lastReset < startOfWeek;
          return {
            id: h.name,
            streak: h.streak || 0,
            weekCount: isNewWeek ? 0 : (h.week_count || 0),
            history: h.history ? JSON.parse(h.history) : Array(28).fill(0),
            active: true,
            _dbId: h.id,
            // Restore custom habit fields if stored
            ...(h.label ? { label: h.label, icon: h.icon, target: h.target, unit: h.unit } : {}),
            lastLoggedDate: h.last_completed || null,
            completed: h.last_completed === todayStr,
          };
        });
        setHabits(mapped);
      }

      // Load mood history (last 28 entries for chart)
      const { data: moodData } = await supabase
        .from("moods")
        .select("*")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: true })
        .limit(56);
      if (moodData && moodData.length > 0) {
        const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const mapped = moodData.map(m => ({
          day: days[new Date(m.logged_at).getDay()],
          score: m.score,
          date: m.logged_at.split("T")[0],
          note: m.note || "",
        }));
        setMoodHistory(mapped);
      }
      // Always separately check if mood logged today (regardless of limit)
      // Use local date boundaries to handle all timezones correctly
      const nowLocal = new Date();
      const localMidnightStart = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 0, 0, 0);
      const localMidnightEnd = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 23, 59, 59);
      const { data: todayMoodRows } = await supabase
        .from("moods")
        .select("id, score, note")
        .eq("user_id", user.id)
        .gte("logged_at", localMidnightStart.toISOString())
        .lte("logged_at", localMidnightEnd.toISOString())
        .order("logged_at", { ascending: false })
        .limit(1);
      if (todayMoodRows && todayMoodRows.length > 0) {
        setTodayMood(todayMoodRows[0].score);
        setMoodLogged(true);
      }

      // Load finances
      const { data: finData } = await supabase
        .from("finances").select("*").eq("user_id", user.id).maybeSingle();
      if (finData) {
        if (finData.credit_score) setCreditScore(finData.credit_score);
        if (finData.monthly_income) setMonthlyIncome(finData.monthly_income);
        if (finData.monthly_expenses) setMonthlyExpenses(finData.monthly_expenses);
        if (finData.savings) setSavings(finData.savings);
        if (finData.pay_freq) setPaySchedule({ freq: finData.pay_freq, day1: finData.pay_day1||1, day2: finData.pay_day2||15, weekday: finData.pay_weekday||5, startDate: finData.pay_start||"" });
        setFinanceForm({ income: finData.monthly_income||"", expenses: finData.monthly_expenses||"", savings: finData.savings||"", pay_freq: finData.pay_freq||"biweekly", pay_day1: String(finData.pay_day1||1), pay_day2: String(finData.pay_day2||15), pay_weekday: String(finData.pay_weekday||5), pay_start: finData.pay_start||"" });
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
        // Use LOCAL date (not UTC) to avoid timezone causing stale resets
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
        setSupplements(suppData.map(s => {
          // Reset taken_today if last taken was before today
          const takenToday = s.last_taken_date === today ? s.taken_today : false;
          // If stale, reset in DB silently
          if (s.taken_today && s.last_taken_date !== today) {
            supabase.from("supplements").update({ taken_today: false }).eq("id", s.id);
          }
          return { ...s, takenToday, history: Array(28).fill(0) };
        }));
      }

      // Load recovery trackers
      const { data: recoveryData } = await supabase.from("recovery_trackers").select("*").eq("user_id", user.id).order("created_at");
      if (recoveryData) setRecoveryTrackers(recoveryData);

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
        .select("username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        if (profile.username) setUsername(profile.username);
        if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
      }
    };
    loadData();
  }, [user]);

  // Award daily login XP whenever progress loads and it's a new day
  useEffect(() => { if (user && progress.xp !== undefined) awardDailyLogin(); }, [progress.last_active_date, user]);

  // ── MIDNIGHT SUPPLEMENT RESET ───────────────────────────────────────────────
  useEffect(() => {
    const getMsUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      return midnight - now;
    };
    let timer;
    const scheduleReset = () => {
      timer = setTimeout(() => {
        // Reset state
        setSupplements(prev => prev.map(s => ({ ...s, takenToday: false })));
        // Reset in Supabase
        if (user) {
          supabase.from("supplements").update({ taken_today: false }).eq("user_id", user.id);
        }
        // Reschedule for next midnight
        scheduleReset();
      }, getMsUntilMidnight());
    };
    scheduleReset();
    return () => clearTimeout(timer);
  }, [user]);

  // ── SUPABASE: Save mood when logged ────────────────────────────────────────
  const saveMood = async (score, note) => {
    if (!user) return;
    const nowLocal = new Date();
    const localMidnightStart = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 0, 0, 0);
    const localMidnightEnd = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 23, 59, 59);
    // Check if already logged today — update instead of inserting a new row
    const { data: existingRows } = await supabase
      .from("moods")
      .select("id")
      .eq("user_id", user.id)
      .gte("logged_at", localMidnightStart.toISOString())
      .lte("logged_at", localMidnightEnd.toISOString())
      .order("logged_at", { ascending: false })
      .limit(1);
    if (existingRows && existingRows.length > 0) {
      await supabase.from("moods").update({ score, note: note || null }).eq("id", existingRows[0].id);
    } else {
      await supabase.from("moods").insert([{ user_id: user.id, score, note: note || null }]);
      awardXP("mood");
    }
  };

  // ── SUPABASE: Save habit log ────────────────────────────────────────────────
  const saveHabit = async (habitId, streak, weekCount, history, extraMeta) => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const dow = new Date().getDay();
    const startOfWeek = new Date();
    startOfWeek.setDate(new Date().getDate() - (dow === 0 ? 6 : dow - 1));
    startOfWeek.setHours(0,0,0,0);
    const historyJson = JSON.stringify((history || []).slice(-28));
    const { data: existing } = await supabase
      .from("habits")
      .select("id, last_week_reset")
      .eq("user_id", user.id)
      .eq("name", habitId)
      .maybeSingle();
    const isNewWeek = !existing?.last_week_reset || new Date(existing.last_week_reset) < startOfWeek;
    const payload = {
      completed: true,
      streak,
      week_count: weekCount,
      history: historyJson,
      last_completed: today,
      last_week_reset: isNewWeek ? startOfWeek.toISOString().split("T")[0] : existing?.last_week_reset,
    };
    // Persist label/icon/target/unit — passed explicitly to avoid stale closure
    if (extraMeta) {
      if (extraMeta.label) payload.label = extraMeta.label;
      if (extraMeta.icon)  payload.icon  = extraMeta.icon;
      if (extraMeta.target) payload.target = extraMeta.target;
      if (extraMeta.unit)  payload.unit  = extraMeta.unit;
    }
    if (existing) {
      await supabase.from("habits").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("habits").insert([{ user_id: user.id, name: habitId, completed: true, ...payload }]);
    }
    awardXP("habit");
  };

  // ── GOALS CRUD ────────────────────────────────────────────────────────────────
  const addRecovery = async () => {
    if (!user) return;
    const label = newRecovery.substance === "custom" ? newRecovery.custom.trim() : {
      alcohol:"Alcohol", nicotine:"Nicotine / Vaping", drugs:"Drugs",
      gambling:"Gambling", social:"Social Media / Phone"
    }[newRecovery.substance];
    if (!label) return;
    const icon = { alcohol:"", nicotine:"", drugs:"", gambling:"", social:"", custom:"" }[newRecovery.substance] || "";
    const { data } = await supabase.from("recovery_trackers")
      .insert([{ user_id: user.id, label, icon, start_date: newRecovery.start_date, best_streak: 0 }])
      .select().single();
    if (data) setRecoveryTrackers(p => [...p, data]);
    setShowAddRecovery(false);
    setNewRecovery({ substance:"alcohol", custom:"", start_date: new Date().toISOString().split("T")[0] });
  };

  const resetRecovery = async (tracker) => {
    const currentStreak = Math.floor((new Date() - new Date(tracker.start_date)) / (1000*60*60*24));
    const newBest = Math.max(tracker.best_streak || 0, currentStreak);
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("recovery_trackers")
      .update({ start_date: today, best_streak: newBest })
      .eq("id", tracker.id).select().single();
    if (data) setRecoveryTrackers(p => p.map(t => t.id === tracker.id ? data : t));
  };

  const deleteRecovery = async (id) => {
    await supabase.from("recovery_trackers").delete().eq("id", id);
    setRecoveryTrackers(p => p.filter(t => t.id !== id));
  };

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
    const updated = { ...goal, current_value: v, completed };
    if (user) await supabase.from("goals").update({ current_value: v, completed }).eq("id", goal.id);
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
      sex: form.sex||"male",
      activity_level: form.activity_level||"moderate",
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

  const saveFinances = async (income, expenses, sav, payForm) => {
    if (!user) return;
    const inc = parseFloat(income)||0;
    const exp = parseFloat(expenses)||0;
    const savAmt = parseFloat(sav)||0;
    const newSchedule = payForm ? { freq: payForm.pay_freq, day1: parseInt(payForm.pay_day1)||1, day2: parseInt(payForm.pay_day2)||15, weekday: parseInt(payForm.pay_weekday)||5, startDate: payForm.pay_start||"" } : paySchedule;
    if (payForm) setPaySchedule(newSchedule);
    const { error } = await supabase.from("finances").upsert(
      { user_id: user.id, monthly_income: inc, monthly_expenses: exp, savings: savAmt, pay_freq: newSchedule.freq, pay_day1: newSchedule.day1, pay_day2: newSchedule.day2, pay_weekday: newSchedule.weekday, pay_start: newSchedule.startDate, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (!error) {
      setMonthlyIncome(inc);
      setMonthlyExpenses(exp);
      setSavings(savAmt);
      // Auto-sync finance savings goals so Overview + Finances tab stay in sync
      setGoals(prev => prev.map(g => {
        if (g.category === "finance" && (g.unit === "$" || g.title.toLowerCase().includes("save"))) {
          const completed = savAmt >= g.target_value;
          supabase.from("goals").update({ current_value: savAmt, completed, updated_at: new Date().toISOString() }).eq("id", g.id);
          return { ...g, current_value: savAmt, completed };
        }
        return g;
      }));
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
    const { data } = await supabase.from("bills").insert([{ user_id: user.id, name: newBill.name, amount: parseFloat(newBill.amount)||0, due_day: parseInt(newBill.due_day)||1, status: newBill.status, category: newBill.category||"other", autopay: newBill.autopay||false }]).select().single();
    if (data) setBills(p => [...p, data]);
    setNewBill({name:"",amount:"",due_day:"",status:"upcoming"}); setShowAddBill(false);
  };

  const removeBill = async (id) => {
    await supabase.from("bills").delete().eq("id", id);
    setBills(p => p.filter(b => b.id !== id));
  };
  const updateBill = async (bill) => {
    const updates = { name: bill.name, amount: parseFloat(bill.amount)||0, due_day: parseInt(bill.due_day)||1, status: bill.status, category: bill.category||"other", autopay: bill.autopay||false };
    if (user) await supabase.from("bills").update(updates).eq("id", bill.id);
    setBills(p => p.map(b => b.id === bill.id ? { ...b, ...updates } : b));
    setEditBill(null);
  };
  const markBillPaid = async (id) => {
    if (user) await supabase.from("bills").update({ status: "paid" }).eq("id", id);
    setBills(p => p.map(b => b.id === id ? { ...b, status: "paid" } : b));
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

  const tmpl = id => {
    const preset = HABIT_TEMPLATES.find(t => t.id === id);
    if (preset) return preset;
    // Custom habit — data stored on the habit object itself
    const h = habits.find(h => h.id === id);
    if (h && h.label) return { id, label: h.label, icon: h.icon||"⭐", target: h.target||5, unit: h.unit||"times/week", scorePerStreak: 2, custom: true };
    return null;
  };
  const hdata = id => habits.find(h => h.id === id);

  const logHabit = (id, count) => {
    const today = new Date().toISOString().split('T')[0];
    const habit = habits.find(h => h.id === id);
    if (habit?.lastLoggedDate === today) return;
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h;
      const t = tmpl(id);
      const newCount = Math.min(h.weekCount + count, t.target * 2);
      const weekDone = newCount >= t.target;
      // Streak increments on every log (each day/session counts)
      const newStreak = h.streak + 1;
      const newHistory = [...h.history, 1].slice(-28);
      saveHabit(id, newStreak, newCount, newHistory, { label:h.label, icon:h.icon, target:h.target, unit:h.unit });
      return { ...h, weekCount: newCount, streak: newStreak, history: newHistory, lastLoggedDate: today };
    }));
    setJustLogged(id);
    setTimeout(() => setJustLogged(null), 2200);
    setLogModal(null); setLogVal(1);
  };

  const addHabit = async id => {
    if (habits.find(h => h.id === id)) return;
    const today = new Date().toISOString().split("T")[0];
    const emptyHistory = JSON.stringify(Array(28).fill(0));
    const t = HABIT_TEMPLATES.find(t => t.id === id);
    const extraCols = t ? { label: t.label, icon: t.icon, target: t.target, unit: t.unit } : {};
    if (user) {
      const { data } = await supabase.from("habits")
        .insert([{ user_id: user.id, name: id, streak: 0, week_count: 0, history: emptyHistory, last_completed: today, last_week_reset: today, completed: false, ...extraCols }])
        .select().single();
      if (data) setHabits(p => [...p, { id, streak:0, weekCount:0, history:Array(28).fill(0), active:true, _dbId: data.id, ...extraCols }]);
    } else {
      setHabits(p => [...p, { id, streak:0, weekCount:0, history:Array(28).fill(0), active:true, ...extraCols }]);
    }
    setShowAdd(false);
  };

  const addCustomHabit = async () => {
    if (!customHabit.label.trim()) return;
    const id = "custom_" + Date.now();
    const today = new Date().toISOString().split("T")[0];
    const emptyHistory = JSON.stringify(Array(28).fill(0));
    const target = parseInt(customHabit.target) || 5;
    const newH = { id, label: customHabit.label.trim(), icon: customHabit.icon, target, unit: customHabit.unit, streak:0, weekCount:0, history:Array(28).fill(0), active:true };
    if (user) {
      const { data } = await supabase.from("habits")
        .insert([{ user_id: user.id, name: id, streak: 0, week_count: 0, history: emptyHistory, last_completed: today, last_week_reset: today, completed: false, label: newH.label, icon: newH.icon, target, unit: newH.unit }])
        .select().single();
      if (data) setHabits(p => [...p, { ...newH, _dbId: data.id }]);
    } else {
      setHabits(p => [...p, newH]);
    }
    setCustomHabit({ label:"", icon:"⭐", target:"5", unit:"times/week" });
    setHabitTab("templates");
    setShowAdd(false);
  };

  const saveEditHabit = async () => {
    if (!editHabit || !editHabit.label.trim()) return;
    const target = parseInt(editHabit.target) || 5;
    const updates = { label: editHabit.label.trim(), icon: editHabit.icon, target, unit: editHabit.unit };
    if (user) {
      await supabase.from("habits").update(updates).eq("user_id", user.id).eq("name", editHabit.id);
    }
    setHabits(p => p.map(h => h.id === editHabit.id ? { ...h, ...updates } : h));
    setEditHabit(null);
  };

  const confirmDeleteHabit = async (id) => {
    if (user) await supabase.from("habits").delete().eq("user_id", user.id).eq("name", id);
    setHabits(p => p.filter(h => h.id !== id));
    setDeleteHabitId(null);
  };

  const takeSupp = async (id) => {
    const newStreak = (supplements.find(s=>s.id===id)?.streak||0) + 1;
    // Use local date to avoid UTC timezone mismatch
    const _now = new Date();
    const todayDate = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}`;
    if (user) await supabase.from("supplements").update({ streak: newStreak, taken_today: true, last_taken_date: todayDate }).eq("id", id);
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
    setNewSupp({ name:"", dose:"", timing:"Morning", icon:"" });
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
  const scColor = (s) => s>=740?"#3a7d5c":s>=670?"#d4860a":s>=580?"#d4860a":"#c0392b";

  const logMood = () => {
    if (!todayMood) return;
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const todayStr = new Date().toISOString().split("T")[0];
    const todayDay = days[new Date().getDay()];
    setMoodHistory(prev => {
      // Replace today's entry if it exists, otherwise append
      const withoutToday = prev.filter(m => m.date !== todayStr);
      return [...withoutToday, { day: todayDay, score: todayMood, date: todayStr, note: todayNote || "" }];
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
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 500,
          system: `You are a warm, empathetic wellness companion inside the LifeSync app. The user just completed a mental wellness check-in. Respond with 3–4 sentences: acknowledge their results gently, validate how they're feeling, offer one small actionable suggestion for today, and remind them you're here to talk. Keep it warm, human, and never clinical. Never diagnose. Always end by saying they can chat with you anytime in the AI tab.`,
          messages: [{ role: "user", content: `My mood today: ${todayMood}/10. PHQ-2 score: ${phqTotal}/6 (${phqRisk} depression indicators). GAD-2 score: ${gadTotal}/6 (${gadRisk} anxiety indicators). My note: "${todayNote || "no note"}". Please give me a short, warm, personalized response.` }]
        })
      });
      const d = await res.json();
      setWellnessMsg(d.content?.map(b => b.text||"").join("") || "Thank you for checking in. Remember, small steps every day add up.");
    } catch { setWellnessMsg("Thanks for checking in today. Whatever you're feeling is valid. Take it one moment at a time. "); }
    setWellnessAiLoading(false);
  };

  const resetCheckIn = () => { setCheckInStep(0); setPhqAnswers([null,null]); setGadAnswers([null,null]); setCheckInResults(null); setWellnessMsg(null); setTodayNote(""); /* keep todayMood + moodLogged if already logged today */ };

  // ── REAL DATA INSIGHTS ENGINE ────────────────────────────────────────────────
  const computeInsights = () => {
    const results = [];
    const validMoods = moodHistory.filter(d => d.score !== null && d.score !== undefined);

    if (validMoods.length < 3) {
      return [{
        icon: "", type: "info", color: "#9a9590",
        text: "Log your mood for at least 3 days to start seeing personalized patterns.",
        recommendation: "Go to Wellness → Log Mood to get started.",
        tag: null,
      }];
    }

    const today = new Date();
    const recentMoodAvg = validMoods.slice(-7).reduce((a,b)=>a+b.score,0) / Math.min(validMoods.slice(-7).length, 7);

    // ── Mood trend: last 7 vs prior 7 ──────────────────────────────────────
    const trend = moodTrend();
    if (Math.abs(trend) >= 0.5) {
      results.push({
        icon: trend > 0 ? "" : "",
        type: trend > 0 ? "positive" : "warning",
        color: trend > 0 ? "#3a7d5c" : "#c0392b",
        tag: trend > 0 ? "Improving" : "Declining",
        text: `Your mood ${trend > 0 ? "improved" : "dropped"} by ${Math.abs(trend).toFixed(1)} pts over the last 7 days compared to the prior week.`,
        recommendation: trend > 0
          ? "You're on an upswing — identify what changed and double down on it."
          : "Try adding one positive habit this week: a short walk, journaling, or better sleep.",
      });
    }

    // ── Habit mood correlations ─────────────────────────────────────────────
    const habitCorrelations = [];
    if (validMoods.some(m => m.date) && habits.length > 0) {
      habits.forEach(h => {
        const t = tmpl(h.id);
        if (!t || !h.history || h.history.length < 7) return;
        const datesWithLog = [];
        const datesWithout = [];
        h.history.slice(-28).forEach((logged, i) => {
          const d = new Date(today);
          d.setDate(today.getDate() - (27 - i));
          const dateStr = d.toISOString().split("T")[0];
          const moodEntry = validMoods.find(m => m.date === dateStr);
          if (moodEntry) {
            if (logged) datesWithLog.push(moodEntry.score);
            else datesWithout.push(moodEntry.score);
          }
        });
        if (datesWithLog.length >= 2 && datesWithout.length >= 2) {
          const avgWith    = datesWithLog.reduce((a,b)=>a+b,0) / datesWithLog.length;
          const avgWithout = datesWithout.reduce((a,b)=>a+b,0) / datesWithout.length;
          const diff = +(avgWith - avgWithout).toFixed(1);
          if (Math.abs(diff) >= 0.5) {
            habitCorrelations.push({ t, diff, avgWith, avgWithout, sampleSize: datesWithLog.length });
          }
        }
      });
    }

    // Sort correlations: strongest positive first, then strongest negative
    const positiveCorr = habitCorrelations.filter(c => c.diff > 0).sort((a,b) => b.diff - a.diff);
    const negativeCorr = habitCorrelations.filter(c => c.diff < 0).sort((a,b) => a.diff - b.diff);

    positiveCorr.slice(0, 3).forEach(({ t, diff, avgWith, avgWithout, sampleSize }) => {
      const pct = Math.round((diff / avgWithout) * 100);
      results.push({
        icon: t.icon || "",
        type: "positive",
        color: "#d4860a",
        tag: `+${pct}% mood boost`,
        text: `When you log ${t.label}, your mood averages ${avgWith.toFixed(1)}/10 vs ${avgWithout.toFixed(1)}/10 on days you skip it — a ${diff.toFixed(1)} pt difference across ${sampleSize} logged days.`,
        recommendation: `Prioritize ${t.label} on days you feel low. Your data shows it consistently lifts your mood.`,
      });
    });

    negativeCorr.slice(0, 1).forEach(({ t, diff, avgWith, avgWithout }) => {
      results.push({
        icon: t.icon || "",
        type: "neutral",
        color: "#d4860a",
        tag: "Worth noting",
        text: `Your mood is slightly lower on ${t.label} days (${avgWith.toFixed(1)} vs ${avgWithout.toFixed(1)}). This often reflects exertion — the effort is still building long-term resilience.`,
        recommendation: `Try logging your mood a day after ${t.label} to capture recovery benefits.`,
      });
    });

    // ── Day-of-week patterns ────────────────────────────────────────────────
    const byDay = {};
    validMoods.forEach(m => {
      if (!byDay[m.day]) byDay[m.day] = [];
      byDay[m.day].push(m.score);
    });
    const dayAvgs = Object.entries(byDay)
      .filter(([,v]) => v.length >= 2)
      .map(([day, scores]) => ({ day, avg: scores.reduce((a,b)=>a+b,0)/scores.length }))
      .sort((a,b) => b.avg - a.avg);
    if (dayAvgs.length >= 3) {
      const best = dayAvgs[0];
      const worst = dayAvgs[dayAvgs.length - 1];
      if (best.avg - worst.avg >= 1.0) {
        results.push({
          icon: "",
          type: "pattern",
          color: "#d4860a",
          tag: "Weekly pattern",
          text: `${best.day}s are your best mood days (avg ${best.avg.toFixed(1)}/10) while ${worst.day}s are your toughest (avg ${worst.avg.toFixed(1)}/10).`,
          recommendation: `Schedule demanding tasks on ${best.day}s and protect ${worst.day}s for recovery, light activity, or social connection.`,
        });
      }
    }

    // ── Medication adherence ────────────────────────────────────────────────
    if (medications.length > 0 && validMoods.length >= 5) {
      medications.forEach(med => {
        if (med.taken_today && med.streak >= 5) {
          results.push({
            icon: "",
            type: "positive",
            color: "#d4860a",
            tag: `${med.streak}-day streak`,
            text: `You've taken ${med.name} consistently for ${med.streak} days. Your current mood average is ${recentMoodAvg.toFixed(1)}/10 — adherence like this supports a stable baseline.`,
            recommendation: "Keep your medication time consistent. Same time daily improves absorption and reduces missed doses.",
          });
        } else if (!med.taken_today) {
          results.push({
            icon: "!",
            type: "warning",
            color: "#c0392b",
            tag: "Missed today",
            text: `${med.name} hasn't been logged today. Missing doses can directly affect your mood, energy, and focus.`,
            recommendation: "Set a phone alarm for the same time each day. Pair it with an existing routine like morning coffee.",
          });
        }
      });
    }

    // ── Supplements ─────────────────────────────────────────────────────────
    if (supplements.length > 0) {
      const consistentSupps = supplements.filter(s => s.streak >= 5);
      const missedSupps = supplements.filter(s => !s.taken_today && s.streak < 2);
      if (consistentSupps.length > 0) {
        results.push({
          icon: "",
          type: "positive",
          color: "#3a7d5c",
          tag: "Consistent",
          text: `${consistentSupps.map(s=>s.name).join(", ")} logged for ${Math.min(...consistentSupps.map(s=>s.streak))}+ consecutive days. Supplement consistency compounds over weeks, not days.`,
          recommendation: "Track how you feel after 30 days of consistent use — that's when most supplements show measurable effects.",
        });
      }
      if (missedSupps.length > 0 && consistentSupps.length === 0) {
        results.push({
          icon: "",
          type: "neutral",
          color: "#d4860a",
          tag: "Inconsistent",
          text: `${missedSupps.map(s=>s.name).join(", ")} ${missedSupps.length > 1 ? "haven't" : "hasn't"} been logged consistently. Inconsistent supplementation limits its effectiveness.`,
          recommendation: "Stack your supplements with a habit you already do daily — like breakfast or brushing your teeth.",
        });
      }
    }

    // ── Financial stress & mood ─────────────────────────────────────────────
    const totalDebt = debts.reduce((a,d) => a+(d.balance||0), 0);
    if (totalDebt > 5000 && recentMoodAvg < 6) {
      results.push({
        icon: "",
        type: "warning",
        color: "#d4860a",
        tag: "Financial stress",
        text: `You have $${totalDebt.toLocaleString()} in debt and your mood this week averages ${recentMoodAvg.toFixed(1)}/10. Financial stress is one of the top predictors of low mood.`,
        recommendation: "Even paying $25 extra/month toward debt reduces cognitive load. Check the Finances tab for a payoff plan.",
      });
    }

    // ── Low mood alert ──────────────────────────────────────────────────────
    const last5 = validMoods.slice(-5);
    if (last5.length === 5 && last5.every(m => m.score <= 5)) {
      results.push({
        icon: "🫂",
        type: "alert",
        color: "#c0392b",
        tag: "Attention needed",
        text: `Your last 5 mood logs: ${last5.map(m=>m.score).join(", ")}. Persistent low mood lasting more than 2 weeks is worth discussing with a professional.`,
        recommendation: "Resources are in the section below. The Crisis Text Line (text HOME to 741741) is free and available 24/7.",
      });
    }

    // ── High performer ──────────────────────────────────────────────────────
    const last5h = validMoods.slice(-5);
    if (last5h.length >= 5 && last5h.every(m => m.score >= 7)) {
      results.push({
        icon: "",
        type: "positive",
        color: "#3a7d5c",
        tag: "On a roll",
        text: `${last5h.length} consecutive mood logs at 7 or above — that's a strong run. Your current habits and routines are clearly working.`,
        recommendation: "Write down what you're doing differently this week. You'll want to reference it when things get harder.",
      });
    }

    // ── Body stats ──────────────────────────────────────────────────────────
    if (bodyStats?.current_weight && bodyStats?.goal_weight) {
      const diff = +(bodyStats.current_weight - bodyStats.goal_weight).toFixed(1);
      if (Math.abs(diff) >= 5) {
        results.push({
          icon: diff > 0 ? "" : "✓",
          type: diff > 0 ? "neutral" : "positive",
          color: diff > 0 ? "#d4860a" : "#3a7d5c",
          tag: diff > 0 ? `${diff} lbs to goal` : "Goal reached",
          text: diff > 0
            ? `You're ${diff} lbs above your goal weight of ${bodyStats.goal_weight} lbs. Weight is one of many health signals — it works alongside mood, sleep, and activity.`
            : `You've reached or passed your weight goal of ${bodyStats.goal_weight} lbs. Great work maintaining your body stats.`,
          recommendation: diff > 0
            ? "Focus on consistency over speed — logging workouts and water daily adds up over weeks."
            : "Shift focus to maintaining and building other pillars like sleep and stress management.",
        });
      }
    }

    // ── Overdue checkups ────────────────────────────────────────────────────
    const urgentCheckups = checkups.filter(c => c.urgent);
    if (urgentCheckups.length > 0) {
      results.push({
        icon: "🩺",
        type: "warning",
        color: "#d4860a",
        tag: `${urgentCheckups.length} overdue`,
        text: `Overdue checkup${urgentCheckups.length > 1 ? "s" : ""}: ${urgentCheckups.map(c=>c.name).join(", ")}. Preventive care catches issues early and reduces long-term health anxiety.`,
        recommendation: "Schedule one checkup this week. Most doctor appointments can be booked online in under 5 minutes.",
      });
    }

    // ── Habit streak momentum ───────────────────────────────────────────────
    const topStreaks = [...habits].filter(h => h.streak >= 5).sort((a,b) => b.streak - a.streak).slice(0,2);
    if (topStreaks.length > 0 && results.filter(r=>r.type==="positive").length < 2) {
      const names = topStreaks.map(h => { const t = tmpl(h.id); return t ? `${t.icon} ${t.label} (${h.streak}-day streak)` : null; }).filter(Boolean);
      results.push({
        icon: "·",
        type: "positive",
        color: "#d4860a",
        tag: "Momentum",
        text: `Your strongest habit streaks: ${names.join(" · ")}. Streaks this long indicate genuine behavior change, not just motivation.`,
        recommendation: "Protect these streaks at all costs — even logging a partial day keeps the chain alive.",
      });
    }

    // ── Default ─────────────────────────────────────────────────────────────
    if (results.length === 0) {
      results.push({
        icon: "", type: "info", color: "#9a9590", tag: null,
        text: "Keep logging daily — personalized insights appear as your data builds up.",
        recommendation: "Log mood, habits, and medications consistently for at least a week to unlock correlations.",
      });
    }

    return results.slice(0, 8);
  };

  const avgMood = () => { const valid = moodHistory.filter(d=>d.score!==null); return valid.length ? (valid.reduce((a,b)=>a+b.score,0)/valid.length).toFixed(1) : "—"; };
  const moodTrend = () => { const valid = moodHistory.filter(d=>d.score!==null); if (valid.length < 7) return 0; const last7 = valid.slice(-7), prev7 = valid.slice(-14,-7); if (prev7.length < 7) return 0; const avgL = last7.reduce((a,b)=>a+b.score,0)/7, avgP = prev7.reduce((a,b)=>a+b.score,0)/7; return +(avgL - avgP).toFixed(1); };
  const moodColor = (s) => s>=8?"#3a7d5c":s>=6?"#d4860a":s>=4?"#d4860a":"#c0392b";
  const moodEmoji = (s) => "";

  // ── DAILY BRIEFING HELPERS ────────────────────────────────────────────────────
  const getBriefingTodayKey = () => "ls_briefing_" + new Date().toISOString().split("T")[0];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(getBriefingTodayKey());
      if (saved) {
        const parsed = JSON.parse(saved);
        setBriefing(parsed.text);
        setBriefingDate(parsed.date);
      }
    } catch {}
  }, []);

  const buildBriefingContext = () => {
    const today = new Date();
    const dayName = today.toLocaleDateString("en-US", { weekday:"long" });
    const dateStr = today.toLocaleDateString("en-US", { month:"long", day:"numeric" });
    const activeHabits = habits.filter(h => h.active !== false);
    const topStreaks = [...activeHabits].sort((a,b)=>b.streak-a.streak).slice(0,3)
      .map(h => { const t=tmpl(h.id); return t ? `${t.label} (${h.streak}-day streak)` : null; }).filter(Boolean);
    const todayStr = today.toISOString().split("T")[0];
    const habitAtRisk = [...activeHabits].filter(h=>h.streak>0&&h.lastLoggedDate!==todayStr)
      .sort((a,b)=>b.streak-a.streak)[0];
    const habitAtRiskLabel = habitAtRisk ? (tmpl(habitAtRisk.id)?.label || habitAtRisk.id) : null;
    const totalDebt = debts.reduce((a,d)=>a+(d.balance||0),0);
    const monthlyCashflow = monthlyIncome - monthlyExpenses;
    const dayOfMonth = today.getDate();
    const upcomingBills = bills.filter(b=>b.status==="upcoming"&&b.due_day>=dayOfMonth&&b.due_day<=dayOfMonth+5);
    const overdueBills = bills.filter(b=>b.status==="overdue");
    const urgentCheckups = checkups.filter(c=>c.urgent);
    const lowMeds = medications.filter(m=>(m.refill_days||30)<=7);
    const suppsDue = supplements.filter(s=>!s.takenToday);
    const activeGoals = goals.filter(g=>!g.completed);
    const nearDeadline = activeGoals.filter(g=>{
      if(!g.deadline) return false;
      const days = Math.ceil((new Date(g.deadline)-today)/(1000*60*60*24));
      return days<=14&&days>0;
    });
    const validMoods = moodHistory.filter(m=>m.score!==null&&m.score!==undefined);
    const recentAvg = validMoods.length>=3
      ? (validMoods.slice(-7).reduce((a,b)=>a+b.score,0)/Math.min(validMoods.slice(-7).length,7)).toFixed(1)
      : null;
    return `Today is ${dayName}, ${dateStr}. User: ${username||"User"}. Life Score: ${lifeScore}/100.
HABITS: Active: ${activeHabits.length}. Top streaks: ${topStreaks.join(", ")||"none"}. Streak at risk today: ${habitAtRiskLabel?`${habitAtRiskLabel} (${habitAtRisk.streak}-day streak, not yet logged today)`:"none"}.
FINANCES: Income $${(monthlyIncome||0).toLocaleString()}/mo, Expenses $${(monthlyExpenses||0).toLocaleString()}/mo, Cashflow $${monthlyCashflow.toLocaleString()}/mo. Savings: $${(savings||0).toLocaleString()}. Total debt: $${totalDebt.toLocaleString()} across ${debts.length} accounts. Upcoming bills (next 5 days): ${upcomingBills.length>0?upcomingBills.map(b=>`${b.name} ($${b.amount})`).join(", "):"none"}. Overdue bills: ${overdueBills.length>0?overdueBills.map(b=>b.name).join(", "):"none"}.
HEALTH: Overdue checkups: ${urgentCheckups.length>0?urgentCheckups.map(c=>c.name).join(", "):"none"}. Meds needing refill: ${lowMeds.length>0?lowMeds.map(m=>m.name).join(", "):"none"}. Supplements not yet taken: ${suppsDue.length>0?suppsDue.map(s=>s.name).join(", "):"none/all taken"}.
WELLNESS: Today\'s mood: ${todayMood?`${todayMood}/10`:"not logged yet"}. 7-day avg mood: ${recentAvg?`${recentAvg}/10`:"not enough data"}.
GOALS: Active: ${activeGoals.length}. Nearing deadline: ${nearDeadline.length>0?nearDeadline.map(g=>`${g.title} (${Math.ceil((new Date(g.deadline)-today)/(1000*60*60*24))}d left)`).join(", "):"none in next 2 weeks"}.`;
  };

  const generateBriefing = async () => {
    setBriefingLoading(true);
    setBriefingExpanded(true);
    try {
      const res = await fetch("/api/claude",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:600,
          system:`You are LifeSync AI, a warm and motivating personal life coach. Generate a concise personalized daily briefing. Structure EXACTLY like this:

 **[Greeting + name]**
[1-2 sentence opener referencing their Life Score]

 **Today\'s Focus**
- [specific data-driven action 1]
- [specific data-driven action 2]
- [specific data-driven action 3 if relevant]

 **Momentum**
[1-2 sentences celebrating real wins with actual numbers]

 **Watch Out**
- [urgent item: bills, checkups, meds, mood — skip entire section if nothing urgent]

 **One Thing**
[Single most impactful action today — be specific]

Under 200 words. Warm, direct, human. Use their actual numbers. Never generic.`,
          messages:[{role:"user", content: buildBriefingContext()}]
        })
      });
      const d = await res.json();
      const text = d.content?.map(b=>b.text||"").join("")||"Have a great day! Keep building those streaks. ";
      setBriefing(text);
      const now = new Date().toISOString();
      setBriefingDate(now);
      try { localStorage.setItem(getBriefingTodayKey(), JSON.stringify({text, date:now})); } catch {}
    } catch {
      setBriefing("Couldn\'t load your briefing right now — but you\'re here, and that counts. Check your habits and keep the streak alive! ");
    }
    setBriefingLoading(false);
  };

  const refreshBriefing = () => {
    try { localStorage.removeItem(getBriefingTodayKey()); } catch {}
    setBriefing(null); setBriefingDate(null);
    generateBriefing();
  };

  const formatBriefingText = (text) => {
    if (!text) return null;
    return text.split("\n").map((line,i) => {
      if (!line.trim()) return <div key={i} style={{height:6}}/>;
      const parts = line.split(/\*\*(.*?)\*\*/g);
      const formatted = parts.map((part,j) =>
        j%2===1 ? <span key={j} style={{fontWeight:800,color:"#111010"}}>{part}</span> : part
      );
      const isHeader = /^[\u2600-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF]/.test(line.trim()) && line.includes("**");
      if (isHeader) return <div key={i} style={{fontSize:13,fontWeight:700,color:"#9a9590",marginTop:i===0?0:14,marginBottom:4}}>{formatted}</div>;
      if (line.trim().startsWith("-")||line.trim().startsWith("•")) return (
        <div key={i} style={{display:"flex",gap:8,marginBottom:4,paddingLeft:4}}>
          <span style={{color:"#9a9590",flexShrink:0}}>◆</span>
          <span style={{fontSize:13,color:"#cbd5e1",lineHeight:1.6}}>{line.replace(/^[-•]\s*/,"")}</span>
        </div>
      );
      return <div key={i} style={{fontSize:13,color:"#cbd5e1",lineHeight:1.65,marginBottom:2}}>{formatted}</div>;
    });
  };

  const briefingTimeAgo = briefingDate ? (()=>{
    const mins = Math.floor((Date.now()-new Date(briefingDate))/60000);
    if (mins<1) return "just now";
    if (mins<60) return `${mins}m ago`;
    return `${Math.floor(mins/60)}h ago`;
  })() : null;

  const getGreeting = () => { const h=new Date().getHours(); return h<12?"Good morning":h<17?"Good afternoon":"Good evening"; };

  const sendMsg = async () => {
    if (!aiInput.trim()) return;
    const um = {role:"user",text:aiInput};
    const next = [...msgs, um];
    setMsgs(next); setAiInput(""); setAiLoading(true);
    const hsum = habits.map(h=>`${tmpl(h.id)?.label}: ${h.streak} streak, ${h.weekCount}/${tmpl(h.id)?.target} this period`).join("; ");
    try {
      const res = await fetch("/api/claude",{
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

  // ── COACH HELPERS ─────────────────────────────────────────────────────────
  const buildCoachUserData = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    return {
      profile: { username, goal_type: bodyStats?.goal_type, age_range: bodyStats?.age, lifeScore },
      habits: habits.map(h => { const t = tmpl(h.id); return { id: h.id, label: t?.label || h.id, streak: h.streak, weekCount: h.weekCount, target: t?.target || 5, loggedToday: h.lastLoggedDate === todayStr }; }),
      goals: goals.filter(g => !g.completed).map(g => ({ title: g.title, category: g.category, current_value: g.current_value, target_value: g.target_value, unit: g.unit, deadline: g.deadline })),
      finances: { monthlyIncome, monthlyExpenses, cashflow: (monthlyIncome || 0) - (monthlyExpenses || 0), savings, debts: debts.map(d => ({ name: d.name, balance: d.balance, rate: d.apr })) },
      supplements: supplements.map(s => ({ name: s.name, streak: s.streak, takenToday: s.takenToday })),
      moods: moodHistory.filter(m => m.score !== null).slice(-14).map(m => ({ score: m.score, date: m.date })),
      bodyStats: bodyStats?.current_weight ? { current_weight: bodyStats.current_weight, goal_weight: bodyStats.goal_weight, height_in: bodyStats.height_in, goal_type: bodyStats.goal_type } : null,
      weightLog: weightLog.slice(-7),
      scoreHistory: [lifeScore],
    };
  };

  const fetchCoachMessage = async (mode, userMsg = "", history = [], cacheKey = null) => {
    setCoachLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userData: buildCoachUserData(), mode, userMessage: userMsg, conversationHistory: history }),
      });
      const data = await res.json();
      if (data.content) {
        setCoachMsgs(prev => [...prev, { text: data.content, isCoach: true, role: "assistant" }]);
        if (cacheKey) { try { localStorage.setItem(cacheKey, data.content); } catch {} }
      }
    } catch {
      setCoachMsgs(prev => [...prev, { text: "Having trouble connecting. Check your connection and try again.", isCoach: true }]);
    }
    setCoachLoading(false);
  };

  const sendCoachMsg = async () => {
    const msg = coachInput.trim();
    if (!msg || coachLoading) return;
    setCoachInput("");
    const newMsg = { text: msg, isCoach: false, role: "user" };
    setCoachMsgs(prev => [...prev, newMsg]);
    const history = coachMsgs.filter(m => m.role).map(m => ({ role: m.role, content: m.text }));
    await fetchCoachMessage("chat", msg, history);
  };

  const loadCoachInsight = async () => {
    const today = new Date().toDateString();
    const cached = localStorage.getItem("ls_coach_insight_date");
    const cachedText = localStorage.getItem("ls_coach_insight_text");
    if (cached === today && cachedText) { setCoachInsight(cachedText); return; }
    setCoachInsightLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userData: buildCoachUserData(), mode: "daily_insight" }),
      });
      const data = await res.json();
      if (data.content) {
        setCoachInsight(data.content);
        localStorage.setItem("ls_coach_insight_date", today);
        localStorage.setItem("ls_coach_insight_text", data.content);
      }
    } catch { setCoachInsight(""); }
    setCoachInsightLoading(false);
  };

  // Open coach drawer
  const openCoach = async () => {
    setCoachOpen(true);
    setCoachPulse(false);
    if (coachMsgs.length === 0) {
      const history = [];
      await fetchCoachMessage("open_greeting", "", history);
    }
    setTimeout(() => coachInputRef.current?.focus(), 350);
  };

  // Scroll coach to bottom
  useEffect(() => { coachBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [coachMsgs, coachLoading]);

  // Load coach insight on overview tab
  useEffect(() => {
    if (tab === "overview" && !coachInsight && !coachInsightLoading && !coachInsightDismissed) {
      loadCoachInsight();
    }
  }, [tab]);

  const coachSuggestions = (() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const suggestions = [];
    const topStreak = [...habits].sort((a, b) => b.streak - a.streak)[0];
    if (topStreak && topStreak.streak >= 3) {
      const t = tmpl(topStreak.id);
      suggestions.push(`How do I protect my ${t?.label || topStreak.id} streak?`);
    }
    const atRisk = habits.find(h => h.streak > 2 && h.lastLoggedDate !== todayStr);
    if (atRisk) {
      const t = tmpl(atRisk.id);
      suggestions.push(`Help me keep my ${t?.label || atRisk.id} streak alive`);
    }
    const cashflow = (monthlyIncome || 0) - (monthlyExpenses || 0);
    if (cashflow < 0) suggestions.push("My expenses exceed income — where do I start cutting?");
    else if (savings > 0) suggestions.push(`I have $${savings.toLocaleString()} saved — best move right now?`);
    const activeGoal = goals.find(g => !g.completed);
    if (activeGoal) suggestions.push(`Am I on track with my ${activeGoal.title} goal?`);
    const defaults = ["What pattern are you seeing?", "Where should I focus today?", "How's my progress overall?", "What's hurting my score?"];
    defaults.forEach(d => { if (suggestions.length < 4) suggestions.push(d); });
    return suggestions.slice(0, 4);
  })();

  const coachTabPrompts = (() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const topHabit = [...habits].sort((a, b) => b.streak - a.streak)[0];
    const topLabel = topHabit ? (tmpl(topHabit.id)?.label || topHabit.id) : null;
    const atRisk = habits.find(h => h.streak > 0 && h.lastLoggedDate !== todayStr);
    const atRiskLabel = atRisk ? (tmpl(atRisk.id)?.label || atRisk.id) : null;
    const cashflow = (monthlyIncome || 0) - (monthlyExpenses || 0);
    const topDebt = [...debts].sort((a, b) => (b.balance || 0) - (a.balance || 0))[0];
    const weightGap = bodyStats?.current_weight && bodyStats?.goal_weight ? Math.abs(bodyStats.current_weight - bodyStats.goal_weight) : null;
    return [
      { label: "Patterns", prompts: [
        "What's the strongest pattern in my data?",
        topLabel && topHabit.streak >= 5 ? `My ${topLabel} streak is ${topHabit.streak} days — what does that say about me?` : "When am I most on track?",
        "What's secretly hurting my progress?",
      ]},
      { label: "Focus", prompts: [
        "What's the #1 thing to fix this week?",
        atRiskLabel ? `Help me keep my ${atRiskLabel} streak going today` : "Which habit has the biggest ripple effect?",
        "Where am I close to a breakthrough?",
      ]},
      { label: "Finance", prompts: [
        cashflow < 0 ? `I'm spending $${Math.abs(cashflow).toLocaleString()} more than I earn — where do I cut first?` : `How can I make the most of my $${cashflow.toLocaleString()}/mo cashflow?`,
        topDebt ? `Best strategy for my ${topDebt.name} debt ($${(topDebt.balance || 0).toLocaleString()})` : "Am I on track with my financial goals?",
        "How does my mood affect my spending?",
      ]},
      { label: "Health", prompts: [
        weightGap !== null ? `I'm ${weightGap} lbs from my goal — realistic timeline?` : "What health habit should I add next?",
        supplements.length > 0 ? `Are my supplements actually making a difference?` : "How is my sleep affecting everything?",
        "Am I recovering well?",
      ]},
    ];
  })();
  const [coachTabCategory, setCoachTabCategory] = useState(0);

  const scoreLabel = lifeScore>=80?"Excellent":lifeScore>=65?"Good":lifeScore>=50?"Fair":lifeScore>=35?"Needs Work":"Critical";
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const scoreColor = lifeScore>=80?"#3a7d5c":lifeScore>=65?"#d4860a":lifeScore>=50?"#c87941":"#c0392b";

  const C = {
    // ── DESIGN TOKENS ──────────────────────────────────────────────────────────
    // bg:#f5f4f0 surface:#fff accent:#d4860a text:#111010 muted:#9a9590
    app:{minHeight:"100vh",background:"#f5f4f0",color:"#111010",fontFamily:"'DM Sans',sans-serif",paddingBottom:isMobile?100:60},
    hdr:{background:"#f5f4f0",borderBottom:"1px solid rgba(0,0,0,0.07)",padding:isMobile?"0 16px":"0 28px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,minHeight:isMobile?52:58,position:"sticky",top:0,zIndex:50},
    logo:{fontSize:20,fontWeight:700,color:"#111010",letterSpacing:"-0.02em"},
    nav:{display:isMobile?"none":"flex",gap:0,overflowX:"auto",flex:1,alignSelf:"stretch"},
    navB:(a)=>({background:"transparent",color:a?"#d4860a":"#9a9590",border:"none",borderBottom:a?"2px solid #d4860a":"2px solid transparent",padding:"0 16px",height:"100%",cursor:"pointer",fontSize:13,fontWeight:500,borderRadius:0,transition:"all .2s",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,letterSpacing:"0.01em"}),
    pg:{padding:isMobile?"16px 16px 0":"28px 28px 0"},
    g:(cols="repeat(auto-fit,minmax(300px,1fr))")=>({display:"grid",gridTemplateColumns:isMobile?"1fr":cols,gap:isMobile?12:16}),
    card:{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:16,padding:isMobile?16:22,boxShadow:"0 2px 16px rgba(0,0,0,0.05)"},
    cTitle:{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.12em",color:"#9a9590",marginBottom:14},
    row:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 0",borderBottom:"1px solid rgba(0,0,0,0.06)"},
    btn:(col="#d4860a")=>({background:col,color:"#fff",border:"none",borderRadius:10,padding:isMobile?"11px 20px":"9px 18px",cursor:"pointer",fontWeight:600,fontSize:13,minHeight:isMobile?44:undefined,letterSpacing:"0.01em",transition:"opacity 0.15s"}),
    ghost:{background:"transparent",border:"1px solid rgba(0,0,0,0.12)",color:"#9a9590",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:500},
    inp:{background:"#f5f4f0",border:"1px solid rgba(0,0,0,0.1)",borderRadius:10,padding:"10px 14px",color:"#111010",fontSize:14,outline:"none"},
    bub:(r)=>({alignSelf:r==="user"?"flex-end":"flex-start",background:r==="user"?"#111010":"#ffffff",border:r==="user"?"none":"1px solid rgba(0,0,0,0.07)",borderRadius:r==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"10px 14px",maxWidth:"82%",fontSize:13,lineHeight:1.6,color:r==="user"?"#fff":"#111010",boxShadow:r==="user"?"none":"0 2px 8px rgba(0,0,0,0.05)"}),
    overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(8px)"},
    mbox:{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:20,padding:28,width:380,maxWidth:"92vw",boxShadow:"0 24px 64px rgba(0,0,0,0.12)"},
  };

  const TABS=[{id:"overview",label:"Overview",icon:"◈"},{id:"profile",label:"Profile",icon:"◯"},{id:"habits",label:"Habits",icon:"·"},{id:"finances",label:"Finances",icon:"◎"},{id:"health",label:"Health",icon:"◉"},{id:"wellness",label:"Wellness",icon:"◯"},{id:"league",label:"League",icon:"◯"},{id:"coach",label:"Coach",icon:"🧠"},{id:"ai",label:"AI Chat",icon:"·"}];
  // Tabs that have meaningful daily check-in content worth reminding about
  const REMIND_TABS = new Set(["habits","wellness","health","finances"]);
  const todayKey = "ls_visited_" + new Date().toISOString().split("T")[0];
  const [visitedTabs, setVisitedTabs] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(todayKey)||"[]")); }
    catch { return new Set(); }
  });
  const markTabVisited = (id) => {
    setVisitedTabs(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem(todayKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  // Load morning briefing when coach tab first opened — cached once per day
  useEffect(() => {
    if (tab === "coach" && coachMsgs.length === 0 && !coachLoading) {
      const todayStr = new Date().toISOString().split("T")[0];
      const cacheKey = `ls_coach_morning_${todayStr}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setCoachMsgs([{ text: cached, isCoach: true, role: "assistant" }]);
      } else {
        fetchCoachMessage("morning_briefing", "", [], cacheKey);
      }
    }
  }, [tab]);

  // Mark overview as visited on first render
  useEffect(() => { markTabVisited("overview"); }, []);
  // PWA meta tags
  useEffect(() => {
    const setMeta = (name, content, prop=false) => {
      let el = document.querySelector(prop ? `meta[property="${name}"]` : `meta[name="${name}"]`);
      if (!el) { el = document.createElement("meta"); prop ? el.setAttribute("property",name) : el.setAttribute("name",name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("theme-color","#f5f4f0");
    setMeta("apple-mobile-web-app-capable","yes");
    setMeta("apple-mobile-web-app-status-bar-style","black-translucent");
    setMeta("apple-mobile-web-app-title","LifeSync");
    setMeta("mobile-web-app-capable","yes");
  }, []);

  return (
    <div style={C.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Serif+Display:ital@0;1&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#f5f4f0}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.12);border-radius:2px}
        @keyframes pulse-dot{0%{box-shadow:0 0 0 0 rgba(212,134,10,0.6)}50%{box-shadow:0 0 0 5px rgba(212,134,10,0)}100%{box-shadow:0 0 0 0 rgba(212,134,10,0)}}
        @keyframes pop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes coachPulse{0%,100%{box-shadow:0 4px 20px rgba(212,134,10,0.45)}50%{box-shadow:0 4px 30px rgba(212,134,10,0.75),0 0 0 8px rgba(212,134,10,0.1)}}
        @keyframes coachSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes coachFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes coachFadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes coachTypingDot{0%,80%,100%{transform:scale(0.6);opacity:0.3}40%{transform:scale(1);opacity:1}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        .popped{animation:pop 0.3s ease}
        input::placeholder{color:#b0aca8}
        textarea::placeholder{color:#b0aca8}
        button:hover{opacity:0.88}`}</style>

      {/* HEADER */}
      <div style={C.hdr}>
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,paddingRight:8}}>
          <div style={C.logo}>LifeSync</div>
        </div>

        {/* Tabs inline */}
        <div style={C.nav}>
          {TABS.map(t=>{
            const unvisited = REMIND_TABS.has(t.id) && !visitedTabs.has(t.id) && tab!==t.id;
            return (
              <button key={t.id} style={{...C.navB(tab===t.id), position:"relative"}}
                onClick={()=>{ setTab(t.id); markTabVisited(t.id); }}>
                <span>{t.icon}</span>{t.label}
                {unvisited && (
                  <span style={{
                    position:"absolute", top:10, right:4,
                    width:7, height:7, borderRadius:"50%",
                    background:"#d4860a",
                    boxShadow:"0 0 0 0 rgba(249,115,22,0.7)",
                    animation:"pulse-dot 1.8s ease-in-out infinite"
                  }}/>
                )}
              </button>
            );
          })}
        </div>

        {/* Life Score + Avatar */}
        <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,paddingLeft:8}}>
          <div style={{textAlign:"right",lineHeight:1.2}}>
            <div style={{fontSize:isMobile?15:17,fontWeight:600,color:"#111010",letterSpacing:"-0.02em"}}>{lifeScore}<span style={{fontSize:10,color:"#9a9590",fontWeight:500,marginLeft:3}}>{isMobile?scoreLabel.slice(0,4):scoreLabel}</span></div>
          </div>
          <div style={{position:"relative"}}>
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",cursor:onSignOut?"pointer":"default",flexShrink:0,border:"2px solid rgba(0,0,0,0.08)"}} title={onSignOut?"Sign out":username} onClick={onSignOut||undefined}/>
              : <div style={{width:36,height:36,borderRadius:"50%",background:"#111010",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:12,color:"#fff",cursor:onSignOut?"pointer":"default",flexShrink:0,letterSpacing:"0.03em"}}
                  title={onSignOut?"Sign out":username}
                  onClick={onSignOut||undefined}>
                  {(username||"?").slice(0,2).toUpperCase()}
                </div>
            }
          </div>
        </div>
      </div>

      {isDemo && (
        <div style={{background:"#fef3e2",borderBottom:"1px solid rgba(212,134,10,0.2)",padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13,color:"#d4860a",fontWeight:500}}>Demo mode — viewing @{username}'s account. Data is not real.</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>navigate("/login")} style={{background:"#111010",color:"#fff",border:"none",borderRadius:8,padding:"6px 16px",cursor:"pointer",fontSize:12,fontWeight:600}}>Create Account →</button>
            <button onClick={()=>navigate("/")} style={{background:"transparent",border:"1px solid rgba(0,0,0,0.12)",color:"#9a9590",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12}}>← Back</button>
          </div>
        </div>
      )}
      <div style={C.pg}>

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>

            {/* ── DAILY AI BRIEFING ── */}
            {!briefingDismissed&&(
              <div style={{background:"#111010",borderRadius:16,padding:isMobile?"16px 18px":"20px 24px",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-40,right:-40,width:160,height:160,borderRadius:"50%",background:"radial-gradient(circle,rgba(212,134,10,0.15) 0%,transparent 70%)",pointerEvents:"none"}}/>
                {/* Header */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:briefing&&briefingExpanded?14:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:32,height:32,borderRadius:10,background:"rgba(212,134,10,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,color:"#d4860a",fontWeight:600}}>AI</div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"#ffffff"}}>{getGreeting()}, {username||"you"}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:1}}>{briefingDate?`Daily briefing · ${briefingTimeAgo}`:"Your AI daily briefing"}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    {briefing&&<button onClick={refreshBriefing} title="Refresh" style={{background:"rgba(255,255,255,0.08)",border:"none",color:"rgba(255,255,255,0.6)",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:12}}>↻</button>}
                    {briefing&&<button onClick={()=>setBriefingExpanded(e=>!e)} style={{background:"rgba(255,255,255,0.08)",border:"none",color:"rgba(255,255,255,0.6)",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11}}>{briefingExpanded?"Less":"More"}</button>}
                    <button onClick={()=>setBriefingDismissed(true)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:20,lineHeight:1,padding:"2px 4px"}}>×</button>
                  </div>
                </div>
                {/* Generate CTA */}
                {!briefing&&!briefingLoading&&(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10,flexWrap:"wrap",gap:10}}>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",flex:1}}>Personalized summary of your habits, finances, health &amp; goals — updated daily.</div>
                    <button onClick={generateBriefing} style={{...C.btn("#d4860a"),fontSize:12,whiteSpace:"nowrap",minHeight:isMobile?44:undefined}}>Generate</button>
                  </div>
                )}
                {/* Loading */}
                {briefingLoading&&(
                  <div style={{marginTop:14,display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid #1d4ed8",borderTopColor:"#d4860a",animation:"spin 0.8s linear infinite",flexShrink:0}}/>
                    <span style={{fontSize:13,color:"#9a9590"}}>Analyzing your habits, finances &amp; health data...</span>
                  </div>
                )}
                {/* Briefing content */}
                {briefing&&briefingExpanded&&!briefingLoading&&(
                  <div style={{borderTop:"1px solid rgba(0,0,0,0.08)",paddingTop:14}}>
                    {formatBriefingText(briefing)}
                    <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>
                      {[{label:" Log Habit",tab:"habits"},{label:" Finances",tab:"finances"},{label:" Wellness",tab:"wellness"},{label:" AI Chat",tab:"ai"}].map(({label,tab:t})=>(
                        <button key={t} onClick={()=>setTab(t)} style={{background:"#f5f4f0",border:"1px solid rgba(0,0,0,0.08)",color:"#9a9590",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:600,minHeight:isMobile?38:undefined}}>{label}</button>
                      ))}
                    </div>
                  </div>
                )}
                {briefing&&!briefingExpanded&&!briefingLoading&&(
                  <div style={{marginTop:8,fontSize:12,color:"#9a9590"}}>Click "View" to see your full personalized briefing →</div>
                )}
              </div>
            )}

            {/* ── COACH INSIGHT CARD ── */}
            {!coachInsightDismissed&&(
              <div onClick={()=>setTab("coach")} style={{background:"linear-gradient(135deg,#111010 0%,#1c1a18 100%)",borderRadius:16,padding:isMobile?"16px 18px":"18px 22px",position:"relative",overflow:"hidden",cursor:"pointer",transition:"transform 0.2s ease"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#d4860a,#f0a832,#d4860a)",backgroundSize:"200% 100%",animation:"shimmer 3s linear infinite"}}/>
                <button onClick={e=>{e.stopPropagation();setCoachInsightDismissed(true);}} style={{position:"absolute",top:12,right:14,background:"none",border:"none",color:"rgba(255,255,255,0.3)",fontSize:18,cursor:"pointer",lineHeight:1,padding:4}}>×</button>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{fontSize:17}}>🧠</span>
                  <span style={{fontSize:11,color:"#d4860a",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>Coach Insight · Today</span>
                </div>
                {coachInsightLoading?(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {[100,85,60].map((w,i)=>(
                      <div key={i} style={{height:13,width:`${w}%`,borderRadius:6,background:"rgba(255,255,255,0.1)",backgroundImage:"linear-gradient(90deg,rgba(255,255,255,0.05) 25%,rgba(255,255,255,0.15) 50%,rgba(255,255,255,0.05) 75%)",backgroundSize:"200% 100%",animation:`shimmer 1.5s linear ${i*0.15}s infinite`}}/>
                    ))}
                  </div>
                ):coachInsight?(
                  <>
                    <p style={{margin:0,color:"rgba(255,255,255,0.9)",fontSize:14,lineHeight:1.6}}>{coachInsight}</p>
                    <div style={{marginTop:12,display:"flex",alignItems:"center",gap:6,color:"#d4860a",fontSize:12,fontWeight:600}}>
                      <span>Talk to your coach</span><span style={{fontSize:14}}>→</span>
                    </div>
                  </>
                ):(
                  <p style={{margin:0,color:"rgba(255,255,255,0.5)",fontSize:13}}>Tap to open your AI coach →</p>
                )}
              </div>
            )}

            <div style={C.g()}>
              <div style={C.card}>
                <div style={C.cTitle}>Life Score</div>
                <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:18}}>
                  <ScoreRing score={lifeScore} size={110}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:700,marginBottom:4,color:scoreColor,fontFamily:"'DM Serif Display',serif"}}>{scoreLabel}</div>
                    <div style={{fontSize:12,color:"#9a9590",lineHeight:1.7,marginBottom:10}}>Score reflects your real situation — debt, overdue care, and habits all count.</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {scoreBreakdown.pillars.map(p=>(
                        <div key={p.label} style={{fontSize:11,background:"#f5f4f0",borderRadius:8,padding:"3px 8px",display:"flex",alignItems:"center",gap:4}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                          <span style={{color:"#9a9590"}}>{p.label.split(" ")[0]}</span>
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
                      <span style={{color:"#9a9590"}}>{p.label}</span>
                      <span style={{fontWeight:700,color:p.color}}>{p.score}/{p.max}</span>
                    </div>
                    <Bar value={p.score} max={p.max} color={p.color} h={7}/>
                    <div style={{fontSize:11,color:p.score<p.max*0.6?"#c0392b":"#9a9590",marginTop:3}}>{p.detail}</div>
                  </div>
                ))}
              </div>
              <div style={C.card}>
                <div style={C.cTitle}>Top Streaks</div>
                {[...habits].sort((a,b)=>b.streak-a.streak).slice(0,4).map(h=>{const t=tmpl(h.id);return(<div key={h.id} style={C.row}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>{t?.icon}</span><div><div style={{fontSize:13,fontWeight:600}}>{t?.label}</div><div style={{fontSize:11,color:"#9a9590"}}>{h.weekCount}/{t?.target} {t?.unit}</div></div></div><Flame streak={h.streak}/></div>);})}
                <button style={{...C.btn(),marginTop:14,width:"100%",fontSize:13}} onClick={()=>setTab("habits")}>View All Habits →</button>
              </div>
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={C.cTitle}>Financial Snapshot</div>
                  <button style={{...C.ghost,padding:"4px 12px",fontSize:11}} onClick={openEditFinances}> Edit</button>
                </div>
                {monthlyIncome===0&&monthlyExpenses===0?(
                  <div style={{textAlign:"center",padding:"20px 0"}}>
                    <div style={{fontSize:13,color:"#9a9590",marginBottom:10}}>No financial data yet.</div>
                    <button style={{...C.btn("#d4860a"),fontSize:12}} onClick={openEditFinances}>+ Add Your Numbers</button>
                  </div>
                ):(
                  <>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
                      {[["Income",`$${monthlyIncome.toLocaleString()}`,"#3a7d5c"],["Expenses",`$${monthlyExpenses.toLocaleString()}`,"#c0392b"],["Saved",`$${Math.max(0,monthlyIncome-monthlyExpenses).toLocaleString()}`,"#d4860a"]].map(([l,v,col])=>(
                        <div key={l} style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:col}}>{v}</div><div style={{fontSize:11,color:"#9a9590"}}>{l}/mo</div></div>
                      ))}
                    </div>
                    <div style={{fontSize:12,color:"#9a9590",marginBottom:4,display:"flex",justifyContent:"space-between"}}><span>Savings</span><span style={{color:"#111010"}}>${savings.toLocaleString()}</span></div>
                    <Bar value={savings} max={Math.max(savings*2,5000)} color="#d4860a"/>
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
                    actions.push({icon:"",text:`${m.name} refill in ${m.refill_days} day${m.refill_days===1?"":"s"}`,color:"#c0392b",action:"View",go:"health"});
                  });
                  // Overdue bills
                  bills.filter(b=>b.status==="overdue").forEach(b=>{
                    actions.push({icon:"",text:`${b.name} bill is overdue — $${(b.amount||0).toLocaleString()}`,color:"#c0392b",action:"View",go:"finances"});
                  });
                  // Overdue checkups
                  checkups.filter(ch=>ch.urgent).slice(0,2).forEach(ch=>{
                    actions.push({icon:"",text:`${ch.name} is overdue`,color:"#d4860a",action:"View",go:"health"});
                  });
                  // Habit streaks at risk (active habits with streak > 0, not logged today)
                  const topStreak = [...habits].filter(h=>h.active&&h.streak>0).sort((a,b)=>b.streak-a.streak)[0];
                  if (topStreak) {
                    const tmpl = HABIT_TEMPLATES.find(t=>t.id===topStreak.id);
                    actions.push({icon:"·",text:`Log ${tmpl?.label||topStreak.id} to keep your ${topStreak.streak}-day streak`,color:"#d4860a",action:"Log now",go:"habits"});
                  }
                  // Low savings alert
                  if (monthlyIncome>0 && savings < monthlyIncome) {
                    actions.push({icon:"",text:`Savings ($${savings.toLocaleString()}) below 1 month income — consider boosting`,color:"#3a7d5c",action:"View",go:"finances"});
                  }
                  // High debt-to-income
                  const totalDebt = debts.reduce((a,d)=>a+(d.balance||0),0);
                  if (monthlyIncome>0 && totalDebt > monthlyIncome*12) {
                    actions.push({icon:"",text:`Debt ($${totalDebt.toLocaleString()}) exceeds annual income — focus on payoff`,color:"#d4860a",action:"View",go:"finances"});
                  }
                  // Upcoming bills in next 3 days
                  const today = new Date().getDate();
                  bills.filter(b=>b.status==="upcoming"&&b.due_day>=today&&b.due_day<=today+3).forEach(b=>{
                    actions.push({icon:"",text:`${b.name} due in ${b.due_day-today} day${b.due_day-today===1?"":"s"} — $${(b.amount||0).toLocaleString()}`,color:"#d4860a",action:"View",go:"finances"});
                  });
                  // No data state
                  if (actions.length===0) {
                    actions.push({icon:"✓",text:"Everything looks good! Keep building your streaks.",color:"#3a7d5c",action:"View habits",go:"habits"});
                  }
                  return actions.slice(0,5).map((a,i)=>(
                    <div key={i} style={{background:"#f5f4f0",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,border:"1px solid rgba(0,0,0,0.06)"}}>
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
                <div style={C.cTitle}> Active Goals</div>
                <button onClick={()=>setTab("profile")} style={{...C.ghost,fontSize:11,padding:"4px 12px"}}>View all →</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {goals.filter(g=>!g.completed).slice(0,3).map(g=>{
                  const auto = getGoalAutoValue(g);
                  const displayVal = auto ? auto.value : g.current_value;
                  const pct = g.target_value > 0 ? Math.min(100, Math.round((displayVal/g.target_value)*100)) : 0;
                  const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline)-new Date())/(1000*60*60*24)) : null;
                  const catColors = { fitness:"#3a7d5c", finance:"#d4860a", health:"#d4860a", personal:"#d4860a" };
                  const col = catColors[g.category] || "#d4860a";
                  return (
                    <div key={g.id} style={{background:"#f5f4f0",borderRadius:12,padding:"12px 16px",border:"1px solid rgba(0,0,0,0.06)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:11,fontWeight:700,color:col,background:`${col}18`,border:`1px solid ${col}30`,borderRadius:6,padding:"2px 8px",textTransform:"uppercase"}}>{g.category}</span>
                          <span style={{fontSize:13,fontWeight:700}}>{g.title}</span>
                        </div>
                        <div style={{fontSize:12,fontWeight:800,color:col}}>{pct}%</div>
                      </div>
                      <div style={{background:"rgba(0,0,0,0.07)",borderRadius:99,height:6,overflow:"hidden",marginBottom:4}}>
                        <div style={{width:`${pct}%`,background:`linear-gradient(90deg,${col},${col}99)`,height:"100%",borderRadius:99,transition:"width 0.8s"}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#9a9590"}}>
                        <span style={{display:"flex",alignItems:"center",gap:4}}>
                          {g.unit==="$"?"$":""}{Number(displayVal).toLocaleString()} / {g.unit==="$"?"$":""}{Number(g.target_value).toLocaleString()} {g.unit!=="$"?g.unit:""}
                          {auto&&<span style={{color:"#3a7d5c",fontSize:10}}>·</span>}
                        </span>
                        {daysLeft !== null && <span style={{color:daysLeft<=7?"#c0392b":daysLeft<=30?"#d4860a":"#9a9590"}}>{daysLeft > 0 ? `${daysLeft}d left` : "Overdue!"}</span>}
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
            <div style={{background:"#f0faf4",border:"1px solid rgba(58,125,92,0.2)",borderRadius:16,padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
              <div>
                <div style={{fontSize:12,color:"#3a7d5c",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>Habits &amp; Discipline Pillar</div>
                <div style={{fontSize:30,fontWeight:900}}>{scoreBreakdown.pillars[2].score}<span style={{fontSize:13,color:"#9a9590",fontWeight:400}}> / 25 pts · Overall Score {lifeScore}/100</span></div>
                {(debts.reduce((a,d)=>a+(d.balance||0),0)>0||checkups.filter(c=>c.urgent).length>0)&&(
                  <div style={{fontSize:12,color:"#d4860a",marginTop:4,fontWeight:600}}>
                     {[debts.reduce((a,d)=>a+(d.balance||0),0)>0&&"Debt load",checkups.filter(c=>c.urgent).length>0&&"overdue checkups"].filter(Boolean).join(" & ")} holding your score back
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
              {habits.length === 0 && (
                <div style={{...C.card,textAlign:"center",padding:"32px 20px"}}>
                  <div style={{fontSize:40,marginBottom:10}}></div>
                  <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>No habits yet</div>
                  <div style={{fontSize:12,color:"#9a9590",marginBottom:16}}>Add habits to start building streaks and boosting your Life Score.</div>
                  <button style={C.btn("#059669")} onClick={()=>setShowAdd(true)}>+ Add Your First Habit</button>
                </div>
              )}
              {habits.map(h=>{
                const t=tmpl(h.id);
                if (!t) return null;
                const pct=Math.min(h.weekCount/t.target,1);
                const done=pct>=1;
                const pts=Math.min(h.streak*(t.scorePerStreak||2),15);
                const logged=justLogged===h.id;
                return(
                  <div key={h.id} className={logged?"popped":""} style={{...C.card,border:done?"1px solid #1a4a2e":"1px solid rgba(0,0,0,0.08)",background:done?"linear-gradient(145deg,#0a1e17,#071511)":C.card.background,transition:"border 0.3s"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:28}}>{t.icon}</span>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <div style={{fontSize:14,fontWeight:700}}>{t.label}</div>
                            {t.custom && <span style={{fontSize:9,fontWeight:700,color:"#d4860a",background:"rgba(99,102,241,0.15)",border:"1px solid #6366f133",borderRadius:4,padding:"1px 5px"}}>CUSTOM</span>}
                          </div>
                          <div style={{fontSize:11,color:"#9a9590"}}>{t.target} {t.unit}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"flex-start",gap:6}}>
                        <div style={{textAlign:"right"}}>
                          <Flame streak={h.streak}/>
                          <div style={{fontSize:11,color:"#3a7d5c",marginTop:2,fontWeight:700}}>+{pts} pts</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:2}}>
                          <button onClick={()=>setEditHabit({...h,...t})} style={{background:"rgba(99,102,241,0.15)",border:"1px solid #6366f133",borderRadius:6,padding:"3px 6px",cursor:"pointer",fontSize:11,color:"#d4860a"}}></button>
                          <button onClick={()=>setDeleteHabitId(h.id)} style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,padding:"3px 6px",cursor:"pointer",fontSize:11,color:"#c0392b"}}></button>
                        </div>
                      </div>
                    </div>
                    <div style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                        <span style={{color:"#9a9590"}}>Progress this period</span>
                        <span style={{color:done?"#3a7d5c":"#111010",fontWeight:700}}>{h.weekCount}/{t.target}{done?" ✓":""}</span>
                      </div>
                      <Bar value={h.weekCount} max={t.target} color={done?"#3a7d5c":"#d4860a"} h={8}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <HeatMap history={h.history}/>
{(()=>{
                        const todayStr = new Date().toISOString().split("T")[0];
                        const loggedToday = h.lastLoggedDate === todayStr;
                        if (loggedToday) return (
                          <div style={{background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:10,padding:"7px 14px",fontSize:12,color:"#3a7d5c",fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                            ✓ Done for Today
                          </div>
                        );
                        return <button onClick={()=>{setLogModal(h.id);setLogVal(1);}} style={{...C.btn(done?"#065f46":"#1d4ed8"),fontSize:12,padding:"7px 14px"}}>{done?"✓ Log More":"Log →"}</button>;
                      })()}
                    </div>
                    {logged&&<div style={{marginTop:10,background:"rgba(74,222,128,0.1)",borderRadius:8,padding:"7px 10px",fontSize:12,color:"#3a7d5c",fontWeight:700,textAlign:"center",animation:"fadeUp 0.3s ease"}}> Logged! Streak &amp; Life Score updated </div>}
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
                  const medals=["1","2","3"];
                  const barColor=i===0?"#d4860a":i===1?"#9a9590":"#cd7f32";
                  return(
                    <div key={h.id} style={{display:"flex",alignItems:"center",gap:14,background:"#f5f4f0",borderRadius:12,padding:"12px 16px"}}>
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
                {[{icon:"·",title:"Streaks Add Points",desc:"Each period you hit your target, your streak grows — so does your Life Score bonus."},{icon:"",title:"Consistency Wins",desc:"Steady habits score higher than one-time bursts. Daily wins compound over time."},{icon:"·",title:"Category Bonuses",desc:"Health habits: 2–5 pts/streak. Finance habits: 3–4 pts. High-impact habits score most."},{icon:"",title:"Protect Your Streaks",desc:"Missing a full period resets your streak to 0. Partial progress doesn't count."}].map(s=>(
                  <div key={s.title} style={{background:"#f5f4f0",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:22,marginBottom:8}}>{s.icon}</div>
                    <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{s.title}</div>
                    <div style={{fontSize:12,color:"#9a9590",lineHeight:1.6}}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* ── RECOVERY STREAKS ── */}
            <div style={C.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div>
                  <div style={C.cTitle}> Recovery Streaks</div>
                  <div style={{fontSize:12,color:"#9a9590",marginTop:2}}>Track what you're working to quit. Every day counts.</div>
                </div>
                <button style={{...C.btn("#d4860a"),fontSize:12,padding:"7px 14px"}} onClick={()=>setShowAddRecovery(true)}>+ Add</button>
              </div>

              {recoveryTrackers.length === 0 ? (
                <div style={{textAlign:"center",padding:"28px 0"}}>
                  <div style={{fontSize:36,marginBottom:10}}></div>
                  <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>Start a Recovery Streak</div>
                  <div style={{fontSize:12,color:"#9a9590",marginBottom:16}}>Track sobriety, quitting smoking, reducing screen time, or any habit you're fighting. No judgment — just progress.</div>
                  <button style={C.btn("#d4860a")} onClick={()=>setShowAddRecovery(true)}>+ Start Tracking</button>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:12}}>
                  {recoveryTrackers.map(tracker => {
                    const days = Math.floor((new Date() - new Date(tracker.start_date)) / (1000*60*60*24));
                    const best = tracker.best_streak || 0;
                    const milestoneColor = days >= 365 ? "#d4860a" : days >= 90 ? "#3a7d5c" : days >= 30 ? "#d4860a" : days >= 7 ? "#d4860a" : "#9a9590";
                    const nextMilestone = days < 1 ? 1 : days < 3 ? 3 : days < 7 ? 7 : days < 14 ? 14 : days < 30 ? 30 : days < 60 ? 60 : days < 90 ? 90 : days < 180 ? 180 : days < 365 ? 365 : null;
                    const pct = nextMilestone ? Math.round((days / nextMilestone) * 100) : 100;
                    return (
                      <div key={tracker.id} style={{background:"#f5f4f0",border:`1px solid ${milestoneColor}33`,borderRadius:14,padding:"16px 18px",borderLeft:`3px solid ${milestoneColor}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                          <div style={{display:"flex",alignItems:"center",gap:12}}>
                            <span style={{fontSize:28}}>{tracker.icon}</span>
                            <div>
                              <div style={{fontSize:15,fontWeight:800}}>{tracker.label}</div>
                              <div style={{fontSize:11,color:"#9a9590"}}>Best: {best} days</div>
                            </div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontSize:32,fontWeight:900,color:milestoneColor,lineHeight:1}}>{days}</div>
                            <div style={{fontSize:10,color:"#9a9590",fontWeight:700,letterSpacing:0.5}}>DAYS CLEAN</div>
                          </div>
                        </div>

                        {/* Milestone badges */}
                        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                          {[1,3,7,14,30,90,180,365].map(m => {
                            const achieved = days >= m;
                            const lbl = m===365?"1 Year":m===180?"6 Mo":m===90?"90 Days":m===30?"30 Days":m===14?"2 Weeks":m===7?"1 Week":m===3?"3 Days":"1 Day";
                            return (
                              <div key={m} style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99,
                                background: achieved ? `${milestoneColor}22` : "rgba(0,0,0,0.06)",
                                color: achieved ? milestoneColor : "#6b6763",
                                border:`1px solid ${achieved ? milestoneColor+"55" : "rgba(0,0,0,0.08)"}`}}>
                                {achieved ? "✓ " : ""}{lbl}
                              </div>
                            );
                          })}
                        </div>

                        {/* Progress to next milestone */}
                        {nextMilestone && (
                          <div style={{marginBottom:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#9a9590",marginBottom:4}}>
                              <span>Next: {nextMilestone===365?"1 year":nextMilestone>=30?`${nextMilestone} days`:nextMilestone===14?"2 weeks":nextMilestone===7?"1 week":`${nextMilestone} days`}</span>
                              <span style={{color:milestoneColor,fontWeight:700}}>{pct}%</span>
                            </div>
                            <Bar value={days} max={nextMilestone} color={milestoneColor} h={6}/>
                          </div>
                        )}

                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div style={{fontSize:11,color:"#6b6763"}}>
                            Since {new Date(tracker.start_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>resetRecovery(tracker)}
                              style={{fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:8,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",color:"#c0392b",cursor:"pointer"}}>
                              Reset
                            </button>
                            <button onClick={()=>deleteRecovery(tracker.id)}
                              style={{fontSize:11,padding:"5px 10px",borderRadius:8,background:"transparent",border:"1px solid rgba(0,0,0,0.08)",color:"#9a9590",cursor:"pointer"}}>
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{marginTop:16,padding:"10px 14px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:10,fontSize:11,color:"#9a9590",lineHeight:1.6}}>
                 Need support? <strong style={{color:"#d4860a"}}>SAMHSA Helpline: 1-800-662-4357</strong> — free &amp; confidential, 24/7.
              </div>
            </div>

          </div>
        )}

        {/* ── FINANCES ── */}
        {tab==="finances"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>

            {/* ── SPENDING BREAKDOWN ── */}
            {(monthlyExpenses > 0 || bills.length > 0) && (() => {
              const BILL_CATS = { housing:" Housing", transport:" Transport", food:" Food", health:" Health", subscriptions:" Subs", utilities:" Utilities", insurance:" Insurance", debt:" Debt Payments", other:" Other" };
              const catAmounts = {};
              bills.forEach(b => {
                const cat = b.category || "other";
                catAmounts[cat] = (catAmounts[cat]||0) + (b.amount||0);
              });
              debts.forEach(d => { catAmounts["debt"] = (catAmounts["debt"]||0) + (d.monthly_payment||0); });
              const total = Object.values(catAmounts).reduce((a,v)=>a+v,0) || monthlyExpenses;
              const COLORS = { housing:"#d4860a", transport:"#d4860a", food:"#3a7d5c", health:"#d4860a", subscriptions:"#d4860a", utilities:"#d4860a", insurance:"#22d3ee", debt:"#c0392b", other:"#9a9590" };
              const sorted = Object.entries(catAmounts).sort((a,b)=>b[1]-a[1]);
              return (
                <div style={C.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={C.cTitle}> Spending Breakdown</div>
                    <div style={{display:"flex",gap:6}}>
                      {["bar","pie"].map(v=><button key={v} onClick={()=>setSpendingView(v)} style={{fontSize:11,padding:"3px 10px",borderRadius:8,border:`1px solid ${spendingView===v?"#d4860a":"rgba(0,0,0,0.08)"}`,background:spendingView===v?"rgba(129,140,248,0.15)":"transparent",color:spendingView===v?"#d4860a":"#9a9590",cursor:"pointer",fontWeight:700}}>{v==="bar"?"≡ Bars":"◉ Pie"}</button>)}
                    </div>
                  </div>
                  {spendingView==="bar" ? (
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {sorted.map(([cat,amt])=>(
                        <div key={cat}>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                            <span style={{color:"#9a9590"}}>{BILL_CATS[cat]||cat}</span>
                            <span style={{fontWeight:700,color:COLORS[cat]||"#9a9590"}}>${amt.toLocaleString()} <span style={{color:"#9a9590",fontWeight:400}}>({Math.round(amt/total*100)}%)</span></span>
                          </div>
                          <div style={{height:7,borderRadius:99,background:"#f0f0ef"}}><div style={{height:"100%",borderRadius:99,background:COLORS[cat]||"#9a9590",width:`${Math.min(100,amt/total*100)}%`,transition:"width 0.6s ease"}}/></div>
                        </div>
                      ))}
                      {sorted.length===0&&<div style={{color:"#9a9590",fontSize:13,textAlign:"center",padding:"12px 0"}}>Add bills & debts to see your spending breakdown.</div>}
                    </div>
                  ) : (
                    <div style={{display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
                      <svg width="140" height="140" viewBox="-1 -1 2 2" style={{transform:"rotate(-90deg)",flexShrink:0}}>
                        {(()=>{
                          let offset=0;
                          return sorted.map(([cat,amt])=>{
                            const frac = amt/total;
                            const angle = frac*2*Math.PI;
                            const x1=Math.cos(offset), y1=Math.sin(offset);
                            const x2=Math.cos(offset+angle), y2=Math.sin(offset+angle);
                            const large=angle>Math.PI?1:0;
                            const d=`M0 0 L${x1} ${y1} A1 1 0 ${large} 1 ${x2} ${y2}Z`;
                            offset+=angle;
                            return <path key={cat} d={d} fill={COLORS[cat]||"#9a9590"} stroke="#f5f4f0" strokeWidth="0.02"/>;
                          });
                        })()}
                      </svg>
                      <div style={{display:"flex",flexDirection:"column",gap:6,flex:1,minWidth:150}}>
                        {sorted.map(([cat,amt])=>(
                          <div key={cat} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                            <div style={{width:10,height:10,borderRadius:"50%",background:COLORS[cat]||"#9a9590",flexShrink:0}}/>
                            <span style={{color:"#9a9590",flex:1}}>{BILL_CATS[cat]||cat}</span>
                            <span style={{fontWeight:700,color:"#111010"}}>${amt.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid rgba(0,0,0,0.06)",display:"flex",justifyContent:"space-between",fontSize:13}}>
                    <span style={{color:"#9a9590"}}>Total tracked monthly spend</span>
                    <span style={{fontWeight:800,color:"#c0392b"}}>${total.toLocaleString()}</span>
                  </div>
                </div>
              );
            })()}

            {/* TOP ROW */}
            <div style={C.g()}>
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={C.cTitle}>Monthly Budget</div>
                  <button style={{...C.ghost,padding:"4px 12px",fontSize:11}} onClick={openEditFinances}> Edit</button>
                </div>
                {monthlyIncome===0&&monthlyExpenses===0?(
                  <div style={{textAlign:"center",padding:"20px 0"}}>
                    <div style={{fontSize:13,color:"#9a9590",marginBottom:10}}>Add your income & expenses to see your budget.</div>
                    <button style={{...C.btn("#d4860a"),fontSize:12}} onClick={openEditFinances}>+ Add Budget Info</button>
                  </div>
                ):(
                  <>
                    <div style={{marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:13}}><span style={{color:"#9a9590"}}>Monthly Income</span><span style={{fontWeight:700,color:"#3a7d5c"}}>${monthlyIncome.toLocaleString()}</span></div>
                      <Bar value={monthlyIncome} max={Math.max(monthlyIncome,1)} color="#3a7d5c" h={6}/>
                    </div>
                    <div style={{marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:13}}><span style={{color:"#9a9590"}}>Monthly Expenses</span><span style={{fontWeight:700,color:"#c0392b"}}>${monthlyExpenses.toLocaleString()}</span></div>
                      <Bar value={monthlyExpenses} max={Math.max(monthlyIncome,1)} color="#c0392b" h={6}/>
                    </div>
                    <div style={{marginBottom:4}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:13}}><span style={{color:"#9a9590"}}>Savings</span><span style={{fontWeight:700,color:"#d4860a"}}>${savings.toLocaleString()}</span></div>
                      <Bar value={savings} max={Math.max(monthlyIncome,1)} color="#d4860a" h={6}/>
                    </div>
                    <div style={{marginTop:12,padding:"10px 14px",background:"#f5f4f0",borderRadius:10,display:"flex",justifyContent:"space-between",fontSize:13}}>
                      <span style={{color:"#9a9590"}}>Left after expenses</span>
                      <span style={{fontWeight:800,color:monthlyIncome-monthlyExpenses>=0?"#3a7d5c":"#c0392b"}}>${(monthlyIncome-monthlyExpenses).toLocaleString()}</span>
                    </div>
                    {paySchedule.freq && monthlyIncome > 0 && (()=>{
                      const labels = {weekly:"Weekly",biweekly:"Bi-weekly",semimonthly:"Twice/month",monthly:"Monthly"};
                      const counts = {weekly:4.33,biweekly:2.17,semimonthly:2,monthly:1};
                      const amt = Math.round(monthlyIncome / (counts[paySchedule.freq]||1));
                      const dayLabel = paySchedule.freq==="semimonthly"?`Days ${paySchedule.day1} & ${paySchedule.day2}`:paySchedule.freq==="monthly"?`Day ${paySchedule.day1}`:["","Mon","Tue","Wed","Thu","Fri"][paySchedule.weekday]||"";
                      return (
                        <div style={{marginTop:8,padding:"10px 14px",background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:10,display:"flex",justifyContent:"space-between",fontSize:12,cursor:"pointer"}} onClick={openEditFinances}>
                          <span style={{color:"#9a9590"}}> {labels[paySchedule.freq]} pay{dayLabel&&` · ${dayLabel}`}</span>
                          <span style={{fontWeight:800,color:"#3a7d5c"}}>${amt.toLocaleString()}/check </span>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
              <div style={C.card}>
                <div style={C.cTitle}>Debt Overview</div>
                {debts.map(d=>(
                  <div key={d.id} style={{marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"flex-start"}}>
                      <div><div style={{fontSize:14,fontWeight:600}}>{d.name}</div><div style={{fontSize:11,color:"#9a9590"}}>{d.apr||"—"} APR · ${(d.monthly_payment||0).toLocaleString()}/mo</div></div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{fontSize:16,fontWeight:800,color:"#c0392b"}}>${(d.balance||0).toLocaleString()}</div><button onClick={()=>removeDebt(d.id)} style={{background:"none",border:"none",color:"#6b6763",cursor:"pointer",fontSize:16}}>×</button></div>
                    </div>
                    <Bar value={d.balance||0} max={Math.max((d.balance||0)*1.5,1000)} color="#c0392b" h={5}/>
                  </div>
                ))}
                {debts.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:"#9a9590",fontSize:13}}>No debts added yet.</div>}
                <button onClick={()=>setShowAddDebt(true)} style={{marginTop:8,background:"transparent",border:"1px solid #1e2240",color:"#d4860a",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,width:"100%"}}>+ Add Debt</button>
              </div>
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={C.cTitle}> Bills</div>
                  <div style={{fontSize:11,color:"#9a9590"}}>{bills.filter(b=>b.status==="overdue").length>0&&<span style={{color:"#c0392b",fontWeight:700}}>{bills.filter(b=>b.status==="overdue").length} overdue</span>}</div>
                </div>
                {(()=>{
                  const today = new Date().getDate();
                  const sorted = [...bills].sort((a,b)=>{
                    const aDays = a.due_day >= today ? a.due_day - today : 31 - today + a.due_day;
                    const bDays = b.due_day >= today ? b.due_day - today : 31 - today + b.due_day;
                    return aDays - bDays;
                  });
                  return sorted.map(b=>{
                    const daysUntil = b.due_day >= today ? b.due_day - today : 31 - today + b.due_day;
                    const urgentColor = b.status==="overdue"?"#c0392b":daysUntil<=3&&b.status!=="paid"?"#d4860a":"#9a9590";
                    const daysLabel = b.status==="paid"?"✓ Paid":b.status==="overdue"?"Overdue!":daysUntil===0?"Due today":daysUntil===1?"Due tomorrow":`Due in ${daysUntil}d`;
                    return (
                      <div key={b.id} style={{padding:"10px 0",borderBottom:"1px solid rgba(0,0,0,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:14,fontWeight:600}}>{b.name}</span>
                            {b.autopay&&<span style={{fontSize:9,background:"rgba(74,222,128,0.1)",color:"#3a7d5c",border:"1px solid rgba(74,222,128,0.3)",borderRadius:4,padding:"1px 5px",fontWeight:700}}>AUTO</span>}
                          </div>
                          <div style={{fontSize:11,color:urgentColor,marginTop:2,fontWeight:daysUntil<=3&&b.status!=="paid"?700:400}}>{daysLabel} · Day {b.due_day}</div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontWeight:700,fontSize:14,color:b.status==="paid"?"#3a7d5c":b.status==="overdue"?"#c0392b":"#111010"}}>${(b.amount||0).toLocaleString()}</span>
                          {b.status!=="paid"&&<button onClick={()=>markBillPaid(b.id)} style={{fontSize:10,background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.3)",color:"#3a7d5c",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontWeight:700}}>✓ Pay</button>}
                          <button onClick={()=>setEditBill({...b})} style={{background:"none",border:"none",color:"#9a9590",cursor:"pointer",fontSize:13,padding:"2px 4px"}}></button>
                          <button onClick={()=>removeBill(b.id)} style={{background:"none",border:"none",color:"#6b6763",cursor:"pointer",fontSize:16}}>×</button>
                        </div>
                      </div>
                    );
                  });
                })()}
                {bills.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:"#9a9590",fontSize:13}}>No bills added yet.</div>}
                <div style={{marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:12,color:"#9a9590"}}>Monthly total: <span style={{color:"#111010",fontWeight:700}}>${bills.reduce((a,b)=>a+(b.amount||0),0).toLocaleString()}</span></div>
                  <button onClick={()=>setShowAddBill(true)} style={{background:"transparent",border:"1px solid #1e2240",color:"#d4860a",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>+ Add Bill</button>
                </div>
              </div>
              <div style={C.card}>
                <div style={C.cTitle}>Benefits Checker</div>
                {[["Earned Income Tax Credit","$1,200","eligible"],["Utility Assistance (LIHEAP)","Up to $500","check"],["SNAP Food Benefits","$250/mo","ineligible"]].map(([name,amt,status])=>(
                  <div key={name} style={C.row}><div><div style={{fontSize:13,fontWeight:600}}>{name}</div><div style={{fontSize:12,color:"#3a7d5c",fontWeight:700}}>{amt}</div></div><Tag status={status}/></div>
                ))}
              </div>
            </div>

            {/* ── CASH FLOW CALENDAR ── */}
            {bills.length > 0 && (() => {
              const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              const fullMonths = ["January","February","March","April","May","June","July","August","September","October","November","December"];
              const today = new Date();
              const year = today.getFullYear();
              const month = cfMonth;
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month+1, 0).getDate();
              // Compute payday dates for this month from paySchedule
              const getPaydays = () => {
                const days = [];
                if (paySchedule.freq === "semimonthly") {
                  days.push(Math.min(paySchedule.day1, daysInMonth));
                  days.push(Math.min(paySchedule.day2, daysInMonth));
                } else if (paySchedule.freq === "monthly") {
                  days.push(Math.min(paySchedule.day1, daysInMonth));
                } else if (paySchedule.freq === "biweekly" || paySchedule.freq === "weekly") {
                  const interval = paySchedule.freq === "weekly" ? 7 : 14;
                  const anchor = paySchedule.startDate ? new Date(paySchedule.startDate) : new Date(year, month, 1);
                  const monthStart = new Date(year, month, 1);
                  const monthEnd = new Date(year, month, daysInMonth);
                  let d = new Date(anchor);
                  // walk back to find first occurrence at or before month start
                  while (d > monthStart) d = new Date(d.getTime() - interval*86400000);
                  while (d < monthStart) d = new Date(d.getTime() + interval*86400000);
                  while (d <= monthEnd) {
                    if (d.getMonth() === month) days.push(d.getDate());
                    d = new Date(d.getTime() + interval*86400000);
                  }
                }
                return days;
              };
              const paydays = getPaydays();
              const perPaycheck = paydays.length > 0 ? Math.round(monthlyIncome / paydays.length) : monthlyIncome;
              const billsByDay = {};
              bills.forEach(b => {
                const day = Math.min(b.due_day, daysInMonth);
                if (!billsByDay[day]) billsByDay[day] = [];
                billsByDay[day].push(b);
              });
              return (
                <div style={C.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={C.cTitle}> Cash Flow Calendar</div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <button onClick={()=>setCfMonth(m=>(m+11)%12)} style={{...C.ghost,padding:"3px 8px",fontSize:14}}>‹</button>
                      <span style={{fontSize:13,fontWeight:700,color:"#111010",minWidth:80,textAlign:"center"}}>{fullMonths[month]}</span>
                      <button onClick={()=>setCfMonth(m=>(m+1)%12)} style={{...C.ghost,padding:"3px 8px",fontSize:14}}>›</button>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:8}}>
                    {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,color:"#9a9590",fontWeight:700,padding:"4px 0"}}>{d}</div>)}
                    {Array(firstDay).fill(null).map((_,i)=><div key={"e"+i}/>)}
                    {Array(daysInMonth).fill(null).map((_,i)=>{
                      const day = i+1;
                      const isToday = today.getDate()===day && today.getMonth()===month;
                      const dayBills = billsByDay[day]||[];
                      const isPay = paydays.includes(day);
                      const hasOverdue = dayBills.some(b=>b.status==="overdue");
                      const hasPaid = dayBills.length>0 && dayBills.every(b=>b.status==="paid");
                      const totalDue = dayBills.reduce((a,b)=>a+(b.amount||0),0);
                      return (
                        <div key={day} title={dayBills.map(b=>`${b.name}: $${b.amount}`).join(" | ")} style={{
                          minHeight:42, borderRadius:8, padding:"4px",
                          background: isToday?"rgba(99,102,241,0.15)": hasPaid?"rgba(74,222,128,0.05)": hasOverdue?"rgba(248,113,113,0.1)": dayBills.length>0?"rgba(96,165,250,0.08)": "transparent",
                          border: `1px solid ${isToday?"#d4860a": hasPaid?"rgba(74,222,128,0.2)": hasOverdue?"rgba(248,113,113,0.3)": dayBills.length>0?"rgba(96,165,250,0.2)":"transparent"}`,
                          cursor: dayBills.length>0?"help":"default"
                        }}>
                          <div style={{fontSize:11,fontWeight:isToday?800:500,color:isToday?"#d4860a":"#9a9590",textAlign:"right"}}>{day}</div>
                          {isPay&&<div style={{fontSize:7,background:"rgba(74,222,128,0.2)",color:"#3a7d5c",borderRadius:3,padding:"1px 3px",fontWeight:700,textAlign:"center",marginTop:1}} title={`Payday: +$${perPaycheck.toLocaleString()}`}>
                        <div>PAY</div>
                        {perPaycheck>0&&<div style={{fontSize:6}}>${perPaycheck>=1000?(perPaycheck/1000).toFixed(1)+"k":perPaycheck}</div>}
                      </div>}
                          {dayBills.length>0&&<div style={{fontSize:8,color:hasOverdue?"#c0392b":hasPaid?"#3a7d5c":"#d4860a",fontWeight:700,textAlign:"center",marginTop:2}}>${totalDue>=1000?(totalDue/1000).toFixed(1)+"k":totalDue}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",gap:12,fontSize:11,flexWrap:"wrap"}}>
                    {[["#d4860a","Today"],["#3a7d5c","Paid"],["#c0392b","Overdue"],["#d4860a","Upcoming"],["#3a7d5c","PAY = Payday"]].map(([col,lbl])=>(
                      <div key={lbl} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:col}}/><span style={{color:"#9a9590"}}>{lbl}</span></div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── DEBT PAYOFF PLANNER ── */}
            {debts.length > 0 && (() => {
              const calcPayoff = (debts, method) => {
                let ds = debts.map(d => ({ ...d, bal: d.balance||0, rate: parseFloat((d.apr||"0").replace("%",""))/100/12, pmt: d.monthly_payment||50 })).filter(d=>d.bal>0);
                if (method==="avalanche") ds.sort((a,b)=>b.rate-a.rate);
                else ds.sort((a,b)=>a.bal-b.bal);
                const results = [];
                let month = 0;
                const maxMonths = 360;
                while (ds.some(d=>d.bal>0) && month < maxMonths) {
                  month++;
                  let extra = ds.filter(d=>d.bal<=0).reduce((a,d)=>a+d.pmt,0);
                  const active = ds.filter(d=>d.bal>0);
                  active.forEach((d,i) => {
                    const interest = d.bal * d.rate;
                    const payment = (i===0 ? d.pmt + extra : d.pmt);
                    d.bal = Math.max(0, d.bal + interest - payment);
                    if (d.bal===0 && !results.find(r=>r.name===d.name)) results.push({ name:d.name, month, label: month<12?`${month}mo`:`${Math.floor(month/12)}y ${month%12}m` });
                  });
                }
                const totalMonths = month;
                const totalInterest = debts.reduce((a,d) => a + Math.max(0, (d.monthly_payment||50)*totalMonths - (d.balance||0)), 0);
                return { results, totalMonths, totalInterest };
              };
              const av = calcPayoff(debts, "avalanche");
              const sw = calcPayoff(debts, "snowball");
              const cur = debtMethod==="avalanche" ? av : sw;
              const totalDebt = debts.reduce((a,d)=>a+(d.balance||0),0);
              const totalPmt = debts.reduce((a,d)=>a+(d.monthly_payment||0),0);
              return (
                <div style={C.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={C.cTitle}> Debt Payoff Planner</div>
                    <div style={{display:"flex",gap:6}}>
                      {["avalanche","snowball"].map(m=>(
                        <button key={m} onClick={()=>setDebtMethod(m)} style={{fontSize:11,padding:"3px 10px",borderRadius:8,border:`1px solid ${debtMethod===m?"#d4860a":"rgba(0,0,0,0.08)"}`,background:debtMethod===m?"rgba(129,140,248,0.15)":"transparent",color:debtMethod===m?"#d4860a":"#9a9590",cursor:"pointer",fontWeight:700,textTransform:"capitalize"}}>{m==="avalanche"?" Avalanche":" Snowball"}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{fontSize:12,color:"#9a9590",marginBottom:14}}>
                    {debtMethod==="avalanche"?"Pay highest-APR debt first — saves the most in interest.":"Pay smallest balance first — builds momentum with quick wins."}
                    {av.totalMonths < sw.totalMonths && debtMethod==="snowball" && <span style={{color:"#d4860a",marginLeft:6}}> Avalanche saves {sw.totalMonths-av.totalMonths} months</span>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:16}}>
                    {[["Total Debt","$"+totalDebt.toLocaleString(),"#c0392b"],["Monthly Payments","$"+totalPmt.toLocaleString()+"/mo","#d4860a"],["Debt-Free In",cur.totalMonths<12?cur.totalMonths+"mo":Math.floor(cur.totalMonths/12)+"y "+cur.totalMonths%12+"m","#3a7d5c"]].map(([lbl,val,col])=>(
                      <div key={lbl} style={{background:"#f5f4f0",borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
                        <div style={{fontSize:11,color:"#9a9590",marginBottom:4}}>{lbl}</div>
                        <div style={{fontSize:18,fontWeight:800,color:col}}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:12,color:"#9a9590",marginBottom:8,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Payoff Order</div>
                  {cur.results.map((r,i)=>{
                    const debt = debts.find(d=>d.name===r.name)||{};
                    const pct = Math.max(5, Math.min(100, 100 - (r.month / cur.totalMonths)*100));
                    return (
                      <div key={r.name} style={{marginBottom:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}>
                          <span style={{fontWeight:600}}><span style={{color:"#9a9590",marginRight:6}}>#{i+1}</span>{r.name}</span>
                          <span style={{color:"#3a7d5c",fontWeight:700}}>✓ Paid off in {r.label}</span>
                        </div>
                        <div style={{height:7,borderRadius:99,background:"#f0f0ef",position:"relative"}}>
                          <div style={{height:"100%",borderRadius:99,background:`linear-gradient(90deg,#4ade80,#60a5fa)`,width:`${100-(r.month/cur.totalMonths)*100+10}%`,maxWidth:"100%",transition:"width 0.6s ease"}}/>
                        </div>
                        <div style={{fontSize:11,color:"#9a9590",marginTop:3}}>Balance: ${(debt.balance||0).toLocaleString()} · ${(debt.monthly_payment||0).toLocaleString()}/mo · {debt.apr||"—"} APR</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── SAVINGS GOALS ── */}
            {(()=>{
              const savingsGoals = goals.filter(g => !g.completed && (g.category==="finance" || g.unit==="$" || (g.title||"").toLowerCase().includes("save") || (g.title||"").toLowerCase().includes("fund")));
              const GOAL_PRESETS = [
                {title:"Emergency Fund",icon:"",target:10000,unit:"$",hint:"3-6 months of expenses"},
                {title:"Vacation Fund",icon:"",target:3000,unit:"$",hint:""},
                {title:"New Car",icon:"",target:5000,unit:"$",hint:"Down payment"},
                {title:"Home Down Payment",icon:"",target:20000,unit:"$",hint:"20% of home price"},
              ];
              return (
                <div style={C.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={C.cTitle}> Savings Goals</div>
                    <button onClick={()=>setShowAddGoal(true)} style={{...C.ghost,fontSize:11,padding:"4px 12px"}}>+ Add Goal</button>
                  </div>
                  {savingsGoals.length===0 ? (
                    <div>
                      <div style={{fontSize:13,color:"#9a9590",marginBottom:14,textAlign:"center"}}>No savings goals yet. Start with a common one:</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}>
                        {GOAL_PRESETS.map(p=>(
                          <button key={p.title} onClick={()=>setShowAddGoal(true)} style={{background:"#f5f4f0",border:"1px solid #1e2240",borderRadius:10,padding:"12px",cursor:"pointer",textAlign:"left"}}>
                            <div style={{fontSize:20,marginBottom:4}}>{p.icon}</div>
                            <div style={{fontSize:13,fontWeight:700,color:"#111010"}}>{p.title}</div>
                            <div style={{fontSize:11,color:"#3a7d5c",marginTop:2}}>Target: ${p.target.toLocaleString()}</div>
                            {p.hint&&<div style={{fontSize:10,color:"#9a9590",marginTop:1}}>{p.hint}</div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      {savingsGoals.map(g=>{
                        const pct = g.target_value>0 ? Math.min(100,Math.round((g.current_value/g.target_value)*100)) : 0;
                        const monthsLeft = g.deadline ? Math.max(0,Math.ceil((new Date(g.deadline)-new Date())/(1000*60*60*24*30))) : null;
                        const needed = monthsLeft>0 ? Math.ceil((g.target_value-g.current_value)/monthsLeft) : null;
                        const goalColor = pct>=100?"#3a7d5c":pct>=50?"#d4860a":"#d4860a";
                        return (
                          <div key={g.id} style={{background:"#f5f4f0",borderRadius:12,padding:"14px 16px"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                              <div>
                                <div style={{fontSize:14,fontWeight:700}}>{g.title}</div>
                                {monthsLeft!==null&&<div style={{fontSize:11,color:"#9a9590",marginTop:2}}>{monthsLeft} months left{needed&&` · save $${needed}/mo`}</div>}
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{fontSize:16,fontWeight:800,color:goalColor}}>{pct}%</div>
                                <div style={{fontSize:11,color:"#9a9590"}}>${(g.current_value||0).toLocaleString()} / ${(g.target_value||0).toLocaleString()}</div>
                              </div>
                            </div>
                            <div style={{height:10,borderRadius:99,background:"#f0f0ef",overflow:"hidden"}}>
                              <div style={{height:"100%",borderRadius:99,background:`linear-gradient(90deg,${goalColor},${goalColor}88)`,width:`${pct}%`,transition:"width 0.8s ease"}}/>
                            </div>
                            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
                              <button onClick={()=>{setShowUpdateGoal(g);setGoalUpdateVal(String(g.current_value));}} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid #1e2240",background:"transparent",color:"#d4860a",cursor:"pointer",fontWeight:700}}>+ Update</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── CREDIT SCORE TRACKER ── */}
            <div style={{borderTop:"1px solid rgba(0,0,0,0.06)",paddingTop:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <h2 style={{fontSize:18,fontWeight:800}}> Credit Score Tracker</h2>
                  <div style={{fontSize:12,color:"#9a9590",marginTop:2}}>Update your score manually from Credit Karma, Experian, or your bank app.</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button style={{...C.ghost,color:"#d4860a",border:"1px solid #facc15"}} onClick={()=>setSimMode(m=>!m)}>{simMode?"Hide Simulator":"Score Simulator"}</button>
                  <button style={C.btn("#0ea5e9")} onClick={()=>setShowUpdateScore(true)}>+ Update Score</button>
                </div>
              </div>

              <div style={C.g("repeat(auto-fit,minmax(300px,1fr))")}>

                {/* Score Gauge */}
                <div style={{...C.card,background:"#ffffff"}}>
                  <div style={C.cTitle}>Current Score</div>
                  <div style={{display:"flex",alignItems:"center",gap:20}}>
                    <div style={{position:"relative",width:110,height:110,flexShrink:0}}>
                      <svg width="110" height="110" style={{transform:"rotate(-90deg)"}}>
                        <circle cx="55" cy="55" r="43" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="10"/>
                        <circle cx="55" cy="55" r="43" fill="none" stroke={scColor(creditScore)} strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={2*Math.PI*43}
                          strokeDashoffset={2*Math.PI*43*(1-((creditScore-300)/550))}
                          style={{transition:"stroke-dashoffset 1s ease"}}/>
                      </svg>
                      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                        <div style={{fontSize:22,fontWeight:900,color:scColor(creditScore)}}>{creditScore}</div>
                        <div style={{fontSize:9,color:"#9a9590",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{scLabel(creditScore)}</div>
                      </div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{marginBottom:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#9a9590",marginBottom:4}}><span>300</span><span>580</span><span>670</span><span>740</span><span>850</span></div>
                        <div style={{height:8,borderRadius:99,background:"linear-gradient(90deg,#f87171 0%,#f97316 25%,#facc15 45%,#4ade80 70%,#22d3ee 100%)",position:"relative"}}>
                          <div style={{position:"absolute",top:"50%",transform:"translate(-50%,-50%)",left:`${((creditScore-300)/550)*100}%`,width:14,height:14,borderRadius:"50%",background:"#fff",border:`3px solid ${scColor(creditScore)}`,boxShadow:"0 0 8px rgba(0,0,0,0.5)",transition:"left 0.8s ease"}}/>
                        </div>
                      </div>
                      <div style={{fontSize:12,color:"#9a9590",lineHeight:1.7}}>
                        <span style={{color:"#3a7d5c",fontWeight:700}}>+31 pts</span> gained in 6 months<br/>
                        <span style={{color:"#d4860a",fontWeight:700}}>Goal: 720</span> — {720-creditScore} pts to go
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
                          <div style={{fontSize:10,color:isLast?scColor(h.score):"#9a9590",fontWeight:isLast?800:400}}>{h.score}</div>
                          <div style={{width:"100%",height:ht,borderRadius:"4px 4px 0 0",background:isLast?scColor(h.score):"rgba(0,0,0,0.08)",transition:"height 0.6s ease",minHeight:12}}/>
                          <div style={{fontSize:10,color:isLast?"#111010":"#9a9590",fontWeight:isLast?700:400}}>{h.month}</div>
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
                      <div key={f.label} style={{background:"#f5f4f0",borderRadius:12,padding:"14px 16px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:700}}>{f.label}</div>
                            <div style={{fontSize:11,color:"#9a9590"}}>{f.weight}% of score · {f.desc}</div>
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
                    <div style={C.cTitle}> Your Credit Details</div>
                    <button style={{...C.ghost,fontSize:11,padding:"4px 12px"}} onClick={()=>{setCreditDetailForm({...creditDetails});setShowEditCreditDetails(true);}}> Edit</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {[
                      ["CC Balance", creditDetails.cc_balance>0?`$${creditDetails.cc_balance.toLocaleString()}`:"Not set", creditDetails.cc_balance>0?"#111010":"#9a9590"],
                      ["CC Limit",   creditDetails.cc_limit>0?`$${creditDetails.cc_limit.toLocaleString()}`:"Not set",  creditDetails.cc_limit>0?"#111010":"#9a9590"],
                      ["Credit Age", creditDetails.credit_age_years>0?`${creditDetails.credit_age_years} yrs`:"Not set", creditDetails.credit_age_years>0?"#111010":"#9a9590"],
                      ["Accounts",   creditDetails.num_accounts>0?creditDetails.num_accounts:"Not set", creditDetails.num_accounts>0?"#111010":"#9a9590"],
                    ].map(([label,val,col])=>(
                      <div key={label} style={{background:"#f5f4f0",borderRadius:10,padding:"10px 14px"}}>
                        <div style={{fontSize:11,color:"#9a9590",marginBottom:3}}>{label}</div>
                        <div style={{fontSize:15,fontWeight:700,color:col}}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {(!creditDetails.cc_balance && !creditDetails.credit_age_years) && (
                    <div style={{marginTop:12,fontSize:12,color:"#9a9590",textAlign:"center"}}>Add your details above for more accurate score breakdown and personalized tips.</div>
                  )}
                </div>

                {/* Action Tips */}
                <div style={C.card}>
                  <div style={C.cTitle}> Personalized Tips</div>
                  {(()=>{
                    const tips = [];
                    const util = creditDetails.cc_limit>0 ? Math.round((creditDetails.cc_balance/creditDetails.cc_limit)*100) : 0;
                    if (util > 30) tips.push({ impact:"+25–45 pts", tip:`Pay CC down to $${Math.round(creditDetails.cc_limit*0.3).toLocaleString()} (30% of your $${creditDetails.cc_limit.toLocaleString()} limit)`, urgent:true });
                    else if (util > 0) tips.push({ impact:" Good", tip:`Utilization at ${util}% — keep it below 30% to maintain your score`, urgent:false });
                    const payHabit = habits.find(h=>h.id==="cardpay");
                    if (payHabit?.streak > 0) tips.push({ impact:"+10–20 pts", tip:`Keep your ${payHabit.streak}-month on-time streak — payment history is 35% of your score`, urgent:false });
                    else tips.push({ impact:" High Impact", tip:"Set up autopay to never miss a payment — payment history is 35% of your score", urgent:true });
                    if (creditDetails.hard_inquiries > 2) tips.push({ impact:"-5–10 pts", tip:`${creditDetails.hard_inquiries} hard inquiries detected — avoid new credit applications for 12 months`, urgent:true });
                    if (creditDetails.credit_age_years > 0 && creditDetails.credit_age_years < 4) tips.push({ impact:"+5–15 pts", tip:"Keep your oldest accounts open — closing them reduces average credit age", urgent:false });
                    if (!creditDetails.cc_limit) tips.push({ impact:"+5 pts", tip:"Request a credit limit increase (ask for soft pull only — won't affect your score)", urgent:false });
                    const totalDebt = debts.reduce((a,d)=>a+(d.balance||0),0);
                    if (monthlyIncome>0 && totalDebt > monthlyIncome*6) tips.push({ impact:"+15–30 pts", tip:`Focus on paying down $${totalDebt.toLocaleString()} total debt — high debt-to-income hurts your score`, urgent:true });
                    if (tips.length === 0) tips.push({ impact:" Looking good", tip:"Add your credit details above for personalized tips", urgent:false });
                    return tips.map((t,i)=>(
                      <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(0,0,0,0.06)",alignItems:"flex-start"}}>
                        <span style={{fontSize:12,fontWeight:800,color:t.urgent?"#c0392b":"#3a7d5c",background:t.urgent?"rgba(248,113,113,0.1)":"rgba(74,222,128,0.1)",padding:"3px 8px",borderRadius:99,whiteSpace:"nowrap",marginTop:1}}>{t.impact}</span>
                        <div style={{fontSize:13,color:"#9a9590",lineHeight:1.5}}>{t.tip}</div>
                      </div>
                    ));
                  })()}
                </div>

                {/* Score Ranges Reference */}
                <div style={C.card}>
                  <div style={C.cTitle}>Score Ranges</div>
                  {[["Exceptional","800–850","#22d3ee",true],["Very Good","740–799","#3a7d5c",false],["Good","670–739","#d4860a",false],["Fair","580–669","#d4860a",false],["Poor","300–579","#c0392b",false]].map(([label,range,rangeColor,top])=>{
                    const isCurrent = (label==="Good"&&creditScore>=670&&creditScore<740)||(label==="Fair"&&creditScore>=580&&creditScore<670)||(label==="Very Good"&&creditScore>=740&&creditScore<800)||(label==="Exceptional"&&creditScore>=800)||(label==="Poor"&&creditScore<580);
                    return(
                      <div key={label} style={{...C.row,background:isCurrent?"rgba(255,255,255,0.03)":"transparent",borderRadius:8,padding:"8px 10px",marginBottom:2}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:rangeColor}}/>
                          <div>
                            <div style={{fontSize:13,fontWeight:isCurrent?800:500}}>{label}{isCurrent&&<span style={{fontSize:10,color:rangeColor,marginLeft:6,fontWeight:700}}>← You are here</span>}</div>
                            <div style={{fontSize:11,color:"#9a9590"}}>{range}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SCORE SIMULATOR */}
              {simMode&&(
                <div style={{...C.card,marginTop:18,border:"1px solid rgba(212,134,10,0.2)",background:"#fffbf4"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <div>
                      <div style={C.cTitle}>Score Simulator — What If?</div>
                      <div style={{fontSize:13,color:"#9a9590"}}>Toggle actions below to see how your score would change.</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:11,color:"#9a9590"}}>Simulated Score</div>
                      <div style={{fontSize:32,fontWeight:900,color:scColor(simScore())}}>{simScore()}</div>
                      <div style={{fontSize:12,color:simScore()>creditScore?"#3a7d5c":"#c0392b",fontWeight:700}}>{simScore()>creditScore?`▲ +${simScore()-creditScore}`:simScore()<creditScore?`▼ ${simScore()-creditScore}`:""} pts</div>
                    </div>
                  </div>
                  <div style={C.g("repeat(auto-fit,minmax(220px,1fr))")}>
                    {[
                      {key:"paydown",    type:"range", label:"Pay down credit card",   desc:`Pay off $${simActions.paydown*100} → balance $${2400-simActions.paydown*100}`, min:0, max:24, color:"#3a7d5c"},
                      {key:"newCard",    type:"toggle",label:"Open a new credit card",  desc:"Hard inquiry + new account age", color:"#c0392b"},
                      {key:"missedPayment",type:"toggle",label:"Miss a payment",        desc:"Biggest single-factor score killer", color:"#c0392b"},
                      {key:"oldAccount", type:"toggle",label:"Close oldest account",    desc:"Reduces average credit age", color:"#d4860a"},
                    ].map(a=>(
                      <div key={a.key} style={{background:"#f5f4f0",border:"1px solid #1e1e08",borderRadius:12,padding:"14px 16px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                          <div><div style={{fontSize:13,fontWeight:700}}>{a.label}</div><div style={{fontSize:11,color:"#9a9590",marginTop:2}}>{a.type==="range"?a.desc.replace("$0","$"+simActions.paydown*100):a.desc}</div></div>
                          {a.type==="toggle"&&(
                            <div onClick={()=>setSimActions(p=>({...p,[a.key]:!p[a.key]}))}
                              style={{width:40,height:22,borderRadius:99,background:simActions[a.key]?"#dc2626":"rgba(0,0,0,0.07)",position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
                              <div style={{position:"absolute",top:3,left:simActions[a.key]?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                            </div>
                          )}
                        </div>
                        {a.type==="range"&&(
                          <div>
                            <input type="range" min={0} max={24} value={simActions.paydown}
                              onChange={e=>setSimActions(p=>({...p,paydown:parseInt(e.target.value)}))}
                              style={{width:"100%",accentColor:a.color}}/>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#9a9590"}}><span>$0</span><span>$2,400</span></div>
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
                <div style={C.cTitle}> Benefits & Programs You May Qualify For</div>
                <button style={{...C.ghost,fontSize:11,padding:"4px 12px"}} onClick={()=>{setCreditDetailForm({...creditDetails});setShowEditCreditDetails(true);}}>Update Info</button>
              </div>
              <div style={{fontSize:12,color:"#9a9590",marginBottom:16}}>Based on your income, debt, and profile. Always verify eligibility directly with the program.</div>
              {(()=>{
                const annualIncome = monthlyIncome * 12;
                const totalDebt = debts.reduce((a,d)=>a+(d.balance||0),0);
                const fs = creditDetails.family_size || 1;
                const benefits = [];

                // EITC
                const eitcLimit = fs===1?17640:fs===2?46560:fs===3?52918:59187;
                const eitcStatus = annualIncome>0&&annualIncome<=eitcLimit?"qualify":annualIncome>0&&annualIncome<=eitcLimit*1.2?"maybe":"unlikely";
                benefits.push({ name:"Earned Income Tax Credit (EITC)", icon:"", category:"Tax Credit",
                  status: eitcStatus,
                  detail: eitcStatus==="qualify"?`Your income (~$${annualIncome.toLocaleString()}/yr) may qualify — up to $${fs===1?"560":fs===2?"3,995":fs===3?"6,604":"7,430"} back`:
                    eitcStatus==="maybe"?"Your income is near the limit — file and let the IRS determine eligibility":"Income likely too high for current household size",
                  action:"File Form 1040 — claim on your tax return", link:"https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit"});

                // Saver's Credit
                const saverLimit = fs===1?23000:fs===2?34500:46000;
                const saverStatus = annualIncome>0&&annualIncome<=saverLimit?"qualify":annualIncome>0&&annualIncome<=saverLimit*1.1?"maybe":"unlikely";
                benefits.push({ name:"Saver's Credit (Retirement)", icon:"", category:"Tax Credit",
                  status: saverStatus,
                  detail: saverStatus==="qualify"?"Up to $1,000 credit for contributing to a 401(k) or IRA — free money for saving":saverStatus==="maybe"?"Near the income threshold — may qualify depending on filing status":"Income likely above Saver's Credit limit",
                  action:"Contribute to 401(k) or IRA and claim Form 8880"});

                // Student Loan Forgiveness
                if (creditDetails.has_student_loans) {
                  benefits.push({ name:"Income-Driven Repayment (IDR) Forgiveness", icon:"", category:"Student Loans",
                    status: annualIncome>0&&totalDebt>annualIncome*0.5?"qualify":"maybe",
                    detail: "If payments under an IDR plan are less than interest, the remainder may be forgiven after 20–25 years. SAVE plan caps payments at 5–10% of discretionary income.",
                    action:"Apply at studentaid.gov/idr", link:"https://studentaid.gov/manage-loans/repayment/plans/income-driven"});
                  if (annualIncome < 60000) {
                    benefits.push({ name:"Public Service Loan Forgiveness (PSLF)", icon:"", category:"Student Loans",
                      status:"maybe",
                      detail:"If you work for a government or nonprofit employer, remaining balance forgiven after 120 qualifying payments (10 years).",
                      action:"Check employer eligibility at studentaid.gov/pslf"});
                  }
                }

                // First-Time Homebuyer
                if (creditDetails.is_first_time_buyer) {
                  const hbLimit = fs===1?60000:fs===2?80000:100000;
                  benefits.push({ name:"First-Time Homebuyer Assistance", icon:"", category:"Housing",
                    status: annualIncome<=hbLimit?"qualify":annualIncome<=hbLimit*1.3?"maybe":"unlikely",
                    detail: `Down payment assistance programs available in most states. FHA loans require only 3.5% down with a 580+ credit score. ${creditScore>=580?"Your credit score qualifies for FHA.":"Work on credit score to reach 580 for FHA eligibility."}`,
                    action:"Search your state's HFA program at hud.gov/buying"});
                }

                // 401k match
                if (creditDetails.employer_has_401k) {
                  benefits.push({ name:"401(k) Employer Match", icon:"", category:"Employer Benefits",
                    status: savings < monthlyIncome*3?"qualify":"maybe",
                    detail: `If your employer matches contributions, unclaimed match is free money. Common match: 50–100% of contributions up to 6% of salary. At $${monthlyIncome.toLocaleString()}/mo that's ~$${Math.round(monthlyIncome*0.06).toLocaleString()}/mo in free contributions.`,
                    action:"Contact HR to confirm match % and enroll"});
                  benefits.push({ name:"HSA / FSA Tax Savings", icon:"", category:"Employer Benefits",
                    status:"qualify",
                    detail:"Health Savings Account (HSA) and Flexible Spending Account (FSA) reduce taxable income. HSA 2024 limit: $4,150 single / $8,300 family. Triple tax advantage.",
                    action:"Enroll during open enrollment or contact HR"});
                }

                // Credit card rewards
                benefits.push({ name:"Credit Card Rewards Optimization", icon:"", category:"CC Rewards",
                  status:"qualify",
                  detail: monthlyExpenses>2000?`At $${monthlyExpenses.toLocaleString()}/mo spending, a 2% cash back card earns ~$${Math.round(monthlyExpenses*0.02*12).toLocaleString()}/yr. Travel cards can earn 3–5x on dining/travel.`:
                    "Even at lower spending, the right rewards card can earn $200–500/yr with no extra effort.",
                  action: creditScore>=720?"You qualify for premium rewards cards (Chase Sapphire, Amex Gold)":creditScore>=670?"Good credit — qualify for most rewards cards":creditScore>=580?"Fair credit — secured cards with rewards available":"Build credit first with a secured card"});

                const statusColor = s => s==="qualify"?"#3a7d5c":s==="maybe"?"#d4860a":"#9a9590";
                const statusLabel = s => s==="qualify"?" Likely Qualify":s==="maybe"?" Possibly Qualify":" Unlikely";
                const statusBg = s => s==="qualify"?"rgba(74,222,128,0.08)":s==="maybe"?"rgba(250,204,21,0.08)":"rgba(71,85,105,0.08)";

                return benefits.map((b,i)=>(
                  <div key={i} style={{background:statusBg(b.status),border:`1px solid ${statusColor(b.status)}22`,borderRadius:14,padding:"16px 18px",marginBottom:10,borderLeft:`3px solid ${statusColor(b.status)}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,flexWrap:"wrap",gap:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:20}}>{b.icon}</span>
                        <div>
                          <div style={{fontSize:14,fontWeight:800}}>{b.name}</div>
                          <span style={{fontSize:10,fontWeight:700,color:"#9a9590",background:"#f5f4f0",border:"1px solid rgba(0,0,0,0.08)",borderRadius:6,padding:"2px 7px",textTransform:"uppercase"}}>{b.category}</span>
                        </div>
                      </div>
                      <span style={{fontSize:12,fontWeight:800,color:statusColor(b.status),background:statusBg(b.status),border:`1px solid ${statusColor(b.status)}44`,borderRadius:99,padding:"3px 10px",whiteSpace:"nowrap"}}>{statusLabel(b.status)}</span>
                    </div>
                    <div style={{fontSize:13,color:"#9a9590",lineHeight:1.6,marginBottom:8}}>{b.detail}</div>
                    <div style={{fontSize:12,color:"#d4860a",fontWeight:600}}>→ {b.action}</div>
                  </div>
                ));
              })()}
            </div>
            {/* Finance Goals */}
            {goals.filter(g => g.category === "finance" && !g.completed).length > 0 && (
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={C.cTitle}> Finance Goals</div>
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
                  <button style={{...C.btn("#d4860a"),fontSize:11,padding:"4px 12px"}} onClick={()=>setShowAddCheckup(true)}>+ Add</button>
                </div>
                {checkups.length===0?(
                  <div style={{textAlign:"center",padding:"20px 0"}}>
                    <div style={{fontSize:28,marginBottom:8}}>🩺</div>
                    <div style={{fontSize:13,color:"#9a9590",marginBottom:10}}>No checkups added yet.</div>
                    <button style={{...C.btn("#d4860a"),fontSize:12}} onClick={()=>setShowAddCheckup(true)}>+ Add Checkup</button>
                  </div>
                ):(
                  checkups.map(ch=>(
                    <div key={ch.id} style={{background:ch.urgent?"rgba(248,113,113,0.07)":"rgba(96,165,250,0.07)",border:`1px solid ${ch.urgent?"rgba(248,113,113,0.3)":"rgba(96,165,250,0.2)"}`,borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600}}>{ch.name}</div>
                        {ch.last_date&&<div style={{fontSize:11,color:"#9a9590"}}>Last: {ch.last_date}</div>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <Tag status={ch.urgent?"overdue":"upcoming"}/>
                        <button onClick={()=>removeCheckup(ch.id)} style={{background:"none",border:"none",color:"#6b6763",cursor:"pointer",fontSize:16}}>×</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={C.cTitle}>Medication Tracker</div>
                  <button style={{...C.btn("#d4860a"),fontSize:11,padding:"4px 12px"}} onClick={()=>setShowAddMed(true)}>+ Add</button>
                </div>
                {medications.length===0?(
                  <div style={{textAlign:"center",padding:"20px 0"}}>
                    <div style={{fontSize:28,marginBottom:8}}></div>
                    <div style={{fontSize:13,color:"#9a9590",marginBottom:10}}>No medications added yet.</div>
                    <button style={{...C.btn("#d4860a"),fontSize:12}} onClick={()=>setShowAddMed(true)}>+ Add Medication</button>
                  </div>
                ):(
                  medications.map(m=>{
                    const days = m.refill_days||30;
                    const color = days<=7?"#c0392b":days<=14?"#d4860a":"#3a7d5c";
                    return(
                      <div key={m.id} style={{background:"#f5f4f0",border:"1px solid rgba(0,0,0,0.08)",borderRadius:12,padding:"12px 16px",marginBottom:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <div><div style={{fontSize:14,fontWeight:700}}>{m.name}</div><div style={{fontSize:12,color:"#9a9590"}}>{m.dose} · {m.schedule}</div></div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"#9a9590"}}>Refill in</div><div style={{fontSize:18,fontWeight:800,color:color}}>{days}d</div></div>
                            <button onClick={()=>removeMed(m.id)} style={{background:"none",border:"none",color:"#6b6763",cursor:"pointer",fontSize:16,padding:"0 4px"}}>×</button>
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
                <div style={{fontSize:13,color:"#9a9590",marginBottom:14}}>Describe what you're feeling for AI guidance.</div>
                <textarea placeholder="e.g. I've had a headache and mild fever for 2 days..." style={{...C.inp,width:"100%",minHeight:100,resize:"vertical"}} onChange={e=>{window._sx=e.target.value;}}/>
                <button onClick={()=>{setAiInput(window._sx||"I have some symptoms I'd like to discuss");setTab("ai");}} style={{...C.btn(),marginTop:12,width:"100%"}}>Ask AI Assistant →</button>
                <div style={{marginTop:10,fontSize:11,color:"#9a9590",lineHeight:1.6}}> Not a substitute for professional medical advice. In emergencies, call 911.</div>
              </div>
            </div>

            {/* ── SUPPLEMENT TRACKER ── */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <h2 style={{fontSize:18,fontWeight:800}}> Supplement Tracker</h2>
                  <div style={{fontSize:12,color:"#9a9590",marginTop:2}}>Log your daily supplements and build a streak.</div>
                </div>
                <button style={C.btn("#d4860a")} onClick={()=>setShowAddSupp(true)}>+ Add Supplement</button>
              </div>

              {/* Today's summary bar */}
              <div style={{background:"#111010",border:"none",borderRadius:14,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontSize:12,color:"#d4860a",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4}}>Today's Progress</div>
                  <div style={{fontSize:22,fontWeight:700,color:"#ffffff"}}>{supplements.filter(s=>s.takenToday).length}<span style={{fontSize:14,color:"rgba(255,255,255,0.45)",fontWeight:400}}> / {supplements.length} taken</span></div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {supplements.map(s=>(
                    <div key={s.id} title={s.name} style={{width:36,height:36,borderRadius:"50%",background:s.takenToday?"#fef3e2":"#f5f4f0",border:`2px solid ${s.takenToday?"#d4860a":"rgba(0,0,0,0.08)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,cursor:"pointer",transition:"all 0.2s"}} onClick={()=>!s.takenToday&&takeSupp(s.id)}>
                      {s.takenToday?"✓":s.icon}
                    </div>
                  ))}
                </div>
              </div>

              {/* Supplement cards grid */}
              <div style={C.g()}>
                {supplements.map(s=>{
                  const isNew = suppJustLogged === s.id;
                  const streakColor = s.streak>=14?"#d4860a":s.streak>=7?"#d4860a":s.streak>=3?"#d4860a":"#9a9590";
                  const streakIcon  = s.streak>=14?"·":s.streak>=7?"·":s.streak>=3?"·":"○";
                  return(
                    <div key={s.id} className={isNew?"popped":""} style={{...C.card, border:s.takenToday?"1px solid rgba(212,134,10,0.3)":s.streak>0?"1px solid rgba(0,0,0,0.08)":"1px solid rgba(0,0,0,0.08)", background:s.takenToday?"#fffbf4":C.card.background, transition:"all 0.3s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:48,height:48,borderRadius:12,background:s.takenToday?"#fef3e2":"#f5f4f0",border:`1px solid ${s.takenToday?"#d4860a":"rgba(0,0,0,0.08)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>
                            {s.takenToday?"✓":s.icon}
                          </div>
                          <div>
                            <div style={{fontSize:15,fontWeight:800}}>{s.name}</div>
                            <div style={{fontSize:12,color:"#9a9590"}}>{s.dose && <span style={{color:"#d4860a",fontWeight:600}}>{s.dose}</span>}{s.dose && s.timing && " · "}{s.timing}</div>
                          </div>
                        </div>
                        <button onClick={()=>removeSupp(s.id)} style={{background:"transparent",border:"none",color:"#6b6763",cursor:"pointer",fontSize:16,padding:"2px 4px",lineHeight:1}} title="Remove">×</button>
                      </div>

                      {/* Streak */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:16}}>{streakIcon}</span>
                          <span style={{fontSize:20,fontWeight:900,color:streakColor}}>{s.streak}</span>
                          <span style={{fontSize:11,color:"#9a9590",fontWeight:600}}>day streak</span>
                        </div>
                        {s.takenToday
                          ? <span style={{fontSize:12,color:"#d4860a",fontWeight:700,background:"rgba(124,58,237,0.15)",padding:"3px 10px",borderRadius:99}}>✓ Done today</span>
                          : <button onClick={()=>takeSupp(s.id)} style={{...C.btn("#d4860a"),fontSize:12,padding:"6px 14px"}}>Take Now ✓</button>
                        }
                      </div>

                      {/* 28-day heatmap */}
                      <div style={{marginBottom:isNew?10:0}}>
                        <div style={{fontSize:11,color:"#9a9590",marginBottom:6,fontWeight:600}}>28-day consistency</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
                          {[...s.history].slice(-28).map((v,i)=>(
                            <div key={i} style={{height:10,borderRadius:3,background:v?"#d4860a":"rgba(0,0,0,0.07)",opacity:v?1:0.4,transition:"background 0.3s"}}/>
                          ))}
                        </div>
                      </div>

                      {isNew&&(
                        <div style={{marginTop:10,background:"rgba(167,139,250,0.1)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:8,padding:"7px 10px",fontSize:12,color:"#d4860a",fontWeight:700,textAlign:"center",animation:"fadeUp 0.3s ease"}}>
                           Logged! Streak updated 
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Empty state */}
                {supplements.length===0&&(
                  <div style={{...C.card,gridColumn:"1/-1",textAlign:"center",padding:40}}>
                    <div style={{fontSize:40,marginBottom:12}}></div>
                    <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>No supplements yet</div>
                    <div style={{fontSize:13,color:"#9a9590",marginBottom:16}}>Add your first supplement to start tracking your daily consistency.</div>
                    <button style={C.btn("#d4860a")} onClick={()=>setShowAddSupp(true)}>+ Add Supplement</button>
                  </div>
                )}
              </div>
            </div>

            {/* Health & Fitness Goals */}
            {goals.filter(g => (g.category === "fitness" || g.category === "health") && !g.completed).length === 0 && habits.filter(h=>h.active).length > 0 && (
              <div style={{...C.card,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"14px 18px"}}>
                <div style={{fontSize:13,color:"#9a9590"}}> Turn your habits into goals — track a milestone like "Run 30 days straight" or "Lose 10 lbs"</div>
                <button onClick={()=>{ setNewGoal(p=>({...p,category:"fitness"})); setShowAddGoal(true); }} style={{...C.btn("#3a7d5c"),fontSize:12,padding:"6px 14px",flexShrink:0}}>+ Set Goal</button>
              </div>
            )}
            {goals.filter(g => (g.category === "fitness" || g.category === "health") && !g.completed).length > 0 && (
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={C.cTitle}> Health & Fitness Goals</div>
                  <button onClick={()=>{ setNewGoal(p=>({...p,category:"fitness"})); setShowAddGoal(true); }} style={{...C.ghost,fontSize:11,padding:"4px 12px"}}>+ Add</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {goals.filter(g => (g.category === "fitness" || g.category === "health") && !g.completed).map(g => {
                    const auto = getGoalAutoValue(g);
                    return <GoalCard key={g.id} g={g} onUpdate={(g)=>{setShowUpdateGoal(g);setGoalUpdateVal(String(g.current_value));}} onDelete={deleteGoal} autoValue={auto?.value} autoLabel={auto?.label}/>;
                  })}
                </div>
                {goals.filter(g=>(g.category==="fitness"||g.category==="health")&&!g.completed).some(g=>getGoalAutoValue(g)) && (
                  <div style={{marginTop:12,padding:"10px 14px",background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:10,fontSize:12,color:"#9a9590"}}>
                     <strong style={{color:"#3a7d5c"}}>Auto-tracking</strong> — goals marked with  update automatically from your habits and weight log. No manual updates needed.
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
            <div style={{background:"rgba(96,165,250,0.07)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:12,padding:"12px 18px",fontSize:12,color:"#9a9590",lineHeight:1.6}}>
               <strong style={{color:"#9a9590"}}>This is a self-reflection tool, not a clinical diagnosis.</strong> Results are for personal awareness only. If you're struggling, please reach out to a mental health professional or call/text <span style={{color:"#d4860a"}}>988</span> (Suicide & Crisis Lifeline).
            </div>

            {/* TOP ROW */}
            <div style={C.g()}>

              {/* Mood Overview */}
              <div style={{...C.card,background:"#ffffff"}}>
                <div style={C.cTitle}>Mood Overview</div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:32}}>{moodEmoji(parseFloat(avgMood()))}</div>
                    <div style={{fontSize:24,fontWeight:900,color:moodColor(parseFloat(avgMood()))}}>{avgMood()}</div>
                    <div style={{fontSize:11,color:"#9a9590"}}>28-day avg</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:24,fontWeight:900,color:moodTrend()>0?"#3a7d5c":moodTrend()<0?"#c0392b":"#9a9590"}}>
                      {moodTrend()>0?"▲":moodTrend()<0?"▼":"—"} {Math.abs(moodTrend())||""}
                    </div>
                    <div style={{fontSize:11,color:"#9a9590"}}>vs last week</div>
                    <div style={{fontSize:11,color:moodTrend()>0?"#3a7d5c":moodTrend()<0?"#c0392b":"#9a9590",fontWeight:700}}>{moodTrend()>0?"Improving":moodTrend()<0?"Declining":"Stable"}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:24,fontWeight:900,color:"#d4860a"}}>{moodHistory.filter(d=>d.score!==null).length}</div>
                    <div style={{fontSize:11,color:"#9a9590"}}>days logged</div>
                  </div>
                </div>
                {/* Spark line */}
                <div style={{display:"flex",alignItems:"flex-end",gap:3,height:56,marginBottom:6}}>
                  {moodHistory.slice(-14).map((d,i)=>{
                    const h = d.score ? Math.round((d.score/10)*50) : 4;
                    const col = d.score ? moodColor(d.score) : "rgba(0,0,0,0.07)";
                    const isToday = i === 13;
                    return(
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                        <div style={{width:"100%",height:h,borderRadius:"3px 3px 0 0",background:col,opacity:d.score?1:0.3,border:isToday?`1px solid ${col}`:"none",boxSizing:"border-box"}}/>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#9a9590"}}>
                  <span>14 days ago</span><span>Today</span>
                </div>
              </div>

              {/* Daily Mood Log */}
              <div style={{...C.card,background:"#ffffff"}}>
                <div style={C.cTitle}>Today's Mood Check-in</div>
                {!moodLogged ? (
                  <div>
                    <div style={{fontSize:13,color:"#9a9590",marginBottom:16}}>How are you feeling today? Tap a number.</div>
                    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
                      {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                        <button key={n} onClick={()=>setTodayMood(n)}
                          style={{width:40,height:40,borderRadius:10,background:todayMood===n?moodColor(n):"#f5f4f0",border:`2px solid ${todayMood===n?moodColor(n):"rgba(0,0,0,0.08)"}`,color:todayMood===n?"#000":"#9a9590",fontWeight:900,fontSize:14,cursor:"pointer",transition:"all 0.15s"}}>
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
                      <button style={{...C.btn("#d4860a"),flex:1,opacity:todayMood?1:0.4}} onClick={logMood} disabled={!todayMood}>Log Mood</button>
                      <button style={{...C.ghost}} onClick={()=>setCheckInStep(1)}>Full Check-in →</button>
                    </div>
                  </div>
                ) : (
                  <div style={{textAlign:"center",padding:"10px 0"}}>
                    <div style={{fontSize:40,marginBottom:8}}>{moodEmoji(todayMood)}</div>
                    <div style={{fontSize:28,fontWeight:900,color:moodColor(todayMood)}}>{todayMood}/10</div>
                    <div style={{fontSize:13,color:"#9a9590",margin:"8px 0 16px"}}>Logged today ✓</div>
                    {todayNote&&<div style={{fontSize:12,color:"#9a9590",background:"#f5f4f0",borderRadius:10,padding:"8px 12px",marginBottom:16,fontStyle:"italic"}}>"{todayNote}"</div>}
                    <button style={C.ghost} onClick={()=>{setMoodLogged(false);setTodayMood(null);setTodayNote("");}}>Edit</button>
                  </div>
                )}
              </div>

              {/* Weekly patterns */}
              <div style={C.card}>
                <div style={C.cTitle}>28-Day Mood Calendar</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:8}}>
                  {["M","T","W","T","F","S","S"].map((d,i)=><div key={i} style={{fontSize:10,color:"#9a9590",textAlign:"center",fontWeight:700}}>{d}</div>)}
                  {moodHistory.map((d,i)=>(
                    <div key={i} title={d.score?`${d.day}: ${d.score}/10`:d.day}
                      style={{height:28,borderRadius:6,background:d.score?moodColor(d.score):"rgba(0,0,0,0.07)",opacity:d.score?0.85:0.3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#000",fontWeight:d.score?800:400}}>
                      {d.score||""}
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:10,marginTop:6,flexWrap:"wrap"}}>
                  {[["#c0392b","Low (1–4)"],["#d4860a","Okay (5–6)"],["#d4860a","Good (7–8)"],["#3a7d5c","Great (9–10)"]].map(([c,l])=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#9a9590"}}>
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
                      <div key={s} style={{flex:1,height:4,borderRadius:99,background:checkInStep>=s?"#d4860a":"rgba(0,0,0,0.07)",transition:"background 0.3s"}}/>
                    ))}
                  </div>

                  {checkInStep===1&&(
                    <div>
                      <div style={{fontSize:20,marginBottom:6}}></div>
                      <div style={{fontSize:17,fontWeight:800,marginBottom:4}}>How are you feeling?</div>
                      <div style={{fontSize:13,color:"#9a9590",marginBottom:20}}>Step 1 of 3 — Mood & note</div>
                      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                          <button key={n} onClick={()=>setTodayMood(n)}
                            style={{width:42,height:42,borderRadius:10,background:todayMood===n?moodColor(n):"#f5f4f0",border:`2px solid ${todayMood===n?moodColor(n):"rgba(0,0,0,0.08)"}`,color:todayMood===n?"#000":"#9a9590",fontWeight:900,fontSize:15,cursor:"pointer"}}>
                            {n}
                          </button>
                        ))}
                      </div>
                      <textarea value={todayNote} onChange={e=>setTodayNote(e.target.value)}
                        placeholder="Anything on your mind? (optional, private)"
                        style={{...C.inp,width:"100%",minHeight:80,resize:"none",fontSize:13,marginBottom:16}}/>
                      <div style={{display:"flex",gap:8}}>
                        <button style={{...C.btn("#d4860a"),flex:1,opacity:todayMood?1:0.4}} onClick={()=>{if(todayMood){logMood();setCheckInStep(2);}}} disabled={!todayMood}>Next →</button>
                        <button style={C.ghost} onClick={()=>setCheckInStep(0)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {checkInStep===2&&(
                    <div>
                      <div style={{fontSize:20,marginBottom:6}}></div>
                      <div style={{fontSize:17,fontWeight:800,marginBottom:4}}>Low mood screen</div>
                      <div style={{fontSize:13,color:"#9a9590",marginBottom:20}}>Step 2 of 3 — PHQ-2 (2 quick questions)</div>
                      {PHQ2.map((q,qi)=>(
                        <div key={qi} style={{marginBottom:18}}>
                          <div style={{fontSize:13,fontWeight:600,marginBottom:10,lineHeight:1.5}}>{q}</div>
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {PHQ_OPTS.map((opt,oi)=>(
                              <button key={oi} onClick={()=>{const a=[...phqAnswers];a[qi]=oi;setPhqAnswers(a);}}
                                style={{textAlign:"left",background:phqAnswers[qi]===oi?"rgba(124,58,237,0.2)":"#f5f4f0",border:`1px solid ${phqAnswers[qi]===oi?"#d4860a":"rgba(0,0,0,0.08)"}`,borderRadius:8,padding:"8px 12px",color:phqAnswers[qi]===oi?"#d4860a":"#9a9590",fontSize:13,cursor:"pointer",fontWeight:phqAnswers[qi]===oi?700:400}}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div style={{display:"flex",gap:8,marginTop:4}}>
                        <button style={{...C.btn("#d4860a"),flex:1,opacity:phqAnswers.every(a=>a!==null)?1:0.4}} onClick={()=>{if(phqAnswers.every(a=>a!==null))setCheckInStep(3);}} disabled={!phqAnswers.every(a=>a!==null)}>Next →</button>
                        <button style={C.ghost} onClick={()=>setCheckInStep(1)}>← Back</button>
                      </div>
                    </div>
                  )}

                  {checkInStep===3&&(
                    <div>
                      <div style={{fontSize:20,marginBottom:6}}>🫁</div>
                      <div style={{fontSize:17,fontWeight:800,marginBottom:4}}>Anxiety screen</div>
                      <div style={{fontSize:13,color:"#9a9590",marginBottom:20}}>Step 3 of 3 — GAD-2 (2 quick questions)</div>
                      {GAD2.map((q,qi)=>(
                        <div key={qi} style={{marginBottom:18}}>
                          <div style={{fontSize:13,fontWeight:600,marginBottom:10,lineHeight:1.5}}>{q}</div>
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {PHQ_OPTS.map((opt,oi)=>(
                              <button key={oi} onClick={()=>{const a=[...gadAnswers];a[qi]=oi;setGadAnswers(a);}}
                                style={{textAlign:"left",background:gadAnswers[qi]===oi?"rgba(124,58,237,0.2)":"#f5f4f0",border:`1px solid ${gadAnswers[qi]===oi?"#d4860a":"rgba(0,0,0,0.08)"}`,borderRadius:8,padding:"8px 12px",color:gadAnswers[qi]===oi?"#d4860a":"#9a9590",fontSize:13,cursor:"pointer",fontWeight:gadAnswers[qi]===oi?700:400}}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div style={{display:"flex",gap:8,marginTop:4}}>
                        <button style={{...C.btn("#d4860a"),flex:1,opacity:gadAnswers.every(a=>a!==null)?1:0.4}} onClick={()=>{if(gadAnswers.every(a=>a!==null))finishCheckIn();}} disabled={!gadAnswers.every(a=>a!==null)}>See Results →</button>
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
                  <div style={{fontSize:24,marginBottom:8}}></div>
                  <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Check-in Complete</div>
                  <div style={{fontSize:13,color:"#9a9590",marginBottom:20}}>Here's a gentle summary of how you're doing.</div>

                  <div style={C.g("1fr 1fr")}>
                    {[
                      {label:"Mood Today",val:`${checkInResults.mood}/10`,sub:checkInResults.mood>=7?"Feeling good":"Could be better",color:moodColor(checkInResults.mood)},
                      {label:"Depression Screen",val:`${checkInResults.phqTotal}/6`,sub:checkInResults.phqRisk==="low"?"Low indicators":checkInResults.phqRisk==="mild"?"Mild indicators":"Elevated — consider support",color:checkInResults.phqRisk==="low"?"#3a7d5c":checkInResults.phqRisk==="mild"?"#d4860a":"#c0392b"},
                      {label:"Anxiety Screen",val:`${checkInResults.gadTotal}/6`,sub:checkInResults.gadRisk==="low"?"Low indicators":checkInResults.gadRisk==="mild"?"Mild indicators":"Elevated — consider support",color:checkInResults.gadRisk==="low"?"#3a7d5c":checkInResults.gadRisk==="mild"?"#d4860a":"#c0392b"},
                      {label:"Logged Streak",val:`${moodHistory.filter(d=>d.score!==null).length} days`,sub:"Keep checking in",color:"#d4860a"},
                    ].map(r=>(
                      <div key={r.label} style={{background:"#f5f4f0",borderRadius:12,padding:"14px 16px",textAlign:"center"}}>
                        <div style={{fontSize:22,fontWeight:900,color:r.color}}>{r.val}</div>
                        <div style={{fontSize:12,fontWeight:700,color:"#9a9590",marginBottom:2}}>{r.label}</div>
                        <div style={{fontSize:11,color:r.color}}>{r.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* AI Response */}
                  <div style={{marginTop:16,background:"#f5f4f0",border:"1px solid rgba(0,0,0,0.08)",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:11,color:"#d4860a",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}> LifeSync AI Response</div>
                    {wellnessAiLoading
                      ? <div style={{fontSize:13,color:"#9a9590"}}>Thinking of something kind to say...</div>
                      : <div style={{fontSize:13,lineHeight:1.7,color:"#111010"}}>{wellnessMsg}</div>
                    }
                  </div>

                  {(checkInResults.phqRisk==="elevated"||checkInResults.gadRisk==="elevated")&&(
                    <div style={{marginTop:12,background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#fca5a5",lineHeight:1.6}}>
                      🆘 Your responses suggest you may be struggling. You're not alone. Please consider talking to someone — call or text <strong>988</strong> (free, 24/7), or reach out to a therapist or trusted person.
                    </div>
                  )}

                  <button style={{...C.btn("#d4860a"),width:"100%",marginTop:16}} onClick={resetCheckIn}>Done</button>
                </div>
              </div>
            )}

            {/* INSIGHTS + RESOURCES ROW */}
            <div style={C.g()}>
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div>
                    <div style={C.cTitle}>Patterns & Insights</div>
                    <div style={{fontSize:11,color:"#9a9590",fontWeight:600,marginTop:2}}>Based on your actual logged data</div>
                  </div>
                  <span style={{fontSize:10,background:"rgba(99,102,241,0.15)",color:"#d4860a",border:"1px solid rgba(99,102,241,0.3)",borderRadius:99,padding:"3px 10px",fontWeight:700,letterSpacing:0.5}}>LIVE</span>
                </div>
                {computeInsights().map((ins,i)=>{
                  const bgMap = {
                    positive:"rgba(74,222,128,0.04)",
                    warning:"rgba(248,113,113,0.05)",
                    alert:"rgba(248,113,113,0.08)",
                    pattern:"rgba(250,204,21,0.04)",
                    neutral:"rgba(249,115,22,0.04)",
                    info:"rgba(100,116,139,0.04)"
                  };
                  const isLast = i === computeInsights().length - 1;
                  return (
                    <div key={i} style={{
                      padding:"14px 12px",
                      borderRadius:12,
                      background: bgMap[ins.type]||"transparent",
                      border:`1px solid ${ins.color}22`,
                      marginBottom: isLast ? 0 : 10,
                    }}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                        <span style={{fontSize:22,flexShrink:0,marginTop:1}}>{ins.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          {/* Tag + text */}
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                            {ins.tag && (
                              <span style={{fontSize:10,fontWeight:800,color:ins.color,background:`${ins.color}18`,border:`1px solid ${ins.color}33`,borderRadius:99,padding:"2px 8px",textTransform:"uppercase",letterSpacing:0.5,flexShrink:0}}>
                                {ins.tag}
                              </span>
                            )}
                          </div>
                          <div style={{fontSize:13,color:"#cbd5e1",lineHeight:1.65,marginBottom:ins.recommendation?10:0}}>{ins.text}</div>
                          {/* Recommendation */}
                          {ins.recommendation && (
                            <div style={{display:"flex",alignItems:"flex-start",gap:6,background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(0,0,0,0.08)"}}>
                              <span style={{fontSize:12,flexShrink:0,marginTop:1}}></span>
                              <div style={{fontSize:12,color:"#9a9590",lineHeight:1.5}}><span style={{color:"#9a9590",fontWeight:700}}>Tip: </span>{ins.recommendation}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={C.card}>
                <div style={C.cTitle}>Weekly Check-in</div>
                <div style={{fontSize:13,color:"#9a9590",marginBottom:16,lineHeight:1.6}}>Takes 2 minutes. Includes a mood log, a 2-question depression screen (PHQ-2), and a 2-question anxiety screen (GAD-2). Results are private and never shared.</div>
                <button style={{...C.btn("#d4860a"),width:"100%",marginBottom:10}} onClick={()=>setCheckInStep(1)}>Start Weekly Check-in →</button>
                <div style={{fontSize:11,color:"#9a9590",lineHeight:1.6}}>Based on validated clinical screening tools. Not a diagnosis — for self-awareness only.</div>
              </div>

              <div style={C.card}>
                <div style={C.cTitle}>Mental Health Resources</div>
                {[
                  {name:"988 Suicide & Crisis Lifeline",desc:"Call or text 988 — free, 24/7",color:"#c0392b",urgent:true},
                  {name:"Crisis Text Line",desc:"Text HOME to 741741",color:"#d4860a",urgent:true},
                  {name:"NAMI Helpline",desc:"1-800-950-NAMI (6264)",color:"#d4860a",urgent:false},
                  {name:"BetterHelp / Talkspace",desc:"Online therapy, affordable plans",color:"#3a7d5c",urgent:false},
                  {name:"Headspace / Calm",desc:"Guided meditation & sleep tools",color:"#d4860a",urgent:false},
                  {name:"Talk to LifeSync AI",desc:"Available anytime in the AI tab",color:"#d4860a",urgent:false},
                ].map(r=>(
                  <div key={r.name} style={C.row}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:r.urgent?"#fca5a5":"#111010"}}>{r.name}</div>
                      <div style={{fontSize:11,color:"#9a9590"}}>{r.desc}</div>
                    </div>
                    {r.urgent&&<span style={{fontSize:10,background:"rgba(248,113,113,0.15)",color:"#c0392b",padding:"2px 8px",borderRadius:99,fontWeight:700,border:"1px solid rgba(248,113,113,0.3)"}}>24/7</span>}
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
          const bmiColor = bmi ? (bmi<18.5?"#d4860a":bmi<25?"#3a7d5c":bmi<30?"#d4860a":"#c0392b") : "#9a9590";
          // Mifflin-St Jeor BMR + activity multiplier
          const activityMultipliers = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 };
          const activityMult = activityMultipliers[bs.activity_level||"moderate"] || 1.55;
          const bmr = (bs.age && bs.height_in && bs.current_weight) ? (() => {
            const wKg = bs.current_weight * 0.453592;
            const hCm = bs.height_in * 2.54;
            const isMale = (bs.sex||"male") === "male";
            // Mifflin-St Jeor: male = 10W + 6.25H - 5A + 5 / female = 10W + 6.25H - 5A - 161
            return Math.round(10 * wKg + 6.25 * hCm - 5 * bs.age + (isMale ? 5 : -161));
          })() : null;
          const tdee = bmr ? Math.round(bmr * activityMult) : null;
          // Smart calorie floor: never go below 10 cal/lb of bodyweight (absolute minimum for satiety)
          const calFloor = bs.current_weight ? Math.round(bs.current_weight * 10) : 1500;
          const goalLbs = bs.goal_weight && bs.current_weight ? Math.abs(bs.current_weight - bs.goal_weight).toFixed(1) : null;
          const goalDir = bs.goal_weight && bs.current_weight ? (bs.goal_weight < bs.current_weight ? "lose" : "gain") : null;
          const weeklyChange = tdee && goalDir ? (goalDir==="lose" ? Math.max(tdee - 500, calFloor) : tdee + 300) : null;
          // Macros at maintenance (protein 0.8g/lb, fat 25%, remainder carbs)
          const macros = tdee ? {
            protein: Math.round(bs.current_weight * 0.8),
            fat: Math.round((tdee * 0.25) / 9),
            get carbs() { return Math.round((tdee - this.protein*4 - this.fat*9) / 4); }
          } : null;
          const goalTypes = { fat_loss:" Fat Loss", muscle_gain:" Muscle Gain", general_fitness:" General Fitness", maintenance:" Maintenance", custom:" Custom Goal" };
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
                  <div style={{background:"linear-gradient(135deg,#111010,#f5f4f0)",border:"1px solid rgba(0,0,0,0.08)",borderRadius:16,padding:"20px 28px",display:"flex",flexDirection:"column",gap:16}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:18}}>
                        <div style={{position:"relative",cursor:"pointer"}} onClick={()=>{ setProfileForm({...bs}); setShowEditProfile(true); }}>
                          {avatarUrl
                            ? <img src={avatarUrl} alt="avatar" style={{width:64,height:64,borderRadius:"50%",objectFit:"cover",border:"2px solid rgba(0,0,0,0.08)"}}/>
                            : <div style={{width:64,height:64,borderRadius:"50%",background:"linear-gradient(135deg,#111010,#d4860a)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:22,color:"#fff"}}>
                                {(username||"?").slice(0,2).toUpperCase()}
                              </div>
                          }
                          <div style={{position:"absolute",bottom:-2,right:-2,width:20,height:20,background:"#d4860a",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:700,border:"2px solid #f5f4f0"}}>+</div>
                          <div style={{position:"absolute",bottom:18,right:-4,fontSize:16}}>{lvl.icon}</div>
                        </div>
                        <div>
                          <div style={{fontSize:22,fontWeight:900}}>{username||"Set your name"}</div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                            <span style={{fontSize:13,fontWeight:700,color:lvl.color}}>{lvl.name}</span>
                            <span style={{fontSize:11,color:"#9a9590"}}>·</span>
                            <span style={{fontSize:13,color:"#d4860a",fontWeight:700}}> {progress.daily_streak||0} day streak</span>
                          </div>
                          {bs.goal_type && <div style={{fontSize:12,color:"#9a9590",marginTop:2}}>{goalTypes[bs.goal_type]||bs.goal_type}</div>}
                        </div>
                      </div>
                      <button style={{...C.btn("#d4860a")}} onClick={()=>{ setProfileForm({...bs}); setShowEditProfile(true); }}> Edit Profile</button>
                    </div>
                    {/* XP bar */}
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#9a9590",marginBottom:5}}>
                        <span style={{fontWeight:700,color:lvl.color}}>{(progress.xp||0).toLocaleString()} XP</span>
                        {nextLvl ? <span>{xpToNext.toLocaleString()} XP to {nextLvl.name}</span> : <span style={{color:"#3a7d5c"}}>Max level reached! </span>}
                      </div>
                      <div style={{background:"rgba(0,0,0,0.07)",borderRadius:99,height:8,overflow:"hidden"}}>
                        <div style={{width:`${xpPct}%`,background:`linear-gradient(90deg,${lvl.color},#818cf8)`,height:"100%",borderRadius:99,transition:"width 0.8s"}}/>
                      </div>
                    </div>
                    {/* Streak stats */}
                    <div style={{display:"flex",gap:12}}>
                      {[[" Current Streak",`${progress.daily_streak||0} days`,"#d4860a"],[" Longest Streak",`${progress.longest_streak||0} days`,"#d4860a"],[" Total XP",`${(progress.xp||0).toLocaleString()}`,"#d4860a"],[" Life Score",`${lifeScore}/100`,"#3a7d5c"]].map(([label,val,statColor])=>(
                        <div key={label} style={{flex:1,background:"#f5f4f0",borderRadius:10,padding:"10px 12px",textAlign:"center",border:"1px solid rgba(0,0,0,0.08)"}}>
                          <div style={{fontSize:15,fontWeight:800,color:statColor}}>{val}</div>
                          <div style={{fontSize:10,color:"#9a9590",marginTop:2}}>{label}</div>
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
                    ["Age", bs.age ? `${bs.age} yrs` : "—", "", "#d4860a"],
                    ["Height", heightFt ? `${heightFt}'${heightIn}"` : "—", "", "#d4860a"],
                    ["Current Weight", bs.current_weight ? `${bs.current_weight} lbs` : "—", "", "#3a7d5c"],
                    ["Goal Weight", bs.goal_weight ? `${bs.goal_weight} lbs` : "—", "→", "#d4860a"],
                    ["BMI", bmi||"—", "", bmiColor],
                    ["Daily Calories", tdee ? `~${tdee.toLocaleString()}` : "—", "·", "#d4860a"],
                    ["BMR", bmr ? `${bmr.toLocaleString()}` : "—", "", "#d4860a"],
                  ].map(([label,val,icon,statColor])=>(
                    <div key={label} style={{background:"#f5f4f0",border:"1px solid rgba(0,0,0,0.08)",borderRadius:14,padding:"14px 16px",textAlign:"center"}}>
                      <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
                      <div style={{fontSize:18,fontWeight:800,color:statColor}}>{val}</div>
                      <div style={{fontSize:11,color:"#9a9590",marginTop:3}}>{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Badges */}
              {progress.badges && progress.badges.length > 0 && (
                <div style={C.card}>
                  <div style={C.cTitle}> Badges Earned</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:8}}>
                    {progress.badges.map(bid=>{
                      const badge = BADGES.find(b=>b.id===bid);
                      if (!badge) return null;
                      return(
                        <div key={bid} title={badge.desc} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"8px 14px"}}>
                          <span style={{fontSize:20}}>{badge.icon}</span>
                          <div><div style={{fontSize:12,fontWeight:700,color:"#d4860a"}}>{badge.label}</div><div style={{fontSize:10,color:"#9a9590"}}>{badge.desc}</div></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Goals section */}
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={C.cTitle}> My Goals</div>
                  <button style={{...C.btn("#d4860a"),fontSize:11,padding:"5px 14px"}} onClick={()=>setShowAddGoal(true)}>+ Add Goal</button>
                </div>
                {goals.length === 0 ? (
                  <div style={{textAlign:"center",padding:"24px 0"}}>
                    <div style={{fontSize:36,marginBottom:10}}></div>
                    <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>No goals yet</div>
                    <div style={{fontSize:12,color:"#9a9590",marginBottom:16}}>Set a goal and track your progress here.</div>
                    <button style={C.btn("#d4860a")} onClick={()=>setShowAddGoal(true)}>+ Set Your First Goal</button>
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {/* Active goals */}
                    {goals.filter(g=>!g.completed).map(g=>{
                      const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current_value/g.target_value)*100)) : 0;
                      const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline)-new Date())/(1000*60*60*24)) : null;
                      const catColors = { fitness:"#3a7d5c", finance:"#d4860a", health:"#d4860a", personal:"#d4860a" };
                      const col = catColors[g.category] || "#d4860a";
                      return (
                        <div key={g.id} style={{background:"#f5f4f0",border:"1px solid rgba(0,0,0,0.08)",borderRadius:14,padding:"16px 18px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                            <div style={{flex:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                                <span style={{fontSize:11,fontWeight:700,color:col,background:`${col}18`,border:`1px solid ${col}30`,borderRadius:6,padding:"2px 8px",textTransform:"uppercase"}}>{g.category}</span>
                                {daysLeft !== null && <span style={{fontSize:11,color:daysLeft<=7?"#c0392b":daysLeft<=14?"#d4860a":"#9a9590"}}>{daysLeft > 0 ? `${daysLeft} days left` : " Overdue"}</span>}
                              </div>
                              <div style={{fontSize:16,fontWeight:800}}>{g.title}</div>
                            </div>
                            <div style={{display:"flex",gap:6,flexShrink:0}}>
                              <button onClick={()=>{setShowUpdateGoal(g);setGoalUpdateVal(String(g.current_value));}} style={{background:"rgba(99,102,241,0.15)",border:"1px solid #6366f1",color:"#d4860a",borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:700}}>Update</button>
                              <button onClick={()=>deleteGoal(g.id)} style={{background:"transparent",border:"1px solid rgba(0,0,0,0.08)",color:"#9a9590",borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>×</button>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div style={{background:"rgba(0,0,0,0.07)",borderRadius:99,height:10,overflow:"hidden",marginBottom:6}}>
                            <div style={{width:`${pct}%`,background:`linear-gradient(90deg,${col},${col}99)`,height:"100%",borderRadius:99,transition:"width 0.8s"}}/>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                            <span style={{color:"#9a9590"}}>{g.current_value} / {g.target_value} {g.unit}</span>
                            <span style={{fontWeight:800,color:col}}>{pct}%</span>
                          </div>
                          {g.deadline && (
                            <div style={{fontSize:11,color:"#9a9590",marginTop:4}}>
                              Target: {new Date(g.deadline).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Completed goals */}
                    {goals.filter(g=>g.completed).length > 0 && (
                      <div>
                        <div style={{fontSize:11,color:"#3a7d5c",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10,marginTop:4}}> Completed</div>
                        {goals.filter(g=>g.completed).map(g=>(
                          <div key={g.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:10,marginBottom:8,opacity:0.8}}>
                            <div>
                              <div style={{fontSize:13,fontWeight:700,color:"#3a7d5c"}}>✓ {g.title}</div>
                              <div style={{fontSize:11,color:"#9a9590"}}>{g.target_value} {g.unit} achieved</div>
                            </div>
                            <button onClick={()=>deleteGoal(g.id)} style={{background:"transparent",border:"none",color:"#6b6763",fontSize:16,cursor:"pointer"}}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!hasStats && (
                <div style={{...C.card,textAlign:"center",padding:"40px 20px"}}>
                  <div style={{fontSize:48,marginBottom:12}}></div>
                  <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Set Up Your Body Profile</div>
                  <div style={{fontSize:13,color:"#9a9590",marginBottom:20,maxWidth:400,margin:"0 auto 20px"}}>Add your age, height, and weight to unlock BMI, calorie targets, and progress tracking.</div>
                  <button style={C.btn("#d4860a")} onClick={()=>{ setProfileForm({...bs}); setShowEditProfile(true); }}>+ Add Your Stats</button>
                </div>
              )}

              {/* Goal card */}
              {hasStats && bs.goal_type && (
                <div style={{...C.card}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                    <div>
                      <div style={C.cTitle}>Your Goal</div>
                      <div style={{fontSize:20,fontWeight:800,color:"#d4860a",marginTop:4}}>{goalTypes[bs.goal_type]||bs.goal_type}</div>
                      {bs.goal_label && <div style={{fontSize:13,color:"#9a9590",marginTop:4}}>"{bs.goal_label}"</div>}
                    </div>
                    {bs.goal_date && (
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:11,color:"#9a9590"}}>Target date</div>
                        <div style={{fontSize:14,fontWeight:700,color:"#111010"}}>{new Date(bs.goal_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
                        <div style={{fontSize:11,color:"#9a9590",marginTop:2}}>
                          {Math.max(0,Math.ceil((new Date(bs.goal_date)-new Date())/(1000*60*60*24)))} days left
                        </div>
                      </div>
                    )}
                  </div>
                  {goalLbs && (
                    <>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}>
                        <span style={{color:"#9a9590"}}>Need to {goalDir} <strong style={{color:"#111010"}}>{goalLbs} lbs</strong></span>
                        {weeklyChange && <span style={{color:"#3a7d5c"}}>~{Math.max(weeklyChange, 1600).toLocaleString()} cal/day target</span>}
                      </div>
                      <div style={{background:"rgba(0,0,0,0.07)",borderRadius:99,height:10,overflow:"hidden",marginBottom:8}}>
                        {(() => {
                          const pct = startWeight && bs.goal_weight && bs.current_weight ?
                            Math.min(100, Math.max(0, Math.abs((bs.current_weight - startWeight) / (bs.goal_weight - startWeight)) * 100)) : 0;
                          return <div style={{width:`${pct}%`,background:"linear-gradient(90deg,#6366f1,#818cf8)",height:"100%",borderRadius:99,transition:"width 1s"}}/>;
                        })()}
                      </div>
                      {totalChange !== null && parseFloat(totalChange) !== 0 && (
                        <div style={{fontSize:12,color:goalDir==="lose"?(parseFloat(totalChange)<0?"#3a7d5c":"#c0392b"):(parseFloat(totalChange)>0?"#3a7d5c":"#c0392b")}}>
                          {parseFloat(totalChange) < 0 ? "▼" : "▲"} {Math.abs(totalChange)} lbs since you started
                        </div>
                      )}
                    </>
                  )}
                  {(bs.goal_type==="fat_loss"||bs.goal_type==="muscle_gain"||bs.goal_type==="general_fitness") && tdee && (
                    <div style={{marginTop:14}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
                        {(bs.goal_type==="muscle_gain" ? [
                          ["Maintenance", tdee,      "#9a9590", "maintain weight"],
                          ["Lean Bulk",   tdee+200,  "#d4860a", "~0.25 lb/week gain"],
                          ["Bulk",        tdee+400,  "#d4860a", "~0.5 lb/week gain"],
                        ] : bs.goal_type==="fat_loss" ? [
                          ["Maintenance", tdee,      "#9a9590", "maintain weight"],
                          ["Mild Cut",    Math.max(tdee-300, calFloor), "#d4860a", "~0.5 lb/week loss"],
                          ["Moderate Cut",Math.max(tdee-500, calFloor), "#d4860a", "~1 lb/week loss"],
                        ] : [
                          ["Light",       tdee-200,  "#9a9590", "slight deficit"],
                          ["Maintenance", tdee,      "#3a7d5c", "maintain weight"],
                          ["Active",      tdee+200,  "#d4860a", "slight surplus"],
                        ]).map((row)=>(
                          <div key={row[0]} style={{background:"#f5f4f0",border:"1px solid rgba(0,0,0,0.08)",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                            <div style={{fontSize:16,fontWeight:800,color:row[2]}}>{row[1].toLocaleString()}</div>
                            <div style={{fontSize:11,color:"#9a9590",marginTop:2,fontWeight:600}}>{row[0]}</div>
                            <div style={{fontSize:10,color:"#9a9590",marginTop:1}}>{row[3]}</div>
                          </div>
                        ))}
                      </div>
                      {bs.goal_type==="fat_loss" && (
                        <div style={{background:"rgba(250,204,21,0.07)",border:"1px solid rgba(250,204,21,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#9a9590",lineHeight:1.6}}>
                           <strong style={{color:"#d4860a"}}>Never go below 1,600 cal/day</strong> without medical supervision. Aggressive cuts cause muscle loss and metabolic slowdown. Slow and steady wins.
                        </div>
                      )}
                      {bs.goal_type==="muscle_gain" && (
                        <div style={{background:"rgba(129,140,248,0.07)",border:"1px solid rgba(129,140,248,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#9a9590",lineHeight:1.6}}>
                           <strong style={{color:"#d4860a"}}>Lean bulking</strong> minimizes fat gain. A 200–400 cal surplus with consistent training is the sweet spot for most people.
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
                    <div style={C.cTitle}> Weight Log</div>
                    <button style={{...C.btn("#d4860a"),fontSize:11,padding:"4px 12px"}} onClick={()=>setShowLogWeight(true)}>+ Log Weight</button>
                  </div>
                  {wLogSorted.length===0 ? (
                    <div style={{textAlign:"center",padding:"20px 0",color:"#9a9590",fontSize:13}}>No weight entries yet. Log your first weigh-in!</div>
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
                                <div key={i} style={{position:"absolute",left:0,top:`${(i/2)*90}%`,fontSize:10,color:"#9a9590",transform:"translateY(-50%)"}}>{v.toFixed(0)}</div>
                              ))}
                              {weights.map((s,si)=>{
                                if(si===0) return null;
                                const x1=`${((si-1)/(weights.length-1||1))*100}%`,x2=`${(si/(weights.length-1||1))*100}%`;
                                const y1=`${((maxW-weights[si-1])/range)*90}%`,y2=`${((maxW-s)/range)*90}%`;
                                const col = goalDir==="lose"?(s<=weights[si-1]?"#3a7d5c":"#c0392b"):(s>=weights[si-1]?"#3a7d5c":"#c0392b");
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
                          const col = delta===null?"#9a9590":goalDir==="lose"?(parseFloat(delta)<=0?"#3a7d5c":"#c0392b"):(parseFloat(delta)>=0?"#3a7d5c":"#c0392b");
                          return(
                            <div key={entry.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#f5f4f0",borderRadius:10}}>
                              <div style={{fontSize:13,color:"#9a9590"}}>{new Date(entry.logged_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                {delta!==null && <div style={{fontSize:12,fontWeight:700,color:col}}>{parseFloat(delta)>0?"+":""}{delta} lbs</div>}
                                <div style={{fontSize:16,fontWeight:800,color:"#111010"}}>{entry.weight} lbs</div>
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
          const rankColor = (r) => r===1?"#d4860a":r===2?"#9a9590":r===3?"#cd7f32":"#9a9590";
          const rankMedal = (r) => r===1?"1":r===2?"2":r===3?"3":"";
          const scoreColor2 = (s) => s>=65?"#3a7d5c":s>=55?"#d4860a":s>=45?"#c87941":"#c0392b";
          const deltaColor = (d) => d>0?"#3a7d5c":d<0?"#c0392b":"#9a9590";
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
              <div style={{background:"#f0faf4",border:"1px solid rgba(58,125,92,0.2)",borderRadius:16,padding:"20px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
                <div>
                  <div style={{fontSize:11,color:"#3a7d5c",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}> Life Score League — Season 1</div>
                  <div style={{fontSize:28,fontWeight:900}}>You're ranked <span style={{color:rankColor(myRank)}}>{myRank<=3?rankMedal(myRank):`#${myRank}`}</span> of {leagueMembers.length}</div>
                  <div style={{fontSize:13,color:"#9a9590",marginTop:4}}>{leagueEndsIn} weeks left · Everyone starts at 50 · Private stats, public scores only</div>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                  <button style={{...C.btn("#059669"),fontSize:13}} onClick={()=>setShowInviteModal(true)}>+ Invite Friends</button>
                  <div style={{textAlign:"center",background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:12,padding:"8px 20px"}}>
                    <div style={{fontSize:11,color:"#3a7d5c",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Your Score</div>
                    <div style={{fontSize:28,fontWeight:900,color:scoreColor2(myLeagueScore)}}>{myLeagueScore}</div>
                  </div>
                </div>
              </div>

              {/* Season progress */}
              <div style={{...C.card,padding:"14px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontSize:12,color:"#9a9590",fontWeight:700}}>Season Progress — Week {leagueWeek} of {leagueTotalWeeks}</div>
                  <div style={{fontSize:12,color:"#3a7d5c",fontWeight:700}}>{leagueEndsIn} weeks to go</div>
                </div>
                <div style={{background:"rgba(0,0,0,0.07)",borderRadius:99,height:8,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,background:"linear-gradient(90deg,#4ade80,#22d3ee)",height:"100%",borderRadius:99}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#9a9590",marginTop:4}}>
                  <span>Start</span><span>Halfway</span><span>End </span>
                </div>
              </div>

              {/* Sub-nav */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[["leaderboard"," Leaderboard"],["matchup"," Head-to-Head"],["history"," Score History"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setLeagueView(v)} style={{...C.ghost,color:leagueView===v?"#3a7d5c":"#9a9590",border:`1px solid ${leagueView===v?"#3a7d5c":"rgba(0,0,0,0.08)"}`,background:leagueView===v?"rgba(74,222,128,0.08)":"transparent",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:700}}>
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
                      <div key={m.id} style={{background:m.isYou?"linear-gradient(145deg,#0a1e0f,#071510)":"linear-gradient(145deg,#ffffff,#ffffff)",border:`1px solid ${m.isYou?"rgba(58,125,92,0.2)":"rgba(0,0,0,0.08)"}`,borderRadius:16,padding:"16px 20px",display:"flex",alignItems:"center",gap:16,position:"relative",overflow:"hidden"}}>
                        {isLeading&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#facc15,#f97316,#facc15)"}}/>}
                        <div style={{fontSize:24,width:36,textAlign:"center",flexShrink:0}}>{rankMedal(i+1)}</div>
                        <div style={{width:42,height:42,borderRadius:"50%",background:m.isYou?"linear-gradient(135deg,#1d4ed8,#4ade80)":"linear-gradient(135deg,rgba(0,0,0,0.08),rgba(0,0,0,0.06))",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,flexShrink:0}}>{m.avatar}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                            <span style={{fontSize:15,fontWeight:800}}>{m.name}</span>
                            {m.isYou&&<span style={{fontSize:10,background:"rgba(74,222,128,0.15)",color:"#3a7d5c",padding:"2px 7px",borderRadius:99,fontWeight:700,border:"1px solid rgba(74,222,128,0.3)"}}>YOU</span>}
                            {isLeading&&!m.isYou&&<span style={{fontSize:10,background:"rgba(250,204,21,0.15)",color:"#d4860a",padding:"2px 7px",borderRadius:99,fontWeight:700}}>LEADING</span>}
                          </div>
                          <div style={{fontSize:12,color:"#9a9590"}}>Top streak: <span style={{color:"#d4860a",fontWeight:700}}>{m.streakHighlight}</span></div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:26,fontWeight:900,color:scoreColor2(m.score)}}>{m.score}</div>
                          <div style={{fontSize:12,fontWeight:700,color:deltaColor(delta)}}>{deltaIcon(delta)} {Math.abs(delta)} this wk</div>
                        </div>
                        <div style={{display:"flex",alignItems:"flex-end",gap:2,height:28,flexShrink:0}}>
                          {(m.weeklyHistory||[50]).map((s,si)=>{
                            const h = Math.max(4,Math.round(((s-45)/25)*26));
                            const isLast = si===(m.weeklyHistory.length-1);
                            return <div key={si} style={{width:6,height:h,borderRadius:"2px 2px 0 0",background:isLast?scoreColor2(s):"rgba(0,0,0,0.08)"}}/>;
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
                  <div style={{fontSize:13,color:"#9a9590"}}>Pick an opponent to compare your progress. Only Life Scores and streak highlights are visible — no personal finance or health data is shared.</div>
                  <div style={C.g()}>
                    {sorted.filter(m=>!m.isYou).map(opp=>{
                      const myS = myLeagueScore;
                      const diff = myS - opp.score;
                      const winning = diff >= 0;
                      return(
                        <div key={opp.id} onClick={()=>setSelectedMatchup(selectedMatchup===opp.id?null:opp.id)} style={{...C.card,cursor:"pointer",border:selectedMatchup===opp.id?"1px solid #4ade80":"1px solid rgba(0,0,0,0.08)"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:selectedMatchup===opp.id?16:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:12}}>
                              <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,rgba(0,0,0,0.08),rgba(0,0,0,0.06))",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13}}>{opp.avatar}</div>
                              <div><div style={{fontSize:14,fontWeight:700}}>{opp.name}</div><div style={{fontSize:12,color:"#d4860a"}}>{opp.streakHighlight}</div></div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:11,color:"#9a9590"}}>Their score</div>
                              <div style={{fontSize:20,fontWeight:900,color:scoreColor2(opp.score)}}>{opp.score}</div>
                            </div>
                          </div>
                          {selectedMatchup===opp.id&&(
                            <div>
                              <div style={{background:"#f5f4f0",borderRadius:12,padding:"14px 16px",marginBottom:12}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                                  <div style={{textAlign:"center"}}><div style={{fontSize:11,color:"#3a7d5c",fontWeight:700,marginBottom:4}}>YOU</div><div style={{fontSize:32,fontWeight:900,color:scoreColor2(myS)}}>{myS}</div></div>
                                  <div style={{textAlign:"center"}}><div style={{fontSize:20,color:"#9a9590"}}></div><div style={{fontSize:13,fontWeight:800,color:winning?"#3a7d5c":"#c0392b",marginTop:4}}>{winning?"You're ahead":"Behind by"} {Math.abs(diff)} pts</div></div>
                                  <div style={{textAlign:"center"}}><div style={{fontSize:11,color:"#9a9590",fontWeight:700,marginBottom:4}}>{opp.name.split(" ")[0].toUpperCase()}</div><div style={{fontSize:32,fontWeight:900,color:scoreColor2(opp.score)}}>{opp.score}</div></div>
                                </div>
                                <div style={{marginBottom:8}}><div style={{fontSize:11,color:"#9a9590",marginBottom:4}}>You</div><div style={{background:"rgba(0,0,0,0.07)",borderRadius:99,height:8,overflow:"hidden"}}><div style={{width:`${Math.min(100,myS)}%`,background:"#3a7d5c",height:"100%",borderRadius:99}}/></div></div>
                                <div><div style={{fontSize:11,color:"#9a9590",marginBottom:4}}>{opp.name}</div><div style={{background:"rgba(0,0,0,0.07)",borderRadius:99,height:8,overflow:"hidden"}}><div style={{width:`${Math.min(100,opp.score)}%`,background:"#d4860a",height:"100%",borderRadius:99}}/></div></div>
                              </div>
                              <div style={{fontSize:12,color:"#9a9590",lineHeight:1.6,textAlign:"center"}}>
                                {winning?`You're ${diff} pts ahead of ${opp.name.split(" ")[0]}. Keep your streaks going! `:`${opp.name.split(" ")[0]} is ${-diff} pts ahead. Log your habits to close the gap! `}
                              </div>
                            </div>
                          )}
                          {selectedMatchup!==opp.id&&<div style={{fontSize:12,color:"#9a9590",textAlign:"center",marginTop:10}}>Tap to compare →</div>}
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
                  <div style={{marginBottom:16,fontSize:13,color:"#9a9590"}}>All players start at 50. Scores reflect Life Score growth over the season.</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:18}}>
                    {sorted.map((m,i)=>{
                      const colors=["#3a7d5c","#d4860a","#d4860a","#d4860a","#d4860a"];
                      return(<div key={m.id} style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}><div style={{width:12,height:3,borderRadius:99,background:colors[i]}}/><span style={{color:m.isYou?"#3a7d5c":"#9a9590",fontWeight:m.isYou?800:400}}>{m.name}{m.isYou?" (You)":""}</span></div>);
                    })}
                  </div>
                  <div style={{position:"relative",height:180,paddingLeft:32}}>
                    {[70,60,50,40].map(v=>(<div key={v} style={{position:"absolute",left:0,top:`${((70-v)/30)*100}%`,fontSize:10,color:"#9a9590",transform:"translateY(-50%)"}}>{v}</div>))}
                    {[70,60,50,40].map(v=>(<div key={v} style={{position:"absolute",left:32,right:0,top:`${((70-v)/30)*100}%`,height:1,background:"rgba(30,58,95,0.5)"}}/>))}
                    {sorted.map((m,mi)=>{
                      const colors=["#3a7d5c","#d4860a","#d4860a","#d4860a","#d4860a"];
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
                    {WEEKS.map(w=><div key={w} style={{fontSize:10,color:"#9a9590",textAlign:"center"}}>{w}</div>)}
                  </div>
                </div>
              )}

              {/* LEAGUE CHAT */}
              <div style={C.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={C.cTitle}> League Chat</div>
                  <div style={{fontSize:11,color:"#9a9590"}}>{leagueMembers.length} members</div>
                </div>
                <div style={{display:"flex",gap:10,marginBottom:16}}>
                  <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#4ade80)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,flexShrink:0}}>{(username||"YO").slice(0,2).toUpperCase()}</div>
                  <div style={{flex:1,display:"flex",gap:8}}>
                    <input value={trashInput} onChange={e=>setTrashInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&postTrash()} placeholder="Talk your trash... or your motivation " style={{...C.inp,flex:1,fontSize:13}}/>
                    <button style={{...C.btn("#1d4ed8"),padding:"8px 16px",fontSize:13}} onClick={postTrash}>Post</button>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {trashTalk.map(msg=>(
                    <div key={msg.id} style={{background:"#f5f4f0",borderRadius:12,padding:"12px 14px",border:"1px solid rgba(0,0,0,0.06)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                        <div style={{width:30,height:30,borderRadius:"50%",background:msg.isYou||msg.from===username?"linear-gradient(135deg,#1d4ed8,#4ade80)":"linear-gradient(135deg,rgba(0,0,0,0.08),rgba(0,0,0,0.06))",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:11,flexShrink:0}}>{msg.avatar}</div>
                        <div style={{flex:1}}><span style={{fontSize:13,fontWeight:700,color:msg.from===username?"#3a7d5c":"#111010"}}>{msg.from}</span>{msg.from===username&&<span style={{fontSize:10,color:"#3a7d5c",marginLeft:6,fontWeight:600}}>you</span>}</div>
                        <span style={{fontSize:11,color:"#9a9590"}}>{msg.time}</span>
                      </div>
                      <div style={{fontSize:13,color:"#9a9590",lineHeight:1.5,marginBottom:8}}>{msg.text}</div>
                      <button onClick={()=>setTrashTalk(p=>p.map(m=>m.id===msg.id?{...m,likes:m.likes+1}:m))} style={{background:"transparent",border:"1px solid rgba(0,0,0,0.08)",color:"#9a9590",borderRadius:8,padding:"3px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}> {msg.likes}</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* INVITE MODAL */}
              {showInviteModal&&(
                <div style={C.overlay} onClick={()=>setShowInviteModal(false)}>
                  <div style={{...C.mbox,width:440}} onClick={e=>e.stopPropagation()}>
                    <div style={{fontSize:28,marginBottom:8}}></div>
                    <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Invite Friends to Your League</div>
                    <div style={{fontSize:13,color:"#9a9590",marginBottom:20,lineHeight:1.6}}>Friends join and track their own private Life Score. Only scores and streak highlights are visible to the group — no personal finance or health data is ever shared.</div>
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:12,color:"#9a9590",fontWeight:700,marginBottom:8}}>League Code</div>
                      <div style={{display:"flex",gap:8}}>
                        <div style={{...C.inp,flex:1,fontSize:20,fontWeight:900,textAlign:"center",letterSpacing:4,color:"#3a7d5c",userSelect:"all"}}>{LEAGUE_CODE}</div>
                        <button style={{...C.btn("#059669"),padding:"8px 16px"}} onClick={()=>copyToClipboard("code")}>{inviteCopied==="code"?"✓ Copied!":"Copy"}</button>
                      </div>
                    </div>
                    <div style={{marginBottom:20}}>
                      <div style={{fontSize:12,color:"#9a9590",fontWeight:700,marginBottom:8}}>Invite Link</div>
                      <div style={{display:"flex",gap:8}}>
                        <div style={{...C.inp,flex:1,fontSize:12,color:"#d4860a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{LEAGUE_LINK}</div>
                        <button style={{...C.btn("#1d4ed8"),padding:"8px 16px"}} onClick={()=>copyToClipboard("link")}>{inviteCopied==="link"?"✓ Copied!":"Copy"}</button>
                      </div>
                    </div>
                    <div style={{background:"rgba(74,222,128,0.07)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#9a9590",marginBottom:20,lineHeight:1.6}}>
                       <strong style={{color:"#9a9590"}}>Privacy guarantee:</strong> Debt, income, credit score, and health data are never visible to other players. Only your Life Score and streak highlights are shared.
                    </div>
                    <button style={{...C.ghost,width:"100%",padding:"10px"}} onClick={()=>setShowInviteModal(false)}>Close</button>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {/* ── COACH TAB ── */}
        {tab==="coach"&&(
          <div style={{maxWidth:680,margin:"0 auto",display:"flex",flexDirection:"column",height:"calc(100vh - 130px)"}}>
            {/* Header */}
            <div style={{padding:"8px 0 18px",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
                <div style={{width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#d4860a,#b8720a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🧠</div>
                <div>
                  <h2 style={{margin:0,fontFamily:"'DM Serif Display',serif",fontSize:22,color:"#111010"}}>LifeSync Coach</h2>
                  <p style={{margin:0,fontSize:12,color:"#9a9590"}}>Sees patterns across habits, mood, finance &amp; health</p>
                </div>
              </div>
            </div>
            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:14,paddingBottom:16}}>
              {coachMsgs.length===0&&!coachLoading&&(
                <div style={{textAlign:"center",color:"#9a9590",fontSize:14,marginTop:40,animation:"coachFadeInUp 0.4s ease"}}>
                  Analyzing your data...
                </div>
              )}
              {coachMsgs.map((m,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.isCoach?"flex-start":"flex-end",animation:"coachFadeInUp 0.3s ease"}}>
                  {m.isCoach&&<div style={{fontSize:11,color:"#9a9590",marginBottom:5,display:"flex",alignItems:"center",gap:5}}><span>🧠</span> Coach</div>}
                  <div style={{maxWidth:"82%",background:m.isCoach?"#fff":"#d4860a",color:m.isCoach?"#111010":"#fff",borderRadius:m.isCoach?"4px 18px 18px 18px":"18px 4px 18px 18px",padding:"13px 17px",fontSize:14,lineHeight:1.6,boxShadow:m.isCoach?"0 2px 10px rgba(17,16,16,0.07)":"0 2px 12px rgba(212,134,10,0.3)"}}>
                    {m.text}
                  </div>
                </div>
              ))}
              {coachLoading&&(
                <div style={{display:"flex",gap:5,padding:"12px 16px",background:"#fff",borderRadius:"4px 18px 18px 18px",alignSelf:"flex-start",boxShadow:"0 2px 10px rgba(17,16,16,0.07)",width:"fit-content"}}>
                  {[0,0.2,0.4].map((d,i)=>(
                    <div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#9a9590",animation:`coachTypingDot 1.2s ease-in-out ${d}s infinite`}}/>
                  ))}
                </div>
              )}
              <div ref={coachBottomRef}/>
            </div>
            {/* Prompt suggestions */}
            <div style={{flexShrink:0,marginBottom:12}}>
              <div style={{display:"flex",gap:8,marginBottom:10,overflowX:"auto",paddingBottom:4}}>
                {coachTabPrompts.map((cat,i)=>(
                  <button key={cat.label} onClick={()=>setCoachTabCategory(i)}
                    style={{whiteSpace:"nowrap",padding:"5px 14px",borderRadius:20,border:"1.5px solid",borderColor:coachTabCategory===i?"#d4860a":"rgba(17,16,16,0.12)",background:coachTabCategory===i?"rgba(212,134,10,0.08)":"transparent",color:coachTabCategory===i?"#d4860a":"#9a9590",fontSize:12,cursor:"pointer",fontWeight:coachTabCategory===i?600:400,transition:"all 0.15s",flexShrink:0}}>
                    {cat.label}
                  </button>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {coachTabPrompts[coachTabCategory].prompts.map(p=>(
                  <button key={p} onClick={async()=>{
                    if(coachLoading)return;
                    setCoachMsgs(prev=>[...prev,{text:p,isCoach:false,role:"user"}]);
                    const history=coachMsgs.filter(m=>m.role).map(m=>({role:m.role,content:m.text}));
                    await fetchCoachMessage("chat",p,history);
                  }} disabled={coachLoading}
                    style={{textAlign:"left",background:"#fff",border:"1.5px solid rgba(17,16,16,0.08)",borderRadius:12,padding:"10px 14px",fontSize:13,color:"#111010",cursor:coachLoading?"not-allowed":"pointer",opacity:coachLoading?0.5:1,transition:"border-color 0.15s,background 0.15s",display:"flex",alignItems:"center",justifyContent:"space-between"}}
                    onMouseEnter={e=>{if(!coachLoading){e.currentTarget.style.borderColor="#d4860a";e.currentTarget.style.background="rgba(212,134,10,0.03)";}}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(17,16,16,0.08)";e.currentTarget.style.background="#fff";}}>
                    {p}<span style={{color:"#d4860a",fontSize:14,flexShrink:0,marginLeft:8}}>→</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Input */}
            <div style={{display:"flex",gap:10,flexShrink:0,paddingBottom:8}}>
              <input ref={coachInputRef} value={coachInput} onChange={e=>setCoachInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendCoachMsg();}}}
                placeholder="Ask your coach anything..."
                style={{flex:1,border:"1.5px solid rgba(17,16,16,0.12)",borderRadius:24,padding:"12px 18px",fontSize:14,background:"#fff",color:"#111010",outline:"none",transition:"border-color 0.2s",fontFamily:"inherit"}}
                onFocus={e=>{e.target.style.borderColor="#d4860a";}}
                onBlur={e=>{e.target.style.borderColor="rgba(17,16,16,0.12)";}}/>
              <button onClick={sendCoachMsg} disabled={!coachInput.trim()||coachLoading}
                style={{width:46,height:46,borderRadius:"50%",background:coachInput.trim()?"#d4860a":"rgba(17,16,16,0.1)",border:"none",cursor:coachInput.trim()?"pointer":"not-allowed",color:coachInput.trim()?"#fff":"#9a9590",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>↑</button>
            </div>
          </div>
        )}

        {/* ── AI CHAT ── */}
        {tab==="ai"&&(
          <div style={{maxWidth:720,margin:"0 auto"}}>
            <div style={C.card}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#4ade80)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}></div>
                <div><div style={{fontWeight:800,fontSize:16}}>LifeSync AI</div><div style={{fontSize:12,color:"#3a7d5c"}}>● Online · Powered by Claude · Knows your full profile</div></div>
              </div>
              <div ref={chatRef} style={{height:360,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingRight:4}}>
                {msgs.map((m,i)=><div key={i} style={C.bub(m.role)}>{m.text}</div>)}
                {aiLoading&&<div style={{...C.bub("assistant"),color:"#9a9590"}}>Thinking...</div>}
              </div>
              <div style={{display:"flex",gap:10,marginTop:14}}>
                <input style={{...C.inp,flex:1}} value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Ask about habits, finances, health..."/>
                <button style={C.btn()} onClick={sendMsg} disabled={aiLoading}>{aiLoading?"...":"Send"}</button>
              </div>
              <div style={{marginTop:14}}>
                <div style={{fontSize:11,color:"#9a9590",marginBottom:8,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Quick Prompts</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {["How do I grow my Life Score faster?","Help me keep my gym streak going","How do I qualify for the tax credit?","What habits should I add next?"].map(q=>(
                    <button key={q} onClick={()=>setAiInput(q)} style={{background:"#f5f4f0",border:"1px solid rgba(0,0,0,0.08)",color:"#9a9590",borderRadius:20,padding:"6px 12px",fontSize:12,cursor:"pointer"}}>{q}</button>
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
              <div style={{fontSize:13,color:"#9a9590",marginBottom:6}}>Current streak: <span style={{color:"#d4860a",fontWeight:800}}>{h.streak} </span></div>
              <div style={{fontSize:13,color:"#9a9590",marginBottom:20}}>Progress: <span style={{color:"#111010",fontWeight:700}}>{h.weekCount}/{t.target} {t.unit}</span></div>
{(()=>{
                const isDaily = t.unit === "days/week";
                const todayStr = new Date().toISOString().split("T")[0];
                const loggedToday = isDaily && h.lastLoggedDate === todayStr;
                return (
                  <>
                    {loggedToday ? (
                      <div style={{background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.25)",borderRadius:12,padding:"16px",textAlign:"center",marginBottom:20}}>
                        <div style={{fontSize:28,marginBottom:8}}>✓</div>
                        <div style={{fontSize:14,fontWeight:800,color:"#3a7d5c",marginBottom:4}}>Already logged today!</div>
                        <div style={{fontSize:12,color:"#9a9590"}}>This habit can only be logged once per day.<br/>Come back tomorrow to keep your streak going.</div>
                      </div>
                    ) : (
                      <div style={{marginBottom:20}}>
                        {isDaily ? (
                          <div style={{fontSize:12,color:"#9a9590",fontWeight:700,marginBottom:10,textAlign:"center"}}>
                            Log today's completion (once per day)
                          </div>
                        ) : (
                          <div style={{fontSize:12,color:"#9a9590",fontWeight:700,marginBottom:10}}>How many times?</div>
                        )}
                        {!isDaily && (
                          <div style={{display:"flex",alignItems:"center",gap:16}}>
                            <button onClick={()=>setLogVal(v=>Math.max(1,v-1))} style={{...C.ghost,fontSize:22,padding:"4px 16px"}}>−</button>
                            <span style={{fontSize:32,fontWeight:900,minWidth:48,textAlign:"center"}}>{logVal}</span>
                            <button onClick={()=>setLogVal(v=>v+1)} style={{...C.ghost,fontSize:22,padding:"4px 16px"}}>+</button>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{display:"flex",gap:10}}>
                      {loggedToday ? (
                        <button style={{...C.ghost,flex:1,padding:"10px"}} onClick={()=>setLogModal(null)}>Close</button>
                      ) : (
                        <>
                          <button style={{...C.btn("#059669"),flex:1}} onClick={()=>logHabit(logModal, isDaily ? 1 : logVal)}>✓ Log &amp; Update Score</button>
                          <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setLogModal(null)}>Cancel</button>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* ── ADD RECOVERY MODAL ── */}
      {showAddRecovery&&(
        <div style={C.overlay} onClick={()=>setShowAddRecovery(false)}>
          <div style={{...C.mbox,width:440}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}> Start a Recovery Streak</div>
            <div style={{fontSize:12,color:"#9a9590",marginBottom:20}}>Every day clean is a win. No judgment — just progress.</div>

            <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>What are you tracking?</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
              {[
                {id:"alcohol",  icon:"", label:"Alcohol"},
                {id:"nicotine", icon:"", label:"Nicotine"},
                {id:"drugs",    icon:"", label:"Drugs"},
                {id:"gambling", icon:"", label:"Gambling"},
                {id:"social",   icon:"", label:"Social Media"},
                {id:"custom",   icon:"", label:"Custom"},
              ].map(s=>(
                <button key={s.id} onClick={()=>setNewRecovery(p=>({...p,substance:s.id}))}
                  style={{padding:"12px 8px",borderRadius:12,border:`2px solid ${newRecovery.substance===s.id?"#d4860a":"rgba(0,0,0,0.08)"}`,
                    background:newRecovery.substance===s.id?"rgba(99,102,241,0.15)":"#f5f4f0",
                    cursor:"pointer",textAlign:"center",transition:"all 0.2s"}}>
                  <div style={{fontSize:24,marginBottom:4}}>{s.icon}</div>
                  <div style={{fontSize:11,fontWeight:700,color:newRecovery.substance===s.id?"#d4860a":"#9a9590"}}>{s.label}</div>
                </button>
              ))}
            </div>

            {newRecovery.substance==="custom"&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,color:"#9a9590",marginBottom:6}}>What are you quitting?</div>
                <input value={newRecovery.custom} onChange={e=>setNewRecovery(p=>({...p,custom:e.target.value}))}
                  placeholder="e.g. Caffeine, Junk food..." style={{...C.inp,width:"100%"}}/>
              </div>
            )}

            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,color:"#9a9590",marginBottom:6}}>Start date — when did you last use?</div>
              <input type="date" value={newRecovery.start_date}
                onChange={e=>setNewRecovery(p=>({...p,start_date:e.target.value}))}
                style={{...C.inp,width:"100%"}}/>
              <div style={{fontSize:11,color:"#9a9590",marginTop:4}}>Set to today if starting fresh, or back-date it if you're already clean.</div>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={addRecovery}>Start Tracking →</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowAddRecovery(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD HABIT MODAL ── */}
      {showAdd&&(
        <div style={C.overlay} onClick={()=>{setShowAdd(false);setHabitTab("templates");}}>
          <div style={{...C.mbox,width:500,maxHeight:"85vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:800,marginBottom:14}}>+ Add a Habit</div>

            {/* Tabs */}
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              {[["templates"," Templates"],["custom"," Custom"]].map(([v,l])=>(
                <button key={v} onClick={()=>setHabitTab(v)}
                  style={{flex:1,padding:"8px",borderRadius:10,border:`1px solid ${habitTab===v?"#d4860a":"rgba(0,0,0,0.08)"}`,background:habitTab===v?"rgba(99,102,241,0.15)":"#f5f4f0",color:habitTab===v?"#d4860a":"#9a9590",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  {l}
                </button>
              ))}
            </div>

            {habitTab==="templates" && (
              <div style={{overflowY:"auto",flex:1,minHeight:0,paddingRight:4}}>
                {["health","finance","wellness"].map(cat=>{
                  const available = HABIT_TEMPLATES.filter(t=>t.category===cat && !habits.find(h=>h.id===t.id));
                  if (available.length===0) return null;
                  const catLabel = {health:" Health",finance:" Finance",wellness:" Wellness"}[cat];
                  return (
                    <div key={cat} style={{marginBottom:14}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#9a9590",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{catLabel}</div>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {available.map(t=>(
                          <button key={t.id} onClick={()=>addHabit(t.id)}
                            style={{background:"#f5f4f0",border:"1px solid rgba(0,0,0,0.08)",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",color:"#111010",textAlign:"left",transition:"border 0.2s"}}
                            onMouseEnter={e=>e.currentTarget.style.borderColor="#d4860a"}
                            onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(0,0,0,0.08)"}>
                            <span style={{fontSize:22}}>{t.icon}</span>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:700}}>{t.label}</div>
                              <div style={{fontSize:11,color:"#9a9590"}}>Target: {t.target} {t.unit} · +{t.scorePerStreak} pts/streak</div>
                            </div>
                            <span style={{fontSize:18,color:"#6b6763"}}>+</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {HABIT_TEMPLATES.every(t=>habits.find(h=>h.id===t.id)) && (
                  <div style={{textAlign:"center",padding:"20px 0",color:"#9a9590",fontSize:13}}>You've added all templates! Try creating a custom habit. </div>
                )}
              </div>
            )}

            {habitTab==="custom" && (
              <div style={{display:"flex",flexDirection:"column",gap:14,overflowY:"auto",flex:1,minHeight:0}}>
                <div>
                  <div style={{fontSize:12,color:"#9a9590",marginBottom:6,fontWeight:600}}>Habit Name</div>
                  <input value={customHabit.label} onChange={e=>setCustomHabit(p=>({...p,label:e.target.value}))}
                    placeholder="e.g. Morning Run, No Sugar, Read Bible..." style={{...C.inp,width:"100%"}}/>
                </div>

                <div>
                  <div style={{fontSize:12,color:"#9a9590",marginBottom:8,fontWeight:600}}>Pick an Icon</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,maxHeight:120,overflowY:"auto",background:"#f5f4f0",borderRadius:10,padding:8,border:"1px solid rgba(0,0,0,0.08)"}}>
                    {["⭐","","","","","","","","","","","","→","","","","","","","","","","","","","","🫧","","","","","","🫖","","","🩺","","","","","","","","","","","","","","·","·",""].map(e=>(
                      <button key={e} onClick={()=>setCustomHabit(p=>({...p,icon:e}))}
                        style={{padding:"6px",borderRadius:6,border:`2px solid ${customHabit.icon===e?"#d4860a":"transparent"}`,background:customHabit.icon===e?"rgba(99,102,241,0.2)":"transparent",cursor:"pointer",fontSize:18}}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <div style={{fontSize:12,color:"#9a9590",marginBottom:6,fontWeight:600}}>Target</div>
                    <input type="number" min="1" max="30" value={customHabit.target}
                      onChange={e=>setCustomHabit(p=>({...p,target:e.target.value}))}
                      style={{...C.inp,width:"100%"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:12,color:"#9a9590",marginBottom:6,fontWeight:600}}>Unit</div>
                    <select value={customHabit.unit} onChange={e=>setCustomHabit(p=>({...p,unit:e.target.value}))}
                      style={{...C.inp,width:"100%"}}>
                      <option value="times/week">times / week</option>
                      <option value="days/week">days / week</option>
                      <option value="times/month">times / month</option>
                      <option value="per month">per month</option>
                      <option value="per quarter">per quarter</option>
                    </select>
                  </div>
                </div>

                <div style={{background:"#f5f4f0",borderRadius:10,padding:"10px 14px",border:"1px solid rgba(0,0,0,0.08)",display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:24}}>{customHabit.icon}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:customHabit.label?"#111010":"#6b6763"}}>{customHabit.label||"Your habit name"}</div>
                    <div style={{fontSize:11,color:"#9a9590"}}>Target: {customHabit.target||5} {customHabit.unit}</div>
                  </div>
                </div>

                <button style={{...C.btn("#d4860a"),opacity:customHabit.label.trim()?1:0.4}} onClick={customHabit.label.trim()?addCustomHabit:null}>
                  + Add Custom Habit
                </button>
              </div>
            )}

            <button style={{...C.ghost,marginTop:14,padding:"9px",width:"100%"}} onClick={()=>{setShowAdd(false);setHabitTab("templates");}}>Cancel</button>
          </div>
        </div>
      )}


      {/* ── EDIT HABIT MODAL ── */}
      {editHabit&&(
        <div style={C.overlay} onClick={()=>setEditHabit(null)}>
          <div style={{...C.mbox,width:440}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:800,marginBottom:16}}> Edit Habit</div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:"#9a9590",marginBottom:6,fontWeight:600}}>Habit Name</div>
              <input value={editHabit.label} onChange={e=>setEditHabit(p=>({...p,label:e.target.value}))}
                style={{...C.inp,width:"100%"}}/>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:"#9a9590",marginBottom:8,fontWeight:600}}>Icon</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,maxHeight:100,overflowY:"auto",background:"#f5f4f0",borderRadius:10,padding:8,border:"1px solid rgba(0,0,0,0.08)"}}>
                {["⭐","","","","","","","","","","","","→","","","","","","","","","","","","","","🫧","","","","","","🫖","","","🩺","","","","","","","","","","","","·","·",""].map(e=>(
                  <button key={e} onClick={()=>setEditHabit(p=>({...p,icon:e}))}
                    style={{padding:"6px",borderRadius:6,border:`2px solid ${editHabit.icon===e?"#d4860a":"transparent"}`,background:editHabit.icon===e?"rgba(99,102,241,0.2)":"transparent",cursor:"pointer",fontSize:18}}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              <div>
                <div style={{fontSize:12,color:"#9a9590",marginBottom:6,fontWeight:600}}>Target</div>
                <input type="number" min="1" max="30" value={editHabit.target}
                  onChange={e=>setEditHabit(p=>({...p,target:e.target.value}))}
                  style={{...C.inp,width:"100%"}}/>
              </div>
              <div>
                <div style={{fontSize:12,color:"#9a9590",marginBottom:6,fontWeight:600}}>Unit</div>
                <select value={editHabit.unit} onChange={e=>setEditHabit(p=>({...p,unit:e.target.value}))}
                  style={{...C.inp,width:"100%"}}>
                  <option value="times/week">times / week</option>
                  <option value="days/week">days / week</option>
                  <option value="times/month">times / month</option>
                  <option value="per month">per month</option>
                  <option value="per quarter">per quarter</option>
                </select>
              </div>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={saveEditHabit}>Save Changes</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setEditHabit(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE HABIT CONFIRMATION ── */}
      {deleteHabitId&&(
        <div style={C.overlay} onClick={()=>setDeleteHabitId(null)}>
          <div style={{...C.mbox,width:380,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:36,marginBottom:12}}></div>
            <div style={{fontSize:17,fontWeight:800,marginBottom:8}}>Delete this habit?</div>
            <div style={{fontSize:13,color:"#9a9590",marginBottom:24,lineHeight:1.6}}>
              Your streak and progress will be lost. This can't be undone.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#ef4444"),flex:1}} onClick={()=>confirmDeleteHabit(deleteHabitId)}>Yes, Delete</button>
              <button style={{...C.ghost,flex:1,padding:"9px"}} onClick={()=>setDeleteHabitId(null)}>Keep It</button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPDATE SCORE MODAL ── */}
      {showUpdateScore&&(
        <div style={C.overlay} onClick={()=>setShowUpdateScore(false)}>
          <div style={{...C.mbox,width:400}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:28,marginBottom:8}}></div>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Update Your Credit Score</div>
            <div style={{fontSize:13,color:"#9a9590",marginBottom:6,lineHeight:1.6}}>Check your score for free on <span style={{color:"#d4860a"}}>Credit Karma</span>, <span style={{color:"#d4860a"}}>Experian</span>, or your bank app, then enter it below.</div>
            <div style={{fontSize:12,color:"#9a9590",marginBottom:20}}>Current score: <span style={{fontWeight:800,color:scColor(creditScore)}}>{creditScore}</span></div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,color:"#9a9590",fontWeight:700,marginBottom:8}}>Your new score (300–850)</div>
              <input
                type="number" min="300" max="850"
                value={newScoreInput}
                onChange={e=>setNewScoreInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&submitNewScore()}
                placeholder="e.g. 705"
                style={{...C.inp,width:"100%",fontSize:24,fontWeight:800,textAlign:"center",padding:"14px"}}
                autoFocus/>
              {newScoreInput&&(parseInt(newScoreInput)<300||parseInt(newScoreInput)>850)&&(
                <div style={{fontSize:12,color:"#c0392b",marginTop:6}}>Score must be between 300 and 850.</div>
              )}
              {newScoreInput&&parseInt(newScoreInput)>=300&&parseInt(newScoreInput)<=850&&(
                <div style={{fontSize:13,marginTop:8,textAlign:"center",fontWeight:700,color:scColor(parseInt(newScoreInput))}}>
                  {parseInt(newScoreInput)} — {scLabel(parseInt(newScoreInput))}
                  {parseInt(newScoreInput)>creditScore&&<span style={{color:"#3a7d5c"}}> ▲ +{parseInt(newScoreInput)-creditScore} pts</span>}
                  {parseInt(newScoreInput)<creditScore&&<span style={{color:"#c0392b"}}> ▼ {parseInt(newScoreInput)-creditScore} pts</span>}
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
          <div style={{...C.mbox,width:460,maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}> Your Finances</div>
            <div style={{fontSize:12,color:"#9a9590",marginBottom:18}}>Enter your monthly numbers. Only you can see these.</div>
            {[["Monthly Income","income","4200"],["Monthly Expenses","expenses","3100"],["Total Savings","savings","2000"]].map(([label,key,ph])=>(
              <div key={key} style={{marginBottom:14}}>
                <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>{label}</div>
                <input value={financeForm[key]} onChange={e=>setFinanceForm(p=>({...p,[key]:e.target.value}))}
                  placeholder={ph} style={{...C.inp,width:"100%"}} type="number"/>
              </div>
            ))}
            <div style={{borderTop:"1px solid #1e2240",margin:"18px 0 16px",paddingTop:16}}>
              <div style={{fontSize:14,fontWeight:800,marginBottom:14,color:"#111010"}}> Pay Schedule</div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:8}}>How often do you get paid?</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {[["weekly"," Weekly"],["biweekly"," Bi-weekly"],["semimonthly"," Twice/month"],["monthly"," Monthly"]].map(([val,lbl])=>(
                    <button key={val} onClick={()=>setFinanceForm(p=>({...p,pay_freq:val}))}
                      style={{padding:"9px 12px",borderRadius:9,border:`1px solid ${financeForm.pay_freq===val?"#d4860a":"rgba(0,0,0,0.08)"}`,background:financeForm.pay_freq===val?"rgba(129,140,248,0.15)":"#f5f4f0",color:financeForm.pay_freq===val?"#d4860a":"#9a9590",cursor:"pointer",fontSize:12,fontWeight:700,textAlign:"center"}}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {(financeForm.pay_freq==="semimonthly"||financeForm.pay_freq==="monthly") && (
                <div style={{display:"flex",gap:10,marginBottom:14}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>1st Payday (day of month)</div>
                    <input value={financeForm.pay_day1} onChange={e=>setFinanceForm(p=>({...p,pay_day1:e.target.value}))} type="number" min="1" max="31" placeholder="1" style={{...C.inp,width:"100%"}}/>
                  </div>
                  {financeForm.pay_freq==="semimonthly" && (
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>2nd Payday (day of month)</div>
                      <input value={financeForm.pay_day2} onChange={e=>setFinanceForm(p=>({...p,pay_day2:e.target.value}))} type="number" min="1" max="31" placeholder="15" style={{...C.inp,width:"100%"}}/>
                    </div>
                  )}
                </div>
              )}
              {(financeForm.pay_freq==="weekly"||financeForm.pay_freq==="biweekly") && (
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:8}}>What day do you get paid?</div>
                  <div style={{display:"flex",gap:6}}>
                    {[["1","Mon"],["2","Tue"],["3","Wed"],["4","Thu"],["5","Fri"]].map(([val,lbl])=>(
                      <button key={val} onClick={()=>setFinanceForm(p=>({...p,pay_weekday:val}))}
                        style={{flex:1,padding:"8px 4px",borderRadius:8,border:`1px solid ${financeForm.pay_weekday===val?"#d4860a":"rgba(0,0,0,0.08)"}`,background:financeForm.pay_weekday===val?"rgba(129,140,248,0.15)":"#f5f4f0",color:financeForm.pay_weekday===val?"#d4860a":"#9a9590",cursor:"pointer",fontSize:12,fontWeight:700}}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <div style={{marginTop:12}}>
                    <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>Last or next payday date <span style={{color:"#9a9590",fontWeight:400}}>(to anchor the schedule)</span></div>
                    <input value={financeForm.pay_start} onChange={e=>setFinanceForm(p=>({...p,pay_start:e.target.value}))} type="date" style={{...C.inp,width:"100%"}}/>
                  </div>
                </div>
              )}
              {monthlyIncome > 0 && (()=>{
                const freq = financeForm.pay_freq;
                const paychecks = freq==="weekly"?4.33:freq==="biweekly"?2.17:freq==="semimonthly"?2:1;
                const amt = Math.round(monthlyIncome / paychecks);
                return <div style={{background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#3a7d5c",fontWeight:700}}> ~${amt.toLocaleString()} per paycheck</div>;
              })()}
            </div>
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={async()=>{await saveFinances(financeForm.income,financeForm.expenses,financeForm.savings,financeForm);setShowEditFinances(false);}}>Save →</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowEditFinances(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}




      {/* ── ADD GOAL MODAL ── */}
      {showAddGoal&&(
        <div style={C.overlay} onClick={()=>setShowAddGoal(false)}>
          <div style={{...C.mbox,width:460}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}> Set a New Goal</div>
            <div style={{fontSize:12,color:"#9a9590",marginBottom:20}}>Track any goal — fitness, money, health, or personal.</div>

            {/* Title */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#9a9590",marginBottom:5}}>Goal title</div>
              <input value={newGoal.title} onChange={e=>setNewGoal(p=>({...p,title:e.target.value}))}
                placeholder='e.g. "Run a 5K" or "Save $10,000"'
                style={{...C.inp,width:"100%"}} autoFocus/>
            </div>

            {/* Category */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#9a9590",marginBottom:8}}>Category</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                {[["fitness"," Fitness","#3a7d5c"],["finance"," Finance","#d4860a"],["health"," Health","#d4860a"],["personal","⭐ Personal","#d4860a"]].map(([val,label,col])=>(
                  <button key={val} onClick={()=>setNewGoal(p=>({...p,category:val}))}
                    style={{background:newGoal.category===val?`${col}18`:"#f5f4f0",border:`1px solid ${newGoal.category===val?col:"rgba(0,0,0,0.08)"}`,color:newGoal.category===val?col:"#9a9590",borderRadius:10,padding:"8px 6px",cursor:"pointer",fontSize:12,fontWeight:700,textAlign:"center"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress values */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:"#9a9590",marginBottom:5}}>Starting value</div>
                <input value={newGoal.current_value} onChange={e=>setNewGoal(p=>({...p,current_value:e.target.value}))}
                  placeholder="0" style={{...C.inp,width:"100%"}} type="number"/>
              </div>
              <div>
                <div style={{fontSize:11,color:"#9a9590",marginBottom:5}}>Target value *</div>
                <input value={newGoal.target_value} onChange={e=>setNewGoal(p=>({...p,target_value:e.target.value}))}
                  placeholder="100" style={{...C.inp,width:"100%"}} type="number"/>
              </div>
              <div>
                <div style={{fontSize:11,color:"#9a9590",marginBottom:5}}>Unit</div>
                <input value={newGoal.unit} onChange={e=>setNewGoal(p=>({...p,unit:e.target.value}))}
                  placeholder="lbs, $, km..." style={{...C.inp,width:"100%"}}/>
              </div>
            </div>

            {/* Deadline */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:"#9a9590",marginBottom:5}}>Target date (optional)</div>
              <input value={newGoal.deadline} onChange={e=>setNewGoal(p=>({...p,deadline:e.target.value}))}
                style={{...C.inp,width:"100%"}} type="date"/>
            </div>

            {/* Quick templates */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:"#9a9590",marginBottom:8}}>Quick templates</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {[
                  {title:"Run a 5K",category:"fitness",target_value:"5",unit:"km",current_value:"0"},
                  {title:"Save $10,000",category:"finance",target_value:"10000",unit:"$",current_value:"0"},
                  {title:"Lose 20 lbs",category:"fitness",target_value:"20",unit:"lbs",current_value:"0"},
                  {title:"Read 12 books",category:"personal",target_value:"12",unit:"books",current_value:"0"},
                  {title:"No missed workouts",category:"fitness",target_value:"30",unit:"days",current_value:"0"},
                ].map(t=>(
                  <button key={t.title} onClick={()=>setNewGoal(p=>({...p,...t}))}
                    style={{background:"#f5f4f0",border:"1px solid rgba(0,0,0,0.08)",color:"#9a9590",borderRadius:20,padding:"5px 12px",fontSize:11,cursor:"pointer",fontWeight:600}}>
                    {t.title}
                  </button>
                ))}
              </div>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={addGoal} disabled={!newGoal.title.trim()||!newGoal.target_value}>Add Goal →</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowAddGoal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPDATE GOAL PROGRESS MODAL ── */}
      {showUpdateGoal&&(
        <div style={C.overlay} onClick={()=>setShowUpdateGoal(null)}>
          <div style={{...C.mbox,width:360}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}> Update Progress</div>
            <div style={{fontSize:13,color:"#d4860a",fontWeight:700,marginBottom:4}}>{showUpdateGoal.title}</div>
            <div style={{fontSize:12,color:"#9a9590",marginBottom:16}}>Target: {showUpdateGoal.target_value} {showUpdateGoal.unit}</div>
            <div style={{position:"relative",marginBottom:6}}>
              <input value={goalUpdateVal} onChange={e=>setGoalUpdateVal(e.target.value)}
                placeholder={String(showUpdateGoal.current_value)}
                style={{...C.inp,width:"100%",fontSize:28,textAlign:"center",fontWeight:800}} type="number" autoFocus/>
            </div>
            <div style={{textAlign:"center",fontSize:12,color:"#9a9590",marginBottom:16}}>{showUpdateGoal.unit}</div>
            {/* Preview progress */}
            {goalUpdateVal && (
              <div style={{marginBottom:16}}>
                <div style={{background:"rgba(0,0,0,0.07)",borderRadius:99,height:8,overflow:"hidden",marginBottom:4}}>
                  <div style={{width:`${Math.min(100,Math.round((parseFloat(goalUpdateVal)/showUpdateGoal.target_value)*100))}%`,background:"linear-gradient(90deg,#6366f1,#818cf8)",height:"100%",borderRadius:99}}/>
                </div>
                <div style={{textAlign:"center",fontSize:12,color:"#d4860a",fontWeight:700}}>
                  {Math.min(100,Math.round((parseFloat(goalUpdateVal)/showUpdateGoal.target_value)*100))}% complete
                  {parseFloat(goalUpdateVal)>=showUpdateGoal.target_value && <span style={{color:"#3a7d5c"}}>  Goal reached!</span>}
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={()=>updateGoalProgress(showUpdateGoal,goalUpdateVal)} disabled={!goalUpdateVal}>Save →</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowUpdateGoal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── XP POPUP ── */}
      {xpPopup&&(
        <div style={{position:"fixed",bottom:96,right:24,background:"#111010",border:"none",borderRadius:12,padding:"10px 18px",zIndex:9999,display:"flex",alignItems:"center",gap:10,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",animation:"slideIn 0.3s ease"}}>
          <span style={{fontSize:22}}></span>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#d4860a"}}>+{xpPopup.amount} XP</div>
            <div style={{fontSize:11,color:"#9a9590",textTransform:"capitalize"}}>{xpPopup.reason} logged</div>
          </div>
        </div>
      )}

      {/* ── LEVEL UP POPUP ── */}
      {levelUpPopup&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setLevelUpPopup(null)}>
          <div style={{background:"linear-gradient(135deg,#111010,#1a1040)",border:"2px solid #6366f1",borderRadius:20,padding:"40px 48px",textAlign:"center",maxWidth:360}}>
            <div style={{fontSize:64,marginBottom:12}}>{levelUpPopup.icon}</div>
            <div style={{fontSize:13,color:"#d4860a",fontWeight:700,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Level Up!</div>
            <div style={{fontSize:32,fontWeight:900,color:levelUpPopup.color,marginBottom:8}}>{levelUpPopup.name}</div>
            <div style={{fontSize:14,color:"#9a9590",marginBottom:24}}>You've reached a new level. Keep the streak going!</div>
            <button style={C.btn("#d4860a")} onClick={()=>setLevelUpPopup(null)}>Let's Go </button>
          </div>
        </div>
      )}

      {/* ── EDIT PROFILE MODAL ── */}
      {showEditProfile&&(
        <div style={C.overlay} onClick={()=>setShowEditProfile(false)}>
          <div style={{...C.mbox,width:460,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Edit Profile</div>
            <div style={{fontSize:12,color:"#9a9590",marginBottom:20}}>Your stats are private — only you can see them.</div>

            {/* Avatar + Display Name */}
            <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Identity</div>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,padding:"16px",background:"#f5f4f0",borderRadius:12,border:"1px solid rgba(0,0,0,0.06)"}}>
              <div style={{position:"relative",flexShrink:0}}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" style={{width:64,height:64,borderRadius:"50%",objectFit:"cover",border:"2px solid rgba(0,0,0,0.08)"}}/>
                  : <div style={{width:64,height:64,borderRadius:"50%",background:"linear-gradient(135deg,#111010,#d4860a)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:22,color:"#fff"}}>
                      {(username||"?").slice(0,2).toUpperCase()}
                    </div>
                }
                <label style={{position:"absolute",bottom:-4,right:-4,width:22,height:22,background:"#d4860a",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",border:"2px solid #fff",fontSize:11,color:"#fff",fontWeight:700}}>
                  +
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                      const dataUrl = ev.target.result;
                      setAvatarUrl(dataUrl);
                      if (user) {
                        await supabase.from("profiles").upsert({ id: user.id, avatar_url: dataUrl }, { onConflict: "id" });
                      }
                    };
                    reader.readAsDataURL(file);
                  }}/>
                </label>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:"#9a9590",marginBottom:6}}>Display Name</div>
                <input
                  value={username}
                  onChange={e=>setUsername(e.target.value)}
                  onBlur={async()=>{
                    if (user && username.trim()) {
                      await supabase.from("profiles").upsert({ id: user.id, username: username.trim() }, { onConflict: "id" });
                    }
                  }}
                  placeholder="Your name"
                  style={{...C.inp, width:"100%"}}
                />
                <div style={{fontSize:10,color:"#9a9590",marginTop:5}}>Tap photo to change your avatar</div>
              </div>
            </div>

            {/* Basic stats */}
            <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Body Stats</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              {[["Age (years)","age","25"],["Height (inches)","height_in","70"],["Current Weight (lbs)","current_weight","175"],["Goal Weight (lbs)","goal_weight","160"]].map(([label,key,ph])=>(
                <div key={key}>
                  <div style={{fontSize:11,color:"#9a9590",marginBottom:5}}>{label}</div>
                  <input value={profileForm[key]||""} onChange={e=>setProfileForm(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}} type="number"/>
                </div>
              ))}
            </div>

            {/* Sex */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Biological Sex <span style={{fontSize:10,color:"#9a9590",fontWeight:400,textTransform:"none"}}>(used for calorie calculations)</span></div>
              <div style={{display:"flex",gap:8}}>
                {[["male"," Male"],["female"," Female"]].map(([val,lbl])=>(
                  <button key={val} onClick={()=>setProfileForm(p=>({...p,sex:val}))}
                    style={{flex:1,padding:"10px",borderRadius:10,border:`1px solid ${profileForm.sex===val?"#d4860a":"rgba(0,0,0,0.08)"}`,background:profileForm.sex===val?"rgba(99,102,241,0.2)":"#f5f4f0",color:profileForm.sex===val?"#d4860a":"#9a9590",cursor:"pointer",fontSize:13,fontWeight:profileForm.sex===val?700:400}}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Level */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Activity Level</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {[
                  ["sedentary","🪑 Sedentary","Desk job, little or no exercise"],
                  ["light"," Lightly Active","Light exercise 1–3 days/week"],
                  ["moderate"," Moderately Active","Moderate exercise 3–5 days/week"],
                  ["active"," Very Active","Hard exercise 6–7 days/week"],
                  ["very_active"," Extremely Active","Physical job + daily training"],
                ].map(([val,lbl,desc])=>(
                  <button key={val} onClick={()=>setProfileForm(p=>({...p,activity_level:val}))}
                    style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${profileForm.activity_level===val?"#d4860a":"rgba(0,0,0,0.08)"}`,background:profileForm.activity_level===val?"rgba(99,102,241,0.15)":"#f5f4f0",color:profileForm.activity_level===val?"#111010":"#9a9590",cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontWeight:profileForm.activity_level===val?700:400,fontSize:13}}>{lbl}</span>
                    <span style={{fontSize:11,color:"#9a9590"}}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Goal type */}
            <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Goal Type</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              {[["fat_loss"," Fat Loss"],["muscle_gain"," Muscle Gain"],["general_fitness"," General Fitness"],["maintenance"," Maintenance"],["custom"," Custom Goal"]].map(([val,label])=>(
                <button key={val} onClick={()=>setProfileForm(p=>({...p,goal_type:val}))}
                  style={{background:profileForm.goal_type===val?"rgba(99,102,241,0.2)":"#f5f4f0",border:`1px solid ${profileForm.goal_type===val?"#d4860a":"rgba(0,0,0,0.08)"}`,color:profileForm.goal_type===val?"#d4860a":"#9a9590",borderRadius:10,padding:"10px 12px",cursor:"pointer",fontSize:13,fontWeight:profileForm.goal_type===val?700:400,textAlign:"left"}}>
                  {label}
                </button>
              ))}
            </div>

            {/* Custom goal label */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#9a9590",marginBottom:5}}>Goal description (optional)</div>
              <input value={profileForm.goal_label||""} onChange={e=>setProfileForm(p=>({...p,goal_label:e.target.value}))} placeholder='e.g. "I want to reach 175 lbs by summer"' style={{...C.inp,width:"100%"}}/>
            </div>

            {/* Target date */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:"#9a9590",marginBottom:5}}>Target date (optional)</div>
              <input value={profileForm.goal_date||""} onChange={e=>setProfileForm(p=>({...p,goal_date:e.target.value}))} style={{...C.inp,width:"100%"}} type="date"/>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={async()=>{ await saveBodyStats(profileForm); setShowEditProfile(false); }}>Save Profile →</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowEditProfile(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOG WEIGHT MODAL ── */}
      {showLogWeight&&(
        <div style={C.overlay} onClick={()=>setShowLogWeight(false)}>
          <div style={{...C.mbox,width:340}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}> Log Today's Weight</div>
            <div style={{fontSize:12,color:"#9a9590",marginBottom:16}}>Weigh yourself first thing in the morning for consistency.</div>
            <input value={logWeightVal} onChange={e=>setLogWeightVal(e.target.value)} placeholder="e.g. 174.5" style={{...C.inp,width:"100%",fontSize:24,textAlign:"center",fontWeight:800}} type="number" autoFocus/>
            <div style={{fontSize:11,color:"#9a9590",textAlign:"center",marginTop:6,marginBottom:16}}>lbs</div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={logWeight} disabled={!logWeightVal}>Save</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowLogWeight(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}


      {/* ── EDIT CREDIT DETAILS MODAL ── */}
      {showEditCreditDetails&&(
        <div style={C.overlay} onClick={()=>setShowEditCreditDetails(false)}>
          <div style={{...C.mbox,width:480,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}> Credit & Benefits Details</div>
            <div style={{fontSize:12,color:"#9a9590",marginBottom:20}}>Used to calculate your real score breakdown and check benefit eligibility. Private — only you can see this.</div>

            <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Credit Card</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[["CC Balance ($)","cc_balance","2400"],["Credit Limit ($)","cc_limit","5000"]].map(([label,key,ph])=>(
                <div key={key}>
                  <div style={{fontSize:11,color:"#9a9590",marginBottom:5}}>{label}</div>
                  <input value={creditDetailForm[key]||""} onChange={e=>setCreditDetailForm(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}} type="number"/>
                </div>
              ))}
            </div>

            <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Credit History</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
              {[["Credit Age (yrs)","credit_age_years","4"],["# of Accounts","num_accounts","3"],["Hard Inquiries","hard_inquiries","1"]].map(([label,key,ph])=>(
                <div key={key}>
                  <div style={{fontSize:11,color:"#9a9590",marginBottom:5}}>{label}</div>
                  <input value={creditDetailForm[key]||""} onChange={e=>setCreditDetailForm(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}} type="number"/>
                </div>
              ))}
            </div>

            <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Benefits Eligibility Info</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#9a9590",marginBottom:5}}>Household / family size</div>
              <input value={creditDetailForm.family_size||""} onChange={e=>setCreditDetailForm(p=>({...p,family_size:e.target.value}))} placeholder="1" style={{...C.inp,width:"100%"}} type="number"/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {[
                ["has_student_loans","I have student loans"],
                ["is_first_time_buyer","I am a first-time homebuyer (never owned a home)"],
                ["employer_has_401k","My employer offers a 401(k) or retirement plan"],
              ].map(([key,label])=>(
                <label key={key} style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",padding:"10px 14px",background:"#f5f4f0",borderRadius:10,border:`1px solid ${creditDetailForm[key]?"#d4860a":"rgba(0,0,0,0.08)"}`}}>
                  <div onClick={()=>setCreditDetailForm(p=>({...p,[key]:!p[key]}))}
                    style={{width:20,height:20,borderRadius:5,border:`2px solid ${creditDetailForm[key]?"#d4860a":"#6b6763"}`,background:creditDetailForm[key]?"#d4860a":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
                    {creditDetailForm[key]&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}
                  </div>
                  <span style={{fontSize:13,color:creditDetailForm[key]?"#111010":"#9a9590"}}>{label}</span>
                </label>
              ))}
            </div>

            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={async()=>{ await saveCreditDetails(creditDetailForm); setShowEditCreditDetails(false); }}>Save →</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowEditCreditDetails(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD DEBT MODAL ── */}
      {showAddDebt&&(
        <div style={C.overlay} onClick={()=>setShowAddDebt(false)}>
          <div style={{...C.mbox,width:420}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}> Add a Debt</div>
            {[["Name","name","Credit Card, Student Loan..."],["Balance ($)","balance","5000"],["Monthly Payment ($)","monthly_payment","150"],["APR (%)","apr","19.9%"]].map(([label,key,ph])=>(
              <div key={key} style={{marginBottom:12}}>
                <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>{label}</div>
                <input value={newDebt[key]} onChange={e=>setNewDebt(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}}/>
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={addDebt}>Add Debt</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowAddDebt(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD BILL MODAL ── */}
      {showAddBill&&(
        <div style={C.overlay} onClick={()=>setShowAddBill(false)}>
          <div style={{...C.mbox,width:440}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}> Add a Bill</div>
            {[["Name","name","Rent, Netflix, Electric..."],["Amount ($)","amount","1200"],["Due Day of Month","due_day","1"]].map(([label,key,ph])=>(
              <div key={key} style={{marginBottom:12}}>
                <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>{label}</div>
                <input value={newBill[key]} onChange={e=>setNewBill(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}}/>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>Category</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                {[["housing"," Housing"],["transport"," Transport"],["food"," Food"],["utilities"," Utilities"],["subscriptions"," Subs"],["insurance"," Insurance"],["health"," Health"],["debt"," Debt"],["other"," Other"]].map(([cat,lbl])=>(
                  <button key={cat} onClick={()=>setNewBill(p=>({...p,category:cat}))} style={{background:newBill.category===cat?"rgba(129,140,248,0.2)":"#f5f4f0",border:`1px solid ${newBill.category===cat?"#d4860a":"rgba(0,0,0,0.08)"}`,color:newBill.category===cat?"#d4860a":"#9a9590",borderRadius:8,padding:"6px",cursor:"pointer",fontSize:11,fontWeight:700,textAlign:"center"}}>{lbl}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>Status</div>
              <div style={{display:"flex",gap:6}}>
                {["upcoming","paid","overdue"].map(s=>(
                  <button key={s} onClick={()=>setNewBill(p=>({...p,status:s}))} style={{flex:1,background:newBill.status===s?"rgba(129,140,248,0.2)":"#f5f4f0",border:`1px solid ${newBill.status===s?"#d4860a":"rgba(0,0,0,0.08)"}`,color:newBill.status===s?"#d4860a":"#9a9590",borderRadius:8,padding:"7px",cursor:"pointer",fontSize:12,fontWeight:700,textTransform:"capitalize"}}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",background:"#f5f4f0",borderRadius:10,padding:"10px 14px"}}>
              <div>
                <div style={{fontSize:13,fontWeight:600}}>Autopay</div>
                <div style={{fontSize:11,color:"#9a9590"}}>Mark as automatically paid each month</div>
              </div>
              <div onClick={()=>setNewBill(p=>({...p,autopay:!p.autopay}))} style={{width:42,height:24,borderRadius:99,background:newBill.autopay?"#3a7d5c":"rgba(0,0,0,0.07)",position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
                <div style={{position:"absolute",top:4,left:newBill.autopay?20:4,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={()=>{addBill();setNewBill({name:"",amount:"",due_day:"",status:"upcoming",category:"other",autopay:false});}}>Add Bill</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowAddBill(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {editBill&&(
        <div style={C.overlay} onClick={()=>setEditBill(null)}>
          <div style={{...C.mbox,width:440}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}> Edit Bill</div>
            {[["Name","name",""],["Amount ($)","amount",""],["Due Day of Month","due_day",""]].map(([label,key,ph])=>(
              <div key={key} style={{marginBottom:12}}>
                <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>{label}</div>
                <input value={editBill[key]||""} onChange={e=>setEditBill(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}}/>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>Category</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                {[["housing"," Housing"],["transport"," Transport"],["food"," Food"],["utilities"," Utilities"],["subscriptions"," Subs"],["insurance"," Insurance"],["health"," Health"],["debt"," Debt"],["other"," Other"]].map(([cat,lbl])=>(
                  <button key={cat} onClick={()=>setEditBill(p=>({...p,category:cat}))} style={{background:editBill.category===cat?"rgba(129,140,248,0.2)":"#f5f4f0",border:`1px solid ${editBill.category===cat?"#d4860a":"rgba(0,0,0,0.08)"}`,color:editBill.category===cat?"#d4860a":"#9a9590",borderRadius:8,padding:"6px",cursor:"pointer",fontSize:11,fontWeight:700,textAlign:"center"}}>{lbl}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>Status</div>
              <div style={{display:"flex",gap:6}}>
                {["upcoming","paid","overdue"].map(s=>(
                  <button key={s} onClick={()=>setEditBill(p=>({...p,status:s}))} style={{flex:1,background:editBill.status===s?"rgba(129,140,248,0.2)":"#f5f4f0",border:`1px solid ${editBill.status===s?"#d4860a":"rgba(0,0,0,0.08)"}`,color:editBill.status===s?"#d4860a":"#9a9590",borderRadius:8,padding:"7px",cursor:"pointer",fontSize:12,fontWeight:700,textTransform:"capitalize"}}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",background:"#f5f4f0",borderRadius:10,padding:"10px 14px"}}>
              <div>
                <div style={{fontSize:13,fontWeight:600}}>Autopay</div>
                <div style={{fontSize:11,color:"#9a9590"}}>Automatically paid each month</div>
              </div>
              <div onClick={()=>setEditBill(p=>({...p,autopay:!p.autopay}))} style={{width:42,height:24,borderRadius:99,background:editBill.autopay?"#3a7d5c":"rgba(0,0,0,0.07)",position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
                <div style={{position:"absolute",top:4,left:editBill.autopay?20:4,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={()=>updateBill(editBill)}>Save Changes</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setEditBill(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD MEDICATION MODAL ── */}
      {showAddMed&&(
        <div style={C.overlay} onClick={()=>setShowAddMed(false)}>
          <div style={{...C.mbox,width:420}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16}}> Add a Medication</div>
            {[["Name","name","Lisinopril, Metformin..."],["Dose","dose","10mg, 500mg..."]].map(([label,key,ph])=>(
              <div key={key} style={{marginBottom:12}}>
                <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>{label}</div>
                <input value={newMed[key]} onChange={e=>setNewMed(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{...C.inp,width:"100%"}}/>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>Schedule</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["Daily","Twice daily","Weekly","As needed"].map(s=>(
                  <button key={s} onClick={()=>setNewMed(p=>({...p,schedule:s}))} style={{background:newMed.schedule===s?"rgba(129,140,248,0.2)":"#f5f4f0",border:`1px solid ${newMed.schedule===s?"#d4860a":"rgba(0,0,0,0.08)"}`,color:newMed.schedule===s?"#d4860a":"#9a9590",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>Days until refill</div>
              <input value={newMed.refill_days} onChange={e=>setNewMed(p=>({...p,refill_days:e.target.value}))} placeholder="30" style={{...C.inp,width:"100%"}} type="number"/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={addMed}>Add Medication</button>
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
              <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>Checkup Name</div>
              <input value={newCheckup.name} onChange={e=>setNewCheckup(p=>({...p,name:e.target.value}))} placeholder="Annual Physical, Dental Cleaning..." style={{...C.inp,width:"100%"}}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#d4860a",fontWeight:700,marginBottom:6}}>When was your last one?</div>
              <input value={newCheckup.last_date} onChange={e=>setNewCheckup(p=>({...p,last_date:e.target.value}))} placeholder="e.g. 6 months ago, Jan 2024..." style={{...C.inp,width:"100%"}}/>
            </div>
            <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <div onClick={()=>setNewCheckup(p=>({...p,urgent:!p.urgent}))} style={{width:40,height:22,borderRadius:99,background:newCheckup.urgent?"#dc2626":"#f5f4f0",position:"relative",cursor:"pointer",transition:"background 0.2s"}}>
                <div style={{position:"absolute",top:3,left:newCheckup.urgent?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </div>
              <span style={{fontSize:13,color:newCheckup.urgent?"#c0392b":"#9a9590"}}>Mark as overdue</span>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#d4860a"),flex:1}} onClick={addCheckup}>Add Checkup</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowAddCheckup(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD SUPPLEMENT MODAL ── */}
      {showAddSupp&&(
        <div style={C.overlay} onClick={()=>setShowAddSupp(false)}>
          <div style={{...C.mbox,width:420}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:800,marginBottom:4}}> Add a Supplement</div>
            <div style={{fontSize:12,color:"#9a9590",marginBottom:18}}>Track any vitamin, mineral, herb, or nootropic.</div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:"#9a9590",fontWeight:700,marginBottom:8}}>Choose an icon</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {SUPP_ICONS.map(ic=>(
                  <button key={ic} onClick={()=>setNewSupp(p=>({...p,icon:ic}))}
                    style={{width:36,height:36,borderRadius:10,background:newSupp.icon===ic?"rgba(124,58,237,0.3)":"#f5f4f0",border:`2px solid ${newSupp.icon===ic?"#d4860a":"rgba(0,0,0,0.08)"}`,fontSize:18,cursor:"pointer"}}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#9a9590",fontWeight:700,marginBottom:6}}>Supplement name *</div>
              <input value={newSupp.name} onChange={e=>setNewSupp(p=>({...p,name:e.target.value}))}
                placeholder="e.g. Vitamin C, Lion's Mane, Ashwagandha..."
                style={{...C.inp,width:"100%"}}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#9a9590",fontWeight:700,marginBottom:6}}>Dose (optional)</div>
              <input value={newSupp.dose} onChange={e=>setNewSupp(p=>({...p,dose:e.target.value}))}
                placeholder="e.g. 500mg, 1 capsule..."
                style={{...C.inp,width:"100%"}}/>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,color:"#9a9590",fontWeight:700,marginBottom:6}}>When do you take it?</div>
              <div style={{display:"flex",gap:6}}>
                {["Morning","Afternoon","Evening","With meals"].map(t=>(
                  <button key={t} onClick={()=>setNewSupp(p=>({...p,timing:t}))}
                    style={{flex:1,background:newSupp.timing===t?"rgba(124,58,237,0.2)":"#f5f4f0",border:`1px solid ${newSupp.timing===t?"#d4860a":"rgba(0,0,0,0.08)"}`,color:newSupp.timing===t?"#d4860a":"#9a9590",borderRadius:8,padding:"7px 2px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btn("#d4860a"),flex:1,opacity:newSupp.name.trim()?1:0.5}} onClick={addSupp} disabled={!newSupp.name.trim()}>+ Add Supplement</button>
              <button style={{...C.ghost,padding:"9px 18px"}} onClick={()=>setShowAddSupp(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* ── FLOATING COACH BUTTON ── */}
      {tab!=="coach"&&(
        <button onClick={openCoach}
          style={{position:"fixed",bottom:isMobile?90:28,right:24,zIndex:190,width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,#d4860a 0%,#b8720a 100%)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(212,134,10,0.45)",fontSize:22,color:"#fff",animation:coachPulse?"coachPulse 2.5s ease-in-out infinite":undefined,transition:"transform 0.2s ease"}}
          onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.1)";}}
          onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}
          title="Open AI Coach">
          {coachMsgs.length===0&&<span style={{position:"absolute",top:2,right:2,width:10,height:10,borderRadius:"50%",background:"#3a7d5c",border:"2px solid #f5f4f0"}}/>}
          🧠
        </button>
      )}

      {/* ── COACH DRAWER ── */}
      {coachOpen&&(
        <>
          <div style={{position:"fixed",inset:0,background:"rgba(17,16,16,0.45)",zIndex:191,backdropFilter:"blur(2px)",animation:"coachFadeIn 0.2s ease"}} onClick={()=>setCoachOpen(false)}/>
          <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:192,background:"#f5f4f0",borderRadius:"20px 20px 0 0",boxShadow:"0 -8px 40px rgba(17,16,16,0.18)",display:"flex",flexDirection:"column",maxHeight:"82vh",animation:"coachSlideUp 0.3s cubic-bezier(0.16,1,0.3,1)"}}>
            <div style={{width:36,height:4,borderRadius:2,background:"#d4d0c8",margin:"12px auto 0",flexShrink:0}}/>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px 10px",flexShrink:0,borderBottom:"1px solid rgba(17,16,16,0.07)"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#d4860a,#b8720a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>🧠</div>
              <div>
                <div style={{fontFamily:"'DM Serif Display',serif",fontSize:17,color:"#111010",lineHeight:1.2}}>LifeSync Coach</div>
                <div style={{fontSize:11,color:"#9a9590"}}>Sees patterns across your whole life</div>
              </div>
              <button onClick={()=>setCoachOpen(false)} style={{marginLeft:"auto",background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9a9590",lineHeight:1}}>×</button>
            </div>
            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
              {coachMsgs.map((m,i)=>(
                <div key={i} style={{maxWidth:"88%",alignSelf:m.isCoach?"flex-start":"flex-end",background:m.isCoach?"#fff":"#d4860a",color:m.isCoach?"#111010":"#fff",borderRadius:m.isCoach?"4px 16px 16px 16px":"16px 4px 16px 16px",padding:"11px 15px",fontSize:14,lineHeight:1.55,boxShadow:m.isCoach?"0 2px 8px rgba(17,16,16,0.07)":"0 2px 10px rgba(212,134,10,0.3)",animation:"coachFadeInUp 0.25s ease"}}>
                  {m.text}
                </div>
              ))}
              {coachLoading&&(
                <div style={{display:"flex",gap:4,padding:"12px 16px",background:"#fff",borderRadius:"4px 16px 16px 16px",alignSelf:"flex-start",boxShadow:"0 2px 8px rgba(17,16,16,0.07)"}}>
                  {[0,0.2,0.4].map((d,i)=>(
                    <div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#9a9590",animation:`coachTypingDot 1.2s ease-in-out ${d}s infinite`}}/>
                  ))}
                </div>
              )}
              <div ref={coachBottomRef}/>
            </div>
            {/* Quick suggestions */}
            {coachMsgs.length<=2&&(
              <div style={{display:"flex",gap:8,padding:"0 20px 12px",overflowX:"auto",flexShrink:0}}>
                {coachSuggestions.map(s=>(
                  <button key={s} onClick={async()=>{
                    setCoachMsgs(prev=>[...prev,{text:s,isCoach:false,role:"user"}]);
                    const history=coachMsgs.filter(m=>m.role).map(m=>({role:m.role,content:m.text}));
                    await fetchCoachMessage("chat",s,history);
                  }}
                    style={{whiteSpace:"nowrap",border:"1.5px solid rgba(212,134,10,0.4)",borderRadius:20,padding:"6px 14px",fontSize:12,color:"#d4860a",background:"transparent",cursor:"pointer",transition:"background 0.15s",flexShrink:0}}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(212,134,10,0.08)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {/* Input */}
            <div style={{display:"flex",gap:10,padding:"12px 16px 20px",flexShrink:0,borderTop:"1px solid rgba(17,16,16,0.07)"}}>
              <input ref={coachInputRef} value={coachInput} onChange={e=>setCoachInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendCoachMsg();setCoachOpen(false);}}}
                placeholder="Ask your coach anything..."
                style={{flex:1,border:"1.5px solid rgba(17,16,16,0.12)",borderRadius:24,padding:"10px 16px",fontSize:14,background:"#fff",color:"#111010",outline:"none",transition:"border-color 0.2s",fontFamily:"inherit"}}
                onFocus={e=>{e.target.style.borderColor="#d4860a";}}
                onBlur={e=>{e.target.style.borderColor="rgba(17,16,16,0.12)";}}/>
              <button onClick={()=>{sendCoachMsg();}} disabled={!coachInput.trim()||coachLoading}
                style={{width:42,height:42,borderRadius:"50%",background:"#d4860a",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:17,flexShrink:0,transition:"transform 0.15s,opacity 0.15s",opacity:coachInput.trim()?1:0.4}}>↑</button>
            </div>
          </div>
        </>
      )}

      {/* ── MOBILE BOTTOM NAV — Floating Pill ── */}
      {isMobile && (
        <>
          <div style={{
            position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)",
            zIndex:200, display:"flex", alignItems:"center",
            background:"#111010",
            borderRadius:100,
            padding:"8px 8px",
            gap:2,
            boxShadow:"0 8px 40px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.04)",
            paddingBottom:"calc(8px + env(safe-area-inset-bottom,0px))",
          }}>
            {[
              {id:"overview", label:"Home",    svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>},
              {id:"habits",   label:"Habits",  svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>},
              {id:"wellness", label:"Wellness",svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>},
              {id:"finances", label:"Finance", svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>},
              {id:"health",   label:"Health",  svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>},
            ].map(t => {
              const active = tab === t.id;
              const unvisited = REMIND_TABS.has(t.id) && !visitedTabs.has(t.id) && !active;
              return (
                <button key={t.id} onClick={()=>{ setTab(t.id); markTabVisited(t.id); setShowMoreMenu(false); }}
                  style={{
                    background: active ? "#d4860a" : "transparent",
                    border:"none", cursor:"pointer",
                    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                    padding:"8px 10px", gap:3, position:"relative", borderRadius:80,
                    minWidth:52, transition:"background 0.15s",
                    color: active ? "#fff" : "rgba(255,255,255,0.38)",
                  }}>
                  {t.svg}
                  <span style={{fontSize:9,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase"}}>{t.label}</span>
                  {unvisited && <span style={{position:"absolute",top:4,right:6,width:6,height:6,borderRadius:"50%",background:"#d4860a",animation:"pulse-dot 1.8s ease-in-out infinite"}}/>}
                </button>
              );
            })}
            <button onClick={()=>setShowMoreMenu(m=>!m)}
              style={{
                background:["profile","league","coach","ai"].includes(tab)?"#d4860a":"transparent",
                border:"none", cursor:"pointer",
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                padding:"8px 10px", gap:3, borderRadius:80, minWidth:52, transition:"background 0.15s",
                color:["profile","league","coach","ai"].includes(tab)?"#fff":"rgba(255,255,255,0.38)",
              }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{width:18,height:18}}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              <span style={{fontSize:9,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase"}}>More</span>
            </button>
          </div>
          {showMoreMenu && (
            <div style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",zIndex:199,background:"#111010",borderRadius:16,padding:"8px 0",boxShadow:"0 16px 48px rgba(0,0,0,0.3)",minWidth:160}}>
              {[{id:"profile",label:"Profile"},{id:"league",label:"League"},{id:"coach",label:"🧠 Coach"},{id:"ai",label:"AI Chat"}].map(t=>(
                <button key={t.id} onClick={()=>{ setTab(t.id); markTabVisited(t.id); setShowMoreMenu(false); }}
                  style={{width:"100%",background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:12,padding:"12px 20px",color:tab===t.id?"#d4860a":"rgba(255,255,255,0.8)",fontWeight:tab===t.id?600:400,fontSize:14,letterSpacing:"0.01em"}}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {showMoreMenu && <div style={{position:"fixed",inset:0,zIndex:198}} onClick={()=>setShowMoreMenu(false)}/>}
        </>
      )}
    </div>
  );
}
