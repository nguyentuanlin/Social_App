import apiClient from './api';

export interface Conversation {
  id: string;
  customerId: string;
  channelId: string;
  status: 'active' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  lastMessageAt: Date;
  unreadCount: number;
  title?: string;
  customer?: {
    id: string;
    name?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    avatarUrl?: string;
  };
  channel?: {
    id: string;
    name: string;
    socialId: string;
    social?: {
      name: string;
      platform: string;
    };
    socialNetwork?: {
      name: string;
      displayName?: string;
    };
  };
  lastMessage?: {
    content: string;
    senderType: 'customer' | 'agent' | 'bot';
  };
  updatedAt?: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  contentType: 'text' | 'image' | 'file' | 'voice' | 'email';
  senderType: 'customer' | 'agent' | 'bot';
  sentAt: Date;
  metadata?: {
    attachments?: {
      files?: Array<{
        fileUrl: string;
        originalName: string;
        mimeType: string;
        size: number;
        duration?: number;
      }>;
    };
    transcript?: string;
    duration?: string;
    fileName?: string;
    fileSize?: string;
    [key: string]: any;
  };
  replyToMessageId?: string;
  replyToMessage?: Message;
}

export interface SendMessageDto {
  conversationId: string;
  content: string;
  contentType?: string;
  replyToMessageId?: string;
  sendToSocialNetwork?: boolean; // Gửi qua webhook đến social network
  attachments?: Array<{
    fileUrl: string;
    originalName?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
  }>;
}

export interface SendMessageResponse {
  success?: boolean;
  message?: Message;
  error?: string;
  userMessage?: string;
}

