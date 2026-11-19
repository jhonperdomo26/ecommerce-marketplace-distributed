# Tienda del cliente: la app Flutter compilada para web y servida con nginx en /app/.
# El servicio "web" (nginx del panel) reenvía /app/ a este contenedor, así la app comparte
# origen con la API (/api) y no hace falta CORS. Las carpetas de plataforma no se versionan:
# `flutter create --platforms web` genera web/ dentro de la imagen.
FROM debian:bookworm-slim AS build
ARG FLUTTER_VERSION=3.50.0
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git xz-utils unzip \
 && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz" \
    | tar -xJ -C /opt \
 && git config --global --add safe.directory /opt/flutter
ENV PATH=/opt/flutter/bin:$PATH
RUN flutter --disable-analytics >/dev/null 2>&1 || true \
 && flutter config --no-cli-animations \
 && flutter precache --web
WORKDIR /src
COPY pubspec.yaml analysis_options.yaml ./
COPY lib ./lib
# --base-href /app/ : la app vive bajo /app/ del sitio.
# --no-web-resources-cdn : CanvasKit va dentro de la imagen (no se descarga de gstatic.com).
RUN flutter create --platforms web --project-name mobile_ecommerce . >/dev/null \
 && rm -rf test \
 && flutter pub get \
 && flutter build web --release --base-href /app/ --no-web-resources-cdn --no-wasm-dry-run

FROM nginx:1.27-alpine AS runtime
COPY nginx.web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/build/web /usr/share/nginx/html/app
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1/app/ >/dev/null || exit 1
