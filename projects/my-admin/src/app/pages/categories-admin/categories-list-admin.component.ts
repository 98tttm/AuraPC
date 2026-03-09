import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService, Category } from '../../core/admin-api.service';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';

type CategoryFilter = 'all' | 'active' | 'hidden' | 'mismatch';

type CategoryNode = Category & {
  key: string;
  parentRef: string | null;
  parentNode: CategoryNode | null;
  children: CategoryNode[];
  effectiveLevel: number;
  levelMismatch: boolean;
  pathNames: string[];
};

type CategoryRow = {
  node: CategoryNode;
  hasChildren: boolean;
  expanded: boolean;
  isContext: boolean;
};

@Component({
  selector: 'app-categories-list-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './categories-list-admin.component.html',
  styleUrl: './categories-list-admin.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesListAdminComponent implements OnInit {
  private api = inject(AdminApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  categories = signal<Category[]>([]);
  treeRoots = signal<CategoryNode[]>([]);
  allNodes = signal<CategoryNode[]>([]);
  expandedState = signal<Record<string, boolean>>({});
  loading = signal(true);
  error = signal('');
  searchQuery = '';
  filter = signal<CategoryFilter>('all');

  readonly filterOptions: Array<{ value: CategoryFilter; label: string }> = [
    { value: 'all', label: 'Tất cả' },
    { value: 'active', label: 'Đang hiển thị' },
    { value: 'hidden', label: 'Đang ẩn' },
    { value: 'mismatch', label: 'Lệch cấp độ' },
  ];

  readonly stats = computed(() => {
    const nodes = this.allNodes();
    return {
      total: nodes.length,
      roots: nodes.filter((node) => node.effectiveLevel === 0).length,
      hidden: nodes.filter((node) => node.is_active === false).length,
      mismatch: nodes.filter((node) => node.levelMismatch).length,
    };
  });

  readonly matchedCount = computed(() => {
    const query = this.normalizeText(this.searchQuery);
    const filter = this.filter();
    return this.allNodes().filter((node) => this.matchesFilter(node, filter) && this.matchesQuery(node, query)).length;
  });

  readonly visibleRows = computed(() => {
    const query = this.normalizeText(this.searchQuery);
    const filter = this.filter();
    const expandedState = this.expandedState();

    return this.treeRoots().flatMap((root) => this.collectRows(root, query, filter, expandedState));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getCategories().subscribe({
      next: (list) => {
        this.categories.set(list);
        const { roots, nodes, expandedState } = this.buildTree(list);
        this.treeRoots.set(roots);
        this.allNodes.set(nodes);
        this.expandedState.set(expandedState);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Lỗi tải danh sách');
        this.loading.set(false);
      },
    });
  }

  setFilter(value: CategoryFilter): void {
    this.filter.set(value);
  }

  toggleExpand(nodeKey: string): void {
    this.expandedState.update((state) => ({
      ...state,
      [nodeKey]: !(state[nodeKey] ?? false),
    }));
  }

  expandAll(): void {
    const nextState: Record<string, boolean> = {};
    this.allNodes().forEach((node) => {
      if (node.children.length > 0) nextState[node.key] = true;
    });
    this.expandedState.set(nextState);
  }

  collapseAll(): void {
    const nextState: Record<string, boolean> = {};
    this.allNodes().forEach((node) => {
      if (node.children.length > 0) nextState[node.key] = false;
    });
    this.expandedState.set(nextState);
  }

  async delete(node: CategoryNode): Promise<void> {
    const id = this.routeId(node);
    if (!id) {
      this.toast.error('Không xác định được ID danh mục');
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: 'Xóa danh mục',
      message: `Bạn có chắc muốn xóa danh mục "${node.name}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa',
      danger: true,
    });
    if (!confirmed) return;

    this.api.deleteCategory(id).subscribe({
      next: () => {
        this.toast.success('Đã xóa danh mục');
        this.load();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Xóa thất bại'),
    });
  }

  routeId(node: CategoryNode): string {
    const value = node._id ?? node.category_id ?? node.slug ?? '';
    return String(value);
  }

  levelLabel(node: CategoryNode): string {
    return node.effectiveLevel === 0 ? 'Gốc' : `Cấp ${node.effectiveLevel}`;
  }

  storedLevel(node: CategoryNode): number {
    return this.normalizeLevel(node.level);
  }

  orderLabel(node: CategoryNode): string {
    const order = this.normalizeNullableNumber(node.display_order);
    return order == null ? '—' : String(order);
  }

  productCountLabel(node: CategoryNode): string {
    const count = this.normalizeNullableNumber(node.product_count) ?? 0;
    return String(count);
  }

  statusLabel(node: CategoryNode): string {
    return node.is_active === false ? 'Ẩn' : 'Hiển thị';
  }

  parentTrail(node: CategoryNode): string {
    return node.pathNames.length > 1 ? node.pathNames.slice(0, -1).join(' / ') : 'Danh mục gốc';
  }

  secondaryMeta(node: CategoryNode): string {
    if (node.category_id) return `Ref ${node.category_id}`;
    if (node._id != null) return `ID ${node._id}`;
    return 'Chưa có mã tham chiếu';
  }

  childCount(node: CategoryNode): number {
    return node.children.length;
  }

  filterCount(value: CategoryFilter): number {
    if (value === 'all') return this.stats().total;
    if (value === 'active') return this.allNodes().filter((node) => node.is_active !== false).length;
    if (value === 'hidden') return this.stats().hidden;
    return this.stats().mismatch;
  }

  private buildTree(categories: Category[]): {
    roots: CategoryNode[];
    nodes: CategoryNode[];
    expandedState: Record<string, boolean>;
  } {
    const nodes = categories.map<CategoryNode>((category, index) => ({
      ...category,
      key: this.primaryKey(category, index),
      parentRef: this.normalizeRef(category.parent_id),
      parentNode: null,
      children: [],
      effectiveLevel: 0,
      levelMismatch: false,
      pathNames: [category.name],
    }));

    const aliases = new Map<string, CategoryNode>();
    nodes.forEach((node) => {
      this.aliasesFor(node).forEach((alias) => {
        if (!aliases.has(alias)) aliases.set(alias, node);
      });
    });

    const roots: CategoryNode[] = [];
    nodes.forEach((node) => {
      const parent = node.parentRef ? aliases.get(node.parentRef) ?? null : null;
      if (parent && parent !== node) {
        node.parentNode = parent;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (a: CategoryNode, b: CategoryNode): number => {
      const orderA = this.normalizeNullableNumber(a.display_order);
      const orderB = this.normalizeNullableNumber(b.display_order);
      if (orderA != null && orderB != null && orderA !== orderB) return orderA - orderB;
      if (orderA != null && orderB == null) return -1;
      if (orderA == null && orderB != null) return 1;
      return a.name.localeCompare(b.name, 'vi');
    };

    const sortTree = (branch: CategoryNode[]): void => {
      branch.sort(sortNodes);
      branch.forEach((node) => sortTree(node.children));
    };

    sortTree(roots);

    const visited = new Set<string>();
    const annotate = (node: CategoryNode, level: number, pathNames: string[]): void => {
      if (visited.has(node.key)) return;
      visited.add(node.key);
      node.effectiveLevel = level;
      node.pathNames = pathNames;
      node.levelMismatch = this.normalizeLevel(node.level) !== level;
      node.children.forEach((child) => annotate(child, level + 1, [...pathNames, child.name]));
    };

    roots.forEach((root) => annotate(root, 0, [root.name]));

    const floatingNodes = nodes.filter((node) => !visited.has(node.key)).sort(sortNodes);
    floatingNodes.forEach((node) => {
      roots.push(node);
      annotate(node, 0, [node.name]);
    });

    sortTree(roots);

    const expandedState: Record<string, boolean> = {};
    nodes.forEach((node) => {
      if (node.children.length > 0) expandedState[node.key] = node.effectiveLevel < 2;
    });

    return { roots, nodes, expandedState };
  }

  private collectRows(
    node: CategoryNode,
    query: string,
    filter: CategoryFilter,
    expandedState: Record<string, boolean>
  ): CategoryRow[] {
    const childRows = node.children.flatMap((child) => this.collectRows(child, query, filter, expandedState));
    const directMatch = (filter === 'all' && !query) || (this.matchesFilter(node, filter) && this.matchesQuery(node, query));
    const includeForContext = childRows.length > 0;
    const includeSelf = directMatch || includeForContext;

    if (!includeSelf) return [];

    const expanded = query.length > 0 || filter !== 'all' || (expandedState[node.key] ?? false);
    const row: CategoryRow = {
      node,
      hasChildren: node.children.length > 0,
      expanded,
      isContext: !directMatch && includeForContext,
    };

    return expanded ? [row, ...childRows] : [row];
  }

  private matchesFilter(node: CategoryNode, filter: CategoryFilter): boolean {
    switch (filter) {
      case 'active':
        return node.is_active !== false;
      case 'hidden':
        return node.is_active === false;
      case 'mismatch':
        return node.levelMismatch;
      case 'all':
      default:
        return true;
    }
  }

  private matchesQuery(node: CategoryNode, query: string): boolean {
    if (!query) return true;
    const haystack = [
      node.name,
      node.slug,
      node.category_id,
      node._id != null ? String(node._id) : '',
      this.parentTrail(node),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  }

  private primaryKey(category: Category, index: number): string {
    const preferred = category._id ?? category.category_id ?? category.slug;
    return preferred != null && preferred !== '' ? String(preferred) : `category-${index}`;
  }

  private aliasesFor(category: Category): string[] {
    return [category._id, category.category_id, category.slug]
      .map((value) => this.normalizeRef(value))
      .filter((value): value is string => !!value);
  }

  private normalizeRef(value: unknown): string | null {
    if (value == null) return null;
    const text = String(value).trim();
    return text ? text : null;
  }

  private normalizeText(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeLevel(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
  }

  private normalizeNullableNumber(value: unknown): number | null {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
}
