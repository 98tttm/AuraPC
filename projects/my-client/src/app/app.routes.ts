// AuraPC Routes
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
    path: 'checkout-momo-return',
    loadComponent: () => import('./pages/checkout-momo-return/checkout-momo-return.component').then((m) => m.CheckoutMomoReturnComponent),
  },
  {
    path: 'checkout-zalopay-payment',
    loadComponent: () => import('./pages/checkout-zalopay-payment').then((m) => m.CheckoutZalopayPaymentComponent),
  },
  {
    path: 'checkout-zalopay-return',
    loadComponent: () => import('./pages/checkout-zalopay-return/checkout-zalopay-return.component').then((m) => m.CheckoutZalopayReturnComponent),
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
  {
    path: 'aura-hub',
    loadComponent: () => import('./pages/aura-hub/aura-hub.component').then(m => m.AuraHubComponent),
  },
  {
    path: 'aura-hub/:postId',
    loadComponent: () => import('./pages/aura-hub/aura-hub.component').then(m => m.AuraHubComponent),
  },
  {
    path: 'collabs/minecraft',
    loadComponent: () =>
      import('./pages/collabs-minecraft/collabs-minecraft.component').then((m) => m.CollabsMinecraftComponent),
  },
  {
    path: 've-aurapc',
    loadComponent: () =>
      import('./pages/ve-aurapc/ve-aurapc.component').then((m) => m.VeAurapcComponent),
  },
  {
    path: 've-aurapc/:slug',
    loadComponent: () =>
      import('./pages/ve-aurapc/ve-aurapc.component').then((m) => m.VeAurapcComponent),
  },
  {
    path: 'ho-tro',
    loadComponent: () =>
      import('./pages/support/support.component').then((m) => m.SupportComponent),
  },
  {
    path: 'tra-cuu-don-hang',
    loadComponent: () =>
      import('./pages/track-order/track-order.component').then((m) => m.TrackOrderComponent),
  },
  {
    path: 'tra-cuu-bao-hanh',
    loadComponent: () =>
      import('./pages/warranty-lookup/warranty-lookup.component').then((m) => m.WarrantyLookupComponent),
  },
  { path: '**', redirectTo: '' },
];
