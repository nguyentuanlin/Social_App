import apiClient from './api';

export interface Reaction {
  emoji: string;         // Emoji sử dụng (👍, ❤️, 😂, 😮, 😢, 😡)
  userId: string;        // ID người thả cảm xúc
  userType: 'customer' | 'agent';  // Loại người dùng
  userName?: string;     // Tên người thả cảm xúc
  createdAt: Date;       // Thời gian thả
  externalReactionId?: string; // ID từ Facebook nếu có
}

export interface ReactionSummary {
  emoji: string;         // Loại emoji
  count: number;         // Số người đã thả
  users: Array<{
    userId: string;
    userType: string;
    userName?: string;
    createdAt: Date;
  }>;
}

export interface ReactionRequest {
  messageId: string;
  emoji: string;
}

// Sử dụng API thật từ backend

export const reactionApi = {
  /**
   * Thêm reaction vào message
   */
  addReaction: async (request: ReactionRequest): Promise<Reaction> => {
    try {
    //   console.log('[API] Adding reaction request:', request);
    //   console.log('[API] Request URL:', '/chat/messages/reactions');
    //   console.log('[API] Request method:', 'POST');
      
      const response = await apiClient.post('/chat/messages/reactions', request);
    //   console.log('[API] Add reaction response status:', response.status);
    //   console.log('[API] Add reaction response data:', response.data);
      
      // Backend có thể trả về format khác nhau
      if (response.data.reaction) {
        return response.data.reaction;
      } else if (response.data.success && response.data.reaction) {
        return response.data.reaction;
      } else {
        // Fallback: tạo reaction object từ response
        return {
          emoji: request.emoji,
          userId: 'current-user',
          userType: 'agent',
          userName: 'Tôi',
          createdAt: new Date()
        };
      }
    } catch (error: any) {
      console.error('[API] Add reaction error:', error);
      console.error('[API] Error response:', error.response?.data);
      console.error('[API] Error status:', error.response?.status);
      console.error('[API] Error headers:', error.response?.headers);
      throw error;
    }
  },

  /**
   * Xóa reaction khỏi message
   */
  removeReaction: async (request: ReactionRequest): Promise<void> => {
    // console.log('[API] Removing reaction request:', request);
    const response = await apiClient.patch('/chat/messages/reactions/remove', request);
    // console.log('[API] Remove reaction response:', response.data);
  },

  /**
   * Lấy danh sách reactions của message
   */
  getMessageReactions: async (messageId: string): Promise<{
    messageId: string;
    reactions: Reaction[];
    summary: ReactionSummary[];
    totalReactions: number;
  }> => {
    // console.log('[API] Getting reactions for message:', messageId);
    const response = await apiClient.get(`/chat/messages/${messageId}/reactions`);
    // console.log('[API] Get reactions response:', response.data);
    return response.data;
  },
};
