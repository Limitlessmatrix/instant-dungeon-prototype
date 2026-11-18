// Headless check of the game: map shapes, reachability, mechanisms, and a fuzz run of every story step.
//   node tools/smoke.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const web = path.join(__dirname, '..', 'web');
const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'width' ? 100 : k === Symbol.toPrimitive ? () => 0 : any()), apply: () => any(), set: () => true });
const sandbox = {
  document: { getElementById: () => ({ getContext: () => any(), addEventListener() {} }) },
  addEventListener() {}, Image: function () { this.ok = false; }, localStorage: { getItem: () => null, setItem() {} },
  __ID_TEST__: {}, console, Math, module: undefined,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(web, 'data.js'), 'utf8') + '\n' + fs.readFileSync(path.join(web, 'game.js'), 'utf8') +
  '\n__ID_TEST__.LEVELS = LEVELS; __ID_TEST__.STORY = STORY; __ID_TEST__.dist = dist;', sandbox);
const X = sandbox.__ID_TEST__, { G, LEVELS, STORY, T } = X;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const step = (n, keysDown = []) => { for (let i = 0; i < n; i++) { keysDown.forEach(k => { X.keys.add(k); }); X.update(1 / 60); X.draw(); } keysDown.forEach(k => X.keys.delete(k)); };
const press = k => { X.pressed.add(k); X.update(1 / 60); };
const at = (h, x, y) => { h.x = x * T + T / 2; h.y = y * T + T / 2; };
const obj = (L, k, id) => L.objs.find(o => o.k === k && (id === undefined || o.id === id));

// 1. shapes and reachability (doors, shifting walls and water count as passable)
for (const [name, def] of Object.entries(LEVELS)) {
  ok(def.map.every(r => r.length === def.map[0].length), `${name}: rows have equal width (${def.map.map(r => r.length).join(',')})`);
  const L = X.startLevel(name); L.dialog = null;
  const seen = new Set(), q = L.heroes.map(h => X.tileOf(h));
  q.forEach(t => seen.add(t.y * L.w + t.x));
  while (q.length) {
    const t = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = t.x + dx, y = t.y + dy, k = y * L.w + x;
      if (x < 0 || y < 0 || x >= L.w || y >= L.h || L.g[y][x] === '#' || seen.has(k)) continue;
      seen.add(k); q.push({ x, y });
    }
  }
  const lost = L.objs.filter(o => !seen.has(o.y * L.w + o.x)).map(o => o.k + (o.id || ''));
  ok(lost.length === 0, `${name}: every object is reachable ${lost}`);
  const ids = new Set(L.objs.filter(o => o.k === 'door').map(o => o.id));
  const linked = Object.values(def.links || {}).flat().concat(def.orbDoor ? [def.orbDoor] : []);
  ok(linked.every(d => ids.has(d)) && [...ids].every(d => linked.includes(d)), `${name}: links and doors match (${[...ids]})`);
  ok((def.signs || []).length === L.objs.filter(o => o.k === 'sign').length, `${name}: sign texts match signs`);
}

// 2. field: leap crosses the stream, exit completes the level
let L = X.startLevel('field'); let h = L.heroes[0];
at(h, 16, 2); h.face = { x: 1, y: 0 }; X.leap(L, h);
ok(X.tileOf(h).x >= 19, `field: leap crosses the 2-tile stream (landed in column ${X.tileOf(h).x})`);
at(h, 15, 2); h.x -= 20; const bx = h.x; h.dashCd = 0; X.leap(L, h);
ok(L.g[X.tileOf(h).y][X.tileOf(h).x] !== '~', `field: a short leap never lands in water (moved ${Math.round(h.x - bx)} px)`);
const ex = obj(L, 'exit'); at(h, ex.x, ex.y); G.step = 2; step(120);
ok(G.mode === 'panels' && G.step === 3, 'field: stepping on the exit moves the story on');

// 3. vine: wrong then right orb order, lever, chest
L = X.startLevel('vine'); h = L.heroes[0];
const useAt = (k, id) => { const o = obj(L, k, id); at(h, o.x, o.y + 1); X.interact(L, h); };
useAt('orb', '6'); ok(L.orbSeq.length === 0, 'vine: a wrong orb resets the sequence');
['8', '6', '7', '9'].forEach(id => useAt('orb', id)); X.mechanisms(L);
ok(obj(L, 'door', 'M').open, 'vine: the riddle order opens door M');
ok(!obj(L, 'door', 'A').open, 'vine: door A is shut before the lever'); useAt('lever', '1'); X.mechanisms(L);
ok(obj(L, 'door', 'A').open, 'vine: the lever opens door A');
const sh = L.shift[0]; L.t = 0; X.mechanisms(L); const c0 = sh.closed; L.t = 3.1; X.mechanisms(L);
ok(c0 !== sh.closed, 'vine: shifting walls change phase');
at(h, sh.x, sh.y); L.t = sh.closed ? 3.1 : 0; sh.closed = false; X.mechanisms(L); ok(!sh.closed, 'vine: a wall never closes on the player');
G.step = 4; useAt('chest'); ok(!!L.dialog, 'vine: the chest opens a dialog'); press('ok'); step(120);
ok(G.step === 5, 'vine: closing the chest dialog moves the story on');

