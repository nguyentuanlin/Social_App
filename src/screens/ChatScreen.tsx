import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
  Alert,
  Dimensions,
  Animated,
  Clipboard,
} from 'react-native';
import { MaterialIcons, FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { chatApi, Conversation, Message } from '../services/apiChat';
import { apiLabel, MessageLabel as MsgLabel, TopLabel, Label } from '../services/apiLabel';
import { reactionApi, Reaction, ReactionSummary } from '../services/apiReactions';
import ChatInputBar from '../components/Chat/ChatInputBar';
import MessageBubble from '../components/Chat/MessageBubble';
import ConversationItem from '../components/Chat/ConversationItem';
import ChatActionButtons from '../components/Chat/ChatActionButtons';
import CustomerProfileModal from '../components/Chat/CustomerProfileModal';
import ReactionOverlay from '../components/Chat/ReactionOverlay';
import ReactionDetails from '../components/Chat/ReactionDetails';

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
  const [topLabelsMap, setTopLabelsMap] = useState<Record<string, TopLabel[]>>({});
  const [messageLabelsMap, setMessageLabelsMap] = useState<Record<string, MsgLabel[]>>({});
  const [convExtraLabelsMap, setConvExtraLabelsMap] = useState<Record<string, number>>({});
  const [labelsModalVisible, setLabelsModalVisible] = useState(false);
  const [labelsModalItems, setLabelsModalItems] = useState<TopLabel[]>([]);
  const [labelsModalTitle, setLabelsModalTitle] = useState<string>('');
  const [labelsModalLoading, setLabelsModalLoading] = useState(false);
  const [msgLabelsVisible, setMsgLabelsVisible] = useState(false);
  const [msgLabelsLoading, setMsgLabelsLoading] = useState(false);
  const [msgLabelsAll, setMsgLabelsAll] = useState<Label[]>([]);
  const [msgLabelsMessageId, setMsgLabelsMessageId] = useState<string | null>(null);
  const [msgLabelsTitle, setMsgLabelsTitle] = useState<string>('');
  const [ctxVisible, setCtxVisible] = useState(false);
  const [ctxAnchor, setCtxAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [ctxMsgId, setCtxMsgId] = useState<string | null>(null);
  const [ctxFromCustomer, setCtxFromCustomer] = useState<boolean>(true);
  const [ctxContent, setCtxContent] = useState<string>('');
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const pillScale = useRef(new Animated.Value(0.8)).current;
  const menuScale = useRef(new Animated.Value(0.8)).current;
  
  // Reaction states
  const [messageReactionMap, setMessageReactionMap] = useState<Record<string, ReactionSummary[]>>({});
  const [currentReactingMessage, setCurrentReactingMessage] = useState<string | null>(null);
  const [reactionDetailsVisible, setReactionDetailsVisible] = useState(false);
  const [selectedMessageReactions, setSelectedMessageReactions] = useState<ReactionSummary[]>([]);
  
  // Toast notification state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  
  // Real-time polling
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Utilities for contrast color
  const getTextColorForBg = (hex: string) => {
    const c = hex?.replace('#', '');
    if (c?.length === 6) {
      const r = parseInt(c.slice(0, 2), 16);
      const g = parseInt(c.slice(2, 4), 16);
      const b = parseInt(c.slice(4, 6), 16);
      // Relative luminance
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return lum > 180 ? '#111827' : '#FFFFFF';
    }
    return '#FFFFFF';
  };

  // Real-time polling functions
  const startPolling = (conversationId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    setIsPolling(true);
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : undefined;
        const newMessages = await chatApi.pollMessages(conversationId, lastMessageId);
        
        if (newMessages.length > 0) {
          console.log('[Polling] Received new messages:', newMessages.length);
          setMessages(prev => [...prev, ...newMessages]);
          
          // Scroll to bottom khi có tin nhắn mới
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 100);
        }
      } catch (error) {
        console.error('[Polling] Error:', error);
      }
    }, 3000); // Poll mỗi 3 giây
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  };

  // Cleanup polling khi component unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Start/stop polling khi chọn conversation (tạm thời disable)
  useEffect(() => {
    if (selectedConversation) {
      // TODO: Enable polling khi backend có API /poll
      // startPolling(selectedConversation.id);
      console.log('[Polling] Disabled - waiting for backend API implementation');
    } else {
      stopPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [selectedConversation?.id]);

  const openMessageLabelPicker = async (messageId: string) => {
    setMsgLabelsVisible(true);
    setMsgLabelsMessageId(messageId);
    setMsgLabelsTitle('Gắn nhãn cho tin nhắn');
    setMsgLabelsLoading(true);
    try {
      const res = await apiLabel.getLabels({ limit: 200 });
      setMsgLabelsAll(res.data || []);
    } catch {
      setMsgLabelsAll([]);
    } finally {
      setMsgLabelsLoading(false);
    }
  };

  const isLabelAssigned = (messageId: string, labelId: string) => {
    const list = messageLabelsMap[messageId] || [];
    return list.some((ml) => ml.labelId === labelId);
  };

  const toggleAssignLabel = async (messageId: string, label: Label) => {
    const assigned = isLabelAssigned(messageId, label.id);
    try {
      if (assigned) {
        await apiLabel.removeLabelFromMessage(messageId, label.id);
        const next = { ...(messageLabelsMap || {}) };
        next[messageId] = (next[messageId] || []).filter((ml) => ml.labelId !== label.id);
        setMessageLabelsMap(next);
      } else {
        const created = await apiLabel.assignLabelToMessage({ messageId, labelId: label.id });
        const next = { ...(messageLabelsMap || {}) };
        next[messageId] = [...(next[messageId] || []), created];
        setMessageLabelsMap(next);
      }
    } catch (e) {
      // console.log('Label toggle failed', e);
    }
  };

  const handleReply = (messageId: string) => {
    const m = messages.find((x) => x.id === messageId);
    const quote = (m?.content || '').split('\n').map((l) => `> ${l}`).join('\n');
    setMessageText(quote ? `${quote}\n` : '');
  };

  const handleTranslate = (messageId: string) => {
    const m = messages.find((x) => x.id === messageId);
    const txt = m?.content ? m.content.slice(0, 120) : '';
    Alert.alert('Dịch tin nhắn', txt || '');
  };

  const handleMore = (messageId: string) => {
    Alert.alert('Thêm', 'Hành động sẽ cập nhật sau');
  };

  const openContextFromBubble = (params: { id: string; anchor: { x: number; y: number; width: number; height: number }; isFromCustomer: boolean; content?: string }) => {
    setCtxMsgId(params.id);
    setCtxAnchor(params.anchor);
    setCtxFromCustomer(params.isFromCustomer);
    setCtxContent(params.content || '');
    setCtxVisible(true);
    
    // Animate in
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(pillScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(menuScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeContext = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(pillScale, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(menuScale, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCtxVisible(false);
      setCtxAnchor(null);
      setCtxMsgId(null);
    });
  };

  const openConversationLabels = async (conversation: Conversation) => {
    setLabelsModalVisible(true);
    const cname = (conversation.customer as any)?.fullName ||
                  (conversation.customer as any)?.name ||
                  conversation.title ||
                  'Khách hàng';
    setLabelsModalTitle(`Nhãn của ${cname}`);
    setLabelsModalLoading(true);
    try {
      const all = await apiLabel.getConversationMessageLabels(conversation.id);
      const counter: Record<string, { labelId: string; labelName: string; color?: string; count: number }> = {};
      for (const ml of all as any[]) {
        const id = ml.labelId;
        const name = ml.label?.name || ml.labelId;
        const color = ml.label?.color;
        if (!counter[id]) counter[id] = { labelId: id, labelName: name, color, count: 0 };
        counter[id].count += 1;
      }
      const items: TopLabel[] = Object.values(counter)
        .sort((a, b) => b.count - a.count)
        .map(i => ({ labelId: i.labelId, labelName: i.labelName, color: i.color, count: i.count }));
      setLabelsModalItems(items);
    } catch (e) {
      setLabelsModalItems([]);
    } finally {
      setLabelsModalLoading(false);
    }
  };

  // Simple label chip for reuse (inline styles to avoid RN TS typing issues)
  const LabelChip: React.FC<{ color?: string; text: string }> = ({ color = '#6B7280', text }) => {
    const textColor = getTextColorForBg(color);
    return (
      <View
        style={{
          backgroundColor: color,
          borderRadius: 4,
          paddingHorizontal: 8,
          paddingVertical: 2,
          minHeight: 20,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.08)'
        }}
      >
        <Text style={{ color: textColor, fontSize: 11, fontWeight: '600' }}>{text}</Text>
      </View>
    );
  };

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
      // console.log('[ChatScreen] Loading conversations...');
      
      const response = await chatApi.getConversations({ limit: 50 });
      // console.log('[ChatScreen] Loaded conversations:', response.data.length);
      
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
      // Load top labels for conversations (best-effort)
      try {
        const convs = response.data.slice(0, 20); // limit to 20 to avoid too many requests
        const results = await Promise.all(
          convs.map(async (c) => {
            try {
              const labels = await apiLabel.getTopConversationLabels(c.id, 2);
              return { id: c.id, labels };
            } catch (e) {
              return { id: c.id, labels: [] as TopLabel[] };
            }
          })
        );
        const map: Record<string, TopLabel[]> = {};
        results.forEach(r => { map[r.id] = r.labels; });
        setTopLabelsMap(map);
      } catch (e) {
        // ignore
      }
      // Compute extras count (+N) using all labels for first 15 conversations
      try {
        const convs = response.data.slice(0, 15);
        const extraPairs = await Promise.all(
          convs.map(async (c) => {
            try {
              const all = await apiLabel.getConversationMessageLabels(c.id);
              const uniqueIds = Array.from(new Set(all.map((ml: any) => ml.labelId)));
              const shown = Math.min(2, (topLabelsMap[c.id] || []).length);
              const extras = Math.max(0, uniqueIds.length - shown);
              return { id: c.id, extras };
            } catch {
              return { id: c.id, extras: 0 };
            }
          })
        );
        const extrasMap: Record<string, number> = {};
        extraPairs.forEach(p => { extrasMap[p.id] = p.extras; });
        setConvExtraLabelsMap(extrasMap);
      } catch {}
      
      // Clear error nếu load thành công
      setError(null);
    } catch (error: any) {
      console.error('[ChatScreen] Error loading conversations:', error);
      setError(error.response?.data?.message || 'Không thể tải cuộc hội thoại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reaction handlers
  const handleAddReaction = async (messageId: string, emoji: string) => {
    try {
      await reactionApi.addReaction({ messageId, emoji });
      // Refresh reaction display
      const reactions = await reactionApi.getMessageReactions(messageId);
      const updatedMap = { ...messageReactionMap };
      updatedMap[messageId] = reactions.summary;
      setMessageReactionMap(updatedMap);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    try {
      await reactionApi.removeReaction({ messageId, emoji });
      // Refresh reaction display
      const reactions = await reactionApi.getMessageReactions(messageId);
      const updatedMap = { ...messageReactionMap };
      updatedMap[messageId] = reactions.summary;
      setMessageReactionMap(updatedMap);
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  const handleShowReactions = (messageId: string) => {
    // Show detailed reactions modal
    setCurrentReactingMessage(messageId);
    setSelectedMessageReactions(messageReactionMap[messageId] || []);
    setReactionDetailsVisible(true);
  };

  // Show toast notification
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    
    // Animate in
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Auto hide after 2 seconds
    setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setToastVisible(false);
      });
    }, 2000);
  };

  // Copy message content
  const handleCopy = (content: string) => {
    console.log('Copying content:', content);
    
    // Hiển thị toast thay vì Alert
    showToast('Đã sao chép tin nhắn');
    
    // Thử copy vào clipboard
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        navigator.clipboard.writeText(content);
      } else {
        Clipboard.setString(content);
      }
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  // handleReply đã có sẵn ở trên

  const loadMessages = async (conversationId: string) => {
    try {
      // console.log('[ChatScreen] Loading messages for conversation:', conversationId);
      const response = await chatApi.getMessages(conversationId, { limit: 100 });
      // console.log('[ChatScreen] Loaded messages:', response.data.length);
      
      // Sort messages by sentAt (oldest to newest)
      const sortedMessages = [...response.data].sort((a, b) => {
        const dateA = new Date(a.sentAt).getTime();
        const dateB = new Date(b.sentAt).getTime();
        return dateA - dateB;
      });
      
      // console.log('[ChatScreen] First message date:', sortedMessages[0]?.sentAt);
      // console.log('[ChatScreen] Last message date:', sortedMessages[sortedMessages.length - 1]?.sentAt);
      
      setMessages(sortedMessages);
      // Load message labels for this conversation (single call)
      try {
        const allLabels = await apiLabel.getConversationMessageLabels(conversationId);
        const grouped: Record<string, MsgLabel[]> = {};
        allLabels.forEach((ml: any) => {
          const mid = ml.messageId;
          if (!grouped[mid]) grouped[mid] = [];
          grouped[mid].push(ml);
        });
        setMessageLabelsMap(grouped);
      } catch (e) {
        setMessageLabelsMap({});
      }
      
      // Mark as read (bỏ qua lỗi nếu endpoint không tồn tại)
      try {
        await chatApi.markAsRead(conversationId);
      } catch (readError) {
        // console.log('[ChatScreen] Mark as read failed (optional):', readError);
      }

      // Load reaction data for messages từ API thật (tách riêng khỏi markAsRead)
      const messageReactions: Record<string, ReactionSummary[]> = {};
      
      if (sortedMessages.length > 0) {
        try {
          // Load reactions cho tất cả messages
          // console.log('[ChatScreen] Loading reactions for', sortedMessages.length, 'messages');
          for (const msg of sortedMessages) {
            if (msg.id) {
              try {
                const reactions = await reactionApi.getMessageReactions(msg.id);
                // console.log(`[ChatScreen] Reactions for ${msg.id}:`, reactions);
                if (reactions.summary && reactions.summary.length > 0) {
                  messageReactions[msg.id] = reactions.summary;
                  // console.log(`[ChatScreen] Added ${reactions.summary.length} reactions for message ${msg.id}`);
                }
              } catch (err) {
                // Bỏ qua lỗi cho từng message riêng lẻ
                // console.log('Failed to load reactions for message:', msg.id, err);
              }
            }
          }
          // console.log('[ChatScreen] Final messageReactions map:', messageReactions);
          setMessageReactionMap(messageReactions);
        } catch (reactionsError) {
          // console.log('Failed to load message reactions:', reactionsError);
        }
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
      setError(null);
      
      const result = await chatApi.sendMessage({
        conversationId: selectedConversation.id,
        content: messageText.trim(),
        contentType: 'text',
        sendToSocialNetwork: true, // Gửi qua webhook đến social network
      });

      if (result.success && result.message) {
        // Thành công - thêm tin nhắn vào danh sách
        setMessages([...messages, result.message]);
        setMessageText('');
        
        // Hiển thị thông báo thành công
        showToast('Tin nhắn đã được gửi!');
      } else {
        // Thất bại - hiển thị lỗi từ backend
        const errorMsg = result.userMessage || result.error || 'Không thể gửi tin nhắn';
        setError(errorMsg);
        Alert.alert('Lỗi gửi tin nhắn', errorMsg);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMsg = 'Lỗi kết nối. Vui lòng thử lại sau.';
      setError(errorMsg);
      Alert.alert('Lỗi', errorMsg);
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

    // Preview text: ưu tiên nội dung tin nhắn cuối, fallback "Chat với ..."
    const previewText = item.lastMessage?.content || `Chat với ${
      (item.customer as any)?.phone ||
      (item.customer as any)?.email ||
      (item.customer as any)?.name ||
      'khách hàng'
    }`;

    const topLabels = topLabelsMap[item.id] || [];
    const extraCount = convExtraLabelsMap[item.id] || 0;
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
              {previewText}
            </Text>
            {(item as any).unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{(item as any).unreadCount}</Text>
              </View>
            )}
          </View>
          {topLabels.length > 0 && (
            <View style={styles.convLabelRow}>
              {topLabels.slice(0, 2).map((l) => (
                <LabelChip text={l.labelName} color={l.color || '#6B7280'} />
              ))}
              {extraCount > 0 && (
                <TouchableOpacity activeOpacity={0.7} onPress={() => openConversationLabels(item)}>
                  <LabelChip text={`+${extraCount}`} color={'#9CA3AF'} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const labels = messageLabelsMap[item.id] || [];
    const reactions = messageReactionMap[item.id] || [];
    return (
      <MessageBubble
        content={item.content}
        contentType={item.contentType}
        senderType={item.senderType}
        sentAt={new Date(item.sentAt)}
        attachments={item.metadata?.attachments || (item as any).attachments}
        metadata={{ ...item.metadata, __labels: labels }}
        messageId={item.id}
        reactions={reactions}
        onOpenLabelPicker={openMessageLabelPicker}
        onReply={handleReply}
        onTranslate={handleTranslate}
        onMore={handleMore}
        onOpenContext={openContextFromBubble}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
        onShowReactions={handleShowReactions}
      />
    );
  };

  // Conversation List View
  if (!selectedConversation) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={['#6D28D9', '#8B5CF6']} style={styles.header}>
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
          <LinearGradient
            colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.14)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.searchGradient}
          >
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#E5E7EB" />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm kiếm cuộc hội thoại..."
                placeholderTextColor="#E5E7EB"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </LinearGradient>
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
              const lastMsg = (conv.lastMessage?.content || '').toLowerCase();
              return (
                customerName.toLowerCase().includes(query) ||
                lastMsg.includes(query)
              );
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

        <Modal
          visible={labelsModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setLabelsModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setLabelsModalVisible(false)}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={styles.modalSheet}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{labelsModalTitle || 'Tất cả nhãn'}</Text>
                    <TouchableOpacity onPress={() => setLabelsModalVisible(false)} style={styles.modalCloseBtn}>
                      <MaterialIcons name="close" size={20} color="#111827" />
                    </TouchableOpacity>
                  </View>
                  {labelsModalLoading ? (
                    <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#3B82F6" />
                    </View>
                  ) : (
                    <ScrollView contentContainerStyle={styles.modalContent}>
                      {labelsModalItems.length === 0 ? (
                        <Text style={{ color: '#6B7280' }}>Không có nhãn</Text>
                      ) : (
                        <View style={styles.modalChipsWrap}>
                          {labelsModalItems.map((it, idx) => (
                            <View key={`${it.labelId}-${idx}`} style={{ marginRight: 6, marginBottom: 6 }}>
                              <LabelChip text={`${it.labelName}`} color={it.color || '#6B7280'} />
                            </View>
                          ))}
                        </View>
                      )}
                    </ScrollView>
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <Modal
          visible={msgLabelsVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setMsgLabelsVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setMsgLabelsVisible(false)}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={styles.modalSheet}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{msgLabelsTitle || 'Gắn nhãn cho tin nhắn'}</Text>
                    <TouchableOpacity onPress={() => setMsgLabelsVisible(false)} style={styles.modalCloseBtn}>
                      <MaterialIcons name="close" size={20} color="#111827" />
                    </TouchableOpacity>
                  </View>
                  {msgLabelsLoading ? (
                    <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#3B82F6" />
                    </View>
                  ) : (
                    <ScrollView contentContainerStyle={styles.modalContent}>
                      {(!msgLabelsAll || msgLabelsAll.length === 0) ? (
                        <Text style={{ color: '#6B7280' }}>Không có nhãn</Text>
                      ) : (
                        <View style={styles.modalChipsWrap}>
                          {msgLabelsAll.map((lb) => {
                            const active = msgLabelsMessageId ? isLabelAssigned(msgLabelsMessageId, lb.id) : false;
                            const textColor = getTextColorForBg(lb.color || '#6B7280');
                            return (
                              <TouchableOpacity
                                key={lb.id}
                                onPress={() => msgLabelsMessageId && toggleAssignLabel(msgLabelsMessageId, lb)}
                                activeOpacity={0.8}
                                style={{
                                  marginRight: 6,
                                  marginBottom: 6,
                                  borderRadius: 4,
                                  borderWidth: 1,
                                  borderColor: active ? '#2563eb' : 'rgba(0,0,0,0.08)',
                                  backgroundColor: lb.color || '#F3F4F6',
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                }}
                              >
                                <Text style={{ color: textColor, fontSize: 12, fontWeight: '600' }}>{lb.name}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </ScrollView>
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
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

      {/* Input Bar - Enhanced with Upload */}
      <ChatInputBar
        conversationId={selectedConversation.id}
        onSendMessage={async (message) => {
          if (!selectedConversation || isSending) return;
          
          try {
            setIsSending(true);
            setError(null);
            
            const result = await chatApi.sendMessage({
              conversationId: selectedConversation.id,
              content: message,
              contentType: 'text',
              sendToSocialNetwork: true,
            });
            
            if (result.success && result.message) {
              setMessages([...messages, result.message]);
              showToast('Tin nhắn đã được gửi!');
            } else {
              const errorMsg = result.userMessage || result.error || 'Không thể gửi tin nhắn';
              setError(errorMsg);
              Alert.alert('Lỗi gửi tin nhắn', errorMsg);
            }
          } catch (error) {
            console.error('Error sending message:', error);
            const errorMsg = 'Lỗi kết nối. Vui lòng thử lại sau.';
            setError(errorMsg);
            Alert.alert('Lỗi', errorMsg);
          } finally {
            setIsSending(false);
          }
        }}
        onFileUploaded={async (uploadResult) => {
          // File đã được upload và message đã được tạo tự động
          // Chỉ cần refresh messages để hiển thị message mới
          try {
            if (uploadResult.message) {
              // Nếu có message trong response, thêm vào danh sách
              setMessages([...messages, uploadResult.message]);
              showToast('File đã được gửi!');
            } else {
              // Nếu không có message, refresh lại danh sách messages
              await loadMessages(selectedConversation.id);
              showToast('File đã được gửi!');
            }
          } catch (error) {
            console.error('Error handling file upload:', error);
            // Fallback: refresh messages
            await loadMessages(selectedConversation.id);
          }
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

      {/* Long-press context overlay */}
      {ctxVisible && ctxAnchor && (
        <TouchableWithoutFeedback onPress={closeContext}>
          <Animated.View style={[styles.ctxBackdrop, { opacity: overlayOpacity }]}>
            {/* Highlighted message bubble with glow */}
            <Animated.View
              style={{
                position: 'absolute',
                top: ctxAnchor.y,
                left: ctxAnchor.x,
                width: ctxAnchor.width,
                height: ctxAnchor.height,
                backgroundColor: 'rgba(255,255,255,0.12)',
                borderRadius: 12,
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.3)',
                shadowColor: '#fff',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 5,
                opacity: overlayOpacity,
              }}
            />

            {/* Reaction pill - compact with animation */}
            {(() => {
              const screen = Dimensions.get('window');
              const pillWidth = 200;
              const pillLeft = Math.min(
                Math.max(ctxAnchor.x + ctxAnchor.width / 2 - pillWidth / 2, 12),
                screen.width - pillWidth - 12
              );
              const pillTop = Math.max(ctxAnchor.y - 48, 12);
              return (
                <Animated.View 
                  style={[
                    styles.ctxReactionPill, 
                    { 
                      top: pillTop, 
                      left: pillLeft, 
                      width: pillWidth,
                      transform: [{ scale: pillScale }],
                      opacity: overlayOpacity,
                    }
                  ]}
                >
                  {['❤️','😂','😮','😢','😡','👍'].map((emj, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      onPress={() => { 
                        if (ctxMsgId) {
                          handleAddReaction(ctxMsgId, emj);
                        }
                        closeContext();
                      }}
                      style={styles.ctxEmojiButton}
                    >
                      <Text style={styles.ctxEmoji}>{emj}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity 
                    onPress={() => { Alert.alert('Thêm cảm xúc', 'Sắp có'); closeContext(); }} 
                    style={styles.ctxPlus}
                  >
                    <MaterialIcons name="add" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </Animated.View>
              );
            })()}

            {/* Dark action menu - positioned below message with animation */}
            {(() => {
              const screen = Dimensions.get('window');
              const menuW = 200;
              const menuLeft = Math.min(
                Math.max(ctxAnchor.x + ctxAnchor.width / 2 - menuW / 2, 12),
                screen.width - menuW - 12
              );
              const menuTop = Math.min(ctxAnchor.y + ctxAnchor.height + 12, screen.height - 200);
              return (
                <Animated.View 
                  style={[
                    styles.ctxMenu, 
                    { 
                      top: menuTop, 
                      left: menuLeft, 
                      width: menuW,
                      transform: [{ scale: menuScale }],
                      opacity: overlayOpacity,
                    }
                  ]}
                >
                  <TouchableOpacity 
                    style={styles.ctxMenuItem} 
                    onPress={() => { if (ctxMsgId) handleReply(ctxMsgId); closeContext(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.ctxMenuText}>Trả lời</Text>
                    <MaterialIcons name="reply" size={16} color="#E5E7EB" style={{ transform: [{ scaleX: -1 }] }} />
                  </TouchableOpacity>

                  {!!ctxContent?.trim() && (
                    <TouchableOpacity 
                      style={styles.ctxMenuItem} 
                      onPress={() => { handleCopy(ctxContent); closeContext(); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.ctxMenuText}>Sao chép</Text>
                      <MaterialIcons name="file-copy" size={16} color="#E5E7EB" />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity 
                    style={styles.ctxMenuItem} 
                    onPress={() => { if (ctxMsgId) openMessageLabelPicker(ctxMsgId); closeContext(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.ctxMenuText}>Gắn nhãn</Text>
                    <MaterialIcons name="local-offer" size={16} color="#E5E7EB" />
                  </TouchableOpacity>

                  <View style={styles.ctxDivider} />

                  <TouchableOpacity 
                    style={styles.ctxMenuItem} 
                    onPress={() => { Alert.alert('Xóa', 'Tính năng sẽ sớm có'); closeContext(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.ctxMenuText, styles.ctxDanger]}>Xóa</Text>
                    <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.ctxMenuItem} 
                    onPress={() => { if (ctxMsgId) handleMore(ctxMsgId); closeContext(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.ctxMenuText}>Khác</Text>
                    <MaterialIcons name="more-horiz" size={18} color="#E5E7EB" />
                  </TouchableOpacity>
                </Animated.View>
              );
            })()}
          </Animated.View>
        </TouchableWithoutFeedback>
      )}
      {/* Reaction Details Modal */}
      <ReactionDetails
        visible={reactionDetailsVisible}
        onClose={() => setReactionDetailsVisible(false)}
        reactions={selectedMessageReactions}
        messageId={currentReactingMessage || ''}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
      />
      
      {/* Toast Notification */}
      {toastVisible && (
        <Animated.View 
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
            }
          ]}
        >
          <MaterialIcons name="check-circle" size={20} color="#10B981" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
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
  searchGradient: {
    borderRadius: 16,
    padding: 2,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  convLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalContent: {
    paddingBottom: 8,
  },
  modalChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
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
  messageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
    paddingHorizontal: 0,
    maxWidth: '80%',
  },
  messageLabelRowCustomer: {
    alignSelf: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 4,
  },
  messageLabelRowAgent: {
    alignSelf: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
    paddingTop: 4,
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
  ctxBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  ctxReactionPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17,24,39,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  ctxEmoji: { fontSize: 22, marginHorizontal: 2 },
  ctxPlus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  ctxMenu: {
    position: 'absolute',
    backgroundColor: 'rgba(17,24,39,0.98)',
    borderRadius: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  ctxMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  ctxMenuText: { color: '#F3F4F6', fontSize: 15, fontWeight: '500' as '500' },
  ctxEmojiButton: {
    padding: 4,
    borderRadius: 8,
  },
  ctxDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 4,
  },
  ctxDanger: { color: '#EF4444', fontWeight: '600' as '600' },
  
  // Toast styles
  toast: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -25 }],
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    minWidth: 200,
    justifyContent: 'center',
  },
  toastText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
});

export default ChatScreen;
