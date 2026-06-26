"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

let _supabase: ReturnType<typeof createBrowserClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _supabase;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface User { id: string; name: string; email: string; }

interface PlantProfile {
  id: string; name: string; species: string; type: string;
  potSize: string; adopted: string; waterAmount: string;
  waterFrequency: number; sunlight: string; notes: string;
  lastWatered: string; color: string; userId?: string;
}

interface GrowthEntry {
  id: string; plantId: string; date: string;
  note: string; height?: string; emoji: string;
}

type MilestoneCategory = "growth" | "care" | "harvest" | "health" | "repot" | "custom";

interface Milestone {
  id: string; plantId: string; date: string; title: string;
  description: string; category: MilestoneCategory; achieved: boolean;
  achievedDate?: string; achievedNote?: string; priority: "low" | "medium" | "high";
}

interface PublicGarden {
  userId: string;
  displayName: string;
  plants: PlantProfile[];
  followerCount: number;
}

// ─── DB row shapes ────────────────────────────────────────────────────────────
interface PlantRow {
  id: string; user_id: string; name: string; species: string | null;
  type: string | null; pot_size: string | null; adopted: string | null;
  water_amount: string | null; water_frequency: number | null;
  sunlight: string | null; notes: string | null;
  last_watered: string | null; color: string | null;
}
interface GrowthRow {
  id: string; plant_id: string; user_id: string;
  date: string | null; note: string | null; height: string | null; emoji: string | null;
}
interface MilestoneRow {
  id: string; plant_id: string; user_id: string;
  date: string | null; title: string | null; description: string | null;
  category: string | null; achieved: boolean | null;
  achieved_date: string | null; achieved_note: string | null;
  priority: string | null;
}

// ─── Row ↔ UI mappers ─────────────────────────────────────────────────────────
const rowToPlant = (r: PlantRow): PlantProfile => ({
  id: r.id, name: r.name, species: r.species ?? "", type: r.type ?? "",
  potSize: r.pot_size ?? "", adopted: r.adopted ?? todayStr(),
  waterAmount: r.water_amount ?? "", waterFrequency: r.water_frequency ?? 7,
  sunlight: r.sunlight ?? "", notes: r.notes ?? "",
  lastWatered: r.last_watered ?? todayStr(), color: r.color ?? PLANT_COLORS[0],
  userId: r.user_id,
});
const plantToRow = (p: PlantProfile, userId: string): PlantRow => ({
  id: p.id, user_id: userId, name: p.name, species: p.species, type: p.type,
  pot_size: p.potSize, adopted: p.adopted, water_amount: p.waterAmount,
  water_frequency: p.waterFrequency, sunlight: p.sunlight, notes: p.notes,
  last_watered: p.lastWatered, color: p.color,
});
const rowToGrowth = (r: GrowthRow): GrowthEntry => ({
  id: r.id, plantId: r.plant_id, date: r.date ?? todayStr(),
  note: r.note ?? "", height: r.height ?? undefined, emoji: r.emoji ?? "🌿",
});
const growthToRow = (g: GrowthEntry, userId: string): GrowthRow => ({
  id: g.id, plant_id: g.plantId, user_id: userId,
  date: g.date, note: g.note, height: g.height ?? null, emoji: g.emoji,
});
const rowToMilestone = (r: MilestoneRow): Milestone => ({
  id: r.id, plantId: r.plant_id, date: r.date ?? todayStr(),
  title: r.title ?? "", description: r.description ?? "",
  category: (r.category as MilestoneCategory) ?? "custom",
  achieved: r.achieved ?? false,
  achievedDate: r.achieved_date ?? undefined,
  achievedNote: r.achieved_note ?? undefined,
  priority: (r.priority as "low" | "medium" | "high") ?? "medium",
});
const milestoneToRow = (m: Milestone, userId: string): MilestoneRow => ({
  id: m.id, plant_id: m.plantId, user_id: userId,
  date: m.date, title: m.title, description: m.description,
  category: m.category, achieved: m.achieved,
  achieved_date: m.achievedDate ?? null, achieved_note: m.achievedNote ?? null,
  priority: m.priority,
});

