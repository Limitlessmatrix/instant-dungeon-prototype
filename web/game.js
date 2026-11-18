// Instant Dungeon: a small top-down adventure that plays through the story. No dependencies.
// Art comes from art/ (AI-generated); anything missing is drawn as a simple shape, so the game always runs.
'use strict';
const T = 48, VW = 960, VH = 540;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const G = { mode: 'title', step: 0, t: 0, L: null, pi: 0, pt: 0, fade: 0, saved: 0 };
const HEROES = {
  kai: { name: 'Kai', color: '#e8e8f0', ability: 'elemental bolt', cd: 0.35 },
  eris: { name: 'Eris', color: '#d8342c', ability: 'sword', cd: 0.45 },
  zephyr: { name: 'Zephyr', color: '#3fc7a0', ability: 'insight', cd: 2.5 },
};
const ENEMY = {
  r: { type: 'rabbit', hp: 1, r: 12, color: '#ffffff', size: 40, harmless: true },
  w: { type: 'boar', hp: 3, r: 16, color: '#8a5a3c', size: 60 },
  s: { type: 'slime', hp: 2, r: 14, color: '#58c458', size: 48 },
  v: { type: 'bat', hp: 1, r: 11, color: '#9050c8', size: 46, fly: true },
  n: { type: 'knight', hp: 5, r: 16, color: '#b8b8a0', size: 62 },
  '*': { type: 'boss', hp: 90, r: 44, color: '#3a2a55', size: 170 },
};

// ---------- assets, input, sound ----------
const IMG = {};
function img(path) {
  if (!IMG[path]) { const i = new Image(); i.ok = false; i.onload = () => { i.ok = true; }; i.src = 'art/' + path; IMG[path] = i; }
  return IMG[path];
}
const keys = new Set(), pressed = new Set();
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right',
  KeyD: 'right', Space: 'act', ShiftLeft: 'leap', ShiftRight: 'leap', KeyE: 'use', Tab: 'swap', Enter: 'ok', Escape: 'esc',
  KeyR: 'restart', KeyC: 'continue' };
addEventListener('keydown', e => { const k = KEYMAP[e.code]; if (!k) return; e.preventDefault(); if (!keys.has(k)) pressed.add(k); keys.add(k); audio(); });
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
cv.addEventListener('mousedown', () => { pressed.add('ok'); audio(); });
let AC = null;
function audio() { if (!AC && typeof AudioContext !== 'undefined') { try { AC = new AudioContext(); } catch (e) { AC = null; } } }
function beep(f, d = 0.08, type = 'square', v = 0.04) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = f; g.gain.value = v; g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + d);
  o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + d);
}
function save() { try { localStorage.setItem('instant-dungeon-step', String(G.step)); } catch (e) { /* private window */ } }
function loadSave() { try { return parseInt(localStorage.getItem('instant-dungeon-step') || '0', 10) || 0; } catch (e) { return 0; } }

// ---------- story flow ----------
function startStep(i) {
  G.step = i; G.fade = 1; save();
  const s = STORY[i];
  if (!s) { G.mode = 'end'; G.L = null; return; }
  if (s.panels) { G.mode = 'panels'; G.pi = 0; G.pt = 0; G.L = null; } else startLevel(s.level);
}

function startLevel(name) {
  const def = LEVELS[name];
  const L = { name, def, w: def.map[0].length, h: def.map.length, g: [], heroes: [], enemies: [], objs: [], shots: [], fx: [],
    latched: {}, held: new Set(), orbSeq: [], doorAt: new Map(), shift: [], t: 0, done: 0, dead: 0, dialog: null, active: 0,
    msg: '', msgT: 0, cam: { x: 0, y: 0 }, boss: null };
  let signN = 0;
  def.map.forEach((row, y) => {
    L.g.push([]);
    [...row].forEach((ch, x) => {
      let tile = '.';
      const cx = x * T + T / 2, cy = y * T + T / 2;
      if ('#~,g'.includes(ch)) tile = ch;
      else if (ch === '%' || ch === '^') { tile = ch; L.shift.push({ x, y, ch, closed: ch === '%' }); }
      else if (ch === '@') L.heroes.push(mkHero('kai', cx, cy));
      else if (ch === '+') L.heroes.push(mkHero('eris', cx, cy));
      else if (ch === '=') L.heroes.push(mkHero('zephyr', cx, cy));
      else if (ENEMY[ch]) L.enemies.push(mkEnemy(ch, cx, cy));
      else if (ch === '?') L.objs.push({ k: 'sign', x, y, text: def.signs[signN++] });
      else if (ch === '$') L.objs.push({ k: 'chest', x, y, open: false });
      else if (ch === 'X') L.objs.push({ k: 'exit', x, y });
      else if (ch >= '1' && ch <= '4') L.objs.push({ k: 'lever', x, y, id: ch, on: false, hidden: false });
      else if (ch === 'h') L.objs.push({ k: 'lever', x, y, id: def.hiddenLever, on: false, hidden: true });
      else if (ch >= '6' && ch <= '9') L.objs.push({ k: 'orb', x, y, id: ch, lit: false });
      else if (ch >= 'a' && ch <= 'f') L.objs.push({ k: 'plate', x, y, id: ch, down: false });
      else if (ch >= 'A' && ch <= 'P') { const d = { k: 'door', x, y, id: ch, open: false }; L.objs.push(d); L.doorAt.set(y * L.w + x, d); }
      L.g[y].push(tile);
    });
  });
  const order = ['kai', 'eris', 'zephyr'];
  L.heroes.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  L.boss = L.enemies.find(e => e.type === 'boss') || null;
  G.L = L; G.mode = 'play';
  if (def.intro) say(L, def.intro);
  return L;
}
function mkHero(id, x, y) { return { id, x, y, r: 14, face: { x: 0, y: 1 }, flip: false, hp: 5, cd: 0, dashCd: 0, inv: 0, aiT: 1 + Math.random() }; }
function mkEnemy(ch, x, y) {
  const d = ENEMY[ch];
  return { ...d, x, y, hx: x, hy: y, max: d.hp, stun: 0, state: 'idle', t: Math.random(), vx: 0, vy: 0, flash: 0, flip: false, vuln: 0, phase: 0 };
}
function say(L, lines, onDone) { L.dialog = { lines: lines.map(l => (typeof l === 'string' ? [null, l] : l)), i: 0, onDone: onDone || null }; }
function note(L, msg) { L.msg = msg; L.msgT = 3.5; }

