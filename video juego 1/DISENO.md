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
- **Arrastrar con `Alt` o `Ctrl` apretado**: el escuadrón se mueve y queda mirando hacia donde arrastraste. Se acepta `Ctrl` porque en algunos escritorios de Ubuntu `Alt` + arrastrar mueve la ventana.
- **Flechas o `WASD`** mueven la cámara. Llevar el puntero al borde de la pantalla también la mueve, y eso se puede apagar.
- **`+` / `-`** acercan y alejan la cámara (tres niveles).
- **`Espacio`** pausa. Con el juego pausado podés dar órdenes.
- **`1`–`5`** cambian la formación: línea, columna, cuña, testudo y orden abierto.
- **`H`** detiene, **`R`** hace correr al escuadrón (cansa más), **`Q`/`E`** giran 45° y **`Shift+6..9`** guarda un grupo que después recuperás con `6..9`. Chrome usa `Ctrl+1..9` para cambiar de pestaña, por eso no se usa ese atajo.
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

## 5. La saga: un juego por etapa

La vida de César se divide en **tres juegos**, cada uno con sus capítulos, como una serie de novelas. La estructura se inspira en la serie de Santiago Posteguillo sobre César:
- un primer ciclo de **ascenso** (en sus novelas, la *Trilogía del Ascenso*, que termina en el 58 a.C. con la Galia);
- **varias líneas narrativas en paralelo**, como Roma, la Galia y Egipto en *Los tres mundos*;
- el **juicio como thriller** de *Roma soy yo*;
- la **ironía dramática**: el lector sabe lo que el personaje todavía no sabe.

Los textos, los títulos y los diálogos son nuestros. No copio nada de las novelas.

### Recursos narrativos de cada juego

- **Libro y capítulos.** Cada capítulo abre con un rótulo de lugar y fecha (por ejemplo: *Gades, Hispania Ulterior, 69 a.C.*) y una introducción de 2–3 párrafos basada en Plutarco y Suetonio, con la cita al pie.
- **Interludios paralelos.** Entre capítulo y capítulo aparecen escenas cortas de **otras líneas**: Roma (Pompeyo, Craso, Cicerón, Clodio), la familia (Aurelia, Cornelia, Julia) y Egipto (Ptolomeo, Cleopatra). Son solo texto con una decisión que afecta la *dignitas*, el dinero o la lealtad, así que no cuestan rendimiento.
- **Ironía dramática.** Los interludios te muestran cosas que César no sabe, como una traición que se arma en Roma o un aliado que duda.
- **Final con gancho.** Cada juego termina con una gran decisión que lleva al siguiente.
- **Nota histórica final.** Al terminar cada juego, un apartado explica qué pasó de verdad y qué es licencia del juego.
- **Tu partida continúa.** Al final de cada juego se exporta un "legado" (fama, legiones veteranas, deudas y alianzas) que se importa en el juego siguiente.

### Juego I — *Alea iacta est: El ascenso* (82–60 a.C.)

| # | Capítulo | Tipo | Objetivo jugable | Fuentes |
|---|---|---|---|---|
| 1 | **Proscrito** (82–81) | Decisión y huida | No repudiar a Cornelia, huir de los hombres de Sila por el mapa de Italia y conseguir el perdón. | Suet. 1; Plut. 1 |
| 2 | **Mitilene** (80) | Batalla, como **tutorial** | Asalto en el que aprendés seleccionar, mover y armar formaciones. Si salvás a un ciudadano, ganás la corona cívica. | Suet. 2 |
| 3 | **El juicio de Dolabela** (77) | Juicio | Un minijuego de oratoria con testigos, pruebas y un jurado comprado. Se puede perder el juicio y aun así ganar fama, como pasó de verdad. | Suet. 4; Plut. 4 |
| 4 | **Los piratas** (75) | Batalla | El rescate de 50 talentos y después la venganza: atacar la guarida pirata con la flota de Mileto. | Plut. 2; Suet. 4 y 74 |
| 5 | **Asia** (74) | Batalla | Por iniciativa propia, reclutás tropas auxiliares contra un prefecto de Mitrídates. | Suet. 4 |
| 6 | **Espartaco** (73–71) | Batalla, *licencia* | Ninguna fuente antigua dice que César haya peleado contra Espartaco. Lo propongo como capítulo opcional y marcado como licencia. | Plut. *Craso* 8–11 (contexto) |
| 7 | **La estatua de Alejandro** (69) | Interludio | Cuestor en Gades: la crisis de los 30 años y la ambición. | Suet. 7 |
| 8 | **Pontífice máximo** (63) | Campaña política | Elecciones, deudas con Craso y el debate de los catilinarios en el Senado. | Suet. 13–14; Plut. 7–8 |
| 9 | **Lusitania** (61) | Campaña y batallas | Como propretor de Hispania Ulterior, campaña contra lusitanos y galaicos hasta el océano. Te aclaman *imperator*. | Plut. 12; Suet. 18 |
| 10 | **Triunfo o consulado** (60) | Decisión final | Para tener el triunfo había que esperar afuera de Roma, y para ser candidato a cónsul había que entrar. César renunció al triunfo. **Gancho:** el pacto con Pompeyo y Craso y la Galia en el horizonte. | Plut. 13; Suet. 18–19 |

