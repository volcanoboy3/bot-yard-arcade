/* Bot Yard Arcade · engine.js
 * Game registry, the play screen, and the `api` object each game receives.
 *
 * A game file registers itself:
 *
 *   Arcade.register({
 *     id: 'robo-runner',               // kebab-case, same as the file name
 *     title: 'Robo Runner',
 *     cat: 'action',                    // action | puzzle | brain | versus | builder
 *     blurb: 'One line for the card.',
 *     rules: ['Short rule', 'Short rule'],   // shown on the start card (2–4 lines)
 *     how: 'Space or tap to jump',      // controls line under the stage
 *     accent: '#f5c518',                // card highlight colour
 *     usesPlayer: true,                 // the player's own bot appears in this game
 *     touch: ['left', 'right', {key: 'fire', label: 'Jump'}],   // on-screen buttons on touch screens
 *     modes: [{id: 'easy', label: 'Easy', note: '9×9'}],        // optional difficulty picker
 *     thumb(ctx, w, h, kit, player) {}, // static card art, drawn at 320×200
 *     start(api) { return () => {} }    // runs when the player presses Start; may return a cleanup fn
 *   });
 *
 * Everything created through api (loop, after, every, on, canvas, stage children) is torn down
 * automatically on restart or exit.
 */
(function () {
  'use strict';

  const kit = window.BotKit;
  const Arcade = window.Arcade = { games: [], byId: {}, kit };
  const CATS = { action: 'Action', puzzle: 'Puzzle', brain: 'Brain', versus: 'Vs Bot', builder: 'Builder' };
  Arcade.CATS = CATS;

  // ---------- tiny event bus for the hub ----------
  const listeners = {};
  Arcade.on = (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); };
  function emit(name, data) { (listeners[name] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }

  // ---------- storage (may be unavailable; never required) ----------
  const NS = 'botyard:';
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(NS + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
    }
  };
  Arcade.store = store;

  Arcade.register = function (def) {
    if (!def || !def.id || typeof def.start !== 'function') { console.error('Arcade.register: bad game definition', def); return; }
    if (Arcade.byId[def.id]) { console.error('Arcade.register: duplicate id ' + def.id); return; }
    def.cat = CATS[def.cat] ? def.cat : 'action';
    Arcade.games.push(def);
    Arcade.byId[def.id] = def;
  };

  // ---------- the player's bot ----------
  const PLAYER_DEFAULT = { name: 'BOLT-7', body: '#5ad1e6', eye: '#bff6ff', head: 'box', antenna: 'ball', base: 'wheels' };
  Arcade.player = Object.assign({}, PLAYER_DEFAULT, store.get('player', null) || {});
  Arcade.setPlayer = patch => {
    Object.assign(Arcade.player, patch);
    store.set('player', Arcade.player);
    emit('player', Arcade.player);
  };

  // ---------- scores and play counts ----------
  Arcade.best = id => Number(store.get('best:' + id, 0)) || 0;
  function recordBest(id, score) {
    score = Math.round(Number(score) || 0);
    if (score > 0 && score > Arcade.best(id)) { store.set('best:' + id, score); emit('best', { id, score }); return true; }
    return false;
  }
  const stats = store.get('stats', null) || { plays: {} };
  Arcade.plays = id => (stats.plays && stats.plays[id]) || 0;
  function countPlay(id) {
    stats.plays = stats.plays || {};
    stats.plays[id] = (stats.plays[id] || 0) + 1;
    store.set('stats', stats);
  }
  const fmt = n => Math.round(Number(n) || 0).toLocaleString('en-US');
  Arcade.fmt = fmt;

  // ---------- sound: a tiny chiptune synth ----------
  const Sound = (function () {
    let ac = null, master = null, noiseBuf = null;
    let muted = !!store.get('muted', false);
    function ensure() {
      if (!ac) {
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
        } catch (e) { ac = null; }
      }
      if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
      return ac;
    }
    function tone(freq, dur, type, vol, slide, delay) {
      if (muted || !ensure()) return;
      dur = dur || 0.08;
      const t0 = ac.currentTime + (delay || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(vol == null ? 0.05 : vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }
    function noise(dur, vol, delay) {
      if (muted || !ensure()) return;
      dur = dur || 0.3;
      if (!noiseBuf) {
        noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t0 = ac.currentTime + (delay || 0);
      const src = ac.createBufferSource(); src.buffer = noiseBuf;
      const f = ac.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(2000, t0); f.frequency.exponentialRampToValueAtTime(180, t0 + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(vol == null ? 0.08 : vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.02);
    }
    const arp = (notes, gap, dur, type, vol) => notes.forEach((f, i) => tone(f, dur, type, vol, 0, i * gap));
    const SFX = {
      click: () => tone(520, 0.04, 'square', 0.035),
      blip: () => tone(660, 0.06, 'square', 0.04),
      tick: () => tone(1000, 0.025, 'square', 0.025),
      coin: () => { tone(880, 0.06, 'square', 0.04); tone(1320, 0.1, 'square', 0.04, 0, 0.06); },
      jump: () => tone(300, 0.16, 'square', 0.045, 500),
      zap: () => tone(1400, 0.14, 'sawtooth', 0.035, -1100),
      hit: () => { tone(180, 0.22, 'sawtooth', 0.06, -120); noise(0.15, 0.05); },
      boom: () => { tone(140, 0.4, 'sawtooth', 0.07, -100); noise(0.45, 0.11); },
      power: () => arp([523, 659, 784], 0.07, 0.1, 'square', 0.04),
      levelup: () => arp([660, 880, 1100, 1320], 0.06, 0.09, 'square', 0.04),
      win: () => arp([523, 659, 784, 1046], 0.11, 0.16, 'square', 0.045),
      lose: () => arp([392, 330, 262, 196], 0.13, 0.2, 'triangle', 0.07),
      error: () => { tone(150, 0.1, 'square', 0.045); tone(150, 0.12, 'square', 0.045, 0, 0.13); },
      talk: () => {
        const n = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) tone(300 + Math.random() * 900, 0.07, 'square', 0.03, (Math.random() - 0.5) * 400, i * 0.075);
      }
    };
    return {
      unlock: ensure,
      tone, noise,
      sfx(name) { if (muted) return; const f = SFX[name]; if (f) f(); },
      names: Object.keys(SFX),
      get muted() { return muted; },
      setMuted(m) { muted = !!m; store.set('muted', muted); emit('muted', muted); }
    };
  })();
  Arcade.sound = Sound;

  // ---------- play screen ----------
  const $ = id => document.getElementById(id);
  const ui = {
    hub: $('hub'), play: $('play'), stage: $('stage'), wrap: $('stage-wrap'),
    title: $('play-title'), cat: $('play-cat'), score: $('play-score'), best: $('play-best'), stats: $('play-stats'),
    pause: $('play-pause'), restart: $('play-restart'), sound: $('play-sound'), back: $('play-back'),
    card: $('play-card'), how: $('play-how'), pad: $('play-pad'), toast: $('play-toast')
  };
  const touchQuery = window.matchMedia ? window.matchMedia('(hover: none) and (pointer: coarse)') : { matches: false };
  const isTouch = () => touchQuery.matches;

  let view = null;   // { def, mode } while the play screen is showing
  let S = null;      // the running session (after Start), or null on the start card
  let hubScroll = 0;

  function el(tag, props) {
    const node = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'on') for (const ev in v) node.addEventListener(ev, v[ev]);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k in node && typeof v !== 'string') node[k] = v;
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      const ch = arguments[i];
      if (ch == null || ch === false) continue;
      if (Array.isArray(ch)) ch.forEach(x => x != null && node.append(x.nodeType ? x : String(x)));
      else node.append(ch.nodeType ? ch : String(ch));
    }
    return node;
  }
  Arcade.el = el;

  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    again: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M4.5 3.5v5h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15l7-7 7 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  Arcade.ICON = ICON;

  function syncSoundButton() {
    ui.sound.innerHTML = Sound.muted ? ICON.soundOff : ICON.soundOn;
    ui.sound.setAttribute('aria-pressed', String(Sound.muted));
    ui.sound.setAttribute('aria-label', Sound.muted ? 'Turn sound on' : 'Turn sound off');
  }
  Arcade.on('muted', syncSoundButton);
  ui.pause.innerHTML = ICON.pause;
  ui.restart.innerHTML = ICON.again;
  syncSoundButton();

  // Clicking a toolbar button with the mouse should not leave it focused,
  // or the next Space press would "click" it again instead of reaching the game.
  function tool(btn, fn) {
    btn.addEventListener('click', e => {
      fn();
      if (e.detail > 0) { btn.blur(); focusStage(); }
    });
  }
  tool(ui.back, () => Arcade.exit());
  tool(ui.restart, () => { if (view) { if (S) restart(); else begin(view.mode); } });
  tool(ui.pause, () => { if (S && S.state === 'play') pause(); else if (S && S.state === 'paused') resume(); });
  tool(ui.sound, () => { Sound.setMuted(!Sound.muted); if (!Sound.muted) { Sound.unlock(); Sound.sfx('blip'); } });

  // Move focus off toolbar and card buttons so Space/Enter reach the game, but never pull it
  // away from something inside the stage (such as a game's hidden text input).
  function focusStage() {
    const a = document.activeElement;
    if (a && a !== document.body && !ui.stage.contains(a) && typeof a.blur === 'function') a.blur();
  }

  // ---------- cards ----------
  function showCard(node, focusSel) {
    ui.card.replaceChildren(node);
    ui.card.hidden = false;
    const f = node.querySelector(focusSel || '.btn.primary') || node.querySelector('button');
    if (f) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  }
  function hideCard() { ui.card.hidden = true; ui.card.replaceChildren(); }

  function btn(label, cls, onClick, icon) {
    return el('button', { type: 'button', class: 'btn ' + (cls || ''), on: { click: onClick }, html: (icon || '') + '<span>' + label + '</span>' });
  }

  function catTags(def) {
    return el('div', { class: 'card-tags' },
      el('span', { class: 'tag' }, CATS[def.cat]),
      def.usesPlayer ? el('span', { class: 'tag tag-you' }, 'Stars your bot') : null);
  }

  function splashCard() {
    const def = view.def;
    const best = Arcade.best(def.id);
    let actions;
    if (def.modes && def.modes.length) {
      actions = el('div', { class: 'modes', role: 'group', 'aria-label': 'Choose a mode' },
        def.modes.map(m => el('button', {
          type: 'button', class: 'btn mode' + (m.id === view.mode ? ' primary' : ''),
          on: { click: () => begin(m.id) }
        }, el('span', null, m.label), m.note ? el('small', null, m.note) : null)));
    } else {
      actions = el('div', { class: 'actions' }, btn('Start', 'primary big', () => begin(null), ICON.play));
    }
    return el('div', { class: 'card splash' },
      catTags(def),
      el('h3', null, def.title),
      def.blurb ? el('p', { class: 'lede' }, def.blurb) : null,
      def.rules && def.rules.length ? el('ul', { class: 'rules' }, def.rules.map(r => el('li', null, r))) : null,
      def.how ? el('p', { class: 'keys' }, el('b', null, 'Controls '), def.how) : null,
      actions,
      el('p', { class: 'best-line' }, best ? 'Your best: ' + fmt(best) : 'No score yet. Set the first one.'));
  }

  function resultCard(won, o, isBest, score) {
    const def = view.def;
    const next = o.next && typeof o.next.run === 'function' ? o.next : null;
    const acts = [];
    if (next) {
      acts.push(btn(next.label || 'Next', 'primary', () => { if (!S) return; hideCard(); S.state = 'play'; focusStage(); S.safe(next.run); }, ICON.play));
      acts.push(btn('Restart', '', restart, ICON.again));
    } else {
      acts.push(btn('Play again', 'primary', restart, ICON.again));
    }
    acts.push(btn('Arcade', 'ghost', () => Arcade.exit()));
    return el('div', { class: 'card result ' + (won ? 'is-win' : 'is-lose') },
      el('p', { class: 'kicker' }, won ? 'Mission complete' : 'Game over'),
      el('h3', null, o.title || (won ? 'You win!' : 'Powered down')),
      o.detail ? el('p', { class: 'detail' }, o.detail) : null,
      o.hideScore ? null : el('div', { class: 'final' }, el('span', null, o.scoreLabel || 'Score'), el('b', null, fmt(score))),
      isBest ? el('p', { class: 'best-line is-new' }, 'New best!')
        : el('p', { class: 'best-line' }, 'Best: ' + fmt(Arcade.best(def.id))),
      el('div', { class: 'actions' }, acts),
      def.modes && def.modes.length && !next ? el('button', { type: 'button', class: 'link', on: { click: toMenu } }, 'Change mode') : null);
  }

  function pauseCard() {
    return el('div', { class: 'card pause' },
      el('p', { class: 'kicker' }, 'Standby'),
      el('h3', null, 'Paused'),
      el('div', { class: 'actions' },
        btn('Resume', 'primary', resume, ICON.play),
        btn('Restart', '', restart, ICON.again),
        btn('Arcade', 'ghost', () => Arcade.exit())));
  }

  function faultCard(err) {
    return el('div', { class: 'card fault' },
      el('p', { class: 'kicker' }, 'System fault'),
      el('h3', null, 'This game hit a bug'),
      el('p', { class: 'detail' }, String((err && err.message) || err)),
      el('div', { class: 'actions' }, btn('Restart', 'primary', restart, ICON.again), btn('Arcade', 'ghost', () => Arcade.exit())));
  }

  // ---------- backdrop art behind the start card ----------
  function drawBackdrop() {
    const def = view && view.def;
    const old = ui.wrap.querySelector('.backdrop');
    if (old) old.remove();
    if (!def || typeof def.thumb !== 'function') return;
    const r = ui.wrap.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    const cv = el('canvas', { class: 'backdrop', 'aria-hidden': 'true' });
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    const s = Math.max(w / 320, h / 200);
    c.translate((w - 320 * s) / 2, (h - 200 * s) / 2);
    c.scale(s, s);
    try { def.thumb(c, 320, 200, kit, Arcade.player); } catch (e) { console.error(e); }
    ui.wrap.prepend(cv);
  }

  // ---------- touch pad ----------
  const PAD_LABEL = { left: ICON.left, right: ICON.right, up: ICON.up, down: ICON.down, fire: 'Fire' };
  function buildPad(def) {
    ui.pad.replaceChildren();
    if (!def.touch || !def.touch.length || !isTouch()) { ui.pad.hidden = true; return; }
    const items = def.touch.map(t => (typeof t === 'string' ? { key: t } : t));
    const dirs = el('div', { class: 'pad-group' }), acts = el('div', { class: 'pad-group' });
    for (const it of items) {
      const label = it.label || PAD_LABEL[it.key] || it.key;
      const b = el('button', { type: 'button', class: 'pad-btn pad-' + it.key, 'aria-label': it.label || it.key, html: /^</.test(label) ? label : '<span>' + label + '</span>' });
      const down = e => {
        e.preventDefault();
        kit.capture(b, e);
        b.classList.add('is-down');
        if (!S || S.state !== 'play') return;
        S.touchHeld.add(it.key); refreshKeys();
        const fake = { key: it.key, code: 'Pad-' + it.key, repeat: false, synthetic: true, preventDefault() {}, target: b };
        S.keyDown.slice().forEach(fn => S.safe(() => fn(it.key, fake)));
      };
      const up = () => {
        b.classList.remove('is-down');
        if (!S || !S.touchHeld.has(it.key)) return;
        S.touchHeld.delete(it.key); refreshKeys();
        const fake = { key: it.key, code: 'Pad-' + it.key, repeat: false, synthetic: true, preventDefault() {}, target: b };
        S.keyUp.slice().forEach(fn => S.safe(() => fn(it.key, fake)));
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', e => e.preventDefault());
      // split the pad across both thumbs: two buttons go one per side; with action buttons the
      // arrows sit left and actions right; arrows alone put left/right left and up/down right
      const DIRS = ['left', 'right', 'up', 'down'];
      const hasAction = items.some(x => DIRS.indexOf(x.key) < 0);
      const toDirs = items.length === 2 ? items.indexOf(it) === 0
        : hasAction ? DIRS.indexOf(it.key) >= 0
        : (it.key === 'left' || it.key === 'right');
      (toDirs ? dirs : acts).append(b);
    }
    ui.pad.append(dirs, acts);
    ui.pad.hidden = false;
  }

  // ---------- keyboard ----------
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'fire', KeyZ: 'fire', KeyX: 'fire', KeyJ: 'fire'
  };
  const KEYNAMES = ['left', 'right', 'up', 'down', 'fire'];
  function refreshKeys() {
    if (!S) return;
    for (const n of KEYNAMES) S.keys[n] = false;
    S.codes.forEach(code => { const n = KEYMAP[code]; if (n) S.keys[n] = true; });
    S.touchHeld.forEach(n => { S.keys[n] = true; });
  }
  const isField = t => !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));

  window.addEventListener('keydown', e => {
    if (!view) return;
    if (!S || S.state !== 'play') {
      if (e.code === 'Escape') {
        e.preventDefault();
        if (S && S.state === 'paused') resume(); else Arcade.exit();
      }
      return;
    }
    const target = e.target;
    const onButton = !!(target && target.tagName === 'BUTTON');
    if (e.code === 'Escape') { e.preventDefault(); pause(); return; }
    // a focused toolbar button keeps Space/Enter for itself
    if (onButton && !ui.stage.contains(target) && (e.code === 'Space' || e.code === 'Enter')) return;
    if (!isField(target) && (e.code.indexOf('Arrow') === 0 || (e.code === 'Space' && !onButton))) e.preventDefault();
    if (!e.repeat) S.codes.add(e.code);
    refreshKeys();
    const name = KEYMAP[e.code] || null;
    S.keyDown.slice().forEach(fn => S.safe(() => fn(name, e)));
  });
  window.addEventListener('keyup', e => {
    if (!S) return;
    S.codes.delete(e.code);
    refreshKeys();
    if (S.state !== 'play') return;
    const name = KEYMAP[e.code] || null;
    S.keyUp.slice().forEach(fn => S.safe(() => fn(name, e)));
  });
  window.addEventListener('blur', () => { if (S) { S.codes.clear(); S.touchHeld.clear(); refreshKeys(); } });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S && S.state === 'play' && S.hasLoop) pause();
  });

  // ---------- canvas fitting ----------
  function stageBox() {
    const cs = getComputedStyle(ui.stage);
    const w = ui.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = ui.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    return { w: Math.max(50, w), h: Math.max(50, h) };
  }
  function fitCanvases() {
    if (!S) return;
    const box = stageBox();
    for (const c of S.canvases) {
      if (!c.fit) continue;
      const s = Math.min(box.w / c.w, box.h / c.h);
      c.el.style.width = Math.floor(c.w * s) + 'px';
      c.el.style.height = Math.floor(c.h * s) + 'px';
    }
  }
  let backdropTimer = 0;
  function onStageResize() {
    fitCanvases();
    if (view && !S) { clearTimeout(backdropTimer); backdropTimer = setTimeout(() => { if (view && !S) drawBackdrop(); }, 120); }
  }
  if (window.ResizeObserver) new ResizeObserver(onStageResize).observe(ui.stage);
  else window.addEventListener('resize', onStageResize);

  // ---------- toast ----------
  let toastTimer = 0;
  function toast(text, o) {
    o = o || {};
    ui.toast.textContent = text;
    ui.toast.style.color = o.color || '';
    ui.toast.classList.remove('is-on');
    void ui.toast.offsetWidth;
    ui.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('is-on'), o.ms || 1300);
  }

  // ---------- sessions ----------
  function newSession(def, mode) {
    const session = {
      def, mode, state: 'play', alive: true,
      score: 0, time: 0, last: performance.now(), raf: 0,
      keys: { left: false, right: false, up: false, down: false, fire: false },
      codes: new Set(), touchHeld: new Set(),
      keyDown: [], keyUp: [], loops: [], timers: [], listeners: [], canvases: [],
      hasLoop: false, cleanup: null, ended: false
    };
    session.safe = fn => {
      if (!session.alive) return undefined;
      try { return fn(); } catch (err) { fault(session, err); return undefined; }
    };
    return session;
  }

  function fault(session, err) {
    console.error('[' + session.def.id + ']', err);
    if (!session.alive || session.state === 'error') return;
    session.state = 'error';
    if (session === S) showCard(faultCard(err));
  }

  function frame(now) {
    const session = S;
    if (!session || !session.alive) return;
    session.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - session.last) / 1000));
    session.last = now;
    if (session.state !== 'play' && session.state !== 'over') return;
    session.time += dt;
    // timers run on the game clock, so pausing freezes them too
    for (let i = 0; i < session.timers.length && session.alive; i++) {
      const tm = session.timers[i];
      if (tm.dead || session.time < tm.due) continue;
      if (tm.every) tm.due += tm.every; else tm.dead = true;
      session.safe(tm.fn);
    }
    if (session.timers.some(tm => tm.dead)) session.timers = session.timers.filter(tm => !tm.dead);
    for (const fn of session.loops.slice()) {
      if (!session.alive || session.state === 'error') return;
      session.safe(() => fn(dt, session.time));
    }
  }

  function makeApi(session) {
    const def = session.def;
    const api = {
      id: def.id,
      stage: ui.stage,
      kit,
      mode: session.mode,
      player: Object.assign({}, Arcade.player),
      best: Arcade.best(def.id),
      isTouch: isTouch(),
      keys: session.keys,
      get time() { return session.time; },
      get over() { return session.state !== 'play'; },

      sfx(name) { if (session.alive) Sound.sfx(name); },
      tone(freq, dur, type, vol, slide, delay) { if (session.alive) Sound.tone(freq, dur, type, vol, slide, delay); },

      onKey(fn) { session.keyDown.push(fn); },
      onKeyUp(fn) { session.keyUp.push(fn); },
      loop(fn) {
        session.loops.push(fn);
        if (!session.hasLoop) { session.hasLoop = true; ui.pause.hidden = false; }
        return () => { session.loops = session.loops.filter(f => f !== fn); };
      },
      after(ms, fn) {
        const tm = { due: session.time + ms / 1000, fn };
        session.timers.push(tm);
        return () => { tm.dead = true; };
      },
      every(ms, fn) {
        const tm = { due: session.time + ms / 1000, every: Math.max(0.016, ms / 1000), fn };
        session.timers.push(tm);
        return () => { tm.dead = true; };
      },
      on(target, type, fn, opts) {
        const wrapped = function (e) { if (session.alive) session.safe(() => fn.call(this, e)); };
        target.addEventListener(type, wrapped, opts);
        session.listeners.push([target, type, wrapped, opts]);
        return () => target.removeEventListener(type, wrapped, opts);
      },
      canvas(w, h, o) {
        o = o || {};
        const parent = o.parent || ui.stage;
        const fit = o.fit != null ? o.fit : !o.parent;
        const cv = el('canvas', { class: 'game-canvas' + (fit ? '' : ' is-fluid') });
        let scale;
        if (fit) { const box = stageBox(); scale = Math.min(box.w / w, box.h / h); }
        else scale = Math.max(1, (parent.clientWidth || w) / w);
        const k = kit.clamp(scale * (window.devicePixelRatio || 1), 1, 2.5);
        cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        if (!fit) cv.style.aspectRatio = w + ' / ' + h;
        const ctx = cv.getContext('2d');
        ctx.setTransform(k, 0, 0, k, 0, 0);
        parent.appendChild(cv);
        const handle = {
          el: cv, ctx, w, h, k, fit,
          toLocal(e) {
            const r = cv.getBoundingClientRect();
            return { x: (e.clientX - r.left) / r.width * w, y: (e.clientY - r.top) / r.height * h };
          }
        };
        session.canvases.push(handle);
        fitCanvases();
        return handle;
      },
      el,
      css(text) { const s = el('style'); s.textContent = text; ui.stage.appendChild(s); return s; },

      score(n) {
        if (session.state !== 'play' || session !== S) return;
        session.score = Math.round(Number(n) || 0);
        ui.score.textContent = fmt(session.score);
      },
      stat(label, value) {
        if (session !== S) return;
        let row = ui.stats.querySelector('[data-label="' + CSS.escape(String(label)) + '"]');
        if (value == null) { if (row) row.remove(); return; }
        if (!row) {
          row = el('div', { class: 'readout', dataset: { label: String(label) } }, el('span', null, String(label)), el('b'));
          ui.stats.append(row);
        }
        row.querySelector('b').textContent = typeof value === 'number' ? fmt(value) : String(value);
      },
      toast(text, o) { if (session === S) toast(text, o); },
      record(n) {
        const isNew = recordBest(def.id, n);
        if (isNew && session === S) { ui.best.textContent = fmt(Arcade.best(def.id)); ui.best.parentElement.classList.add('is-new'); }
        return isNew;
      },
      gameOver(o) { end(session, false, o || {}); },
      win(o) { end(session, true, o || {}); },
      save(data) { store.set('data:' + def.id, data); },
      load(fallback) { return store.get('data:' + def.id, fallback); }
    };
    return api;
  }

  function end(session, won, o) {
    if (session !== S || session.state !== 'play') return;
    session.state = 'over';
    const score = o.score != null ? Math.round(Number(o.score) || 0) : session.score;
    session.score = score;
    ui.score.textContent = fmt(score);
    const isBest = recordBest(session.def.id, score);
    if (isBest) ui.best.textContent = fmt(score);
    if (!o.silent) Sound.sfx(won ? 'win' : 'lose');
    const delay = o.delay != null ? o.delay : 650;
    setTimeout(() => {
      if (S !== session || !session.alive || session.state !== 'over') return;
      showCard(resultCard(won, o, isBest, score));
    }, delay);
  }

  function teardown() {
    const session = S;
    if (!session) return;
    session.alive = false;
    cancelAnimationFrame(session.raf);
    session.listeners.forEach(([t, type, fn, opts]) => t.removeEventListener(type, fn, opts));
    if (typeof session.cleanup === 'function') { try { session.cleanup(); } catch (e) { console.error(e); } }
    S = null;
    ui.stage.replaceChildren();
    ui.stats.replaceChildren();
    ui.pause.hidden = true;
    ui.toast.classList.remove('is-on');
  }

  function begin(mode) {
    if (!view) return;
    teardown();
    hideCard();
    const def = view.def;
    if (mode != null) { view.mode = mode; store.set('mode:' + def.id, mode); }
    const bd = ui.wrap.querySelector('.backdrop');
    if (bd) bd.remove();
    Sound.unlock();
    const session = newSession(def, view.mode);
    S = session;
    ui.score.textContent = '0';
    ui.best.textContent = fmt(Arcade.best(def.id));
    ui.best.parentElement.classList.remove('is-new');
    buildPad(def);
    countPlay(def.id);
    emit('start', def.id);
    focusStage();
    const api = makeApi(session);
    const ret = session.safe(() => def.start(api));
    if (typeof ret === 'function') session.cleanup = ret;
    if (S === session && session.alive) session.raf = requestAnimationFrame(frame);
  }

  function restart() { if (view) begin(view.mode); }
  function toMenu() { teardown(); hideCard(); drawBackdrop(); showCard(splashCard()); }
  function pause() {
    if (!S || S.state !== 'play') return;
    S.state = 'paused';
    S.codes.clear(); S.touchHeld.clear(); refreshKeys();
    showCard(pauseCard());
  }
  function resume() {
    if (!S || S.state !== 'paused') return;
    hideCard(); S.state = 'play'; S.last = performance.now(); focusStage();
  }

  function openView(id) {
    const def = Arcade.byId[id];
    if (!def) return;
    if (view) closeView(true);
    const modes = def.modes && def.modes.length ? def.modes : null;
    const saved = store.get('mode:' + id, null);
    view = { def, mode: modes ? (modes.some(m => m.id === saved) ? saved : modes[0].id) : null };
    hubScroll = window.scrollY;
    ui.title.textContent = def.title;
    ui.cat.textContent = CATS[def.cat];
    ui.how.textContent = def.how || '';
    ui.score.textContent = '0';
    ui.best.textContent = fmt(Arcade.best(id));
    ui.best.parentElement.classList.remove('is-new');
    ui.pause.hidden = true;
    ui.play.style.setProperty('--accent', def.accent || kit.C.safety);
    document.title = def.title + ' · Bot Yard Arcade';
    ui.hub.hidden = true;
    ui.play.hidden = false;
    document.documentElement.classList.add('is-playing');
    emit('open', id);
    requestAnimationFrame(() => { if (view && view.def === def && !S) drawBackdrop(); });
    showCard(splashCard());
  }

  function closeView(silent) {
    teardown();
    hideCard();
    const bd = ui.wrap.querySelector('.backdrop');
    if (bd) bd.remove();
    view = null;
    ui.pad.hidden = true;
    ui.play.hidden = true;
    ui.hub.hidden = false;
    document.documentElement.classList.remove('is-playing');
    document.title = 'Bot Yard Arcade';
    if (!silent) {
      window.scrollTo(0, hubScroll);
      emit('close');
    }
  }

  // ---------- routing: #game-id opens a game, so the browser Back button leaves it ----------
  // Entries this page pushes carry a {botyard} marker; Arcade.exit only steps back over one of
  // those, so leaving a game can never navigate away from the arcade (it may run inside a frame).
  function route() {
    let id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { id = ''; }
    if (Arcade.byId[id]) { if (!view || view.def.id !== id) openView(id); }
    else if (view) closeView(false);
  }
  Arcade.play = id => {
    if (!Arcade.byId[id]) return;
    let pushed = false;
    try { history.pushState({ botyard: id }, '', '#' + id); pushed = true; } catch (e) { /* history locked down */ }
    if (pushed) route(); else location.hash = id;
  };
  Arcade.exit = () => {
    if (!view) return;
    const st = history.state;
    if (st && st.botyard === view.def.id) {
      const leavingView = view;
      history.back();
      setTimeout(() => { if (view === leavingView) forceHub(); }, 300);
    } else forceHub();
  };
  function forceHub() {
    if (location.hash) {
      try { history.replaceState(null, '', location.href.split('#')[0]); }
      catch (e) { try { location.hash = ''; } catch (e2) { /* ignore */ } }
    }
    closeView(false);
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', route);
  Arcade.route = route;

  // ---------- test hook: ?dev=<id>&mode=<mode> opens a game and starts it at once ----------
  Arcade.debug = {
    get state() { return S ? S.state : (view ? 'menu' : 'hub'); },
    get score() { return S ? S.score : null; },
    get game() { return view ? view.def.id : null; },
    start(id, mode) { openView(id); begin(mode || null); }
  };
  Arcade.devParams = (function () {
    try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); }
  })();
})();
