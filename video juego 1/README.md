# Alea iacta est

Juego de estrategia sobre la vida de Julio César, para jugar en el navegador. Tiene dos partes: un mapa de campaña por turnos y batallas en tiempo real vistas desde arriba. Está hecho con HTML5 Canvas 2D y JavaScript puro, sin motores ni bibliotecas.

**Libro primero · El ascenso.** Por ahora se juega el **capítulo IX, Lusitania (61 a.C.)**.

## Cómo jugar

- **Sin conexión:** bajá `alea-iacta-est-1.html` y abrilo con doble clic en Chrome o Firefox. Es un solo archivo de unos 310 KB y no necesita internet.
- **Partida guardada:** se guarda sola en el navegador al final de cada turno y de cada batalla. Desde el menú de la partida la podés exportar a un archivo `.json`, y desde el menú principal la cargás en otra máquina.
- **Opciones:** sonido, mover la cámara llevando el puntero al borde, detalle de batalla (alto o bajo) y contador de fps.

### Controles de batalla (touchpad, sin rueda)

| Acción | Control |
|---|---|
| Seleccionar | Clic en la tropa, o en su tarjeta en el panel de abajo |
| Seleccionar varias | Arrastrar un rectángulo, o Shift + clic |
| Mover | Con algo seleccionado, clic en el terreno |
| Atacar | Clic en un enemigo |
| Mover y elegir hacia dónde miran | Alt o Ctrl + arrastrar |
| Girar | Q / E |
| Formación | 1 línea · 2 columna · 3 cuña · 4 testudo · 5 orden abierto |
| Correr / detenerse | R / H |
| Grupos | Shift + 6..9 para guardar un grupo; 6..9 para elegirlo |
| Cámara | Flechas o WASD, `+` / `−` para el zoom, clic en el minimapa |
| Pausa / velocidad | Espacio (en pausa se pueden dar órdenes) / `.` |
| Ayuda / fps | Botón «Controles» / F3 |

En la campaña: clic en tu ejército, clic en una región resaltada para moverlo y Enter para terminar el turno.

## Archivos

```
DISENO.md               documento de diseño (Fase 0)
INFORME-FASE-1.md       pruebas y rendimiento de esta entrega
alea-iacta-est-1.html   el juego armado (lo que se juega)
build.mjs               arma el HTML único a partir de src/
src/index.html          estructura de pantallas
src/style.css           estilos
src/fonts/              Cinzel y Alegreya (licencia SIL OFL)
src/js/                 código
  util.js  audio.js  data.js         utilidades, sonido sintetizado, datos y textos
  sprites.js  terrain.js             siluetas pre-dibujadas y terreno generado
  battle_core.js  battle_ai.js       simulación de batalla e IA enemiga
  battle_view.js                     dibujo, controles y panel de batalla
  campaign.js  campaign_view.js      reglas y mapa de la campaña
  ui.js  main.js                     ventanas, pantallas y flujo del juego
tests/                  pruebas automatizadas con Chromium
```

## Para desarrollar

```sh
node build.mjs                 # genera alea-iacta-est-1.html
node tests/smoke.mjs           # menú, batalla con clics, arrastre y teclado, campaña
node tests/campaign.mjs        # campaña completa hasta el final
node tests/balance.mjs 12      # equilibrio: batallas simuladas por dificultad
node tests/perf.mjs 6          # fps con la CPU frenada 6 veces (agregá "bajo" para detalle bajo)
```

Las pruebas usan el Chromium y el Playwright que vienen instalados en el entorno de desarrollo.
