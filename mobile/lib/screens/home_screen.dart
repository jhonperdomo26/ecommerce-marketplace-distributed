// lib/screens/home_screen.dart
// Contenedor con BottomNavigationBar: Catálogo, Mis Pedidos y Asistente (chat).
import 'package:flutter/material.dart';

import '../sesion.dart';
import 'catalogo_screen.dart';
import 'chat_screen.dart';
import 'mis_pedidos_screen.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _indice = 0;

  final _pantallas = const [
    CatalogoScreen(),
    MisPedidosScreen(),
    ChatScreen(),
  ];

  static const _titulos = ['Catálogo', 'Mis Pedidos', 'Asistente'];

  void _cerrarSesion() {
    Sesion.cerrar();
    ChatHistorial.limpiar();
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_titulos[_indice]),
        backgroundColor: Colors.blueAccent,
        actions: [
          IconButton(
            onPressed: _cerrarSesion,
            icon: const Icon(Icons.logout),
            tooltip: 'Cerrar sesión',
          ),
        ],
      ),
      body: _pantallas[_indice],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _indice,
        onTap: (i) => setState(() => _indice = i),
        items: const [
          BottomNavigationBarItem(
              icon: Icon(Icons.storefront), label: 'Catálogo'),
          BottomNavigationBarItem(
              icon: Icon(Icons.receipt_long), label: 'Mis Pedidos'),
          BottomNavigationBarItem(
              icon: Icon(Icons.chat_bubble_outline), label: 'Asistente'),
        ],
      ),
    );
  }
}
