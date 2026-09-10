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

## Estado

Implementados: el código de las Secciones 2–5 y la guía de los Pasos 1–4 del
manual, las funcionalidades de negocio de la tabla anterior (catálogo, compra,
registro, panel de administrador, reseñas y cambio de estado de pedidos) y el
**Punto 5.3** (pruebas automatizadas y de carga).

- [x] **5.3** Suite **Jest + Supertest** (`backend/test/`, `cd backend && npm test`):
      `verificarToken`, `actualizarEstadoPedido` con el **caso 5.2** como prueba
      permanente, `crearPedido` (incl. stock insuficiente → rollback), `crearResena`
      y pruebas de las restricciones `CHECK`/`UNIQUE` de la BD. **30 pruebas.**
      Prueba de **carga con k6** sobre `POST /api/pedidos`
      (`backend/load/`, ver [`backend/load/README.md`](backend/load/README.md)).
- [x] **Prueba móvil (Flutter)** del Paso 5.1: automatizada en
      `mobile/integration_test/mis_pedidos_test.dart`
      (`flutter test integration_test/mis_pedidos_test.dart -d windows`). Monta
      `MisPedidosScreen` con un token real y comprueba que el indicador de carga
      no gira indefinidamente.
- [ ] **5.1 (web) / 5.2** El manual las plantea como verificación **manual**
      (Postman + navegador). El fondo de la 5.2 ya queda cubierto de forma
      automática dentro de 5.3 (`test/pedidos.test.ts`); falta, si se quiere,
      dejarlas escritas como guion de prueba manual.
