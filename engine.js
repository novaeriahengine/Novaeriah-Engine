import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88b4c5);
scene.fog = new THREE.FogExp2(0x88b4c5, 0.009);
const camera = new THREE.PerspectiveCamera(72, 1, .1, 900);
camera.rotation.order = 'YXZ';
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();
const terrainSize = 440;

const state = {
  running: false, locked: false, yaw: 0, pitch: -.08, keys: {},
  health: 100, ki: 100, maxHealth: 100, maxKi: 100, level: 1, xp: 0,
  sprint: 0, lastW: -1000, attackCooldown: 0, skillCooldown: {},
  target: null, nearest: null, menu: false, quest: 0, elapsed: 0,
};

function terrainHeight(x, z) {
  const island = Math.max(0, 1 - Math.hypot(x, z) / 190);
  const rolling = Math.sin(x * .045) * 3 + Math.cos(z * .052) * 2.7 + Math.sin((x + z) * .025) * 5;
  const ridge = Math.max(0, 16 - Math.hypot(x + 50, z - 45) * .17);
  return -2.8 + island * (rolling + 10) + ridge * island;
}

function makeTerrain() {
  const seg = 140;
  const geo = new THREE.PlaneGeometry(terrainSize, terrainSize, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = terrainHeight(x, z), dist = Math.hypot(x, z);
    p.setY(i, h);
    if (dist > 172) color.set(0x395e4d);
    else if (h < 1.0) color.set(0x9e9662);
    else if (h > 14) color.set(0x607c68);
    else color.setHSL(.29 - h * .003, .29, .25 + h * .006);
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  land.receiveShadow = true; scene.add(land);
}

function addLight() {
  scene.add(new THREE.HemisphereLight(0xb9e7f2, 0x263925, 2.4));
  const sun = new THREE.DirectionalLight(0xffd7a2, 3.2); sun.position.set(-90, 140, -70); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -130; sun.shadow.camera.right = 130; sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130; scene.add(sun);
}

function addWater() {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: 0x174859, roughness: .28, metalness: .3, transparent: true, opacity: .93 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -2.9; scene.add(water);
}

const world = new THREE.Group(); scene.add(world);
function box(w, h, d, color, x, y, z, group = world) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: .8 }));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
}
function tree(x, z, burnt = false) {
  const y = terrainHeight(x, z); const g = new THREE.Group();
  box(.55, 5 + Math.random() * 4, .55, burnt ? 0x251d17 : 0x55402d, 0, 3, 0, g);
  if (!burnt) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.7 + Math.random(), 6 + Math.random() * 2, 7), new THREE.MeshStandardMaterial({ color: 0x284a31, roughness: 1 }));
    crown.position.y = 7; crown.castShadow = true; g.add(crown);
  }
  g.position.set(x, y, z); world.add(g);
}
function ruin(x, z, rotation = 0) {
  const y = terrainHeight(x, z); const g = new THREE.Group(); g.rotation.y = rotation;
  const stone = 0x4c453d, char = 0x211b18;
  box(7, .8, 5, stone, 0, .4, 0, g);
  for (const [a, b] of [[-3,-2], [3,-2],[-3,2],[3,2]]) box(.55, 3.5, .55, char, a, 2, b, g);
  box(7.5, .35, .5, char, 0, 4.1, -2.3, g); box(7.5, .35, .5, char, 0, 4.1, 2.3, g);
  g.position.set(x, y, z); world.add(g);
}
function landmarkWorld() {
  for (let x = -160; x < 180; x += 18) for (let z = -160; z < 180; z += 18) {
    if (Math.hypot(x, z) < 155 && Math.random() > .55 && Math.hypot(x + 16, z - 28) > 35) tree(x + Math.random() * 8, z + Math.random() * 8);
  }
  for (let i = 0; i < 12; i++) tree(-30 + Math.random() * 55, 15 + Math.random() * 44, true);
  ruin(-12, 21, .3); ruin(8, 34, -.5); ruin(-27, 39, .1);
  const fire = new THREE.PointLight(0xff702e, 13, 28, 2); fire.position.set(-11, terrainHeight(-11, 27) + 2, 27); world.add(fire);
  const ember = new THREE.Mesh(new THREE.SphereGeometry(.45, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff9d45 })); ember.position.copy(fire.position); world.add(ember);
  // A distant mainland rises beyond the water, keeping the war's origin visible.
  const mainland = new THREE.Group(); mainland.position.set(0, -2, -450);
  for (let i = 0; i < 16; i++) { const m = box(40 + Math.random()*35, 12 + Math.random()*34, 22, 0x3a5964, -340 + i*43, 0, Math.random()*25, mainland); m.position.y = m.geometry.parameters.height / 2; }
  scene.add(mainland);
}

