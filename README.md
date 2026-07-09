# Domain Restriction Test Frontend

Minimal Vite + vanilla JavaScript frontend for verifying **CORS origin allowlist** behavior on `auth-service-go`.

The backend only reflects `Access-Control-Allow-Origin` when the browser `Origin` header **exactly matches** an entry in `security.cors_origins` / `CORS_ORIGINS`. This app helps you confirm allowed origins work and unauthorized origins are blocked by the browser.

**No backend changes required.**

---

## Prerequisites

1. Auth service running for your target:
   - **local** → `http://localhost:8081` (Docker)
   - **dev** → `http://18.134.155.144:8081` ([Swagger](http://18.134.155.144:8081/docs/dev-local-api-key-change-me))

2. Default backend CORS config (`deploy/docker/.env`):

   ```env
   CORS_ORIGINS=http://localhost:3000
   ```

3. Node.js 18+ and npm

---

## Setup

```bash
cd test/domain-restriction-frontend
cp .env.example .env
npm install
```

### API target (`VITE_AUTH_TARGET`)

Set in `.env`:

| Value | API base | Swagger |
|-------|----------|---------|
| `local` | `http://localhost:8081` | `http://localhost:8081/docs/dev-local-api-key-change-me` |
| `dev` | `http://18.134.155.144:8081` | [http://18.134.155.144:8081/docs/dev-local-api-key-change-me](http://18.134.155.144:8081/docs/dev-local-api-key-change-me) |

```env
VITE_AUTH_TARGET=local   # or dev
```

URLs are defined in `src/auth-targets.js` — not in `.env`.

After changing `.env`, restart Vite (`Ctrl+C`, then `npm run dev:3000`).

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_AUTH_TARGET` | `local` | `local` or `dev` — selects API host |
| `VITE_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated origins (mirror backend `CORS_ORIGINS`) |
| `VITE_PLATFORM` | `web` | `X-Platform` header |

**CORS:** The API server must list your frontend origin in `CORS_ORIGINS` (e.g. `http://localhost:3000`). For `dev`, configure this on the remote server.

---

## Run the frontend

### Local API

```bash
# .env: VITE_AUTH_TARGET=local
npm run dev:3000
```

### Remote dev API

```bash
# Option A — set in .env: VITE_AUTH_TARGET=dev
npm run dev:3000

# Option B — one-off without editing .env
npm run dev:dev
```

Open: **http://localhost:3000**

### Unauthorized origin — different port

```bash
npm run dev:5174
```

Open: **http://localhost:5174**

### Unauthorized origin — another port

```bash
npm run dev:4000
```

Open: **http://localhost:4000**

### Custom domain via `/etc/hosts`

1. Add to `/etc/hosts`:

   ```
   127.0.0.1 auth-test.local
   ```

2. Run on port 80 (requires permission) or any port:

   ```bash
   npx vite --host auth-test.local --port 8088
   ```

3. Open: **http://auth-test.local:8088**

   This origin is **not** in the default allowlist unless you add `http://auth-test.local:8088` to backend `CORS_ORIGINS`.

---

## Pages

| Page | URL | Purpose |
|------|-----|---------|
| Home | `/` | Origin status, health check, OPTIONS preflight |
| Signup | `/signup.html` | Send OTP → Verify → Finish signup |
| Login | `/login.html` | Send OTP → Verify → tokens |

Each page includes a **debug panel** showing:

- Current origin (`window.location.origin`)
- API base URL
- Request method, endpoint, headers
- Response status, headers, body
- Time taken
- CORS / network error indicators
- Captured browser console errors

---

## OTP codes (mock provider)

With `NOTIFY_PROVIDER=mock`, OTP codes are logged by the auth container — **not** returned in the API response.

### Watch OTPs live (recommended)

From the repo root:

```bash
docker compose -f deploy/docker/docker-compose.yml logs -f auth | grep verification
```

Or show only the code numbers:

```bash
docker compose -f deploy/docker/docker-compose.yml logs -f auth | grep -oE '[0-9]{6}'
```

### Why you see HTTP 200 but no OTP in logs

The API always returns the same success shape (anti-enumeration). OTP is **only logged** when the request is eligible:

| Reason | Signup | Login |
|--------|--------|-------|
| Handle already registered | No OTP sent | — |
| Unknown handle | — | No OTP sent |
| Same phone/email used &lt; 1 min ago | No OTP (rate limit) | No OTP |
| Frontend on wrong origin (not in `CORS_ORIGINS`) | Request blocked by browser | Same |
| Wrong `VITE_API_KEY` | 401, no OTP | 401 |

**Signup:** click **New test identity** on the signup page to generate a fresh handle, phone, and email.

**Login:** use credentials from a completed signup; wait 1 minute before re-sending to the same phone/email.

**CORS:** run the frontend on `http://localhost:3000`:

```bash
npm run dev:3000
```

---

## Manual test cases

### TC-1: Allowed origin — signup send OTP

| Step | Action |
|------|--------|
| 1 | Start frontend on `http://localhost:3000` |
| 2 | Open `/signup.html` |
| 3 | Fill handle + phone/email, click **Send signup OTP** |

**Expected:**

- HTTP **200**
- Response body: `{ "otp_session_id": "<uuid>", "message": "..." }`
- Response headers include `access-control-allow-origin: http://localhost:3000`
- Debug panel: no network error, CORS badge green
- Browser DevTools Network: POST succeeds; OPTIONS preflight (if sent) returns **204**

---

### TC-2: Unauthorized origin — signup send OTP blocked

| Step | Action |
|------|--------|
| 1 | Start frontend on `http://localhost:5174` |
| 2 | Open `/signup.html` |
| 3 | Click **Send signup OTP** |

**Expected:**

- Browser shows **CORS error** in console (e.g. `Failed to fetch`)
- Debug panel: **Network error** + **Likely CORS block**
- No readable JSON body in JavaScript (browser blocks cross-origin response)
- DevTools Network may show the request reached the server, but JS cannot read the response

---

### TC-3: OPTIONS preflight — allowed origin

| Step | Action |
|------|--------|
| 1 | Frontend on `http://localhost:3000` |
| 2 | Click **Test OPTIONS preflight** |

**Expected:**

- HTTP **204**
- Headers include:
  - `access-control-allow-origin: http://localhost:3000`
  - `access-control-allow-methods: GET, POST, DELETE, OPTIONS`
  - `access-control-allow-headers: Authorization, Content-Type, X-Device-ID, X-Platform, X-API-Key`
  - `vary: Origin`

---

### TC-4: OPTIONS preflight — unauthorized origin

| Step | Action |
|------|--------|
| 1 | Frontend on `http://localhost:5174` |
| 2 | Click **Test OPTIONS preflight** |

**Expected:**

- HTTP **204** (server still answers OPTIONS)
- **No** `access-control-allow-origin` header (or not matching request origin)
- Subsequent POST from JS fails CORS check

---

### TC-5: Allowed origin — full login flow

| Step | Action |
|------|--------|
| 1 | Complete signup on allowed origin (TC-1 + verify + finish) |
| 2 | Open `/login.html` on `http://localhost:3000` |
| 3 | Send OTP → verify with codes from logs |

**Expected:**

- All steps return HTTP **200**
- Verify response includes `access_token`, `refresh_token`, `expires_in`, `token_type`
- CORS headers on every response

---

### TC-6: Unauthorized origin — login blocked

| Step | Action |
|------|--------|
| 1 | Frontend on `http://localhost:4000` |
| 2 | Try login send OTP |

**Expected:**

- Same CORS failure as TC-2
- Cannot complete login from JavaScript

---

### TC-7: curl bypasses CORS (control test)

CORS is a **browser** restriction. Server still processes requests without matching Origin:

```bash
curl -i -X POST http://localhost:8081/v1/auth/signup/otp/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-local-api-key-change-me" \
  -H "X-Platform: web" \
  -H "X-Device-ID: curl-test-001" \
  -H "Origin: http://evil.example.com" \
  -d '{"handle":"curltest","phone":"+919876543211"}'
```

**Expected:**

- HTTP **200** with JSON body (API works)
- **No** `Access-Control-Allow-Origin` header (origin not allowlisted)
- Proves domain restriction protects **browser clients**, not direct API access

---

## Adding an origin to the allowlist

To test a second allowed origin (e.g. port 5174):

1. Edit `deploy/docker/.env`:

   ```env
   CORS_ORIGINS=http://localhost:3000,http://localhost:5174
   ```

2. Restart auth service:

   ```bash
   docker compose --env-file deploy/docker/.env -f deploy/docker/docker-compose.yml up -d auth
   ```

3. Re-run TC-2 — should now succeed on port 5174.

---

## API endpoints used

| Flow | Endpoints |
|------|-----------|
| Signup | `POST /v1/auth/signup/otp/send`, `/resend`, `/verify`, `/finish` |
| Login | `POST /v1/auth/login/otp/send`, `/resend`, `/verify` |
| Health | `GET /health` |

All auth endpoints send:

```http
X-API-Key: <VITE_API_KEY>
X-Platform: web
X-Device-ID: <stable UUID in localStorage>
Content-Type: application/json
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| 401 on all requests | `VITE_API_KEY` matches `CLIENT_API_KEYS` in docker `.env` |
| CORS OK but 429 | Rate limit — wait 1 minute between OTP sends per identifier |
| OTP verify fails | Use codes from `docker compose logs -f auth` |
| Allowed origin still fails | Confirm `CORS_ORIGINS` includes exact origin (scheme + host + port) |

---

## Project structure

```
test/domain-restriction-frontend/
├── index.html          # Home + quick CORS checks
├── signup.html         # Signup OTP flow
├── login.html          # Login OTP flow
├── src/
│   ├── api.js          # Fetch wrapper + debug panel
│   ├── main.js
│   ├── signup.js
│   ├── login.js
│   └── styles.css
├── .env.example
├── vite.config.js
└── README.md
```
