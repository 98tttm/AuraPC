# AuraPC — Backend API

> Express 5.2 REST API powering the AuraPC gaming PC e-commerce platform.

---

## Quick Start

```bash
cd server
cp .env.example .env        # Configure environment variables
npm install                  # Install dependencies
npm run dev                  # Dev server with --watch → http://localhost:3000
```

### Scripts

```bash
npm start              # Production server (node index.js)
npm run dev            # Development server with file watching (node --watch index.js)
npm test               # Run Jest test suite
npm run update-brands  # Extract brands from products into categories
```

---

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Express | 5.2.1 | HTTP framework |
| Mongoose | 9.1.6 | MongoDB ODM |
| JSON Web Token | 9.0.3 | Authentication |
| bcryptjs | 3.0.3 | Password hashing (admin accounts) |
| Nodemailer | 8.0.1 | Transactional emails (Gmail SMTP) |
| PDFKit | 0.17.2 | Invoice PDF generation |
| Multer | 2.0.2 | File upload handling |
| Axios | 1.13.6 | HTTP client (Facebook API, ZaloPay) |
| Pino | 10.3.1 | Structured JSON logging |
| Socket.IO | 4.8.3 | Real-time WebSocket events |
| Supabase JS | 2.98.0 | Image storage, chat logging |
| Google Auth Library | 10.6.2 | Google OAuth token verification |
| CORS | 2.8.6 | Cross-origin request handling |
| express-rate-limit | 8.2.1 | API rate limiting |
| dotenv | 17.2.4 | Environment variable loading |

---

## Architecture

```
server/
├── index.js               # Entry point: Express app, CORS, routes, error handler
├── package.json
├── .env.example            # Environment variable template
│
├── models/                 # Mongoose schemas (21 models)
│   ├── User.js             # Customer accounts (phone, Google, Facebook)
│   ├── Admin.js            # Admin accounts (email/bcrypt)
│   ├── Product.js          # Products with specs, prices, stock
│   ├── Order.js            # Orders with items, shipping, payment
│   ├── Cart.js             # Shopping carts
│   ├── Builder.js          # PC configurator saves
│   ├── Share.js            # Builder share links (7-day TTL)
│   ├── ProductReview.js    # Product ratings & reviews
│   ├── Blog.js             # Blog articles
│   ├── Category.js         # Product categories (hierarchical)
│   ├── Otp.js              # OTP codes with brute-force protection
│   ├── PendingPayment.js   # Pending payment records (MoMo, ZaloPay)
│   ├── Promotion.js        # Discount codes
│   ├── PromotionUsage.js   # Per-user promotion tracking
│   ├── Post.js             # Community hub posts
│   ├── HubComment.js       # Comments on hub posts
│   ├── SupportConversation.js  # Support ticket threads
│   ├── SupportMessage.js   # Support ticket messages
│   ├── UserNotification.js # Customer notifications
│   ├── AdminNotification.js # Admin notifications
│   └── Faq.js              # FAQ entries
│
├── routes/                 # API route handlers
│   ├── authRoutes.js       # OTP, Google/Facebook login, profile, avatar, addresses
│   ├── productRoutes.js    # Product CRUD, filtering, search
│   ├── orderRoutes.js      # Order creation, tracking, status, invoice PDF
│   ├── paymentRoutes.js    # MoMo/ZaloPay create, IPN callbacks, verification
│   ├── cartRoutes.js       # Cart CRUD
│   ├── reviewRoutes.js     # Product reviews
│   ├── blogRoutes.js       # Blog articles
│   ├── categoryRoutes.js   # Category tree
│   ├── builderRoutes.js    # PC builder configs & sharing
│   ├── chatRoutes.js       # AI chatbot (Qwen 3 235B via Replicate)
│   ├── hubRoutes.js        # Community hub posts & comments
│   ├── promotionRoutes.js  # Promotion code validation
│   ├── supportRoutes.js    # Customer support
│   ├── warrantyRoutes.js   # Warranty lookup
│   ├── faqRoutes.js        # FAQ management
│   ├── notificationRoutes.js # Notification management
│   └── admin/              # Admin-only routes (requireAdmin middleware)
│       ├── authRoutes.js        # Admin login
│       ├── dashboardRoutes.js   # Analytics & KPIs
│       ├── productRoutes.js     # Product CRUD + brand extraction
│       ├── orderRoutes.js       # Order management + status updates
│       ├── userRoutes.js        # Customer management
│       ├── blogRoutes.js        # Blog CRUD
│       ├── categoryRoutes.js    # Category CRUD
│       ├── hubRoutes.js         # Hub moderation
│       ├── supportRoutes.js     # Support management
│       ├── warrantyRoutes.js    # Warranty management
│       ├── notificationRoutes.js # Admin notifications
│       └── promotionRoutes.js   # Promotion CRUD
│
├── middleware/
│   └── auth.js             # requireAuth, optionalAuth, requireAdmin
│
├── utils/
│   ├── email.js            # Nodemailer Gmail SMTP transport
│   ├── invoicePdf.js       # PDFKit invoice generation
│   ├── momoHelpers.js      # MoMo signature & API helpers
│   ├── productFilters.js   # Product query builder
│   ├── productNormalizer.js # Product data normalization
│   └── logger.js           # Pino structured logger
│
├── scripts/
│   ├── update-brands.js    # Extract brands from products
│   ├── backfill-user-email.js # Backfill user emails
│   └── seed-admin.js       # Seed admin accounts
│
├── docs/
│   ├── MOMO_LOCAL.md       # MoMo sandbox setup guide
│   ├── DEPLOY_RENDER.md    # Render deployment guide
│   └── SECURITY_ROTATION.md # Credential rotation guide
│
└── uploads/                # User-uploaded files (avatars, etc.)
```

