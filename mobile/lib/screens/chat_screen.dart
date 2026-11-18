// lib/screens/chat_screen.dart
// Asistente virtual (Fase 3) para el cliente. Habla con POST /api/chat; el
// servidor no guarda estado, así que cada respuesta trae «opciones» (botones de
// respuesta rápida) cuyo `valor` se reenvía al pulsarlas.
import 'package:flutter/material.dart';

import '../api.dart';

const int _maxLongitud = 300; // mismo límite que valida el backend

class MensajeChat {
  final bool esMio;
  final String texto;
  final bool error;
  const MensajeChat({required this.esMio, required this.texto, this.error = false});
}

class OpcionChat {
  final String texto;
  final String valor;
  const OpcionChat({required this.texto, required this.valor});
}

/// Conversación en memoria. HomeScreen reconstruye la pantalla al cambiar de
/// pestaña, así que el historial vive fuera del State; se limpia al cerrar sesión.
class ChatHistorial {
  static final List<MensajeChat> mensajes = [];
  static List<OpcionChat> opciones = [];
  static bool iniciado = false;

  static void limpiar() {
    mensajes.clear();
    opciones = [];
    iniciado = false;
  }
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({Key? key}) : super(key: key);

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controlador = TextEditingController();
  final _scroll = ScrollController();
  bool _enviando = false;

  @override
  void initState() {
    super.initState();
    if (!ChatHistorial.iniciado) {
      ChatHistorial.iniciado = true;
      // El saludo trae el menú de opciones según el rol. Se difiere al primer
      // frame para no llamar a setState dentro de initState.
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _enviar('hola', mostrar: false));
    } else {
      _bajar();
    }
  }

  @override
  void dispose() {
    _controlador.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _bajar() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // `valor` es lo que se envía al servidor; `textoVisible` lo que se muestra como
  // mensaje propio (por defecto el mismo `valor`).
  Future<void> _enviar(String valor,
      {String? textoVisible, bool mostrar = true}) async {
    final contenido = valor.trim();
    if (contenido.isEmpty || _enviando) return;

    if (mostrar) {
      ChatHistorial.mensajes
          .add(MensajeChat(esMio: true, texto: textoVisible ?? contenido));
    }
    ChatHistorial.opciones = [];
    if (mounted) setState(() => _enviando = true);
    _bajar();

    try {
      final data = await Api.post('/api/chat', {'mensaje': contenido});
      ChatHistorial.mensajes
          .add(MensajeChat(esMio: false, texto: data['respuesta'] as String));
      ChatHistorial.opciones = ((data['opciones'] ?? []) as List)
          .map((o) => OpcionChat(
                texto: o['texto'] as String,
                valor: o['valor'] as String,
              ))
          .toList();
    } catch (e) {
      ChatHistorial.mensajes.add(
          MensajeChat(esMio: false, texto: 'No pude responder: $e', error: true));
    }

    if (!mounted) return; // la persona cambió de pestaña: el historial ya se guardó
    setState(() => _enviando = false);
    _bajar();
  }

  void _enviarEscrito() {
    final t = _controlador.text;
    _controlador.clear();
    _enviar(t);
  }

  Widget _burbuja(MensajeChat m) {
    final colorFondo = m.esMio
        ? Colors.blue.shade600
        : (m.error ? Colors.red.shade50 : Colors.grey.shade200);
    final colorTexto = m.esMio
        ? Colors.white
        : (m.error ? Colors.red.shade800 : Colors.black87);
    return Align(
      alignment: m.esMio ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: colorFondo,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(m.texto, style: TextStyle(color: colorTexto)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            controller: _scroll,
            padding: const EdgeInsets.all(12),
            children: [
              for (final m in ChatHistorial.mensajes) _burbuja(m),
              if (_enviando)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 4),
                  child: Text('Escribiendo…',
                      style: TextStyle(color: Colors.grey, fontSize: 12)),
                ),
              if (ChatHistorial.opciones.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      for (final o in ChatHistorial.opciones)
                        ActionChip(
                          label: Text(o.texto),
                          onPressed: () => _enviar(o.valor, textoVisible: o.texto),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const Divider(height: 1),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controlador,
                    maxLength: _maxLongitud,
                    buildCounter: (context,
                            {required currentLength,
                            required isFocused,
                            required maxLength}) =>
                        null,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _enviarEscrito(),
                    decoration: const InputDecoration(
                      hintText: 'Escribe tu pregunta…',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: _enviando ? null : _enviarEscrito,
                  icon: const Icon(Icons.send),
                  tooltip: 'Enviar',
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
