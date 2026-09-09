# Frontend web — React + Vite + Tailwind

Web para los roles **vendedor** y **administrador**. El **cliente** no tiene
vistas aquí: usa la app móvil. Corresponde a la **Sección 4** y al **Paso 3** del
Manual Técnico, ampliado con gestión de productos, reseñas y panel de administración.

## Requisitos

- Node.js 20 o superior
- El backend en ejecución en `http://localhost:3000`

## Puesta en marcha

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Las peticiones a `/api/...` se redirigen al backend
mediante el proxy configurado en `vite.config.js` (Manual Técnico, Paso 3, punto 4).

## Rutas

| Ruta         | Acceso        | Contenido |
| ------------ | ------------- | --------- |
| `/login`     | público       | Inicio de sesión. Guarda `token` y `usuario` en `localStorage`. |
| `/registro`  | público       | Auto-registro de clientes (`POST /api/auth/registro`). |
| `/pedidos`   | vendedor      | `PanelPedidos` (base del manual) + cambio de estado por fila. |
| `/productos` | vendedor      | Alta / edición / borrado de los productos de su tienda. |
| `/resenas`   | vendedor      | Reseñas de los productos de su tienda. |
| `/admin`     | administrador | Conteos globales + alta de tiendas y usuarios + activar/desactivar. |

Tras el login se redirige según el rol (vendedor → `/pedidos`,
administrador → `/admin`).

## Estructura

```
src/
├── main.jsx                     Punto de entrada + BrowserRouter
├── App.jsx                      Rutas con guarda por rol (RutaProtegida)
├── index.css                    Directivas de Tailwind
├── api.js                       token/usuario en localStorage + apiFetch / apiJson
├── components/
│   ├── Layout.jsx               Barra de navegación según rol + "Salir"
│   └── PanelPedidos.jsx         Tabla de pedidos (base del manual) + cambio de estado
└── pages/
    ├── Login.jsx                Inicio de sesión
    ├── Registro.jsx             Alta de clientes
    ├── Productos.jsx            CRUD de productos del vendedor
    ├── Resenas.jsx              Reseñas de los productos del vendedor
    └── Admin.jsx                Panel de administración
```
