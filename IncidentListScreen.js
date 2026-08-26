import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,  
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { INCIDENT_TYPES, SEVERITY_LEVELS, STATUS_TYPES } from '../constants/incidentTypes';

const IncidentListScreen = ({ navigation }) => {
  const [incidents, setIncidents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIncidents(data);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to incidents:', error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    applyFilters();
  }, [incidents, search, filterType]);

  const applyFilters = () => {
    let result = incidents;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(inc =>
        inc.title.toLowerCase().includes(q) ||
        inc.location.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q)
      );
    }
    if (filterType !== 'all') {
      result = result.filter(inc => inc.type === filterType);
    }
    setFiltered(result);
  };

  const renderItem = ({ item }) => {
    const typeInfo = INCIDENT_TYPES.find(t => t.id === item.type);
    const statusInfo = STATUS_TYPES.find(s => s.id === item.status);
    const date = item.date ? new Date(item.date) : new Date(item.createdAt?.toDate?.() || Date.now());

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Incident Detail', { incidentId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo?.color || '#757575' }]}>
            <Text style={styles.statusText}>{statusInfo?.label || 'Unknown'}</Text>
          </View>
        </View>
        <Text style={styles.cardLocation}>{item.location}</Text>
        <View style={styles.cardFooter}>
          <View style={[styles.typeBadge, { backgroundColor: typeInfo?.color || '#757575' }]}>
            <Text style={styles.typeText}>{typeInfo?.label || 'Unknown'}</Text>
          </View>
          <Text style={styles.cardDate}>{date.toLocaleDateString()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#000666" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Incidents</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search incidents..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView horizontal style={styles.filterRow} showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
          onPress={() => setFilterType('all')}
        >
          <Text style={filterType === 'all' ? styles.filterTextActive : styles.filterText}>All Types</Text>
        </TouchableOpacity>
        {INCIDENT_TYPES.map(type => (
          <TouchableOpacity
            key={type.id}
            style={[styles.filterChip, filterType === type.id && styles.filterChipActive]}
            onPress={() => setFilterType(type.id)}
          >
            <Text style={filterType === type.id ? styles.filterTextActive : styles.filterText}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No incidents found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1c1c' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#1a1c1c', paddingVertical: 4 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: '#000666', borderColor: '#000666' },
  filterText: { fontSize: 12, color: '#666' },
  filterTextActive: { fontSize: 12, color: '#fff', fontWeight: '600' },
  list: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e2e2' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1c1c', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardLocation: { fontSize: 14, color: '#666', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  typeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardDate: { fontSize: 12, color: '#999' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999' },
});

export default IncidentListScreen;
