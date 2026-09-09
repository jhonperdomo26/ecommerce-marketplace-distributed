# Plataforma de Comercio Electrónico — Marketplace multi-tienda

Implementación del **Manual Técnico** del proyecto (Ingeniería de Software II).
Arquitectura desacoplada: una **API RESTful central** (Node + Express + TypeScript)
atiende simultáneamente al **frontend web** (React + Vite + Tailwind) y a la
**app móvil** (Flutter), sobre una base de datos **PostgreSQL** con soporte
multi-tienda.

> Documento de referencia: [`docs/Manual_Tecnico_Ecommerce.docx`](docs/Manual_Tecnico_Ecommerce.docx)

Autores: Juan Andrés Vidarte Dussan · Jhon Jairo Perdomo Perdomo · Julián Andrés Silva Morales

---

## Arquitectura (Sección 1 del manual)

```
        ┌─────────────┐         ┌─────────────┐
        │  Web (React)│         │ Móvil (Flutter)
        └──────┬──────┘         └──────┬──────┘
               │  HTTPS / JWT          │
               └──────────┬───────────-┘
                          ▼
                ┌──────────────────────┐
                │  API RESTful central │  Node + Express + TypeScript
                │  Auth JWT + RBAC     │  (administrador / vendedor / cliente)
                └──────────┬───────────┘
                           ▼
                ┌──────────────────────┐
                │     PostgreSQL       │  particionable por tienda_id
                └──────────────────────┘
```

- **Seguridad multi-tenant:** cada consulta se filtra por el `tienda_id`
  recuperado de la firma del token, nunca de un parámetro enviado por el cliente.
- **Disponibilidad:** el uso de JWT mantiene la API *stateless*, lista para
  clonarse tras un balanceador de carga en picos de demanda.

## Estructura del repositorio

| Carpeta       | Contenido                                                           |
| ------------- | ---------------------------------------------------------------- |
| `database/`   | `01_schema.sql`, `02_seed.sql`, `03_constraints.sql` y guía de la BD. |
| `backend/`    | API RESTful (Sección 3 y Paso 2 del manual) + endpoints de negocio.  |
| `frontend/`   | Web de vendedor y administrador (Sección 4 y Paso 3).            |
| `mobile/`     | App del cliente en Flutter (Sección 5 y Paso 4).                 |
| `docs/`       | Copia del Manual Técnico original.                               |
| `docker-compose.yml` | PostgreSQL + pgAdmin para desarrollo local.               |

Cada subproyecto tiene su propio `README.md` con instrucciones detalladas.

## Requisitos

- **Node.js 20+** y npm (backend y frontend)
- **PostgreSQL 14+** — o **Docker** para usar `docker-compose.yml`
- **Flutter SDK 3.x** (solo para la app móvil)

## Puesta en marcha (orden recomendado)

### 1. Base de datos

Con Docker (recomendado):

```bash
docker compose up -d
```

Levanta PostgreSQL en `localhost:5432` (base `comercio_electronico`, usuario y
contraseña `postgres`) y ejecuta los scripts `.sql` automáticamente. pgAdmin
queda en `http://localhost:5050`.

Sin Docker: ver [`database/README.md`](database/README.md).

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env      # PowerShell: copy .env.example .env
# ajusta las credenciales en .env (con Docker: DB_USER=postgres, DB_PASSWORD=postgres)
npm run dev
```

API en `http://localhost:3000`.

### 3. Frontend web

```bash
cd frontend
npm install
npm run dev
```

Web en `http://localhost:5173`. Inicia sesión como **vendedor**
(`vendedor1@tutienda.com` / `Password123`) para gestionar productos, pedidos y
ver reseñas, o como **administrador** (`admin@tutienda.com`) para el panel de
tiendas y usuarios. El **cliente** no tiene vistas en web: usa la app móvil.

### 4. App móvil

```bash
cd mobile
flutter create .          # regenera las carpetas de plataforma
flutter pub get
flutter run
```

Ajusta `lib/config.dart` según el emulador/dispositivo. Inicia sesión con
`cliente@correo.com` / `Password123` (o crea una cuenta nueva). Desde la app el
cliente **navega el catálogo, compra** y, sobre los pedidos `entregado`,
**deja una reseña**.

## Funcionalidades

| Módulo | Funciones |
| ------ | --------- |
| **Autenticación** | Login (todos los roles) y auto-registro de clientes (web y app). |
| **Cliente (app móvil)** | Catálogo de productos, compra (descuenta stock), "Mis pedidos" y reseñas de pedidos entregados. |
| **Vendedor (web)** | CRUD de productos de su tienda, panel de pedidos con cambio de estado, y reseñas de sus productos. |
| **Administrador (web)** | Conteos globales, alta de tiendas y alta/activación de usuarios `vendedor`/`administrador`. |
| **Seguridad** | RBAC por rol + aislamiento multi-tienda: `tienda_id`/`usuario_id` siempre desde el token. |

## Usuarios de prueba

Todos con contraseña **`Password123`** (ver `database/02_seed.sql`).

| Email                     | Rol           | tienda_id |
| ------------------------- | ------------- | --------- |
| `admin@tutienda.com`      | administrador | 1         |
| `vendedor1@tutienda.com`  | vendedor      | 1         |
| `vendedor2@tutienda.com`  | vendedor      | 2         |
| `cliente@correo.com`      | cliente       | —         |

## Estado / pendientes

Implementados: el código de las Secciones 2–5 y la guía de los Pasos 1–4 del
manual, más las funcionalidades de negocio de la tabla anterior (catálogo,
compra, registro, panel de administrador, reseñas y cambio de estado de pedidos).

**Falta el Paso 5 del manual (Pruebas de Integración y Validación):**

- [ ] **5.1** Prueba de humo end-to-end (login → web → móvil).
- [ ] **5.2** Prueba crítica de aislamiento entre tiendas (multi-tenancy):
      un vendedor de la Tienda 2 no debe poder modificar un pedido/producto de la
      Tienda 1 (respuesta esperada `403`).
- [ ] **5.3** Pruebas automatizadas: unitarias (Jest + Supertest) sobre
      `verificarToken`, `actualizarEstadoPedido`, `crearPedido` (incluido el caso
      de stock insuficiente) y `crearResena`; pruebas de las restricciones
      `CHECK`/`UNIQUE` de la BD y prueba de carga (k6 / JMeter) sobre la creación
      de pedidos.
