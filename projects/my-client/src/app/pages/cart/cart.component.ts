import { Component, inject, signal, computed, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { CartService } from '../../core/services/cart.service';
import { productDisplayPrice, productMainImage, Product } from '../../core/services/api.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, DecimalPipe, FormsModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
})
export class CartComponent {
  private cart = inject(CartService);
  private router = inject(Router);

  // Track selected product IDs
  selectedMethod = signal<Set<string>>(new Set());

  // Computed cart items directly from service
  cartParams = this.cart.getItems;

  cartItems = computed(() => {
    return this.cart.getItems();
  });

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
    // Sync selectAllModel with computed isAllSelected
    effect(() => {
      this.selectAllModel = this.isAllSelected();
    });
  }

  getImage(p: Product) {
    return productMainImage(p);
  }

  getPrice(p: Product) {
    return productDisplayPrice(p);
  }

  productId(p: Product): string {
    const product = p as (Product & { id?: string });
    const id = product?._id ?? product?.product_id ?? product?.id;
    return id ? String(id) : '';
  }

  hasSale(p: Product): boolean {
    return !!(p.salePrice && p.salePrice < p.price);
  }

  salePercent(p: Product): number {
    if (!p.salePrice || p.salePrice >= p.price) return 0;
    return Math.round((1 - p.salePrice / p.price) * 100);
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
      this.cart.remove(productId);
      this.removeSelection(productId);
    }
  }

  remove(productId: string) {
    if (!productId) return;
    this.cart.remove(productId);
    this.removeSelection(productId);
  }

  // Selection Logic
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
      // Select all
      this.cartItems().forEach((item) => {
        const id = this.productId(item.product);
        if (id) newSet.add(id);
      });
    }
    // If was all selected, we clear the set (unselect all)

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
