import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, BlogPost } from '../../core/admin-api.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-blog-form',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './blog-form.component.html',
  styleUrl: './blog-form.component.css',
})
export class BlogFormComponent implements OnInit {
  id = signal<string | null>(null);
  loading = signal(false);
  error = signal('');
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
    }
  }

  submit(): void {
    this.error.set('');
    this.loading.set(true);
    const id = this.id();
    if (!this.model.title?.trim()) {
      this.error.set('Vui lòng nhập tiêu đề.');
      this.loading.set(false);
      return;
    }
    if (id) {
      this.api.updateBlog(id, this.model).subscribe({
        next: () => this.router.navigate(['/blogs']),
        error: (err) => {
          this.error.set(err?.error?.error || 'Cập nhật thất bại');
          this.loading.set(false);
        },
      });
    } else {
      this.api.createBlog(this.model).subscribe({
        next: () => this.router.navigate(['/blogs']),
        error: (err) => {
          this.error.set(err?.error?.error || 'Tạo thất bại');
          this.loading.set(false);
        },
      });
    }
  }
}
