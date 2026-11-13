# Plantilla de diseño (Studio Admin)

Base del frontend: [arhamkhnz/next-shadcn-admin-dashboard-baseui](https://github.com/arhamkhnz/next-shadcn-admin-dashboard-baseui) (MIT). Usar solo ese repo original, nunca forks (hay forks con malware en otras plantillas).

- Pila: Next.js 16, React 19, Tailwind 4, shadcn estilo `base-nova` sobre **Base UI** (no Radix), Recharts 3, TanStack Table v9, lucide-react.
- **Pantalla modelo: Academy Dashboard** (`src/app/(main)/dashboard/academy/` de la plantilla). Cada módulo de la app copia su ritmo:
  1. Encabezado: título grande (`text-3xl tracking-tight`), subtítulo corto en gris, y a la derecha botones pequeños con ícono (uno primario, el resto `outline`).
  2. Fila de 4 tarjetas KPI: título, número grande, insignia de cambio (verde/rojo) y contexto gris.
  3. Grilla de 12 columnas: lista con estados a la izquierda (5 col) y gráfico de barras a la derecha (7 col).
  4. Segunda fila: bloque ancho (8 col) y bloque angosto (4 col), cada tarjeta con enlace "Ver …" con flecha arriba a la derecha.
- **Muchos íconos** (lucide-react): en cada botón, cada título de tarjeta, cada KPI, cada ítem del menú y en los estados vacíos.
- Conservar el panel de **Preferencias** (tema, fuente, modo claro/oscuro/sistema, layout, sidebar).
- Usar `src/components/ui/` tal cual. No editarlos; personalizar donde se usan. Colores solo con tokens del tema (o paleta por nombre de Tailwind); nunca hex/rgb/oklch sueltos.
- Quitar las pantallas demo que no usamos (CRM, Finance, Academy, etc.) del menú y del código cuando el módulo propio exista. La plantilla es el cascarón, no el contenido.
- Marca: "Medoxigas Contabilidad" en el sidebar; usuario real de Supabase abajo (no "Arham Khan").
- Todo el texto de la UI en **español** de RD. Números con formato `es-DO` (coma de miles: RD$ 1,250.00). Fechas y horas en `America/Santo_Domingo`.

## Decisiones de Waldy (2026-11-13)

- La plantilla es la **base del repo**: se trae el código de Studio Admin y se le pasa lo nuestro (login Supabase, `proxy.ts`, migraciones, consultas y módulos propios). No al revés.
- Menú lateral: **Inicio** activo; los módulos futuros (Facturación, Clientes, Productos, Gastos, Bancos y Reportes) deshabilitados con badge «soon». Las pantallas demo de la plantilla se borran.
- Login: tarjeta de dos paneles (formulario a la izquierda, panel de marca neutro a la derecha), conectada a Supabase Auth (correo/contraseña y Google). Sin registro público. En español, con monograma "MC" y textos de Medoxigas Contabilidad.
- **Colores de marca (de medoxigas.com):** fondo blanco y **azul principal `#1e56c7`** (botones primarios, enlaces, íconos activos, insignias, barra principal de gráficos). Azul oscuro `#0a2352` (títulos de acento); hover `#123c8c`; suave `#eaf0fc` (fondos de ítems activos). Viven como **preset "Medoxigas"** en `src/styles/presets/` (tokens `--primary`, `--ring`, `--chart-1`, `--sidebar-primary`…), por defecto; nunca hex sueltos en componentes.
- Etapa 2 (no ahora): lista de usuarios permitidos (allowlist en Supabase) administrada por una API.
