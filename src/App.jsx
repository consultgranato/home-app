import React, { useState, useEffect, useRef } from "react";
import {
  Home, Calendar as CalIcon, UtensilsCrossed, ShoppingCart, CheckSquare,
  StickyNote, Sparkles, Settings, Plus, X, ChevronLeft, ChevronRight, ChevronDown,
  Trash2, Check, Clock, ArrowRight, Plane, MapPin, RotateCcw, Lightbulb, Globe,
  Star, Info, Pencil, Paperclip, Gift, LogOut
} from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { useHousehold } from "./hooks/useHousehold";
import { useAppData } from "./hooks/useAppData";

// ---------- helpers ----------
const WEEKDAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const WD_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const GROCERY_CATS = ["Produce","Dairy","Meat & Seafood","Bakery","Pantry","Frozen","Beverages","Household","Other"];

const uid = () => Math.random().toString(36).slice(2, 10);
const MSDAY = 86400000;
const todayISO = () => toISO(new Date());
function toISO(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function parseISO(s){ const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function weekdayIndexMon(date){ return (date.getDay()+6)%7; }
function prettyDate(d){ return `${WEEKDAYS[weekdayIndexMon(d)]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`; }
function shortRange(s,e){
  const a=parseISO(s); const b=e?parseISO(e):a;
  const sameMonth=a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear();
  if(sameMonth) return `${MONTHS[a.getMonth()].slice(0,3)} ${a.getDate()}–${b.getDate()}`;
  return `${MONTHS[a.getMonth()].slice(0,3)} ${a.getDate()} – ${MONTHS[b.getMonth()].slice(0,3)} ${b.getDate()}`;
}

// ---------- colors ----------
const PALETTE = {
  indigo:{dot:"bg-indigo-400",chip:"bg-indigo-500/20 text-indigo-300",text:"text-indigo-400"},
  rose:{dot:"bg-rose-400",chip:"bg-rose-500/20 text-rose-300",text:"text-rose-400"},
  sky:{dot:"bg-sky-400",chip:"bg-sky-500/20 text-sky-300",text:"text-sky-400"},
  emerald:{dot:"bg-emerald-400",chip:"bg-emerald-500/20 text-emerald-300",text:"text-emerald-400"},
  amber:{dot:"bg-amber-400",chip:"bg-amber-500/20 text-amber-300",text:"text-amber-400"},
  violet:{dot:"bg-violet-400",chip:"bg-violet-500/20 text-violet-300",text:"text-violet-400"},
  teal:{dot:"bg-teal-400",chip:"bg-teal-500/20 text-teal-300",text:"text-teal-400"},
  cyan:{dot:"bg-cyan-400",chip:"bg-cyan-500/20 text-cyan-300",text:"text-cyan-400"},
  fuchsia:{dot:"bg-fuchsia-400",chip:"bg-fuchsia-500/20 text-fuchsia-300",text:"text-fuchsia-400"},
  lime:{dot:"bg-lime-400",chip:"bg-lime-500/20 text-lime-300",text:"text-lime-400"},
};
function colorsFromSettings(s){
  return {
    p1: PALETTE[s.color1]||PALETTE.indigo,
    p2: PALETTE[s.color2]||PALETTE.rose,
    both: PALETTE[s.colorBoth]||PALETTE.emerald,
  };
}

// ---------- file handling (client-side compress) ----------
function readAndCompress(file, maxDim=1000, quality=0.7){
  return new Promise((resolve,reject)=>{
    if(!file.type.startsWith("image/")){
      const r=new FileReader();
      r.onload=()=>resolve({blob: r.result, name:file.name, type:file.type});
      r.onerror=()=>reject(new Error("Couldn't read that file"));
      r.readAsArrayBuffer(file); return;
    }
    const r=new FileReader();
    r.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        let {width,height}=img;
        if(width>maxDim||height>maxDim){ const sc=maxDim/Math.max(width,height); width=Math.round(width*sc); height=Math.round(height*sc); }
        const canvas=document.createElement("canvas"); canvas.width=width; canvas.height=height;
        canvas.getContext("2d").drawImage(img,0,0,width,height);
        canvas.toBlob((blob)=>{ resolve({blob, name:file.name, type:"image/jpeg"}); }, "image/jpeg", quality);
      };
      img.onerror=()=>reject(new Error("Couldn't load that image"));
      img.src=r.result;
    };
    r.onerror=()=>reject(new Error("Couldn't read that image"));
    r.readAsDataURL(file);
  });
}

// ---------- key dates ----------
function nextKeyDate(md){
  const [m,day]=md.split("-").map(Number);
  const today=new Date(); today.setHours(0,0,0,0);
  let next=new Date(today.getFullYear(),m-1,day);
  if(next<today) next=new Date(today.getFullYear()+1,m-1,day);
  return { next, days: Math.round((next-today)/MSDAY) };
}
function keyDateLabel(days){ return days===0?"Today":days===1?"Tomorrow":`In ${days} days`; }

// ========== AUTH SCREEN ==========
function AuthScreen({ signIn, signUp }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const switchMode = (m) => { setMode(m); setErr(""); setOk(""); };

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true); setErr(""); setOk("");
    if (mode === "signup") {
      const { data, error } = await signUp(email.trim(), password);
      if (error) { setErr(error.message); }
      else if (!data.session) { setOk("Account created — check your email to confirm, then sign in."); }
    } else {
      const { error } = await signIn(email.trim(), password);
      if (error) { setErr(error.message); }
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <GlobalStyle/>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-zinc-900">
            <Home size={22}/>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Our Life</h1>
            <p className="text-sm text-zinc-500">Your shared home app</p>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-4">
          <p className="text-sm text-zinc-300 font-medium">
            {mode === "signin" ? "Sign in" : "Create account"}
          </p>
          <input
            type="email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            placeholder="your@email.com"
            className="input"
            autoFocus
          />
          <input
            type="password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            placeholder="Password"
            className="input"
          />
          {err && <p className="text-xs text-rose-400">{err}</p>}
          {ok  && <p className="text-xs text-emerald-400">{ok}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="w-full bg-amber-400 text-zinc-900 rounded-xl py-2.5 font-medium hover:bg-amber-300 disabled:opacity-50"
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <p className="text-xs text-center text-zinc-500">
            {mode === "signin"
              ? <>No account? <button onClick={()=>switchMode("signup")} className="text-zinc-300 hover:text-white">Create one</button></>
              : <>Already have one? <button onClick={()=>switchMode("signin")} className="text-zinc-300 hover:text-white">Sign in</button></>}
          </p>
        </div>
      </div>
    </div>
  );
}

