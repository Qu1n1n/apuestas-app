import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigation.replace('Salas');
  }

  async function handleSignUp() {
    if (!telefono.trim()) {
      setError('El teléfono es necesario para poder invitarte a salas desde los contactos de tus amigos.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { telefono: telefono.trim() },
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigation.replace('Salas');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Apuestas entre Amigos</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {modo === 'registro' && (
        <TextInput
          style={styles.input}
          placeholder="Teléfono (ej. 612345678)"
          keyboardType="phone-pad"
          value={telefono}
          onChangeText={setTelefono}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ActivityIndicator />
      ) : modo === 'login' ? (
        <>
          <Button title="Entrar" onPress={handleLogin} />
          <View style={{ height: 8 }} />
          <Button title="Aún no tengo cuenta" onPress={() => setModo('registro')} />
        </>
      ) : (
        <>
          <Button title="Crear cuenta" onPress={handleSignUp} />
          <View style={{ height: 8 }} />
          <Button title="Ya tengo cuenta" onPress={() => setModo('login')} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 24, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  error: { color: 'red', marginBottom: 12 },
});
