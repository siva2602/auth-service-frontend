/**
 * Helpers for generating fresh test identities (avoids handle-taken and rate-limit issues).
 */

import { config } from './api.js';

/** @returns {string} */
export function randomHandle(prefix = 'user') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** @returns {string} E.164 phone with random last 4 digits */
export function randomPhone() {
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `+91987654${suffix}`;
}

/** @returns {string} */
export function randomEmail() {
  return `test_${Date.now().toString(36)}@example.com`;
}

/**
 * Fill signup form fields with a new unique identity.
 */
export function fillSignupIdentity() {
  const handle = document.getElementById('handle');
  const phone = document.getElementById('phone');
  const email = document.getElementById('email');
  if (handle) handle.value = randomHandle();
  if (phone) phone.value = randomPhone();
  if (email) email.value = randomEmail();
}

/**
 * Explain why OTP may not appear in docker logs after a uniform 200 response.
 * @param {import('./api.js').ApiResult} result
 */
export function explainOtpDelivery(result) {
  if (result.corsLikely || result.networkError) {
    return {
      level: 'blocked',
      text: 'Request blocked by browser (CORS). OTP was NOT sent. Ensure your origin is listed in VITE_CORS_ORIGINS (.env) and backend CORS_ORIGINS. Check the debug panel.',
    };
  }
  if (result.status === 401) {
    return {
      level: 'blocked',
      text: `401 Unauthorized — check API key for target "${config.authTarget}" in src/auth-targets.js.`,
    };
  }
  if (result.status === 200) {
    return {
      level: 'warn',
      text: 'API returned 200, but OTP is only logged when eligible. Common reasons for NO log line: (1) handle already registered — click "New test identity", (2) same phone/email used within the last 1 minute (rate limit), (3) invalid phone/email format. Watch logs with the command in the OTP help box below.',
    };
  }
  return null;
}

/**
 * @param {HTMLElement} el
 * @param {{ level: string, text: string }|null} hint
 */
export function renderOtpHint(el, hint) {
  if (!el) return;
  if (!hint) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  el.className = `origin-banner ${hint.level === 'blocked' ? 'blocked-hint' : 'blocked-hint'}`;
  if (hint.level === 'warn') {
    el.className = 'origin-banner';
    el.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    el.style.background = 'rgba(245, 158, 11, 0.08)';
  }
  el.textContent = hint.text;
}
