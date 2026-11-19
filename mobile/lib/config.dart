// lib/config.dart
// URL base de la API central.
//
// Manual Técnico, Paso 4, punto 5 ("Ajustar la dirección IP"). Aquí la elección
// se hace automáticamente según dónde se ejecute la app:
//
//   - Emulador de Android : http://10.0.2.2:3000   (localhost del PC anfitrión)
//   - Web (navegador)     : el mismo origen desde el que se sirve la app. En Docker la app
//                           vive en /app/ del sitio y nginx reenvía /api a la API, así que
//                           no hace falta CORS. Se puede forzar otra URL al compilar con
//                           --dart-define=API_URL=https://...
//   - Windows / iOS       : http://localhost:3000
//   - Dispositivo físico  : cambiar manualmente por la IP local del PC
//                           (ej. http://192.168.1.5:3000)
import 'package:flutter/foundation.dart'
    show kIsWeb, defaultTargetPlatform, TargetPlatform;

class Config {
  /// Solo para pruebas: si se asigna, tiene prioridad sobre la detección de
  /// plataforma.
  static String? override;

  static String get baseUrl {
    if (override != null) return override!;
    if (kIsWeb) {
      const forzada = String.fromEnvironment('API_URL');
      return forzada.isNotEmpty ? forzada : Uri.base.origin;
    }
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }
}
