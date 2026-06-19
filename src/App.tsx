import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ayxbhcrokrlavkbmlmjx.supabase.co'; // ← Nuevo proyecto Supabase para CashDave II
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eGJoY3Jva3JsYXZrYm1sbWp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTM0NTEsImV4cCI6MjA5NjYyOTQ1MX0.pRrmhmlLSIqpbdcmNk19cV9yUKkCyojBH7L8VuCLa_s'; // ← anon key del nuevo proyecto

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const COP = (n) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n || 0);

// Todos los montos se guardan en PESOS directamente en Supabase
// RAW y FROM_DB NO multiplican/dividen — son identidad
const RAW = (n) => Math.round(n || 0);
const FROM_DB = (n) => Math.round(n || 0);

// Los 12 meses del fondo en orden, con su año correcto
const MESES_FONDO = [
  'Junio 2026',
  'Julio 2026',
  'Agosto 2026',
  'Septiembre 2026',
  'Octubre 2026',
  'Noviembre 2026',
  'Diciembre 2026',
  'Enero 2027',
  'Febrero 2027',
  'Marzo 2027',
  'Abril 2027',
  'Mayo 2027',
  'Junio 2027',
];

// Abreviaturas para el calendario
const MESES_ABR = ['Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun-27'];

// Mes actual como string "Marzo 2026"
const mesActual = () => {
  const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const d = new Date();
  return `${nombres[d.getMonth()]} ${d.getFullYear()}`;
};

// Índice del mes actual dentro de MESES_FONDO (-1 si no encontrado)
const idxMesActual = () => MESES_FONDO.indexOf(mesActual());

const initials = (n) =>
  (n || '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const today = () => new Date().toISOString().split('T')[0];

// ─── Utilidades de imagen (anti-blank-screen en mobile) ───
const MAX_IMAGE_MB = 15;
const isImageFile = (f) => {
  if (!f) return false;
  if (f.type && f.type.startsWith('image/')) return true;
  // Algunos browsers Android/iPhone no setean type bien; fallback por extension
  return /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(f.name || '');
};
const validateImage = (f) => {
  if (!f) return 'No se selecciono ningun archivo.';
  if (!isImageFile(f)) return 'Selecciona una imagen valida (JPG, PNG, WEBP o HEIC).';
  if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
    const mb = (f.size / 1024 / 1024).toFixed(1);
    return `La imagen pesa ${mb} MB. Maximo permitido: ${MAX_IMAGE_MB} MB. Reduce el tamaño desde tu galeria.`;
  }
  return null;
};
const revokeIfBlob = (url, defer = false) => {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    if (defer) {
      // Diferir para que React termine de desmontar el <img> del DOM
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 100);
    } else {
      try { URL.revokeObjectURL(url); } catch (_) { /* noop */ }
    }
  }
};

/* ─────────────────────────────────────────────────────────────
   ERROR BOUNDARY — Evita pantallas en blanco por errores no atrapados
───────────────────────────────────────────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  reset = () => this.setState({ hasError: false, error: null });
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, marginBottom: 8 }}>Algo salio mal</h3>
            <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              La aplicacion encontro un error. Esto puede ocurrir si la imagen es muy grande o tu conexion fallo.
            </p>
            {this.state.error?.message && (
              <pre style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', padding: 10, borderRadius: 8, overflow: 'auto', marginBottom: 16, textAlign: 'left' }}>
                {String(this.state.error.message).slice(0, 240)}
              </pre>
            )}
            <button className="btn primary" onClick={this.reset}>Reintentar</button>
            <button className="btn ghost" style={{ marginLeft: 8 }} onClick={() => window.location.reload()}>Recargar pagina</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

  useEffect(() => { run(); }, [run]);
  return { data, loading, error, refetch: run };
}

/* ─────────────────────────────────────────────────────────────
   API
───────────────────────────────────────────────────────────── */
const api = {
  async getConfig() {
    const { data } = await supabase.from('config').select('*').single();
    return data;
  },
  async updateConfig(patch) {
    await supabase.from('config').update(patch).eq('id', 1);
  },
  async getMiembros() {
    const { data } = await supabase.from('miembros').select('*').order('nombre');
    return data || [];
  },
  async getMiembroByCedula(cedula) {
    const { data } = await supabase.from('miembros').select('*').eq('cedula', cedula).single();
    return data;
  },
  async createMiembro(m) {
    const { error } = await supabase.from('miembros').insert(m);
    if (error) throw new Error(error.message);
  },
  async updateMiembro(id, patch) {
    const { error } = await supabase.from('miembros').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  },
  async getAportes(filter = {}) {
    let q = supabase.from('aportes').select('*, miembros(nombre,cedula,saldo)').order('created_at', { ascending: false });
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
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${miembroId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('comprobantes').upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('comprobantes').getPublicUrl(path);
    return data.publicUrl;
  },
  async uploadMedia(file, userId) {
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('media').getPublicUrl(path);
    return data.publicUrl;
  },
  async getPrestamos(filter = {}) {
    let q = supabase.from('prestamos').select('*, miembros(nombre,cedula)').order('created_at', { ascending: false });
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
    const { error } = await supabase.from('prestamos').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  },
  async getInversiones() {
    const { data } = await supabase.from('inversiones').select('*').order('created_at', { ascending: false });
    return data || [];
  },
  async createInversion(i) {
    const { error } = await supabase.from('inversiones').insert(i);
    if (error) throw new Error(error.message);
  },
  async updateInversion(id, patch) {
    const { error } = await supabase.from('inversiones').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  },
  async getGanancias() {
    const { data } = await supabase.from('ganancias').select('*').order('fecha', { ascending: false });
    return data || [];
  },
  async createGanancia(g) {
    const { error } = await supabase.from('ganancias').insert(g);
    if (error) throw new Error(error.message);
  },
  async updateGanancia(id, patch) {
    const { error } = await supabase.from('ganancias').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  },
  async deleteGanancia(id) {
    const { error } = await supabase.from('ganancias').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ALIANZAS
  async getAlianzas() {
    const { data } = await supabase.from('alianzas').select('*').order('created_at', { ascending: false });
    return data || [];
  },
  async createAlianza(a) {
    const { error } = await supabase.from('alianzas').insert(a);
    if (error) throw new Error(error.message);
  },
  async updateAlianza(id, patch) {
    const { error } = await supabase.from('alianzas').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  },

  // NOTICIAS
  async getNoticias() {
    const { data } = await supabase.from('noticias').select('*, miembros(nombre)').order('created_at', { ascending: false });
    return data || [];
  },
  async createNoticia(n) {
    const { error } = await supabase.from('noticias').insert(n);
    if (error) throw new Error(error.message);
  },
  async updateNoticia(id, patch) {
    const { error } = await supabase.from('noticias').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  },

  // EVENTOS
  async getEventos() {
    const { data } = await supabase.from('eventos').select('*, miembros(nombre)').order('fecha_evento', { ascending: true });
    return data || [];
  },
  async createEvento(e) {
    const { error } = await supabase.from('eventos').insert(e);
    if (error) throw new Error(error.message);
  },
  async updateEvento(id, patch) {
    const { error } = await supabase.from('eventos').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  },

  // MERCH
  async getMerch() {
    const { data } = await supabase.from('merch').select('*').order('created_at', { ascending: false });
    return data || [];
  },
  async createMerch(m) {
    const { error } = await supabase.from('merch').insert(m);
    if (error) throw new Error(error.message);
  },
  async updateMerch(id, patch) {
    const { error } = await supabase.from('merch').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  },

  // CAPITAL EXTRAORDINARIO
  async getCapitalExt() {
    const { data } = await supabase.from('capital_extraordinario').select('*').order('created_at', { ascending: false });
    return data || [];
  },
  async createCapitalExt(c) {
    const { error } = await supabase.from('capital_extraordinario').insert(c);
    if (error) throw new Error(error.message);
  },
  async updateCapitalExt(id, patch) {
    const { error } = await supabase.from('capital_extraordinario').update(patch).eq('id', id);
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

.ph{margin-bottom:24px}
.ph h2{font-family:'Playfair Display',serif;font-size:24px;font-weight:700}
.ph p{color:var(--text2);font-size:14px;margin-top:4px}

.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:24px;margin-bottom:16px}
.ch{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.ct{font-family:'Playfair Display',serif;font-size:16px;font-weight:600}
.cs{color:var(--text2);font-size:13px;margin-top:2px}

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

.sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px;margin-bottom:16px}
.sb{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px;transition:border-color .2s}
.sb:hover{border-color:var(--border2)}
.sb .si{font-size:20px;margin-bottom:8px}
.sb .sl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin-bottom:5px}
.sb .sv{font-family:'Playfair Display',serif;font-size:20px;font-weight:700}
.sb.a{border-left:3px solid var(--accent)}.sb.g{border-left:3px solid var(--green)}
.sb.go{border-left:3px solid var(--gold)}.sb.r{border-left:3px solid var(--red)}.sb.p{border-left:3px solid var(--purple)}

.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.bg{background:rgba(16,185,129,.12);color:var(--green2);border:1px solid rgba(16,185,129,.2)}
.bgo{background:rgba(245,158,11,.12);color:var(--gold2);border:1px solid rgba(245,158,11,.2)}
.br{background:rgba(239,68,68,.1);color:var(--red2);border:1px solid rgba(239,68,68,.2)}
.bb{background:rgba(59,130,246,.1);color:var(--accent2);border:1px solid rgba(59,130,246,.2)}
.bgy{background:rgba(100,116,139,.12);color:#94a3b8;border:1px solid rgba(100,116,139,.2)}
.bp{background:rgba(139,92,246,.1);color:#c4b5fd;border:1px solid rgba(139,92,246,.2)}

.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13.5px}
thead th{text-align:left;padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--text3);background:var(--surface2);border-bottom:1px solid var(--border)}
tbody td{padding:13px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:rgba(255,255,255,.02)}

.fg{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:540px){.fg{grid-template-columns:1fr}}
.ff{grid-column:1/-1}
.field label{display:block;font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text2);margin-bottom:7px}
.field input,.field select,.field textarea{width:100%;padding:11px 14px;background:var(--surface2);
  border:1.5px solid var(--border);border-radius:var(--rs);color:var(--text);font-size:14px;outline:none;transition:border-color .2s}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--accent)}
.field input::placeholder,.field textarea::placeholder{color:var(--text3)}
.field select option{background:var(--surface2)}

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
.btn.ok{background:rgba(16,185,129,.15);color:var(--green2);border:1px solid rgba(16,185,129,.25)}
.btn.ok:hover{background:rgba(16,185,129,.25)}
.btn.sm{padding:6px 14px;font-size:12px}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none!important}

.uz{border:2px dashed var(--border2);border-radius:var(--r);padding:28px;text-align:center;
  cursor:pointer;transition:border-color .2s,background .2s;background:var(--surface2)}
.uz:hover,.uz.drag{border-color:var(--accent);background:rgba(59,130,246,.05)}
.uz .ui{font-size:32px;margin-bottom:10px}
.uz p{color:var(--text2);font-size:13px}
.uz strong{color:var(--accent2)}
.prev{width:100%;max-height:220px;object-fit:contain;border-radius:var(--rs);border:1px solid var(--border);margin-top:12px}

.mgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:16px}
@media(max-width:600px){.mgrid{grid-template-columns:repeat(4,1fr)}}
.mc{padding:14px 8px;border-radius:var(--rs);border:1px solid var(--border);text-align:center;transition:all .2s}
.mc.paid{background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.25)}
.mc.pend{background:rgba(245,158,11,.07);border-color:rgba(245,158,11,.25)}
.mc.miss{background:rgba(239,68,68,.05);border-color:rgba(239,68,68,.15)}
.mc.rech{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.3)}
.mc.curr{border-color:var(--accent);background:rgba(59,130,246,.07)}
.mc.fut{opacity:.3}
.mc-n{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin-bottom:6px}
.mc-i{font-size:18px}
.mc-s{font-size:10px;font-weight:700;margin-top:5px}
.mc.paid .mc-s{color:var(--green2)}.mc.pend .mc-s{color:var(--gold2)}.mc.miss .mc-s{color:var(--red2)}.mc.rech .mc-s{color:var(--red2)}.mc.curr .mc-s{color:var(--accent2)}

