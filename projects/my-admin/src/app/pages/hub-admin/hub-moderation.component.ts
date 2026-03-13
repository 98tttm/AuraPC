import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService, HubPost, HubPostsListResponse, HubComment } from '../../core/admin-api.service';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../core/toast.service';

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
    { value: 'pending', label: 'Chờ duyệt' },
    { value: 'approved', label: 'Đã duyệt' },
    { value: 'rejected', label: 'Từ chối' },
    { value: 'all', label: 'Tất cả' },
  ] as const;

  loading = signal(false);
  items = signal<HubPost[]>([]);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);
  pendingCount = signal(0);
  status = signal<string>('pending');
  search = signal<string>('');
  topic = signal<string>('');
  sort = signal<'newest' | 'trending'>('newest');

  detailOpen = signal(false);
  selectedPost = signal<HubPost | null>(null);
  rejectReason = signal<string>('');
  actionLoading = signal(false);

  // Comments
  comments = signal<HubComment[]>([]);
  commentsLoading = signal(false);

  // Image preview lightbox
  previewImages = signal<string[]>([]);
  previewIndex = signal(0);

  constructor(
    private adminApi: AdminApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.fetchPosts(true);
    this.fetchPendingCount();
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

  fetchPendingCount(): void {
    this.adminApi
      .getHubPosts({ page: 1, limit: 1, status: 'pending' })
      .subscribe({
        next: (res: HubPostsListResponse) => {
          this.pendingCount.set(res.total);
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
    this.comments.set([]);
    this.fetchComments(post._id!);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.selectedPost.set(null);
    this.rejectReason.set('');
    this.comments.set([]);
  }

  fetchComments(postId: string): void {
    this.commentsLoading.set(true);
    this.adminApi.getHubPostComments(postId).subscribe({
      next: (res) => {
        this.comments.set(res);
        this.commentsLoading.set(false);
      },
      error: () => {
        this.commentsLoading.set(false);
      },
    });
  }

  deleteComment(commentId: string): void {
    if (!confirm('Xóa bình luận này?')) return;
    this.adminApi.deleteHubComment(commentId).subscribe({
      next: () => {
        // Remove from local state
        const updated = this.comments().filter((c) => {
          if (c._id === commentId) return false;
          if (c.replies) {
            c.replies = c.replies.filter((r) => r._id !== commentId);
          }
          return true;
        });
        this.comments.set(updated);
        this.toast.show('Đã xóa bình luận', 'success');
        // Refresh post to update commentCount
        const post = this.selectedPost();
        if (post?._id) {
          this.adminApi.getHubPostDetail(post._id).subscribe({
            next: (res) => {
              this.selectedPost.set(res);
              this.replaceItem(res);
            },
          });
        }
      },
      error: () => {
        this.toast.show('Không thể xóa bình luận', 'error');
      },
    });
  }

  commentAuthorName(c: HubComment): string {
    return c.author?.profile?.fullName || c.author?.username || c.author?.phoneNumber || 'Ẩn danh';
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
    if (isApproved) return 'hub-status hub-status--approved';
    if (status === 'rejected') return 'hub-status hub-status--rejected';
    return 'hub-status hub-status--pending';
  }

  authorName(p: HubPost): string {
    return p.author?.profile?.fullName || p.author?.username || p.author?.phoneNumber || 'Ẩn danh';
  }

  getImageUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = environment.apiUrl.replace(/\/api$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // Approve directly from the card list
  approvePost(post: HubPost, forcePublishNow = false): void {
    if (!post._id) return;
    this.actionLoading.set(true);
    this.adminApi.approveHubPost(post._id, forcePublishNow).subscribe({
      next: (res) => {
        this.replaceItem(res);
        this.actionLoading.set(false);
        this.toast.show('Đã duyệt bài đăng thành công', 'success');
        this.fetchPendingCount();
      },
      error: () => {
        this.actionLoading.set(false);
        this.toast.show('Không thể duyệt bài đăng', 'error');
      },
    });
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
        this.toast.show('Đã duyệt bài đăng thành công', 'success');
        this.fetchPendingCount();
      },
      error: () => {
        this.actionLoading.set(false);
        this.toast.show('Không thể duyệt bài đăng', 'error');
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
        this.toast.show('Đã từ chối bài đăng', 'success');
        this.fetchPendingCount();
      },
      error: () => {
        this.actionLoading.set(false);
        this.toast.show('Không thể từ chối bài đăng', 'error');
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
        this.toast.show('Đã xóa bài đăng', 'success');
        this.fetchPendingCount();
      },
      error: () => {
        this.actionLoading.set(false);
        this.toast.show('Không thể xóa bài đăng', 'error');
      },
    });
  }

  // Image preview
  openImagePreview(images: string[], index: number): void {
    this.previewImages.set(images);
    this.previewIndex.set(index);
  }

  closeImagePreview(): void {
    this.previewImages.set([]);
    this.previewIndex.set(0);
  }

  prevImage(): void {
    const idx = this.previewIndex();
    if (idx > 0) this.previewIndex.set(idx - 1);
    else this.previewIndex.set(this.previewImages().length - 1);
  }

  nextImage(): void {
    const idx = this.previewIndex();
    if (idx < this.previewImages().length - 1) this.previewIndex.set(idx + 1);
    else this.previewIndex.set(0);
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
