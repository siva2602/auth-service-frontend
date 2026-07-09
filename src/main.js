import './styles.css';
import { allowedOrigins, config, initConsoleCapture, isOriginAllowed, mountDebugPanel, testPreflight } from './api.js';

initConsoleCapture();

document.getElementById('config-target').textContent = config.authTarget;
document.getElementById('config-api').textContent = config.apiBaseUrl;
document.getElementById('config-docs').innerHTML = `<a href="${config.docsUrl}" target="_blank" rel="noopener">${config.docsUrl}</a>`;
document.getElementById('config-origin').textContent = window.location.origin;
document.getElementById('config-allowed').textContent =
  allowedOrigins.length > 0 ? allowedOrigins.join(', ') : '(set VITE_CORS_ORIGINS in .env)';

const isAllowed = isOriginAllowed(window.location.origin);
const statusEl = document.getElementById('cors-status');
statusEl.textContent = isAllowed
  ? 'This origin is in VITE_CORS_ORIGINS — API calls should work (if backend CORS_ORIGINS matches).'
  : 'This origin is NOT in VITE_CORS_ORIGINS — expect CORS failures.';
statusEl.className = `origin-banner ${isAllowed ? 'allowed-hint' : 'blocked-hint'}`;

mountDebugPanel(document.getElementById('debug-panel'));

document.getElementById('btn-health').addEventListener('click', async () => {
  const url = `${config.apiBaseUrl.replace(/\/$/, '')}/health`;
  const start = performance.now();
  try {
    const res = await fetch(url);
    const body = await res.text();
    document.getElementById('health-result').textContent = JSON.stringify(
      {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body,
        timeMs: (performance.now() - start).toFixed(1),
      },
      null,
      2
    );
  } catch (err) {
    document.getElementById('health-result').textContent = String(err);
  }
});

document.getElementById('btn-preflight-index').addEventListener('click', () => {
  testPreflight('/v1/auth/login/otp/send');
});
