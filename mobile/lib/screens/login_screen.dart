// lib/screens/login_screen.dart
// Inicio de sesión: obtiene el JWT de /api/auth/login, lo guarda en Sesion y
// entra a HomeScreen (Catálogo + Mis Pedidos).
import 'package:flutter/material.dart';

import '../api.dart';
import '../sesion.dart';
import 'home_screen.dart';
import 'registro_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController(text: 'cliente@correo.com');
  final _passCtrl = TextEditingController(text: 'Password123');
  bool _cargando = false;
  String? _error;

  Future<void> _login() async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final data = await Api.post('/api/auth/login', {
        'email': _emailCtrl.text.trim(),
        'password': _passCtrl.text,
      });
      Sesion.iniciar(data['token'], Map<String, dynamic>.from(data['usuario']));
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
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
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Iniciar sesión'),
        backgroundColor: Colors.blueAccent,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: _emailCtrl,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _passCtrl,
              decoration: const InputDecoration(labelText: 'Contraseña'),
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
                onPressed: _cargando ? null : _login,
                child: Text(_cargando ? 'Entrando...' : 'Entrar'),
              ),
            ),
            TextButton(
              onPressed: _cargando
                  ? null
                  : () => Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => const RegistroScreen()),
                      ),
              child: const Text('¿Cliente nuevo? Crear cuenta'),
            ),
          ],
        ),
      ),
    );
  }
}