export const chatApi = {
  /**
   * Lấy danh sách conversations
   */
  getConversations: async (params?: {
    status?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Conversation[]; total: number }> => {
    try {
      console.log('[Chat API] Fetching conversations with params:', params);
      
      // Lấy channels được phân công cho user hiện tại
      let assignedChannelIds: string[] = [];
      try {
        const dashboardResponse = await apiClient.get('/employee-dashboard/overview');
        const assignedChannels = dashboardResponse.data.assignedChannels || [];
        assignedChannelIds = assignedChannels.map((ch: any) => ch.channelId);
        console.log('[Chat API] Assigned channel IDs:', assignedChannelIds);
      } catch (error) {
        console.warn('[Chat API] Could not fetch assigned channels, showing all conversations');
      }
      
      // Thêm filter theo channels được phân công
      const queryParams = {
        ...params,
        hasChannel: true, // Chỉ lấy conversations có channel
        ...(assignedChannelIds.length > 0 && { channelIds: assignedChannelIds.join(',') })
      };
      
      const response = await apiClient.get('/chat/conversations', { params: queryParams });
      console.log('[Chat API] Response:', response.data);
      
      // Handle different response formats
      if (Array.isArray(response.data)) {
        return { data: response.data, total: response.data.length };
      }
      
      const conversations = response.data.data || response.data.conversations || [];
      
      // Filter out conversations without customer or channel
      const validConversations = conversations.filter((conv: any) => 
        conv.customerId && conv.channelId
      );
      
      // Sort by lastActivityAt (newest first)
      validConversations.sort((a: any, b: any) => {
        const dateA = new Date(a.lastActivityAt || a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.lastActivityAt || b.updatedAt || b.createdAt).getTime();
        return dateB - dateA; // Newest first
      });
      
      // console.log('[Chat API] Valid conversations:', validConversations.length, 'out of', conversations.length);
      if (validConversations.length > 0) {
        const first = validConversations[0];
        console.log('[Chat API] First conversation data:', {
          id: first.id,
          lastActivityAt: first.lastActivityAt,
          updatedAt: first.updatedAt,
          createdAt: first.createdAt,
          lastMessageAt: first.lastMessageAt
        });
      }
      
      return {
        data: validConversations,
        total: validConversations.length,
      };
    } catch (error: any) {
      console.error('[Chat API] Error fetching conversations:', error);
      console.error('[Chat API] Error response:', error.response?.data);
      throw error;
    }
  },

  /**
   * Lấy chi tiết conversation
   */
  getConversation: async (id: string): Promise<Conversation> => {
    const response = await apiClient.get(`/chat/conversations/${id}`);
    return response.data;
  },

  /**
   * Lấy messages của conversation
   */
  getMessages: async (conversationId: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<{ data: Message[]; total: number }> => {
    try {
      // console.log('[Chat API] Fetching messages for conversation:', conversationId);
      // Backend trả về messages cùng với conversation detail
      const response = await apiClient.get(`/chat/conversations/${conversationId}`);
      // console.log('[Chat API] Conversation detail response:', response.data);
      
      // Extract messages from conversation detail
      const messages = response.data.messages || [];
      // console.log('[Chat API] Extracted messages:', messages.length);
      
      // Debug: Log first and last message dates
      // if (messages.length > 0) {
      //   console.log('[Chat API] First message:', {
      //     date: messages[0].sentAt || messages[0].createdAt,
      //     content: messages[0].content?.substring(0, 50)
      //   });
      //   console.log('[Chat API] Last message:', {
      //     date: messages[messages.length - 1].sentAt || messages[messages.length - 1].createdAt,
      //     content: messages[messages.length - 1].content?.substring(0, 50)
      //   });
      // }
      
      return {
        data: messages,
        total: messages.length,
      };
    } catch (error: any) {
      console.error('[Chat API] Error fetching messages:', error);
      console.error('[Chat API] Error details:', error.response?.data);
      throw error;
    }
  },

  /**
   * Gửi message với error handling như web app
   */
  sendMessage: async (data: SendMessageDto): Promise<SendMessageResponse> => {
    try {
      // console.log('[Chat API] Sending message:', data);
      
      // Mặc định gửi qua social network webhook
      const messageData = {
        ...data,
        sendToSocialNetwork: data.sendToSocialNetwork !== false, // Default true
      };
      
      const response = await apiClient.post('/chat/messages', messageData);
      
      // Kiểm tra nếu response có error (từ backend)
      if (response.data.success === false) {
        console.warn('[Chat API] Message send failed:', {
          error: response.data.error,
          userMessage: response.data.userMessage,
          time: new Date().toISOString()
        });
        
        return {
          success: false,
          message: response.data.message,
          error: response.data.error,
          userMessage: response.data.userMessage
        };
      }
      
      return {
        success: true,
        message: response.data
      };
      
    } catch (error: any) {
      console.error('[Chat API] Error sending message:', error);
      
      // Xử lý các lỗi HTTP
      if (error.response?.status === 400) {
        return {
          success: false,
          error: 'VALIDATION_ERROR',
          userMessage: 'Dữ liệu tin nhắn không hợp lệ'
        };
      } else if (error.response?.status === 404) {
        return {
          success: false,
          error: 'CONVERSATION_NOT_FOUND',
          userMessage: 'Không tìm thấy cuộc hội thoại'
        };
      } else {
        return {
          success: false,
          error: 'NETWORK_ERROR',
          userMessage: 'Lỗi kết nối. Vui lòng thử lại sau.'
        };
      }
    }
  },

  /**
   * Đánh dấu đã đọc (API chưa có trong backend)
   */
  markAsRead: async (conversationId: string): Promise<void> => {
    try {
      await apiClient.patch(`/chat/conversations/${conversationId}/read`, {});
    } catch (e) {
      // console.log('[API] markAsRead failed (non fatal):', e);
    }
  },

  /**
   * Cập nhật status conversation
   */
  updateStatus: async (conversationId: string, status: string): Promise<Conversation> => {
    const response = await apiClient.patch(`/chat/conversations/${conversationId}/status`, { status });
    return response.data;
  },

  /**
   * Polling messages mới (tạm thời disable để tránh lỗi 404)
   */
  pollMessages: async (conversationId: string, lastMessageId?: string): Promise<Message[]> => {
    // TODO: Implement proper polling API in backend
    // Tạm thời return empty array để tránh spam lỗi 404
    // console.log('[API] pollMessages called for conversation:', conversationId, 'lastMessageId:', lastMessageId);
    return [];
  },

  /**
   * Lấy thống kê chat
   */
  getStats: async (): Promise<any> => {
    try {
      const response = await apiClient.get('/chat/stats');
      return response.data;
    } catch (error) {
      console.error('[Chat API] Error fetching stats:', error);
      throw error;
    }
  },

  /**
   * Tìm kiếm tin nhắn
   */
  searchMessages: async (conversationId: string, keyword: string): Promise<Message[]> => {
    try {
      const response = await apiClient.get(`/chat/conversations/${conversationId}/search`, {
        params: { keyword }
      });
      return response.data;
    } catch (error) {
      console.error('[Chat API] Error searching messages:', error);
      return [];
    }
  },
};
