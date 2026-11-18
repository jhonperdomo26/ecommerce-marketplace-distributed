# App móvil — Flutter

App del **cliente**, que consume la misma API central. Corresponde a la
**Sección 5** y al **Paso 4** del Manual Técnico, ampliada con catálogo, compra y
reseñas.

## Requisitos

- SDK de Flutter (3.x) y un emulador configurado (Android Studio o Xcode)
- El backend en ejecución

## Puesta en marcha

Este directorio contiene solo el código fuente (`lib/`) y `pubspec.yaml`. Las
carpetas de plataforma (`android/`, `ios/`, …) se generan localmente:

```bash
cd mobile
flutter create .        # regenera android/, ios/, etc. sin tocar lib/ ni pubspec.yaml
flutter pub get
flutter run
```

## Configurar la dirección de la API (¡importante!)

Edita `lib/config.dart` → `Config.baseUrl` según dónde ejecutes la app
(Manual Técnico, Paso 4, punto 5):

| Entorno              | baseUrl                     |
| -------------------- | --------------------------- |
| Emulador de Android  | `http://10.0.2.2:3000`      |
| Emulador de iOS      | `http://localhost:3000`     |
| Dispositivo físico   | `http://192.168.x.x:3000` (IP local del PC) |

Valor por defecto: `http://10.0.2.2:3000` (emulador de Android).

## Estructura

```
lib/
├── main.dart                          MaterialApp -> LoginScreen
├── config.dart                        Config.baseUrl (emulador / dispositivo)
├── sesion.dart                        Sesion.token / Sesion.usuario (en memoria)
├── api.dart                           Api.get / Api.post con Authorization
└── screens/
    ├── login_screen.dart              Login -> Sesion -> HomeScreen
    ├── registro_screen.dart           Alta de cliente (POST /api/auth/registro)
    ├── home_screen.dart               BottomNavigationBar: Catálogo | Mis Pedidos | Asistente
    ├── catalogo_screen.dart           GET /api/productos
    ├── producto_detalle_screen.dart   Detalle + reseñas + Comprar (POST /api/pedidos)
    ├── mis_pedidos_screen.dart        GET /api/pedidos/mios + Calificar (POST /api/resenas)
    └── chat_screen.dart               Asistente virtual (POST /api/chat) con respuestas rápidas
```

## Flujo

1. `LoginScreen` (precargado con `cliente@correo.com` / `Password123`, o
   `RegistroScreen` para una cuenta nueva) obtiene el JWT y lo guarda en `Sesion`.
2. `HomeScreen` con tres pestañas:
   - **Catálogo** → tocar un producto → **Comprar** (descuenta stock).
   - **Mis Pedidos** → sobre un pedido `entregado`, **Calificar** (1–5 ★ + comentario).
   - **Asistente** → chat para consultar el estado de un pedido, buscar productos y resolver dudas (ver [`../docs/Fase3_Chatbot.md`](../docs/Fase3_Chatbot.md)).

## Prueba de integración

`integration_test/mis_pedidos_test.dart` es la versión automatizada de la
"Prueba móvil (Flutter)" del Manual Técnico (Paso 5.1, punto 3): monta
`MisPedidosScreen` con un token real y verifica que el indicador de carga
desaparece (no "gira indefinidamente") y que la lista se renderiza.

Necesita el backend en `http://localhost:3000` y la BD con datos semilla:

```bash
flutter test integration_test/mis_pedidos_test.dart -d windows
```
