import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService, HubPost, HubPostsListResponse } from '../../core/admin-api.service';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-hub-moderation',
  imports: [CommonModule, FormsModule],
  templateUrl: './hub-moderation.component.html',
  styleUrls: ['./hub-moderation.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubModerationComponent implements OnInit {
  readonly statusTabs = [
    { value: 'all', label: 'Tất cả' },
    { value: 'pending', label: 'Chờ duyệt' },
    { value: 'approved', label: 'Đã duyệt' },
    { value: 'rejected', label: 'Từ chối' },
  ] as const;

  loading = signal(false);
  items = signal<HubPost[]>([]);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);
  // Mặc định xem tất cả bài, không chỉ chờ duyệt
  status = signal<string>('all');
  search = signal<string>('');
  topic = signal<string>('');
  sort = signal<'newest' | 'trending'>('newest');

  detailOpen = signal(false);
  selectedPost = signal<HubPost | null>(null);
  rejectReason = signal<string>('');
  actionLoading = signal(false);

  constructor(private adminApi: AdminApiService) {}

  ngOnInit(): void {
    this.fetchPosts(true);
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    this.fetchPosts(true);
  }

  onSortChange(value: 'newest' | 'trending'): void {
    this.sort.set(value);
    this.fetchPosts(true);
  }

  onRejectReasonChange(value: string): void {
    this.rejectReason.set(value);
  }

  fetchPosts(resetPage = false): void {
    if (resetPage) {
      this.page.set(1);
    }
    this.loading.set(true);
    this.adminApi
      .getHubPosts({
        page: this.page(),
        limit: 20,
        status: this.status(),
        topic: this.topic() || undefined,
        search: this.search() || undefined,
        sort: this.sort(),
      })
      .subscribe({
        next: (res: HubPostsListResponse) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.totalPages.set(res.totalPages || 1);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  changeStatusTab(value: string): void {
    this.status.set(value);
    this.fetchPosts(true);
  }

  changePage(delta: number): void {
    const next = this.page() + delta;
    if (next < 1 || next > this.totalPages()) return;
    this.page.set(next);
    this.fetchPosts(false);
  }

  openDetail(post: HubPost): void {
    this.selectedPost.set(post);
    this.rejectReason.set(post.rejectedReason || '');
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.selectedPost.set(null);
    this.rejectReason.set('');
  }

  statusLabel(p: HubPost): string {
    const status = p.status;
    const isApproved = status === 'approved' || (!status && p.isPublished);
    if (isApproved) return 'Đã duyệt';
    if (status === 'rejected') return 'Từ chối';
    return 'Chờ duyệt';
  }

  statusBadgeClass(p: HubPost): string {
    const status = p.status;
    const isApproved = status === 'approved' || (!status && p.isPublished);
    if (isApproved) return 'hub-table__status hub-table__status--approved';
    if (status === 'rejected') return 'hub-table__status hub-table__status--rejected';
    return 'hub-table__status hub-table__status--pending';
  }

  shortContent(p: HubPost): string {
    const text = (p.content || '').trim();
    if (!text) return '(Không có nội dung)';
    if (text.length <= 120) return text;
    return text.slice(0, 120) + '…';
  }

  authorName(p: HubPost): string {
    return p.author?.profile?.fullName || p.author?.username || p.author?.phoneNumber || 'Ẩn danh';
  }

  approveSelected(forcePublishNow = false): void {
    const current = this.selectedPost();
    if (!current || !current._id) return;
    this.actionLoading.set(true);
    this.adminApi.approveHubPost(current._id, forcePublishNow).subscribe({
      next: (res) => {
        this.replaceItem(res);
        this.selectedPost.set(res);
        this.actionLoading.set(false);
      },
      error: () => {
        this.actionLoading.set(false);
      },
    });
  }

  rejectSelected(): void {
    const current = this.selectedPost();
    if (!current || !current._id) return;
    const reason = this.rejectReason().trim();
    if (!reason) return;
    this.actionLoading.set(true);
    this.adminApi.rejectHubPost(current._id, reason).subscribe({
      next: (res) => {
        this.replaceItem(res);
        this.selectedPost.set(res);
        this.actionLoading.set(false);
      },
      error: () => {
        this.actionLoading.set(false);
      },
    });
  }

  deleteSelected(): void {
    const current = this.selectedPost();
    if (!current || !current._id) return;
    if (!confirm('Bạn chắc chắn muốn xóa bài AuraHub này?')) return;
    this.actionLoading.set(true);
    this.adminApi.deleteHubPost(current._id).subscribe({
      next: () => {
        this.items.set(this.items().filter((p) => p._id !== current._id));
        this.closeDetail();
        this.actionLoading.set(false);
      },
      error: () => {
        this.actionLoading.set(false);
      },
    });
  }

  private replaceItem(updated: HubPost): void {
    const list = this.items();
    const idx = list.findIndex((p) => p._id === updated._id);
    if (idx !== -1) {
      const clone = [...list];
      clone[idx] = updated;
      this.items.set(clone);
    }
  }
}

