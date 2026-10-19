'use strict';

const CandyLevels = (() => {
  const SIZE = 8;
  const TYPES = ['score', 'colors', 'jelly'];
  // Movimientos por unidad de objetivo según los colores del nivel. Calibrado con partidas de
  // prueba que eligen siempre la mejor jugada, más un 25 % de margen.
  const PACE = {
    5: { score: 1 / 560, colors: 0.34, jelly: 0.8 },
    6: { score: 1 / 420, colors: 0.62, jelly: 1.75 }
  };
  function square(side) {
    const start = (SIZE - side) / 2, cells = [];
    for (let row = start; row < start + side; row++) for (let col = start; col < start + side; col++) cells.push(row * SIZE + col);
    return cells;
  }
  function levelConfig(level) {
    const colors = level <= 6 ? 5 : 6;
    const type = TYPES[(level - 1) % TYPES.length];
    const config = { level, colors, type };
    let units;
    if (type === 'score') {
      config.goal = 1500 + (level - 1) * 400;
      units = config.goal;
    } else if (type === 'colors') {
      const count = Math.min(60, 15 + 3 * level);
      config.targets = [{ color: level % colors, count }, { color: (level + 2) % colors, count }];
      units = count * 2;
    } else {
      config.jelly = square(level < 6 ? 4 : level < 16 ? 6 : 8);
      units = config.jelly.length;
    }
    config.par = Math.max(5, Math.round(units * PACE[colors][type]));
    return config;
  }
  // 3 estrellas en el par o menos; 2 hasta 1.5 veces el par; 1 en cualquier otro caso.
  const stars = (moves, par) => moves <= par ? 3 : moves <= par * 1.5 ? 2 : 1;
  return { levelConfig, stars };
})();
if (typeof module !== 'undefined') module.exports = CandyLevels;
