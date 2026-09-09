// lib/screens/mis_pedidos_screen.dart
// Basado en el código del Manual Técnico, Sección 5 (Aplicación Móvil Integrada).
// Adaptaciones: el token sale de Sesion (vía Api), va dentro del HomeScreen (sin
// Scaffold propio), y sobre los pedidos "entregado" sin reseña ofrece "Calificar"
// (POST /api/resenas).
import 'package:flutter/material.dart';

import '../api.dart';

class MisPedidosScreen extends StatefulWidget {
  const MisPedidosScreen({Key? key}) : super(key: key);

  @override
  State<MisPedidosScreen> createState() => _MisPedidosScreenState();
}

class _MisPedidosScreenState extends State<MisPedidosScreen> {
  List _pedidos = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchPedidos();
  }

  Future<void> _fetchPedidos() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final data = await Api.get('/api/pedidos/mios');
      setState(() {
        _pedidos = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = '$e';
        _isLoading = false;
      });
    }
  }

  Future<void> _calificar(Map pedido) async {
    final resultado = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _DialogoResena(productoNombre: pedido['producto_nombre']),
    );
    if (resultado == null) return;
    try {
      await Api.post('/api/resenas', {
        'pedido_id': pedido['id'],
        'calificacion': resultado['calificacion'],
        'comentario': resultado['comentario'],
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('¡Gracias por tu reseña!')));
      _fetchPedidos();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(child: Text(_error!));
    }
    return RefreshIndicator(
      onRefresh: _fetchPedidos,
      child: _pedidos.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 80),
                Center(child: Text('Todavía no tienes pedidos.')),
              ],
            )
          : ListView.builder(
              itemCount: _pedidos.length,
              itemBuilder: (context, index) {
                final pedido = _pedidos[index];
                final entregado = pedido['estado'] == 'entregado';
                final tieneResena = pedido['tiene_resena'] == true;
                return Card(
                  margin:
                      const EdgeInsets.symmetric(horizontal: 15, vertical: 8),
                  child: ListTile(
                    title: Text(pedido['producto_nombre'],
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('Cantidad: ${pedido['cantidad']}'),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          pedido['estado'],
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: entregado ? Colors.green : Colors.orange,
                          ),
                        ),
                        if (entregado && !tieneResena)
                          TextButton(
                            onPressed: () => _calificar(pedido),
                            child: const Text('Calificar'),
                          ),
                        if (entregado && tieneResena)
                          const Text('Reseñada',
                              style: TextStyle(
                                  fontSize: 11, color: Colors.grey)),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}

// Diálogo de reseña: estrellas 1-5 + comentario opcional.
class _DialogoResena extends StatefulWidget {
  final String productoNombre;
  const _DialogoResena({required this.productoNombre});

  @override
  State<_DialogoResena> createState() => _DialogoResenaState();
}

class _DialogoResenaState extends State<_DialogoResena> {
  int _estrellas = 5;
  final _comentarioCtrl = TextEditingController();

  @override
  void dispose() {
    _comentarioCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Calificar: ${widget.productoNombre}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (i) {
              final valor = i + 1;
              return IconButton(
                icon: Icon(
                  valor <= _estrellas ? Icons.star : Icons.star_border,
                  color: Colors.amber,
                ),
                onPressed: () => setState(() => _estrellas = valor),
              );
            }),
          ),
          TextField(
            controller: _comentarioCtrl,
            decoration: const InputDecoration(
              labelText: 'Comentario (opcional)',
            ),
            maxLength: 300,
            maxLines: 2,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop({
            'calificacion': _estrellas,
            'comentario': _comentarioCtrl.text.trim(),
          }),
          child: const Text('Enviar'),
        ),
      ],
    );
  }
}
