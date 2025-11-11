import apiClient from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      console.log('[AuthService] 🔐 Bắt đầu đăng nhập...');
      console.log('[AuthService] 📧 Email:', email);
      console.log('[AuthService] 🌐 API URL:', apiClient.defaults.baseURL);
      
      const response = await apiClient.post<LoginResponse>('/auth/login', {
        email,
        password,
      });

      console.log('[AuthService] ✅ Đăng nhập thành công!');
      console.log('[AuthService] 🎫 Token nhận được:', response.data.access_token ? 'Có' : 'Không');

      // Lưu token vào AsyncStorage
      if (response.data.access_token) {
        await AsyncStorage.setItem('access_token', response.data.access_token);
        console.log('[AuthService] 💾 Đã lưu token vào AsyncStorage');
      }

      return response.data;
    } catch (error: any) {
      console.error('[AuthService] ❌ Lỗi đăng nhập:', error.message);
      console.error('[AuthService] 📄 Response:', error.response?.data);
      console.error('[AuthService] 🔢 Status:', error.response?.status);
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
      console.log('[AuthService] 👤 Đang lấy thông tin profile...');
      
      const response = await apiClient.get<User>('/auth/profile');
      
      console.log('[AuthService] ✅ Lấy profile thành công!');
      console.log('[AuthService] 👨‍💼 User:', response.data.fullname);
      console.log('[AuthService] 📧 Email:', response.data.email);
      console.log('[AuthService] 🎭 Roles:', response.data.roles);
      
      // Lưu user data vào AsyncStorage
      await AsyncStorage.setItem('userData', JSON.stringify(response.data));
      console.log('[AuthService] 💾 Đã lưu user data vào AsyncStorage');
      
      return response.data;
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
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Xóa token và user data
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('userData');
    }
  },

  /**
   * Kiểm tra token còn hiệu lực không
   */
  isAuthenticated: async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem('access_token');
    return !!token;
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

      // Lưu token vào AsyncStorage
      if (response.data.access_token) {
        await AsyncStorage.setItem('access_token', response.data.access_token);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'SSO authentication failed'
      );
    }
  },
};
