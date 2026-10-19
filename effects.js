'use strict';

const CandyEffects = (() => {
  const palette = ['#ff8195', '#ffc383', '#fff391', '#c5ee89', '#8ee8f9', '#d0acff'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function create(shell, buttons) {
    const canvas = document.createElement('canvas');
    canvas.className = 'effects-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    shell.append(canvas);
    const ctx = canvas.getContext('2d');
    let particles = [], effects = [], frame = null;
    let width = 0, height = 0;

    function resize() {
      const rect = shell.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    new ResizeObserver(resize).observe(shell);

    function draw(now) {
      ctx.clearRect(0, 0, width, height);
      particles = particles.filter(particle => now - particle.start < 600);
      effects = effects.filter(effect => now - effect.start < 650);
      for (const particle of particles) {
        const age = (now - particle.start) / 1000;
        ctx.globalAlpha = Math.max(0, 1 - age / 0.6);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x + particle.vx * age, particle.y + particle.vy * age + 180 * age * age, particle.size * (1 - age), 0, Math.PI * 2);
        ctx.fill();
      }
      for (const effect of effects) {
        const progress = Math.min(1, (now - effect.start) / 650);
        ctx.save();
        ctx.globalAlpha = Math.sin(progress * Math.PI);
        ctx.strokeStyle = effect.color;
        ctx.fillStyle = effect.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 12;
        if (effect.type === 'stripe') {
          const reach = Math.min(1, progress * 4);
          const vertical = effect.direction === 'vertical';
          const length = vertical ? height : width;
          ctx.fillRect(vertical ? effect.x - 5 : effect.x - length * reach,
            vertical ? effect.y - length * reach : effect.y - 5,
            vertical ? 10 : length * reach * 2, vertical ? length * reach * 2 : 10);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(vertical ? effect.x - 1 : effect.x - length * reach,
            vertical ? effect.y - length * reach : effect.y - 1,
            vertical ? 2 : length * reach * 2, vertical ? length * reach * 2 : 2);
        } else if (effect.type === 'wrapped') {
          ctx.lineWidth = 6 * (1 - progress) + 1;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.size * 1.6 * progress, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha *= 0.15;
          ctx.fill();
        } else if (effect.type === 'bomb') {
          ctx.lineWidth = 2;
          for (const target of effect.targets) {
            ctx.beginPath();
            ctx.moveTo(effect.x, effect.y);
            ctx.lineTo((effect.x + target.x) / 2 + target.jitter, (effect.y + target.y) / 2 - target.jitter);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      frame = particles.length || effects.length ? requestAnimationFrame(draw) : null;
    }

    function label(text, x, y, combo = false) {
      const element = document.createElement('span');
      element.className = combo ? 'floating-score combo-label' : 'floating-score';
      element.textContent = text;
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.setAttribute('aria-hidden', 'true');
      shell.append(element);
      const animation = element.animate([
        { translate: '-50% 0', scale: 0.85, opacity: 0 },
        { translate: '-50% -12px', scale: 1.05, opacity: 1, offset: 0.18 },
        { translate: '-50% -42px', scale: 1, opacity: 0 }
      ], { duration: combo ? 1100 : 900, easing: 'ease-out' });
      animation.finished.catch(() => {}).finally(() => element.remove());
    }

    function burst(board, clear, activated, points, combo) {
      if (reducedMotion.matches || !ctx) return;
      const bounds = canvas.getBoundingClientRect();
      const positions = buttons.map(button => {
        const rect = button.getBoundingClientRect();
        return { x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2, size: rect.width };
      });
      const now = performance.now();
      for (const index of clear) {
        const position = positions[index];
        for (let i = 0; i < 6 && particles.length < 360; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 35 + Math.random() * 100;
          particles.push({ ...position, start: now, color: palette[board[index]?.color] || '#fff4be',
            size: 1.5 + Math.random() * 2.5, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 50 });
        }
      }
      for (const effect of activated) {
        effects.push({ ...effect, ...positions[effect.index], start: now,
          color: effect.type === 'bomb' ? '#ede0ff' : palette[board[effect.index]?.color] || '#fff4be',
          targets: effect.targets.map(index => ({ ...positions[index], jitter: Math.random() * 20 - 10 })) });
      }
      const indices = [...clear];
      if (indices.length) {
        const x = indices.reduce((sum, index) => sum + positions[index].x, 0) / indices.length;
        const y = indices.reduce((sum, index) => sum + positions[index].y, 0) / indices.length;
        label(`+${points.toLocaleString('es-MX')}`, x, y);
      }
      if (combo > 1) label(`¡Combo ×${combo}!`, width / 2, height * 0.24, true);
      if (frame === null) frame = requestAnimationFrame(draw);
    }

    function clear() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null; particles = []; effects = [];
      ctx?.clearRect(0, 0, width, height);
      shell.querySelectorAll('.floating-score').forEach(element => {
        element.getAnimations().forEach(animation => animation.cancel());
        element.remove();
      });
    }
    return { burst, clear };
  }
  return { create };
})();
