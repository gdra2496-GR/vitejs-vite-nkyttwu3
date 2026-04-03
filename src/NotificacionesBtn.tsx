import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dikrihjhzoqyayibynmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpa3JpaGpoem9xeWF5aWJ5bm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMjAyMTEsImV4cCI6MjA4Nzc5NjIxMX0.nPwuz_JHMzqMJMh3iTSq_974PsUe4r9EMmmMTkEemew'
);

const VAPID_PUBLIC_KEY =
  'BLVOqIzv01i6QNeIFqHNuA3lTLYt_aWfdx9D_tstsFLm6xTKzenJnBcaxtDlKHAsxtJQO6kP0dsfqw2fuFmPZ7g';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

interface Props {
  miembroId: string;
}

export default function NotificacionesBtn({ miembroId }: Props) {
  const [estado, setEstado] = useState<
    'idle' | 'solicitando' | 'activo' | 'bloqueado' | 'noSoportado'
  >('idle');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado('noSoportado');
      return;
    }
    if (Notification.permission === 'denied') {
      setEstado('bloqueado');
      return;
    }
    navigator.serviceWorker.getRegistration('/sw.js').then((reg) => {
      if (!reg) return;
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setEstado('activo');
      });
    });
  }, [miembroId]);

  async function activar() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado('noSoportado');
      return;
    }
    setEstado('solicitando');
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'bloqueado' : 'idle');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const subJson = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const { error } = await supabase.from('device_tokens').upsert(
        {
          miembro_id: miembroId,
          token: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
          platform: 'web',
        },
        { onConflict: 'miembro_id,token' }
      );
      if (error) throw error;
      setEstado('activo');
    } catch (err) {
      console.error('Error activando notificaciones:', err);
      setEstado('idle');
    }
  }

  async function desactivar() {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('device_tokens').delete().eq('token', sub.endpoint);
        await sub.unsubscribe();
      }
    }
    setEstado('idle');
  }

  if (estado === 'noSoportado') return null;

  if (estado === 'activo') {
    return (
      <button
        onClick={desactivar}
        style={{
          background: 'none', border: '1px solid #ccc', borderRadius: 8,
          padding: '8px 14px', cursor: 'pointer', fontSize: 13,
          color: '#555', display: 'flex', alignItems: 'center', gap: 6,
        }}
        title="Desactivar recordatorios"
      >
        🔔 Recordatorios activos
      </button>
    );
  }

  if (estado === 'bloqueado') {
    return (
      <p style={{ fontSize: 12, color: '#999' }}>
        🔕 Notificaciones bloqueadas en el navegador
      </p>
    );
  }

  return (
    <button
      onClick={activar}
      disabled={estado === 'solicitando'}
      style={{
        background: '#16a34a', border: 'none', borderRadius: 8,
        padding: '10px 18px',
        cursor: estado === 'solicitando' ? 'wait' : 'pointer',
        fontSize: 14, color: '#fff', display: 'flex',
        alignItems: 'center', gap: 8, fontWeight: 600,
      }}
    >
      {estado === 'solicitando'
        ? '⏳ Activando...'
        : '🔔 Activar recordatorios del fondo'}
    </button>
  );
}
