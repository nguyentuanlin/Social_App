import apiClient from './api';

export interface DashboardStats {
  totalConversations: number;
  totalMessages: number;
  totalCustomers: number;
  totalChannels: number;
  unreadMessages: number;
  pendingConversations: number;
}

export interface CSITrendData {
  csiTrend: Array<{
    date: string;
    happy: number;
    neutral: number;
    sad: number;
    count: number;
  }>;
  summary: {
    totalHappy: number;
    totalNeutral: number;
    totalSad: number;
    avgCSI: number;
  };
  channels: Array<{
    id: string;
    name: string;
    platform: string;
  }>;
  seriesByChannel: Array<Record<string, any>>;
  summaryByChannel: Array<{
    channelId: string;
    channelName: string;
    totalHappy: number;
    totalNeutral: number;
    totalSad: number;
    avgCSI: number;
  }>;
}

export const dashboardApi = {
  /**
   * Lấy thống kê dashboard cho nhân viên 
   */
  getEmployeeStats: async (): Promise<DashboardStats> => {
    try {
      // Sử dụng employee dashboard API - đã có logic phân quyền theo user_channels
      const response = await apiClient.get('/employee-dashboard/overview');
      
      // Debug logging
      console.log('[Dashboard API] Employee dashboard response:', response.data);
      console.log('[Dashboard API] Assigned channels:', response.data.assignedChannels);
      
      return {
        totalConversations: response.data.totalConversations || 0,
        totalMessages: response.data.totalMessages || 0,
        totalCustomers: response.data.totalCustomers || 0, 
        totalChannels: response.data.assignedChannels?.length || 0,
        unreadMessages: response.data.unreadConversations || 0,
        pendingConversations: response.data.pendingConversations || 0,
      };
    } catch (error) {
      console.error('[Dashboard API] Error:', error);
      // Fallback to employee dashboard if chat stats fails
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
      } catch (fallbackError) {
        console.error('[Dashboard API] Fallback error:', fallbackError);
        return {
          totalConversations: 0,
          totalMessages: 0,
          totalCustomers: 0,
          totalChannels: 0,
          unreadMessages: 0,
          pendingConversations: 0,
        };
      }
    }
  },

  getCSITrend: async (days: number = 7): Promise<CSITrendData> => {
    try {
      const response = await apiClient.get('/dashboard/csi-trend', {
        params: { days },
      });
      console.log('[Dashboard API] CSI trend response:', response.data);

      const raw = response.data as any;
      const fixed: CSITrendData = {
        csiTrend: Array.isArray(raw.csiTrend) ? raw.csiTrend : [],
        summary: raw.summary || {
          totalHappy: 0,
          totalNeutral: 0,
          totalSad: 0,
          avgCSI: 0,
        },
        channels: Array.isArray(raw.channels) ? raw.channels : [],
        seriesByChannel: Array.isArray(raw.seriesByChannel) ? raw.seriesByChannel : [],
        summaryByChannel: Array.isArray(raw.summaryByChannel) ? raw.summaryByChannel : [],
      };

      if (!Array.isArray(raw.seriesByChannel)) {
        console.warn('[Dashboard API] CSI seriesByChannel is not array, received:', typeof raw.seriesByChannel);
      }

      return fixed;
    } catch (error) {
      console.error('[Dashboard API] CSI error:', error);
      return {
        csiTrend: [],
        summary: {
          totalHappy: 0,
          totalNeutral: 0,
          totalSad: 0,
          avgCSI: 0,
        },
        channels: [],
        seriesByChannel: [],
        summaryByChannel: [],
      };
    }
  },
};
