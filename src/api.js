/**
 * Shared API client and debug panel for domain-restriction testing.
 * Captures request/response metadata for CORS verification.
 */

const STORAGE_KEY_DEVICE = 'auth-test-device-id';

import { resolveAuthTarget } from './auth-targets.js';

/** UUID v4 — works in non-secure HTTP contexts where crypto.randomUUID is unavailable. */
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** @returns {string} */
export function getDeviceId() {
  let id = localStorage.getItem(STORAGE_KEY_DEVICE);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(STORAGE_KEY_DEVICE, id);
  }
  return id;
}

const target = resolveAuthTarget();

export const config = {
  authTarget: target.label,
  apiBaseUrl: target.apiBaseUrl,
  apiKey: target.apiKey,
  docsUrl: target.docsUrl,
  platform: import.meta.env.VITE_PLATFORM || 'web',
};

/** Parse comma-separated origins from VITE_CORS_ORIGINS (mirrors backend CORS_ORIGINS). */
function parseAllowedOrigins() {
  const raw = import.meta.env.VITE_CORS_ORIGINS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Origins expected to be allowlisted on the auth API (from .env). */
export const allowedOrigins = parseAllowedOrigins();

/** @param {string} origin */
export function isOriginAllowed(origin) {
  return allowedOrigins.includes(origin);
}

const consoleLogs = [];

/**
 * Patch console.error to collect browser messages for the debug panel.
 */
export function initConsoleCapture() {
  const originalError = console.error.bind(console);
  console.error = (...args) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    consoleLogs.unshift({ time: new Date().toISOString(), level: 'error', message: msg });
    if (consoleLogs.length > 30) consoleLogs.pop();
    renderConsoleLogs();
    originalError(...args);
  };
}

function renderConsoleLogs() {
  const el = document.getElementById('console-logs');
  if (!el) return;
  el.innerHTML = consoleLogs
    .map(
      (l) =>
        `<li class="${l.level === 'error' ? 'error' : ''}">[${l.time}] ${escapeHtml(l.message)}</li>`
    )
    .join('');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build standard auth API headers.
 * @returns {Record<string, string>}
 */
export function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': config.apiKey,
    'X-Platform': config.platform,
    'X-Device-ID': getDeviceId(),
  };
}

/**
 * @typedef {Object} ApiResult
 * @property {boolean} ok
 * @property {number|null} status
 * @property {Record<string, string>} responseHeaders
 * @property {unknown} body
 * @property {string} method
 * @property {string} endpoint
 * @property {string} url
 * @property {Record<string, string>} requestHeaders
 * @property {unknown} requestBody
 * @property {number} timeMs
 * @property {string|null} networkError
 * @property {boolean} corsLikely
 */

/** @type {ApiResult|null} */
let lastResult = null;

/** @returns {ApiResult|null} */
export function getLastResult() {
  return lastResult;
}

/**
 * Update the debug panel DOM with the latest request result.
 * @param {ApiResult} result
 */
export function updateDebugPanel(result) {
  lastResult = result;
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '—';
  };

  set('dbg-origin', window.location.origin);
  set('dbg-api-base', `${config.apiBaseUrl} (${config.authTarget})`);
  set('dbg-method', result.method);
  set('dbg-endpoint', result.endpoint);
  set('dbg-status', result.status != null ? String(result.status) : '—');
  set('dbg-time', `${result.timeMs.toFixed(1)} ms`);
  set('dbg-req-headers', JSON.stringify(result.requestHeaders, null, 2));
  set('dbg-res-headers', JSON.stringify(result.responseHeaders, null, 2));
  set(
    'dbg-res-body',
    typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2)
  );

  const corsEl = document.getElementById('dbg-cors');
  if (corsEl) {
    if (result.corsLikely) {
      corsEl.textContent = 'Likely CORS block (browser rejected cross-origin response)';
      corsEl.className = 'status-badge blocked';
    } else if (result.responseHeaders['access-control-allow-origin']) {
      corsEl.textContent = `CORS allowed: ${result.responseHeaders['access-control-allow-origin']}`;
      corsEl.className = 'status-badge ok';
    } else if (result.status != null) {
      corsEl.textContent = 'No Access-Control-Allow-Origin header in response';
      corsEl.className = 'status-badge warn';
    } else {
      corsEl.textContent = '—';
      corsEl.className = 'status-badge';
    }
  }

  const netEl = document.getElementById('dbg-network-error');
  if (netEl) {
    netEl.textContent = result.networkError || 'None';
    netEl.className = result.networkError ? 'status-badge blocked' : 'status-badge ok';
  }

  updateOriginBanner();
}

function updateOriginBanner() {
  const banner = document.getElementById('origin-banner');
  if (!banner) return;
  const origin = window.location.origin;
  const isAllowed = isOriginAllowed(origin);
  const allowlistLabel = allowedOrigins.length
    ? allowedOrigins.map((o) => `<code>${escapeHtml(o)}</code>`).join(', ')
    : '<em>(none — set VITE_CORS_ORIGINS in .env)</em>';
  banner.className = `origin-banner ${isAllowed ? 'allowed-hint' : 'blocked-hint'}`;
  banner.innerHTML = isAllowed
    ? `<strong>Origin:</strong> <code>${escapeHtml(origin)}</code> — matches configured <code>VITE_CORS_ORIGINS</code> entry. API calls should succeed.`
    : `<strong>Origin:</strong> <code>${escapeHtml(origin)}</code> — not in configured allowlist (${allowlistLabel}). Expect CORS errors unless this origin is on backend <code>CORS_ORIGINS</code>.`;
}

