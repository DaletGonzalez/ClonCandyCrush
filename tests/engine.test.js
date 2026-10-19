'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine.js');

const { SIZE } = engine;

// Convierte 8 cadenas en tablero: dígito = dulce normal, '.' = vacío.
function parse(rows) {
  return rows.flatMap(row => [...row].map(ch => (ch === '.' ? null : { color: Number(ch), special: null })));
}
const at = (row, col) => row * SIZE + col;

// Tablero sin combinaciones (sólo colores 0-3; los casos usan 4 y 5).
const NEUTRAL = ['01230123', '23012301', '01230123', '23012301', '01230123', '23012301', '01230123', '23012301'];
const neutral = () => parse(NEUTRAL);
const put = (board, row, col, tile) => { board[at(row, col)] = typeof tile === 'number' ? { color: tile, special: null } : tile; };
const stripe = (color, direction) => ({ color, special: 'stripe', direction });
const wrapped = color => ({ color, special: 'wrapped' });
const bomb = () => ({ color: -1, special: 'bomb' });
const sorted = list => [...list].sort((a, b) => a - b);

// Sustituye Math.random por una secuencia fija y siempre la restaura.
function withRandom(values, fn) {
  const original = Math.random;
  let i = 0;
  Math.random = () => values[i++ % values.length];
  try { return fn(); } finally { Math.random = original; }
}

test('el tablero base no tiene combinaciones', () => {
  assert.equal(engine.matches(neutral()).length, 0);
});

test('adjacent: vecinos sí, diagonal y salto de fila no', () => {
  assert.equal(engine.adjacent(0, 1), true);
  assert.equal(engine.adjacent(1, 0), true);
  assert.equal(engine.adjacent(0, 8), true);
  assert.equal(engine.adjacent(8, 0), true);
  assert.equal(engine.adjacent(0, 9), false);
  assert.equal(engine.adjacent(9, 0), false);
  assert.equal(engine.adjacent(7, 8), false);
  assert.equal(engine.adjacent(8, 7), false);
  assert.equal(engine.adjacent(3, 3), false);
});

test('matches: línea horizontal de 3', () => {
  const board = neutral();
  for (const c of [1, 2, 3]) put(board, 3, c, 4);
  const groups = engine.matches(board);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].axis, 0);
  assert.deepEqual(sorted(groups[0].cells), [at(3, 1), at(3, 2), at(3, 3)]);
});

test('matches: línea vertical de 3', () => {
  const board = neutral();
  for (const r of [2, 3, 4]) put(board, r, 5, 4);
  const groups = engine.matches(board);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].axis, 1);
  assert.deepEqual(sorted(groups[0].cells), [at(2, 5), at(3, 5), at(4, 5)]);
});

test('matches: línea de 2 no cuenta', () => {
  const board = neutral();
  put(board, 3, 1, 4);
  put(board, 3, 2, 4);
  assert.equal(engine.matches(board).length, 0);
});

test('matches: bomba o vacío cortan la línea', () => {
  for (const cut of [bomb(), null]) {
    const board = neutral();
    for (const c of [1, 2, 4, 5]) put(board, 3, c, 4);
    put(board, 3, 3, cut);
    assert.equal(engine.matches(board).length, 0);
  }
});

test('matches: rayado y envuelto del mismo color cuentan en la línea', () => {
  const board = neutral();
  put(board, 3, 1, 4);
  put(board, 3, 2, stripe(4, 'vertical'));
  put(board, 3, 3, wrapped(4));
  const groups = engine.matches(board);
  assert.equal(groups.length, 1);
  assert.deepEqual(sorted(groups[0].cells), [at(3, 1), at(3, 2), at(3, 3)]);
});

test('validSwap: no vecinos es falso', () => {
  assert.equal(engine.validSwap(neutral(), at(0, 0), at(0, 2)), false);
  assert.equal(engine.validSwap(neutral(), at(0, 0), at(1, 1)), false);
});

test('validSwap: el intercambio que forma 3 es válido', () => {
  const board = neutral();
  put(board, 3, 0, 5);
  put(board, 3, 1, 5);
  put(board, 2, 2, 5);
  assert.equal(engine.validSwap(board, at(3, 2), at(2, 2)), true);
});

test('validSwap: sin combinación es falso y el tablero no cambia', () => {
  const board = neutral();
  const before = [...board];
  assert.equal(engine.validSwap(board, at(3, 3), at(3, 4)), false);
  board.forEach((tile, i) => assert.equal(tile, before[i]));
});

