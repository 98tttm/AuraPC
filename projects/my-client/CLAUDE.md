# my-client — AuraPC Customer-Facing App

## Overview
Main Angular storefront for AuraPC. Vietnamese-market gaming PC e-commerce with product browsing, PC builder, checkout, blog, and community hub.

## Commands
```bash
# From repo root:
npm start              # Dev server → http://localhost:4200
npm run build          # Production build → dist/my-client/browser
npm test               # Karma unit tests
```

## Directory Structure
```
src/app/
├── app.routes.ts          # All routes (Vietnamese slugs, lazy-loaded)
├── app.config.ts          # Providers: router, HttpClient + auth interceptor
├── core/
│   ├── interceptors/      # authInterceptor — attaches JWT from localStorage
│   └── services/          # All injectable services
│       ├── api.service.ts       # Backend HTTP calls + product helpers
│       ├── auth.service.ts      # Phone OTP login, JWT, user state (signals)
│       ├── cart.service.ts      # Cart state (BehaviorSubject) + backend sync
│       ├── address.service.ts   # User address CRUD
│       ├── toast.service.ts     # Toast notifications
│       ├── chatbot.service.ts   # AI chatbot integration
│       └── intro-state.service.ts  # Homepage intro animation state
├── components/            # Shared/layout components
│   ├── header/            # Site header + nav
│   ├── footer/            # Site footer
│   ├── three-canvas/      # Three.js homepage 3D scene
│   ├── chatbot-widget/    # Floating chatbot
│   ├── checkout-stepper/  # Checkout progress indicator
│   ├── cod-otp-dialog/    # COD OTP verification modal
│   └── toast/             # Toast notification display
└── pages/                 # Route-level page components
    ├── homepage/          # Landing page (3D canvas, featured products)
    ├── product-list/      # /san-pham — product catalog with filters
    ├── product-detail/    # /san-pham/:slug — single product + reviews
    ├── builder/           # /aura-builder — PC configurator
    ├── cart/              # /cart
    ├── checkout/          # /checkout — address, payment method selection
    ├── checkout-*/        # Payment-specific return/confirmation pages
    ├── account/           # /tai-khoan — user profile, orders, addresses
    ├── login/ & register/ # Auth pages (phone OTP)
    ├── blog-list/         # /blog
    ├── blog-detail/       # /blog/:slug
    └── aura-hub/          # /aura-hub — community posts
```

## Routes (Vietnamese Slugs)
| Path | Component | Loading |
|------|-----------|---------|
| `/` | HomepageComponent | Eager |
| `/san-pham` | ProductListComponent | Eager |
| `/san-pham/:slug` | ProductDetailComponent | Eager |
| `/tai-khoan` | AccountPageComponent | Lazy |
| `/cart` | CartComponent | Lazy |
| `/checkout` | CheckoutComponent | Lazy |
| `/checkout-*` | Payment return pages | Lazy |
| `/aura-builder` | AuraBuilderComponent | Lazy |
| `/aura-hub` | AuraHubComponent | Lazy |
| `/blog` | BlogListComponent | Lazy |
| `/blog/:slug` | BlogDetailComponent | Lazy |

## Key Patterns
- **All components are standalone** — no NgModules
- **Auth state**: `AuthService` uses Angular `signal()` for reactive user state
- **Cart state**: `CartService` uses RxJS `BehaviorSubject`, syncs with backend when logged in
- **JWT token**: Stored in `localStorage` as `aurapc_token`, attached via functional `authInterceptor`
- **API base URL**: Configured in `ApiService`, points to backend (`localhost:3000` dev, Render prod)
- **3D**: Three.js for homepage canvas, Google Model Viewer for product 3D views

## Code Conventions
- 2-space indentation, single quotes
- Strict TypeScript (`strict`, `strictTemplates`, `noImplicitReturns`)
- Component prefix: `app-`
- Some comments in Vietnamese
- No ESLint/Prettier — follow existing patterns

## Known Issues
- `bypassSecurityTrustHtml` used in `product-detail.component.ts` — should use Angular sanitizer
- Homepage/product-list eagerly loaded (could be lazy for bundle size)
- Hardcoded `localhost:5678` reference in aura-builder (AuraVisual broken in prod)
