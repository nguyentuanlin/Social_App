import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import ProfileModal from '../components/ProfileModal';
import ChatScreen from './ChatScreen';
import { dashboardApi, DashboardStats, CSITrendData } from '../services/apiDashboard';
import * as ImagePicker from 'expo-image-picker';
import CSIChart from '../components/Chat/CSIChart';

const HomeScreen = () => {
  const { user, logout, updateUserLocal } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChatScreen, setShowChatScreen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const [csiTrend, setCsiTrend] = useState<CSITrendData | null>(null);
  const [selectedCSIChannelId, setSelectedCSIChannelId] = useState<string | 'all'>('all');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const [statsData, csiData] = await Promise.all([
        dashboardApi.getEmployeeStats(),
        dashboardApi.getCSITrend(),
      ]);
      setStats(statsData);
      setCsiTrend(csiData);
      if (csiData && Array.isArray(csiData.channels) && csiData.channels.length > 0) {
        setSelectedCSIChannelId(csiData.channels[0].id || 'all');
      } else {
        setSelectedCSIChannelId('all');
      }
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

  const handlePickImage = async (target: 'avatar' | 'cover') => {
    try {
      // console.log('[HomeScreen] Pick image for', target);
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Cần quyền truy cập ảnh');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: target === 'avatar' ? [1, 1] : [16, 9],
        quality: 0.9,
      });

      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setUploading(target);
      await updateUserLocal(target === 'avatar' ? { avatar: uri } : { coverImage: uri });
    } catch (err) {
      console.error('[HomeScreen] pick image error:', err);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    } finally {
      setUploading(null);
    }
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
        {/* Edit cover button */}
        <TouchableOpacity
          onPress={() => handlePickImage('cover')}
          style={styles.coverEditButton}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#00000055', '#00000022']} style={styles.coverEditInner}>
            <MaterialIcons name="photo-camera" size={20} color="#FFFFFF" />
            <Text style={styles.coverEditText}>Đổi ảnh bìa</Text>
          </LinearGradient>
        </TouchableOpacity>

        {uploading === 'cover' && (
          <View style={styles.coverUploadingOverlay}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        )}
        
        {/* Header Content */}
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>Xin chào,</Text>
            <Text style={styles.userName}>{user?.fullname || 'User'}</Text>
            <Text style={styles.userRole}>{user?.user_tile || 'User'}</Text>
          </View>
          <View style={styles.avatarWrapperHeader}>
            <TouchableOpacity onPress={() => setShowProfileModal(true)} activeOpacity={0.9}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{user?.fullname?.charAt(0) || 'U'}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarEditButton}
              onPress={() => handlePickImage('avatar')}
              activeOpacity={0.85}
            >
              {uploading === 'avatar' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <MaterialIcons name="photo-camera" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Stats Cards */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  style={styles.statGradient}
                >
                  <View style={styles.statIconWrap}>
                    <MaterialIcons name="chat-bubble" size={26} color="#FFFFFF" />
                  </View>
                  <Text style={styles.statValue}>{stats?.totalConversations || 0}</Text>
                  <Text style={styles.statLabel}>Cuộc hội thoại</Text>
                  <View style={styles.statShine} />
                </LinearGradient>
              </View>

              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  style={styles.statGradient}
                >
                  <View style={styles.statIconWrap}>
                    <MaterialIcons name="message" size={26} color="#FFFFFF" />
                  </View>
                  <Text style={styles.statValue}>{stats?.totalMessages || 0}</Text>
                  <Text style={styles.statLabel}>Tin nhắn</Text>
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
                  <View style={styles.statIconWrap}>
                    <MaterialIcons name="people" size={26} color="#FFFFFF" />
                  </View>
                  <Text style={styles.statValue}>{stats?.totalCustomers || 0}</Text>
                  <Text style={styles.statLabel}>Khách hàng</Text>
                  <View style={styles.statShine} />
                </LinearGradient>
              </View>

              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  style={styles.statGradient}
                >
                  <View style={styles.statIconWrap}>
                    <MaterialIcons name="link" size={26} color="#FFFFFF" />
                  </View>
                  <Text style={styles.statValue}>{stats?.totalChannels || 0}</Text>
                  <Text style={styles.statLabel}>Kênh kết nối</Text>
                  <View style={styles.statShine} />
                </LinearGradient>
              </View>
            </View>

            {csiTrend && csiTrend.csiTrend && csiTrend.csiTrend.length > 0 && (
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
            )}
          </>
        )}

        {/* Quick Actions */}
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
      </ScrollView>

      {/* Profile Modal */}
      <ProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
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
  coverEditButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  coverEditInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  coverEditText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  coverUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
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
  avatarEditButton: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  content: {
    flex: 1,
    padding: 20,
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
    marginBottom: 16,
    gap: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statGradient: {
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
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
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.92)',
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
