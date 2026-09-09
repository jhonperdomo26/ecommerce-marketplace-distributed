// lib/screens/producto_detalle_screen.dart
// Detalle de producto: datos, reseñas (GET /api/resenas/producto/:id) y compra
// (POST /api/pedidos con { producto_id, cantidad }).
import 'package:flutter/material.dart';

import '../api.dart';

class ProductoDetalleScreen extends StatefulWidget {
  final Map producto;
  const ProductoDetalleScreen({Key? key, required this.producto})
      : super(key: key);

  @override
  State<ProductoDetalleScreen> createState() => _ProductoDetalleScreenState();
}

class _ProductoDetalleScreenState extends State<ProductoDetalleScreen> {
  List _resenas = [];
  bool _cargandoResenas = true;
  int _cantidad = 1;
  bool _comprando = false;

  int get _stock => (widget.producto['stock'] ?? 0) as int;

  @override
  void initState() {
    super.initState();
    _cargarResenas();
  }

  Future<void> _cargarResenas() async {
    try {
      final data =
          await Api.get('/api/resenas/producto/${widget.producto['id']}');
      setState(() {
        _resenas = data;
        _cargandoResenas = false;
      });
    } catch (_) {
      setState(() => _cargandoResenas = false);
    }
  }

  Future<void> _comprar() async {
    setState(() => _comprando = true);
    try {
      await Api.post('/api/pedidos', {
        'producto_id': widget.producto['id'],
        'cantidad': _cantidad,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pedido creado. Míralo en "Mis Pedidos".')),
      );
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.mensaje)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _comprando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.producto;
    final promedio = _resenas.isEmpty
        ? null
        : (_resenas
                    .map((r) => double.parse('${r['calificacion']}'))
                    .reduce((a, b) => a + b) /
                _resenas.length)
            .toStringAsFixed(1);

    return Scaffold(
      appBar: AppBar(
        title: Text(p['nombre']),
        backgroundColor: Colors.blueAccent,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(p['nombre'],
              style:
                  const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text('${p['tienda_nombre']}', style: const TextStyle(color: Colors.grey)),
          const SizedBox(height: 12),
          Text('\$${p['precio']}',
              style: const TextStyle(fontSize: 20, color: Colors.green)),
          Text('Stock disponible: $_stock'),
          if (promedio != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('Calificación: $promedio ★ (${_resenas.length})'),
            ),
          const Divider(height: 32),

          // --- Compra ---
          Row(
            children: [
              const Text('Cantidad:'),
              IconButton(
                onPressed: _cantidad > 1
                    ? () => setState(() => _cantidad--)
                    : null,
                icon: const Icon(Icons.remove_circle_outline),
              ),
              Text('$_cantidad', style: const TextStyle(fontSize: 18)),
              IconButton(
                onPressed: _cantidad < _stock
                    ? () => setState(() => _cantidad++)
                    : null,
                icon: const Icon(Icons.add_circle_outline),
              ),
            ],
          ),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: (_stock <= 0 || _comprando) ? null : _comprar,
              icon: const Icon(Icons.shopping_cart_checkout),
              label: Text(_stock <= 0
                  ? 'Agotado'
                  : (_comprando ? 'Comprando...' : 'Comprar')),
            ),
          ),
          const Divider(height: 32),

          // --- Reseñas ---
          const Text('Reseñas',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          if (_cargandoResenas)
            const Center(child: CircularProgressIndicator())
          else if (_resenas.isEmpty)
            const Text('Este producto aún no tiene reseñas.',
                style: TextStyle(color: Colors.grey))
          else
            ..._resenas.map((r) => Card(
                  child: ListTile(
                    title: Text('${r['calificacion']} ★  ·  ${r['cliente_nombre']}'),
                    subtitle: Text(r['comentario'] ?? 'Sin comentario'),
                  ),
                )),
        ],
      ),
    );
  }
}
