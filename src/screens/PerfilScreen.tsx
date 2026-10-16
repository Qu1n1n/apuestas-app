import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Perfil'>;

type Perfil = {
  nombre: string;
  email: string;
  apuestas_creadas: number;
  apuestas_cumplidas: number;
  apuestas_incumplidas: number;
};

export default function PerfilScreen({ navigation }: Props) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [activas, setActivas] = useState(0);
  const [cargando, setCargando] = useState(true);

  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data: userData } = await supabase.auth.getUser();
    const usuarioId = userData.user?.id;
    if (!usuarioId) {
      setCargando(false);
      return;
    }

    const [{ data: perfilData }, { count }] = await Promise.all([
      supabase
        .from('usuarios')
        .select('nombre, email, apuestas_creadas, apuestas_cumplidas, apuestas_incumplidas')
        .eq('id', usuarioId)
        .single(),
      supabase
        .from('apuestas')
        .select('id', { count: 'exact', head: true })
        .eq('creador_id', usuarioId)
        .in('estado', ['pendiente_aceptacion', 'aceptada', 'en_resolucion']),
    ]);

    setPerfil(perfilData);
    setActivas(count ?? 0);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarPassword() {
    if (nuevaPassword.length < 6) {
      Alert.alert('Contraseña demasiado corta', 'Usa al menos 6 caracteres.');
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      Alert.alert('No coinciden', 'Las dos contraseñas deben ser iguales.');
      return;
    }
    setCambiandoPassword(true);
    const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
    setCambiandoPassword(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setNuevaPassword('');
    setConfirmarPassword('');
    Alert.alert('Listo', 'Tu contraseña se ha actualizado.');
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  if (cargando || !perfil) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  const totalResueltas = perfil.apuestas_cumplidas + perfil.apuestas_incumplidas;
  const porcentajeCumplidas =
    totalResueltas > 0 ? Math.round((perfil.apuestas_cumplidas / totalResueltas) * 100) : null;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.nombre}>{perfil.nombre}</Text>
      <Text style={styles.email}>{perfil.email}</Text>

      <View style={styles.statsFila}>
        <View style={styles.statCaja}>
          <Text style={styles.statNumero}>{activas}</Text>
          <Text style={styles.statEtiqueta}>Activas</Text>
        </View>
        <View style={styles.statCaja}>
          <Text style={[styles.statNumero, { color: '#2e7d32' }]}>{perfil.apuestas_cumplidas}</Text>
          <Text style={styles.statEtiqueta}>Cumplidas</Text>
        </View>
        <View style={styles.statCaja}>
          <Text style={[styles.statNumero, { color: '#dc2626' }]}>{perfil.apuestas_incumplidas}</Text>
          <Text style={styles.statEtiqueta}>Incumplidas</Text>
        </View>
      </View>

      {porcentajeCumplidas !== null && (
        <Text style={styles.resumen}>
          Cumples el {porcentajeCumplidas}% de tus apuestas ({perfil.apuestas_creadas} creadas en total)
        </Text>
      )}

      <View style={styles.separador} />

      <Text style={styles.seccion}>Cambiar contraseña</Text>
      <TextInput
        style={styles.input}
        placeholder="Nueva contraseña"
        secureTextEntry
        value={nuevaPassword}
        onChangeText={setNuevaPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Repite la contraseña"
        secureTextEntry
        value={confirmarPassword}
        onChangeText={setConfirmarPassword}
      />
      {cambiandoPassword ? (
        <ActivityIndicator />
      ) : (
        <Button title="Actualizar contraseña" onPress={cambiarPassword} />
      )}

      <View style={styles.separador} />

      <Button title="Cerrar sesión" color="#dc2626" onPress={cerrarSesion} />

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  nombre: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 14, color: '#666', marginBottom: 20 },
  statsFila: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statCaja: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    paddingVertical: 16,
    marginHorizontal: 4,
  },
  statNumero: { fontSize: 24, fontWeight: '700' },
  statEtiqueta: { fontSize: 12, color: '#666', marginTop: 4 },
  resumen: { textAlign: 'center', color: '#555', fontStyle: 'italic', marginBottom: 8 },
  separador: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  seccion: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
});
