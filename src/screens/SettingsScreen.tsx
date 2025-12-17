import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomAlert from '../components/CustomAlert';

interface SettingsScreenProps {
  navigation: any;
}

const SESSION_TOTAL_MS = 24 * 60 * 60 * 1000; // 24h
const SESSION_EXPIRES_AT_KEY = 'session_expires_at';

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { user, updateUserLocal, logout } = useAuth();
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);
  const [remainingSession, setRemainingSession] = useState<string | null>(null);
  const [remainingPercent, setRemainingPercent] = useState<number>(1);

  // Load session time
  useEffect(() => {
    const interval = setInterval(() => {
      updateRemainingSession();
    }, 1000);
    updateRemainingSession();
    return () => clearInterval(interval);
  }, []);

  const updateRemainingSession = async () => {
    try {
      const raw = await AsyncStorage.getItem(SESSION_EXPIRES_AT_KEY);
      if (!raw) {
        setRemainingSession(null);
        return;
      }
      const expires = new Date(raw);
      if (isNaN(expires.getTime())) {
        setRemainingSession(null);
        return;
      }

      const diffMs = expires.getTime() - Date.now();
      if (diffMs <= 0) {
        setRemainingSession('Phiên đã hết hạn');
        setRemainingPercent(0);
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      let text = '';
      if (hours > 0) {
        text = `Còn ${hours} giờ ${minutes} phút ${seconds} giây`;
      } else {
        text = `Còn ${minutes} phút ${seconds} giây`;
      }
      setRemainingSession(text);

      const pct = Math.max(0, Math.min(1, diffMs / SESSION_TOTAL_MS));
      setRemainingPercent(pct);
    } catch {
      setRemainingSession(null);
    }
  };

  const handlePickImage = async (target: 'avatar' | 'cover') => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Cần quyền truy cập ảnh', 'Vui lòng cấp quyền truy cập thư viện ảnh để đổi ảnh.');
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
      Alert.alert('Thành công', `Đã cập nhật ${target === 'avatar' ? 'ảnh đại diện' : 'ảnh bìa'} thành công!`);
    } catch (err) {
      console.error('[SettingsScreen] pick image error:', err);
      Alert.alert('Lỗi', 'Không thể chọn ảnh. Vui lòng thử lại.');
    } finally {
      setUploading(null);
    }
  };

  const handleLogout = () => {
    setConfirmLogoutVisible(true);
  };

  const performLogout = async () => {
    try {
      setConfirmLogoutVisible(false);
      await new Promise(resolve => setTimeout(resolve, 300));
      await logout();
    } catch (error) {
      console.error('[SettingsScreen] ❌ Logout error:', error);
      if (Platform.OS === 'web') {
        window.alert('Lỗi: Không thể đăng xuất. Vui lòng thử lại.');
      } else {
        Alert.alert('Lỗi', 'Không thể đăng xuất. Vui lòng thử lại.');
      }
    }
  };


  if (!user) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cài đặt tài khoản</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Image Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ảnh bìa</Text>
          <View style={styles.coverContainer}>
            {user?.coverImage ? (
              <Image
                source={{ uri: user.coverImage }}
                style={styles.coverImage}
                blurRadius={0}
              />
            ) : (
              <LinearGradient
                colors={['#3B82F6', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.coverGradient}
              />
            )}
            
            <View style={styles.coverOverlay} />
            
            {uploading === 'cover' ? (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#FFFFFF" size="large" />
                <Text style={styles.uploadingText}>Đang tải...</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handlePickImage('cover')}
                style={styles.coverEditButton}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.4)']}
                  style={styles.coverEditInner}
                >
                  <MaterialIcons name="photo-camera" size={22} color="#FFFFFF" />
                  <Text style={styles.coverEditText}>Đổi ảnh bìa</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.sectionHint}>
            Ảnh bìa sẽ hiển thị ở đầu trang cá nhân của bạn
          </Text>
        </View>

        {/* Avatar Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ảnh đại diện</Text>
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {user?.fullname?.charAt(0) || 'U'}
                  </Text>
                </View>
              )}
              
              {uploading === 'avatar' ? (
                <View style={styles.avatarUploadingOverlay}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.avatarEditButton}
                  onPress={() => handlePickImage('avatar')}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="photo-camera" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.avatarInfo}>
              <Text style={styles.avatarInfoTitle}>Ảnh đại diện</Text>
              <Text style={styles.avatarInfoHint}>
                Nhấn vào biểu tượng camera để đổi ảnh đại diện
              </Text>
              <TouchableOpacity
                onPress={() => handlePickImage('avatar')}
                style={styles.avatarChangeButton}
                activeOpacity={0.7}
              >
                <Text style={styles.avatarChangeButtonText}>Chọn ảnh mới</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Session Time Section */}
        {remainingSession && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thời gian phiên</Text>
            <View style={styles.sessionCard}>
              <View style={styles.sessionHeaderRow}>
                <Text style={styles.sessionLabel}>Thời gian còn lại:</Text>
                <Text style={styles.sessionValue}>{remainingSession}</Text>
              </View>
              <View style={styles.sessionProgressTrack}>
                <View
                  style={[
                    styles.sessionProgressFill,
                    { width: `${Math.max(0, Math.min(1, remainingPercent)) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.sessionHint}>
                Phiên sẽ tự động hết hạn để đảm bảo an toàn.
              </Text>
            </View>
          </View>
        )}

        {/* Account Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin tài khoản</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <MaterialIcons name="person" size={20} color="#3B82F6" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Họ và tên</Text>
                <Text style={styles.infoValue}>{user.fullname || 'Chưa cập nhật'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <MaterialIcons name="email" size={20} color="#8B5CF6" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <MaterialIcons name="badge" size={20} color="#10B981" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Username</Text>
                <Text style={styles.infoValue}>{user.username}</Text>
              </View>
            </View>

            {user.user_tile && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIconContainer}>
                    <MaterialIcons name="verified" size={20} color="#F59E0B" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Vai trò</Text>
                    <Text style={styles.infoValue}>{user.user_tile}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Permissions Section */}
        {user.roles && user.roles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quyền hạn</Text>
            <View style={styles.rolesCard}>
              {user.roles.map((role, index) => (
                <View key={index} style={styles.roleChip}>
                  <MaterialIcons name="check-circle" size={16} color="#10B981" />
                  <Text style={styles.roleChipText}>{role}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Logout Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutButton}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoutButtonGradient}
          >
            <MaterialIcons name="logout" size={22} color="#FFFFFF" />
            <Text style={styles.logoutButtonText}>Đăng xuất</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Logout Confirmation */}
      <CustomAlert
        visible={confirmLogoutVisible}
        title="Đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất?"
        confirmText="Đăng xuất"
        cancelText="Hủy"
        type="danger"
        onCancel={() => setConfirmLogoutVisible(false)}
        onConfirm={performLogout}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  sectionHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  coverContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverGradient: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  coverEditButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  coverEditInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  coverEditText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  avatarEditButton: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInfo: {
    flex: 1,
    paddingTop: 8,
  },
  avatarInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  avatarInfoHint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  avatarChangeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarChangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  rolesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  roleChipText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '500',
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionLabel: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  sessionValue: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  sessionProgressTrack: {
    height: 6,
    borderRadius: 9999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 4,
  },
  sessionProgressFill: {
    height: '100%',
    borderRadius: 9999,
    backgroundColor: '#3B82F6',
  },
  sessionHint: {
    marginTop: 4,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  logoutButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsScreen;

