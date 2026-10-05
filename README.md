# Escuchar a Claude

Un programa de terminal, gratis y sin API key, para usar junto a la app de Claude:

- **Claude te habla.** Cada vez que apretás **Copiar** en una respuesta de Claude, el programa la lee en voz alta con la voz de tu computadora.
- **Vos le hablás.** Con un atajo de teclado grabás tu voz, se transcribe sin internet y el texto aparece escrito en la caja de chat de Claude. Lo revisás y apretás Enter.

No usa la API de Anthropic ni ningún servicio pago. Todo corre en tu PC.

## Instalación en Linux (Lubuntu, Ubuntu, Debian)

1. Descargá esta carpeta (botón verde *Code* → *Download ZIP*) y descomprimila, por ejemplo en tu carpeta personal.
2. Abrí una terminal dentro de la carpeta (clic derecho → *Abrir terminal aquí*) y ejecutá:

   ```
   ./escuchar_claude.sh --probar
   ```

   La primera vez instala lo que falta (te pide tu contraseña para `apt`), crea un entorno de Python e instala las librerías. Al final dice una frase de prueba en voz alta.

3. De ahí en más, para arrancarlo:

   ```
   ./escuchar_claude.sh
   ```

   Si al hacer doble clic en el archivo se abre un editor en vez de ejecutarse, usalo desde la terminal.

## Instalación en Windows

1. Instalá Python desde <https://www.python.org/downloads/>. En el instalador marcá **"Add python.exe to PATH"**.
2. Descargá esta carpeta (botón verde *Code* → *Download ZIP*) y descomprimila.
3. Abrí una terminal en la carpeta (clic derecho → *Abrir en Terminal*) y ejecutá:

   ```
   pip install -r requirements.txt
   ```

4. Probá que la voz funcione:

   ```
   python escuchar_claude.py --probar
   ```

   Si no escuchás nada o habla en inglés, fijate la sección *Voz en español* más abajo.

## Uso diario

1. Abrí la app de Claude como siempre.
2. Arrancá el programa: en Linux `./escuchar_claude.sh`, en Windows doble clic en `escuchar_claude.bat`. Dejá esa ventana abierta.
3. Cuando Claude responda, pasá el mouse por debajo de la respuesta y apretá el botón **Copiar**. La respuesta empieza a sonar enseguida.
4. Para contestarle con la voz: hacé clic en la caja de texto de Claude, apretá **Ctrl+Alt+H**, hablá, y volvé a apretar **Ctrl+Alt+H**. El texto se pega solo. Revisalo y apretá Enter.

### Atajos globales (funcionan con la ventana de Claude enfocada)

| Atajo | Qué hace |
|---|---|
| Ctrl+Alt+S | Detener la lectura |
| Ctrl+Alt+R | Repetir la última respuesta |
| Ctrl+Alt+H | Empezar / terminar el dictado |

### Teclas en la ventana del programa (escribí la letra y Enter)

| Tecla | Qué hace |
|---|---|
| Enter | Detener la lectura |
| r | Repetir la última respuesta |
| h | Empezar / terminar el dictado |
| + / - | Leer más rápido / más despacio |
| v | Listar las voces instaladas |
| p | Pausar / reanudar la lectura del portapapeles |
| q | Salir |

### Opciones al arrancar

```
python escuchar_claude.py --velocidad 3        # más rápido (de -10 a 10)
python escuchar_claude.py --voz "Microsoft Helena Desktop"
python escuchar_claude.py --listar-voces       # ver qué voces tenés
python escuchar_claude.py --leer-codigo        # leer también los bloques de código
python escuchar_claude.py --enviar             # después de dictar, envía el mensaje solo
python escuchar_claude.py --ayuda
```

Los bloques de código se saltean por defecto (se escucha "Bloque de código omitido") porque leídos letra por letra no se entienden. Títulos, negritas, listas, tablas y enlaces se limpian para que suenen naturales.

## Voz en español

**Windows.** El programa elige sola la primera voz en español que encuentre. Si tu Windows está en inglés, puede que no tengas ninguna. Para agregarla: *Configuración → Hora e idioma → Idioma y región → Agregar un idioma → Español* y marcá la casilla **Texto a voz**. Después ejecutá `python escuchar_claude.py --listar-voces` para verla.

**macOS.** Usa el comando `say` con la primera voz en español instalada (Mónica, Paulina…). Podés agregar más en *Ajustes → Accesibilidad → Contenido hablado → Voz del sistema*.

**Linux.** Usa `espeak-ng` con la voz latinoamericana (`es-419`). Para la de España: `./escuchar_claude.sh --voz es`. Si lo instalaste a mano y falta algo:

```
sudo apt install espeak-ng xclip python3-venv libportaudio2
```

## Dictado por micrófono

La primera vez que dictes se descarga un modelo de reconocimiento de voz en español (unos 40 MB, una sola vez) a la carpeta `modelos/`. Después todo funciona sin internet.

Si el programa dice que falta algo, instalá las librerías opcionales:

```
pip install vosk sounddevice pynput
```

El dictado funciona bien con frases claras y a velocidad normal. Mientras grabás, la lectura de Claude se detiene para que el micrófono no la capte.

## Problemas comunes

- **No pasa nada al copiar.** Revisá que el programa esté abierto y que no esté en pausa (tecla `p`). Copiá con el botón *Copiar* de Claude o con Ctrl+C sobre el texto seleccionado.
- **Habla en inglés.** No hay voz en español instalada; mirá la sección *Voz en español*.
- **Los atajos globales no funcionan.** Usá las teclas dentro de la ventana del programa, o reinstalá `pynput`. En Linux funcionan con sesión X11 (la normal de Lubuntu), no con Wayland. En macOS hay que darle permiso a la terminal en *Ajustes → Privacidad y seguridad → Accesibilidad*.
- **No me reconoce el micrófono.** Revisá que Windows tenga permitido el acceso al micrófono para aplicaciones de escritorio (*Configuración → Privacidad → Micrófono*).