---

## Authentication

### Customer Auth (Phone OTP)
```
POST /api/auth/request-otp   → { phoneNumber }
POST /api/auth/verify-otp    → { phoneNumber, otp } → { token, user }
```

- OTP expires in 5 minutes
- 3 failed attempts → 1-hour lockout (brute-force protection)
- `devOtp` returned in response only when `NODE_ENV=development`

### Social Auth (Google & Facebook)
```
POST /api/auth/google    → { idToken }      → { token, user }
POST /api/auth/facebook  → { accessToken }  → { token, user }
```

- Google: Verified via `google-auth-library` (`verifyIdToken`)
- Facebook: Verified via Facebook Graph API (`/me?fields=id,name,email,picture`)
- Account linking: if social email matches existing user, accounts merge
- Avatar and name pulled from social profiles on first login

### Admin Auth
```
POST /api/admin/auth/login → { email, password } → { token, admin }
```

- Separate `Admin` model with bcrypt password hashing
- JWT includes `{ adminId, isAdmin: true }`
- All `/api/admin/*` routes protected by `requireAdmin` middleware

### JWT Configuration
- Secret: `JWT_SECRET` env var (**required** — server crashes without it)
- Expiry: 7 days
- Attached via `Authorization: Bearer <token>` header

---

## API Routes

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/request-otp` | Request OTP for phone login |
| POST | `/api/auth/verify-otp` | Verify OTP, receive JWT |
| POST | `/api/auth/google` | Google OAuth login |
| POST | `/api/auth/facebook` | Facebook OAuth login |
| PUT | `/api/auth/profile` | Update user profile |
| POST | `/api/auth/avatar` | Upload avatar (Supabase) |
| GET | `/api/products` | List products (with filters, pagination) |
| GET | `/api/products/featured` | Featured products |
| GET | `/api/products/:slug` | Product detail by slug |
| POST | `/api/orders` | Create order (COD/ATM) |
| GET | `/api/orders/track/:orderNumber` | Track order by number |
| GET | `/api/orders/:orderNumber/invoice` | Download invoice PDF |
| POST | `/api/payment/momo/create` | Create MoMo payment |
| POST | `/api/payment/momo/ipn` | MoMo IPN callback |
| POST | `/api/payment/zalopay/create` | Create ZaloPay payment |
| POST | `/api/payment/zalopay/callback` | ZaloPay callback |
| GET | `/api/cart` | Get user cart |
| POST | `/api/cart/sync` | Sync local cart to server |
| POST | `/api/reviews` | Submit product review |
| GET | `/api/reviews/:productId` | Get product reviews |
| POST | `/api/builder` | Save builder config |
| GET | `/api/builder/share/:shareId` | Load shared config |
| POST | `/api/chat` | AI chatbot message |
| POST | `/api/promotions/validate` | Validate promotion code |
| GET | `/api/categories` | Category tree |
| GET | `/api/blogs` | List blog posts |
| GET | `/api/blogs/:slug` | Blog detail by slug |
| GET/POST | `/api/hub/posts` | Community hub posts |
| GET/POST | `/api/support` | Support conversations |
| GET | `/api/warranty/:query` | Warranty lookup |
| GET | `/api/faq` | FAQ list |

### Admin Endpoints (`/api/admin/*`)

All require `requireAdmin` middleware.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/auth/login` | Admin login |
| GET | `/api/admin/dashboard/stats` | Dashboard KPIs |
| GET/POST/PUT/DELETE | `/api/admin/products` | Product CRUD |
| GET | `/api/admin/products/brands` | Brand list |
| GET/PUT | `/api/admin/orders` | Order management |
| GET | `/api/admin/users` | User list |
| GET/POST/PUT/DELETE | `/api/admin/blogs` | Blog CRUD |
| GET/POST/PUT/DELETE | `/api/admin/categories` | Category CRUD |
| GET/POST/PUT/DELETE | `/api/admin/promotions` | Promotion CRUD |
| GET/POST | `/api/admin/support` | Support management |
| GET | `/api/admin/warranty` | Warranty management |
| GET | `/api/admin/hub` | Hub moderation |
| GET | `/api/admin/notifications` | Admin notifications |

---

## Payment Integration

### MoMo (Sandbox)
- Create payment → redirect to MoMo → IPN callback confirms payment → order created
- Server-side price validation against Product DB
- Supports mock mode (`MOMO_MOCK_MODE=true`) for demo without real MoMo API

### ZaloPay (Sandbox)
- Similar flow: create → redirect → callback → order created
- HMAC signature verification on callbacks

### COD (Cash on Delivery)
- OTP verification required before order confirmation
- Order created immediately with `pending` payment status

### ATM Transfer
- Order created with bank transfer instructions
- Manual confirmation via admin panel

### Promotion/Voucher System
- Promotions validated server-side with `Promotion` model
- Supports: percentage discount, max discount cap, usage limits, date range
- Usage tracked per user via `PromotionUsage` model
- Applied to all payment methods (COD, MoMo, ZaloPay, ATM)

---

## Environment Variables

```env
# === REQUIRED ===
MONGODB_URI=mongodb+srv://...          # MongoDB Atlas connection string
JWT_SECRET=your-secret-key             # JWT signing secret (NO fallback!)
PORT=3000                              # Server port (10000 on Render)

# === Email ===
EMAIL_USER=your@gmail.com             # Gmail address
EMAIL_PASS=xxxx-xxxx-xxxx-xxxx        # Gmail App Password
FRONTEND_URL=http://localhost:4200     # Frontend origin for CORS & emails

# === Payments (MoMo Sandbox) ===
MOMO_PARTNER_CODE=MOMO
MOMO_ACCESS_KEY=F8BBA842ECF85
MOMO_SECRET_KEY=K951B6PE1waDMi640xX08PD3vg6EkVlz
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
MOMO_REDIRECT_URL=http://localhost:4200/checkout-momo-return
MOMO_IPN_URL=http://localhost:3000/api/payment/momo/ipn
MOMO_MOCK_MODE=false

# === Social Login ===
GOOGLE_CLIENT_ID=your-google-client-id
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# === AI Chatbot ===
REPLICATE_API_TOKEN=your-replicate-token

# === Supabase (Image Storage) ===
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
SUPABASE_HUB_BUCKET=hub-images
SUPABASE_AVATAR_BUCKET=hub-images

# === Optional ===
NODE_ENV=development                   # Controls OTP visibility, error verbosity
AURA_VISUAL_WEBHOOK_URL=http://...     # AuraVisual n8n webhook
```

---

## CORS Configuration

CORS whitelist is configured in `index.js`. Allowed origins:

```javascript
[
  'http://localhost:4200',        // Local frontend
  'http://localhost:4201',        // Local admin
  'https://www.aurapc.io.vn',    // Production frontend
  // ... Vercel preview URLs
]
```

Add new origins to the array in `index.js` when deploying to new domains.

---

## Database

### MongoDB Atlas
- 21 Mongoose models
- Indexes: phone (sparse unique), googleId (sparse unique), facebookId (sparse unique), product slug, order number, etc.
- TTL indexes: Builder shares (7 days), OTP codes (5 minutes)

### Supabase
- Image storage buckets: `hub-images` (community posts + avatars)
- Optional chat logging for AruBot conversations

---

## Error Handling

- Centralized error handler in `index.js`
- All route handlers wrapped in try/catch
- Production: generic error messages (no stack traces)
- Development: detailed error messages with `err.message`
- Pino logger for structured JSON logging

---

## Deployment

Deployed on **Render** (Singapore, free tier). Configuration in `render.yaml`:

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

**Production API**: `https://aurapc-backend.onrender.com/api`

### Deployment Docs
- `docs/DEPLOY_RENDER.md` — Full Render deployment guide
- `docs/MOMO_LOCAL.md` — MoMo sandbox local testing
- `docs/SECURITY_ROTATION.md` — Credential rotation procedures