/**
 * Perform an API request and populate the debug panel.
 * @param {string} method
 * @param {string} endpoint
 * @param {object|undefined} body
 * @returns {Promise<ApiResult>}
 */
export async function apiRequest(method, endpoint, body) {
  const headers = buildHeaders();
  const url = `${config.apiBaseUrl.replace(/\/$/, '')}${endpoint}`;
  const start = performance.now();

  const base = {
    method,
    endpoint,
    url,
    requestHeaders: headers,
    requestBody: body ?? null,
    responseHeaders: {},
    body: null,
    status: null,
    ok: false,
    timeMs: 0,
    networkError: null,
    corsLikely: false,
  };

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });

    const timeMs = performance.now() - start;
    const responseHeaders = {};
    res.headers.forEach((v, k) => {
      responseHeaders[k.toLowerCase()] = v;
    });

    const text = await res.text();
    let parsed = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // keep raw text
    }

    const result = {
      ...base,
      ok: res.ok,
      status: res.status,
      responseHeaders,
      body: parsed,
      timeMs,
    };

    updateDebugPanel(result);
    return result;
  } catch (err) {
    const timeMs = performance.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const corsLikely =
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('Load failed');

    const result = {
      ...base,
      timeMs,
      networkError: message,
      corsLikely,
      body: {
        error: message,
        hint: corsLikely
          ? 'Browser blocked the response — typical CORS failure for non-whitelisted origins.'
          : undefined,
      },
    };

    console.error('API request failed:', message);
    updateDebugPanel(result);
    return result;
  }
}

/**
 * Send OPTIONS preflight to test CORS behavior without a request body.
 * @param {string} endpoint
 */
export async function testPreflight(endpoint = '/v1/auth/signup/otp/send') {
  const url = `${config.apiBaseUrl.replace(/\/$/, '')}${endpoint}`;
  const start = performance.now();

  const base = {
    method: 'OPTIONS',
    endpoint,
    url,
    requestHeaders: {
      Origin: window.location.origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers':
        'authorization,content-type,x-device-id,x-platform,x-api-key',
    },
    requestBody: null,
    responseHeaders: {},
    body: null,
    status: null,
    ok: false,
    timeMs: 0,
    networkError: null,
    corsLikely: false,
  };

  try {
    const res = await fetch(url, {
      method: 'OPTIONS',
      headers: base.requestHeaders,
    });

    const timeMs = performance.now() - start;
    const responseHeaders = {};
    res.headers.forEach((v, k) => {
      responseHeaders[k.toLowerCase()] = v;
    });

    const text = await res.text();
    const result = {
      ...base,
      ok: res.ok,
      status: res.status,
      responseHeaders,
      body: text || '(empty body — expected for OPTIONS)',
      timeMs,
    };

    updateDebugPanel(result);
    return result;
  } catch (err) {
    const timeMs = performance.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const result = {
      ...base,
      timeMs,
      networkError: message,
      corsLikely: true,
      body: { error: message },
    };
    console.error('Preflight failed:', message);
    updateDebugPanel(result);
    return result;
  }
}

/**
 * Render shared debug panel HTML into a container.
 * @param {HTMLElement} container
 */
export function mountDebugPanel(container) {
  container.innerHTML = `
    <div class="panel">
      <h2>Test helper / debug panel</h2>
      <div id="origin-banner" class="origin-banner"></div>
      <dl class="debug-meta" style="margin-top: 1rem;">
        <dt>Current origin</dt><dd id="dbg-origin">—</dd>
        <dt>API base URL</dt><dd id="dbg-api-base">—</dd>
        <dt>Request method</dt><dd id="dbg-method">—</dd>
        <dt>Endpoint</dt><dd id="dbg-endpoint">—</dd>
        <dt>Response status</dt><dd id="dbg-status">—</dd>
        <dt>Time taken</dt><dd id="dbg-time">—</dd>
        <dt>CORS</dt><dd><span id="dbg-cors" class="status-badge">—</span></dd>
        <dt>Network error</dt><dd><span id="dbg-network-error" class="status-badge ok">None</span></dd>
      </dl>
      <h3>Request headers</h3>
      <pre id="dbg-req-headers" class="code-block">—</pre>
      <h3>Response headers</h3>
      <pre id="dbg-res-headers" class="code-block">—</pre>
      <h3>Response body</h3>
      <pre id="dbg-res-body" class="code-block">—</pre>
      <h3>Browser console errors (captured)</h3>
      <ul id="console-logs" class="log-list"><li>—</li></ul>
      <div style="margin-top: 1rem;">
        <button type="button" id="btn-preflight" class="secondary">Test OPTIONS preflight</button>
      </div>
    </div>
  `;

  document.getElementById('btn-preflight')?.addEventListener('click', () => {
    testPreflight('/v1/auth/signup/otp/send');
  });

  updateOriginBanner();
}

/**
 * Append a response to the page history list.
 * @param {HTMLElement} container
 * @param {string} label
 * @param {ApiResult} result
 */
export function appendResponseHistory(container, label, result) {
  const item = document.createElement('div');
  item.className = 'response-item';
  const statusLabel =
    result.status != null
      ? `HTTP ${result.status}`
      : result.networkError
        ? 'Network error'
        : '—';
  const corsHeader = result.responseHeaders['access-control-allow-origin'];
  item.innerHTML = `
    <div class="title">${escapeHtml(label)} — ${escapeHtml(statusLabel)} (${result.timeMs.toFixed(0)} ms)</div>
    <div>CORS header: <code>${escapeHtml(corsHeader || 'none')}</code></div>
    <pre class="code-block">${escapeHtml(
      typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2)
    )}</pre>
  `;
  container.prepend(item);
}
