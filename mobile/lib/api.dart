// lib/api.dart
// Cliente HTTP mínimo para la API central. Añade la cabecera Authorization con
// el token de Sesion y resuelve la URL base con Config.baseUrl.
import 'dart:convert';
import 'package:http/http.dart' as http;

import 'config.dart';
import 'sesion.dart';

class ApiException implements Exception {
  final int statusCode;
  final String mensaje;
  ApiException(this.statusCode, this.mensaje);
  @override
  String toString() => mensaje;
}

class Api {
  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (Sesion.token != null) 'Authorization': 'Bearer ${Sesion.token}',
      };

  static Uri _uri(String path) => Uri.parse('${Config.baseUrl}$path');

  static dynamic _procesar(http.Response r) {
    final cuerpo = r.body.isEmpty ? null : json.decode(r.body);
    if (r.statusCode >= 200 && r.statusCode < 300) return cuerpo;
    final msg = (cuerpo is Map && cuerpo['mensaje'] != null)
        ? cuerpo['mensaje'] as String
        : 'Error ${r.statusCode}';
    throw ApiException(r.statusCode, msg);
  }

  static Future<dynamic> get(String path) async =>
      _procesar(await http.get(_uri(path), headers: _headers));

  static Future<dynamic> post(String path, Map<String, dynamic> body) async =>
      _procesar(await http.post(_uri(path),
          headers: _headers, body: json.encode(body)));
}
