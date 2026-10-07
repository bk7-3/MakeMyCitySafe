import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { FAB } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
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
  lg: scale(20, 24, 28),
};

// ---------- Categories (matches CreateOpportunityScreen) ----------
const OPPORTUNITY_CATEGORIES = [
  { label: 'All', value: 'all' },
  { label: 'Cleanup', value: 'cleanup' },
  { label: 'Safety Training', value: 'safety' },
  { label: 'Neighborhood Watch', value: 'neighborhood' },
  { label: 'Education', value: 'education' },
  { label: 'Public Health', value: 'health' },
];

// ---------- Category visual config ----------
const getCategoryConfig = (category = '') => {
  switch (category) {
    case 'cleanup':
      return {
        border: '#2E7D32',
        bg: '#E8F5E9',
        text: '#1B5E20',
        icon: 'leaf',
      };
    case 'safety':
      return {
        border: '#F9A825',
        bg: '#FFF9C4',
        text: '#795548',
        icon: 'shield-checkmark',
      };
    case 'neighborhood':
      return {
        border: '#000666',
        bg: '#E0E0FF',
        text: '#000767',
        icon: 'people',
      };
    case 'education':
      return {
        border: '#6A1B9A',
        bg: '#F3E5F5',
        text: '#4A0072',
        icon: 'school',
      };
    case 'health':
      return {
        border: '#BA1A1A',
        bg: '#FFEBEE',
        text: '#93000A',
        icon: 'heart',
      };
    default:
      return {
        border: '#DFE1E8',
        bg: '#F5F7FA',
        text: '#454652',
        icon: 'pricetag',
      };
  }
};

const formatDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const VolunteerDashboard = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [opportunities, setOpportunities] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // ---------- Auth listener ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // ---------- Fetch opportunities ----------
  const fetchOpportunities = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'opportunities'));
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOpportunities(list);
    } catch (err) {
      console.error('Error fetching opportunities:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOpportunities();
  };

  // ---------- Filter ----------
  const filteredOpportunities = opportunities.filter((opp) => {
    const query = search.toLowerCase();
    const matchesSearch =
      !search ||
      (opp.eventName || '').toLowerCase().includes(query) ||
      (opp.groupName || '').toLowerCase().includes(query) ||
      (opp.destination || '').toLowerCase().includes(query) ||
      (opp.description || '').toLowerCase().includes(query);

    if (!matchesSearch) return false;
    if (activeFilter === 'all') return true;
    return opp.category === activeFilter;
  });

  // ---------- Render opportunity card ----------
  const renderItem = ({ item }) => {
    const config = getCategoryConfig(item.category);
    const isOwn = currentUser && item.createdBy === currentUser.uid;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('Opportunity Detail', { opportunity: item })
        }
        style={[styles.card, isOwn && styles.ownCard]}
      >
        {/* Category icon box */}
        <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={scale(22, 26, 30)} color={config.text} />
        </View>

        {/* Details */}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.categoryBadge, { color: config.text }]}>
              {(item.category || 'General').toUpperCase()}
            </Text>
            {isOwn && (
              <View style={styles.ownBadge}>
                <Ionicons name="star" size={9} color="#fff" />
                <Text style={styles.ownBadgeText}>Yours</Text>
              </View>
            )}
          </View>

          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.eventName}
          </Text>

          <View style={styles.cardMetaRow}>
            <Ionicons name="location-outline" size={13} color="#767683" />
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {item.destination || 'No location'}
            </Text>
          </View>

          <View style={styles.cardMetaRow}>
            <Ionicons name="calendar-outline" size={13} color="#767683" />
            <Text style={styles.cardDate} numberOfLines={1}>
              {formatDate(item.date)} · {item.groupName || 'No group'}
            </Text>
          </View>
        </View>

        {/* Chevron */}
        <View style={styles.chevronBox}>
          <Ionicons name="chevron-forward" size={18} color="#B0B3BF" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color="#000666" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Volunteer Connect</Text>
          <Text style={styles.headerSubtitle}>
            {opportunities.length} opportunities
          </Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Find volunteer opportunities..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#8A8A9E"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        {OPPORTUNITY_CATEGORIES.map((chip) => {
          const isActive = activeFilter === chip.value;
          return (
            <TouchableOpacity
              key={chip.value}
              onPress={() => setActiveFilter(chip.value)}
              style={[styles.chip, isActive && styles.chipActive]}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000666" />
          <Text style={styles.loadingText}>Loading opportunities...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOpportunities}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#000666"
              colors={['#000666']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="calendar-outline" size={40} color="#B0B3BF" />
              </View>
              <Text style={styles.emptyTitle}>No opportunities yet</Text>
              <Text style={styles.emptySubtitle}>
                {search || activeFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Tap the + button to create the first one.'}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <FAB
        style={[
          styles.fab,
          { bottom: insets.bottom + SPACING.md },
        ]}
        icon="plus"
        color="#fff"
        onPress={() => navigation.navigate('Create Opportunity')}
      />
    </SafeAreaView>
  );
};

export default VolunteerDashboard;

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E6E8EE',
    gap: SPACING.sm,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: scale(16, 18, 20),
    fontWeight: '700',
    color: '#000666',
  },
  headerSubtitle: {
    fontSize: scale(10, 11, 12),
    color: '#8A8A9E',
    marginTop: 1,
    fontWeight: '500',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    paddingHorizontal: 12,
    paddingVertical: scale(6, 8, 10),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DFE1E8',
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: scale(13, 14, 15),
    color: '#1a1c1c',
    paddingVertical: 2,
  },

  // Chips
  chipRow: {
    flexGrow: 0,
    marginTop: SPACING.sm,
  },
  chipRowContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DFE1E8',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#000666',
    borderColor: '#000666',
  },
  chipText: {
    fontSize: scale(11, 12, 13),
    color: '#454652',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // List
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: scale(14, 16, 18),
    borderWidth: 1,
    borderColor: '#E6E8EE',
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  ownCard: {
    borderColor: '#000666',
    borderWidth: 2,
    backgroundColor: '#F8F9FF',
  },
  iconBox: {
    width: scale(60, 70, 80),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.sm,
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryBadge: {
    fontSize: scale(9, 10, 11),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#000666',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  ownBadgeText: {
    color: '#fff',
    fontSize: scale(8, 9, 10),
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: scale(14, 15, 16),
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 4,
  },
  cardSubtitle: {
    fontSize: scale(11, 12, 13),
    color: '#4A4A5A',
    flex: 1,
  },
  cardDate: {
    fontSize: scale(11, 12, 13),
    color: '#8A8A9E',
    flex: 1,
  },
  chevronBox: {
    justifyContent: 'center',
    paddingRight: SPACING.sm,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: scale(12, 13, 14),
    fontWeight: '500',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
  },
  emptyIconBox: {
    width: scale(80, 90, 100),
    height: scale(80, 90, 100),
    borderRadius: scale(20, 22, 24),
    backgroundColor: '#F0F2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: scale(15, 16, 17),
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: scale(12, 13, 14),
    color: '#8A8A9E',
    textAlign: 'center',
    lineHeight: scale(18, 19, 20),
  },

  // FAB
  fab: {
    position: 'absolute',
    right: SPACING.md,
    backgroundColor: '#000666',
    shadowColor: '#000666',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
});
