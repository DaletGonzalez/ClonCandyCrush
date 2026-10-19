'use strict';

(() => {
  const engine = CandyEngine;
  const $ = id => document.getElementById(id);
  const names = ['Jardín de azúcar', 'Laguna de caramelo', 'Bosque de gomitas', 'Nubes de merengue', 'Palacio de chocolate'];
  const colors = ['rojo', 'naranja', 'amarillo', 'verde', 'azul', 'morado'];
  const format = value => value.toLocaleString('es-MX');
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('caramelo-club')) || {}; } catch { /* El juego funciona sin almacenamiento. */ }
  let level = Number.isSafeInteger(saved.level) && saved.level > 0 ? Math.min(saved.level, 10000) : 1;
  let record = Number.isSafeInteger(saved.record) && saved.record > 0 ? saved.record : 0;
  let board, selected = null, busy = false, score = 0, goal, finished = false;
  let sound = false, audio, pointerStart = null, suppressClick = false, dialogAction;
  const buttons = [];
  const effects = CandyEffects.create(document.querySelector('.board-shell'), buttons);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function save() {
    try { localStorage.setItem('caramelo-club', JSON.stringify({ level, record })); } catch { /* Almacenamiento opcional. */ }
  }
  function tone(combo = 1) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume();
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(390 + combo * 90, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(780 + combo * 90, audio.currentTime + 0.13);
      gain.gain.setValueAtTime(0.07, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.22);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(); oscillator.stop(audio.currentTime + 0.23);
    } catch { sound = false; updateSound(); }
  }
  function paint(i) {
    const tile = board[i], button = buttons[i];
    button.className = `cell${selected === i ? ' selected' : ''}`;
    if (tile) {
      let element = button.firstElementChild;
      if (!element) {
        element = document.createElement('span');
        button.append(element);
      }
      const className = `candy c${tile.color} ${tile.special || ''} ${tile.direction || ''}`;
      if (element.className !== className) element.className = className;
    } else {
      button.firstElementChild?.remove();
    }
    button.setAttribute('aria-label', `Fila ${Math.floor(i / 8) + 1}, columna ${i % 8 + 1}: ${tile?.special === 'bomb' ? 'bomba de color' : `dulce ${colors[tile?.color] || ''}${tile?.special ? ', especial' : ''}${tile?.direction ? ` ${tile.direction}` : ''}`}`);
    button.setAttribute('aria-pressed', selected === i ? 'true' : 'false');
  }
  function render() {
    board.forEach((tile, i) => paint(i));
    $('score').textContent = format(score);
    $('record').textContent = format(Math.max(record, score));
    const progress = Math.min(100, score / goal * 100);
    $('progress').style.width = `${progress}%`;
    document.querySelector('.progress').setAttribute('aria-valuenow', Math.round(progress));
  }
  function status(text) { $('status').textContent = text; }
  function showDialog(icon, title, text, label, action) {
    $('dialog-icon').textContent = icon;
    $('dialog-title').textContent = title;
    $('dialog-text').textContent = text;
    $('dialog-action').textContent = label;
    dialogAction = action;
    $('overlay').hidden = false;
    $('board').inert = true;
    $('dialog-action').focus();
  }
  function closeDialog() { $('overlay').hidden = true; $('board').inert = false; }
  function start() {
    effects.clear();
    board = engine.createBoard();
    selected = null; score = 0;
    goal = 1500 + (level - 1) * 400; finished = false; busy = false;
    $('level').textContent = level;
    $('goal').textContent = format(goal);
    $('level-name').textContent = $('board-label').textContent = names[(level - 1) % names.length];
    closeDialog(); render(); status('Elige un dulce y uno de sus vecinos.');
  }
  async function fall(previous) {
    const animations = [];
    if (reducedMotion.matches) return;
    const positions = buttons.map(button => button.getBoundingClientRect());
    const step = positions[engine.SIZE].top - positions[0].top;
    board.forEach((tile, index) => {
      if (tile === previous[index]) return;
      const source = previous.indexOf(tile);
      const row = Math.floor(index / engine.SIZE);
      const col = index % engine.SIZE;
      const missing = previous.filter((item, i) => i % engine.SIZE === col && !item).length;
      const sourceRow = source >= 0 ? Math.floor(source / engine.SIZE) : row - missing;
      buttons[index].classList.add('falling');
      const animation = buttons[index].firstElementChild.animate([
        { translate: `0 ${(sourceRow - row) * step}px` },
        { translate: '0 0' }
      ], { duration: 260 + (row - sourceRow) * 35, easing: 'cubic-bezier(.32,0,.7,1)' });
      animations.push(animation.finished);
    });
    await Promise.all(animations);
    buttons.forEach(button => button.classList.remove('falling'));
  }
  async function resolve(initial = null, preferred = [], activated = []) {
    let combo = 0;
    while (true) {
      const groups = engine.matches(board);
      if (!initial && !groups.length) break;
      const result = initial ? { clear: initial, specials: new Map() } : engine.plan(board, groups, preferred);
      initial = null; preferred = [];
      engine.expand(board, result.clear, activated);
      // Un especial que ya existía debe activarse antes de dejar un nuevo dulce.
      for (const index of result.specials.keys()) result.clear.delete(index);
      combo++;
      for (const index of result.clear) buttons[index].classList.add('popping');
      tone(combo);
      const points = result.clear.size * 60 * Math.min(combo, 5) + result.specials.size * 120;
      score += points;
      effects.burst(board, result.clear, activated, points, combo);
      activated = [];
      status(combo > 1 ? `¡Cascada ×${combo}! +${format(result.clear.size * 60 * Math.min(combo, 5))} puntos` : '¡Qué dulce combinación!');
      await delay(reducedMotion.matches ? 0 : 260);
      for (const index of result.clear) board[index] = null;
      for (const [index, tile] of result.specials) board[index] = tile;
      render();
      const previous = board.slice();
      engine.refill(board); render();
      await fall(previous);
    }
    if (score > record) { record = score; save(); }
    if (score >= goal) {
      finished = true;
      showDialog('✦', '¡Dulce victoria!', `Lograste ${format(score)} puntos y superaste el nivel ${level}. El siguiente reto te espera.`, 'Siguiente nivel →', () => { level++; save(); start(); });
    } else if (!engine.findMove(board)) {
      board = engine.createBoard(); render(); status('Mezclamos los dulces: ya hay nuevas jugadas.');
    }
  }
  async function attempt(a, b) {
    if (busy || finished || !$('overlay').hidden) return;
    busy = true; selected = null;
    if (!engine.validSwap(board, a, b)) {
      render(); buttons[a].classList.add('invalid'); buttons[b].classList.add('invalid');
      status('Ese cambio no forma una combinación. Intenta otro.');
      await delay(320); render(); busy = false; return;
    }
    engine.swap(board, a, b); render();
    await delay(150);
    const combo = engine.combine(board, a, b);
    // Muestra los dulces que la bomba convirtió; los especiales gastados se ven igual hasta reventar.
    for (const effect of combo?.effects ?? []) if (effect.type === 'convert') effect.targets.forEach(paint);
    await resolve(combo?.clear ?? null, [b, a], combo?.effects ?? []);
    busy = false;
  }
  function choose(index) {
    if (busy || finished || !$('overlay').hidden) return;
    buttons.forEach(button => button.classList.remove('hint'));
    if (selected === index) selected = null;
    else if (selected !== null && engine.adjacent(selected, index)) { attempt(selected, index); return; }
    else selected = index;
    render();
  }
  for (let i = 0; i < 64; i++) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'cell'; button.dataset.index = i;
    button.addEventListener('click', () => { if (!suppressClick) choose(i); });
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || busy || finished || !$('overlay').hidden) return;
      pointerStart = { index: i, x: event.clientX, y: event.clientY };
    });
    button.addEventListener('keydown', event => {
      const shifts = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 };
      if (!(event.key in shifts)) return;
      event.preventDefault();
      const next = i + shifts[event.key];
      if (next >= 0 && next < 64 && engine.adjacent(i, next)) buttons[next].focus();
    });
    $('board').append(button); buttons.push(button);
  }
  window.addEventListener('pointerup', event => {
    if (!pointerStart) return;
    const { index, x, y } = pointerStart; pointerStart = null;
    const dx = event.clientX - x, dy = event.clientY - y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
    const next = index + (Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : Math.sign(dy) * 8);
    if (next >= 0 && next < 64 && engine.adjacent(index, next)) attempt(index, next);
  });
  window.addEventListener('pointercancel', () => { pointerStart = null; });
  $('hint').addEventListener('click', () => {
    if (busy || finished || !$('overlay').hidden) return;
    selected = null; render();
    const move = engine.findMove(board);
    if (move) { move.forEach(index => buttons[index].classList.add('hint')); status('Prueba intercambiar los dos dulces iluminados.'); }
  });
  $('restart').addEventListener('click', () => {
    if (busy || !$('overlay').hidden) return;
    showDialog('↻', '¿Otra oportunidad?', 'Reiniciarás los puntos y el tablero de este nivel.', 'Reiniciar nivel', start);
    const cancel = document.createElement('button');
    cancel.textContent = 'Seguir jugando'; cancel.className = 'cancel';
    cancel.onclick = () => { cancel.remove(); closeDialog(); buttons[0].focus(); };
    $('dialog-action').after(cancel);
  });
  $('dialog-action').addEventListener('click', () => { document.querySelector('.cancel')?.remove(); dialogAction?.(); });
  $('help').addEventListener('click', () => {
    if (busy || finished || !$('overlay').hidden) return;
    showDialog('✧', 'Un momento para jugar', 'Haz clic en dos dulces vecinos o arrastra uno con el mouse. Combina 3 o más del mismo color y alcanza el objetivo sin límite de movimientos ni tiempo. Al juntar 4, la dirección del intercambio define si el rayado limpia una fila o columna. Cinco en línea hacen bomba aunque formen T o L. Intercambia una bomba con un dulce para eliminar su color (si otro especial la alcanza, elimina el color que más abunde), o dos especiales vecinos para combinarlos. También puedes usar las flechas y Enter.', '¡A combinar!', () => { closeDialog(); buttons[0].focus(); });
  });
  function updateSound() { $('sound').setAttribute('aria-pressed', sound); $('sound').innerHTML = `♫ <span>Sonido ${sound ? 'encendido' : 'apagado'}</span>`; }
  $('sound').addEventListener('click', () => { sound = !sound; updateSound(); if (sound) tone(); });
  start();
})();
