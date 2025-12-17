import apiClient from './api';

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';

export interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  completed: number;
  overdue: number;
  completedToday: number;
  completedThisWeek: number;
}

export interface EmployeeTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  channelName?: string;
  dueDate?: string;
  isOverdue?: boolean;
  createdByName?: string;
}

export const tasksApi = {
  /**
   * Lấy thống kê công việc của nhân viên hiện tại
   */
  getMyTaskStats: async (): Promise<TaskStats> => {
    try {
      const response = await apiClient.get('/employee-tasks/my-stats');
      return response.data as TaskStats;
    } catch (error) {
      console.error('[Tasks API] Error fetching my-stats:', error);
      return {
        total: 0,
        todo: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
        completedToday: 0,
        completedThisWeek: 0,
      };
    }
  },

  /**
   * Lấy danh sách công việc của tôi, có thể filter theo trạng thái
   */
  getMyTasks: async (status?: TaskStatus): Promise<EmployeeTask[]> => {
    try {
      const response = await apiClient.get('/employee-tasks/my-tasks', {
        params: status ? { status } : undefined,
      });
      return response.data as EmployeeTask[];
    } catch (error) {
      console.error('[Tasks API] Error fetching my-tasks:', error);
      return [];
    }
  },
};

