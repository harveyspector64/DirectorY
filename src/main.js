(() => {
  const WORLD_SIZE = 4200;
  const BLOCK = 260;
  const ROAD = 64;

  const app = document.getElementById('app');
  const zoneEl = document.getElementById('zone');
  const stateEl = document.getElementById('state');
  const wantedEl = document.getElementById('wanted');
  const promptEl = document.getElementById('prompt');
  const minimap = document.getElementById('minimap');
  const mm = minimap.getContext('2d');

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  app.appendChild(canvas);

  const keys = {};
  let interactLatch = false;
  let resetLatch = false;

  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));

  let audioCtx;
  const initAudio = () => {
    if (!audioCtx) audioCtx = new AudioContext();
  };
  window.addEventListener('pointerdown', initAudio, { once: true });
  const beep = (f = 440, d = 0.08, t = 'sine', g = 0.02) => {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    o.type = t;
    o.frequency.value = f;
    gain.gain.value = g;
    o.connect(gain).connect(audioCtx.destination);
    o.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
    o.stop(audioCtx.currentTime + d);
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const zones = [
    { name: 'Mid-Wilshire / Miracle Mile', x: -400, y: -100 },
    { name: 'Koreatown Fringe', x: -1150, y: -200 },
    { name: 'Beverly Grove', x: 760, y: -250 },
    { name: 'Pico-Union Edge', x: -900, y: 850 },
    { name: 'Hollywood Border', x: 650, y: -1350 }
  ];

  const buildings = [];
  const trees = [];
  for (let gx = -7; gx <= 7; gx++) {
    for (let gy = -7; gy <= 7; gy++) {
      const cx = gx * BLOCK;
      const cy = gy * BLOCK;
      if (Math.abs(cx % BLOCK) < ROAD || Math.abs(cy % BLOCK) < ROAD) continue;

      const count = Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const w = rand(80, 170);
        const h = rand(80, 170);
        buildings.push({
          x: cx + rand(-55, 55),
          y: cy + rand(-55, 55),
          w,
          h,
          color: `hsl(${rand(195, 230)} 18% ${rand(20, 40)}%)`,
          roof: `hsl(${rand(200, 220)} 20% ${rand(38, 52)}%)`
        });
      }

      if (Math.random() < 0.55) {
        trees.push({ x: cx + rand(-95, 95), y: cy + rand(-95, 95), r: rand(14, 24) });
      }
    }
  }

  const roads = [];
  for (let i = -8; i <= 8; i++) {
    roads.push({ x: i * BLOCK - ROAD / 2, y: -WORLD_SIZE / 2, w: ROAD, h: WORLD_SIZE });
    roads.push({ x: -WORLD_SIZE / 2, y: i * BLOCK - ROAD / 2, w: WORLD_SIZE, h: ROAD });
  }

  const player = { x: -450, y: -110, dir: 0, onFoot: true, car: null, wanted: 0, heat: 0, cash: 5000 };
  const playerCar = { x: -500, y: -90, dir: Math.PI / 2, speed: 0, color: '#ef4444', w: 30, h: 52, playerOwned: true };

  const traffic = [];
  for (let i = 0; i < 42; i++) {
    const horizontal = Math.random() > 0.5;
    const lane = Math.round(rand(-6, 6)) * BLOCK;
    traffic.push({
      x: horizontal ? rand(-WORLD_SIZE / 2, WORLD_SIZE / 2) : lane,
      y: horizontal ? lane : rand(-WORLD_SIZE / 2, WORLD_SIZE / 2),
      dir: horizontal ? (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() > 0.5 ? 0 : Math.PI),
      speed: rand(45, 90),
      color: `hsl(${rand(0, 360)} 75% 58%)`,
      w: 28,
      h: 50,
      ai: true
    });
  }

  const pedestrians = [];
  for (let i = 0; i < 85; i++) {
    pedestrians.push({
      x: rand(-WORLD_SIZE / 2, WORLD_SIZE / 2),
      y: rand(-WORLD_SIZE / 2, WORLD_SIZE / 2),
      dir: rand(0, Math.PI * 2),
      speed: rand(22, 36),
      color: `hsl(${rand(0, 360)} 60% 60%)`
    });
  }

  const cops = [];
  for (let i = 0; i < 11; i++) {
    cops.push({ x: rand(-1600, 1600), y: rand(-1600, 1600), dir: rand(0, Math.PI * 2), speed: 115, w: 30, h: 52, siren: 0 });
  }

  const entitiesCars = [...traffic, playerCar];

  const worldToScreen = (x, y, camX, camY) => ({
    x: (x - camX) + canvas.width / 2,
    y: (y - camY) + canvas.height / 2
  });

  const drawCar = (car, camX, camY, police = false) => {
    const p = worldToScreen(car.x, car.y, camX, camY);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(car.dir);
    ctx.fillStyle = police ? '#0f172a' : car.color;
    ctx.fillRect(-car.w / 2, -car.h / 2, car.w, car.h);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-car.w * 0.33, -car.h * 0.2, car.w * 0.66, car.h * 0.36);
    if (police) {
      ctx.fillStyle = Math.sin(performance.now() * 0.02) > 0 ? '#3b82f6' : '#ef4444';
      ctx.fillRect(-9, -car.h * 0.32, 18, 5);
    }
    ctx.restore();
  };

  const nearestZone = () => zones.slice().sort((a, b) => (a.x - player.x) ** 2 + (a.y - player.y) ** 2 - ((b.x - player.x) ** 2 + (b.y - player.y) ** 2))[0];

  const updateWanted = (dt) => {
    player.heat = Math.max(0, player.heat - dt * 0.9);
    player.wanted = clamp(Math.floor(player.heat / 10), 0, 5);
  };

  const updatePlayer = (dt) => {
    if (keys.r && !resetLatch) {
      resetLatch = true;
      player.x = -450; player.y = -110; player.dir = 0; player.onFoot = true; player.car = null;
      playerCar.x = -500; playerCar.y = -90; playerCar.speed = 0;
    }
    if (!keys.r) resetLatch = false;

    if (player.onFoot) {
      const mx = (keys.a || keys.arrowleft ? -1 : 0) + (keys.d || keys.arrowright ? 1 : 0);
      const my = (keys.w || keys.arrowup ? -1 : 0) + (keys.s || keys.arrowdown ? 1 : 0);
      const len = Math.hypot(mx, my);
      if (len > 0) {
        const sp = keys.shift ? 170 : 120;
        player.x += (mx / len) * sp * dt;
        player.y += (my / len) * sp * dt;
        player.dir = Math.atan2(my, mx) + Math.PI / 2;
      }

      const nearCar = dist(player, playerCar) < 70;
      promptEl.style.display = nearCar ? 'block' : 'none';
      promptEl.textContent = 'Press E to enter vehicle';
      if (nearCar && keys.e && !interactLatch) {
        interactLatch = true;
        player.onFoot = false;
        player.car = playerCar;
        beep(370, 0.08, 'triangle', 0.04);
      }
      if (!keys.e) interactLatch = false;
    } else {
      const car = player.car;
      const accel = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
      const steer = (keys.a || keys.arrowleft ? -1 : 0) + (keys.d || keys.arrowright ? 1 : 0);
      const max = keys.shift ? 280 : 205;

      car.speed += accel * 260 * dt;
      car.speed *= keys[' '] ? 0.9 : 0.985;
      car.speed = clamp(car.speed, -110, max);
      car.dir += steer * (1.3 + Math.abs(car.speed) * 0.005) * dt;
      car.x += Math.cos(car.dir - Math.PI / 2) * car.speed * dt;
      car.y += Math.sin(car.dir - Math.PI / 2) * car.speed * dt;

      player.x = car.x;
      player.y = car.y;
      player.dir = car.dir;
      promptEl.style.display = 'block';
      promptEl.textContent = 'Press E to exit vehicle';
      if (keys.e && !interactLatch) {
        interactLatch = true;
        player.onFoot = true;
        player.car = null;
        player.x += 30;
        player.y += 14;
        beep(270, 0.08, 'sawtooth', 0.035);
      }
      if (!keys.e) interactLatch = false;
    }

    player.x = clamp(player.x, -WORLD_SIZE / 2 + 35, WORLD_SIZE / 2 - 35);
    player.y = clamp(player.y, -WORLD_SIZE / 2 + 35, WORLD_SIZE / 2 - 35);
  };

  const updateTraffic = (dt) => {
    for (const c of traffic) {
      c.x += Math.cos(c.dir - Math.PI / 2) * c.speed * dt;
      c.y += Math.sin(c.dir - Math.PI / 2) * c.speed * dt;
      if (Math.random() < 0.01) c.dir += rand(-0.14, 0.14);
      if (Math.abs(c.x) > WORLD_SIZE / 2 - 40 || Math.abs(c.y) > WORLD_SIZE / 2 - 40) c.dir += Math.PI;
    }
  };

  const updatePedestrians = (dt) => {
    for (const p of pedestrians) {
      p.x += Math.cos(p.dir) * p.speed * dt;
      p.y += Math.sin(p.dir) * p.speed * dt;
      if (Math.random() < 0.025 || Math.abs(p.x) > WORLD_SIZE / 2 - 10 || Math.abs(p.y) > WORLD_SIZE / 2 - 10) p.dir += rand(-1.2, 1.2);

      if (!player.onFoot && dist(p, player) < 24 && Math.abs(playerCar.speed) > 90) {
        p.x += rand(-80, 80);
        p.y += rand(-80, 80);
        player.heat += 3;
        beep(100, 0.12, 'square', 0.05);
      }
    }
  };

  const updateCops = (dt) => {
    for (const c of cops) {
      if (player.wanted > 0) {
        const dx = player.x - c.x;
        const dy = player.y - c.y;
        const ang = Math.atan2(dy, dx) + Math.PI / 2;
        let delta = ang - c.dir;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        c.dir += delta * 0.08;
        const chase = c.speed + player.wanted * 36;
        c.x += Math.cos(c.dir - Math.PI / 2) * chase * dt;
        c.y += Math.sin(c.dir - Math.PI / 2) * chase * dt;

        const d = dist(c, player);
        if (d < 230) {
          c.siren += dt * 16;
          if (Math.sin(c.siren) > 0.98) beep(810, 0.06, 'triangle', 0.014);
          if (Math.sin(c.siren) < -0.98) beep(560, 0.06, 'triangle', 0.014);
        }
        if (d < 55 && !player.onFoot) player.heat += dt * 2;
      } else {
        c.x += Math.cos(c.dir - Math.PI / 2) * 70 * dt;
        c.y += Math.sin(c.dir - Math.PI / 2) * 70 * dt;
        if (Math.random() < 0.02) c.dir += rand(-0.6, 0.6);
      }
      c.x = clamp(c.x, -WORLD_SIZE / 2 + 30, WORLD_SIZE / 2 - 30);
      c.y = clamp(c.y, -WORLD_SIZE / 2 + 30, WORLD_SIZE / 2 - 30);
    }
  };

  const drawWorld = (camX, camY) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0b1220');
    gradient.addColorStop(1, '#142035');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    const tl = worldToScreen(-WORLD_SIZE / 2, -WORLD_SIZE / 2, camX, camY);
    ctx.fillStyle = '#1f3b2d';
    ctx.fillRect(tl.x, tl.y, WORLD_SIZE, WORLD_SIZE);

    ctx.fillStyle = '#2f3742';
    roads.forEach((r) => {
      const p = worldToScreen(r.x, r.y, camX, camY);
      ctx.fillRect(p.x, p.y, r.w, r.h);
    });

    ctx.strokeStyle = '#f6d365';
    ctx.lineWidth = 2;
    for (let i = -8; i <= 8; i++) {
      const x = i * BLOCK;
      for (let y = -WORLD_SIZE / 2; y < WORLD_SIZE / 2; y += 90) {
        const p = worldToScreen(x, y, camX, camY);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + 40); ctx.stroke();
      }
      for (let xx = -WORLD_SIZE / 2; xx < WORLD_SIZE / 2; xx += 90) {
        const p = worldToScreen(xx, x, camX, camY);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 40, p.y); ctx.stroke();
      }
    }

    for (const b of buildings) {
      const p = worldToScreen(b.x - b.w / 2, b.y - b.h / 2, camX, camY);
      ctx.fillStyle = b.color;
      ctx.fillRect(p.x, p.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(p.x + 10, p.y + 10, b.w - 20, b.h - 20);
    }

    for (const t of trees) {
      const p = worldToScreen(t.x, t.y, camX, camY);
      ctx.fillStyle = '#3b2f24';
      ctx.fillRect(p.x - 2, p.y - 6, 4, 12);
      ctx.beginPath();
      ctx.fillStyle = '#1faa59';
      ctx.arc(p.x, p.y - 6, t.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of pedestrians) {
      const s = worldToScreen(p.x, p.y, camX, camY);
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111827';
      ctx.stroke();
    }

    for (const c of traffic) drawCar(c, camX, camY, false);
    for (const c of cops) drawCar(c, camX, camY, true);
    if (player.onFoot) {
      const p = worldToScreen(player.x, player.y, camX, camY);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(player.dir);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-2, -15, 4, 8);
      ctx.restore();
    }
    if (!player.onFoot) drawCar(playerCar, camX, camY, false);

    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(0, 0, canvas.width, 56);
  };

  const drawMiniMap = () => {
    mm.fillStyle = '#0b121d';
    mm.fillRect(0, 0, 240, 240);
    mm.strokeStyle = '#334155';
    for (let i = 0; i < 240; i += 24) {
      mm.beginPath(); mm.moveTo(i, 0); mm.lineTo(i, 240); mm.stroke();
      mm.beginPath(); mm.moveTo(0, i); mm.lineTo(240, i); mm.stroke();
    }

    const dot = (x, y, c, r) => {
      const u = 120 + (x / (WORLD_SIZE / 2)) * 120;
      const v = 120 + (y / (WORLD_SIZE / 2)) * 120;
      mm.beginPath(); mm.fillStyle = c; mm.arc(u, v, r, 0, Math.PI * 2); mm.fill();
    };

    traffic.forEach((c) => dot(c.x, c.y, '#d1d5db', 2));
    pedestrians.forEach((p) => dot(p.x, p.y, '#4ade80', 1.2));
    cops.forEach((c) => dot(c.x, c.y, '#60a5fa', 2.5));
    dot(player.x, player.y, '#f43f5e', 4);
  };

  const updateUi = () => {
    const z = nearestZone();
    zoneEl.textContent = `Zone: ${z.name}`;
    stateEl.textContent = player.onFoot ? 'On Foot' : `Driving ${Math.round(Math.abs(playerCar.speed))} mph`;
    wantedEl.innerHTML = `Wanted: ${Array.from({ length: 5 }, (_, i) => `<span class="${i < player.wanted ? 'on' : ''}">★</span>`).join('')}`;
  };

  const resize = () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  };
  window.addEventListener('resize', resize);
  resize();

  let prev = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.033, (now - prev) / 1000);
    prev = now;

    updatePlayer(dt);
    updateTraffic(dt);
    updatePedestrians(dt);
    updateWanted(dt);
    updateCops(dt);

    drawWorld(player.x, player.y);
    drawMiniMap();
    updateUi();

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
})();
