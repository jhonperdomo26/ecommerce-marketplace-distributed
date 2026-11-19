# Fase 5 — Despliegue y validación final (web)

Alcance: backend + frontend web. La app móvil queda fuera de esta entrega.

## Qué contiene

| Archivo | Para qué sirve |
| ------- | -------------- |
| `docker-compose.prod.yml` | Levanta PostgreSQL + API + web (nginx) + Mailpit (correo de pruebas), y el servicio `e2e` con `--profile pruebas`. El `docker-compose.yml` de la raíz sigue siendo el de desarrollo (BD + pgAdmin). |
| `backend/Dockerfile` | Imagen de la API en dos etapas (compila con TypeScript; la imagen final solo lleva dependencias de producción y corre como usuario `node`). |
| `frontend/Dockerfile`, `frontend/nginx.conf` | Compila la web con Vite y la sirve con nginx, que reenvía `/api` a la API. |
| `.env.example` | Variables del despliegue (`DB_PASSWORD`, `JWT_SECRET`, …). Se copia como `.env`. |
| `backend/e2e/` | Suite de aceptación End-to-End (33 pruebas, 10 criterios). |

## Requisitos

Solo **Docker Desktop** (con WSL2 en Windows). No hace falta instalar Node, PostgreSQL ni nada de la app
móvil: la base corre en su propio contenedor y se crea sola con los scripts de `database/`, y las imágenes
solo copian `backend/` y `frontend/` (la carpeta `mobile/` nunca se usa). El `docker-compose.yml` de la raíz
(BD + pgAdmin) es para desarrollo; para correr el proyecto completo se usa `docker-compose.prod.yml`.

Generar el `JWT_SECRET` sin tener Node instalado:

```bash
docker run --rm node:20-slim node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

## Desplegar

```bash
cp .env.example .env
# edita .env: DB_PASSWORD y JWT_SECRET (>= 32 caracteres aleatorios):
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml ps        # los tres servicios deben quedar "healthy" / "running"
```

La web queda en <http://localhost:8080>, la documentación de la API en <http://localhost:8080/api/docs> y la bandeja de correos de prueba en <http://localhost:8025>. La base de datos y la API **no se publican**: solo se llega a
ellas a través de nginx (`/api`). Los scripts de `database/` se ejecutan únicamente la primera vez que se
crea el volumen; para recrear la base: `docker compose -f docker-compose.prod.yml down -v`.

> **Datos de demostración.** `database/02_seed.sql` crea usuarios con la clave `Password123`. Sirven para
> las pruebas y la defensa; en un despliegue real hay que cambiarlas o no cargar la semilla.

## Validar (End-to-End)

Sin instalar Node (la suite corre en un contenedor dentro de la misma red):

```bash
docker compose -f docker-compose.prod.yml --profile pruebas run --rm e2e
```

Con Node instalado en el equipo, contra la web publicada:

```bash
cd backend
# El despliegue limita los logins a 10 por IP cada 15 min; la suite hace 7 por ejecución.
# Para repetirla, levanta el compose con LOGIN_RATE_LIMIT=100 en .env (o reinicia la API).
BASE_URL=http://localhost:8080 E2E_WEB=1 npm run test:e2e
```

- `E2E_WEB=1` añade las dos comprobaciones de la web (SPA y reenvío de `/api`); sin él la suite apunta a la
  API directa (`BASE_URL=http://localhost:3000`).
- Es un entorno de pruebas: la suite deja productos, pedidos y usuarios «E2E» creados.

| Criterio | Flujo verificado |
| -------- | ---------------- |
| CA-01 | Despliegue disponible: la API exige autenticación, 404 en JSON sin trazas, la web sirve la SPA y sus rutas |
| CA-02 | Inicio de sesión de los 3 roles, rechazo de clave incorrecta, sin caché ni cabecera `X-Powered-By` |
| CA-03 | Vendedor: crear, editar y validar productos |
| CA-04 | Cliente: registro, catálogo, compra, control de stock, «mis pedidos» y asistente virtual |
| CA-05 | Vendedor atiende el pedido (entregado) y el cliente lo califica |
| CA-06 | Aislamiento entre tiendas y entre roles |
| CA-07 | Administrador: resumen, alta de vendedor y desactivación (el token y el login dejan de servir) |
| CA-08 | Borrado de un producto sin pedidos |
| CA-09 | El cliente recibe en Mailpit el correo de la compra y el de la entrega (solo con `MAILPIT_URL`, que el servicio `e2e` ya define) |
| CA-10 | La especificación OpenAPI y la página de Swagger están publicadas |

## Estado de la verificación

- **Ejecutado con Docker por el equipo:** las imágenes se construyen, los servicios quedan sanos y la suite
  corre dentro de Compose. La primera corrida dio 30 de 31 por las cabeceras de nginx (corregido en
  `frontend/nginx.conf`) y la siguiente se cortó por el límite de inicios de sesión al repetirla
  (ver «Validar»).
- **Cambios posteriores, probados fuera de Docker:** TypeORM, notificaciones, Swagger, filtros de pedidos y
  la nueva interfaz. Backend: 301 pruebas en verde. Suite E2E contra la API compilada y un Mailpit real: 31 en
  verde (las 2 de nginx solo corren en Compose).
- **Cerrado en la nube (v1.1, 18 de noviembre de 2026):** con la versión final se reconstruyeron las imágenes
  en la máquina virtual de Azure y la suite pasó completa, **33 de 33**. Despliegue en
  https://158-158-107-192.sslip.io; detalles en `docs/fase5/Despliegue_Nube.md` y en la sección 3.1 del
  manual técnico.
- Las imágenes de Node pasaron de la 20 (fin de soporte en abril de 2026) a la 22.
