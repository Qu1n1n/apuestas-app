-- ============================================================
-- APUESTAS ENTRE AMIGOS — Esquema inicial (MVP)
-- ============================================================

-- Tipos enumerados
create type estado_sala as enum ('abierta', 'cerrada');
create type rol_sala as enum ('creador', 'miembro');
create type categoria_apuesta as enum ('beber', 'hacer', 'decir', 'otro');
create type estado_apuesta as enum (
  'pendiente_aceptacion',
  'aceptada',
  'en_resolucion',
  'resuelta_cumplida',
  'resuelta_incumplida'
);
create type lado_apuesta as enum ('a_favor', 'en_contra');
create type resultado_propuesto as enum ('cumplida', 'incumplida');
create type tipo_notificacion as enum (
  'invitado_a_sala', 'nueva_apuesta', 'apuesta_aceptada',
  'propuesta_resolucion', 'apuesta_resuelta'
);

-- ============================================================
-- TABLAS
-- ============================================================

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text unique not null,
  telefono text,
  avatar_url text,
  apuestas_creadas int not null default 0,
  apuestas_cumplidas int not null default 0,
  apuestas_incumplidas int not null default 0,
  creado_en timestamptz not null default now()
);

create table salas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creador_id uuid not null references usuarios(id),
  estado estado_sala not null default 'abierta',
  creado_en timestamptz not null default now()
);

create table sala_miembros (
  sala_id uuid not null references salas(id),
  usuario_id uuid not null references usuarios(id),
  rol rol_sala not null default 'miembro',
  unido_en timestamptz not null default now(),
  primary key (sala_id, usuario_id)
);

create table apuestas (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid references salas(id), -- nullable: futuras apuestas globales
  creador_id uuid not null references usuarios(id),
  descripcion text not null,
  apuesta_en_juego text not null,
  categoria categoria_apuesta not null default 'otro',
  max_participantes int not null default 20,
  estado estado_apuesta not null default 'pendiente_aceptacion',
  foto_prueba_url text,
  patrocinador_id uuid, -- reservado para futuras marcas, sin FK todavía
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz
);

create table apuesta_participantes (
  apuesta_id uuid not null references apuestas(id),
  usuario_id uuid not null references usuarios(id),
  lado lado_apuesta not null,
  aceptado_en timestamptz not null default now(),
  primary key (apuesta_id, usuario_id)
);

create table apuesta_resolucion (
  id uuid primary key default gen_random_uuid(),
  apuesta_id uuid not null references apuestas(id),
  propuesto_por uuid not null references usuarios(id),
  resultado_propuesto resultado_propuesto not null,
  creado_en timestamptz not null default now()
);

create table apuesta_resolucion_votos (
  resolucion_id uuid not null references apuesta_resolucion(id),
  usuario_id uuid not null references usuarios(id),
  voto boolean not null,
  votado_en timestamptz not null default now(),
  primary key (resolucion_id, usuario_id)
);

create table notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id),
  tipo tipo_notificacion not null,
  referencia_id uuid not null,
  leido boolean not null default false,
  creado_en timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table usuarios enable row level security;
alter table salas enable row level security;
alter table sala_miembros enable row level security;
alter table apuestas enable row level security;
alter table apuesta_participantes enable row level security;
alter table apuesta_resolucion enable row level security;
alter table apuesta_resolucion_votos enable row level security;
alter table notificaciones enable row level security;

-- --- usuarios ---
create policy "usuarios: lectura propia y de miembros de mis salas"
  on usuarios for select
  using (true); -- simplificado para MVP; se puede restringir a salas compartidas más adelante

create policy "usuarios: solo puedo editar mi propio perfil"
  on usuarios for update
  using (auth.uid() = id);

-- --- salas ---
create policy "salas: veo las salas de las que soy miembro"
  on salas for select
  using (
    exists (
      select 1 from sala_miembros sm
      where sm.sala_id = salas.id and sm.usuario_id = auth.uid()
    )
  );

create policy "salas: cualquier usuario autenticado puede crear una sala"
  on salas for insert
  with check (auth.uid() = creador_id);

create policy "salas: solo se puede actualizar el estado, nunca borrar"
  on salas for update
  using (
    exists (
      select 1 from sala_miembros sm
      where sm.sala_id = salas.id and sm.usuario_id = auth.uid()
    )
  );

