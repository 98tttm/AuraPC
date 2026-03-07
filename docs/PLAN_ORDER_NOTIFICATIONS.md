# Plan: Đơn hàng Đang giao + Thông báo Client/Admin

## Tổng quan

1. **Phase 1** – Đơn "Đang giao": nút "Đã nhận" / "Hoàn trả đơn hàng", bỏ "Mua lại"; chuyển trạng thái ngay; admin đã có notification hoàn trả.
2. **Phase 2** – Thông báo trên my-client: chuông + dropdown; backend tạo thông báo khi đơn đổi trạng thái, AuraHub like/comment/reply (nếu có).
3. **Phase 3** – Admin: xác nhận/từ chối hoàn trả (đã có), demo "nhắn tin" (mailto hoặc placeholder).

---

## Phase 1 – Đơn hàng Đang giao (ưu tiên)

### 1.1 Client (my-client) – Trang Đơn hàng của tôi

| Việc | Chi tiết |
|------|----------|
| Ẩn "Mua lại" khi đang giao | Chỉ khi `order.status === 'shipped'` thì **không** hiện nút "Mua lại". Các trạng thái khác (đã giao, đã hủy, trả hàng) vẫn hiện "Mua lại". |
| Đổi nhãn nút | "Đã nhận hàng" → **"Đã nhận"**; "Hoàn trả" → **"Hoàn trả đơn hàng"**. |
| Giữ logic hiện tại | `canShowDeliveryActions(order)` vẫn dùng (shipped + đủ thời gian mở xác nhận). Nút "Đã nhận" và "Hoàn trả đơn hàng" chỉ hiện khi `canShowDeliveryActions` true. |

**File:** `projects/my-client/src/app/pages/account/account-page.component.html` (và .ts nếu cần).

### 1.2 Backend – Xác nhận nhận hàng ngay (không chờ 30 phút)

| Việc | Chi tiết |
|------|----------|
| Bỏ delay 30 phút cho "Đã nhận" | `POST /api/orders/:orderNumber/confirm-received`: không gọi `canUserConfirmDelivery(order)` nữa; khi status = `shipped` và không có returnRequest pending thì cho phép chuyển ngay sang `delivered`. |
| Hoàn trả | Giữ hoặc bỏ delay cho `return-request` (đề xuất: bỏ luôn để UX đồng bộ). |

**File:** `server/routes/orderRoutes.js`.

### 1.3 Admin (my-admin)

- **Đã có:** Notification type `order_return_request`, nhãn "Yêu cầu hoàn trả", click mở đơn `/orders/:orderNumber`.
- **Đã có:** Trang chi tiết đơn có block "Yêu cầu hoàn trả" với nút "Duyệt hoàn trả" / "Từ chối hoàn trả".
- **Phase 3:** Thêm demo "Nhắn tin" (mailto hoặc nút placeholder).

---

## Phase 2 – Thông báo trên my-client

### 2.1 Backend

| Việc | Chi tiết |
|------|----------|
| Model | `UserNotification`: user (ObjectId), type (enum), title, message, metadata, readAt (Date?), createdAt. |
| API (client) | `GET /api/notifications` (list + unread count), `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`. Middleware: requireAuth. |
| Tạo thông báo khi | Admin đổi trạng thái đơn (confirmed, processing, shipped, delivered, cancelled, duyệt/từ chối hủy/hoàn trả). Sau này: AuraHub like, comment, reply (khi có API tương ứng). |

**Files:** `server/models/UserNotification.js`, `server/routes/notificationRoutes.js`, `server/utils/userNotifications.js`, gọi từ `server/routes/orderRoutes.js` và admin order update.

### 2.2 Client (my-client)

| Việc | Chi tiết |
|------|----------|
| Service | `NotificationService`: getNotifications(), markRead(id), markAllRead(), unreadCount (signal hoặc Observable). Gọi API trên. |
| Header | Icon chuông (giống admin) + dropdown: danh sách thông báo, "Đánh dấu đã đọc tất cả", click item → mark read + điều hướng (đơn hàng → /tai-khoan với tab đơn, v.v.). |
| Types | order_confirmed, order_shipped, order_delivered, order_cancelled, order_return_approved, order_return_rejected, v.v. |

**Files:** `projects/my-client/src/app/core/services/notification.service.ts`, `projects/my-client/src/app/components/header/` (thêm dropdown thông báo).

---

## Phase 3 – Admin: xác nhận hoàn trả + demo nhắn tin

| Việc | Chi tiết |
|------|----------|
| Xác nhận / Từ chối | Đã có trong order-detail-admin. Chỉ cần đảm bảo khi duyệt/từ chối → tạo UserNotification cho khách (Phase 2). |
| Demo nhắn tin | Trong block "Yêu cầu hoàn trả" hoặc header đơn: nút "Liên hệ khách" → mailto: hoặc `tel:` (SĐT từ shippingAddress), hoặc placeholder "Tính năng nhắn tin đang phát triển". |

---

## Thứ tự thực hiện đề xuất

1. **Phase 1.1 + 1.2** – Client UI (nút + nhãn) + Backend (confirm-received/return-request không delay).  
2. **Phase 2.1** – Backend: UserNotification model + API + tạo thông báo khi đổi trạng thái đơn (và khi admin duyệt/từ chối hủy/hoàn trả).  
3. **Phase 2.2** – Client: NotificationService + chuông + dropdown trong header.  
4. **Phase 3** – Admin: nút "Liên hệ khách" (mailto/tel hoặc placeholder).

---

## Chấp nhận plan

Nếu bạn đồng ý với plan này, reply **"accept"** hoặc **"bắt đầu"** để triển khai theo thứ tự trên. Có thể chỉ làm Phase 1 trước rồi làm Phase 2–3 sau.