test('validSwap: bomba con cualquier vecino es válido', () => {
  const board = neutral();
  put(board, 3, 3, bomb());
  assert.equal(engine.validSwap(board, at(3, 3), at(3, 4)), true);
  assert.equal(engine.validSwap(board, at(2, 3), at(3, 3)), true);
});

test('validSwap: dos especiales vecinos son válidos sin línea', () => {
  const board = neutral();
  put(board, 3, 3, stripe(4, 'horizontal'));
  put(board, 3, 4, wrapped(5));
  assert.equal(engine.validSwap(board, at(3, 3), at(3, 4)), true);
});

// Grupo horizontal de 4 del color 4 en la fila 3, columnas 1-4.
function horizontalFour() {
  const board = neutral();
  for (const c of [1, 2, 3, 4]) put(board, 3, c, 4);
  return board;
}

test('plan: 4 con intercambio horizontal da rayado horizontal en la celda destino', () => {
  const board = horizontalFour();
  const groups = engine.matches(board);
  assert.equal(groups.length, 1);
  const a = at(3, 5), b = at(3, 4);
  const { clear, specials } = engine.plan(board, groups, [b, a]);
  assert.equal(specials.size, 1);
  assert.deepEqual(specials.get(b), { color: 4, special: 'stripe', direction: 'horizontal' });
  for (const c of [1, 2, 3, 4]) assert.ok(clear.has(at(3, c)));
  assert.equal(clear.size, 4);
});

test('plan: 4 con intercambio vertical da rayado vertical en la celda destino', () => {
  const board = horizontalFour();
  const a = at(2, 4), b = at(3, 4);
  const { clear, specials } = engine.plan(board, engine.matches(board), [b, a]);
  assert.equal(specials.size, 1);
  assert.deepEqual(specials.get(b), { color: 4, special: 'stripe', direction: 'vertical' });
  assert.equal(clear.size, 4);
});

test('plan: cascada con 4 horizontal da rayado horizontal en la celda central', () => {
  const board = horizontalFour();
  const groups = engine.matches(board);
  const cell = groups[0].cells[Math.floor(groups[0].cells.length / 2)];
  const { specials } = engine.plan(board, groups, []);
  assert.deepEqual(specials.get(cell), { color: 4, special: 'stripe', direction: 'horizontal' });
});

test('plan: cascada con 4 vertical da rayado vertical en la celda central', () => {
  const board = neutral();
  for (const r of [1, 2, 3, 4]) put(board, r, 2, 5);
  const groups = engine.matches(board);
  assert.equal(groups.length, 1);
  const cell = groups[0].cells[Math.floor(groups[0].cells.length / 2)];
  const { specials } = engine.plan(board, groups, []);
  assert.equal(specials.size, 1);
  assert.deepEqual(specials.get(cell), { color: 5, special: 'stripe', direction: 'vertical' });
});

test('plan: línea de 5 da bomba sin dirección', () => {
  const board = neutral();
  for (const c of [0, 1, 2, 3, 4]) put(board, 3, c, 5);
  const groups = engine.matches(board);
  const { clear, specials } = engine.plan(board, groups, []);
  assert.equal(specials.size, 1);
  const [tile] = specials.values();
  assert.deepEqual(tile, { color: -1, special: 'bomb' });
  assert.equal('direction' in tile, false);
  assert.equal(clear.size, 5);
});

test('plan: forma L o T da envuelto en la celda compartida', () => {
  const board = neutral();
  for (const c of [2, 3, 4]) put(board, 3, c, 4);
  for (const r of [4, 5]) put(board, r, 2, 4);
  const groups = engine.matches(board);
  assert.equal(groups.length, 2);
  const { clear, specials } = engine.plan(board, groups, []);
  assert.equal(specials.size, 1);
  assert.deepEqual(specials.get(at(3, 2)), { color: 4, special: 'wrapped' });
  assert.equal(clear.size, 5);
});

test('plan: línea de 5 con T crea bomba y ningún envuelto', () => {
  const board = neutral();
  for (const c of range(1, 5)) put(board, 3, c, 4);
  for (const r of [4, 5]) put(board, r, 3, 4);
  const groups = engine.matches(board);
  assert.equal(groups.length, 2);
  const horizontal = groups.find(g => g.axis === 0);
  const { clear, specials } = engine.plan(board, groups, []);
  assert.equal(specials.size, 1);
  assert.deepEqual(specials.get(horizontal.cells[2]), { color: -1, special: 'bomb' });
  assert.equal(clear.size, 7);
});

