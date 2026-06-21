import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';

type SideAdBanner = {
  side: 'left' | 'right';
  href: string;
  title: string;
  eyebrow: string;
  image: string;
  cta: string;
};

const SHOPEE_MALL_URL = 'https://shopee.vn/shop/793341363';
const TIKTOK_SHOP_URL = 'https://vt.tiktok.com/ZSQKxnAjg/?page=TikTokShop';

const SIDE_AD_BANNERS: SideAdBanner[] = [
  {
    side: 'left',
    href: TIKTOK_SHOP_URL,
    title: 'Radeon RX 9000',
    eyebrow: 'TikTok Shop',
    image: 'assets/ads/tiktok-radeon-side.png',
    cta: 'Mua ngay',
  },
  {
    side: 'right',
    href: SHOPEE_MALL_URL,
    title: 'Shopee Mall',
    eyebrow: 'Shopee',
    image: 'assets/ads/shopee-aurapc.png',
    cta: 'Xem deal',
  },
];

@Component({
  selector: 'app-side-ad-banners',
  standalone: true,
  templateUrl: './side-ad-banners.component.html',
  styleUrl: './side-ad-banners.component.css',
})
export class SideAdBannersComponent {
  private router = inject(Router);

  private routePath = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.router.url.split('?')[0])
    ),
    { initialValue: '/' }
  );

  readonly hidden = computed(() => {
    const path = this.routePath();
    return path.startsWith('/aura-builder')
      || path.startsWith('/checkout')
      || path.startsWith('/san-pham')
      || path.startsWith('/aura-hub')
      || path.startsWith('/ho-tro');
  });

  readonly banners = SIDE_AD_BANNERS;
}
