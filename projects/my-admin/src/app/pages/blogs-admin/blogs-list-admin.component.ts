import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminApiService, BlogPost } from '../../core/admin-api.service';

@Component({
  selector: 'app-blogs-list-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './blogs-list-admin.component.html',
  styleUrl: './blogs-list-admin.component.css',
})
export class BlogsListAdminComponent implements OnInit {
  items = signal<BlogPost[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getBlogs(1, 50).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Lỗi tải danh sách');
        this.loading.set(false);
      },
    });
  }

  delete(id: string, title: string): void {
    if (!confirm(`Xóa bài viết "${title}"?`)) return;
    this.api.deleteBlog(id).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(err?.error?.error || 'Xóa thất bại'),
    });
  }
}
