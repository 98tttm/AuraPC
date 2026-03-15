import { Component, inject, signal, computed, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService, CartItem } from '../../core/services/cart.service';
import { ApiService, productDisplayPrice, productMainImage, Product } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CheckoutStepperComponent } from '../../components/checkout-stepper/checkout-stepper.component';
import { RecentlyViewedSectionComponent } from '../../components/recently-viewed-section/recently-viewed-section.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, FormsModule, CheckoutStepperComponent, RecentlyViewedSectionComponent],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
})
export class CartComponent {
  private cart = inject(CartService);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /** Flag: has the initial auto-select already happened? */
  private hasInitialized = false;

  // Track selected product IDs
  selectedMethod = signal<Set<string>>(new Set());

  // Delete confirmation popup state
  showDeletePopup = signal(false);
  deleteMode = signal<'single' | 'selected'>('single');
  deleteTargetId = signal<string>('');

  // Voucher state
  couponCode = signal('');
  showVoucherModal = signal(false);
  voucherLoading = signal(false);
  voucherError = signal('');
  appliedVoucher = signal<{ code: string; description: string; discountPercent: number; discountAmount: number } | null>(null);

  // Computed cart items directly from service
  cartItems = computed(() => this.cart.getItems());
  cartCount = this.cart.cartCount;
  cartTotal = this.cart.cartTotal;

  // Total only includes selected items
  selectedTotal = computed(() => {
    const selected = this.selectedMethod();
    return this.cartItems().reduce((total, item) => {
      const id = this.productId(item.product);
      if (id && selected.has(id)) {
        return total + (productDisplayPrice(item.product) * item.qty);
      }
      return total;
    }, 0);
  });

  /**
   * "Giảm giá trực tiếp" = sum of (old_price - display_price) * qty
   * for every SELECTED item that has a sale/old_price.
   * Does NOT include voucher discounts.
   */
  directDiscount = computed(() => {
    const selected = this.selectedMethod();
    return this.cartItems().reduce((total, item) => {
      const id = this.productId(item.product);
      if (!id || !selected.has(id)) return total;

      const p = item.product;
      const displayPrice = productDisplayPrice(p);
      const oldPrice = p?.old_price ?? 0;

      if (oldPrice > 0 && displayPrice < oldPrice) {
        return total + ((oldPrice - displayPrice) * item.qty);
      }
      return total;
    }, 0);
  });

  /** Original total before discounts (uses old_price where applicable) */
  originalTotal = computed(() => {
    const selected = this.selectedMethod();
    return this.cartItems().reduce((total, item) => {
      const id = this.productId(item.product);
      if (!id || !selected.has(id)) return total;

      const p = item.product;
      const oldPrice = p?.old_price ?? 0;
      const displayPrice = productDisplayPrice(p);
      const price = (oldPrice > 0 && oldPrice > displayPrice) ? oldPrice : displayPrice;
      return total + (price * item.qty);
    }, 0);
  });

  // Count of selected items
  selectedCount = computed(() => this.selectedMethod().size);

  // Master checkbox state
  isAllSelected = computed(() => {
    const items = this.cartItems();
    const selected = this.selectedMethod();
    return items.length > 0 && items.every((i) => {
      const id = this.productId(i.product);
      return !!id && selected.has(id);
    });
  });

  selectAllModel = false;

  constructor() {
    // Auto-select all items ONLY on first load
    effect(() => {
      const items = this.cartItems();
      if (items.length > 0 && !this.hasInitialized) {
        this.hasInitialized = true;
        const newSet = new Set<string>();
        items.forEach((item) => {
          const id = this.productId(item.product);
          if (id) newSet.add(id);
        });
        this.selectedMethod.set(newSet);
      }
    });

    // Sync selectAllModel with computed isAllSelected
    effect(() => {
      this.selectAllModel = this.isAllSelected();
    });
  }

  getImage(p: Product) {
    return productMainImage(p);
  }

