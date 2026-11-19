# Fase 3 — Asistente virtual (chatbot por reglas)

Versión 1.1, 18 de noviembre de 2026. Autores: Jhon Jairo Perdomo Perdomo, Julián Andrés Silva Morales y
Juan Vidarte. Lo nuevo de la versión 1.1 va marcado con **(v1.1)**.

**Alcance de esta entrega (v1.1):** se entrega y valida el chat de la web (vendedor y administrador),
que cubre el requisito RF8 de la Fase 1. La pestaña de la app móvil existe en el repositorio, pero queda
fuera de esta entrega; las intenciones de cliente se prueban por la API.

Módulo de chat integrado en la web (vendedor y administrador) y en la app móvil
(cliente), con su lógica de negocio conectada al backend. Usa un **motor de
reglas deterministas** (árbol de decisión por intenciones), una de las dos
opciones que plantea la actividad; no depende de ninguna API externa de IA.

## Decisión de diseño

| Criterio | Reglas deterministas | API de IA |
| -------- | -------------------- | --------- |
| Respuesta sobre datos reales (estado de un pedido, stock) | Exacta: sale de una consulta a la base (TypeORM) **(v1.1)** | Requiere dar acceso a datos al modelo |
| Fuga de datos entre usuarios | Imposible por construcción (ver «Seguridad») | Hay que contenerla con instrucciones |
| Pruebas automatizadas | Deterministas y rápidas | No reproducibles |
| Costo y claves | Ninguno | Clave, cuota y red externa |
| Cobertura de preguntas | Solo las intenciones definidas | Abierta |

Se eligieron las reglas porque lo que más pregunta una persona en un marketplace
(«¿dónde está mi pedido?», «¿cuánto cuesta X?») es una consulta a datos propios.
La limitación (preguntas fuera de las intenciones) se trata en «Mejoras».

## Dónde vive en el código

| Archivo | Responsabilidad |
| ------- | --------------- |
| `backend/src/chat/tipos.ts` | Tipos y el contrato `ChatDatos` (acceso a datos) |
| `backend/src/chat/motor.ts` | Motor de reglas: normalización, intenciones, puntaje, respuestas |
| `backend/src/chat/datos.ts` | Implementación de `ChatDatos` sobre PostgreSQL con TypeORM **(v1.1)** |
| `backend/src/controllers/chat.controller.ts` | Valida la entrada y llama al motor con la identidad del token |
| `backend/src/routes/chat.routes.ts` | `POST /api/chat` con `verificarToken` y límite de tasa |
| `frontend/src/components/ChatWidget.jsx` | Panel de chat flotante (se muestra desde `Layout.jsx`) |
| `mobile/lib/screens/chat_screen.dart` | Pestaña «Asistente» de la app (en `home_screen.dart`) |
| `backend/test/chat.motor.test.ts`, `backend/test/chat.test.ts` | Pruebas unitarias y de integración |

## Cómo decide el motor

1. **Normaliza** el mensaje: minúsculas, sin tildes ni signos («¿Cómo dejo una
   Reseña?» → `como dejo una resena`).
2. **Extrae entidades**: un número de pedido (`#12`, `pedido 12`, `pedido número 12`).
3. **Puntúa** cada intención permitida para el rol: palabra suelta que coincide
   por prefijo = 1 punto, frase = 2, clave fuerte = 4. Un número de pedido suma 2
   a «estado del pedido».
4. **Elige** la de mayor puntaje (en empate, la primera de la lista). Solo
   compiten las intenciones del rol del token.
5. **Responde** consultando los datos del propio usuario o con un texto fijo
   (preguntas frecuentes). Sin coincidencias devuelve «no entendí» con el menú.

El servidor **no guarda estado**. Los flujos de varios pasos usan `opciones`: por
ejemplo, ante «estado de mi pedido» con varios pedidos, devuelve un botón por
pedido cuyo `valor` es `estado del pedido #12`; al pulsarlo, ese texto vuelve al
chat con toda la información que hace falta.

## API

`POST /api/chat` — cualquier usuario autenticado (`cliente`, `vendedor`, `administrador`).

