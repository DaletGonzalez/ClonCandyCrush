# Contexto del proyecto

- Juego individual de combinar dulces, inspirado en Candy Crush, para navegador y Live Server de VS Code.
- El juego está dirigido únicamente a navegadores de PC, con mouse y teclado. No se requiere soporte móvil.
- HTML, CSS y JavaScript nativos. Sin dependencias, backend ni multijugador.
- `index.html`: pantalla del juego; `style.css`: apariencia adaptable; `engine.js`: reglas del tablero; `app.js`: interacción, animaciones y progreso local.
- Abrir `index.html` con Live Server. No requiere instalación ni compilación.
- Mantener código sencillo, cambios pequeños y explicaciones breves en español.
- Tablero 8×8, combinaciones de tres o más, cascadas, especiales y objetivos de puntuación. Sin límite de movimientos, tiempo, vidas ni intentos. El progreso se guarda en localStorage.
- Los rayados creados por cuatro dulces siguen la dirección del intercambio que los generó: horizontal limpia una fila y vertical una columna. En cascadas sin intercambio se usa la orientación de la combinación.
- Efectos visuales nativos en `effects.js`: partículas canvas, barridos direccionales, ondas, rayos de bombas, puntos flotantes y combos. `app.js` anima la caída desde la posición anterior mediante Web Animations. Respetar movimiento reducido y conservar quietos los dulces no afectados.
