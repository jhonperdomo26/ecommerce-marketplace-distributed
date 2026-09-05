// lib/main.dart
// Punto de entrada de la app móvil. Arranca en la pantalla de login; una vez
// autenticado, el token se pasa a MisPedidosScreen (código del Manual Técnico,
// Sección 5).
import 'package:flutter/material.dart';

import 'screens/login_screen.dart';

void main() {
  runApp(const MobileEcommerceApp());
}

class MobileEcommerceApp extends StatelessWidget {
  const MobileEcommerceApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Comercio Electrónico',
      theme: ThemeData(primarySwatch: Colors.blue),
      debugShowCheckedModeBanner: false,
      home: const LoginScreen(),
    );
  }
}
