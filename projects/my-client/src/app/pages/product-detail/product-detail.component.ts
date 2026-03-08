import { Component, ChangeDetectionStrategy, signal, inject, computed, effect, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ApiService, Product, ProductReviewItem, ProductReviewsResponse, productMainImage, productDisplayPrice, productHasSale, productSalePercent } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { RecentlyViewedService } from '../../core/services/recently-viewed.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private cart = inject(CartService);
  private recentlyViewed = inject(RecentlyViewedService);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private routeSub: Subscription | null = null;

  product = signal<Product | null>(null);
  currentImage = signal<string>('');
  loading = signal(true);
  error = signal(false);
  showFullDesc = signal(false);
  showSpecsModal = signal(false);
  relatedProducts = signal<Product[]>([]);
  recentlyViewedProducts = signal<Product[]>([]);

  // Đánh giá: lọc theo sao (null = tất cả)
  reviewStarFilter = signal<number | null>(null);
  // Hỏi đáp: sắp xếp Mới nhất / Cũ nhất
  qaSort = signal<'newest' | 'oldest'>('newest');
  reviewsData = signal<ProductReviewsResponse | null>(null);
  reviewsLoading = signal(false);
  canReview = signal(false);
  alreadyReviewed = signal(false);
  canReviewLoading = signal(false);

  // Form state
  showReviewForm = signal(false);
  showCommentForm = signal(false);
  reviewContent = '';
  reviewRating = 5;
  commentContent = '';
  replyTargetId = signal<string | null>(null);
  replyContent = '';
  submitLoading = signal(false);
  submitError = signal<string | null>(null);

  readonly isLoggedIn = computed(() => !!this.auth.currentUser());

  /** Tên hiển thị của user đang đăng nhập (ưu tiên tên, không hiển thị SĐT thô). */
  currentUserDisplayName(): string {
    const u = this.auth.currentUser();
    if (!u) return '';
    const name = u.profile?.fullName;
    if (name && String(name).trim()) return name;
    if (u.username && String(u.username).trim()) return u.username;
    if (u.phoneNumber) return u.phoneNumber.replace(/(\d{4})(\d{3})(\d{3})/, '$1***$3');
    return 'Khách';
  }

  /** Nhãn theo số sao đánh giá */
  ratingLabel(rating: number): string {
    const labels: Record<number, string> = { 1: 'Rất tệ', 2: 'Tệ', 3: 'Bình thường', 4: 'Tốt', 5: 'Tuyệt vời' };
    return labels[rating] ?? '';
  }
  readonly reviews = computed(() => {
    const d = this.reviewsData();
    if (!d) return [];
    const list = d.items.filter((i) => i.type === 'review');
    const star = this.reviewStarFilter();
    if (star != null) return list.filter((r) => (r.rating ?? 0) === star);
    return list;
  });
  readonly comments = computed(() => {
    const d = this.reviewsData();
    if (!d) return [];
    return d.items.filter((i) => i.type === 'comment');
  });
  readonly avgRating = computed(() => this.reviewsData()?.avgRating ?? 0);
  readonly ratingBars = computed(() => {
    const bars = this.reviewsData()?.ratingBars ?? [];
    const total = bars.reduce((s, b) => s + b.count, 0) || 1;
    return bars.map((b) => ({ ...b, percent: (b.count / total) * 100 }));
  });

  constructor() {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (!slug) {
        this.product.set(null);
        this.loading.set(false);
        this.error.set(true);
        return;
      }
      this.loadProduct(slug);
    });

    // Re-check canReview and reload reviews when user logs in/out
    let prevUserId: string | null | undefined = undefined;
    effect(() => {
      const user = this.auth.currentUser();
      const currentUserId = user?._id ?? (user as { id?: string })?.id ?? null;
      if (prevUserId === undefined) {
        prevUserId = currentUserId;
        return;
      }
      if (currentUserId !== prevUserId) {
        prevUserId = currentUserId;
        const p = this.product();
        const pid = p?._id ?? (p as { id?: string })?.id;
        if (pid) {
          this.checkCanReview(pid);
          this.loadReviews(pid);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  private loadProduct(slug: string): void {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
    this.loading.set(true);
    this.error.set(false);
    this.showFullDesc.set(false);
    this.showSpecsModal.set(false);
    this.showReviewForm.set(false);
    this.showCommentForm.set(false);
    this.replyTargetId.set(null);
    this.submitError.set(null);
    this.reviewsData.set(null);
    this.canReview.set(false);
    this.alreadyReviewed.set(false);
    this.canReviewLoading.set(false);
    this.relatedProducts.set([]);
    this.recentlyViewedProducts.set([]);

    this.api.getProductBySlug(slug).subscribe({
      next: (p) => {
        this.product.set(p);
        this.currentImage.set(productMainImage(p));
        this.loading.set(false);
        this.recentlyViewed.track(p);
        this.refreshRecentlyViewed(p);

        const pid = p._id ?? (p as { id?: string })?.id;
        if (pid) {
          this.loadReviews(pid);
          this.checkCanReview(pid);
        } else {
          this.reviewsData.set(null);
          this.canReview.set(false);
          this.alreadyReviewed.set(false);
        }

        this.loadRelatedProducts(p);
      },
      error: () => {
        this.product.set(null);
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadRelatedProducts(product: Product): void {
    if (!product.category) {
      this.relatedProducts.set([]);
      return;
    }

    const catSlug = product.category.slug || product.category.category_id;
    this.api.getProducts({ category: catSlug, limit: 8 }).subscribe({
      next: (res) => {
        this.relatedProducts.set(
          (res.items || [])
            .filter((item) => this.productKey(item) !== this.productKey(product))
            .slice(0, 4)
        );
      },
      error: () => this.relatedProducts.set([]),
    });
  }

  private refreshRecentlyViewed(current: Product): void {
    this.recentlyViewedProducts.set(this.recentlyViewed.list(4, this.productKey(current)));
  }

  private productKey(product: Product | null | undefined): string {
    return String(product?._id || product?.product_id || product?.slug || '').trim();
  }

  private loadReviews(productId: string): void {
    this.reviewsLoading.set(true);
    this.api
      .getProductReviews(productId, 'all', 'all', { sort: this.qaSort() })
      .subscribe({
        next: (res) => {
          this.reviewsData.set(res);
          this.reviewsLoading.set(false);
        },
        error: () => this.reviewsLoading.set(false),
      });
  }

  private checkCanReview(productId: string): void {
    if (!this.auth.currentUser()) {
      this.canReview.set(false);
      this.alreadyReviewed.set(false);
      this.canReviewLoading.set(false);
      return;
    }
    this.canReviewLoading.set(true);
    this.api.canReview(productId).subscribe({
      next: (res) => {
        this.canReview.set(res.canReview);
        this.alreadyReviewed.set(!!res.alreadyReviewed);
        this.canReviewLoading.set(false);
      },
      error: () => {
        this.canReview.set(false);
        this.alreadyReviewed.set(false);
        this.canReviewLoading.set(false);
      },
    });
  }

  onReviewStarFilter(star: number | null): void {
    this.reviewStarFilter.set(star);
  }

  onQaSortChange(sort: 'newest' | 'oldest'): void {
    this.qaSort.set(sort);
    const p = this.product();
    const pid = p?._id ?? (p as { id?: string })?.id;
    if (pid) this.loadReviews(pid);
  }

  openReviewForm(): void {
    if (!this.isLoggedIn()) {
      this.auth.showLoginPopup$.next();
      return;
    }
    if (this.alreadyReviewed()) {
      this.toast.showInfo('Bạn đã đánh giá sản phẩm này rồi.');
      return;
    }
    if (!this.canReview()) {
      this.toast.showInfo('Chỉ khách hàng đã mua và nhận hàng mới được đánh giá.');
      return;
    }
    this.showReviewForm.set(true);
    this.showCommentForm.set(false);
    this.submitError.set(null);
  }

  openCommentForm(): void {
    if (!this.isLoggedIn()) {
      this.auth.showLoginPopup$.next();
      return;
    }
    this.showCommentForm.set(true);
    this.showReviewForm.set(false);
    this.submitError.set(null);
  }

  submitReview(): void {
    const p = this.product();
    const pid = p?._id ?? (p as { id?: string })?.id;
    if (!pid || !this.auth.currentUser()) return;
    const content = this.reviewContent.trim();
    if (!content) {
      this.submitError.set('Vui lòng nhập nội dung đánh giá.');
      return;
    }
    this.submitLoading.set(true);
    this.submitError.set(null);
    this.api
      .createReviewComment({
        productId: pid,
        type: 'review',
        content,
        rating: this.reviewRating,
      })
      .subscribe({
        next: () => {
          this.reviewContent = '';
          this.reviewRating = 5;
          this.showReviewForm.set(false);
          this.submitLoading.set(false);
          this.alreadyReviewed.set(true);
          this.loadReviews(pid);
          this.checkCanReview(pid);
        },
        error: (err) => {
          this.submitError.set(err.error?.error || 'Gửi đánh giá thất bại.');
          this.submitLoading.set(false);
        },
      });
  }

  submitComment(): void {
    const p = this.product();
    const pid = p?._id ?? (p as { id?: string })?.id;
    if (!pid || !this.auth.currentUser()) return;
    const content = this.commentContent.trim();
    if (!content) {
      this.submitError.set('Vui lòng nhập nội dung bình luận.');
      return;
    }
    this.submitLoading.set(true);
    this.submitError.set(null);
    this.api
      .createReviewComment({
        productId: pid,
        type: 'comment',
        content,
      })
      .subscribe({
        next: () => {
          this.commentContent = '';
          this.showCommentForm.set(false);
          this.submitLoading.set(false);
          this.loadReviews(pid);
        },
        error: (err) => {
          this.submitError.set(err.error?.error || 'Gửi bình luận thất bại.');
          this.submitLoading.set(false);
        },
      });
  }

  openReply(itemId: string): void {
    if (!this.isLoggedIn()) {
      this.auth.showLoginPopup$.next();
      return;
    }
    this.replyTargetId.set(itemId);
    this.replyContent = '';
    this.submitError.set(null);
  }

  cancelReply(): void {
    this.replyTargetId.set(null);
  }

  submitReply(): void {
    const targetId = this.replyTargetId();
    if (!targetId || !this.auth.currentUser()) return;
    const content = this.replyContent.trim();
    if (!content) {
      this.submitError.set('Vui lòng nhập nội dung phản hồi.');
      return;
    }
    this.submitLoading.set(true);
    this.submitError.set(null);
    this.api.addReviewReply(targetId, content).subscribe({
      next: () => {
        this.replyTargetId.set(null);
        this.replyContent = '';
        this.submitLoading.set(false);
        const p = this.product();
        const pid = p?._id ?? (p as { id?: string })?.id;
        if (pid) this.loadReviews(pid);
      },
      error: (err) => {
        this.submitError.set(err.error?.error || 'Gửi phản hồi thất bại.');
        this.submitLoading.set(false);
      },
    });
  }

  /** Hiển thị theo tên người dùng (ưu tiên tên, không dùng SĐT thô). */
  userDisplayName(item: ProductReviewItem): string {
    const u = item.user;
    if (!u) return 'Khách';
    const name = (u as { profile?: { fullName?: string } })?.profile?.fullName;
    if (name && String(name).trim()) return name;
    const un = (u as { username?: string })?.username;
    if (un && String(un).trim()) return un;
    const ph = (u as { phoneNumber?: string })?.phoneNumber;
    if (ph) return ph.replace(/(\d{4})(\d{3})(\d{3})/, '$1***$3');
    return 'Khách';
  }

  closeReviewPopup(): void {
    this.showReviewForm.set(false);
    this.submitError.set(null);
  }

  closeCommentPopup(): void {
    this.showCommentForm.set(false);
    this.submitError.set(null);
  }

  closeReplyPopup(): void {
    this.replyTargetId.set(null);
    this.submitError.set(null);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  mainImage(p: Product): string {
    return productMainImage(p);
  }

  /** Danh sách ảnh gallery (bao gồm ảnh chính). */
  imageList(p: Product): string[] {
    if (!p.images || !p.images.length) return [];
    return p.images.map((img) => (typeof img === 'string' ? img : img.url));
  }

  selectImage(img: string) {
    this.currentImage.set(img);
  }

  prevImage() {
    const p = this.product();
    if (!p) return;
    const list = this.imageList(p);
    if (!list.length) return;
    const current = this.currentImage();
    const idx = list.indexOf(current);
    const prevIdx = (idx - 1 + list.length) % list.length;
    this.currentImage.set(list[prevIdx]);
  }

  nextImage() {
    const p = this.product();
    if (!p) return;
    const list = this.imageList(p);
    if (!list.length) return;
    const current = this.currentImage();
    const idx = list.indexOf(current);
    const nextIdx = (idx + 1) % list.length;
    this.currentImage.set(list[nextIdx]);
  }

  displayPrice(p: Product): number {
    return productDisplayPrice(p);
  }

  hasSale(p: Product): boolean {
    return productHasSale(p);
  }

  salePercent(p: Product): number {
    return productSalePercent(p);
  }

  /** Giá hiển thị: "Liên hệ" nếu price = 0, ngược lại format VNĐ. */
  priceLabel(p: Product): string {
    const price = productDisplayPrice(p);
    if (price == null || price <= 0) return 'Liên hệ';
    return price.toLocaleString('vi-VN') + '₫';
  }

  /** Giá gốc (khi giảm) để gạch ngang. */
  oldPriceLabel(p: Product): string {
    if (!this.hasSale(p)) return '';
    const old = p.old_price ?? (p.price ?? 0);
    if (old <= 0) return '';
    return old.toLocaleString('vi-VN') + '₫';
  }

  /** Mô tả HTML (description_html hoặc description) dùng bypassSecurityTrustHtml để render. */
  descriptionSafe(p: Product): SafeHtml | null {
    const html = p.description_html ?? p.description;
    if (!html || typeof html !== 'string') return null;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /** Bảng specs từ p.specs (Record<string, string>). */
  specEntries(p: Product): { key: string; value: string }[] {
    const specs = p.specs ?? {};
    return Object.entries(specs)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .map(([key, value]) => ({ key, value: String(value) }));
  }

  /** Thông số tóm tắt hiển thị ở phần info (CPU, VGA, RAM, SSD, Màn hình). */
  shortSpecs(p: Product): { label: string; value: string }[] {
    const s = (p.specs ?? p.techSpecs ?? {}) as Record<string, string>;
    const keys = [
      { label: 'CPU', find: ['CPU', 'Vi xử lý', 'Chipset'] },
      { label: 'RAM', find: ['RAM', 'Bộ nhớ trong', 'Memory'] },
      { label: 'Ổ cứng', find: ['Ổ cứng', 'SSD', 'Storage'] },
      { label: 'VGA', find: ['VGA', 'Card đồ họa', 'GPU'] },
      { label: 'Màn hình', find: ['Màn hình', 'Display', 'LCD'] },
    ];
    const res: { label: string; value: string }[] = [];
    for (const k of keys) {
      for (const f of k.find) {
        const foundKey = Object.keys(s).find((sk) => sk.toLowerCase() === f.toLowerCase());
        if (foundKey && s[foundKey]) {
          res.push({ label: k.label, value: String(s[foundKey]) });
          break;
        }
      }
    }
    return res;
  }

  brandName(p: Product): string {
    if (p.brand) return p.brand;
    if (p.category?.name) {
      if (p.category.name.toLowerCase().includes('asus')) return 'ASUS';
      if (p.category.name.toLowerCase().includes('acer')) return 'ACER';
      if (p.category.name.toLowerCase().includes('msi')) return 'MSI';
      if (p.category.name.toLowerCase().includes('dell')) return 'DELL';
      if (p.category.name.toLowerCase().includes('hp')) return 'HP';
      if (p.category.name.toLowerCase().includes('lenovo')) return 'LENOVO';
      if (p.category.name.toLowerCase().includes('apple')) return 'APPLE';
    }
    const name = p.name.toUpperCase();
    if (name.startsWith('ASUS')) return 'ASUS';
    if (name.startsWith('ACER')) return 'ACER';
    if (name.startsWith('MSI')) return 'MSI';
    if (name.startsWith('DELL')) return 'DELL';
    if (name.startsWith('HP')) return 'HP';
    if (name.startsWith('LENOVO')) return 'LENOVO';
    if (name.startsWith('MACBOOK') || name.startsWith('APPLE')) return 'APPLE';
    if (name.startsWith('GIGABYTE')) return 'GIGABYTE';
    return 'Khác';
  }

  sku(p: Product): string {
    return p.product_id ?? p._id?.substring(0, 8).toUpperCase() ?? 'N/A';
  }

  productRoute(product: Product): string[] {
    if (product.slug) return ['/san-pham', product.slug];
    return ['/san-pham'];
  }

  productQueryParams(product: Product): Record<string, string> | null {
    if (product.slug) return null;
    return product.name ? { search: product.name } : null;
  }

  toggleDesc() {
    this.showFullDesc.update((v) => !v);
  }

  toggleSpecsModal() {
    this.showSpecsModal.update((v) => !v);
  }

  get visibleSpecEntries(): { key: string; value: string }[] {
    const p = this.product();
    if (!p) return [];
    const all = this.specEntries(p);
    return all.slice(0, 10);
  }

  /** Mua ngay: thêm vào giỏ + chuyển hướng tới trang giỏ hàng */
  buyNow(): void {
    const p = this.product();
    if (!p) return;
    this.cart.add(p, 1);
    this.router.navigate(['/cart']);
  }

  /** Thêm vào giỏ hàng (không chuyển hướng) */
  addToCart(): void {
    const p = this.product();
    if (!p) return;
    this.cart.add(p, 1);
    this.toast.showInfo('Đã thêm sản phẩm vào giỏ hàng!');
  }
}
