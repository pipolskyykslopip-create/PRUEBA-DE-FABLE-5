# Alea iacta est — La vida de Julio César

Documento de diseño (Fase 0). Para aprobar antes de programar.

Juego de estrategia 2D para navegador. Tiene dos capas: un mapa de campaña por turnos (como *Total War: Rome II*) y batallas en tiempo real vistas desde arriba (como *Age of Empires*).

---

## 1. Límites técnicos

Todo el diseño parte de que el juego tiene que andar bien en tu notebook: Celeron, 4 GB de RAM y gráfica integrada.

| Requisito | Cómo se cumple |
|---|---|
| ≥ 30 fps en Chrome/Firefox | Canvas 2D y JavaScript puro, sin bibliotecas. El terreno se dibuja una sola vez en un canvas aparte y después solo se copia. Cada silueta de soldado se dibuja una vez por facción y se reutiliza. La lógica corre a 20 ticks por segundo y el dibujo a la frecuencia de la pantalla. |
| Máx. 150–200 unidades | Tope duro de **200 soldados dibujados** en total. Cada soldado es una figurita; los soldados se agrupan en **escuadrones** de 12–20. Recibís órdenes por escuadrón, no por soldado. |
| Colisiones y búsqueda baratas | Una grilla espacial divide el campo en celdas, así cada soldado solo revisa a sus vecinos. La pelea entre escuadrones se calcula en bloque y los soldados solo la representan visualmente. |
| Sin imágenes externas | Todo se dibuja por código: formas, siluetas, escudos con los colores de cada facción y un mapa vectorial simplificado. |
| < 5 MB, sin internet | Un **único archivo `.html`** con todo adentro. Calculo que va a pesar menos de 500 KB. No usa fuentes web ni CDN. |
| Medición | Un contador de fps opcional (tecla `F3`). Las pruebas se hacen con Chrome automatizado y la CPU frenada ×4–×6 para simular tu Celeron. |

**Plan B si los fps no alcanzan:** bajo automáticamente la cantidad de soldados por escuadrón (siempre se ven al menos 8). El escuadrón mantiene su fuerza en los cálculos; solo cambia cuántos se dibujan.

## 2. Controles (pensados para touchpad, sin rueda)

**Batalla**
- **Clic izquierdo** sobre un escuadrón propio lo selecciona. Con **Shift + clic** sumás otro a la selección.
- **Arrastrar** con el botón apretado dibuja un rectángulo y selecciona todo lo que quede adentro.
- Con algo seleccionado, **clic en el terreno** lo manda a moverse y **clic sobre un enemigo** lo manda a atacar. No hace falta el botón derecho.
- **Arrastrar desde un escuadrón seleccionado con `Alt` apretado**: el escuadrón se mueve y queda mirando hacia donde arrastraste.
- **Flechas o `WASD`** mueven la cámara. Llevar el puntero al borde de la pantalla también la mueve, y eso se puede apagar.
- **`+` / `-`** acercan y alejan la cámara (tres niveles).
- **`Espacio`** pausa. Con el juego pausado podés dar órdenes.
- **`1`–`5`** cambian la formación: línea, columna, cuña, testudo y orden abierto.
- **`H`** detiene, **`R`** hace correr al escuadrón (cansa más) y **`Ctrl+1..9`** guarda un grupo que después recuperás con `1..9`.
- **`Tab`** pasa al siguiente escuadrón y **`F3`** muestra los fps.

**Campaña:** con clic seleccionás un ejército o una región y con otro clic en una región vecina lo movés. **`Enter`** termina el turno. Todos los botones son grandes y se pueden clickear, y nada depende de pasar el puntero por encima.

## 3. Mapa de campaña (por turnos)

- **Regiones:** 18 en total, en Italia, Galia Cisalpina, Galia Transalpina, Hispania, Grecia/Macedonia, Asia Menor, Ponto y Egipto. Se dibujan como polígonos sobre el contorno del Mediterráneo.
- **Turno = una estación.** Así se avanza rápido y se ve pasar el tiempo.
- **Recursos de cada región:** dinero (denarios por turno), un tope de reclutamiento por tipo de tropa y el orden público.
- **Ejércitos:** una legión tiene hasta 8 escuadrones. Cada turno puede moverse 1 o 2 regiones. Si entra en una región con enemigos, se arma una batalla; podés pelearla vos o dejar que se resuelva sola.
- **Lealtad de las legiones (0–100):**
  - Sube con victorias, botín y paga al día.
  - Baja con derrotas, atrasos en la paga y campañas muy largas lejos de casa.
  - Con lealtad baja empieza a haber deserciones. En el capítulo del Rubicón, la lealtad decide cuántas tropas te siguen.
