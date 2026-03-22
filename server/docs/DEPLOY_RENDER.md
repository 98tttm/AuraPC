# Deploy backend (Render) — MoMo / ZaloPay / Gmail / client domain

Use this checklist so payment redirects, CORS, and optional features match your **canonical** storefront URL.

## 1. Unify `FRONTEND_URL` and payment return URLs (Render dashboard)

Pick **one** public origin users should land on after checkout (recommended: `https://www.aurapc.io.vn` if that is your main domain).

Set on Render (Environment):

| Variable | Example (canonical) |
|----------|---------------------|
| `FRONTEND_URL` | `https://www.aurapc.io.vn` |
| `MOMO_REDIRECT_URL` | `https://www.aurapc.io.vn/checkout-momo-return` |
| `ZALOPAY_REDIRECT_URL` | `https://www.aurapc.io.vn/checkout-zalopay-return` |

**Do not** point these at a Vercel project you do not deploy (e.g. wrong `*.vercel.app` name) — the browser will show Vercel [NOT_FOUND](https://vercel.com/docs/errors/NOT_FOUND.md) or the wrong app.

`MOMO_IPN_URL` / `ZALOPAY_CALLBACK_URL` must stay on your **backend** HTTPS URL, e.g. `https://aurapc-backend.onrender.com/api/payment/momo/ipn`.

After changes: **Manual Deploy** or wait for auto-deploy, then retest checkout.

## 2. CORS and testing the mock payment flow

`server/index.js` allows `https://www.aurapc.io.vn`, `https://aurapc.io.vn`, `https://aura-pc-client.vercel.app`, and adds `FRONTEND_URL` / `ADMIN_URL` origins dynamically. `*.vercel.app` is also allowed.

**After redeploy**, verify:

1. Open storefront on `https://www.aurapc.io.vn` (and optionally `https://aura-pc-client.vercel.app`).
2. With `MOMO_MOCK_MODE=true`, complete checkout with MoMo mock.
3. Confirm redirect lands on **your** site’s `/checkout-momo-return` (no NOT_FOUND, no wrong subdomain).

**Optional:** In Vercel, redirect the default `aura-pc-client.vercel.app` to your custom domain so users share one origin (fewer cookie/CORS surprises).

## 3. Real MoMo sandbox (when turning off mock)

1. Set `MOMO_MOCK_MODE=false` (or `0`).
2. Use **one** merchant’s sandbox credentials (`MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`) from MoMo M4B / test tool — avoid mixed legacy sample keys (see `server/utils/momo.js`).
3. In MoMo merchant config, **whitelist** the exact return URL (`MOMO_REDIRECT_URL`).
4. Keep `MOMO_IPN_URL` on Render; note free-tier cold starts can delay IPN — client confirm route remains the backup.

## 4. AuraVisual on production

- `AURA_VISUAL_WEBHOOK_URL` must be a **public** HTTPS URL (e.g. deployed n8n), not `http://localhost:...`.
- If unset in production, `/api/chat/auravisual` returns 503 with a clear message.
- If set to localhost in production, the server returns **503** (feature effectively off).

## 5. Gmail on Render

Requires `EMAIL_USER` + `EMAIL_PASS` (Gmail App Password). See `server/README-EMAIL.md`. Render uses IPv4-first for SMTP (`server/index.js`).

## 6. Secrets exposed in chat or tickets

If any production secret was pasted publicly, **rotate** it — see `server/docs/SECURITY_ROTATION.md`.