```json
// petición
{ "mensaje": "¿cuál es el estado del pedido #1?" }

// respuesta 200
{
  "respuesta": "Pedido #1: Teclado mecánico (x2)\nEstado: pendiente\nFecha: 18/11/2026\nTu pedido quedó registrado y está a la espera de que la tienda lo procese.",
  "intencion": "estado_pedido",
  "opciones": [{ "texto": "Mis pedidos", "valor": "mis pedidos" }]
}
```

| Código | Cuándo |
| ------ | ------ |
| 400 | `mensaje` ausente, vacío, no es texto o supera 300 caracteres; también token inválido |
| 401 | Usuario desactivado o inexistente **(v1.1)** |
| 403 | Sin token |
| 429 | Más de 60 mensajes por minuto desde una IP (`CHAT_RATE_LIMIT` lo cambia) |
| 500 | Error interno (mensaje genérico, detalle solo en el log del servidor) |

## Intenciones por rol

**Todos los roles**

| Intención | Ejemplos de frase |
| --------- | ----------------- |
| `saludo` | «hola», «buenas tardes» (saluda por el primer nombre y muestra el menú del rol) |
| `ayuda` | «ayuda», «qué puedes hacer» |
| `despedida` | «gracias», «adiós» |
| `humano` | «quiero hablar con un asesor» (indica que el chat no conecta con personas) |
| `buscar_producto` | «¿cuánto cuesta el teclado?», «hay stock de monitor», «catálogo» **(v1.1: ejemplos con productos de la semilla)** |

**Cliente**

| Intención | Ejemplos de frase | Fuente |
| --------- | ----------------- | ------ |
| `estado_pedido` | «estado del pedido #1», «¿dónde está mi compra?» | Consulta (solo sus pedidos) |
| `mis_pedidos` | «mis pedidos», «mi historial» | Consulta (solo sus pedidos) |
| `como_comprar` | «¿cómo compro?» | Texto fijo |
| `como_resenar` | «quiero calificar mi compra» | Texto fijo |
| `estados_pedido` | «¿qué significa pendiente?» | Texto fijo |
| `pagos` | «¿cómo pago?» | Texto fijo |
| `envios` | «¿cuánto tarda el envío?» | Texto fijo |
| `cancelar` | «quiero cancelar mi pedido» | Texto fijo |

**Vendedor**

| Intención | Ejemplos de frase | Fuente |
| --------- | ----------------- | ------ |
| `pedidos_pendientes` | «pedidos pendientes», «cuántos pedidos tengo» | Conteo por estado de su tienda |
| `stock_bajo` | «stock bajo», «qué productos se me agotan» | Productos de su tienda con 5 unidades o menos |
| `resumen_resenas` | «resumen de reseñas», «mi calificación promedio» | Promedio y 3 reseñas recientes de su tienda |
| `como_estado` | «¿cómo cambio el estado de un pedido?» | Texto fijo |
| `como_producto` | «¿cómo creo un producto?» | Texto fijo |
| `estados_pedido` | «¿qué significa enviado?» | Texto fijo |

**Administrador**

| Intención | Ejemplos de frase | Fuente |
| --------- | ----------------- | ------ |
| `resumen_admin` | «resumen», «¿cuántos usuarios hay?» | Conteos globales |
| `como_admin` | «¿cómo creo una tienda?» | Texto fijo |

Los textos fijos describen lo que la plataforma hace **hoy**: por ejemplo, la
respuesta sobre pagos aclara que la app no cobra en línea y que la tienda
registra el pago, y la de cancelación que el cliente no puede cancelar por su
cuenta. Si se implementan esas funciones, hay que actualizar esos textos.

## Seguridad

- **Identidad del token, nunca del mensaje.** El controlador pasa `usuario_id`,
  `rol` y `tienda_id` del JWT al motor; cada consulta de `datos.ts` los usa en
  su `WHERE`. Aunque alguien escriba `pedido #99` de otro cliente, la consulta
  incluye `cliente_id = <su id>` y responde «no encontré».
- **Intenciones por rol.** Un cliente que escribe «stock bajo» o «resumen» no
  activa las intenciones de vendedor o administrador.
