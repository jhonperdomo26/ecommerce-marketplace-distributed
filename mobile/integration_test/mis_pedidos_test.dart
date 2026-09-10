// integration_test/mis_pedidos_test.dart
//
// Versión automatizada de la "Prueba móvil (Flutter)" del Manual Técnico
// (Paso 5.1, punto 3): montar la pantalla de pedidos del cliente con un token
// real y comprobar que el ícono de carga NO gira indefinidamente, es decir, que
// la pantalla obtiene datos de la API central.
//
// Es una prueba de integración (hace HTTP real), así que se corre sobre un
// dispositivo. Requiere el backend en http://localhost:3000 y la BD con datos
// semilla (docker compose up -d + npm run dev). Ejecutar:
//
//   flutter test integration_test/mis_pedidos_test.dart -d windows
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:http/http.dart' as http;

import 'package:mobile_ecommerce/config.dart';
import 'package:mobile_ecommerce/sesion.dart';
import 'package:mobile_ecommerce/screens/mis_pedidos_screen.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const baseUrl = 'http://localhost:3000';

  setUpAll(() => Config.override = baseUrl);
  tearDownAll(() {
    Config.override = null;
    Sesion.cerrar();
  });

  testWidgets(
    'MisPedidosScreen carga los pedidos del cliente sin quedarse girando',
    (WidgetTester tester) async {
      // 1) Token real del cliente semilla (como haría el login de la app).
      final loginRes = await http.post(
        Uri.parse('$baseUrl/api/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'email': 'cliente@correo.com',
          'password': 'Password123',
        }),
      );
      expect(loginRes.statusCode, 200,
          reason: '¿Está corriendo el backend con datos semilla?');
      final data = json.decode(loginRes.body);
      Sesion.iniciar(data['token'], Map<String, dynamic>.from(data['usuario']));

      // 2) Montar la pantalla (equivale a MisPedidosScreen(userToken: ...)).
      await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: MisPedidosScreen())),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // 3) Esperar a que resuelva la petición HTTP real.
      await tester.pumpAndSettle(const Duration(seconds: 10));

      // El ícono de carga desapareció (no gira indefinidamente).
      expect(
        find.byType(CircularProgressIndicator),
        findsNothing,
        reason:
            'El indicador sigue girando: revisa Config.baseUrl / la IP del backend '
            '(Manual Técnico, Paso 4, punto 5).',
      );

      // Y se renderizó contenido: al menos un pedido (Card) o el aviso de lista vacía.
      final hayPedidos = find.byType(Card).evaluate().isNotEmpty;
      final listaVacia =
          find.text('Todavía no tienes pedidos.').evaluate().isNotEmpty;
      expect(hayPedidos || listaVacia, isTrue,
          reason: 'No se mostró ni un pedido ni el mensaje de lista vacía.');
    },
  );
}
