/**
 * API targets selected by VITE_AUTH_TARGET (local | dev).
 * Docs URLs are for reference/Swagger; API calls use apiBaseUrl only.
 */

/** @typedef {'local' | 'dev'} AuthTarget */

/** @type {Record<AuthTarget, { apiBaseUrl: string, apiKey: string, docsUrl: string, label: string }>} */
export const AUTH_TARGETS = {
  local: {
    label: 'local',
    apiBaseUrl: 'http://localhost:8081',
    apiKey: 'dev-local-api-key-change-me',
    docsUrl: 'http://localhost:8081/docs/dev-local-api-key-change-me',
  },
  dev: {
    label: 'dev',
    apiBaseUrl: 'http://18.134.155.144:8081',
    apiKey: 'dev-local-api-key-change-me',
    docsUrl: 'http://18.134.155.144:8081/docs/dev-local-api-key-change-me',
  },
};

/**
 * Resolve active target from VITE_AUTH_TARGET.
 * @returns {typeof AUTH_TARGETS.local}
 */
export function resolveAuthTarget() {
  const raw = (import.meta.env.VITE_AUTH_TARGET || 'local').toLowerCase().trim();
  if (raw === 'dev') {
    return AUTH_TARGETS.dev;
  }
  if (raw !== 'local') {
    console.warn(`Unknown VITE_AUTH_TARGET="${raw}", falling back to local`);
  }
  return AUTH_TARGETS.local;
}
