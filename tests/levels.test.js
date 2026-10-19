'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { levelConfig, stars } = require('../levels.js');

test('colores por nivel', () => {
  for (let level = 1; level <= 6; level++) assert.equal(levelConfig(level).colors, 5);
  assert.equal(levelConfig(7).colors, 6);
  assert.equal(levelConfig(30).colors, 6);
});

test('ciclo de tipos de objetivo', () => {
  const expected = { 1: 'score', 2: 'colors', 3: 'jelly', 4: 'score', 5: 'colors', 6: 'jelly', 9: 'jelly' };
  for (const [level, type] of Object.entries(expected)) assert.equal(levelConfig(Number(level)).type, type);
});

test('meta de puntos', () => {
  assert.equal(levelConfig(1).goal, 4000);
  assert.equal(levelConfig(10).goal, 4000 + 9 * 900);
});

test('objetivo de colores', () => {
  for (const level of [2, 5, 8, 20, 29]) {
    const { targets, colors } = levelConfig(level);
    assert.equal(targets.length, 2);
    assert.notEqual(targets[0].color, targets[1].color);
    for (const target of targets) {
      assert.ok(target.color >= 0 && target.color < colors);
      assert.equal(target.count, Math.min(60, 15 + 3 * level));
    }
  }
  assert.equal(levelConfig(20).targets[0].count, 60);
  assert.equal(levelConfig(29).targets[0].count, 60);
});

test('gelatina en cuadro centrado', () => {
  const sizes = { 3: 16, 6: 36, 15: 36, 18: 64 };
  for (const [level, size] of Object.entries(sizes)) {
    const { jelly } = levelConfig(Number(level));
    assert.equal(jelly.length, size);
    assert.equal(new Set(jelly).size, size);
    const side = Math.sqrt(size), start = (8 - side) / 2;
    const rows = new Set(jelly.map(i => Math.floor(i / 8)));
    const cols = new Set(jelly.map(i => i % 8));
    assert.deepEqual([...rows].sort((a, b) => a - b), Array.from({ length: side }, (_, i) => start + i));
    assert.deepEqual([...cols].sort((a, b) => a - b), Array.from({ length: side }, (_, i) => start + i));
  }
});

test('par entero de al menos 5', () => {
  for (let level = 1; level <= 30; level++) {
    const { par } = levelConfig(level);
    assert.ok(Number.isInteger(par) && par >= 5, `nivel ${level}: par ${par}`);
  }
});

test('estrellas según el par', () => {
  assert.equal(stars(10, 10), 3);
  assert.equal(stars(11, 10), 2);
  assert.equal(stars(15, 10), 2);
  assert.equal(stars(16, 10), 1);
  assert.equal(stars(0, 10), 3);
});

test('hintBonus: gelatina, colores que faltan y nada en puntos', () => {
  const { levelConfig, hintBonus } = require('../levels.js');
  assert.equal(hintBonus(levelConfig(1), Array(6).fill(0), new Set()), null);
  const jellyBonus = hintBonus(levelConfig(3), Array(6).fill(0), new Set([27, 28]));
  assert.equal(jellyBonus([27, 28, 0], []), 10);
  const config = levelConfig(2);
  const [first, second] = config.targets;
  const collected = Array(6).fill(0);
  collected[first.color] = first.count;
  const board = [{ color: first.color }, { color: second.color }, { color: second.color }];
  assert.equal(hintBonus(config, collected, new Set())([0, 1, 2], board), 6);
});
