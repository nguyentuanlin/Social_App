import apiClient from './api';

export interface DashboardStats {
  totalConversations: number;
  totalMessages: number;
  totalCustomers: number;
  totalChannels: number;
  unreadMessages: number;
  pendingConversations: number;
}

export const dashboardApi = {
  /**
   * Lấy thống kê dashboard cho nhân viên
   */
  getEmployeeStats: async (): Promise<DashboardStats> => {
    try {
      const response = await apiClient.get('/employee-dashboard/overview');
      return {
        totalConversations: response.data.totalConversations || 0,
        totalMessages: response.data.totalMessages || 0,
        totalCustomers: response.data.totalCustomers || 0,
        totalChannels: response.data.assignedChannels?.length || 0,
        unreadMessages: response.data.unreadMessages || 0,
        pendingConversations: response.data.pendingConversations || 0,
      };
    } catch (error) {
      console.error('[Dashboard API] Error:', error);
      // Return default values on error
      return {
        totalConversations: 0,
        totalMessages: 0,
        totalCustomers: 0,
        totalChannels: 0,
        unreadMessages: 0,
        pendingConversations: 0,
      };
    }
  },
};
