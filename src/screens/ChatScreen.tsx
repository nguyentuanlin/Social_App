import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons, FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { chatApi, Conversation, Message } from '../services/apiChat';
import ChatInputBar from '../components/Chat/ChatInputBar';
import MessageBubble from '../components/Chat/MessageBubble';
import ConversationItem from '../components/Chat/ConversationItem';
import ChatActionButtons from '../components/Chat/ChatActionButtons';
import CustomerProfileModal from '../components/Chat/CustomerProfileModal';

interface ChatScreenProps {
  onBack?: () => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ onBack }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const flatListRef = React.useRef<FlatList>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[ChatScreen] Loading conversations...');
      
      const response = await chatApi.getConversations({ limit: 50 });
      console.log('[ChatScreen] Loaded conversations:', response.data.length);
      
      // Debug platform info
      if (response.data.length > 0) {
        const firstConv = response.data[0];
        console.log('[ChatScreen] First conversation channel:', firstConv.channel);
        console.log('[ChatScreen] Platform name:', 
          (firstConv.channel as any)?.socialNetwork?.name || 
          (firstConv.channel as any)?.social?.platform || 
          'unknown'
        );
      }
      
      setConversations(response.data);
      
      // Clear error nếu load thành công
      setError(null);
    } catch (error: any) {
      console.error('[ChatScreen] Error loading conversations:', error);
      setError(error.response?.data?.message || 'Không thể tải cuộc hội thoại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      console.log('[ChatScreen] Loading messages for conversation:', conversationId);
      const response = await chatApi.getMessages(conversationId, { limit: 100 });
      console.log('[ChatScreen] Loaded messages:', response.data.length);
      
      // Sort messages by sentAt (oldest to newest)
      const sortedMessages = [...response.data].sort((a, b) => {
        const dateA = new Date(a.sentAt).getTime();
        const dateB = new Date(b.sentAt).getTime();
        return dateA - dateB;
      });
      
      console.log('[ChatScreen] First message date:', sortedMessages[0]?.sentAt);
      console.log('[ChatScreen] Last message date:', sortedMessages[sortedMessages.length - 1]?.sentAt);
      
      setMessages(sortedMessages);
      
      // Mark as read (bỏ qua lỗi nếu endpoint không tồn tại)
      try {
        await chatApi.markAsRead(conversationId);
      } catch (readError) {
        console.log('[ChatScreen] Mark as read failed (optional):', readError);
      }
    } catch (error: any) {
      console.error('[ChatScreen] Error loading messages:', error);
      console.error('[ChatScreen] Error details:', error.response?.data);
      // Set empty messages array nếu lỗi
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || isSending) return;

    try {
      setIsSending(true);
      const newMessage = await chatApi.sendMessage({
        conversationId: selectedConversation.id,
        content: messageText.trim(),
        contentType: 'text',
      });

      setMessages([...messages, newMessage]);
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const renderPlatformIcon = (platform?: string) => {
    const iconSize = 12;
    const iconColor = '#FFFFFF';
    
    switch (platform?.toLowerCase()) {
      case 'facebook':
        return <FontAwesome name="facebook" size={iconSize} color={iconColor} />;
      case 'instagram':
        return <FontAwesome name="instagram" size={iconSize} color={iconColor} />;
      case 'telegram':
        return <FontAwesome name="telegram" size={iconSize} color={iconColor} />;
      case 'gmail':
      case 'email':
        return <MaterialIcons name="email" size={iconSize} color={iconColor} />;
      case 'zalo':
        return (
          <Image
            source={require('../../assets/zalo-logo.png')}
            style={{ width: iconSize, height: iconSize }}
            resizeMode="contain"
          />
        );
      case 'whatsapp':
        return <FontAwesome name="whatsapp" size={iconSize} color={iconColor} />;
      case 'viber':
        return <FontAwesome5 name="viber" size={iconSize} color={iconColor} />;
      case 'messenger':
        return <Ionicons name="chatbubble" size={iconSize} color={iconColor} />;
      default:
        return <MaterialIcons name="chat" size={iconSize} color={iconColor} />;
    }
  };

  const getPlatformColor = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'facebook':
        return '#1877F2';
      case 'instagram':
        return '#E4405F';
      case 'telegram':
        return '#0088CC';
      case 'gmail':
      case 'email':
        return '#EA4335';
      case 'zalo':
        return '#0068FF';
      case 'whatsapp':
        return '#25D366';
      case 'viber':
        return '#7360F2';
      case 'messenger':
        return '#00B2FF';
      default:
        return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'resolved':
        return '#3B82F6';
      case 'closed':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút`;
    if (diffHours < 24) return `${diffHours} giờ`;
    if (diffDays < 7) return `${diffDays} ngày`;
    
    return messageDate.toLocaleDateString('vi-VN');
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    // Get customer name from various possible fields
    const customerName = (item.customer as any)?.fullName || 
                        (item.customer as any)?.name || 
                        item.title || 
                        'Khách hàng';
    
    // Get platform from channel - check multiple possible fields
    const platform = (item.channel as any)?.socialNetwork?.name || 
                    (item.channel as any)?.socialNetwork?.platform ||
                    (item.channel as any)?.social?.name ||
                    (item.channel as any)?.social?.platform ||
                    (item.channel as any)?.platform ||
                    'unknown';
    
    // Get last message time - with proper validation
    let lastTime: Date | null = null;
    
    // Try to get from lastActivityAt first (most reliable)
    if ((item as any).lastActivityAt) {
      const parsed = new Date((item as any).lastActivityAt);
      if (!isNaN(parsed.getTime())) {
        lastTime = parsed;
      }
    }
    
    // Fallback to other fields
    if (!lastTime && item.lastMessageAt) {
      const parsed = new Date(item.lastMessageAt);
      if (!isNaN(parsed.getTime())) {
        lastTime = parsed;
      }
    }
    
    if (!lastTime && (item as any).updatedAt) {
      const parsed = new Date((item as any).updatedAt);
      if (!isNaN(parsed.getTime())) {
        lastTime = parsed;
      }
    }
    
    if (!lastTime && (item as any).createdAt) {
      const parsed = new Date((item as any).createdAt);
      if (!isNaN(parsed.getTime())) {
        lastTime = parsed;
      }
    }
    
    // Final fallback to current time
    if (!lastTime) {
      lastTime = new Date();
    }
    
    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          selectedConversation?.id === item.id && styles.conversationItemActive,
        ]}
        onPress={() => setSelectedConversation(item)}
      >
        <View style={styles.conversationAvatar}>
          {(item.customer as any)?.avatarUrl ? (
            <Image
              source={{ uri: (item.customer as any).avatarUrl }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {customerName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.platformBadge,
              { backgroundColor: getPlatformColor(platform) },
            ]}
          >
            {renderPlatformIcon(platform)}
          </View>
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.customerName} numberOfLines={1}>
              {customerName}
            </Text>
            <Text style={styles.timestamp}>
              {formatTime(lastTime)}
            </Text>
          </View>
          <View style={styles.conversationFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.title || 'Cuộc hội thoại mới'}
            </Text>
            {(item as any).unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{(item as any).unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    return (
      <MessageBubble
        content={item.content}
        contentType={item.contentType}
        senderType={item.senderType}
        sentAt={new Date(item.sentAt)}
        attachments={item.metadata?.attachments || (item as any).attachments}
        metadata={item.metadata}
      />
    );
  };

  // Conversation List View
  if (!selectedConversation) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={['#3B82F6', '#8B5CF6']} style={styles.header}>
          <View style={styles.headerContent}>
            {onBack && (
              <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>Tin nhắn</Text>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={async () => {
                setIsRefreshing(true);
                await loadConversations();
                setIsRefreshing(false);
              }}
              disabled={isRefreshing}
            >
              <MaterialIcons 
                name="refresh" 
                size={24} 
                color="#FFFFFF"
                style={isRefreshing ? { opacity: 0.5 } : {}}
              />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm cuộc hội thoại..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </LinearGradient>

        {/* Conversations List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Đang tải...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={64} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadConversations}>
              <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={conversations.filter((conv) => {
              if (!searchQuery.trim()) return true;
              const query = searchQuery.toLowerCase();
              const customerName = (conv.customer as any)?.fullName || 
                                  (conv.customer as any)?.name || 
                                  conv.title || '';
              return customerName.toLowerCase().includes(query);
            })}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyText}>Chưa có cuộc hội thoại nào</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadConversations}>
                  <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                  <Text style={styles.retryButtonText}>Tải lại</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>
    );
  }

  // Chat Window View
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Chat Header */}
      <LinearGradient colors={['#3B82F6', '#8B5CF6']} style={styles.chatHeader}>
        <View style={styles.chatHeaderLeft}>
          <TouchableOpacity
            onPress={() => setSelectedConversation(null)}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          
          {/* Avatar - Clickable */}
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => setProfileModalVisible(true)}
            activeOpacity={0.7}
          >
            {(selectedConversation.customer as any)?.avatarUrl ? (
              <Image
                source={{ uri: (selectedConversation.customer as any).avatarUrl }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarText}>
                  {((selectedConversation.customer as any)?.fullName || 
                    (selectedConversation.customer as any)?.name || 
                    selectedConversation.title || 
                    'K').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            
            {/* Platform Badge */}
            <View
              style={[
                styles.headerPlatformBadge,
                { 
                  backgroundColor: getPlatformColor(
                    (selectedConversation.channel as any)?.socialNetwork?.name || 
                    (selectedConversation.channel as any)?.social?.platform
                  ) 
                },
              ]}
            >
              {renderPlatformIcon(
                (selectedConversation.channel as any)?.socialNetwork?.name || 
                (selectedConversation.channel as any)?.social?.platform
              )}
            </View>
          </TouchableOpacity>
          
          {/* Info - Clickable */}
          <TouchableOpacity 
            style={styles.chatHeaderInfo}
            onPress={() => setProfileModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.chatHeaderName} numberOfLines={1}>
              {(selectedConversation.customer as any)?.fullName || 
               (selectedConversation.customer as any)?.name || 
               selectedConversation.title || 
               'Khách hàng'}
            </Text>
            <Text style={styles.chatHeaderStatus} numberOfLines={1}>
              {(selectedConversation.channel as any)?.socialNetwork?.name || 
               (selectedConversation.channel as any)?.social?.platform || 
               'Chat'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Action Buttons */}
      <ChatActionButtons
        onPinConversation={() => console.log('Pin conversation')}
        onViewHistory={() => console.log('View history')}
        onComposeEmail={() => console.log('Compose email')}
        onArchive={() => console.log('Archive')}
        onViewInfo={() => console.log('View info')}
        onTranslate={() => console.log('Translate')}
      />

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={[...messages].reverse()}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContent}
        inverted={true}
        ListEmptyComponent={
          <View style={styles.emptyMessagesContainer}>
            <MaterialIcons name="chat-bubble-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyMessagesText}>Chưa có tin nhắn nào</Text>
            <Text style={styles.emptyMessagesSubtext}>
              Hãy bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn đầu tiên
            </Text>
          </View>
        }
      />

      {/* Input Bar - New Component */}
      <ChatInputBar
        onSendMessage={async (message) => {
          if (!selectedConversation || isSending) return;
          
          try {
            setIsSending(true);
            const newMessage = await chatApi.sendMessage({
              conversationId: selectedConversation.id,
              content: message,
              contentType: 'text',
            });
            
            setMessages([...messages, newMessage]);
          } catch (error) {
            console.error('Error sending message:', error);
          } finally {
            setIsSending(false);
          }
        }}
        onSendImage={(imageUri) => {
          console.log('Send image:', imageUri);
          // TODO: Implement image upload
        }}
        onSendFile={(file) => {
          console.log('Send file:', file);
          // TODO: Implement file upload
        }}
        isSending={isSending}
      />

      {/* Customer Profile Modal */}
      {selectedConversation && (
        <CustomerProfileModal
          visible={profileModalVisible}
          onClose={() => setProfileModalVisible(false)}
          customer={selectedConversation.customer}
          conversation={selectedConversation}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    padding: 4,
    marginLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 24,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  conversationItemActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  conversationAvatar: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  platformBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  conversationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  emptyMessagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyMessagesText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessagesSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 44,
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  avatarContainer: {
    position: 'relative',
    marginLeft: 6,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerPlatformBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  chatHeaderInfo: {
    flex: 1,
    marginLeft: 8,
    minWidth: 0,
  },
  chatHeaderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chatHeaderStatus: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 0,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  messageLeft: {
    alignSelf: 'flex-start',
  },
  messageRight: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
  },
  messageBubbleCustomer: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  messageBubbleAgent: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextCustomer: {
    color: '#1F2937',
  },
  messageTextAgent: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeCustomer: {
    color: '#9CA3AF',
  },
  messageTimeAgent: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
});

export default ChatScreen;
