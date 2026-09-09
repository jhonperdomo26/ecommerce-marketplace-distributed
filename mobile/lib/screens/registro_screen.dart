// lib/screens/registro_screen.dart
// Alta de cliente -> POST /api/auth/registro. Al crear la cuenta entra directo.
import 'package:flutter/material.dart';

import '../api.dart';
import '../sesion.dart';
import 'home_screen.dart';

class RegistroScreen extends StatefulWidget {
  const RegistroScreen({Key? key}) : super(key: key);

  @override
  State<RegistroScreen> createState() => _RegistroScreenState();
}

class _RegistroScreenState extends State<RegistroScreen> {
  final _nombreCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _cargando = false;
  String? _error;

  Future<void> _registrar() async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final data = await Api.post('/api/auth/registro', {
        'nombre': _nombreCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'password': _passCtrl.text,
      });
      Sesion.iniciar(data['token'], Map<String, dynamic>.from(data['usuario']));
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
        (route) => false,
      );
    } on ApiException catch (e) {
      setState(() => _error = e.mensaje);
    } catch (e) {
      setState(() => _error = 'Error de conexión con la API: $e');
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  void dispose() {
    _nombreCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Crear cuenta'),
        backgroundColor: Colors.blueAccent,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: _nombreCtrl,
              decoration: const InputDecoration(labelText: 'Nombre'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _emailCtrl,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _passCtrl,
              decoration:
                  const InputDecoration(labelText: 'Contraseña (mín. 6)'),
              obscureText: true,
            ),
            const SizedBox(height: 20),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _cargando ? null : _registrar,
                child: Text(_cargando ? 'Creando...' : 'Crear cuenta'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