// ========== HOUSEHOLD SETUP SCREEN ==========
function HouseholdSetup({ createHousehold, joinHousehold, error }) {
  const [mode, setMode] = useState(null); // "create" | "join"
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    await createHousehold();
    setBusy(false);
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setBusy(true);
    await joinHousehold(code);
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <GlobalStyle/>
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-zinc-900">
            <Home size={22}/>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Welcome</h1>
            <p className="text-sm text-zinc-500">Set up your household</p>
          </div>
        </div>

        {!mode && (
          <div className="space-y-3">
            <button
              onClick={()=>setMode("create")}
              className="w-full bg-amber-400 text-zinc-900 rounded-2xl p-4 text-left font-medium hover:bg-amber-300"
            >
              <p className="font-semibold">Create a new household</p>
              <p className="text-xs font-normal mt-0.5 text-zinc-700">You'll get an invite code to share with your partner</p>
            </button>
            <button
              onClick={()=>setMode("join")}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-left hover:border-zinc-600"
            >
              <p className="font-semibold text-zinc-100">Join an existing household</p>
              <p className="text-xs text-zinc-400 mt-0.5">Enter the invite code your partner shared</p>
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-4">
            <p className="text-sm text-zinc-300">This creates your household. After signing in, go to Settings to get your invite code and share it with your partner.</p>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={busy} className="flex-1 bg-amber-400 text-zinc-900 rounded-xl py-2.5 font-medium hover:bg-amber-300 disabled:opacity-50">{busy?"Creating…":"Create household"}</button>
              <button onClick={()=>setMode(null)} className="text-zinc-400 px-3">Back</button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-3">
            <p className="text-sm text-zinc-300">Enter the household invite code your partner shared with you.</p>
            <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Paste invite code…" className="input"/>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleJoin} disabled={busy||!code.trim()} className="flex-1 bg-amber-400 text-zinc-900 rounded-xl py-2.5 font-medium hover:bg-amber-300 disabled:opacity-50">{busy?"Joining…":"Join household"}</button>
              <button onClick={()=>setMode(null)} className="text-zinc-400 px-3">Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========== MAIN APP ==========
export default function App() {
  const { session, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const { householdId, slot, loading: hhLoading, error: hhError, createHousehold, joinHousehold } = useHousehold(session?.user?.id);
  const data = useAppData(householdId);

  const [tab, setTab] = useState("home");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    try { window.scrollTo({top:0,behavior:"instant"}); } catch { window.scrollTo(0,0); }
    if (document.documentElement) document.documentElement.scrollTop = 0;
  }, [tab]);

  if (authLoading || hhLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <GlobalStyle/>
        <div className="text-zinc-600 text-sm animate-pulse">Loading your home…</div>
      </div>
    );
  }

  if (!session) return <AuthScreen signIn={signIn} signUp={signUp}/>;
  if (!householdId) return <HouseholdSetup createHousehold={createHousehold} joinHousehold={joinHousehold} error={hhError}/>;

  if (data.dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <GlobalStyle/>
        <div className="text-zinc-600 text-sm animate-pulse">Loading your home…</div>
      </div>
    );
  }

  const { events, dinners, grocery, todos, notes, chores, trips, ideas, visited, meals, important, importantFiles, dates, settings,
    upEvents, upDinners, upGrocery, upTodos, upNotes, upChores, upTrips, upIdeas, upVisited, upMeals,
    upImportant, upImportantFiles, upDates, upSettings, addAttachment, removeAttachment } = data;

  const nameOf = who => who==="p1"?settings.name1 : who==="p2"?settings.name2 : "Both";
  const colors = colorsFromSettings(settings);

  const TABS = [
    { id:"home",    label:"Home",    icon:Home },
    { id:"cal",     label:"Calendar",icon:CalIcon },
    { id:"kitchen", label:"Kitchen", icon:UtensilsCrossed },
    { id:"tasks",   label:"Tasks",   icon:CheckSquare },
    { id:"travel",  label:"Travel",  icon:Plane },
    { id:"notes",   label:"Notes",   icon:StickyNote },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24 md:pb-6">
      <GlobalStyle/>
      <header className="bg-zinc-900/80 backdrop-blur border-b border-zinc-800 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-zinc-900">
              <Home size={18}/>
            </div>
            <div>
              <h1 className="font-semibold leading-tight text-zinc-100">{settings.home}</h1>
              <p className="text-xs text-zinc-500 leading-tight">{settings.name1} & {settings.name2}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={()=>setShowSettings(true)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><Settings size={18}/></button>
            <button onClick={signOut} title="Sign out" className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400"><LogOut size={16}/></button>
          </div>
        </div>
        <nav className="hidden md:flex max-w-4xl mx-auto px-2 gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg border-b-2 transition ${tab===t.id?"border-amber-400 text-amber-300 font-medium":"border-transparent text-zinc-500 hover:text-zinc-200"}`}>
              <t.icon size={16}/>{t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5">
        {tab==="home"    && <Dashboard {...{events,dinners,grocery,todos,chores,trips,dates,settings,colors,setTab}}/>}
        {tab==="cal"     && <CalendarView {...{events,upEvents,dates,upDates,settings,colors}}/>}
        {tab==="kitchen" && <KitchenView {...{dinners,upDinners,grocery,upGrocery,meals,upMeals}}/>}
        {tab==="tasks"   && <TasksView {...{todos,upTodos,chores,upChores,settings,colors,nameOf}}/>}
        {tab==="travel"  && <TravelView {...{trips,upTrips,ideas,upIdeas,visited,upVisited}}/>}
        {tab==="notes"   && <NotesView {...{notes,upNotes,important,upImportant,importantFiles,upImportantFiles,householdId,addAttachment,removeAttachment}}/>}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 z-20">
        <div className="flex justify-between px-1">
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2 px-2 flex-1 text-[10px] ${tab===t.id?"text-amber-300":"text-zinc-500"}`}>
              <t.icon size={20}/>{t.label}
            </button>
          ))}
        </div>
      </nav>

      {showSettings && <SettingsModal {...{settings,upSettings,householdId,close:()=>setShowSettings(false)}}/>}
    </div>
  );
}

function GlobalStyle(){
  return <style>{`
    :root{ color-scheme: dark; }
    .input{ width:100%; background:#27272a; border:1px solid #3f3f46; border-radius:0.75rem; padding:0.6rem 0.85rem; font-size:0.875rem; color:#f4f4f5; color-scheme:dark; font-family:inherit; }
    .input::placeholder{ color:#71717a; }
    .input:focus{ outline:none; border-color:#fbbf24; box-shadow:0 0 0 2px rgba(251,191,36,0.25); }
    .input option{ background:#27272a; color:#f4f4f5; }
    textarea.input{ resize:vertical; line-height:1.5; }
  `}</style>;
}

// ---------- shared components ----------
function Segmented({value,onChange,options}){
  return (
    <div className="flex bg-zinc-800 rounded-xl p-0.5 text-sm w-fit">
      {options.map(o=>(
        <button key={o.id} onClick={()=>onChange(o.id)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${value===o.id?"bg-zinc-700 text-zinc-100 font-medium":"text-zinc-400 hover:text-zinc-200"}`}>
          {o.dot && <span className={`w-2 h-2 rounded-full ${o.dot}`}/>}
          {o.icon && <o.icon size={14}/>}{o.label}
        </button>
      ))}
    </div>
  );
}
function Empty({children}){ return <p className="text-sm text-zinc-600 py-3">{children}</p>; }
function ConfirmDelete({onConfirm,title="Delete",triggerClass="text-zinc-600 hover:text-rose-400",icon:Icon=Trash2,size=16,label}){
  const [armed,setArmed]=useState(false);
  useEffect(()=>{ if(!armed)return; const t=setTimeout(()=>setArmed(false),3500); return ()=>clearTimeout(t); },[armed]);
  if(armed) return (
    <span className="flex items-center gap-1.5">
      <button onClick={()=>{ onConfirm(); setArmed(false); }} className="text-xs bg-rose-500 text-white rounded-lg px-2.5 py-1.5 font-medium">Confirm</button>
      <button onClick={()=>setArmed(false)} className="text-xs text-zinc-400 px-1.5 py-1.5">Cancel</button>
    </span>
  );
  return (
    <button onClick={()=>setArmed(true)} title={title} className={`p-2 -m-1 rounded-lg flex items-center gap-1 ${triggerClass}`}>
      <Icon size={size}/>{label && <span className="text-xs">{label}</span>}
    </button>
  );
}
function Lightbox({src,onClose}){
  if(!src) return null;
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
      <img src={src} alt="" className="max-w-full max-h-full rounded-xl"/>
    </div>
  );
}

// Storage-backed Attachments component
// items: [{id, name, mime, storage_path, url}]
function Attachments({items, onAdd, onRemove}){
  const inputRef=useRef();
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const [light,setLight]=useState(null);

  const handle=async(e)=>{
    const files=[...e.target.files]; e.target.value=""; setErr(""); setBusy(true);
    for(const file of files){
      try{
        const result = await readAndCompress(file);
        await onAdd(file, result.blob, result.type);
      } catch(ex){ setErr(ex.message||"Couldn't add that file"); }
    }
    setBusy(false);
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*,application/pdf,.txt,.doc,.docx" multiple className="hidden" onChange={handle}/>
      <button onClick={()=>inputRef.current?.click()} className="text-xs flex items-center gap-1.5 text-zinc-300 hover:text-amber-200 border border-zinc-700 rounded-lg px-2.5 py-1.5">
        <Paperclip size={13}/>{busy?"Adding…":"Attach image / file"}
      </button>
      {err && <p className="text-xs text-rose-400 mt-1.5">{err}</p>}
      {items.length>0 && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {items.map(a=> (a.mime||"").startsWith("image/")
            ? <div key={a.id} className="relative">
                <img src={a.url} onClick={()=>setLight(a.url)} alt="" className="w-16 h-16 object-cover rounded-lg cursor-pointer border border-zinc-700"/>
                <button onClick={()=>onRemove(a.id, a.storage_path)} className="absolute -top-2 -right-2 bg-zinc-900 border border-zinc-700 rounded-full p-1 text-zinc-300 hover:text-rose-400"><X size={12}/></button>
              </div>
            : <div key={a.id} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-2.5 py-2">
                <a href={a.url} download={a.name} className="text-xs text-zinc-200 underline max-w-[10rem] truncate">{a.name||"file"}</a>
                <button onClick={()=>onRemove(a.id, a.storage_path)} className="text-zinc-500 hover:text-rose-400 p-1 -m-1"><X size={12}/></button>
              </div>
          )}
        </div>
      )}
      <Lightbox src={light} onClose={()=>setLight(null)}/>
    </div>
  );
}

