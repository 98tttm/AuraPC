# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in the my-admin project.

## Overview

AuraPC Admin Panel — internal dashboard for managing the AuraPC e-commerce platform. Built as a separate Angular project within the monorepo.

## Commands

```bash
# Dev server (port 4201)
npx ng serve my-admin

# Production build
npx ng build my-admin --configuration=production

# Run tests
npx ng test my-admin
```

## Seeding Admins

5 admin accounts already seeded in MongoDB (password: `0` for all):
- thinhtt234111e@st.uel.edu.vn (Thinh Tran)
- phatht234111e@st.uel.edu.vn (Phat Huynh)
- thongnt234111e@st.uel.edu.vn (Thong Nguyen)
- nhilhq234111e@st.uel.edu.vn (Nhi Le)
- antt234111e@st.uel.edu.vn (An Trinh)

Seed script: `server/scripts/seed-admins.js`

## Architecture

### Auth Flow
- Separate Admin model (email + password, bcrypt) — NOT the customer User model
- Login: POST `/api/admin/auth/login` → JWT with `{ adminId, isAdmin: true }`
- Token stored in localStorage as `aurapc_admin_token`
- `adminAuthInterceptor` attaches token; redirects to `/login` on 401
- `adminAuthGuard` protects all routes except `/login`
- `requireAdmin` middleware protects all `/api/admin/*` backend routes

### Key Files
- **Auth**: `core/auth/admin-auth.service.ts`, `admin-auth.interceptor.ts`, `admin-auth.guard.ts`
- **API**: `core/admin-api.service.ts` — all HTTP calls (dashboard, products, orders, users, blogs)
- **Layout**: `layout/admin-layout.component.*` — sidebar + top bar wrapper (collapsible icon-only mode)
- **Routes**: `app.routes.ts` — lazy-loaded, guarded routes
- **Constants**: `core/constants.ts` — centralized status labels, user segments, stock thresholds, slug generator
- **Toast**: `core/toast.service.ts` + `shared/toast.component.ts` — signal-based notifications
- **Confirm**: `shared/confirm-dialog.component.ts` — promise-based confirmation modal
- **Theme**: `core/theme.service.ts` — dark/light mode toggle (persisted in localStorage)

### Pages
| Route | Component | Description |
|-------|-----------|-------------|
| `/` | DashboardComponent | Stats cards, charts (Chart.js), recent orders |
| `/products` | ProductsListAdminComponent | CRUD product list with sortable columns |
| `/products/new` | ProductFormComponent | Add product with validation, auto-slug |
| `/products/:id/edit` | ProductFormComponent | Edit product |
| `/orders` | OrdersListAdminComponent | Orders with status pill filters, date range |
| `/orders/:orderNumber` | OrderDetailAdminComponent | Order detail + status stepper + confirmation |
| `/users` | UsersListAdminComponent | Customer list with search, segment chart |
| `/users/:id` | UserDetailAdminComponent | Customer profile + order history |
| `/blogs` | BlogsListAdminComponent | CRUD blog list with draft/published filter |
| `/blogs/new` | BlogFormComponent | Add blog with auto-slug, content preview |
| `/blogs/:id/edit` | BlogFormComponent | Edit blog |
| `/login` | LoginComponent | Admin login with email/password validation |

### Backend Admin Routes
All at `/api/admin/*`, protected by `requireAdmin` middleware:
- `/api/admin/auth` — login, me, seed
- `/api/admin/dashboard` — stats, chart/orders, chart/revenue, top-products
- `/api/admin/products` — CRUD
- `/api/admin/categories` — CRUD (backend exists, frontend removed)
- `/api/admin/blogs` — CRUD
- `/api/admin/orders` — list, detail, status update
- `/api/admin/users` — list, detail

## UI System

### Theme
- Dark/light mode via `ThemeService` signal, persisted in localStorage (`aurapc_admin_theme`)
- `data-theme` attribute on `<body>` controls CSS variables
- Shopify Polaris-inspired token system in `styles.css`

### Sidebar
- Collapsible: full (220px) or icon-only (64px) mode
- Logo switches between light/dark variants: `assets/WEBSOURCE/logo152238.png` (dark) and `LogoWhite.png` (light)
- Account section shows avatar-only when collapsed

### Shared Components
- Toast notifications (auto-dismiss 3s, top-right position)
- Confirmation dialogs (promise-based, danger variant for deletes)
- Skeleton loading states on all list/detail pages
- Empty states with icons and CTAs

## Conventions
- Standalone components, `ChangeDetectionStrategy.OnPush`, signals for state
- Vietnamese UI labels
- BEM CSS naming, scoped per component
- Chart.js + ng2-charts for dashboard visualizations
- All delete actions use confirmation dialog (not `window.confirm`)
- Status labels from centralized `ORDER_STATUS_LABELS` in `core/constants.ts`

## Phase 2 (Future)
- Real-time chat (WebSocket) with customer messaging
- SEO management for client site
- Banner/slide management
- Marketing poster management
- Add `helmet` + `express-rate-limit` to backend
- Add MIME validation to file uploads
- Whitelist fields in admin CRUD routes (security)
