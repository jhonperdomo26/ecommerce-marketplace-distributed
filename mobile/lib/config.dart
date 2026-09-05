// lib/config.dart
// URL base de la API central.
//
// Manual Técnico, Paso 4, punto 5 ("Ajustar la dirección IP"):
//   - Emulador de Android : http://10.0.2.2:3000   (localhost del PC anfitrión)
//   - Dispositivo físico  : http://192.168.x.x:3000 (IP local de tu computador)
//   - Emulador de iOS     : http://localhost:3000
//
// Cambia este valor según dónde ejecutes la app.
class Config {
  static const String baseUrl = 'http://10.0.2.2:3000';
}
