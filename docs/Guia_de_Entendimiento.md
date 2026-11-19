# Guía de entendimiento de las cinco fases

> **Documento de apoyo interno, no es un entregable.** Lo escribimos para que los tres
> entendamos de qué trata cada fase y sepamos explicarla en la defensa. **Lo que se presenta y se
> califica son los documentos oficiales** que aparecen en la columna «Documento oficial» de cada fase
> (índice completo en [`README.md`](README.md)). Si algo de aquí no coincide con un documento oficial,
> manda el oficial.

Equipo: Jhon Jairo Perdomo Perdomo, Julián Andrés Silva Morales y Juan Vidarte.
Alcance: la **versión web** (vendedor y administrador). La app móvil está en el repositorio, pero no
hace parte de esta entrega.

---

## El proyecto en tres frases

Es un **marketplace**: varias tiendas publican productos, los clientes compran y dejan reseñas, y un
administrador gestiona tiendas y usuarios. Lo construimos como una **API en Node.js + TypeScript** con
**PostgreSQL**, una **web en React** y un **asistente virtual** por reglas. Está **publicado en Azure**
y validado con pruebas automáticas de punta a punta.

---

## Fase 1: Análisis y diseño arquitectónico

**Qué pedía la actividad:** diseñar una arquitectura distribuida (diagramas C4, servicios, cómo se
comunican y dónde guardan los datos).

**Qué hicimos, en simple:**
- Diseñamos el sistema **ideal** con cinco servicios: Identidad, Catálogo, Pedidos, Notificaciones y
  Asistente, detrás de un **API Gateway** (Nginx), que se avisan cosas por una **cola de mensajes**
  (RabbitMQ). Por ejemplo, cuando se crea un pedido, Pedidos publica «pedido creado» y Notificaciones
  manda el correo.
- Lo que **construimos de verdad** es el primer paso de ese camino: **un solo servicio dividido en
  módulos** (un «monolito modular»), con las notificaciones ya separadas del resto. El documento explica
  cómo se pasaría, paso a paso, de esto a los cinco servicios.
- Definimos los requisitos **RF1 a RF8** (registro e inicio de sesión, productos, compra, pedidos,
  reseñas, avisos por correo, administración y asistente). Quitamos lo que no programamos, como la
  pasarela de pagos.

**Si nos preguntan «¿por qué no son microservicios de una vez?»:** porque para un equipo de tres y este
tamaño de proyecto, separar primero en módulos es más seguro. La arquitectura deja listo el camino para
separarlos después.

| Documento oficial | Ruta |
| --- | --- |
| Especificación de arquitectura (v1.1) | `docs/fase1/Especificacion_Arquitectura.pdf` (y `.docx`) |

---

## Fase 2: Construcción del núcleo

**Qué pedía la actividad:** el MVP funcionando, con patrones de diseño, ORM, sesiones seguras con JWT,
un servicio externo, documentación de la API (OpenAPI) y scripts de base de datos.

**Qué hicimos, en simple:**
- **Capas:** cada petición pasa por *rutas → middleware (seguridad) → controladores → base de datos*.
  Cada capa hace una sola cosa.
- **ORM (TypeORM):** hablamos con PostgreSQL mediante clases (entidades), sin escribir SQL a mano en la
  API.
- **JWT:** al iniciar sesión el usuario recibe un token que vale 8 horas. En cada petición revisamos en
  la base si el usuario sigue activo y qué rol tiene, así que desactivar a alguien funciona al instante.
- **Compra segura:** el stock se descuenta dentro de una transacción y solo si alcanza, así dos compras
  al mismo tiempo no pueden dejarlo en negativo.
- **Servicio externo:** correos automáticos al crear un pedido y al cambiar su estado (Nodemailer por
  SMTP; en pruebas los recibe Mailpit).
- **Swagger:** las 21 rutas de la API están documentadas y se pueden probar desde el navegador.
- **Pruebas:** 301 pruebas automáticas del backend.

| Documento oficial | Ruta |
| --- | --- |
| Mapa del núcleo: patrones, trazabilidad y JWT | `docs/fase2/README.md` |
| Especificación OpenAPI | `docs/fase2/openapi.json` (en vivo: `https://158-158-107-192.sslip.io/api/docs`) |
| Scripts de base de datos | `database/01_schema.sql`, `02_seed.sql`, `03_constraints.sql` (explicados en `database/README.md`) |
| Código | `backend/src/` y `frontend/src/` |

---

## Fase 3: Automatización conversacional (chatbot)

**Qué pedía la actividad:** un chat integrado en la interfaz y conectado al backend, hecho con reglas o
con IA.

