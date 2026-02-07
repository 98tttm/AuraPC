import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, Category } from '../../core/admin-api.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.css',
})
export class CategoryFormComponent implements OnInit {
  id = signal<string | null>(null);
  loading = signal(false);
  error = signal('');
  model: Partial<Category> = { name: '', slug: '', order: 0, active: true };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: AdminApiService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.id.set(id);
      this.api.getCategory(id).subscribe({
        next: (c) => {
          this.model = { name: c.name, slug: c.slug, parent: c.parent, order: c.order, active: c.active !== false };
        },
        error: () => this.error.set('Không tìm thấy danh mục'),
      });
    }
  }

  submit(): void {
    this.error.set('');
    this.loading.set(true);
    const id = this.id();
    if (!this.model.name?.trim()) {
      this.error.set('Vui lòng nhập tên danh mục.');
      this.loading.set(false);
      return;
    }
    if (id) {
      this.api.updateCategory(id, this.model).subscribe({
        next: () => this.router.navigate(['/categories']),
        error: (err) => {
          this.error.set(err?.error?.error || 'Cập nhật thất bại');
          this.loading.set(false);
        },
      });
    } else {
      this.api.createCategory(this.model).subscribe({
        next: () => this.router.navigate(['/categories']),
        error: (err) => {
          this.error.set(err?.error?.error || 'Tạo thất bại');
          this.loading.set(false);
        },
      });
    }
  }
}
