import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { dispararPush } from '../lib/notifications';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'CrearApuesta'>;

const CATEGORIAS = [
  { valor: 'beber', etiqueta: 'Beber' },
  { valor: 'hacer', etiqueta: 'Hacer algo' },
  { valor: 'decir', etiqueta: 'Decir algo' },
  { valor: 'otro', etiqueta: 'Otro' },
] as const;

export default function CrearApuestaScreen({ route, navigation }: Props) {
  const { salaId } = route.params;
  const [descripcion, setDescripcion] = useState('');
  const [enJuego, setEnJuego] = useState('');
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number]['valor']>('otro');
  const [creando, setCreando] = useState(false);

  async function crear() {
    if (!descripcion.trim() || !enJuego.trim()) {
      Alert.alert('Faltan datos', 'Escribe qué apuestas y qué te juegas.');
      return;
    }
    setCreando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const usuarioId = userData.user?.id;
      if (!usuarioId) throw new Error('No se ha podido identificar tu usuario.');

      const { data: nuevaApuesta, error } = await supabase
        .from('apuestas')
        .insert({
          sala_id: salaId,
          creador_id: usuarioId,
          descripcion: descripcion.trim(),
          apuesta_en_juego: enJuego.trim(),
          categoria,
        })
        .select()
        .single();

      if (error) throw error;
      if (nuevaApuesta) await dispararPush('apuestas', nuevaApuesta);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error al crear la apuesta', e.message ?? 'Inténtalo de nuevo.');
    } finally {
      setCreando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>¿Qué apuestas?</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Hoy no hago la siesta"
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
      />

      <Text style={styles.label}>¿Qué te juegas?</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Una comida"
        value={enJuego}
        onChangeText={setEnJuego}
      />

      <Text style={styles.label}>Categoría</Text>
      <View style={styles.categorias}>
        {CATEGORIAS.map((cat) => (
          <Text
            key={cat.valor}
            style={[styles.categoriaChip, categoria === cat.valor && styles.categoriaChipActiva]}
            onPress={() => setCategoria(cat.valor)}
          >
            {cat.etiqueta}
          </Text>
        ))}
      </View>

      <View style={{ height: 24 }} />

      {creando ? <ActivityIndicator /> : <Button title="Crear apuesta" onPress={crear} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
  categorias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoriaChip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    overflow: 'hidden',
    color: '#333',
  },
  categoriaChipActiva: {
    backgroundColor: '#111827',
    color: 'white',
    borderColor: '#111827',
  },
});
