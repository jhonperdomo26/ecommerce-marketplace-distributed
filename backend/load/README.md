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

---

# Fase 4 · Suite de rendimiento (`ren-suite.js`)

`ren-suite.js` implementa los perfiles **REN-01 a REN-06** del Plan de Pruebas (casos PT-REN-01 a 08)
en un único script; el perfil se elige con `PERFIL`. Archivos de apoyo:

| Archivo | Para qué sirve |
| ------- | -------------- |
| `ren-suite.js` | Perfiles REN-01 (login), REN-02 (catálogo), REN-03 (panel), REN-04 (compra), REN-05 (estrés), REN-06 (resistencia) y `BASE` (línea base de PT-REN-08). |
| `datos-volumen.sql` | Lleva la BD a 60 productos y 300 pedidos (REN-02/03). Ejecutar tras `02_seed.sql`. |
| `consistencia-stock.sql` | PT-REN-07: stock descontado = suma de pedidos y stock ≥ 0, por producto de carga. |
| `analizar_resultados.py` | Lee los resultados de k6 y genera tabla y gráficos (`docs/fase4/graficos/`). |
| `muestreo_recursos.py` | Muestrea CPU y memoria del proceso Node cada 2 s (criterio «CPU < 85 %»). |

```bash
# Backend en modo producción con los límites de tasa relajados (si no, el limitador del login
# bloquea el setup de k6) y la BD con la semilla + datos-volumen.sql:
NODE_ENV=production JWT_SECRET=$(openssl rand -base64 48) LOGIN_RATE_LIMIT=10000000 \
  CHAT_RATE_LIMIT=10000000 REGISTRO_RATE_LIMIT=10000000 npm start

mkdir -p resultados
k6 run --summary-export=resultados/ren-02.json --out json=resultados/ren-02.points.json.gz \
  -e PERFIL=REN-02 load/ren-suite.js
# Estrés en una sola ejecución (8 min):           -e PERFIL=REN-05
# Estrés por tramos contiguos de la misma rampa:  -e PERFIL=REN-05 -e STAGES=120s:80 -e START_VUS=0
#                                                 -e PERFIL=REN-05 -e STAGES=120s:160 -e START_VUS=80 ...
# Resistencia de 30 min (por defecto):            -e PERFIL=REN-06   (SOAK_MIN=5 para una versión corta)
# Compras repartidas entre 20 productos:          -e N_PRODUCTOS=20
psql -d comercio_electronico -f load/consistencia-stock.sql      # PT-REN-07
```

Con Docker, igual que `pedidos-load.js`: `docker run --rm -i -e PERFIL=REN-02 -e BASE_URL=http://host.docker.internal:3000
-v "${PWD}/load:/load" grafana/k6 run /load/ren-suite.js`.
