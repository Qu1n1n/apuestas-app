import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import * as Contacts from 'expo-contacts/legacy';
import { supabase } from '../lib/supabase';
import { dispararPush } from '../lib/notifications';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'CrearSala'>;

type ContactoFila = {
  contactoId: string;
  contactoNombre: string;
  telefono?: string;
  email?: string;
  usuarioId?: string;
  usuarioNombre?: string;
};

const ENLACE_APP = 'https://apuestasentreamigos.app'; // placeholder

function normalizarTelefono(numero: string): string {
  return numero.replace(/\D/g, '').slice(-9);
}

function numeroParaWhatsapp(numero: string): string {
  const digitos = numero.replace(/\D/g, '');
  return digitos.length === 9 ? `34${digitos}` : digitos;
}

export default function CrearSalaScreen({ navigation }: Props) {
  const [nombreSala, setNombreSala] = useState('');
  const [cargando, setCargando] = useState(false);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);
  const [contactos, setContactos] = useState<ContactoFila[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [creando, setCreando] = useState(false);

  const mensajeInvitacion =
    `¡Te invito a mi sala de apuestas en Apuestas entre Amigos! 🎲\n` +
    `Descárgate la app aquí: ${ENLACE_APP}`;

  async function buscarAmigos() {
    setCargando(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso necesario', 'Necesitamos acceso a tus contactos para invitar a tus amigos.');
        setCargando(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
      });

      const { data: usuarios, error } = await supabase
        .from('usuarios')
        .select('id, nombre, telefono')
        .not('telefono', 'is', null);
      if (error) throw error;

      const telefonoAUsuario = new Map<string, { id: string; nombre: string }>();
      for (const u of usuarios ?? []) {
        if (u.telefono) telefonoAUsuario.set(normalizarTelefono(u.telefono), { id: u.id, nombre: u.nombre });
      }

      const filas: ContactoFila[] = [];
      const idsVistos = new Set<string>();

      for (const c of data) {
        const nombre =
          c.name?.trim() || [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || null;
        if (!nombre) continue;

        let match: { id: string; nombre: string } | undefined;
        for (const tel of c.phoneNumbers ?? []) {
          if (tel.number) {
            const posible = telefonoAUsuario.get(normalizarTelefono(tel.number));
            if (posible) {
              match = posible;
              break;
            }
          }
        }

        if (match) {
          if (idsVistos.has(match.id)) continue;
          idsVistos.add(match.id);
        }

        filas.push({
          contactoId: c.id ?? `${nombre}-${Math.random()}`,
          contactoNombre: nombre,
          telefono: c.phoneNumbers?.[0]?.number,
          email: c.emails?.[0]?.email,
          usuarioId: match?.id,
          usuarioNombre: match?.nombre,
        });
      }

      const nombresConApp = new Set(filas.filter((f) => f.usuarioId).map((f) => f.contactoNombre));
      const filasFinal = filas.filter((f) => f.usuarioId || !nombresConApp.has(f.contactoNombre));
      filasFinal.sort((a, b) => (a.usuarioId ? -1 : 1) - (b.usuarioId ? -1 : 1));

      setContactos(filasFinal);
      setBusquedaRealizada(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudieron cargar los contactos.');
    } finally {
      setCargando(false);
    }
  }

  function toggleSeleccion(usuarioId: string) {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      nuevo.has(usuarioId) ? nuevo.delete(usuarioId) : nuevo.add(usuarioId);
      return nuevo;
    });
  }

  function invitarPorWhatsapp(telefono: string) {
    const url = `https://wa.me/${numeroParaWhatsapp(telefono)}?text=${encodeURIComponent(mensajeInvitacion)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir WhatsApp.'));
  }

  function invitarPorEmail(email: string) {
    const url = `mailto:${email}?subject=${encodeURIComponent(
      'Te invito a Apuestas entre Amigos'
    )}&body=${encodeURIComponent(mensajeInvitacion)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir el correo.'));
  }

  async function crearSala() {
    if (!nombreSala.trim()) {
      Alert.alert('Falta el nombre', 'Ponle un nombre a la sala.');
      return;
    }
    setCreando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const usuarioActualId = userData.user?.id;
      if (!usuarioActualId) throw new Error('No se ha podido identificar tu usuario.');

      const { data: sala, error: errorSala } = await supabase
        .from('salas')
        .insert({ nombre: nombreSala.trim(), creador_id: usuarioActualId })
        .select()
        .single();
      if (errorSala) throw errorSala;

      const miembros = [
        { sala_id: sala.id, usuario_id: usuarioActualId, rol: 'creador' as const },
        ...Array.from(seleccionados).map((usuario_id) => ({
          sala_id: sala.id,
          usuario_id,
          rol: 'miembro' as const,
        })),
      ];
      const { error: errorMiembros } = await supabase.from('sala_miembros').insert(miembros);
      if (errorMiembros) throw errorMiembros;

      // Avisamos a los amigos añadidos (no al creador, que ya sabe que la creó)
      for (const usuario_id of seleccionados) {
        await dispararPush('sala_miembros', { sala_id: sala.id, usuario_id });
      }

      navigation.replace('Salas');
    } catch (e: any) {
      Alert.alert('Error al crear la sala', e.message ?? 'Inténtalo de nuevo.');
    } finally {
      setCreando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nombre de la sala</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Los del fútbol"
        value={nombreSala}
        onChangeText={setNombreSala}
      />

      <View style={{ height: 16 }} />

      {contactos.length === 0 && !cargando && (
        <Button title={busquedaRealizada ? 'Volver a buscar' : 'Buscar amigos en mis contactos'} onPress={buscarAmigos} />
      )}

      {cargando && <ActivityIndicator style={{ marginTop: 16 }} />}

      {busquedaRealizada && contactos.length === 0 && !cargando && (
        <Text style={styles.nota}>No se encontraron contactos con teléfono o email.</Text>
      )}

      {contactos.length > 0 && (
        <>
          <Text style={styles.label}>Amigos — toca para seleccionar, o invita a los que no tienen la app</Text>
          <FlatList
            data={contactos}
            keyExtractor={(item) => item.contactoId}
            renderItem={({ item }) => {
              if (item.usuarioId) {
                const sel = seleccionados.has(item.usuarioId);
                return (
                  <TouchableOpacity
                    style={[styles.item, sel && styles.itemSeleccionado]}
                    onPress={() => toggleSeleccion(item.usuarioId!)}
                  >
                    <View>
                      <Text style={styles.nombre}>{item.contactoNombre}</Text>
                      <Text style={styles.subNombre}>({item.usuarioNombre} · ya tiene la app)</Text>
                    </View>
                    {sel && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              }
              return (
                <View style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nombre}>{item.contactoNombre}</Text>
                    <Text style={styles.subNombreGris}>Todavía no tiene la app</Text>
                  </View>
                  <View style={styles.botonesInvitar}>
                    {item.telefono && (
                      <TouchableOpacity onPress={() => invitarPorWhatsapp(item.telefono!)}>
                        <Text style={styles.botonInvitar}>WhatsApp</Text>
                      </TouchableOpacity>
                    )}
                    {item.email && (
                      <TouchableOpacity onPress={() => invitarPorEmail(item.email!)}>
                        <Text style={styles.botonInvitar}>Email</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </>
      )}

      <View style={{ height: 16 }} />

      {creando ? <ActivityIndicator /> : <Button title="Crear sala" onPress={crearSala} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  nota: { color: '#888', fontStyle: 'italic', marginTop: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    marginBottom: 8,
  },
  itemSeleccionado: { backgroundColor: '#dff0d8' },
  nombre: { fontSize: 15, fontWeight: '500' },
  subNombre: { fontSize: 12, color: '#666' },
  subNombreGris: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  check: { fontSize: 18, color: '#2e7d32', fontWeight: '700' },
  botonesInvitar: { flexDirection: 'row', gap: 12 },
  botonInvitar: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
});
