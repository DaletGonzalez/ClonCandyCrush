'use strict';

const CandyEngine = (() => {
  const SIZE = 8;
  const COLORS = 6;
  const candy = () => ({ color: Math.floor(Math.random() * COLORS), special: null });
  const adjacent = (a, b) => Math.abs(a % SIZE - b % SIZE) + Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) === 1;
  function swap(board, a, b) { [board[a], board[b]] = [board[b], board[a]]; }
  function matches(board) {
    const groups = [];
    for (let axis = 0; axis < 2; axis++) {
      for (let line = 0; line < SIZE; line++) {
        let run = [];
        for (let step = 0; step <= SIZE; step++) {
          const index = axis === 0 ? line * SIZE + step : step * SIZE + line;
          const tile = step < SIZE ? board[index] : null;
          if (run.length && (!tile || tile.color < 0 || tile.color !== board[run[0]].color)) {
            if (run.length >= 3) groups.push({ cells: run, axis });
            run = [];
          }
          if (tile && tile.color >= 0) run.push(index);
        }
      }
    }
    return groups;
  }
  function validSwap(board, a, b) {
    if (!adjacent(a, b)) return false;
    if (board[a].special === 'bomb' || board[b].special === 'bomb') return true;
    if (board[a].special && board[b].special) return true;
    swap(board, a, b);
    const valid = matches(board).length > 0;
    swap(board, a, b);
    return valid;
  }
  function findMove(board) {
    for (let a = 0; a < board.length; a++) {
      for (const b of [a % SIZE < SIZE - 1 ? a + 1 : -1, a + SIZE]) {
        if (b >= 0 && b < board.length && validSwap(board, a, b)) return [a, b];
      }
    }
    return null;
  }
  function createBoard() {
    let board;
    do {
      board = [];
      for (let i = 0; i < SIZE * SIZE; i++) {
        let tile;
        do { tile = candy(); } while (
          (i % SIZE >= 2 && board[i - 1].color === tile.color && board[i - 2].color === tile.color) ||
          (i >= SIZE * 2 && board[i - SIZE].color === tile.color && board[i - SIZE * 2].color === tile.color)
        );
        board.push(tile);
      }
    } while (!findMove(board));
    return board;
  }
  function plan(board, groups, preferred = []) {
    const clear = new Set(groups.flatMap(group => group.cells));
    const specials = new Map();
    const intersections = new Set();
    const wraps = new Set();
    for (const group of groups) {
      for (const other of groups) {
        if (group.axis === other.axis) continue;
        for (const cell of group.cells) {
          if (!other.cells.includes(cell)) continue;
          intersections.add(cell);
          // Si algún grupo es de 5 o más, la intersección no se vuelve envuelto.
          if (group.cells.length < 5 && other.cells.length < 5) wraps.add(cell);
        }
      }
    }
    for (const cell of wraps) specials.set(cell, { color: board[cell].color, special: 'wrapped' });
    for (const group of groups) {
      // La bomba se crea aunque haya intersecciones; el rayado no.
      if (group.cells.length < 4 || (group.cells.length < 5 && group.cells.some(cell => intersections.has(cell)))) continue;
      const cell = preferred.find(index => group.cells.includes(index)) ?? group.cells[Math.floor(group.cells.length / 2)];
      const tile = { color: group.cells.length >= 5 ? -1 : board[cell].color, special: group.cells.length >= 5 ? 'bomb' : 'stripe' };
      if (tile.special === 'stripe') {
        const horizontal = preferred.length === 2
          ? Math.floor(preferred[0] / SIZE) === Math.floor(preferred[1] / SIZE)
          : group.axis === 0;
        tile.direction = horizontal ? 'horizontal' : 'vertical';
      }
      specials.set(cell, tile);
    }
    return { clear, specials };
  }
  function expand(board, clear, effects = []) {
    const queue = [...clear];
    const visited = new Set();
    while (queue.length) {
      const index = queue.shift();
      if (visited.has(index)) continue;
      visited.add(index);
      const tile = board[index];
      const affected = [];
      if (tile?.special === 'stripe') {
        const row = Math.floor(index / SIZE) * SIZE;
        const col = index % SIZE;
        for (let x = 0; x < SIZE; x++) affected.push(tile.direction === 'vertical' ? x * SIZE + col : row + x);
      } else if (tile?.special === 'wrapped') {
        for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
          const row = Math.floor(index / SIZE) + y, col = index % SIZE + x;
          if (row >= 0 && row < SIZE && col >= 0 && col < SIZE) affected.push(row * SIZE + col);
        }
      } else if (tile?.special === 'bomb') {
        // Elige el color con más casillas que aún no se limpian; en empate, el de número menor.
        const counts = Array(COLORS).fill(0);
        board.forEach((item, i) => { if (item && item.color >= 0 && !clear.has(i)) counts[item.color]++; });
        const best = Math.max(...counts);
        if (best > 0) {
          const color = counts.indexOf(best);
          board.forEach((item, i) => { if (item?.color === color) affected.push(i); });
        }
      }
      if (tile?.special) effects.push({ type: tile.special, direction: tile.direction, index, targets: affected });
      for (const cell of affected) if (!clear.has(cell)) { clear.add(cell); queue.push(cell); }
    }
    return clear;
  }
  // Un especial ya usado en una combinación no debe volver a activarse en expand.
  const spent = tile => ({ color: tile.color, special: null });
  const cellsWhere = test => {
    const cells = [];
    for (let i = 0; i < SIZE * SIZE; i++) if (test(Math.floor(i / SIZE), i % SIZE)) cells.push(i);
    return cells;
  };
  // Intercambio ya aplicado que involucra especiales. Regresa null si es una combinación normal.
  // b es la casilla destino: ahí se centran cruces y explosiones.
  function combine(board, a, b) {
    const first = board[a], second = board[b];
    const isBomb = [first.special === 'bomb', second.special === 'bomb'];
    if (!isBomb[0] && !isBomb[1] && !(first.special && second.special)) return null;
    const clear = new Set([a, b]);
    const effects = [];
    if (isBomb[0] !== isBomb[1]) {
      const bombCell = isBomb[0] ? a : b;
      const otherCell = isBomb[0] ? b : a, other = board[otherCell];
      if (other.special) {
        // Bomba con rayado o envuelto: todo el color se vuelve ese especial y se activa.
        const targets = [];
        board.forEach((tile, i) => {
          if (tile.color !== other.color) return;
          // Los especiales que ya había conservan su efecto; sólo se convierten dulces normales.
          if (tile.special && i !== otherCell) { clear.add(i); return; }
          board[i] = other.special === 'stripe'
            ? { color: other.color, special: 'stripe', direction: Math.random() < 0.5 ? 'horizontal' : 'vertical' }
            : { color: other.color, special: 'wrapped' };
          targets.push(i);
          clear.add(i);
        });
        effects.push({ type: 'convert', special: other.special, index: bombCell, targets });
        board[bombCell] = spent(board[bombCell]);
        return { clear, effects };
      }
    }
    if (isBomb[0] || isBomb[1]) {
      const both = isBomb[0] && isBomb[1];
      const color = isBomb[0] ? second.color : first.color;
      board.forEach((tile, i) => { if (both || tile.color === color) clear.add(i); });
      for (const index of [a, b]) {
        if (board[index].special !== 'bomb') continue;
        effects.push({ type: 'bomb', index, targets: [...clear] });
        // El color elegido ya está incluido; evita una segunda explosión aleatoria.
        board[index] = spent(board[index]);
      }
      return { clear, effects };
    }
    const row = Math.floor(b / SIZE), col = b % SIZE;
    const kinds = [first.special, second.special].sort().join('+');
    let type, targets;
    if (kinds === 'stripe+stripe') {
      type = 'cross';
      targets = cellsWhere((y, x) => y === row || x === col);
    } else if (kinds === 'wrapped+wrapped') {
      type = 'blast';
      targets = cellsWhere((y, x) => Math.abs(y - row) <= 2 && Math.abs(x - col) <= 2);
    } else {
      type = 'bigcross';
      targets = cellsWhere((y, x) => Math.abs(y - row) <= 1 || Math.abs(x - col) <= 1);
    }
    board[a] = spent(first);
    board[b] = spent(second);
    for (const cell of targets) clear.add(cell);
    effects.push({ type, index: b, targets });
    return { clear, effects };
  }
  function refill(board) {
    for (let col = 0; col < SIZE; col++) {
      const tiles = [];
      for (let row = SIZE - 1; row >= 0; row--) if (board[row * SIZE + col]) tiles.push(board[row * SIZE + col]);
      for (let row = SIZE - 1; row >= 0; row--) board[row * SIZE + col] = tiles[SIZE - 1 - row] || candy();
    }
  }
  return { SIZE, createBoard, matches, swap, adjacent, validSwap, findMove, plan, expand, combine, refill };
})();
if (typeof module !== 'undefined') module.exports = CandyEngine;