// 4. gothic: the whole plate chain, in order
L = X.startLevel('gothic'); L.dialog = null; G.step = 6;
const [kai, eris, zeph] = L.heroes; const door = id => obj(L, 'door', id), plate = id => obj(L, 'plate', id);
const stand = (who, id) => { const p = plate(id); at(who, p.x, p.y); X.mechanisms(L); };
ok('ABCDHIJ'.split('').every(d => !door(d).open), 'gothic: all gates start shut');
stand(kai, 'a'); ok(door('A').open, 'gothic: Kai on plate a opens A for Eris');
stand(eris, 'b'); ok(door('B').open, 'gothic: Eris on plate b opens B for Zephyr');
const hl = L.objs.find(o => o.k === 'lever'); ok(hl.hidden, 'gothic: the lever starts hidden');
at(zeph, hl.x, hl.y + 1); X.interact(L, zeph); ok(!door('C').open && hl.hidden, 'gothic: a hidden lever cannot be used');
X.ability(L, zeph); ok(!hl.hidden, 'gothic: insight reveals the lever'); X.interact(L, zeph); X.mechanisms(L);
ok(door('C').open, 'gothic: the lever opens C for Kai');
stand(kai, 'c'); ok(door('D').open, 'gothic: Kai on plate c opens D for Eris');
stand(eris, 'e'); ok(door('J').open && door('H').open, 'gothic: Eris on plate e opens J and H');
at(kai, 36, 2); stand(zeph, 'f'); ok(door('I').open, 'gothic: plate f in the hall opens I for Eris');
L.enemies.length = 0; at(kai, 38, 5); at(eris, 39, 6); ok(L.done === 0, 'gothic: not done until all three gather');
at(zeph, 40, 7); step(120); ok(G.step === 7, 'gothic: gathering all three moves the story on');

// 5. boss: closed core takes quarter damage, allies fight, the fight can be won and lost
L = X.startLevel('boss'); L.dialog = null; G.step = 8;
const boss = L.boss, hp0 = boss.hp; L.active = 1; at(L.heroes[1], 11, 5); L.heroes[1].face = { x: 1, y: 0 }; X.ability(L, L.heroes[1]);
ok(Math.abs(hp0 - boss.hp - 0.5) < 1e-9, `boss: sword on a closed core does 0.5 (${hp0 - boss.hp})`);
X.ability(L, L.heroes[2].x ? (at(L.heroes[2], 11, 6), L.heroes[2]) : L.heroes[2]); ok(boss.vuln > 0, 'boss: insight opens the core');
const hp1 = boss.hp; X.ability(L, L.heroes[1]); ok(hp1 - boss.hp === 2, 'boss: sword on an open core does 2');
L = X.startLevel('boss'); L.dialog = null; L.active = 0; let frames = 0;
while (G.L === L && !L.done && !L.dead && frames < 60 * 600) { L.heroes[0].hp = 5; X.keys.add('act'); X.update(1 / 60); frames++; }
X.keys.clear(); ok(L.done > 0, `boss: allies plus the player bring it down (${Math.round(frames / 60)} s of game time with an idle, unkillable player)`);
step(120); ok(G.step === 9 && G.mode === 'panels', 'boss: winning moves the story on');
L = X.startLevel('boss'); L.dialog = null; L.heroes[0].hp = 1; L.heroes[0].inv = 0; at(L.heroes[0], 12, 5); step(200);
ok(G.L !== L && G.L.name === 'boss', 'boss: dying restarts the level');

// 6. the whole story can be walked through; fuzz every level with random input
X.startStep(0); let guard = 0;
while (G.mode !== 'end' && guard++ < 500) { if (G.mode === 'panels') { press('ok'); press('ok'); } else { X.startStep(G.step + 1); } }
ok(G.mode === 'end', `story: ${STORY.length} steps run through to the ending`);
const K = ['up', 'down', 'left', 'right', 'act', 'leap', 'use', 'swap'];
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (const name of Object.keys(LEVELS)) {
  X.startLevel(name); let err = null;
  try {
    for (let i = 0; i < 6000; i++) {
      if (i % 20 === 0) { X.keys.clear(); K.forEach(k => { if (rnd() < 0.3) { X.keys.add(k); X.pressed.add(k); } }); }
      if (G.L && G.L.dialog) X.pressed.add('ok');
      if (G.mode !== 'play') X.startLevel(name);
      X.update(1 / 30); X.draw();
      const bad = G.L.heroes.concat(G.L.enemies).find(e => !Number.isFinite(e.x + e.y) || X.solid(G.L, Math.floor(e.x / T), Math.floor(e.y / T), true) && G.L.g[Math.floor(e.y / T)][Math.floor(e.x / T)] === '#');
      if (bad) throw new Error('entity inside a wall or NaN: ' + (bad.id || bad.type));
    }
  } catch (e) { err = e; }
  X.keys.clear(); ok(!err, `fuzz ${name}: 6000 frames of random input ${err ? err.stack : ''}`);
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