### Juego II — *Alea iacta est: Las Galias* (58–50 a.C.)

**Capítulos:**
- los helvecios, con la barricada de carretas;
- Ariovisto;
- los nervios en el Sabis;
- Britania, con los **carros de guerra britanos**, que ahí sí son históricos;
- Alesia, con la doble línea de fortificaciones.

**Líneas paralelas:** Roma (Clodio, la muerte de Julia, Craso en Carras) y Egipto (el exilio de Ptolomeo y Cleopatra).

**Final:** el Rubicón, como decisión.

### Juego III — *Alea iacta est: La guerra civil* (49–44 a.C.)

**Capítulos:**
- Dirraquio;
- Farsalia, con la cuarta línea;
- Alejandría y Cleopatra;
- Zela, con los carros falcados y el *veni, vidi, vici*;
- Munda.

**Epílogo:** los Idus de marzo, como capítulo narrativo de decisiones.

Las fuentes de los juegos II y III son las de la versión anterior de este documento. Las detallo cuando arranquemos cada juego.

**Sobre los carros:** con esta división cada carro cae en su lugar histórico, así que no hace falta ninguna licencia.
- Helvecios: carretas que forman una barricada.
- Britania: carros de guerra.
- Zela: carros falcados.

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

Todos los juegos comparten **el mismo motor**. Cada juego es un archivo `.html` aparte y cada entrega agrega uno o dos capítulos ya probados.

| Fase | Contenido | Cómo se verifica |
|---|---|---|
| **1 — Mínimo jugable** | El motor completo más el capítulo **Lusitania (61)** del Juego I. Incluye un mapa chico de Hispania (6 regiones: Bética, Gades, Lusitania, Callaecia, Carpetania y el océano), recursos, reclutamiento, movimiento, lealtad, guardado y dificultad. También una batalla completa contra los lusitanos, que usan emboscadas en las colinas, caballería ligera y un río. | Pruebas automatizadas en Chrome (clics, arrastre y teclado) y fps medidos con la CPU frenada, con 200 soldados en pantalla. |
| **2** | Mitilene (tutorial) y Los piratas | Ídem |
| **3** | El juicio de Dolabela | Ídem |
| **4** | Proscrito, Asia y la estatua de Alejandro | Ídem |
| **5** | Pontífice máximo y Triunfo o consulado. **Juego I completo** | Ídem |
| **6 en adelante** | Juego II, capítulo por capítulo, y después el Juego III | Ídem |

**Por qué Lusitania va primero:** es el único capítulo del Juego I que usa a la vez el mapa de campaña, la lealtad de las legiones y una batalla grande. Si el motor aguanta ahí, aguanta todo lo demás.

**Formato de cada entrega:**
- Una versión publicada para abrir en el navegador.
- El archivo `alea-iacta-est-1.html` en esta carpeta, para descargar y abrir sin conexión con doble clic.
- Un informe corto de las pruebas y los fps.

---

### Para que decidas

1. ~~Nombre~~ → **Alea iacta est** (decidido).
2. ¿Te sirve la división en **3 juegos**: Ascenso, Galias y Guerra civil?
3. ¿Arrancamos la Fase 1 con **Lusitania (61)**, o preferís que la primera batalla sea otra?
4. Espartaco: ¿lo incluyo como capítulo opcional marcado como licencia, o lo saco?
