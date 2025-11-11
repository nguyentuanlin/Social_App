# 🔧 Cấu hình Azure Redirect URI cho Mobile App

## ❌ Lỗi hiện tại

```
AADSTS50011: The redirect URI 'http://localhost:8081/auth/callback' specified in the request 
does not match the redirect URIs configured for the application
```

## ✅ Giải pháp: Thêm Redirect URI vào Azure Portal

### Bước 1: Mở Azure Portal

1. Truy cập: https://portal.azure.com
2. Vào **Azure Active Directory** → **App registrations**
3. Chọn app: `0f263b0c-86ad-46c8-a583-0381ec2c8be3`

### Bước 2: Thêm Redirect URIs

Vào **Authentication** → **Platform configurations** → **Add a platform**

#### Chọn **Mobile and desktop applications**

Thêm các URIs sau:

```
socialapp://
socialapp://auth/callback
exp://localhost:8081/--/auth/callback
http://localhost:8081/--/auth/callback
```

#### Hoặc chọn **Single-page application (SPA)**

Thêm:

```
http://localhost:8081/auth/callback
exp://172.17.144.37:8081/--/auth/callback
```

### Bước 3: Save Changes

Click **Save** ở cuối trang.

---

## 📱 Redirect URI được sử dụng

App sẽ tự động generate redirect URI dựa trên:

```typescript
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'socialapp',
});
```

**Kết quả có thể là:**
- `socialapp://` (Expo Go)
- `socialapp://auth/callback` (Standalone app)
- `exp://172.17.144.37:8081/--/auth/callback` (Development)

---

## 🔍 Debug Redirect URI

Khi chạy app, check console log:

```
[Azure Auth] Redirect URI: socialapp://
```

Copy URI này và thêm vào Azure Portal.

---

## ⚠️ Lưu ý

1. **Expo Go**: Redirect URI sẽ khác khi chạy trên Expo Go vs standalone app
2. **Development**: URI có thể thay đổi theo IP máy
3. **Production**: Cần config redirect URI cố định

---

## 🚀 Alternative: Sử dụng Web Flow

Nếu không muốn config Azure, có thể dùng **WebBrowser** để mở web login:

```typescript
// Mở web login trong in-app browser
const result = await WebBrowser.openAuthSessionAsync(
  'http://localhost:3001/auth/signin',
  'socialapp://auth/callback'
);
```

Cách này sẽ redirect về web frontend để xử lý SSO.