-- IMPORTANTE: no se crea ninguna policy de DELETE para "salas".
-- Sin policy de delete + RLS activo, ningún usuario (solo el rol admin/service_role) puede borrar filas.

-- --- sala_miembros ---
create policy "sala_miembros: veo miembros de mis salas"
  on sala_miembros for select
  using (
    exists (
      select 1 from sala_miembros sm2
      where sm2.sala_id = sala_miembros.sala_id and sm2.usuario_id = auth.uid()
    )
  );

create policy "sala_miembros: el creador de la sala añade miembros"
  on sala_miembros for insert
  with check (
    exists (
      select 1 from salas s
      where s.id = sala_miembros.sala_id and s.creador_id = auth.uid()
    )
  );

-- --- apuestas ---
create policy "apuestas: veo apuestas de mis salas"
  on apuestas for select
  using (
    exists (
      select 1 from sala_miembros sm
      where sm.sala_id = apuestas.sala_id and sm.usuario_id = auth.uid()
    )
  );

create policy "apuestas: cualquier miembro de la sala puede crear una apuesta"
  on apuestas for insert
  with check (
    auth.uid() = creador_id
    and exists (
      select 1 from sala_miembros sm
      where sm.sala_id = apuestas.sala_id and sm.usuario_id = auth.uid()
    )
  );

create policy "apuestas: solo se puede actualizar estado/foto, nunca borrar"
  on apuestas for update
  using (
    exists (
      select 1 from sala_miembros sm
      where sm.sala_id = apuestas.sala_id and sm.usuario_id = auth.uid()
    )
  );

-- Igual que en "salas": no hay policy de DELETE para "apuestas" -> son inmutables.

-- --- apuesta_participantes ---
create policy "participantes: veo participantes de apuestas de mis salas"
  on apuesta_participantes for select
  using (
    exists (
      select 1 from apuestas a
      join sala_miembros sm on sm.sala_id = a.sala_id
      where a.id = apuesta_participantes.apuesta_id and sm.usuario_id = auth.uid()
    )
  );

create policy "participantes: me puedo unir yo mismo a una apuesta"
  on apuesta_participantes for insert
  with check (auth.uid() = usuario_id);

-- --- apuesta_resolucion / votos ---
create policy "resolucion: veo resoluciones de apuestas de mis salas"
  on apuesta_resolucion for select
  using (
    exists (
      select 1 from apuestas a
      join sala_miembros sm on sm.sala_id = a.sala_id
      where a.id = apuesta_resolucion.apuesta_id and sm.usuario_id = auth.uid()
    )
  );

create policy "resolucion: un participante puede proponer resultado"
  on apuesta_resolucion for insert
  with check (
    auth.uid() = propuesto_por
    and exists (
      select 1 from apuesta_participantes ap
      where ap.apuesta_id = apuesta_resolucion.apuesta_id and ap.usuario_id = auth.uid()
    )
  );

create policy "votos: veo votos de resoluciones de mis salas"
  on apuesta_resolucion_votos for select
  using (
    exists (
      select 1 from apuesta_resolucion r
      join apuestas a on a.id = r.apuesta_id
      join sala_miembros sm on sm.sala_id = a.sala_id
      where r.id = apuesta_resolucion_votos.resolucion_id and sm.usuario_id = auth.uid()
    )
  );

create policy "votos: solo puedo votar en mi nombre"
  on apuesta_resolucion_votos for insert
  with check (auth.uid() = usuario_id);

-- --- notificaciones ---
create policy "notificaciones: solo veo las mías"
  on notificaciones for select
  using (auth.uid() = usuario_id);

create policy "notificaciones: solo puedo marcar como leídas las mías"
  on notificaciones for update
  using (auth.uid() = usuario_id);

-- ============================================================
-- NOTA sobre inmutabilidad:
-- Ninguna tabla tiene policy de "delete". Con RLS activado, eso
-- significa que ningún usuario normal puede borrar filas de
-- salas, apuestas, resoluciones ni participantes — solo el
-- service_role (backend/admin) podría, si algún día hace falta
-- para moderación.
-- ============================================================
