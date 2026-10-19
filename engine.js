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
    for (const group of groups) {
      for (const other of groups) {
        if (group.axis !== other.axis) for (const cell of group.cells) if (other.cells.includes(cell)) intersections.add(cell);
      }
    }
    for (const cell of intersections) specials.set(cell, { color: board[cell].color, special: 'wrapped' });
    for (const group of groups) {
      if (group.cells.length < 4 || group.cells.some(cell => intersections.has(cell))) continue;
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
        const color = Math.floor(Math.random() * COLORS);
        board.forEach((item, i) => { if (item?.color === color) affected.push(i); });
      }
      if (tile?.special) effects.push({ type: tile.special, direction: tile.direction, index, targets: affected });
      for (const cell of affected) if (!clear.has(cell)) { clear.add(cell); queue.push(cell); }
    }
    return clear;
  }
  // Intercambio ya aplicado que involucra especiales. Regresa null si es una combinación normal.
  function combine(board, a, b) {
    const first = board[a], second = board[b];
    if (first.special !== 'bomb' && second.special !== 'bomb') {
      return first.special && second.special ? { clear: new Set([a, b]), effects: [] } : null;
    }
    const both = first.special === 'bomb' && second.special === 'bomb';
    const color = first.special === 'bomb' ? second.color : first.color;
    const clear = new Set([a, b]);
    board.forEach((tile, i) => { if (both || tile.color === color) clear.add(i); });
    const effects = [];
    for (const index of [a, b]) {
      if (board[index].special !== 'bomb') continue;
      effects.push({ type: 'bomb', index, targets: [...clear] });
      // El color elegido ya está incluido; evita una segunda explosión aleatoria.
      board[index] = { ...board[index], special: null };
    }
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