- **Senado / *dignitas*:** un indicador político simple que en algunos capítulos abre o cierra opciones.

## 4. Batallas (tiempo real)

| Tropa | Rol |
|---|---|
| Legionarios | Línea principal. Resistentes. Antes de chocar arrojan una andanada de *pila*. |
| Caballería | Rápida y muy fuerte cargando de flanco o por la espalda. Débil sostenida contra una línea. |
| Arqueros / honderos | Atacan a distancia con munición limitada y son frágiles cuerpo a cuerpo. |
| Especiales (según el capítulo) | Barricada de carros de los helvecios, carros falcados del Ponto, fortificaciones en Alesia. |

- **Formaciones:** cada una cambia ataque, defensa, velocidad y protección contra proyectiles. Por ejemplo, el testudo casi anula las flechas pero vuelve al escuadrón lento.
- **Flanqueo:** un golpe de costado hace ×1,5 de daño y uno por la espalda ×2. Las dos cosas también bajan la moral.
- **Moral:** baja con las bajas, si te flanquean, si cae el general o si ves desbandarse a escuadrones cercanos. Sube si el general está cerca. Si llega a 0, el escuadrón **se desbanda**: huye y puede reagruparse lejos del combate. Con todo el ejército desbandado, se pierde la batalla.
- **Cansancio:** correr y pelear cansan, y descansar recupera.
- **Terreno:**
  - **Colinas:** dan bonificación al que pelea desde arriba y más alcance a los proyectiles.
  - **Bosques:** frenan a la caballería, protegen de las flechas y ocultan escuadrones.
  - **Ríos:** solo se cruzan por los vados, y quien cruza pelea con desventaja.
- **IA enemiga:** máquina de estados por escuadrón (avanzar, sostener la línea, flanquear, retirarse), más un "plan" de batalla distinto en cada capítulo.

## 5. Capítulos

Cada capítulo empieza con una introducción de 2–3 párrafos basada en Plutarco (*Vida de César*) y Suetonio (*Divino Julio*). Al escribir cada uno voy a cotejar el texto con las fuentes y anotar la cita (capítulo y párrafo) en una nota al pie dentro del juego.

| # | Capítulo | Objetivo jugable | Fuentes |
|---|---|---|---|
| 0 | **Los piratas** (75 a.C.), como tutorial | En un islote con pocas tropas aprendés seleccionar, mover, cambiar formación y flanquear. Después atacás la guarida pirata con la flota que juntaste en Mileto. | Plut. *Caes.* 2; Suet. *Iul.* 4 y 74 |
| 1 | **Los helvecios** (58 a.C.) | Primero, en la campaña, alcanzar a los helvecios antes de que se instalen en la Galia. Después, la batalla: resistir el choque desde la colina, aguantar el ataque de flanco de los boyos y los tulingos, y romper la barricada de carros. | Plut. *Caes.* 18; César, *BG* I (como apoyo) |
| 2 | **Alesia** (52 a.C.) | Asedio con **doble línea**: la de adentro encierra a Vercingétorix y la de afuera frena al ejército galo que viene a rescatarlo. Hay que llevar las reservas de un punto a otro sin que se rompa ninguna de las dos. | Plut. *Caes.* 26–27 |
| 3 | **El Rubicón** (49 a.C.) | Una **decisión** sin batalla. Según tu *dignitas*, el dinero y la lealtad de tus legiones, elegís cruzar o no. Si no cruzás, ves un final alternativo corto. Si cruzás, sigue la campaña por Italia. | Plut. *Caes.* 32; Suet. *Iul.* 31–33 |
| 4 | **Farsalia** (48 a.C.) | Pelear contra un ejército que te duplica. El truco histórico es esconder una **cuarta línea** de cohortes para frenar a la caballería de Pompeyo, y eso hay que descubrirlo y aplicarlo. | Plut. *Caes.* 42–45, *Pomp.* 68–72; Suet. *Iul.* 35 |
| 5 | **Zela** (47 a.C.) | Batalla corta con límite de tiempo, en la que Fárnaces ataca colina arriba con **carros falcados**. Si ganás rápido, se desbloquea el "*veni, vidi, vici*". | Plut. *Caes.* 50; Suet. *Iul.* 35 y 37 |
| 6 | **Munda** (45 a.C.) | La batalla más dura, contra los hijos de Pompeyo y Labieno. La moral está muy pareja y el general tiene que meterse en la primera línea en el momento justo. | Plut. *Caes.* 56; Suet. *Iul.* 36 |
| 7 | **Los Idus de marzo** (44 a.C.) | Un **epílogo narrativo** sin combate. Pasás por avisos y decisiones: Espurina, Calpurnia, la nota de Artemidoro. La historia termina igual, pero lo que elegiste cambia el texto final y la evaluación de tu carrera. | Plut. *Caes.* 63–66; Suet. *Iul.* 81–82 |

