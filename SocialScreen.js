import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Alert,
  Modal,
} from 'react-native';
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

const SocialScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'requests' | 'friends'
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

  // Map Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendLocation, setFriendLocation] = useState(null);
  const [loadingMap, setLoadingMap] = useState(false);

  // Real-time map location listener reference
  const mapUnsubscribeRef = useRef(null);

  // Track auth via state so effects re-run once the session is restored
  const [currentUserId, setCurrentUserId] = useState(auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUserId(user?.uid ?? null);
    });
    return unsub;
  }, []);

  // -------------------------------------------------------------
  // 1. Listen for current user's friends & request arrays
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentUserId) return;

    const userDocRef = doc(db, 'students', currentUserId);
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

  // Helper function to chunk array for Firestore 'in' query limit (30 max)
  const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  // -------------------------------------------------------------
  // 2. Hydrate details for Friends List & Incoming Requests
  // -------------------------------------------------------------
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
            collection(db, 'students'),
            where('__name__', 'in', chunk)
          );
          const snapshot = await getDocs(q);
          const docsData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
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

  // Clean up map subscription on unmount
  useEffect(() => {
    return () => {
      if (mapUnsubscribeRef.current) {
        mapUnsubscribeRef.current();
      }
    };
  }, []);

  // -------------------------------------------------------------
  // 3. Search Logic
  // -------------------------------------------------------------
  const handleSearch = async () => {
    const trimmedQuery = searchText.trim();
    if (!trimmedQuery) return;

    setLoading(true);
    setHasSearched(true);

    const formattedQuery = trimmedQuery.toLowerCase();

    try {
      const studentsRef = collection(db, 'students');

      const qExact = query(
        studentsRef,
        where('name', '>=', trimmedQuery),
        where('name', '<=', trimmedQuery + '\uf8ff')
      );

      const qLowercase = query(
        studentsRef,
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
      Alert.alert('Error', 'Failed to search users. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchText('');
    setResults([]);
    setHasSearched(false);
  };

  // -------------------------------------------------------------
  // 4. Friend Request Handlers
  // -------------------------------------------------------------
  const sendFriendRequest = async (targetUserId) => {
    try {
      await updateDoc(doc(db, 'students', currentUserId), {
        outgoingRequests: arrayUnion(targetUserId),
      });

      await updateDoc(doc(db, 'students', targetUserId), {
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
      const myRef = doc(db, 'students', currentUserId);
      const friendRef = doc(db, 'students', targetUserId);

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
      await updateDoc(doc(db, 'students', currentUserId), {
        incomingRequests: arrayRemove(targetUserId),
      });

      // Fixed: remove MY id from the sender's outgoing list
      await updateDoc(doc(db, 'students', targetUserId), {
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
              await updateDoc(doc(db, 'students', currentUserId), {
                friends: arrayRemove(targetUserId),
              });
              await updateDoc(doc(db, 'students', targetUserId), {
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

  // -------------------------------------------------------------
  // 5. Map Modal Handlers (reads users/{id}.location saved by MainScreen)
  // -------------------------------------------------------------
  const handleOpenMap = (friend) => {
    setSelectedFriend(friend);
    setIsModalVisible(true);
    setLoadingMap(true);

    if (mapUnsubscribeRef.current) {
      mapUnsubscribeRef.current();
    }

    const friendDocRef = doc(db, 'users', friend.id);

    mapUnsubscribeRef.current = onSnapshot(
      friendDocRef,
      (snapshot) => {
        setLoadingMap(false);

        // MainScreen saves the location nested under `location`
        const loc = snapshot.exists() ? snapshot.data().location : null;

        if (loc?.latitude != null && loc?.longitude != null) {
          // Works with an ISO string (current) or a Firestore Timestamp
          const raw = loc.lastUpdated;
          const lastUpdated = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null;

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
  };

  // -------------------------------------------------------------
  // 6. Render Items
  // -------------------------------------------------------------
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
          <Text style={styles.userName}>{item.name || 'Unnamed Student'}</Text>
          {item.city ? <Text style={styles.userDetails}>📍 {item.city}</Text> : null}
        </View>

        {isFriend ? (
          <View style={styles.badgeSuccess}>
            <Text style={styles.badgeText}>Friends</Text>
          </View>
        ) : isOutgoing ? (
          <View style={styles.badgePending}>
            <Text style={styles.badgeTextPending}>Pending</Text>
          </View>
        ) : isIncoming ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => acceptFriendRequest(item.id)}
          >
            <Text style={styles.actionBtnText}>Accept</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => sendFriendRequest(item.id)}
          >
            <Text style={styles.actionBtnText}>+ Add</Text>
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
        <Text style={styles.userName}>{item.name || 'Unnamed Student'}</Text>
        {item.city ? <Text style={styles.userDetails}>📍 {item.city}</Text> : null}
      </View>

      <View style={styles.friendActions}>
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() => handleOpenMap(item)}
        >
          <Text style={styles.mapBtnText}>View Map</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => removeFriend(item.id, item.name)}
        >
          <Text style={styles.removeBtnText}>✕</Text>
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
        <Text style={styles.userName}>{item.name || 'Unnamed Student'}</Text>
        <Text style={styles.userDetails}>Wants to share location</Text>
      </View>

      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => acceptFriendRequest(item.id)}
        >
          <Text style={styles.actionBtnText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectBtn}
          onPress={() => rejectFriendRequest(item.id)}
        >
          <Text style={styles.rejectBtnText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image
            source={require('../assets/logo1.png')}
            style={styles.headerIcon}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>MakeMyCitySafe</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.activeTab]}
          onPress={() => setActiveTab('search')}
        >
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
            Search
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            Requests {incomingRequests.length > 0 ? `(${incomingRequests.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
            Friends ({myFriends.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.container}>
        {activeTab === 'search' && (
          <>
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search students by name..."
                  placeholderTextColor="#767683"
                  value={searchText}
                  onChangeText={setSearchText}
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
                {searchText.length > 0 && (
                  <TouchableOpacity style={styles.clearSearchBtn} onPress={clearSearch}>
                    <Text style={styles.clearSearchBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={handleSearch}
                activeOpacity={0.85}
              >
                <Text style={styles.searchBtnText}>Search</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#000666" style={styles.loader} />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={renderSearchResultItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  hasSearched ? (
                    <Text style={styles.emptyText}>
                      No students found matching "{searchText}"
                    </Text>
                  ) : (
                    <Text style={styles.emptyText}>
                      Search for students by entering their name above.
                    </Text>
                  )
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
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No pending friend requests.</Text>
            }
          />
        )}

        {activeTab === 'friends' && (
          <FlatList
            data={friendsDetails}
            keyExtractor={(item) => item.id}
            renderItem={renderFriendItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                You haven't added any friends yet.
              </Text>
            }
          />
        )}
      </View>

      {/* Location Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseMap}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedFriend?.name || 'Friend'}'s Location
              </Text>
              <TouchableOpacity style={styles.closeBtn} onPress={handleCloseMap}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Content Area */}
            {loadingMap ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#000666" />
              </View>
            ) : friendLocation ? (
              <MapView style={styles.modalMap} region={friendLocation}>
                <Marker
                  coordinate={{
                    latitude: friendLocation.latitude,
                    longitude: friendLocation.longitude,
                  }}
                  title={selectedFriend?.name || 'Friend'}
                  description={
                    friendLocation.lastUpdated
                      ? `Last updated: ${friendLocation.lastUpdated.toLocaleString()}`
                      : 'Last known location'
                  }
                />
              </MapView>
            ) : (
              <View style={styles.centerContainer}>
                <Text style={styles.noLocationText}>
                  No location data available for this student.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    height: 56,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    width: 28,
    height: 28,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000666',
    letterSpacing: -0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#000666',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#767683',
  },
  activeTabText: {
    color: '#000666',
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
  },
  searchInputContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchInput: {
    height: 48,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c6c5d4',
    paddingLeft: 12,
    paddingRight: 36,
    fontSize: 16,
    color: '#1a1c1c',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 10,
    padding: 4,
  },
  clearSearchBtnText: {
    color: '#767683',
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchBtn: {
    height: 48,
    paddingHorizontal: 20,
    backgroundColor: '#000666',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  loader: {
    marginTop: 40,
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c6c5d4',
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a237e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  userDetails: {
    fontSize: 13,
    color: '#454652',
    marginTop: 2,
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    backgroundColor: '#000666',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  rejectBtn: {
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 6,
  },
  rejectBtnText: {
    color: '#d32f2f',
    fontWeight: '600',
    fontSize: 13,
  },
  mapBtn: {
    backgroundColor: '#1a237e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  mapBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  removeBtn: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  removeBtnText: {
    color: '#d32f2f',
    fontWeight: 'bold',
    fontSize: 13,
  },
  badgeSuccess: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    color: '#2e7d32',
    fontWeight: '600',
    fontSize: 12,
  },
  badgePending: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeTextPending: {
    color: '#ef6c00',
    fontWeight: '600',
    fontSize: 12,
  },
  requestActions: {
    flexDirection: 'row',
  },
  emptyText: {
    textAlign: 'center',
    color: '#767683',
    marginTop: 40,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    height: '65%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000666',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f1f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#454652',
  },
  modalMap: {
    flex: 1,
    width: '100%',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noLocationText: {
    color: '#767683',
    fontSize: 15,
    textAlign: 'center',
  },
});

export default SocialScreen;
