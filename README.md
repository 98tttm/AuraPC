<p align="center">
  <img src="projects/my-client/src/assets/LOGO/logofavicon.png" alt="AuraPC Logo" width="80" />
</p>

<h1 align="center">AuraPC — Gaming PC E-commerce Platform</h1>

<p align="center">
  <strong>Cung cấp trải nghiệm mua sắm PC Gaming cao cấp cho thị trường Việt Nam</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Angular-21.1-DD0031?logo=angular" alt="Angular 21" />
  <img src="https://img.shields.io/badge/Express-5.2-000000?logo=express" alt="Express 5.2" />
  <img src="https://img.shields.io/badge/MongoDB-8.0-47A248?logo=mongodb" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Node.js-22+-339933?logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Deploy-Vercel%20%2B%20Render-black" alt="Deploy" />
</p>

---

## Overview

AuraPC is a full-stack gaming PC e-commerce platform built for the Vietnamese market. It features an immersive 3D homepage, an interactive PC configurator (AuraBuilder), AI-powered chatbot (AruBot), community hub, multi-payment gateway integration, and a full-featured admin panel.

### Key Highlights

- **3D Immersive Experience** — Three.js-powered homepage with animated gaming PC model
- **AuraBuilder** — Interactive drag-and-drop PC configurator with PDF export & shareable links
- **AruBot** — AI chatbot (Qwen 3 235B via Replicate) with live product catalog injection
- **Multi-Payment** — MoMo, ZaloPay, ATM Transfer, COD with OTP verification
- **Social Login** — Google & Facebook OAuth (popup-based, SPA-friendly)
- **Community Hub** — User-generated posts with image uploads via Supabase Storage
- **Admin Panel** — Shopify Polaris-inspired dark/light theme with real-time dashboard

---

## Monorepo Structure

```
AuraPC/
├── projects/
│   ├── my-client/          # Customer-facing Angular app (port 4200)
│   ├── my-admin/           # Admin panel Angular app (port 4201)
│   └── shared/             # Shared Angular library
├── server/                 # Express.js API backend (port 3000)
├── vercel.json             # Vercel deployment config (frontend)
├── render.yaml             # Render deployment config (backend)
└── package.json            # Root Angular workspace
```

| Project | Stack | Description |
|---------|-------|-------------|
| **my-client** | Angular 21, Three.js, GSAP, RxJS | Customer storefront with 3D visuals, shopping, checkout |
| **my-admin** | Angular 21, Chart.js | Admin dashboard, product/order/user management |
| **server** | Express 5.2, Mongoose 9.1, JWT | REST API, auth, payments, email, PDF generation |

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Angular | 21.1.3 | SPA framework (standalone components, signals) |
| TypeScript | 5.9.3 | Type safety |
| Three.js | 0.172.0 | 3D homepage visualization |
| GSAP | 3.14.2 | Scroll & transition animations |
| Chart.js | 4.5.1 | Admin dashboard charts |
| Google Model Viewer | 4.1.0 | 3D product viewer |
| RxJS | 7.8.x | Reactive state (cart, real-time) |
| Socket.IO Client | 4.8.3 | Real-time notifications |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Express | 5.2.1 | HTTP framework |
| Mongoose | 9.1.6 | MongoDB ODM (21 models) |
| JWT | 9.0.3 | Authentication tokens |
| Nodemailer | 8.0.1 | Transactional emails (Gmail SMTP) |
| PDFKit | 0.17.2 | Invoice PDF generation |
| Multer | 2.0.2 | File uploads |
| Pino | 10.3.1 | Structured logging |
| Supabase JS | 2.98.0 | Image storage & chat logging |
| Socket.IO | 4.8.3 | Real-time server |
| Google Auth Library | 10.6.2 | Google OAuth verification |

### Infrastructure
| Service | Purpose |
|---------|---------|
| **Vercel** | Frontend hosting (auto-deploy from `main`) |
| **Render** | Backend hosting (Singapore, free tier) |
| **MongoDB Atlas** | Cloud database |
| **Supabase** | Image storage (hub, avatars), chat logging |
| **Replicate** | AI model hosting (Qwen 3 235B for chatbot) |

---

## Quick Start

### Prerequisites
- Node.js >= 22
- npm >= 10
- MongoDB Atlas account (or local MongoDB)

### 1. Clone & Install

```bash
git clone https://github.com/user/AuraPC.git
cd AuraPC

# Frontend dependencies
npm install

# Backend dependencies
cd server && npm install && cd ..
```

### 2. Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your credentials:

```env
# Required
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
NODE_ENV=development

# Email (Gmail App Password)
EMAIL_USER=your@gmail.com
EMAIL_PASS=xxxx-xxxx-xxxx-xxxx

# Payments (MoMo Sandbox)
MOMO_PARTNER_CODE=MOMO
MOMO_ACCESS_KEY=F8BBA842ECF85
MOMO_SECRET_KEY=K951B6PE1waDMi640xX08PD3vg6EkVlz

# Social Login
GOOGLE_CLIENT_ID=your-google-client-id
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# AI Chatbot
REPLICATE_API_TOKEN=your-replicate-token

# Image Storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### 3. Run Development Servers

```bash
# Terminal 1 — Backend API
cd server && npm run dev

# Terminal 2 — Customer frontend
npx ng serve my-client

