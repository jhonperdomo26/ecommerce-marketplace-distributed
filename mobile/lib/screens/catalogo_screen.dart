// lib/screens/catalogo_screen.dart
// Catálogo de productos -> GET /api/productos. Al tocar un producto abre el
// detalle, donde el cliente puede comprar.
import 'package:flutter/material.dart';

import '../api.dart';
import 'producto_detalle_screen.dart';

class CatalogoScreen extends StatefulWidget {
  const CatalogoScreen({Key? key}) : super(key: key);

  @override
  State<CatalogoScreen> createState() => _CatalogoScreenState();
}

class _CatalogoScreenState extends State<CatalogoScreen> {
  List _productos = [];
  bool _cargando = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final data = await Api.get('/api/productos');
      setState(() {
        _productos = data;
        _cargando = false;
      });
    } catch (e) {
      setState(() {
        _error = '$e';
        _cargando = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_cargando) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(child: Text(_error!));
    }
    return RefreshIndicator(
      onRefresh: _cargar,
      child: ListView.builder(
        itemCount: _productos.length,
        itemBuilder: (context, index) {
          final p = _productos[index];
          final sinStock = (p['stock'] ?? 0) <= 0;
          return Card(
            margin: const EdgeInsets.symmetric(horizontal: 15, vertical: 6),
            child: ListTile(
              title: Text(p['nombre'],
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text(
                  '${p['tienda_nombre']}  ·  \$${p['precio']}  ·  stock: ${p['stock']}'),
              trailing: sinStock
                  ? const Text('Agotado',
                      style: TextStyle(color: Colors.red))
                  : const Icon(Icons.chevron_right),
              onTap: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ProductoDetalleScreen(producto: p),
                  ),
                );
                _cargar(); // refresca stock al volver
              },
            ),
          );
        },
      ),
    );
  }
}
