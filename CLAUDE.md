# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AuraPC is a Vietnamese-market gaming PC e-commerce platform. Monorepo with Angular frontend and Express backend.

## Common Commands

### Frontend (run from repo root)
```bash
npm start                # Angular dev server on http://localhost:4200
npm run build            # Production build (output: dist/my-client/browser)
npm test                 # Run Karma tests
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
- `projects/my-admin/` — Admin panel (Angular)
- `projects/shared/` — Shared Angular library
- `server/` — Express API backend

### Frontend (Angular 21)
- **All components are standalone** (no NgModules) with lazy-loaded routes
- **State management**: Angular signals (`signal()`) for auth state, RxJS `BehaviorSubject` for cart
- **Auth interceptor**: Functional interceptor in `app.config.ts` attaches JWT from localStorage (`aurapc_token`) to all API requests
- **Routes use Vietnamese slugs**: `/san-pham` (products), `/tai-khoan` (account), `/aura-builder` (PC configurator)
- **Key services** in `core/services/`: `AuthService` (phone OTP login), `ApiService` (all backend calls + product helpers), `CartService` (local cart + backend sync), `AddressService`, `ToastService`
- **3D visualization**: Three.js canvas on homepage, Google Model Viewer for product pages

### Backend (Express 5.2 + MongoDB)
- **Entry point**: `server/index.js` — loads routes, CORS whitelist, centralized error handler
- **Auth**: Phone-based OTP → JWT (7-day expiry). Middleware in `server/middleware/auth.js` provides `requireAuth` and `optionalAuth`
- **9 Mongoose models**: User, Product, Order, ProductReview, Blog, Category, Builder, Cart, Otp
- **Route groups** at `/api/*`: auth, products, orders, cart, payment, reviews, builder, blogs, categories, plus `admin/` routes
- **Payments**: MoMo (sandbox), ZaloPay, ATM transfer, COD with OTP verification
- **Utils**: email (Nodemailer/Gmail SMTP), invoicePdf (PDFKit), product filters/normalizers, momo helpers, Pino logger
- **CORS**: Explicit origin whitelist (Vercel URLs + localhost). Add new origins to the array in `server/index.js`

### AuraBuilder
Interactive PC configurator with component selection. Configs are saved with a `shareId` (7-day TTL) and can be exported as PDF or emailed.

## Code Conventions

- **2-space indentation**, single quotes in TypeScript (`.editorconfig`)
- **Strict TypeScript**: `strict`, `noImplicitOverride`, `noImplicitReturns`, `strictTemplates`
- Component prefix: `app-`
- Some code comments are in Vietnamese
- No ESLint or Prettier configured — follow existing patterns

## Environment Setup

Copy `server/.env.example` to `server/.env` and fill in:
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — Secret for JWT signing
- `EMAIL_USER` / `EMAIL_PASS` — Gmail app password for transactional emails
- `FRONTEND_URL` — Frontend origin for CORS (default: `http://localhost:4200`)
- MoMo/ZaloPay payment credentials (sandbox values in .env.example)

## Deployment

- **Frontend**: Vercel — auto-deploys from `main`, builds `my-client`, SPA rewrites via `vercel.json`
- **Backend**: Render (Singapore, free tier) — auto-deploys from `main`, port 10000, config in `render.yaml`
- **Production API**: `https://aurapc-backend.onrender.com/api`
