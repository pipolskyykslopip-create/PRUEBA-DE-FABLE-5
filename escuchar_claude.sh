#!/usr/bin/env bash
# Lanzador para Linux (Lubuntu, Ubuntu, Debian…). La primera vez instala todo solo.
cd "$(dirname "$0")"

faltan=""
for paq in espeak-ng xclip python3-venv libportaudio2; do
  dpkg -s "$paq" >/dev/null 2>&1 || faltan="$faltan $paq"
done
if [ -n "$faltan" ]; then
  echo "Instalando paquetes del sistema:$faltan (te va a pedir tu contraseña)"
  sudo apt-get install -y $faltan || { echo "No pude instalar los paquetes."; read -rp "Enter para cerrar."; exit 1; }
fi

if [ ! -x .venv/bin/python ]; then
  echo "Creando el entorno de Python e instalando librerías (solo la primera vez)…"
  python3 -m venv .venv && .venv/bin/pip install --quiet -r requirements.txt \
    || { echo "Falló la instalación de las librerías."; read -rp "Enter para cerrar."; exit 1; }
fi

.venv/bin/python escuchar_claude.py "$@"
