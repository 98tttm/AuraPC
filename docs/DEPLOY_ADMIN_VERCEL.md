# Deploy my-admin lên Vercel

Hướng dẫn deploy Admin Panel (my-admin) lên Vercel như một project riêng.

## Cách 1: Tạo project mới trên Vercel Dashboard (khuyến nghị)

1. Đăng nhập [Vercel](https://vercel.com) và vào **Add New** → **Project**.

2. **Import** repository GitHub `98tttm/AuraPC` (hoặc repo của bạn).

3. Cấu hình project:
   - **Project Name**: `aurapc-admin` (hoặc tên bạn chọn)
   - **Framework Preset**: Other
   - **Root Directory**: để trống (repo root)
   - **Build Command**: `npm run build -- my-admin --configuration=production`
   - **Output Directory**: `dist/my-admin/browser`
   - **Install Command**: `npm install`

4. **Environment Variables** (nếu cần):
   - my-admin dùng `environment.apiUrl` trỏ tới `https://aurapc-backend.onrender.com/api` (đã cấu hình trong `environment.ts`), không cần thêm biến môi trường.

5. Bấm **Deploy**.

## Cách 2: Dùng Vercel CLI với config riêng

Nếu muốn deploy bằng CLI với config admin:

```bash
# Copy config admin
cp vercel.admin.json vercel.json

# Deploy (cần cài vercel CLI: npm i -g vercel)
vercel --prod

# Nhớ restore vercel.json cho my-client sau khi xong
git checkout vercel.json
```

**Lưu ý**: Cách này tạm thay `vercel.json` nên không phù hợp nếu bạn deploy cả my-client và my-admin từ cùng một repo.

## Cấu hình tùy chọn

### Custom domain

Trong Vercel project → **Settings** → **Domains**, thêm domain (ví dụ: `admin.aurapc.vn`).

### CORS Backend

Backend Render đã cấu hình CORS. Nếu dùng domain mới cho admin, kiểm tra `server/index.js` và thêm origin vào whitelist nếu cần.

## Tham chiếu

- `vercel.admin.json` — config mẫu cho my-admin
- `vercel.json` — config hiện tại cho my-client (deploy chính)
- `projects/my-admin/src/environments/environment.ts` — API URL production
