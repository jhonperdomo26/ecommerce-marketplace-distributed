# Prueba de carga — k6

Corresponde al **Punto 5.3** del Manual Técnico: prueba de carga contra el
endpoint de creación de pedidos (`POST /api/pedidos`), simulando un pico de
tráfico tipo Black Friday.

`pedidos-load.js` levanta hasta **50 usuarios virtuales** (rampa 20 s → pico
30 s → bajada 10 s). En `setup()` crea un producto con stock enorme y obtiene el
token del cliente semilla; cada iteración hace un `POST /api/pedidos` real.

## Requisitos

- El **backend** corriendo (`npm run dev`) y la **BD con datos semilla**
  (`docker compose up -d` desde la raíz).
- **k6**: vía Docker (no requiere instalación) o instalado localmente
  (`winget install k6 --id k6.k6`).

## Ejecutar

Desde la carpeta `backend/`:

**Con Docker** (recomendado):

```bash
docker run --rm -i -e BASE_URL=http://host.docker.internal:3000 \
  -v "${PWD}/load:/load" grafana/k6 run /load/pedidos-load.js
```

> En PowerShell usa `${PWD}` igual; en CMD reemplaza por la ruta absoluta.
> `host.docker.internal` es cómo el contenedor de k6 alcanza tu backend local.

**Con k6 instalado**:

```bash
k6 run load/pedidos-load.js
# o apuntando a otra URL:
k6 run -e BASE_URL=http://localhost:3000 load/pedidos-load.js
```

## Criterios de aceptación (`thresholds`)

| Métrica | Umbral |
| ------- | ------ |
| `http_req_failed` | < 1 % de peticiones con error |
| `http_req_duration` p(95) | < 800 ms |
| `checks` | > 99 % de respuestas `201` |

k6 termina con código de salida distinto de 0 si algún umbral no se cumple, así
que sirve tal cual en un pipeline de CI.

## Después de correrla

La prueba crea muchos pedidos en la BD de desarrollo. Para dejarla limpia:

```bash
docker compose down -v && docker compose up -d   # desde la raíz del repo
```
