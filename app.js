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
  // Mejor resultado por nivel: { [nivel]: { stars, score } }; stars 0 = aún no superado.
  const levels = {};
  for (const [key, entry] of Object.entries(saved.levels && typeof saved.levels === 'object' ? saved.levels : {})) {
    const n = Number(key);
    if (Number.isSafeInteger(n) && n > 0 && [0, 1, 2, 3].includes(entry?.stars) && Number.isSafeInteger(entry?.score) && entry.score >= 0) levels[n] = { stars: entry.stars, score: entry.score };
  }
  // Formato viejo: el récord global pasa al nivel guardado.
  if (!saved.levels && Number.isSafeInteger(saved.record) && saved.record > 0) levels[level] = { stars: 0, score: saved.record };
  let board, selected = null, busy = false, score = 0, finished = false;
  let config, moves = 0, collected = [], jelly = new Set();
  let sound = false, audio, pointerStart = null, suppressClick = false, dialogAction, hintTimer = null;
  const buttons = [];
  const effects = CandyEffects.create(document.querySelector('.board-shell'), buttons);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function save() {
    try { localStorage.setItem('caramelo-club', JSON.stringify({ level, levels })); } catch { /* Almacenamiento opcional. */ }
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
    button.className = `cell${selected === i ? ' selected' : ''}${jelly.has(i) ? ' jelly' : ''}`;
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
    button.setAttribute('aria-label', `Fila ${Math.floor(i / 8) + 1}, columna ${i % 8 + 1}: ${tile?.special === 'bomb' ? 'bomba de color' : `dulce ${colors[tile?.color] || ''}${tile?.special ? ', especial' : ''}${tile?.direction ? ` ${tile.direction}` : ''}`}${jelly.has(i) ? ', con gelatina' : ''}`);
    button.setAttribute('aria-pressed', selected === i ? 'true' : 'false');
  }
  function row(icon, text, done) {
    const item = document.createElement('div');
    item.className = done ? 'obj-row done' : 'obj-row';
    const label = document.createElement('span');
    label.textContent = done ? `${text} ✓` : text;
    item.append(icon, label);
    return item;
  }
  function renderObjective() {
    const box = $('objective');
    if (config.type === 'score') {
      const line = document.createElement('div');
      line.className = 'goal-line';
      const label = document.createElement('span'), value = document.createElement('strong');
      label.textContent = 'Objetivo';
      value.textContent = format(config.goal);
      line.append(label, value);
      box.replaceChildren(line);
    } else if (config.type === 'colors') {
      box.replaceChildren(...config.targets.map(t => {
        const candy = document.createElement('span');
        candy.className = `candy c${t.color} mini`;
        candy.title = colors[t.color];
        const count = Math.min(t.count, collected[t.color]);
        return row(candy, `${count}/${t.count} ${colors[t.color]}`, count >= t.count);
      }));
    } else {
      const tile = document.createElement('span');
      tile.className = 'jelly-mini';
      const done = config.jelly.length - jelly.size;
      box.replaceChildren(row(tile, `Gelatina ${done}/${config.jelly.length}`, jelly.size === 0));
    }
  }
  function render() {
    board.forEach((tile, i) => paint(i));
    $('score').textContent = format(score);
    $('total-stars').textContent = Object.values(levels).reduce((sum, entry) => sum + entry.stars, 0);
    const best = levels[level];
    $('level-record').textContent = best?.score ? `Récord del nivel: ${format(best.score)} · ${'★'.repeat(best.stars)}${'☆'.repeat(3 - best.stars)}` : '';
    renderObjective();
    const earned = CandyLevels.stars(moves, config.par);
    $('moves').textContent = moves;
    $('moves-stars').textContent = `${'★'.repeat(earned)}${'☆'.repeat(3 - earned)}`;
    $('moves-stars').title = `3 estrellas hasta ${config.par} movimientos`;
    $('moves-stars').setAttribute('aria-label', `${earned} de 3 estrellas; 3 estrellas hasta ${config.par} movimientos`);
    const progress = Math.min(100, objective() * 100);
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
    clearTimeout(hintTimer);
    $('overlay').hidden = false;
    $('board').inert = true;
    $('dialog-action').focus();
  }
  function closeDialog() { $('overlay').hidden = true; $('board').inert = false; restartHint(); }
  // Avance del objetivo del nivel, de 0 a 1.
  function objective() {
    if (config.type === 'score') return Math.min(1, score / config.goal);
    if (config.type === 'colors') {
      const total = config.targets.reduce((sum, target) => sum + target.count, 0);
      return config.targets.reduce((sum, target) => sum + Math.min(target.count, collected[target.color]), 0) / total;
    }
    return 1 - jelly.size / config.jelly.length;
  }
  function start() {
    effects.clear();
    config = CandyLevels.levelConfig(level);
    board = engine.createBoard(config.colors);
    selected = null; score = 0; moves = 0;
    collected = Array(6).fill(0); jelly = new Set(config.jelly || []);
    finished = false; busy = false;
    $('level').textContent = level;
    $('level-name').textContent = $('board-label').textContent = names[(level - 1) % names.length];
    closeDialog(); render(); status('Elige un dulce y uno de sus vecinos.');
    restartHint();
  }
  // Desplazamiento en píxeles de la casilla to a la casilla from.
  function offset(from, to) {
    const [first, right, below] = [0, 1, engine.SIZE].map(i => buttons[i].getBoundingClientRect());
    return {
      x: (from % engine.SIZE - to % engine.SIZE) * (right.left - first.left),
      y: (Math.floor(from / engine.SIZE) - Math.floor(to / engine.SIZE)) * (below.top - first.top)
    };
  }
  // Mueve el dulce de cada casilla desde (x, y) hasta su lugar; con back va y regresa.
  async function slide(moves, { duration, easing = 'ease-in-out', back = false }) {
    if (reducedMotion.matches || !moves.length) return;
    await Promise.all(moves.map(({ index, x, y, time }) => {
      const element = buttons[index].firstElementChild;
      if (!element) return null;
      buttons[index].classList.add('moving');
      const frames = back ? ['0 0', `${x}px ${y}px`, '0 0'] : [`${x}px ${y}px`, '0 0'];
      return element.animate(frames.map(translate => ({ translate })), { duration: time ?? duration, easing }).finished.catch(() => {});
    }));
    for (const { index } of moves) buttons[index].classList.remove('moving');
  }
  async function fall(previous) {
    if (reducedMotion.matches) return;
    const step = offset(engine.SIZE, 0).y;
    const moves = [];
    board.forEach((tile, index) => {
      if (tile === previous[index]) return;
      const source = previous.indexOf(tile);
      const row = Math.floor(index / engine.SIZE);
      const col = index % engine.SIZE;
      const missing = previous.filter((item, i) => i % engine.SIZE === col && !item).length;
      const sourceRow = source >= 0 ? Math.floor(source / engine.SIZE) : row - missing;
      moves.push({ index, x: 0, y: (sourceRow - row) * step, time: 260 + (row - sourceRow) * 35 });
    });
    await slide(moves, { easing: 'cubic-bezier(.32,0,.7,1)' });
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
      // Cuenta los dulces que se van; el que se vuelve especial cuenta cuando explote.
      // La gelatina se quita en ambas casillas.
      for (const index of result.clear) if (board[index]?.color >= 0) collected[board[index].color]++;
      for (const index of [...result.clear, ...result.specials.keys()]) jelly.delete(index);
      for (const index of result.clear) board[index] = null;
      for (const [index, tile] of result.specials) board[index] = tile;
      render();
      const previous = board.slice();
      engine.refill(board, config.colors); render();
      await fall(previous);
    }
    if (objective() >= 1) {
      finished = true;
      const stars = CandyLevels.stars(moves, config.par);
      const best = levels[level] || { stars: 0, score: 0 };
      levels[level] = { stars: Math.max(best.stars, stars), score: Math.max(best.score, score) };
      save();
      showDialog(`${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, '¡Dulce victoria!', `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} Superaste el nivel ${level} en ${moves} movimientos (par ${config.par}) con ${format(score)} puntos. El siguiente reto te espera.`, 'Siguiente nivel →', () => { level++; save(); start(); });
    } else if (!engine.findMove(board)) {
      const previous = board.slice();
      if (!engine.shuffle(board)) board = engine.createBoard(config.colors);
      render();
      // Sólo se animan los dulces que cambiaron de casilla.
      const slides = [];
      board.forEach((tile, index) => {
        const from = previous.indexOf(tile);
        if (from >= 0 && from !== index) slides.push({ index, ...offset(from, index) });
      });
      await slide(slides, { duration: 420 });
      status('Mezclamos los dulces: ya hay nuevas jugadas.');
    }
  }
  async function attempt(a, b) {
    if (busy || finished || !$('overlay').hidden) return;
    busy = true; selected = null;
    render();
    if (!engine.validSwap(board, a, b)) {
      status('Ese cambio no forma una combinación. Intenta otro.');
      await slide([{ index: a, ...offset(b, a) }, { index: b, ...offset(a, b) }], { duration: 280, back: true });
      busy = false; restartHint(); return;
    }
    // Cada dulce parte de la casilla del otro y se desliza a su nuevo lugar.
    moves++;
    engine.swap(board, a, b); render();
    await slide([{ index: a, ...offset(b, a) }, { index: b, ...offset(a, b) }], { duration: 160 });
    const combo = engine.combine(board, a, b);
    // Muestra los dulces que la bomba convirtió; los especiales gastados se ven igual hasta reventar.
    for (const effect of combo?.effects ?? []) if (effect.type === 'convert') effect.targets.forEach(paint);
    await resolve(combo?.clear ?? null, [b, a], combo?.effects ?? []);
    busy = false; restartHint();
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
  function showHint() {
    clearTimeout(hintTimer);
    selected = null; render();
    const move = engine.bestMove(board, CandyLevels.hintBonus(config, collected, jelly));
    if (move) { move.forEach(index => buttons[index].classList.add('hint')); status('Prueba intercambiar los dos dulces iluminados.'); }
  }
  // Apaga la pista visible y la programa de nuevo tras 5 s sin actividad.
  function restartHint() {
    clearTimeout(hintTimer);
    buttons.forEach(button => button.classList.remove('hint'));
    const idle = () => !busy && !finished && $('overlay').hidden;
    // No interrumpe a quien ya eligió un dulce.
    if (idle()) hintTimer = setTimeout(() => { if (idle() && selected === null) showHint(); }, 5000);
  }
  window.addEventListener('pointerdown', restartHint);
  window.addEventListener('keydown', restartHint);
  $('hint').addEventListener('click', () => {
    if (busy || finished || !$('overlay').hidden) return;
    showHint();
  });
  $('restart').addEventListener('click', () => {
    if (busy || !$('overlay').hidden) return;
    showDialog('↻', '¿Otra oportunidad?', 'Reiniciarás el tablero, los puntos, los movimientos y el avance del objetivo de este nivel.', 'Reiniciar nivel', start);
    const cancel = document.createElement('button');
    cancel.textContent = 'Seguir jugando'; cancel.className = 'cancel';
    cancel.onclick = () => { cancel.remove(); closeDialog(); buttons[0].focus(); };
    $('dialog-action').after(cancel);
  });
  $('dialog-action').addEventListener('click', () => { document.querySelector('.cancel')?.remove(); dialogAction?.(); });
  $('help').addEventListener('click', () => {
    if (busy || finished || !$('overlay').hidden) return;
    showDialog('✧', 'Un momento para jugar', 'Haz clic en dos dulces vecinos o arrastra uno con el mouse. Combina 3 o más del mismo color y cumple el objetivo del nivel (puntos, colores o gelatina) sin límite de movimientos ni tiempo; menos movimientos dan más estrellas. Al juntar 4, la dirección del intercambio define si el rayado limpia una fila o columna. Cinco en línea hacen bomba aunque formen T o L. Intercambia una bomba con un dulce para eliminar su color (si otro especial la alcanza, elimina el color que más abunde), o dos especiales vecinos para combinarlos. Si te quedas quieto un momento, la mejor jugada se ilumina. También puedes usar las flechas y Enter.', '¡A combinar!', () => { closeDialog(); buttons[0].focus(); });
  });
  function updateSound() { $('sound').setAttribute('aria-pressed', sound); $('sound').innerHTML = `♫ <span>Sonido ${sound ? 'encendido' : 'apagado'}</span>`; }
  $('sound').addEventListener('click', () => { sound = !sound; updateSound(); if (sound) tone(); });
  start();
})();
