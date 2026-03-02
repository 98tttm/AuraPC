import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-aura-hub',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './aura-hub.component.html',
    styleUrl: './aura-hub.component.css',
})
export class AuraHubComponent implements OnInit, OnDestroy {
    private api = inject(ApiService);
    private auth = inject(AuthService);
    private toast = inject(ToastService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    // Feed
    posts = signal<any[]>([]);
    page = signal(1);
    totalPages = signal(1);
    loading = signal(false);
    selectedTopic = signal('');
    sortMode = signal<'newest' | 'trending'>('newest');

    // Topics
    topics = signal<string[]>([]);
    trending = signal<any[]>([]);

    // Post detail mode
    detailPost = signal<any | null>(null);
    detailComments = signal<any[]>([]);
    commentSort = signal<'newest' | 'top'>('newest');
    commentText = signal('');
    replyingTo = signal<any | null>(null);
    replyText = signal('');

    // Create Post Modal
    showCreateModal = signal(false);
    newPostContent = signal('');
    newPostTopic = signal('');
    newPostImages = signal<string[]>([]);
    newPostUploading = signal(false);
    showTopicDropdown = signal(false);
    showEmojiPicker = signal(false);
    creating = signal(false);

    // Share menu
    shareMenuPostId = signal<string | null>(null);

    // User
    currentUser = this.auth.currentUser;

    readonly emojis = ['😀', '😂', '🤣', '😍', '🥰', '😎', '🤔', '👍', '❤️', '🔥', '💯', '🙌', '👏', '🎉', '😱', '💻', '🖥️', '⌨️', '🖱️', '🎮'];

    ngOnInit(): void {
        this.api.getHubTopics().subscribe(t => this.topics.set(t));
        this.api.getHubTrending(5).subscribe(t => this.trending.set(t));

        // Check if we have a postId route param
        const postId = this.route.snapshot.paramMap.get('postId');
        if (postId) {
            this.openPostDetail(postId);
        } else {
            this.loadPosts();
        }
    }

    ngOnDestroy(): void { }

    loadPosts(append = false): void {
        this.loading.set(true);
        this.api.getHubPosts({
            page: this.page(),
            limit: 10,
            topic: this.selectedTopic() || undefined,
            sort: this.sortMode(),
        }).subscribe({
            next: (res) => {
                if (append) {
                    this.posts.update(prev => [...prev, ...res.posts]);
                } else {
                    this.posts.set(res.posts);
                }
                this.totalPages.set(res.totalPages);
                this.loading.set(false);
            },
            error: () => this.loading.set(false),
        });
    }

    loadMore(): void {
        if (this.page() < this.totalPages()) {
            this.page.update(p => p + 1);
            this.loadPosts(true);
        }
    }

    filterByTopic(topic: string): void {
        this.selectedTopic.set(topic);
        this.page.set(1);
        this.loadPosts();
    }

    setSort(mode: 'newest' | 'trending'): void {
        this.sortMode.set(mode);
        this.page.set(1);
        this.loadPosts();
    }

    // ─── Create Post ───
    openCreateModal(): void {
        if (!this.currentUser()) {
            this.auth.showLoginPopup$.next();
            return;
        }
        this.showCreateModal.set(true);
    }

    closeCreateModal(): void {
        this.showCreateModal.set(false);
        this.newPostContent.set('');
        this.newPostTopic.set('');
        this.newPostImages.set([]);
        this.showTopicDropdown.set(false);
        this.showEmojiPicker.set(false);
    }

    selectTopic(topic: string): void {
        this.newPostTopic.set(topic);
        this.showTopicDropdown.set(false);
    }

    insertEmoji(emoji: string): void {
        this.newPostContent.update(c => c + emoji);
        this.showEmojiPicker.set(false);
    }

    onImageSelect(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;
        this.newPostUploading.set(true);
        this.api.uploadHubImages(Array.from(input.files)).subscribe({
            next: (res) => {
                this.newPostImages.update(imgs => [...imgs, ...res.urls]);
                this.newPostUploading.set(false);
            },
            error: () => this.newPostUploading.set(false),
        });
        input.value = '';
    }

    removeImage(index: number): void {
        this.newPostImages.update(imgs => imgs.filter((_, i) => i !== index));
    }

    submitPost(): void {
        const content = this.newPostContent().trim();
        const images = this.newPostImages();
        if (!content && !images.length) return;
        this.creating.set(true);
        this.api.createHubPost({
            content,
            images,
            topic: this.newPostTopic() || undefined,
        }).subscribe({
            next: (post) => {
                this.posts.update(prev => [post, ...prev]);
                this.closeCreateModal();
                this.creating.set(false);
            },
            error: () => this.creating.set(false),
        });
    }

    // ─── Like ───
    toggleLike(post: any): void {
        if (!this.currentUser()) { this.auth.showLoginPopup$.next(); return; }
        this.api.toggleHubLike(post._id).subscribe({
            next: (res) => {
                post.liked = res.liked;
                post.likeCount = res.likeCount;
                if (res.liked) {
                    if (!post.likes) post.likes = [];
                    post.likes.push(this.currentUser()?._id);
                } else {
                    post.likes = (post.likes || []).filter((id: string) => id !== this.currentUser()?._id);
                }
            },
        });
    }

    isLiked(post: any): boolean {
        const uid = this.currentUser()?._id;
        if (!uid || !post.likes) return false;
        return post.likes.includes(uid);
    }

    // ─── Repost ───
    repost(post: any): void {
        if (!this.currentUser()) { this.auth.showLoginPopup$.next(); return; }
        this.api.repostHub(post._id).subscribe({
            next: (repost) => {
                post.repostCount = (post.repostCount || 0) + 1;
                this.posts.update(prev => [repost, ...prev]);
            },
            error: (err) => {
                const msg = err?.error?.message || 'Không thể repost';
                this.toast.showInfo(msg);
            },
        });
    }

    // ─── Share ───
    toggleShareMenu(postId: string): void {
        this.shareMenuPostId.update(cur => cur === postId ? null : postId);
    }

    sharePost(postId: string, method: string): void {
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/aura-hub/${postId}`;
        if (method === 'copy_link') {
            navigator.clipboard.writeText(link).then(() => {
                this.toast.showInfo('Đã copy link!');
            });
        }
        if (this.currentUser()) {
            this.api.shareHub(postId, method).subscribe();
        }
        this.shareMenuPostId.set(null);
    }

    // ─── Post Detail ───
    openPostDetail(postId: string): void {
        this.api.getHubPost(postId).subscribe({
            next: (post) => {
                this.detailPost.set(post);
                this.loadComments(postId);
                this.router.navigate(['/aura-hub', postId], { replaceUrl: true });
            },
        });
    }

    closePostDetail(): void {
        this.detailPost.set(null);
        this.detailComments.set([]);
        this.commentText.set('');
        this.replyingTo.set(null);
        this.replyText.set('');
        this.router.navigate(['/aura-hub'], { replaceUrl: true });
    }

    loadComments(postId: string): void {
        this.api.getHubComments(postId, this.commentSort()).subscribe({
            next: (comments) => this.detailComments.set(comments),
        });
    }

    submitComment(): void {
        const post = this.detailPost();
        if (!post || !this.currentUser()) { this.auth.showLoginPopup$.next(); return; }
        const content = this.commentText().trim();
        if (!content) return;
        this.api.createHubComment(post._id, { content }).subscribe({
            next: (comment) => {
                this.detailComments.update(prev => [comment, ...prev]);
                this.commentText.set('');
                post.commentCount = (post.commentCount || 0) + 1;
            },
        });
    }

    startReply(comment: any): void {
        this.replyingTo.set(comment);
        this.replyText.set('');
    }

    cancelReply(): void {
        this.replyingTo.set(null);
        this.replyText.set('');
    }

    submitReply(): void {
        const post = this.detailPost();
        const parent = this.replyingTo();
        if (!post || !parent || !this.currentUser()) return;
        const content = this.replyText().trim();
        if (!content) return;
        this.api.createHubComment(post._id, { content, parentComment: parent._id }).subscribe({
            next: (reply) => {
                if (!parent.replies) parent.replies = [];
                parent.replies.push(reply);
                parent.replyCount = (parent.replyCount || 0) + 1;
                post.commentCount = (post.commentCount || 0) + 1;
                this.cancelReply();
            },
        });
    }

    toggleCommentLike(comment: any): void {
        if (!this.currentUser()) { this.auth.showLoginPopup$.next(); return; }
        this.api.toggleHubCommentLike(comment._id).subscribe({
            next: (res) => {
                comment.likeCount = res.likeCount;
                if (res.liked) {
                    if (!comment.likes) comment.likes = [];
                    comment.likes.push(this.currentUser()?._id);
                } else {
                    comment.likes = (comment.likes || []).filter((id: string) => id !== this.currentUser()?._id);
                }
            },
        });
    }

    deletePost(post: any): void {
        if (!confirm('Bạn có chắc muốn xóa bài đăng này?')) return;
        this.api.deleteHubPost(post._id).subscribe({
            next: () => {
                this.posts.update(prev => prev.filter(p => p._id !== post._id));
                if (this.detailPost()?._id === post._id) this.closePostDetail();
            },
        });
    }

    deleteComment(comment: any): void {
        if (!confirm('Xóa bình luận này?')) return;
        this.api.deleteHubComment(comment._id).subscribe({
            next: () => {
                this.detailComments.update(prev => prev.filter(c => c._id !== comment._id));
                const post = this.detailPost();
                if (post) post.commentCount = Math.max(0, (post.commentCount || 0) - 1);
            },
        });
    }

    // ─── Helpers ───
    getAvatarUrl(user: any): string {
        if (!user?.avatar) return 'assets/AVT/avtdefaut.png';
        if (user.avatar.startsWith('http')) return user.avatar;
        const base = environment.apiUrl.replace(/\/api$/, '');
        return `${base}${user.avatar}`;
    }

    getImageUrl(url: string): string {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        const base = environment.apiUrl.replace(/\/api$/, '');
        return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    getDisplayName(user: any): string {
        if (!user) return 'Ẩn danh';
        if (user.profile?.fullName) return user.profile.fullName;
        if (user.username) return user.username;
        if (user.phoneNumber) {
            const d = user.phoneNumber.replace(/\D/g, '');
            if (d.length === 11 && d.startsWith('84')) return '0' + d.slice(2);
            return user.phoneNumber;
        }
        return 'Ẩn danh';
    }

    timeAgo(date: string): string {
        const now = Date.now();
        const d = new Date(date).getTime();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return `${diff}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
        return new Date(date).toLocaleDateString('vi-VN');
    }

    isOwner(post: any): boolean {
        return this.currentUser()?._id === post?.author?._id;
    }

    trackByPostId(index: number, post: any): string {
        return post._id;
    }

    trackByCommentId(index: number, comment: any): string {
        return comment._id;
    }
}
