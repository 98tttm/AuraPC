# AuraPC — Project Knowledge for Claude Chat
# Copy toàn bộ nội dung này vào "Project Knowledge" trên claude.ai

---

# CLAUDE.md (Project Instructions)

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

## Architecture

### Monorepo Layout
- `projects/my-client/` — Main customer-facing Angular app
- `projects/my-admin/` — Admin panel (Angular, Shopify Polaris-inspired dark/light theme)
- `projects/shared/` — Shared Angular library
- `server/` — Express API backend

### Frontend (Angular 21)
- All components are standalone (no NgModules) with lazy-loaded routes
- State management: Angular signals for auth, RxJS BehaviorSubject for cart
- Auth interceptor: Functional interceptor attaches JWT from localStorage (`aurapc_token`)
- Routes use Vietnamese slugs: `/san-pham`, `/tai-khoan`, `/aura-builder`, `/ho-tro`, `/tra-cuu-don-hang`
- Key services in `core/services/`: AuthService, ApiService, CartService, AddressService, ToastService
- 3D visualization: Three.js canvas on homepage, Google Model Viewer for product pages

### Backend (Express 5.2 + MongoDB)
- Entry point: `server/index.js`
- Auth: Phone-based OTP → JWT (7-day expiry)
- JWT_SECRET is REQUIRED — server crashes if not set
- 20 Mongoose models: User, Admin, Product, Category, Order, Cart, ProductReview, Blog, Builder, Post, HubComment, Share, Promotion, PromotionUsage, Otp, UserNotification, AdminNotification, Faq, SupportConversation, SupportMessage
- Route groups at `/api/*`: auth, products, orders, cart, payment, reviews, builder, blogs, categories, hub, chat, support, faqs, promotions, notifications, plus `admin/` routes
- Payments: MoMo, ZaloPay, ATM transfer, COD with OTP
- Utils: email (Nodemailer/Gmail SMTP), invoicePdf (PDFKit), momo/zalopay helpers, Pino logger
- Real-time: Socket.IO for order updates, support chat, notifications
- AI Chatbot: Qwen 3 235B via Replicate API with cached product catalog

### AuraBuilder
Interactive PC configurator with 13 component types. Configs saved with shareId (7-day TTL), exportable as PDF or email.

### AuraHub (Community)
Social features: posts (text/images/polls), nested comments, likes, reposts, shares, follow/unfollow, trending, moderation workflow.

### AruBot (AI Chatbot)
- Backend: POST `/api/chat` → Qwen 3 235B via Replicate
- Product catalog injection: cached dump of all products from MongoDB (10min refresh)
- 4-step product matching: slug exact → name exact → regex → fuzzy keywords → featured fallback

## Code Conventions
- 2-space indentation, single quotes in TypeScript
- Strict TypeScript: strict, noImplicitOverride, noImplicitReturns, strictTemplates
- Component prefix: `app-`

## Deployment
- Frontend: Vercel — auto-deploys from main
- Backend: Render (Singapore, free tier) — auto-deploys from main, port 10000
- Production API: `https://aurapc-backend.onrender.com/api`

---

# Project Memory

## Stack
- Frontend: Angular 21, TypeScript 5.9, RxJS, Three.js, Google Model Viewer
- Backend: Node.js, Express 5.2, MongoDB/Mongoose 9.1, JWT
- Payments: MoMo (sandbox), ZaloPay, ATM Transfer, COD+OTP
- Email/PDF: Nodemailer (Gmail SMTP), PDFKit
- Testing: Jest (backend), Karma (frontend)

## Key Paths
- Client app: `projects/my-client/src/app/`
- Admin app: `projects/my-admin/src/app/` (port 4201)
- Server: `server/`
- Services: `projects/my-client/src/app/core/services/`
- Routes: `server/routes/`, `server/routes/admin/`
- Models: `server/models/`

## Admin Panel
- Separate Admin model (email/password bcrypt, NOT User model)
- 5 admins seeded (password: "0"): thinhtt, phatht, thongnt, nhilhq, antt @st.uel.edu.vn
- JWT with `{ adminId, isAdmin: true }` claim
- Shopify Polaris-inspired dark/light theme (ThemeService signal)

## API Endpoints Summary (80+)
- Auth: request-otp, verify-otp, profile, avatar, follow, addresses
- Products: list (filters), filter-options, featured, by-slug, by-id
- Cart: get, sync, add, update, remove, remove-multiple
- Orders: list, track, create, cancel-request, confirm-received, return-request
- Payment: momo/create, momo/ipn, momo/confirm, zalopay/create, zalopay/callback, zalopay/confirm
- Reviews: list, can-review, create, reply
- Builders: get, create, update-component, auravisual, email-pdf
- Hub: posts CRUD, like, repost, share, comments, vote, topics, trending, upload
- Chat: AI chat, debug-catalog, auravisual webhook
- Support: conversations, messages (real-time via Socket.IO)
- Promotions: list active
- Admin: auth, dashboard, products, categories, blogs, orders, users, notifications, support, hub, promotions

## Security (March 2026)
### Fixed:
- Removed hardcoded MongoDB URI → env var
- JWT secret fallback removed — crashes if not set
- MoMo payment verifies prices server-side
- OTP devOtp only in development

### Still needs fixing:
- helmet, express-rate-limit, express-mongo-sanitize
- MIME validation for uploads
- bypassSecurityTrustHtml in product-detail
- Auth gaps (order detail, builder writes, address IDOR)
- Field whitelisting in admin CRUD
- ~30 console.log in production