  getPrice(p: Product): number {
    return productDisplayPrice(p);
  }

  priceLabel(p: Product): string {
    const price = productDisplayPrice(p);
    if (!price || price <= 0) return 'Liên hệ';
    return price.toLocaleString('vi-VN') + '₫';
  }

  itemTotalLabel(item: CartItem): string {
    const price = productDisplayPrice(item.product);
    if (!price || price <= 0) return 'Liên hệ';
    return (price * item.qty).toLocaleString('vi-VN') + '₫';
  }

  oldPriceLabel(p: Product): string {
    const old = p?.old_price ?? 0;
    if (old <= 0) return '';
    return old.toLocaleString('vi-VN') + '₫';
  }

  /** Format the selected total */
  totalLabel(): string {
    const total = this.selectedTotal();
    if (!total || total <= 0) return '0₫';
    return total.toLocaleString('vi-VN') + '₫';
  }

  /** Format original total (before sale discounts) */
  originalTotalLabel(): string {
    const total = this.originalTotal();
    if (!total || total <= 0) return '0₫';
    return total.toLocaleString('vi-VN') + '₫';
  }

  /** Format direct discount */
  directDiscountLabel(): string {
    const d = this.directDiscount();
    if (!d || d <= 0) return '0₫';
    return '-' + d.toLocaleString('vi-VN') + '₫';
  }

  /** Voucher discount amount (recomputed when voucher or total changes) */
  voucherDiscount = computed(() => {
    const v = this.appliedVoucher();
    if (!v) return 0;
    const subtotal = this.selectedTotal();
    return Math.min(Math.round(subtotal * v.discountPercent / 100), v.discountAmount);
  });

  /** Final total after all discounts */
  finalTotal = computed(() => Math.max(0, this.selectedTotal() - this.voucherDiscount()));

  /** Final total = selectedTotal - voucher discount */
  finalTotalLabel(): string {
    const total = this.finalTotal();
    if (!total || total <= 0) return '0₫';
    return total.toLocaleString('vi-VN') + '₫';
  }

  voucherDiscountLabel(): string {
    const d = this.voucherDiscount();
    if (!d || d <= 0) return '0₫';
    return '-' + d.toLocaleString('vi-VN') + '₫';
  }

  productSlug(p: Product): string {
    return p?.slug || p?._id || '';
  }

  productId(p: Product): string {
    const product = p as (Product & { id?: string });
    const id = product?._id ?? product?.product_id ?? product?.id;
    return id ? String(id) : '';
  }

  hasSale(p: Product): boolean {
    const old = p?.old_price;
    if (old != null && old > 0 && (p?.price ?? 0) < old) return true;
    return !!(p.salePrice && p.salePrice < p.price);
  }

  salePercent(p: Product): number {
    const price = p?.price ?? 0;
    const old = p?.old_price;
    if (old != null && old > 0 && price < old) {
      return Math.round((1 - price / old) * 100);
    }
    if (!p.salePrice || p.salePrice >= price) return 0;
    return Math.round((1 - p.salePrice / price) * 100);
  }

  increaseQty(productId: string) {
    if (!productId) return;
    const item = this.cartItems().find(i => this.productId(i.product) === productId);
    if (item) this.cart.setQty(productId, item.qty + 1);
  }

  decreaseQty(productId: string) {
    if (!productId) return;
    const item = this.cartItems().find(i => this.productId(i.product) === productId);
    if (item && item.qty > 1) this.cart.setQty(productId, item.qty - 1);
    else if (item) {
      this.requestDeleteSingle(productId);
    }
  }

  // ---- Delete with confirmation popup ----

  requestDeleteSingle(productId: string) {
    if (!productId) return;
    this.deleteMode.set('single');
    this.deleteTargetId.set(productId);
    this.showDeletePopup.set(true);
  }

  requestDeleteSelected() {
    if (this.selectedCount() === 0) return;
    this.deleteMode.set('selected');
    this.deleteTargetId.set('');
    this.showDeletePopup.set(true);
  }

