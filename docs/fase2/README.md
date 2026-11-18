# Fase 2 — Construcción del núcleo (entregable)

El entregable de esta fase es el propio repositorio. Este archivo indica dónde está cada parte que pide
la actividad.

| Lo que pide la actividad | Dónde está |
| ------------------------ | ---------- |
| Backend y módulos principales (MVP funcional) | `backend/src/` — rutas, controladores y middleware de auth, productos, pedidos, reseñas, administración y asistente |
| Patrones de diseño limpios | Capas `routes → middleware → controllers → repositorios (TypeORM)`; patrón Repository; servicio de notificaciones desacoplado (`backend/src/servicios/`); motor del asistente separado de los datos mediante una interfaz (`backend/src/chat/tipos.ts`) |
| Persistencia con ORM | TypeORM 1.1: entidades en `backend/src/entidades/`, configuración en `backend/src/db.ts` (`synchronize: false`) |
| Manejo seguro de sesiones (JWT) | `backend/src/middleware/auth.ts` y `backend/src/config.ts`: HS256 fijo, secreto obligatorio en producción, rol y estado leídos de la base en cada petición |
| Integración de servicios externos o pasarelas de pago/notificaciones | Notificaciones por correo (SMTP con Nodemailer) en `backend/src/servicios/notificaciones.ts`; Mailpit en `docker-compose.prod.yml` |
| Documentación de la API (Swagger/OpenAPI) | `/api/docs` con la API en marcha; especificación exportada en [`openapi.json`](openapi.json) (fuente: `backend/src/docs/openapi.ts`) |
| Scripts de base de datos | `database/01_schema.sql`, `02_seed.sql`, `03_constraints.sql` |
| Pruebas | `backend/test/` (301 pruebas Jest + Supertest) |

`openapi.json` se regenera con:

```bash
cd backend
npx ts-node --transpile-only -e "console.log(JSON.stringify(require('./src/docs/openapi').openapi, null, 2))" > ../docs/fase2/openapi.json
```
