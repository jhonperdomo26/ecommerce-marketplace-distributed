# Frontend web — React + Vite + Tailwind

Panel del vendedor para visualizar los pedidos de su tienda.
Corresponde a la **Sección 4** y al **Paso 3** del Manual Técnico.

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

## Flujo

1. `/login` — formulario de inicio de sesión. Viene precargado con el vendedor de
   prueba `vendedor1@tutienda.com` / `Password123`. Al entrar, guarda el JWT en
   `localStorage` bajo la clave `token`.
2. `/pedidos` — `PanelPedidos` (código literal del manual). Consume
   `GET /api/pedidos/por-tienda` con la cabecera `Authorization: Bearer <token>`.

## Estructura

```
src/
├── main.jsx                     Punto de entrada + BrowserRouter
├── App.jsx                      Rutas /login y /pedidos (ruta protegida)
├── index.css                    Directivas de Tailwind
├── api.js                       getToken / setToken / apiFetch
├── pages/Login.jsx              Formulario de inicio de sesión
└── components/PanelPedidos.jsx  Tabla de pedidos (literal del Manual Técnico)
```
