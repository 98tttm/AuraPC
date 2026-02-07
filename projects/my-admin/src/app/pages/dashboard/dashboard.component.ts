import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <h1>Dashboard</h1>
    <p>Chào mừng đến AuraPC Admin. Sử dụng menu bên trái để quản lý sản phẩm, danh mục và bài viết.</p>
    <div class="quick-links">
      <a routerLink="/products">Quản lý sản phẩm</a>
      <a routerLink="/categories">Quản lý danh mục</a>
      <a routerLink="/blogs">Quản lý bài viết</a>
    </div>
  `,
  styles: [`
    .quick-links { display: flex; gap: 1rem; margin-top: 1.5rem; }
    .quick-links a { color: #ff6d2d; text-decoration: none; }
    .quick-links a:hover { text-decoration: underline; }
  `],
})
export class DashboardComponent {}
