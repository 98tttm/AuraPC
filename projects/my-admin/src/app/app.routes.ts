import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './layout/admin-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
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
        path: 'blogs',
        loadComponent: () =>
          import('./pages/blogs-admin/blogs-list-admin.component').then((m) => m.BlogsListAdminComponent),
      },
      {
        path: 'blogs/new',
        loadComponent: () =>
          import('./pages/blogs-admin/blog-form.component').then((m) => m.BlogFormComponent),
      },
      {
        path: 'blogs/:id/edit',
        loadComponent: () =>
          import('./pages/blogs-admin/blog-form.component').then((m) => m.BlogFormComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
