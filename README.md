# Apuestas entre Amigos — Fase 0 (Setup)

Esto es el esqueleto del proyecto: login + listado de salas conectados a Supabase, con el esquema de base de datos completo. A partir de aquí construimos pantalla a pantalla.

## 1. Crear el proyecto en Supabase
1. Ve a https://supabase.com → crea un proyecto nuevo (gratis).
2. Ve a **SQL Editor** y ejecuta, en este orden:
   - `sql/schema.sql`
   - `sql/trigger_nuevo_usuario.sql`
3. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public key`

## 2. Configurar el proyecto local
```bash
# Instala dependencias
npm install

# Copia el archivo de entorno y rellénalo con tus datos de Supabase
cp .env.example .env
```

Edita `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
```

## 3. Arrancar la app
Necesitas tener instalada la app **Expo Go** en tu móvil (iOS/Android) para probarlo sin compilar nada.

```bash
npx expo start
```

Escanea el QR con la cámara (iOS) o con la app Expo Go (Android).

## 4. Qué hay ya funcionando
- ✅ Registro / login con email y contraseña (Supabase Auth)
- ✅ Creación automática de perfil en `usuarios` al registrarse
- ✅ Listado de salas (vacío hasta que creemos la pantalla de "crear sala")
- ✅ Esquema completo de base de datos con las reglas de inmutabilidad (RLS) para salas y apuestas

## 5. Siguiente paso (Fase 1)
- Pantalla "Crear sala" + selector de contactos (`expo-contacts`)
- Pantalla de detalle de sala con listado de apuestas
- Pantalla "Crear apuesta"

## Estructura del proyecto
```
apuestas-app/
├── App.tsx                  # Entrada + navegación
├── app.json                 # Config de Expo (permisos cámara/contactos)
├── package.json
├── .env.example
├── src/
│   ├── lib/supabase.ts      # Cliente de Supabase
│   └── screens/
│       ├── LoginScreen.tsx
│       └── SalasScreen.tsx
└── sql/
    ├── schema.sql           # Todas las tablas + RLS
    └── trigger_nuevo_usuario.sql
```