// ---------- key dates ----------
// (same as prototype)

// ---------- Dashboard ----------
function tripStatus(t){
  if(!t.start) return {state:"idea", label:"Dates TBD", sort:50000};
  const today=parseISO(todayISO()), start=parseISO(t.start), end=t.end?parseISO(t.end):start;
  if(today<start){ const d=Math.round((start-today)/MSDAY); return {state:"upcoming",label:d===0?"Departs today":`In ${d} day${d!==1?"s":""}`,sort:d}; }
  if(today<=end) return {state:"active",label:"In progress",sort:-1};
  return {state:"past",label:"Completed",sort:99999};
}
function Dashboard({events,dinners,grocery,todos,chores,trips,dates,settings,colors,setTab}){
  const t = todayISO();
  const now = new Date();
  const todaysEvents = events.filter(e=>e.date===t).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
  const todayDinner = dinners[WEEKDAYS[weekdayIndexMon(now)]];
  const sharedOpen = (todos.shared||[]).filter(x=>!x.done).slice(0,5);
  const groceryLeft = grocery.filter(g=>!g.checked).length;
  const choresDue = chores.filter(c=>isChoreDue(c)).length;
  const nextTrip = trips.map(tr=>({tr,st:tripStatus(tr)})).filter(x=>x.st.state==="upcoming"||x.st.state==="active").sort((a,b)=>a.st.sort-b.st.sort)[0];
  const nextDate = [...dates].map(d=>({d,...nextKeyDate(d.md)})).sort((a,b)=>a.days-b.days).filter(x=>x.days<=45)[0];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-zinc-500">{prettyDate(now)}</p>
        <h2 className="text-2xl font-semibold text-zinc-100">Good {greeting()}, {settings.name1.split(" ")[0]}</h2>
      </div>

      {nextTrip && (
        <button onClick={()=>setTab("travel")} className="w-full text-left rounded-2xl border border-zinc-800 bg-gradient-to-r from-indigo-500/15 to-rose-500/15 p-4 flex items-center gap-3 hover:border-zinc-700 transition">
          <div className="w-10 h-10 rounded-xl bg-zinc-900/60 flex items-center justify-center text-amber-300 shrink-0"><Plane size={18}/></div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-400">Next trip</p>
            <p className="font-semibold text-zinc-100 truncate">{nextTrip.tr.destination||nextTrip.tr.name} · {nextTrip.st.label}</p>
          </div>
          {nextTrip.tr.start && <span className="text-xs text-zinc-400 shrink-0">{shortRange(nextTrip.tr.start,nextTrip.tr.end)}</span>}
        </button>
      )}

      {nextDate && (
        <button onClick={()=>setTab("cal")} className="w-full text-left rounded-2xl border border-zinc-800 bg-gradient-to-r from-amber-500/15 to-emerald-500/10 p-4 flex items-center gap-3 hover:border-zinc-700 transition">
          <div className="w-10 h-10 rounded-xl bg-zinc-900/60 flex items-center justify-center text-amber-300 shrink-0"><Gift size={18}/></div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-400">Coming up</p>
            <p className="font-semibold text-zinc-100 truncate">{nextDate.d.label} · {keyDateLabel(nextDate.days)}</p>
          </div>
          <span className="text-xs text-zinc-400 shrink-0">{MONTHS[nextDate.next.getMonth()].slice(0,3)} {nextDate.next.getDate()}</span>
        </button>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard onClick={()=>setTab("cal")} label="Today" value={`${todaysEvents.length} event${todaysEvents.length!==1?"s":""}`} icon={CalIcon} tone="bg-indigo-500/20 text-indigo-300"/>
        <StatCard onClick={()=>setTab("kitchen")} label="To grab" value={`${groceryLeft} item${groceryLeft!==1?"s":""}`} icon={ShoppingCart} tone="bg-emerald-500/20 text-emerald-300"/>
        <StatCard onClick={()=>setTab("tasks")} label="To-Do" value={`${sharedOpen.length} open`} icon={CheckSquare} tone="bg-amber-500/20 text-amber-300"/>
        <StatCard onClick={()=>setTab("tasks")} label="Chores due" value={`${choresDue}`} icon={Sparkles} tone="bg-rose-500/20 text-rose-300"/>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Today's Schedule" icon={CalIcon} action={()=>setTab("cal")}>
          {todaysEvents.length===0
            ? <Empty>Nothing scheduled today.</Empty>
            : todaysEvents.map(e=>(
              <div key={e.id} className="flex items-center gap-3 py-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${colors[e.person].dot}`}/>
                <span className="text-sm text-zinc-500 w-16">{e.time||"—"}</span>
                <span className="text-sm text-zinc-200">{e.title}</span>
              </div>
            ))}
        </Card>

        <Card title="Tonight's Dinner" icon={UtensilsCrossed} action={()=>setTab("kitchen")}>
          {todayDinner?.name
            ? <div className="py-2">
                <p className="text-lg font-medium text-zinc-100">{todayDinner.name}</p>
                {todayDinner.ingredients && <p className="text-sm text-zinc-500 mt-1">{todayDinner.ingredients}</p>}
              </div>
            : <Empty>No dinner planned for tonight.</Empty>}
        </Card>

        <Card title="Shared To-Dos" icon={CheckSquare} action={()=>setTab("tasks")}>
          {sharedOpen.length===0
            ? <Empty>All caught up.</Empty>
            : sharedOpen.map(x=>(
              <div key={x.id} className="flex items-center gap-2 py-1.5 text-sm text-zinc-200">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"/>{x.text}
              </div>
            ))}
        </Card>

        <Card title="Grocery Run" icon={ShoppingCart} action={()=>setTab("kitchen")}>
          {groceryLeft===0
            ? <Empty>{grocery.length? "All checked off.":"List is empty."}</Empty>
            : <div className="py-1">
                <p className="text-sm text-zinc-400">{groceryLeft} to grab</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {grocery.filter(g=>!g.checked).slice(0,8).map(g=>(
                    <span key={g.id} className="text-xs bg-zinc-800 text-zinc-300 rounded-full px-2.5 py-1">{g.name}</span>
                  ))}
                </div>
              </div>}
        </Card>
      </div>
    </div>
  );
}
function greeting(){ const h=new Date().getHours(); return h<12?"morning":h<17?"afternoon":"evening"; }
function StatCard({label,value,icon:Icon,tone,onClick}){
  return (
    <button onClick={onClick} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-3 text-left hover:border-zinc-700 hover:bg-zinc-800/50 transition">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tone}`}><Icon size={16}/></div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-semibold text-sm text-zinc-100">{value}</p>
    </button>
  );
}
function Card({title,icon:Icon,action,children}){
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-zinc-300 font-medium text-sm"><Icon size={16}/>{title}</div>
        {action && <button onClick={action} className="text-zinc-600 hover:text-zinc-300 p-1 -m-1"><ArrowRight size={16}/></button>}
      </div>
      {children}
    </div>
  );
}

