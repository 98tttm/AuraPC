import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminApiService, Category } from '../../core/admin-api.service';

@Component({
  selector: 'app-categories-list-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './categories-list-admin.component.html',
  styleUrl: './categories-list-admin.component.css',
})
export class CategoriesListAdminComponent implements OnInit {
  items = signal<Category[]>([]);
  loading = signal(true);
  error = signal('');

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getCategories().subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Lỗi tải danh sách');
        this.loading.set(false);
      },
    });
  }

  delete(id: string, name: string): void {
    if (!confirm(`Xóa danh mục "${name}"?`)) return;
    this.api.deleteCategory(id).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(err?.error?.error || 'Xóa thất bại'),
    });
  }
}
