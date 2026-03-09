import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, Category } from '../../core/admin-api.service';
import { FormsModule } from '@angular/forms';
import { generateSlug } from '../../core/constants';

type CategoryOption = {
  value: string | number;
  label: string;
  level: number;
};

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.css',
})
export class CategoryFormComponent implements OnInit {
  id = signal<string | null>(null);
  categories = signal<Category[]>([]);
  loading = signal(false);
  error = signal('');
  model: Partial<Category> = { name: '', slug: '', display_order: 0, is_active: true, parent_id: null };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: AdminApiService,
  ) {}

  ngOnInit(): void {
    this.api.getCategories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => {},
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.id.set(id);
      this.api.getCategory(id).subscribe({
        next: (category) => {
          this.model = {
            name: category.name,
            slug: category.slug,
            parent_id: category.parent_id ?? null,
            display_order: category.display_order,
            is_active: category.is_active !== false,
          };
        },
        error: () => this.error.set('Không tìm thấy danh mục'),
      });
    }
  }

  onNameChange(): void {
    if (!this.id() && this.model.name) {
      this.model.slug = generateSlug(this.model.name);
    }
  }

  parentOptions(): CategoryOption[] {
    const currentId = this.id();
    return [...this.categories()]
      .filter((category) => !currentId || !this.sameRef(category._id, currentId))
      .sort((a, b) => {
        const levelA = Number(a.level ?? 0);
        const levelB = Number(b.level ?? 0);
        if (levelA !== levelB) return levelA - levelB;

        const orderA = Number(a.display_order ?? Number.MAX_SAFE_INTEGER);
        const orderB = Number(b.display_order ?? Number.MAX_SAFE_INTEGER);
        if (orderA !== orderB) return orderA - orderB;

        return a.name.localeCompare(b.name, 'vi');
      })
      .map((category) => ({
        value: (category._id ?? category.category_id ?? category.slug) as string | number,
        label: `${'— '.repeat(Math.max(0, Number(category.level ?? 0)))}${category.name}`,
        level: Math.max(0, Number(category.level ?? 0)),
      }));
  }

  selectedParentName(): string {
    if (this.model.parent_id == null || this.model.parent_id === '') return 'Danh mục gốc';
    const found = this.findCategoryByRef(this.model.parent_id);
    return found?.name || String(this.model.parent_id);
  }

  previewLevel(): number {
    if (this.model.parent_id == null || this.model.parent_id === '') return 0;
    const parent = this.findCategoryByRef(this.model.parent_id);
    const baseLevel = Number(parent?.level ?? 0);
    return Number.isFinite(baseLevel) ? baseLevel + 1 : 1;
  }

  previewPath(): string {
    const name = this.model.name?.trim() || 'Danh mục mới';
    if (this.model.parent_id == null || this.model.parent_id === '') return name;
    return `${this.selectedParentName()} / ${name}`;
  }

  statusLabel(): string {
    return this.model.is_active === false ? 'Đang ẩn' : 'Đang hiển thị';
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

    const body: Partial<Category> = {
      ...this.model,
      parent_id: this.model.parent_id ?? null,
      level: this.previewLevel(),
    };

    if (id) {
      this.api.updateCategory(id, body).subscribe({
        next: () => this.router.navigate(['/categories']),
        error: (err) => {
          this.error.set(err?.error?.error || 'Cập nhật thất bại');
          this.loading.set(false);
        },
      });
    } else {
      this.api.createCategory(body).subscribe({
        next: () => this.router.navigate(['/categories']),
        error: (err) => {
          this.error.set(err?.error?.error || 'Tạo thất bại');
          this.loading.set(false);
        },
      });
    }
  }

  private sameRef(a: unknown, b: unknown): boolean {
    if (a == null || b == null) return false;
    return String(a) === String(b);
  }

  private findCategoryByRef(ref: unknown): Category | undefined {
    return this.categories().find((category) =>
      this.sameRef(category._id, ref)
      || this.sameRef(category.category_id, ref)
      || this.sameRef(category.slug, ref)
    );
  }
}