test('plan: línea de 5 con L crea la bomba en la celda preferida', () => {
  const board = neutral();
  for (const c of range(1, 5)) put(board, 3, c, 4);
  for (const r of [4, 5]) put(board, r, 1, 4);
  const groups = engine.matches(board);
  assert.equal(groups.length, 2);
  const { clear, specials } = engine.plan(board, groups, [at(3, 2), at(2, 2)]);
  assert.equal(specials.size, 1);
  assert.deepEqual(specials.get(at(3, 2)), { color: -1, special: 'bomb' });
  assert.equal(clear.size, 7);
});

test('plan: grupo de 3 no crea especiales', () => {
  const board = neutral();
  for (const c of [1, 2, 3]) put(board, 3, c, 4);
  const { clear, specials } = engine.plan(board, engine.matches(board), []);
  assert.equal(specials.size, 0);
  assert.equal(clear.size, 3);
});

test('expand: rayado horizontal limpia la fila', () => {
  const board = neutral();
  put(board, 3, 4, stripe(4, 'horizontal'));
  const effects = [];
  const clear = engine.expand(board, new Set([at(3, 4)]), effects);
  assert.deepEqual(sorted(clear), Array.from({ length: SIZE }, (_, c) => at(3, c)));
  assert.equal(effects.length, 1);
  assert.equal(effects[0].type, 'stripe');
  assert.equal(effects[0].direction, 'horizontal');
  assert.equal(effects[0].index, at(3, 4));
  assert.deepEqual(sorted(effects[0].targets), sorted(clear));
});

test('expand: rayado vertical limpia la columna', () => {
  const board = neutral();
  put(board, 3, 4, stripe(4, 'vertical'));
  const effects = [];
  const clear = engine.expand(board, new Set([at(3, 4)]), effects);
  assert.deepEqual(sorted(clear), Array.from({ length: SIZE }, (_, r) => at(r, 4)));
  assert.equal(effects.length, 1);
  assert.equal(effects[0].direction, 'vertical');
});

test('expand: envuelto en la esquina limpia 4 celdas', () => {
  const board = neutral();
  put(board, 0, 0, wrapped(4));
  const clear = engine.expand(board, new Set([at(0, 0)]), []);
  assert.deepEqual(sorted(clear), [at(0, 0), at(0, 1), at(1, 0), at(1, 1)]);
});

test('expand: envuelto en el centro limpia 9 celdas', () => {
  const board = neutral();
  put(board, 3, 3, wrapped(4));
  const clear = engine.expand(board, new Set([at(3, 3)]), []);
  const expected = [];
  for (let r = 2; r <= 4; r++) for (let c = 2; c <= 4; c++) expected.push(at(r, c));
  assert.deepEqual(sorted(clear), expected);
});

test('expand: cadena de rayado a envuelto', () => {
  const board = neutral();
  put(board, 3, 1, stripe(4, 'horizontal'));
  put(board, 3, 6, wrapped(5));
  const effects = [];
  const clear = engine.expand(board, new Set([at(3, 1)]), effects);
  const expected = new Set(Array.from({ length: SIZE }, (_, c) => at(3, c)));
  for (let r = 2; r <= 4; r++) for (let c = 5; c <= 7; c++) expected.add(at(r, c));
  assert.deepEqual(sorted(clear), sorted(expected));
  assert.equal(effects.length, 2);
  assert.deepEqual(effects.map(e => e.type), ['stripe', 'wrapped']);
});

test('expand: bomba limpia todas las celdas del color más abundante (empate: el menor)', () => {
  const board = neutral();
  // La bomba ocupa una casilla de color 3: quedan 0, 1 y 2 empatados con 16.
  put(board, 0, 3, bomb());
  const clear = engine.expand(board, new Set([at(0, 3)]), []);
  const expected = [at(0, 3), ...cellsOfColor(board, 0)];
  assert.ok(expected.length > 1);
  assert.deepEqual(sorted(clear), sorted(expected));
});

test('expand: bomba elige el color que tiene más casillas', () => {
  const board = neutral();
  const changed = cellsOfColor(board, 1).slice(0, 3);
  for (const i of changed) board[i] = { color: 2, special: null };
  assert.equal(cellsOfColor(board, 2).length, 19);
  put(board, 0, 0, bomb());
  const clear = engine.expand(board, new Set([at(0, 0)]), []);
  assert.deepEqual(sorted(clear), sorted([at(0, 0), ...cellsOfColor(board, 2)]));
});

