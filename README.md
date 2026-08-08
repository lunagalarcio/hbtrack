# HabiTrack 🎯

Aplicación web progresiva (PWA) de estudio y hábitos, construida con HTML, CSS y JavaScript puro (sin frameworks). Organiza tus hábitos, clases, tareas, cronómetros Pomodoro y metas en un solo lugar, y sincroniza tus datos en la nube con Supabase.

## ✨ Funciones

- **Hábitos diarios**: crea hábitos con meta de tiempo, categoría, color y días de la semana; márcalos cada día.
- **Cronómetro**: modo normal y modo Pomodoro con notificaciones, sonidos y estadísticas de sesión.
- **Semana**: organiza tareas por día (incluidas tareas recurrentes).
- **Horario**: agenda tus clases de la universidad por horas.
- **Calendario**: marca días importantes y añade notas.
- **Metas**: vincula una meta a un hábito y lográzala con constancia (días totales o racha).
- **Estadísticas**: gráficos de intensidad, minutos de estudio y porcentaje de cumplimiento.
- **Modo oscuro y colores de acento**: tema claro/oscuro y color de acento personalizable.
- **Sincronización en la nube**: tus datos se guardan localmente (localStorage) y se sincronizan con Supabase.
- **Instalable (PWA)**: funciona offline y se puede instalar en el teléfono.

## 🚀 Cómo empezar

### Requisitos

- Node.js (para el build) o Python (para servir el proyecto localmente)
- Una cuenta en [Supabase](https://supabase.com)

### 1. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Copia tu **Project URL** y tu **anon key**.
3. Ejecuta el script `db/supabase.sql` en el **SQL Editor** de tu proyecto. Esto crea las tablas `profiles` y `user_data` con Row Level Security.

### 2. Configurar las credenciales

Copia `.env.example` como `.env` y pega tus credenciales:

```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key-aqui
```

### 3. Ejecutar localmente

Debes servir la app con un servidor (los navegadores no permiten leer `.env` abriendo `index.html` directamente):

```bash
npx serve .
```

o

```bash
python -m http.server 3000
```

Luego abre `http://localhost:3000`.

## ☁️ Despliegue en Vercel

1. Sube el repositorio a GitHub e importa el proyecto en [Vercel](https://vercel.com).
2. Añade estas variables de entorno en Vercel:

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. Vercel usará `vercel.json` (build: `node build.js`, salida: `.`), que inyecta las credenciales en `js/config.js`.

> Nota: Vercel no sirve el archivo `.env` (está en `.gitignore`). Sin las variables de entorno, la app funciona en modo invitado (sin sincronización).

## 🧠 Cómo funciona la sincronización

- Los datos se guardan en `localStorage` con prefijo por usuario (`<userId>_habits`, etc.).
- Cada guardado registra su `updated_at` local y se encola para subirse a Supabase (tabla `user_data`).
- Al iniciar sesión se comparan los timestamps local vs nube (última escritura gana) y se mezclan.
- Los datos creados como invitado se migran al prefijo del usuario en el primer inicio de sesión.
- Los cambios hechos sin conexión se guardan en una cola de pendientes y se reintentan automáticamente.

## 🗂️ Estructura del proyecto

```
├── index.html            # Interfaz principal
├── css/style.css         # Estilos (incluye diseño móvil)
├── js/
│   ├── config.js         # Credenciales de Supabase (inyectadas en el build)
│   ├── shared.js         # Helpers y estado compartido
│   ├── sync.js           # Sincronización con Supabase
│   ├── auth.js           # Inicio de sesión / registro
│   ├── habit.js          # Hábitos
│   ├── goals.js          # Metas
│   ├── timer.js          # Cronómetro / Pomodoro
│   ├── week.js           # Tareas semanales
│   ├── timetable.js      # Horario de clases
│   ├── calendar.js       # Calendario
│   ├── stats.js          # Estadísticas y gráficos
│   ├── dashboard.js      # Resumen
│   └── reminders.js      # Recordatorios
├── db/supabase.sql       # Esquema de la base de datos
├── icons/                # Iconos de la app
├── build.js              # Script de build para Vercel
├── vercel.json           # Configuración de Vercel
└── sw.js                 # Service Worker (PWA/offline)
```

## 📄 Licencia

Todos los derechos reservados. Ver [LICENSE](LICENSE).
