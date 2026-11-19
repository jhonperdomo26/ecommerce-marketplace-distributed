# Despliegue en la nube (Fase 5)

Guía para dejar la plataforma accesible en internet con HTTPS, en una máquina virtual (VM) con Docker.
Usa los mismos contenedores que el despliegue local (`docker-compose.prod.yml`) más un ajuste para la
nube (`docker-compose.nube.yml`) que agrega **Caddy** como entrada pública con certificado HTTPS
automático.

```
Internet ──443──► Caddy ──► web (nginx) ──/api──► api (Node) ──► db (PostgreSQL)
                    └─ correo.<dominio> ──► mailpit (bandeja, con contraseña)
```

## 1. Conseguir la VM

Cualquier VM con **Ubuntu 22.04 o 24.04**, **2 GB de RAM o más** y una **IP pública** sirve. Opciones sin
costo para estudiantes (verifique las condiciones vigentes al registrarse):

| Proveedor | Oferta | Notas |
| --------- | ------ | ----- |
| Azure for Students | Crédito de USD 100 por 12 meses, sin tarjeta, con el correo de la universidad | VM x86; elegir un tamaño pequeño (2 vCPU, 4 GB) y **apagarla** cuando no se use para no gastar el crédito |
| Oracle Cloud Always Free | VM Ampere A1 (ARM) de hasta 4 OCPU y 24 GB, sin vencimiento | Pide tarjeta para verificar identidad; las imágenes del proyecto funcionan en ARM |
| Google Cloud | Una e2-micro (1 GB) gratis en regiones de EE. UU. | Muy justa: el script agrega memoria de intercambio, pero la compilación será lenta |

Al crear la VM:
- Usuario con clave SSH.
- Abrir en el firewall o grupo de seguridad de la nube los puertos **22, 80 y 443**.
- Anotar la **IP pública** (por ejemplo `20.30.40.50`).

## 2. Preparar la VM

```bash
ssh usuario@20.30.40.50
git clone https://github.com/jhonperdomo26/ecommerce-marketplace-distributed.git ecommerce
cd ecommerce
bash despliegue/preparar_vm.sh      # instala Docker, agrega swap si hace falta y abre puertos
exit                                # volver a entrar para usar docker sin sudo
```

## 3. Configurar `.env`

```bash
ssh usuario@20.30.40.50 && cd ecommerce
cp .env.example .env
nano .env
```

Valores mínimos:

```dotenv
DB_PASSWORD=<contraseña larga para PostgreSQL>
JWT_SECRET=<48 bytes aleatorios: openssl rand -base64 48>
DOMINIO=20-30-40-50.sslip.io        # la IP con guiones; sslip.io resuelve al instante
MAILPIT_UI_AUTH=demo:<otra contraseña>
```

`sslip.io` evita comprar un dominio: `20-30-40-50.sslip.io` apunta a `20.30.40.50`. Si se tiene un
dominio propio, se crea un registro A hacia la IP y se usa ese nombre.

## 4. Levantar

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.nube.yml up --build -d
docker compose -f docker-compose.prod.yml -f docker-compose.nube.yml ps
docker compose -f docker-compose.prod.yml -f docker-compose.nube.yml logs -f caddy   # ver la emisión del certificado
```

Queda disponible en:
- `https://20-30-40-50.sslip.io` — panel web (vendedores y administradores)
- `https://20-30-40-50.sslip.io/app/` — tienda del cliente (la app Flutter compilada para web; se
  usa desde el navegador del celular o del PC)
- `https://20-30-40-50.sslip.io/api/docs` — Swagger
- `https://correo.20-30-40-50.sslip.io` — bandeja de Mailpit (pide `MAILPIT_UI_AUTH`)

La primera construcción tarda más (unos minutos extra): la imagen `cliente` descarga el SDK de
Flutter (~1 GB) y compila la app para web. Las siguientes reutilizan la caché de Docker.

## 5. Validar (pruebas de aceptación) y asegurar

1. Correr la suite **antes** de cambiar contraseñas (usa las de la semilla):
   ```bash
   docker compose -f docker-compose.prod.yml -f docker-compose.nube.yml --profile pruebas run --rm e2e
   ```
   Para repetirla seguido, subir temporalmente `LOGIN_RATE_LIMIT` en `.env` y volver a hacer `up -d api`.
2. **Cambiar las contraseñas de la semilla.** `Password123` está publicada en el repositorio; en un
   servidor público cualquiera podría entrar como administrador:
   ```bash
   docker compose -f docker-compose.prod.yml -f docker-compose.nube.yml exec \
     -e NUEVA_CLAVE='<clave nueva de 8+ caracteres>' api node dist/scripts/cambiarClavesDemo.js
   ```
   Después, para volver a correr la suite: `E2E_CLAVE=<clave nueva>` en `.env`.
3. Si se quiere ocultar la documentación de la API: `API_DOCS=0` en `.env` y `up -d api`.

## Operación

| Tarea | Comando (desde la carpeta del proyecto en la VM) |
| ----- | ------------------------------------------------ |
| Ver registros de la API | `docker compose -f docker-compose.prod.yml -f docker-compose.nube.yml logs -f api` |
| Actualizar a la última versión | `git pull` y el comando del paso 4 |
| Respaldo de la base | `docker compose -f docker-compose.prod.yml exec db pg_dump -U postgres comercio_electronico > respaldo.sql` |
| Apagar (conserva datos) | `docker compose -f docker-compose.prod.yml -f docker-compose.nube.yml down` |

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
| ------- | -------------- | -------- |
| El navegador no conecta | Puertos 80/443 cerrados en la nube | Abrirlos en el grupo de seguridad / firewall del proveedor |
| Caddy no obtiene el certificado | El dominio no apunta a la IP, o el puerto 80 está cerrado; o se alcanzó el límite de certificados de Let's Encrypt para sslip.io | Revisar `logs caddy`; probar con un subdominio gratuito de DuckDNS o un dominio propio |
| La compilación se detiene por memoria | VM con poca RAM | Usar una VM de 2 GB o más; el script ya agrega 2 GB de swap |
| `!reset` da error | Docker Compose anterior a 2.24 | Actualizar Docker con el script de preparación |

## Qué cambia frente al despliegue local

- Se agrega el servicio `caddy`; `web` y `mailpit` ya no publican puertos propios.
- `TRUST_PROXY=2` (Caddy y nginx delante de la API) y `CORS_ORIGIN=https://<DOMINIO>`.
- Mailpit exige usuario y contraseña. Sigue siendo un buzón de pruebas: los correos no salen a internet.
  Para enviar correos reales, definir `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y
  `SMTP_SECURE` de un proveedor.

> Estado: estos archivos se escribieron y revisaron pero **todavía no se han probado en una VM real**.
> La primera ejecución puede requerir ajustes menores.