test('expand: bomba alcanzada por un rayado limpia la fila y el color más abundante', () => {
  const board = neutral();
  put(board, 3, 0, stripe(4, 'horizontal'));
  put(board, 3, 5, bomb());
  const counts = Array(6).fill(0);
  // Sólo cuentan las casillas fuera de la fila que ya limpia el rayado.
  board.forEach((tile, i) => { if (tile.color >= 0 && Math.floor(i / SIZE) !== 3) counts[tile.color]++; });
  const color = counts.indexOf(Math.max(...counts));
  const effects = [];
  const clear = engine.expand(board, new Set([at(3, 0)]), effects);
  const expected = new Set([...lines([3], []), ...cellsOfColor(board, color)]);
  assert.deepEqual(sorted(clear), sorted(expected));
  assert.deepEqual(effects.map(e => e.type), ['stripe', 'bomb']);
});

test('expand: dos bombas en cadena eligen colores distintos', () => {
  const board = neutral();
  put(board, 3, 0, stripe(4, 'horizontal'));
  put(board, 3, 2, bomb());
  put(board, 3, 6, bomb());
  const effects = [];
  const clear = engine.expand(board, new Set([at(3, 0)]), effects);
  const bombs = effects.filter(e => e.type === 'bomb');
  assert.equal(bombs.length, 2);
  const colorOf = effect => board[effect.targets.find(i => Math.floor(i / SIZE) !== 3)].color;
  assert.notEqual(colorOf(bombs[0]), colorOf(bombs[1]));
  for (const effect of bombs) for (const cell of effect.targets) assert.ok(clear.has(cell));
});

test('refill: los dulces caen conservando objetos y orden', () => {
  const board = neutral();
  const col = 3;
  put(board, 5, col, null);
  put(board, 2, col, null);
  put(board, 0, col, null);
  const others = board.map((tile, i) => (i % SIZE === col ? undefined : tile));
  const survivors = [1, 3, 4, 6, 7].map(r => board[at(r, col)]);
  withRandom([0.1, 0.9, 0.5], () => engine.refill(board));
  assert.equal(board.length, SIZE * SIZE);
  board.forEach(tile => assert.notEqual(tile, null));
  // Los 5 existentes quedan en las filas 3-7, mismos objetos y orden.
  survivors.forEach((tile, i) => assert.equal(board[at(3 + i, col)], tile));
  // Arriba, 3 dulces nuevos normales con color válido.
  for (let r = 0; r < 3; r++) {
    const tile = board[at(r, col)];
    assert.equal(tile.special, null);
    assert.ok(Number.isInteger(tile.color) && tile.color >= 0 && tile.color <= 5);
  }
  // Las demás columnas no cambian.
  board.forEach((tile, i) => { if (i % SIZE !== col) assert.equal(tile, others[i]); });
});

test('createBoard: 200 tableros válidos', () => {
  for (let n = 0; n < 200; n++) {
    const board = engine.createBoard();
    assert.equal(board.length, SIZE * SIZE);
    for (const tile of board) {
      assert.equal(tile.special, null);
      assert.ok(tile.color >= 0 && tile.color <= 5);
    }
    assert.equal(engine.matches(board).length, 0);
    assert.notEqual(engine.findMove(board), null);
  }
});

test('findMove: regresa la única jugada posible', () => {
  const board = neutral();
  assert.equal(engine.findMove(board), null);
  put(board, 3, 0, 5);
  put(board, 3, 1, 5);
  put(board, 2, 2, 5);
  // Todas las jugadas válidas por fuerza bruta.
  const valid = [];
  for (let a = 0; a < board.length; a++) {
    for (const b of [a + 1, a + SIZE]) {
      if (b < board.length && engine.adjacent(a, b) && engine.validSwap(board, a, b)) valid.push([a, b]);
    }
  }
  assert.equal(valid.length, 1);
  const move = engine.findMove(board);
  assert.deepEqual(sorted(move), sorted(valid[0]));
  assert.deepEqual(sorted(move), [at(2, 2), at(3, 2)]);
  assert.equal(engine.validSwap(board, move[0], move[1]), true);
});

test('findMove: sin jugadas regresa null', () => {
  assert.equal(engine.findMove(neutral()), null);
});

test('combine: intercambio sin especiales regresa null', () => {
  const board = neutral();
  assert.equal(engine.combine(board, at(3, 3), at(3, 4)), null);
  assert.equal(engine.combine(board, at(3, 3), at(2, 3)), null);
});

test('combine: un solo especial (sin bomba) regresa null', () => {
  const board = neutral();
  put(board, 3, 3, stripe(4, 'horizontal'));
  assert.equal(engine.combine(board, at(3, 3), at(3, 4)), null);
});

