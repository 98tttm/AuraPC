# AuraPC — Customer Storefront

> Angular 21 single-page application for the AuraPC gaming PC e-commerce platform.

---

## Quick Start

```bash
# From repo root
npx ng serve my-client          # Dev server → http://localhost:4200
npx ng build my-client          # Production build → dist/my-client/browser
npx ng test my-client           # Run Karma unit tests
```

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| Angular 21.1.3 | SPA framework (standalone components, signals, lazy routes) |
| TypeScript 5.9.3 | Type safety with strict mode |
| Three.js 0.172 | 3D homepage visualization (animated gaming PC) |
| GSAP 3.14 | Scroll-triggered animations & page transitions |
| Google Model Viewer 4.1 | Interactive 3D product viewer on product pages |
| RxJS 7.8 | Reactive cart state, HTTP streams |
| Socket.IO Client 4.8 | Real-time notifications |
| Zone.js 0.15 | Angular change detection |

---

## Architecture

All components are **standalone** (no NgModules). Routes are **lazy-loaded** for optimal bundle splitting.

### State Management
- **Auth**: Angular `signal()` in `AuthService` — reactive user state
- **Cart**: RxJS `BehaviorSubject` in `CartService` — syncs with backend when logged in
- **UI**: Component-level signals for local state

### Authentication
- **Phone OTP**: Enter Vietnamese phone number → receive OTP → verify → JWT
- **Google OAuth**: Google Identity Services popup → ID token sent to backend
- **Facebook OAuth**: Facebook JS SDK popup → access token sent to backend
- JWT stored in `localStorage` (`aurapc_token`), attached via functional `authInterceptor`

---

## Directory Structure

```
src/app/
├── app.routes.ts              # Route definitions (Vietnamese slugs, lazy-loaded)
├── app.config.ts              # Providers: Router, HttpClient, auth interceptor
├── app.component.ts           # Root component (header + router-outlet + footer)
│
├── core/
│   ├── interceptors/
│   │   └── authInterceptor    # Attaches JWT to all API requests
│   └── services/
│       ├── api.service.ts     # All backend HTTP calls + product helpers
│       ├── auth.service.ts    # Auth state (signal), OTP, Google/Facebook login
│       ├── cart.service.ts    # Cart state (BehaviorSubject) + backend sync
│       ├── address.service.ts # User address CRUD
│       ├── toast.service.ts   # Toast notifications
│       ├── chatbot.service.ts # AruBot chatbot integration
│       └── intro-state.service.ts  # Homepage intro animation state
│
├── components/                # Shared/layout components
│   ├── header/                # Site header with nav, search, auth popup
│   ├── footer/                # Site footer
│   ├── three-canvas/          # Three.js 3D scene (homepage)
│   ├── chatbot-widget/        # Floating AruBot chatbot widget
│   ├── checkout-stepper/      # Multi-step checkout progress
│   ├── cod-otp-dialog/        # COD payment OTP verification modal
│   └── toast/                 # Toast notification renderer
│
└── pages/                     # Route-level page components
    ├── homepage/              # Landing page (3D canvas, featured products)
    ├── product-list/          # Product catalog with filters, sorting, search
    ├── product-detail/        # Product page (specs, reviews, 3D viewer, add to cart)
    ├── cart/                  # Shopping cart with quantity controls, vouchers
    ├── checkout/              # Shipping address, payment method selection
    ├── checkout-success/      # Order confirmation page
    ├── checkout-momo-return/  # MoMo payment callback handler
    ├── checkout-zalopay-return/ # ZaloPay payment callback handler
    ├── checkout-atm-payment/  # ATM bank transfer instructions
    ├── checkout-qr-payment/   # QR code payment display
    ├── builder/               # AuraBuilder — interactive PC configurator
    ├── account/               # User profile, order history, addresses, warranty
    ├── login/                 # Phone OTP login
    ├── register/              # New user registration
    ├── track-order/           # Order tracking by order number
    ├── blog-list/             # Blog article listing
    ├── blog-detail/           # Single blog article
    ├── aura-hub/              # Community hub (posts & comments)
    ├── support/               # Customer support chat
    ├── warranty-lookup/       # Warranty status lookup
    ├── ve-aurapc/             # About AuraPC pages
    └── collabs-minecraft/     # Minecraft collaboration campaign
```

---

