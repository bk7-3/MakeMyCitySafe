import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  RefreshControl,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { FAB } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
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
  white: '#ffffff',
};

// ---------- Category config ----------
// Each category has: label, Ionicons icon name, accent color, light background
const CATEGORIES = {
  infrastructure: {
    label: 'Infrastructure',
    icon: 'construct',
    color: '#E65100',
    bg: '#FFF3E0',
  },
  construction: {
    label: 'Construction',
    icon: 'hammer',
    color: '#2E7D32',
    bg: '#E8F5E9',
  },
  safety: {
    label: 'Safety Hazard',
    icon: 'warning',
    color: '#BA1A1A',
    bg: '#FFEBEE',
  },
  lighting: {
    label: 'Poor Lighting',
    icon: 'bulb',
    color: '#F9A825',
    bg: '#FFF9C4',
  },
  other: {
    label: 'Other',
    icon: 'pricetag',
    color: '#454652',
    bg: '#F0F2FF',
  },
};

const STATUS_CONFIG = {
  reported: {
    label: 'Reported',
    color: '#E65100',
    bg: '#FFF3E0',
    icon: 'alert-circle',
  },
  submitted: {
    label: 'Submitted',
    color: '#E65100',
    bg: '#FFF3E0',
    icon: 'paper-plane',
  },
  'in-progress': {
    label: 'In Progress',
    color: '#2E7D32',
    bg: '#E8F5E9',
    icon: 'time',
  },
  resolved: {
    label: 'Resolved',
    color: '#00695C',
    bg: '#E0F2F1',
    icon: 'checkmark-circle',
  },
};

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Reported', value: 'reported' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Resolved', value: 'resolved' },
];

const SuggestListScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [suggestions, setSuggestions] = useState([]);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // -------- Auth listener --------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // -------- Fetch suggestions --------
  const fetchSuggestions = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'suggestions'),
        orderBy('reportDateTime', 'desc')
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSuggestions(list);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      Alert.alert('Error', 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Refresh when screen gets focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchSuggestions();
    });
    return unsubscribe;
  }, [navigation, fetchSuggestions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSuggestions();
    setRefreshing(false);
  }, [fetchSuggestions]);

  // -------- Filtering --------
  const filtered = suggestions.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      (item.description || '').toLowerCase().includes(q) ||
      (item.reportedByName || item.reportedBy || '').toLowerCase().includes(q) ||
      (item.location || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (activeStatus !== 'all' && item.status !== activeStatus) return false;
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    return true;
  });

  // -------- Render card --------
  const renderItem = ({ item }) => {
    const cat = CATEGORIES[item.category] || CATEGORIES.other;
    const status =
      STATUS_CONFIG[item.status] || {
        label: item.status || 'Unknown',
        color: '#454652',
        bg: '#F0F2FF',
        icon: 'help-circle',
      };
    const isOwn = currentUser && item.reportedBy === currentUser.uid;

    const formattedDate = item.reportDateTime?.toDate
      ? item.reportDateTime.toDate().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('Suggest Detail', { suggestion: item })
        }
        style={[styles.card, isOwn && styles.ownCard]}
      >
        {/* Category icon box */}
        <View style={[styles.iconBox, { backgroundColor: cat.bg }]}>
          <Ionicons name={cat.icon} size={scale(22, 26, 30)} color={cat.color} />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          {/* Top row of badges */}
          <View style={styles.cardHeader}>
            <View style={[styles.badge, { backgroundColor: cat.bg }]}>
              <Text style={[styles.badgeText, { color: cat.color }]}>
                {cat.label}
              </Text>
            </View>

            <View style={[styles.badge, { backgroundColor: status.bg }]}>
              <Ionicons name={status.icon} size={10} color={status.color} />
              <Text
                style={[
                  styles.badgeText,
                  { color: status.color, marginLeft: 3 },
                ]}
              >
                {status.label}
              </Text>
            </View>

            {isOwn && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: COLORS.primaryLight },
                ]}
              >
                <Ionicons name="star" size={10} color={COLORS.primary} />
                <Text
                  style={[
                    styles.badgeText,
                    { color: COLORS.primary, marginLeft: 3 },
                  ]}
                >
                  Yours
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>

          {/* Meta row */}
          <View style={styles.metaRow}>
            {item.location ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={12} color={COLORS.muted} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {item.location}
                </Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.muted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {formattedDate || 'Just now'} ·{' '}
                {item.reportedByName || 'Anonymous'}
              </Text>
            </View>
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
          <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Community Reports</Text>
          <Text style={styles.headerSubtitle}>
            {suggestions.length} total report
            {suggestions.length === 1 ? '' : 's'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="person-circle-outline" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search reports..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={COLORS.muted}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {STATUS_FILTERS.map((chip) => {
          const isActive = activeStatus === chip.value;
          return (
            <TouchableOpacity
              key={chip.value}
              onPress={() => setActiveStatus(chip.value)}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive,
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {[
          { label: 'All', value: 'all', icon: 'apps' },
          ...Object.entries(CATEGORIES).map(([key, val]) => ({
            label: val.label,
            value: key,
            icon: val.icon,
            color: val.color,
          })),
        ].map((chip) => {
          const isActive = activeCategory === chip.value;
          return (
            <TouchableOpacity
              key={chip.value}
              onPress={() => setActiveCategory(chip.value)}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
            >
              <Ionicons
                name={chip.icon}
                size={12}
                color={isActive ? '#fff' : chip.color || COLORS.primary}
              />
              <Text
                style={[
                  styles.filterChipText,
                  { marginLeft: 4 },
                  isActive && styles.filterChipTextActive,
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="document-text-outline" size={40} color="#B0B3BF" />
              </View>
              <Text style={styles.emptyTitle}>No reports found</Text>
              <Text style={styles.emptySubtext}>
                {search || activeStatus !== 'all' || activeCategory !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Be the first to report an issue!'}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <FAB
        style={[styles.fab, { bottom: insets.bottom + SPACING.md }]}
        icon="plus"
        color="#fff"
        onPress={() => navigation.navigate('Suggest Add')}
      />
    </SafeAreaView>
  );
};

export default SuggestListScreen;

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  headerTextContainer: { flex: 1 },
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
    borderColor: COLORS.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: scale(13, 14, 15),
    color: COLORS.text,
    paddingVertical: 2,
  },

  // Filters
  filterRow: {
    flexGrow: 0,
    marginTop: SPACING.sm,
    maxHeight: scale(36, 40, 44),
  },
  filterContent: {
    paddingHorizontal: SPACING.md,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: scale(11, 12, 13),
    color: COLORS.subtext,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // List
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: {
    marginTop: 10,
    color: COLORS.muted,
    fontSize: scale(12, 13, 14),
    fontWeight: '500',
  },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: scale(14, 16, 18),
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  ownCard: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: '#F8F9FF',
  },
  iconBox: {
    width: scale(56, 66, 76),
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
    flexWrap: 'wrap',
    marginBottom: 6,
    gap: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: scale(9, 10, 11),
    fontWeight: '700',
  },
  description: {
    fontSize: scale(13, 14, 15),
    color: COLORS.text,
    fontWeight: '500',
    marginBottom: 6,
    lineHeight: scale(18, 19, 20),
  },
  metaRow: {
    flexDirection: 'column',
    gap: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: scale(10, 11, 12),
    color: COLORS.muted,
    flex: 1,
  },
  chevronBox: {
    justifyContent: 'center',
    paddingRight: SPACING.sm,
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
  },

  // FAB
  fab: {
    position: 'absolute',
    right: SPACING.md,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
});
