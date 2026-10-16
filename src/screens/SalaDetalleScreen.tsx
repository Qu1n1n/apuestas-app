import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'SalaDetalle'>;

type Miembro = {
  usuario_id: string;
  rol: 'creador' | 'miembro';
  usuarios: { nombre: string } | null;
};

type Apuesta = {
  id: string;
  descripcion: string;
  apuesta_en_juego: string;
  estado: string;
};

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente_aceptacion: 'Esperando participantes',
  aceptada: 'En juego',
  en_resolucion: 'Votando resultado',
  resuelta_cumplida: '✅ Cumplida',
  resuelta_incumplida: '❌ Incumplida',
};

export default function SalaDetalleScreen({ route, navigation }: Props) {
  const { salaId } = route.params;
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [apuestas, setApuestas] = useState<Apuesta[]>([]);
  const [miUsuarioId, setMiUsuarioId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    setRefreshing(true);
    const [{ data: userData }, { data: miembrosData }, { data: apuestasData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('sala_miembros').select('usuario_id, rol, usuarios(nombre)').eq('sala_id', salaId),
      supabase
        .from('apuestas')
        .select('id, descripcion, apuesta_en_juego, estado')
        .eq('sala_id', salaId)
        .order('creado_en', { ascending: false }),
    ]);
    setMiUsuarioId(userData.user?.id ?? null);
    if (miembrosData) setMiembros(miembrosData as unknown as Miembro[]);
    if (apuestasData) setApuestas(apuestasData as Apuesta[]);
    setRefreshing(false);
  }, [salaId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', cargar);
    return unsubscribe;
  }, [navigation, cargar]);

  const soyCreador = miembros.some((m) => m.usuario_id === miUsuarioId && m.rol === 'creador');

  function confirmarQuitar(usuarioId: string, nombre: string, esYoMismo: boolean) {
    Alert.alert(
      esYoMismo ? 'Salir de la sala' : `Expulsar a ${nombre}`,
      esYoMismo ? '¿Seguro que quieres salir de esta sala?' : `¿Seguro que quieres expulsar a ${nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: esYoMismo ? 'Salir' : 'Expulsar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('sala_miembros')
              .delete()
              .eq('sala_id', salaId)
              .eq('usuario_id', usuarioId);
            if (error) {
              Alert.alert('Error', error.message);
              return;
            }
            if (esYoMismo) {
              navigation.navigate('Salas');
            } else {
              cargar();
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.botonCrear}
        onPress={() => navigation.navigate('CrearApuesta', { salaId })}
      >
        <Text style={styles.botonCrearTexto}>+ Nueva apuesta</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.botonEstadisticas}
        onPress={() => navigation.navigate('SalaEstadisticas', { salaId, salaNombre: route.params.salaNombre })}
      >
        <Text style={styles.botonEstadisticasTexto}>📊 Ver ranking de la sala</Text>
      </TouchableOpacity>

      <Text style={styles.seccion}>Apuestas</Text>
      <FlatList
        data={apuestas}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={cargar} />}
        ListEmptyComponent={<Text style={styles.nota}>Todavía no hay apuestas en esta sala.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.apuestaItem}
            onPress={() => navigation.navigate('ApuestaDetalle', { apuestaId: item.id })}
          >
            <Text style={styles.apuestaDescripcion}>{item.descripcion}</Text>
            <Text style={styles.apuestaEnJuego}>🎲 {item.apuesta_en_juego}</Text>
            <Text style={styles.apuestaEstado}>{ETIQUETA_ESTADO[item.estado] ?? item.estado}</Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.separador} />

      <View style={styles.filaSeccion}>
        <Text style={styles.seccion}>Miembros</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AnadirMiembro', { salaId, salaNombre: route.params.salaNombre })}>
          <Text style={styles.enlaceAnadir}>+ Añadir amigos</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={miembros}
        keyExtractor={(item) => item.usuario_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={cargar} />}
        renderItem={({ item }) => {
          const esYoMismo = item.usuario_id === miUsuarioId;
          const puedoQuitarlo = esYoMismo || (soyCreador && item.rol !== 'creador');
          return (
            <View style={styles.miembroFila}>
              <Text style={styles.miembro}>
                {item.usuarios?.nombre ?? 'Usuario'} {item.rol === 'creador' ? '👑' : ''}
              </Text>
              {puedoQuitarlo && (
                <TouchableOpacity
                  onPress={() => confirmarQuitar(item.usuario_id, item.usuarios?.nombre ?? 'Usuario', esYoMismo)}
                >
                  <Text style={styles.quitar}>{esYoMismo ? 'Salir' : 'Quitar'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
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
  botonEstadisticas: {
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  botonEstadisticasTexto: { color: '#333', fontWeight: '600' },
  seccion: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  filaSeccion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  enlaceAnadir: { color: '#2563eb', fontWeight: '600' },
  nota: { color: '#888', fontStyle: 'italic', marginBottom: 8 },
  apuestaItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f2f2f2',
    marginBottom: 8,
  },
  apuestaDescripcion: { fontSize: 15, fontWeight: '600' },
  apuestaEnJuego: { fontSize: 13, color: '#555', marginTop: 2 },
  apuestaEstado: { fontSize: 12, color: '#888', marginTop: 4, fontStyle: 'italic' },
  separador: { height: 1, backgroundColor: '#eee', marginVertical: 16 },
  miembroFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  miembro: { fontSize: 14 },
  quitar: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
});
