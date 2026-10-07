import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
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
  inputBg: '#F9FAFC',
  danger: '#D32F2F',
  dangerLight: '#FFEBEE',
  success: '#2E7D32',
  successLight: '#E8F5E9',
  warning: '#F57C00',
  warningLight: '#FFF3E0',
};

// ---------- Tabs ----------
const TABS = [
  { key: 'search', label: 'Search', icon: 'search' },
  { key: 'requests', label: 'Requests', icon: 'person-add' },
  { key: 'friends', label: 'Friends', icon: 'people' },
];

const SocialScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState('search');
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Firestore user state
  const [myFriends, setMyFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friendsDetails, setFriendsDetails] = useState([]);
  const [requestsDetails, setRequestsDetails] = useState([]);

  // Map modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendLocation, setFriendLocation] = useState(null);
  const [loadingMap, setLoadingMap] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const mapUnsubscribeRef = useRef(null);
  const [currentUserId, setCurrentUserId] = useState(
    auth.currentUser?.uid ?? null
  );

  // ---------- Auth listener ----------
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUserId(user?.uid ?? null);
    });
    return unsub;
  }, []);

  // ---------- User doc listener (friends + requests arrays) ----------
  useEffect(() => {
    if (!currentUserId) return;

    const userDocRef = doc(db, 'users', currentUserId);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setMyFriends(data.friends || []);
          setIncomingRequests(data.incomingRequests || []);
          setOutgoingRequests(data.outgoingRequests || []);
        }
      },
      (error) => {
        console.error('Error listening to user doc:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  // ---------- Hydrate friend & request details ----------
  useEffect(() => {
    const fetchUsersByIds = async (ids, setter) => {
      if (!ids || ids.length === 0) {
        setter([]);
        return;
      }
      try {
        const idChunks = chunkArray(ids, 30);
        let fetchedList = [];

        for (const chunk of idChunks) {
          const q = query(
            collection(db, 'users'),
            where('__name__', 'in', chunk)
          );
          const snapshot = await getDocs(q);
          const docsData = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          fetchedList = [...fetchedList, ...docsData];
        }
        setter(fetchedList);
      } catch (err) {
        console.error('Error fetching user profiles:', err);
      }
    };

    if (activeTab === 'friends') {
      fetchUsersByIds(myFriends, setFriendsDetails);
    } else if (activeTab === 'requests') {
      fetchUsersByIds(incomingRequests, setRequestsDetails);
    }
  }, [activeTab, myFriends, incomingRequests]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapUnsubscribeRef.current) {
        mapUnsubscribeRef.current();
      }
    };
  }, []);

  // ---------- Search ----------
  const handleSearch = async () => {
    const trimmedQuery = searchText.trim();
    if (!trimmedQuery) return;

    setLoading(true);
    setHasSearched(true);

    const formattedQuery = trimmedQuery.toLowerCase();

    try {
      const usersRef = collection(db, 'users');

      const qExact = query(
        usersRef,
        where('name', '>=', trimmedQuery),
        where('name', '<=', trimmedQuery + '\uf8ff')
      );

      const qLowercase = query(
        usersRef,
        where('name_lowercase', '>=', formattedQuery),
        where('name_lowercase', '<=', formattedQuery + '\uf8ff')
      );

      const [snapshotExact, snapshotLowercase] = await Promise.all([
        getDocs(qExact),
        getDocs(qLowercase),
      ]);

      const usersMap = new Map();

      snapshotExact.forEach((docSnap) => {
        if (docSnap.id !== currentUserId) {
          usersMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        }
      });

      snapshotLowercase.forEach((docSnap) => {
        if (docSnap.id !== currentUserId) {
          usersMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        }
      });

      setResults(Array.from(usersMap.values()));
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchText('');
    setResults([]);
    setHasSearched(false);
  };

  // ---------- Friend requests ----------
  const sendFriendRequest = async (targetUserId) => {
    try {
      await updateDoc(doc(db, 'users', currentUserId), {
        outgoingRequests: arrayUnion(targetUserId),
      });
      await updateDoc(doc(db, 'users', targetUserId), {
        incomingRequests: arrayUnion(currentUserId),
      });
      Alert.alert('Success', 'Friend request sent!');
    } catch (err) {
      console.error('Error sending friend request:', err);
      Alert.alert('Error', 'Could not send friend request.');
    }
  };

  const acceptFriendRequest = async (targetUserId) => {
    try {
      const myRef = doc(db, 'users', currentUserId);
      const friendRef = doc(db, 'users', targetUserId);

      await updateDoc(myRef, {
        friends: arrayUnion(targetUserId),
        incomingRequests: arrayRemove(targetUserId),
      });

      await updateDoc(friendRef, {
        friends: arrayUnion(currentUserId),
        outgoingRequests: arrayRemove(currentUserId),
      });

      Alert.alert('Connected', 'Friend request accepted!');
    } catch (err) {
      console.error('Error accepting friend request:', err);
      Alert.alert('Error', 'Failed to accept friend request.');
    }
  };

  const rejectFriendRequest = async (targetUserId) => {
    try {
      await updateDoc(doc(db, 'users', currentUserId), {
        incomingRequests: arrayRemove(targetUserId),
      });
      await updateDoc(doc(db, 'users', targetUserId), {
        outgoingRequests: arrayRemove(currentUserId),
      });
    } catch (err) {
      console.error('Error rejecting friend request:', err);
    }
  };

  const removeFriend = async (targetUserId, targetUserName) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${targetUserName || 'this friend'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', currentUserId), {
                friends: arrayRemove(targetUserId),
              });
              await updateDoc(doc(db, 'users', targetUserId), {
                friends: arrayRemove(currentUserId),
              });
            } catch (err) {
              console.error('Error removing friend:', err);
              Alert.alert('Error', 'Could not remove friend.');
            }
          },
        },
      ]
    );
  };

  // ---------- Map modal ----------
  const handleOpenMap = (friend) => {
    setSelectedFriend(friend);
    setIsModalVisible(true);
    setLoadingMap(true);
    setMapReady(false);

    if (mapUnsubscribeRef.current) {
      mapUnsubscribeRef.current();
    }

    const friendDocRef = doc(db, 'users', friend.id);

    mapUnsubscribeRef.current = onSnapshot(
      friendDocRef,
      (snapshot) => {
        setLoadingMap(false);
        const loc = snapshot.exists() ? snapshot.data().location : null;

        if (loc?.latitude != null && loc?.longitude != null) {
          const raw = loc.lastUpdated;
          const lastUpdated = raw?.toDate
            ? raw.toDate()
            : raw
            ? new Date(raw)
            : null;

          setFriendLocation({
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
            lastUpdated,
          });
        } else {
          setFriendLocation(null);
        }
      },
      (error) => {
        console.error('Error listening to friend location:', error);
        setLoadingMap(false);
        Alert.alert('Error', 'Could not load location.');
      }
    );
  };

  const handleCloseMap = () => {
    if (mapUnsubscribeRef.current) {
      mapUnsubscribeRef.current();
      mapUnsubscribeRef.current = null;
    }
    setIsModalVisible(false);
    setSelectedFriend(null);
    setFriendLocation(null);
    setMapReady(false);
  };

  // ---------- Renders ----------
  const renderSearchResultItem = ({ item }) => {
    const isFriend = myFriends.includes(item.id);
    const isOutgoing = outgoingRequests.includes(item.id);
    const isIncoming = incomingRequests.includes(item.id);

    return (
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.name || 'Unnamed Student'}
          </Text>
          {item.city ? (
            <View style={styles.metaRow}>
              <Ionicons
                name="location-outline"
                size={12}
                color={COLORS.muted}
              />
              <Text style={styles.userDetails} numberOfLines={1}>
                {item.city}
              </Text>
            </View>
          ) : null}
        </View>

        {isFriend ? (
          <View style={styles.badgeSuccess}>
            <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
            <Text style={styles.badgeSuccessText}>Friends</Text>
          </View>
        ) : isOutgoing ? (
          <View style={styles.badgePending}>
            <Ionicons name="time" size={12} color={COLORS.warning} />
            <Text style={styles.badgePendingText}>Pending</Text>
          </View>
        ) : isIncoming ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => acceptFriendRequest(item.id)}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnText}>Accept</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => sendFriendRequest(item.id)}
            activeOpacity={0.85}
          >
            <Ionicons name="person-add" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFriendItem = ({ item }) => (
    <View style={styles.userCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.name ? item.name.charAt(0).toUpperCase() : '?'}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.name || 'Unnamed Student'}
        </Text>
        {item.city ? (
          <View style={styles.metaRow}>
            <Ionicons
              name="location-outline"
              size={12}
              color={COLORS.muted}
            />
            <Text style={styles.userDetails} numberOfLines={1}>
              {item.city}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.friendActions}>
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() => handleOpenMap(item)}
          activeOpacity={0.85}
        >
          <Ionicons name="map" size={14} color="#fff" />
          <Text style={styles.mapBtnText}>Map</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => removeFriend(item.id, item.name)}
          activeOpacity={0.85}
        >
          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRequestItem = ({ item }) => (
    <View style={styles.userCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.name ? item.name.charAt(0).toUpperCase() : '?'}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.name || 'Unnamed Student'}
        </Text>
        <Text style={styles.userDetails}>Wants to share location</Text>
      </View>

      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.acceptSmallBtn}
          onPress={() => acceptFriendRequest(item.id)}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectSmallBtn}
          onPress={() => rejectFriendRequest(item.id)}
          activeOpacity={0.85}
        >
          <Ionicons name="close" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Social</Text>
          <Text style={styles.headerSubtitle}>
            {myFriends.length} friend{myFriends.length === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Segmented tabs */}
      <View style={styles.tabsWrapper}>
        <View style={styles.tabContainer}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const badge =
              tab.key === 'requests'
                ? incomingRequests.length
                : tab.key === 'friends'
                ? myFriends.length
                : 0;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={isActive ? COLORS.primary : COLORS.muted}
                />
                <Text
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                >
                  {tab.label}
                </Text>
                {badge > 0 && (
                  <View
                    style={[
                      styles.tabBadge,
                      isActive && styles.tabBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabBadgeText,
                        isActive && { color: '#fff' },
                      ]}
                    >
                      {badge}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'search' && (
          <>
            <View style={styles.searchContainer}>
              <View style={styles.searchInputWrapper}>
                <Ionicons
                  name="search"
                  size={16}
                  color={COLORS.muted}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search users by name..."
                  placeholderTextColor={COLORS.muted}
                  value={searchText}
                  onChangeText={setSearchText}
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
                {searchText.length > 0 && (
                  <TouchableOpacity
                    onPress={clearSearch}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={COLORS.muted}
                    />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={handleSearch}
                activeOpacity={0.85}
              >
                <Text style={styles.searchBtnText}>Go</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={renderSearchResultItem}
                contentContainerStyle={[
                  styles.listContent,
                  results.length === 0 && styles.listContentEmpty,
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconBox}>
                      <Ionicons
                        name={hasSearched ? 'search' : 'people-outline'}
                        size={40}
                        color={COLORS.muted}
                      />
                    </View>
                    <Text style={styles.emptyTitle}>
                      {hasSearched
                        ? 'No users found'
                        : 'Find new friends'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                      {hasSearched
                        ? `No one matches "${searchText}"`
                        : 'Search by name to add friends and share locations.'}
                    </Text>
                  </View>
                }
              />
            )}
          </>
        )}

        {activeTab === 'requests' && (
          <FlatList
            data={requestsDetails}
            keyExtractor={(item) => item.id}
            renderItem={renderRequestItem}
            contentContainerStyle={[
              styles.listContent,
              requestsDetails.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBox}>
                  <Ionicons
                    name="person-add-outline"
                    size={40}
                    color={COLORS.muted}
                  />
                </View>
                <Text style={styles.emptyTitle}>No pending requests</Text>
                <Text style={styles.emptySubtext}>
                  Friend requests you receive will appear here.
                </Text>
              </View>
            }
          />
        )}

        {activeTab === 'friends' && (
          <FlatList
            data={friendsDetails}
            keyExtractor={(item) => item.id}
            renderItem={renderFriendItem}
            contentContainerStyle={[
              styles.listContent,
              friendsDetails.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBox}>
                  <Ionicons
                    name="people-outline"
                    size={40}
                    color={COLORS.muted}
                  />
                </View>
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptySubtext}>
                  Add friends from the Search tab to share locations.
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Location modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={handleCloseMap}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom + SPACING.md },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>
                    {selectedFriend?.name
                      ? selectedFriend.name.charAt(0).toUpperCase()
                      : '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selectedFriend?.name || 'Friend'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {friendLocation
                      ? 'Live location'
                      : 'Awaiting location...'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleCloseMap}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View
              style={styles.modalMapWrapper}
              onLayout={() => setMapReady(true)}
            >
              {loadingMap ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Loading location...</Text>
                </View>
              ) : friendLocation && mapReady ? (
                <MapView style={styles.modalMap} region={friendLocation}>
                  <Marker
                    coordinate={{
                      latitude: friendLocation.latitude,
                      longitude: friendLocation.longitude,
                    }}
                    title={selectedFriend?.name || 'Friend'}
                    description={
                      friendLocation.lastUpdated
                        ? `Updated: ${friendLocation.lastUpdated.toLocaleString()}`
                        : 'Last known location'
                    }
                    pinColor={COLORS.primary}
                  />
                </MapView>
              ) : (
                <View style={styles.centered}>
                  <View style={styles.emptyIconBox}>
                    <Ionicons
                      name="location-outline"
                      size={40}
                      color={COLORS.muted}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>No location available</Text>
                  <Text style={styles.emptySubtext}>
                    This friend hasn't shared a location yet.
                  </Text>
                </View>
              )}
            </View>

            {friendLocation?.lastUpdated && (
              <View style={styles.lastUpdatedRow}>
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={COLORS.muted}
                />
                <Text style={styles.lastUpdatedText}>
                  Updated {friendLocation.lastUpdated.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default SocialScreen;

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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: scale(16, 18, 20),
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontSize: scale(10, 11, 12),
    color: COLORS.muted,
    marginTop: 1,
    fontWeight: '500',
  },

  // Tabs
  tabsWrapper: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(8, 10, 12),
    borderRadius: 8,
    gap: 5,
  },
  tabActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabText: {
    fontSize: scale(11, 12, 13),
    fontWeight: '600',
    color: COLORS.muted,
  },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },
  tabBadge: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  tabBadgeActive: { backgroundColor: COLORS.primary },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.muted,
  },

  // Content
  content: { flex: 1, marginTop: SPACING.sm },

  // Search
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: scale(6, 8, 10),
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: scale(13, 14, 15),
    color: COLORS.text,
    paddingVertical: 4,
  },
  searchBtn: {
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: scale(13, 14, 15),
  },

  // List
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: SPACING.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  avatar: {
    width: scale(40, 44, 48),
    height: scale(40, 44, 48),
    borderRadius: scale(20, 22, 24),
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: {
    color: '#fff',
    fontSize: scale(16, 17, 18),
    fontWeight: '700',
  },
  userInfo: { flex: 1, marginRight: SPACING.sm },
  userName: {
    fontSize: scale(13, 14, 15),
    fontWeight: '700',
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  userDetails: {
    fontSize: scale(10, 11, 12),
    color: COLORS.muted,
    flexShrink: 1,
  },

  // Buttons on cards
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: scale(11, 12, 13),
  },

  friendActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  mapBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: scale(11, 12, 13),
  },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  requestActions: { flexDirection: 'row', gap: 6 },
  acceptSmallBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectSmallBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Badges
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeSuccessText: {
    color: COLORS.success,
    fontWeight: '700',
    fontSize: scale(10, 11, 12),
  },
  badgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgePendingText: {
    color: COLORS.warning,
    fontWeight: '700',
    fontSize: scale(10, 11, 12),
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
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
  emptySubtext: {
    fontSize: scale(12, 13, 14),
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: scale(18, 19, 20),
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  modalAvatar: {
    width: scale(40, 44, 48),
    height: scale(40, 44, 48),
    borderRadius: scale(20, 22, 24),
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    color: '#fff',
    fontSize: scale(16, 17, 18),
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: scale(15, 16, 17),
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: scale(11, 12, 13),
    color: COLORS.muted,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMapWrapper: {
    height: scale(320, 380, 420),
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
    marginBottom: SPACING.sm,
  },
  modalMap: { flex: 1, width: '100%' },
  lastUpdatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: SPACING.sm,
  },
  lastUpdatedText: {
    fontSize: scale(11, 12, 13),
    color: COLORS.muted,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.muted,
    fontSize: scale(12, 13, 14),
    fontWeight: '500',
  },
});