// ---------- collision ----------
function occupied(L, tx, ty) {
  const x0 = tx * T, y0 = ty * T;
  const hit = e => e.x + e.r > x0 && e.x - e.r < x0 + T && e.y + e.r > y0 && e.y - e.r < y0 + T;
  return L.heroes.some(hit) || L.enemies.some(hit);
}
function solid(L, tx, ty, overWater) {
  if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return true;
  const c = L.g[ty][tx];
  if (c === '#') return true;
  if (c === '~') return !overWater;
  if (c === '%' || c === '^') return L.shift.find(s => s.x === tx && s.y === ty).closed;
  const d = L.doorAt.get(ty * L.w + tx);
  return d ? !d.open : false;
}
function blocked(L, x, y, r, overWater) {
  const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(L, tx, ty, overWater)) return true;
  return false;
}
function moveEnt(L, e, dx, dy) {
  let hit = false;
  if (dx) { if (!blocked(L, e.x + dx, e.y, e.r, e.fly)) e.x += dx; else hit = true; }
  if (dy) { if (!blocked(L, e.x, e.y + dy, e.r, e.fly)) e.y += dy; else hit = true; }
  return hit;
}
function sees(L, a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / (T / 2));
  for (let i = 1; i < n; i++) {
    const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
    if (solid(L, Math.floor(x / T), Math.floor(y / T), true)) return false;
  }
  return true;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function tileOf(e) { return { x: Math.floor(e.x / T), y: Math.floor(e.y / T) }; }

// ---------- mechanisms ----------
function mechanisms(L) {
  const held = new Set();
  for (const o of L.objs) if (o.k === 'plate') {
    const down = L.heroes.some(h => { const t = tileOf(h); return t.x === o.x && t.y === o.y; });
    if (down !== o.down) beep(down ? 520 : 300, 0.05);
    o.down = down;
    if (down) for (const d of (L.def.links[o.id] || [])) held.add(d);
  }
  L.held = held;
  for (const o of L.objs) if (o.k === 'door') {
    const want = !!L.latched[o.id] || held.has(o.id);
    if (want) o.open = true; else if (!occupied(L, o.x, o.y)) o.open = false;   // never closes on someone
  }
  const phase = Math.floor(L.t / 3) % 2;
  for (const s of L.shift) {
    const want = (s.ch === '%') === (phase === 0);
    if (!want) s.closed = false; else if (!occupied(L, s.x, s.y)) s.closed = true;
  }
}

