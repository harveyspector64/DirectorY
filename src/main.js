import * as THREE from 'https://unpkg.com/three@0.174.0/build/three.module.js';

const WORLD_SIZE = 900;
const ROAD_W = 22;
const BLOCK = 90;
const HALF = WORLD_SIZE / 2;

const app = document.getElementById('app');
const zoneEl = document.getElementById('zone');
const stateEl = document.getElementById('state');
const wantedEl = document.getElementById('wanted');
const promptEl = document.getElementById('prompt');
const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') e.preventDefault();
});
window.addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0c1525');
scene.fog = new THREE.Fog('#0c1525', 200, 780);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 160, 120);
camera.lookAt(0, 0, 0);

const ambient = new THREE.HemisphereLight('#99d4ff', '#131510', 0.78);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#fff8dc', 1.4);
sun.position.set(170, 290, 85);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -420;
sun.shadow.camera.right = 420;
sun.shadow.camera.top = 420;
sun.shadow.camera.bottom = -420;
scene.add(sun);

function roadMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#2d3239', roughness: 0.9, metalness: 0.05 });
}

const world = new THREE.Group();
scene.add(world);

const asphalt = roadMaterial();
const stripeMat = new THREE.MeshStandardMaterial({ color: '#d7c278', emissive: '#6a5518', emissiveIntensity: 0.2 });
const curbMat = new THREE.MeshStandardMaterial({ color: '#8a8f94' });
const grassMat = new THREE.MeshStandardMaterial({ color: '#1d392a' });

const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE), grassMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
world.add(ground);

const roads = [];
for (let i = -4; i <= 4; i++) {
  const x = i * BLOCK;
  const vRoad = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W, 0.2, WORLD_SIZE), asphalt);
  vRoad.position.set(x, 0.1, 0);
  vRoad.receiveShadow = true;
  world.add(vRoad);
  roads.push({ x1: x - ROAD_W / 2, x2: x + ROAD_W / 2, z1: -HALF, z2: HALF });

  const hRoad = new THREE.Mesh(new THREE.BoxGeometry(WORLD_SIZE, 0.2, ROAD_W), asphalt);
  hRoad.position.set(0, 0.1, x);
  hRoad.receiveShadow = true;
  world.add(hRoad);
  roads.push({ x1: -HALF, x2: HALF, z1: x - ROAD_W / 2, z2: x + ROAD_W / 2 });

  for (let j = -8; j <= 8; j++) {
    if (j % 2 === 0) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(4, 0.08, 0.5), stripeMat);
      s.position.set(x, 0.25, j * 28);
      world.add(s);
      const s2 = s.clone();
      s2.rotation.y = Math.PI / 2;
      s2.position.set(j * 28, 0.25, x);
      world.add(s2);
    }
  }
}

