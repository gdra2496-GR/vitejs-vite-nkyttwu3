import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SpeedInsights } from '@vercel/speed-insights/react';

/* ─────────────────────────────────────────────────────────────
   ⚙️  CONFIGURACIÓN — reemplaza con tus credenciales de Supabase
   Las encuentras en: Settings → API → Project URL y anon key
───────────────────────────────────────────────────────────── */
const SUPABASE_URL = 'https://dikrihjhzoqyayibynmb.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpa3JpaGpoem9xeWF5aWJ5bm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMjAyMTEsImV4cCI6MjA4Nzc5NjIxMX0.nPwuz_JHMzqMJMh3iTSq_974PsUe4r9EMmmMTkEemew';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const COP = (n) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format((n || 0) / 100);
const RAW = (n) => Math.round((n || 0) * 100); // pesos → centavos para DB
const FROM_DB = (n) => (n || 0) / 100; // centavos → pesos para mostrar
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const mesActual = () =>
  `${MESES[new Date().getMonth()]} ${new Date().getFullYear()}`;
const initials = (n) =>
  (n || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
const today = () => new Date().toISOString().split('T')[0];

/* ─────────────────────────────────────────────────────────────
   SUPABASE HOOKS
───────────────────────────────────────────────────────────── */
function useQuery(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fn();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line

  useEffect(() => {
    run();
  }, [run]);
  return { data, loading, error, refetch: run };
}

/* ─────────────────────────────────────────────────────────────
   API — todas las operaciones de base de datos
───────────────────────────────────────────────────────────── */
const api = {
  // CONFIG
  async getConfig() {
    const { data } = await supabase.from('config').select('*').single();
    return data;
  },
  async updateConfig(patch) {
    await supabase.from('config').update(patch).eq('id', 1);
  },

  // MIEMBROS
  async getMiembros() {
    const { data } = await supabase
      .from('miembros')
      .select('*')
      .order('nombre');
    return data || [];
  },
  async getMiembroByCedula(cedula) {
    const { data } = await supabase
      .from('miembros')
      .select('*')
      .eq('cedula', cedula)
      .single();
    return data;
  },
  async createMiembro(m) {
    const { error } = await supabase.from('miembros').insert(m);
    if (error) throw new Error(error.message);
  },
  async updateMiembro(id, patch) {
    const { error } = await supabase
      .from('miembros')
      .update(patch)
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  // APORTES
  async getAportes(filter = {}) {
    let q = supabase
      .from('aportes')
      .select('*, miembros(nombre,cedula)')
      .order('created_at', { ascending: false });
    if (filter.miembro_id) q = q.eq('miembro_id', filter.miembro_id);
    if (filter.estado) q = q.eq('estado', filter.estado);
    const { data } = await q;
    return data || [];
  },
  async createAporte(a) {
    const { error } = await supabase.from('aportes').insert(a);
    if (error) throw new Error(error.message);
  },
  async updateAporte(id, patch) {
    const { error } = await supabase.from('aportes').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  },
  async uploadComprobante(file, miembroId) {
    const ext = file.name.split('.').pop();
    const path = `${miembroId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('comprobantes')
      .upload(path, file);
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('comprobantes').getPublicUrl(path);
    return data.publicUrl;
  },

  // PRÉSTAMOS
  async getPrestamos(filter = {}) {
    let q = supabase
      .from('prestamos')
      .select('*, miembros(nombre,cedula)')
      .order('created_at', { ascending: false });
    if (filter.miembro_id) q = q.eq('miembro_id', filter.miembro_id);
    if (filter.estado) q = q.eq('estado', filter.estado);
    const { data } = await q;
    return data || [];
  },
  async createPrestamo(p) {
    const { error } = await supabase.from('prestamos').insert(p);
    if (error) throw new Error(error.message);
  },
  async updatePrestamo(id, patch) {
    const { error } = await supabase
      .from('prestamos')
      .update(patch)
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  // INVERSIONES
  async getInversiones() {
    const { data } = await supabase
      .from('inversiones')
      .select('*')
      .order('created_at', { ascending: false });
    return data || [];
  },
  async createInversion(i) {
    const { error } = await supabase.from('inversiones').insert(i);
    if (error) throw new Error(error.message);
  },
  async updateInversion(id, patch) {
    const { error } = await supabase
      .from('inversiones')
      .update(patch)
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  // GANANCIAS
  async getGanancias() {
    const { data } = await supabase
      .from('ganancias')
      .select('*')
      .order('fecha', { ascending: false });
    return data || [];
  },
  async createGanancia(g) {
    const { error } = await supabase.from('ganancias').insert(g);
    if (error) throw new Error(error.message);
  },
};

/* ─────────────────────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0b0f19;--surface:#131929;--surface2:#1a2236;
  --border:#1e2d47;--border2:#253554;
  --accent:#3b82f6;--accent2:#60a5fa;
  --gold:#f59e0b;--gold2:#fbbf24;
  --green:#10b981;--green2:#34d399;
  --red:#ef4444;--red2:#f87171;
  --purple:#8b5cf6;
  --text:#e8edf5;--text2:#8b9dc3;--text3:#4a6080;
  --shadow:0 4px 24px rgba(0,0,0,.4);
  --r:14px;--rs:9px;
}
body{font-family:'Outfit',sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
button,input,select,textarea{font-family:'Outfit',sans-serif}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}

/* AUTH */
.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(ellipse 80% 60% at 50% -10%,rgba(59,130,246,.18),transparent),
             radial-gradient(ellipse 60% 50% at 80% 90%,rgba(139,92,246,.12),transparent),var(--bg);padding:16px}
.auth-box{width:100%;max-width:400px;background:var(--surface);border:1px solid var(--border);
  border-radius:20px;padding:44px 36px;box-shadow:0 0 0 1px rgba(255,255,255,.04),var(--shadow);animation:fadeUp .5s ease}
.auth-brand{text-align:center;margin-bottom:36px}
.auth-brand .lr{width:68px;height:68px;margin:0 auto 16px;background:linear-gradient(135deg,#1d4ed8,#7c3aed);
  border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 8px 32px rgba(59,130,246,.35)}
.auth-brand h1{font-family:'Playfair Display',serif;font-size:26px;font-weight:700}
.auth-brand p{color:var(--text3);font-size:13px;margin-top:5px}
.auth-field{margin-bottom:18px}
.auth-field label{display:block;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text2);margin-bottom:8px}
.auth-field input{width:100%;padding:13px 16px;background:var(--surface2);border:1.5px solid var(--border);
  border-radius:var(--rs);color:var(--text);font-size:15px;outline:none;transition:border-color .2s}
.auth-field input:focus{border-color:var(--accent)}
.auth-field input::placeholder{color:var(--text3)}
.btn-main{width:100%;padding:14px;background:linear-gradient(135deg,#2563eb,#7c3aed);border:none;
  border-radius:var(--rs);color:#fff;font-size:15px;font-weight:600;cursor:pointer;
  transition:opacity .2s,transform .15s;margin-top:4px}
.btn-main:hover{opacity:.92;transform:translateY(-1px)}
.err-msg{margin-top:12px;padding:12px 16px;border-radius:var(--rs);background:rgba(239,68,68,.1);
  border:1px solid rgba(239,68,68,.2);color:#f87171;font-size:13px;text-align:center}
.info-box{margin-top:16px;padding:14px;border-radius:var(--rs);background:rgba(59,130,246,.06);
  border:1px solid rgba(59,130,246,.15);font-size:12px;color:var(--text2);line-height:1.8}
.info-box strong{color:var(--accent2)}

/* LAYOUT */
.app-shell{display:flex;flex-direction:column;min-height:100vh}
.topbar{height:60px;display:flex;align-items:center;justify-content:space-between;
  padding:0 20px;background:var(--surface);border-bottom:1px solid var(--border);
  position:sticky;top:0;z-index:100}
.topbar-left{display:flex;align-items:center;gap:12px}
.tl{width:34px;height:34px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:10px;
  display:flex;align-items:center;justify-content:center;font-size:15px}
.tn{font-family:'Playfair Display',serif;font-size:17px;font-weight:600;display:none}
@media(min-width:560px){.tn{display:block}}
.topbar-right{display:flex;align-items:center;gap:10px}
.uc{display:flex;align-items:center;gap:8px;padding:5px 12px 5px 5px;background:var(--surface2);
  border:1px solid var(--border);border-radius:30px}
.uc .av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--accent));
  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#000}
.uc span{font-size:13px;font-weight:500;color:var(--text2)}
.btn-exit{padding:7px 14px;background:transparent;border:1px solid var(--border);border-radius:var(--rs);
  color:var(--text3);font-size:13px;cursor:pointer;transition:all .2s}
.btn-exit:hover{border-color:var(--border2);color:var(--text)}
.sidebar{width:220px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);
  padding:16px 10px;display:flex;flex-direction:column;gap:4px;
  position:fixed;left:0;top:60px;bottom:0;overflow-y:auto;z-index:50;
  transform:translateX(-100%);transition:transform .25s ease}
.sidebar.open{transform:translateX(0)}
@media(min-width:768px){.sidebar{transform:translateX(0)}}
.content-area{flex:1;padding:24px 16px;margin-top:60px;overflow-x:hidden}
@media(min-width:768px){.content-area{margin-left:220px}}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--rs);
  color:var(--text2);font-size:13.5px;font-weight:500;cursor:pointer;transition:all .18s;
  border:none;background:transparent;width:100%;text-align:left}
.nav-item:hover{background:var(--surface2);color:var(--text)}
.nav-item.active{background:rgba(59,130,246,.12);color:var(--accent2);font-weight:600}
.nav-item .ni{width:18px;text-align:center;flex-shrink:0}
.nav-sec{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);padding:12px 12px 4px}
.mmb{display:flex;align-items:center;justify-content:center;width:36px;height:36px;
  background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);color:var(--text2);cursor:pointer}
@media(min-width:768px){.mmb{display:none}}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:49;display:none}
.overlay.show{display:block}

/* PAGE */
.ph{margin-bottom:24px}
.ph h2{font-family:'Playfair Display',serif;font-size:24px;font-weight:700}
.ph p{color:var(--text2);font-size:14px;margin-top:4px}

/* CARD */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:24px;margin-bottom:16px}
.ch{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.ct{font-family:'Playfair Display',serif;font-size:16px;font-weight:600}
.cs{color:var(--text2);font-size:13px;margin-top:2px}

/* HERO */
.bh{border-radius:18px;padding:28px 32px;
  background:linear-gradient(135deg,#1e3a8a 0%,#312e81 50%,#1e1b4b 100%);
  border:1px solid rgba(99,102,241,.3);position:relative;overflow:hidden;margin-bottom:16px}
.bh::before{content:'';position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;
  background:radial-gradient(circle,rgba(139,92,246,.25),transparent 70%)}
.bh-lbl{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:6px}
.bh-amt{font-family:'Playfair Display',serif;font-size:42px;font-weight:700;line-height:1;color:#fff;position:relative;z-index:1}
.bh-meta{display:flex;gap:28px;margin-top:22px;flex-wrap:wrap}
.bh-mi label{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.35);display:block;margin-bottom:3px}
.bh-mi span{font-size:14px;color:rgba(255,255,255,.8);font-weight:500}

/* STATS */
.sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px;margin-bottom:16px}
.sb{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px;transition:border-color .2s}
.sb:hover{border-color:var(--border2)}
.sb .si{font-size:20px;margin-bottom:8px}
.sb .sl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin-bottom:5px}
.sb .sv{font-family:'Playfair Display',serif;font-size:20px;font-weight:700}
.sb.a{border-left:3px solid var(--accent)}.sb.g{border-left:3px solid var(--green)}
.sb.go{border-left:3px solid var(--gold)}.sb.r{border-left:3px solid var(--red)}.sb.p{border-left:3px solid var(--purple)}

/* BADGES */
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.bg{background:rgba(16,185,129,.12);color:var(--green2);border:1px solid rgba(16,185,129,.2)}
.bgo{background:rgba(245,158,11,.12);color:var(--gold2);border:1px solid rgba(245,158,11,.2)}
.br{background:rgba(239,68,68,.1);color:var(--red2);border:1px solid rgba(239,68,68,.2)}
.bb{background:rgba(59,130,246,.1);color:var(--accent2);border:1px solid rgba(59,130,246,.2)}
.bgy{background:rgba(100,116,139,.12);color:#94a3b8;border:1px solid rgba(100,116,139,.2)}
.bp{background:rgba(139,92,246,.1);color:#c4b5fd;border:1px solid rgba(139,92,246,.2)}

/* TABLE */
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13.5px}
thead th{text-align:left;padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--text3);background:var(--surface2);border-bottom:1px solid var(--border)}
tbody td{padding:13px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:rgba(255,255,255,.02)}

/* FORMS */
.fg{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:540px){.fg{grid-template-columns:1fr}}
.ff{grid-column:1/-1}
.field label{display:block;font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text2);margin-bottom:7px}
.field input,.field select,.field textarea{width:100%;padding:11px 14px;background:var(--surface2);
  border:1.5px solid var(--border);border-radius:var(--rs);color:var(--text);font-size:14px;outline:none;transition:border-color .2s}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--accent)}
.field input::placeholder,.field textarea::placeholder{color:var(--text3)}
.field select option{background:var(--surface2)}

/* BUTTONS */
.btn{padding:10px 20px;border:none;border-radius:var(--rs);font-size:13px;font-weight:600;
  cursor:pointer;transition:all .18s;display:inline-flex;align-items:center;gap:7px}
.btn.primary{background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff}
.btn.primary:hover{opacity:.9;transform:translateY(-1px)}
.btn.success{background:rgba(16,185,129,.15);color:var(--green2);border:1px solid rgba(16,185,129,.25)}
.btn.success:hover{background:rgba(16,185,129,.25)}
.btn.danger{background:rgba(239,68,68,.12);color:var(--red2);border:1px solid rgba(239,68,68,.2)}
.btn.danger:hover{background:rgba(239,68,68,.22)}
.btn.ghost{background:transparent;color:var(--text2);border:1px solid var(--border)}
.btn.ghost:hover{border-color:var(--border2);color:var(--text)}
.btn.gold{background:rgba(245,158,11,.15);color:var(--gold2);border:1px solid rgba(245,158,11,.25)}
.btn.gold:hover{background:rgba(245,158,11,.25)}
.btn.sm{padding:6px 14px;font-size:12px}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none!important}

/* UPLOAD */
.uz{border:2px dashed var(--border2);border-radius:var(--r);padding:28px;text-align:center;
  cursor:pointer;transition:border-color .2s,background .2s;background:var(--surface2)}
.uz:hover,.uz.drag{border-color:var(--accent);background:rgba(59,130,246,.05)}
.uz .ui{font-size:32px;margin-bottom:10px}
.uz p{color:var(--text2);font-size:13px}
.uz strong{color:var(--accent2)}
.prev{width:100%;max-height:220px;object-fit:contain;border-radius:var(--rs);border:1px solid var(--border);margin-top:12px}

/* MONTH GRID */
.mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(95px,1fr));gap:8px;margin-top:16px}
.mc{padding:14px 8px;border-radius:var(--rs);border:1px solid var(--border);text-align:center;transition:all .2s}
.mc.paid{background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.25)}
.mc.pend{background:rgba(245,158,11,.07);border-color:rgba(245,158,11,.25)}
.mc.miss{background:rgba(239,68,68,.05);border-color:rgba(239,68,68,.15)}
.mc.fut{opacity:.3}
.mc-n{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin-bottom:6px}
.mc-i{font-size:18px}
.mc-s{font-size:10px;font-weight:700;margin-top:5px}
.mc.paid .mc-s{color:var(--green2)}.mc.pend .mc-s{color:var(--gold2)}.mc.miss .mc-s{color:var(--red2)}

/* ALERTS */
.al{padding:13px 16px;border-radius:var(--rs);font-size:13.5px;display:flex;gap:10px;align-items:flex-start;margin-bottom:14px}
.al.info{background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);color:var(--accent2)}
.al.warn{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);color:var(--gold2)}
.al.ok{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);color:var(--green2)}
.al.err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:var(--red2)}

/* PROGRESS */
.pb{height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:6px}
.pf{height:100%;background:linear-gradient(90deg,var(--accent),var(--purple));border-radius:3px;transition:width .6s}

/* MEMBER ROWS */
.mr{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--border)}
.mr:last-child{border-bottom:none}
.mav{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));
  display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}
.mi2{flex:1;min-width:0}
.mi2 .nm{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mi2 .mt{font-size:12px;color:var(--text3)}

/* LIGHTBOX */
.lb{position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);z-index:300;
  display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out}
.lb img{max-width:100%;max-height:90vh;border-radius:10px;box-shadow:var(--shadow)}
.pt{width:48px;height:36px;object-fit:cover;border-radius:5px;border:1px solid var(--border);cursor:zoom-in}

/* TOAST */
.toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
  background:var(--green);color:#fff;padding:13px 24px;border-radius:12px;
  font-weight:600;font-size:14px;z-index:999;box-shadow:0 8px 30px rgba(16,185,129,.4);
  animation:fadeUp .3s;white-space:nowrap}
.toast.err{background:var(--red);box-shadow:0 8px 30px rgba(239,68,68,.4)}

/* SPINNER */
.spin{display:flex;align-items:center;justify-content:center;padding:60px;color:var(--text3);gap:12px;font-size:14px}
.spin::before{content:'';width:24px;height:24px;border:2px solid var(--border2);border-top-color:var(--accent);
  border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}

/* CHART */
.cbw{display:flex;align-items:flex-end;gap:8px;height:120px;margin-top:12px}
.cbc{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.cbr{width:100%;border-radius:5px 5px 0 0;background:linear-gradient(180deg,var(--purple),var(--accent));min-height:4px;transition:height .6s}
.cbl{font-size:10px;color:var(--text3);text-align:center}

/* CONFIG PANEL */
.cfg-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:540px){.cfg-grid{grid-template-columns:1fr}}

.empty{text-align:center;padding:40px;color:var(--text3)}
.empty .ei{font-size:38px;margin-bottom:10px}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
`;

/* ─────────────────────────────────────────────────────────────
   ROOT
───────────────────────────────────────────────────────────── */
export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('home');
  const [nav, setNav] = useState(false);
  const [toast, setToast] = useState(null); // {msg, type}
  const [light, setLight] = useState(null); // url
  const [config, setConfig] = useState(null);

  // Cargar config al inicio
  useEffect(() => {
    api.getConfig().then((c) => setConfig(c));
  }, []);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const logout = () => {
    setUser(null);
    setTab('home');
  };

  const adminNav = [
    { id: 'home', icon: '📊', label: 'Dashboard' },
    { id: 'miembros', icon: '👥', label: 'Miembros' },
    { id: 'aportes', icon: '💳', label: 'Aportes' },
    { id: 'prestamos', icon: '🤝', label: 'Préstamos' },
    { id: 'inversiones', icon: '📈', label: 'Inversiones' },
    { id: 'ganancias', icon: '💰', label: 'Ganancias' },
    { id: 'retiro', icon: '🚪', label: 'Retiro socio' },
    { id: 'config', icon: '⚙️', label: 'Configuración' },
  ];
  const memberNav = [
    { id: 'home', icon: '📊', label: 'Mi Saldo' },
    { id: 'aportes', icon: '💳', label: 'Mis Aportes' },
    { id: 'prestamos', icon: '🤝', label: 'Mis Préstamos' },
    { id: 'inversiones', icon: '📈', label: 'Inversiones' },
    { id: 'ganancias', icon: '💰', label: 'Ganancias' },
  ];
  const navItems = user?.is_admin ? adminNav : memberNav;

  if (!config)
    return (
      <>
        <style>{CSS}</style>
        <div className="spin" style={{ height: '100vh' }}>
          Cargando Fondo Solidario...
        </div>
        <SpeedInsights />
      </>
    );

  if (!user)
    return (
      <>
        <style>{CSS}</style>
        <AuthScreen config={config} onLogin={setUser} showToast={showToast} />
        {toast && (
          <div className={`toast ${toast.type === 'err' ? 'err' : ''}`}>
            {toast.msg}
          </div>
        )}
        <SpeedInsights />
      </>
    );

  return (
    <>
      <style>{CSS}</style>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mmb" onClick={() => setNav((v) => !v)}>
              ☰
            </button>
            <div className="tl">🏦</div>
            <span className="tn">{config.nombre_fondo}</span>
            {user.is_admin && <span className="badge bp">Admin</span>}
          </div>
          <div className="topbar-right">
            <div className="uc">
              <div className="av">{initials(user.nombre)}</div>
              <span>{user.nombre.split(' ')[0]}</span>
            </div>
            <button className="btn-exit" onClick={logout}>
              Salir
            </button>
          </div>
        </header>

        <div
          className={`overlay ${nav ? 'show' : ''}`}
          onClick={() => setNav(false)}
        />

        <nav className={`sidebar ${nav ? 'open' : ''}`}>
          <div className="nav-sec">Menú</div>
          {navItems.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${tab === n.id ? 'active' : ''}`}
              onClick={() => {
                setTab(n.id);
                setNav(false);
              }}
            >
              <span className="ni">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <main
          className="content-area"
          style={{ maxWidth: 920, margin: '0 auto' }}
        >
          {tab === 'home' &&
            (user.is_admin ? (
              <AdminDash
                user={user}
                config={config}
                setTab={setTab}
                showToast={showToast}
              />
            ) : (
              <MemberDash user={user} config={config} />
            ))}
          {tab === 'aportes' &&
            (user.is_admin ? (
              <AdminAportes
                config={config}
                showToast={showToast}
                setLight={setLight}
              />
            ) : (
              <MisAportes user={user} config={config} showToast={showToast} />
            ))}
          {tab === 'prestamos' &&
            (user.is_admin ? (
              <AdminPrestamos config={config} showToast={showToast} />
            ) : (
              <MisPrestamos user={user} config={config} showToast={showToast} />
            ))}
          {tab === 'inversiones' && (
            <Inversiones user={user} showToast={showToast} />
          )}
          {tab === 'ganancias' && (
            <Ganancias user={user} showToast={showToast} />
          )}
          {tab === 'miembros' && user.is_admin && (
            <AdminMiembros showToast={showToast} />
          )}
          {tab === 'retiro' && user.is_admin && (
            <AdminRetiro showToast={showToast} />
          )}
          {tab === 'config' && user.is_admin && (
            <AdminConfig
              config={config}
              setConfig={setConfig}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {toast && (
        <div className={`toast ${toast.type === 'err' ? 'err' : ''}`}>
          {toast.msg}
        </div>
      )}
      {light && (
        <div className="lb" onClick={() => setLight(null)}>
          <img
            src={light}
            alt="comprobante"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   AUTH
───────────────────────────────────────────────────────────── */
function AuthScreen({ config, onLogin, showToast }) {
  const [cedula, setCedula] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    if (!cedula.trim()) return;
    setLoading(true);
    setError('');
    try {
      const m = await api.getMiembroByCedula(cedula.trim());
      if (m && m.activo) {
        onLogin(m);
      } else
        setError(
          m
            ? 'Tu cuenta está inactiva. Contacta al administrador.'
            : 'Cédula no encontrada en el fondo.'
        );
    } catch (e) {
      setError('Error de conexión. Verifica tu internet.');
      showToast(
        'Error al conectar con Supabase. ¿Configuraste las credenciales?',
        'err'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-brand">
          <div className="lr">🏦</div>
          <h1>{config?.nombre_fondo || 'Fondo Solidario'}</h1>
          <p>Ingresa con tu número de cédula</p>
        </div>
        <div className="auth-field">
          <label>Número de Cédula</label>
          <input
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            placeholder="Ej: 12345678"
            onKeyDown={(e) => e.key === 'Enter' && login()}
            autoFocus
          />
        </div>
        <button className="btn-main" onClick={login} disabled={loading}>
          {loading ? 'Verificando…' : 'Entrar al Fondo'}
        </button>
        {error && <div className="err-msg">{error}</div>}
        <div className="info-box">
          <strong>⚠️ Primera vez:</strong> Configura tu URL y clave de Supabase
          en el archivo y ejecuta el schema SQL.
          <br />
          Admin: cédula <strong>admin</strong>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MEMBER DASHBOARD
───────────────────────────────────────────────────────────── */
function MemberDash({ user, config }) {
  const { data: miembro, loading } = useQuery(
    () => api.getMiembroByCedula(user.cedula),
    [user.id]
  );
  const { data: aportes } = useQuery(
    () => api.getAportes({ miembro_id: user.id }),
    [user.id]
  );
  const { data: prestamos } = useQuery(
    () => api.getPrestamos({ miembro_id: user.id }),
    [user.id]
  );
  const { data: ganancias } = useQuery(() => api.getGanancias(), []);
  const { data: allMiembros } = useQuery(() => api.getMiembros(), []);

  if (loading) return <div className="spin">Cargando tu información…</div>;

  const mes = mesActual();
  const misAportes = (aportes || []).filter((a) => a.estado === 'confirmado');
  const pagadoMes = (aportes || []).some(
    (a) => a.mes === mes && a.estado === 'confirmado'
  );
  const pendiente = (aportes || []).some(
    (a) => a.mes === mes && a.estado === 'pendiente'
  );
  const prestAct = (prestamos || []).filter((p) => p.estado === 'activo');
  const totalAportado = misAportes.reduce((s, a) => s + FROM_DB(a.monto), 0);
  const totalFondo = (allMiembros || [])
    .filter((m) => !m.is_admin && m.activo)
    .reduce((s, m) => s + FROM_DB(m.saldo), 0);
  const totalGanancias = (ganancias || []).reduce(
    (s, g) => s + FROM_DB(g.monto),
    0
  );
  const proporcion =
    totalFondo > 0 ? FROM_DB(miembro?.saldo || 0) / totalFondo : 0;
  const gananciaEst = Math.round(proporcion * totalGanancias);
  const saldo = FROM_DB(miembro?.saldo || 0);

  return (
    <>
      {!pagadoMes && !pendiente && (
        <div className="al warn">
          ⚠️ No has registrado tu aporte de <strong>{mes}</strong>. Ve a "Mis
          Aportes".
        </div>
      )}
      {pendiente && (
        <div className="al info">
          ⏳ Tu aporte de <strong>{mes}</strong> está en revisión.
        </div>
      )}
      {pagadoMes && (
        <div className="al ok">
          ✅ Aporte de <strong>{mes}</strong> confirmado. ¡Gracias!
        </div>
      )}

      <div className="bh">
        <div className="bh-lbl">Tu Saldo en el Fondo</div>
        <div className="bh-amt">{COP(miembro?.saldo || 0)}</div>
        <div className="bh-meta">
          <div className="bh-mi">
            <label>Total aportado</label>
            <span>{COP(RAW(totalAportado))}</span>
          </div>
          <div className="bh-mi">
            <label>Meses pagados</label>
            <span>{misAportes.length}</span>
          </div>
          <div className="bh-mi">
            <label>Parte de ganancias</label>
            <span>{COP(RAW(gananciaEst))}</span>
          </div>
          <div className="bh-mi">
            <label>Socio desde</label>
            <span>{user.fecha_ingreso}</span>
          </div>
        </div>
      </div>

      <div className="sg">
        <div className="sb go">
          <div className="si">📅</div>
          <div className="sl">Aporte mensual</div>
          <div className="sv">{COP(config.monto_mensual)}</div>
        </div>
        <div className="sb a">
          <div className="si">🤝</div>
          <div className="sl">Préstamos activos</div>
          <div className="sv">{prestAct.length}</div>
        </div>
        <div className="sb g">
          <div className="si">💰</div>
          <div className="sl">Ganancia estimada</div>
          <div className="sv" style={{ fontSize: 16 }}>
            {COP(RAW(gananciaEst))}
          </div>
        </div>
        <div className="sb p">
          <div className="si">📈</div>
          <div className="sl">Aportes confirmados</div>
          <div className="sv">{misAportes.length}</div>
        </div>
      </div>

      {prestAct.length > 0 && (
        <div className="card">
          <div className="ct">🤝 Préstamos Activos</div>
          {prestAct.map((p) => {
            const cuota = Math.round(
              (FROM_DB(p.monto) * (1 + (p.interes / 100) * p.cuotas)) / p.cuotas
            );
            const pct = Math.round((p.cuotas_pagadas / p.cuotas) * 100);
            return (
              <div key={p.id} style={{ marginBottom: 18, marginTop: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{COP(p.monto)}</span>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                    Cuota {p.cuotas_pagadas}/{p.cuotas} · {COP(RAW(cuota))}/mes
                  </span>
                </div>
                <div className="pb">
                  <div className="pf" style={{ width: `${pct}%` }} />
                </div>
                <div
                  style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}
                >
                  {pct}% pagado · {p.motivo}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   ADMIN DASHBOARD
───────────────────────────────────────────────────────────── */
function AdminDash({ config, setTab, showToast }) {
  const { data: miembros } = useQuery(() => api.getMiembros(), []);
  const { data: aportes } = useQuery(() => api.getAportes(), []);
  const { data: prestamos } = useQuery(() => api.getPrestamos(), []);
  const { data: inversiones } = useQuery(() => api.getInversiones(), []);
  const { data: ganancias } = useQuery(() => api.getGanancias(), []);

  const activos = (miembros || []).filter((m) => !m.is_admin && m.activo);
  const mes = mesActual();
  const pagadosMes = new Set(
    (aportes || [])
      .filter((a) => a.mes === mes && a.estado === 'confirmado')
      .map((a) => a.miembro_id)
  ).size;
  const pendientesConf = (aportes || []).filter(
    (a) => a.estado === 'pendiente'
  ).length;
  const totalSaldos = activos.reduce((s, m) => s + FROM_DB(m.saldo), 0);
  const totalInv = (inversiones || [])
    .filter((i) => i.estado === 'activo')
    .reduce((s, i) => s + FROM_DB(i.monto), 0);
  const totalPrest = (prestamos || [])
    .filter((p) => p.estado === 'activo')
    .reduce((s, p) => s + FROM_DB(p.monto), 0);
  const totalGanancias = (ganancias || []).reduce(
    (s, g) => s + FROM_DB(g.monto),
    0
  );

  return (
    <>
      <div className="ph">
        <h2>Panel General</h2>
        <p>
          {mes} · {activos.length} socios activos
        </p>
      </div>

      {pendientesConf > 0 && (
        <div
          className="al warn"
          style={{ cursor: 'pointer' }}
          onClick={() => setTab('aportes')}
        >
          ⚠️ <strong>{pendientesConf} aporte(s)</strong> esperan confirmación →{' '}
          <u>ir a Aportes</u>
        </div>
      )}

      <div className="bh">
        <div className="bh-lbl">Capital Total Administrado</div>
        <div className="bh-amt">{COP(RAW(totalSaldos + totalInv))}</div>
        <div className="bh-meta">
          <div className="bh-mi">
            <label>Saldos socios</label>
            <span>{COP(RAW(totalSaldos))}</span>
          </div>
          <div className="bh-mi">
            <label>En inversiones</label>
            <span>{COP(RAW(totalInv))}</span>
          </div>
          <div className="bh-mi">
            <label>Prestado</label>
            <span>{COP(RAW(totalPrest))}</span>
          </div>
          <div className="bh-mi">
            <label>Total ganancias</label>
            <span>{COP(RAW(totalGanancias))}</span>
          </div>
        </div>
      </div>

      <div className="sg">
        <div className="sb g">
          <div className="si">✅</div>
          <div className="sl">Pagaron este mes</div>
          <div className="sv">
            {pagadosMes}/{activos.length}
          </div>
        </div>
        <div className="sb r">
          <div className="si">⏳</div>
          <div className="sl">Pendientes confirmar</div>
          <div className="sv">{pendientesConf}</div>
        </div>
        <div className="sb a">
          <div className="si">🤝</div>
          <div className="sl">Préstamos activos</div>
          <div className="sv">
            {(prestamos || []).filter((p) => p.estado === 'activo').length}
          </div>
        </div>
        <div className="sb go">
          <div className="si">💰</div>
          <div className="sl">Ganancias totales</div>
          <div className="sv" style={{ fontSize: 16 }}>
            {COP(RAW(totalGanancias))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="ct">Estado Aportes — {mes}</div>
        {activos.length === 0 ? (
          <div className="empty">
            <div className="ei">👥</div>Sin socios registrados.
          </div>
        ) : (
          activos.map((m) => {
            const a = (aportes || []).find(
              (ap) => ap.miembro_id === m.id && ap.mes === mes
            );
            return (
              <div className="mr" key={m.id}>
                <div className="mav">{initials(m.nombre)}</div>
                <div className="mi2">
                  <div className="nm">{m.nombre}</div>
                  <div className="mt">CC {m.cedula}</div>
                </div>
                <span
                  className={`badge ${
                    a ? (a.estado === 'confirmado' ? 'bg' : 'bgo') : 'br'
                  }`}
                >
                  {a
                    ? a.estado === 'confirmado'
                      ? '✓ Pagado'
                      : '⏳ Pendiente'
                    : '✗ Sin pagar'}
                </span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   MIS APORTES (member)
───────────────────────────────────────────────────────────── */
function MisAportes({ user, config, showToast }) {
  const { data: aportes, refetch } = useQuery(
    () => api.getAportes({ miembro_id: user.id }),
    [user.id]
  );
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [drag, setDrag] = useState(false);
  const [comp, setComp] = useState('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const mes = mesActual();
  const yaRegistrado = (aportes || []).some((a) => a.mes === mes);
  const y = new Date().getFullYear();
  const mi = new Date().getMonth();

  const handleFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return;
    setFile(f);
    const r = new FileReader();
    r.onload = (e) => setPreview(e.target.result);
    r.readAsDataURL(f);
  };

  const registrar = async () => {
    if (!file) {
      showToast('Sube la foto del comprobante.', 'err');
      return;
    }
    setSaving(true);
    try {
      const fotoUrl = await api.uploadComprobante(file, user.id);
      await api.createAporte({
        miembro_id: user.id,
        monto: config.monto_mensual,
        mes,
        fecha: today(),
        comprobante: comp || '—',
        foto_url: fotoUrl,
        nota,
        estado: 'pendiente',
      });
      setShowForm(false);
      setFile(null);
      setPreview(null);
      setComp('');
      setNota('');
      showToast('¡Aporte enviado! Esperando confirmación del admin.');
      refetch();
    } catch (e) {
      showToast('Error al subir: ' + e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="ph">
        <h2>Mis Aportes</h2>
        <p>Sube tu comprobante mensual de transferencia</p>
      </div>

      {!yaRegistrado && !showForm && (
        <div className="al info">
          📅 Tu aporte de <strong>{mes}</strong> no está registrado.
          <button
            className="btn sm primary"
            style={{ marginLeft: 12 }}
            onClick={() => setShowForm(true)}
          >
            Registrar ahora
          </button>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
          <div className="ct">Registrar Aporte — {mes}</div>
          <div className="cs">
            {COP(config.monto_mensual)} · Sube la foto de tu transferencia
          </div>
          <div style={{ marginTop: 16 }}>
            <div
              className={`uz ${drag ? 'drag' : ''}`}
              onClick={() => fileRef.current.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                handleFile(e.dataTransfer.files[0]);
              }}
            >
              <div className="ui">{preview ? '✅' : '📷'}</div>
              <p>
                {preview ? (
                  <strong style={{ color: 'var(--green2)' }}>
                    Imagen lista — toca para cambiar
                  </strong>
                ) : (
                  <>
                    <strong>Toca o arrastra</strong> la foto del comprobante
                  </>
                )}
              </p>
              <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text3)' }}>
                JPG · PNG · WEBP
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>
            {preview && <img src={preview} className="prev" alt="preview" />}
          </div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field">
              <label>Referencia / N° operación</label>
              <input
                value={comp}
                onChange={(e) => setComp(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="field">
              <label>Nota adicional</label>
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Nequi, Bancolombia..."
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              className="btn primary"
              onClick={registrar}
              disabled={saving}
            >
              {saving ? 'Subiendo…' : 'Enviar Aporte'}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setShowForm(false);
                setFile(null);
                setPreview(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="ct">Estado {y}</div>
        <div className="mgrid">
          {MESES.map((m, i) => {
            const a = (aportes || []).find((ap) => ap.mes === `${m} ${y}`);
            const isFuture = i > mi;
            const cls = a
              ? a.estado === 'confirmado'
                ? 'paid'
                : 'pend'
              : isFuture
              ? 'fut'
              : 'miss';
            return (
              <div key={m} className={`mc ${cls}`}>
                <div className="mc-n">{m.slice(0, 3)}</div>
                <div className="mc-i">
                  {a
                    ? a.estado === 'confirmado'
                      ? '✅'
                      : '⏳'
                    : isFuture
                    ? '◽'
                    : '❌'}
                </div>
                <div className="mc-s">
                  {a
                    ? a.estado === 'confirmado'
                      ? 'Pagado'
                      : 'Pendiente'
                    : isFuture
                    ? ''
                    : 'Faltó'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="ct">Historial</div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th>Monto</th>
                <th>Referencia</th>
                <th>Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {!aportes?.length ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">
                      <div className="ei">📭</div>Sin aportes aún.
                    </div>
                  </td>
                </tr>
              ) : (
                aportes.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.mes}</td>
                    <td>{COP(a.monto)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {a.comprobante}
                    </td>
                    <td style={{ fontSize: 12 }}>{a.fecha}</td>
                    <td>
                      <span
                        className={`badge ${
                          a.estado === 'confirmado' ? 'bg' : 'bgo'
                        }`}
                      >
                        {a.estado === 'confirmado'
                          ? '✓ Confirmado'
                          : '⏳ Pendiente'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — APORTES
───────────────────────────────────────────────────────────── */
function AdminAportes({ config, showToast, setLight }) {
  const [filter, setFilter] = useState('pendiente');
  const { data: aportes, refetch } = useQuery(
    () => api.getAportes(filter === 'todos' ? {} : { estado: filter }),
    [filter]
  );

  const confirmar = async (a) => {
    try {
      await api.updateAporte(a.id, { estado: 'confirmado' });
      await api.updateMiembro(a.miembro_id, {
        saldo: (a.miembros?.saldo || 0) + a.monto,
      });
      showToast(`Aporte de ${a.miembros?.nombre} confirmado.`);
      refetch();
    } catch (e) {
      showToast(e.message, 'err');
    }
  };

  const rechazar = async (a) => {
    try {
      await api.updateAporte(a.id, { estado: 'rechazado' });
      showToast('Aporte rechazado.');
      refetch();
    } catch (e) {
      showToast(e.message, 'err');
    }
  };

  const registrarManual = async () => {
    const cedula = window.prompt('Cédula del miembro:');
    const m = await api.getMiembroByCedula(cedula?.trim());
    if (!m) {
      showToast('Miembro no encontrado.', 'err');
      return;
    }
    const montoStr = window.prompt('Monto en pesos (ej: 200000):');
    const monto = parseInt(montoStr || '0') * 100;
    const comp = window.prompt('Referencia/comprobante:') || 'MANUAL';
    const mes = mesActual();
    try {
      await api.createAporte({
        miembro_id: m.id,
        monto,
        mes,
        fecha: today(),
        comprobante: comp,
        estado: 'confirmado',
        nota: 'Registro manual admin',
      });
      await api.updateMiembro(m.id, { saldo: (m.saldo || 0) + monto });
      showToast(`Aporte manual de ${m.nombre} registrado.`);
      refetch();
    } catch (e) {
      showToast(e.message, 'err');
    }
  };

  const pendCount = (aportes || []).filter(
    (a) => a.estado === 'pendiente'
  ).length;

  return (
    <>
      <div className="ph">
        <h2>Gestión de Aportes</h2>
        <p>Confirma los comprobantes de los socios</p>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['pendiente', 'confirmado', 'rechazado', 'todos'].map((f) => (
            <button
              key={f}
              className={`btn sm ${filter === f ? 'primary' : 'ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pendiente' && pendCount > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: 'var(--red)',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '1px 7px',
                    fontSize: 10,
                  }}
                >
                  {pendCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button className="btn success" onClick={registrarManual}>
          + Registro Manual
        </button>
      </div>

      <div className="card">
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Socio</th>
                <th>Mes</th>
                <th>Monto</th>
                <th>Ref.</th>
                <th>Foto</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {!aportes?.length ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">
                      <div className="ei">📭</div>Sin aportes en esta categoría.
                    </div>
                  </td>
                </tr>
              ) : (
                aportes.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>
                      {a.miembros?.nombre || '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>{a.mes}</td>
                    <td style={{ fontWeight: 600 }}>{COP(a.monto)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      {a.comprobante}
                    </td>
                    <td>
                      {a.foto_url ? (
                        <img
                          src={a.foto_url}
                          className="pt"
                          alt="comp"
                          onClick={() => setLight(a.foto_url)}
                        />
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                          —
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 11 }}>{a.fecha}</td>
                    <td>
                      <span
                        className={`badge ${
                          a.estado === 'confirmado'
                            ? 'bg'
                            : a.estado === 'pendiente'
                            ? 'bgo'
                            : 'br'
                        }`}
                      >
                        {a.estado}
                      </span>
                    </td>
                    <td>
                      {a.estado === 'pendiente' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn sm success"
                            onClick={() => confirmar(a)}
                          >
                            ✓
                          </button>
                          <button
                            className="btn sm danger"
                            onClick={() => rechazar(a)}
                          >
                            ✗
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   MIS PRÉSTAMOS (member)
───────────────────────────────────────────────────────────── */
function MisPrestamos({ user, config, showToast }) {
  const { data: prestamos, refetch } = useQuery(
    () => api.getPrestamos({ miembro_id: user.id }),
    [user.id]
  );
  const [showForm, setShowForm] = useState(false);
  const [monto, setMonto] = useState('');
  const [cuotas, setCuotas] = useState('6');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const activo = (prestamos || []).find((p) => p.estado === 'activo');
  const total = monto
    ? Math.round(
        parseInt(monto) * (1 + (config.tasa_prestamo / 100) * parseInt(cuotas))
      )
    : 0;
  const cuotaVal = total && cuotas ? Math.round(total / parseInt(cuotas)) : 0;

  const solicitar = async () => {
    if (!monto || !motivo) {
      showToast('Completa todos los campos.', 'err');
      return;
    }
    if (activo) {
      showToast('Ya tienes un préstamo activo.', 'err');
      return;
    }
    setSaving(true);
    try {
      await api.createPrestamo({
        miembro_id: user.id,
        monto: parseInt(monto) * 100,
        interes: config.tasa_prestamo,
        cuotas: parseInt(cuotas),
        cuotas_pagadas: 0,
        fecha: today(),
        estado: 'pendiente',
        motivo,
      });
      setShowForm(false);
      setMonto('');
      setMotivo('');
      showToast('Solicitud enviada al administrador.');
      refetch();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="ph">
        <h2>Mis Préstamos</h2>
        <p>Solicita y monitorea tus préstamos</p>
      </div>
      {!activo && !showForm && (
        <button
          className="btn primary"
          style={{ marginBottom: 16 }}
          onClick={() => setShowForm(true)}
        >
          + Solicitar Préstamo
        </button>
      )}
      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
          <div className="ct">Solicitar Préstamo</div>
          <div className="cs">Tasa: {config.tasa_prestamo}% mensual</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field">
              <label>Monto (COP)</label>
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="500000"
              />
            </div>
            <div className="field">
              <label>Cuotas</label>
              <select
                value={cuotas}
                onChange={(e) => setCuotas(e.target.value)}
              >
                {[3, 6, 9, 12, 18, 24].map((c) => (
                  <option key={c} value={c}>
                    {c} meses
                  </option>
                ))}
              </select>
            </div>
            {monto && (
              <div className="ff">
                <div className="al info">
                  💡 Cuota mensual: <strong>{COP(RAW(cuotaVal))}</strong> ·
                  Total: <strong>{COP(RAW(total))}</strong>
                </div>
              </div>
            )}
            <div className="field ff">
              <label>Motivo</label>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Gastos médicos, educación..."
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              className="btn primary"
              onClick={solicitar}
              disabled={saving}
            >
              {saving ? 'Enviando…' : 'Enviar Solicitud'}
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      <div className="card">
        {!prestamos?.length ? (
          <div className="empty">
            <div className="ei">🤝</div>Sin préstamos.
          </div>
        ) : (
          prestamos.map((p) => {
            const cv = Math.round(
              (FROM_DB(p.monto) * (1 + (p.interes / 100) * p.cuotas)) / p.cuotas
            );
            const pend = (p.cuotas - p.cuotas_pagadas) * cv;
            const pct = Math.round((p.cuotas_pagadas / p.cuotas) * 100);
            return (
              <div
                key={p.id}
                style={{
                  padding: '16px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>
                      {COP(p.monto)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {p.motivo} · {p.fecha}
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      p.estado === 'activo'
                        ? 'bgo'
                        : p.estado === 'pagado'
                        ? 'bg'
                        : 'bgy'
                    }`}
                  >
                    {p.estado}
                  </span>
                </div>
                {p.estado !== 'pendiente' && (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: 'var(--text2)' }}>
                        Cuotas: {p.cuotas_pagadas}/{p.cuotas}
                      </span>
                      <span>
                        Saldo: <strong>{COP(RAW(pend))}</strong>
                      </span>
                    </div>
                    <div className="pb">
                      <div className="pf" style={{ width: `${pct}%` }} />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text3)',
                        marginTop: 3,
                      }}
                    >
                      {pct}% pagado
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — PRÉSTAMOS
───────────────────────────────────────────────────────────── */
function AdminPrestamos({ config, showToast }) {
  const { data: prestamos, refetch } = useQuery(() => api.getPrestamos(), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cedula: '',
    monto: '',
    cuotas: '6',
    interes: String(config.tasa_prestamo),
    motivo: '',
  });
  const [saving, setSaving] = useState(false);

  const crear = async () => {
    const m = await api.getMiembroByCedula(form.cedula.trim());
    if (!m) {
      showToast('Miembro no encontrado.', 'err');
      return;
    }
    if (!form.monto || !form.motivo) {
      showToast('Completa todos los campos.', 'err');
      return;
    }
    setSaving(true);
    try {
      await api.createPrestamo({
        miembro_id: m.id,
        monto: parseInt(form.monto) * 100,
        interes: parseFloat(form.interes),
        cuotas: parseInt(form.cuotas),
        cuotas_pagadas: 0,
        fecha: today(),
        estado: 'activo',
        motivo: form.motivo,
      });
      setShowForm(false);
      setForm({
        cedula: '',
        monto: '',
        cuotas: '6',
        interes: String(config.tasa_prestamo),
        motivo: '',
      });
      showToast('Préstamo registrado.');
      refetch();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  const pagarCuota = async (p) => {
    if (p.cuotas_pagadas >= p.cuotas) return;
    const nuevas = p.cuotas_pagadas + 1;
    const estado = nuevas === p.cuotas ? 'pagado' : 'activo';
    const interesMes = Math.round(FROM_DB(p.monto) * (p.interes / 100));
    try {
      await api.updatePrestamo(p.id, { cuotas_pagadas: nuevas, estado });
      await api.createGanancia({
        descripcion: `Interés cuota ${nuevas}/${p.cuotas} — ${p.miembros?.nombre}`,
        monto: RAW(interesMes),
        tipo: 'interes',
        fecha: today(),
      });
      showToast(`Cuota ${nuevas}/${p.cuotas} registrada.`);
      refetch();
    } catch (e) {
      showToast(e.message, 'err');
    }
  };

  return (
    <>
      <div className="ph">
        <h2>Préstamos</h2>
        <p>Gestiona los préstamos a los socios</p>
      </div>
      <div style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
          + Nuevo Préstamo
        </button>
      </div>
      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
          <div className="ct">Registrar Préstamo</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field">
              <label>Cédula del socio</label>
              <input
                value={form.cedula}
                onChange={(e) => setForm({ ...form, cedula: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Monto (COP)</label>
              <input
                type="number"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Cuotas</label>
              <select
                value={form.cuotas}
                onChange={(e) => setForm({ ...form, cuotas: e.target.value })}
              >
                {[3, 6, 9, 12, 18, 24].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Interés % mensual</label>
              <input
                type="number"
                step="0.5"
                value={form.interes}
                onChange={(e) => setForm({ ...form, interes: e.target.value })}
              />
            </div>
            <div className="field ff">
              <label>Motivo</label>
              <input
                value={form.motivo}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={crear} disabled={saving}>
              {saving ? 'Guardando…' : 'Registrar'}
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      <div className="card">
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Socio</th>
                <th>Monto</th>
                <th>Cuota/mes</th>
                <th>Progreso</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {!prestamos?.length ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">
                      <div className="ei">🤝</div>Sin préstamos.
                    </div>
                  </td>
                </tr>
              ) : (
                prestamos.map((p) => {
                  const cv = Math.round(
                    (FROM_DB(p.monto) * (1 + (p.interes / 100) * p.cuotas)) /
                      p.cuotas
                  );
                  const pct = Math.round((p.cuotas_pagadas / p.cuotas) * 100);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {p.miembros?.nombre}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {p.motivo}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{COP(p.monto)}</td>
                      <td style={{ fontSize: 13 }}>{COP(RAW(cv))}</td>
                      <td style={{ minWidth: 130 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 11,
                            color: 'var(--text3)',
                            marginBottom: 3,
                          }}
                        >
                          <span>
                            {p.cuotas_pagadas}/{p.cuotas}
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="pb">
                          <div className="pf" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            p.estado === 'activo'
                              ? 'bgo'
                              : p.estado === 'pagado'
                              ? 'bg'
                              : 'bgy'
                          }`}
                        >
                          {p.estado}
                        </span>
                      </td>
                      <td>
                        {p.estado === 'activo' && (
                          <button
                            className="btn sm success"
                            onClick={() => pagarCuota(p)}
                          >
                            + Cuota
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   INVERSIONES
───────────────────────────────────────────────────────────── */
function Inversiones({ user, showToast }) {
  const { data: inversiones, refetch } = useQuery(
    () => api.getInversiones(),
    []
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    descripcion: '',
    monto: '',
    rendimiento_anual: '',
    fecha_inicio: '',
    fecha_fin: '',
  });
  const [saving, setSaving] = useState(false);

  const activas = (inversiones || []).filter((i) => i.estado === 'activo');
  const totalInv = activas.reduce((s, i) => s + FROM_DB(i.monto), 0);
  const ganAnual = activas.reduce(
    (s, i) => s + Math.round((FROM_DB(i.monto) * i.rendimiento_anual) / 100),
    0
  );

  const crear = async () => {
    if (!form.descripcion || !form.monto) {
      showToast('Completa descripción y monto.', 'err');
      return;
    }
    setSaving(true);
    try {
      await api.createInversion({
        ...form,
        monto: parseInt(form.monto) * 100,
        rendimiento_anual: parseFloat(form.rendimiento_anual) || 0,
      });
      setShowForm(false);
      setForm({
        descripcion: '',
        monto: '',
        rendimiento_anual: '',
        fecha_inicio: '',
        fecha_fin: '',
      });
      showToast('Inversión registrada.');
      refetch();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (inv) => {
    try {
      await api.updateInversion(inv.id, {
        estado: inv.estado === 'activo' ? 'cerrado' : 'activo',
      });
      showToast('Estado actualizado.');
      refetch();
    } catch (e) {
      showToast(e.message, 'err');
    }
  };

  return (
    <>
      <div className="ph">
        <h2>Inversiones</h2>
        <p>El dinero del fondo puesto a trabajar</p>
      </div>
      <div className="sg">
        <div className="sb g">
          <div className="si">💼</div>
          <div className="sl">Capital invertido</div>
          <div className="sv">{COP(RAW(totalInv))}</div>
        </div>
        <div className="sb go">
          <div className="si">📈</div>
          <div className="sl">Ganancia anual est.</div>
          <div className="sv">{COP(RAW(ganAnual))}</div>
        </div>
        <div className="sb a">
          <div className="si">🔢</div>
          <div className="sl">Inversiones activas</div>
          <div className="sv">{activas.length}</div>
        </div>
      </div>
      {user.is_admin && (
        <div style={{ marginBottom: 16 }}>
          <button
            className="btn primary"
            onClick={() => setShowForm((v) => !v)}
          >
            + Nueva Inversión
          </button>
        </div>
      )}
      {showForm && user.is_admin && (
        <div className="card" style={{ borderTop: '3px solid var(--green)' }}>
          <div className="ct">Registrar Inversión</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field ff">
              <label>Descripción</label>
              <input
                value={form.descripcion}
                onChange={(e) =>
                  setForm({ ...form, descripcion: e.target.value })
                }
                placeholder="CDT Banco Davivienda, Lote..."
              />
            </div>
            <div className="field">
              <label>Monto (COP)</label>
              <input
                type="number"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Rendimiento anual %</label>
              <input
                type="number"
                step="0.1"
                value={form.rendimiento_anual}
                onChange={(e) =>
                  setForm({ ...form, rendimiento_anual: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Fecha inicio</label>
              <input
                type="date"
                value={form.fecha_inicio}
                onChange={(e) =>
                  setForm({ ...form, fecha_inicio: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Fecha vencimiento</label>
              <input
                type="date"
                value={form.fecha_fin}
                onChange={(e) =>
                  setForm({ ...form, fecha_fin: e.target.value })
                }
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={crear} disabled={saving}>
              {saving ? 'Guardando…' : 'Registrar'}
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      <div className="card">
        {!inversiones?.length ? (
          <div className="empty">
            <div className="ei">📈</div>Sin inversiones.
          </div>
        ) : (
          inversiones.map((inv) => {
            const ga = Math.round(
              (FROM_DB(inv.monto) * inv.rendimiento_anual) / 100
            );
            return (
              <div
                key={inv.id}
                style={{
                  padding: '16px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {inv.descripcion}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text3)',
                        marginTop: 2,
                      }}
                    >
                      {inv.fecha_inicio} → {inv.fecha_fin || 'Abierto'}
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      inv.estado === 'activo' ? 'bg' : 'bgy'
                    }`}
                  >
                    {inv.estado}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 24,
                    marginTop: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text3)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Capital
                    </div>
                    <div
                      style={{
                        fontFamily: "'Playfair Display',serif",
                        fontSize: 17,
                        fontWeight: 700,
                      }}
                    >
                      {COP(inv.monto)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text3)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Rendimiento
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: 'var(--green2)',
                      }}
                    >
                      {inv.rendimiento_anual}% anual
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text3)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Ganancia est./año
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: 'var(--gold2)',
                      }}
                    >
                      {COP(RAW(ga))}
                    </div>
                  </div>
                </div>
                {user.is_admin && (
                  <button
                    className="btn sm ghost"
                    style={{ marginTop: 10 }}
                    onClick={() => toggle(inv)}
                  >
                    {inv.estado === 'activo' ? 'Cerrar inversión' : 'Reactivar'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   GANANCIAS
───────────────────────────────────────────────────────────── */
function Ganancias({ user, showToast }) {
  const { data: ganancias, refetch } = useQuery(() => api.getGanancias(), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    descripcion: '',
    monto: '',
    tipo: 'rendimiento',
  });
  const [saving, setSaving] = useState(false);

  const total = (ganancias || []).reduce((s, g) => s + FROM_DB(g.monto), 0);
  const porTipo = (ganancias || []).reduce((acc, g) => {
    acc[g.tipo] = (acc[g.tipo] || 0) + FROM_DB(g.monto);
    return acc;
  }, {});

  const y = new Date().getFullYear();
  const mi = new Date().getMonth();
  const chartMeses = Array.from({ length: 6 }, (_, i) => {
    const idx = (mi - 5 + i + 12) % 12;
    const key = `${y}-${String(idx + 1).padStart(2, '0')}`;
    return {
      label: MESES[idx].slice(0, 3),
      total: (ganancias || [])
        .filter((g) => g.fecha?.startsWith(key))
        .reduce((s, g) => s + FROM_DB(g.monto), 0),
    };
  });
  const maxC = Math.max(...chartMeses.map((m) => m.total), 1);

  const registrar = async () => {
    if (!form.descripcion || !form.monto) {
      showToast('Completa todos los campos.', 'err');
      return;
    }
    setSaving(true);
    try {
      await api.createGanancia({
        ...form,
        monto: parseInt(form.monto) * 100,
        fecha: today(),
      });
      setShowForm(false);
      setForm({ descripcion: '', monto: '', tipo: 'rendimiento' });
      showToast('Ganancia registrada.');
      refetch();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="ph">
        <h2>Ganancias</h2>
        <p>Rendimientos, intereses y otros ingresos del fondo</p>
      </div>
      <div className="sg">
        <div className="sb g">
          <div className="si">💰</div>
          <div className="sl">Total ganancias</div>
          <div className="sv">{COP(RAW(total))}</div>
        </div>
        <div className="sb go">
          <div className="si">📈</div>
          <div className="sl">Rendimientos</div>
          <div className="sv">{COP(RAW(porTipo.rendimiento || 0))}</div>
        </div>
        <div className="sb a">
          <div className="si">🤝</div>
          <div className="sl">Intereses préstamos</div>
          <div className="sv">{COP(RAW(porTipo.interes || 0))}</div>
        </div>
        <div className="sb p">
          <div className="si">✨</div>
          <div className="sl">Otros</div>
          <div className="sv">{COP(RAW(porTipo.otro || 0))}</div>
        </div>
      </div>
      <div className="card">
        <div className="ct">Últimos 6 meses</div>
        <div className="cbw">
          {chartMeses.map((m) => (
            <div key={m.label} className="cbc">
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                {m.total > 0 ? COP(RAW(m.total)) : ''}
              </div>
              <div
                className="cbr"
                style={{ height: `${Math.max((m.total / maxC) * 100, 4)}%` }}
              />
              <div className="cbl">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
      {user.is_admin && (
        <div style={{ marginBottom: 16 }}>
          <button
            className="btn primary"
            onClick={() => setShowForm((v) => !v)}
          >
            + Registrar Ganancia
          </button>
        </div>
      )}
      {showForm && user.is_admin && (
        <div className="card" style={{ borderTop: '3px solid var(--green)' }}>
          <div className="ct">Nueva Ganancia</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field ff">
              <label>Descripción</label>
              <input
                value={form.descripcion}
                onChange={(e) =>
                  setForm({ ...form, descripcion: e.target.value })
                }
                placeholder="Rendimiento CDT trimestre 1..."
              />
            </div>
            <div className="field">
              <label>Monto (COP)</label>
              <input
                type="number"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <option value="rendimiento">Rendimiento inversión</option>
                <option value="interes">Interés préstamo</option>
                <option value="otro">Otro ingreso</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              className="btn primary"
              onClick={registrar}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      <div className="card">
        <div className="ct">Historial de Ganancias</div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {!ganancias?.length ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty">
                      <div className="ei">💰</div>Sin ganancias registradas.
                    </div>
                  </td>
                </tr>
              ) : (
                ganancias.map((g) => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 500 }}>{g.descripcion}</td>
                    <td>
                      <span
                        className={`badge ${
                          g.tipo === 'rendimiento'
                            ? 'bg'
                            : g.tipo === 'interes'
                            ? 'bb'
                            : 'bp'
                        }`}
                      >
                        {g.tipo}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--green2)' }}>
                      {COP(g.monto)}
                    </td>
                    <td style={{ fontSize: 12 }}>{g.fecha}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!user.is_admin && (
        <div className="al info" style={{ marginTop: 4 }}>
          ℹ️ Las ganancias se distribuyen proporcionalmente al saldo de cada
          socio. Tu parte estimada la ves en tu dashboard.
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — MIEMBROS
───────────────────────────────────────────────────────────── */
function AdminMiembros({ showToast }) {
  const { data: miembros, refetch } = useQuery(() => api.getMiembros(), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', cedula: '', saldo: '0' });
  const [saving, setSaving] = useState(false);

  const crear = async () => {
    if (!form.nombre || !form.cedula) {
      showToast('Nombre y cédula obligatorios.', 'err');
      return;
    }
    setSaving(true);
    try {
      await api.createMiembro({
        nombre: form.nombre.trim(),
        cedula: form.cedula.trim(),
        saldo: parseInt(form.saldo || '0') * 100,
        activo: true,
        fecha_ingreso: today(),
        is_admin: false,
      });
      setShowForm(false);
      setForm({ nombre: '', cedula: '', saldo: '0' });
      showToast('Miembro creado.');
      refetch();
    } catch (e) {
      showToast(
        e.message === 'duplicate key' ? 'Cédula ya registrada.' : e.message,
        'err'
      );
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (m) => {
    try {
      await api.updateMiembro(m.id, { activo: !m.activo });
      showToast(`Miembro ${!m.activo ? 'activado' : 'desactivado'}.`);
      refetch();
    } catch (e) {
      showToast(e.message, 'err');
    }
  };

  const editSaldo = async (m, val) => {
    try {
      await api.updateMiembro(m.id, { saldo: parseInt(val || '0') * 100 });
      showToast('Saldo actualizado.');
      refetch();
    } catch (e) {
      showToast(e.message, 'err');
    }
  };

  const activos = (miembros || []).filter(
    (m) => !m.is_admin && m.activo
  ).length;
  const inactivos = (miembros || []).filter(
    (m) => !m.is_admin && !m.activo
  ).length;

  return (
    <>
      <div className="ph">
        <h2>Miembros</h2>
        <p>
          {activos} activos · {inactivos} inactivos
        </p>
      </div>
      <div style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
          + Agregar Miembro
        </button>
      </div>
      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
          <div className="ct">Nuevo Miembro</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field">
              <label>Nombre Completo</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Cédula</label>
              <input
                value={form.cedula}
                onChange={(e) => setForm({ ...form, cedula: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Saldo Inicial (COP)</label>
              <input
                type="number"
                value={form.saldo}
                onChange={(e) => setForm({ ...form, saldo: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={crear} disabled={saving}>
              {saving ? 'Creando…' : 'Crear'}
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      <div className="card">
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Miembro</th>
                <th>Cédula</th>
                <th>Saldo</th>
                <th>Ingresó</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(miembros || [])
                .filter((m) => !m.is_admin)
                .map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.nombre}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {m.cedula}
                    </td>
                    <td>
                      <input
                        type="number"
                        defaultValue={Math.round(FROM_DB(m.saldo))}
                        onBlur={(e) => editSaldo(m, e.target.value)}
                        style={{
                          width: 130,
                          padding: '6px 10px',
                          background: 'var(--surface2)',
                          border: '1.5px solid var(--border)',
                          borderRadius: 'var(--rs)',
                          color: 'var(--text)',
                          fontSize: 13,
                          fontFamily: 'Outfit,sans-serif',
                        }}
                      />
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {m.fecha_ingreso}
                    </td>
                    <td>
                      <span className={`badge ${m.activo ? 'bg' : 'br'}`}>
                        {m.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`btn sm ${m.activo ? 'danger' : 'success'}`}
                        onClick={() => toggle(m)}
                      >
                        {m.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — RETIRO
───────────────────────────────────────────────────────────── */
function AdminRetiro({ showToast }) {
  const { data: miembros, refetch } = useQuery(() => api.getMiembros(), []);
  const [cedula, setCedula] = useState('');
  const [motivo, setMotivo] = useState('');
  const [found, setFound] = useState(null);
  const [saving, setSaving] = useState(false);

  const buscar = async () => {
    const m = await api.getMiembroByCedula(cedula.trim());
    setFound(m && !m.is_admin ? m : null);
    if (!m || m.is_admin) showToast('Miembro no encontrado.', 'err');
  };

  const retirar = async () => {
    if (!found || !motivo) return;
    if (
      !window.confirm(
        `¿Confirmar retiro de ${found.nombre}?\nSe liquidará su saldo de ${COP(
          found.saldo
        )}`
      )
    )
      return;
    setSaving(true);
    try {
      await api.updateMiembro(found.id, {
        activo: false,
        motivo_retiro: motivo,
        fecha_retiro: today(),
        saldo_liquidado: found.saldo,
        saldo: 0,
      });
      showToast(`${found.nombre} retirado del fondo.`);
      setFound(null);
      setCedula('');
      setMotivo('');
      refetch();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  const retirados = (miembros || []).filter(
    (m) => !m.is_admin && !m.activo && m.motivo_retiro
  );

  return (
    <>
      <div className="ph">
        <h2>Retiro de Socio</h2>
        <p>Procesar la salida definitiva de un ahorrador</p>
      </div>
      <div className="card" style={{ borderTop: '3px solid var(--red)' }}>
        <div className="ct">⚠️ Proceso de Retiro</div>
        <div className="cs">
          Esta acción es irreversible. El saldo será liquidado.
        </div>
        <div className="fg" style={{ marginTop: 16 }}>
          <div className="field">
            <label>Cédula</label>
            <input
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="12345678"
            />
          </div>
          <div
            className="field"
            style={{ display: 'flex', alignItems: 'flex-end' }}
          >
            <button
              className="btn primary"
              style={{ width: '100%' }}
              onClick={buscar}
            >
              Buscar
            </button>
          </div>
        </div>
        {found && (
          <>
            <div className="al warn" style={{ marginTop: 12 }}>
              <div>
                <strong>{found.nombre}</strong> · CC {found.cedula}
                <br />
                Saldo a liquidar: <strong>{COP(found.saldo)}</strong> · Socio
                desde {found.fecha_ingreso}
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Motivo del retiro</label>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Retiro voluntario, traslado..."
              />
            </div>
            <button
              className="btn danger"
              style={{ marginTop: 14 }}
              onClick={retirar}
              disabled={saving}
            >
              {saving ? 'Procesando…' : 'Confirmar Retiro Definitivo'}
            </button>
          </>
        )}
      </div>
      {retirados.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="ct">Socios Retirados</div>
          {retirados.map((m) => (
            <div className="mr" key={m.id}>
              <div
                className="mav"
                style={{ background: 'var(--surface2)', color: 'var(--text3)' }}
              >
                {initials(m.nombre)}
              </div>
              <div className="mi2">
                <div className="nm">{m.nombre}</div>
                <div className="mt">
                  {m.motivo_retiro} · {m.fecha_retiro} · Liquidado:{' '}
                  {COP(m.saldo_liquidado || 0)}
                </div>
              </div>
              <span className="badge br">Retirado</span>
            </div>
          ))}
        </div>
      )}
      <SpeedInsights />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — CONFIGURACIÓN
───────────────────────────────────────────────────────────── */
function AdminConfig({ config, setConfig, showToast }) {
  const [form, setForm] = useState({
    nombre_fondo: config.nombre_fondo,
    monto_mensual: String(Math.round(FROM_DB(config.monto_mensual))),
    tasa_prestamo: String(config.tasa_prestamo),
  });
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    setSaving(true);
    try {
      const patch = {
        nombre_fondo: form.nombre_fondo,
        monto_mensual: parseInt(form.monto_mensual || '0') * 100,
        tasa_prestamo: parseFloat(form.tasa_prestamo) || 2,
      };
      await api.updateConfig(patch);
      setConfig({ ...config, ...patch });
      showToast('Configuración guardada.');
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="ph">
        <h2>Configuración</h2>
        <p>Ajustes generales del fondo</p>
      </div>
      <div className="card">
        <div className="ct">Parámetros del Fondo</div>
        <div className="cfg-grid" style={{ marginTop: 16 }}>
          <div className="field">
            <label>Nombre del fondo</label>
            <input
              value={form.nombre_fondo}
              onChange={(e) =>
                setForm({ ...form, nombre_fondo: e.target.value })
              }
            />
          </div>
          <div className="field">
            <label>Aporte mensual (COP)</label>
            <input
              type="number"
              value={form.monto_mensual}
              onChange={(e) =>
                setForm({ ...form, monto_mensual: e.target.value })
              }
            />
          </div>
          <div className="field">
            <label>Tasa préstamos % mensual</label>
            <input
              type="number"
              step="0.5"
              value={form.tasa_prestamo}
              onChange={(e) =>
                setForm({ ...form, tasa_prestamo: e.target.value })
              }
            />
          </div>
        </div>
        <button
          className="btn primary"
          style={{ marginTop: 16 }}
          onClick={guardar}
          disabled={saving}
        >
          {saving ? 'Guardando…' : 'Guardar Cambios'}
        </button>
      </div>
      <div className="card">
        <div className="ct">ℹ️ Credenciales Supabase</div>
        <div className="al info" style={{ marginTop: 12 }}>
          Recuerda reemplazar <strong>SUPABASE_URL</strong> y{' '}
          <strong>SUPABASE_ANON</strong> al inicio del archivo con tus
          credenciales reales de Supabase para que los datos persistan.
        </div>
      </div>
    </>
  );
}
