# Caramelo Club

Juego de combinar dulces hecho con HTML, CSS y JavaScript, sin dependencias.
Dirigido a navegadores de PC, con mouse y teclado.

## Abrir

1. Abre esta carpeta en VS Code.
2. Haz clic derecho sobre `index.html` y selecciona **Open with Live Server**.

## Jugar

- Haz clic en dos dulces vecinos o arrastra uno hacia su vecino.
- Junta al menos tres del mismo color. Los cambios sin combinación se rechazan.
- Alcanza el objetivo para pasar de nivel, sin límites de movimientos, tiempo, vidas ni intentos.
- Cuatro en línea crean un dulce rayado. Si el intercambio que lo creó fue horizontal, limpia su fila; si fue vertical, limpia su columna. Las rayas muestran esa dirección. En cascadas, la orientación sigue la línea combinada.
- Cinco en línea crean una bomba: intercámbiala con un dulce para eliminar ese color.
- Una T o L crea un dulce envuelto que explota en un área de 3×3.
- Dos especiales vecinos pueden intercambiarse para activar ambos.
- Usa **Una pista** si necesitas ayuda. Si no hay jugadas, el tablero se renueva automáticamente.
- Con teclado: flechas para desplazarte, Enter o espacio para seleccionar.
- Nivel y récord se guardan en este navegador. El tablero de una partida se reinicia al recargar.

El sonido es opcional. No hay cuentas, conexión con otros jugadores ni servicios externos.

Los efectos usan canvas, CSS y Web Animations: caída desde la posición anterior, partículas de colores, barridos de rayados, ondas de envueltos, rayos de bombas, puntos y combos flotantes. Se respeta la preferencia de movimiento reducido del sistema.
