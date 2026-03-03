import { Component, OnInit, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService, BlogPost } from '../../core/admin-api.service';

@Component({
  selector: 'app-blogs-list-admin',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './blogs-list-admin.component.html',
  styleUrl: './blogs-list-admin.component.css',
})
export class BlogsListAdminComponent implements OnInit {
  private api = inject(AdminApiService);

  items = signal<BlogPost[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');
  searchQuery = '';

  // Computed stats
  totalPosts = computed(() => this.items().length);
  publishedPosts = computed(() => this.items().filter(b => b.published).length);
  draftPosts = computed(() => this.items().filter(b => !b.published).length);

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

  filteredItems(): BlogPost[] {
    if (!this.searchQuery.trim()) return this.items();
    const q = this.searchQuery.toLowerCase();
    return this.items().filter(b => b.title.toLowerCase().includes(q));
  }

  delete(id: string, title: string): void {
    if (!confirm(`Xóa bài viết "${title}"?`)) return;
    this.api.deleteBlog(id).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(err?.error?.error || 'Xóa thất bại'),
    });
  }

  getExcerpt(b: BlogPost): string {
    return b.excerpt || (b.content ? b.content.replace(/<[^>]*>/g, '').substring(0, 80) + '...' : '');
  }
}