const characters = [];
function makeCharacter({ name, x, z, color, hostile = false, line }) {
  const root = new THREE.Group(); const y = terrainHeight(x, z);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, .9), new THREE.MeshStandardMaterial({ color, roughness: .65, emissive: hostile ? 0x230603 : 0 }));
  body.position.y = 1.25; body.castShadow = true; root.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(.82, .82, .82), new THREE.MeshStandardMaterial({ color: hostile ? 0x9c4e42 : 0xd9ae86 })); head.position.y = 2.72; head.castShadow = true; root.add(head);
  const aura = new THREE.Mesh(new THREE.RingGeometry(.8, 1.05, 16), new THREE.MeshBasicMaterial({ color: hostile ? 0xd24b35 : 0x8eceba, transparent: true, opacity: .7, side: THREE.DoubleSide })); aura.rotation.x = -Math.PI/2; aura.position.y = .05; root.add(aura);
  root.position.set(x, y, z); root.userData = { name, hostile, line, health: hostile ? 68 : 100, maxHealth: hostile ? 68 : 100, body, aura, alive: true, attackTimer: 0, home: new THREE.Vector3(x,y,z) };
  world.add(root); characters.push(root); return root;
}
function makeBoat() {
  const boat = new THREE.Group(); boat.position.set(2, -1.4, -128);
  const hull = box(8, 1.5, 19, 0x3c2519, 0, 0, 0, boat); hull.rotation.z = .03;
  const mast = box(.45, 12, .45, 0x4c3423, 0, 6, 0, boat);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(8, 7), new THREE.MeshStandardMaterial({ color: 0x7c2825, side: THREE.DoubleSide, roughness: .9 })); sail.position.set(2.2, 8, 0); boat.add(sail);
  const glow = new THREE.PointLight(0xff502a, 8, 30); glow.position.set(0, 4, -4); boat.add(glow); world.add(boat); return boat;
}

const boat = makeBoat();
function setupNPCs() {
  makeCharacter({ name: 'Mira, Village Keeper', x: -18, z: 17, color: 0x4d8193, line: 'The flames took the shrine, but not our will. Raiders come from the mainland every tide. Find your breath, then find your stance.' });
  makeCharacter({ name: 'Elder Sori', x: 7, z: 24, color: 0xa57b41, line: 'Your Ki answers when the mind becomes still. Hold Shift without moving to meditate. Let it flow while moving and it will carry you farther.' });
  makeCharacter({ name: 'Wounded Fisher', x: 17, z: 12, color: 0x788f5e, line: 'I saw their boats beyond the reef. Their captain is testing us. Do not meet steel with fear—your hands are enough.' });
  makeCharacter({ name: 'Mainland Raider', x: -8, z: -24, color: 0x7c3030, hostile: true, line: '' });
  makeCharacter({ name: 'Mainland Raider', x: 24, z: -38, color: 0x7c3030, hostile: true, line: '' });
  makeCharacter({ name: 'Mainland Raider', x: 39, z: 16, color: 0x7c3030, hostile: true, line: '' });
}

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize(); makeTerrain(); addWater(); addLight(); landmarkWorld(); setupNPCs();
camera.position.set(0, terrainHeight(0, 0) + 1.72, 1);