test('combine: bomba con dulce normal limpia ese color y apaga la bomba', () => {
  const board = neutral();
  put(board, 3, 3, bomb());
  const color = board[at(3, 4)].color;
  const { clear, effects } = engine.combine(board, at(3, 3), at(3, 4));
  const expected = new Set([at(3, 3)]);
  board.forEach((tile, i) => { if (tile.color === color) expected.add(i); });
  assert.deepEqual(sorted(clear), sorted(expected));
  assert.equal(effects.length, 1);
  assert.equal(effects[0].type, 'bomb');
  assert.equal(effects[0].index, at(3, 3));
  assert.deepEqual(sorted(effects[0].targets), sorted(clear));
  assert.equal(board[at(3, 3)].special, null);
});

test('combine: bomba con bomba limpia todo el tablero', () => {
  const board = neutral();
  put(board, 3, 3, bomb());
  put(board, 3, 4, bomb());
  const { clear, effects } = engine.combine(board, at(3, 3), at(3, 4));
  assert.equal(clear.size, SIZE * SIZE);
  assert.deepEqual(effects.map(e => e.index), [at(3, 3), at(3, 4)]);
  for (const effect of effects) assert.equal(effect.targets.length, SIZE * SIZE);
  assert.equal(board[at(3, 3)].special, null);
  assert.equal(board[at(3, 4)].special, null);
});

// Celdas de las filas y columnas indicadas (unión).
function lines(rows, cols) {
  const cells = new Set();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (rows.includes(r) || cols.includes(c)) cells.add(at(r, c));
  return cells;
}
// Celdas del rectángulo filas × columnas.
function block(rows, cols) {
  const cells = new Set();
  for (const r of rows) for (const c of cols) cells.add(at(r, c));
  return cells;
}
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
// Casillas del tablero con el color dado.
const cellsOfColor = (board, color) => {
  const cells = [];
  board.forEach((tile, i) => { if (tile.color === color) cells.push(i); });
  return cells;
};

test('combine: rayado + rayado limpia fila y columna del destino', () => {
  for (const [d1, d2] of [['horizontal', 'vertical'], ['horizontal', 'horizontal'], ['vertical', 'vertical']]) {
    const board = neutral();
    put(board, 3, 3, stripe(4, d1));
    put(board, 3, 4, stripe(5, d2));
    const { clear, effects } = engine.combine(board, at(3, 3), at(3, 4));
    const expected = lines([3], [4]);
    assert.equal(expected.size, 15);
    assert.deepEqual(sorted(clear), sorted(expected));
    assert.equal(effects.length, 1);
    assert.equal(effects[0].type, 'cross');
    assert.equal(effects[0].index, at(3, 4));
    assert.deepEqual(sorted(effects[0].targets), sorted(expected));
    assert.equal(board[at(3, 3)].special, null);
    assert.equal(board[at(3, 4)].special, null);
  }
});

test('combine: rayado + rayado en la orilla', () => {
  const board = neutral();
  put(board, 0, 1, stripe(4, 'horizontal'));
  put(board, 0, 0, stripe(5, 'vertical'));
  const { clear, effects } = engine.combine(board, at(0, 1), at(0, 0));
  assert.deepEqual(sorted(clear), sorted(lines([0], [0])));
  assert.equal(effects[0].type, 'cross');
  assert.equal(effects[0].index, at(0, 0));
  assert.deepEqual(sorted(effects[0].targets), sorted(lines([0], [0])));
  assert.equal(board[at(0, 0)].special, null);
  assert.equal(board[at(0, 1)].special, null);
});

test('combine: rayado + envuelto (ambos órdenes) limpia tres filas y tres columnas', () => {
  for (const stripeFirst of [true, false]) {
    const board = neutral();
    put(board, 3, 3, stripeFirst ? stripe(4, 'horizontal') : wrapped(5));
    put(board, 3, 4, stripeFirst ? wrapped(5) : stripe(4, 'vertical'));
    const { clear, effects } = engine.combine(board, at(3, 3), at(3, 4));
    const expected = lines([2, 3, 4], [3, 4, 5]);
    assert.equal(expected.size, 39);
    assert.deepEqual(sorted(clear), sorted(expected));
    assert.equal(effects.length, 1);
    assert.equal(effects[0].type, 'bigcross');
    assert.equal(effects[0].index, at(3, 4));
    assert.deepEqual(sorted(effects[0].targets), sorted(expected));
    assert.equal(board[at(3, 3)].special, null);
    assert.equal(board[at(3, 4)].special, null);
  }
});

