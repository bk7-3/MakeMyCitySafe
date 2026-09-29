import React, { useState, useEffect, useRef } from "react";
import {
  View,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Text, IconButton, Divider } from "react-native-paper";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";

const COLORS = {
  primary: "#0F172A",
  accent: "#2563EB",
  background: "#F8FAFC",
  cardBg: "#FFFFFF",
  textPrimary: "#1E293B",
  textSecondary: "#64748B",
  border: "#E2E8F0",
  myBubble: "#2563EB",
  theirBubble: "#E2E8F0",
};

const PinChatScreen = ({ route, navigation }) => {
  const { hazardId, hazardTitle, category } = route.params;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef(null);
  const currentUser = auth.currentUser;

  // Set top header navigation title
  useEffect(() => {
    navigation.setOptions({
      title: hazardTitle ? `Chat: ${hazardTitle}` : "Pin Discussion",
    });
  }, [navigation, hazardTitle]);

  // Real-time listener for messages under: hazards/{hazardId}/messages
  useEffect(() => {
    if (!hazardId) return;

    const messagesRef = collection(db, "hazards", hazardId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

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
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Just now",
          };
        });
        setMessages(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching pin messages:", error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [hazardId]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const textToSend = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const messagesRef = collection(db, "hazards", hazardId, "messages");
      await addDoc(messagesRef, {
        text: textToSend,
        senderId: currentUser?.uid || "anonymous",
        senderName: currentUser?.displayName || currentUser?.email?.split("@")[0] || "User",
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const renderMessageItem = ({ item }) => {
    const isMe = item.senderId === currentUser?.uid;

    return (
      <View
        style={[
          styles.messageWrapper,
          isMe ? styles.myMessageWrapper : styles.theirMessageWrapper,
        ]}
      >
        {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.bannerContainer}>
          <Text style={styles.bannerTitle}>{hazardTitle || "Location Discussion"}</Text>
          <Text style={styles.bannerSub}>
            Discuss status updates, active risks, or resolution in real time.
          </Text>
        </View>
        <Divider style={styles.divider} />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={styles.loadingText}>Loading chat...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            onLayout={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No messages yet. Be the first to post an update!
                </Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a status update or message..."
            placeholderTextColor={COLORS.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <IconButton
            icon="send"
            size={24}
            iconColor={inputText.trim() ? COLORS.accent : COLORS.textSecondary}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || sending}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  bannerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: COLORS.cardBg,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  bannerSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    backgroundColor: COLORS.border,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  loadingContainer: {
    flex: 1,
    justify: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },
  messageWrapper: {
    marginVertical: 4,
    maxWidth: "80%",
  },
  myMessageWrapper: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  theirMessageWrapper: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  senderName: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 2,
    marginLeft: 4,
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  myBubble: {
    backgroundColor: COLORS.myBubble,
    borderBottomRightRadius: 2,
  },
  theirBubble: {
    backgroundColor: COLORS.theirBubble,
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18,
  },
  myMessageText: {
    color: "#FFFFFF",
  },
  theirMessageText: {
    color: COLORS.textPrimary,
  },
  timestampText: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginHorizontal: 4,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});

export default PinChatScreen;
