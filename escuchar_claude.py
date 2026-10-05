#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
escuchar_claude.py — Escuchá lo que responde Claude y dictale con tu voz.

Funciona junto a la app de Claude (claude.ai o la app de escritorio), sin API
key y sin pagar nada:

  1. Vigila el portapapeles. Cuando apretás "Copiar" en una respuesta de
     Claude, el programa la lee en voz alta con la voz del sistema.
  2. Con un atajo (Ctrl+Alt+H) grabás tu voz, se transcribe sin internet
     (Vosk) y el texto se pega en la caja de chat de Claude.

Uso rápido:
    python escuchar_claude.py             # arranca el lector
    python escuchar_claude.py --ayuda     # todas las opciones

Teclas en la terminal (escribí la letra y apretá Enter):
    Enter   detener la lectura actual
    r       repetir la última respuesta
    h       empezar / terminar el dictado por micrófono
    +  /  - leer más rápido / más despacio
    v       listar las voces instaladas
    p       pausar / reanudar la vigilancia del portapapeles
    q       salir

Atajos globales (funcionan aunque la terminal no esté enfocada):
    Ctrl+Alt+S   detener la lectura
    Ctrl+Alt+R   repetir la última respuesta
    Ctrl+Alt+H   empezar / terminar el dictado
"""

import argparse
import base64
import io
import json
import os
import platform
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import zipfile

SISTEMA = platform.system()  # "Windows", "Darwin" (macOS) o "Linux"
CARPETA = os.path.dirname(os.path.abspath(__file__))

# Modelo de reconocimiento de voz en español, gratuito y sin conexión (~40 MB).
MODELO_NOMBRE = "vosk-model-small-es-0.42"
MODELO_URL = f"https://alphacephei.com/vosk/models/{MODELO_NOMBRE}.zip"
MODELO_DIR = os.path.join(CARPETA, "modelos", MODELO_NOMBRE)

ATAJO_DETENER = "<ctrl>+<alt>+s"
ATAJO_REPETIR = "<ctrl>+<alt>+r"
ATAJO_DICTAR = "<ctrl>+<alt>+h"


def log(mensaje):
    """Imprime un mensaje con hora, sin romper la línea donde el usuario escribe."""
    hora = time.strftime("%H:%M:%S")
    print(f"\r[{hora}] {mensaje}")
    print("> ", end="", flush=True)


# ---------------------------------------------------------------------------
# Limpieza del texto: Claude escribe en Markdown y eso suena horrible leído tal cual.
# ---------------------------------------------------------------------------

def limpiar_markdown(texto, leer_codigo=False):
    """Convierte Markdown en texto plano agradable de escuchar."""
    t = texto.replace("\r\n", "\n")

    if leer_codigo:
        t = re.sub(r"```[^\n]*\n(.*?)```", r"\1", t, flags=re.S)
    else:
        t = re.sub(r"```.*?```", "\nBloque de código omitido.\n", t, flags=re.S)

    t = re.sub(r"`([^`\n]*)`", r"\1", t)                       # código en línea
    t = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", t)             # imágenes
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)              # enlaces [texto](url)
    t = re.sub(r"https?://\S+", "enlace", t)                    # URLs sueltas
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)         # títulos
    t = re.sub(r"^\s*[-*+]\s+", "", t, flags=re.M)              # viñetas
    t = re.sub(r"^\s*\d+[.)]\s+", "", t, flags=re.M)            # listas numeradas
    t = re.sub(r"^\s*>\s?", "", t, flags=re.M)                  # citas
    t = re.sub(r"^\s*[-*_]{3,}\s*$", "", t, flags=re.M)         # líneas separadoras
    t = re.sub(r"^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-*:?\s*\|?\s*$", "", t, flags=re.M)  # separador de tablas
    t = re.sub(r"^[ \t]*\|[ \t]*|[ \t]*\|[ \t]*$", "", t, flags=re.M)  # barras al inicio y fin de filas
    t = re.sub(r"[ \t]*\|[ \t]*", ", ", t)                      # celdas de tablas
    t = re.sub(r"(\*\*|__)(.+?)\1", r"\2", t, flags=re.S)       # negrita
    t = re.sub(r"(?<![\w*])[*_]([^*_\n]+?)[*_](?![\w*])", r"\1", t)  # cursiva
    t = re.sub(r"[ \t]+", " ", t)
    # Un punto al final de cada línea sin puntuación, para que la voz haga una pausa.
    t = re.sub(r"(?<=[^\s.,;:!?¿¡])[ \t]*$", ".", t, flags=re.M)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


# ---------------------------------------------------------------------------
# Voz: usa lo que ya trae el sistema operativo, sin instalar nada.
#   Windows -> System.Speech (SAPI) vía PowerShell
#   macOS   -> comando `say`
#   Linux   -> espeak-ng / espeak
# ---------------------------------------------------------------------------

class Voz:
    def __init__(self, velocidad=0, nombre_voz=None):
        self.velocidad = max(-10, min(10, velocidad))  # -10 (lento) .. 10 (rápido)
        self.nombre_voz = nombre_voz
        self.proceso = None
        self.ultimo_texto = ""
        self._lock = threading.Lock()
        self._comprobar_disponible()

    # ---- disponibilidad -------------------------------------------------

    def _comprobar_disponible(self):
        if SISTEMA == "Windows":
            self.binario = shutil.which("powershell") or shutil.which("powershell.exe")
            if not self.binario:
                raise SystemExit("No encuentro PowerShell, que viene con Windows. Revisá tu instalación.")
        elif SISTEMA == "Darwin":
            self.binario = shutil.which("say")
            if not self.binario:
                raise SystemExit("No encuentro el comando `say` de macOS.")
            if not self.nombre_voz:
                self.nombre_voz = self._voz_es_macos()
        else:
            self.binario = shutil.which("espeak-ng") or shutil.which("espeak")
            if not self.binario:
                raise SystemExit(
                    "Falta espeak-ng. Instalalo con:\n"
                    "   sudo apt install espeak-ng      (Debian/Ubuntu)\n"
                    "   sudo dnf install espeak-ng      (Fedora)"
                )

    def _voz_es_macos(self):
        try:
            salida = subprocess.run([self.binario, "-v", "?"], capture_output=True, text=True).stdout
        except Exception:
            return None
        for linea in salida.splitlines():
            if " es_" in linea:
                return linea.split()[0]
        return None

    # ---- construcción del comando ---------------------------------------

    def _palabras_por_minuto(self):
        return 175 + self.velocidad * 15

    def _comando(self):
        if SISTEMA == "Windows":
            voz = (self.nombre_voz or "").replace("'", "''")
            script = f"""
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = {self.velocidad}
if ('{voz}' -ne '') {{
    try {{ $s.SelectVoice('{voz}') }} catch {{ Write-Error "No existe la voz '{voz}'" }}
}} else {{
    $es = $s.GetInstalledVoices() | Where-Object {{ $_.VoiceInfo.Culture.Name -like 'es*' }} | Select-Object -First 1
    if ($es) {{ $s.SelectVoice($es.VoiceInfo.Name) }}
}}
$t = [Console]::In.ReadToEnd()
$s.Speak($t)
"""
            codificado = base64.b64encode(script.encode("utf-16-le")).decode("ascii")
            return [self.binario, "-NoProfile", "-NonInteractive", "-EncodedCommand", codificado]

        if SISTEMA == "Darwin":
            cmd = [self.binario, "-r", str(self._palabras_por_minuto())]
            if self.nombre_voz:
                cmd += ["-v", self.nombre_voz]
            return cmd

        # "es-419" es español latinoamericano; con --voz es se usa el de España.
        cmd = [self.binario, "-v", self.nombre_voz or "es-419", "-s", str(self._palabras_por_minuto()), "--stdin"]
        return cmd

    # ---- acciones -------------------------------------------------------

    def hablando(self):
        return self.proceso is not None and self.proceso.poll() is None

    def detener(self):
        with self._lock:
            if self.hablando():
                try:
                    self.proceso.kill()
                except Exception:
                    pass
            self.proceso = None

    def decir(self, texto):
        """Lee el texto en voz alta en segundo plano. Interrumpe lo que se esté leyendo."""
        self.detener()
        self.ultimo_texto = texto
        if not texto.strip():
            return
        with self._lock:
            self.proceso = subprocess.Popen(
                self._comando(),
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
            proceso = self.proceso

        def alimentar():
            try:
                proceso.stdin.write(texto.encode("utf-8"))
                proceso.stdin.close()
                _, err = proceso.communicate()
                if proceso.returncode not in (0, None) and err and self.proceso is proceso:
                    log("Problema con la voz: " + err.decode("utf-8", "ignore").strip()[:300])
            except Exception:
                pass

        threading.Thread(target=alimentar, daemon=True).start()

    def repetir(self):
        if self.ultimo_texto:
            self.decir(self.ultimo_texto)
        else:
            log("Todavía no leí nada.")

    def cambiar_velocidad(self, delta):
        self.velocidad = max(-10, min(10, self.velocidad + delta))
        log(f"Velocidad: {self.velocidad:+d} (de -10 a +10)")

    def listar_voces(self):
        if SISTEMA == "Windows":
            script = (
                "Add-Type -AssemblyName System.Speech; "
                "(New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | "
                "ForEach-Object { $_.VoiceInfo.Name + '  [' + $_.VoiceInfo.Culture.Name + ']' }"
            )
            codificado = base64.b64encode(script.encode("utf-16-le")).decode("ascii")
            cmd = [self.binario, "-NoProfile", "-EncodedCommand", codificado]
        elif SISTEMA == "Darwin":
            cmd = [self.binario, "-v", "?"]
        else:
            cmd = [self.binario, "--voices=es"]
        salida = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore").stdout
        print("\nVoces instaladas:")
        print(salida.strip() or "(no encontré ninguna)")
        if SISTEMA == "Windows" and "[es" not in salida:
            print(
                "\nNo hay voces en español. Para agregar una:\n"
                "  Configuración > Hora e idioma > Idioma y región > Agregar un idioma > Español\n"
                "  y marcá la casilla 'Texto a voz'. Después reiniciá este programa."
            )
        print("Usá  --voz \"Nombre\"  para elegir una.\n")


# ---------------------------------------------------------------------------
# Portapapeles: cada texto nuevo que copies se lee en voz alta.
# ---------------------------------------------------------------------------

class VigilantePortapapeles(threading.Thread):
    def __init__(self, voz, leer_codigo=False, minimo=1):
        super().__init__(daemon=True)
        import pyperclip  # se importa acá para dar un mensaje claro si falta
        self.pyperclip = pyperclip
        self.voz = voz
        self.leer_codigo = leer_codigo
        self.minimo = minimo
        self.pausado = False
        self.ignorar = None  # texto que pusimos nosotros en el portapapeles (dictado)
        try:
            self.anterior = pyperclip.paste()
        except Exception:
            self.anterior = ""

    def poner(self, texto):
        """Pone texto en el portapapeles sin que después se lea en voz alta."""
        self.ignorar = texto
        self.anterior = texto
        self.pyperclip.copy(texto)

    def run(self):
        while True:
            time.sleep(0.4)
            if self.pausado:
                continue
            try:
                actual = self.pyperclip.paste()
            except Exception:
                continue
            if not isinstance(actual, str) or actual == self.anterior:
                continue
            self.anterior = actual
            if actual == self.ignorar:
                continue
            texto = limpiar_markdown(actual, self.leer_codigo)
            if len(texto) < self.minimo:
                continue
            resumen = texto[:70].replace("\n", " ")
            log(f"Leyendo ({len(texto)} letras): {resumen}{'…' if len(texto) > 70 else ''}")
            self.voz.decir(texto)


# ---------------------------------------------------------------------------
# Dictado: micrófono -> texto, sin internet, con Vosk.
# ---------------------------------------------------------------------------

class Dictado:
    def __init__(self, voz, vigilante, enviar=False):
        self.voz = voz
        self.vigilante = vigilante
        self.enviar = enviar
        self.grabando = False
        self._modelo = None
        self._hilo = None

    def disponible(self):
        try:
            import vosk  # noqa: F401
            import sounddevice  # noqa: F401
            return True
        except ImportError:
            return False

    def _asegurar_modelo(self):
        if os.path.isdir(MODELO_DIR):
            return True
        os.makedirs(os.path.dirname(MODELO_DIR), exist_ok=True)
        log(f"Descargando el modelo de voz en español (una sola vez, ~40 MB)…")
        try:
            with urllib.request.urlopen(MODELO_URL, timeout=60) as resp:
                total = int(resp.headers.get("Content-Length") or 0)
                datos = io.BytesIO()
                leido = 0
                while True:
                    trozo = resp.read(1 << 16)
                    if not trozo:
                        break
                    datos.write(trozo)
                    leido += len(trozo)
                    if total:
                        print(f"\r   {leido * 100 // total}%", end="", flush=True)
            print()
            with zipfile.ZipFile(datos) as z:
                z.extractall(os.path.dirname(MODELO_DIR))
            log("Modelo descargado.")
            return os.path.isdir(MODELO_DIR)
        except Exception as e:
            log(f"No pude descargar el modelo: {e}")
            log(f"Bajalo a mano de {MODELO_URL} y descomprimilo en {os.path.dirname(MODELO_DIR)}")
            return False

    def _cargar_modelo(self):
        if self._modelo is None:
            import vosk
            vosk.SetLogLevel(-1)
            if not self._asegurar_modelo():
                return None
            self._modelo = vosk.Model(MODELO_DIR)
        return self._modelo

    def alternar(self):
        if not self.disponible():
            log("Para dictar instalá:  pip install vosk sounddevice pynput")
            return
        if self.grabando:
            self.grabando = False
            log("Procesando lo que dijiste…")
            return
        self.voz.detener()  # que el micrófono no escuche a Claude
        self.grabando = True
        self._hilo = threading.Thread(target=self._grabar, daemon=True)
        self._hilo.start()

    def _grabar(self):
        import sounddevice as sd
        import vosk

        modelo = self._cargar_modelo()
        if modelo is None:
            self.grabando = False
            return
        rec = vosk.KaldiRecognizer(modelo, 16000)
        cola = queue.Queue()

        def callback(indata, frames, tiempo, status):
            cola.put(bytes(indata))

        partes = []
        log("🎤 Grabando. Hablá y, cuando termines, volvé a apretar Ctrl+Alt+H (o escribí h y Enter).")
        try:
            with sd.RawInputStream(samplerate=16000, blocksize=4000, dtype="int16", channels=1, callback=callback):
                while self.grabando:
                    try:
                        datos = cola.get(timeout=0.2)
                    except queue.Empty:
                        continue
                    if rec.AcceptWaveform(datos):
                        frase = json.loads(rec.Result()).get("text", "")
                        if frase:
                            partes.append(frase)
                            log(f"   … {frase}")
        except Exception as e:
            self.grabando = False
            log(f"No pude usar el micrófono: {e}")
            return
        final = json.loads(rec.FinalResult()).get("text", "")
        if final:
            partes.append(final)
        texto = " ".join(partes).strip()
        if not texto:
            log("No entendí nada. Probá hablar más cerca del micrófono.")
            return
        texto = texto[0].upper() + texto[1:]
        log(f"Dijiste: {texto}")
        self._escribir(texto)

    def _escribir(self, texto):
        """Pega el texto en la ventana activa (la caja de chat de Claude)."""
        self.vigilante.poner(texto)
        try:
            from pynput.keyboard import Controller, Key
        except ImportError:
            log("Texto copiado al portapapeles. Pegalo en Claude con Ctrl+V. (pip install pynput para que sea automático)")
            return
        teclado = Controller()
        modificador = Key.cmd if SISTEMA == "Darwin" else Key.ctrl
        time.sleep(0.2)
        with teclado.pressed(modificador):
            teclado.press("v")
            teclado.release("v")
        if self.enviar:
            time.sleep(0.3)
            teclado.press(Key.enter)
            teclado.release(Key.enter)
            log("Enviado a Claude.")
        else:
            log("Texto pegado en la ventana activa. Revisalo y apretá Enter para enviarlo.")


# ---------------------------------------------------------------------------
# Atajos globales (opcionales): funcionan con la ventana de Claude enfocada.
# ---------------------------------------------------------------------------

def activar_atajos(voz, dictado):
    try:
        from pynput import keyboard
    except ImportError:
        log("Sin atajos globales (pip install pynput para activarlos). Usá las teclas de la terminal.")
        return None
    try:
        atajos = keyboard.GlobalHotKeys({
            ATAJO_DETENER: voz.detener,
            ATAJO_REPETIR: voz.repetir,
            ATAJO_DICTAR: dictado.alternar,
        })
        atajos.daemon = True
        atajos.start()
        return atajos
    except Exception as e:
        log(f"No pude activar los atajos globales: {e}")
        return None


# ---------------------------------------------------------------------------
# Programa principal
# ---------------------------------------------------------------------------

def parsear_argumentos():
    p = argparse.ArgumentParser(
        description="Escuchá en voz alta lo que responde Claude en la app y dictale con el micrófono.",
        add_help=False,
    )
    p.add_argument("--ayuda", "-h", action="help", help="muestra esta ayuda")
    p.add_argument("--velocidad", type=int, default=0, help="velocidad de lectura, de -10 (lento) a 10 (rápido). Por defecto 0")
    p.add_argument("--voz", default=None, help="nombre de la voz a usar (ver opción --listar-voces)")
    p.add_argument("--listar-voces", action="store_true", help="muestra las voces instaladas y sale")
    p.add_argument("--leer-codigo", action="store_true", help="lee también los bloques de código (por defecto se omiten)")
    p.add_argument("--enviar", action="store_true", help="después de dictar, aprieta Enter para enviar el mensaje solo")
    p.add_argument("--sin-atajos", action="store_true", help="no activa los atajos globales de teclado")
    p.add_argument("--probar", action="store_true", help="dice una frase de prueba y sale")
    return p.parse_args()


def main():
    args = parsear_argumentos()
    voz = Voz(velocidad=args.velocidad, nombre_voz=args.voz)

    if args.listar_voces:
        voz.listar_voces()
        return
    if args.probar:
        print("Probando la voz…")
        voz.decir("Hola, soy la voz que va a leer las respuestas de Claude. ¿Se escucha bien?")
        while voz.hablando():
            time.sleep(0.2)
        return

    try:
        vigilante = VigilantePortapapeles(voz, leer_codigo=args.leer_codigo)
    except ImportError:
        raise SystemExit("Falta una librería. Instalala con:  pip install pyperclip")
    dictado = Dictado(voz, vigilante, enviar=args.enviar)

    print(__doc__)
    print(f"Sistema: {SISTEMA}. Velocidad: {voz.velocidad:+d}.")
    if not dictado.disponible():
        print("Dictado por micrófono desactivado: falta instalar  pip install vosk sounddevice pynput")
    print("\nListo. Andá a la app de Claude y apretá 'Copiar' en una respuesta para escucharla.\n")

    vigilante.start()
    if not args.sin_atajos:
        activar_atajos(voz, dictado)

    print("> ", end="", flush=True)
    while True:
        try:
            orden = input().strip().lower()
        except (EOFError, KeyboardInterrupt):
            break
        if orden == "":
            voz.detener()
        elif orden == "r":
            voz.repetir()
        elif orden == "h":
            dictado.alternar()
        elif orden == "+":
            voz.cambiar_velocidad(1)
        elif orden == "-":
            voz.cambiar_velocidad(-1)
        elif orden == "v":
            voz.listar_voces()
        elif orden == "p":
            vigilante.pausado = not vigilante.pausado
            log("Portapapeles en pausa." if vigilante.pausado else "Portapapeles activo de nuevo.")
        elif orden in ("q", "salir", "exit"):
            break
        else:
            log("Teclas: Enter=detener  r=repetir  h=dictar  +/-=velocidad  v=voces  p=pausar  q=salir")
        print("> ", end="", flush=True)

    voz.detener()
    print("\nChau.")


if __name__ == "__main__":
    main()
