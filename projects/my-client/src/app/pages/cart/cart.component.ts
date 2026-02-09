import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { CartService } from '../../core/services/cart.service';
import { productDisplayPrice, productMainImage, productHasSale, productSalePercent } from '../../core/services/api.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent {
  private cart = inject(CartService);

  cartItems = computed(() => this.cart.getItems());
  cartCount = this.cart.cartCount;
  cartTotal = this.cart.cartTotal;

  getImage(p: any) { return productMainImage(p); }
  getPrice(p: any) { return productDisplayPrice(p); }
  hasSale(p: any) { return productHasSale(p); }
  salePercent(p: any) { return productSalePercent(p); }

  increaseQty(productId: string) {
    const item = this.cartItems().find(i => i.product._id === productId);
    if (item) this.cart.setQty(productId, item.qty + 1);
  }

  decreaseQty(productId: string) {
    const item = this.cartItems().find(i => i.product._id === productId);
    if (item && item.qty > 1) this.cart.setQty(productId, item.qty - 1);
    else if (item) this.cart.remove(productId);
  }

  remove(productId: string) {
    this.cart.remove(productId);
  }
}
