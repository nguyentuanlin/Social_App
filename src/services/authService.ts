import apiClient from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const SESSION_EXPIRES_AT_KEY = 'session_expires_at';

export interface LoginResponse {
  access_token: string;
}

export interface User {
  sub: string;
  email: string;
  username: string;
  fullname: string;
  user_tile: string;
  roles: string[];
  avatar?: string;
  coverImage?: string;
}

export const authService = {
  /**
   * Đăng nhập
   */
  login: async (email: string, password: string): Promise<LoginResponse> => {
    try {
      // console.log('[AuthService] 🔐 Bắt đầu đăng nhập...');
      // console.log('[AuthService] 📧 Email:', email);
      // console.log('[AuthService] 🌐 API URL:', apiClient.defaults.baseURL);
      
      const response = await apiClient.post<LoginResponse>('/auth/login', {
        email,
        password,
      });

      // console.log('[AuthService] ✅ Đăng nhập thành công!');
      // console.log('[AuthService] 🎫 Token nhận được:', response.data.access_token ? 'Có' : 'Không');

      // Lưu token + thời gian hết hạn vào AsyncStorage
      if (response.data.access_token) {
        await AsyncStorage.setItem('access_token', response.data.access_token);
        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
        await AsyncStorage.setItem(SESSION_EXPIRES_AT_KEY, expiresAt);
        console.log('[AuthService] 💾 Đã lưu token và session_expires_at vào AsyncStorage');
      }

      return response.data;
    } catch (error: any) {
      console.error('[AuthService] ❌ Lỗi đăng nhập:', error.message);
      console.error('[AuthService] 📄 Response:', error.response?.data);
      console.error('[AuthService] 🔢 Status:', error.response?.status);

      // Network Error / CORS fail: không có response từ server
      if (!error.response || error.message === 'Network Error') {
        throw new Error(
          'Không thể kết nối tới máy chủ. Vui lòng kiểm tra backend (http://localhost:7000) có đang chạy và cấu hình CORS đúng chưa.'
        );
      }

      throw new Error(
        error.response?.data?.message || 'Đăng nhập thất bại'
      );
    }
  },

  /**
   * Lấy thông tin profile
   */
  getProfile: async (): Promise<User> => {
    try {
      // console.log('[AuthService] 👤 Đang lấy thông tin profile...');
      
      const response = await apiClient.get<User>('/auth/profile');
      const serverUser = response.data;

      // console.log('[AuthService] ✅ Lấy profile thành công!');
      // console.log('[AuthService] 👨‍💼 User:', serverUser.fullname);
      // console.log('[AuthService] 📧 Email:', serverUser.email);
      // console.log('[AuthService] 🎭 Roles:', serverUser.roles);

      // Merge với cache để giữ avatar/coverImage cục bộ nếu có
      let cachedUser: User | null = null;
      try {
        const cached = await AsyncStorage.getItem('userData');
        cachedUser = cached ? JSON.parse(cached) : null;
      } catch {}

      const merged: User = {
        ...serverUser,
        avatar: cachedUser?.avatar ?? serverUser.avatar,
        coverImage: cachedUser?.coverImage ?? serverUser.coverImage,
      };

      // Lưu merged user vào AsyncStorage
      await AsyncStorage.setItem('userData', JSON.stringify(merged));
      // console.log('[AuthService] 💾 Đã lưu merged user vào AsyncStorage (giữ avatar/cover cục bộ nếu có)');
      
      return merged;
    } catch (error: any) {
      console.error('[AuthService] ❌ Lỗi lấy profile:', error.message);
      console.error('[AuthService] 📄 Response:', error.response?.data);
      throw new Error(
        error.response?.data?.message || 'Không thể lấy thông tin người dùng'
      );
    }
  },

  /**
   * Đăng xuất
   */
  logout: async (): Promise<void> => {
    try {
      // console.log('[AuthService] 🚪 Đang đăng xuất...');
      
      // Gọi API logout (không bắt buộc phải thành công)
      try {
        await apiClient.post('/auth/logout');
        // console.log('[AuthService] ✅ API logout thành công');
      } catch (apiError) {
        console.warn('[AuthService] ⚠️ API logout lỗi (tiếp tục clear local data):', apiError);
      }
      
      // Xóa token và user data (quan trọng nhất)
      await AsyncStorage.removeItem('access_token');
      // console.log('[AuthService] 🗑️ Đã xóa access_token');
      
      await AsyncStorage.removeItem('userData');
      // console.log('[AuthService] 🗑️ Đã xóa userData');
      await AsyncStorage.removeItem(SESSION_EXPIRES_AT_KEY);
      
      // console.log('[AuthService] ✅ Logout hoàn thành!');
    } catch (error) {
      console.error('[AuthService] ❌ Lỗi nghiêm trọng khi logout:', error);
      // Vẫn cố gắng xóa dữ liệu local
      try {
        await AsyncStorage.removeItem('access_token');
        await AsyncStorage.removeItem('userData');
      } catch (cleanupError) {
        console.error('[AuthService] ❌ Không thể xóa local data:', cleanupError);
      }
    }
  },

  /**
   * Kiểm tra token còn hiệu lực không
   */
  isAuthenticated: async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem('access_token');
    if (!token) return false;

    try {
      const raw = await AsyncStorage.getItem(SESSION_EXPIRES_AT_KEY);
      if (raw) {
        const expires = new Date(raw);
        if (!isNaN(expires.getTime()) && expires.getTime() <= Date.now()) {
          // Phiên đã hết hạn → xoá local state
          await AsyncStorage.removeItem('access_token');
          await AsyncStorage.removeItem('userData');
          await AsyncStorage.removeItem(SESSION_EXPIRES_AT_KEY);
          return false;
        }
      }
    } catch {}

    return true;
  },

  /**
   * Lấy user data từ AsyncStorage
   */
  getCachedUser: async (): Promise<User | null> => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Exchange SSO token (Azure/Google) thành JWT của hệ thống
   */
  exchangeSsoToken: async (provider: string, token: string): Promise<LoginResponse> => {
    try {
      const response = await apiClient.post<LoginResponse>('/auth/exchange-sso-token', {
        provider,
        token,
      });

      // Lưu token + thời gian hết hạn vào AsyncStorage
      if (response.data.access_token) {
        await AsyncStorage.setItem('access_token', response.data.access_token);
        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
        await AsyncStorage.setItem(SESSION_EXPIRES_AT_KEY, expiresAt);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'SSO authentication failed'
      );
    }
  },

  /**
   * Gia hạn phiên làm việc bằng cách refresh JWT
   */
  refreshToken: async (): Promise<LoginResponse> => {
    try {
      const response = await apiClient.post<LoginResponse>('/auth/refresh');

      if (response.data.access_token) {
        await AsyncStorage.setItem('access_token', response.data.access_token);
        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
        await AsyncStorage.setItem(SESSION_EXPIRES_AT_KEY, expiresAt);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Không thể gia hạn phiên đăng nhập'
      );
    }
  },
};
