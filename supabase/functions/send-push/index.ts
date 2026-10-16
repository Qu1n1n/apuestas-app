import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function enviarPush(usuarioIds: string[], titulo: string, cuerpo: string) {
  if (usuarioIds.length === 0) return;

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .in('usuario_id', usuarioIds);

  const mensajes = (tokens ?? []).map((t) => ({
    to: t.token,
    sound: 'default',
    title: titulo,
    body: cuerpo,
  }));

  if (mensajes.length === 0) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mensajes),
  });
}

Deno.serve(async (req) => {
  const payload = await req.json();
  const { table, record } = payload;

  try {
    if (table === 'sala_miembros') {
      const { data: sala } = await supabase
        .from('salas')
        .select('nombre')
        .eq('id', record.sala_id)
        .single();
      await enviarPush(
        [record.usuario_id],
        '¡Te han añadido a una sala!',
        `Ya formas parte de "${sala?.nombre}" en Apuestas entre Amigos.`
      );
    }

    if (table === 'apuestas') {
      const { data: miembros } = await supabase
        .from('sala_miembros')
        .select('usuario_id')
        .eq('sala_id', record.sala_id)
        .neq('usuario_id', record.creador_id);
      await enviarPush(
        (miembros ?? []).map((m) => m.usuario_id),
        'Nueva apuesta 🎲',
        record.descripcion
      );
    }

    if (table === 'apuesta_resolucion') {
      const { data: participantes } = await supabase
        .from('apuesta_participantes')
        .select('usuario_id')
        .eq('apuesta_id', record.apuesta_id)
        .neq('usuario_id', record.propuesto_por);
      await enviarPush(
        (participantes ?? []).map((p) => p.usuario_id),
        '¡Vota el resultado!',
        'Alguien ha dicho si se cumplió una apuesta. Entra a confirmar tu voto.'
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
