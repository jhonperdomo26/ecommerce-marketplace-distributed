# App móvil — Flutter

Pantalla para que el cliente consulte sus pedidos consumiendo la misma API
central. Corresponde a la **Sección 5** y al **Paso 4** del Manual Técnico.

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
├── main.dart                      MaterialApp -> LoginScreen
├── config.dart                    Config.baseUrl (emulador / dispositivo)
└── screens/
    ├── login_screen.dart          Login -> obtiene el token de /api/auth/login
    └── mis_pedidos_screen.dart    Lista de pedidos (literal del Manual Técnico)
```

## Flujo

1. `LoginScreen` (precargado con `cliente@correo.com` / `Password123`) hace
   `POST /api/auth/login` y obtiene el JWT.
2. Navega a `MisPedidosScreen(userToken: token)`, que consume
   `GET /api/pedidos/mios` con `Authorization: Bearer <token>`.
