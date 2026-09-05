// lib/screens/mis_pedidos_screen.dart
// Código literal del Manual Técnico, Sección 5 (Aplicación Móvil Integrada).
// Única modificación: la URL se toma de Config.baseUrl en lugar de estar fija
// (Manual Técnico, Paso 4, punto 5).
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import '../config.dart';

class MisPedidosScreen extends StatefulWidget {
  final String userToken;
  const MisPedidosScreen({Key? key, required this.userToken}) : super(key: key);

  @override
  _MisPedidosScreenState createState() => _MisPedidosScreenState();
}

class _MisPedidosScreenState extends State<MisPedidosScreen> {
  List _pedidos = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchPedidos();
  }

  Future<void> _fetchPedidos() async {
    final url = Uri.parse('${Config.baseUrl}/api/pedidos/mios');
    try {
      final response = await http.get(url, headers: {
        'Authorization': 'Bearer ${widget.userToken}',
        'Content-Type': 'application/json',
      });

      if (response.statusCode == 200) {
        setState(() {
          _pedidos = json.decode(response.body);
          _isLoading = false;
        });
      }
    } catch (e) {
      print("Error de conexión externa: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis Pedidos'),
        backgroundColor: Colors.blueAccent,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _pedidos.length,
              itemBuilder: (context, index) {
                final pedido = _pedidos[index];
                return Card(
                  margin:
                      const EdgeInsets.symmetric(horizontal: 15, vertical: 8),
                  child: ListTile(
                    title: Text(pedido['producto_nombre'],
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('Cantidad: ${pedido['cantidad']}'),
                    trailing: Text(
                      pedido['estado'],
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: pedido['estado'] == 'entregado'
                            ? Colors.green
                            : Colors.orange,
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
