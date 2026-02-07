# Model 3D – Load nhanh hơn

## Cách giảm thời gian load (70MB → vài MB)

1. **Cài CLI** (một lần):
   ```bash
   npm install
   # hoặc
   npm install @gltf-transform/cli --save-dev
   ```

2. **Nén model** (tạo file `GamingPC-opt.glb`):
   ```bash
   npm run compress-model
   ```
   Hoặc chạy trực tiếp:
   ```bash
   npx @gltf-transform/cli optimize projects/my-client/src/assets/models/GamingPC.glb projects/my-client/src/assets/models/GamingPC-opt.glb
   ```

3. Ứng dụng **tự dùng bản đã nén** nếu có file `GamingPC-opt.glb`; không có thì vẫn load bản gốc `GamingPC.glb`.

## Preload

Trong `index.html` đã có preload cho `GamingPC.glb` để trình duyệt bắt đầu tải ngay khi mở trang.
