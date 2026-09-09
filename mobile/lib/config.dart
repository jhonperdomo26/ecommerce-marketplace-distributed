// lib/config.dart
// URL base de la API central.
//
// Manual Técnico, Paso 4, punto 5 ("Ajustar la dirección IP"). Aquí la elección
// se hace automáticamente según dónde se ejecute la app:
//
//   - Emulador de Android : http://10.0.2.2:3000   (localhost del PC anfitrión)
//   - Web / Windows / iOS : http://localhost:3000
//   - Dispositivo físico  : cambiar manualmente por la IP local del PC
//                           (ej. http://192.168.1.5:3000)
import 'package:flutter/foundation.dart'
    show kIsWeb, defaultTargetPlatform, TargetPlatform;

class Config {
  static String get baseUrl {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }
}