// ─── SVG Plant Cartoons ───────────────────────────────────────────────────────
const PlantCartoon = ({ type, size = 90 }: { type: string; size?: number }) => {
  const t = type.toLowerCase();
  const h = Math.round(size * (160 / 90));
  if (t.includes("cactus") || t.includes("succulent")) return (
    <svg viewBox="0 0 120 160" width={size} height={h}>
      <ellipse cx="60" cy="148" rx="30" ry="8" fill="#8B6914" opacity="0.4"/>
      <rect x="46" y="100" width="28" height="44" rx="6" fill="#5a9e6f"/>
      <ellipse cx="60" cy="100" rx="14" ry="8" fill="#6db882"/>
      <rect x="28" y="110" width="20" height="28" rx="6" fill="#5a9e6f"/>
      <ellipse cx="38" cy="110" rx="10" ry="6" fill="#6db882"/>
      <rect x="72" y="116" width="18" height="22" rx="5" fill="#5a9e6f"/>
      <ellipse cx="81" cy="116" rx="9" ry="5" fill="#6db882"/>
      {[55,60,65,50,70].map((x,i)=><line key={i} x1={x} y1={100+i*8} x2={x+5} y2={95+i*8} stroke="#3d7a52" strokeWidth="1"/>)}
      <circle cx="60" cy="94" r="5" fill="#e85d8a"/>
      <rect x="48" y="144" width="24" height="10" rx="3" fill="#b87333"/>
      <rect x="44" y="150" width="32" height="6" rx="2" fill="#8B6914"/>
    </svg>
  );
  if (t.includes("fern") || t.includes("monstera") || t.includes("tropical")) return (
    <svg viewBox="0 0 120 160" width={size} height={h}>
      <ellipse cx="60" cy="150" rx="28" ry="7" fill="#8B6914" opacity="0.4"/>
      <rect x="55" y="110" width="10" height="38" rx="4" fill="#6b4f28"/>
      {[[-25,-40,30,5],[-15,-50,15,10],[5,-50,-10,15],[20,-40,-25,10],[10,-30,-30,5]].map(([dx,dy,cx2,cy2],i)=>(
        <g key={i}>
          <path d={`M 60 110 Q ${60+Number(cx2)} ${110+Number(cy2)} ${60+Number(dx)} ${110+Number(dy)}`} stroke="#6b4f28" strokeWidth="2" fill="none"/>
          <ellipse cx={60+Number(dx)} cy={110+Number(dy)} rx="16" ry="9" transform={`rotate(${i*35-60} ${60+Number(dx)} ${110+Number(dy)})`} fill={i%2===0?"#4a9e65":"#5cb876"} opacity="0.9"/>
        </g>
      ))}
      <rect x="48" y="144" width="24" height="12" rx="3" fill="#c17f3e"/>
      <rect x="44" y="152" width="32" height="5" rx="2" fill="#8B6914"/>
    </svg>
  );
  if (t.includes("flower") || t.includes("rose") || t.includes("tulip")) return (
    <svg viewBox="0 0 120 160" width={size} height={h}>
      <ellipse cx="60" cy="150" rx="28" ry="7" fill="#8B6914" opacity="0.4"/>
      <line x1="60" y1="145" x2="60" y2="80" stroke="#4a8c3f" strokeWidth="4" strokeLinecap="round"/>
      <path d="M 60 110 Q 40 100 35 85 Q 50 90 60 110" fill="#5cb050"/>
      <path d="M 60 100 Q 80 90 85 75 Q 70 82 60 100" fill="#4a8c3f"/>
      {[0,45,90,135,180,225,270,315].map((angle,i)=>(
        <ellipse key={i} cx={60+Math.cos(angle*Math.PI/180)*16} cy={68+Math.sin(angle*Math.PI/180)*16}
          rx="7" ry="10" transform={`rotate(${angle} ${60+Math.cos(angle*Math.PI/180)*16} ${68+Math.sin(angle*Math.PI/180)*16})`}
          fill={i%2===0?"#ff6b9d":"#ff8fb1"}/>
      ))}
      <circle cx="60" cy="68" r="9" fill="#f5c518"/>
      <circle cx="60" cy="68" r="5" fill="#e6a800"/>
      <rect x="48" y="144" width="24" height="10" rx="3" fill="#c17f3e"/>
      <rect x="44" y="150" width="32" height="6" rx="2" fill="#8B6914"/>
    </svg>
  );
  if (t.includes("bamboo") || t.includes("palm") || t.includes("tree")) return (
    <svg viewBox="0 0 120 160" width={size} height={h}>
      <ellipse cx="60" cy="150" rx="28" ry="7" fill="#8B6914" opacity="0.4"/>
      <rect x="56" y="80" width="8" height="68" rx="3" fill="#7ab648"/>
      <rect x="56" y="100" width="8" height="4" rx="1" fill="#5a8a30"/>
      <rect x="56" y="120" width="8" height="4" rx="1" fill="#5a8a30"/>
      {[[-30,-15],[-20,-5],[-10,5],[10,-5],[20,-15],[30,-10]].map(([dx,dy],i)=>(
        <path key={i} d={`M 60 85 Q ${60+Number(dx)/2} ${85+Number(dy)} ${60+Number(dx)} ${85+Number(dy)*2}`} stroke="#4a9e3e" strokeWidth="3" fill="none" strokeLinecap="round"/>
      ))}
      <rect x="48" y="144" width="24" height="10" rx="3" fill="#c17f3e"/>
      <rect x="44" y="150" width="32" height="6" rx="2" fill="#8B6914"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 120 160" width={size} height={h}>
      <ellipse cx="60" cy="150" rx="28" ry="7" fill="#8B6914" opacity="0.4"/>
      <line x1="60" y1="145" x2="60" y2="100" stroke="#6b4f28" strokeWidth="3" strokeLinecap="round"/>
      {[[-30,-40,-10,-10],[-20,-55,0,0],[5,-55,5,5],[25,-45,15,0],[30,-25,20,10]].map(([dx,dy,cx2,cy2],i)=>(
        <g key={i}>
          <path d={`M 60 100 Q ${60+Number(cx2)} ${100+Number(cy2)} ${60+Number(dx)} ${100+Number(dy)}`} stroke="#6b4f28" strokeWidth="1.5" fill="none"/>
          <ellipse cx={60+Number(dx)} cy={100+Number(dy)} rx="18" ry="11" transform={`rotate(${i*30-50} ${60+Number(dx)} ${100+Number(dy)})`} fill={["#4a9e65","#5cb876","#3d8a55","#6dc88a","#4ab870"][i]}/>
        </g>
      ))}
      <rect x="48" y="140" width="24" height="14" rx="3" fill="#c17f3e"/>
      <rect x="44" y="150" width="32" height="6" rx="2" fill="#8B6914"/>
    </svg>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const fmt = (d: string) => new Date(d).toLocaleDateString("en-SG", { day:"numeric", month:"short", year:"numeric" });
const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

const MILESTONE_CATEGORIES: { value: MilestoneCategory; label: string; emoji: string; color: string }[] = [
  { value:"growth",  label:"Growth",  emoji:"🌱", color:"#4a9e65" },
  { value:"care",    label:"Care",    emoji:"💧", color:"#5ba3cc" },
  { value:"harvest", label:"Harvest", emoji:"🌾", color:"#c9a84c" },
  { value:"health",  label:"Health",  emoji:"💊", color:"#cc7a5f" },
  { value:"repot",   label:"Repot",   emoji:"🪴", color:"#8a6ec9" },
  { value:"custom",  label:"Custom",  emoji:"⭐", color:"#7a7a6e" },
];
const CAT = (c: MilestoneCategory) => MILESTONE_CATEGORIES.find(x => x.value === c) ?? MILESTONE_CATEGORIES[5];
const PLANT_COLORS = ["#5a9e6f","#5ba3cc","#c9a84c","#cc7a5f","#8a6ec9","#cc5f8a","#4a7ecc","#7a9e3e"];
const REACTION_EMOJIS = ["🌿","🌸","💚","🔥","😍","👏"];

const emptyPlant = (): Omit<PlantProfile,"id"> => ({
  name:"", species:"", type:"", potSize:"", adopted:todayStr(),
  waterAmount:"", waterFrequency:7, sunlight:"", notes:"",
  lastWatered:todayStr(), color:PLANT_COLORS[0],
});

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --sage:#7a9e7e;--sage-light:#a8c5ac;--sage-dark:#4a6e4e;
    --cream:#faf7f2;--warm:#f0e8d8;--text:#2c2c2c;--muted:#7a7a6e;
    --white:#fff;--water:#5ba3cc;--gold:#c9a84c;--red:#cc5f5f;
    --radius:16px;--shadow:0 4px 24px rgba(0,0,0,0.08);
  }
  body{background:var(--cream);font-family:'DM Sans',sans-serif;color:var(--text);}
  .app{min-height:100vh;width:100%;display:flex;flex-direction:column;}

  /* ── Auth ── */
  .auth-wrap{min-height:100vh;width:100%;display:flex;flex-direction:column;background:var(--cream);}
  .auth-top{background:linear-gradient(160deg,#3a5e3e,#4a6e4e,#5a8e5e);padding:64px 32px 52px;display:flex;flex-direction:column;align-items:center;gap:14px;}
  .auth-logo{font-size:56px;filter:drop-shadow(0 4px 14px rgba(0,0,0,0.25));}
  .auth-brand{font-family:'Playfair Display',serif;color:#fff;font-size:30px;font-weight:700;letter-spacing:-0.5px;}
  .auth-tagline{color:#b8d9bc;font-size:13px;text-align:center;font-weight:300;line-height:1.6;max-width:260px;}
  .auth-body{flex:1;padding:40px 24px 48px;display:flex;flex-direction:column;align-items:center;}
  .auth-inner{width:100%;max-width:480px;}
  .auth-tabs{display:flex;border-bottom:2px solid #e8e2d8;margin-bottom:28px;}
  .auth-tab{flex:1;padding:11px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;color:var(--muted);background:none;border:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .2s;}
  .auth-tab.active{color:var(--sage-dark);border-bottom-color:var(--sage-dark);}
  .auth-form{display:flex;flex-direction:column;gap:16px;}
  .auth-field{display:flex;flex-direction:column;gap:6px;}
  .auth-label{font-size:12px;font-weight:500;color:var(--muted);}
  .auth-input{padding:13px 16px;border:1.5px solid #e0dbd0;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text);background:#fdfbf8;transition:border-color .2s;width:100%;}
  .auth-input:focus{outline:none;border-color:var(--sage);}
  .auth-btn{padding:14px;background:var(--sage-dark);color:white;border:none;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;cursor:pointer;transition:background .2s;margin-top:2px;}
  .auth-btn:hover{background:#3a5e3e;}
  .auth-btn:disabled{opacity:0.6;cursor:not-allowed;}
  .auth-error{background:#fde8e8;color:#c03030;padding:10px 14px;border-radius:10px;font-size:13px;text-align:center;}
  .auth-success{background:#e8f5ea;color:#2d6e3e;padding:10px 14px;border-radius:10px;font-size:13px;text-align:center;}
  .auth-hint{font-size:12px;color:var(--muted);text-align:center;line-height:1.6;padding:4px 0;}

  /* ── Shell ── */
  .header{background:var(--sage-dark);padding:18px 28px 14px;display:flex;align-items:center;gap:10px;}
  .hback{background:rgba(255,255,255,0.18);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .htitle{font-family:'Playfair Display',serif;color:var(--cream);font-size:20px;font-weight:700;}
  .hsub{color:var(--sage-light);font-size:11px;margin-top:1px;}
  .hright{margin-left:auto;}
  .havatar{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:white;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;letter-spacing:0.5px;}
  .user-bar{background:#fff;border-bottom:1px solid #e8e2d8;padding:10px 28px;display:flex;justify-content:space-between;align-items:center;}

  /* ── Top-level garden/explore tabs ── */
  .gnav{display:flex;background:var(--white);border-bottom:1px solid #e8e2d8;position:sticky;top:0;z-index:10;}
  .gnbtn{flex:1;padding:11px 4px 9px;font-size:10px;font-family:'DM Sans',sans-serif;font-weight:500;color:var(--muted);background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;border-bottom:2px solid transparent;transition:color .2s;}
  .gnbtn.active{color:var(--sage-dark);border-bottom-color:var(--sage-dark);}

  /* ── Plant-level nav ── */
  .nav{display:flex;background:var(--white);border-bottom:1px solid #e8e2d8;position:sticky;top:0;z-index:10;}
  .nbtn{flex:1;padding:11px 4px 9px;font-size:10px;font-family:'DM Sans',sans-serif;font-weight:500;color:var(--muted);background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;border-bottom:2px solid transparent;transition:color .2s;}
  .nbtn.active{color:var(--sage-dark);border-bottom-color:var(--sage-dark);}
  .nicon{font-size:17px;}

  /* ── Content ── */
  .content{flex:1;overflow-y:auto;padding:20px 28px 100px;display:flex;flex-direction:column;gap:14px;max-width:860px;width:100%;margin:0 auto;align-self:center;}
  .card{background:var(--white);border-radius:var(--radius);padding:18px;box-shadow:var(--shadow);}
  .ctitle{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:var(--sage-dark);margin-bottom:12px;}

  /* ── Garden grid ── */
  .garden-wrap{width:100%;padding:16px 28px;}
  .garden-inner{max-width:1200px;margin:0 auto;}
  .ggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;}
  .pcard{background:var(--white);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow);cursor:pointer;transition:transform .15s,box-shadow .15s;display:flex;flex-direction:column;align-items:center;gap:7px;border-top:4px solid var(--acc);}
  .pcard:hover{transform:translateY(-3px);box-shadow:0 8px 28px rgba(0,0,0,0.12);}
  .pcname{font-family:'Playfair Display',serif;font-size:14px;font-weight:700;text-align:center;line-height:1.2;}
  .pcspp{font-size:10px;color:var(--muted);font-style:italic;text-align:center;}
  .pcpill{font-size:11px;padding:3px 9px;border-radius:50px;font-weight:500;}
  .pcpill.needs{background:#d6edf8;color:#2d7aaa;}
  .pcpill.ok{background:#d6edd9;color:#2d6e3e;}
  .addcard{background:var(--warm);border-radius:var(--radius);padding:20px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:2px dashed #c8bfae;min-height:185px;transition:background .2s;}
  .addcard:hover{background:#e8dece;}

  /* ── Explore ── */
  .explore-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;}
  .gcard{background:var(--white);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:12px;}
  .gcard-header{display:flex;align-items:center;gap:12px;}
  .gcard-avatar{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--sage),var(--sage-dark));display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:white;flex-shrink:0;}
  .gcard-name{font-family:'Playfair Display',serif;font-size:16px;font-weight:700;}
  .gcard-meta{font-size:11px;color:var(--muted);margin-top:2px;}
  .gcard-thumbs{display:flex;gap:6px;flex-wrap:wrap;}
  .pthumb{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:8px 6px;border-radius:12px;background:var(--warm);transition:background .15s;flex:1;min-width:64px;}
  .pthumb:hover{background:#e4d8c8;}
  .pthumb-name{font-size:10px;font-weight:500;text-align:center;color:var(--sage-dark);line-height:1.2;}
  .rx-row{display:flex;gap:5px;flex-wrap:wrap;align-items:center;}
  .rx-btn{padding:4px 9px;border-radius:50px;font-size:13px;border:1.5px solid #e0dbd0;background:white;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:3px;font-family:'DM Sans',sans-serif;}
  .rx-btn.mine{border-color:var(--sage-dark);background:#edf5ee;}
  .rx-count{font-size:11px;color:var(--muted);}
  .follow-btn{padding:6px 14px;border-radius:50px;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid var(--sage-dark);background:none;color:var(--sage-dark);transition:all .2s;font-family:'DM Sans',sans-serif;}
  .follow-btn.on{background:var(--sage-dark);color:white;}
  .search-wrap{position:relative;}
  .search-input{width:100%;padding:10px 14px 10px 36px;border:1.5px solid #e0dbd0;border-radius:50px;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text);background:#fdfbf8;transition:border-color .2s;}
  .search-input:focus{outline:none;border-color:var(--sage);}
  .search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;pointer-events:none;color:var(--muted);}
  .visit-banner{background:linear-gradient(135deg,#e8f5ea,#d0ead4);border-radius:12px;padding:12px 16px;font-size:13px;color:var(--sage-dark);display:flex;align-items:center;gap:8px;}

  /* ── Spinner ── */
  .spinner{width:20px;height:20px;border:2px solid #e0dbd0;border-top-color:var(--sage-dark);border-radius:50%;animation:spin .7s linear infinite;margin:0 auto;}
  @keyframes spin{to{transform:rotate(360deg)}}
  .loading{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;gap:14px;color:var(--muted);font-size:13px;}

  /* ── Empty ── */
  .empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 32px;gap:16px;text-align:center;min-height:60vh;}
  .empty-icon{font-size:64px;opacity:0.55;}
  .empty-title{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--sage-dark);}
  .empty-sub{font-size:14px;color:var(--muted);line-height:1.65;max-width:270px;}

  /* ── Water banner ── */
  .wbanner{border-radius:var(--radius);padding:18px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow);}
  .wbanner.needs{background:linear-gradient(135deg,#d6edf8,#b8ddf5);}
  .wbanner.ok{background:linear-gradient(135deg,#d6edd9,#b8d9bb);}
  .wicon{font-size:36px;flex-shrink:0;}
  .wtitle{font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:var(--sage-dark);}
  .wsub{font-size:11px;color:var(--muted);margin-top:2px;}
  .wamt{font-size:20px;font-weight:700;color:var(--water);margin:5px 0 8px;}

  /* ── Hero ── */
  .hero{background:linear-gradient(160deg,#e8f5ea,#d0ead4);border-radius:var(--radius);padding:18px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow);}
  .hname{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:var(--sage-dark);}
  .hspp{font-style:italic;font-size:12px;color:var(--muted);margin-top:2px;}
  .badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;}
  .badge{background:white;color:var(--sage-dark);font-size:10px;font-weight:500;padding:3px 9px;border-radius:50px;box-shadow:0 1px 4px rgba(0,0,0,0.08);}

  /* ── Stats ── */
  .stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
  .stat{background:var(--warm);border-radius:12px;padding:10px;text-align:center;}
  .snum{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:var(--sage-dark);}
  .slbl{font-size:9px;color:var(--muted);margin-top:1px;}

  /* ── Growth entries ── */
  .entry{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #f0ece4;}
  .entry:last-child{border-bottom:none;}
  .eemo{font-size:22px;flex-shrink:0;}
  .edate{font-size:10px;color:var(--muted);}
  .enote{font-size:13px;margin-top:2px;line-height:1.4;}
  .eht{font-size:10px;color:var(--sage-dark);font-weight:500;margin-top:3px;}

  /* ── Milestones ── */
  .ms{padding:11px 0;border-bottom:1px solid #f0ece4;}
  .ms:last-child{border-bottom:none;}
  .mscat{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
  .mstitle{font-weight:500;font-size:13px;line-height:1.3;}
  .mstitle.done{text-decoration:line-through;color:var(--muted);}
  .msdesc{font-size:11px;color:var(--muted);margin-top:2px;}
  .msmeta{display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;}
  .msdate{font-size:10px;color:var(--sage-dark);}
  .mspri{font-size:10px;padding:2px 7px;border-radius:50px;font-weight:500;}
  .mspri.high{background:#fde8e8;color:#cc4444;}
  .mspri.medium{background:#fdf3d6;color:#a07a10;}
  .mspri.low{background:#e8f0e8;color:#3d7a3d;}
  .msach{background:#e8f5ea;border-radius:8px;padding:7px 10px;margin-top:7px;font-size:11px;color:var(--sage-dark);}
  .ftabs{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;}
  .ftab{padding:4px 11px;border-radius:50px;font-size:11px;font-weight:500;cursor:pointer;border:1.5px solid #e0dbd0;background:white;color:var(--muted);transition:all .15s;}
  .ftab.active{border-color:var(--sage-dark);color:var(--sage-dark);background:#edf5ee;}

  /* ── Inputs ── */
  .ig{display:flex;flex-direction:column;gap:5px;margin-bottom:8px;}
  .il{font-size:11px;font-weight:500;color:var(--muted);}
  .input{padding:9px 12px;border:1.5px solid #e0dbd0;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text);background:#fdfbf8;width:100%;transition:border-color .2s;}
  .input:focus{outline:none;border-color:var(--sage);}
  .textarea{resize:vertical;min-height:64px;}
  .irow{display:flex;gap:8px;}
  .epick{display:flex;gap:6px;flex-wrap:wrap;}
  .ep{width:34px;height:34px;border-radius:8px;border:2px solid transparent;font-size:16px;cursor:pointer;background:var(--warm);display:flex;align-items:center;justify-content:center;}
  .ep.sel{border-color:var(--sage-dark);}

  /* ── Profile ── */
  .pr{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f0ece4;font-size:13px;}
  .pr:last-child{border-bottom:none;}
  .swatches{display:flex;gap:7px;flex-wrap:wrap;}
  .swatch{width:26px;height:26px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:border-color .15s;}
  .swatch.sel{border-color:#6b4f28;}

  /* ── Buttons ── */
  .btn{display:inline-flex;align-items:center;gap:5px;padding:8px 16px;border-radius:50px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;border:none;transition:all .2s;}
  .btn-water{background:var(--water);color:white;}
  .btn-sage{background:var(--sage-dark);color:white;}
  .btn-outline{background:none;border:1.5px solid var(--sage-dark);color:var(--sage-dark);}
  .btn-gold{background:var(--gold);color:white;}
  .btn-danger{background:#fde8e8;color:#cc4444;}
  .btn-sm{padding:5px 12px;font-size:12px;}
  .btn:disabled{opacity:0.6;cursor:not-allowed;}

  /* ── Modal ── */
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.42);z-index:50;display:flex;align-items:center;justify-content:center;}
  .modal{background:var(--white);border-radius:20px;padding:28px 24px 36px;width:100%;max-width:520px;margin:0 24px;max-height:88vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.2);}
  .mtitle{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--sage-dark);margin-bottom:14px;}

  /* ── Alert / toast ── */
  .alert{background:#fef9ec;border:1.5px solid #f0d88a;border-radius:12px;padding:10px 14px;font-size:13px;color:#8a6010;font-weight:500;}
  .toast{position:fixed;bottom:40px;left:50%;transform:translateX(-50%);background:var(--sage-dark);color:white;padding:10px 20px;border-radius:50px;font-size:13px;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,0.2);z-index:100;white-space:nowrap;animation:su .3s ease;}
  .toast.err{background:var(--red);}
  @keyframes su{from{transform:translateX(-50%) translateY(20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
  select.input{appearance:none;}
  .splash{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--cream);font-family:'DM Sans',sans-serif;color:var(--muted);font-size:14px;}
`;

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function PlantJournalPage() {
  const supabase = getSupabase();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser]           = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authTab, setAuthTab]     = useState<"login"|"signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw]       = useState("");
  const [authName, setAuthName]   = useState("");
  const [authError, setAuthError] = useState("");
  const [authInfo, setAuthInfo]   = useState("");
  const [authBusy, setAuthBusy]   = useState(false);

  // ── Own data ──────────────────────────────────────────────────────────────
  const [plants, setPlants]         = useState<PlantProfile[]>([]);
  const [growth, setGrowth]         = useState<GrowthEntry[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  // ── Navigation ────────────────────────────────────────────────────────────
  type TopTab    = "myGarden" | "explore";
  type PlantTab  = "home" | "growth" | "milestones" | "profile";
  type ViewMode  = "garden" | "plant" | "visitGarden" | "visitPlant";

  const [topTab, setTopTab]               = useState<TopTab>("myGarden");
  const [view, setView]                   = useState<ViewMode>("garden");
  const [activePlantId, setActivePlantId] = useState<string | null>(null);
  const [tab, setTab]                     = useState<PlantTab>("home");
  const [showUserMenu, setShowUserMenu]   = useState(false);

  // ── Explore state ─────────────────────────────────────────────────────────
  const [publicGardens, setPublicGardens]   = useState<PublicGarden[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreLoaded, setExploreLoaded]   = useState(false);
  const [searchQuery, setSearchQuery]       = useState("");
  // myReactions: plantId → emoji I reacted with
  const [myReactions, setMyReactions]       = useState<Record<string, string>>({});
  // reactionCounts: plantId → { emoji → count }
  const [rxCounts, setRxCounts]             = useState<Record<string, Record<string, number>>>({});
  const [myFollows, setMyFollows]           = useState<Set<string>>(new Set());
  const [visitingGarden, setVisitingGarden] = useState<PublicGarden | null>(null);
  const [visitingPlant, setVisitingPlant]   = useState<PlantProfile | null>(null);
  const [visitGrowth, setVisitGrowth]       = useState<GrowthEntry[]>([]);
  const [visitMs, setVisitMs]               = useState<Milestone[]>([]);
  const [visitLoading, setVisitLoading]     = useState(false);

  // ── Forms ─────────────────────────────────────────────────────────────────
  const [addingPlant, setAddingPlant]       = useState(false);
  const [newPlantDraft, setNewPlantDraft]   = useState(emptyPlant());
  const [newEntry, setNewEntry]             = useState({ note:"", height:"", emoji:"🌿" });
  const [newMs, setNewMs]                   = useState<{
    title:string; description:string; date:string;
    category:MilestoneCategory; priority:"low"|"medium"|"high";
  }>({ title:"", description:"", date:todayStr(), category:"growth", priority:"medium" });
  const [achievingId, setAchievingId]       = useState<string | null>(null);
  const [achieveNote, setAchieveNote]       = useState("");
  const [msFilter, setMsFilter]             = useState<MilestoneCategory|"all"|"done">("all");
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftProfile, setDraftProfile]     = useState<PlantProfile | null>(null);
  const [toast, setToast]                   = useState<{ msg:string; err?:boolean } | null>(null);

  const showToast = (msg:string, err = false) => {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3000);
  };

  // ── Load own data ─────────────────────────────────────────────────────────
  const loadUserData = useCallback(async (userId: string) => {
    const [{ data: pData, error: pErr }, { data: gData, error: gErr }, { data: mData, error: mErr }] = await Promise.all([
      supabase.from("plants").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("growth_entries").select("*").eq("user_id", userId).order("date", { ascending: false }),
      supabase.from("milestones").select("*").eq("user_id", userId).order("date", { ascending: true }),
    ]);
    if (pErr) showToast("Could not load plants", true);
    if (gErr) showToast("Could not load growth entries", true);
    if (mErr) showToast("Could not load milestones", true);
    setPlants((pData ?? []).map(rowToPlant));
    setGrowth((gData ?? []).map(rowToGrowth));
    setMilestones((mData ?? []).map(rowToMilestone));
  }, [supabase]);

  // ── Auth bootstrap ────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // Safety net: if nothing resolves in 5s, stop showing the splash screen
    const safetyTimer = setTimeout(() => {
      if (mounted) setAuthReady(true);
    }, 5000);

    // Subscribe first so we never miss an event that fires before getSession returns
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (!mounted) return;
      if (session?.user) {
        const u: User = {
          id: session.user.id, email: session.user.email ?? "",
          name: (session.user.user_metadata?.name as string) || session.user.email?.split("@")[0] || "Plant lover",
        };
        setUser(u);
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          loadUserData(u.id); // intentionally not awaited — let UI unblock
        }
      } else {
        setUser(null);
        setPlants([]); setGrowth([]); setMilestones([]);
      }
      // Always unblock the splash on any auth event
      if (mounted) setAuthReady(true);
    });

    // Then check for an existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      // If onAuthStateChange already fired (INITIAL_SESSION), this is a no-op.
      // If there's no session at all, we still need to unblock the splash.
      if (!session) setAuthReady(true);
      // If there is a session, onAuthStateChange will have fired or will fire shortly.
    }).catch(() => {
      // Network error — show auth screen rather than hanging
      if (mounted) setAuthReady(true);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [supabase, loadUserData]);

  // ── Load Explore data ─────────────────────────────────────────────────────
  const loadExplore = useCallback(async () => {
    if (!user || exploreLoaded) return;
    setExploreLoading(true);

    // All plants not owned by me
    const { data: allPlants } = await supabase
      .from("plants").select("*")
      .neq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!allPlants || allPlants.length === 0) {
      setExploreLoading(false); setExploreLoaded(true); return;
    }

    // Group by user
    const byUser: Record<string, PlantProfile[]> = {};
    for (const row of allPlants) {
      if (!byUser[row.user_id]) byUser[row.user_id] = [];
      byUser[row.user_id].push(rowToPlant(row as PlantRow));
    }
    const userIds = Object.keys(byUser);

    // Display names from profiles table
    const { data: profiles } = await supabase.from("profiles").select("id,display_name").in("id", userIds);
    const nameMap: Record<string, string> = {};
    (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.display_name ?? "Gardener"; });

    // Follower counts
    const { data: followData } = await supabase.from("follows").select("following_id").in("following_id", userIds);
    const followerMap: Record<string, number> = {};
    (followData ?? []).forEach((f: any) => { followerMap[f.following_id] = (followerMap[f.following_id] ?? 0) + 1; });

    setPublicGardens(userIds.map(uid => ({
      userId: uid,
      displayName: nameMap[uid] ?? "Gardener",
      plants: byUser[uid],
      followerCount: followerMap[uid] ?? 0,
    })));

    // My follows
    const { data: myFollowData } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
    setMyFollows(new Set((myFollowData ?? []).map((f: any) => f.following_id)));

    // Reactions for all these plants
    const plantIds = allPlants.map((p: any) => p.id);
    const { data: rxData } = await supabase.from("reactions").select("plant_id,emoji,user_id").in("plant_id", plantIds);
    const myRx: Record<string, string> = {};
    const counts: Record<string, Record<string, number>> = {};
    (rxData ?? []).forEach((r: any) => {
      if (r.user_id === user.id) myRx[r.plant_id] = r.emoji;
      if (!counts[r.plant_id]) counts[r.plant_id] = {};
      counts[r.plant_id][r.emoji] = (counts[r.plant_id][r.emoji] ?? 0) + 1;
    });
    setMyReactions(myRx);
    setRxCounts(counts);

    setExploreLoading(false); setExploreLoaded(true);
  }, [user, supabase, exploreLoaded]);

  useEffect(() => {
    if (topTab === "explore" && user) loadExplore();
  }, [topTab, user, loadExplore]);

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const resetAuthForm = () => { setAuthEmail(""); setAuthPw(""); setAuthName(""); setAuthError(""); setAuthInfo(""); };

  const handleLogin = async () => {
    setAuthError(""); setAuthInfo("");
    if (!authEmail.trim() || !authPw) { setAuthError("Please fill in all fields."); return; }
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim().toLowerCase(), password: authPw,
    });
    setAuthBusy(false);
    if (error) { setAuthError(error.message); return; }
    resetAuthForm();
  };

  const handleSignup = async () => {
    setAuthError(""); setAuthInfo("");
    if (!authName.trim() || !authEmail.trim() || !authPw) { setAuthError("Please fill in all fields."); return; }
    if (!authEmail.includes("@")) { setAuthError("Please enter a valid email address."); return; }
    if (authPw.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
    setAuthBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: authEmail.trim().toLowerCase(), password: authPw,
      options: { data: { name: authName.trim() } },
    });
    setAuthBusy(false);
    if (error) { setAuthError(error.message); return; }
    if (!data.session) {
      setAuthInfo("Account created! Check your email to confirm, then sign in.");
      setAuthTab("login"); setAuthPw(""); setAuthName(""); return;
    }
    resetAuthForm();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView("garden"); setTopTab("myGarden"); setShowUserMenu(false); setActivePlantId(null);
    setExploreLoaded(false); setPublicGardens([]);
  };

  // ── Own plant helpers ─────────────────────────────────────────────────────
  const activePlant     = plants.find(p => p.id === activePlantId) ?? null;
  const plantGrowth     = growth.filter(g => g.plantId === activePlantId);
  const plantMilestones = milestones.filter(m => m.plantId === activePlantId);

  const openPlant = (id: string) => {
    setActivePlantId(id); setView("plant"); setTab("home");
    setEditingProfile(false); setMsFilter("all");
  };

  const persist = async (
    label: string,
    optimistic: () => void,
    write: () => Promise<{ error: { message: string } | null }>,
    rollback: () => void,
  ) => {
    optimistic();
    const { error } = await write();
    if (error) { rollback(); showToast(`${label} failed: ${error.message}`, true); return false; }
    return true;
  };

  const logWater = async () => {
    if (!activePlant || !user) return;
    const prev = activePlant.lastWatered; const next = todayStr();
    await persist("Watering",
      () => setPlants(plants.map(p => p.id===activePlant.id ? {...p, lastWatered:next} : p)),
      () => supabase.from("plants").update({ last_watered:next }).eq("id", activePlant.id),
      () => setPlants(plants.map(p => p.id===activePlant.id ? {...p, lastWatered:prev} : p)),
    ) && showToast("💧 Watering logged!");
  };

  const addGrowthEntry = async () => {
    if (!newEntry.note.trim() || !activePlantId || !user) return;
    const entry: GrowthEntry = { id:"g"+Date.now(), plantId:activePlantId, date:todayStr(), ...newEntry };
    const ok = await persist("Adding entry",
      () => setGrowth([entry, ...growth]),
      () => supabase.from("growth_entries").insert(growthToRow(entry, user.id)),
      () => setGrowth(growth.filter(g => g.id !== entry.id)),
    );
    if (ok) { setNewEntry({ note:"", height:"", emoji:"🌿" }); showToast("🌿 Entry added!"); }
  };

  const addMilestone = async () => {
    if (!newMs.title.trim() || !activePlantId || !user) return;
    const m: Milestone = { id:"m"+Date.now(), plantId:activePlantId, achieved:false, ...newMs };
    const ok = await persist("Adding milestone",
      () => setMilestones([...milestones, m]),
      () => supabase.from("milestones").insert(milestoneToRow(m, user.id)),
      () => setMilestones(milestones.filter(x => x.id !== m.id)),
    );
    if (ok) {
      setNewMs({ title:"", description:"", date:todayStr(), category:"growth", priority:"medium" });
      showToast("⭐ Milestone added!");
    }
  };

  const confirmAchieve = async () => {
    if (!achievingId) return;
    const prev = milestones; const achievedDate = todayStr();
    const ok = await persist("Marking achieved",
      () => setMilestones(milestones.map(m => m.id===achievingId ? {...m, achieved:true, achievedDate, achievedNote:achieveNote||undefined} : m)),
      () => supabase.from("milestones").update({ achieved:true, achieved_date:achievedDate, achieved_note:achieveNote||null }).eq("id", achievingId),
      () => setMilestones(prev),
    );
    if (ok) { setAchievingId(null); setAchieveNote(""); showToast("🎉 Milestone achieved!"); }
  };

  const unachieve = async (id: string) => {
    const prev = milestones;
    await persist("Undo achievement",
      () => setMilestones(milestones.map(m => m.id===id ? {...m, achieved:false, achievedDate:undefined, achievedNote:undefined} : m)),
      () => supabase.from("milestones").update({ achieved:false, achieved_date:null, achieved_note:null }).eq("id", id),
      () => setMilestones(prev),
    );
  };

  const confirmAddPlant = async () => {
    if (!newPlantDraft.name.trim() || !user) return;
    const plant: PlantProfile = { id:"p"+Date.now(), ...newPlantDraft };
    const ok = await persist("Adding plant",
      () => setPlants([...plants, plant]),
      () => supabase.from("plants").insert(plantToRow(plant, user.id)),
      () => setPlants(plants.filter(p => p.id !== plant.id)),
    );
    if (ok) { setAddingPlant(false); setNewPlantDraft(emptyPlant()); showToast("🪴 Plant added!"); }
  };

  const deletePlant = async (id: string) => {
    const pp = plants, pg = growth, pm = milestones;
    const ok = await persist("Removing plant",
      () => { setPlants(plants.filter(p=>p.id!==id)); setGrowth(growth.filter(g=>g.plantId!==id)); setMilestones(milestones.filter(m=>m.plantId!==id)); },
      () => supabase.from("plants").delete().eq("id", id),
      () => { setPlants(pp); setGrowth(pg); setMilestones(pm); },
    );
    if (ok) { setView("garden"); showToast("🗑 Plant removed."); }
  };

  const saveProfile = async () => {
    if (!draftProfile || !user) return;
    const prev = plants;
    const ok = await persist("Saving profile",
      () => setPlants(plants.map(p => p.id===draftProfile.id ? draftProfile : p)),
      () => supabase.from("plants").update({
        name:draftProfile.name, species:draftProfile.species, type:draftProfile.type,
        pot_size:draftProfile.potSize, adopted:draftProfile.adopted,
        water_amount:draftProfile.waterAmount, water_frequency:draftProfile.waterFrequency,
        sunlight:draftProfile.sunlight, notes:draftProfile.notes, color:draftProfile.color,
      }).eq("id", draftProfile.id),
      () => setPlants(prev),
    );
    if (ok) { setEditingProfile(false); showToast("✅ Profile saved!"); }
  };

  // ── Explore: reactions, follows, visiting ─────────────────────────────────
  const toggleReaction = async (plantId: string, emoji: string) => {
    if (!user) return;
    const current = myReactions[plantId];
    if (current === emoji) {
      await supabase.from("reactions").delete().eq("plant_id", plantId).eq("user_id", user.id);
      setMyReactions(r => { const n={...r}; delete n[plantId]; return n; });
      setRxCounts(c => { const n={...c}; if(n[plantId]?.[emoji]) n[plantId]={...n[plantId],[emoji]:Math.max(0,n[plantId][emoji]-1)}; return n; });
    } else {
      await supabase.from("reactions").upsert({ id:`${plantId}_${user.id}`, plant_id:plantId, user_id:user.id, emoji });
      if (current) setRxCounts(c => { const n={...c}; if(n[plantId]?.[current]) n[plantId]={...n[plantId],[current]:Math.max(0,n[plantId][current]-1)}; return n; });
      setMyReactions(r => ({ ...r, [plantId]:emoji }));
      setRxCounts(c => { const n={...c}; if(!n[plantId]) n[plantId]={}; n[plantId]={...n[plantId],[emoji]:(n[plantId][emoji]??0)+1}; return n; });
    }
  };

  const toggleFollow = async (targetId: string) => {
    if (!user) return;
    const isFollowing = myFollows.has(targetId);
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
      setMyFollows(f => { const n=new Set(f); n.delete(targetId); return n; });
      setPublicGardens(g => g.map(pg => pg.userId===targetId ? {...pg, followerCount:Math.max(0,pg.followerCount-1)} : pg));
    } else {
      await supabase.from("follows").insert({ follower_id:user.id, following_id:targetId });
      setMyFollows(f => new Set([...f, targetId]));
      setPublicGardens(g => g.map(pg => pg.userId===targetId ? {...pg, followerCount:pg.followerCount+1} : pg));
    }
  };

  const openVisitGarden = (garden: PublicGarden) => {
    setVisitingGarden(garden); setVisitingPlant(null); setView("visitGarden");
  };

  const openVisitPlant = async (plant: PlantProfile, garden: PublicGarden) => {
    setVisitingPlant(plant); setVisitingGarden(garden); setView("visitPlant"); setVisitLoading(true);
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from("growth_entries").select("*").eq("plant_id", plant.id).order("date", { ascending:false }),
      supabase.from("milestones").select("*").eq("plant_id", plant.id).order("date", { ascending:true }),
    ]);
    setVisitGrowth((g ?? []).map(rowToGrowth));
    setVisitMs((m ?? []).map(rowToMilestone));
    setVisitLoading(false);
  };

  // ── Filtered milestones ───────────────────────────────────────────────────
  const filteredMs = plantMilestones.filter(m => {
    if (msFilter==="done") return m.achieved;
    if (msFilter==="all")  return !m.achieved;
    return m.category===msFilter && !m.achieved;
  }).sort((a,b) => ({high:0,medium:1,low:2}[a.priority]) - ({high:0,medium:1,low:2}[b.priority]));

  const filteredGardens = publicGardens.filter(g =>
    g.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.plants.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ── Add plant modal (shared) ──────────────────────────────────────────────
  const AddPlantModal = () => (
    <div className="overlay" onClick={() => setAddingPlant(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="mtitle">🌱 Add a new plant</div>
        {([
          ["Plant nickname","name","text","e.g. Monty"],
          ["Species","species","text","e.g. Monstera deliciosa"],
          ["Type","type","text","e.g. Herb, Cactus, Fern, Flower…"],
          ["Pot size","potSize","text","e.g. 6 inch"],
          ["Water amount","waterAmount","text","e.g. 300ml"],
          ["Sunlight","sunlight","text","e.g. Indirect light"],
        ] as const).map(([label,key,type,ph]) => (
          <div className="ig" key={key}>
            <div className="il">{label}</div>
            <input className="input" type={type} placeholder={ph}
              value={String(newPlantDraft[key as keyof typeof newPlantDraft])}
              onChange={e => setNewPlantDraft({...newPlantDraft,[key]:e.target.value})}/>
          </div>
        ))}
        <div className="irow">
          <div className="ig" style={{flex:1}}>
            <div className="il">Date adopted</div>
            <input className="input" type="date" value={newPlantDraft.adopted}
              onChange={e => setNewPlantDraft({...newPlantDraft,adopted:e.target.value})}/>
          </div>
          <div className="ig" style={{flex:1}}>
            <div className="il">Water every (days)</div>
            <input className="input" type="number" min={1} value={newPlantDraft.waterFrequency}
              onChange={e => setNewPlantDraft({...newPlantDraft,waterFrequency:parseInt(e.target.value)||1})}/>
          </div>
        </div>
        <div className="ig">
          <div className="il">Card colour</div>
          <div className="swatches">{PLANT_COLORS.map(c => (
            <div key={c} className={`swatch ${newPlantDraft.color===c?"sel":""}`}
              style={{background:c}} onClick={() => setNewPlantDraft({...newPlantDraft,color:c})}/>
          ))}</div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:12}}>
          <button className="btn btn-sage" onClick={confirmAddPlant}>Add plant</button>
          <button className="btn btn-outline" onClick={() => setAddingPlant(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SPLASH
  // ══════════════════════════════════════════════════════════════════════════
  if (!authReady) return (<><style>{css}</style><div className="splash">🌿 Loading your garden…</div></>);

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (!user) return (
    <>
      <style>{css}</style>
      <div className="auth-wrap">
        <div className="auth-top">
          <div className="auth-logo">🌿</div>
          <div className="auth-brand">Plant Journal</div>
          <div className="auth-tagline">Track your plants, celebrate every leaf,<br/>never miss a watering day.</div>
        </div>
        <div className="auth-body">
          <div className="auth-inner">
            <div className="auth-tabs">
              <button className={`auth-tab ${authTab==="login"?"active":""}`} onClick={() => {setAuthTab("login");setAuthError("");setAuthInfo("");}}>Sign in</button>
              <button className={`auth-tab ${authTab==="signup"?"active":""}`} onClick={() => {setAuthTab("signup");setAuthError("");setAuthInfo("");}}>Create account</button>
            </div>
            {authTab==="login" ? (
              <div className="auth-form">
                <div className="auth-field">
                  <div className="auth-label">Email</div>
                  <input className="auth-input" type="email" placeholder="you@example.com"
                    value={authEmail} onChange={e => setAuthEmail(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleLogin()}/>
                </div>
                <div className="auth-field">
                  <div className="auth-label">Password</div>
                  <input className="auth-input" type="password" placeholder="••••••••"
                    value={authPw} onChange={e => setAuthPw(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleLogin()}/>
                </div>
                {authError && <div className="auth-error">{authError}</div>}
                {authInfo  && <div className="auth-success">{authInfo}</div>}
                <button className="auth-btn" onClick={handleLogin} disabled={authBusy}>{authBusy?"Signing in…":"Sign in →"}</button>
              </div>
            ) : (
              <div className="auth-form">
                <div className="auth-field">
                  <div className="auth-label">Your name</div>
                  <input className="auth-input" type="text" placeholder="e.g. Alex" value={authName} onChange={e => setAuthName(e.target.value)}/>
                </div>
                <div className="auth-field">
                  <div className="auth-label">Email</div>
                  <input className="auth-input" type="email" placeholder="you@example.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)}/>
                </div>
                <div className="auth-field">
                  <div className="auth-label">Password</div>
                  <input className="auth-input" type="password" placeholder="At least 6 characters"
                    value={authPw} onChange={e => setAuthPw(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleSignup()}/>
                </div>
                {authError && <div className="auth-error">{authError}</div>}
                {authInfo  && <div className="auth-success">{authInfo}</div>}
                <button className="auth-btn" onClick={handleSignup} disabled={authBusy}>{authBusy?"Creating account…":"Create account →"}</button>
                <div className="auth-hint">By signing up you agree to take very good care of your plants 🌱</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // VISIT A SINGLE PLANT (read-only)
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="visitPlant" && visitingPlant && visitingGarden) {
    const plantRxCounts = rxCounts[visitingPlant.id] ?? {};
    const myRx = myReactions[visitingPlant.id];
    return (
      <>
        <style>{css}</style>
        <div className="app">
          <div className="header" style={{background:visitingPlant.color}}>
            <button className="hback" onClick={() => setView("visitGarden")}>←</button>
            <div>
              <div className="htitle">{visitingPlant.name}</div>
              <div className="hsub">{visitingGarden.displayName}&rsquo;s garden</div>
            </div>
          </div>
          <div className="content">
            <div className="visit-banner">👁 Visiting {visitingGarden.displayName}&rsquo;s plant — read only</div>

            <div className="hero">
              <PlantCartoon type={visitingPlant.type} size={78}/>
              <div>
                <div className="hname">{visitingPlant.name}</div>
                <div className="hspp">{visitingPlant.species}</div>
                <div className="badges">
                  {visitingPlant.type    && <span className="badge">🪴 {visitingPlant.type}</span>}
                  {visitingPlant.sunlight && <span className="badge">☀️ {visitingPlant.sunlight}</span>}
                  {visitingPlant.potSize  && <span className="badge">📦 {visitingPlant.potSize}</span>}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="ctitle">React</div>
              <div className="rx-row">
                {REACTION_EMOJIS.map(e => (
                  <button key={e} className={`rx-btn ${myRx===e?"mine":""}`} onClick={() => toggleReaction(visitingPlant.id, e)}>
                    {e}{(plantRxCounts[e]??0)>0 && <span className="rx-count">{plantRxCounts[e]}</span>}
                  </button>
                ))}
              </div>
            </div>

            {visitLoading ? (
              <div className="loading"><div className="spinner"/><span>Loading journal…</span></div>
            ) : (
              <>
                <div className="card">
                  <div className="ctitle">📋 Growth log ({visitGrowth.length})</div>
                  {visitGrowth.length===0
                    ? <div style={{fontSize:13,color:"var(--muted)"}}>No entries yet.</div>
                    : visitGrowth.map(e => (
                      <div className="entry" key={e.id}>
                        <div className="eemo">{e.emoji}</div>
                        <div>
                          <div className="edate">{fmt(e.date)}</div>
                          <div className="enote">{e.note}</div>
                          {e.height && <div className="eht">📏 {e.height}</div>}
                        </div>
                      </div>
                    ))
                  }
                </div>

                <div className="card">
                  <div className="ctitle">⭐ Milestones ({visitMs.length})</div>
                  {visitMs.length===0
                    ? <div style={{fontSize:13,color:"var(--muted)"}}>No milestones yet.</div>
                    : visitMs.map(m => {
                      const cat = CAT(m.category);
                      return (
                        <div className="ms" key={m.id}>
                          <div style={{display:"flex",gap:8}}>
                            <div className="mscat" style={{background:cat.color+"22"}}>{cat.emoji}</div>
                            <div style={{flex:1}}>
                              <div className={`mstitle ${m.achieved?"done":""}`}>{m.title}</div>
                              {m.description && <div className="msdesc">{m.description}</div>}
                              <div className="msmeta">
                                <span className="msdate">🗓 {fmt(m.date)}</span>
                                <span className={`mspri ${m.priority}`}>{m.priority}</span>
                              </div>
                            </div>
                          </div>
                          {m.achieved && <div className="msach">✅ Achieved {m.achievedDate?fmt(m.achievedDate):""}</div>}
                        </div>
                      );
                    })
                  }
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISIT A GARDEN (read-only overview)
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="visitGarden" && visitingGarden) {
    const isFollowing = myFollows.has(visitingGarden.userId);
    const initials = visitingGarden.displayName.slice(0,2).toUpperCase();
    return (
      <>
        <style>{css}</style>
        <div className="app">
          <div className="header">
            <button className="hback" onClick={() => { setView("garden"); setTopTab("explore"); }}>←</button>
            <div>
              <div className="htitle">{visitingGarden.displayName}&rsquo;s Garden</div>
              <div className="hsub">{visitingGarden.plants.length} plant{visitingGarden.plants.length!==1?"s":""} · {visitingGarden.followerCount} follower{visitingGarden.followerCount!==1?"s":""}</div>
            </div>
            <div className="hright">
              <button className={`follow-btn ${isFollowing?"on":""}`} onClick={() => toggleFollow(visitingGarden.userId)}>
                {isFollowing?"✓ Following":"+ Follow"}
              </button>
            </div>
          </div>
          <div className="content">
            <div className="visit-banner">👁 Visiting {visitingGarden.displayName}&rsquo;s garden — tap any plant to explore it</div>
            <div className="ggrid">
              {visitingGarden.plants.map(p => {
                const totalRx = Object.values(rxCounts[p.id]??{}).reduce((a,b)=>a+b,0);
                return (
                  <div key={p.id} className="pcard" style={{"--acc":p.color} as React.CSSProperties} onClick={() => openVisitPlant(p, visitingGarden)}>
                    <PlantCartoon type={p.type} size={60}/>
                    <div className="pcname">{p.name}</div>
                    <div className="pcspp">{p.species||p.type}</div>
                    {totalRx>0 && (
                      <div style={{fontSize:10,color:"var(--muted)"}}>
                        {Object.entries(rxCounts[p.id]??{}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([e])=>e).join("")} {totalRx}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {visitingGarden.plants.length===0 && (
              <div style={{fontSize:13,color:"var(--muted)",textAlign:"center",padding:"40px 0"}}>This garden is empty so far.</div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GARDEN + EXPLORE (top-level tabs)
  // ══════════════════════════════════════════════════════════════════════════
  if (view==="garden") {
    const needWater = plants.filter(p => daysSince(p.lastWatered)>=p.waterFrequency).length;
    const msDue     = milestones.filter(m => !m.achieved && m.date<=todayStr()).length;
    const initials  = user.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);

    return (
      <>
        <style>{css}</style>
        <div className="app">
          <div className="header">
            <div style={{flex:1}}>
              <div className="htitle">🌿 Plant Journal</div>
              <div className="hsub">
                {topTab==="myGarden"
                  ? (plants.length>0 ? `${plants.length} plant${plants.length!==1?"s":""}` : `Welcome, ${user.name.split(" ")[0]}!`)
                  : "Explore the community"}
              </div>
            </div>
            <div className="hright">
              <button className="havatar" onClick={() => setShowUserMenu(v=>!v)}>{initials}</button>
            </div>
          </div>

          {showUserMenu && (
            <div className="user-bar">
              <div>
                <div style={{fontSize:13,fontWeight:500}}>{user.name}</div>
                <div style={{fontSize:11,color:"var(--muted)"}}>{user.email}</div>
              </div>
              <button className="btn btn-danger btn-sm" style={{border:"none"}} onClick={handleLogout}>Sign out</button>
            </div>
          )}

          {/* Top tabs */}
          <div className="gnav">
            <button className={`gnbtn ${topTab==="myGarden"?"active":""}`} onClick={() => setTopTab("myGarden")}>
              <span className="nicon">🪴</span>My Garden
            </button>
            <button className={`gnbtn ${topTab==="explore"?"active":""}`} onClick={() => setTopTab("explore")}>
              <span className="nicon">🌍</span>Explore
            </button>
          </div>

          {/* ── MY GARDEN ── */}
          {topTab==="myGarden" && (
            plants.length===0 ? (
              <div className="empty">
                <div className="empty-icon">🌱</div>
                <div className="empty-title">Your garden is empty</div>
                <div className="empty-sub">Add your first plant to start tracking its growth, watering schedule, and milestones.</div>
                <button className="btn btn-sage" style={{marginTop:8}} onClick={() => setAddingPlant(true)}>+ Add your first plant</button>
              </div>
            ) : (
              <div className="garden-wrap">
                <div className="garden-inner">
                  {(needWater>0||msDue>0) && (
                    <div style={{marginBottom:14}}>
                      <div className="alert">
                        {needWater>0 && `💧 ${needWater} plant${needWater>1?"s":""} need${needWater===1?"s":""} watering  `}
                        {msDue>0 && `⭐ ${msDue} milestone${msDue>1?"s":""} overdue`}
                      </div>
                    </div>
                  )}
                  <div className="ggrid">
                    {plants.map(p => {
                      const needs = daysSince(p.lastWatered)>=p.waterFrequency;
                      const pMs = milestones.filter(m => m.plantId===p.id);
                      return (
                        <div key={p.id} className="pcard" style={{"--acc":p.color} as React.CSSProperties} onClick={() => openPlant(p.id)}>
                          <PlantCartoon type={p.type} size={60}/>
                          <div className="pcname">{p.name}</div>
                          <div className="pcspp">{p.species||p.type}</div>
                          <div className={`pcpill ${needs?"needs":"ok"}`}>{needs?"💧 Water now":"✅ Watered"}</div>
                          <div style={{fontSize:10,color:"var(--muted)"}}>{pMs.filter(m=>m.achieved).length}/{pMs.length} milestones</div>
                        </div>
                      );
                    })}
                    <div className="addcard" onClick={() => setAddingPlant(true)}>
                      <div style={{fontSize:34}}>🌱</div>
                      <div style={{fontSize:13,color:"var(--muted)",fontWeight:500}}>Add a plant</div>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* ── EXPLORE ── */}
          {topTab==="explore" && (
            <div className="content">
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input className="search-input" placeholder="Search gardeners or plant types…"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
              </div>

              {exploreLoading ? (
                <div className="loading"><div className="spinner"/><span>Finding gardens…</span></div>
              ) : filteredGardens.length===0 ? (
                <div style={{textAlign:"center",padding:"48px 20px"}}>
                  <div style={{fontSize:40,marginBottom:12}}>🌍</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"var(--sage-dark)",marginBottom:8}}>
                    {publicGardens.length===0 ? "No other gardens yet" : "No results found"}
                  </div>
                  <div style={{fontSize:13,color:"var(--muted)"}}>
                    {publicGardens.length===0 ? "Be the first to add plants and inspire others!" : "Try a different search."}
                  </div>
                </div>
              ) : (
                <div className="explore-grid">
                  {filteredGardens.map(garden => {
                    const isFollowing = myFollows.has(garden.userId);
                    const initials = garden.displayName.slice(0,2).toUpperCase();
                    return (
                      <div key={garden.userId} className="gcard">
                        {/* Header */}
                        <div className="gcard-header">
                          <div className="gcard-avatar">{initials}</div>
                          <div style={{flex:1}}>
                            <div className="gcard-name">{garden.displayName}</div>
                            <div className="gcard-meta">{garden.plants.length} plant{garden.plants.length!==1?"s":""} · {garden.followerCount} follower{garden.followerCount!==1?"s":""}</div>
                          </div>
                          <button className={`follow-btn ${isFollowing?"on":""}`} onClick={() => toggleFollow(garden.userId)}>
                            {isFollowing?"✓":"+ Follow"}
                          </button>
                        </div>

                        {/* Plant thumbnails */}
                        {garden.plants.length>0 && (
                          <div className="gcard-thumbs">
                            {garden.plants.slice(0,4).map(p => (
                              <div key={p.id} className="pthumb" onClick={() => openVisitPlant(p, garden)}>
                                <PlantCartoon type={p.type} size={38}/>
                                <div className="pthumb-name">{p.name}</div>
                              </div>
                            ))}
                            {garden.plants.length>4 && (
                              <div className="pthumb" onClick={() => openVisitGarden(garden)}>
                                <div style={{fontSize:20,lineHeight:1,marginTop:8}}>+{garden.plants.length-4}</div>
                                <div className="pthumb-name">more</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Reactions for the first plant */}
                        {garden.plants[0] && (() => {
                          const p = garden.plants[0];
                          const counts = rxCounts[p.id] ?? {};
                          const myRx = myReactions[p.id];
                          return (
                            <div>
                              <div style={{fontSize:11,color:"var(--muted)",marginBottom:6}}>React to {p.name}</div>
                              <div className="rx-row">
                                {REACTION_EMOJIS.map(e => (
                                  <button key={e} className={`rx-btn ${myRx===e?"mine":""}`} onClick={() => toggleReaction(p.id, e)}>
                                    {e}{(counts[e]??0)>0 && <span className="rx-count">{counts[e]}</span>}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        <button className="btn btn-outline btn-sm" onClick={() => openVisitGarden(garden)}>
                          Visit garden →
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {addingPlant && <AddPlantModal/>}
          {toast && <div className={`toast ${toast.err?"err":""}`}>{toast.msg}</div>}
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // OWN PLANT VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (!activePlant) return null;
  const needs    = daysSince(activePlant.lastWatered) >= activePlant.waterFrequency;
  const daysAgo  = daysSince(activePlant.lastWatered);
  const daysLeft = activePlant.waterFrequency - daysAgo;
  const highPri  = plantMilestones.filter(m => !m.achieved && m.priority==="high");

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header" style={{background:activePlant.color}}>
          <button className="hback" onClick={() => setView("garden")}>←</button>
          <div>
            <div className="htitle">{activePlant.name}</div>
            <div className="hsub">{activePlant.species||activePlant.type}</div>
          </div>
        </div>

        <nav className="nav">
          {(["home","growth","milestones","profile"] as const).map(t => (
            <button key={t} className={`nbtn ${tab===t?"active":""}`} onClick={() => setTab(t)}>
              <span className="nicon">{t==="home"?"🏠":t==="growth"?"📈":t==="milestones"?"⭐":"🪴"}</span>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </nav>

        {/* HOME */}
        {tab==="home" && (
          <div className="content">
            <div className="hero">
              <PlantCartoon type={activePlant.type} size={78}/>
              <div>
                <div className="hname">{activePlant.name}</div>
                <div className="hspp">{activePlant.species}</div>
                <div className="badges">
                  {activePlant.type    && <span className="badge">🪴 {activePlant.type}</span>}
                  {activePlant.sunlight && <span className="badge">☀️ {activePlant.sunlight}</span>}
                  {activePlant.potSize  && <span className="badge">📦 {activePlant.potSize}</span>}
                </div>
              </div>
            </div>

            <div className={`wbanner ${needs?"needs":"ok"}`}>
              <div className="wicon">{needs?"💧":"✅"}</div>
              <div style={{flex:1}}>
                <div className="wtitle">{needs?"Time to water!":"All good!"}</div>
                <div className="wsub">{needs?`Last watered ${daysAgo} day${daysAgo!==1?"s":""} ago`:`Next watering in ${daysLeft} day${daysLeft!==1?"s":""}`}</div>
                <div className="wamt">{activePlant.waterAmount||"—"}</div>
                <button className={`btn ${needs?"btn-water":"btn-outline btn-sm"}`} onClick={logWater}>
                  💧 {needs?"Log watering":"Watered early"}
                </button>
              </div>
            </div>

            <div className="stats">
              <div className="stat"><div className="snum">{plantGrowth.length}</div><div className="slbl">Log entries</div></div>
              <div className="stat"><div className="snum">{plantMilestones.filter(m=>m.achieved).length}/{plantMilestones.length}</div><div className="slbl">Milestones</div></div>
              <div className="stat"><div className="snum">{daysSince(activePlant.adopted)}</div><div className="slbl">Days together</div></div>
            </div>

            {plantGrowth[0] && (
              <div className="card">
                <div className="ctitle">🌱 Latest entry</div>
                <div className="entry" style={{borderBottom:"none",paddingTop:0}}>
                  <div className="eemo">{plantGrowth[0].emoji}</div>
                  <div>
                    <div className="edate">{fmt(plantGrowth[0].date)}</div>
                    <div className="enote">{plantGrowth[0].note}</div>
                    {plantGrowth[0].height && <div className="eht">📏 {plantGrowth[0].height}</div>}
                  </div>
                </div>
              </div>
            )}

            {highPri.length>0 && (
              <div className="card">
                <div className="ctitle">🔴 Needs attention</div>
                {highPri.map(m => {
                  const cat = CAT(m.category);
                  return (
                    <div key={m.id} style={{display:"flex",gap:8,alignItems:"center",padding:"6px 0",borderBottom:"1px solid #f0ece4"}}>
                      <div className="mscat" style={{background:cat.color+"22"}}>{cat.emoji}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500}}>{m.title}</div>
                        <div style={{fontSize:10,color:"var(--muted)"}}>🗓 {fmt(m.date)}</div>
                      </div>
                      <button className="btn btn-gold btn-sm" onClick={() => {setAchievingId(m.id);setAchieveNote("");}}>Done ✓</button>
                    </div>
                  );
                })}
              </div>
            )}

            {plantGrowth.length===0 && plantMilestones.length===0 && (
              <div className="card" style={{textAlign:"center",padding:"28px 18px"}}>
                <div style={{fontSize:36,marginBottom:8}}>✍️</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"var(--sage-dark)",marginBottom:6}}>Start your journal</div>
                <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.55}}>Add a growth entry or milestone to begin tracking {activePlant.name}&rsquo;s journey.</div>
              </div>
            )}
          </div>
        )}

        {/* GROWTH */}
        {tab==="growth" && (
          <div className="content">
            <div className="card">
              <div className="ctitle">✏️ New entry</div>
              <div className="ig">
                <div className="il">Mood</div>
                <div className="epick">
                  {["🌱","🌿","🍃","🌾","🌸","🪴","🌳","💪","🌵","🍄","🔆","🌊"].map(e => (
                    <button key={e} className={`ep ${newEntry.emoji===e?"sel":""}`} onClick={() => setNewEntry({...newEntry,emoji:e})}>{e}</button>
                  ))}
                </div>
              </div>
              <div className="ig">
                <div className="il">Height (optional)</div>
                <input className="input" placeholder="e.g. 12 cm" value={newEntry.height} onChange={e => setNewEntry({...newEntry,height:e.target.value})}/>
              </div>
              <div className="ig">
                <div className="il">Note</div>
                <textarea className="input textarea" placeholder="What's happening today?" value={newEntry.note} onChange={e => setNewEntry({...newEntry,note:e.target.value})}/>
              </div>
              <button className="btn btn-sage" onClick={addGrowthEntry}>+ Add entry</button>
            </div>
            <div className="card">
              <div className="ctitle">📋 Growth log ({plantGrowth.length})</div>
              {plantGrowth.length===0
                ? <div style={{fontSize:13,color:"var(--muted)"}}>No entries yet — add your first one above!</div>
                : plantGrowth.map(e => (
                  <div className="entry" key={e.id}>
                    <div className="eemo">{e.emoji}</div>
                    <div>
                      <div className="edate">{fmt(e.date)}</div>
                      <div className="enote">{e.note}</div>
                      {e.height && <div className="eht">📏 {e.height}</div>}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* MILESTONES */}
        {tab==="milestones" && (
          <div className="content">
            <div className="card">
              <div className="ctitle">➕ New milestone</div>
              <div className="ig">
                <div className="il">Title</div>
                <input className="input" placeholder="e.g. First harvest 🌾" value={newMs.title} onChange={e => setNewMs({...newMs,title:e.target.value})}/>
              </div>
              <div className="ig">
                <div className="il">Description (optional)</div>
                <input className="input" placeholder="What does achieving this look like?" value={newMs.description} onChange={e => setNewMs({...newMs,description:e.target.value})}/>
              </div>
              <div className="irow">
                <div className="ig" style={{flex:1}}>
                  <div className="il">Category</div>
                  <select className="input" value={newMs.category} onChange={e => setNewMs({...newMs,category:e.target.value as MilestoneCategory})}>
                    {MILESTONE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                  </select>
                </div>
                <div className="ig" style={{flex:1}}>
                  <div className="il">Priority</div>
                  <select className="input" value={newMs.priority} onChange={e => setNewMs({...newMs,priority:e.target.value as "low"|"medium"|"high"})}>
                    <option value="high">🔴 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </div>
              </div>
              <div className="ig">
                <div className="il">Target date</div>
                <input className="input" type="date" value={newMs.date} onChange={e => setNewMs({...newMs,date:e.target.value})}/>
              </div>
              <button className="btn btn-sage" onClick={addMilestone}>+ Add milestone</button>
            </div>

            <div className="card">
              <div className="ctitle">⭐ Milestones ({plantMilestones.length})</div>
              <div className="ftabs">
                {([
                  {value:"all",label:"All pending"},
                  {value:"done",label:"✓ Done"},
                  ...MILESTONE_CATEGORIES.map(c => ({value:c.value,label:`${c.emoji} ${c.label}`}))
                ] as {value:string;label:string}[]).map(f => (
                  <button key={f.value} className={`ftab ${msFilter===f.value?"active":""}`} onClick={() => setMsFilter(f.value as MilestoneCategory|"all"|"done")}>{f.label}</button>
                ))}
              </div>
              {filteredMs.length===0 ? (
                <div style={{fontSize:13,color:"var(--muted)"}}>
                  {msFilter==="done" ? "No milestones achieved yet — keep going!"
                    : plantMilestones.length===0 ? "No milestones yet. Add one above!"
                    : "No milestones in this category."}
                </div>
              ) : filteredMs.map(m => {
                const cat = CAT(m.category);
                return (
                  <div className="ms" key={m.id}>
                    <div style={{display:"flex",gap:8}}>
                      <div className="mscat" style={{background:cat.color+"22"}}>{cat.emoji}</div>
                      <div style={{flex:1}}>
                        <div className={`mstitle ${m.achieved?"done":""}`}>{m.title}</div>
                        {m.description && <div className="msdesc">{m.description}</div>}
                        <div className="msmeta">
                          <span className="msdate">🗓 {fmt(m.date)}</span>
                          <span className={`mspri ${m.priority}`}>{m.priority}</span>
                        </div>
                      </div>
                    </div>
                    {m.achieved && (
                      <div className="msach">
                        ✅ Achieved {m.achievedDate?fmt(m.achievedDate):""}
                        {m.achievedNote && <div style={{marginTop:3,fontStyle:"italic"}}>&ldquo;{m.achievedNote}&rdquo;</div>}
                      </div>
                    )}
                    <div style={{display:"flex",gap:6,marginTop:7}}>
                      {!m.achieved
                        ? <button className="btn btn-gold btn-sm" onClick={() => {setAchievingId(m.id);setAchieveNote("");}}>Mark achieved ✓</button>
                        : <button className="btn btn-outline btn-sm" onClick={() => unachieve(m.id)}>Undo</button>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PROFILE */}
        {tab==="profile" && (
          <div className="content">
            <div className="hero" style={{flexDirection:"column",alignItems:"center",gap:10}}>
              <PlantCartoon type={editingProfile&&draftProfile?draftProfile.type:activePlant.type} size={78}/>
              <div style={{textAlign:"center"}}>
                <div className="hname">{editingProfile&&draftProfile?draftProfile.name:activePlant.name}</div>
                <div className="hspp">{editingProfile&&draftProfile?draftProfile.species:activePlant.species}</div>
              </div>
            </div>

            {!editingProfile ? (
              <div className="card">
                <div className="ctitle">🌱 Profile</div>
                {[
                  ["Species",activePlant.species], ["Type",activePlant.type],
                  ["Pot size",activePlant.potSize], ["Adopted",fmt(activePlant.adopted)],
                  ["Water amount",activePlant.waterAmount],
                  ["Water every",`${activePlant.waterFrequency} days`],
                  ["Sunlight",activePlant.sunlight],
                ].map(([k,v]) => (
                  <div className="pr" key={k}>
                    <span style={{fontSize:11,color:"var(--muted)"}}>{k}</span>
                    <span style={{fontWeight:500,textAlign:"right",fontSize:13}}>{v||"—"}</span>
                  </div>
                ))}
                {activePlant.notes && (
                  <div style={{marginTop:10,padding:"9px 12px",background:"var(--warm)",borderRadius:10,fontSize:12,color:"var(--muted)",fontStyle:"italic"}}>
                    &ldquo;{activePlant.notes}&rdquo;
                  </div>
                )}
                <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
                  <button className="btn btn-outline btn-sm" onClick={() => {setDraftProfile({...activePlant});setEditingProfile(true);}}>✏️ Edit profile</button>
                  <button className="btn btn-danger btn-sm" style={{border:"none"}}
                    onClick={() => {if(window.confirm(`Remove ${activePlant.name} from your garden?`)) deletePlant(activePlant.id);}}>
                    🗑 Remove plant
                  </button>
                </div>
              </div>
            ) : draftProfile && (
              <div className="card">
                <div className="ctitle">✏️ Edit profile</div>
                {([
                  ["Plant nickname","name","text","e.g. Basil"],
                  ["Species","species","text","e.g. Ocimum basilicum"],
                  ["Type","type","text","e.g. Herb, Cactus, Fern, Flower…"],
                  ["Pot size","potSize","text","e.g. 6 inch"],
                  ["Water amount","waterAmount","text","e.g. 200ml"],
                  ["Sunlight","sunlight","text","e.g. Full sun"],
                ] as const).map(([label,key,type,ph]) => (
                  <div className="ig" key={key}>
                    <div className="il">{label}</div>
                    <input className="input" type={type} placeholder={ph}
                      value={String(draftProfile[key as keyof PlantProfile])}
                      onChange={e => setDraftProfile({...draftProfile,[key]:e.target.value})}/>
                  </div>
                ))}
                <div className="irow">
                  <div className="ig" style={{flex:1}}>
                    <div className="il">Date adopted</div>
                    <input className="input" type="date" value={draftProfile.adopted}
                      onChange={e => setDraftProfile({...draftProfile,adopted:e.target.value})}/>
                  </div>
                  <div className="ig" style={{flex:1}}>
                    <div className="il">Water every (days)</div>
                    <input className="input" type="number" min={1} value={draftProfile.waterFrequency}
                      onChange={e => setDraftProfile({...draftProfile,waterFrequency:parseInt(e.target.value)||1})}/>
                  </div>
                </div>
                <div className="ig">
                  <div className="il">Notes</div>
                  <textarea className="input textarea" value={draftProfile.notes} onChange={e => setDraftProfile({...draftProfile,notes:e.target.value})}/>
                </div>
                <div className="ig">
                  <div className="il">Card colour</div>
                  <div className="swatches">{PLANT_COLORS.map(c => (
                    <div key={c} className={`swatch ${draftProfile.color===c?"sel":""}`}
                      style={{background:c}} onClick={() => setDraftProfile({...draftProfile,color:c})}/>
                  ))}</div>
                </div>
                <div style={{display:"flex",gap:10,marginTop:8}}>
                  <button className="btn btn-sage" onClick={saveProfile}>Save</button>
                  <button className="btn btn-outline" onClick={() => setEditingProfile(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Achieve modal */}
        {achievingId && (
          <div className="overlay">
            <div className="modal">
              <div className="mtitle">🎉 Mark as achieved!</div>
              <div style={{fontSize:13,color:"var(--muted)",marginBottom:14}}>Add a note about how it went (optional).</div>
              <div className="ig">
                <div className="il">Achievement note</div>
                <textarea className="input textarea" placeholder="e.g. Harvested 15 leaves today!" value={achieveNote} onChange={e => setAchieveNote(e.target.value)}/>
              </div>
              <div style={{display:"flex",gap:10,marginTop:8}}>
                <button className="btn btn-sage" onClick={confirmAchieve}>Confirm ✓</button>
                <button className="btn btn-outline" onClick={() => setAchievingId(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {addingPlant && <AddPlantModal/>}
        {toast && <div className={`toast ${toast.err?"err":""}`}>{toast.msg}</div>}
      </div>
    </>
  );
}