**Qué hicimos, en simple:**
- Elegimos **reglas** en lugar de IA: las preguntas típicas («¿dónde está mi pedido?», «¿cuánto stock
  tengo?») se responden mejor consultando la base de datos, sin costo, sin claves externas y con
  pruebas que siempre dan el mismo resultado.
- **Cómo piensa:** limpia el mensaje (minúsculas, sin tildes), busca palabras clave, da puntos a cada
  intención y responde con la que más puntos saque. Hay **20 intenciones** repartidas por rol.
- **Seguridad:** cada usuario solo ve sus propios datos, porque el bot usa la identidad del token, no
  lo que la persona escriba.
- Ruta `POST /api/chat`, con un límite de 60 mensajes por minuto. En la web aparece como un panel
  flotante.

| Documento oficial | Ruta |
| --- | --- |
| Documento del asistente, con guion de demostración | `docs/Fase3_Chatbot.md` |
| Código | `backend/src/chat/` y `frontend/src/components/ChatWidget.jsx` |

---

## Fase 4: Aseguramiento de calidad

**Qué pedía la actividad:** pruebas de rendimiento, seguridad (OWASP) y usabilidad, con un informe de
métricas, gráficos y un plan de mitigación.

**Qué hicimos, en simple:**
- **Rendimiento:** pruebas de carga con **k6** (escenarios REN-01 a REN-06) y gráficos de los tiempos
  de respuesta.
- **Seguridad:** **179 pruebas** basadas en OWASP: tokens falsos o vencidos, acceso a datos de otra
  tienda, entradas maliciosas y límites de intentos. Lo que encontramos lo corregimos (por ejemplo, la
  API ya no arranca sin un secreto JWT fuerte).
- **Usabilidad:** revisión con las heurísticas de Nielsen: **15 hallazgos**, de los cuales corregimos
  13, uno quedó parcial y uno pendiente.
- **Plan de mitigación:** cada problema tiene su causa, su corrección y su estado. Lo que no se alcanzó
  (escaneo con ZAP, encuesta SUS con usuarios reales y una prueba de carga larga) quedó declarado como
  trabajo futuro.

| Documento oficial | Ruta |
| --- | --- |
| Informe de aseguramiento de calidad (v1.1) | `docs/fase4/Informe_Aseguramiento_Calidad.pdf` (y `.docx`) |
| Gráficos | `docs/fase4/graficos/` |
| Guía técnica de las pruebas | `docs/Fase4_Calidad.md` |

---

## Fase 5: Despliegue y validación final

**Qué pedía la actividad:** el software desplegado en contenedores y en la nube, pruebas End-to-End, un
manual técnico, un manual de usuario y la defensa.

**Qué hicimos, en simple:**
- **Docker:** todo corre en contenedores (base de datos, API, web y Mailpit) con un solo comando.
- **Nube:** está publicado en una máquina virtual de **Azure** con HTTPS automático (Caddy).
  - Web: `https://158-158-107-192.sslip.io`
  - Swagger: `https://158-158-107-192.sslip.io/api/docs`
  - Correos de prueba (Mailpit, pide usuario y clave): `https://correo.158-158-107-192.sslip.io`
- **Pruebas End-to-End:** 33 pruebas que recorren el sistema completo como lo haría un usuario
  (10 criterios de aceptación, CA-01 a CA-10). Las 33 pasaron contra Azure.
- **Manuales y presentación:** el técnico explica cómo instalar y desplegar; el de usuario explica cómo
  usar la web; la presentación es la de la defensa.

**Recordatorios para la defensa:**
1. Encender la máquina virtual de Azure antes, si está apagada.
2. Crear un pedido justo antes de mostrar Mailpit, porque borra los correos al reiniciarse.
3. Apagar la máquina virtual al terminar, para no gastar crédito.

| Documento oficial | Ruta |
| --- | --- |
| Manual técnico (v1.1) | `docs/fase5/Manual_Tecnico.pdf` (y `.docx`) |
| Manual de usuario web | `docs/fase5/Manual_Usuario_Web.pdf` |
| Presentación de la defensa | `docs/fase5/Presentacion_Defensa.pdf` (fuente editable: `Presentacion_Defensa.html`) |
| Guías de despliegue | `docs/Fase5_Despliegue.md` (local) y `docs/fase5/Despliegue_Nube.md` (Azure) |

---

## Cómo se conectan las fases

Fase 1 dice **qué** construir y por qué → Fase 2 lo **construye** → Fase 3 le agrega el **asistente**
→ Fase 4 **mide y corrige** su calidad → Fase 5 lo **publica** y comprueba que todo funcione junto.
Cada requisito RF1–RF8 se puede seguir desde la Fase 1 hasta su código (Fase 2) y sus pruebas (Fases 4
y 5).