# Terminal 3 — Admin panel (optional)
npx ng serve my-admin
```

| Service | URL |
|---------|-----|
| Customer App | http://localhost:4200 |
| Admin Panel | http://localhost:4201 |
| API Server | http://localhost:3000 |

---

## API Overview

The backend exposes **80+ REST endpoints** organized into 28 route files.

### Public Routes (`/api/...`)

| Route Group | Base Path | Endpoints |
|------------|-----------|-----------|
| Auth | `/api/auth` | OTP request/verify, Google/Facebook login, profile, avatar, addresses |
| Products | `/api/products` | List, filter, search, detail by slug, featured, categories |
| Orders | `/api/orders` | Create, track, status update, invoice PDF download |
| Payments | `/api/payment` | MoMo/ZaloPay create, callback/IPN, verify, ATM confirm |
| Cart | `/api/cart` | Get, add, update, remove, sync |
| Reviews | `/api/reviews` | CRUD for product reviews |
| Builder | `/api/builder` | Save/load/share PC configurations |
| Blog | `/api/blogs` | List, detail, by slug |
| Categories | `/api/categories` | Category tree |
| Hub | `/api/hub` | Community posts & comments |
| Chat | `/api/chat` | AI chatbot (Qwen 3 235B) |
| Promotions | `/api/promotions` | Validate discount codes |
| Support | `/api/support` | Customer support conversations |
| Warranty | `/api/warranty` | Warranty lookup |
| FAQ | `/api/faq` | Frequently asked questions |
| Notifications | `/api/notifications` | User notifications |

### Admin Routes (`/api/admin/...`)

All admin routes require `requireAdmin` middleware (JWT with `isAdmin: true`).

| Route Group | Base Path |
|------------|-----------|
| Dashboard | `/api/admin/dashboard` |
| Products | `/api/admin/products` |
| Orders | `/api/admin/orders` |
| Users | `/api/admin/users` |
| Blogs | `/api/admin/blogs` |
| Categories | `/api/admin/categories` |
| Hub | `/api/admin/hub` |
| Support | `/api/admin/support` |
| Warranty | `/api/admin/warranty` |
| Notifications | `/api/admin/notifications` |
| Promotions | `/api/admin/promotions` |

---

## Database Models

21 Mongoose models powering the platform:

| Model | Description |
|-------|-------------|
| `User` | Customer accounts (phone OTP, Google, Facebook auth) |
| `Admin` | Admin accounts (email/bcrypt, seeded) |
| `Product` | Products with specs, images, sale prices, stock |
| `Order` | Orders with items, shipping, payment, status tracking |
| `Cart` | Shopping carts (synced with backend) |
| `Builder` | PC configurator saved configurations |
| `Share` | Builder share links (7-day TTL auto-delete) |
| `ProductReview` | Ratings & text reviews per product |
| `Blog` | Blog articles with SEO slugs |
| `Category` | Hierarchical product categories |
| `Otp` | One-time passwords with brute-force protection |
| `PendingPayment` | MoMo/ZaloPay pending payment records |
| `Promotion` | Discount codes with usage limits |
| `PromotionUsage` | Per-user promotion usage tracking |
| `Post` | Community hub posts |
| `HubComment` | Comments on hub posts |
| `SupportConversation` | Support ticket threads |
| `SupportMessage` | Messages within support tickets |
| `UserNotification` | Notifications for customers |
| `AdminNotification` | Notifications for admins |
| `Faq` | FAQ entries |

---

## Deployment

### Frontend → Vercel

Auto-deploys from `main` branch. Configuration in `vercel.json`:

```json
{
  "buildCommand": "node scripts/vercel-build.cjs",
  "outputDirectory": "dist/vercel-output",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Backend → Render

Auto-deploys from `main` branch. Configuration in `render.yaml`:

```yaml
services:
  - type: web
    name: aurapc-backend
    env: node
    plan: free
    region: singapore
    buildCommand: cd server && npm install
    startCommand: cd server && npm start
    branch: main
    port: 10000
```

**Production URLs:**
- Frontend: `https://www.aurapc.io.vn`
- API: `https://aurapc-backend.onrender.com/api`

---

## Authentication

AuraPC supports 3 authentication methods:

| Method | Flow |
|--------|------|
| **Phone OTP** | Enter phone → receive OTP → verify → JWT issued |
| **Google** | Click → Google popup → ID token → backend verifies → JWT issued |
| **Facebook** | Click → FB popup → access token → backend verifies → JWT issued |

- JWT stored in `localStorage` (`aurapc_token`)
- 7-day token expiry
- Auth interceptor auto-attaches token to all API requests
- Social login pulls avatar & display name from Google/Facebook profiles

---

## Payment Methods

| Method | Provider | Status |
|--------|----------|--------|
| MoMo | MoMo Sandbox | QR code / MoMo wallet |
| ZaloPay | ZaloPay Sandbox | QR code / ZaloPay wallet |
| ATM Transfer | Manual | Bank transfer with confirmation |
| COD | Cash on Delivery | OTP verification required |

All payment amounts are validated server-side against product database prices.

---

## Scripts

```bash
# Frontend
npx ng serve my-client          # Dev server (port 4200)
npx ng serve my-admin           # Admin dev server (port 4201)
npx ng build my-client          # Production build
npx ng build my-admin --configuration=production
npx ng test my-client           # Run tests

# Backend
cd server && npm run dev        # Dev server with --watch
cd server && npm start          # Production server
cd server && npm test           # Jest tests

# Utilities
npm run compress-model          # Optimize 3D GLB model
cd server && npm run update-brands  # Extract brands from products
```

---

## Project READMEs

Each sub-project has its own detailed README:

- [`projects/my-client/README.md`](projects/my-client/README.md) — Customer storefront
- [`projects/my-admin/README.md`](projects/my-admin/README.md) — Admin panel
- [`server/README.md`](server/README.md) — Backend API

---

## License

Private project — All rights reserved.

---

<p align="center">
  Built with passion by the <strong>AuraPC Team</strong> — UEL 2026
</p>