function interact(L, h) {
  let best = null, bd = 62;
  for (const o of L.objs) {
    if (!['sign', 'chest', 'lever', 'orb'].includes(o.k) || o.hidden) continue;
    const d = Math.hypot(o.x * T + T / 2 - h.x, o.y * T + T / 2 - h.y);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return;
  if (best.k === 'sign') say(L, [best.text]);
  else if (best.k === 'lever') {
    best.on = !best.on; beep(240, 0.1);
    for (const d of (L.def.links[best.id] || [])) L.latched[d] = !L.latched[d];
    note(L, 'Somewhere, a gate ' + (best.on ? 'grinds open.' : 'falls shut.'));
  } else if (best.k === 'orb') {
    if (L.latched[L.def.orbDoor]) return;
    L.orbSeq.push(best.id); best.lit = true; beep(400 + 90 * L.orbSeq.length, 0.15, 'sine', 0.06);
    const want = L.def.orbOrder;
    if (L.orbSeq.some((id, i) => id !== want[i])) {
      L.orbSeq = []; for (const o of L.objs) if (o.k === 'orb') o.lit = false;
      note(L, 'The runes go dark. Wrong order.'); beep(110, 0.3, 'sawtooth');
    } else if (L.orbSeq.length === want.length) { L.latched[L.def.orbDoor] = true; note(L, 'The mechanism turns. A door unlocks.'); }
  } else if (best.k === 'chest' && !best.open) {
    best.open = true; beep(660, 0.3, 'sine', 0.06);
    say(L, ['Inside the chest: a mysterious artifact, humming softly, and a map of a far larger world.'], () => { L.done = 0.01; });
  }
}

// ---------- combat ----------
function hurtHero(L, h, from) {
  if (h.inv > 0 || L.done || L.dead) return;
  h.hp -= 1; h.inv = 1.0; beep(140, 0.15, 'sawtooth'); A(h).hit = 0.3; L.shake = 7;
  const d = Math.max(1, Math.hypot(h.x - from.x, h.y - from.y));
  moveEnt(L, h, (h.x - from.x) / d * 22, (h.y - from.y) / d * 22);
  if (h.hp <= 0) { L.dead = 0.01; note(L, 'You fall. The dungeon resets...'); }
}
function hurtEnemy(L, e, dmg, from) {
  if (e.harmless) { e.t = 0; e.vx = (e.x - from.x) * 2; e.vy = (e.y - from.y) * 2; return; }
  if (e.type === 'boss' && e.vuln <= 0) dmg *= 0.25;
  e.hp -= dmg; e.flash = 0.15; beep(300, 0.04); A(e).hit = 0.22;
  if (e.type !== 'boss') { const d = Math.max(1, dist(e, from)); moveEnt(L, e, (e.x - from.x) / d * 14, (e.y - from.y) / d * 14); }
  if (e.hp <= 0) {
    for (let i = 0; i < 10; i++) L.fx.push({ k: 'spark', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 240, vy: (Math.random() - 0.5) * 240, t: 0.5, color: e.color });
    L.enemies.splice(L.enemies.indexOf(e), 1);
    if (e.type === 'boss') { L.done = 0.01; L.enemies.length = 0; L.shots.length = 0; note(L, 'The guardian crumbles.'); beep(90, 0.8, 'sawtooth', 0.07); }
  }
}
function ability(L, h) {
  h.cd = HEROES[h.id].cd; A(h).atk = 0.22;
  if (h.id === 'kai') {
    const el = ['#ff7a3c', '#4cb4ff', '#d8fff0'][Math.floor(L.t * 3) % 3];
    L.shots.push({ x: h.x + h.face.x * 18, y: h.y + h.face.y * 18, vx: h.face.x * 430, vy: h.face.y * 430, t: 0.9, dmg: 1, hero: true, color: el, r: 7 });
    beep(700, 0.05, 'triangle');
  } else if (h.id === 'eris') {
    const p = { x: h.x + h.face.x * 34, y: h.y + h.face.y * 34 };
    L.fx.push({ k: 'slash', x: p.x, y: p.y, a: Math.atan2(h.face.y, h.face.x), t: 0.18 });
    for (const e of [...L.enemies]) if (dist(e, p) < 40 + e.r) hurtEnemy(L, e, 2, h);
    beep(220, 0.06, 'sawtooth');
  } else {
    L.fx.push({ k: 'pulse', x: h.x, y: h.y, t: 0.5 });
    for (const e of L.enemies) if (dist(e, h) < 170 + e.r) { if (e.type === 'boss') e.vuln = 4; else e.stun = 2.5; }
    for (const o of L.objs) if (o.hidden && Math.hypot(o.x * T + T / 2 - h.x, o.y * T + T / 2 - h.y) < 190) {
      o.hidden = false; note(L, 'Zephyr\'s insight reveals a hidden lever.');
    }
    beep(880, 0.25, 'sine', 0.05);
  }
}
function leap(L, h) {
  h.dashCd = 0.8;
  let best = 0;
  for (let d = 8; d <= 3.5 * T; d += 8) {
    const x = h.x + h.face.x * d, y = h.y + h.face.y * d;
    if (blocked(L, x, y, h.r, true)) break;
    if (!blocked(L, x, y, h.r, false)) best = d;
  }
  if (!best) return;
  L.fx.push({ k: 'trail', x: h.x, y: h.y, x2: h.x + h.face.x * best, y2: h.y + h.face.y * best, t: 0.25 });
  h.x += h.face.x * best; h.y += h.face.y * best; h.inv = Math.max(h.inv, 0.3); beep(520, 0.08, 'sine'); A(h).jump = JUMP_T;
}

// ---------- animation (looks only) ----------
// Every hero and enemy carries e.an: a smoothed draw position, a walk cycle driven by how fast it really moved,
// and short timers for attack, hit, leap and landing. Nothing here feeds back into the rules.
const JUMP_T = 0.26, LAND_T = 0.16;
function A(e) {
  return e.an || (e.an = { x: e.x, y: e.y, lx: e.x, ly: e.y, sp: 0, ph: 0, seed: Math.random() * 6.283, vxn: 0, atk: 0, hit: 0,
                           jump: 0, land: 0, alert: 0, was: false, fl: e.flip ? -1 : 1 });
}
function dust(L, x, y, n) {
  for (let i = 0; i < n; i++) L.fx.push({ k: 'dust', x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 4, vx: (Math.random() - 0.5) * 40, t: 0.4, r: 3 + Math.random() * 3 });
}
function animate(L, dt) {
  const k = x => Math.min(1, dt * x);
  for (const e of L.heroes.concat(L.enemies)) {
    const a = A(e), mvx = (e.x - a.lx) / Math.max(dt, 1e-4), mvy = (e.y - a.ly) / Math.max(dt, 1e-4), v = Math.hypot(mvx, mvy);
    a.lx = e.x; a.ly = e.y;
    const run = v > 900 ? 0 : Math.min(1, v / 130);                 // a leap or a knock-back is not a walk
    a.sp += (run - a.sp) * k(run > a.sp ? 14 : 9);
    a.vxn += (Math.max(-1, Math.min(1, v > 900 ? 0 : mvx / 170)) - a.vxn) * k(10);
    const step0 = Math.floor(a.ph / Math.PI); a.ph += dt * 14 * a.sp * (e.type === 'boss' ? 0.5 : 1);
    if (!e.fly && a.sp > 0.55 && a.jump <= 0 && Math.floor(a.ph / Math.PI) !== step0) dust(L, a.x, a.y + (e.size || 58) * 0.36, e.type === 'boss' ? 3 : 1);
    if (Math.hypot(e.x - a.x, e.y - a.y) > 400) { a.x = e.x; a.y = e.y; }            // new level: no slide across the map
    a.x += (e.x - a.x) * k(a.jump > 0 ? 12 : 24); a.y += (e.y - a.y) * k(a.jump > 0 ? 12 : 24);
    a.fl += ((e.flip ? -1 : 1) - a.fl) * k(20);
    if (a.jump > 0) { a.jump -= dt; if (a.jump <= 0) { a.land = LAND_T; dust(L, e.x, e.y + 20, 5); } }
    a.atk = Math.max(0, a.atk - dt); a.hit = Math.max(0, a.hit - dt); a.land = Math.max(0, a.land - dt); a.alert = Math.max(0, a.alert - dt);
    if (e.aware && !a.was && !e.harmless && e.type) { a.alert = 0.8; beep(980, 0.04, 'square', 0.02); }
    a.was = !!e.aware;
  }
  for (const o of L.objs) if (o.k === 'door') o.a = (o.a || 0) + ((o.open ? 1 : 0) - (o.a || 0)) * k(9);
  L.shake = Math.max(0, (L.shake || 0) - dt * 28);
}
// where and how to draw an entity this frame
function pose(e) {
  const a = A(e), w = a.sp, s = Math.sin(a.ph), idle = Math.sin(G.t * 2.6 + a.seed) * 0.02 * (1 - w);
  let x = a.x, y = a.y, hop = e.fly ? 0 : Math.abs(s) * (e.type === 'rabbit' ? 11 : 5) * w;
  let rot = (e.fly ? 0.5 : 1) * (s * 0.07 * w + a.vxn * 0.09), sy = 1 + idle + (e.fly ? 0 : Math.cos(a.ph * 2) * 0.045 * w), sx = 1 - idle;
  if (e.type === 'slime') { const q = Math.sin(G.t * 5 + a.seed) * (0.05 + 0.06 * w); sy += q; sx -= q; }
  if (e.type === 'bat') sx *= 1 + Math.sin(G.t * 20 + a.seed) * 0.13;
  if (e.state === 'aim') { x += (Math.random() - 0.5) * 4; rot += (e.x < (G.L.heroes[G.L.active] || e).x ? 1 : -1) * 0.12; }
  if (e.state === 'charge') rot += Math.max(-1, Math.min(1, (e.vx || 0))) * 0.18;
  if (a.jump > 0) { const j = 1 - a.jump / JUMP_T; hop += Math.sin(Math.PI * j) * 34; sy *= 1.12; sx *= 0.92; rot += a.vxn * 0.2; }
  if (a.land > 0) { const q = a.land / LAND_T; sy *= 1 - 0.22 * q; sx *= 1 + 0.2 * q; }
  if (a.atk > 0 && e.face) { const q = Math.sin(Math.PI * (1 - a.atk / 0.22)); x += e.face.x * 11 * q; y += e.face.y * 11 * q; sx *= 1 + 0.1 * q; rot += e.face.x * 0.16 * q; }
  if (a.hit > 0) { const q = a.hit / 0.3; sy *= 1 - 0.16 * q; sx *= 1 + 0.14 * q; x += Math.sin(G.t * 90) * 3 * q; }
  return { x, y, hop, rot, sx, sy, fl: a.fl, flash: a.hit > 0 ? Math.min(1, a.hit / 0.15) : 0 };
}

// ---------- update ----------
function updateHero(L, h, dt) {
  let dx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0), dy = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
  if (dx || dy) {
    const n = Math.hypot(dx, dy); dx /= n; dy /= n;
    h.face = { x: dx, y: dy }; if (dx) h.flip = dx < 0;
  }
  // ease in and out of the run instead of snapping to full speed
  const k = Math.min(1, dt * (dx || dy ? 14 : 18));
  h.vx = (h.vx || 0) + (dx * 175 - (h.vx || 0)) * k; h.vy = (h.vy || 0) + (dy * 175 - (h.vy || 0)) * k;
  if (Math.hypot(h.vx, h.vy) > 6) moveEnt(L, h, h.vx * dt, h.vy * dt); else h.vx = h.vy = 0;
  if (keys.has('act') && h.cd <= 0) ability(L, h);
  if (pressed.has('leap') && h.dashCd <= 0) leap(L, h);
  if (pressed.has('use')) interact(L, h);
}
function steer(L, e, tx, ty, speed, dt) {
  const d = Math.hypot(tx - e.x, ty - e.y);
  if (d < 2) return false;
  if (tx !== e.x) e.flip = tx < e.x;
  return moveEnt(L, e, (tx - e.x) / d * speed * dt, (ty - e.y) / d * speed * dt);
}
function updateAlly(L, h, lead, dt) {
  const foe = L.enemies.filter(e => !e.harmless).sort((a, b) => dist(a, h) - dist(b, h))[0];
  h.aiT -= dt;
  if (!foe) { if (dist(h, lead) > 90) steer(L, h, lead.x, lead.y, 150, dt); return; }
  const d = dist(h, foe), fx = (foe.x - h.x) / Math.max(1, d), fy = (foe.y - h.y) / Math.max(1, d);
  h.face = { x: fx, y: fy };
  if (h.id === 'eris') {
    if (d > foe.r + 40) steer(L, h, foe.x, foe.y, 150, dt); else if (h.aiT <= 0) { ability(L, h); h.aiT = 1.1; }
  } else if (h.id === 'kai') {
    if (d < 170) steer(L, h, h.x - fx * 50, h.y - fy * 50, 130, dt); else if (d > 300) steer(L, h, foe.x, foe.y, 130, dt);
    if (h.aiT <= 0 && sees(L, h, foe)) { ability(L, h); h.aiT = 1.0; }
  } else {
    if (d > foe.r + 120) steer(L, h, foe.x, foe.y, 140, dt); else if (h.aiT <= 0) { ability(L, h); h.aiT = 7; }
  }
}
function updateEnemy(L, e, dt) {
  e.flash -= dt; e.vuln -= dt;
  if (e.stun > 0) { e.stun -= dt; return; }
  const h = L.heroes[L.active], d = dist(e, h);
  e.t -= dt;
  if (e.type === 'rabbit') {
    if (e.t <= 0) { const a = Math.random() * 6.283, go = Math.random() < 0.7; e.vx = go ? Math.cos(a) * 70 : 0; e.vy = go ? Math.sin(a) * 70 : 0; e.t = 0.5 + Math.random(); }
    if (e.vx) e.flip = e.vx < 0;
    moveEnt(L, e, e.vx * dt, e.vy * dt); return;
  }
  const aware = d < 8 * T && sees(L, e, h); e.aware = aware;
  if (e.type === 'slime') { if (aware) steer(L, e, h.x, h.y, 55, dt); }
  else if (e.type === 'knight') { if (aware) steer(L, e, h.x, h.y, 72, dt); }
  else if (e.type === 'bat') {
    if (aware || e.summoned) { const w = Math.sin(L.t * 6 + e.hx) * 60; steer(L, e, h.x + w, h.y - w, 115, dt); }
  } else if (e.type === 'boar') {
    if (e.state === 'idle' && aware && d < 5.5 * T) { e.state = 'aim'; e.t = 0.55; }
    else if (e.state === 'aim' && e.t <= 0) { e.vx = (h.x - e.x) / d; e.vy = (h.y - e.y) / d; e.flip = e.vx < 0; e.state = 'charge'; e.t = 0.9; }
    else if (e.state === 'charge') { if (moveEnt(L, e, e.vx * 330 * dt, e.vy * 330 * dt) || e.t <= 0) { e.state = 'rest'; e.t = 0.9; } }
    else if (e.state === 'rest' && e.t <= 0) e.state = 'idle';
  } else if (e.type === 'boss') {
    if (e.state === 'idle') { e.state = 'chase'; e.t = 2.5; }
    else if (e.state === 'chase') { steer(L, e, h.x, h.y, 62, dt); if (e.t <= 0) { e.phase++; e.state = e.phase % 2 ? 'aim' : 'burst'; e.t = 0.8; } }
    else if (e.state === 'aim' && e.t <= 0) { e.vx = (h.x - e.x) / Math.max(1, d); e.vy = (h.y - e.y) / Math.max(1, d); e.state = 'charge'; e.t = 0.65; beep(80, 0.3, 'sawtooth'); }
    else if (e.state === 'charge') { if (moveEnt(L, e, e.vx * 400 * dt, e.vy * 400 * dt) || e.t <= 0) { e.state = 'chase'; e.t = 2.2; L.shake = 9; beep(60, 0.2, 'sawtooth', 0.05); } }
    else if (e.state === 'burst' && e.t <= 0) {
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + e.phase; L.shots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, t: 3, dmg: 1, hero: false, color: '#b070ff', r: 8 }); }
      if (e.hp < e.max / 2 && L.enemies.length < 4) for (let i = 0; i < 2; i++) { const b = mkEnemy('v', e.x + (i ? 70 : -70), e.y); b.summoned = true; L.enemies.push(b); }
      e.state = 'chase'; e.t = 2.5; beep(160, 0.2, 'square'); L.shake = 5;
    }
  }
  if (d < e.r + h.r) hurtHero(L, h, e);
}
function updateLevel(L, dt) {
  if (L.dialog) {
    if (pressed.has('ok') || pressed.has('act') || pressed.has('use')) {
      if (++L.dialog.i >= L.dialog.lines.length) { const f = L.dialog.onDone; L.dialog = null; if (f) f(); }
    }
    return;
  }
  L.t += dt; L.msgT -= dt;
  if (L.dead) { L.dead += dt; if (L.dead > 1.6) startLevel(L.name); return; }
  if (L.done) { L.done += dt; if (L.done > 1.4) startStep(G.step + 1); return; }
  if (pressed.has('restart')) { startLevel(L.name); return; }
  if (pressed.has('swap') && L.heroes.length > 1) { L.heroes[L.active].vx = L.heroes[L.active].vy = 0; L.active = (L.active + 1) % L.heroes.length; beep(600, 0.05, 'sine'); A(L.heroes[L.active]).land = LAND_T; }
  const lead = L.heroes[L.active];
  for (const h of L.heroes) { h.cd -= dt; h.dashCd -= dt; h.inv -= dt; }
  updateHero(L, lead, dt);
  if (L.def.party) for (const h of L.heroes) if (h !== lead) updateAlly(L, h, lead, dt);
  mechanisms(L);
  for (const e of [...L.enemies]) updateEnemy(L, e, dt);
  for (const s of [...L.shots]) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt;
    let gone = s.t <= 0 || solid(L, Math.floor(s.x / T), Math.floor(s.y / T), true);
    if (!gone && s.hero) { const e = L.enemies.find(e => dist(e, s) < e.r + s.r); if (e) { hurtEnemy(L, e, s.dmg, s); gone = true; } }
    else if (!gone && dist(lead, s) < lead.r + s.r) { hurtHero(L, lead, s); gone = true; }
    if (gone) L.shots.splice(L.shots.indexOf(s), 1);
  }
  for (const f of [...L.fx]) { f.t -= dt; if (f.k === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; } else if (f.k === 'dust') f.x += f.vx * dt; if (f.t <= 0) L.fx.splice(L.fx.indexOf(f), 1); }
  // goals
  const lt = tileOf(lead);
  if (L.objs.some(o => o.k === 'exit' && o.x === lt.x && o.y === lt.y)) L.done = 0.01;
  if (L.heroes.length > 1 && !L.def.party && L.heroes.every(h => { const t = tileOf(h); return L.g[t.y][t.x] === 'g'; })) {
    L.done = 0.01; note(L, 'Together again.');
  }
}
function update(dt) {
  G.t += dt; G.dt = dt; G.fade = Math.max(0, G.fade - dt * 2);
  if (G.mode === 'title') {
    G.saved = loadSave();
    if (pressed.has('continue') && G.saved > 0 && G.saved < STORY.length) startStep(G.saved);
    else if (pressed.has('ok') || pressed.has('act')) startStep(0);
  } else if (G.mode === 'panels') {
    const p = STORY[G.step].panels; G.pt += dt;
    if (pressed.has('esc')) startStep(G.step + 1);
    else if (pressed.has('ok') || pressed.has('act')) {
      if (G.pt * 45 < p[G.pi][1].length) G.pt = 999;            // first press: show the whole caption
      else if (++G.pi >= p.length) startStep(G.step + 1); else G.pt = 0;
    }
  } else if (G.mode === 'play') { updateLevel(G.L, dt); if (G.mode === 'play' && G.L) animate(G.L, dt); }
  else if (G.mode === 'end' && (pressed.has('ok') || pressed.has('act'))) { G.mode = 'title'; G.step = 0; save(); }
  pressed.clear();
}

