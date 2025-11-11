# Hướng dẫn Đồng bộ Tin nhắn từ Social Media

## Vấn đề hiện tại
- Tin nhắn chỉ hiển thị đến tháng 10
- Tin nhắn mới từ Facebook/Telegram/Instagram chưa được đồng bộ vào database
- Backend cần nhận webhook từ các platform để cập nhật tin nhắn real-time

## Giải pháp tạm thời - Nút Refresh ✅

### 1. Đã thêm nút Refresh
- **Vị trí 1**: Header danh sách conversations (icon refresh)
- **Vị trí 2**: Header chat window (icon refresh)
- **Chức năng**: Click để reload conversations/messages mới nhất

### 2. Cách sử dụng
1. Mở app Social Chat
2. Click icon **refresh** ở góc phải header
3. Danh sách conversations sẽ được cập nhật
4. Khi vào chat, click refresh để load tin nhắn mới

## Giải pháp lâu dài - Webhook Integration

### Backend cần setup:

#### 1. Facebook Webhook
```
URL: https://your-domain.com/webhook/facebook
Method: POST
Verify Token: your-verify-token
```

**Cấu hình trên Facebook Developer:**
- Vào App Settings → Webhooks
- Subscribe to Page: messages, messaging_postbacks
- Nhập Callback URL và Verify Token

#### 2. Telegram Webhook
```
URL: https://your-domain.com/webhook/telegram
Method: POST
```

**Setup webhook:**
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-domain.com/webhook/telegram"
```

#### 3. Instagram Webhook
```
URL: https://your-domain.com/webhook/instagram
Method: POST
```

**Cấu hình tương tự Facebook** (Instagram Business Account)

### Kiểm tra Webhook đang hoạt động:

#### Backend logs cần có:
```
[WebhookProcessor] Processing Facebook message...
[WebhookProcessor] Processing Telegram message...
[WebhookProcessor] Processing Instagram message...
```

#### Test webhook:
1. Gửi tin nhắn từ Facebook/Telegram/Instagram
2. Check backend logs xem có nhận webhook không
3. Check database xem message có được lưu không

### Troubleshooting:

#### Webhook không nhận được:
- ✅ Check URL có public và accessible không
- ✅ Check SSL certificate (phải HTTPS)
- ✅ Check firewall/port có mở không
- ✅ Check verify token có đúng không

#### Message không lưu vào DB:
- ✅ Check backend logs có error không
- ✅ Check database connection
- ✅ Check entity relationships (Conversation, Customer, Channel)

## Auto-sync trong tương lai

### Polling (tạm thời)
```typescript
// Trong ChatScreen.tsx
useEffect(() => {
  const interval = setInterval(() => {
    loadConversations();
  }, 30000); // Refresh mỗi 30s
  
  return () => clearInterval(interval);
}, []);
```

### WebSocket (tốt nhất)
```typescript
// Real-time updates qua Socket.IO
socket.on('new_message', (message) => {
  setMessages(prev => [...prev, message]);
});

socket.on('conversation_updated', (conversation) => {
  // Update conversation list
});
```

## Checklist Setup Webhook

- [ ] Có domain public với HTTPS
- [ ] Backend đang chạy và accessible
- [ ] Facebook webhook đã setup và verified
- [ ] Telegram webhook đã setup
- [ ] Instagram webhook đã setup (nếu dùng)
- [ ] Test gửi tin nhắn và check logs
- [ ] Verify messages được lưu vào database
- [ ] Frontend có thể load messages mới

## Liên hệ
Nếu cần hỗ trợ setup webhook, liên hệ team backend để:
1. Cấu hình webhook URLs
2. Setup SSL certificate
3. Configure verify tokens
4. Test webhook integration
