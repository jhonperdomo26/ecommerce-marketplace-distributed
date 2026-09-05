# Backend — API RESTful central

Node.js + Express + TypeScript. Implementa la autenticación con JWT + RBAC y la
gestión de estado de pedidos con aislamiento por tienda (multi-tenancy).
Corresponde a la **Sección 3** y al **Paso 2** del Manual Técnico.

## Requisitos

- Node.js 20 o superior
- PostgreSQL en ejecución con la base `comercio_electronico` ya creada
  (ver [`../database/README.md`](../database/README.md))

## Puesta en marcha

```bash
npm install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
# edita .env con las credenciales de tu PostgreSQL
npm run dev
```

El servidor queda escuchando en `http://localhost:3000` e imprime esa URL.

## Scripts

| Script              | Descripción                                              |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Arranca en modo desarrollo con recarga (`ts-node-dev`). |
| `npm run build`     | Compila TypeScript a `dist/`.                           |
| `npm start`         | Ejecuta la versión compilada (`node dist/index.js`).    |
| `npm run seed:hash` | Genera un `password_hash` bcrypt. Uso: `npm run seed:hash -- "MiClave"`. |

## Estructura

```
src/
├── index.ts                     Express + CORS + montaje de rutas + listen
├── db.ts                        Pool de PostgreSQL (variables de entorno)
├── middleware/
│   └── auth.ts                  verificarToken(rolesPermitidos) — RBAC (literal del manual)
├── controllers/
│   ├── auth.controller.ts       login: valida credenciales y firma el JWT
│   └── pedidos.controller.ts    actualizarEstadoPedido (literal del manual) + listarPorTienda + listarMios
└── routes/
    ├── auth.routes.ts           POST /api/auth/login
    └── pedidos.routes.ts        GET /por-tienda, GET /mios, PATCH /estado
```

## Endpoints

| Método | Ruta                       | Rol requerido | Descripción                                    |
| ------ | -------------------------- | ------------- | --------------------------------------------- |
| `GET`  | `/`                        | —             | Sonda de salud.                               |
| `POST` | `/api/auth/login`          | —             | Devuelve `{ token, usuario }`.                |
| `GET`  | `/api/pedidos/por-tienda`  | `vendedor`    | Pedidos de la tienda del token (panel web).   |
| `GET`  | `/api/pedidos/mios`        | `cliente`     | Pedidos del cliente del token (app móvil).    |
| `PATCH`| `/api/pedidos/estado`      | `vendedor`    | `{ pedido_id, estado }`. Valida la tienda.    |

El `tienda_id` y el `usuario_id` se leen **siempre** de la firma del token, nunca
del cuerpo de la petición (garantía de aislamiento entre tiendas del manual).

## Prueba rápida (manual)

```bash
# 1. Login (usuario semilla, ver ../database/README.md)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"vendedor1@tutienda.com\",\"password\":\"Password123\"}"

# 2. Con el token devuelto:
curl http://localhost:3000/api/pedidos/por-tienda \
  -H "Authorization: Bearer <TOKEN>"
```
