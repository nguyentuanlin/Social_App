# Social Media CRM - Mobile App

React Native app cho hệ thống AI Agent quản lý mạng xã hội đa kênh.

## 🚀 Cài đặt

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Cấu hình Backend URL

Mở file `src/services/api.ts` và thay đổi `API_BASE_URL`:

```typescript
const API_BASE_URL = 'http://192.168.1.100:3000'; // Thay bằng IP máy backend
```

**Lưu ý:**
- Nếu chạy trên máy ảo Android: Dùng `http://10.0.2.2:3000`
- Nếu chạy trên thiết bị thật: Dùng IP LAN của máy backend (ví dụ: `http://192.168.1.100:3000`)
- Không dùng `localhost` hoặc `127.0.0.1`

### 3. Chạy app

```bash
# Start Metro bundler
npm start

# Chạy trên Android
npm run android

# Chạy trên iOS
npm run ios

# Chạy trên web
npm run web
```

## 📱 Tính năng

### ✅ Đã hoàn thành
- **Đăng nhập**: Email + Password
- **Authentication**: JWT token với AsyncStorage
- **Auto login**: Tự động đăng nhập khi mở lại app
- **Profile**: Hiển thị thông tin user
- **Logout**: Đăng xuất và xóa token

### 🔄 Đang phát triển
- Chat interface
- Quản lý khách hàng
- Thống kê và báo cáo
- Push notifications

## 🏗️ Cấu trúc Project

```
Social_app/
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx       # Auth state management
│   ├── screens/
│   │   ├── LoginScreen.tsx       # Màn hình đăng nhập
│   │   └── HomeScreen.tsx        # Màn hình chính
│   └── services/
│       ├── api.ts                # Axios config
│       └── authService.ts        # Auth API calls
├── App.tsx                       # Root component
├── package.json
└── README.md
```

## 🔐 Authentication Flow

1. User nhập email + password
2. App gọi `POST /auth/login` → Nhận `access_token`
3. Lưu token vào AsyncStorage
4. Gọi `GET /auth/profile` → Lấy thông tin user
5. Lưu user data vào AsyncStorage
6. Navigate đến HomeScreen

## 🛠️ Tech Stack

- **React Native**: 0.74.5
- **Expo**: ~51.0.0
- **React Navigation**: 6.x
- **Axios**: HTTP client
- **AsyncStorage**: Local storage
- **TypeScript**: Type safety

## 📝 API Endpoints

Backend URL: `http://localhost:3000`

- `POST /auth/login` - Đăng nhập
- `GET /auth/profile` - Lấy thông tin user
- `POST /auth/logout` - Đăng xuất

## 🐛 Troubleshooting

### Lỗi kết nối backend

**Vấn đề**: Không kết nối được với backend

**Giải pháp**:
1. Kiểm tra backend đang chạy: `http://localhost:3000`
2. Kiểm tra IP address trong `src/services/api.ts`
3. Đảm bảo điện thoại và máy tính cùng mạng WiFi
4. Tắt firewall nếu cần

### Lỗi "Network request failed"

**Giải pháp**:
- Android emulator: Dùng `http://10.0.2.2:3000`
- iOS simulator: Dùng `http://localhost:3000`
- Thiết bị thật: Dùng IP LAN (ví dụ: `http://192.168.1.100:3000`)

## 📞 Liên hệ

Nếu có vấn đề, liên hệ team phát triển.