.al{padding:13px 16px;border-radius:var(--rs);font-size:13.5px;display:flex;gap:10px;align-items:flex-start;margin-bottom:14px}
.al.info{background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);color:var(--accent2)}
.al.warn{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);color:var(--gold2)}
.al.ok{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);color:var(--green2)}
.al.err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:var(--red2)}

.pb{height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:6px}
.pf{height:100%;background:linear-gradient(90deg,var(--accent),var(--purple));border-radius:3px;transition:width .6s}

.mr{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--border)}
.mr:last-child{border-bottom:none}
.mav{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));
  display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}
.mi2{flex:1;min-width:0}
.mi2 .nm{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mi2 .mt{font-size:12px;color:var(--text3)}

.lb{position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);z-index:300;
  display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out}
.lb img{max-width:100%;max-height:90vh;border-radius:10px;box-shadow:var(--shadow)}
.pt{width:48px;height:36px;object-fit:cover;border-radius:5px;border:1px solid var(--border);cursor:zoom-in}

.toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
  background:var(--green);color:#fff;padding:13px 24px;border-radius:12px;
  font-weight:600;font-size:14px;z-index:999;box-shadow:0 8px 30px rgba(16,185,129,.4);
  animation:fadeUp .3s;white-space:nowrap;max-width:90vw;text-align:center}
.toast.err{background:var(--red);box-shadow:0 8px 30px rgba(239,68,68,.4)}

.spin{display:flex;align-items:center;justify-content:center;padding:60px;color:var(--text3);gap:12px;font-size:14px}
.spin::before{content:'';width:24px;height:24px;border:2px solid var(--border2);border-top-color:var(--accent);
  border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}

