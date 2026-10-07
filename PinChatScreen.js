import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

// ---------- Responsive helpers ----------
const { height: SCREEN_H } = Dimensions.get('window');
const isSmallDevice = SCREEN_H < 700;
const isLargeDevice = SCREEN_H > 850;

const scale = (small, normal, large) => {
  if (isSmallDevice) return small;
  if (isLargeDevice) return large;
  return normal;
};

const SPACING = {
  xs: scale(4, 6, 8),
  sm: scale(8, 10, 12),
  md: scale(12, 16, 20),
  lg: scale(16, 20, 24),
};

// ---------- Colors ----------
const COLORS = {
  primary: '#000666',
  primaryLight: '#F0F2FF',
  background: '#F5F7FA',
  surface: '#ffffff',
  text: '#1a1c1c',
  subtext: '#4A4A5A',
  muted: '#8A8A9E',
  border: '#E6E8EE',
  myBubble: '#000666',
  theirBubble: '#FFFFFF',
  danger: '#D32F2F',
  dangerLight: '#FFEBEE',
  success: '#2E7D32',
  successLight: '#E8F5E9',
  warning: '#F57C00',
  warningLight: '#FFF3E0',
};

// Category → accent color for banner
const CATEGORY_COLORS = {
  Hazard: { base: '#F57C00', light: '#FFF3E0', icon: 'warning' },
  Crime: { base: '#D32F2F', light: '#FFEBEE', icon: 'alert-circle' },
  SafeSpace: { base: '#2E7D32', light: '#E8F5E9', icon: 'shield-checkmark' },
  SOS: { base: '#D32F2F', light: '#FFEBEE', icon: 'alert' },
};

const getCategoryAccent = (cat) =>
  CATEGORY_COLORS[cat] || {
    base: COLORS.primary,
    light: COLORS.primaryLight,
    icon: 'chatbubbles',
  };

const PinChatScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { hazardId, hazardTitle, category } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef(null);
  const currentUser = auth.currentUser;
  const accent = getCategoryAccent(category);

  // -------- Real-time message listener --------
  useEffect(() => {
    if (!hazardId) {
      setLoading(false);
      return;
    }

    const messagesRef = collection(db, 'hazards', hazardId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            formattedTime: data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Just now',
          };
        });
        setMessages(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching pin messages:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [hazardId]);

  // -------- Send message --------
  const handleSendMessage = async () => {
    if (!inputText.trim() || sending || !hazardId) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const messagesRef = collection(db, 'hazards', hazardId, 'messages');
      await addDoc(messagesRef, {
        text: textToSend,
        senderId: currentUser?.uid || 'anonymous',
        senderName:
          currentUser?.displayName ||
          currentUser?.email?.split('@')[0] ||
          'User',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  // -------- Render message --------
  const renderMessageItem = ({ item }) => {
    const isMe = item.senderId === currentUser?.uid;

    return (
      <View
        style={[
          styles.messageWrapper,
          isMe ? styles.myMessageWrapper : styles.theirMessageWrapper,
        ]}
      >
        {!isMe && (
          <View style={styles.senderRow}>
            <View style={styles.senderAvatar}>
              <Text style={styles.senderInitial}>
                {(item.senderName || 'U')[0].toUpperCase()}
              </Text>
            </View>
            <Text style={styles.senderName}>{item.senderName}</Text>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isMe ? styles.myBubble : styles.theirBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMe ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.text}
          </Text>
        </View>
        <Text style={styles.timestampText}>{item.formattedTime}</Text>
      </View>
    );
  };

  // -------- Render --------
  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header — respects top notch */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            navigation.canGoBack()
              ? navigation.goBack()
              : navigation.navigate('Main')
          }
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBtn}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {hazardTitle || 'Discussion'}
          </Text>
          <View style={styles.headerSubRow}>
            <View
              style={[styles.liveDot, { backgroundColor: accent.base }]}
            />
            <Text style={styles.headerSubtitle}>
              Live chat · {messages.length}{' '}
              {messages.length === 1 ? 'message' : 'messages'}
            </Text>
          </View>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Category banner */}
      <View
        style={[
          styles.bannerContainer,
          { backgroundColor: accent.light },
        ]}
      >
        <View
          style={[
            styles.bannerIconBox,
            { backgroundColor: `${accent.base}20` },
          ]}
        >
          <Ionicons name={accent.icon} size={18} color={accent.base} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: accent.base }]}>
            {category || 'Location Discussion'}
          </Text>
          <Text style={styles.bannerSub}>
            Discuss status updates, active risks, or resolution in real time.
          </Text>
        </View>
      </View>

      {/* Messages + input bar */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading chat...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={[
              styles.listContent,
              messages.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            onLayout={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBox}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={40}
                    color={COLORS.muted}
                  />
                </View>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyText}>
                  Be the first to post an update about this location.
                </Text>
              </View>
            }
          />
        )}

        {/* Input bar — respects bottom gesture bar */}
        <View
          style={[
            styles.inputBar,
            { paddingBottom: Math.max(insets.bottom, SPACING.sm) },
          ]}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.muted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color="#fff"
                style={{ marginLeft: 2 }}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default PinChatScreen;

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: scale(15, 16, 17),
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerSubtitle: {
    fontSize: scale(10, 11, 12),
    color: COLORS.muted,
    fontWeight: '500',
  },

  // Category banner
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: scale(12, 14, 16),
  },
  bannerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: scale(12, 13, 14),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bannerSub: {
    fontSize: scale(10, 11, 12),
    color: COLORS.subtext,
    marginTop: 2,
  },

  // List
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.muted,
    fontSize: scale(12, 13, 14),
    fontWeight: '500',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyIconBox: {
    width: scale(80, 90, 100),
    height: scale(80, 90, 100),
    borderRadius: scale(20, 22, 24),
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: scale(15, 16, 17),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: scale(12, 13, 14),
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: scale(18, 19, 20),
  },

  // Message wrapper
  messageWrapper: {
    marginVertical: 5,
    maxWidth: '82%',
  },
  myMessageWrapper: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirMessageWrapper: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },

  // Sender row
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 4,
    gap: 6,
  },
  senderAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  senderInitial: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  senderName: {
    fontSize: scale(10, 11, 12),
    fontWeight: '700',
    color: COLORS.subtext,
  },

  // Bubble
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: '100%',
  },
  myBubble: {
    backgroundColor: COLORS.myBubble,
    borderBottomRightRadius: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  theirBubble: {
    backgroundColor: COLORS.theirBubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    fontSize: scale(13, 14, 15),
    lineHeight: scale(18, 19, 20),
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: COLORS.text,
  },
  timestampText: {
    fontSize: scale(9, 10, 11),
    color: COLORS.muted,
    marginTop: 4,
    marginHorizontal: 4,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  textInput: {
    minHeight: scale(36, 40, 44),
    maxHeight: 110,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: scale(13, 14, 15),
    color: COLORS.text,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: scale(40, 44, 48),
    height: scale(40, 44, 48),
    borderRadius: scale(20, 22, 24),
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.muted,
    shadowOpacity: 0.1,
    elevation: 0,
  },
});
