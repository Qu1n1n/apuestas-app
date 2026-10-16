import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { dispararPush } from '../lib/notifications';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ApuestaDetalle'>;

type Apuesta = {
  id: string;
  descripcion: string;
  apuesta_en_juego: string;
  categoria: string;
  estado: string;
  creador_id: string;
  foto_prueba_url: string | null;
};

type Participante = {
  usuario_id: string;
  lado: 'a_favor' | 'en_contra';
  usuarios: { nombre: string } | null;
};

type Resolucion = {
  id: string;
  propuesto_por: string;
  resultado_propuesto: 'cumplida' | 'incumplida';
};

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente_aceptacion: 'Esperando que alguien se apunte',
  aceptada: 'En juego',
  en_resolucion: 'Resultado propuesto, votando',
  resuelta_cumplida: '✅ Cumplida',
  resuelta_incumplida: '❌ Incumplida',
};

async function subirFotoPrueba(apuestaId: string, uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const path = `${apuestaId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('pruebas').upload(path, decode(base64), {
    contentType: 'image/jpeg',
  });
  if (error) throw error;
  const { data } = supabase.storage.from('pruebas').getPublicUrl(path);
  return data.publicUrl;
}

export default function ApuestaDetalleScreen({ route }: Props) {
  const { apuestaId } = route.params;
  const [apuesta, setApuesta] = useState<Apuesta | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [resolucion, setResolucion] = useState<Resolucion | null>(null);
  const [miVoto, setMiVoto] = useState<boolean | null>(null);
  const [miUsuarioId, setMiUsuarioId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [fotoUri, setFotoUri] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data: userData } = await supabase.auth.getUser();
    const usuarioId = userData.user?.id ?? null;
    setMiUsuarioId(usuarioId);

    const { data: apuestaData } = await supabase
      .from('apuestas')
      .select('id, descripcion, apuesta_en_juego, categoria, estado, creador_id, foto_prueba_url')
      .eq('id', apuestaId)
      .single();
    setApuesta(apuestaData);

    const { data: participantesData } = await supabase
      .from('apuesta_participantes')
      .select('usuario_id, lado, usuarios(nombre)')
      .eq('apuesta_id', apuestaId);
    setParticipantes((participantesData as unknown as Participante[]) ?? []);

    if (apuestaData?.estado === 'en_resolucion') {
      const { data: resolucionData } = await supabase
        .from('apuesta_resolucion')
        .select('id, propuesto_por, resultado_propuesto')
        .eq('apuesta_id', apuestaId)
        .order('creado_en', { ascending: false })
        .limit(1)
        .maybeSingle();
      setResolucion(resolucionData);

      if (resolucionData && usuarioId) {
        const { data: miVotoRow } = await supabase
          .from('apuesta_resolucion_votos')
          .select('voto')
          .eq('resolucion_id', resolucionData.id)
          .eq('usuario_id', usuarioId)
          .maybeSingle();
        setMiVoto(miVotoRow ? miVotoRow.voto : null);
      } else {
        setMiVoto(null);
      }
    } else {
      setResolucion(null);
      setMiVoto(null);
    }

    setCargando(false);
  }, [apuestaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function unirse(lado: 'a_favor' | 'en_contra') {
    if (!miUsuarioId) return;
    setProcesando(true);
    const { error } = await supabase
      .from('apuesta_participantes')
      .insert({ apuesta_id: apuestaId, usuario_id: miUsuarioId, lado });
    setProcesando(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    await supabase.from('apuestas').update({ estado: 'aceptada' }).eq('id', apuestaId).eq('estado', 'pendiente_aceptacion');
    cargar();
  }

  function elegirFoto() {
    Alert.alert('Foto de prueba (opcional)', '¿Cómo quieres añadirla?', [
      { text: 'Hacer foto', onPress: () => lanzarPicker('camara') },
      { text: 'Elegir de galería', onPress: () => lanzarPicker('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function lanzarPicker(tipo: 'camara' | 'galeria') {
    const permiso =
      tipo === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permiso.status !== 'granted') {
      Alert.alert('Permiso necesario', 'Necesitamos acceso para adjuntar la foto.');
      return;
    }
    const resultado =
      tipo === 'camara'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!resultado.canceled && resultado.assets?.[0]?.uri) {
      setFotoUri(resultado.assets[0].uri);
    }
  }

  async function proponerResultado(resultado: 'cumplida' | 'incumplida') {
    if (!miUsuarioId) return;
    setProcesando(true);
    try {
      if (fotoUri) {
        const url = await subirFotoPrueba(apuestaId, fotoUri);
        await supabase.from('apuestas').update({ foto_prueba_url: url }).eq('id', apuestaId);
      }

      const { data: nuevaResolucion, error } = await supabase
        .from('apuesta_resolucion')
        .insert({ apuesta_id: apuestaId, propuesto_por: miUsuarioId, resultado_propuesto: resultado })
        .select()
        .single();

      if (error) throw error;
      if (nuevaResolucion) await dispararPush('apuesta_resolucion', nuevaResolucion);
      setFotoUri(null);
      cargar();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo completar la acción.');
    } finally {
      setProcesando(false);
    }
  }

  async function votar(voto: boolean) {
    if (!miUsuarioId || !resolucion) return;
    setProcesando(true);
    const { error } = await supabase
      .from('apuesta_resolucion_votos')
      .upsert(
        { resolucion_id: resolucion.id, usuario_id: miUsuarioId, voto },
        { onConflict: 'resolucion_id,usuario_id' }
      );
    setProcesando(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setMiVoto(voto);
    cargar();
  }

  if (cargando || !apuesta) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  const yaParticipo = participantes.some((p) => p.usuario_id === miUsuarioId);
  const soyElQuePropuso = resolucion?.propuesto_por === miUsuarioId;

  return (
    <View style={styles.container}>
      <Text style={styles.descripcion}>{apuesta.descripcion}</Text>
      <Text style={styles.enJuego}>🎲 En juego: {apuesta.apuesta_en_juego}</Text>
      <Text style={styles.estado}>{ETIQUETA_ESTADO[apuesta.estado] ?? apuesta.estado}</Text>

      {apuesta.foto_prueba_url && (
        <Image source={{ uri: apuesta.foto_prueba_url }} style={styles.fotoPrueba} />
      )}

      <View style={styles.separador} />

      <Text style={styles.seccion}>Participantes</Text>
      <FlatList
        data={participantes}
        keyExtractor={(item) => item.usuario_id}
        renderItem={({ item }) => (
          <Text style={styles.participante}>
            {item.usuarios?.nombre ?? 'Usuario'} — {item.lado === 'a_favor' ? '👍 a favor' : '👎 en contra'}
          </Text>
        )}
        ListEmptyComponent={<Text style={styles.nota}>Nadie se ha apuntado todavía.</Text>}
      />

      <View style={styles.separador} />

      {procesando && <ActivityIndicator style={{ marginBottom: 12 }} />}

      {!yaParticipo && (apuesta.estado === 'pendiente_aceptacion' || apuesta.estado === 'aceptada') && (
        <>
          <Text style={styles.seccion}>¿Te la juegas?</Text>
          <View style={styles.botonesFila}>
            <Button title="👍 A favor" onPress={() => unirse('a_favor')} />
            <Button title="👎 En contra" onPress={() => unirse('en_contra')} />
          </View>
        </>
      )}

      {yaParticipo && apuesta.estado === 'aceptada' && (
        <>
          <Text style={styles.seccion}>¿Se ha cumplido?</Text>

          <TouchableOpacity onPress={elegirFoto} style={styles.botonFoto}>
            <Text style={styles.botonFotoTexto}>
              {fotoUri ? '📷 Cambiar foto de prueba' : '📷 Adjuntar foto de prueba (opcional)'}
            </Text>
          </TouchableOpacity>
          {fotoUri && <Image source={{ uri: fotoUri }} style={styles.previsualizacion} />}

          <View style={styles.botonesFila}>
            <Button title="✅ Cumplida" onPress={() => proponerResultado('cumplida')} />
            <Button title="❌ Incumplida" onPress={() => proponerResultado('incumplida')} />
          </View>
        </>
      )}

      {apuesta.estado === 'en_resolucion' && resolucion && (
        <>
          <Text style={styles.seccion}>
            Alguien ha dicho que fue{' '}
            {resolucion.resultado_propuesto === 'cumplida' ? 'CUMPLIDA ✅' : 'INCUMPLIDA ❌'}
          </Text>
          {soyElQuePropuso ? (
            <Text style={styles.nota}>Estás esperando a que el resto vote.</Text>
          ) : (
            <>
              <View style={styles.botonesFila}>
                <Button
                  title={miVoto === true ? '✓ Confirmo' : 'Confirmo'}
                  color={miVoto === true ? '#2e7d32' : undefined}
                  onPress={() => votar(true)}
                />
                <Button
                  title={miVoto === false ? '✓ No estoy de acuerdo' : 'No estoy de acuerdo'}
                  color={miVoto === false ? '#dc2626' : undefined}
                  onPress={() => votar(false)}
                />
              </View>
              {miVoto !== null && (
                <Text style={styles.nota}>Puedes cambiar tu voto mientras siga abierta la votación.</Text>
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  descripcion: { fontSize: 18, fontWeight: '700' },
  enJuego: { fontSize: 15, color: '#555', marginTop: 4 },
  estado: { fontSize: 13, color: '#888', marginTop: 8, fontStyle: 'italic' },
  fotoPrueba: { width: '100%', height: 200, borderRadius: 8, marginTop: 12 },
  separador: { height: 1, backgroundColor: '#eee', marginVertical: 16 },
  seccion: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  participante: { fontSize: 14, paddingVertical: 4 },
  nota: { color: '#888', fontStyle: 'italic' },
  botonesFila: { flexDirection: 'row', justifyContent: 'space-around' },
  botonFoto: {
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  botonFotoTexto: { color: '#333', fontWeight: '500', fontSize: 13 },
  previsualizacion: { width: '100%', height: 160, borderRadius: 8, marginBottom: 12 },
});