test('combine: rayado + envuelto en la orilla', () => {
  const board = neutral();
  put(board, 0, 1, stripe(4, 'horizontal'));
  put(board, 0, 0, wrapped(5));
  const { clear, effects } = engine.combine(board, at(0, 1), at(0, 0));
  const expected = lines([0, 1], [0, 1]);
  assert.equal(expected.size, 28);
  assert.deepEqual(sorted(clear), sorted(expected));
  assert.equal(effects[0].type, 'bigcross');
  assert.equal(effects[0].index, at(0, 0));
  assert.equal(board[at(0, 0)].special, null);
  assert.equal(board[at(0, 1)].special, null);
});

test('combine: envuelto + envuelto limpia el cuadro de 5x5', () => {
  const board = neutral();
  put(board, 3, 3, wrapped(4));
  put(board, 3, 4, wrapped(5));
  const { clear, effects } = engine.combine(board, at(3, 3), at(3, 4));
  const expected = block(range(1, 5), range(2, 6));
  assert.equal(expected.size, 25);
  assert.deepEqual(sorted(clear), sorted(expected));
  assert.equal(effects.length, 1);
  assert.equal(effects[0].type, 'blast');
  assert.equal(effects[0].index, at(3, 4));
  assert.deepEqual(sorted(effects[0].targets), sorted(expected));
  assert.equal(board[at(3, 3)].special, null);
  assert.equal(board[at(3, 4)].special, null);
});

test('combine: envuelto + envuelto en la esquina limpia 3x3', () => {
  const board = neutral();
  put(board, 0, 1, wrapped(4));
  put(board, 0, 0, wrapped(5));
  const { clear } = engine.combine(board, at(0, 1), at(0, 0));
  assert.deepEqual(sorted(clear), sorted(block(range(0, 2), range(0, 2))));
  assert.equal(board[at(0, 0)].special, null);
  assert.equal(board[at(0, 1)].special, null);
});

test('combine: bomba + rayado convierte el color en rayados con la dirección fijada', () => {
  for (const bombFirst of [true, false]) {
    for (const [value, direction] of [[0.2, 'horizontal'], [0.8, 'vertical']]) {
      const board = neutral();
      put(board, 3, 3, bombFirst ? bomb() : stripe(2, 'vertical'));
      put(board, 3, 4, bombFirst ? stripe(2, 'vertical') : bomb());
      const bombCell = bombFirst ? at(3, 3) : at(3, 4);
      const colored = cellsOfColor(board, 2);
      assert.ok(colored.length > 2);
      const { clear, effects } = withRandom([value], () => engine.combine(board, at(3, 3), at(3, 4)));
      for (const i of colored) assert.deepEqual(board[i], stripe(2, direction));
      assert.deepEqual(sorted(clear), sorted([bombCell, ...colored]));
      assert.equal(effects.length, 1);
      assert.equal(effects[0].type, 'convert');
      assert.equal(effects[0].special, 'stripe');
      assert.equal(effects[0].index, bombCell);
      assert.deepEqual(sorted(effects[0].targets), sorted(colored));
      assert.equal(board[bombCell].special, null);
    }
  }
});

test('combine: bomba + rayado puede sortear ambas direcciones', () => {
  const board = neutral();
  put(board, 3, 3, bomb());
  put(board, 3, 4, stripe(2, 'vertical'));
  const colored = cellsOfColor(board, 2);
  withRandom([0.2, 0.8], () => engine.combine(board, at(3, 3), at(3, 4)));
  const directions = new Set(colored.map(i => board[i].direction));
  assert.deepEqual([...directions].sort(), ['horizontal', 'vertical']);
});

test('combine: bomba + envuelto convierte el color en envueltos', () => {
  for (const bombFirst of [true, false]) {
    const board = neutral();
    put(board, 3, 3, bombFirst ? bomb() : wrapped(2));
    put(board, 3, 4, bombFirst ? wrapped(2) : bomb());
    const bombCell = bombFirst ? at(3, 3) : at(3, 4);
    const colored = cellsOfColor(board, 2);
    assert.ok(colored.length > 2);
    const { clear, effects } = engine.combine(board, at(3, 3), at(3, 4));
    for (const i of colored) assert.deepEqual(board[i], wrapped(2));
    assert.deepEqual(sorted(clear), sorted([bombCell, ...colored]));
    assert.equal(effects.length, 1);
    assert.equal(effects[0].type, 'convert');
    assert.equal(effects[0].special, 'wrapped');
    assert.equal(effects[0].index, bombCell);
    assert.deepEqual(sorted(effects[0].targets), sorted(colored));
    assert.equal(board[bombCell].special, null);
  }
});

