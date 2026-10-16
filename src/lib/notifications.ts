import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registrarPushToken() {
  try {
    if (!Device.isDevice) return; // los simuladores no tienen push de verdad

    const { status: existente } = await Notifications.getPermissionsAsync();
    let status = existente;
    if (status !== 'granted') {
      const { status: nuevo } = await Notifications.requestPermissionsAsync();
      status = nuevo;
    }
    if (status !== 'granted') return;

    const { data: userData } = await supabase.auth.getUser();
    const usuarioId = userData.user?.id;
    if (!usuarioId) return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await supabase.from('push_tokens').upsert(
      { usuario_id: usuarioId, token },
      { onConflict: 'token' }
    );
  } catch (e) {
    console.warn('No se pudo registrar el token de notificaciones:', e);
  }
}

// Llama directamente a la Edge Function "send-push" (sin pasar por
// Database Webhooks, que en este proyecto tienen un problema de
// aprovisionamiento). Se invoca justo después de cada acción relevante:
// añadir un miembro, crear una apuesta, o proponer una resolución.
export async function dispararPush(table: 'sala_miembros' | 'apuestas' | 'apuesta_resolucion', record: any) {
  try {
    await supabase.functions.invoke('send-push', { body: { table, record } });
  } catch (e) {
    console.warn('No se pudo disparar la notificación push:', e);
  }
}
