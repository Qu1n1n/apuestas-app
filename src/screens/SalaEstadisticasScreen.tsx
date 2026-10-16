import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'SalaEstadisticas'>;

type FilaRanking = {
  usuarioId: string;
  nombre: string;
  creadas: number;
  cumplidas: number;
  incumplidas: number;
};

export default function SalaEstadisticasScreen({ route }: Props) {
  const { salaId } = route.params;
  const [ranking, setRanking] = useState<FilaRanking[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    setRefreshing(true);
    const [{ data: miembros }, { data: apuestas }] = await Promise.all([
      supabase.from('sala_miembros').select('usuario_id, usuarios(nombre)').eq('sala_id', salaId),
      supabase.from('apuestas').select('creador_id, estado').eq('sala_id', salaId),
    ]);

    const filas: FilaRanking[] = ((miembros as any[]) ?? []).map((m) => {
      const suyas = (apuestas ?? []).filter((a) => a.creador_id === m.usuario_id);
      return {
        usuarioId: m.usuario_id,
        nombre: m.usuarios?.nombre ?? 'Usuario',
        creadas: suyas.length,
        cumplidas: suyas.filter((a) => a.estado === 'resuelta_cumplida').length,
        incumplidas: suyas.filter((a) => a.estado === 'resuelta_incumplida').length,
      };
    });

    filas.sort((a, b) => b.creadas - a.creadas);

    setRanking(filas);
    setCargando(false);
    setRefreshing(false);
  }, [salaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  const maxIncumplidas = Math.max(0, ...ranking.map((f) => f.incumplidas));
  const maxCumplidas = Math.max(0, ...ranking.map((f) => f.cumplidas));

  return (
    <View style={styles.container}>
      <View style={styles.cabecera}>
        <Text style={[styles.cabeceraTexto, styles.colNombre]}>Nombre</Text>
        <Text style={[styles.cabeceraTexto, styles.colNumero]}>Creadas</Text>
        <Text style={[styles.cabeceraTexto, styles.colNumero]}>✅</Text>
        <Text style={[styles.cabeceraTexto, styles.colNumero]}>❌</Text>
      </View>

      <FlatList
        data={ranking}
        keyExtractor={(item) => item.usuarioId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={cargar} />}
        ListEmptyComponent={<Text style={styles.nota}>Todavía no hay apuestas en esta sala.</Text>}
        renderItem={({ item }) => {
          const esCampeon = maxCumplidas > 0 && item.cumplidas === maxCumplidas;
          const esGallina = maxIncumplidas > 0 && item.incumplidas === maxIncumplidas;
          return (
            <View style={styles.fila}>
              <View style={styles.colNombre}>
                <Text style={styles.nombre}>
                  {item.nombre} {esCampeon ? '🏆' : ''} {esGallina ? '🐔' : ''}
                </Text>
              </View>
              <Text style={[styles.numero, styles.colNumero]}>{item.creadas}</Text>
              <Text style={[styles.numero, styles.colNumero, { color: '#2e7d32' }]}>{item.cumplidas}</Text>
              <Text style={[styles.numero, styles.colNumero, { color: '#dc2626' }]}>{item.incumplidas}</Text>
            </View>
          );
        }}
      />

      <Text style={styles.leyenda}>🏆 Más apuestas cumplidas · 🐔 Más apuestas incumplidas</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  cabecera: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 8,
    marginBottom: 4,
  },
  cabeceraTexto: { fontWeight: '700', fontSize: 12, color: '#555' },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  colNombre: { flex: 2 },
  colNumero: { flex: 1, textAlign: 'center' },
  nombre: { fontSize: 14, fontWeight: '500' },
  numero: { fontSize: 14, fontWeight: '600' },
  nota: { color: '#888', fontStyle: 'italic', marginTop: 20, textAlign: 'center' },
  leyenda: { fontSize: 11, color: '#999', marginTop: 16, textAlign: 'center' },
});
