import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, BlogPost } from '../../core/admin-api.service';
import { AdminAuthService } from '../../core/auth/admin-auth.service';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/toast.service';
import { generateSlug } from '../../core/constants';

@Component({
  selector: 'app-blog-form',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './blog-form.component.html',
  styleUrl: './blog-form.component.css',
})
export class BlogFormComponent implements OnInit {
  private auth = inject(AdminAuthService);
  private toast = inject(ToastService);

  id = signal<string | null>(null);
  loading = signal(false);
  error = signal('');
  touched = signal(false);
  showPreview = signal(false);
  model: Partial<BlogPost> = {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    coverImage: '',
    author: '',
    published: false,
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: AdminApiService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.id.set(id);
      this.api.getBlog(id).subscribe({
        next: (b) => {
          this.model = {
            title: b.title,
            slug: b.slug,
            excerpt: b.excerpt,
            content: b.content,
            coverImage: b.coverImage,
            author: b.author,
            published: b.published || false,
          };
        },
        error: () => this.error.set('Không tìm thấy bài viết'),
      });
    } else {
      // Auto-fill author from current admin
      const admin = this.auth.currentAdmin();
      if (admin?.name) {
        this.model.author = admin.name;
      }
    }
  }

  onTitleChange(): void {
    if (!this.id() && this.model.title) {
      this.model.slug = generateSlug(this.model.title);
    }
  }

  togglePreview(): void {
    this.showPreview.update(v => !v);
  }

  get titleError(): string {
    if (!this.touched()) return '';
    if (!this.model.title?.trim()) return 'Vui lòng nhập tiêu đề';
    return '';
  }

  submit(): void {
    this.touched.set(true);
    this.error.set('');
    if (this.titleError) return;

    this.loading.set(true);
    const id = this.id();
    if (id) {
      this.api.updateBlog(id, this.model).subscribe({
        next: () => {
          this.toast.success('Cập nhật bài viết thành công');
          this.router.navigate(['/blogs']);
        },
        error: (err) => {
          this.error.set(err?.error?.error || 'Cập nhật thất bại');
          this.loading.set(false);
        },
      });
    } else {
      this.api.createBlog(this.model).subscribe({
        next: () => {
          this.toast.success('Tạo bài viết thành công');
          this.router.navigate(['/blogs']);
        },
        error: (err) => {
          this.error.set(err?.error?.error || 'Tạo thất bại');
          this.loading.set(false);
        },
      });
    }
  }
}
