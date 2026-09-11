import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';

type Sala = {
  id: string;
  nombre: string;
  estado: 'abierta' | 'cerrada';
};

export default function SalasScreen() {
  const [salas, setSalas] = useState<Sala[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const cargarSalas = useCallback(async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from('salas')
      .select('id, nombre, estado')
      .order('creado_en', { ascending: false });

    if (!error && data) {
      setSalas(data as Sala[]);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    cargarSalas();
  }, [cargarSalas]);

  return (
    <View style={styles.container}>
      <FlatList
        data={salas}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={cargarSalas} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Todavía no tienes salas. Cuando crees una o te añadan a una, aparecerá aquí.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.salaItem}>
            <Text style={styles.salaNombre}>{item.nombre}</Text>
            <Text style={styles.salaEstado}>{item.estado}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
  salaItem: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f2f2f2',
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  salaNombre: { fontSize: 16, fontWeight: '500' },
  salaEstado: { color: '#666' },
});
