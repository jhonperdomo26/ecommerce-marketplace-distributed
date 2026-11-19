# Fase 2 — Construcción del núcleo (entregable)

Versión 1.1, 18 de noviembre de 2026. Autores: Jhon Jairo Perdomo Perdomo, Julián Andrés Silva Morales y
Juan Vidarte. Lo nuevo de la versión 1.1 va marcado con **(v1.1)**.

El entregable de esta fase es el propio repositorio
([jhonperdomo26/ecommerce-marketplace-distributed](https://github.com/jhonperdomo26/ecommerce-marketplace-distributed)).
Este archivo indica dónde está cada parte que pide la actividad y cómo comprobarla. Alcance: la API y la
versión web (vendedor y administrador); la app móvil queda fuera de esta entrega.

## Qué pide la actividad y dónde está

| Lo que pide la actividad | Dónde está |
| ------------------------ | ---------- |
| Backend y módulos principales (MVP funcional) | `backend/src/`: rutas, controladores y middleware de auth, productos, pedidos, reseñas, administración y asistente |
| Patrones de diseño limpios | Capas `routes → middleware → controllers → repositorios (TypeORM)`; detalle en la sección «Patrones de diseño» **(v1.1)** |
| Persistencia con ORM | TypeORM 1.1: entidades en `backend/src/entidades/`, configuración en `backend/src/db.ts` (`synchronize: false`). No queda SQL escrito a mano en el código de la API **(v1.1)** |
| Manejo seguro de sesiones (JWT) | `backend/src/middleware/auth.ts` y `backend/src/config.ts`: HS256 fijo, secreto obligatorio en producción, rol y estado leídos de la base en cada petición |
| Integración de servicios externos o pasarelas de pago/notificaciones | Notificaciones por correo (SMTP con Nodemailer) en `backend/src/servicios/notificaciones.ts`; Mailpit en `docker-compose.prod.yml`. No hay pasarela de pagos: quedó fuera de alcance (Fase 1, v1.1) |
| Documentación de la API (Swagger/OpenAPI) | `/api/docs` con la API en marcha; especificación exportada en [`openapi.json`](openapi.json) (fuente: `backend/src/docs/openapi.ts`) |
| Scripts de base de datos | `database/01_schema.sql` (tablas), `02_seed.sql` (datos de demostración), `03_constraints.sql` (una reseña por pedido e índices) |
| Pruebas | `backend/test/` (301 pruebas Jest + Supertest) |

## Verificación (v1.1)

Corrida del 18 de noviembre de 2026 sobre el commit `adc88f1`, con PostgreSQL 16:

| Comprobación | Comando | Resultado |
| ------------ | ------- | --------- |
| Compilación TypeScript | `cd backend && npx tsc --noEmit` | Sin errores |
| Pruebas del backend | `cd backend && npm test` | 12 suites, 301 pruebas en verde (1 pendiente marcada `todo`) |
| OpenAPI exportada al día | regenerar `openapi.json` (comando al final) y compararlo | Idéntico a `backend/src/docs/openapi.ts` |
| Rutas documentadas | `test/openapi.test.ts` y comparación de rutas | Las 21 rutas del código están en la especificación |
| Frontend web | `cd frontend && npm run build` | Compila |
| Aceptación End-to-End | `npm run test:e2e` (Fase 5) | 33 pruebas en verde contra el despliegue en Azure |

## Patrones de diseño (v1.1)

| Patrón | Dónde | Para qué |
| ------ | ----- | -------- |
| Arquitectura en capas | `routes/` → `middleware/` → `controllers/` → repositorios | Cada capa tiene una sola responsabilidad: enrutar, autorizar, validar y responder, persistir |
| Repository (TypeORM) | `repo()` en `db.ts`; entidades en `entidades/` | Acceso a datos sin SQL a mano y con tipos |
| Unit of Work (transacción) | `bd().transaction(...)` en `crearPedido` | El descuento de stock y el pedido se confirman o se deshacen juntos |
| Middleware (cadena de responsabilidad) | `verificarToken(roles)`, `helmet`, CORS, límites de tasa en `app.ts` | Seguridad transversal sin repetirla en cada controlador |
| Inversión de dependencias | Interfaz `ChatDatos` en `chat/tipos.ts`, implementación en `chat/datos.ts` | El motor del asistente se prueba sin base de datos y puede salir a un servicio propio |
| Inyección del transporte de correo | `configurarTransporte()` en `servicios/notificaciones.ts` | Las pruebas usan un transporte falso; producción usa SMTP |
| Inicialización perezosa | `bd()` en `db.ts` | La conexión se abre con la primera consulta y se reintenta si la base aún no arranca |
| Manejo uniforme de errores | `utils/errores.ts` | Los errores 500 no filtran detalles internos |

## Trazabilidad con los requisitos de la Fase 1 (v1.1)

| Requisito (Fase 1, v1.1) | Rutas | Código |
| ------------------------ | ----- | ------ |
| RF1 Registro e inicio de sesión | `POST /api/auth/login`, `POST /api/auth/registro` | `auth.controller.ts` |
| RF2 Productos de la tienda | `GET /api/productos`, `GET /api/productos/mios`, `POST /api/productos`, `PUT` y `DELETE /api/productos/{id}` | `productos.controller.ts` |
| RF3 Compra con descuento de stock | `POST /api/pedidos` | `crearPedido` en `pedidos.controller.ts` |
| RF4 Pedidos y sus estados | `GET /api/pedidos/mios`, `GET /api/pedidos/por-tienda`, `PATCH /api/pedidos/estado` | `pedidos.controller.ts` |
| RF5 Reseñas | `POST /api/resenas`, `GET /api/resenas/producto/{producto_id}`, `GET /api/resenas/mis-productos` | `resenas.controller.ts` |
| RF6 Avisos por correo | Sin ruta propia: se dispara al crear un pedido y al cambiar su estado | `servicios/notificaciones.ts` |
| RF7 Administración | `GET /api/admin/resumen`, `GET` y `POST /api/admin/tiendas`, `GET` y `POST /api/admin/usuarios`, `PATCH /api/admin/usuarios/{id}/activo` | `admin.controller.ts` |
| RF8 Asistente virtual | `POST /api/chat` | `chat.controller.ts`, `chat/` |

## Sesión JWT: contrato de respuestas

Coincide con la sección 10 de la Fase 1 (v1.1), con `openapi.ts` y con las suites de seguridad y E2E.

| Situación | Código |
| --------- | ------ |
| Petición sin token | 403 |
| Token mal formado, con otro algoritmo o vencido | 400 |
| Usuario desactivado o inexistente | 401 |
| Rol sin permiso para la ruta | 401 |
| Recurso de otra tienda | 403 |

## Servicio externo: notificaciones por correo

- Se envía un correo al cliente cuando crea un pedido y cada vez que la tienda cambia su estado.
- El envío ocurre después de confirmar la transacción y sin hacer esperar la respuesta; si el servidor de
  correo falla, el pedido igual queda creado y el error solo se registra.
- Variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  (ver `backend/.env.example`). Sin `SMTP_HOST` el servicio queda apagado.
- En el despliegue, Mailpit recibe los correos y los muestra en su bandeja web.

## Regenerar `openapi.json`

```bash
cd backend
npx ts-node --transpile-only -e "console.log(JSON.stringify(require('./src/docs/openapi').openapi, null, 2))" > ../docs/fase2/openapi.json
```