.cbw{display:flex;align-items:flex-end;gap:8px;height:120px;margin-top:12px}
.cbc{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.cbr{width:100%;border-radius:5px 5px 0 0;background:linear-gradient(180deg,var(--purple),var(--accent));min-height:4px;transition:height .6s}
.cbl{font-size:10px;color:var(--text3);text-align:center}

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
  const [toast, setToast] = useState(null);
  const [light, setLight] = useState(null);
  const [config, setConfig] = useState(null);

  useEffect(() => { api.getConfig().then((c) => setConfig(c)); }, []);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const logout = () => { setUser(null); setTab('home'); };

  const adminNav = [
    { id: 'home', icon: '📊', label: 'Dashboard' },
    { id: 'miembros', icon: '👥', label: 'Miembros' },
    { id: 'aportes', icon: '💳', label: 'Aportes' },
    { id: 'prestamos', icon: '🤝', label: 'Préstamos' },
    { id: 'inversiones', icon: '📈', label: 'Inversiones' },
    { id: 'ganancias', icon: '💰', label: 'Ganancias' },
    { id: 'retiro', icon: '🚪', label: 'Retiro socio' },
    { id: 'capital', icon: '💵', label: 'Capital Externo' },
    { id: 'alianzas', icon: '🤜', label: 'Alianzas' },
    { id: 'noticias', icon: '📰', label: 'Noticias' },
    { id: 'eventos', icon: '🗓️', label: 'Eventos' },
    { id: 'merch', icon: '👕', label: 'Merch' },
    { id: 'config', icon: '⚙️', label: 'Configuración' },
  ];
  const memberNav = [
    { id: 'home', icon: '📊', label: 'Mi Saldo' },
    { id: 'aportes', icon: '💳', label: 'Mis Aportes' },
    { id: 'prestamos', icon: '🤝', label: 'Mis Préstamos' },
    { id: 'inversiones', icon: '📈', label: 'Inversiones' },
    { id: 'ganancias', icon: '💰', label: 'Ganancias' },
    { id: 'alianzas', icon: '🤜', label: 'Alianzas' },
    { id: 'noticias', icon: '📰', label: 'Noticias' },
    { id: 'eventos', icon: '🗓️', label: 'Eventos' },
    { id: 'merch', icon: '👕', label: 'Merch' },
  ];
  const navItems = user?.is_admin ? adminNav : memberNav;

  if (!config)
    return (
      <>
        <style>{CSS}</style>
        <div className="spin" style={{ height: '100vh' }}>Cargando CashDave II...</div>
      </>
    );

  if (!user)
    return (
      <>
        <style>{CSS}</style>
        <AuthScreen config={config} onLogin={setUser} showToast={showToast} />
        {toast && <div className={`toast ${toast.type === 'err' ? 'err' : ''}`}>{toast.msg}</div>}
      </>
    );

  return (
    <>
      <style>{CSS}</style>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mmb" onClick={() => setNav((v) => !v)}>☰</button>
            <div className="tl"><img src="/logo_fondo.jpg" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} /></div>
            <span className="tn">{config.nombre_fondo}</span>
            {user.is_admin && <span className="badge bp">Admin</span>}
          </div>
          <div className="topbar-right">
            <div className="uc">
              <div className="av">{initials(user.nombre)}</div>
              <span>{user.nombre.split(' ')[0]}</span>
            </div>
            <button className="btn-exit" onClick={logout}>Salir</button>
          </div>
        </header>

        <div className={`overlay ${nav ? 'show' : ''}`} onClick={() => setNav(false)} />

        <nav className={`sidebar ${nav ? 'open' : ''}`}>
          <div className="nav-sec">Menú</div>
          {navItems.map((n) => (
            <button key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`}
              onClick={() => { setTab(n.id); setNav(false); }}>
              <span className="ni">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>

        <main className="content-area" style={{ maxWidth: 920, margin: '0 auto' }}>
          <ErrorBoundary key={tab}>
            {tab === 'home' && (user.is_admin
              ? <AdminDash user={user} config={config} setTab={setTab} showToast={showToast} />
              : <MemberDash user={user} config={config} />)}
            {tab === 'aportes' && (user.is_admin
              ? <AdminAportes config={config} showToast={showToast} setLight={setLight} />
              : <MisAportes user={user} config={config} showToast={showToast} />)}
            {tab === 'prestamos' && (user.is_admin
              ? <AdminPrestamos config={config} showToast={showToast} />
              : <MisPrestamos user={user} config={config} showToast={showToast} />)}
            {tab === 'inversiones' && <Inversiones user={user} showToast={showToast} />}
            {tab === 'ganancias' && <Ganancias user={user} showToast={showToast} />}
            {tab === 'miembros' && user.is_admin && <AdminMiembros showToast={showToast} />}
            {tab === 'retiro' && user.is_admin && <AdminRetiro showToast={showToast} />}
            {tab === 'capital' && user.is_admin && <AdminCapitalExt showToast={showToast} />}
            {tab === 'alianzas' && <Alianzas user={user} showToast={showToast} />}
            {tab === 'noticias' && <Noticias user={user} showToast={showToast} setLight={setLight} />}
            {tab === 'eventos' && <Eventos user={user} showToast={showToast} setLight={setLight} />}
            {tab === 'merch' && <Merch user={user} showToast={showToast} setLight={setLight} />}
            {tab === 'config' && user.is_admin && <AdminConfig config={config} setConfig={setConfig} showToast={showToast} />}
          </ErrorBoundary>
        </main>
      </div>

      {toast && <div className={`toast ${toast.type === 'err' ? 'err' : ''}`}>{toast.msg}</div>}
      {light && (
        <div className="lb" onClick={() => setLight(null)}>
          <img src={light} alt="comprobante" onClick={(e) => e.stopPropagation()} />
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
        setError(m ? 'Tu cuenta está inactiva. Contacta al administrador.' : 'Cédula no encontrada en el fondo.');
    } catch (e) {
      setError('Error de conexión. Verifica tu internet.');
      showToast('Error al conectar con Supabase.', 'err');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-brand">
          <div className="lr"><img src="/logo_fondo.jpg" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} /></div>
          <h1>{config?.nombre_fondo || 'Fondo Solidario'}</h1>
          <p>Ingresa con tu número de cédula</p>
        </div>
        <div className="auth-field">
          <label>Número de Cédula</label>
          <input value={cedula} onChange={(e) => setCedula(e.target.value)}
            placeholder="Ej: 12345678" onKeyDown={(e) => e.key === 'Enter' && login()} autoFocus />
        </div>
        <button className="btn-main" onClick={login} disabled={loading}>
          {loading ? 'Verificando…' : 'Entrar al Fondo'}
        </button>
        {error && <div className="err-msg">{error}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MEMBER DASHBOARD
───────────────────────────────────────────────────────────── */
function MemberDash({ user, config }) {
  const { data: miembro, loading } = useQuery(() => api.getMiembroByCedula(user.cedula), [user.id]);
  const { data: aportes } = useQuery(() => api.getAportes({ miembro_id: user.id }), [user.id]);
  const { data: prestamos } = useQuery(() => api.getPrestamos({ miembro_id: user.id }), [user.id]);
  const { data: ganancias } = useQuery(() => api.getGanancias(), []);
  const { data: allMiembros } = useQuery(() => api.getMiembros(), []);

  if (loading) return <div className="spin">Cargando tu información…</div>;

  const mes = mesActual();
  const misAportes = (aportes || []).filter((a) => a.estado === 'confirmado');
  const pagadoMes = (aportes || []).some((a) => a.mes === mes && a.estado === 'confirmado');
  const pendiente = (aportes || []).some((a) => a.mes === mes && a.estado === 'pendiente');
  const prestAct = (prestamos || []).filter((p) => p.estado === 'activo');

  // Total aportado = suma directa de montos en pesos
  const totalAportado = misAportes.reduce((s, a) => s + FROM_DB(a.monto), 0);

  const totalFondo = (allMiembros || [])
    .filter((m) => !m.is_admin && m.activo)
    .reduce((s, m) => s + FROM_DB(m.saldo), 0);

  const totalGanancias = (ganancias || []).reduce((s, g) => s + FROM_DB(g.monto), 0);
  const saldo = FROM_DB(miembro?.saldo || 0);
  const proporcion = totalFondo > 0 ? saldo / totalFondo : 0;
  const gananciaEst = Math.round(proporcion * totalGanancias);

  return (
    <>
      {!pagadoMes && !pendiente && (
        <div className="al warn">
          ⚠️ No has registrado tu aporte de <strong>{mes}</strong>. Ve a "Mis Aportes".
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
        <div className="bh-amt">{COP(saldo)}</div>
        <div className="bh-meta">
          <div className="bh-mi">
            <label>Total aportado</label>
            <span>{COP(totalAportado)}</span>
          </div>
          <div className="bh-mi">
            <label>Meses pagados</label>
            <span>{misAportes.length}</span>
          </div>
          <div className="bh-mi">
            <label>Parte de ganancias</label>
            <span>{COP(gananciaEst)}</span>
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
          <div className="sv">{COP(user.monto_mensual || config.monto_mensual)}</div>
        </div>
        <div className="sb a">
          <div className="si">🤝</div>
          <div className="sl">Préstamos activos</div>
          <div className="sv">{prestAct.length}</div>
        </div>
        <div className="sb g">
          <div className="si">💰</div>
          <div className="sl">Ganancia estimada</div>
          <div className="sv" style={{ fontSize: 16 }}>{COP(gananciaEst)}</div>
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
            const cuota = Math.round((FROM_DB(p.monto) * (1 + (p.interes / 100) * p.cuotas)) / p.cuotas);
            const pct = Math.round((p.cuotas_pagadas / p.cuotas) * 100);
            return (
              <div key={p.id} style={{ marginBottom: 18, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{COP(FROM_DB(p.monto))}</span>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                    Cuota {p.cuotas_pagadas}/{p.cuotas} · {COP(cuota)}/mes
                  </span>
                </div>
                <div className="pb"><div className="pf" style={{ width: `${pct}%` }} /></div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
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
    (aportes || []).filter((a) => a.mes === mes && a.estado === 'confirmado').map((a) => a.miembro_id)
  ).size;
  const pendientesConf = (aportes || []).filter((a) => a.estado === 'pendiente').length;
  const totalSaldos = activos.reduce((s, m) => s + FROM_DB(m.saldo), 0);
  const totalInv = (inversiones || []).filter((i) => i.estado === 'activo').reduce((s, i) => s + FROM_DB(i.monto), 0);
  const totalPrest = (prestamos || []).filter((p) => p.estado === 'activo').reduce((s, p) => s + FROM_DB(p.monto), 0);
  const totalGanancias = (ganancias || []).reduce((s, g) => s + FROM_DB(g.monto), 0);

  return (
    <>
      <div className="ph">
        <h2>Panel General</h2>
        <p>{mes} · {activos.length} socios activos</p>
      </div>

      {pendientesConf > 0 && (
        <div className="al warn" style={{ cursor: 'pointer' }} onClick={() => setTab('aportes')}>
          ⚠️ <strong>{pendientesConf} aporte(s)</strong> esperan confirmación → <u>ir a Aportes</u>
        </div>
      )}

      <div className="bh">
        <div className="bh-lbl">Capital Total Administrado</div>
        <div className="bh-amt">{COP(totalSaldos + totalInv)}</div>
        <div className="bh-meta">
          <div className="bh-mi"><label>Saldos socios</label><span>{COP(totalSaldos)}</span></div>
          <div className="bh-mi"><label>En inversiones</label><span>{COP(totalInv)}</span></div>
          <div className="bh-mi"><label>Prestado</label><span>{COP(totalPrest)}</span></div>
          <div className="bh-mi"><label>Total ganancias</label><span>{COP(totalGanancias)}</span></div>
        </div>
      </div>

      <div className="sg">
        <div className="sb g"><div className="si">✅</div><div className="sl">Pagaron este mes</div><div className="sv">{pagadosMes}/{activos.length}</div></div>
        <div className="sb r"><div className="si">⏳</div><div className="sl">Pendientes confirmar</div><div className="sv">{pendientesConf}</div></div>
        <div className="sb a"><div className="si">🤝</div><div className="sl">Préstamos activos</div><div className="sv">{(prestamos || []).filter((p) => p.estado === 'activo').length}</div></div>
        <div className="sb go"><div className="si">💰</div><div className="sl">Ganancias totales</div><div className="sv" style={{ fontSize: 16 }}>{COP(totalGanancias)}</div></div>
      </div>

      <div className="card">
        <div className="ct">Estado Aportes — {mes}</div>
        {activos.length === 0 ? (
          <div className="empty"><div className="ei">👥</div>Sin socios registrados.</div>
        ) : (
          activos.map((m) => {
            const a = (aportes || []).find((ap) => ap.miembro_id === m.id && ap.mes === mes);
            return (
              <div className="mr" key={m.id}>
                <div className="mav">{initials(m.nombre)}</div>
                <div className="mi2">
                  <div className="nm">{m.nombre}</div>
                  <div className="mt">CC {m.cedula}</div>
                </div>
                <span className={`badge ${a ? (a.estado === 'confirmado' ? 'bg' : 'bgo') : 'br'}`}>
                  {a ? (a.estado === 'confirmado' ? '✓ Pagado' : '⏳ Pendiente') : '✗ Sin pagar'}
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
   MIS APORTES (member)  — ⚡ FIX: createObjectURL en vez de base64
───────────────────────────────────────────────────────────── */
function MisAportes({ user, config, showToast }) {
  const { data: aportes, refetch } = useQuery(() => api.getAportes({ miembro_id: user.id }), [user.id]);
  const [showForm, setShowForm] = useState(false);
  const [mesSel, setMesSel] = useState(mesActual());
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [drag, setDrag] = useState(false);
  const [comp, setComp] = useState('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  // Limpiar el blob URL cuando se desmonta el componente
  const previewRef = useRef(preview);
  previewRef.current = preview;
  useEffect(() => {
    return () => { revokeIfBlob(previewRef.current); };
  }, []); // eslint-disable-line

  const mes = mesActual();
  const idxActual = idxMesActual();

  // Meses disponibles: los que no tienen aporte O que estan rechazados (re-subir)
  const mesesDisponibles = MESES_FONDO.filter(
    (m) => !(aportes || []).some((a) => a.mes === m && a.estado !== 'rechazado')
  );

  // Asegurar que mesSel sea siempre un mes valido (no uno ya pagado)
  useEffect(() => {
    if (mesesDisponibles.length > 0 && !mesesDisponibles.includes(mesSel)) {
      setMesSel(mesesDisponibles.includes(mes) ? mes : mesesDisponibles[0]);
    }
  }, [aportes]); // eslint-disable-line

  // ⚡ HANDLER SEGURO — usa createObjectURL (no base64) y captura errores
  const handleFile = (f) => {
    try {
      const err = validateImage(f);
      if (err) { showToast(err, 'err'); return; }

      const old = preview;
      setFile(f);
      const url = URL.createObjectURL(f);
      setPreview(url);
      // Diferir revoke del preview anterior para evitar removeChild en mobile
      revokeIfBlob(old, true);
    } catch (ex) {
      console.error('[Aportes.handleFile]', ex);
      showToast('No se pudo cargar la imagen. Intenta con otra foto.', 'err');
      setFile(null);
      setPreview(null);
    }
  };

  const limpiarFoto = () => {
    const old = preview;
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
    revokeIfBlob(old, true); // defer: dejar que React desmonte el <img> primero
  };

  const cerrarForm = () => {
    const old = preview;
    setShowForm(false);
    setFile(null);
    setPreview(null);
    setComp('');
    setNota('');
    revokeIfBlob(old, true); // defer: dejar que React desmonte el <img> primero
  };

  const registrar = async () => {
    if (!file) { showToast('Sube la foto del comprobante.', 'err'); return; }
    if (saving) return;
    setSaving(true);
    try {
      const fotoUrl = await api.uploadComprobante(file, user.id);
      await api.createAporte({
        miembro_id: user.id,
        monto: user.monto_mensual || config.monto_mensual,
        mes: mesSel,
        fecha: today(),
        comprobante: comp || '—',
        foto_url: fotoUrl,
        nota,
        estado: 'pendiente',
      });
      cerrarForm();
      showToast('¡Aporte enviado! Esperando confirmación del admin.');
      refetch();
    } catch (e) {
      console.error('[Aportes.registrar]', e);
      showToast('Error al subir: ' + (e?.message || 'intenta de nuevo'), 'err');
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

      {mesesDisponibles.length > 0 && !showForm && (
        <div className="al info">
          📅 Tienes <strong>{mesesDisponibles.length} mes(es)</strong> sin registrar.
          <button className="btn sm primary" style={{ marginLeft: 12 }} onClick={() => setShowForm(true)}>
            Registrar aporte
          </button>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
          <div className="ct">Registrar Aporte</div>
          <div className="cs">{COP(user.monto_mensual || config.monto_mensual)} · Sube la foto de tu transferencia</div>

          <div className="field" style={{ marginTop: 16 }}>
            <label>¿A qué mes corresponde este pago?</label>
            <select value={mesSel} onChange={(e) => setMesSel(e.target.value)}>
              {mesesDisponibles.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className={`uz ${drag ? 'drag' : ''}`}
              onClick={() => { try { fileRef.current?.click(); } catch (_) { } }}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer?.files?.[0];
                if (f) handleFile(f);
              }}>
              <div className="ui">{preview ? '✅' : '📷'}</div>
              <p>{preview
                ? <strong style={{ color: 'var(--green2)' }}>Imagen lista — toca para cambiar</strong>
                : <><strong>Toca o arrastra</strong> la foto del comprobante</>}
              </p>
              <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text3)' }}>JPG · PNG · WEBP · HEIC (max {MAX_IMAGE_MB} MB)</p>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target?.files?.[0];
                  if (f) handleFile(f);
                }} />
            </div>
            {preview && (
              <div key={preview}>
                <img src={preview} className="prev" alt="preview"
                  onError={() => { /* HEIC no previsualiza en algunos browsers — no es bloqueante */ }} />
                <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={limpiarFoto}>
                  Quitar foto
                </button>
              </div>
            )}
          </div>

          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field">
              <label>Referencia / N° operación</label>
              <input value={comp} onChange={(e) => setComp(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="field">
              <label>Nota adicional</label>
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nequi, Bancolombia..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={registrar} disabled={saving || !file}>
              {saving ? 'Subiendo…' : `Enviar Aporte — ${mesSel}`}
            </button>
            <button className="btn ghost" onClick={cerrarForm} disabled={saving}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Calendario de estado por mes */}
      <div className="card">
        <div className="ct">Estado del Fondo 2026–2027</div>
        <div className="mgrid">
          {MESES_FONDO.map((m, i) => {
            const a = (aportes || []).find((ap) => ap.mes === m);
            const esFuturo = i > idxActual;
            const esActual = i === idxActual;
            let cls = 'fut';
            let icon = '◽';
            let texto = '';
            if (a) {
              if (a.estado === 'confirmado') { cls = 'paid'; icon = '✅'; texto = 'Pagado'; }
              else if (a.estado === 'rechazado') { cls = 'rech'; icon = '⚠️'; texto = 'Rechazado'; }
              else { cls = 'pend'; icon = '⏳'; texto = 'Pendiente'; }
            } else if (esActual) {
              cls = 'curr'; icon = '📅'; texto = 'Pendiente';
            } else if (!esFuturo) {
              cls = 'miss'; icon = '❌'; texto = 'Faltó';
            }
            return (
              <div key={m} className={`mc ${cls}`}>
                <div className="mc-n">{MESES_ABR[i]}</div>
                <div className="mc-i">{icon}</div>
                <div className="mc-s">{texto}</div>
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
              <tr><th>Mes</th><th>Monto</th><th>Referencia</th><th>Fecha</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {!aportes?.length ? (
                <tr><td colSpan={5}><div className="empty"><div className="ei">📭</div>Sin aportes aún.</div></td></tr>
              ) : (
                aportes.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.mes}</td>
                    <td>{COP(a.monto)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.comprobante}</td>
                    <td style={{ fontSize: 12 }}>{a.fecha}</td>
                    <td>
                      <span className={`badge ${a.estado === 'confirmado' ? 'bg' : a.estado === 'rechazado' ? 'br' : 'bgo'}`}>
                       {a.estado === 'confirmado' ? '✓ Confirmado' : a.estado === 'rechazado' ? '✗ Rechazado' : '⏳ Pendiente'}
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
    () => api.getAportes(filter === 'todos' ? {}  : { estado: filter }),
    [filter]
  );

  const confirmar = async (a) => {
    try {
      const saldoActual = a.miembros?.saldo || 0;
      await api.updateAporte(a.id, { estado: 'confirmado' });
      await api.updateMiembro(a.miembro_id, { saldo: saldoActual + a.monto });
      showToast(`Aporte de ${a.miembros?.nombre} confirmado.`);
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
  };

  const rechazar = async (a) => {
    try {
      await api.updateAporte(a.id, { estado: 'rechazado' });
      showToast('Aporte rechazado.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
  };

  const registrarManual = async () => {
    const cedula = window.prompt('Cédula del miembro:');
    if (!cedula) return;
    const m = await api.getMiembroByCedula(cedula.trim());
    if (!m) { showToast('Miembro no encontrado.', 'err'); return; }

    const mesLista = MESES_FONDO.map((mes, i) => `${i + 1}. ${mes}`).join('\n');
    const mesIdx = window.prompt(`Selecciona el mes:\n${mesLista}\n\nEscribe el número:`);
    if (!mesIdx) return;
    const mesSeleccionado = MESES_FONDO[parseInt(mesIdx) - 1];
    if (!mesSeleccionado) { showToast('Número de mes inválido.', 'err'); return; }

    const montoDefault = m.monto_mensual || config.monto_mensual;
    const montoStr = window.prompt(`Monto en pesos (aporte estándar del socio: ${COP(montoDefault)}):`);
    const monto = parseInt(montoStr || '0');
    if (!monto) return;

    const comp = window.prompt('Referencia / comprobante:') || 'MANUAL';
    try {
      await api.createAporte({
        miembro_id: m.id,
        monto,
        mes: mesSeleccionado,
        fecha: today(),
        comprobante: comp,
        estado: 'confirmado',
        nota: 'Registro manual admin',
      });
      await api.updateMiembro(m.id, { saldo: (m.saldo || 0) + monto });
      showToast(`✅ Aporte de ${m.nombre} — ${mesSeleccionado} registrado.`);
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
  };

  return (
    <>
      <div className="ph"><h2>Gestión de Aportes</h2><p>Confirma los comprobantes enviados por los socios</p></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['pendiente', 'confirmado', 'rechazado', 'todos'].map((f) => (
            <button key={f} className={`btn sm ${filter === f ? 'primary' : 'ghost'}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn ok" onClick={registrarManual}>+ Registro Manual</button>
      </div>
      <div className="card">
        <div className="tw">
          <table>
            <thead>
              <tr><th>Socio</th><th>Mes</th><th>Monto</th><th>Ref.</th><th>Foto</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {!aportes?.length ? (
                <tr><td colSpan={8}><div className="empty"><div className="ei">📭</div>Sin aportes en esta categoría.</div></td></tr>
              ) : (
                aportes.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.miembros?.nombre || '—'}</td>
                    <td style={{ fontSize: 12 }}>{a.mes}</td>
                    <td style={{ fontWeight: 600 }}>{COP(a.monto)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.comprobante}</td>
                    <td>{a.foto_url
                      ? <img src={a.foto_url} className="pt" alt="comp" onClick={() => setLight(a.foto_url)} />
                      : <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 11 }}>{a.fecha}</td>
                    <td><span className={`badge ${a.estado === 'confirmado' ? 'bg' : a.estado === 'pendiente' ? 'bgo' : 'br'}`}>{a.estado}</span></td>
                    <td>{a.estado === 'pendiente' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn sm success" onClick={() => confirmar(a)}>✓</button>
                        <button className="btn sm danger" onClick={() => rechazar(a)}>✗</button>
                      </div>
                    )}</td>
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
  const { data: prestamos, refetch } = useQuery(() => api.getPrestamos({ miembro_id: user.id }), [user.id]);
  const [showForm, setShowForm] = useState(false);
  const [monto, setMonto] = useState('');
  const [cuotas, setCuotas] = useState('6');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const activo = (prestamos || []).find((p) => p.estado === 'activo');
  const total = monto ? Math.round(parseInt(monto) * (1 + (config.tasa_prestamo / 100) * parseInt(cuotas))) : 0;
  const cuotaVal = total && cuotas ? Math.round(total / parseInt(cuotas)) : 0;

  const solicitar = async () => {
    if (!monto || !motivo) { showToast('Completa todos los campos.', 'err'); return; }
    if (activo) { showToast('Ya tienes un préstamo activo.', 'err'); return; }
    setSaving(true);
    try {
      await api.createPrestamo({
        miembro_id: user.id,
        monto: parseInt(monto),
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
    } catch (e) { showToast(e.message, 'err'); } finally { setSaving(false); }
  };

  return (
    <>
      <div className="ph"><h2>Mis Préstamos</h2><p>Solicita y monitorea tus préstamos</p></div>
      {!activo && !showForm && (
        <button className="btn primary" style={{ marginBottom: 16 }} onClick={() => setShowForm(true)}>
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
              <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="500000" />
            </div>
            <div className="field">
              <label>Cuotas</label>
              <select value={cuotas} onChange={(e) => setCuotas(e.target.value)}>
                {[3, 6, 9, 12, 18, 24].map((c) => <option key={c} value={c}>{c} meses</option>)}
              </select>
            </div>
            {monto && (
              <div className="ff">
                <div className="al info">
                  💡 Cuota mensual: <strong>{COP(cuotaVal)}</strong> · Total: <strong>{COP(total)}</strong>
                </div>
              </div>
            )}
            <div className="field ff">
              <label>Motivo</label>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Gastos médicos, educación..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={solicitar} disabled={saving}>
              {saving ? 'Enviando…' : 'Enviar Solicitud'}
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="card">
        {!prestamos?.length ? (
          <div className="empty"><div className="ei">🤝</div>Sin préstamos.</div>
        ) : (
          prestamos.map((p) => {
            const cv = Math.round((FROM_DB(p.monto) * (1 + (p.interes / 100) * p.cuotas)) / p.cuotas);
            const pend = (p.cuotas - p.cuotas_pagadas) * cv;
            const pct = Math.round((p.cuotas_pagadas / p.cuotas) * 100);
            return (
              <div key={p.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{COP(FROM_DB(p.monto))}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.motivo} · {p.fecha}</div>
                  </div>
                  <span className={`badge ${p.estado === 'activo' ? 'bgo' : p.estado === 'pagado' ? 'bg' : 'bgy'}`}>{p.estado}</span>
                </div>
                {p.estado !== 'pendiente' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text2)' }}>Cuotas: {p.cuotas_pagadas}/{p.cuotas}</span>
                      <span>Saldo: <strong>{COP(pend)}</strong></span>
                    </div>
                    <div className="pb"><div className="pf" style={{ width: `${pct}%` }} /></div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{pct}% pagado</div>
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
  const [form, setForm] = useState({ cedula: '', monto: '', cuotas: '6', interes: String(config.tasa_prestamo), motivo: '' });
  const [saving, setSaving] = useState(false);
  const [loadingId, setLoadingId] = useState(null);

  const crear = async () => {
    const m = await api.getMiembroByCedula(form.cedula.trim());
    if (!m) { showToast('Miembro no encontrado.', 'err'); return; }
    if (!form.monto || !form.motivo) { showToast('Completa todos los campos.', 'err'); return; }
    setSaving(true);
    try {
      await api.createPrestamo({
        miembro_id: m.id,
        monto: parseInt(form.monto),
        interes: parseFloat(form.interes),
        cuotas: parseInt(form.cuotas),
        cuotas_pagadas: 0,
        fecha: today(),
        estado: 'activo',
        motivo: form.motivo,
      });
      setShowForm(false);
      setForm({ cedula: '', monto: '', cuotas: '6', interes: String(config.tasa_prestamo), motivo: '' });
      showToast('Préstamo registrado.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); } finally { setSaving(false); }
  };

  const pagarCuota = async (p) => {
    if (p.cuotas_pagadas >= p.cuotas || loadingId) return;
    const nuevas = p.cuotas_pagadas + 1;
    const estado = nuevas === p.cuotas ? 'pagado' : 'activo';
    const interesMes = Math.round(FROM_DB(p.monto) * (p.interes / 100));
    setLoadingId(p.id);
    try {
      await api.updatePrestamo(p.id, { cuotas_pagadas: nuevas, estado });
      await api.createGanancia({
        descripcion: `Interés cuota ${nuevas}/${p.cuotas} — ${p.miembros?.nombre}`,
        monto: interesMes,
        tipo: 'interes',
        fecha: today(),
      });
      showToast(`Cuota ${nuevas}/${p.cuotas} registrada.`);
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
    finally { setLoadingId(null); }
  };

  const saldarPrestamo = async (p) => {
    if (loadingId) return;
    const cuotasRestantes = p.cuotas - p.cuotas_pagadas;
    if (cuotasRestantes <= 0) return;
    const interesMes = Math.round(FROM_DB(p.monto) * (p.interes / 100));
    const totalInteresRestante = interesMes * cuotasRestantes;
    const cuotaVal = Math.round((FROM_DB(p.monto) * (1 + (p.interes / 100) * p.cuotas)) / p.cuotas);
    const totalPago = cuotaVal * cuotasRestantes;
    if (!window.confirm(
      `Registrar pago anticipado de ${p.miembros?.nombre}?\n` +
      `• Cuotas restantes: ${cuotasRestantes}\n` +
      `• Total a recibir: ${COP(totalPago)}\n` +
      `• Interés a registrar: ${COP(totalInteresRestante)}`
    )) return;
    setLoadingId(p.id);
    try {
      await api.updatePrestamo(p.id, { cuotas_pagadas: p.cuotas, estado: 'pagado' });
      await api.createGanancia({
        descripcion: `Pago anticipado (${cuotasRestantes} cuotas) — ${p.miembros?.nombre}`,
        monto: totalInteresRestante,
        tipo: 'interes',
        fecha: today(),
      });
      showToast('✅ Préstamo saldado anticipadamente.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
    finally { setLoadingId(null); }
  };

  return (
    <>
      <div className="ph"><h2>Préstamos</h2><p>Gestiona los préstamos a los socios</p></div>
      <div style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>+ Nuevo Préstamo</button>
      </div>
      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
          <div className="ct">Registrar Préstamo</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field"><label>Cédula del socio</label><input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} /></div>
            <div className="field"><label>Monto (COP)</label><input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></div>
            <div className="field">
              <label>Cuotas</label>
              <select value={form.cuotas} onChange={(e) => setForm({ ...form, cuotas: e.target.value })}>
                {[3, 6, 9, 12, 18, 24].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Interés % mensual</label><input type="number" step="0.5" value={form.interes} onChange={(e) => setForm({ ...form, interes: e.target.value })} /></div>
            <div className="field ff"><label>Motivo</label><input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={crear} disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="card">
        <div className="tw">
          <table>
            <thead><tr><th>Socio</th><th>Monto</th><th>Cuota/mes</th><th>Progreso</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              {!prestamos?.length ? (
                <tr><td colSpan={6}><div className="empty"><div className="ei">🤝</div>Sin préstamos.</div></td></tr>
              ) : (
                prestamos.map((p) => {
                  const cv = Math.round((FROM_DB(p.monto) * (1 + (p.interes / 100) * p.cuotas)) / p.cuotas);
                  const pct = Math.round((p.cuotas_pagadas / p.cuotas) * 100);
                  const isLoading = loadingId === p.id;
                  const cuotasRestantes = p.cuotas - p.cuotas_pagadas;
                  return (
                    <tr key={p.id}>
                      <td><div style={{ fontWeight: 600 }}>{p.miembros?.nombre}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.motivo}</div></td>
                      <td style={{ fontWeight: 600 }}>{COP(FROM_DB(p.monto))}</td>
                      <td style={{ fontSize: 13 }}>{COP(cv)}</td>
                      <td style={{ minWidth: 130 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>
                          <span>{p.cuotas_pagadas}/{p.cuotas}</span><span>{pct}%</span>
                        </div>
                        <div className="pb"><div className="pf" style={{ width: `${pct}%` }} /></div>
                      </td>
                      <td><span className={`badge ${p.estado === 'activo' ? 'bgo' : p.estado === 'pagado' ? 'bg' : 'bgy'}`}>{p.estado}</span></td>
                      <td>
                        {p.estado === 'activo' && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn sm success" onClick={() => pagarCuota(p)} disabled={isLoading || !!loadingId}>
                              {isLoading ? '…' : '+ Cuota'}
                            </button>
                            {cuotasRestantes > 1 && (
                              <button className="btn sm gold" onClick={() => saldarPrestamo(p)} disabled={isLoading || !!loadingId} title={`Saldar ${cuotasRestantes} cuotas restantes`}>
                                ⚡ Saldar
                              </button>
                            )}
                          </div>
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
  const { data: inversiones, refetch } = useQuery(() => api.getInversiones(), []);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ descripcion: '', monto: '', rendimiento_anual: '', fecha_inicio: '', fecha_fin: '' });
  const [editForm, setEditForm] = useState({ descripcion: '', monto: '', rendimiento_anual: '', fecha_fin: '' });
  const [saving, setSaving] = useState(false);

  const activas = (inversiones || []).filter((i) => i.estado === 'activo');
  const totalInv = activas.reduce((s, i) => s + FROM_DB(i.monto), 0);
  const ganAnual = activas.reduce((s, i) => s + Math.round((FROM_DB(i.monto) * i.rendimiento_anual) / 100), 0);

  const crear = async () => {
    if (!form.descripcion || !form.monto) { showToast('Completa descripción y monto.', 'err'); return; }
    setSaving(true);
    try {
      await api.createInversion({ ...form, monto: parseInt(form.monto), rendimiento_anual: parseFloat(form.rendimiento_anual) || 0 });
      setShowForm(false);
      setForm({ descripcion: '', monto: '', rendimiento_anual: '', fecha_inicio: '', fecha_fin: '' });
      showToast('Inversión registrada.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); } finally { setSaving(false); }
  };

  const abrirEditar = (inv) => {
    setEditId(inv.id);
    setEditForm({
      descripcion: inv.descripcion,
      monto: String(FROM_DB(inv.monto)),
      rendimiento_anual: String(inv.rendimiento_anual),
      fecha_fin: inv.fecha_fin || '',
    });
  };

  const guardarEdicion = async () => {
    setSaving(true);
    try {
      await api.updateInversion(editId, {
        descripcion: editForm.descripcion,
        monto: parseInt(editForm.monto),
        rendimiento_anual: parseFloat(editForm.rendimiento_anual) || 0,
        fecha_fin: editForm.fecha_fin || null,
      });
      setEditId(null);
      showToast('Inversión actualizada.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); } finally { setSaving(false); }
  };

  const toggle = async (inv) => {
    try {
      await api.updateInversion(inv.id, { estado: inv.estado === 'activo' ? 'cerrado' : 'activo' });
      showToast('Estado actualizado.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
  };

  return (
    <>
      <div className="ph"><h2>Inversiones</h2><p>El dinero del fondo puesto a trabajar</p></div>
      <div className="sg">
        <div className="sb g"><div className="si">💼</div><div className="sl">Capital invertido</div><div className="sv">{COP(totalInv)}</div></div>
        <div className="sb go"><div className="si">📈</div><div className="sl">Ganancia anual est.</div><div className="sv">{COP(ganAnual)}</div></div>
        <div className="sb a"><div className="si">🔢</div><div className="sl">Inversiones activas</div><div className="sv">{activas.length}</div></div>
      </div>
      {user.is_admin && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn primary" onClick={() => setShowForm((v) => !v)}>+ Nueva Inversión</button>
        </div>
      )}
      {showForm && user.is_admin && (
        <div className="card" style={{ borderTop: '3px solid var(--green)' }}>
          <div className="ct">Registrar Inversión</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field ff"><label>Descripción</label><input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="CDT Banco Davivienda, Lote..." /></div>
            <div className="field"><label>Monto (COP)</label><input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></div>
            <div className="field"><label>Rendimiento anual %</label><input type="number" step="0.1" value={form.rendimiento_anual} onChange={(e) => setForm({ ...form, rendimiento_anual: e.target.value })} /></div>
            <div className="field"><label>Fecha inicio</label><input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} /></div>
            <div className="field"><label>Fecha vencimiento</label><input type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={crear} disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="card">
        {!inversiones?.length ? (
          <div className="empty"><div className="ei">📈</div>Sin inversiones.</div>
        ) : (
          inversiones.map((inv) => {
            const ga = Math.round((FROM_DB(inv.monto) * inv.rendimiento_anual) / 100);
            const editando = editId === inv.id;
            return (
              <div key={inv.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                {editando && user.is_admin ? (
                  <div style={{ background: 'var(--surface2)', borderRadius: 'var(--rs)', padding: 16 }}>
                    <div className="ct" style={{ marginBottom: 12 }}>✏️ Editar Inversión</div>
                    <div className="fg">
                      <div className="field ff"><label>Descripción</label><input value={editForm.descripcion} onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })} /></div>
                      <div className="field"><label>Monto (COP)</label><input type="number" value={editForm.monto} onChange={(e) => setEditForm({ ...editForm, monto: e.target.value })} /></div>
                      <div className="field"><label>Rendimiento anual %</label><input type="number" step="0.1" value={editForm.rendimiento_anual} onChange={(e) => setEditForm({ ...editForm, rendimiento_anual: e.target.value })} /></div>
                      <div className="field"><label>Fecha vencimiento</label><input type="date" value={editForm.fecha_fin} onChange={(e) => setEditForm({ ...editForm, fecha_fin: e.target.value })} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      <button className="btn primary sm" onClick={guardarEdicion} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
                      <button className="btn ghost sm" onClick={() => setEditId(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{inv.descripcion}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{inv.fecha_inicio} → {inv.fecha_fin || 'Abierto'}</div>
                      </div>
                      <span className={`badge ${inv.estado === 'activo' ? 'bg' : 'bgy'}`}>{inv.estado}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Capital</div>
                        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700 }}>{COP(FROM_DB(inv.monto))}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Rendimiento</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--green2)' }}>{inv.rendimiento_anual}% anual</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Ganancia est./año</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold2)' }}>{COP(ga)}</div>
                      </div>
                    </div>
                    {user.is_admin && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        <button className="btn sm gold" onClick={() => abrirEditar(inv)}>✏️ Editar</button>
                        <button className="btn sm ghost" onClick={() => toggle(inv)}>
                          {inv.estado === 'activo' ? 'Cerrar inversión' : 'Reactivar'}
                        </button>
                      </div>
                    )}
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
   GANANCIAS
───────────────────────────────────────────────────────────── */
function Ganancias({ user, showToast }) {
  const { data: ganancias, refetch } = useQuery(() => api.getGanancias(), []);
  const [showForm, setShowForm] = useState(false);
  const [abonoId, setAbonoId] = useState(null);
  const [abonoMonto, setAbonoMonto] = useState('');
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ descripcion: '', monto: '', tipo: 'rendimiento' });
  const [form, setForm] = useState({ descripcion: '', monto: '', tipo: 'rendimiento' });
  const [saving, setSaving] = useState(false);

  const total = (ganancias || []).reduce((s, g) => s + FROM_DB(g.monto), 0);
  const porTipo = (ganancias || []).reduce((acc, g) => {
    acc[g.tipo] = (acc[g.tipo] || 0) + FROM_DB(g.monto);
    return acc;
  }, {});

  const idxActual = idxMesActual();
  const startIdx = Math.max(0, idxActual - 5);
  const chartMeses = MESES_FONDO.slice(startIdx, idxActual + 1).map((m) => ({
    label: MESES_ABR[MESES_FONDO.indexOf(m)],
    total: (ganancias || []).filter((g) => g.fecha && g.mes === m).reduce((s, g) => s + FROM_DB(g.monto), 0),
  }));
  const maxC = Math.max(...chartMeses.map((m) => m.total), 1);

  const registrar = async () => {
    if (!form.descripcion || !form.monto) { showToast('Completa todos los campos.', 'err'); return; }
    setSaving(true);
    try {
      await api.createGanancia({ ...form, monto: parseInt(form.monto), fecha: today() });
      setShowForm(false);
      setForm({ descripcion: '', monto: '', tipo: 'rendimiento' });
      showToast('Ganancia registrada.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); } finally { setSaving(false); }
  };

  const registrarAbono = async (g) => {
    const monto = parseInt(abonoMonto);
    if (!monto || monto <= 0) { showToast('Ingresa un monto valido.', 'err'); return; }
    if (saving) return;
    setSaving(true);
    try {
      await api.createGanancia({ descripcion: g.descripcion + ' — Abono', monto, tipo: g.tipo, fecha: today() });
      setAbonoId(null);
      setAbonoMonto('');
      showToast('Abono registrado.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); } finally { setSaving(false); }
  };

  const abrirEditar = (g) => {
    setEditId(g.id);
    setEditForm({ descripcion: g.descripcion, monto: String(FROM_DB(g.monto)), tipo: g.tipo });
    setAbonoId(null);
  };

  const guardarEdicion = async () => {
    if (!editForm.descripcion || !editForm.monto) { showToast('Completa todos los campos.', 'err'); return; }
    if (saving) return;
    setSaving(true);
    try {
      await api.updateGanancia(editId, {
        descripcion: editForm.descripcion,
        monto: parseInt(editForm.monto),
        tipo: editForm.tipo,
      });
      setEditId(null);
      showToast('Ganancia actualizada.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); } finally { setSaving(false); }
  };

  const eliminarGanancia = async (g) => {
    if (!window.confirm(`¿Eliminar "${g.descripcion}"?\nEsto no puede deshacerse.`)) return;
    try {
      await api.deleteGanancia(g.id);
      showToast('Registro eliminado.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
  };

  return (
    <>
      <div className="ph"><h2>Ganancias</h2><p>Rendimientos, intereses y otros ingresos del fondo</p></div>
      <div className="sg">
        <div className="sb g"><div className="si">💰</div><div className="sl">Total ganancias</div><div className="sv">{COP(total)}</div></div>
        <div className="sb go"><div className="si">📈</div><div className="sl">Rendimientos</div><div className="sv">{COP(porTipo.rendimiento || 0)}</div></div>
        <div className="sb a"><div className="si">🤝</div><div className="sl">Intereses prestamos</div><div className="sv">{COP(porTipo.interes || 0)}</div></div>
        <div className="sb p"><div className="si">✨</div><div className="sl">Otros</div><div className="sv">{COP(porTipo.otro || 0)}</div></div>
      </div>
      <div className="card">
        <div className="ct">Ultimos meses</div>
        <div className="cbw">
          {chartMeses.map((m) => (
            <div key={m.label} className="cbc">
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{m.total > 0 ? COP(m.total) : ''}</div>
              <div className="cbr" style={{ height: `${Math.max((m.total / maxC) * 100, 4)}%` }} />
              <div className="cbl">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
      {user.is_admin && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn primary" onClick={() => setShowForm((v) => !v)}>+ Registrar Ganancia</button>
        </div>
      )}
      {showForm && user.is_admin && (
        <div className="card" style={{ borderTop: '3px solid var(--green)' }}>
          <div className="ct">Nueva Ganancia</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field ff"><label>Descripcion</label><input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Rendimiento CDT trimestre 1..." /></div>
            <div className="field"><label>Monto (COP)</label><input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></div>
            <div className="field">
              <label>Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="rendimiento">Rendimiento inversion</option>
                <option value="interes">Interes prestamo</option>
                <option value="otro">Otro ingreso</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={registrar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="card">
        <div className="ct">Historial de Ganancias</div>
        <div className="tw">
          <table>
            <thead><tr><th>Descripcion</th><th>Tipo</th><th>Monto</th><th>Fecha</th>{user.is_admin && <th></th>}</tr></thead>
            <tbody>
              {!ganancias?.length ? (
                <tr><td colSpan={5}><div className="empty"><div className="ei">💰</div>Sin ganancias registradas.</div></td></tr>
              ) : (
                ganancias.map((g) => (
                  <React.Fragment key={g.id}>
                    {editId === g.id && user.is_admin ? (
                      <tr style={{ background: 'var(--surface2)' }}>
                        <td>
                          <input value={editForm.descripcion} onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
                            style={{ width: '100%', padding: '6px 10px', background: 'var(--bg)', border: '1.5px solid var(--accent)', borderRadius: 'var(--rs)', color: 'var(--text)', fontSize: 13 }} />
                        </td>
                        <td>
                          <select value={editForm.tipo} onChange={(e) => setEditForm({ ...editForm, tipo: e.target.value })}
                            style={{ padding: '6px 8px', background: 'var(--bg)', border: '1.5px solid var(--accent)', borderRadius: 'var(--rs)', color: 'var(--text)', fontSize: 12 }}>
                            <option value="rendimiento">rendimiento</option>
                            <option value="interes">interes</option>
                            <option value="otro">otro</option>
                          </select>
                        </td>
                        <td>
                          <input type="number" value={editForm.monto} onChange={(e) => setEditForm({ ...editForm, monto: e.target.value })}
                            style={{ width: 110, padding: '6px 10px', background: 'var(--bg)', border: '1.5px solid var(--accent)', borderRadius: 'var(--rs)', color: 'var(--text)', fontSize: 13 }} />
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{g.fecha}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn sm success" onClick={guardarEdicion} disabled={saving}>{saving ? '…' : '✓'}</button>
                            <button className="btn sm ghost" onClick={() => setEditId(null)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td style={{ fontWeight: 500 }}>{g.descripcion}</td>
                        <td><span className={`badge ${g.tipo === 'rendimiento' ? 'bg' : g.tipo === 'interes' ? 'bb' : 'bp'}`}>{g.tipo}</span></td>
                        <td style={{ fontWeight: 700, color: 'var(--green2)' }}>{COP(FROM_DB(g.monto))}</td>
                        <td style={{ fontSize: 12 }}>{g.fecha}</td>
                        {user.is_admin && (
                          <td>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button className="btn sm gold" onClick={() => { setAbonoId(abonoId === g.id ? null : g.id); setAbonoMonto(''); setEditId(null); }}>+ Abono</button>
                              <button className="btn sm ghost" onClick={() => abrirEditar(g)} title="Editar">✏️</button>
                              <button className="btn sm danger" onClick={() => eliminarGanancia(g)} title="Eliminar">🗑</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )}
                    {abonoId === g.id && user.is_admin && editId !== g.id && (
                      <tr>
                        <td colSpan={5}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', flexWrap: 'wrap' }}>
                            <input type="number" placeholder="Monto del abono (COP)" value={abonoMonto} onChange={(e) => setAbonoMonto(e.target.value)}
                              style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1.5px solid var(--accent)', borderRadius: 'var(--rs)', color: 'var(--text)', fontSize: 13, width: 220 }} />
                            <button className="btn sm primary" onClick={() => registrarAbono(g)} disabled={saving}>{saving ? '...' : 'Guardar abono'}</button>
                            <button className="btn sm ghost" onClick={() => setAbonoId(null)}>Cancelar</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!user.is_admin && (
        <div className="al info" style={{ marginTop: 4 }}>
          Las ganancias se distribuyen proporcionalmente al saldo de cada socio. Tu parte estimada la ves en tu dashboard.
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
  const [form, setForm] = useState({ nombre: '', cedula: '', saldo: '0', monto_mensual: '0' });
  const [saving, setSaving] = useState(false);

  const crear = async () => {
    if (!form.nombre || !form.cedula) { showToast('Nombre y cédula obligatorios.', 'err'); return; }
    setSaving(true);
    try {
      await api.createMiembro({
        nombre: form.nombre.trim(),
        cedula: form.cedula.trim(),
        saldo: parseInt(form.saldo || '0'),
        monto_mensual: parseInt(form.monto_mensual || '0'),
        activo: true,
        fecha_ingreso: today(),
        is_admin: false,
      });
      setShowForm(false);
      setForm({ nombre: '', cedula: '', saldo: '0', monto_mensual: '0' });
      showToast('Miembro creado.');
      refetch();
    } catch (e) {
      showToast(e.message === 'duplicate key' ? 'Cédula ya registrada.' : e.message, 'err');
    } finally { setSaving(false); }
  };

  const toggle = async (m) => {
    try {
      await api.updateMiembro(m.id, { activo: !m.activo });
      showToast(`Miembro ${!m.activo ? 'activado' : 'desactivado'}.`);
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
  };

  const editSaldo = async (m, val) => {
    try {
      await api.updateMiembro(m.id, { saldo: parseInt(val || '0') });
      showToast('Saldo actualizado.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
  };

  const activos = (miembros || []).filter((m) => !m.is_admin && m.activo).length;
  const inactivos = (miembros || []).filter((m) => !m.is_admin && !m.activo).length;

  return (
    <>
      <div className="ph"><h2>Miembros</h2><p>{activos} activos · {inactivos} inactivos</p></div>
      <div style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>+ Agregar Miembro</button>
      </div>
      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
          <div className="ct">Nuevo Miembro</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field"><label>Nombre Completo</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
            <div className="field"><label>Cédula</label><input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} /></div>
            <div className="field"><label>Saldo Inicial (COP)</label><input type="number" value={form.saldo} onChange={(e) => setForm({ ...form, saldo: e.target.value })} /></div>
            <div className="field"><label>Aporte Mensual (COP)</label><input type="number" value={form.monto_mensual} onChange={(e) => setForm({ ...form, monto_mensual: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={crear} disabled={saving}>{saving ? 'Creando…' : 'Crear'}</button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="card">
        <div className="tw">
          <table>
            <thead>
              <tr><th>Miembro</th><th>Cédula</th><th>Aporte/mes</th><th>Saldo</th><th>Ingresó</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {(miembros || []).filter((m) => !m.is_admin).map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.nombre}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{m.cedula}</td>
                  <td style={{ fontSize: 13, color: 'var(--text2)' }}>{COP(m.monto_mensual || 0)}</td>
                  <td>
                    <input type="number" defaultValue={FROM_DB(m.saldo)}
                      onBlur={(e) => editSaldo(m, e.target.value)}
                      style={{ width: 130, padding: '6px 10px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--rs)', color: 'var(--text)', fontSize: 13, fontFamily: 'Outfit,sans-serif' }} />
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{m.fecha_ingreso}</td>
                  <td><span className={`badge ${m.activo ? 'bg' : 'br'}`}>{m.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td><button className={`btn sm ${m.activo ? 'danger' : 'success'}`} onClick={() => toggle(m)}>{m.activo ? 'Desactivar' : 'Activar'}</button></td>
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
    if (!window.confirm(`¿Confirmar retiro de ${found.nombre}?\nSe liquidará su saldo de ${COP(found.saldo)}`)) return;
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
      setFound(null); setCedula(''); setMotivo('');
      refetch();
    } catch (e) { showToast(e.message, 'err'); } finally { setSaving(false); }
  };

  const retirados = (miembros || []).filter((m) => !m.is_admin && !m.activo && m.motivo_retiro);

  return (
    <>
      <div className="ph"><h2>Retiro de Socio</h2><p>Procesar la salida definitiva de un ahorrador</p></div>
      <div className="card" style={{ borderTop: '3px solid var(--red)' }}>
        <div className="ct">⚠️ Proceso de Retiro</div>
        <div className="cs">Esta acción es irreversible. El saldo será liquidado.</div>
        <div className="fg" style={{ marginTop: 16 }}>
          <div className="field"><label>Cédula</label><input value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="12345678" /></div>
          <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn primary" style={{ width: '100%' }} onClick={buscar}>Buscar</button>
          </div>
        </div>
        {found && (
          <>
            <div className="al warn" style={{ marginTop: 12 }}>
              <div>
                <strong>{found.nombre}</strong> · CC {found.cedula}<br />
                Saldo a liquidar: <strong>{COP(FROM_DB(found.saldo))}</strong> · Socio desde {found.fecha_ingreso}
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Motivo del retiro</label>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Retiro voluntario, traslado..." />
            </div>
            <button className="btn danger" style={{ marginTop: 14 }} onClick={retirar} disabled={saving}>
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
              <div className="mav" style={{ background: 'var(--surface2)', color: 'var(--text3)' }}>{initials(m.nombre)}</div>
              <div className="mi2">
                <div className="nm">{m.nombre}</div>
                <div className="mt">{m.motivo_retiro} · {m.fecha_retiro} · Liquidado: {COP(m.saldo_liquidado || 0)}</div>
              </div>
              <span className="badge br">Retirado</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — CONFIGURACIÓN
───────────────────────────────────────────────────────────── */
function AdminConfig({ config, setConfig, showToast }) {
  const [form, setForm] = useState({
    nombre_fondo: config.nombre_fondo,
    monto_mensual: String(FROM_DB(config.monto_mensual)),
    tasa_prestamo: String(config.tasa_prestamo),
  });
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    setSaving(true);
    try {
      const patch = {
        nombre_fondo: form.nombre_fondo,
        monto_mensual: parseInt(form.monto_mensual || '0'),
        tasa_prestamo: parseFloat(form.tasa_prestamo) || 2,
      };
      await api.updateConfig(patch);
      setConfig({ ...config, ...patch });
      showToast('Configuración guardada.');
    } catch (e) { showToast(e.message, 'err'); } finally { setSaving(false); }
  };

  return (
    <>
      <div className="ph"><h2>Configuración</h2><p>Ajustes generales del fondo</p></div>
      <div className="card">
        <div className="ct">Parámetros del Fondo</div>
        <div className="cfg-grid" style={{ marginTop: 16 }}>
          <div className="field"><label>Nombre del fondo</label><input value={form.nombre_fondo} onChange={(e) => setForm({ ...form, nombre_fondo: e.target.value })} /></div>
          <div className="field"><label>Aporte mensual base (COP)</label><input type="number" value={form.monto_mensual} onChange={(e) => setForm({ ...form, monto_mensual: e.target.value })} /></div>
          <div className="field"><label>Tasa préstamos % mensual</label><input type="number" step="0.5" value={form.tasa_prestamo} onChange={(e) => setForm({ ...form, tasa_prestamo: e.target.value })} /></div>
        </div>
        <button className="btn primary" style={{ marginTop: 16 }} onClick={guardar} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar Cambios'}
        </button>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   ADMIN — CAPITAL EXTRAORDINARIO
───────────────────────────────────────────────────────────── */
function AdminCapitalExt({ showToast }) {
  const { data: items, refetch } = useQuery(() => api.getCapitalExt(), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ descripcion: '', monto_total: '', origen: '', fecha: today(), notas: '' });
  const [saving, setSaving] = useState(false);

  const totalInyectado = (items || []).reduce((s, i) => s + FROM_DB(i.monto_total), 0);
  const totalReembolsado = (items || []).reduce((s, i) => s + FROM_DB(i.monto_reembolsado), 0);
  const totalPendiente = totalInyectado - totalReembolsado;

  const crear = async () => {
    if (!form.descripcion || !form.monto_total) { showToast('Completa descripción y monto.', 'err'); return; }
    setSaving(true);
    try {
      await api.createCapitalExt({
        descripcion: form.descripcion,
        monto_total: parseInt(form.monto_total),
        monto_reembolsado: 0,
        origen: form.origen,
        fecha: form.fecha || today(),
        notas: form.notas,
      });
      setShowForm(false);
      setForm({ descripcion: '', monto_total: '', origen: '', fecha: today(), notas: '' });
      showToast('Capital registrado.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); } finally { setSaving(false); }
  };

  const registrarReembolso = async (item) => {
    const val = window.prompt(`Cuanto vas a reembolsar de "${item.descripcion}"?\nPendiente: ${COP(FROM_DB(item.monto_total) - FROM_DB(item.monto_reembolsado))}`);
    if (!val) return;
    const monto = parseInt(val);
    if (!monto || monto <= 0) { showToast('Monto invalido.', 'err'); return; }
    const nuevo = FROM_DB(item.monto_reembolsado) + monto;
    if (nuevo > FROM_DB(item.monto_total)) { showToast('El reembolso supera el total inyectado.', 'err'); return; }
    try {
      await api.updateCapitalExt(item.id, { monto_reembolsado: nuevo });
      showToast('Reembolso de ' + COP(monto) + ' registrado.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
  };

  return (
    <>
      <div className="ph">
        <h2>Capital Externo</h2>
        <p>Inyecciones de capital al fondo — cadenas, anticipos y otros ingresos extraordinarios</p>
      </div>

      <div className="sg">
        <div className="sb g"><div className="si">💵</div><div className="sl">Total inyectado</div><div className="sv">{COP(totalInyectado)}</div></div>
        <div className="sb go"><div className="si">✅</div><div className="sl">Reembolsado</div><div className="sv">{COP(totalReembolsado)}</div></div>
        <div className="sb r"><div className="si">⏳</div><div className="sl">Por reembolsar</div><div className="sv">{COP(totalPendiente)}</div></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>+ Nueva Inyeccion de Capital</button>
      </div>

      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--gold)' }}>
          <div className="ct">Registrar Capital Externo</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field ff">
              <label>Descripcion</label>
              <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Cadena de ahorro puesto #2, Anticipo personal..." />
            </div>
            <div className="field">
              <label>Monto total (COP)</label>
              <input type="number" value={form.monto_total} onChange={(e) => setForm({ ...form, monto_total: e.target.value })} placeholder="1000000" />
            </div>
            <div className="field">
              <label>Origen</label>
              <input value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}
                placeholder="Cadena barrio, prestamo personal..." />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div className="field ff">
              <label>Notas adicionales</label>
              <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Se reembolsa con aportes mensuales a partir de..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={crear} disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="ct">Historial de Capital Externo</div>
        {!items?.length ? (
          <div className="empty"><div className="ei">💵</div>Sin inyecciones registradas.</div>
        ) : (
          items.map((item) => {
            const total = FROM_DB(item.monto_total);
            const reembolsado = FROM_DB(item.monto_reembolsado);
            const pendiente = total - reembolsado;
            const pct = total > 0 ? Math.round((reembolsado / total) * 100) : 0;
            const pagado = pendiente <= 0;
            return (
              <div key={item.id} style={{ padding: '18px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{item.descripcion}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {item.origen && <span>{item.origen} · </span>}{item.fecha}
                    </div>
                    {item.notas && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{item.notas}</div>}
                  </div>
                  <span className={`badge ${pagado ? 'bg' : 'bgo'}`}>{pagado ? 'Reembolsado' : 'Pendiente'}</span>
                </div>
                <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Capital inyectado</div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700 }}>{COP(total)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Reembolsado</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--green2)' }}>{COP(reembolsado)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Por reembolsar</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: pendiente > 0 ? 'var(--gold2)' : 'var(--green2)' }}>{COP(pendiente)}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>
                    <span>Progreso de reembolso</span><span>{pct}%</span>
                  </div>
                  <div className="pb"><div className="pf" style={{ width: `${pct}%` }} /></div>
                </div>
                {!pagado && (
                  <button className="btn sm gold" style={{ marginTop: 12 }} onClick={() => registrarReembolso(item)}>
                    + Registrar Reembolso
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
   ALIANZAS
───────────────────────────────────────────────────────────── */
function Alianzas({ user, showToast }) {
  const { data: alianzas, refetch } = useQuery(() => api.getAlianzas(), []);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [codigoVisible, setCodigoVisible] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', descuento: '', codigo: '', categoria: '', logo_url: '' });
  const [saving, setSaving] = useState(false);

  const activas = (alianzas || []).filter(a => a.activo);

  const crear = async () => {
    if (!form.nombre || !form.descuento) { showToast('Nombre y descuento son obligatorios.', 'err'); return; }
    setSaving(true);
    try {
      await api.createAlianza({ ...form, activo: true });
      setShowForm(false);
      setForm({ nombre: '', descripcion: '', descuento: '', codigo: '', categoria: '', logo_url: '' });
      showToast('Alianza registrada.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); } finally { setSaving(false); }
  };

  const toggleActivo = async (a) => {
    try {
      await api.updateAlianza(a.id, { activo: !a.activo });
      showToast(`Alianza ${!a.activo ? 'activada' : 'desactivada'}.`);
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
  };

  const abrirEditar = (a) => {
    setEditId(a.id);
    setForm({ nombre: a.nombre, descripcion: a.descripcion || '', descuento: a.descuento || '', codigo: a.codigo || '', categoria: a.categoria || '', logo_url: a.logo_url || '' });
    setShowForm(true);
  };

  const guardarEdicion = async () => {
    setSaving(true);
    try {
      await api.updateAlianza(editId, form);
      setShowForm(false);
      setEditId(null);
      setForm({ nombre: '', descripcion: '', descuento: '', codigo: '', categoria: '', logo_url: '' });
      showToast('Alianza actualizada.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); } finally { setSaving(false); }
  };

  const cancelar = () => { setShowForm(false); setEditId(null); setForm({ nombre: '', descripcion: '', descuento: '', codigo: '', categoria: '', logo_url: '' }); };

  return (
    <>
      <div className="ph">
        <h2>🤜 Alianzas</h2>
        <p>Beneficios y descuentos exclusivos para socios del fondo</p>
      </div>

      {activas.length > 0 && (
        <div className="al ok" style={{ marginBottom: 16 }}>
          🎉 Tienes acceso a <strong>{activas.length} alianza(s)</strong> con descuentos exclusivos por ser socio del fondo.
        </div>
      )}

      {user.is_admin && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn primary" onClick={() => { cancelar(); setShowForm(v => !v); }}>
            {showForm && !editId ? 'Cancelar' : '+ Nueva Alianza'}
          </button>
        </div>
      )}

      {showForm && user.is_admin && (
        <div className="card" style={{ borderTop: '3px solid var(--gold)' }}>
          <div className="ct">{editId ? 'Editar Alianza' : 'Nueva Alianza'}</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field"><label>Nombre del negocio</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Restaurante La Palma, Peluqueria Style..." /></div>
            <div className="field"><label>Categoria</label><input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="Restaurante, Salud, Moda, Tecnologia..." /></div>
            <div className="field ff"><label>Descripcion del beneficio</label><input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="10% de descuento en todos los platos del menu..." /></div>
            <div className="field"><label>Descuento</label><input value={form.descuento} onChange={e => setForm({ ...form, descuento: e.target.value })} placeholder="10%, 2x1, $20.000 off..." /></div>
            <div className="field"><label>Codigo exclusivo</label><input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="CASHDAVE10, FONDO2026..." /></div>
            <div className="field ff"><label>URL del logo (opcional)</label><input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={editId ? guardarEdicion : crear} disabled={saving}>{saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Registrar alianza'}</button>
            <button className="btn ghost" onClick={cancelar}>Cancelar</button>
          </div>
        </div>
      )}

      {!alianzas?.length ? (
        <div className="card"><div className="empty"><div className="ei">🤝</div>Pronto tendremos alianzas y descuentos exclusivos para ti.</div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {alianzas.map(a => (
            <div key={a.id} className="card" style={{ opacity: a.activo ? 1 : 0.5, borderTop: `3px solid ${a.activo ? 'var(--gold)' : 'var(--border)'}`, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                {a.logo_url ? (
                  <img src={a.logo_url} alt={a.nombre} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: 'linear-gradient(135deg, var(--gold), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏪</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{a.nombre}</div>
                  {a.categoria && <span className="badge bgo" style={{ marginTop: 4, fontSize: 10 }}>{a.categoria}</span>}
                </div>
                <div style={{ background: 'var(--gold)', color: '#000', fontWeight: 800, fontSize: 13, padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>{a.descuento}</div>
              </div>

              {a.descripcion && <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.5 }}>{a.descripcion}</p>}

              {a.codigo && (
                <div style={{ background: 'var(--surface2)', border: '1.5px dashed var(--gold)', borderRadius: 'var(--rs)', padding: '10px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Codigo exclusivo socio</div>
                  {codigoVisible === a.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18, color: 'var(--gold2)', letterSpacing: '0.1em' }}>{a.codigo}</span>
                      <button className="btn sm ghost" onClick={() => { navigator.clipboard?.writeText(a.codigo); showToast('Codigo copiado!'); }}>Copiar</button>
                    </div>
                  ) : (
                    <button className="btn sm gold" style={{ width: '100%' }} onClick={() => setCodigoVisible(a.id)}>🔓 Ver mi codigo</button>
                  )}
                </div>
              )}

              {user.is_admin && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn sm ghost" onClick={() => abrirEditar(a)}>✏️ Editar</button>
                  <button className={`btn sm ${a.activo ? 'danger' : 'success'}`} onClick={() => toggleActivo(a)}>{a.activo ? 'Desactivar' : 'Activar'}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   NOTICIAS — ⚡ FIX: createObjectURL + uploadMedia (bucket correcto)
───────────────────────────────────────────────────────────── */
function Noticias({ user, showToast, setLight }) {
  const { data: noticias, refetch } = useQuery(() => api.getNoticias(), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: '', contenido: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => () => { revokeIfBlob(preview); }, []); // eslint-disable-line

  const handleFile = (f) => {
    try {
      const err = validateImage(f);
      if (err) { showToast(err, 'err'); return; }
      revokeIfBlob(preview);
      setFile(f);
      setPreview(URL.createObjectURL(f));
    } catch (ex) {
      console.error('[Noticias.handleFile]', ex);
      showToast('No se pudo cargar la imagen.', 'err');
      setFile(null); setPreview(null);
    }
  };

  const cerrarForm = () => {
    revokeIfBlob(preview);
    setShowForm(false);
    setForm({ titulo: '', contenido: '' });
    setFile(null);
    setPreview(null);
  };

  const publicar = async () => {
    if (!form.titulo) { showToast('El titulo es obligatorio.', 'err'); return; }
    if (saving) return;
    setSaving(true);
    try {
      let foto_url = null;
      if (file) {
        foto_url = await api.uploadMedia(file, user.id);
      }
      await api.createNoticia({ titulo: form.titulo, contenido: form.contenido, foto_url, autor_id: user.id, activo: true });
      cerrarForm();
      showToast('Noticia publicada.');
      refetch();
    } catch (e) {
      console.error('[Noticias.publicar]', e);
      showToast('Error al publicar: ' + (e?.message || 'intenta de nuevo'), 'err');
    } finally { setSaving(false); }
  };

  const eliminar = async (n) => {
    if (!window.confirm('Eliminar esta noticia?')) return;
    try {
      await api.updateNoticia(n.id, { activo: false });
      showToast('Noticia eliminada.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
  };

  const activas = (noticias || []).filter(n => n.activo);

  return (
    <>
      <div className="ph">
        <h2>📰 Noticias</h2>
        <p>Fotos y novedades del fondo solidario</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => showForm ? cerrarForm() : setShowForm(true)}>
          {showForm ? 'Cancelar' : '+ Publicar noticia'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
          <div className="ct">Nueva Noticia</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field ff">
              <label>Titulo</label>
              <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Reunion mensual, Evento de recaudacion..." />
            </div>
            <div className="field ff">
              <label>Contenido</label>
              <textarea value={form.contenido} onChange={e => setForm({ ...form, contenido: e.target.value })}
                placeholder="Describe lo que paso, comparte los detalles del evento..."
                style={{ minHeight: 80, resize: 'vertical', width: '100%', padding: '11px 14px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--rs)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
            </div>
            <div className="field ff">
              <label>Foto (opcional)</label>
              <div className="uz" onClick={() => { try { fileRef.current?.click(); } catch (_) { } }} style={{ padding: 16 }}>
                <div className="ui">{preview ? '✅' : '📷'}</div>
                <p>{preview ? <strong style={{ color: 'var(--green2)' }}>Imagen lista</strong> : <><strong>Toca</strong> para agregar foto</>}</p>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target?.files?.[0]; if (f) handleFile(f); }} />
              </div>
              {preview && <img src={preview} className="prev" alt="preview" />}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={publicar} disabled={saving}>{saving ? 'Publicando...' : 'Publicar'}</button>
            <button className="btn ghost" onClick={cerrarForm} disabled={saving}>Cancelar</button>
          </div>
        </div>
      )}

      {!activas.length ? (
        <div className="card"><div className="empty"><div className="ei">📰</div>Aun no hay noticias. Se el primero en publicar!</div></div>
      ) : (
        activas.map(n => (
          <div key={n.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {n.foto_url && (
              <img src={n.foto_url} alt={n.titulo}
                style={{ width: '100%', maxHeight: 280, objectFit: 'cover', cursor: 'zoom-in' }}
                onClick={() => setLight(n.foto_url)} />
            )}
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700 }}>{n.titulo}</h3>
                {(user.is_admin || user.id === n.autor_id) && (
                  <button className="btn sm danger" onClick={() => eliminar(n)}>🗑</button>
                )}
              </div>
              {n.contenido && <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>{n.contenido}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                  {initials(n.miembros?.nombre || '?')}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{n.miembros?.nombre} · {new Date(n.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   EVENTOS — ya usaba createObjectURL, solo se reforzo
───────────────────────────────────────────────────────────── */
function Eventos({ user, showToast, setLight }) {
  const { data: eventos, refetch } = useQuery(() => api.getEventos(), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: '', descripcion: '', fecha_evento: '', lugar: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => () => { revokeIfBlob(preview); }, []); // eslint-disable-line

  const handleFile = (f) => {
    try {
      const err = validateImage(f);
      if (err) { showToast(err, 'err'); return; }
      revokeIfBlob(preview);
      setFile(f);
      setPreview(URL.createObjectURL(f));
    } catch (ex) {
      console.error('[Eventos.handleFile]', ex);
      showToast('No se pudo cargar la imagen.', 'err');
      setFile(null); setPreview(null);
    }
  };

  const limpiarForm = () => {
    revokeIfBlob(preview);
    setShowForm(false);
    setForm({ titulo: '', descripcion: '', fecha_evento: '', lugar: '' });
    setFile(null);
    setPreview(null);
  };

  const publicar = async () => {
    if (!form.titulo || !form.fecha_evento) { showToast('Titulo y fecha son obligatorios.', 'err'); return; }
    if (saving) return;
    setSaving(true);
    try {
      let foto_url = null;
      if (file) foto_url = await api.uploadMedia(file, user.id);
      await api.createEvento({ ...form, foto_url, autor_id: user.id, activo: true });
      limpiarForm();
      showToast('Evento publicado.');
      refetch();
    } catch (e) {
      console.error('[Eventos.publicar]', e);
      showToast('Error al publicar: ' + (e?.message || 'Intenta de nuevo'), 'err');
    } finally { setSaving(false); }
  };

  const eliminar = async (e) => {
    if (!window.confirm('Eliminar este evento?')) return;
    try {
      await api.updateEvento(e.id, { activo: false });
      showToast('Evento eliminado.');
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
  };

  const hoy = today();
  const activos = (eventos || []).filter(e => e.activo);
  const proximos = activos.filter(e => e.fecha_evento >= hoy);
  const pasados = activos.filter(e => e.fecha_evento < hoy);

  const CardEvento = ({ e }) => (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {e.foto_url && (
        <img src={e.foto_url} alt={e.titulo} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', cursor: 'zoom-in' }} onClick={() => setLight(e.foto_url)} />
      )}
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
          <div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700 }}>{e.titulo}</h3>
            <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--accent2)' }}>📅 {new Date(e.fecha_evento + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              {e.lugar && <span style={{ fontSize: 12, color: 'var(--text3)' }}>📍 {e.lugar}</span>}
            </div>
          </div>
          {(user.is_admin || user.id === e.autor_id) && (
            <button className="btn sm danger" onClick={() => eliminar(e)}>🗑</button>
          )}
        </div>
        {e.descripcion && <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{e.descripcion}</p>}
      </div>
    </div>
  );

  return (
    <>
      <div className="ph">
        <h2>🗓️ Eventos</h2>
        <p>Actividades programadas y pasadas del fondo</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => showForm ? limpiarForm() : setShowForm(true)}>
          {showForm ? 'Cancelar' : '+ Publicar evento'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ borderTop: '3px solid var(--purple)' }}>
          <div className="ct">Nuevo Evento</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field ff"><label>Titulo del evento</label><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Tarde de integracion, Bingo solidario..." /></div>
            <div className="field"><label>Fecha del evento</label><input type="date" value={form.fecha_evento} onChange={e => setForm({ ...form, fecha_evento: e.target.value })} /></div>
            <div className="field"><label>Lugar</label><input value={form.lugar} onChange={e => setForm({ ...form, lugar: e.target.value })} placeholder="Parque El Tunal, Casa comunal..." /></div>
            <div className="field ff">
              <label>Descripcion</label>
              <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Detalles del evento, como participar, que llevar..."
                style={{ minHeight: 80, resize: 'vertical', width: '100%', padding: '11px 14px', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--rs)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
            </div>
            <div className="field ff">
              <label>Foto (opcional)</label>
              <div className="uz" onClick={() => { try { fileRef.current?.click(); } catch (_) { } }} style={{ padding: 16 }}>
                <div className="ui">{preview ? '✅' : '📷'}</div>
                <p>{preview ? <strong style={{ color: 'var(--green2)' }}>Imagen lista</strong> : <><strong>Toca</strong> para agregar foto</>}</p>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target?.files?.[0]; if (f) handleFile(f); }} />
              </div>
              {preview && <img src={preview} className="prev" alt="preview" />}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={publicar} disabled={saving}>{saving ? 'Publicando...' : 'Publicar evento'}</button>
            <button className="btn ghost" onClick={limpiarForm}>Cancelar</button>
          </div>
        </div>
      )}

      {proximos.length > 0 && (
        <>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, marginBottom: 12, color: 'var(--accent2)' }}>📌 Proximos eventos</h3>
          {proximos.map(e => <CardEvento key={e.id} e={e} />)}
        </>
      )}

      {pasados.length > 0 && (
        <>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, margin: '24px 0 12px', color: 'var(--text2)' }}>📁 Eventos pasados</h3>
          {pasados.map(e => <CardEvento key={e.id} e={e} />)}
        </>
      )}

      {!activos.length && (
        <div className="card"><div className="empty"><div className="ei">🗓️</div>No hay eventos publicados aun. Crea el primero!</div></div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   MERCH — ⚡ FIX: createObjectURL en vez de base64
───────────────────────────────────────────────────────────── */
function Merch({ user, showToast, setLight }) {
  const { data: productos, refetch } = useQuery(() => api.getMerch(), []);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: '', tallas: '', colores: '', stock: '0' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const WHATSAPP_ADMIN = '573001234567';

  useEffect(() => () => { revokeIfBlob(preview); }, []); // eslint-disable-line

  const disponibles = (productos || []).filter(p => p.disponible);

  const handleFile = (f) => {
    try {
      const err = validateImage(f);
      if (err) { showToast(err, 'err'); return; }
      revokeIfBlob(preview);
      setFile(f);
      setPreview(URL.createObjectURL(f));
    } catch (ex) {
      console.error('[Merch.handleFile]', ex);
      showToast('No se pudo cargar la imagen.', 'err');
      setFile(null); setPreview(null);
    }
  };

  const cancelar = () => {
    revokeIfBlob(preview);
    setShowForm(false);
    setEditId(null);
    setForm({ nombre: '', descripcion: '', precio: '', tallas: '', colores: '', stock: '0' });
    setFile(null);
    setPreview(null);
  };

  const crear = async () => {
    if (!form.nombre || !form.precio) { showToast('Nombre y precio son obligatorios.', 'err'); return; }
    if (saving) return;
    setSaving(true);
    try {
      let foto_url = null;
      if (file) foto_url = await api.uploadMedia(file, user.id);
      await api.createMerch({
        nombre: form.nombre,
        descripcion: form.descripcion,
        precio: parseInt(form.precio),
        tallas: form.tallas,
        colores: form.colores,
        stock: parseInt(form.stock) || 0,
        foto_url,
        disponible: true,
      });
      cancelar();
      showToast('Producto agregado.');
      refetch();
    } catch (e) {
      console.error('[Merch.crear]', e);
      showToast('Error: ' + (e?.message || 'intenta de nuevo'), 'err');
    } finally { setSaving(false); }
  };

  const abrirEditar = (p) => {
    revokeIfBlob(preview);
    setEditId(p.id);
    setForm({ nombre: p.nombre, descripcion: p.descripcion || '', precio: String(p.precio), tallas: p.tallas || '', colores: p.colores || '', stock: String(p.stock || 0) });
    setFile(null);
    setPreview(p.foto_url || null); // URL remota, no blob
    setShowForm(true);
  };

  const guardarEdicion = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Si el preview es una URL remota (no blob) y no hay file nuevo, conservar foto_url
      let foto_url = null;
      if (file) {
        foto_url = await api.uploadMedia(file, user.id);
      } else if (preview && typeof preview === 'string' && !preview.startsWith('blob:')) {
        foto_url = preview;
      }
      await api.updateMerch(editId, {
        nombre: form.nombre,
        descripcion: form.descripcion,
        precio: parseInt(form.precio),
        tallas: form.tallas,
        colores: form.colores,
        stock: parseInt(form.stock) || 0,
        ...(foto_url !== null && { foto_url }),
      });
      cancelar();
      showToast('Producto actualizado.');
      refetch();
    } catch (e) {
      console.error('[Merch.guardarEdicion]', e);
      showToast('Error: ' + (e?.message || 'intenta de nuevo'), 'err');
    } finally { setSaving(false); }
  };

  const toggleDisponible = async (p) => {
    try {
      await api.updateMerch(p.id, { disponible: !p.disponible });
      showToast(`Producto ${!p.disponible ? 'activado' : 'desactivado'}.`);
      refetch();
    } catch (e) { showToast(e.message, 'err'); }
  };

  const pedirPorWhatsApp = (p) => {
    const msg = encodeURIComponent(`Hola! Soy ${user.nombre}, socio del Fondo CashDave.\nQuiero pedir: *${p.nombre}*\nPrecio: ${COP(p.precio)}\n${p.tallas ? 'Tallas disponibles: ' + p.tallas : ''}\n${p.colores ? 'Colores: ' + p.colores : ''}\n\nPor favor confirma disponibilidad y datos de pago. Gracias!`);
    window.open(`https://wa.me/${WHATSAPP_ADMIN}?text=${msg}`, '_blank');
  };

  return (
    <>
      <div className="ph">
        <h2>👕 Merch CashDave</h2>
        <p>Productos exclusivos para socios del fondo</p>
      </div>

      {user.is_admin && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn primary" onClick={() => { cancelar(); setShowForm(v => !v); }}>
            {showForm && !editId ? 'Cancelar' : '+ Agregar producto'}
          </button>
        </div>
      )}

      {showForm && user.is_admin && (
        <div className="card" style={{ borderTop: '3px solid var(--purple)' }}>
          <div className="ct">{editId ? 'Editar Producto' : 'Nuevo Producto'}</div>
          <div className="fg" style={{ marginTop: 14 }}>
            <div className="field ff"><label>Nombre del producto</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Camiseta CashDave, Gorra del fondo..." /></div>
            <div className="field"><label>Precio (COP)</label><input type="number" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="50000" /></div>
            <div className="field"><label>Stock disponible</label><input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="10" /></div>
            <div className="field"><label>Tallas</label><input value={form.tallas} onChange={e => setForm({ ...form, tallas: e.target.value })} placeholder="S, M, L, XL" /></div>
            <div className="field"><label>Colores</label><input value={form.colores} onChange={e => setForm({ ...form, colores: e.target.value })} placeholder="Negro, Blanco, Azul..." /></div>
            <div className="field ff"><label>Descripcion</label><input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Camiseta 100% algodon con logo bordado..." /></div>
            <div className="field ff">
              <label>Foto del producto</label>
              <div className="uz" onClick={() => { try { fileRef.current?.click(); } catch (_) { } }} style={{ padding: 16 }}>
                <div className="ui">{preview ? '✅' : '📷'}</div>
                <p>{preview ? <strong style={{ color: 'var(--green2)' }}>Imagen lista — toca para cambiar</strong> : <><strong>Toca</strong> para agregar foto</>}</p>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target?.files?.[0]; if (f) handleFile(f); }} />
              </div>
              {preview && <img src={preview} className="prev" alt="preview" />}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={editId ? guardarEdicion : crear} disabled={saving}>{saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Agregar producto'}</button>
            <button className="btn ghost" onClick={cancelar}>Cancelar</button>
          </div>
        </div>
      )}

      {!disponibles.length && !user.is_admin ? (
        <div className="card"><div className="empty"><div className="ei">👕</div>Pronto tendremos merch exclusivo disponible!</div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
          {(productos || []).map(p => (
            <div key={p.id} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', cursor: 'pointer', opacity: p.disponible ? 1 : 0.5 }}
              onClick={() => setLight(p.foto_url || null)}>
              {p.foto_url ? (
                <img src={p.foto_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>👕</div>
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8, opacity: 0, transition: 'opacity .2s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, textAlign: 'center', marginBottom: 4 }}>{p.nombre}</div>
                <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: 14 }}>{COP(p.precio)}</div>
              </div>
              {!p.disponible && (
                <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(239,68,68,0.9)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>Sin stock</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {(productos || []).filter(p => p.disponible || user.is_admin).map(p => (
          <div key={p.id} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            {p.foto_url ? (
              <img src={p.foto_url} alt={p.nombre} style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 10, background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>👕</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nombre}</div>
              {p.descripcion && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{p.descripcion}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                {p.tallas && <span style={{ fontSize: 11, color: 'var(--text3)' }}>📐 {p.tallas}</span>}
                {p.colores && <span style={{ fontSize: 11, color: 'var(--text3)' }}>🎨 {p.colores}</span>}
                {p.stock > 0 && <span style={{ fontSize: 11, color: 'var(--green2)' }}>📦 {p.stock} uds</span>}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, fontSize: 16, color: 'var(--gold2)' }}>{COP(p.precio)}</div>
              {p.disponible ? (
                <button className="btn sm primary" onClick={() => pedirPorWhatsApp(p)}>💬 Pedir</button>
              ) : (
                <span className="badge br" style={{ fontSize: 10 }}>Sin stock</span>
              )}
              {user.is_admin && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn sm ghost" onClick={() => abrirEditar(p)}>✏️</button>
                  <button className={`btn sm ${p.disponible ? 'danger' : 'success'}`} onClick={() => toggleDisponible(p)}>{p.disponible ? 'Off' : 'On'}</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