function makeBuilding(x, z) {
  const h = 20 + Math.random() * 70;
  const w = 30 + Math.random() * 38;
  const d = 30 + Math.random() * 38;
  const hue = 200 + Math.random() * 40;
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${hue},18%,${25 + Math.random() * 25}%)`), roughness: 0.85 })
  );
  b.position.set(x, h / 2, z);
  b.castShadow = true;
  b.receiveShadow = true;
  world.add(b);
}

for (let x = -4; x <= 4; x++) {
  for (let z = -4; z <= 4; z++) {
    const cx = x * BLOCK;
    const cz = z * BLOCK;
    if (Math.abs(cx) < ROAD_W || Math.abs(cz) < ROAD_W) continue;
    if (Math.random() < 0.9) makeBuilding(cx + (Math.random() - 0.5) * 24, cz + (Math.random() - 0.5) * 24);

    if (Math.random() < 0.38) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.1, 9, 8), new THREE.MeshStandardMaterial({ color: '#5a3f2d' }));
      const crown = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 8), new THREE.MeshStandardMaterial({ color: '#2f8f4b' }));
      p.position.set(cx + (Math.random() - 0.5) * 40, 4.5, cz + (Math.random() - 0.5) * 40);
      crown.position.set(p.position.x, 12, p.position.z);
      world.add(p, crown);
    }
  }
}

const player = {
  pos: new THREE.Vector3(-40, 0.7, 20),
  dir: 0,
  speed: 0,
  onFoot: true,
  car: null,
  wanted: 0,
  crimeHeat: 0,
};

const playerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 2.4, 4, 8), new THREE.MeshStandardMaterial({ color: '#f9e3b1' }));
playerMesh.castShadow = true;
playerMesh.position.copy(player.pos);
scene.add(playerMesh);

function createCar(color = '#3d9df2', police = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 11), new THREE.MeshStandardMaterial({ color }));
  body.position.y = 1.6;
  body.castShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(5.3, 1.7, 5.5), new THREE.MeshStandardMaterial({ color: '#d0d6df' }));
  top.position.set(0, 3, -0.7);
  if (police) {
    body.material = new THREE.MeshStandardMaterial({ color: '#111821' });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: '#c5d3ff', emissive: '#3b65ff', emissiveIntensity: 0.9 }));
    bar.position.set(0, 4.2, -0.6);
    g.add(bar);
  }
  g.add(body, top);
  g.castShadow = true;
  return g;
}

function createPed() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 1.4, 4, 8), new THREE.MeshStandardMaterial({ color: `hsl(${Math.random() * 360},60%,60%)` }));
  g.add(body);
  return g;
}

const traffic = [];
for (let i = 0; i < 26; i++) {
  const car = createCar(`hsl(${Math.random() * 360},72%,56%)`);
  const laneX = (-4 + Math.floor(Math.random() * 9)) * BLOCK;
  const laneZ = (-4 + Math.floor(Math.random() * 9)) * BLOCK;
  const horizontal = Math.random() > 0.5;
  car.position.set(horizontal ? -HALF + Math.random() * WORLD_SIZE : laneX, 0, horizontal ? laneZ : -HALF + Math.random() * WORLD_SIZE);
  car.rotation.y = horizontal ? (Math.random() > 0.5 ? 0 : Math.PI) : Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(car);
  traffic.push({ mesh: car, speed: 10 + Math.random() * 18, horizontal, npc: true, police: false });
}

const cops = [];
for (let i = 0; i < 6; i++) {
  const c = createCar('#102449', true);
  c.position.set((Math.random() - 0.5) * WORLD_SIZE, 0, (Math.random() - 0.5) * WORLD_SIZE);
  scene.add(c);
  cops.push({ mesh: c, speed: 22, police: true, sirenTick: 0 });
}

const peds = [];
for (let i = 0; i < 46; i++) {
  const p = createPed();
  p.position.set((Math.random() - 0.5) * WORLD_SIZE, 0.4, (Math.random() - 0.5) * WORLD_SIZE);
  scene.add(p);
  peds.push({ mesh: p, dir: Math.random() * Math.PI * 2, speed: 3 + Math.random() * 2 });
}

const playerCar = createCar('#ef4136');
playerCar.position.set(-52, 0, 18);
playerCar.rotation.y = Math.PI / 2;
scene.add(playerCar);
traffic.push({ mesh: playerCar, speed: 0, horizontal: true, npc: false, police: false });

const zones = [
  { name: 'LACMA / Miracle Mile', x: -40, z: 20 },
  { name: 'Koreatown Border', x: -160, z: 70 },
  { name: 'Beverly Grove', x: 140, z: -20 },
  { name: 'Pico-Union Edge', x: -120, z: -180 },
];

let audioCtx;
function tone(freq, dur = 0.08, type = 'sine', gain = 0.03) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g).connect(audioCtx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  o.stop(audioCtx.currentTime + dur);
}
window.addEventListener('pointerdown', () => {
  if (!audioCtx) audioCtx = new AudioContext();
});

function clampWorld(v) {
  v.x = THREE.MathUtils.clamp(v.x, -HALF + 4, HALF - 4);
  v.z = THREE.MathUtils.clamp(v.z, -HALF + 4, HALF - 4);
}

function nearestDrivable(pos) {
  let d = Infinity;
  for (const r of roads) {
    const cx = THREE.MathUtils.clamp(pos.x, r.x1, r.x2);
    const cz = THREE.MathUtils.clamp(pos.z, r.z1, r.z2);
    d = Math.min(d, (cx - pos.x) ** 2 + (cz - pos.z) ** 2);
  }
  return Math.sqrt(d);
}

function updatePlayer(dt) {
  const inputX = (keys['a'] || keys['arrowleft'] ? -1 : 0) + (keys['d'] || keys['arrowright'] ? 1 : 0);
  const inputZ = (keys['w'] || keys['arrowup'] ? -1 : 0) + (keys['s'] || keys['arrowdown'] ? 1 : 0);

  if (keys['r']) {
    player.pos.set(-40, 0.7, 20);
    playerCar.position.set(-52, 0, 18);
    player.onFoot = true;
    player.car = null;
  }

  if (player.onFoot) {
    const dir = new THREE.Vector3(inputX, 0, inputZ);
    if (dir.lengthSq() > 0.0001) {
      dir.normalize();
      const speed = keys['shift'] ? 28 : 16;
      player.pos.addScaledVector(dir, speed * dt);
      player.dir = Math.atan2(dir.x, dir.z);
      playerMesh.rotation.y = player.dir;
    }
    clampWorld(player.pos);
    playerMesh.position.copy(player.pos);

    const dcar = player.pos.distanceTo(playerCar.position);
    if (dcar < 8) {
      promptEl.style.display = 'block';
      promptEl.textContent = 'Press E to enter vehicle';
      if (keys['e']) {
        player.onFoot = false;
        player.car = playerCar;
        tone(420, 0.12, 'triangle', 0.05);
      }
    } else promptEl.style.display = 'none';
  } else {
    const car = player.car;
    const accel = (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 1 : 0);
    const turn = (keys['a'] || keys['arrowleft'] ? 1 : 0) - (keys['d'] || keys['arrowright'] ? 1 : 0);
    traffic.find((t) => t.mesh === car).speed += accel * dt * 34;
    traffic.find((t) => t.mesh === car).speed *= keys[' '] ? 0.93 : 0.985;
    traffic.find((t) => t.mesh === car).speed = THREE.MathUtils.clamp(traffic.find((t) => t.mesh === car).speed, -18, keys['shift'] ? 68 : 48);
    car.rotation.y += turn * dt * (0.95 + Math.abs(traffic.find((t) => t.mesh === car).speed) * 0.015);
    const forward = new THREE.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    car.position.addScaledVector(forward, traffic.find((t) => t.mesh === car).speed * dt);
    clampWorld(car.position);
    player.pos.copy(car.position);

    promptEl.style.display = 'block';
    promptEl.textContent = 'Press E to exit vehicle';
    if (keys['e']) {
      player.onFoot = true;
      player.car = null;
      player.pos.add(new THREE.Vector3(3, 0, 3));
      tone(310, 0.1, 'sawtooth', 0.03);
    }
  }
}

function updateTraffic(dt) {
  for (const t of traffic) {
    if (!t.npc) continue;
    const f = new THREE.Vector3(Math.sin(t.mesh.rotation.y), 0, Math.cos(t.mesh.rotation.y));
    t.mesh.position.addScaledVector(f, t.speed * dt);
    if (t.mesh.position.x < -HALF + 6 || t.mesh.position.x > HALF - 6 || t.mesh.position.z < -HALF + 6 || t.mesh.position.z > HALF - 6) {
      t.mesh.rotation.y += Math.PI;
    }
    if (Math.random() < 0.005) t.mesh.rotation.y += (Math.random() - 0.5) * Math.PI * 0.5;
  }
}

function updatePeds(dt) {
  for (const p of peds) {
    p.mesh.position.x += Math.sin(p.dir) * p.speed * dt;
    p.mesh.position.z += Math.cos(p.dir) * p.speed * dt;
    if (nearestDrivable(p.mesh.position) < 7 || Math.abs(p.mesh.position.x) > HALF - 10 || Math.abs(p.mesh.position.z) > HALF - 10 || Math.random() < 0.01) p.dir += (Math.random() - 0.5) * 2.2;
    p.mesh.rotation.y = p.dir;

    if (!player.onFoot && p.mesh.position.distanceTo(player.pos) < 5 && Math.abs(traffic.find((t) => t.mesh === player.car).speed) > 16) {
      player.crimeHeat += 4;
      p.mesh.position.add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8));
      tone(90, 0.16, 'square', 0.06);
    }
  }
}

function updateCops(dt) {
  player.wanted = Math.min(5, Math.floor(player.crimeHeat / 15));
  player.crimeHeat = Math.max(0, player.crimeHeat - dt * 1.3);

  for (const c of cops) {
    const target = player.pos;
    const to = new THREE.Vector3().subVectors(target, c.mesh.position);
    const dist = to.length();
    if (player.wanted > 0) {
      to.normalize();
      c.mesh.rotation.y = THREE.MathUtils.lerp(c.mesh.rotation.y, Math.atan2(to.x, to.z), 0.06);
      c.mesh.position.addScaledVector(new THREE.Vector3(Math.sin(c.mesh.rotation.y), 0, Math.cos(c.mesh.rotation.y)), (c.speed + player.wanted * 6) * dt);
      if (dist < 24) {
        c.sirenTick += dt * (6 + player.wanted);
        if (Math.sin(c.sirenTick) > 0.97) tone(760, 0.08, 'triangle', 0.02);
        if (Math.sin(c.sirenTick) < -0.97) tone(560, 0.08, 'triangle', 0.02);
      }
      if (dist < 9 && !player.onFoot) player.crimeHeat += dt * 4;
    } else {
      c.mesh.position.x += Math.sin(c.mesh.rotation.y) * 8 * dt;
      c.mesh.position.z += Math.cos(c.mesh.rotation.y) * 8 * dt;
      if (Math.random() < 0.01) c.mesh.rotation.y += (Math.random() - 0.5) * 1.5;
    }
    clampWorld(c.mesh.position);
  }
}

function updateUI() {
  stateEl.textContent = player.onFoot ? 'On Foot' : `Driving  ${Math.round(Math.abs(traffic.find((t) => t.mesh === player.car).speed || 0))} mph`;
  wantedEl.innerHTML = 'Wanted: ' + Array.from({ length: 5 }, (_, i) => `<span class="${i < player.wanted ? 'on' : ''}">★</span>`).join('');
  zones.sort((a, b) => player.pos.distanceToSquared(new THREE.Vector3(a.x, 0, a.z)) - player.pos.distanceToSquared(new THREE.Vector3(b.x, 0, b.z)));
  zoneEl.textContent = `Zone: ${zones[0].name}`;

  minimapCtx.fillStyle = '#0b121d';
  minimapCtx.fillRect(0, 0, 240, 240);
  minimapCtx.strokeStyle = '#2f3f58';
  minimapCtx.lineWidth = 1;
  for (let i = -4; i <= 4; i++) {
    const u = 120 + i * 24;
    minimapCtx.beginPath(); minimapCtx.moveTo(u, 0); minimapCtx.lineTo(u, 240); minimapCtx.stroke();
    minimapCtx.beginPath(); minimapCtx.moveTo(0, u); minimapCtx.lineTo(240, u); minimapCtx.stroke();
  }
  const drawDot = (x, z, color, r = 3) => {
    const u = 120 + (x / HALF) * 120;
    const v = 120 + (z / HALF) * 120;
    minimapCtx.fillStyle = color;
    minimapCtx.beginPath(); minimapCtx.arc(u, v, r, 0, Math.PI * 2); minimapCtx.fill();
  };
  for (const t of traffic) drawDot(t.mesh.position.x, t.mesh.position.z, t.police ? '#64b4ff' : '#d2dee7', t.police ? 2.6 : 2);
  for (const p of peds) drawDot(p.mesh.position.x, p.mesh.position.z, '#58f7aa', 1.4);
  drawDot(player.pos.x, player.pos.z, '#ff5555', 4.3);
}

function updateCamera() {
  const target = player.onFoot ? player.pos : player.car.position;
  const behind = new THREE.Vector3(0, 115, 85);
  const desired = target.clone().add(behind);
  camera.position.lerp(desired, 0.08);
  camera.lookAt(target.x, 0, target.z);
}

let prev = performance.now();
function tick(now) {
  const dt = Math.min(0.03, (now - prev) / 1000);
  prev = now;

  updatePlayer(dt);
  updateTraffic(dt);
  updatePeds(dt);
  updateCops(dt);
  updateUI();
  updateCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
