import { Routes } from '@angular/router';
import { HomepageComponent } from './pages/homepage/homepage.component';
import { ProductListComponent } from './pages/product-list/product-list.component';
import { ProductDetailComponent } from './pages/product-detail/product-detail.component';

export const routes: Routes = [
  { path: '', component: HomepageComponent },
  { path: 'san-pham', component: ProductListComponent },
  { path: 'san-pham/:slug', component: ProductDetailComponent },
  {
    path: 'tai-khoan',
    loadComponent: () => import('./pages/account').then((m) => m.AccountPageComponent),
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart.component').then((m) => m.CartComponent),
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout/checkout.component').then((m) => m.CheckoutComponent),
  },
  {
    path: 'checkout-qr-payment',
    loadComponent: () => import('./pages/checkout-qr-payment/checkout-qr-payment.component').then((m) => m.CheckoutQrPaymentComponent),
  },
  {
    path: 'checkout-momo-payment',
    loadComponent: () => import('./pages/checkout-momo-payment/checkout-momo-payment.component').then((m) => m.CheckoutMomoPaymentComponent),
  },
  {
    path: 'checkout-zalopay-payment',
    loadComponent: () => import('./pages/checkout-zalopay-payment').then((m) => m.CheckoutZalopayPaymentComponent),
  },
  {
    path: 'checkout-atm-payment',
    loadComponent: () => import('./pages/checkout-atm-payment').then((m) => m.CheckoutAtmPaymentComponent),
  },
  {
    path: 'checkout-success',
    loadComponent: () => import('./pages/checkout-success/checkout-success.component').then((m) => m.CheckoutSuccessComponent),
  },
  {
    path: 'blog',
    loadComponent: () => import('./pages/blog-list/blog-list.component').then((m) => m.BlogListComponent),
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./pages/blog-detail/blog-detail.component').then((m) => m.BlogDetailComponent),
  },
  {
    path: 'aura-builder',
    loadComponent: () => import('./pages/builder/aura-builder.component').then(m => m.AuraBuilderComponent),
  },
  {
    path: 'aura-builder/:id',
    loadComponent: () => import('./pages/builder/aura-builder.component').then(m => m.AuraBuilderComponent),
  },
  { path: '**', redirectTo: '' },
];
