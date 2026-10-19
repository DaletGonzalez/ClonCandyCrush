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

test('expand: bomba limpia todas las celdas del color elegido', () => {
  const board = neutral();
  put(board, 0, 0, bomb());
  // 0.5 * 6 = 3 -> color 3
  const clear = withRandom([0.5], () => engine.expand(board, new Set([at(0, 0)]), []));
  const expected = [at(0, 0)];
  board.forEach((tile, i) => { if (tile.color === 3) expected.push(i); });
  assert.ok(expected.length > 1);
  assert.deepEqual(sorted(clear), sorted(expected));
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

test('combine: dos especiales sin bomba limpian ambas celdas para que se activen', () => {
  const board = neutral();
  put(board, 3, 3, stripe(4, 'horizontal'));
  put(board, 3, 4, wrapped(5));
  const { clear, effects } = engine.combine(board, at(3, 3), at(3, 4));
  assert.deepEqual(sorted(clear), [at(3, 3), at(3, 4)]);
  assert.equal(effects.length, 0);
  assert.equal(board[at(3, 3)].special, 'stripe');
});
