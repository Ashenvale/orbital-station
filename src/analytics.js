// ---------------------------------------------------------------------------
// Métricas anónimas (PostHog), al estilo de Dungeon_Lord.
//  - Identidad anónima por navegador (os_userid) + id de sesión por carga.
//  - track(event, props) bufferiza; flush por sendBeacon cada 30s, al cerrar
//    la pestaña (pagehide) y al ocultarse.
//  - Se SILENCIA en local-dev (localhost/file) para no ensuciar el dashboard
//    con mis sesiones de prueba; en itch.io sí envía.
//  - Cada evento lleva game/version/$session_id/distinct_id automáticamente.
//  - Captura js_error y session_end.
// NOTA: usa el mismo proyecto PostHog que Dungeon_Lord; se distingue por la
// propiedad `game: 'orbital-station'`. Para separarlo, cambiá POSTHOG_KEY por
// la key de un proyecto propio.
// ---------------------------------------------------------------------------
import { VERSION } from './version.js';

const POSTHOG_KEY = 'phc_qKVyp3ff4uXcQaVUVbg7U5w8dCvU8DibVS4QUjU7bABP';
const POSTHOG_URL = 'https://us.i.posthog.com/batch/';
const GAME = 'orbital-station';

const USER_KEY = 'os_userid';
const LASTVISIT_KEY = 'os_lastvisit';
const FLUSH_MS = 30000;
const BUFFER_MAX = 50;
const MAX_ERRORS = 50;

function isLocalDev() {
  try {
    if (typeof location === 'undefined') return false;
    if (location.protocol === 'file:') return true;
    const h = (location.hostname || '').toLowerCase();
    return (
      h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' ||
      h === '::1' || h === '[::1]' || h === '' || h.endsWith('.local')
    );
  } catch (e) {
    return false;
  }
}

const SESSION_ID = 's_v1_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random());
let _sessionStart = Date.now();
let _isNewUser = false;

function getUserId() {
  let uid = localStorage.getItem(USER_KEY);
  if (!uid) {
    uid = 'u_v1_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random());
    localStorage.setItem(USER_KEY, uid);
    _isNewUser = true;
  }
  return uid;
}

function navigationType() {
  try {
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav && nav.type) return nav.type;
  } catch (e) {}
  return 'unknown';
}

function secondsSinceLastVisit() {
  let prev = null;
  try {
    const raw = localStorage.getItem(LASTVISIT_KEY);
    if (raw) prev = parseInt(raw, 10);
    localStorage.setItem(LASTVISIT_KEY, String(Date.now()));
  } catch (e) {}
  if (!prev || !Number.isFinite(prev)) return null;
  return Math.round((Date.now() - prev) / 1000);
}

let _buffer = [];

function flush() {
  if (_buffer.length === 0) return false;
  if (isLocalDev()) return false; // dev: no enviar
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return false;
  const batch = _buffer.splice(0);
  const body = JSON.stringify({ api_key: POSTHOG_KEY, batch });
  const ok = navigator.sendBeacon(POSTHOG_URL, new Blob([body], { type: 'text/plain' }));
  if (!ok) {
    _buffer.unshift(...batch);
    return false;
  }
  return true;
}

function track(event, properties) {
  try {
    _buffer.push({
      event,
      distinct_id: getUserId(),
      properties: {
        $session_id: SESSION_ID,
        game: GAME,
        version: VERSION,
        ...(properties || {})
      },
      timestamp: new Date().toISOString()
    });
    if (_buffer.length >= BUFFER_MAX) flush();
  } catch (e) {
    /* nunca romper el juego por métricas */
  }
}

// -- js_error (dedupe + tope) -----------------------------------------------
const _seenErr = new Set();
function handleError(info) {
  const source = info.source || '';
  if (source.indexOf('analytics') >= 0) return;
  if (_seenErr.size >= MAX_ERRORS) return;
  const hash = (info.message || '') + '|' + source + '|' + (info.line || '');
  if (_seenErr.has(hash)) return;
  _seenErr.add(hash);
  track('js_error', {
    message: String(info.message || '').slice(0, 300),
    source,
    line: info.line || null,
    stack: String(info.stack || '').slice(0, 500),
    ua: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 200)
  });
  flush();
}

function emitSessionEnd(reason) {
  track('session_end', {
    duration_s: Math.round((Date.now() - _sessionStart) / 1000),
    reason: reason || 'pagehide'
  });
  flush();
}

// -- Lifecycle (solo en navegador) ------------------------------------------
if (typeof window !== 'undefined') {
  if (typeof setInterval === 'function') setInterval(flush, FLUSH_MS);
  addEventListener('pagehide', () => emitSessionEnd('pagehide'));
  addEventListener('error', (e) => {
    if (e.target && e.target !== window) return;
    if (!e.error && !e.message) return;
    handleError({ message: e.message, source: e.filename, line: e.lineno, stack: e.error && e.error.stack });
  });
  addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    handleError({
      message: r && r.message ? r.message : 'Unhandled rejection: ' + String(r),
      source: 'promise',
      stack: r && r.stack
    });
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }
}

export const Analytics = {
  track,
  flush,
  isNewUser: () => _isNewUser,
  navigationType,
  secondsSinceLastVisit,
  // app_loaded: lo llama MenuScene la primera vez por carga.
  appLoaded(extra) {
    track('app_loaded', {
      isNewUser: this.isNewUser(),
      nav: navigationType(),
      secsSinceLastVisit: secondsSinceLastVisit(),
      // Tag a nivel PERSONA: permite filtrar "gente que jugó orbital-station"
      // (y separar de Dungeon_Lord en el proyecto compartido).
      $set: { game: GAME },
      ...(extra || {})
    });
  }
};
