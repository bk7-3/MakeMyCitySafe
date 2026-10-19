import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, SafeAreaView, FlatList, TouchableOpacity, Text,
  TextInput, ScrollView, StatusBar, RefreshControl, Alert } from 'react-native';
import { IconButton, Divider, FAB } from 'react-native-paper';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

const COLORS = { primary: '#000666', primaryContainer: '#1a237e', background: '#f9f9f9',
  surface: '#fff', text: '#1a1c1c', placeholder: '#454652', border: '#c6c5d4', white: '#fff' };

const CATEGORIES = {
  infrastructure: { label: 'Infrastructure', icon: '🏗️', color: '#e65100', bg: '#fff3e0' },
  construction: { label: 'Construction', icon: '🚧', color: '#2e7d32', bg: '#e8f5e9' },
  safety: { label: 'Safety Hazard', icon: '⚠️', color: '#ba1a1a', bg: '#ffdad6' },
  lighting: { label: 'Poor Lighting', icon: '💡', color: '#f9a825', bg: '#fff9c4' },
  other: { label: 'Other', icon: '📌', color: '#454652', bg: '#f0f0f0' },
};
const STATUS_CONFIG = {
  reported: { label: 'Reported', color: '#e65100', bg: '#fff3e0' },
  submitted: { label: 'Submitted', color: '#e65100', bg: '#fff3e0' },
  'in-progress': { label: 'In Progress', color: '#2e7d32', bg: '#e8f5e9' },
  resolved: { label: 'Resolved', color: '#00695c', bg: '#e0f2f1' },
};
const DEFAULT_STATUS = { color: '#454652', bg: '#f0f0f0' };

const STATUS_CHIPS = [{ label: 'All', value: 'all' }, ...Object.entries(STATUS_CONFIG)
  .filter(([k, v], i, a) => a.findIndex(([, x]) => x.label === v.label) === i)
  .map(([key, val]) => ({ label: val.label, value: key }))];
const CATEGORY_CHIPS = [{ label: 'All', value: 'all' },
  ...Object.entries(CATEGORIES).map(([key, val]) => ({ label: `${val.icon} ${val.label}`, value: key }))];

const FilterChips = ({ items, active, onSelect }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}
    style={styles.filterRow} contentContainerStyle={styles.filterContent}>
    {items.map((chip) => (
      <TouchableOpacity key={chip.value} onPress={() => onSelect(chip.value)}
        style={[styles.filterChip, active === chip.value && styles.filterChipActive]}>
        <Text style={active === chip.value ? styles.filterChipTextActive : styles.filterChipText}>
          {chip.label}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const SuggestListScreen = ({ navigation }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, setCurrentUser), []);

  const fetchSuggestions = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'suggestions'), orderBy('reportDateTime', 'desc')));
      setSuggestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      Alert.alert('Error', 'Failed to load reports: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  useEffect(() => navigation.addListener('focus', fetchSuggestions), [navigation, fetchSuggestions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSuggestions();
    setRefreshing(false);
  }, [fetchSuggestions]);

  const q = search.toLowerCase();
  const filtered = suggestions.filter((item) => {
    const matchesSearch = !search ||
      (item.description || '').toLowerCase().includes(q) ||
      (item.reportedByName || item.reportedBy || '').toLowerCase().includes(q) ||
      (item.location || '').toLowerCase().includes(q);
    return matchesSearch
      && (activeStatus === 'all' || item.status === activeStatus)
      && (activeCategory === 'all' || item.category === activeCategory);
  });

  const renderItem = ({ item }) => {
    const cat = CATEGORIES[item.category] || CATEGORIES.other;
    const status = STATUS_CONFIG[item.status] || { ...DEFAULT_STATUS, label: item.status || 'Unknown' };
    const isOwn = currentUser && item.reportedBy === currentUser.uid;
    const formattedDate = item.reportDateTime?.toDate
      ? item.reportDateTime.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    return (
      <TouchableOpacity activeOpacity={0.8}
        onPress={() => navigation.navigate('Suggest Detail', { suggestion: item })}>
        <View style={[styles.card, isOwn && styles.ownCard]}>
          <View style={[styles.iconBox, { backgroundColor: cat.bg }]}>
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: cat.color + '20' }]}>
                <Text style={[styles.badgeText, { color: cat.color }]}>{cat.label}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: status.bg }]}>
                <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
              </View>
              {isOwn && (
                <View style={[styles.badge, { backgroundColor: COLORS.primary + '20' }]}>
                  <Text style={[styles.badgeText, { color: COLORS.primary }]}>Yours</Text>
                </View>
              )}
            </View>
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
            <View style={styles.metaRow}>
              {item.location ? <Text style={styles.metaText}>📍 {item.location}</Text> : null}
              <Text style={styles.metaText}>{formattedDate} · {item.reportedByName || item.reportedBy || 'Anonymous'}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community Reports</Text>
        <IconButton icon="account" size={24} color={COLORS.primary} onPress={() => navigation.navigate('Login')} />
      </View>

      <View style={styles.searchContainer}>
        <TextInput style={styles.searchInput} placeholder="Search reports..." value={search}
          onChangeText={setSearch} placeholderTextColor={COLORS.placeholder} />
      </View>

      <FilterChips items={STATUS_CHIPS} active={activeStatus} onSelect={setActiveStatus} />
      <FilterChips items={CATEGORY_CHIPS} active={activeCategory} onSelect={setActiveCategory} />

      <Divider style={styles.divider} />

      <FlatList data={filtered} renderItem={renderItem} keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>{loading ? 'Loading...' : 'No reports found'}</Text>
            <Text style={styles.emptySubtext}>
              {search || activeStatus !== 'all' || activeCategory !== 'all'
                ? 'Try adjusting your filters.' : 'Be the first to report an issue!'}
            </Text>
          </View>
        }
      />

      <FAB style={styles.fab} icon="plus" color={COLORS.white} onPress={() => navigation.navigate('Suggest Add')} />
    </SafeAreaView>
  );
};

export default SuggestListScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  searchContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchInput: { backgroundColor: '#eee', padding: 12, borderRadius: 12, fontSize: 16, color: COLORS.text },
  filterRow: { flexGrow: 0, marginTop: 8, maxHeight: 44 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#e2e2e2', marginRight: 8, justifyContent: 'center' },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipText: { color: COLORS.placeholder, fontWeight: '500', fontSize: 13 },
  filterChipTextActive: { color: COLORS.white, fontWeight: '500', fontSize: 13 },
  divider: { marginTop: 8, backgroundColor: COLORS.border },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 },
  card: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.border, marginBottom: 12, overflow: 'hidden' },
  ownCard: { borderColor: COLORS.primary, borderWidth: 1.5, backgroundColor: '#f8f9ff' },
  iconBox: { width: 80, justifyContent: 'center', alignItems: 'center' },
  categoryIcon: { fontSize: 28 },
  cardContent: { flex: 1, padding: 12, justifyContent: 'center' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 6, gap: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  description: { fontSize: 15, color: COLORS.text, fontWeight: '500', marginBottom: 6, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 12, color: COLORS.placeholder, flexShrink: 1 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  emptySubtext: { fontSize: 14, color: COLORS.placeholder, marginTop: 4 },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: COLORS.primary },
});
