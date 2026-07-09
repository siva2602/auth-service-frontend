import './styles.css';
import {
  apiRequest,
  appendResponseHistory,
  config,
  initConsoleCapture,
  mountDebugPanel,
} from './api.js';
import { explainOtpDelivery, fillSignupIdentity, renderOtpHint } from './test-identity.js';

initConsoleCapture();

const historyEl = document.getElementById('response-history');
const otpHintEl = document.getElementById('otp-hint');
const debugMount = document.getElementById('debug-panel');
mountDebugPanel(debugMount);

// Fresh identity avoids "handle already exists" and stale rate-limit collisions.
fillSignupIdentity();
document.getElementById('btn-new-identity')?.addEventListener('click', () => {
  fillSignupIdentity();
  renderOtpHint(otpHintEl, null);
});

// Step state
let otpSessionId = null;
let bootstrapToken = null;
let currentStep = 1;

const steps = {
  1: document.getElementById('step-1'),
  2: document.getElementById('step-2'),
  3: document.getElementById('step-3'),
  4: document.getElementById('step-4'),
};

const otpModeSelect = document.getElementById('otp-mode');
const phoneGroup = document.getElementById('phone-group');
const emailGroup = document.getElementById('email-group');
const phoneCodeGroup = document.getElementById('phone-code-group');
const emailCodeGroup = document.getElementById('email-code-group');

/** Toggle visible fields based on OTP channel mode. */
function updateOtpModeFields() {
  const mode = otpModeSelect.value;
  phoneGroup.classList.toggle('hidden', mode === 'email');
  emailGroup.classList.toggle('hidden', mode === 'phone');
  phoneCodeGroup.classList.toggle('hidden', mode === 'email');
  emailCodeGroup.classList.toggle('hidden', mode === 'phone');
}

otpModeSelect.addEventListener('change', updateOtpModeFields);
updateOtpModeFields();

function setStep(n) {
  currentStep = n;
  Object.entries(steps).forEach(([k, el]) => {
    const num = Number(k);
    el.classList.remove('active', 'done');
    if (num < n) el.classList.add('done');
    if (num === n) el.classList.add('active');
  });
}

function buildSendBody() {
  const mode = otpModeSelect.value;
  const body = { handle: document.getElementById('handle').value.trim() };
  if (mode === 'phone' || mode === 'both') {
    body.phone = document.getElementById('phone').value.trim();
  }
  if (mode === 'email' || mode === 'both') {
    body.email = document.getElementById('email').value.trim();
  }
  return body;
}

document.getElementById('btn-send-otp').addEventListener('click', async () => {
  const result = await apiRequest('POST', '/v1/auth/signup/otp/send', buildSendBody());
  appendResponseHistory(historyEl, 'Signup — send OTP', result);
  renderOtpHint(otpHintEl, explainOtpDelivery(result));
  if (result.body && typeof result.body === 'object' && result.body.otp_session_id) {
    otpSessionId = result.body.otp_session_id;
    document.getElementById('otp-session-id').value = otpSessionId;
    if (!result.corsLikely && !result.networkError) setStep(2);
  }
});

document.getElementById('btn-resend-otp').addEventListener('click', async () => {
  const sessionId = document.getElementById('otp-session-id').value.trim() || otpSessionId;
  if (!sessionId) return;
  const result = await apiRequest('POST', '/v1/auth/signup/otp/resend', {
    otp_session_id: sessionId,
  });
  appendResponseHistory(historyEl, 'Signup — resend OTP', result);
});

document.getElementById('btn-verify-otp').addEventListener('click', async () => {
  const mode = otpModeSelect.value;
  const body = { otp_session_id: document.getElementById('otp-session-id').value.trim() };
  if (mode === 'phone' || mode === 'both') {
    body.phone_code = document.getElementById('phone-code').value.trim();
  }
  if (mode === 'email' || mode === 'both') {
    body.email_code = document.getElementById('email-code').value.trim();
  }
  const result = await apiRequest('POST', '/v1/auth/signup/otp/verify', body);
  appendResponseHistory(historyEl, 'Signup — verify OTP', result);
  if (result.body && typeof result.body === 'object' && result.body.bootstrap_token) {
    bootstrapToken = result.body.bootstrap_token;
    document.getElementById('bootstrap-token').value = bootstrapToken;
    setStep(3);
  }
});

document.getElementById('btn-finish').addEventListener('click', async () => {
  const token = document.getElementById('bootstrap-token').value.trim() || bootstrapToken;
  if (!token) return;
  const result = await apiRequest('POST', '/v1/auth/signup/finish', { bootstrap_token: token });
  appendResponseHistory(historyEl, 'Signup — finish', result);
  if (result.ok) setStep(4);
});

// Show config summary in header
document.getElementById('config-summary').textContent =
  `Target: ${config.authTarget} · API: ${config.apiBaseUrl} · Platform: ${config.platform}`;

setStep(1);
