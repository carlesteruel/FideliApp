# 🏆 FideliApp — App de Fidelización de Negocios

App nativa móvil (iOS + Android) + panel web para la gestión de campañas de fidelización de clientes para negocios de restauración.

---

## 📁 Estructura del proyecto

```
/
├── mobile/          ← App React Native + Expo (iOS & Android)
├── dashboard/       ← Panel web Next.js para negocios
└── supabase/
    └── schema.sql   ← Schema completo de la base de datos
```

---

## 🚀 Guía de setup rápido

### 1️⃣ Crear proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com) y crea una cuenta gratuita
2. Crea un nuevo proyecto
3. Ve a **SQL Editor** y pega el contenido de `supabase/schema.sql`
4. Ejecuta el SQL para crear todas las tablas, funciones y políticas RLS
5. Copia tus credenciales en **Settings > API**:
   - `Project URL` → `EXPO_PUBLIC_SUPABASE_URL`
   - `anon public` key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

### 2️⃣ Configurar la App Móvil (`/mobile`)

#### Configurar variables de entorno
Edita `mobile/.env.local`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY_AQUI
```

#### Instalar dependencias
```bash
cd mobile
npm install
```

#### Ejecutar la app
```bash
# Expo Go (desarrollo rápido)
npx expo start

# Para Android (requiere Android Studio o dispositivo físico)
npx expo run:android

# Para iOS (requiere Xcode en Mac)
npx expo run:ios
```

---

### 3️⃣ Configurar el Dashboard Web (`/dashboard`)

#### Instalar dependencias del dashboard
```bash
cd dashboard
npm install
npm install @supabase/ssr @supabase/supabase-js
```

#### Configurar variables de entorno
Edita `dashboard/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY_AQUI
```

#### Ejecutar el dashboard
```bash
cd dashboard
npm run dev
# Abre http://localhost:3000
```

---

## 👥 Roles de usuario

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| `client` | Cliente final | App móvil: tarjetas, premios, QR |
| `business` | Dueño de negocio | App móvil + Dashboard web |
| `admin` | Administrador | Acceso total (futuro) |

---

## 📱 Funcionalidades de la App Móvil

### Para Clientes (`/(client)`)
- 🏠 **Explorar** — Descubrir negocios y campañas activas
- 💳 **Mis tarjetas** — Tarjetas de fidelización con progreso visual
- 🎁 **Premios** — Premios ganados y canjeados
- 📲 **Mi QR** — Código QR personal (válido 5 min) para que el negocio escanee
- 👤 **Perfil** — Datos personales, notificaciones, ajustes

### Para Negocios (`/(business)`)
- 📊 **Dashboard** — Estadísticas en tiempo real (clientes, sellos, premios)
- 🎯 **Campañas** — Crear, activar/pausar campañas de fidelización
- 📷 **Escáner QR** — Escanear el QR del cliente para añadir sellos
- 👥 **Clientes** — Ranking de clientes más fieles
- 🏪 **Mi negocio** — Configuración del negocio

---

## 🌐 Panel Web (Dashboard)

Accesible en `http://localhost:3000`:

| Ruta | Descripción |
|------|-------------|
| `/login` | Login para negocios |
| `/dashboard` | Vista general con estadísticas |
| `/dashboard/campaigns` | Gestión de campañas |
| `/dashboard/customers` | Ranking de clientes |
| `/dashboard/rewards` | Premios generados |
| `/dashboard/settings` | Configuración del negocio |

---

## 🎯 Tipos de campaña disponibles

| Tipo | Emoji | Descripción |
|------|-------|-------------|
| `punch_card` | ☕ | Tarjeta de sellos: X sellos = premio gratis |
| `points` | ⭐ | Sistema de puntos: 1€ = N puntos |
| `birthday` | 🎂 | Regalo automático en cumpleaños |
| `streak` | 🔥 | Premio por visitas consecutivas |
| `cashback` | 💸 | % de vuelta en saldo (próxima versión) |
| `referral` | 👫 | Premio por traer amigos (próxima versión) |

---

## 🔄 Flujo de uso

```
CLIENTE                           NEGOCIO
   │                                 │
   │ 1. Abre pantalla "Mi QR"        │
   │    (genera token 5 min)         │
   │                                 │
   │ 2. Muestra QR al negocio ──────►│ 3. Escanea QR con la app
   │                                 │    (selecciona campaña)
   │                                 │
   │◄── 4. Sello añadido a la tarjeta│
   │                                 │
   │ 5. Si completa → Premio 🎁      │
   │    (visible en "Mis premios")   │
   │                                 │
   │ 6. Muestra pantalla Premio ────►│ 7. Valida el canje
```

---

## 🗄️ Base de datos (Supabase)

### Tablas principales
- `profiles` — Usuarios (clientes y negocios)
- `businesses` — Negocios registrados
- `campaigns` — Campañas de fidelización
- `loyalty_cards` — Tarjeta de cliente por campaña
- `stamps` — Registro de cada sello
- `rewards` — Premios ganados
- `customer_qr_tokens` — Tokens QR temporales (5 min)
- `push_tokens` — Tokens para notificaciones push

### Funciones RPC
- `add_stamp(p_customer_id, p_campaign_id, p_stamped_by)` — Añade un sello y genera premio si corresponde
- `redeem_reward(p_reward_id, p_redeemed_by)` — Canjea un premio

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| App móvil | React Native + Expo |
| Estilos móvil | NativeWind (Tailwind para RN) |
| Estado global | Zustand |
| Panel web | Next.js 15 (App Router) |
| Estilos web | Tailwind CSS |
| Backend/DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| QR Code | react-native-qrcode-svg |
| Cámara/Scanner | expo-camera |

---

## 📋 Próximas funcionalidades (Fase 2)

- [ ] Notificaciones push (Expo + FCM)
- [ ] Cashback automático
- [ ] Sistema de referidos
- [ ] Gamificación (ruleta de premios, retos)
- [ ] Mapa de negocios participantes
- [ ] Panel de analíticas avanzado
- [ ] Integración con pagos (Stripe) para bonos pack
- [ ] Valoraciones y reseñas

---

## 🔐 Seguridad

- Row Level Security (RLS) activado en todas las tablas
- Los clientes solo ven sus propios datos
- Los negocios solo ven datos de sus propias campañas
- Los tokens QR expiran a los 5 minutos y solo pueden usarse una vez

---

## 📞 Contacto

FideliApp · soporte@fideliapp.com