- **Inyección SQL.** Solo se usan consultas parametrizadas de TypeORM **(v1.1)**; además, el mensaje se
  normaliza y los términos de búsqueda quedan limitados a `[a-z0-9]`. Los
  comodines `%` y `_` se escapan en `LIKE`.
- **Entrada acotada**: máximo 300 caracteres, límite de 60 mensajes por minuto por
  IP, errores 500 genéricos (igual que el resto de la API).
- **Salida como texto.** La web y la app muestran la respuesta como texto plano
  (React y Flutter no interpretan HTML), así que un mensaje con `<script>` no se ejecuta.
- El asistente **solo lee** datos: ninguna intención crea, modifica o elimina nada.

## Cómo probarlo

Con el backend y la base corriendo (ver README raíz):

```bash
# 1) iniciar sesión como cliente y guardar el token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@correo.com","password":"Password123"}'

# 2) preguntar al asistente (reemplaza <TOKEN>)
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"mensaje":"mis pedidos"}'
```

- **Web:** inicia sesión como `vendedor1@tutienda.com` o `admin@tutienda.com` y
  pulsa **Asistente** (abajo a la derecha).
- **Guion para la demostración (v1.1)**, con los datos de la semilla:

  | Usuario | Mensaje | Qué responde |
  | ------- | ------- | ------------ |
  | `vendedor1@tutienda.com` | «hola» | Saludo y menú de vendedor |
  | `vendedor1@tutienda.com` | «pedidos pendientes» | Conteo por estado de su tienda (1 pendiente, 1 entregado) |
  | `vendedor1@tutienda.com` | «¿cuánto cuesta el teclado?» | Teclado mecánico, precio y stock |
  | `vendedor2@tutienda.com` | «stock bajo» | Escritorio, 5 unidades |
  | `admin@tutienda.com` | «resumen» | Conteos de tiendas, usuarios, productos y pedidos |
  | `admin@tutienda.com` | «mis pedidos» | «No entendí» y su menú: las intenciones de cliente no aplican a su rol |

  En la VM de Azure las contraseñas de la semilla se cambiaron: usar las nuevas.
- **App móvil:** inicia sesión como `cliente@correo.com` y abre la pestaña **Asistente**.
- **Pruebas automatizadas:** `cd backend && npm test` (necesita PostgreSQL, igual
  que el resto de la suite). Solo las del chat: `npm test -- chat`.

## Verificación (v1.1)

Corrida del 18 de noviembre de 2026 con PostgreSQL 16 y la semilla de demostración:

- `npm test -- chat`: 2 suites, 81 pruebas en verde (motor de reglas sin base y endpoint con base).
- Prueba en vivo de `POST /api/chat` con vendedor, administrador y cliente: cada mensaje del guion
  anterior devolvió la intención y los datos esperados.
- Trazabilidad: cubre el requisito RF8 de la especificación de la Fase 1 (v1.1).

## Relación con la arquitectura distribuida (Fase 1)

En la especificación de arquitectura (v1.1) el Asistente es uno de los **cinco
servicios**, sin base propia, que consulta a Pedidos, Catálogo e Identidad por REST. Aquí vive dentro del backend actual para
no adelantar la separación en servicios (Fase 2), pero ya está preparado:

- `motor.ts` no importa Express ni `pg`; solo depende de la interfaz `ChatDatos`.
- Para extraerlo basta crear un servicio con el mismo motor y una implementación
  de `ChatDatos` que llame por REST a Pedidos y Catálogo reenviando el JWT del
  usuario, en lugar de consultar la base directamente.

## Limitaciones y mejoras posibles

- **Sin memoria de conversación**: cada mensaje se interpreta por separado. Los
  botones de `opciones` cubren los flujos de varios pasos.
- **Solo reconoce las intenciones definidas.** Una mejora sencilla: ante
  `no_entendido`, delegar en un modelo de lenguaje restringido a las mismas
  funciones de `ChatDatos`.
- **No ejecuta acciones** (cancelar, cambiar estados, comprar): solo informa.
- El umbral de «stock bajo» (5 unidades) es una constante, `UMBRAL_STOCK_BAJO`
  en `motor.ts`.
