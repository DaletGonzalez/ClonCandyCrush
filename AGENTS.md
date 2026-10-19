# Contexto del proyecto

- Juego individual de combinar dulces, inspirado en Candy Crush, para navegador y Live Server de VS Code.
- El juego está dirigido únicamente a navegadores de PC, con mouse y teclado. No se requiere soporte móvil.
- HTML, CSS y JavaScript nativos. Sin dependencias, backend ni multijugador.
- `index.html`: pantalla del juego; `style.css`: apariencia adaptable; `engine.js`: reglas del tablero; `app.js`: interacción, animaciones y progreso local.
- Abrir `index.html` con Live Server. No requiere instalación ni compilación.
- Mantener código sencillo, cambios pequeños y explicaciones breves en español.
- Tablero 8×8, combinaciones de tres o más, cascadas y especiales. `levels.js` define cada nivel (`levelConfig`): 5 colores hasta el nivel 6 y 6 después; objetivos que se alternan entre puntos, colores y gelatina; un par de movimientos calibrado para dar de 1 a 3 estrellas. Se guardan por nivel las mejores estrellas y el mejor puntaje. Sin límite de movimientos, tiempo, vidas ni intentos. El progreso se guarda en localStorage.
- Los rayados creados por cuatro dulces siguen la dirección del intercambio que los generó: horizontal limpia una fila y vertical una columna. En cascadas sin intercambio se usa la orientación de la combinación.
- Una línea de 5 crea bomba aunque forme T o L; una bomba activada por otro especial elimina el color más abundante entre lo que no se está limpiando. Combinaciones de especiales (en `combine` de `engine.js`, centradas en la casilla destino): rayado+rayado cruz, rayado+envuelto tres filas y tres columnas, envuelto+envuelto 5×5, bomba+rayado/envuelto convierte los dulces normales de ese color, bomba+bomba todo el tablero.
- Las reglas del tablero tienen pruebas en `tests/` (`node --test`, sin dependencias).
- Efectos visuales nativos en `effects.js`: partículas canvas, barridos direccionales, ondas, rayos de bombas, puntos flotantes y combos. `app.js` anima con Web Animations (`slide`) la caída, el intercambio (de ida y vuelta si no es válido) y la revoltura de los mismos dulces. La pista (botón y automática tras 5 s sin interacción) usa `bestMove` con el bono `hintBonus` de `levels.js`, que favorece la gelatina o los colores que faltan. Respetar movimiento reducido y conservar quietos los dulces no afectados.
