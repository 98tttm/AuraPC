import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Danh mục chính theo cấu trúc data sản phẩm (slug từ category_tree / DB) */
const FOOTER_CATEGORIES: { name: string; slug: string }[] = [
  { name: 'Bàn Ghế', slug: 'ban-ghe' },
  { name: 'Gaming Gear', slug: 'gaming-gear' },
  { name: 'Laptop', slug: 'laptop' },
  { name: 'Linh Kiện', slug: 'linh-kien' },
  { name: 'Màn Hình', slug: 'man-hinh' },
  { name: 'PC', slug: 'pc' },
  { name: 'Phụ Kiện', slug: 'phu-kien' },
];

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent {
  categories = FOOTER_CATEGORIES;
}
