import { Component, inject, signal, computed, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService, CartItem } from '../../core/services/cart.service';
import { productDisplayPrice, productMainImage, Product } from '../../core/services/api.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
})
export class CartComponent {
  private cart = inject(CartService);
  private router = inject(Router);

  /** Flag: has the initial auto-select already happened? */
  private hasInitialized = false;

  // Track selected product IDs
  selectedMethod = signal<Set<string>>(new Set());

  // Delete confirmation popup state
  showDeletePopup = signal(false);
  deleteMode = signal<'single' | 'selected'>('single');
  deleteTargetId = signal<string>('');

  // Coupon input
  couponCode = signal('');

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

  /** Final total = selectedTotal (already discounted display prices) */
  finalTotalLabel(): string {
    return this.totalLabel();
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
        this.cart.remove(id);
        this.removeSelection(id);
      }
    } else {
      // Delete all selected — snapshot the IDs first, then clear selection, then remove
      const toDelete = Array.from(this.selectedMethod());
      this.selectedMethod.set(new Set());
      toDelete.forEach(id => this.cart.remove(id));
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
