# Rotating secrets after exposure

If credentials appeared in chat, screenshots, or public repos, assume compromise and rotate.

## Checklist (do in order that minimizes downtime)

1. **MongoDB** — Change database user password in Atlas/hosting; update `MONGODB_URI` on Render; redeploy if needed.
2. **JWT** — Set a new strong `JWT_SECRET` on Render; **all** users must sign in again (old tokens invalid).
3. **Supabase** — Rotate **service role** key in Supabase dashboard; update `SUPABASE_SERVICE_ROLE_KEY` on Render (and any other envs).
4. **Gmail** — Revoke the App Password; create a new one; update `EMAIL_PASS` on Render.
5. **MoMo** — Regenerate or rotate secret in MoMo merchant portal; update `MOMO_SECRET_KEY` (and related keys if merchant rotates them).
6. **ZaloPay** — Rotate keys in ZaloPay merchant console if those were exposed.
7. **Replicate / other APIs** — Regenerate tokens in provider dashboards.

Never commit real secrets to git. Use Render/Vercel env UI or secret stores only.
