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
│   ├── auth.controller.ts       login + registro (bcrypt, firma JWT)
│   ├── pedidos.controller.ts    actualizarEstadoPedido (literal del manual) + listarPorTienda + listarMios + crearPedido
│   ├── productos.controller.ts  catálogo + CRUD de productos del vendedor
│   ├── resenas.controller.ts    crear/consultar reseñas
│   └── admin.controller.ts      tiendas, usuarios y conteos globales
└── routes/
    ├── auth.routes.ts           POST /login, POST /registro
    ├── pedidos.routes.ts        GET /por-tienda, GET /mios, POST /, PATCH /estado
    ├── productos.routes.ts      GET /, GET /mios, POST /, PUT /:id, DELETE /:id
    ├── resenas.routes.ts        POST /, GET /producto/:id, GET /mis-productos
    └── admin.routes.ts          GET/POST /tiendas, GET/POST /usuarios, PATCH /usuarios/:id/activo, GET /resumen
```

## Endpoints

| Método | Ruta | Rol | Descripción |
| ------ | ---- | --- | ----------- |
| `GET`  | `/`                              | —             | Sonda de salud. |
| `POST` | `/api/auth/login`                | —             | Devuelve `{ token, usuario }`. |
| `POST` | `/api/auth/registro`             | —             | Alta de `cliente`. Devuelve `{ token, usuario }`. |
| `GET`  | `/api/productos`                 | autenticado   | Catálogo (`?tienda_id=` opcional). |
| `GET`  | `/api/productos/mios`            | `vendedor`    | Productos de la tienda del token. |
| `POST` | `/api/productos`                 | `vendedor`    | `{ nombre, sku, precio, stock }`. |
| `PUT`  | `/api/productos/:id`             | `vendedor`    | Edita un producto de la propia tienda. |
| `DELETE` | `/api/productos/:id`           | `vendedor`    | Elimina un producto de la propia tienda. |
| `GET`  | `/api/pedidos/por-tienda`        | `vendedor`    | Pedidos de la tienda del token (panel web). |
| `GET`  | `/api/pedidos/mios`              | `cliente`     | Pedidos del cliente del token (app móvil). |
| `POST` | `/api/pedidos`                   | `cliente`     | `{ producto_id, cantidad }`. Valida y descuenta stock (transacción). |
| `PATCH`| `/api/pedidos/estado`            | `vendedor`    | `{ pedido_id, estado }`. Valida la tienda. |
| `POST` | `/api/resenas`                   | `cliente`     | `{ pedido_id, calificacion, comentario }`. Pedido propio y `entregado`. |
| `GET`  | `/api/resenas/producto/:id`      | autenticado   | Reseñas de un producto. |
| `GET`  | `/api/resenas/mis-productos`     | `vendedor`    | Reseñas de los productos de su tienda. |
| `GET`  | `/api/admin/resumen`             | `administrador` | Conteos globales. |
| `GET` · `POST` | `/api/admin/tiendas`     | `administrador` | Lista / crea tiendas. |
| `GET` · `POST` | `/api/admin/usuarios`    | `administrador` | Lista / crea `vendedor`/`administrador`. |
| `PATCH`| `/api/admin/usuarios/:id/activo` | `administrador` | `{ activo: boolean }`. |

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
