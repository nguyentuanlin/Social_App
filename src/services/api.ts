import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// URL Backend - Thay đổi theo IP máy của bạn
const API_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:7000'
    : 'http://localhost:7000'; // Backend chạy cổng 3000c

// Tạo axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Thêm token vào header
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Xử lý lỗi
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token hết hạn - Xóa token và redirect về login
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('session_expires_at');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
export { API_BASE_URL };
