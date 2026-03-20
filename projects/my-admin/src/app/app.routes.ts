import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './layout/admin-layout.component';
import { adminAuthGuard } from './core/auth/admin-auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [adminAuthGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./pages/products-admin/products-list-admin.component').then((m) => m.ProductsListAdminComponent),
      },
      {
        path: 'products/new',
        loadComponent: () =>
          import('./pages/products-admin/product-form.component').then((m) => m.ProductFormComponent),
      },
      {
        path: 'products/:id/edit',
        loadComponent: () =>
          import('./pages/products-admin/product-form.component').then((m) => m.ProductFormComponent),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./pages/categories-admin/categories-list-admin.component').then((m) => m.CategoriesListAdminComponent),
      },
      {
        path: 'categories/new',
        loadComponent: () =>
          import('./pages/categories-admin/category-form.component').then((m) => m.CategoryFormComponent),
      },
      {
        path: 'categories/:id/edit',
        loadComponent: () =>
          import('./pages/categories-admin/category-form.component').then((m) => m.CategoryFormComponent),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./pages/orders-admin/orders-list-admin.component').then((m) => m.OrdersListAdminComponent),
      },
      {
        path: 'orders/:orderNumber',
        loadComponent: () =>
          import('./pages/orders-admin/order-detail-admin.component').then((m) => m.OrderDetailAdminComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users-admin/users-list-admin.component').then((m) => m.UsersListAdminComponent),
      },
      {
        path: 'users/:id',
        loadComponent: () =>
          import('./pages/users-admin/user-detail-admin.component').then((m) => m.UserDetailAdminComponent),
      },
      {
        path: 'blogs',
        loadComponent: () =>
          import('./pages/blogs-admin/blogs-list-admin.component').then((m) => m.BlogsListAdminComponent),
      },
      {
        path: 'hub',
        loadComponent: () =>
          import('./pages/hub-admin/hub-moderation.component').then((m) => m.HubModerationComponent),
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./pages/support-admin/support-admin.component').then((m) => m.SupportAdminComponent),
      },
      {
        path: 'blogs/new',
        loadComponent: () =>
          import('./pages/blogs-admin/blog-form.component').then((m) => m.BlogFormComponent),
      },
      {
        path: 'blogs/:id/detail',
        loadComponent: () =>
          import('./pages/blogs-admin/blog-detail-admin.component').then((m) => m.BlogDetailAdminComponent),
      },
      {
        path: 'blogs/:id/edit',
        loadComponent: () =>
          import('./pages/blogs-admin/blog-form.component').then((m) => m.BlogFormComponent),
      },
      {
        path: 'promotions',
        loadComponent: () =>
          import('./pages/promotions-admin/promotions-list-admin.component').then((m) => m.PromotionsListAdminComponent),
      },
      {
        path: 'promotions/new',
        loadComponent: () =>
          import('./pages/promotions-admin/promotion-form.component').then((m) => m.PromotionFormComponent),
      },
      {
        path: 'promotions/:id/edit',
        loadComponent: () =>
          import('./pages/promotions-admin/promotion-form.component').then((m) => m.PromotionFormComponent),
      },
      {
        path: 'warranty',
        loadComponent: () =>
          import('./pages/warranty-admin/warranty-admin.component').then((m) => m.WarrantyAdminComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
