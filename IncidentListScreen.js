import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, ScrollView, StatusBar, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { INCIDENT_TYPES, SEVERITY_LEVELS, STATUS_TYPES } from '../constants/incidentTypes';

const { height: SCREEN_H } = Dimensions.get('window');
const scale = (s, n, l) => (SCREEN_H < 700 ? s : SCREEN_H > 850 ? l : n);
const SPACING = { xs: scale(4, 6, 8), sm: scale(8, 10, 12), md: scale(12, 16, 20), lg: scale(16, 20, 24) };
const COLORS = { primary: '#000666', primaryLight: '#F0F2FF', background: '#F5F7FA',
  surface: '#fff', text: '#1a1c1c', subtext: '#4A4A5A', muted: '#8A8A9E', border: '#E6E8EE',
  inputBg: '#F9FAFC', danger: '#D32F2F', dangerLight: '#FFEBEE', success: '#2E7D32',
  successLight: '#E8F5E9', warning: '#F57C00', warningLight: '#FFF3E0' };

const IncidentListScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [incidents, setIncidents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q,
      (snap) => {
        setIncidents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error('Error listening to incidents:', error);
        setLoading(false);
        setRefreshing(false);
      });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let result = incidents;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((inc) =>
        (inc.title || '').toLowerCase().includes(q) ||
        (inc.location || '').toLowerCase().includes(q) ||
        (inc.description || '').toLowerCase().includes(q));
    }
    if (filterType !== 'all') result = result.filter((inc) => inc.type === filterType);
    setFiltered(result);
  }, [incidents, search, filterType]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderItem = ({ item }) => {
    const typeInfo = INCIDENT_TYPES.find((t) => t.id === item.type);
    const statusInfo = STATUS_TYPES.find((s) => s.id === item.status);
    const severityInfo = SEVERITY_LEVELS.find((s) => s.id === item.severity);
    const date = item.date ? new Date(item.date) : new Date(item.createdAt?.toDate?.() || Date.now());
    const typeColor = typeInfo?.color || COLORS.muted;

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85}
        onPress={() => navigation.navigate('Incident Detail', { incidentId: item.id })}>
        <View style={[styles.cardAccent, { backgroundColor: typeColor }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={[styles.typeBadge, { backgroundColor: `${typeColor}18` }]}>
              <Ionicons name="alert-circle" size={11} color={typeColor} />
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeInfo?.label || 'Incident'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo?.color || COLORS.muted }]}>
              <Text style={styles.statusBadgeText}>{statusInfo?.label || 'Unknown'}</Text>
            </View>
          </View>

          <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Untitled Incident'}</Text>
          {item.description && <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>}

          <View style={styles.cardMetaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={12} color={COLORS.muted} />
              <Text style={styles.metaText} numberOfLines={1}>{item.location || 'No location'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.muted} />
              <Text style={styles.metaText}>{date.toLocaleDateString()}</Text>
            </View>
            {severityInfo && (
              <View style={styles.metaItem}>
                <View style={[styles.severityDot, { backgroundColor: severityInfo.color }]} />
                <Text style={styles.metaText}>{severityInfo.label}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.chevronBox}><Ionicons name="chevron-forward" size={18} color="#B0B3BF" /></View>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading incidents...</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Incidents</Text>
          <Text style={styles.headerSubtitle}>{filtered.length} {filtered.length === 1 ? 'report' : 'reports'}</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={COLORS.muted} style={styles.searchIcon} />
        <TextInput style={styles.searchInput} placeholder="Search by title, location, description..."
          placeholderTextColor={COLORS.muted} value={search} onChangeText={setSearch} returnKeyType="search" />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}>
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
          onPress={() => setFilterType('all')} activeOpacity={0.85}>
          <Text style={[styles.filterText, filterType === 'all' && styles.filterTextActive]}>All Types</Text>
        </TouchableOpacity>
        {INCIDENT_TYPES.map((type) => {
          const isActive = filterType === type.id;
          return (
            <TouchableOpacity key={type.id}
              style={[styles.filterChip, isActive && { backgroundColor: type.color, borderColor: type.color }]}
              onPress={() => setFilterType(type.id)} activeOpacity={0.85}>
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{type.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={renderItem}
        contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty, { paddingBottom: insets.bottom + SPACING.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
          tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="document-text-outline" size={40} color={COLORS.muted} />
            </View>
            <Text style={styles.emptyTitle}>No incidents found</Text>
            <Text style={styles.emptySubtext}>
              {search || filterType !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Be the first to report an incident from the map.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default IncidentListScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: scale(16, 18, 20), fontWeight: '700', color: COLORS.primary },
  headerSubtitle: { fontSize: scale(10, 11, 12), color: COLORS.muted, marginTop: 1, fontWeight: '500' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.muted, fontSize: scale(12, 13, 14), fontWeight: '500' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: SPACING.md, marginTop: SPACING.sm, paddingHorizontal: 12,
    paddingVertical: scale(6, 8, 10), borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: scale(13, 14, 15), color: COLORS.text, paddingVertical: 2 },

  filterRow: { flexGrow: 0, marginTop: SPACING.sm, maxHeight: scale(38, 42, 46) },
  filterRowContent: { paddingHorizontal: SPACING.md, paddingVertical: 6, gap: 8, alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: scale(11, 12, 13), color: COLORS.subtext, fontWeight: '600' },
  filterTextActive: { color: '#fff', fontWeight: '700' },

  list: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },

  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: scale(14, 16, 18),
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: SPACING.sm, paddingRight: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 4 },
  typeBadgeText: { fontSize: scale(9, 10, 11), fontWeight: '700', letterSpacing: 0.3 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusBadgeText: { color: '#fff', fontSize: scale(9, 10, 11), fontWeight: '700' },
  cardTitle: { fontSize: scale(14, 15, 16), fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  cardDescription: { fontSize: scale(11, 12, 13), color: COLORS.subtext, lineHeight: scale(16, 18, 20), marginBottom: 6 },
  cardMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: scale(10, 11, 12), color: COLORS.muted, fontWeight: '500' },
  severityDot: { width: 7, height: 7, borderRadius: 3.5 },
  chevronBox: { justifyContent: 'center', paddingRight: SPACING.sm },

  emptyContainer: { alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xl },
  emptyIconBox: { width: scale(80, 90, 100), height: scale(80, 90, 100), borderRadius: scale(20, 22, 24),
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  emptyTitle: { fontSize: scale(15, 16, 17), fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  emptySubtext: { fontSize: scale(12, 13, 14), color: COLORS.muted, textAlign: 'center', lineHeight: scale(18, 19, 20) },
});
