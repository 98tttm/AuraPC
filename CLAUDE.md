# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AuraPC is a Vietnamese-market gaming PC e-commerce platform. Monorepo with Angular frontend and Express backend.

## Common Commands

### Frontend (run from repo root)
```bash
npx ng serve my-client   # Angular dev server on http://localhost:4200
npx ng build my-client   # Production build (output: dist/my-client/browser)
npx ng test my-client    # Run Karma tests
```

### Admin Panel (run from repo root)
```bash
npx ng serve my-admin    # Dev server on http://localhost:4201
npx ng build my-admin --configuration=production
```

### Backend (run from `server/`)
```bash
cd server && npm run dev   # Dev server with --watch on http://localhost:3000
cd server && npm start     # Production server
cd server && npm test      # Run Jest tests
```

### Other
```bash
npm run compress-model           # Compress 3D GLB model (gltf-transform)
cd server && npm run update-brands  # Extract brands from products into categories
```

## Architecture

### Monorepo Layout
- `projects/my-client/` — Main customer-facing Angular app
- `projects/my-admin/` — Admin panel (Angular, Shopify Polaris-inspired dark/light theme)
- `projects/shared/` — Shared Angular library
- `server/` — Express API backend
- `scrapers/` — Data scrapers (gitignored, may contain credentials)

### Frontend (Angular 21)
- **All components are standalone** (no NgModules) with lazy-loaded routes
- **State management**: Angular signals (`signal()`) for auth state, RxJS `BehaviorSubject` for cart
- **Auth interceptor**: Functional interceptor in `app.config.ts` attaches JWT from localStorage (`aurapc_token`) to all API requests
- **Routes use Vietnamese slugs**: `/san-pham` (products), `/tai-khoan` (account), `/aura-builder` (PC configurator), `/ho-tro` (support), `/tra-cuu-don-hang` (order tracking)
- **Key services** in `core/services/`: `AuthService` (phone OTP login), `ApiService` (all backend calls + product helpers), `CartService` (local cart + backend sync), `AddressService`, `ToastService`
- **3D visualization**: Three.js canvas on homepage, Google Model Viewer for product pages

### Backend (Express 5.2 + MongoDB)
- **Entry point**: `server/index.js` — loads routes, CORS whitelist, centralized error handler
- **Auth**: Phone-based OTP → JWT (7-day expiry). Middleware in `server/middleware/auth.js` provides `requireAuth` and `optionalAuth`
- **JWT_SECRET is REQUIRED** — server crashes on startup if not set (no fallback)
- **OTP devOtp only in development** — `NODE_ENV=development` to see OTP in response
- **10 Mongoose models**: User, Product, Order, ProductReview, Blog, Category, Builder, Cart, Otp, Admin
- **Route groups** at `/api/*`: auth, products, orders, cart, payment, reviews, builder, blogs, categories, hub, chat, plus `admin/` routes
- **Payments**: MoMo (sandbox), ZaloPay, ATM transfer, COD with OTP verification. MoMo payment verifies prices server-side.
- **Utils**: email (Nodemailer/Gmail SMTP), invoicePdf (PDFKit), product filters/normalizers, momo helpers, Pino logger
- **CORS**: Explicit origin whitelist (Vercel URLs + localhost). Add new origins to the array in `server/index.js`

### AuraBuilder
Interactive PC configurator with component selection. Configs are saved with a `shareId` (7-day TTL) and can be exported as PDF or emailed.

### AruBot (Chatbot)
- **Frontend**: Floating widget component at `projects/my-client/src/app/components/chatbot-widget/`
- **Backend**: `server/routes/chatRoutes.js` — POST `/api/chat`
- **AI Model**: Qwen 3 235B via Replicate API (`REPLICATE_API_TOKEN` required)
- **Product catalog injection**: The system prompt includes a cached dump of all categories + products (name, slug, price) from MongoDB, refreshed every 10 minutes. This ensures the AI only suggests real products from the store.
- **Product matching flow**: AI returns exact slugs → backend looks up by slug → fallback by name → fallback by keywords → fallback featured products
- **Click behavior**: Products with slug navigate to `/san-pham/:slug`; products without slug search on `/san-pham?search=<name>`
- **Chat logging**: Optional Supabase integration for conversation history

## Code Conventions

- **2-space indentation**, single quotes in TypeScript (`.editorconfig`)
- **Strict TypeScript**: `strict`, `noImplicitOverride`, `noImplicitReturns`, `strictTemplates`
- Component prefix: `app-`
- Some code comments are in Vietnamese
- No ESLint or Prettier configured — follow existing patterns

## Environment Setup

- **MoMo sandbox trên máy local** (ví thật test) vs **mock trên Render**: `server/docs/MOMO_LOCAL.md`

Copy `server/.env.example` to `server/.env` and fill in:
- `MONGODB_URI` — MongoDB connection string (**REQUIRED**)
- `JWT_SECRET` — Secret for JWT signing (**REQUIRED**, server won't start without it)
- `NODE_ENV` — Set to `production` in prod (controls OTP visibility, error verbosity)
- `EMAIL_USER` / `EMAIL_PASS` — Gmail app password for transactional emails
- `FRONTEND_URL` — Frontend origin for CORS (default: `http://localhost:4200`)
- MoMo/ZaloPay payment credentials (sandbox values in .env.example)

## Deployment

- **Frontend**: Vercel — auto-deploys from `main`, builds `my-client`, SPA rewrites via `vercel.json`
- **Backend**: Render (Singapore, free tier) — auto-deploys from `main`, port 10000, config in `render.yaml`
- **Production API**: `https://aurapc-backend.onrender.com/api`
- **Render env / MoMo–ZaloPay–domain alignment**: `server/docs/DEPLOY_RENDER.md` (canonical `FRONTEND_URL` + return URLs; AuraVisual; post-deploy tests)
- **If secrets were exposed**: `server/docs/SECURITY_ROTATION.md`

## Security

### Critical rules — NEVER do these:
- **NEVER hardcode credentials** (DB URIs, API keys, passwords) in source files
- **NEVER use fallback secrets** for JWT or crypto — always require env vars
- **NEVER return OTP codes in API responses** outside development mode
- **NEVER pass raw `req.body`** to Mongoose constructors without field whitelisting
- **NEVER use `bypassSecurityTrustHtml`** — use Angular's built-in sanitizer

### Security fixes applied (March 2026):
1. Removed hardcoded MongoDB URI from `scrapers/unified_scraper.py` → uses `os.environ` now
2. `scrapers/` added to `.gitignore`
3. JWT secret fallback removed — server crashes if `JWT_SECRET` not set
4. MoMo payment route now verifies prices server-side from Product DB
5. OTP `devOtp` only exposed when `NODE_ENV=development`
6. OTP `console.log` suppressed in production

### Remaining security work (not yet fixed):
- Add `helmet` middleware for security headers
- Add `express-rate-limit` to auth endpoints (OTP, login)
- Add MIME type validation to file uploads (avatar, hub images)
- Add `Content-Disposition: attachment` to `/uploads` static serving
- Fix `bypassSecurityTrustHtml` in `product-detail.component.ts`
- Add auth to order detail endpoint (`GET /api/orders/:orderNumber`)
- Add `express-mongo-sanitize` middleware
- Fix address IDOR (`GET /api/auth/addresses/:userId` should use `req.userId`)
- Whitelist fields in admin CRUD routes
- Add auth to builder write endpoints
- Replace `err.message` with generic errors in catch blocks
- Clean up ~30 `console.log` statements in production code
