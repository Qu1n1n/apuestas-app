import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Salas'>;

type Sala = {
  id: string;
  nombre: string;
  estado: 'abierta' | 'cerrada';
};

export default function SalasScreen({ navigation }: Props) {
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
    const unsubscribe = navigation.addListener('focus', cargarSalas);
    return unsubscribe;
  }, [navigation, cargarSalas]);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.botonCrear} onPress={() => navigation.navigate('CrearSala')}>
        <Text style={styles.botonCrearTexto}>+ Crear sala</Text>
      </TouchableOpacity>

      <FlatList
        data={salas}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={cargarSalas} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Todavía no tienes salas. Crea una o espera a que te añadan a una.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.salaItem}
            onPress={() => navigation.navigate('SalaDetalle', { salaId: item.id, salaNombre: item.nombre })}
          >
            <Text style={styles.salaNombre}>{item.nombre}</Text>
            <Text style={styles.salaEstado}>{item.estado}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  botonCrear: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  botonCrearTexto: { color: 'white', fontWeight: '600' },
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
