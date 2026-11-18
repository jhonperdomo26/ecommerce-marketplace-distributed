#!/usr/bin/env bash
# Prepara una máquina virtual Ubuntu (22.04 o 24.04) para el despliegue:
# instala Docker con Compose, agrega memoria de intercambio si la VM tiene poca RAM
# y abre los puertos 22, 80 y 443 en el firewall del sistema.
#   bash despliegue/preparar_vm.sh
set -euo pipefail

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo ">> Docker instalado. Cierre la sesión SSH y vuelva a entrar para usarlo sin sudo."
fi

# Compilar las imágenes (TypeScript, Vite) con menos de 3 GB de RAM puede quedarse sin memoria.
ram_mb=$(free -m | awk '/^Mem:/{print $2}')
if [ "$ram_mb" -lt 3000 ] && ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo ">> Se agregaron 2 GB de memoria de intercambio."
fi

if command -v ufw >/dev/null; then
  sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
  sudo ufw --force enable
fi

docker compose version || sudo docker compose version
echo ">> Listo. Recuerde abrir también 80 y 443 en el firewall o grupo de seguridad de la nube."
