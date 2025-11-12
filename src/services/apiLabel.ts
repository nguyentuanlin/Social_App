import apiClient from './api';

export interface Label {
  id: string;
  name: string;
  color?: string;
  description?: string;
  category?: string;
  isSystem: boolean;
  status: string;
  autoReplyEnabled: boolean;
  weight?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageLabel {
  messageId: string;
  labelId: string;
  confidence?: number;
  assignedBy?: string;
  createdAt: string;
  label?: Label;
}

export interface CreateMessageLabelDto {
  messageId: string;
  labelId: string;
  confidence?: number;
  assignedBy?: string;
}

export interface TopLabel {
  labelId: string;
  labelName: string;
  count: number;
  color?: string;
  category?: string;
}

export interface LabelListResponse {
  data: Label[];
  total: number;
}

export const apiLabel = {
  async getLabels(params?: { page?: number; limit?: number; search?: string; category?: string; status?: string }): Promise<LabelListResponse> {
    const res = await apiClient.get('/labels', { params });
    return res.data;
  },
  async getMessageLabels(messageId: string): Promise<MessageLabel[]> {
    const res = await apiClient.get(`/message-labels/message/${messageId}`);
    return res.data;
  },
  async assignLabelToMessage(data: CreateMessageLabelDto): Promise<MessageLabel> {
    const res = await apiClient.post('/message-labels', data);
    return res.data;
  },
  async removeLabelFromMessage(messageId: string, labelId: string): Promise<void> {
    await apiClient.delete(`/message-labels/${messageId}/${labelId}`);
  },
  async getTopConversationLabels(conversationId: string, topN: number = 2): Promise<TopLabel[]> {
    const res = await apiClient.get(`/message-labels/conversation/${conversationId}/top-labels`, { params: { topN } });
    return res.data;
  },
  async getConversationMessageLabels(conversationId: string): Promise<MessageLabel[]> {
    const res = await apiClient.get(`/message-labels/conversation/${conversationId}/all-labels`);
    return res.data;
  }
};
