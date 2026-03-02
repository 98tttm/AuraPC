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
- **Layout**: `layout/admin-layout.component.*` — sidebar + top bar wrapper
- **Routes**: `app.routes.ts` — lazy-loaded, guarded routes

### Pages
| Route | Component | Description |
|-------|-----------|-------------|
| `/` | DashboardComponent | Stats cards, charts (Chart.js), recent orders |
| `/products` | ProductsListAdminComponent | CRUD product list |
| `/orders` | OrdersListAdminComponent | All orders, filter by status |
| `/orders/:orderNumber` | OrderDetailAdminComponent | Order detail + status update |
| `/users` | UsersListAdminComponent | Customer list with search |
| `/users/:id` | UserDetailAdminComponent | Customer profile + order history |
| `/blogs` | BlogsListAdminComponent | CRUD blog list |
| `/login` | LoginComponent | Admin login form |

### Backend Admin Routes
All at `/api/admin/*`, protected by `requireAdmin` middleware:
- `/api/admin/auth` — login, me, seed
- `/api/admin/dashboard` — stats, chart/orders, chart/revenue
- `/api/admin/products` — CRUD
- `/api/admin/categories` — CRUD (backend still exists, frontend removed)
- `/api/admin/blogs` — CRUD
- `/api/admin/orders` — list, detail, status update
- `/api/admin/users` — list, detail

## Conventions
- Standalone components, `ChangeDetectionStrategy.OnPush`, signals for state
- Vietnamese UI labels
- BEM CSS naming, scoped per component
- Chart.js + ng2-charts for dashboard visualizations

## PENDING: UI Overhaul (Next Session)

### Goal
Completely restyle the admin panel to match **Shopify Polaris** design system with **dark/light mode toggle**.

### Design References
1. **Shopify Polaris**: https://shopify.dev/docs/api/app-home/using-polaris-components
2. **Figma prototype** (primary UI reference): https://dish-amity-20127371.figma.site/
   - User will provide screenshots of this site as the Figma site requires JS to render
3. **Category management page has been REMOVED** from admin frontend

### Shopify Polaris Color Tokens (for reference)
```css
/* Light mode */
--p-color-bg: #f1f1f1;
--p-color-bg-surface: #ffffff;
--p-color-bg-surface-secondary: #f7f7f7;
--p-color-text: #303030;
--p-color-text-secondary: #616161;
--p-color-border: #e3e3e3;
--p-color-border-secondary: #ebebeb;
--p-color-bg-fill-brand: #303030;
--p-color-bg-fill-critical: #c70a24;
--p-color-bg-fill-success: #047b5d;
--p-color-bg-fill-warning: #ffb800;
--p-color-icon: #4a4a4a;
--p-color-icon-secondary: #8a8a8a;
```

### Tasks for Next Session
1. **Dark/Light mode toggle**: Add theme service with signal, persist preference in localStorage, CSS variables for both themes, toggle button in topbar
2. **Restyle all components** to match Shopify Polaris + Figma prototype:
   - Sidebar: clean, minimal, Polaris-style nav with icon + label
   - Cards: Polaris card style (subtle border, small radius, minimal shadow)
   - Tables: Polaris data table style
   - Buttons: Polaris button variants (primary=dark fill, outline, plain)
   - Forms/Inputs: Polaris input style
   - Badges/Status: Polaris tone system
3. **Remove category management** from sidebar nav and routes (backend API stays)
4. **Match Figma prototype layout** — user will provide screenshots
5. Ensure all existing pages (dashboard, products, orders, users, blogs, login) get the new styling

## Phase 2 (Future)
- Real-time chat (WebSocket) with customer messaging
- SEO management for client site
- Banner/slide management
- Marketing poster management
