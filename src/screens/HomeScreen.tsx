import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView, 
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import ChatScreen from './ChatScreen';
import { dashboardApi, DashboardStats, CSITrendData } from '../services/apiDashboard';
import { tasksApi, TaskStats, EmployeeTask, TaskStatus } from '../services/apiTasks';
import CSIChart from '../components/Chat/CSIChart';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [showChatScreen, setShowChatScreen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [csiTrend, setCsiTrend] = useState<CSITrendData | null>(null);
  const [selectedCSIChannelId, setSelectedCSIChannelId] = useState<string | 'all'>('all');
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [isCSILoading, setIsCSILoading] = useState(false);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [taskModalTitle, setTaskModalTitle] = useState('');
  const [taskList, setTaskList] = useState<EmployeeTask[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'csi' | 'tasks'>('overview');
  const [sectionOffsets, setSectionOffsets] = useState<{ overview: number; csi: number; tasks: number }>({
    overview: 0,
    csi: 0,
    tasks: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const [statsData, myTasks] = await Promise.all([
        dashboardApi.getEmployeeStats(),
        tasksApi.getMyTaskStats(),
      ]);
      setStats(statsData);
      setTaskStats(myTasks);
      // Mặc định luôn chọn "Tất cả" cho bộ lọc CSI, dữ liệu CSI sẽ được load lười
      setSelectedCSIChannelId('all');
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadStats();
    setIsRefreshing(false);
  };


  const getCurrentAvgCSI = () => {
    if (!csiTrend) return 0;
    if (!selectedCSIChannelId || selectedCSIChannelId === 'all') {
      return csiTrend.summary?.avgCSI ?? 0;
    }
    const summary = csiTrend.summaryByChannel?.find((s) => s.channelId === selectedCSIChannelId);
    if (summary && typeof summary.avgCSI === 'number') {
      return summary.avgCSI;
    }
    return csiTrend.summary?.avgCSI ?? 0;
  };

  const getCurrentCSIPoints = () => {
    if (
      !csiTrend ||
      !csiTrend.seriesByChannel ||
      !Array.isArray(csiTrend.seriesByChannel) ||
      csiTrend.seriesByChannel.length === 0
    ) {
      return [] as { date: string; avgCSI: number }[];
    }

    const labels = csiTrend.seriesByChannel.map((row: any) => String(row.date));
    const channels = csiTrend.channels || [];

    const targetChannels = !selectedCSIChannelId || selectedCSIChannelId === 'all'
      ? channels
      : channels.filter((ch) => ch.id === selectedCSIChannelId);

    const palette = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#e11d48','#84cc16','#06b6d4','#f97316'];

    const series = targetChannels.map((ch, idx) => {
      const values = csiTrend.seriesByChannel.map((row: any) => {
        const v = row[ch.id];
        return typeof v === 'number' ? v : 0;
      });
      return {
        label: `${ch.name} (${ch.platform})`,
        color: palette[idx % palette.length],
        values,
      };
    });

    return { labels, series };
  };

  // Chỉ load dữ liệu CSI khi user cuộn xuống tới gần khu vực biểu đồ
  const ensureCSITrendLoaded = async () => {
    if (csiTrend || isCSILoading) return;
    try {
      setIsCSILoading(true);
      const csiData = await dashboardApi.getCSITrend();
      setCsiTrend(csiData);
      setSelectedCSIChannelId('all');
    } catch (err) {
      console.error('Error loading CSI trend:', err);
    } finally {
      setIsCSILoading(false);
    }
  };

  const handleScroll = (event: any) => {
    const { contentOffset } = event.nativeEvent;
    if (contentOffset?.y > 250) {
      ensureCSITrendLoaded();
    }
  };

  // Đảm bảo biểu đồ CSI luôn được load một lần sau khi màn hình khởi tạo
  useEffect(() => {
    ensureCSITrendLoaded();
  }, []);

  // Tải danh sách công việc khi người dùng chuyển sang tab Công việc
  useEffect(() => {
    if (activeTab === 'tasks') {
      ensureTasksLoaded();
    }
  }, [activeTab]);

  const scrollToSection = (key: 'overview' | 'csi' | 'tasks') => {
    const y = sectionOffsets[key] ?? 0;
    scrollRef.current?.scrollTo({ y, animated: true });
    setActiveTab(key);
    if (key === 'csi') {
      ensureCSITrendLoaded();
    }
  };

  const openTaskModal = async (filter: TaskStatus | 'overdue', title: string) => {
    try {
      setTaskModalTitle(title);
      setTaskModalVisible(true);
      setTaskLoading(true);

      let tasks: EmployeeTask[] = [];
      if (filter === 'overdue') {
        // Lấy tất cả, lọc quá hạn phía client
        tasks = await tasksApi.getMyTasks();
        tasks = tasks.filter((t) => t.isOverdue);
      } else {
        tasks = await tasksApi.getMyTasks(filter);
      }

      setTaskList(tasks);
    } catch (error) {
      console.error('[HomeScreen] Error loading tasks:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách công việc');
      setTaskList([]);
    } finally {
      setTaskLoading(false);
    }
  };

  const ensureTasksLoaded = async () => {
    if (taskLoading || taskList.length > 0) return;
    try {
      setTaskLoading(true);
      const tasks = await tasksApi.getMyTasks();
      setTaskList(tasks);
    } catch (error) {
      console.error('[HomeScreen] Error loading all tasks:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách công việc');
    } finally {
      setTaskLoading(false);
    }
  };

  // Show ChatScreen if active
  if (showChatScreen) {
    return <ChatScreen onBack={() => setShowChatScreen(false)} />;
  }

  return (
    <View style={styles.container}>
      {/* Header với Cover Image */}
      <View style={styles.headerContainer}>
        {/* Cover Image/Gradient Background */}
        {user?.coverImage ? (
          <Image
            source={{ uri: user.coverImage }}
            style={styles.coverImage}
            blurRadius={1}
          />
        ) : (
          <LinearGradient
            colors={['#3B82F6', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.coverGradient}
          />
        )}
        
        {/* Overlay để text dễ đọc */}
        <View style={styles.headerOverlay} />
        {/* Settings button - Simple icon only */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings' as never)}
          style={styles.settingsButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="settings" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        {/* Header Content */}
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>Xin chào,</Text>
            <Text style={styles.userName}>{user?.fullname || 'User'}</Text>
            <Text style={styles.userRole}>{user?.user_tile || 'User'}</Text>
          </View>
          <View style={styles.avatarWrapperHeader}>
            <TouchableOpacity onPress={() => navigation.navigate('Settings' as never)} activeOpacity={0.9}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{user?.fullname?.charAt(0) || 'U'}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Quick Actions - chức năng chính đặt lên đầu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tính năng</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => setShowChatScreen(true)}
          >
            <View style={styles.actionIconContainer}>
              <MaterialIcons name="chat-bubble-outline" size={28} color="#3B82F6" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Chat</Text>
              <Text style={styles.actionDescription}>
                Quản lý cuộc hội thoại
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Tabs chuyển nhanh tới từng phần trong dashboard */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.tabChip,
              activeTab === 'overview' && styles.tabChipActive,
            ]}
            onPress={() => setActiveTab('overview')}
          >
            <Text
              style={[
                styles.tabChipText,
                activeTab === 'overview' && styles.tabChipTextActive,
              ]}
            >
              Tổng quan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabChip,
              activeTab === 'csi' && styles.tabChipActive,
            ]}
            onPress={() => {
              setActiveTab('csi');
              ensureCSITrendLoaded();
            }}
          >
            <Text
              style={[
                styles.tabChipText,
                activeTab === 'csi' && styles.tabChipTextActive,
              ]}
            >
              CSI
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabChip,
              activeTab === 'tasks' && styles.tabChipActive,
            ]}
            onPress={() => {
              setActiveTab('tasks');
              ensureTasksLoaded();
            }}
          >
            <Text
              style={[
                styles.tabChipText,
                activeTab === 'tasks' && styles.tabChipTextActive,
              ]}
            >
              Công việc
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards + CSI + Công việc theo từng tab */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
          </View>
        ) : (
          <>
            {/* Tab: Tổng quan */}
            {activeTab === 'overview' && (
              <>
                <View style={styles.statsContainer}>
                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['#3B82F6', '#2563EB']}
                      style={styles.statGradient}
                    >
                      <View style={styles.statHeaderRow}>
                        <View style={styles.statIconWrap}>
                          <MaterialIcons name="chat-bubble" size={26} color="#FFFFFF" />
                        </View>
                        <View style={styles.statHeaderText}>
                          <Text style={styles.statTitle}>Cuộc hội thoại</Text>
                          <Text style={styles.statSubtitle}>Tổng tất cả kênh</Text>
                        </View>
                      </View>

                      <Text style={styles.statValue}>{stats?.totalConversations || 0}</Text>

                      <View style={styles.statFooterRow}>
                        <View style={styles.statPill}>
                          <View style={[styles.statPillDot, { backgroundColor: '#FACC15' }]} />
                          <Text style={styles.statPillText}>
                            Đang chờ: {stats?.pendingConversations || 0}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.statShine} />
                    </LinearGradient>
                  </View>

                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['#8B5CF6', '#7C3AED']}
                      style={styles.statGradient}
                    >
                      <View style={styles.statHeaderRow}>
                        <View style={styles.statIconWrap}>
                          <MaterialIcons name="message" size={26} color="#FFFFFF" />
                        </View>
                        <View style={styles.statHeaderText}>
                          <Text style={styles.statTitle}>Tin nhắn</Text>
                          <Text style={styles.statSubtitle}>Tất cả cuộc hội thoại</Text>
                        </View>
                      </View>

                      <Text style={styles.statValue}>{stats?.totalMessages || 0}</Text>

                      <View style={styles.statFooterRow}>
                        <View style={styles.statPill}>
                          <View style={[styles.statPillDot, { backgroundColor: '#FB7185' }]} />
                          <Text style={styles.statPillText}>
                            Chưa đọc: {stats?.unreadMessages || 0}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.statShine} />
                    </LinearGradient>
                  </View>
                </View>

                <View style={styles.statsContainer}>
                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      style={styles.statGradient}
                    >
                      <View style={styles.statHeaderRow}>
                        <View style={styles.statIconWrap}>
                          <MaterialIcons name="people" size={26} color="#FFFFFF" />
                        </View>
                        <View style={styles.statHeaderText}>
                          <Text style={styles.statTitle}>Khách hàng</Text>
                          <Text style={styles.statSubtitle}>Trong phạm vi được phân quyền</Text>
                        </View>
                      </View>

                      <Text style={styles.statValue}>{stats?.totalCustomers || 0}</Text>

                      <View style={styles.statFooterRow}>
                        <Text style={styles.statFooterHint}>
                          Dựa trên dữ liệu khách hàng đồng bộ từ CRM
                        </Text>
                      </View>

                      <View style={styles.statShine} />
                    </LinearGradient>
                  </View>

                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['#F59E0B', '#D97706']}
                      style={styles.statGradient}
                    >
                      <View style={styles.statHeaderRow}>
                        <View style={styles.statIconWrap}>
                          <MaterialIcons name="link" size={26} color="#FFFFFF" />
                        </View>
                        <View style={styles.statHeaderText}>
                          <Text style={styles.statTitle}>Kênh kết nối</Text>
                          <Text style={styles.statSubtitle}>Fanpage, Zalo, Instagram...</Text>
                        </View>
                      </View>

                      <Text style={styles.statValue}>{stats?.totalChannels || 0}</Text>

                      <View style={styles.statFooterRow}>
                        <Text style={styles.statFooterHint}>
                          Chỉ tính các kênh đã được gán cho bạn
                        </Text>
                      </View>

                      <View style={styles.statShine} />
                    </LinearGradient>
                  </View>
                </View>
              </>
            )}

            {/* Tab: CSI */}
            {activeTab === 'csi' && csiTrend && csiTrend.csiTrend && csiTrend.csiTrend.length > 0 && (
              <View
                onLayout={(e) => {
                  const y = e.nativeEvent.layout.y;
                  setSectionOffsets((prev) => ({ ...prev, csi: y }));
                }}
              >
                <View style={styles.csiSection}>
                  <View style={styles.csiHeaderRow}>
                    <View style={styles.csiTitleBlock}>
                      <Text style={styles.csiTitle}>Chỉ số hài lòng khách hàng (CSI)</Text>
                      <Text style={styles.csiSubtitle}>Xu hướng 7 ngày gần đây</Text>
                    </View>
                    <View style={styles.csiBadge}>
                      <Text style={styles.csiBadgeLabel}>CSI trung bình</Text>
                      <Text style={styles.csiBadgeValue}>
                        {getCurrentAvgCSI().toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {csiTrend.channels && csiTrend.channels.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.csiChannelScroll}
                      contentContainerStyle={styles.csiChannelScrollContent}
                    >
                      <TouchableOpacity
                        style={[
                          styles.csiChannelChip,
                          selectedCSIChannelId === 'all' && styles.csiChannelChipActive,
                        ]}
                        onPress={() => setSelectedCSIChannelId('all')}
                      >
                        <Text
                          style={[
                            styles.csiChannelChipText,
                            selectedCSIChannelId === 'all' && styles.csiChannelChipTextActive,
                          ]}
                        >
                          Tất cả
                        </Text>
                      </TouchableOpacity>
                      {csiTrend.channels.map((ch) => (
                        <TouchableOpacity
                          key={ch.id}
                          style={[
                            styles.csiChannelChip,
                            selectedCSIChannelId === ch.id && styles.csiChannelChipActive,
                          ]}
                          onPress={() => setSelectedCSIChannelId(ch.id)}
                        >
                          <Text
                            style={[
                              styles.csiChannelChipText,
                              selectedCSIChannelId === ch.id && styles.csiChannelChipTextActive,
                            ]}
                          >
                            {ch.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}

                  {(() => {
                    const multi = getCurrentCSIPoints() as any;
                    return (
                      <>
                        <CSIChart
                          title="Biểu đồ CSI theo thời gian"
                          multiSeries={multi}
                        />

                        {multi && multi.series && multi.series.length > 0 && (
                          <View style={styles.csiChannelLegendRow}>
                            {multi.series.map((s: any, idx: number) => (
                              <View key={idx} style={styles.csiChannelLegendItem}>
                                <View
                                  style={[
                                    styles.csiChannelLegendDot,
                                    { backgroundColor: s.color || '#3B82F6' },
                                  ]}
                                />
                                <Text style={styles.csiChannelLegendText} numberOfLines={1}>
                                  {s.label}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </>
                    );
                  })()}

                  <View style={styles.csiLegendRow}>
                    <View style={styles.csiLegendItem}>
                      <View style={[styles.csiLegendDot, { backgroundColor: '#10B981' }]} />
                      <Text style={styles.csiLegendText}>
                        Hài lòng: {csiTrend.summary.totalHappy}
                      </Text>
                    </View>
                    <View style={styles.csiLegendItem}>
                      <View style={[styles.csiLegendDot, { backgroundColor: '#F59E0B' }]} />
                      <Text style={styles.csiLegendText}>
                        Trung tính: {csiTrend.summary.totalNeutral}
                      </Text>
                    </View>
                    <View style={styles.csiLegendItem}>
                      <View style={[styles.csiLegendDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={styles.csiLegendText}>
                        Không hài lòng: {csiTrend.summary.totalSad}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Tab: Công việc */}
            {activeTab === 'tasks' && taskStats && (
              <View
                style={styles.taskSection}
                onLayout={(e) => {
                  const y = e.nativeEvent.layout.y;
                  setSectionOffsets((prev) => ({ ...prev, tasks: y }));
                }}
              >
                <View style={styles.taskHeaderRow}>
                  <View style={styles.taskTitleBlock}>
                    <Text style={styles.taskTitle}>Công việc của tôi</Text>
                    <Text style={styles.taskSubtitle}>
                      Các nhiệm vụ được giao cho bạn hôm nay
                    </Text>
                  </View>
                  <View style={styles.taskChipsRow}>
                    <View style={[styles.taskChip, { backgroundColor: '#FEE2E2' }]}>
                      <MaterialIcons name="warning-amber" size={14} color="#DC2626" />
                      <Text style={[styles.taskChipText, { color: '#DC2626' }]}>
                        {taskStats.overdue} quá hạn
                      </Text>
                    </View>
                    <View style={[styles.taskChip, { backgroundColor: '#DCFCE7' }]}>
                      <MaterialIcons name="check-circle" size={14} color="#16A34A" />
                      <Text style={[styles.taskChipText, { color: '#166534' }]}>
                        {taskStats.completedToday} hoàn thành hôm nay
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.taskKpiRow}>
                  <View style={styles.taskKpiCard}>
                    <Text style={styles.taskKpiValue}>{taskStats.todo}</Text>
                    <Text style={styles.taskKpiLabel}>Cần làm</Text>
                  </View>
                  <View style={styles.taskKpiCard}>
                    <Text style={styles.taskKpiValue}>{taskStats.inProgress}</Text>
                    <Text style={styles.taskKpiLabel}>Đang làm</Text>
                  </View>
                  <View style={styles.taskKpiCard}>
                    <Text style={styles.taskKpiValue}>{taskStats.completed}</Text>
                    <Text style={styles.taskKpiLabel}>Hoàn thành</Text>
                  </View>
                  <View style={styles.taskKpiCard}>
                    <Text style={styles.taskKpiValue}>{taskStats.overdue}</Text>
                    <Text style={styles.taskKpiLabel}>Quá hạn</Text>
                  </View>
                </View>

                {/* Danh sách công việc hiển thị ngay bên dưới */}
                {taskLoading ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#3B82F6" />
                    <Text style={{ marginTop: 6, color: '#6B7280', fontSize: 13 }}>
                      Đang tải danh sách công việc...
                    </Text>
                  </View>
                ) : taskList.length === 0 ? (
                  <View style={styles.taskModalEmpty}>
                    <Text style={styles.taskModalEmptyText}>
                      Không có công việc nào trong mục này
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 8 }}>
                    {taskList.map((task) => (
                      <View key={task.id} style={styles.taskItemCard}>
                        <View style={styles.taskItemHeader}>
                          <Text style={styles.taskItemTitle} numberOfLines={2}>
                            {task.title}
                          </Text>
                          {task.isOverdue && (
                            <View style={styles.taskItemOverdueBadge}>
                              <Text style={styles.taskItemOverdueText}>Quá hạn</Text>
                            </View>
                          )}
                        </View>
                        {task.description ? (
                          <Text style={styles.taskItemDescription} numberOfLines={2}>
                            {task.description}
                          </Text>
                        ) : null}
                        <View style={styles.taskItemMetaRow}>
                          <Text style={styles.taskItemMetaText}>
                            {task.status === 'todo'
                              ? 'Cần làm'
                              : task.status === 'in_progress'
                              ? 'Đang làm'
                              : task.status === 'completed'
                              ? 'Hoàn thành'
                              : 'Đã hủy'}
                          </Text>
                          {task.channelName ? (
                            <Text style={styles.taskItemMetaText}>{task.channelName}</Text>
                          ) : null}
                          {task.dueDate ? (
                            <Text style={styles.taskItemMetaText}>
                              Hạn: {new Date(task.dueDate).toLocaleString('vi-VN')}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Task list modal */}
      <Modal
        visible={taskModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTaskModalVisible(false)}
      >
        <View style={styles.taskModalBackdrop}>
          <View style={styles.taskModalContainer}>
            <View style={styles.taskModalHeader}>
              <Text style={styles.taskModalTitle}>{taskModalTitle}</Text>
              <TouchableOpacity onPress={() => setTaskModalVisible(false)}>
                <MaterialIcons name="close" size={22} color="#4B5563" />
              </TouchableOpacity>
            </View>

            {taskLoading ? (
              <View style={styles.taskModalLoading}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.taskModalLoadingText}>Đang tải công việc...</Text>
              </View>
            ) : taskList.length === 0 ? (
              <View style={styles.taskModalEmpty}>
                <Text style={styles.taskModalEmptyText}>
                  Không có công việc nào trong mục này
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.taskModalList}>
                {taskList.map((task) => (
                  <View key={task.id} style={styles.taskItemCard}>
                    <View style={styles.taskItemHeader}>
                      <Text style={styles.taskItemTitle} numberOfLines={2}>
                        {task.title}
                      </Text>
                      {task.isOverdue && (
                        <View style={styles.taskItemOverdueBadge}>
                          <Text style={styles.taskItemOverdueText}>Quá hạn</Text>
                        </View>
                      )}
                    </View>
                    {task.description ? (
                      <Text style={styles.taskItemDescription} numberOfLines={2}>
                        {task.description}
                      </Text>
                    ) : null}
                    <View style={styles.taskItemMetaRow}>
                      {task.channelName ? (
                        <Text style={styles.taskItemMetaText}>{task.channelName}</Text>
                      ) : null}
                      {task.dueDate ? (
                        <Text style={styles.taskItemMetaText}>
                          Hạn: {new Date(task.dueDate).toLocaleString('vi-VN')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  headerContainer: {
    height: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  coverImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  settingsButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 60,
  },
  avatarWrapperHeader: {
    position: 'relative',
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userRole: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  contentContainer: {
    paddingBottom: 96, // chừa khoảng trống dưới để không bị dính cạnh
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
    columnGap: 12,
    rowGap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '48%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  statGradient: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'stretch',
    position: 'relative',
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statHeaderText: {
    marginLeft: 10,
    flexShrink: 1,
  },
  statTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EFF6FF',
  },
  statSubtitle: {
    fontSize: 11,
    color: 'rgba(239,246,255,0.9)',
    marginTop: 2,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statFooterRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statPillText: {
    fontSize: 11,
    color: '#E5E7EB',
    fontWeight: '500',
  },
  statFooterHint: {
    fontSize: 11,
    color: 'rgba(249,250,251,0.9)',
  },
  statShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  section: {
    marginTop: 32,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  taskSection: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  taskHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  taskTitleBlock: {
    flexShrink: 1,
    paddingRight: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  taskSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  taskChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  taskChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskKpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  taskKpiCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  taskKpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  taskKpiLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  tabChip: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  tabChipActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59,130,246,0.06)',
  },
  tabChipText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  taskModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  taskModalContainer: {
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  taskModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  taskModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  taskModalLoading: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskModalLoadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  taskModalEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskModalEmptyText: {
    fontSize: 13,
    color: '#6B7280',
  },
  taskModalList: {
    marginTop: 4,
  },
  taskItemCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(209,213,219,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#F9FAFB',
  },
  taskItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  taskItemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginRight: 8,
  },
  taskItemOverdueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FEE2E2',
  },
  taskItemOverdueText: {
    fontSize: 10,
    color: '#B91C1C',
    fontWeight: '700',
  },
  taskItemDescription: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  taskItemMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 8,
  },
  taskItemMetaText: {
    fontSize: 11,
    color: '#6B7280',
  },
  csiSection: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  csiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  csiTitleBlock: {
    flexShrink: 1,
    paddingRight: 8,
  },
  csiTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  csiSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  csiBadge: {
    minWidth: 80,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.06)',
    alignItems: 'flex-end',
  },
  csiBadgeLabel: {
    fontSize: 9,
    color: '#6B7280',
  },
  csiBadgeValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  csiLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 8,
  },
  csiLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  csiLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  csiLegendText: {
    fontSize: 11,
    color: '#6B7280',
  },
  csiChannelLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 2,
    gap: 8,
  },
  csiChannelLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '48%',
  },
  csiChannelLegendDot: {
    width: 12,
    height: 4,
    borderRadius: 2,
    marginRight: 4,
  },
  csiChannelLegendText: {
    fontSize: 11,
    color: '#4B5563',
  },
  csiChannelScroll: {
    marginTop: 4,
    marginBottom: 4,
  },
  csiChannelScrollContent: {
    paddingVertical: 4,
    paddingRight: 4,
  },
  csiChannelChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.9)',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  csiChannelChipActive: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderColor: '#3B82F6',
  },
  csiChannelChipText: {
    fontSize: 12,
    color: '#4B5563',
  },
  csiChannelChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
});

export default HomeScreen;
