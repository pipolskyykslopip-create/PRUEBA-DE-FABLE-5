# Informe de la Fase 1: mínimo jugable

**Contenido:** el motor completo y el capítulo IX, *Lusitania* (61 a.C.), del Libro primero.

## Qué incluye

- **Mapa de campaña de Hispania.** Seis regiones jugables más la Citerior, que gobierna otro magistrado.
  - Dinero en talentos, soldada por tropa, reclutamiento en Córduba y Gades, y reposición de bajas.
  - Flota en Gades para ir por mar.
  - Lealtad de las legiones: deserciones y motín.
  - *Dignitas*, orden público, saqueo o clemencia, y rebeliones.
  - IA lusitana: saqueadores, oportunistas y defensores.
  - Fecha límite según la dificultad, y la deuda con los acreedores.
- **Batallas en tiempo real.**
  - Legionarios con *pila*, honderos baleares, caballería, la guardia de César y, del lado lusitano, guerreros con caetra, jabalineros, jinetes y un caudillo.
  - Cinco formaciones.
  - Flanqueo: ×1,5 de costado y ×2 por la espalda.
  - Cargas, moral, desbande y reagrupamiento, y cansancio.
  - Colinas, que dan ventaja desde arriba y más alcance a los tiradores.
  - Bosques que frenan y esconden, ríos con vados y costa.
  - En el monte Herminio, emboscadas en los bosques.
- **Narrativa.**
  - Introducción con fuentes, al estilo de un capítulo.
  - Dos eventos de decisión: el pretexto del Herminio y los deudores y acreedores.
  - Dos interludios paralelos: Roma, con Pompeyo y Craso, y la familia, con la carta de Aurelia sobre Clodio.
  - Final con una nota histórica que separa lo que pasó de lo que es licencia del juego.
- **Además:** tres dificultades, guardado automático, exportar e importar la partida, una batalla de práctica, sonido sintetizado y un solo archivo de **307 KB** que anda sin internet.

## Cómo se probó

Todas las pruebas usaron Chromium automatizado (Playwright) a 1366×768, que es la resolución de una Vivobook E410MA.

| Prueba | Qué hace | Resultado |
|---|---|---|
| `tests/smoke.mjs` | Menú, batalla de práctica con arrastre para seleccionar, clic para mover y atacar, teclas 1–5, Espacio, WASD, `+`/`−` y `.`; campaña con evento, batalla automática, captura, reclutamiento y tres fines de turno | Sin errores en consola, guardado automático confirmado |
| `tests/campaign.mjs` | Campaña completa en Legado: Ébora en batalla dirigida, reclutamiento, unión de ejércitos, Herminio, Callaecia y pantalla final | Llega a «Imperator» y a la nota histórica, sin errores |
| `tests/balance.mjs` | 12 batallas simuladas por escenario y dificultad, con un jugador automático que ataca sin táctica | Ver la tabla de abajo |
| `tests/perf.mjs` | fps medidos con la CPU frenada y 200 soldados | Ver la tabla de abajo |

**Errores que encontraron las pruebas y ya están corregidos:**
- En el archivo sin conexión, una ventana oculta tapaba los clics.
- El sombreado del relieve venía del lado contrario.
- El río y la cima se veían pixelados.
- Algunos nombres del mapa se pisaban.
- Parte de la zona de despliegue quedaba debajo del panel.

## Rendimiento

La CPU se frenó con la emulación de Chrome y el dibujo se hizo **por software, sin placa de video**. Eso es más exigente que tu notebook, que dibuja el canvas con la gráfica integrada. La medición se toma con la batalla ya trabada: unos 150 soldados vivos, combate cuerpo a cuerpo y proyectiles.

| CPU frenada | Detalle | Mapa de campaña | Batalla (peor zoom) | Carga del campo |
|---|---|---|---|---|
| ×4 | alto | 60 fps | **58 fps** | 2,5 s |
| ×6 | alto | 53 fps | **39 fps** | 3,8 s |
| ×8 | alto | 37 fps | **24 fps** | 4,9 s |
| ×8 | bajo | 37 fps | **29–32 fps** | 5,1 s |

- La simulación cuesta 0,5–1 ms por paso (20 pasos por segundo), así que el límite está en el dibujo.
- **Primer intento:** ×6 daba 20 fps.
- **Qué se cambió:**
  - Las siluetas se dibujan de antemano para cada nivel de zoom y en batalla se copian píxel a píxel, sin escalar.
  - Los estandartes también se dibujan una sola vez.
  - El fondo ya no se pinta dos veces.
  - Con eso, ×6 pasó a 39 fps.
- **Plan B automático:** si la batalla baja de 27 fps durante 4 segundos, el juego apaga partículas y marcas en el suelo, y avisa.
- **Detalle bajo en Opciones:** dibuja un 40 % menos de soldados por tropa sin cambiar su fuerza.
- **Calibración:** un Celeron N4020 rinde aproximadamente entre 3 y 5 veces menos que la CPU de estas pruebas. Esto es una estimación, no una medición en tu máquina. El freno ×6 cubre ese rango con margen. Lo que vale es probarlo en tu notebook: tocá **F3** en batalla para ver los fps reales.

## Equilibrio

Porcentaje de victorias del jugador automático, que ataca al enemigo más cercano sin táctica:

| Escenario | Tribuno | Legado | Dictador |
|---|---|---|---|
| Monte Herminio con el ejército inicial | 58 % | 8 % | 0 % |
| Monte Herminio con 2 cohortes más | 100 % | 92 % | 50 % |
| Ébora (colinas) | 100 % | 100 % | 88 % |
| Defensa en llanura con 3 tropas contra 4 | 100 % | 88 % | 50 % |

El Herminio está pensado para que haga falta reclutar, como hizo César, que sumó diez cohortes (Plutarco, *César* 12), o para que haya que usar el terreno, los flancos y las reservas. Un jugador humano que flanquea debería ganar más seguido que este jugador automático.

## Pendiente o simplificado

- **Fuentes:** las citas de Plutarco, Suetonio y Dión Casio salen de mi conocimiento. Este entorno no puede abrir sitios como Perseus o LacusCurtius para cotejarlas palabra por palabra. Están marcadas en el juego con su capítulo para que se puedan revisar.
- **El Herminio en el mapa:** la batalla dirigida es una reconstrucción. Dión cuenta que los lusitanos huyeron y César los persiguió; eso se explica en la nota histórica.
- **Carga del campo de batalla:** en una máquina lenta puede tardar unos segundos, porque el terreno se genera y se pinta al empezar.
- **Exportar desde la versión publicada:** algunos visores bloquean las descargas. Para eso, el juego muestra el texto de la partida para copiarlo.
