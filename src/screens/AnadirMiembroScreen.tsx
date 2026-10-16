import React, { useState } from 'react';
import {
  View,
  Text,
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

type Props = NativeStackScreenProps<RootStackParamList, 'AnadirMiembro'>;

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

export default function AnadirMiembroScreen({ route, navigation }: Props) {
  const { salaId, salaNombre } = route.params;
  const [cargando, setCargando] = useState(false);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);
  const [contactos, setContactos] = useState<ContactoFila[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [anadiendo, setAnadiendo] = useState(false);

  const mensajeInvitacion =
    `¡Te he añadido a la sala "${salaNombre}" en Apuestas entre Amigos! 🎲\n` +
    `Descárgate la app aquí para verla y apostar: ${ENLACE_APP}`;

  async function buscar() {
    setCargando(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso necesario', 'Necesitamos acceso a tus contactos.');
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

      const { data: yaMiembros } = await supabase
        .from('sala_miembros')
        .select('usuario_id')
        .eq('sala_id', salaId);
      const idsYaEnSala = new Set((yaMiembros ?? []).map((m) => m.usuario_id));

      const { data: usuarios, error } = await supabase
        .from('usuarios')
        .select('id, nombre, telefono')
        .not('telefono', 'is', null);
      if (error) throw error;

      const telefonoAUsuario = new Map<string, { id: string; nombre: string }>();
      for (const u of usuarios ?? []) {
        if (u.telefono && !idsYaEnSala.has(u.id)) {
          telefonoAUsuario.set(normalizarTelefono(u.telefono), { id: u.id, nombre: u.nombre });
        }
      }

      const filas: ContactoFila[] = [];
      const idsMatcheadosVistos = new Set<string>();

      for (const c of data) {
        const nombre =
          c.name?.trim() ||
          [c.firstName, c.lastName].filter(Boolean).join(' ').trim() ||
          null;
        if (!nombre) continue;

        // Buscamos coincidencia probando TODOS los teléfonos del contacto, no solo el primero.
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
          if (idsMatcheadosVistos.has(match.id)) continue; // evita duplicados del mismo usuario
          idsMatcheadosVistos.add(match.id);
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

      // Si un mismo nombre aparece tanto emparejado como sin emparejar
      // (contacto duplicado por sincronización), nos quedamos solo con
      // la versión emparejada.
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

  function toggle(usuarioId: string) {
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
      'Te invito a una sala en Apuestas entre Amigos'
    )}&body=${encodeURIComponent(mensajeInvitacion)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir el correo.'));
  }

  async function anadirSeleccionados() {
    if (seleccionados.size === 0) {
      Alert.alert('Nada seleccionado', 'Toca a los amigos que ya tienen la app para añadirlos.');
      return;
    }
    setAnadiendo(true);
    const filas = Array.from(seleccionados).map((usuario_id) => ({
      sala_id: salaId,
      usuario_id,
      rol: 'miembro' as const,
    }));
    const { error } = await supabase.from('sala_miembros').insert(filas);
    setAnadiendo(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    for (const fila of filas) {
      await dispararPush('sala_miembros', fila);
    }
    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      {contactos.length === 0 && !cargando && (
        <Button title={busquedaRealizada ? 'Volver a buscar' : 'Ver mis contactos'} onPress={buscar} />
      )}

      {cargando && <ActivityIndicator style={{ marginTop: 16 }} />}

      {busquedaRealizada && contactos.length === 0 && !cargando && (
        <Text style={styles.nota}>No se encontraron contactos con teléfono o email.</Text>
      )}

      {contactos.length > 0 && (
        <>
          <FlatList
            data={contactos}
            keyExtractor={(item) => item.contactoId}
            renderItem={({ item }) => {
              if (item.usuarioId) {
                const sel = seleccionados.has(item.usuarioId);
                return (
                  <TouchableOpacity
                    style={[styles.item, sel && styles.itemSeleccionado]}
                    onPress={() => toggle(item.usuarioId!)}
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
          <View style={{ height: 16 }} />
          {anadiendo ? <ActivityIndicator /> : <Button title="Añadir seleccionados" onPress={anadirSeleccionados} />}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  nota: { color: '#888', fontStyle: 'italic', marginTop: 16 },
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