## Routes

All routes use **Vietnamese slugs** for SEO and local market optimization.

| Path | Component | Loading | Description |
|------|-----------|---------|-------------|
| `/` | HomepageComponent | Eager | Landing page with 3D visualization |
| `/san-pham` | ProductListComponent | Eager | Product catalog with filters |
| `/san-pham/:slug` | ProductDetailComponent | Eager | Product detail + reviews + 3D viewer |
| `/cart` | CartComponent | Lazy | Shopping cart |
| `/checkout` | CheckoutComponent | Lazy | Checkout with address & payment |
| `/checkout-success` | CheckoutSuccessComponent | Lazy | Order confirmation |
| `/checkout-momo-return` | CheckoutMomoReturnComponent | Lazy | MoMo payment return handler |
| `/checkout-zalopay-return` | CheckoutZalopayReturnComponent | Lazy | ZaloPay return handler |
| `/checkout-atm-payment` | CheckoutAtmPaymentComponent | Lazy | ATM transfer instructions |
| `/checkout-qr-payment` | CheckoutQrPaymentComponent | Lazy | QR code display |
| `/tai-khoan` | AccountPageComponent | Lazy | User profile & order history |
| `/aura-builder` | AuraBuilderComponent | Lazy | PC configurator |
| `/aura-builder/:id` | AuraBuilderComponent | Lazy | Load saved build |
| `/aura-hub` | AuraHubComponent | Lazy | Community hub |
| `/aura-hub/:postId` | AuraHubComponent | Lazy | Hub post detail |
| `/blog` | BlogListComponent | Lazy | Blog listing |
| `/blog/:slug` | BlogDetailComponent | Lazy | Blog article |
| `/ho-tro` | SupportComponent | Lazy | Customer support |
| `/tra-cuu-don-hang` | TrackOrderComponent | Lazy | Order tracking |
| `/collabs/minecraft` | CollabsMinecraftComponent | Lazy | Campaign landing page |
| `/ve-aurapc` | VeAurapcComponent | Lazy | About pages |

---

## Key Features

### 3D Homepage Experience
The homepage renders a Three.js scene with an animated gaming PC model. GSAP handles scroll-triggered animations and camera transitions. The intro animation state is managed by `IntroStateService`.

### AuraBuilder — PC Configurator
- Select components (CPU, GPU, RAM, etc.) from categorized lists
- Real-time price calculation
- Save configurations with shareable links (7-day TTL)
- Export as PDF or send via email
- Load from URL: `/aura-builder/:id`

### AruBot — AI Chatbot
- Floating widget accessible from any page
- Powered by Qwen 3 235B via Replicate API
- System prompt includes full product catalog (auto-refreshed every 10 min)
- Product suggestions with direct links to `/san-pham/:slug`
- Chat history optionally logged to Supabase

### Shopping & Checkout
- Cart with real-time quantity editing (manual input + increment/decrement)
- Promotion/voucher code validation with server-side discount calculation
- Shipping: free for orders >= 500,000₫, otherwise 30,000₫
- Payment methods: MoMo, ZaloPay, ATM Transfer, COD (with OTP)
- Invoice PDF download on order confirmation pages

### Social Login
- Google: Google Identity Services (popup-based, no redirect)
- Facebook: Facebook JS SDK (popup-based)
- Auto-pulls avatar and display name from social profiles
- Account linking: if email matches existing phone user, accounts are merged

---

## Environment Configuration

Frontend environment files at `src/environments/`:

```typescript
// environment.ts (production)
export const environment = {
  production: true,
  apiUrl: 'https://aurapc-backend.onrender.com/api',
  googleClientId: 'your-google-client-id',
  facebookAppId: 'your-facebook-app-id',
};

// environment.development.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  googleClientId: 'your-google-client-id',
  facebookAppId: 'your-facebook-app-id',
};
```

---

## Code Conventions

- 2-space indentation, single quotes
- Strict TypeScript: `strict`, `strictTemplates`, `noImplicitReturns`
- Component prefix: `app-`
- Standalone components only — no NgModules
- Vietnamese comments in some files
- No ESLint/Prettier — follow existing patterns

---

## Deployment

Deployed on **Vercel** with auto-deploy from `main` branch. SPA routing handled via `vercel.json` rewrites. Production URL: `https://www.aurapc.io.vn`
