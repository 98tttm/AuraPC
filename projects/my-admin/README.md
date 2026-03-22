# AuraPC — Admin Panel

> Angular 21 admin dashboard for managing the AuraPC e-commerce platform. Shopify Polaris-inspired design with dark/light theme.

---

## Quick Start

```bash
# From repo root
npx ng serve my-admin           # Dev server → http://localhost:4201
npx ng build my-admin --configuration=production
```

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| Angular 21.1.3 | SPA framework (standalone components, signals) |
| TypeScript 5.9.3 | Strict type checking |
| Chart.js 4.5 + ng2-charts 9.0 | Dashboard analytics charts |
| Socket.IO Client 4.8 | Real-time order/support notifications |
| XLSX 0.18 | Excel export for orders/products |
| DocX 9.6 | Word document generation |

---

## Authentication

- **Separate `Admin` model** — not the `User` model (different collection)
- Admin accounts use **email/password** with bcrypt hashing
- JWT contains `{ adminId, isAdmin: true }` claim
- Token stored in `localStorage` as `aurapc_admin_token`
- All routes guarded by `AdminAuthGuard` + backend `requireAdmin` middleware
- On 401 response, auto-redirects to `/login`

### Seeded Admin Accounts

| Username | Email | Password |
|----------|-------|----------|
| thinhtt | thinhtt234111e@st.uel.edu.vn | `0` |
| phatht | phatht234111e@st.uel.edu.vn | `0` |
| thongnt | thongnt234111e@st.uel.edu.vn | `0` |
| nhilhq | nhilhq234111e@st.uel.edu.vn | `0` |
| antt | antt234111e@st.uel.edu.vn | `0` |

> Change passwords in production!

---

## Architecture

### Directory Structure

```
src/app/
├── app.routes.ts              # Lazy-loaded, guarded admin routes
├── app.config.ts              # Providers with auth interceptor
├── app.component.ts           # Root: sidebar + header + router-outlet
│
├── core/
│   ├── admin-api.service.ts        # All HTTP calls to /api/admin/*
│   ├── admin-auth.service.ts       # Login, token, current admin state
│   ├── admin-auth.interceptor.ts   # Auto-attach JWT; redirect on 401
│   ├── admin-auth.guard.ts         # Route protection
│   ├── theme.service.ts            # Dark/light theme toggle (localStorage)
│   ├── toast.service.ts            # Signal-based toast notifications
│   ├── layout.service.ts           # Sidebar collapse state
│   ├── admin-support.service.ts    # Support conversation features
│   ├── realtime.service.ts         # Socket.IO for real-time events
│   └── constants.ts                # Status labels, segments, stock thresholds
│
├── components/
│   ├── toast.component.ts          # Toast notification renderer
│   └── confirm-dialog.component.ts # Promise-based confirmation modal
│
└── pages/
    ├── login/                 # Admin email/password login
    ├── dashboard/             # KPI cards, revenue/orders/customers charts
    ├── products-admin/        # Product CRUD with brand/category filters
    ├── orders-admin/          # Order list + detail with status stepper
    ├── users-admin/           # Customer list + profile/order history
    ├── blogs-admin/           # Blog article CRUD
    ├── categories-admin/      # Product category management
    ├── promotions-admin/      # Discount code management
    ├── support-admin/         # Customer support conversation view
    ├── warranty-admin/        # Warranty lookup + management
    └── hub-admin/             # Community hub moderation
```

---

## Pages & Features

### Dashboard (`/`)
- **4 KPI cards**: Revenue, Orders, Customers, Products
- **Charts**: Revenue over time, orders by status, new customers trend
- **Top products**: Best-selling products table
- **Quick stats**: Order status distribution, stock alerts

### Product Management (`/products`)
- Product list with search, category filter, brand filter
- Create/edit with specs, images, sale prices, stock levels
- Brand extraction: `npm run update-brands` (server script)

### Order Management (`/orders`)
- Order list with status tabs and date range filters
- Order detail with visual status stepper
- Status transitions: Pending → Confirmed → Shipping → Delivered → Completed
- Invoice PDF download

### User Management (`/users`)
- Customer list with search and segmentation
- User detail: profile info, order history, addresses

### Blog Management (`/blogs`)
- Blog article CRUD with rich text content
- SEO slug generation

### Category Management (`/categories`)
- Hierarchical category tree
- Parent-child relationships

### Promotion Management (`/promotions`)
- Create discount codes with percentage, max amount, usage limits
- Track usage per promotion
- Activate/deactivate promotions

### Support (`/support`)
- View customer support conversations
- Reply to customer messages

### Warranty (`/warranty`)
- Lookup warranty by order number
- Manage warranty claims with stats

### Hub Moderation (`/hub`)
- Review community posts
- Moderate content

---

## Theme System

Shopify Polaris-inspired dark/light theme managed by `ThemeService`:

- Toggle via header button
- Persisted in `localStorage`
- CSS custom properties for all colors
- Theme-aware logos:
  - Light mode: `assets/WEBSOURCE/logo152238.png`
  - Dark mode: `assets/WEBSOURCE/LogoWhite.png`

### Layout
- **Collapsible sidebar**: Full (220px) or icon-only (64px)
- State managed by `LayoutService`
- Responsive: auto-collapses on smaller screens

---

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/login` | LoginComponent | Admin authentication |
| `/` | DashboardComponent | Analytics dashboard |
| `/products` | ProductsAdminComponent | Product CRUD |
| `/orders` | OrdersAdminComponent | Order management |
| `/users` | UsersAdminComponent | Customer management |
| `/blogs` | BlogsAdminComponent | Blog CRUD |
| `/categories` | CategoriesAdminComponent | Category tree |
| `/promotions` | PromotionsAdminComponent | Discount codes |
| `/support` | SupportAdminComponent | Support inbox |
| `/warranty` | WarrantyAdminComponent | Warranty management |
| `/hub` | HubAdminComponent | Community moderation |

All routes except `/login` are protected by `AdminAuthGuard`.

---

## API Integration

All API calls go through `AdminApiService` to `/api/admin/*` endpoints. The backend `requireAdmin` middleware verifies the JWT contains `isAdmin: true` before processing any request.

---

## Code Conventions

- Standalone components (no NgModules)
- BEM-style CSS naming
- Signal-based state management
- 2-space indentation, single quotes
- Component prefix: `app-`

---

## Deployment

The admin panel is part of the same Angular workspace but deployed separately if needed. For development, it runs on port 4201 alongside the customer app on port 4200.