**Nota histórica sobre los "galos con carros":** en el 58 a.C. los galos del continente ya no usaban carros de guerra (los que sí los usaban eran los britanos). Lo que tenían los helvecios era una **barricada de carretas** donde estaban sus familias. Por eso propongo:
- en Helvecios, la barricada de carretas como fortificación que hay que asaltar;
- en Zela, los **carros falcados** del Ponto, que ahí sí son históricos.

Si preferís tener carros de guerra galos igual, se pueden agregar marcados como licencia histórica.

## 6. Estilo visual y sonido

- **Vista cenital**, con una paleta tipo mapa antiguo: ocres, verdes apagados y azul piedra.
- **Soldados:** figuritas de 6–10 px, con un escudo del color de su facción. Roma: rojo y oro. Galos: verde y azul. Pompeyanos: blanco y azul. Ponto: púrpura. Los estandartes marcan el escudero de cada escuadrón.
- **Mapa de campaña:** pergamino dibujado con regiones de colores, ciudades como puntos y nombres con tipografía del sistema en estilo serif.
- **Interfaz:** botones grandes, contraste alto y textos legibles a 1366×768, que es la resolución de tu notebook.
- **Sonido:** efectos simples generados con Web Audio (choques, trompas) y sin archivos de música, para no pasarnos de peso. Se pueden apagar.

## 7. Idioma, guardado y dificultad

- **Español rioplatense** en todo el juego, con voseo ("Elegí tu formación", "¿Cruzás el río?").
- **Guardado automático** en el navegador (`localStorage`) al final de cada turno y de cada batalla. También se puede **exportar o importar la partida a un archivo**, por si borrás los datos del navegador.
- **Tres dificultades:**

| Dificultad | Cómo cambia el juego |
|---|---|
| **Tribuno** | Enemigos −20 % de fuerza, más dinero y la lealtad baja más despacio. |
| **Legado** | Equilibrado. |
| **Dictador** | Enemigos +20 % de fuerza, IA más agresiva, menos pausas tácticas y la lealtad castiga más. |

## 8. Entregas

| Fase | Contenido | Cómo se verifica |
|---|---|---|
| **1 — Mínimo jugable** | Mapa chico (6 regiones: Italia, Cisalpina, Narbonense, Helvecia, Bibracte y Belgica), recursos, reclutamiento, movimiento, lealtad, guardado y dificultad. Una batalla completa: los helvecios. | Pruebas automatizadas en Chrome (clics, arrastre y teclado) y fps medidos con la CPU frenada, con 200 soldados en pantalla. |
| **2** | Alesia | Ídem |
| **3** | Rubicón y mapa completo | Ídem |
| **4** | Farsalia | Ídem |
| **5** | Zela | Ídem |
| **6** | Munda | Ídem |
| **7** | Prólogo de los piratas (tutorial) e Idus de marzo | Ídem |

El tutorial va al final aunque en el juego sea el primer capítulo: conviene escribirlo cuando las mecánicas ya no cambien.

**Formato de cada entrega:**
- Una versión publicada para abrir en el navegador.
- El archivo `alea-iacta-est.html` en esta carpeta, para descargar y abrir sin conexión con doble clic.
- Un informe corto de las pruebas y los fps.

---

### Para que decidas

1. ~~Nombre~~ → **Alea iacta est** (decidido)
2. ¿Aceptás reemplazar los "galos con carros" por la barricada de carretas y los carros falcados en Zela? ¿O preferís tener carros galos como licencia histórica?
3. ¿Está bien que el tutorial de los piratas se haga recién en la última entrega?
4. ¿Te sirve que el Rubicón y los Idus sean capítulos de decisiones, sin batalla?