// ---------- Calendar ----------
function CalendarView({events,upEvents,dates,upDates,settings,colors}){
  const [view, setView] = useState("week");
  const [cursor, setCursor] = useState(new Date());
  const [modalDate, setModalDate] = useState(null);
  const [filter, setFilter] = useState("all");

  const personOpts = [{id:"p1",label:settings.name1},{id:"p2",label:settings.name2},{id:"both",label:"Both"}];
  const addEvent = (date,title,time,person) => { if(title.trim()) upEvents([...events,{id:uid(),date,title:title.trim(),time,person}]); };
  const updEvent = (id,patch) => upEvents(events.map(e=>e.id===id?{...e,...patch}:e));
  const delEvent = id => upEvents(events.filter(e=>e.id!==id));

  const visible = events.filter(e=> filter==="all" ? true : (e.person===filter || e.person==="both"));
  const defaultPerson = filter==="all" ? "both" : filter;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={()=>setCursor(shift(cursor,view,-1))} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300"><ChevronLeft size={18}/></button>
          <h2 className="text-lg font-semibold min-w-40 text-center text-zinc-100">
            {view==="month" ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}` : weekLabel(cursor)}
          </h2>
          <button onClick={()=>setCursor(shift(cursor,view,1))} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300"><ChevronRight size={18}/></button>
          <button onClick={()=>setCursor(new Date())} className="text-xs text-zinc-400 border border-zinc-700 rounded-lg px-2 py-1 hover:bg-zinc-800">Today</button>
        </div>
        <Segmented value={view} onChange={setView} options={[{id:"week",label:"Week"},{id:"month",label:"Month"}]}/>
      </div>

      <Segmented value={filter} onChange={setFilter} options={[
        {id:"all",label:"Both",dot:colors.both.dot},
        {id:"p1",label:settings.name1,dot:colors.p1.dot},
        {id:"p2",label:settings.name2,dot:colors.p2.dot},
      ]}/>

      {view==="month"
        ? <MonthGrid cursor={cursor} events={visible} colors={colors} onPick={setModalDate}/>
        : <WeekGrid cursor={cursor} events={visible} colors={colors} onPick={setModalDate}/>}

      <KeyDates dates={dates} upDates={upDates}/>

      {modalDate && (
        <DayModal date={modalDate} events={events.filter(e=>e.date===modalDate)} personOpts={personOpts} colors={colors}
          defaultPerson={defaultPerson} onAdd={addEvent} onUpdate={updEvent} onDel={delEvent} close={()=>setModalDate(null)}/>
      )}
    </div>
  );
}
function shift(d,view,dir){ const n=new Date(d); if(view==="month") n.setMonth(n.getMonth()+dir); else n.setDate(n.getDate()+dir*7); return n; }
function weekLabel(d){ const s=startOfWeek(d); const e=new Date(s); e.setDate(e.getDate()+6); return `${MONTHS[s.getMonth()].slice(0,3)} ${s.getDate()} – ${MONTHS[e.getMonth()].slice(0,3)} ${e.getDate()}`; }
function startOfWeek(d){ const n=new Date(d); n.setDate(n.getDate()-weekdayIndexMon(n)); n.setHours(0,0,0,0); return n; }

function MonthGrid({cursor,events,colors,onPick}){
  const year=cursor.getFullYear(), month=cursor.getMonth();
  const startPad=weekdayIndexMon(new Date(year,month,1));
  const daysInMonth=new Date(year,month+1,0).getDate();
  const cells=[];
  for(let i=0;i<startPad;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(new Date(year,month,d));
  while(cells.length%7!==0) cells.push(null);
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
      <div className="grid grid-cols-7 text-center text-xs text-zinc-500 border-b border-zinc-800">
        {WD_SHORT.map(w=><div key={w} className="py-2">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c,i)=>{
          if(!c) return <div key={i} className="min-h-20 border-b border-r border-zinc-800/50 bg-zinc-900/40"/>;
          const iso=toISO(c);
          const evs=events.filter(e=>e.date===iso);
          const isToday=iso===todayISO();
          return (
            <button key={i} onClick={()=>onPick(iso)} className="min-h-20 border-b border-r border-zinc-800/50 p-1 text-left hover:bg-zinc-800/60 transition align-top">
              <span className={`inline-flex items-center justify-center w-6 h-6 text-xs rounded-full ${isToday?"bg-amber-400 text-zinc-900 font-semibold":"text-zinc-400"}`}>{c.getDate()}</span>
              <div className="mt-0.5 space-y-0.5">
                {evs.slice(0,3).map(e=>(
                  <div key={e.id} className={`text-[10px] truncate rounded px-1 ${colors[e.person].chip}`}>{e.time?e.time+" ":""}{e.title}</div>
                ))}
                {evs.length>3 && <div className="text-[10px] text-zinc-500 px-1">+{evs.length-3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function WeekGrid({cursor,events,colors,onPick}){
  const start=startOfWeek(cursor);
  const days=[...Array(7)].map((_,i)=>{const d=new Date(start); d.setDate(d.getDate()+i); return d;});
  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
      {days.map((d,i)=>{
        const iso=toISO(d);
        const evs=events.filter(e=>e.date===iso).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
        const isToday=iso===todayISO();
        return (
          <button key={i} onClick={()=>onPick(iso)} className={`bg-zinc-900 rounded-xl border p-2 text-left min-h-28 hover:border-zinc-700 transition ${isToday?"border-amber-400/60 ring-1 ring-amber-400/30":"border-zinc-800"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-500">{WD_SHORT[i]}</span>
              <span className={`text-sm font-semibold ${isToday?"text-amber-300":"text-zinc-200"}`}>{d.getDate()}</span>
            </div>
            <div className="space-y-1">
              {evs.map(e=>(
                <div key={e.id} className={`text-[11px] rounded px-1.5 py-0.5 ${colors[e.person].chip}`}>
                  {e.time && <span className="opacity-70">{e.time} </span>}{e.title}
                </div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
function DayModal({date,events,personOpts,colors,defaultPerson,onAdd,onUpdate,onDel,close}){
  const [title,setTitle]=useState(""); const [time,setTime]=useState(""); const [person,setPerson]=useState(defaultPerson||"both");
  const [editId,setEditId]=useState(null);
  const dayEvents=events.sort((a,b)=>(a.time||"").localeCompare(b.time||""));
  const startEdit=e=>{ setEditId(e.id); setTitle(e.title); setTime(e.time||""); setPerson(e.person); };
  const reset=()=>{ setEditId(null); setTitle(""); setTime(""); setPerson(defaultPerson||"both"); };
  const submit=()=>{
    if(!title.trim()) return;
    if(editId) onUpdate(editId,{title:title.trim(),time,person});
    else onAdd(date,title,time,person);
    reset();
  };
  return (
    <Modal close={close} title={prettyDate(parseISO(date))}>
      <div className="space-y-2 mb-4">
        {dayEvents.length===0 && <p className="text-sm text-zinc-500">No events yet.</p>}
        {dayEvents.map(e=>(
          <div key={e.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${editId===e.id?"bg-zinc-700":"bg-zinc-800"}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${colors[e.person].dot}`}/>
            <span className="text-sm text-zinc-500 w-14">{e.time||"—"}</span>
            <span className="text-sm flex-1 text-zinc-200">{e.title}</span>
            <button onClick={()=>startEdit(e)} className="text-zinc-500 hover:text-amber-300 p-2 -m-1"><Pencil size={14}/></button>
            <button onClick={()=>{ if(editId===e.id) reset(); onDel(e.id); }} className="text-zinc-500 hover:text-rose-400 p-2 -m-1"><Trash2 size={15}/></button>
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t border-zinc-800 pt-3">
        {editId && <p className="text-xs text-amber-300">Editing event</p>}
        <input value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Event title…" className="input"/>
        <div className="flex gap-2">
          <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="input flex-none w-32"/>
          <select value={person} onChange={e=>setPerson(e.target.value)} className="input flex-1 min-w-0">
            {personOpts.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button onClick={submit} className="bg-amber-400 text-zinc-900 rounded-xl px-4 text-sm font-medium hover:bg-amber-300 shrink-0">{editId?"Save":"Add"}</button>
        </div>
        {editId && <button onClick={reset} className="text-xs text-zinc-400 hover:text-zinc-200">Cancel edit</button>}
      </div>
    </Modal>
  );
}
function KeyDates({dates,upDates}){
  const [open,setOpen]=useState(false);
  const [label,setLabel]=useState(""); const [date,setDate]=useState("");
  const add=()=>{
    if(!label.trim()||!date) return;
    const [,m,d]=date.split("-");
    upDates([...dates,{id:uid(),label:label.trim(),md:`${m}-${d}`}]); setLabel(""); setDate("");
  };
  const del=id=>upDates(dates.filter(x=>x.id!==id));
  const sorted=[...dates].map(d=>({...d,...nextKeyDate(d.md)})).sort((a,b)=>a.days-b.days);
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
      <button onClick={()=>setOpen(o=>!o)} className="w-full flex items-center gap-2 text-zinc-300 font-medium text-sm">
        <Gift size={16} className="text-amber-300"/>Key Dates
        <span className="text-xs text-zinc-600">{dates.length>0?`· ${dates.length}`:""}</span>
        <ChevronDown size={16} className={`ml-auto text-zinc-500 transition ${open?"rotate-180":""}`}/>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Anniversary, birthday…" className="input flex-1 min-w-0 basis-full sm:basis-0"/>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="input w-40"/>
            <button onClick={add} className="bg-amber-400 text-zinc-900 rounded-xl px-3 hover:bg-amber-300 shrink-0"><Plus size={18}/></button>
          </div>
          <p className="text-[11px] text-zinc-600">Recurs every year — only the month and day are used.</p>
          {sorted.length===0 && <p className="text-xs text-zinc-600">No key dates yet.</p>}
          <div className="space-y-1.5">
            {sorted.map(d=>(
              <div key={d.id} className="flex items-center gap-3 bg-zinc-800/60 rounded-xl px-3 py-2">
                <span className="text-sm text-zinc-100 flex-1">{d.label}</span>
                <span className="text-xs text-zinc-400">{MONTHS[d.next.getMonth()].slice(0,3)} {d.next.getDate()}</span>
                <span className="text-xs text-amber-300 w-20 text-right">{keyDateLabel(d.days)}</span>
                <button onClick={()=>del(d.id)} className="text-zinc-600 hover:text-rose-400 p-2 -m-1"><X size={14}/></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Kitchen ----------
function KitchenView({dinners,upDinners,grocery,upGrocery,meals,upMeals}){
  const [sub,setSub]=useState("dinners");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-zinc-100">Kitchen</h2>
        <Segmented value={sub} onChange={setSub} options={[{id:"dinners",label:"Dinners",icon:UtensilsCrossed},{id:"grocery",label:"Grocery",icon:ShoppingCart}]}/>
      </div>
      {sub==="dinners" ? <Dinners {...{dinners,upDinners,meals,upMeals}}/> : <Grocery {...{grocery,upGrocery}}/>}
    </div>
  );
}
function Dinners({dinners,upDinners,meals,upMeals}){
  const [editing,setEditing]=useState(null);
  const [fav,setFav]=useState("");
  const setDinner=(day,val)=>upDinners({...dinners,[day]:val});
  const clearWeek=()=>upDinners({});
  const isFav=name=>meals.some(m=>m.name.toLowerCase()===(name||"").toLowerCase());
  const addFav=name=>{ const v=(name||"").trim(); if(!v||isFav(v)) return; upMeals([...meals,{id:uid(),name:v}]); };
  const delFav=id=>upMeals(meals.filter(m=>m.id!==id));
  const planned=WEEKDAYS.some(d=>dinners[d]?.name);

  return (
    <div className="space-y-3">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-3 text-zinc-300 font-medium text-sm"><Star size={16} className="text-amber-300"/>Favorite Meals</div>
        <div className="flex gap-2 mb-3">
          <input value={fav} onChange={e=>setFav(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ addFav(fav); setFav(""); } }} placeholder="Add a go-to meal…" className="input flex-1 min-w-0"/>
          <button onClick={()=>{ addFav(fav); setFav(""); }} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl px-3 shrink-0"><Plus size={18}/></button>
        </div>
        {meals.length===0 && <p className="text-xs text-zinc-600">No favorites yet. Add your regulars so you can pick them fast.</p>}
        <div className="flex flex-wrap gap-2">
          {meals.map(m=>(
            <span key={m.id} className="group flex items-center gap-1.5 text-sm bg-zinc-800 text-zinc-200 rounded-full pl-3 pr-1.5 py-1.5">
              {m.name}
              <button onClick={()=>delFav(m.id)} className="text-zinc-600 group-hover:text-rose-400 p-1 -m-1"><X size={13}/></button>
            </span>
          ))}
        </div>
      </div>

      {planned && (
        <div className="flex justify-end">
          <ConfirmDelete onConfirm={clearWeek} title="Clear all dinners" icon={RotateCcw} label="Clear week" triggerClass="text-zinc-400 hover:text-amber-300 border border-zinc-700"/>
        </div>
      )}

      <datalist id="fav-meals">{meals.map(m=><option key={m.id} value={m.name}/>)}</datalist>

      {WEEKDAYS.map(day=>{
        const d=dinners[day]||{};
        const isToday=WEEKDAYS[weekdayIndexMon(new Date())]===day;
        return (
          <div key={day} className={`bg-zinc-900 rounded-2xl border p-4 ${isToday?"border-amber-400/60 ring-1 ring-amber-400/20":"border-zinc-800"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-medium ${isToday?"text-amber-300":"text-zinc-400"}`}>{day}{isToday && " · Today"}</span>
              <button onClick={()=>setEditing(editing===day?null:day)} className="text-xs text-zinc-500 hover:text-zinc-300 p-1 -m-1">{editing===day?"Done":"Edit"}</button>
            </div>
            {editing===day ? (
              <div className="space-y-2 mt-2">
                <input list="fav-meals" value={d.name||""} onChange={e=>setDinner(day,{...d,name:e.target.value})} placeholder="Pick a favorite or type a new meal…" className="input"/>
                <input value={d.ingredients||""} onChange={e=>setDinner(day,{...d,ingredients:e.target.value})} placeholder="Notes / sides (optional)" className="input"/>
                {d.name && !isFav(d.name) && (
                  <button onClick={()=>addFav(d.name)} className="text-xs flex items-center gap-1 text-amber-300 hover:text-amber-200"><Star size={12}/>Save "{d.name}" to favorites</button>
                )}
              </div>
            ) : (
              d.name
                ? <div><p className="text-lg text-zinc-100">{d.name}</p>{d.ingredients && <p className="text-sm text-zinc-500 mt-0.5">{d.ingredients}</p>}</div>
                : <p className="text-zinc-600 text-sm">Tap edit to plan…</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
function Grocery({grocery,upGrocery}){
  const [name,setName]=useState(""); const [cat,setCat]=useState("Produce");
  const add=()=>{ if(!name.trim())return; upGrocery([...grocery,{id:uid(),name:name.trim(),cat,checked:false}]); setName(""); };
  const toggle=id=>upGrocery(grocery.map(g=>g.id===id?{...g,checked:!g.checked}:g));
  const del=id=>upGrocery(grocery.filter(g=>g.id!==id));
  const resetWeek=()=>upGrocery(grocery.map(g=>({...g,checked:false})));
  const left=grocery.filter(g=>!g.checked).length;
  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-3">
        <p className="text-xs text-zinc-500 mb-2">Your regular items live here — check them off as you shop, then reset for next week.</p>
        <div className="flex flex-wrap gap-2">
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Add a regular item…" className="input flex-1 min-w-0 basis-full sm:basis-0"/>
          <select value={cat} onChange={e=>setCat(e.target.value)} className="input w-32 flex-none">
            {GROCERY_CATS.map(c=><option key={c}>{c}</option>)}
          </select>
          <button onClick={add} className="bg-amber-400 text-zinc-900 rounded-xl px-3 hover:bg-amber-300 shrink-0"><Plus size={18}/></button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-sm text-zinc-400">{grocery.length? `${left} of ${grocery.length} left to grab` : "No items yet"}</span>
        {grocery.length>0 && (
          <button onClick={resetWeek} className="text-xs flex items-center gap-1.5 text-zinc-400 hover:text-amber-300 border border-zinc-700 rounded-lg px-2.5 py-1.5 shrink-0">
            <RotateCcw size={13}/>Reset for new week
          </button>
        )}
      </div>

      {grocery.length===0 && <Empty>Add the items you buy regularly.</Empty>}

      {GROCERY_CATS.map(c=>{
        const items=grocery.filter(g=>g.cat===c);
        if(items.length===0) return null;
        return (
          <div key={c} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">{c}</p>
            <div className="space-y-0.5">
              {items.map(g=>(
                <div key={g.id} className="flex items-center gap-3 group py-0.5">
                  <button onClick={()=>toggle(g.id)} className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${g.checked?"bg-emerald-500 border-emerald-500 text-white":"border-zinc-600"}`}>
                    {g.checked && <Check size={14}/>}
                  </button>
                  <span className={`text-sm flex-1 min-w-0 ${g.checked?"line-through text-zinc-600":"text-zinc-200"}`}>{g.name}</span>
                  <button onClick={()=>del(g.id)} className="text-zinc-700 group-hover:text-rose-400 p-2 -m-1" title="Remove for good"><X size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Tasks ----------
function TasksView({todos,upTodos,chores,upChores,settings,colors,nameOf}){
  const [sub,setSub]=useState("lists");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-zinc-100">Tasks</h2>
        <Segmented value={sub} onChange={setSub} options={[{id:"lists",label:"To-Do",icon:CheckSquare},{id:"chores",label:"Chores",icon:Sparkles}]}/>
      </div>
      {sub==="lists" ? <Todos {...{todos,upTodos,settings,colors}}/> : <Chores {...{chores,upChores,settings,colors,nameOf}}/>}
    </div>
  );
}
function Todos({todos,upTodos,settings,colors}){
  const lists=[{key:"shared",label:"Shared",color:colors.both},{key:"p1",label:settings.name1,color:colors.p1},{key:"p2",label:settings.name2,color:colors.p2}];
  const add=(key,text)=>{ if(!text.trim())return; upTodos({...todos,[key]:[...(todos[key]||[]),{id:uid(),text:text.trim(),done:false}]}); };
  const toggle=(key,id)=>upTodos({...todos,[key]:todos[key].map(t=>t.id===id?{...t,done:!t.done}:t)});
  const del=(key,id)=>upTodos({...todos,[key]:todos[key].filter(t=>t.id!==id)});
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {lists.map(l=>(
        <TodoColumn key={l.key} list={l} items={todos[l.key]||[]} onAdd={t=>add(l.key,t)} onToggle={id=>toggle(l.key,id)} onDel={id=>del(l.key,id)}/>
      ))}
    </div>
  );
}
function TodoColumn({list,items,onAdd,onToggle,onDel}){
  const [text,setText]=useState("");
  const submit=()=>{ onAdd(text); setText(""); };
  const open=items.filter(i=>!i.done), done=items.filter(i=>i.done);
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${list.color.dot}`}/>
        <h3 className="font-medium text-sm text-zinc-200">{list.label}</h3>
        <span className="text-xs text-zinc-600 ml-auto">{open.length} open</span>
      </div>
      <div className="flex gap-1.5 mb-3">
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Add task…" className="input flex-1 min-w-0"/>
        <button onClick={submit} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl px-2.5 shrink-0"><Plus size={16}/></button>
      </div>
      <div className="space-y-0.5">
        {items.length===0 && <p className="text-xs text-zinc-600 py-2">No tasks yet.</p>}
        {open.map(t=><TodoItem key={t.id} t={t} onToggle={onToggle} onDel={onDel}/>)}
        {done.length>0 && <p className="text-[10px] text-zinc-600 uppercase tracking-wide pt-2">Done</p>}
        {done.map(t=><TodoItem key={t.id} t={t} onToggle={onToggle} onDel={onDel}/>)}
      </div>
    </div>
  );
}
function TodoItem({t,onToggle,onDel}){
  return (
    <div className="flex items-center gap-2 group py-0.5">
      <button onClick={()=>onToggle(t.id)} className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${t.done?"bg-amber-400 border-amber-400 text-zinc-900":"border-zinc-600"}`}>
        {t.done && <Check size={13}/>}
      </button>
      <span className={`text-sm flex-1 min-w-0 ${t.done?"line-through text-zinc-600":"text-zinc-200"}`}>{t.text}</span>
      <button onClick={()=>onDel(t.id)} className="text-zinc-700 group-hover:text-rose-400 p-2 -m-1"><X size={15}/></button>
    </div>
  );
}
function isChoreDue(c){
  if(!c.lastDone) return true;
  const diff=Math.floor((Date.now()-parseISO(c.lastDone).getTime())/MSDAY);
  const span={daily:1,weekly:7,monthly:30}[c.frequency]||7;
  return diff>=span;
}
function Chores({chores,upChores,settings,colors,nameOf}){
  const [name,setName]=useState(""); const [freq,setFreq]=useState("weekly"); const [who,setWho]=useState("both");
  const add=()=>{ if(!name.trim())return; upChores([...chores,{id:uid(),name:name.trim(),frequency:freq,assignedTo:who,lastDone:null}]); setName(""); };
  const markDone=id=>upChores(chores.map(c=>c.id===id?{...c,lastDone:todayISO()}:c));
  const del=id=>upChores(chores.filter(c=>c.id!==id));
  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-3 space-y-2">
        <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="New chore (e.g. Take out trash)…" className="input"/>
        <div className="flex flex-wrap gap-2">
          <select value={freq} onChange={e=>setFreq(e.target.value)} className="input flex-1 min-w-0">
            <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
          </select>
          <select value={who} onChange={e=>setWho(e.target.value)} className="input flex-1 min-w-0">
            <option value="p1">{settings.name1}</option><option value="p2">{settings.name2}</option><option value="both">Both</option>
          </select>
          <button onClick={add} className="bg-amber-400 text-zinc-900 rounded-xl px-3 hover:bg-amber-300 shrink-0"><Plus size={18}/></button>
        </div>
      </div>
      {chores.length===0 && <Empty>No chores yet. Add recurring tasks above.</Empty>}
      <div className="space-y-2">
        {chores.map(c=>{
          const due=isChoreDue(c);
          return (
            <div key={c.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex items-center gap-3">
              <button onClick={()=>markDone(c.id)} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${due?"border-rose-400/60 hover:bg-rose-500/10":"border-emerald-400/60 bg-emerald-500/10 text-emerald-400"}`}>
                {!due && <Check size={15}/>}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100">{c.name}</p>
                <p className="text-xs text-zinc-500 flex items-center gap-1.5 flex-wrap">
                  <span className="capitalize">{c.frequency}</span> ·
                  <span className={colors[c.assignedTo]?.text}>{nameOf(c.assignedTo)}</span> ·
                  {c.lastDone ? <span className="flex items-center gap-1"><Clock size={11}/>last {timeAgo(c.lastDone)}</span> : <span>never done</span>}
                </p>
              </div>
              {due && <span className="text-xs bg-rose-500/20 text-rose-300 rounded-full px-2.5 py-1 font-medium shrink-0">Due</span>}
              <button onClick={()=>del(c.id)} className="text-zinc-700 hover:text-rose-400 p-2 -m-1"><Trash2 size={16}/></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function timeAgo(iso){ const diff=Math.floor((Date.now()-parseISO(iso).getTime())/MSDAY); if(diff<=0)return"today"; if(diff===1)return"yesterday"; return `${diff}d ago`; }

// ---------- Travel ----------
function TravelView({trips,upTrips,ideas,upIdeas,visited,upVisited}){
  const [adding,setAdding]=useState(false);
  const [f,setF]=useState({name:"",destination:"",start:"",end:""});
  const [idea,setIdea]=useState("");
  const [expanded,setExpanded]=useState(null);
  const [showPast,setShowPast]=useState(false);

  const addTrip=()=>{
    if(!f.destination.trim() && !f.name.trim()) return;
    const t={id:uid(),name:f.name.trim()||f.destination.trim(),destination:f.destination.trim(),start:f.start,end:f.end||f.start,checklist:[]};
    upTrips([...trips,t]); setF({name:"",destination:"",start:"",end:""}); setAdding(false); setExpanded(t.id);
  };
  const delTrip=id=>upTrips(trips.filter(t=>t.id!==id));
  const updateTrip=(id,fn)=>upTrips(trips.map(t=>t.id===id?fn(t):t));
  const addItem=(id,text)=>{ if(!text.trim())return; updateTrip(id,t=>({...t,checklist:[...(t.checklist||[]),{id:uid(),text:text.trim(),done:false}]})); };
  const toggleItem=(id,iid)=>updateTrip(id,t=>({...t,checklist:t.checklist.map(i=>i.id===iid?{...i,done:!i.done}:i)}));
  const delItem=(id,iid)=>updateTrip(id,t=>({...t,checklist:t.checklist.filter(i=>i.id!==iid)}));
  const addIdea=()=>{ if(!idea.trim())return; upIdeas([{id:uid(),text:idea.trim()},...ideas]); setIdea(""); };
  const delIdea=id=>upIdeas(ideas.filter(i=>i.id!==id));

  const all=[...trips].map(t=>({t,st:tripStatus(t)})).sort((a,b)=>a.st.sort-b.st.sort);
  const current=all.filter(x=>x.st.state!=="past");
  const past=all.filter(x=>x.st.state==="past");

  const renderTrip=({t,st})=>{
    const isOpen=expanded===t.id;
    const done=(t.checklist||[]).filter(i=>i.done).length;
    const total=(t.checklist||[]).length;
    const badge = st.state==="active"?"bg-emerald-500/20 text-emerald-300":st.state==="past"?"bg-zinc-800 text-zinc-500":"bg-indigo-500/20 text-indigo-300";
    return (
      <div key={t.id} className={`bg-zinc-900 rounded-2xl border ${st.state==="past"?"border-zinc-800/60":"border-zinc-800"}`}>
        <button onClick={()=>setExpanded(isOpen?null:t.id)} className="w-full flex items-center gap-3 p-4 text-left">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-amber-300 shrink-0"><MapPin size={18}/></div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-zinc-100 truncate">{t.destination||t.name}</p>
            <p className="text-xs text-zinc-500 flex items-center gap-2">
              {t.start && <span>{shortRange(t.start,t.end)}</span>}
              {total>0 && <span>· {done}/{total} packed</span>}
            </p>
          </div>
          <span className={`text-xs rounded-full px-2.5 py-1 font-medium shrink-0 ${badge}`}>{st.label}</span>
          <ChevronDown size={18} className={`text-zinc-500 transition shrink-0 ${isOpen?"rotate-180":""}`}/>
        </button>
        {isOpen && (
          <div className="px-4 pb-4 space-y-2 border-t border-zinc-800 pt-3">
            {t.name && t.name!==t.destination && <p className="text-xs text-zinc-500">{t.name}</p>}
            <ChecklistEditor checklist={t.checklist||[]} onAdd={txt=>addItem(t.id,txt)} onToggle={iid=>toggleItem(t.id,iid)} onDel={iid=>delItem(t.id,iid)}/>
            <div className="pt-1"><ConfirmDelete onConfirm={()=>delTrip(t.id)} title="Delete trip" label="Delete trip" triggerClass="text-zinc-500 hover:text-rose-400" size={13}/></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Travel</h2>
        <button onClick={()=>setAdding(a=>!a)} className="text-sm flex items-center gap-1.5 bg-amber-400 text-zinc-900 rounded-xl px-3 py-1.5 font-medium hover:bg-amber-300"><Plus size={16}/>New trip</button>
      </div>

      {adding && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-2">
          <input value={f.destination} onChange={e=>setF({...f,destination:e.target.value})} placeholder="Destination (e.g. Zanzibar)" className="input"/>
          <input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="Trip name (optional, e.g. Honeymoon)" className="input"/>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0"><label className="text-xs text-zinc-500 block mb-1">Start</label><input type="date" value={f.start} onChange={e=>setF({...f,start:e.target.value})} className="input"/></div>
            <div className="flex-1 min-w-0"><label className="text-xs text-zinc-500 block mb-1">End</label><input type="date" value={f.end} onChange={e=>setF({...f,end:e.target.value})} className="input"/></div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={addTrip} className="bg-amber-400 text-zinc-900 rounded-xl px-4 py-2 text-sm font-medium hover:bg-amber-300">Add trip</button>
            <button onClick={()=>setAdding(false)} className="text-zinc-400 text-sm px-3">Cancel</button>
          </div>
        </div>
      )}

      {trips.length===0 && !adding && <Empty>No trips yet. Add one to start planning.</Empty>}
      <div className="space-y-3">{current.map(renderTrip)}</div>

      {past.length>0 && (
        <div>
          <button onClick={()=>setShowPast(p=>!p)} className="text-sm text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 mb-3">
            <ChevronDown size={15} className={`transition ${showPast?"rotate-180":""}`}/>Past trips ({past.length})
          </button>
          {showPast && <div className="space-y-3">{past.map(renderTrip)}</div>}
        </div>
      )}

      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-3 text-zinc-300 font-medium text-sm"><Lightbulb size={16} className="text-amber-300"/>Someday / Trip Ideas</div>
        <div className="flex gap-2 mb-3">
          <input value={idea} onChange={e=>setIdea(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addIdea()} placeholder="Add a dream destination…" className="input flex-1 min-w-0"/>
          <button onClick={addIdea} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl px-3 shrink-0"><Plus size={18}/></button>
        </div>
        {ideas.length===0 && <p className="text-xs text-zinc-600">Nowhere on the wishlist yet.</p>}
        <div className="flex flex-wrap gap-2">
          {ideas.map(i=>(
            <span key={i.id} className="group flex items-center gap-1.5 text-sm bg-zinc-800 text-zinc-200 rounded-full pl-3 pr-1.5 py-1.5">
              {i.text}
              <button onClick={()=>delIdea(i.id)} className="text-zinc-600 group-hover:text-rose-400 p-1 -m-1"><X size={13}/></button>
            </span>
          ))}
        </div>
      </div>

      <PlacesVisited visited={visited} upVisited={upVisited}/>
    </div>
  );
}
function ChecklistEditor({checklist,onAdd,onToggle,onDel}){
  const [text,setText]=useState("");
  const submit=()=>{ onAdd(text); setText(""); };
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Add to-do / packing item…" className="input flex-1 min-w-0"/>
        <button onClick={submit} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl px-3 shrink-0"><Plus size={16}/></button>
      </div>
      <div className="space-y-0.5">
        {checklist.length===0 && <p className="text-xs text-zinc-600 py-1">Nothing on the list yet.</p>}
        {checklist.map(i=>(
          <div key={i.id} className="flex items-center gap-2 group py-0.5">
            <button onClick={()=>onToggle(i.id)} className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${i.done?"bg-emerald-500 border-emerald-500 text-white":"border-zinc-600"}`}>
              {i.done && <Check size={13}/>}
            </button>
            <span className={`text-sm flex-1 min-w-0 ${i.done?"line-through text-zinc-600":"text-zinc-200"}`}>{i.text}</span>
            <button onClick={()=>onDel(i.id)} className="text-zinc-700 group-hover:text-rose-400 p-2 -m-1"><X size={15}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}
function PlacesVisited({visited,upVisited}){
  const add=(kind,name)=>{
    const v=name.trim(); if(!v) return;
    if((visited[kind]||[]).some(p=>p.name.toLowerCase()===v.toLowerCase())) return;
    upVisited({...visited,[kind]:[...(visited[kind]||[]),{id:uid(),name:v}]});
  };
  const del=(kind,id)=>upVisited({...visited,[kind]:visited[kind].filter(p=>p.id!==id)});
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-4 text-zinc-300 font-medium text-sm"><Globe size={16} className="text-emerald-300"/>Places We've Been</div>
      <div className="grid md:grid-cols-2 gap-5">
        <PlaceGroup label="Countries" items={visited.countries||[]} onAdd={n=>add("countries",n)} onDel={id=>del("countries",id)} placeholder="Add a country…"/>
        <PlaceGroup label="States" items={visited.states||[]} onAdd={n=>add("states",n)} onDel={id=>del("states",id)} placeholder="Add a state…"/>
      </div>
    </div>
  );
}
function PlaceGroup({label,items,onAdd,onDel,placeholder}){
  const [text,setText]=useState("");
  const submit=()=>{ onAdd(text); setText(""); };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{label}</p>
        <span className="text-xs text-zinc-600">{items.length}</span>
      </div>
      <div className="flex gap-2 mb-3">
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder={placeholder} className="input flex-1 min-w-0"/>
        <button onClick={submit} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl px-3 shrink-0"><Plus size={16}/></button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.length===0 && <p className="text-xs text-zinc-600">None added yet.</p>}
        {items.map(p=>(
          <span key={p.id} className="group flex items-center gap-1.5 text-sm bg-zinc-800 text-zinc-200 rounded-full pl-3 pr-1.5 py-1.5">
            {p.name}
            <button onClick={()=>onDel(p.id)} className="text-zinc-600 group-hover:text-rose-400 p-1 -m-1"><X size={13}/></button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Notes ----------
function NotesView({notes,upNotes,important,upImportant,importantFiles,upImportantFiles,householdId,addAttachment,removeAttachment}){
  const [text,setText]=useState("");
  const [light,setLight]=useState(null);

  const add=()=>{
    if(!text.trim())return;
    const newNote={id:uid(),text:text.trim(),at:Date.now(),att:[]};
    upNotes([newNote,...notes]);
    setText("");
  };
  const del=id=>upNotes(notes.filter(n=>n.id!==id));

  const handleAttAdd=(noteId)=>async(file,blob,type)=>{
    await addAttachment(file,blob,uid(),"note",noteId);
  };
  const handleAttRemove=(noteId)=>(attId,storagePath)=>removeAttachment(attId,storagePath);

  const tones=["bg-amber-500/10 border-amber-500/30 text-amber-100","bg-rose-500/10 border-rose-500/30 text-rose-100","bg-emerald-500/10 border-emerald-500/30 text-emerald-100","bg-indigo-500/10 border-indigo-500/30 text-indigo-100","bg-sky-500/10 border-sky-500/30 text-sky-100"];
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-100">Notes</h2>

      <ImportantInfo
        important={important} upImportant={upImportant}
        files={importantFiles}
        onAddFile={async(file,blob)=>addAttachment(file,blob,uid(),"important",null)}
        onRemoveFile={(id,path)=>removeAttachment(id,path)}
      />

      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-3 space-y-3">
        <div className="flex gap-2">
          <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Jot a note, reminder, or idea…" className="input flex-1 min-w-0"/>
          <button onClick={add} className="bg-amber-400 text-zinc-900 rounded-xl px-4 text-sm font-medium hover:bg-amber-300 shrink-0">Pin</button>
        </div>
      </div>

      {notes.length===0 && <Empty>Nothing pinned yet.</Empty>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {notes.map((n,i)=>(
          <div key={n.id} className={`rounded-2xl border p-3 ${tones[i%tones.length]} relative group`}>
            <div className="absolute top-2 right-2">
              <ConfirmDelete onConfirm={()=>del(n.id)} title="Delete note" triggerClass="text-zinc-400 hover:text-rose-400" size={14}/>
            </div>
            {n.text && <p className="text-sm whitespace-pre-wrap pr-6">{n.text}</p>}
            {n.att?.length>0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {n.att.map(a=> (a.mime||"").startsWith("image/")
                  ? <img key={a.id} src={a.url} onClick={()=>setLight(a.url)} alt="" className="w-16 h-16 object-cover rounded-lg cursor-pointer border border-black/20"/>
                  : <a key={a.id} href={a.url} download={a.name} className="text-xs underline bg-black/20 rounded-lg px-2 py-1 max-w-full truncate">{a.name||"file"}</a>
                )}
              </div>
            )}
            <div className="mt-2">
              <Attachments
                items={n.att||[]}
                onAdd={handleAttAdd(n.id)}
                onRemove={handleAttRemove(n.id)}
              />
            </div>
          </div>
        ))}
      </div>
      <Lightbox src={light} onClose={()=>setLight(null)}/>
    </div>
  );
}
function ImportantInfo({important,upImportant,files,onAddFile,onRemoveFile}){
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(important||"");
  useEffect(()=>{ if(!editing) setDraft(important||""); },[important,editing]);
  const save=()=>{ upImportant(draft); setEditing(false); };
  return (
    <div className="bg-zinc-900 rounded-2xl border border-amber-500/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-amber-200 font-medium text-sm"><Info size={16}/>Important Information</div>
        {editing
          ? <div className="flex gap-2">
              <button onClick={()=>{ setDraft(important||""); setEditing(false); }} className="text-xs text-zinc-400 hover:text-zinc-200 px-1 py-1">Cancel</button>
              <button onClick={save} className="text-xs bg-amber-400 text-zinc-900 rounded-lg px-3 py-1.5 font-medium hover:bg-amber-300">Save</button>
            </div>
          : <button onClick={()=>setEditing(true)} className="text-xs flex items-center gap-1 text-zinc-400 hover:text-amber-200 p-1 -m-1"><Pencil size={12}/>Edit</button>}
      </div>
      {editing ? (
        <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={6}
          placeholder={"Key things to keep handy — e.g.\nWi-Fi password: ...\nEmergency contacts: ...\nInsurance / policy #s: ...\nHome alarm code: ..."}
          className="input"/>
      ) : (
        important?.trim()
          ? <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{important}</p>
          : <p className="text-sm text-zinc-600">Nothing here yet. Tap "Edit" to add the info you'll want at your fingertips — Wi-Fi, emergency contacts, account numbers, codes.</p>
      )}
      <div className="mt-3 pt-3 border-t border-zinc-800">
        <Attachments items={files||[]} onAdd={async(file,blob,type)=>onAddFile(file,blob)} onRemove={(id,path)=>onRemoveFile(id,path)}/>
      </div>
    </div>
  );
}

// ---------- Settings ----------
function SwatchRow({value,onChange}){
  return (
    <div className="flex flex-wrap gap-2">
      {Object.keys(PALETTE).map(k=>(
        <button key={k} onClick={()=>onChange(k)}
          className={`w-7 h-7 rounded-full ${PALETTE[k].dot} ${value===k?"ring-2 ring-offset-2 ring-offset-zinc-900 ring-white":""}`}/>
      ))}
    </div>
  );
}
function SettingsModal({settings,upSettings,householdId,close}){
  const [f,setF]=useState(settings);
  const save=()=>{ upSettings(f); close(); };
  return (
    <Modal close={close} title="Settings">
      <div className="space-y-3">
        <Field label="Home name"><input value={f.home} onChange={e=>setF({...f,home:e.target.value})} className="input"/></Field>
        <Field label="Person 1 name"><input value={f.name1} onChange={e=>setF({...f,name1:e.target.value})} className="input"/></Field>
        <Field label={`${f.name1||"Person 1"}'s color`}><SwatchRow value={f.color1} onChange={k=>setF({...f,color1:k})}/></Field>
        <Field label="Person 2 name"><input value={f.name2} onChange={e=>setF({...f,name2:e.target.value})} className="input"/></Field>
        <Field label={`${f.name2||"Person 2"}'s color`}><SwatchRow value={f.color2} onChange={k=>setF({...f,color2:k})}/></Field>
        <Field label="Shared / Both color"><SwatchRow value={f.colorBoth} onChange={k=>setF({...f,colorBoth:k})}/></Field>
        <div className="pt-2 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-1">Household invite code</p>
          <p className="text-xs font-mono bg-zinc-800 text-zinc-200 rounded-lg px-3 py-2 break-all select-all">{householdId}</p>
          <p className="text-[11px] text-zinc-600 mt-1">Share this code with your partner so they can join on first sign-in.</p>
        </div>
        <button onClick={save} className="w-full bg-amber-400 text-zinc-900 rounded-xl py-2.5 font-medium hover:bg-amber-300">Save</button>
      </div>
    </Modal>
  );
}
function Field({label,children}){ return <div><label className="text-xs text-zinc-500 block mb-1.5">{label}</label>{children}</div>; }
function Modal({title,close,children}){
  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={close}>
      <div onClick={e=>e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 rounded-t-3xl md:rounded-2xl w-full md:max-w-md max-h-[85vh] overflow-y-auto p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-zinc-100">{title}</h3>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}