test('expand tras rayado + rayado: no reactiva los rayados ni agrega celdas', () => {
  const board = neutral();
  put(board, 3, 3, stripe(4, 'horizontal'));
  put(board, 3, 4, stripe(5, 'vertical'));
  const { clear, effects } = engine.combine(board, at(3, 3), at(3, 4));
  const before = sorted(clear);
  const expanded = engine.expand(board, clear, effects);
  assert.deepEqual(sorted(expanded), before);
  assert.equal(effects.length, 1);
});

test('expand tras rayado + rayado: un envuelto en la cruz agrega su 3x3', () => {
  const board = neutral();
  put(board, 3, 3, stripe(4, 'horizontal'));
  put(board, 3, 4, stripe(5, 'vertical'));
  put(board, 6, 4, wrapped(5));
  const { clear, effects } = engine.combine(board, at(3, 3), at(3, 4));
  const expanded = engine.expand(board, clear, effects);
  const expected = lines([3], [4]);
  for (const cell of block(range(5, 7), range(3, 5))) expected.add(cell);
  assert.deepEqual(sorted(expanded), sorted(expected));
  assert.deepEqual(effects.map(e => e.type), ['cross', 'wrapped']);
});

test('combine: bomba + rayado conserva los especiales que ya había de ese color', () => {
  const board = neutral();
  put(board, 3, 3, bomb());
  put(board, 3, 4, stripe(2, 'horizontal'));
  const other = at(6, 6);
  put(board, 6, 6, wrapped(2));
  const { clear, effects } = withRandom([0.2], () => engine.combine(board, at(3, 3), at(3, 4)));
  assert.equal(board[other].special, 'wrapped');
  assert.ok(clear.has(other));
  assert.equal(effects[0].targets.includes(other), false);
  assert.equal(board[at(3, 4)].special, 'stripe');
});

// Sustituye Math.random por un generador determinista (mulberry32) y siempre lo restaura.
function withSeed(seed, fn) {
  const original = Math.random;
  let s = seed >>> 0;
  Math.random = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try { return fn(); } finally { Math.random = original; }
}

// Todas las jugadas válidas por fuerza bruta.
function validMoves(board) {
  const valid = [];
  for (let a = 0; a < board.length; a++) {
    for (const b of [a + 1, a + SIZE]) {
      if (b < board.length && engine.adjacent(a, b) && engine.validSwap(board, a, b)) valid.push([a, b]);
    }
  }
  return valid;
}
// Arma una línea de 3 (fila 0-1), de 4 y de 5 (filas 5-6) con una jugada cada una.
function threeMove(board, color) {
  put(board, 0, 5, color); put(board, 0, 6, color); put(board, 1, 7, color);
  return [at(0, 7), at(1, 7)];
}
function fourMove(board, color, row = 6) {
  for (const c of [0, 1, 3]) put(board, row, c, color);
  put(board, row - 1, 2, color);
  return [at(row - 1, 2), at(row, 2)];
}
function fiveMove(board, color, row = 6) {
  for (const c of [0, 1, 3, 4]) put(board, row, c, color);
  put(board, row - 1, 2, color);
  return [at(row - 1, 2), at(row, 2)];
}

test('bestMove: sin jugadas regresa null', () => {
  assert.equal(engine.bestMove(neutral()), null);
});

test('bestMove: con una sola jugada regresa la de findMove', () => {
  const board = neutral();
  put(board, 3, 0, 5);
  put(board, 3, 1, 5);
  put(board, 2, 2, 5);
  assert.equal(validMoves(board).length, 1);
  assert.deepEqual(engine.bestMove(board), engine.findMove(board));
});

test('bestMove: combo de dos especiales gana sobre una línea de 5', () => {
  const board = neutral();
  put(board, 5, 4, stripe(4, 'horizontal'));
  put(board, 5, 5, wrapped(4));
  // La línea de 5 queda antes en el orden de búsqueda que el combo.
  const five = fiveMove(board, 5, 2);
  assert.ok(validMoves(board).some(([a, b]) => a === five[0] && b === five[1]));
  assert.deepEqual(engine.findMove(board), five);
  assert.deepEqual(engine.bestMove(board), [at(5, 4), at(5, 5)]);
  assert.notDeepEqual(engine.bestMove(board), engine.findMove(board));
});

