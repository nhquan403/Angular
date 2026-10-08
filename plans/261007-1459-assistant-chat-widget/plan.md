# Mini chat trợ lý AI nhúng góc phải

Status: done (FE). BE endpoint chưa làm trong todo-api, xem docs/assistant-backend.md

## Outcome
Nút chat nổi ở góc phải dưới; bấm thì khung chat trượt lên. Người dùng chat với trợ lý AI (Claude chạy ở BE),
trợ lý đọc được todo của người dùng và ngữ cảnh trang đang mở, và có thể gợi ý todo mới;
bấm "Điền vào form" thì gợi ý được điền vào form tạo todo (người dùng vẫn tự bấm Thêm).

## Quyết định đã chốt với người dùng
- Bộ não: Claude qua BE (API key nằm ở server). Repo này chỉ có FE.
- Dữ liệu: todo của người dùng (BE đọc bằng tool, đúng quyền của người đó) + ngữ cảnh trang (FE gửi kèm).

## Hợp đồng FE ↔ BE
`POST /api/assistant/chat` (Bearer) → `text/event-stream`, sự kiện `delta | tool | suggestion | done | error`.
Chi tiết và code mẫu Spring: `docs/assistant-backend.md`.

## Non-goals
Không tự tạo todo thay người dùng; không render HTML/markdown từ AI (chỉ văn bản thuần); không lưu lịch sử chat lên server.

## Acceptance
- Widget mở/đóng, Esc đóng, Enter gửi, Shift+Enter xuống dòng, dừng được câu trả lời đang chạy.
- Câu trả lời hiện dần (stream); lỗi 404/429/mạng có thông báo rõ.
- Gợi ý → "Điền vào form" điền đúng form tạo ở /todos (tự chuyển trang nếu đang ở trang khác).
- Unit test cho parser SSE, API stream, service, ngữ cảnh trang, cầu nối form, widget.
- E2E với BE giả trên Chromium; lint, test, build sạch.
