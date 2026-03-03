import { Component, OnInit, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService, BlogPost } from '../../core/admin-api.service';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';

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
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  items = signal<BlogPost[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');
  searchQuery = '';
  page = 1;
  limit = 20;
  publishedFilter: 'all' | 'published' | 'draft' = 'all';

  // Stats from total
  totalPosts = computed(() => this.total());
  publishedPosts = computed(() => this.items().filter(b => b.published).length);
  draftPosts = computed(() => this.items().filter(b => !b.published).length);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getBlogs(this.page, this.limit).subscribe({
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
    let list = this.items();
    if (this.publishedFilter === 'published') list = list.filter(b => b.published);
    if (this.publishedFilter === 'draft') list = list.filter(b => !b.published);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(b => b.title.toLowerCase().includes(q));
    }
    return list;
  }

  setPublishedFilter(filter: 'all' | 'published' | 'draft'): void {
    this.publishedFilter = filter;
  }

  goToPage(p: number): void {
    this.page = p;
    this.load();
  }

  get totalPages(): number {
    return Math.ceil(this.total() / this.limit);
  }

  async delete(id: string, title: string): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'Xóa bài viết',
      message: `Bạn có chắc muốn xóa bài viết "${title}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa',
      danger: true,
    });
    if (!confirmed) return;
    this.api.deleteBlog(id).subscribe({
      next: () => {
        this.toast.success('Đã xóa bài viết');
        this.load();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Xóa thất bại'),
    });
  }

  getExcerpt(b: BlogPost): string {
    return b.excerpt || (b.content ? b.content.replace(/<[^>]*>/g, '').substring(0, 80) + '...' : '');
  }
}
