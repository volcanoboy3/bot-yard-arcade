/* Rock Paper Robot — rock, paper, scissors against a robot that learns your habits.
 * The robot runs four small pattern "circuits" and trusts whichever has been guessing best. */
(function () {
  'use strict';
  const K = window.BotKit;
  const MOVES = ['rock', 'paper', 'scissors'];
  const LABEL = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };
  const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };   // key beats value
  const COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' }; // value beats key
  const VERB = { rock: 'Rock smashes scissors', paper: 'Paper wraps rock', scissors: 'Scissors cut paper' };
  const CELLS = 5;
  const CPU = { body: '#ff6b3d', eye: '#ffd36b', head: 'tv', antenna: 'dish', base: 'treads' };

  const ICON = {
    rock: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 33l5-15 11-8 13 4 6 13-5 12-14 3-12-3z" fill="currentColor"/><path d="M12 18l9 6 2 15M23 10l-2 14 15-10M21 24l21 3" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="2" stroke-linejoin="round"/></svg>',
    paper: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 5h19l9 9v29H11z" fill="currentColor"/><path d="M30 5v9h9" fill="rgba(0,0,0,.2)"/><path d="M17 22h15M17 28h15M17 34h10" stroke="rgba(0,0,0,.3)" stroke-width="2.6" stroke-linecap="round"/></svg>',
    scissors: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"><path d="M19 30L36 6M29 30L12 6"/><circle cx="14" cy="36" r="6.5"/><circle cx="34" cy="36" r="6.5"/></g><circle cx="24" cy="23" r="2.3" fill="rgba(0,0,0,.35)"/></svg>'
  };

  const CSS = `
  .g-rps { width: 100%; max-width: 780px; max-height: 100%; overflow: auto; display: grid; gap: 14px; align-content: center; padding: 4px; }
  .g-rps .arena { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px;
    background: #172733; border: 2px solid #223845; border-radius: 16px; padding: 16px 12px 14px; }
  .g-rps .side { display: grid; justify-items: center; gap: 8px; }
  .g-rps .bot-slot canvas { width: clamp(84px, 20vw, 150px) !important; height: auto !important; aspect-ratio: 1; }
  .g-rps .nameplate { font: 400 16px/1 var(--display); color: #e6eef2; text-align: center; }
  .g-rps .nameplate small { display: block; margin-top: 4px; font: 700 10.5px/1 var(--body); letter-spacing: .14em; text-transform: uppercase; color: #6f8796; }
  .g-rps .hand { width: clamp(64px, 14vw, 92px); aspect-ratio: 1; display: grid; place-items: center; border-radius: 14px;
    background: #0f1a23; box-shadow: inset 0 0 0 2px #223845; color: #39505e; }
  .g-rps .hand svg { width: 64%; height: 64%; }
  .g-rps .hand.rock { color: #8b9aa6; } .g-rps .hand.paper { color: #e6eef2; } .g-rps .hand.scissors { color: #ff6b3d; }
  .g-rps .hand.is-win { box-shadow: inset 0 0 0 3px #7cf08a, 0 0 22px rgba(124,240,138,.35); }
  .g-rps .hand.is-lose { opacity: .55; }
  .g-rps .hand.is-shake svg { animation: rps-shake .18s ease-in-out infinite alternate; }
  .g-rps .cpu .hand.is-shake svg { animation-delay: .02s; }
  @keyframes rps-shake { from { transform: translateY(-9px) rotate(-8deg); } to { transform: translateY(5px) rotate(4deg); } }
  .g-rps .vs { font: 400 clamp(22px, 4vw, 34px)/1 var(--display); color: #f5c518; }
  .g-rps .verdict { margin: 0; text-align: center; font: 400 clamp(18px, 3vw, 24px)/1.15 var(--display); color: #e6eef2; min-height: 1.2em; }
  .g-rps .verdict.win { color: #7cf08a; } .g-rps .verdict.lose { color: #ff6b3d; } .g-rps .verdict.tie { color: #5ad1e6; }
  .g-rps .sub { margin: -6px 0 0; text-align: center; color: #8b9aa6; font-size: 14px; min-height: 1.4em; }
  .g-rps .meters { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .g-rps .meter { background: #0f1a23; border-radius: 12px; box-shadow: inset 0 0 0 2px #223845; padding: 10px 12px; display: grid; gap: 6px; align-content: start; }
  .g-rps .meter > span { font: 700 10.5px/1 var(--body); letter-spacing: .14em; text-transform: uppercase; color: #6f8796; }
  .g-rps .cells { display: flex; gap: 5px; }
  .g-rps .cell { flex: 1; max-width: 34px; height: 20px; border-radius: 4px; background: #7cf08a; box-shadow: inset 0 -4px 0 rgba(0,0,0,.2); transition: background-color .3s; }
  .g-rps .cell.is-empty { background: #223845; box-shadow: none; }
  .g-rps .brain b { font: 700 15px/1.25 var(--body); color: #e6eef2; }
  .g-rps .brain small { font-size: 13px; color: #8b9aa6; }
  .g-rps .choices { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .g-rps .choice { display: grid; justify-items: center; gap: 4px; padding: 12px 6px 10px; cursor: pointer;
    background: #223845; color: #e6eef2; border: 0; border-radius: 12px; box-shadow: 0 4px 0 #0b141b; font: 400 16px/1 var(--display); }
  .g-rps .choice svg { width: 42px; height: 42px; }
  .g-rps .choice.rock svg { color: #8b9aa6; } .g-rps .choice.paper svg { color: #e6eef2; } .g-rps .choice.scissors svg { color: #ff6b3d; }
  .g-rps .choice kbd { font: 700 11px/1 var(--body); color: #6f8796; }
  .g-rps .choice:hover:not(:disabled) { background: #2b4353; }
  .g-rps .choice:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 #0b141b; }
  .g-rps .choice:disabled { opacity: .5; cursor: default; }
  @media (max-width: 520px) { .g-rps .meters { grid-template-columns: 1fr; } .g-rps .choice kbd { display: none; } }
  `;

  // ---------- the robot's pattern circuits ----------
  function tally(list) {
    const n = { rock: 0, paper: 0, scissors: 0 };
    list.forEach(m => { n[m]++; });
    const top = Math.max(n.rock, n.paper, n.scissors);
    if (!top) return null;
    return K.pick(MOVES.filter(m => n[m] === top));
  }
  function relation(prev, next) { return next === prev ? 'stay' : next === COUNTER[prev] ? 'up' : 'down'; }
  function applyRelation(prev, rel) { return rel === 'stay' ? prev : rel === 'up' ? COUNTER[prev] : BEATS[prev]; }

  function makeBrain() {
    const you = [], results = [];
    const afterSeq = n => {
      if (you.length <= n) return null;
      const key = you.slice(-n).join();
      const next = [];
      for (let i = n; i < you.length; i++) if (you.slice(i - n, i).join() === key) next.push(you[i]);
      return tally(next);
    };
    const afterResult = () => {
      if (you.length < 3) return null;
      const last = results[results.length - 1];
      const rels = { stay: 0, up: 0, down: 0 };
      let seen = 0;
      for (let i = 1; i < you.length; i++) {
        if (results[i - 1] === last) { rels[relation(you[i - 1], you[i])]++; seen++; }
      }
      if (!seen) return null;
      const top = Math.max(rels.stay, rels.up, rels.down);
      const rel = K.pick(['stay', 'up', 'down'].filter(r => rels[r] === top));
      return applyRelation(you[you.length - 1], rel);
    };
    const circuits = [
      { name: 'Habit sensor', note: 'counts your favourite move', predict: () => tally(you), score: 0.1 },
      { name: 'Repeat tracker', note: 'remembers what follows your last move', predict: () => afterSeq(1), score: 0 },
      { name: 'Combo memory', note: 'remembers your two-move combos', predict: () => afterSeq(2), score: 0 },
      { name: 'Mood reader', note: 'watches what you do after a win or a loss', predict: afterResult, score: 0 }
    ];
    let guesses = [];
    return {
      rounds: () => you.length,
      choose() {
        guesses = circuits.map(c => c.predict());
        if (you.length < 3 || Math.random() < 0.1) return { move: K.pick(MOVES), circuit: null, guess: null };
        let best = -1, bestScore = -Infinity;
        circuits.forEach((c, i) => { if (guesses[i] && c.score > bestScore) { best = i; bestScore = c.score; } });
        if (best < 0) return { move: K.pick(MOVES), circuit: null, guess: null };
        return { move: COUNTER[guesses[best]], circuit: circuits[best], guess: guesses[best] };
      },
      learn(yourMove, result) {
        circuits.forEach((c, i) => {
          const g = guesses[i];
          c.score = c.score * 0.8 + (g == null ? 0 : g === yourMove ? 1 : -0.4);
        });
        you.push(yourMove); results.push(result);
      }
    };
  }

  Arcade.register({
    id: 'rock-paper-robot',
    title: 'Rock Paper Robot',
    cat: 'versus',
    blurb: 'This robot learns your habits. Stay unpredictable.',
    rules: [
      'Pick rock, paper or scissors. Rock beats scissors, scissors beat paper, paper beats rock.',
      'Each time the robot wins you lose a battery cell. Ties are free.',
      'The robot studies your patterns, so it gets sharper the longer you play.'
    ],
    how: 'Click a move · or press 1, 2, 3 (R, P, S)',
    accent: '#ff6b3d',
    usesPlayer: true,

    thumb(ctx, w, h, kit, player) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#132330'); g.addColorStop(1, '#1c2f3c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      for (let x = 0; x < w; x += 40) ctx.fillRect(x, 0, 2, h);
      kit.drawBot(ctx, 70, 92, 112, Object.assign({}, player, { mood: 'happy', arms: 'up', t: 0.3, shadow: true }));
      kit.drawBot(ctx, 250, 92, 112, Object.assign({}, CPU, { mood: 'angry', flip: true, t: 0.3, shadow: true }));
      kit.text(ctx, 'VS', 160, 78, { size: 34, color: kit.C.safety });
      const hand = (x, y, color, draw) => {
        ctx.fillStyle = kit.C.bg; kit.rr(ctx, x - 26, y - 26, 52, 52, 10);
        ctx.strokeStyle = kit.C.line; ctx.lineWidth = 2; kit.rrPath(ctx, x - 26, y - 26, 52, 52, 10); ctx.stroke();
        ctx.save(); ctx.translate(x, y); ctx.fillStyle = color; ctx.strokeStyle = color; draw(); ctx.restore();
      };
      hand(122, 160, '#e6eef2', () => { kit.rr(ctx, -12, -15, 24, 30, 2); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-7, -4, 14, 2.4); ctx.fillRect(-7, 3, 14, 2.4); });
      hand(198, 160, '#ff6b3d', () => {
        ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-5, 6); ctx.lineTo(9, -14); ctx.moveTo(5, 6); ctx.lineTo(-9, -14); ctx.stroke();
        ctx.beginPath(); ctx.arc(-7, 11, 5, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(7, 11, 5, 0, 7); ctx.stroke();
      });
      kit.text(ctx, 'YOU', 70, 186, { size: 13, body: true, color: kit.C.muted, shadow: false });
      kit.text(ctx, 'RPS-9000', 250, 186, { size: 13, body: true, color: kit.C.muted, shadow: false });
    },

    start(api) {
      const el = api.el;
      api.css(CSS);
      const brain = makeBrain();
      let cells = CELLS, wins = 0, losses = 0, streak = 0, busy = false, correct = 0, guessed = 0;
      let youMood = 'happy', cpuMood = 'neutral';

      const youBot = K.botCanvas(150, Object.assign({}, api.player, { mood: youMood }));
      const cpuBot = K.botCanvas(150, Object.assign({}, CPU, { mood: cpuMood, flip: true }));
      const youHand = el('div', { class: 'hand', 'aria-label': 'Your move' });
      const cpuHand = el('div', { class: 'hand', 'aria-label': 'Robot move' });
      const verdict = el('p', { class: 'verdict', 'aria-live': 'polite' }, 'Pick a move. The robot is watching.');
      const sub = el('p', { class: 'sub' }, 'It has no data on you yet.');
      const cellRow = el('div', { class: 'cells', 'aria-label': CELLS + ' battery cells left' });
      const cellEls = [];
      for (let i = 0; i < CELLS; i++) { const c = el('span', { class: 'cell' }); cellEls.push(c); cellRow.append(c); }
      const brainName = el('b', null, 'Warming up');
      const brainNote = el('small', null, 'Playing at random until it has seen three moves.');
      const buttons = MOVES.map((m, i) => el('button', {
        type: 'button', class: 'choice ' + m, on: { click: () => play(m) }, html: ICON[m] + '<span>' + LABEL[m] + '</span><kbd>' + (i + 1) + '</kbd>'
      }));

      const root = el('div', { class: 'g-rps' },
        el('div', { class: 'arena' },
          el('div', { class: 'side you' }, el('div', { class: 'bot-slot' }, youBot), el('div', { class: 'nameplate' }, api.player.name, el('small', null, 'You')), youHand),
          el('div', { class: 'vs', 'aria-hidden': 'true' }, 'VS'),
          el('div', { class: 'side cpu' }, el('div', { class: 'bot-slot' }, cpuBot), el('div', { class: 'nameplate' }, 'RPS-9000', el('small', null, 'Robot')), cpuHand)),
        verdict, sub,
        el('div', { class: 'meters' },
          el('div', { class: 'meter' }, el('span', null, 'Your battery cells'), cellRow),
          el('div', { class: 'meter brain' }, el('span', null, 'Robot brain'), brainName, brainNote)),
        el('div', { class: 'choices' }, buttons));
      api.stage.append(root);

      const setHand = (node, move, cls) => {
        node.className = 'hand' + (move ? ' ' + move : '') + (cls ? ' ' + cls : '');
        node.innerHTML = move ? ICON[move] : '';
      };
      setHand(youHand, null); setHand(cpuHand, null);
      api.every(90, () => {
        const t = api.time;
        youBot.redraw(Object.assign({}, api.player, { mood: youMood, t, arms: youMood === 'happy' && streak > 0 ? 'up' : 'down' }));
        cpuBot.redraw(Object.assign({}, CPU, { mood: cpuMood, t, flip: true, arms: cpuMood === 'happy' ? 'wave' : 'down' }));
      });

      function play(move) {
        if (busy || api.over) return;
        busy = true;
        buttons.forEach(b => { b.disabled = true; });
        const pick = brain.choose();
        setHand(youHand, 'rock', 'is-shake'); setHand(cpuHand, 'rock', 'is-shake');
        verdict.className = 'verdict'; verdict.textContent = 'Rock… paper… scissors…';
        sub.textContent = '';
        youMood = 'neutral'; cpuMood = 'neutral';
        [0, 190, 380].forEach(ms => api.after(ms, () => api.sfx('tick')));
        api.after(600, () => reveal(move, pick));
      }

      function reveal(move, pick) {
        const cpu = pick.move;
        const result = move === cpu ? 't' : BEATS[move] === cpu ? 'w' : 'l';
        setHand(youHand, move, result === 'w' ? 'is-win' : result === 'l' ? 'is-lose' : '');
        setHand(cpuHand, cpu, result === 'l' ? 'is-win' : result === 'w' ? 'is-lose' : '');
        if (pick.guess) { guessed++; if (pick.guess === move) correct++; }
        brain.learn(move, result);

        if (result === 'w') {
          wins++; streak++;
          verdict.className = 'verdict win'; verdict.textContent = 'You win the round!';
          sub.textContent = VERB[move] + '.';
          youMood = 'happy'; cpuMood = 'sad';
          api.sfx('coin');
          api.score(wins);
          if (streak === 3 || streak === 6 || streak === 10) api.toast(streak + ' in a row!');
        } else if (result === 'l') {
          losses++; streak = 0; cells--;
          verdict.className = 'verdict lose'; verdict.textContent = 'The robot wins the round.';
          sub.textContent = VERB[cpu] + '. You lose a cell.';
          youMood = 'sad'; cpuMood = 'happy';
          api.sfx('hit');
        } else {
          verdict.className = 'verdict tie'; verdict.textContent = 'Tie!';
          sub.textContent = 'Both picked ' + LABEL[move].toLowerCase() + '. No cells lost.';
          youMood = 'wow'; cpuMood = 'wow';
          api.sfx('blip');
        }
        cellEls.forEach((c, i) => c.classList.toggle('is-empty', i >= cells));
        cellRow.setAttribute('aria-label', cells + ' battery cells left');
        api.stat('Cells', cells + '/' + CELLS);

        if (pick.circuit) {
          brainName.textContent = pick.circuit.name + (pick.guess === move ? ' guessed right' : ' guessed wrong');
          brainNote.textContent = 'It ' + pick.circuit.note + '. Read you ' + correct + ' of ' + guessed + ' times.';
        } else {
          brainName.textContent = brain.rounds() < 3 ? 'Warming up' : 'Random move';
          brainNote.textContent = brain.rounds() < 3 ? 'Playing at random until it has seen three moves.' : 'It threw a random move to stay hard to read.';
        }

        if (cells <= 0) {
          api.gameOver({
            score: wins,
            scoreLabel: 'Rounds won',
            title: 'Out of power',
            detail: 'You won ' + wins + ' round' + (wins === 1 ? '' : 's') + '. The robot read your next move ' + correct + ' of ' + guessed + ' times.',
            delay: 900
          });
          return;
        }
        api.after(250, () => { busy = false; buttons.forEach(b => { b.disabled = false; }); });
      }

      api.onKey((name, e) => {
        const k = (e.key || '').toLowerCase();
        const map = { '1': 'rock', r: 'rock', '2': 'paper', p: 'paper', '3': 'scissors', s: 'scissors' };
        if (map[k]) { e.preventDefault(); play(map[k]); }
      });
      api.stat('Cells', CELLS + '/' + CELLS);
    }
  });
})();
