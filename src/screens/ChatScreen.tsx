import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { API_BASE_URL } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
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

const MESSAGES_PAGE_SIZE = 30;

const ChatScreen: React.FC<ChatScreenProps> = ({ onBack }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleMessageCount, setVisibleMessageCount] = useState<number>(MESSAGES_PAGE_SIZE);
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
  const [convLastMessageMap, setConvLastMessageMap] = useState<Record<string, string>>({});
  const conversationsRef = useRef<Conversation[]>([]);
  const [labelsModalVisible, setLabelsModalVisible] = useState(false);
  const [labelsModalItems, setLabelsModalItems] = useState<TopLabel[]>([]);
  const [labelsModalTitle, setLabelsModalTitle] = useState<string>('');
  const [labelsModalLoading, setLabelsModalLoading] = useState(false);
  const [msgLabelsVisible, setMsgLabelsVisible] = useState(false);
  const [msgLabelsLoading, setMsgLabelsLoading] = useState(false);
  const [msgLabelsAll, setMsgLabelsAll] = useState<Label[]>([]);
  const [msgLabelsMessageId, setMsgLabelsMessageId] = useState<string | null>(null);
  const [msgLabelsTitle, setMsgLabelsTitle] = useState<string>('');
  const [msgLabelsSearch, setMsgLabelsSearch] = useState('');
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
  const [replyContext, setReplyContext] = useState<{ id: string; author?: string; content?: string } | null>(null);
  
  // Toast notification state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  
  // WebSocket realtime
  const socketRef = useRef<Socket | null>(null);
  const selectedConvIdRef = useRef<string | null>(null);
  const prevConvIdRef = useRef<string | null>(null);
  const locallyClearedUnreadRef = useRef<Record<string, boolean>>({});
  const READ_OVERRIDES_KEY = 'chat_read_overrides_v1';
  const [readOverrideMap, setReadOverrideMap] = useState<Record<string, string>>({});
  
  // Real-time polling
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Source of conversations: external social channels vs Visitor (web chat)
  const [conversationSource, setConversationSource] = useState<'external' | 'visitor'>('external');
  const [unreadExternalCount, setUnreadExternalCount] = useState(0);
  const [unreadVisitorCount, setUnreadVisitorCount] = useState(0);
  const badgeRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket base URL - ưu tiên cấu hình qua biến môi trường giống web
  // Có thể người dùng set EXPO_PUBLIC_WEBSOCKET_URL = https://smile.cmcu.edu.vn/api/backend
  // nên cần strip phần /api/backend để khớp với nginx location /chat/socket.io
  const RAW_WS_BASE =
    (process.env.EXPO_PUBLIC_WEBSOCKET_URL as string | undefined) ||
    (process.env.NEXT_PUBLIC_WEBSOCKET_URL as string | undefined) ||
    API_BASE_URL;
  const WS_BASE_URL = (RAW_WS_BASE || '')
    // bỏ /api/backend hoặc /api ở cuối nếu có
    .replace(/\/api\/backend\/?$/i, '')
    .replace(/\/api\/?$/i, '');

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

  // Load/save read overrides
  const loadReadOverrides = async () => {
    try {
      const raw = await AsyncStorage.getItem(READ_OVERRIDES_KEY);
      if (raw) setReadOverrideMap(JSON.parse(raw));
      else setReadOverrideMap({});
    } catch {
      setReadOverrideMap({});
    }
  };

  // Update badge counts mỗi khi danh sách conversations thay đổi
  useEffect(() => {
    conversationsRef.current = conversations;
    try {
      const list: any[] = conversations as any[];
      const unread = list.filter((c) => (c?.unreadCount || 0) > 0).length;
      if (conversationSource === 'external') {
        setUnreadExternalCount(unread);
      } else {
        setUnreadVisitorCount(unread);
      }
    } catch {
      // ignore
    }
  }, [conversations, conversationSource]);

  const saveReadOverride = async (conversationId: string, iso: string) => {
    setReadOverrideMap((prev) => {
      const next = { ...prev, [conversationId]: iso };
      AsyncStorage.setItem(READ_OVERRIDES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const applyReadOverrides = (list: any[]) => {
    return list.map((c: any) => {
      const lastRaw: any = c.lastActivityAt || c.lastMessageAt || c.updatedAt || c.createdAt;
      const lastTime = parseMessageDate(lastRaw).getTime();
      const clearedIso = readOverrideMap[c.id];
      const clearedTime = clearedIso ? new Date(clearedIso).getTime() : 0;
      if (locallyClearedUnreadRef.current[c.id] || clearedTime >= lastTime) {
        return { ...c, unreadCount: 0 };
      }
      return c;
    });
  };

  useEffect(() => { loadReadOverrides(); }, []);
  useEffect(() => {
    // Re-apply when overrides change
    setConversations((prev) => applyReadOverrides(prev as any));
  }, [readOverrideMap]);

  // Open a conversation and clear its unread counter locally
  const openConversation = (conversation: Conversation) => {
    try {
      setSelectedConversation({ ...(conversation as any), unreadCount: 0 } as any);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversation.id ? ({ ...(c as any), unreadCount: 0 } as any) : c))
      );
      // best-effort mark as read
      try { chatApi.markAsRead(conversation.id); } catch {}
      // persist local cleared state
      locallyClearedUnreadRef.current[conversation.id] = true;
      saveReadOverride(conversation.id, new Date().toISOString());
    } catch {}
  };

  // Ensure clearing unread when selection changes
  useEffect(() => {
    const id = selectedConversation?.id;
    if (!id) return;
    setConversations((prev) => prev.map((c) => (c.id === id ? ({ ...(c as any), unreadCount: 0 } as any) : c)));
    locallyClearedUnreadRef.current[id] = true;
    saveReadOverride(id, new Date().toISOString());
  }, [selectedConversation?.id]);

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
          // console.log('[Polling] Received new messages:', newMessages.length);
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
      // console.log('[Polling] Disabled - waiting for backend API implementation');
    } else {
      stopPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [selectedConversation?.id]);

  // Parse message date robustly: if string lacks timezone, treat as UTC
  const parseMessageDate = (raw: any): Date => {
    if (!raw) return new Date();
    if (raw instanceof Date) return raw;
    const s = String(raw);
    // If already contains timezone info (Z or +hh:mm / -hh:mm), parse directly
    if (/Z$/i.test(s) || /[\+\-]\d{2}:?\d{2}$/.test(s)) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    // Normalize common formats without timezone to UTC by appending Z
    if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      const d = new Date(s.replace(' ', 'T') + 'Z');
      return isNaN(d.getTime()) ? new Date() : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  // Keep ref of current conversation id for ws handlers
  useEffect(() => {
    // console.log('[ChatScreen] WS_BASE_URL =', WS_BASE_URL);
    selectedConvIdRef.current = selectedConversation?.id || null;
  }, [selectedConversation?.id]);

  // Initialize Socket.IO connection
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        // Chuẩn hoá URL, bỏ dấu '/' thừa ở cuối
        const wsBase = (WS_BASE_URL || '').replace(/\/+$/, '');
        console.log('[ChatScreen] Initializing WebSocket with base =', wsBase);
        const socket = io(`${wsBase}/chat`, {
          transports: ['websocket', 'polling'],
          autoConnect: true,
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10000,
        });
        if (!active) return;
        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('[ChatScreen][WS] connected, id =', socket.id);
          const currentId = selectedConvIdRef.current;
          if (currentId) {
            socket.emit('joinConversation', { conversationId: currentId });
            console.log('[ChatScreen][WS] joinConversation on connect', currentId);
          } else {
            // In list view, join all conversations to receive realtime updates
            (conversationsRef.current || []).forEach((c) => {
              try {
                socket.emit('joinConversation', { conversationId: c.id });
              } catch (e) {
                console.log('[ChatScreen][WS] joinConversation error', e);
              }
            });
          }
        });
        socket.on('connect_error', (err) => {
          console.log('[ChatScreen][WS] connect_error', err?.message || err);
        });
        socket.on('reconnect', (attempt) => {
          console.log('[ChatScreen][WS] reconnected', attempt);
        });

        socket.on('newMessage', (msg: any) => {
          console.log('[ChatScreen][WS] newMessage arrived', {
            id: msg?.id,
            conversationId: msg?.conversationId,
            senderType: msg?.senderType,
          });
          const currentId = selectedConvIdRef.current;

          // Helper: derive preview label from message
          const previewFromMsg = (() => {
            const content = String(msg?.content || '').trim();
            if (content) return content;
            const ct = String(msg?.contentType || '').toLowerCase();
            if (ct === 'image') return '[Ảnh]';
            if (ct === 'file') return '[Tệp]';
            if (ct === 'voice') return '[Voice]';
            if (ct === 'email') return '[Email]';
            if (msg?.metadata?.attachments?.files?.length) return '[Tệp]';
            return '';
          })();

          // Update conversation list (preview, unread, last activity) and reorder to top
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === msg?.conversationId);
            if (idx === -1) return prev;
            const conv: any = prev[idx] || {};
            const isActive = currentId === msg?.conversationId;
            const now = parseMessageDate(msg?.sentAt || msg?.createdAt || new Date());
            const nextUnread = isActive
              ? 0
              : (conv.unreadCount || 0) + (msg?.senderType === 'customer' ? 1 : 0);
            const updated: any = {
              ...conv,
              lastMessage: {
                content: previewFromMsg || conv?.lastMessage?.content || '',
                senderType: msg?.senderType || conv?.lastMessage?.senderType || 'customer',
              },
              lastMessageAt: now,
              lastActivityAt: now,
              updatedAt: now,
              unreadCount: nextUnread,
            };
            const rest = prev.filter((c) => c.id !== msg?.conversationId);
            return [updated, ...rest];
          });

          // Update preview cache map
          if (previewFromMsg) {
            setConvLastMessageMap((m) => ({ ...m, [msg.conversationId]: previewFromMsg }));
          }

          // Refresh badges for tabs when có tin nhắn mới
          if (String(msg?.senderType).toLowerCase() === 'customer') {
            scheduleBadgeRefresh();
          }

          // If currently viewing this conversation, also append the message in the chat view and keep unread = 0
          if (currentId && msg?.conversationId === currentId) {
            setMessages((prev) => {
              if (!msg?.id || prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg as Message];
            });
            // Scroll to bottom (inverted list -> offset 0)
            setTimeout(() => {
              flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }, 80);
            // If the incoming message is from customer while this conversation is open,
            // mark it as read on backend and keep unread badge at 0 persistently
            if (String(msg?.senderType).toLowerCase() === 'customer') {
              try { chatApi.markAsRead(currentId); } catch {}
              locallyClearedUnreadRef.current[currentId] = true;
              saveReadOverride(currentId, parseMessageDate(msg?.sentAt || msg?.createdAt || new Date()).toISOString());
              setConversations((prev) => prev.map((c) => c.id === currentId ? ({ ...(c as any), unreadCount: 0 } as any) : c));
            }
          }
        });

        // Optional: message update (reactions/status)
        socket.on('messageUpdate', (update: any) => {
          console.log('[ChatScreen][WS] messageUpdate', update?.messageId);
          const currentId = selectedConvIdRef.current;
          if (!currentId || update?.conversationId !== currentId) return;
          if (!update?.messageId) return;
          setMessages(prev => prev.map(m => (m.id === update.messageId ? { ...m, ...update } as any : m)));
          refreshMessageLabels(update.messageId);
          if (update?.topLabels) {
            updateConversationLabelSummary(
              update.conversationId || currentId,
              (update.topLabels || []) as TopLabel[],
              update.totalLabelCount
            );
          }
        });

        socket.on('messageLabelUpdated', (payload: any) => {
          const mid = payload?.messageId;
          const cid = payload?.conversationId || selectedConvIdRef.current;
          if (mid) refreshMessageLabels(mid);
          if (payload?.labels?.length) {
            updateMessageLabelsState(mid, payload.labels as MsgLabel[]);
          }
          if (payload?.topLabels) {
            updateConversationLabelSummary(
              cid,
              (payload.topLabels || []) as TopLabel[],
              payload.totalLabelCount
            );
          } else if (cid) {
            apiLabel.getTopConversationLabels(cid).then((top) => {
              updateConversationLabelSummary(cid, top as TopLabel[], payload?.totalLabelCount);
            }).catch(() => {});
          }
        });

        // Conversation-level updates: unreadCount, lastActivityAt, status, etc.
        socket.on('conversationUpdated', (payload: any) => {
          console.log('[ChatScreen][WS] conversationUpdated', payload?.id);
          if (!payload?.id) return;
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === payload.id);
            if (idx === -1) return prev;
            const conv: any = prev[idx];
            const isActive = selectedConvIdRef.current === payload.id;
            const updated: any = {
              ...conv,
              ...payload,
            };
            // If this conversation is currently open on this client, force unreadCount to 0
            if (isActive) updated.unreadCount = 0;
            // Only reorder to top if lastActivityAt is present (real activity), otherwise keep position
            if (payload.lastActivityAt) {
              const rest = prev.filter((c) => c.id !== payload.id);
              return [updated, ...rest];
            } else {
              const next = [...prev];
              next[idx] = updated;
              return next;
            }
          });
          if (payload?.topLabels) {
            updateConversationLabelSummary(
              payload.id,
              (payload.topLabels || []) as TopLabel[],
              payload.totalLabelCount
            );
          }
          if ((payload?.unreadCount || 0) > 0) {
            scheduleBadgeRefresh();
          }
        });

        socket.on('newConversation', (conv: any) => {
          console.log('[ChatScreen][WS] newConversation', conv?.id);
          if (!conv?.id) return;
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === conv.id);
            if (exists) return prev;
            return [conv as any, ...prev];
          });
        });

        socket.on('disconnect', (reason: any) => {
          console.log('[ChatScreen][WS] disconnected', reason);
        });
      } catch (err) {
        console.log('[ChatScreen][WS] Failed to init socket:', err);
      }
    })();

    return () => {
      active = false;
      try {
        socketRef.current?.removeAllListeners();
        socketRef.current?.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, []);

  // Join/leave conversation rooms when selection changes
  useEffect(() => {
    const socket = socketRef.current;
    const nextId = selectedConversation?.id || null;
    const prevId = prevConvIdRef.current;
    if (socket) {
      if (prevId && prevId !== nextId) {
        socket.emit('leaveConversation', { conversationId: prevId });
      }
      if (nextId) {
        socket.emit('joinConversation', { conversationId: nextId });
      }
    }
    prevConvIdRef.current = nextId;
  }, [selectedConversation?.id]);

  // In list view, join all conversation rooms to receive realtime updates
  const convIdSignature = useMemo(() => conversations.map(c => c.id).sort().join(','), [conversations]);
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (!selectedConversation && conversations.length > 0) {
      conversations.forEach(c => {
        try { socket.emit('joinConversation', { conversationId: c.id }); } catch {}
      });
    }
  }, [convIdSignature, selectedConversation]);

  const updateMessageLabelsState = (messageId: string, labels: MsgLabel[]) => {
    setMessageLabelsMap((prev) => ({ ...(prev || {}), [messageId]: labels }));
  };

  const refreshMessageLabels = async (messageId: string) => {
    try {
      const labels = await apiLabel.getMessageLabels(messageId);
      updateMessageLabelsState(messageId, labels);
    } catch {
      // ignore fetch errors
    }
  };

  const refreshConversationLabels = async (conversationId: string) => {
    if (!conversationId) return;
    try {
      const allLabels = await apiLabel.getConversationMessageLabels(conversationId);
      const grouped: Record<string, MsgLabel[]> = {};
      allLabels.forEach((ml: any) => {
        const mid = ml.messageId;
        if (!grouped[mid]) grouped[mid] = [];
        grouped[mid].push(ml);
      });
      setMessageLabelsMap(grouped);
    } catch {
      // ignore
    }

    try {
      const top = await apiLabel.getTopConversationLabels(conversationId);
      updateConversationLabelSummary(conversationId, top as TopLabel[], undefined);
    } catch {
      // ignore
    }
  };

  const updateConversationLabelSummary = (
    conversationId: string,
    topLabels?: TopLabel[],
    totalDistinct?: number
  ) => {
    if (!conversationId || !topLabels) return;
    setTopLabelsMap((prev) => ({ ...(prev || {}), [conversationId]: topLabels }));
    setConvExtraLabelsMap((prev) => {
      const shown = Math.min(2, topLabels.length);
      const extras = Math.max(0, (totalDistinct ?? topLabels.length) - shown);
      return { ...(prev || {}), [conversationId]: extras };
    });
  };

  const openMessageLabelPicker = async (messageId: string) => {
    setMsgLabelsVisible(true);
    setMsgLabelsMessageId(messageId);
    setMsgLabelsTitle('Gắn nhãn cho tin nhắn');
    setMsgLabelsLoading(true);
    setMsgLabelsSearch('');
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
        setMessageLabelsMap((prev) => {
          const next = { ...(prev || {}) };
          next[messageId] = (next[messageId] || []).filter((ml) => ml.labelId !== label.id);
          return next;
        });
      } else {
        const created = await apiLabel.assignLabelToMessage({ messageId, labelId: label.id });
        const enriched = { ...created, label } as MsgLabel; // attach full label so UI shows name instead of ID
        setMessageLabelsMap((prev) => {
          const next = { ...(prev || {}) };
          next[messageId] = [...(next[messageId] || []), enriched];
          return next;
        });
      }
    } catch (e) {
      // console.log('Label toggle failed', e);
    }
  };

  const handleReply = (messageId: string) => {
    const m = messages.find((x) => x.id === messageId);
    const content = (m?.content || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    const author = m?.senderType === 'customer'
      ? ((selectedConversation?.customer as any)?.fullName || (selectedConversation?.customer as any)?.name || 'Khách hàng')
      : 'Bạn';
    setReplyContext({ id: messageId, author, content });
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

  // Preload unread Visitor conversations once (để badge Visitor có số ngay từ đầu)
  useEffect(() => {
    const preloadVisitorUnread = async () => {
      try {
        const res = await chatApi.getVisitorConversations({ limit: 50 });
        const list: any[] = res?.data || [];
        const unread = list.filter((c) => (c?.unreadCount || 0) > 0).length;
        setUnreadVisitorCount(unread);
      } catch {
        // ignore
      }
    };
    preloadVisitorUnread();
  }, []);

  // Preload external unread once for badge (matching visitor preload)
  useEffect(() => {
    const preloadExternalUnread = async () => {
      try {
        const res = await chatApi.getConversations({ limit: 50 });
        const list: any[] = res?.data || [];
        const unread = list.filter((c) => (c?.unreadCount || 0) > 0).length;
        setUnreadExternalCount(unread);
      } catch {
        // ignore
      }
    };
    preloadExternalUnread();
  }, []);

  useEffect(() => {
    loadConversations();
  }, [conversationSource]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  // Periodic refresh labels for current conversation to stay fresh even if WS event missing
  useEffect(() => {
    if (!selectedConversation?.id) return;
    const cid = selectedConversation.id;
    // initial refresh
    refreshConversationLabels(cid);
    const interval = setInterval(() => {
      refreshConversationLabels(cid);
    }, 15000); // every 15s
    return () => clearInterval(interval);
  }, [selectedConversation?.id]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // console.log('[ChatScreen] Loading conversations...', conversationSource);

      const response =
        conversationSource === 'visitor'
          ? await chatApi.getVisitorConversations({ limit: 50 })
          : await chatApi.getConversations({ limit: 50 });
      // console.log('[ChatScreen] Loaded conversations:', response.data.length);
      
      // Debug platform info
      // if (response.data.length > 0) {
      //   const firstConv = response.data[0];
      //   console.log('[ChatScreen] First conversation channel:', firstConv.channel);
      //   console.log('[ChatScreen] Platform name:', 
      //     (firstConv.channel as any)?.socialNetwork?.name || 
      //     (firstConv.channel as any)?.social?.platform || 
      //     'unknown'
      //   );
      // }
      
      // Apply local + persisted unread clear overrides before setting state
      const original = response.data;
      const mergedConvs = applyReadOverrides(
        original.map((c: any) =>
          locallyClearedUnreadRef.current[c.id] ? { ...c, unreadCount: 0 } : c
        )
      );
      setConversations(mergedConvs);
      // Backend sync: if original had unreadCount>0 but overrides forced it to 0, call markAsRead to sync DB
      try {
        const toSync = original.filter((c: any, idx: number) => (c.unreadCount || 0) > 0 && (mergedConvs[idx]?.unreadCount || 0) === 0);
        for (const c of toSync.slice(0, 10)) { // limit to 10 to avoid spam
          try { chatApi.markAsRead(c.id); } catch {}
        }
      } catch {}
      // Map label summary từ backend (topLabels + totalLabelCount) để hiển thị chip và +N
      try {
        const labelsMap: Record<string, TopLabel[]> = {};
        const extrasMap: Record<string, number> = {};

        (mergedConvs as any[]).forEach((c) => {
          const convTop: any[] = (c as any).topLabels || [];
          const totalDistinct: number = (c as any).totalLabelCount ?? convTop.length;

          // Chuẩn hoá về TopLabel[] cho FE
          const top: TopLabel[] = convTop.map((l: any) => ({
            labelId: l.labelId,
            labelName: l.labelName,
            count: l.count,
            color: l.color,
            category: l.category,
          }));

          labelsMap[c.id] = top;

          const shown = Math.min(2, top.length);
          const extras = Math.max(0, totalDistinct - shown);
          extrasMap[c.id] = extras;
        });

        setTopLabelsMap(labelsMap);
        setConvExtraLabelsMap(extrasMap);
      } catch (e) {
        // Nếu có lỗi khi map label summary thì bỏ qua, không chặn luồng chính
      }
      
      // Clear error nếu load thành công
      setError(null);
    } catch (error: any) {
      console.error('[ChatScreen] Error loading conversations:', error);
      setError(error.response?.data?.message || 'Không thể tải cuộc hội thoại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced badge refresh for both tabs
  const refreshBadgeCounts = async () => {
    try {
      const [extRes, visRes] = await Promise.all([
        chatApi.getConversations({ limit: 50 }),
        chatApi.getVisitorConversations({ limit: 50 }),
      ]);
      const extUnread = (extRes?.data || []).filter((c: any) => (c?.unreadCount || 0) > 0).length;
      const visUnread = (visRes?.data || []).filter((c: any) => (c?.unreadCount || 0) > 0).length;
      setUnreadExternalCount(extUnread);
      setUnreadVisitorCount(visUnread);
    } catch {
      // ignore badge refresh errors
    }
  };

  const scheduleBadgeRefresh = () => {
    if (badgeRefreshTimerRef.current) {
      clearTimeout(badgeRefreshTimerRef.current);
    }
    badgeRefreshTimerRef.current = setTimeout(() => {
      refreshBadgeCounts();
    }, 1200); // debounce 1.2s để tránh spam API
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
    // console.log('Copying content:', content);
    
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
        const aRaw: any = (a as any)?.sentAt || (a as any)?.createdAt || (a as any)?.deliveredAt || (a as any)?.readAt;
        const bRaw: any = (b as any)?.sentAt || (b as any)?.createdAt || (b as any)?.deliveredAt || (b as any)?.readAt;
        const dateA = parseMessageDate(aRaw).getTime();
        const dateB = parseMessageDate(bRaw).getTime();
        return dateA - dateB;
      });
      
      // console.log('[ChatScreen] First message date:', sortedMessages[0]?.sentAt);
      // console.log('[ChatScreen] Last message date:', sortedMessages[sortedMessages.length - 1]?.sentAt);
      
      setMessages(sortedMessages);
      setVisibleMessageCount(Math.min(MESSAGES_PAGE_SIZE, sortedMessages.length));
      // Clear unread locally for this conversation
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? ({ ...(c as any), unreadCount: 0 } as any) : c)));
      // Persist read override up to the last message time
      try {
        const last = sortedMessages[sortedMessages.length - 1];
        const lastRaw: any = (last as any)?.sentAt || (last as any)?.createdAt || (last as any)?.deliveredAt || (last as any)?.readAt || new Date();
        saveReadOverride(conversationId, parseMessageDate(lastRaw).toISOString());
      } catch {}
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

  const handleLoadOlderMessages = () => {
    if (!messages || messages.length === 0) return;
    if (messages.length <= visibleMessageCount) return;
    setVisibleMessageCount((prev) => {
      const next = Math.min(prev + MESSAGES_PAGE_SIZE, messages.length);
      return next;
    });
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
        replyToMessageId: replyContext?.id,
        sendToSocialNetwork: true, // Gửi qua webhook đến social network
      });

      if (result.success && result.message) {
        // Thành công - thêm tin nhắn vào danh sách (enrich with reply info for immediate UI)
        const enriched: any = { ...result.message };
        if (replyContext?.id) {
          enriched.replyToMessageId = replyContext.id;
          const original = messages.find(m => m.id === replyContext.id);
          if (original) enriched.replyToMessage = original;
        }
        setMessages([...messages, enriched]);
        setMessageText('');
        setReplyContext(null);
        
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
        // Use a generic chat icon for Zalo instead of an image asset
        return <FontAwesome5 name="comment-dots" size={iconSize} color={iconColor} />;
      case 'whatsapp':
        return <FontAwesome name="whatsapp" size={iconSize} color={iconColor} />;
      case 'viber':
        return <FontAwesome5 name="viber" size={iconSize} color={iconColor} />;
      case 'messenger':
        return <Ionicons name="chatbubble" size={iconSize} color={iconColor} />;
      case 'visitor':
      case 'web':
      case 'web-chat':
        return <Ionicons name="globe-outline" size={iconSize} color={iconColor} />;
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
      case 'visitor':
      case 'web':
      case 'web-chat':
        return '#14B8A6';
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
    const d = new Date(date);
    let diffMs = now.getTime() - d.getTime();
    if (!isFinite(diffMs)) diffMs = 0;
    if (diffMs < 0) diffMs = 0; // tránh thời gian tương lai do lệch clock
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    // Get customer name from various possible fields
    const customerName = (item.customer as any)?.fullName || 
                        (item.customer as any)?.name || 
                        item.title || 
                        'Khách hàng';
    
    // Visitor view: toàn bộ danh sách là web chat
    const isVisitorView = conversationSource === 'visitor';

    // Get platform from channel - hoặc Visitor nếu đang ở tab Visitor
    const platform = isVisitorView
      ? 'visitor'
      : (item.channel as any)?.socialNetwork?.name || 
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

    const previewText = (() => {
      // 1) Ưu tiên cache đã có (được cập nhật realtime qua WebSocket)
      const viaMap = (convLastMessageMap[item.id] || '').trim();
      if (viaMap) return viaMap;

      // 2) Tìm lastMessage từ nhiều nguồn giống web CRM
      const convAny: any = item as any;
      let lm: any = convAny.lastMessage;
      if (!lm && Array.isArray(convAny.messages) && convAny.messages.length > 0) {
        lm = convAny.messages[convAny.messages.length - 1];
      }

      // Nếu vẫn không có message nào, fallback rỗng
      if (!lm) {
        return '';
      }

      // 3) Logic giống ChatWindow: ưu tiên text, bỏ placeholder
      const raw = String(lm.content ?? '').trim();
      const upper = raw.toUpperCase();
      const isPlaceholder = [
        '[PHOTO]',
        '[VOICE]',
        '[VIDEO]',
        '[DOCUMENT]',
        '[AUDIO]',
        '[STICKER]',
        '[IMAGE]',
        '[FILE]',
      ].includes(upper);

      // Lấy danh sách file đính kèm nếu có
      const files =
        (lm.attachments as any)?.files ||
        (lm.metadata as any)?.attachments?.files ||
        [];

      if (raw && !isPlaceholder) return raw;

      if (Array.isArray(files) && files.length > 0) {
        const f = files[0] as any;
        const name =
          f.originalName ||
          f.fileName ||
          f.file_url ||
          'Tệp đính kèm';
        return `📎 ${name}`;
      }

      // 4) Dựa vào contentType khi không có text/filename rõ ràng
      const ct = String(lm.contentType || '').toLowerCase();
      if (ct === 'image') return '[Ảnh]';
      if (ct === 'file') return '[Tệp]';
      if (ct === 'voice' || ct === 'audio') return '[Voice]';
      if (ct === 'email') return '[Email]';

      // Không còn fallback "Chat với khách hàng" để tránh bị sai nội dung
      return '';
    })();

    const topLabels = topLabelsMap[item.id] || [];
    const extraCount = convExtraLabelsMap[item.id] || 0;
    const unread = (item as any).unreadCount > 0;
    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          selectedConversation?.id === item.id && styles.conversationItemActive,
        ]}
        onPress={() => openConversation(item)}
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
            <Text
              style={[
                styles.customerName,
                unread && styles.conversationUnreadTitle,
              ]}
              numberOfLines={1}
            >
              {customerName}
            </Text>
            <Text style={styles.timestamp}>
              {formatTime(lastTime)}
            </Text>
          </View>
          <View style={styles.conversationFooter}>
            <Text
              style={[
                styles.lastMessage,
                unread && styles.conversationUnreadPreview,
              ]}
              numberOfLines={1}
            >
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
                <LabelChip
                  key={l.labelId}
                  text={l.labelName}
                  color={l.color || '#6B7280'}
                />
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
    // Build reply preview for this message if present
    const replyId = (item as any)?.replyToMessageId;
    const replyObj: any = (item as any)?.replyToMessage || messages.find(m => m.id === replyId);
    const replyAuthor = replyObj
      ? (replyObj.senderType === 'customer'
          ? ((selectedConversation?.customer as any)?.fullName || (selectedConversation?.customer as any)?.name || 'Khách hàng')
          : 'Bạn')
      : undefined;
    const replySnippet = replyObj ? String(replyObj.content || '').replace(/\s+/g, ' ').trim().slice(0, 90) : undefined;
    const sentDate = (() => {
      const raw: any = (item as any)?.sentAt || (item as any)?.createdAt || (item as any)?.deliveredAt || (item as any)?.readAt;
      return parseMessageDate(raw);
    })();
    return (
      <MessageBubble
        content={item.content}
        contentType={item.contentType}
        senderType={item.senderType}
        sentAt={sentDate}
        attachments={item.metadata?.attachments || (item as any).attachments}
        metadata={{ ...item.metadata, __labels: labels }}
        messageId={item.id}
        reactions={reactions}
        replyTo={replyId ? { author: replyAuthor, content: replySnippet } : null}
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

  const displayedMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [] as Message[];
    const start = Math.max(0, messages.length - visibleMessageCount);
    return messages.slice(start);
  }, [messages, visibleMessageCount]);

  const invertedMessages = useMemo(() => {
    return [...displayedMessages].reverse();
  }, [displayedMessages]);

  // Conversation List View
  if (!selectedConversation) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={['#E0E7FF', '#F5D0FE']} style={styles.header}>
          <LinearGradient
            colors={['#60A5FA', '#F472B6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topAccentBar}
          />
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onBack || (() => {})} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color="#2563EB" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Đoạn chat</Text>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={async () => {
                setIsRefreshing(true);
                await loadConversations();
                setIsRefreshing(false);
              }}
              disabled={isRefreshing}
            >
              <Ionicons 
                name="create-outline" 
                size={22} 
                color="#EC4899"
                style={isRefreshing ? { opacity: 0.5 } : {}}
              />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <LinearGradient
            colors={['rgba(255,255,255,0.75)', 'rgba(255,255,255,0.45)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.searchGradient}
          >
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#6B7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm kiếm"
                placeholderTextColor="#6B7280"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </LinearGradient>

          {/* Source toggle: Kênh MXH vs Visitor */}
          <View style={styles.sourceToggleRow}>
            <TouchableOpacity
              style={[
                styles.sourceToggleButton,
                conversationSource === 'external' && styles.sourceToggleButtonActive,
              ]}
              activeOpacity={0.85}
              onPress={() => setConversationSource('external')}
            >
              <View style={styles.sourceToggleInner}>
                <Text
                  style={[
                    styles.sourceToggleText,
                    conversationSource === 'external' && styles.sourceToggleTextActive,
                  ]}
                >
                  Kênh MXH
                </Text>
                {unreadExternalCount > 0 && (
                  <View style={styles.sourceBadge}>
                    <Text style={styles.sourceBadgeText}>
                      {unreadExternalCount > 99 ? '99+' : unreadExternalCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sourceToggleButton,
                conversationSource === 'visitor' && styles.sourceToggleButtonActive,
              ]}
              activeOpacity={0.85}
              onPress={() => setConversationSource('visitor')}
            >
              <View style={styles.sourceToggleInner}>
                <Text
                  style={[
                    styles.sourceToggleText,
                    conversationSource === 'visitor' && styles.sourceToggleTextActive,
                  ]}
                >
                  Visitor
                </Text>
                {unreadVisitorCount > 0 && (
                  <View style={styles.sourceBadge}>
                    <Text style={styles.sourceBadgeText}>
                      {unreadVisitorCount > 99 ? '99+' : unreadVisitorCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
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
              const lastMsg = (conv.lastMessage?.content || '').toLowerCase();
              return (
                customerName.toLowerCase().includes(query) ||
                lastMsg.includes(query)
              );
            })}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            extraData={{ convLastMessageMap, topLabelsMap, convExtraLabelsMap }}
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Chat Header */}
      <LinearGradient colors={['#4F46E5', '#9333EA']} style={styles.chatHeader}>
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
                    conversationSource === 'visitor'
                      ? 'visitor'
                      : (selectedConversation.channel as any)?.socialNetwork?.name || 
                        (selectedConversation.channel as any)?.social?.platform
                  ),
                },
              ]}
            >
              {renderPlatformIcon(
                conversationSource === 'visitor'
                  ? 'visitor'
                  : (selectedConversation.channel as any)?.socialNetwork?.name || 
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
              {conversationSource === 'visitor'
                ? 'Visitor (Web chat)'
                : (selectedConversation.channel as any)?.socialNetwork?.name || 
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
        data={invertedMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContent}
        inverted={true}
        removeClippedSubviews={Platform.OS !== 'web'}
        windowSize={8}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: 50 } as any}
        scrollEventThrottle={16}
        onEndReached={handleLoadOlderMessages}
        onEndReachedThreshold={0.1}
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

      {/* Reply Banner */}
      {replyContext && (
        <View style={styles.replyBar}>
          <View style={styles.replyAccent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.replyTitle} numberOfLines={1}>
              Đang trả lời {replyContext.author || 'tin nhắn'}
            </Text>
            {!!replyContext.content && (
              <Text style={styles.replySnippet} numberOfLines={1}>
                {replyContext.content}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setReplyContext(null)} style={styles.replyClose}>
            <MaterialIcons name="close" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

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
              replyToMessageId: replyContext?.id,
              sendToSocialNetwork: true,
            });
            
            if (result.success && result.message) {
              setMessages([...messages, result.message]);
              setReplyContext(null);
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
        showContactSuggestionButton={conversationSource === 'visitor'}
        onContactSuggestion={async () => {
          if (!selectedConversation || isSending) return;

          const template =
            'Anh/chị vui lòng giúp em cung cấp thông tin liên hệ theo mẫu sau (có thể trả lời từng dòng):\n' +
            '- Họ và tên: \n' +
            '- Số điện thoại: \n' +
            '- Email: \n' +
            '- Địa chỉ: ';

          try {
            setIsSending(true);
            setError(null);

            const result = await chatApi.sendMessage({
              conversationId: selectedConversation.id,
              content: template,
              contentType: 'text',
              replyToMessageId: undefined,
              sendToSocialNetwork: true,
            });

            if (result.success && result.message) {
              setMessages((prev) => [...prev, result.message!]);
              showToast('Đã gửi gợi ý điền thông tin liên hệ');
            } else {
              const errorMsg = result.userMessage || result.error || 'Không thể gửi lời nhắc';
              setError(errorMsg);
              Alert.alert('Lỗi', errorMsg);
            }
          } catch (error) {
            console.error('Error sending contact suggestion:', error);
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
              const enriched: any = { ...uploadResult.message };
              if (replyContext?.id) {
                enriched.replyToMessageId = replyContext.id;
                const original = messages.find(m => m.id === replyContext.id);
                if (original) enriched.replyToMessage = original;
              }
              setMessages([...messages, enriched]);
              setReplyContext(null);
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
              // Calculate pill width to wrap only 6 emojis (exclude '+')
              const EMOJI_COUNT = 6;
              const EMOJI_BTN = 32; // styles.ctxEmojiButton size
              const PLUS_W = 28;    // styles.ctxPlus size
              const GAP = 4;        // styles.ctxReactionPill gap
              const PADDING_H = 16; // paddingHorizontal = 8 * 2
              const PADDING_V = 8;  // paddingVertical

              const pillWidth = EMOJI_COUNT * EMOJI_BTN + (EMOJI_COUNT - 1) * GAP + PADDING_H;
              const pillHeight = EMOJI_BTN + PADDING_V * 2;

              const pillLeft = Math.min(
                Math.max(ctxAnchor.x + ctxAnchor.width / 2 - pillWidth / 2, 12),
                screen.width - pillWidth - 12
              );
              const pillTop = Math.max(ctxAnchor.y - 48, 12);

              // Position '+' outside, to the immediate right of the pill
              const plusGap = 6;
              const plusLeft = Math.min(pillLeft + pillWidth + plusGap, screen.width - PLUS_W - 12);
              const plusTop = pillTop + Math.max(0, Math.round((pillHeight - PLUS_W) / 2));

              return (
                <>
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
                  </Animated.View>

                  <Animated.View
                    style={{
                      position: 'absolute',
                      top: plusTop,
                      left: plusLeft,
                      opacity: overlayOpacity,
                      transform: [{ scale: pillScale }],
                    }}
                  >
                    <TouchableOpacity 
                      onPress={() => { Alert.alert('Thêm cảm xúc', 'Sắp có'); closeContext(); }} 
                      style={styles.ctxPlus}
                    >
                      <MaterialIcons name="add" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </Animated.View>
                </>
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
                  <ScrollView contentContainerStyle={[styles.modalContent, { paddingTop: 0 }] }>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#F3F4F6',
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      marginBottom: 10,
                    }}>
                      <MaterialIcons name="search" size={18} color="#6B7280" />
                      <TextInput
                        style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' }}
                        placeholder="Tìm nhãn..."
                        placeholderTextColor="#9CA3AF"
                        value={msgLabelsSearch}
                        onChangeText={setMsgLabelsSearch}
                      />
                    </View>

                    {(!msgLabelsAll || msgLabelsAll.length === 0) ? (
                      <Text style={{ color: '#6B7280' }}>Không có nhãn</Text>
                    ) : (
                      (() => {
                        const search = (msgLabelsSearch || '').trim().toLowerCase();
                        let list = msgLabelsAll.filter(lb => !search || (lb.name || '').toLowerCase().includes(search));
                        const mid = msgLabelsMessageId;
                        list = list.sort((a, b) => {
                          const aActive = mid ? isLabelAssigned(mid, a.id) : false;
                          const bActive = mid ? isLabelAssigned(mid, b.id) : false;
                          if (aActive !== bActive) return aActive ? -1 : 1; // selected first
                          return (a.name || '').localeCompare(b.name || '');
                        });
                        return (
                          <View style={[styles.modalChipsWrap, { gap: 8 }]}>
                            {list.map((lb) => {
                              const active = mid ? isLabelAssigned(mid, lb.id) : false;
                              const textColor = getTextColorForBg(lb.color || '#6B7280');
                              return (
                                <TouchableOpacity
                                  key={lb.id}
                                  onPress={() => mid && toggleAssignLabel(mid, lb)}
                                  activeOpacity={0.85}
                                  style={{
                                    marginRight: 4,
                                    marginBottom: 8,
                                    borderRadius: 8,
                                    borderWidth: 2,
                                    borderColor: active ? '#2563eb' : 'rgba(0,0,0,0.08)',
                                    backgroundColor: lb.color || '#F3F4F6',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text style={{ color: textColor, fontSize: 13, fontWeight: '700' }}>{lb.name}</Text>
                                  {active && (
                                    <MaterialIcons name="check" size={16} color={textColor} style={{ marginLeft: 6 }} />
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        );
                      })()
                    )}
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      
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
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    opacity: 0.98,
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
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    padding: 4,
    marginLeft: 4,
  },
  searchGradient: {
    borderRadius: 14,
    padding: 1.5,
    marginTop: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 14,
    color: '#111827',
  },
  sourceToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  sourceToggleButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.7)',
    backgroundColor: 'rgba(248,250,252,0.8)',
    paddingVertical: 8,
  },
  sourceToggleButtonActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  sourceToggleText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  sourceToggleTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  sourceBadge: {
    marginTop: 0,
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sourceToggleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#111827',
    letterSpacing: 0.1,
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
    letterSpacing: 0.1,
  },
  conversationUnreadTitle: {
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.15,
  },
  conversationUnreadPreview: {
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 0.12,
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
    width: 32,
    height: 32,
    padding: 4,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctxDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 4,
  },
  ctxDanger: { color: '#EF4444', fontWeight: '600' as '600' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 10,
    marginBottom: 6,
  },
  replyAccent: {
    width: 3,
    height: 28,
    borderRadius: 2,
    backgroundColor: '#3B82F6',
  },
  replyTitle: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 2,
  },
  replySnippet: {
    color: '#6B7280',
    fontSize: 12,
  },
  replyClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  
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