  confirmDelete() {
    if (this.deleteMode() === 'single') {
      const id = this.deleteTargetId();
      if (id) {
        const itemEl = document.getElementById('cart-item-' + id);
        if (itemEl) {
          itemEl.classList.add('is-deleting');
          setTimeout(() => {
            this.cart.remove(id);
            this.removeSelection(id);
          }, 300);
        } else {
          this.cart.remove(id);
          this.removeSelection(id);
        }
      }
    } else {
      // Batch delete all selected at once with animation
      const toDelete = Array.from(this.selectedMethod());
      toDelete.forEach(id => {
        const itemEl = document.getElementById('cart-item-' + id);
        if (itemEl) itemEl.classList.add('is-deleting');
      });
      setTimeout(() => {
        this.selectedMethod.set(new Set());
        this.cart.removeMultiple(toDelete);
      }, 300);
    }
    this.showDeletePopup.set(false);
  }

  cancelDelete() {
    this.showDeletePopup.set(false);
  }

  deleteTargetName(): string {
    if (this.deleteMode() === 'selected') {
      return `${this.selectedCount()} sản phẩm đã chọn`;
    }
    const id = this.deleteTargetId();
    const item = this.cartItems().find(i => this.productId(i.product) === id);
    return item?.product?.name ?? 'sản phẩm này';
  }

  remove(productId: string) {
    if (!productId) return;
    this.requestDeleteSingle(productId);
  }

  // ---- Voucher Logic ----

  openVoucherModal() {
    this.showVoucherModal.set(true);
    this.voucherError.set('');
  }

  closeVoucherModal() {
    this.showVoucherModal.set(false);
  }

  applyVoucher() {
    const code = this.couponCode().trim();
    if (!code) return;
    this.voucherLoading.set(true);
    this.voucherError.set('');

    const userId = this.auth.currentUser()?._id;
    this.api.validatePromotion(code, this.selectedTotal()).subscribe({
      next: (res) => {
        this.voucherLoading.set(false);
        if (res.valid && res.promotion) {
          this.appliedVoucher.set({
            code: res.promotion.code,
            description: res.promotion.description,
            discountPercent: res.promotion.discountPercent,
            discountAmount: res.promotion.discountAmount,
          });
          // Store in sessionStorage for checkout page
          sessionStorage.setItem('appliedVoucher', JSON.stringify(this.appliedVoucher()));
          this.showVoucherModal.set(false);
        } else {
          this.voucherError.set(res.message || 'Mã không hợp lệ.');
        }
      },
      error: () => {
        this.voucherLoading.set(false);
        this.voucherError.set('Lỗi hệ thống, vui lòng thử lại.');
      },
    });
  }

  removeVoucher() {
    this.appliedVoucher.set(null);
    this.couponCode.set('');
    sessionStorage.removeItem('appliedVoucher');
  }

  // ---- Checkout navigation ----
  goToCheckout() {
    if (this.selectedTotal() <= 0) return;
    this.router.navigate(['/checkout']);
  }

  // ---- Selection Logic ----

  isSelected(productId: string): boolean {
    if (!productId) return false;
    return this.selectedMethod().has(productId);
  }

  toggleSelection(productId: string, event: any) {
    if (!productId) return;
    const checked = event.target.checked;
    const current = new Set(this.selectedMethod());
    if (checked) {
      current.add(productId);
    } else {
      current.delete(productId);
    }
    this.selectedMethod.set(current);
  }

  toggleSelectAll() {
    const currentAll = this.isAllSelected();
    const newSet = new Set<string>();

    if (!currentAll) {
      this.cartItems().forEach((item) => {
        const id = this.productId(item.product);
        if (id) newSet.add(id);
      });
    }

    this.selectedMethod.set(newSet);
  }

  private removeSelection(productId: string) {
    const current = new Set(this.selectedMethod());
    if (current.has(productId)) {
      current.delete(productId);
      this.selectedMethod.set(current);
    }
  }
}