// ---------- drawing ----------
function wrap(text, x, y, maxW, lh) {
  let line = '';
  for (const w of text.split(' ')) {
    if (ctx.measureText(line + w).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = ''; }
    line += w + ' ';
  }
  ctx.fillText(line, x, y); return y + lh;
}
const POSE0 = { hop: 0, rot: 0, sx: 1, sy: 1, flash: 0 };
function sprite(name, x, y, size, flip, color, bob, p) {
  p = p || POSE0;
  const i = img('sprites/' + name + '.png'), by = Math.sin(G.t * 6 + (p.seed || 0)) * (bob || 0) - p.hop, sh = Math.max(0.55, 1 - p.hop / 70);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y + size * 0.36, size * 0.3 * sh, size * 0.1 * sh, 0, 0, 6.283); ctx.fill();
  if (i.ok) {
    // pivot at the feet so squash, stretch and lean look planted
    ctx.save(); ctx.translate(x, y + size * 0.38 + by); ctx.rotate(p.rot);
    ctx.scale((typeof p.fl === 'number' ? p.fl : (flip ? -1 : 1)) * p.sx, p.sy);
    ctx.drawImage(i, -size / 2, -size, size, size);
    if (p.flash > 0) { const ga = ctx.globalAlpha; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * p.flash; ctx.drawImage(i, -size / 2, -size, size, size); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = ga; }
    ctx.restore();
  } else {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y - size * 0.1 + by, size * 0.3, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#111'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(name[0].toUpperCase(), x, y - size * 0.1 + by + 4);
  }
}
const FLAT = { grass: '#4f9a4a', path: '#b89b6a', vine_floor: '#6f7a62', vine_wall: '#23492a', goth_floor: '#4a4a55', goth_wall: '#1c1c26', water: '#3aa6c8', plate: '#7fa8ff' };
function tile(name, tx, ty, x, y) {
  const i = img('tiles/' + name + '.jpg');
  if (i.ok) { const q = i.width / 2; ctx.drawImage(i, (tx & 1) * q, (ty & 1) * q, q, q, x, y, T, T); }
  else { ctx.fillStyle = FLAT[name]; ctx.fillRect(x, y, T, T); ctx.fillStyle = 'rgba(0,0,0,0.06)'; if ((tx + ty) & 1) ctx.fillRect(x, y, T, T); }
}
function drawLevel(L) {
  const def = L.def, lead = L.heroes[L.active];
  const W = L.w * T, H = L.h * T;
  // the camera looks a little ahead of where the leader faces and eases there
  const la = A(lead), ahead = la.sp * 46;
  const cx = W <= VW ? (W - VW) / 2 : Math.max(0, Math.min(W - VW, la.x + lead.face.x * ahead - VW / 2));
  const cy = H + 52 <= VH ? (H + 52 - VH) / 2 : Math.max(0, Math.min(H + 52 - VH, la.y + lead.face.y * ahead - VH / 2));   // 52: the HUD band
  const ck = L.cam.ok ? Math.min(1, (G.dt || 0.016) * 6) : 1; L.cam.ok = true;
  L.cam.x += (cx - L.cam.x) * ck; L.cam.y += (cy - L.cam.y) * ck;
  const shx = L.shake ? (Math.random() - 0.5) * L.shake : 0, shy = L.shake ? (Math.random() - 0.5) * L.shake : 0;
  ctx.fillStyle = '#0c0c12'; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.translate(-Math.round(L.cam.x + shx), -Math.round(L.cam.y + shy));
  const x0 = Math.max(0, Math.floor(L.cam.x / T)), x1 = Math.min(L.w - 1, Math.floor((L.cam.x + VW) / T));
  const y0 = Math.max(0, Math.floor(L.cam.y / T)), y1 = Math.min(L.h - 1, Math.floor((L.cam.y + VH) / T));
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const c = L.g[ty][tx], x = tx * T, y = ty * T;
    if (c === '#') { tile(def.wall, tx, ty, x, y); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + T - 8, T, 8); }
    else if (c === '~') { tile('water', tx, ty, x, y); ctx.fillStyle = `rgba(255,255,255,${0.06 + 0.05 * Math.sin(G.t * 2 + tx + ty)})`; ctx.fillRect(x, y, T, T); }
    else {
      tile(c === ',' ? 'path' : def.floor, tx, ty, x, y);
      if (c === 'g') { ctx.fillStyle = `rgba(255,220,120,${0.14 + 0.08 * Math.sin(G.t * 3)})`; ctx.fillRect(x, y, T, T); }
      if (c === '%' || c === '^') {
        const s = L.shift.find(s => s.x === tx && s.y === ty), left = 3 - (L.t % 3);
        if (s.closed) { tile(def.wall, tx, ty, x, y); ctx.strokeStyle = 'rgba(160,255,160,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, T - 4, T - 4); }
        else { ctx.strokeStyle = `rgba(160,255,160,${left < 0.8 ? 0.9 : 0.3})`; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, T - 6, T - 6); ctx.setLineDash([]); }
      }
    }
  }
  for (const o of L.objs) {
    const x = o.x * T, y = o.y * T, cx = x + T / 2, cy = y + T / 2;
    if (o.hidden) continue;
    if (o.k === 'plate') {
      const p = img('tiles/plate.jpg');
      if (p.ok) ctx.drawImage(p, 0, 0, p.width / 2, p.height / 2, x + 6, y + 6, T - 12, T - 12); else { ctx.fillStyle = FLAT.plate; ctx.fillRect(x + 6, y + 6, T - 12, T - 12); }
      if (o.down) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 6, y + 6, T - 12, T - 12); }
      ctx.strokeStyle = o.down ? '#fff' : '#223'; ctx.lineWidth = 2; ctx.strokeRect(x + 6, y + 6, T - 12, T - 12);
    }
    else if (o.k === 'door') {
      const oa = o.a || 0;                                           // 0 shut .. 1 open: the gate sinks into the floor
      if (oa > 0.5) { ctx.strokeStyle = `rgba(255,255,255,${0.25 * oa})`; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y + 4, T - 8, T - 8); }
      if (oa < 0.97) { ctx.globalAlpha = 1 - oa * 0.6; sprite(L.name === 'vine' ? 'door_vine' : 'door_iron', cx, cy + 6, T + 10, false, '#7a5a2a', 0, { hop: 0, rot: 0, sx: 1, sy: 1 - oa, flash: 0 }); ctx.globalAlpha = 1; }
    } else if (o.k === 'lever') { sprite('lever', cx, cy + 4, 46, o.on, o.on ? '#ffd24a' : '#998866', 0); }
    else if (o.k === 'orb') {
      const col = def.orbColor[o.id];
      sprite('orb', cx, cy + 4, 50, false, col, 0);
      ctx.fillStyle = col; ctx.globalAlpha = o.lit ? 0.9 : 0.35 + 0.1 * Math.sin(G.t * 3); ctx.beginPath(); ctx.arc(cx, cy - 6, o.lit ? 13 : 8, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
    } else if (o.k === 'chest') sprite(o.open ? 'chest_open' : 'chest', cx, cy + 4, 56, false, '#c8962a', 0);
    else if (o.k === 'sign') { ctx.fillStyle = '#9a9a8a'; ctx.fillRect(cx - 12, cy - 16, 24, 28); ctx.fillStyle = '#555'; for (let i = 0; i < 3; i++) ctx.fillRect(cx - 8, cy - 10 + i * 7, 16, 2); }
    else if (o.k === 'exit') { const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 30); g.addColorStop(0, 'rgba(255,240,170,0.95)'); g.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = g; ctx.fillRect(x - 8, y - 8, T + 16, T + 16); }
  }
  const ents = [...L.heroes.map(h => ({ h, y: h.y })), ...L.enemies.map(e => ({ e, y: e.y }))].sort((a, b) => a.y - b.y);
  for (const it of ents) {
    if (it.h) {
      const h = it.h, me = h === lead, ps = pose(h); ps.seed = A(h).seed;
      if (me) { ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.25 * Math.sin(G.t * 5)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(ps.x, ps.y + 18, 19, 8, 0, 0, 6.283); ctx.stroke(); }
      ctx.globalAlpha = h.inv > 0 && A(h).hit <= 0 && Math.floor(G.t * 16) % 2 ? 0.45 : 1;      // hurt: flash, then blink while safe
      sprite(h.id, ps.x, ps.y, 58, h.flip, HEROES[h.id].color, 1.2 * (1 - A(h).sp), ps);
      ctx.globalAlpha = 1;
    } else {
      const e = it.e;
      if (e.type === 'boss' && e.vuln > 0) { ctx.fillStyle = `rgba(190,120,255,${0.25 + 0.15 * Math.sin(G.t * 12)})`; ctx.beginPath(); ctx.arc(e.x, e.y - 10, 70, 0, 6.283); ctx.fill(); }
      if ((e.state === 'aim') && Math.floor(G.t * 16) % 2) { ctx.fillStyle = 'rgba(255,60,60,0.35)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 10, 0, 6.283); ctx.fill(); }
      const ps = pose(e), ea = A(e); ps.seed = ea.seed;
      sprite(e.type, ps.x, ps.y, e.size, e.flip, e.color, e.fly ? 4 : 1.2 * (1 - ea.sp), ps);
      if (e.stun > 0) { ctx.fillStyle = '#ffe066'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('* *', ps.x + Math.sin(G.t * 8) * 6, ps.y - e.size * 0.5); }
      if (ea.alert > 0) {                                              // it just noticed you
        const q = Math.min(1, (0.8 - ea.alert) * 10), up = e.size * 0.62 + 8 * q;
        ctx.fillStyle = '#ffdd33'; ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.font = `bold ${Math.round(14 + 8 * q)}px sans-serif`; ctx.textAlign = 'center';
        ctx.globalAlpha = Math.min(1, ea.alert * 4); ctx.strokeText('!', ps.x, ps.y - up); ctx.fillText('!', ps.x, ps.y - up); ctx.globalAlpha = 1;
      }
    }
  }
  for (const s of L.shots) { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.45, 0, 6.283); ctx.fill(); }
  for (const f of L.fx) {
    if (f.k === 'slash') { ctx.strokeStyle = `rgba(255,255,255,${f.t / 0.18})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(f.x - Math.cos(f.a) * 22, f.y - Math.sin(f.a) * 22, 36, f.a - 1, f.a + 1); ctx.stroke(); }
    else if (f.k === 'pulse') { ctx.strokeStyle = `rgba(120,255,220,${f.t * 2})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, 170 * (1 - f.t * 2) + 4, 0, 6.283); ctx.stroke(); }
    else if (f.k === 'trail') { ctx.strokeStyle = `rgba(255,255,255,${f.t * 3})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); }
    else if (f.k === 'dust') { ctx.fillStyle = `rgba(235,230,210,${Math.max(0, f.t * 1.1)})`; ctx.beginPath(); ctx.arc(f.x, f.y - (0.4 - f.t) * 14, f.r * (1.6 - f.t * 1.5), 0, 6.283); ctx.fill(); }
    else { ctx.fillStyle = f.color; ctx.globalAlpha = Math.max(0, f.t * 2); ctx.fillRect(f.x - 3, f.y - 3, 6, 6); ctx.globalAlpha = 1; }
  }
  ctx.restore();
  // HUD
  ctx.textAlign = 'left'; ctx.font = 'bold 15px sans-serif';
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i < lead.hp ? '#ff4d5e' : 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(24 + i * 22, 24, 8, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.fillText(`${HEROES[lead.id].name}: ${HEROES[lead.id].ability}`, 140, 29);
  ctx.font = '14px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, VH - 52, VW, 52);
  ctx.fillStyle = '#ffe9a8'; ctx.fillText(def.goal, 16, VH - 30); ctx.fillStyle = '#c8c8d8'; ctx.fillText(def.hint + '    Restart: R', 16, VH - 10);
  if (L.t < 3 && !L.dialog) { ctx.textAlign = 'center'; ctx.font = 'bold 30px serif'; ctx.fillStyle = `rgba(255,255,255,${Math.min(1, 3 - L.t)})`; ctx.fillText(def.title, VW / 2, 110); }
  if (L.msgT > 0) { ctx.textAlign = 'center'; ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = `rgba(255,240,170,${Math.min(1, L.msgT)})`; ctx.fillText(L.msg, VW / 2, 80); }
  if (L.boss && L.enemies.includes(L.boss)) {
    const b = L.boss; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(280, 14, 400, 16);
    ctx.fillStyle = b.vuln > 0 ? '#c88cff' : '#8a3fd0'; ctx.fillRect(282, 16, 396 * Math.max(0, b.hp / b.max), 12);
    ctx.textAlign = 'center'; ctx.font = '12px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(b.vuln > 0 ? 'CORE OPEN' : 'core closed: needs insight', 480, 44);
  }
  if (L.dialog) {
    const [who, text] = L.dialog.lines[L.dialog.i];
    ctx.fillStyle = 'rgba(8,8,16,0.88)'; ctx.fillRect(40, VH - 190, VW - 80, 130); ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2; ctx.strokeRect(40, VH - 190, VW - 80, 130);
    let tx = 64;
    if (who) {
      const p = img('portraits/' + who + '.jpg');
      if (p.ok) ctx.drawImage(p, 52, VH - 180, 110, 110); else { ctx.fillStyle = HEROES[who].color; ctx.fillRect(52, VH - 180, 110, 110); }
      tx = 180; ctx.textAlign = 'left'; ctx.font = 'bold 17px sans-serif'; ctx.fillStyle = HEROES[who].color; ctx.fillText(HEROES[who].name, tx, VH - 160);
    }
    ctx.textAlign = 'left'; ctx.font = '17px serif'; ctx.fillStyle = '#fff'; wrap(text, tx, VH - (who ? 134 : 150), VW - 80 - (tx - 40) - 24, 24);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#aaa'; ctx.textAlign = 'right'; ctx.fillText('Space', VW - 56, VH - 70);
  }
  if (L.dead || L.done) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (L.dead || L.done) / 1.3)})`; ctx.fillRect(0, 0, VW, VH); }
}
function cover(i, zoom) {
  const s = Math.max(VW / i.width, VH / i.height) * zoom, w = i.width * s, h = i.height * s;
  ctx.drawImage(i, (VW - w) / 2, (VH - h) / 2, w, h);
}
function drawPanel() {
  const p = STORY[G.step].panels, [id, text] = p[G.pi], i = img('panels/' + id + '.jpg');
  ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, VW, VH);
  if (i.ok) cover(i, 1 + Math.min(0.06, G.pt * 0.006));
  else { const g = ctx.createLinearGradient(0, 0, VW, VH); g.addColorStop(0, '#1c2440'); g.addColorStop(1, '#40204a'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('[ illustration ' + id + ' ]', VW / 2, VH / 2 - 40); }
  ctx.fillStyle = 'rgba(6,6,12,0.78)'; ctx.fillRect(0, VH - 130, VW, 130);
  ctx.fillStyle = '#fff'; ctx.font = '20px serif'; ctx.textAlign = 'left';
  wrap(text.slice(0, Math.floor(G.pt * 45)), 48, VH - 92, VW - 96, 28);
  ctx.font = '12px sans-serif'; ctx.fillStyle = '#aaa'; ctx.textAlign = 'right'; ctx.fillText(`${G.pi + 1} / ${p.length}    Space: next    Esc: skip`, VW - 24, VH - 12);
}
function drawTitle(end) {
  const i = img('panels/p00.jpg');
  ctx.fillStyle = '#10101c'; ctx.fillRect(0, 0, VW, VH);
  if (i.ok) cover(i, 1.03 + 0.02 * Math.sin(G.t * 0.3));
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 64px serif'; ctx.fillText('Instant Dungeon', VW / 2, 200);
  ctx.font = '20px serif';
  if (end) { ctx.fillText('To be continued.', VW / 2, 270); ctx.font = '15px sans-serif'; ctx.fillStyle = '#ddd'; ctx.fillText('From the story "Instant Dungeon". Press Enter.', VW / 2, 320); return; }
  ctx.fillText('An isekai adventure', VW / 2, 245);
  ctx.font = '18px sans-serif'; ctx.fillStyle = `rgba(255,233,168,${0.6 + 0.4 * Math.sin(G.t * 3)})`; ctx.fillText('Press Enter to begin', VW / 2, 360);
  if (G.saved > 0 && G.saved < STORY.length) { ctx.fillStyle = '#ddd'; ctx.fillText('Press C to continue', VW / 2, 392); }
}
function draw() {
  if (G.mode === 'title') drawTitle(false); else if (G.mode === 'end') drawTitle(true);
  else if (G.mode === 'panels') drawPanel(); else if (G.L) drawLevel(G.L);
  if (G.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${G.fade})`; ctx.fillRect(0, 0, VW, VH); }
}
let last = 0;
function frame(ts) {
  const dt = Math.min(0.033, (ts - last) / 1000 || 0.016); last = ts;
  update(dt); draw(); requestAnimationFrame(frame);
}
if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(frame);
if (typeof globalThis.__ID_TEST__ !== 'undefined') Object.assign(globalThis.__ID_TEST__, { G, keys, pressed, update, draw, startStep, startLevel, solid, tileOf, T, mechanisms, interact, ability, leap });
// dev: index.html?level=vine jumps straight into a level, ?step=5 into a story step
if (typeof location !== 'undefined') {
  const q = new URLSearchParams(location.search);
  if (LEVELS[q.get('level')]) { G.step = STORY.findIndex(s => s.level === q.get('level')); startLevel(q.get('level')); G.L.dialog = q.has('talk') ? G.L.dialog : null; }
  else if (q.has('step')) startStep(parseInt(q.get('step'), 10) || 0);
}
