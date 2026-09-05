# Base de datos — PostgreSQL

Corresponde a la **Sección 2** y al **Paso 1** del Manual Técnico.

| Archivo          | Contenido                                                      |
| ---------------- | ------------------------------------------------------------- |
| `01_schema.sql`  | Estructura relacional: `tiendas`, `usuarios`, `productos`, `pedidos`, `resenas`. |
| `02_seed.sql`    | Datos de prueba: 2 tiendas, 1 admin, 2 vendedores, 1 cliente, 1 producto, 1 pedido. |

## Opción A — Docker (recomendada)

Desde la raíz del repositorio:

```bash
docker compose up -d
```

Esto levanta:

- **PostgreSQL** en `localhost:5432` (usuario `postgres`, contraseña `postgres`,
  base `comercio_electronico`). Los dos scripts `.sql` se ejecutan
  automáticamente la primera vez.
- **pgAdmin** en `http://localhost:5050` (correo `admin@admin.com`,
  contraseña `admin`).

En ese caso el `.env` del backend debe usar:

```
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=comercio_electronico
```

## Opción B — PostgreSQL instalado localmente

1. Crear la base de datos física:

   ```sql
   CREATE DATABASE comercio_electronico;
   ```

2. Ejecutar los scripts en orden (pgAdmin → *Query Tool*, o por terminal):

   ```bash
   psql -U postgres -d comercio_electronico -f 01_schema.sql
   psql -U postgres -d comercio_electronico -f 02_seed.sql
   ```

## Usuarios de prueba

Todos tienen la contraseña **`Password123`**.

| Email                     | Rol           | tienda_id |
| ------------------------- | ------------- | --------- |
| `admin@tutienda.com`      | administrador | 1         |
| `vendedor1@tutienda.com`  | vendedor      | 1         |
| `vendedor2@tutienda.com`  | vendedor      | 2         |
| `cliente@correo.com`      | cliente       | (NULL)    |

Para regenerar el hash bcrypt de la contraseña:

```bash
cd ../backend && npm run seed:hash -- "Password123"
```