test('bestMove: envuelto (L de 3+3) gana sobre un rayado (línea de 4)', () => {
  const board = neutral();
  const four = fourMove(board, 5, 1);
  // L con esquina en (5,2): al bajar el 4 de (4,2) se forman fila 5 y columna 2.
  for (const [r, c] of [[5, 0], [5, 1], [6, 2], [7, 2], [4, 2]]) put(board, r, c, 4);
  assert.deepEqual(engine.findMove(board), four);
  assert.deepEqual(sorted(engine.bestMove(board)), [at(4, 2), at(5, 2)]);
  assert.notDeepEqual(engine.bestMove(board), engine.findMove(board));
});

test('bestMove: línea de 5 gana sobre una de 4', () => {
  const board = neutral();
  const four = fourMove(board, 4, 2);
  const five = fiveMove(board, 5);
  // Las jugadas de cada línea existen; la de 5 puntúa más que cualquiera de las otras.
  assert.ok(validMoves(board).length >= 2);
  assert.notDeepEqual(engine.bestMove(board), four);
  assert.deepEqual(engine.bestMove(board), five);
});

test('bestMove: línea de 4 gana sobre una de 3', () => {
  const board = neutral();
  const three = threeMove(board, 4);
  const four = fourMove(board, 5);
  assert.ok(validMoves(board).length >= 2);
  assert.notDeepEqual(engine.bestMove(board), three);
  assert.deepEqual(engine.bestMove(board), four);
});

test('bestMove: no modifica el tablero ni los dulces', () => {
  const board = neutral();
  put(board, 1, 4, stripe(4, 'horizontal'));
  put(board, 1, 5, wrapped(4));
  put(board, 3, 0, bomb());
  fiveMove(board, 5);
  const json = JSON.stringify(board);
  const refs = board.slice();
  assert.notEqual(engine.bestMove(board), null);
  assert.equal(JSON.stringify(board), json);
  board.forEach((tile, i) => assert.equal(tile, refs[i]));
});

test('bestMove: la conversión de bomba con rayado tampoco modifica el tablero', () => {
  const board = neutral();
  put(board, 3, 0, bomb());
  put(board, 3, 1, stripe(2, 'horizontal'));
  const json = JSON.stringify(board);
  const refs = board.slice();
  assert.notEqual(engine.bestMove(board), null);
  assert.equal(JSON.stringify(board), json);
  board.forEach((tile, i) => assert.equal(tile, refs[i]));
});

test('bestMove: no consume Math.random', () => {
  const board = neutral();
  put(board, 3, 0, bomb());
  put(board, 3, 1, stripe(2, 'horizontal'));
  const original = Math.random;
  Math.random = () => { throw new Error('Math.random no debe usarse'); };
  try { assert.notEqual(engine.bestMove(board), null); } finally { Math.random = original; }
});

test('shuffle: deja un tablero sin combinaciones, con jugada y los mismos dulces', () => {
  const board = neutral();
  const originals = new Set(board);
  assert.equal(withSeed(7, () => engine.shuffle(board)), true);
  assert.equal(engine.matches(board).length, 0);
  assert.notEqual(engine.findMove(board), null);
  assert.equal(board.length, SIZE * SIZE);
  assert.equal(new Set(board).size, SIZE * SIZE);
  for (const tile of board) assert.ok(originals.has(tile));
});

test('shuffle: conserva los especiales y su dirección', () => {
  const board = neutral();
  const s = stripe(4, 'vertical'), w = wrapped(5);
  put(board, 2, 2, s);
  put(board, 5, 5, w);
  assert.equal(withSeed(11, () => engine.shuffle(board)), true);
  assert.ok(board.includes(s) && board.includes(w));
  assert.equal(s.special, 'stripe');
  assert.equal(s.direction, 'vertical');
  assert.equal(w.special, 'wrapped');
});

test('shuffle: la misma semilla da el mismo orden', () => {
  const first = neutral(), second = neutral();
  for (const board of [first, second]) put(board, 4, 4, stripe(4, 'horizontal'));
  assert.equal(withSeed(42, () => engine.shuffle(first)), true);
  assert.equal(withSeed(42, () => engine.shuffle(second)), true);
  const key = board => board.map(t => `${t.color}${t.special ?? ''}${t.direction ?? ''}`);
  assert.deepEqual(key(first), key(second));
});

test('shuffle: sin solución regresa false y restaura el orden', () => {
  const board = Array.from({ length: SIZE * SIZE }, () => ({ color: 1, special: null }));
  const refs = board.slice();
  assert.equal(withSeed(3, () => engine.shuffle(board)), false);
  board.forEach((tile, i) => assert.equal(tile, refs[i]));
});
