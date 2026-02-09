# Cấu trúc dữ liệu chặt chẽ (Schema 1.0)

File **`structured-categories-and-products.json`** được tạo bởi `server/scripts/build-strict-category-report.js` với cấu trúc cố định dưới đây.

## 1. Root

```ts
{
  meta: Meta;
  categoriesTree: CategoryNode[];
  categoriesFlat: CategoryFlatItem[];
  unassignedProducts: UnassignedProduct[];
}
```

## 2. Meta

```ts
interface Meta {
  generatedAt: string;   // ISO 8601
  schemaVersion: string; // "1.0"
  summary: {
    totalCategories: number;
    totalRoots: number;
    totalProducts: number;
    productsAssigned: number;
    productsUnassigned: number;
  };
}
```

## 3. CategoryNode (cây)

- Mỗi node có đúng các field sau, không thừa.
- `id` là chuỗi (string), dùng làm khóa duy nhất.
- `parent_id` là `null` (gốc) hoặc `id` của node cha có trong cây.
- Con được sắp theo `display_order`, rồi `name`.

```ts
interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  level: number;
  display_order: number;
  parent_id: string | null;
  is_active: boolean;
  product_count: number;
  products: ProductInCategory[];
  children: CategoryNode[];
}

interface ProductInCategory {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
}
```

## 4. CategoryFlatItem (danh sách phẳng)

Dùng để tra cứu nhanh theo `id` hoặc `slug`, vẫn đúng thứ tự cây (depth-first).

```ts
interface CategoryFlatItem {
  id: string;
  name: string;
  slug: string;
  level: number;
  display_order: number;
  parent_id: string | null;
  product_count: number;
}
```

## 5. UnassignedProduct

Sản phẩm không có `category_ref` hoặc `category_ref` không trùng bất kỳ `id` danh mục nào.

```ts
interface UnassignedProduct {
  id: string;
  name: string;
  slug: string;
  category_ref: string | null;
}
```

## 6. Quy tắc xử lý

| Nội dung | Quy tắc |
|----------|--------|
| **Category** | Chỉ lấy document có `_id` hợp lệ; `id` luôn là string; `parent_id` chỉ trỏ tới `id` có trong tập danh mục, nếu không thì coi là gốc. |
| **Sắp xếp** | Gốc và từng nhánh con: sort theo `display_order` (số), rồi `name` (chuỗi). |
| **Product → Category** | Chỉ gán khi `product.category` hoặc `product.category_id` hoặc `product.categoryId` (chuỗi hóa) bằng đúng `id` của một danh mục trong cây. |
| **Sản phẩm chưa gán** | Đưa vào `unassignedProducts`, không đưa vào bất kỳ node nào của `categoriesTree`. |

## 7. Một lệnh chạy

```bash
cd server
node scripts/build-strict-category-report.js
```

Sau khi chạy: `docs/data/structured-categories-and-products.json`, `docs/BAO_CAO_DANH_MUC.md`, `docs/BAO_CAO_SAN_PHAM_THEO_DANH_MUC.md` được cập nhật theo schema trên.