function showToast(message, time = 2600) { const el = $('toast'); el.textContent = message; el.classList.remove('hidden'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => el.classList.add('hidden'), time); }
function updateHUD() {
  $('health-bar').style.width = `${state.health}%`; $('ki-bar').style.width = `${state.ki}%`;
  $('health-text').textContent = `${Math.ceil(state.health)} / ${state.maxHealth}`; $('ki-text').textContent = `${Math.ceil(state.ki)} / ${state.maxKi}`;
  const moving = state.keys.KeyW || state.keys.KeyA || state.keys.KeyS || state.keys.KeyD;
  const mode = state.keys.ShiftLeft || state.keys.ShiftRight ? (moving ? 'Ki Flow · speed consumes Ki' : 'Meditating · restoring focus') : state.sprint > 0 && moving ? 'Sprinting' : 'Wandering · Double-tap W to sprint';
  $('stance-text').textContent = mode; $('stance-dot').style.background = (state.keys.ShiftLeft || state.keys.ShiftRight) ? '#6be1ee' : state.sprint > 0 ? '#e5b760' : '#d6ae61';
}
function yawForward() { return new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw)); }
function spawnDamage(pos, amount, hostile = false) {
  const v = pos.clone().project(camera); const el = document.createElement('div'); el.className = `damage${hostile ? ' enemy' : ''}`; el.textContent = `-${amount}`;
  el.style.left = `${(v.x *.5 + .5)*innerWidth}px`; el.style.top = `${(-v.y *.5 + .5)*innerHeight}px`; $('damage-layer').append(el); setTimeout(() => el.remove(), 810);
}
function enemyHit(enemy, damage, label = '') {
  if (!enemy.userData.alive) return;
  enemy.userData.health -= damage; enemy.userData.body.material.emissive.set(0xff3b24); setTimeout(() => enemy.userData?.body?.material.emissive.set(0x230603), 100);
  spawnDamage(enemy.position.clone().add(new THREE.Vector3(0, 3, 0)), damage);
  if (label) showToast(label, 1200);
  if (enemy.userData.health <= 0) { enemy.userData.alive = false; enemy.userData.aura.material.color.set(0x606060); enemy.rotation.z = Math.PI / 2; state.xp += 25; showToast(`Raider defeated · +25 Insight (${state.xp}/100)`, 3000); }
}
function playerHit(amount) { state.health = Math.max(0, state.health - amount); spawnDamage(camera.position.clone().add(yawForward().multiplyScalar(3)), amount, true); if (state.health <= 0) { state.health = state.maxHealth; state.ki = state.maxKi; camera.position.set(0, terrainHeight(0,0)+1.72, 1); showToast('You awaken beside the shrine. Resolve returns.', 3500); } }
function strike(kind = 'punch') {
  if (!state.running || state.menu || performance.now() < state.attackCooldown) return;
  const cfg = { punch: [12, 4, 'Iron Fist'], palm: [27, 7, 'Palm Strike'], sky: [18, 5, 'Sky Step'], guard: [38, 8, 'Guard Break'] }[kind];
  if (kind !== 'punch' && state.ki < cfg[1]) return showToast('Not enough Ki.', 1200);
  if (kind !== 'punch') state.ki -= cfg[1]; state.attackCooldown = performance.now() + (kind === 'punch' ? 390 : 850);
  const f = yawForward(); let landed = false;
  for (const enemy of characters) { if (!enemy.userData.hostile || !enemy.userData.alive) continue; const to = enemy.position.clone().sub(camera.position); const horizontal = new THREE.Vector3(to.x,0,to.z); const dist = horizontal.length(); horizontal.normalize();
    if (dist < cfg[2] && f.dot(horizontal) > (kind === 'guard' ? .1 : .42)) { enemyHit(enemy, cfg[0], cfg[2]); landed = true; }
  }
  if (!landed && kind !== 'punch') showToast(`${cfg[2]} echoes through the air.`, 900);
}
function activateSkill(code) {
  if (code === 'KeyZ') strike('palm');
  if (code === 'KeyX') { const f = yawForward(); camera.position.addScaledVector(f, 7); camera.position.y = terrainHeight(camera.position.x,camera.position.z)+1.72; strike('sky'); }
  if (code === 'KeyC') strike('guard');
}
function nearestCharacter() {
  let best = null, bestDist = 5.5; for (const c of characters) { if (!c.userData.alive || c.userData.hostile) continue; const d = c.position.distanceTo(camera.position); if (d < bestDist) { best=c; bestDist=d; } } return best;
}
function interact() { const npc = nearestCharacter(); if (!npc) return; state.quest = Math.max(1, state.quest); $('dialogue-name').textContent = npc.userData.name; $('dialogue-text').textContent = npc.userData.line; $('dialogue').classList.remove('hidden'); document.exitPointerLock(); }
function drawMap() {
  const map = $('map'), c = map.getContext('2d'), w = map.width; c.clearRect(0,0,w,w); c.save(); c.beginPath(); c.arc(w/2,w/2,w/2-2,0,Math.PI*2); c.clip();
  c.fillStyle='#123b50'; c.fillRect(0,0,w,w); c.fillStyle='#6a8452'; c.beginPath(); c.arc(w/2,w/2,67,0,Math.PI*2); c.fill(); c.fillStyle='#c4af72'; c.beginPath(); c.arc(w/2,w/2,61,0,Math.PI*2); c.fill(); c.fillStyle='#54713f'; c.beginPath(); c.arc(w/2,w/2,55,0,Math.PI*2); c.fill();
  const scale=.41; for(const npc of characters) { const x=w/2+npc.position.x*scale, y=w/2+npc.position.z*scale; if (x<0||x>w||y<0||y>w) continue; c.fillStyle=npc.userData.hostile?'#e25b47':'#a7e1c6'; c.beginPath(); c.arc(x,y,npc.userData.hostile?3:2.2,0,Math.PI*2);c.fill(); }
  const px=w/2+camera.position.x*scale, py=w/2+camera.position.z*scale; c.translate(px,py);c.rotate(-state.yaw);c.fillStyle='#fff4c8';c.beginPath();c.moveTo(0,-7);c.lineTo(4,6);c.lineTo(-4,6);c.fill();c.restore();
}
function openMenu(tab = 'inventory') {
  state.menu = true; document.exitPointerLock(); $('menu').classList.remove('hidden'); document.querySelectorAll('.menu-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const view = { inventory: `<h3>Inventory</h3><div class="stat-row"><span>Worn Traveler's Wraps</span><b>Light armor</b></div><div class="stat-row"><span>Shoreline Herb × 3</span><b>Restores 15 Health</b></div><div class="stat-row"><span>Charred Shrine Token</span><b>Quest item</b></div>`, stats: `<h3>Wayfarer · Level ${state.level}</h3><div class="stat-row"><span>Vitality</span><b>${state.maxHealth}</b></div><div class="stat-row"><span>Ki Capacity</span><b>${state.maxKi}</b></div><div class="stat-row"><span>Martial Power</span><b>12</b></div><div class="stat-row"><span>Insight</span><b>${state.xp} / 100</b></div>`, skills: `<h3>Martial Way: Tidebreaker</h3><div class="skill-card"><b>Z · Palm Strike</b><br>Spend 7 Ki to send force through a nearby foe.</div><div class="skill-card"><b>X · Sky Step</b><br>Spend 5 Ki to dash through danger and strike.</div><div class="skill-card"><b>C · Guard Break</b><br>Spend 8 Ki for a heavy stance-breaking blow.</div>`, map: `<h3>Ashen Isle</h3><p>The burned village stands on the eastern shore. Raiders from the mainland are probing the island. The mainland is visible over the northern horizon.</p><div class="stat-row"><span>Current objective</span><b>${state.quest ? 'Survive the first raid' : 'Speak with a survivor'}</b></div>` }; $('menu-content').innerHTML=view[tab];
}
function closePanels() { state.menu=false; $('menu').classList.add('hidden'); $('dialogue').classList.add('hidden'); }

addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') { state.menu ? closePanels() : openMenu(); return; }
  if (e.code === 'KeyE') interact(); if (['KeyZ','KeyX','KeyC'].includes(e.code)) activateSkill(e.code);
  if (e.code === 'KeyW' && !e.repeat) { if (performance.now()-state.lastW < 280) { state.sprint=1500; showToast('Sprint engaged', 750); } state.lastW=performance.now(); }
  state.keys[e.code]=true;
});
addEventListener('keyup', (e) => state.keys[e.code]=false);
canvas.addEventListener('click', () => { if (state.running && !state.menu && $('dialogue').classList.contains('hidden')) { if (document.pointerLockElement !== canvas) canvas.requestPointerLock(); else strike('punch'); } });
document.addEventListener('pointerlockchange', () => state.locked=document.pointerLockElement===canvas);
document.addEventListener('mousemove', (e) => { if (!state.locked) return; state.yaw -= e.movementX*.00225; state.pitch = THREE.MathUtils.clamp(state.pitch-e.movementY*.00225, -1.35, 1.3); });
$('play-button').addEventListener('click', () => { $('start-screen').classList.add('hidden'); state.running=true; canvas.requestPointerLock(); showToast('Ashen Isle loaded. Seek the survivors.', 3500); });
$('dialogue-close').addEventListener('click', () => { $('dialogue').classList.add('hidden'); canvas.requestPointerLock(); if (state.quest === 1) { state.quest=2; $('objective').textContent='First raid: test your martial way against the mainland raiders.'; showToast('Quest updated: Defend Ashen Isle', 2600); } });
document.querySelectorAll('.menu-tabs button').forEach(b => b.addEventListener('click', () => openMenu(b.dataset.tab)));

function update(dt) {
  state.elapsed += dt; if (!state.running) { camera.rotation.y = state.yaw; camera.rotation.x = state.pitch; renderer.render(scene,camera); return; }
  if (state.sprint > 0) state.sprint -= dt*1000;
  const move = new THREE.Vector3((state.keys.KeyD?1:0)-(state.keys.KeyA?1:0),0,(state.keys.KeyS?1:0)-(state.keys.KeyW?1:0));
  const moving=move.lengthSq()>0; const shift=state.keys.ShiftLeft||state.keys.ShiftRight;
  if (moving && !state.menu && $('dialogue').classList.contains('hidden')) {
    move.normalize(); const f=yawForward(), right=new THREE.Vector3(f.z,0,-f.x); let speed=8;
    if (state.sprint>0) speed=13; if (shift && state.ki>.1) { speed+=7; state.ki=Math.max(0,state.ki-dt*13); }
    camera.position.addScaledVector(f, move.z*speed*dt); camera.position.addScaledVector(right,move.x*speed*dt);
  } else if (shift) { state.ki=Math.min(state.maxKi,state.ki+dt*21); state.health=Math.min(state.maxHealth,state.health+dt*3.4); }
  if (!shift) state.ki=Math.min(state.maxKi,state.ki+dt*3.6);
  const r=Math.hypot(camera.position.x,camera.position.z); if (r>187) { camera.position.x*=187/r;camera.position.z*=187/r; }
  camera.position.y=terrainHeight(camera.position.x,camera.position.z)+1.72; camera.rotation.set(state.pitch,state.yaw,0);
  const nearest=nearestCharacter(); $('prompt').classList.toggle('hidden', !nearest || state.menu); if(nearest) $('prompt').innerHTML=`Press <kbd>E</kbd> to speak with ${nearest.userData.name}`;
  // Raider behavior: cube enemies close in and strike at close range.
  for (const enemy of characters) { if (!enemy.userData.hostile || !enemy.userData.alive) continue; const to=camera.position.clone().sub(enemy.position); const d=to.length(); if (d<27 && d>3) { to.y=0;to.normalize();enemy.position.addScaledVector(to,dt*2.1);enemy.position.y=terrainHeight(enemy.position.x,enemy.position.z);enemy.lookAt(camera.position.x,enemy.position.y,camera.position.z); } if(d<3.1) { enemy.userData.attackTimer-=dt; if(enemy.userData.attackTimer<=0){playerHit(7);enemy.userData.attackTimer=2.1;} } }
  boat.position.z = -128 + Math.sin(state.elapsed*.24)*2; boat.rotation.z=Math.sin(state.elapsed*.75)*.025; boat.rotation.y=Math.sin(state.elapsed*.2)*.08;
  updateHUD(); drawMap(); renderer.render(scene,camera);
}
function loop() { requestAnimationFrame(loop); update(Math.min(clock.getDelta(), .05)); }
loop();
