# todo-web

Giao diện Angular 22 cho [todo-api](../todo-api) (Spring Boot, kiến trúc Hexagonal). App này dùng **toàn bộ** những gì BE cung cấp.

**Giao diện:** [Angular Material](https://material.angular.dev) (Material Design 3) cho component (form, dialog, bảng, menu, snackbar, phân trang) và [Tailwind CSS v4](https://tailwindcss.com) cho bố cục, khoảng cách, chữ. Có chế độ sáng / tối / theo hệ thống, chạy tốt trên điện thoại.

| Tính năng của BE | Nơi dùng trong app |
|---|---|
| Đăng ký, đăng nhập, `/me` | `features/auth/`, `core/auth/auth-store.ts` |
| Access token (15 phút) + refresh token xoay vòng, đăng xuất | `core/auth/auth-store.ts`, `core/http/interceptors.ts` |
| Role USER / ADMIN, 403 | `core/auth/guards.ts` (`adminGuard`), menu và trang `features/admin/` |
| Todo CRUD, hoàn thành, mở lại | `features/todos/todo-list`, `todo-detail` |
| Lọc, sắp xếp, phân trang | `features/todos/todo-query.ts` (trạng thái nằm trên URL) |
| Khóa lạc quan (`version`, 409) | `features/todos/todo-detail.ts` |
| Lỗi ProblemDetail (RFC 9457) + `errors` theo ô, `X-Request-Id` | `core/api-error.ts`, form hiện lỗi từng ô |
| Todo của ai người nấy, ADMIN thấy tất cả | Danh sách tự đổi tiêu đề, bảng hoạt động có nhãn `user #id` |
| Quản lý người dùng, đổi role | `features/admin/admin-users.ts` |
| Ticket dùng một lần cho SSE / WebSocket | `core/realtime/realtime-service.ts` |
| SSE (`/api/realtime/stream`) và WebSocket (`/ws/todos`) | Nút chuyển SSE/WebSocket trên thanh trên cùng |
| Giới hạn 5 kết nối mỗi người (429 / close 1013) | `RealtimeService` báo lỗi rõ ràng |
| Sự kiện không được phát lại | `resync$`: kết nối lại xong thì tải lại danh sách |
| CORS, kiểm tra Origin của WebSocket | BE đã thêm `http://localhost:4200` vào `app.cors.allowed-origins` |
| Swagger UI | Link ở chân trang và menu tài khoản |

## Chạy

Cần Node.js `^22.22.3`, `^24.15` hoặc `>=26` (yêu cầu của Angular CLI 22) và BE đang chạy ở cổng 8080.

```bash
# 1. BE (một terminal), profile dev có sẵn ADMIN admin@example.com / Admin#12345
cd ../todo-api
mvn spring-boot:run

# 2. FE (terminal khác)
cd todo-web
npm install
npm start            # http://localhost:4200
```

Đổi địa chỉ BE: sửa `apiBaseUrl` trong `src/environments/environment.ts` (bản production) và `environment.development.ts` (bản `npm start`). Mặc định `http://localhost:8080`, WebSocket tự suy ra `ws://localhost:8080`.
Domain frontend khác 4200 thì thêm vào `app.cors.allowed-origins` của BE, nếu không trình duyệt chặn cả API lẫn WebSocket.

| Lệnh | Việc |
|---|---|
| `npm start` | chạy dev ở http://localhost:4200 |
| `npm run build` | bản production ở `dist/todo-web/browser` |
| `npm test` | unit test (Vitest) |
| `npm run lint` | ESLint (angular-eslint, gồm luật accessibility cho template) |
| `npm run format` / `format:check` | Prettier (tự sắp xếp class Tailwind) |

Docker: `docker build -t todo-web . && docker run -p 8080:80 todo-web` (nginx, có fallback cho SPA và cache dài hạn cho file đã băm tên).

### Thử tính năng thời gian thực

1. Đăng ký hai tài khoản hoặc dùng ADMIN. Mở app ở **hai tab** cùng đăng nhập.
2. Ở tab 1 thêm, sửa, hoàn thành, xóa một todo: tab 2 nhận sự kiện ngay (dòng được làm nổi, bảng "Hoạt động trực tiếp" thêm dòng).
3. Bấm **WebSocket** trên thanh trên: kết nối đổi sang WebSocket, mọi thứ vẫn chạy như cũ.
4. Đăng nhập ADMIN ở tab 1, USER ở cửa sổ ẩn danh: USER tạo todo thì ADMIN thấy sự kiện kèm nhãn `user #id`, ngược lại USER không thấy gì của người khác.
5. Tắt BE rồi bật lại: thanh trên chuyển "Đang kết nối lại..." rồi tự về "Trực tiếp", danh sách tự tải lại.
6. Sửa một todo ở tab 1 (chưa lưu) rồi sửa và lưu cùng todo đó ở tab 2: tab 1 hiện banner xung đột, cho chọn giữ hay bỏ thay đổi của mình.

## Cấu trúc

```
src/app/
├── app.ts, app.config.ts, app.routes.ts   gốc, cấu hình (HttpClient, router, locale vi, Material), bản đồ đường dẫn
├── core/                                  những thứ dùng chung cho cả app, không thuộc màn hình nào
│   ├── config.ts                          API_BASE_URL (lấy từ src/environments)
│   ├── models.ts                          kiểu dữ liệu khớp DTO của BE
│   ├── api-error.ts                       đổi lỗi HTTP thành ApiError (đọc ProblemDetail)
│   ├── error-handler.ts                   bắt lỗi chưa xử lý, ghi console và báo nhẹ cho người dùng
│   ├── auth/  token-store, auth-api, auth-store, guards
│   ├── http/  interceptors                gắn Bearer, tự refresh khi 401, đổi lỗi
│   ├── realtime/  realtime-service, todo-event
│   ├── notify/  toast-service             thông báo nổi (MatSnackBar)
│   ├── dialog/  confirm-dialog            hộp thoại xác nhận dùng chung (MatDialog)
│   ├── theme/  theme-service              sáng / tối / theo hệ thống
│   └── ui/  app-title-strategy, paginator-intl   tiêu đề tab "Trang · Todo", chữ tiếng Việt cho phân trang
├── shared/  alert, empty-state, form-errors      banner, màn hình trống, gắn lỗi BE vào đúng ô form
├── layout/  shell, realtime-badge, theme-toggle  thanh trên cùng, trạng thái kết nối, menu tài khoản
└── features/
    ├── auth/  auth-layout, login, register
    ├── todos/  todo-api, todo-query, todo-list, todo-detail, unsaved-changes-guard
    ├── realtime/  activity-feed
    └── admin/  admin-users
src/environments/   apiBaseUrl cho dev và production
src/styles.scss     theme Angular Material (M3) và màu bổ sung
src/tailwind.css    Tailwind, ánh xạ màu Tailwind sang token Material (--mat-sys-*)
```

**Material + Tailwind sống chung thế nào.** Tailwind trỏ màu vào token của Material (`bg-primary`, `text-on-surface-variant`, `border-outline-variant`...), nên một lần đổi `color-scheme` trên `<html>` là cả hai cùng chuyển sáng/tối. Mọi lớp Tailwind nằm trong `@layer`, còn CSS của Material thì không, nên preflight của Tailwind không đè được component Material. Muốn sửa component Material thì dùng mixin `mat.*-overrides` (xem `styles.scss`), không dùng `::ng-deep`.

Quy ước của Angular mới: file không có hậu tố `.component` (`todo-list.ts` chứa class `TodoList`), component độc lập (standalone, không có NgModule), trạng thái dùng **signal**, không dùng zone.js (zoneless), control flow `@if` / `@for` / `@switch` thay cho `*ngIf` / `*ngFor`.

## Những chỗ đáng đọc kỹ

**1. Làm mới token (`core/auth/auth-store.ts`, `core/http/interceptors.ts`).**
Refresh token của BE xoay vòng: mỗi token chỉ dùng được một lần, dùng lại là BE coi như bị trộm và thu hồi cả phiên. Hậu quả: nếu ba request cùng nhận 401 và cả ba cùng gọi `/refresh` thì người dùng bị đăng xuất. Vì thế:
- trong một tab, mọi request chờ chung **một** lần refresh (`refreshInflight`);
- giữa các tab, dùng Web Locks để chỉ một tab refresh, tab còn lại đọc lại token mới từ `localStorage`;
- token sắp hết hạn (còn dưới 15 giây) được làm mới trước khi gửi, đỡ tốn một lượt 401.

**2. Thời gian thực (`core/realtime/realtime-service.ts`).**
`EventSource` và `WebSocket` của trình duyệt không gắn được header `Authorization`, nên mỗi lần kết nối app xin một **ticket** (POST có Bearer) rồi truyền qua `?ticket=`. Ticket dùng một lần, nên cơ chế tự nối lại của `EventSource` (thử lại đúng URL cũ) luôn thất bại: service tự đóng và tự mở lại với ticket mới, chờ tăng dần 1s, 2s, 4s... tối đa 30s kèm ngẫu nhiên.

**3. Trạng thái nằm trên URL (`todo-query.ts`).**
`/todos?completed=false&page=2&sortBy=title&direction=asc`: F5, nút Back, gửi link đều đúng. Giá trị lạ trên URL bị đưa về mặc định vì BE trả 400 khi tham số sai.

**4. Không mất dữ liệu đang gõ (`todo-detail.ts`, `unsaved-changes-guard.ts`).**
Form còn thay đổi chưa lưu thì rời trang trong app sẽ hiện hộp thoại hỏi lại, đóng tab hay F5 thì trình duyệt hỏi. Lỗi BE trả theo từng ô (`errors` của ProblemDetail) được gắn thẳng vào FormControl (`shared/form-errors.ts`) để hiện ngay dưới ô đó.

**5. Guard chỉ để trải nghiệm tốt hơn.**
`authGuard`, `adminGuard` tránh cho người dùng thấy trang rồi mới bị 403. Chúng **không phải** bảo mật: JavaScript trong trình duyệt ai cũng sửa được. Quyền thật luôn do BE kiểm tra ở mỗi request.

## Kiểm tra đã làm

- `npm test`: 68 unit test (interceptor và refresh token, realtime kể cả backoff, parse sự kiện, parse URL, lỗi API, token, gắn lỗi BE vào form, thông báo, giao diện sáng/tối, guard thay đổi chưa lưu, bắt lỗi toàn cục, form đăng nhập).
- `npm run lint`, `npm run build` sạch.
- Chạy bản build thật trong Chromium với **một BE giả** viết theo đúng controller và DTO của `todo-api` (không phải Spring thật): 18 bước gồm chuyển về đăng nhập kèm `returnUrl`, lỗi từng ô, thêm / hoàn thành / xóa (qua hộp thoại) todo, lọc và phân trang trên URL, SSE giữa hai tab, xung đột version, hỏi khi rời trang chưa lưu, ADMIN đổi role, chế độ tối, bố cục điện thoại 390px không tràn ngang, đăng xuất đồng bộ giữa các tab, trang 404.
- Chưa chạy với BE Spring thật. Nếu có chỗ lệch hợp đồng (ví dụ định dạng thời gian, tên trường) thì sẽ lộ ra khi chạy `mvn spring-boot:run` rồi `npm start`.

## Giới hạn đã biết

- Token lưu ở `localStorage`: đọc được bằng JavaScript, nên nếu trang dính XSS thì token bị lấy. Cách an toàn hơn là BFF + cookie HttpOnly, BE hiện tại không làm theo hướng đó.
- Mỗi tab mở một kết nối thời gian thực riêng, BE giới hạn 5 mỗi người. Mở tab thứ 6 sẽ bị từ chối (thanh trên cùng báo lý do). Muốn dùng chung một kết nối giữa các tab cần `SharedWorker` hoặc `BroadcastChannel`.
- Đổi role: người bị đổi phải đăng nhập lại để nhận role mới (BE thu hồi refresh token, access token cũ còn sống tối đa 15 phút).
- Chưa có i18n (giao diện chỉ tiếng Việt) và chưa có phân quyền theo từng nút ngoài ADMIN.
- Font Roboto và bộ biểu tượng Material Symbols nạp từ Google Fonts (`src/index.html`). Môi trường không ra được Internet thì cần tự host hai font này.
- `apiBaseUrl` cố định lúc build. Muốn một image Docker chạy được với nhiều BE khác nhau thì cần thêm cấu hình lúc chạy (ví dụ `config.json` do nginx phục vụ).
