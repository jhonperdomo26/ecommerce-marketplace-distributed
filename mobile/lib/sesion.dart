// lib/sesion.dart
// Sesión en memoria: guarda el token JWT y el usuario tras el login, para no
// encadenar el token por constructor en cada pantalla nueva.
class Sesion {
  static String? token;
  static Map<String, dynamic>? usuario;

  static void iniciar(String tokenJwt, Map<String, dynamic> datosUsuario) {
    token = tokenJwt;
    usuario = datosUsuario;
  }

  static void cerrar() {
    token = null;
    usuario = null;
  }

  static bool get autenticado => token != null;
}
