const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#ec4899', '#06b6d4', '#f97316'];
const RO_FLAG_SVG = `<svg viewBox="0 0 3 2" style="width:1.15em;height:0.8em;vertical-align:-0.12em;border-radius:2px;display:inline-block;box-shadow:0 0 2px rgba(0,0,0,0.6);"><rect width="1" height="2" x="0" fill="#002B7F"/><rect width="1" height="2" x="1" fill="#FCD116"/><rect width="1" height="2" x="2" fill="#CE1126"/></svg>`;

let PLAYERS = [];
let gameStarted = false;
let freePlayMode = false;

let turnOrder = [];
let currentTurnIndex = 0;
let pendingRoll = 0;
let currentQ = null;
let receivedAnswers = {};
let roundVerdicts = {};
let activeKopduel = null;
let askedQuestionKeys = new Set();

let tieBreakerIds = [];
let manualOrderSequence = [];
let firstStarterId = '';
let pendingSpecialTile = null;
let freePlayCatalog = {};
let selectedFreeCatId = '';

const DICE_ROTATIONS = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  2: { x: 0, y: 90 },
  5: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 }
};

const CATEGORIES = [
  { id: 'roemenie',    name: `${RO_FLAG_SVG} Roemenië`, short: 'Roemenië',    icon: RO_FLAG_SVG },
  { id: 'wk',          name: '🌍 Het WK',               short: 'Het WK',      icon: '🌍' },
  { id: 'video_audio', name: '🎬 Video & Audio',        short: 'Media',       icon: '🎬' },
  { id: 'foto',        name: '📸 Foto',                 short: 'Foto',        icon: '📸' },
  { id: 'algemeen',    name: '⚽ Algemeen',             short: 'Algemeen',    icon: '⚽' },
  { id: 'paspoort',    name: '🪪 Spelerspaspoort',      short: 'Paspoort',    icon: '🪪' },
  { id: 'marktwaarde', name: '💶 Marktwaarde',          short: 'Marktwaarde', icon: '💶' }
];

const SPECIAL_TILES = {
  1:  { type: 'start',   icon: '🛖', short: 'Dugout',        title: 'De Dugout (Start)', desc: 'Hier begint de wedstrijd!' },
  6:  { type: 'special', icon: '⚡', short: 'Counter -> 12', title: 'De Snelle Counter!', desc: 'Je snijdt door de defensie: vlieg direct door naar Vak 12 én deel 3 slokken uit!', action: 'JUMP', target: 12 },
  17: { type: 'special', icon: '💵', short: 'Omkoping',      title: 'Steekpenningen voor de Scheids!', desc: 'De Scheidsrechter drinkt verplicht 2 slokken (of een shotje)! Jij gaat 2 vakjes extra vooruit.', action: 'MOVE_REL', offset: 2 },
  24: { type: 'special', icon: '🍺', short: 'Kater 09:30',   title: 'Kater van de Vrijdagnacht!', desc: 'Kies: 1 beurt overslaan op de bank ÓF direct 4 slokken adten om door te spelen!', action: 'CHOICE_KATER' },
  31: { type: 'special', icon: '🩼', short: 'Kruisband',     title: 'Kruisbandblessure!', desc: 'Kermend op het gras: 3 beurten overslaan én trek een Atje!', action: 'SKIP', turns: 3 },
  33: { type: 'special', icon: '🫖', short: 'Lauwe Thee',    title: 'Te Veel Thee in de Rust!', desc: 'Te laat voor de 2e helft: 1 beurt overslaan én 3 slokken drinken!', action: 'SKIP', turns: 1 },
  38: { type: 'special', icon: '🤬', short: 'Kritiek',       title: 'Kritiek op de Leiding!', desc: 'Kop-of-munt duel met de Scheidsrechter! De verliezer neemt direct 3 slokken.', action: 'NONE' },
  41: { type: 'special', icon: '😴', short: 'Slapende VAR',  title: 'De VAR Ligt te Slapen!', desc: 'Je scoort een zuivere buitenspelgoal! Vlieg door naar Vak 47 én deel 2 shotjes uit!', action: 'JUMP', target: 47 },
  46: { type: 'special', icon: '🔄', short: 'Wissel 80\'',   title: 'Tactische Wissel!', desc: 'Je ruilt van plek met de speler die direct achter je staat (die speler neemt 2 slokken)!', action: 'SWAP_BEHIND' },
  52: { type: 'special', icon: '🟥', short: 'Rode Kaart',    title: 'Directe Rode Kaart!', desc: 'Natrappen! 1 beurt schorsing én neem een Shotje!', action: 'SKIP', turns: 1 },
  58: { type: 'special', icon: '💀', short: '90+4 Blunder',  title: 'Gigantische Blunder in 90+4!', desc: 'Eigen goal in blessuretijd: terug naar Vak 18 én trek een Atje!', action: 'JUMP', target: 18 },
  63: { type: 'finish',  icon: '🥅', short: 'DOEL & KANTINE',title: 'HET DOEL & DE KANTINESCHAAL!', desc: 'KAMPIOEN VAN HET WEEKEND!' }
};

const BOARD_TILES = [];
let normalCounter = 0;
for (let i = 1; i <= 63; i++) {
  if (SPECIAL_TILES[i]) {
    BOARD_TILES.push({ num: i, ...SPECIAL_TILES[i] });
  } else {
    const catObj = CATEGORIES[normalCounter % CATEGORIES.length];
    normalCounter++;
    BOARD_TILES.push({
      num: i,
      type: 'normal',
      cat: catObj.id,
      catName: catObj.name,
      icon: catObj.icon,
      short: catObj.short
    });
  }
}

function computeSpiralCoordinates(cols, rows) {
  const coords = [];
  let top = 0, bottom = rows - 1, left = 0, right = cols - 1;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) coords.push({ r: top, c, dir: c < right ? '→' : '↓' });
    top++;
    for (let r = top; r <= bottom; r++) coords.push({ r, c: right, dir: r < bottom ? '↓' : '←' });
    right--;
    if (top <= bottom) {
      for (let c = right; c >= left; c--) coords.push({ r: bottom, c, dir: c > left ? '←' : '↑' });
      bottom--;
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r--) coords.push({ r, c: left, dir: r > top ? '↑' : '→' });
      left++;
    }
  }
  return coords;
}

let QUESTION_POOLS = {
  roemenie: [
    { idKey: 'def_ro_1', cat: 'roemenie', priority: 1, type: 'tekst', media: '', q: 'Welke Roemeense club won in 1986 de Europacup 1 door FC Barcelona na penalty\'s te verslaan?', a: 'Steaua Boekarest', ansType: 'tekst', ansMedia: '', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false }
  ],
  wk: [
    { idKey: 'def_wk_1', cat: 'wk', priority: 1, type: 'tekst', media: '', q: 'In welk Zuid-Amerikaans land werd in 1930 het allereerste WK voetbal georganiseerd?', a: 'Uruguay', ansType: 'tekst', ansMedia: '', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false }
  ],
  video_audio: [
    { idKey: 'def_va_1', cat: 'video_audio', priority: 1, type: 'tekst', media: '', q: 'Maak het legendarische commentaar van Jack van Gelder in 1998 af: "DENNIS BERGKAMP! DENNIS BERGKAMP! ..."', a: 'BERRRGKAMP!', ansType: 'tekst', ansMedia: '', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: true }
  ],
  foto: [
    { idKey: 'def_fo_1', cat: 'foto', priority: 1, type: 'tekst', media: '', q: 'Welke Braziliaanse spits droeg tijdens het WK 2002 het iconische driehoekje voorop zijn verder kale hoofd?', a: 'Ronaldo (R9)', ansType: 'tekst', ansMedia: '', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false }
  ],
  algemeen: [
    { idKey: 'def_al_1', cat: 'algemeen', priority: 1, type: 'tekst', media: '', q: 'Welke club won de Champions League drie keer op rij tussen 2016 en 2018?', a: 'Real Madrid', ansType: 'tekst', ansMedia: '', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false }
  ],
  paspoort: [
    { idKey: 'def_pa_1', cat: 'paspoort', priority: 1, type: 'tekst', media: '', q: 'Spelerspaspoort: FC Groningen -> PSV -> Chelsea -> Real Madrid -> Bayern München. Wie ben ik?', a: 'Arjen Robben', ansType: 'tekst', ansMedia: '', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false }
  ],
  marktwaarde: [
    { idKey: 'def_mw_1', cat: 'marktwaarde', priority: 1, type: 'tekst', media: '', q: 'Voor welk recordbedrag (in miljoenen euro\'s) vertrok Neymar in 2017 van Barcelona naar PSG?', a: '222 miljoen euro', ansType: 'tekst', ansMedia: '', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false }
  ],
  kopduel: [
    { idKey: 'def_kd_1', cat: 'kopduel', priority: 1, type: 'tekst', media: '', q: 'Inschattingsvraag: Hoeveel officiële interlands speelde Gheorghe Hagi voor Roemenië?', a: '124 interlands', ansType: 'tekst', ansMedia: '', good: 'Winnaar +1 vak', bad: 'Verliezer -1 vak & Shotje', group: true }
  ]
};
let BACKUP_POOLS = JSON.parse(JSON.stringify(QUESTION_POOLS));

async function loadQuestionsFromCSV() {
  try {
    const res = await fetch('vragen.csv?t=' + Date.now());
    if (!res.ok) throw new Error('Geen vragen.csv gevonden');
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return;

    const freshPools = { roemenie: [], wk: [], video_audio: [], foto: [], algemeen: [], paspoort: [], marktwaarde: [], kopduel: [] };

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';');
      if (cols.length < 6) continue;
      let cat = cols[0].trim().toLowerCase();
      if (cat === 'transfers') cat = 'marktwaarde';

      let priority = 2, type = 'tekst', media = '', q = '', a = '', ansType = 'tekst', ansMedia = '', good = 'Deel 3 slokken uit', bad = 'Neem 3 slokken', group = false;

      if (cols.length >= 11) {
        priority = parseInt((cols[1] || '2').trim(), 10) || 2;
        type     = (cols[2] || 'tekst').trim().toLowerCase();
        media    = (cols[3] || '').trim();
        q        = (cols[4] || '').trim();
        a        = (cols[5] || '').trim();
        ansType  = (cols[6] || 'tekst').trim().toLowerCase();
        ansMedia = (cols[7] || '').trim();
        good     = (cols[8] || 'Deel 3 slokken uit').trim();
        bad      = (cols[9] || 'Neem 3 slokken').trim();
        group    = (cols[10] || 'NEE').trim().toUpperCase() === 'JA';
      } else {
        type  = (cols[1] || 'tekst').trim().toLowerCase();
        media = (cols[2] || '').trim();
        q     = (cols[3] || '').trim();
        a     = (cols[4] || '').trim();
        good  = (cols[5] || 'Deel 3 slokken uit').trim();
        bad   = (cols[6] || 'Neem 3 slokken').trim();
        group = (cols[7] || 'NEE').trim().toUpperCase() === 'JA';
      }

      if (freshPools[cat] && q) {
        freshPools[cat].push({ idKey: `${cat}_${i}_${q.slice(0, 25)}`, cat, priority, type, media, q, a, ansType, ansMedia, good, bad, group });
      }
    }

    Object.keys(freshPools).forEach(k => {
      if (freshPools[k].length > 0) QUESTION_POOLS[k] = freshPools[k];
    });
    BACKUP_POOLS = JSON.parse(JSON.stringify(QUESTION_POOLS));
    const statusEl = document.getElementById('tv-csv-status');
    if (statusEl) statusEl.innerText = `✅ vragen.csv geladen (${lines.length - 1} vragen klaar!)`;
  } catch (err) {
    const statusEl = document.getElementById('tv-csv-status');
    if (statusEl) statusEl.innerText = `ℹ️ Standaard vragen actief (plaats vragen.csv voor eigen vragen)`;
  }
}

function drawUniqueQuestion(catId, allowRefill = false) {
  let pool = QUESTION_POOLS[catId] || [];
  pool = pool.filter(item => !askedQuestionKeys.has(item.idKey || item.q));
  QUESTION_POOLS[catId] = pool;

  if (pool.length === 0 && allowRefill && !freePlayMode) {
    const backup = JSON.parse(JSON.stringify(BACKUP_POOLS[catId] || BACKUP_POOLS.algemeen || []));
    QUESTION_POOLS[catId] = backup;
    pool = QUESTION_POOLS[catId];
  }
  if (!pool || pool.length === 0) return null;

  const prio1Items = pool.filter(item => item.priority === 1);
  const candidatePool = prio1Items.length > 0 ? prio1Items : pool;
  const picked = candidatePool[Math.floor(Math.random() * candidatePool.length)];
  const exactIndex = pool.indexOf(picked);
  if (exactIndex > -1) pool.splice(exactIndex, 1);

  askedQuestionKeys.add(picked.idKey || picked.q);
  return picked;
}

function drawSpecificQuestion(catId, idKey) {
  let pool = QUESTION_POOLS[catId] || [];
  const idx = pool.findIndex(item => (item.idKey || item.q) === idKey);
  if (idx === -1) return null;
  const picked = pool.splice(idx, 1)[0];
  askedQuestionKeys.add(picked.idKey || picked.q);
  return picked;
}

function getRemainingQuestionsCatalog() {
  const counts = {};
  const catalog = {};
  [...CATEGORIES.map(c => c.id), 'kopduel'].forEach(id => {
    const pool = (QUESTION_POOLS[id] || [])
      .filter(item => !askedQuestionKeys.has(item.idKey || item.q))
      .sort((a, b) => (a.priority || 2) - (b.priority || 2));
    QUESTION_POOLS[id] = pool;
    counts[id] = pool.length;
    catalog[id] = pool.map(item => ({
      idKey: item.idKey || item.q,
      priority: item.priority || 2,
      q: item.q,
      a: item.a
    }));
  });
  return { counts, catalog };
}

let peer = null;
let connections = [];
let clientConn = null;
let myRole = '';
let myPlayerId = '';
let mySelfieData = '';
let cameraStream = null;

function makeRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function unlockTabletAudio() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {}
}

function initTV() {
  unlockTabletAudio();
  myRole = 'tv';
  document.getElementById('view-select').style.display = 'none';
  document.getElementById('tv-view').style.display = 'block';
  document.getElementById('fs-toggle').style.display = 'block';

  const legend = document.querySelector('.cat-legend');
  if (legend) {
    legend.innerHTML = `
      <span>${RO_FLAG_SVG} Roemenië</span>
      <span>🌍 Het WK</span>
      <span>🎬 Video/Audio</span>
      <span>📸 Foto</span>
      <span>⚽ Algemeen</span>
      <span>🪪 Paspoort</span>
      <span>💶 Marktwaarde</span>
    `;
  }

  buildSpiralBoard();
  updateTVLeaderboard();
  loadQuestionsFromCSV();

  const code = makeRoomCode();
  document.getElementById('tv-room-code').innerText = code;
  document.getElementById('tv-room-code-badge').innerText = code;

  peer = new Peer('gzb-' + code);
  peer.on('connection', (conn) => {
    connections.push(conn);
    conn.on('data', (data) => handleTVIncomingData(data, conn));
  });

  renderLobbyTV();
}

function buildSpiralBoard() {
  const grid = document.getElementById('board-grid');
  grid.innerHTML = '';
  const spiralCoords = computeSpiralCoordinates(9, 7);

  BOARD_TILES.forEach((tile, index) => {
    const coord = spiralCoords[index];
    const div = document.createElement('div');
    const catClass = tile.cat ? `cat-${tile.cat}` : '';
    const dirClass = coord.dir === '→' ? 'dir-right' : coord.dir === '↓' ? 'dir-down' : coord.dir === '←' ? 'dir-left' : 'dir-up';
    div.className = `tile ${tile.type} ${catClass} ${tile.num < 63 ? dirClass : ''}`;
    div.id = `tile-${tile.num}`;
    div.style.gridRow = coord.r + 1;
    div.style.gridColumn = coord.c + 1;

    div.innerHTML = `
      <span class="tile-num">${tile.num}</span>
      ${tile.num < 63 ? `<span class="tile-dir">${coord.dir}</span>` : ''}
      <div class="tile-icon">${tile.icon}</div>
      <div class="tile-name">${tile.short}</div>
      <div class="tile-tokens" id="tokens-tile-${tile.num}"></div>
    `;
    grid.appendChild(div);
  });
  renderTokens();
}

function renderTokens() {
  const activePlayerId = (!freePlayMode && turnOrder.length > 0) ? turnOrder[currentTurnIndex] : '';

  BOARD_TILES.forEach(t => {
    const tileDiv = document.getElementById(`tile-${t.num}`);
    if (tileDiv) tileDiv.classList.remove('active-player-tile');
    const el = document.getElementById(`tokens-tile-${t.num}`);
    if (el) {
      el.innerHTML = '';
      el.classList.remove('multi');
    }
  });

  PLAYERS.forEach(p => {
    const el = document.getElementById(`tokens-tile-${p.pos}`);
    const tileDiv = document.getElementById(`tile-${p.pos}`);
    if (el) {
      const isTurn = p.id === activePlayerId;
      if (isTurn && tileDiv) tileDiv.classList.add('active-player-tile');
      const tok = document.createElement('div');
      tok.className = `p-token ${isTurn ? 'active-board-token' : ''}`;
      tok.style.borderColor = p.color;
      tok.innerHTML = `<img src="${p.selfie}" alt="${p.name}">`;
      el.appendChild(tok);
      if (el.children.length > 1) el.classList.add('multi');
    }
  });
}

function renderLobbyTV() {
  const container = document.getElementById('tv-lobby-players');
  document.getElementById('tv-lobby-count').innerText = `Verbonden Spelers (${PLAYERS.length})`;
  if (PLAYERS.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; opacity:0.5;">Wachten op spelers...</div>';
    return;
  }
  container.innerHTML = PLAYERS.map(p => `
    <div class="lobby-player-card" style="border-color: ${p.color};">
      <img src="${p.selfie}" alt="${p.name}" style="border-color: ${p.color};">
      <div style="font-weight: 800; color: ${p.color}; font-size: 1rem;">${p.name}</div>
    </div>
  `).join('');
}

function updateTVLeaderboard() {
  const rankSorted = [...PLAYERS].sort((a, b) => b.pos - a.pos);
  const rankMap = {};
  rankSorted.forEach((p, idx) => { rankMap[p.id] = idx + 1; });

  const orderedList = turnOrder.length === PLAYERS.length && turnOrder.length > 0
    ? turnOrder.map(id => PLAYERS.find(x => x.id === id)).filter(Boolean)
    : PLAYERS;

  const activePlayerId = turnOrder[currentTurnIndex];

  document.getElementById('tv-leaderboard').innerHTML = orderedList.map((p, idx) => {
    const dist = 63 - p.pos;
    const isActive = !freePlayMode && p.id === activePlayerId;
    const skipBadge = p.skipTurns > 0 ? ` • 🩼${p.skipTurns}x` : '';
    const yellowBadge = p.yellowCards > 0 ? ` • 🟨` : '';
    const varBadge = p.varLeft ? `<span class="var-pill-on">📺 VAR</span>` : `<span class="var-pill-off">VAR ✖</span>`;
    const rankNum = rankMap[p.id] || (idx + 1);
    return `
      <div class="lb-card ${isActive ? 'active-turn' : ''}" style="border-color: ${p.color};">
        <img src="${p.selfie}" class="lb-avatar" style="border-color: ${p.color};">
        <div class="lb-info">
          <div class="lb-top">
            <span style="color: ${p.color};">${idx + 1}. ${p.name}</span>
            <span class="rank-pill">#${rankNum}</span>
          </div>
          <div class="lb-sub">Vak ${p.pos} (${dist === 0 ? '🏆' : '-' + dist})${skipBadge}${yellowBadge} ${varBadge}</div>
          ${isActive ? `<div class="turn-tag">🎲 AAN DE BEURT</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function showPlayerSetup() {
  document.getElementById('view-select').style.display = 'none';
  document.getElementById('player-setup-view').style.display = 'flex';
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 250, height: 250 },
      audio: false
    });
    document.getElementById('camera-stream').srcObject = cameraStream;
  } catch (err) {}
}

function takeSelfie() {
  const video = document.getElementById('camera-stream');
  const canvas = document.getElementById('selfie-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 180;
  canvas.height = 180;
  ctx.translate(180, 0);
  ctx.scale(-1, 1);

  const size = Math.min(video.videoWidth || 180, video.videoHeight || 180);
  const sx = ((video.videoWidth || 180) - size) / 2;
  const sy = ((video.videoHeight || 180) - size) / 2;
  ctx.drawImage(video, sx, sy, size, size, 0, 0, 180, 180);

  mySelfieData = canvas.toDataURL('image/jpeg', 0.78);
  const preview = document.getElementById('selfie-preview');
  preview.src = mySelfieData;
  preview.style.display = 'block';
  video.style.display = 'none';

  document.getElementById('btn-take-selfie').style.display = 'none';
  document.getElementById('btn-retake-selfie').style.display = 'inline-flex';
}

function retakeSelfie() {
  mySelfieData = '';
  document.getElementById('selfie-preview').style.display = 'none';
  document.getElementById('camera-stream').style.display = 'block';
  document.getElementById('btn-take-selfie').style.display = 'inline-flex';
  document.getElementById('btn-retake-selfie').style.display = 'none';
}

function handleFileSelfie(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.getElementById('selfie-canvas');
      canvas.width = 180;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 180, 180);
      mySelfieData = canvas.toDataURL('image/jpeg', 0.78);

      const preview = document.getElementById('selfie-preview');
      preview.src = mySelfieData;
      preview.style.transform = 'none';
      preview.style.display = 'block';
      document.getElementById('camera-stream').style.display = 'none';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function submitPlayerJoin() {
  const code = document.getElementById('join-code').value.trim();
  const name = document.getElementById('join-name').value.trim();

  if (!code || code.length !== 4) return alert("Vul de 4-cijferige kamercode in!");
  if (!name) return alert("Vul je naam in!");
  if (!mySelfieData) return alert("Maak eerst een selfie!");

  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());

  myRole = 'player';
  myPlayerId = 'p_' + Math.random().toString(36).substr(2, 6);

  document.getElementById('player-setup-view').style.display = 'none';
  document.getElementById('mobile-view').style.display = 'flex';
  document.getElementById('m-player-name').innerText = name;
  document.getElementById('m-header-avatar').src = mySelfieData;

  peer = new Peer();
  peer.on('open', () => {
    clientConn = peer.connect('gzb-' + code);
    clientConn.on('open', () => {
      clientConn.send({ type: 'PLAYER_JOIN', playerId: myPlayerId, name, selfie: mySelfieData });
    });
    clientConn.on('data', handlePlayerIncomingData);
  });
}

function showRefereeSetup() {
  document.getElementById('view-select').style.display = 'none';
  document.getElementById('ref-setup-view').style.display = 'flex';
}

function connectReferee() {
  const code = document.getElementById('ref-join-code').value.trim();
  if (!code) return;

  myRole = 'ref';
  document.getElementById('ref-setup-view').style.display = 'none';
  document.getElementById('ref-view').style.display = 'flex';

  peer = new Peer();
  peer.on('open', () => {
    clientConn = peer.connect('gzb-' + code);
    clientConn.on('open', () => {
      clientConn.send({ type: 'REF_JOIN' });
    });
    clientConn.on('data', handleRefIncomingData);
  });
  renderRefPlayerLists();
}

function handleTVIncomingData(data, conn) {
  if (data.type === 'PLAYER_JOIN') {
    const assignedColor = PLAYER_COLORS[PLAYERS.length % PLAYER_COLORS.length];
    PLAYERS.push({
      id: data.playerId,
      name: data.name,
      selfie: data.selfie,
      color: assignedColor,
      pos: 1,
      orderRoll: 0,
      skipTurns: 0,
      yellowCards: 0,
      varLeft: true
    });
    renderLobbyTV();
    renderTokens();
    updateTVLeaderboard();
    broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted, freePlayMode });
  }
  else if (data.type === 'REF_JOIN') {
    broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted, freePlayMode });
    if (freePlayMode) {
      const rem = getRemainingQuestionsCatalog();
      renderTVFreePlayOverlay(rem.counts);
      broadcastToAll({ type: 'FREE_PLAY_CATEGORIES', counts: rem.counts, catalog: rem.catalog });
    }
  }
  else if (data.type === 'REF_KICK_PLAYER') {
    PLAYERS = PLAYERS.filter(p => p.id !== data.playerId);
    turnOrder = turnOrder.filter(id => id !== data.playerId);
    tieBreakerIds = tieBreakerIds.filter(id => id !== data.playerId);
    renderLobbyTV();
    renderTokens();
    updateTVLeaderboard();
    broadcastToAll({ type: 'PLAYER_KICKED', playerId: data.playerId, players: PLAYERS, gameStarted });
  }
  else if (data.type === 'REF_START_GAME') {
    if (PLAYERS.length === 0) return;
    gameStarted = true;
    tieBreakerIds = PLAYERS.map(p => p.id);
    PLAYERS.forEach(p => { p.orderRoll = 0; });
    document.getElementById('tv-lobby-overlay').style.display = 'none';
    document.getElementById('tv-roll-order-overlay').style.display = 'flex';
    renderTVRollOrder();
    broadcastToAll({ type: 'START_WIEGELOOT', players: PLAYERS, activeRollers: tieBreakerIds, isTieBreak: false });
  }
  else if (data.type === 'PLAYER_WIEGELOOT_ROLL') {
    if (!tieBreakerIds.includes(data.playerId)) return;
    const p = PLAYERS.find(x => x.id === data.playerId);
    if (p) {
      p.orderRoll = data.roll;
      renderTVRollOrder();
      const allActiveRolled = tieBreakerIds.every(id => {
        const pl = PLAYERS.find(x => x.id === id);
        return pl && pl.orderRoll > 0;
      });

      if (allActiveRolled) {
        const activePlayers = tieBreakerIds.map(id => PLAYERS.find(x => x.id === id)).filter(Boolean);
        const maxRoll = Math.max(...activePlayers.map(x => x.orderRoll));
        const topRollers = activePlayers.filter(x => x.orderRoll === maxRoll);

        if (topRollers.length > 1) {
          const names = topRollers.map(x => x.name).join(' & ');
          document.getElementById('tv-roll-order-sub').innerText = `⚡ GELIJKSPEL (${maxRoll}) tussen ${names}! Zij gooien opnieuw!`;
          setTimeout(() => {
            tieBreakerIds = topRollers.map(x => x.id);
            PLAYERS.forEach(pl => {
              if (tieBreakerIds.includes(pl.id)) pl.orderRoll = 0;
            });
            renderTVRollOrder();
            broadcastToAll({ type: 'START_WIEGELOOT', players: PLAYERS, activeRollers: tieBreakerIds, isTieBreak: true });
          }, 2200);
          return;
        } else {
          const winner = topRollers[0];
          firstStarterId = winner.id;
          document.getElementById('tv-roll-order-sub').innerText = `🏆 ${winner.name} heeft gewonnen met ${maxRoll}! De Scheids stelt nu de tafelvolgorde in...`;
          broadcastToAll({
            type: 'WIEGELOOT_WINNER_DECIDED',
            players: PLAYERS,
            winnerId: winner.id,
            winnerName: winner.name
          });
          return;
        }
      }
      broadcastToAll({ type: 'WIEGELOOT_UPDATE', players: PLAYERS, allRolled: false });
    }
  }
  else if (data.type === 'REF_SET_CUSTOM_ORDER') {
    turnOrder = data.order;
    currentTurnIndex = 0;
    hideAllTVOverlays();
    renderTokens();
    updateTVLeaderboard();
    sendBoardWaitState();
  }
  else if (data.type === 'REF_SHOW_BOARD') {
    hideAllTVOverlays();
    renderTokens();
    updateTVLeaderboard();
    sendBoardWaitState();
  }
  else if (data.type === 'REF_CONFIRM_SKIP') {
    const p = PLAYERS.find(x => x.id === turnOrder[currentTurnIndex]);
    if (p && p.skipTurns > 0) p.skipTurns--;
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    renderTokens();
    updateTVLeaderboard();
    sendBoardWaitState();
  }
  else if (data.type === 'REF_ALLOW_ROLL') {
    startTurnOnTV();
  }
  else if (data.type === 'PLAYER_DICE_ROLL') {
    const st = document.getElementById('tv-dice-status');
    if (st) st.innerText = 'De dobbelsteen rolt...';
    animateDiceCube('tv-dice-cube', data.roll, 0.58, () => {
      if (st) st.innerText = `Gegooid: ${data.roll}!`;
    });
  }
  else if (data.type === 'PLAYER_EXECUTE_STEPS') {
    executePlayerStepsWithBounce(data.playerId, data.steps);
  }
  else if (data.type === 'REF_OPEN_SPECIAL_OVERLAY') {
    if (pendingSpecialTile) {
      showSpecialTileOverlayOnTV(pendingSpecialTile.player, pendingSpecialTile.tile);
    }
  }
  else if (data.type === 'REF_RESOLVE_SPECIAL') {
    resolveSpecialTileEffect(data);
  }
  else if (data.type === 'REF_SHOW_QUESTION') {
    revealQuestionOnTV();
  }
  else if (data.type === 'PLAYER_SUBMIT_ANSWER') {
    receivedAnswers[data.playerId] = data.ans;
    const p = PLAYERS.find(x => x.id === data.playerId);
    if (data.autoWrong) {
      roundVerdicts[data.playerId] = { ans: '🏳️ Geskipt', correct: false };
    }
    document.getElementById('tv-q-status').innerText = `${p ? p.name : 'Speler'} heeft ${data.autoWrong ? 'de vraag geskipt' : 'een antwoord ingediend'}!`;
    broadcastToAll({ type: 'REF_RECEIVE_ANSWERS', answers: receivedAnswers, verdicts: roundVerdicts, activeKopduel });
  }
  else if (data.type === 'REF_SHOW_RESULT') {
    roundVerdicts = data.verdicts || {};
    displayRegularResultsOnTV(roundVerdicts);
  }
  else if (data.type === 'PLAYER_REQUEST_VAR') {
    const p = PLAYERS.find(x => x.id === data.playerId);
    if (p && p.varLeft) {
      p.varLeft = false;
      updateTVLeaderboard();
      triggerVarCheckOnTV(p);
      broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted, freePlayMode });
      broadcastToAll({
        type: 'REF_VAR_CHECK_PROMPT',
        playerId: p.id,
        playerName: p.name,
        givenAns: (roundVerdicts[p.id] && roundVerdicts[p.id].ans) || receivedAnswers[p.id] || '-',
        question: currentQ || { q: 'Lopende discussie / huidige vraag', a: '-' }
      });
    }
  }
  else if (data.type === 'REF_VAR_DECISION') {
    resolveVarDecisionOnTV(data.playerId, data.decision);
  }
  else if (data.type === 'REF_KOPDUEL_VERDICT') {
    handleKopduelVerdictOnTV(data);
  }
  else if (data.type === 'REF_CONTINUE_AFTER_KOPDUEL') {
    continueAfterKopduelMoveOnTV();
  }
  else if (data.type === 'REF_ADVANCE_TURN_TO_BOARD') {
    hideAllTVOverlays();
    stopTVMedia();
    if (freePlayMode) {
      const rem = getRemainingQuestionsCatalog();
      renderTVFreePlayOverlay(rem.counts);
      broadcastToAll({ type: 'FREE_PLAY_CATEGORIES', counts: rem.counts, catalog: rem.catalog });
      return;
    }
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    renderTokens();
    updateTVLeaderboard();
    sendBoardWaitState();
  }
  else if (data.type === 'REF_START_FREE_PLAY') {
    freePlayMode = true;
    hideAllTVOverlays();
    stopTVMedia();
    renderTokens();
    updateTVLeaderboard();
    const rem = getRemainingQuestionsCatalog();
    renderTVFreePlayOverlay(rem.counts);
    broadcastToAll({ type: 'FREE_PLAY_CATEGORIES', counts: rem.counts, catalog: rem.catalog });
  }
  else if (data.type === 'REF_SELECT_FREE_QUESTION') {
    freePlayMode = true;
    prepareFreePlayQuestionOnTV(data.catId, data.idKey);
  }
  else if (data.type === 'REF_GIVE_CARD') {
    applyCardPenaltyOnTV(data.playerId, data.cardType);
  }
}

function hideAllTVOverlays() {
  ['tv-lobby-overlay', 'tv-roll-order-overlay', 'tv-special-overlay', 'tv-question-overlay', 'tv-win-overlay', 'tv-var-overlay', 'tv-card-overlay', 'tv-free-play-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const sDice = document.getElementById('tv-sidebar-dice-box');
  if (sDice) sDice.style.display = 'none';
}

function sendBoardWaitState() {
  const nextPlayer = PLAYERS.find(p => p.id === turnOrder[currentTurnIndex]);
  broadcastToAll({
    type: 'BOARD_ACTIVE_WAIT',
    nextPlayerId: nextPlayer ? nextPlayer.id : '',
    nextPlayerName: nextPlayer ? nextPlayer.name : '',
    nextPlayerSkip: nextPlayer ? nextPlayer.skipTurns : 0,
    players: PLAYERS
  });
}

function broadcastToAll(msg) {
  connections.forEach(c => {
    if (c.open) c.send(msg);
  });
}

function renderTVRollOrder() {
  const grid = document.getElementById('tv-roll-order-grid');
  grid.innerHTML = PLAYERS.map(p => {
    const isActiveRoller = tieBreakerIds.length === 0 || tieBreakerIds.includes(p.id);
    return `
      <div class="lobby-player-card" style="border-color: ${p.color}; opacity: ${isActiveRoller ? '1' : '0.35'};">
        <img src="${p.selfie}" style="border-color: ${p.color};">
        <h3 style="color:${p.color};">${p.name}</h3>
        <div style="font-size: 2.3rem; font-weight: 900; color: var(--gold);">
          ${p.orderRoll > 0 ? p.orderRoll : (isActiveRoller ? '🎲' : '➖')}
        </div>
        <div style="font-size: 0.75rem; opacity: 0.7;">
          ${!isActiveRoller ? 'Uitgeschakeld voor aftrap' : (p.orderRoll > 0 ? 'Gegooid!' : 'Aan het gooien...')}
        </div>
      </div>
    `;
  }).join('');
}

function renderTVFreePlayOverlay(counts) {
  const ov = document.getElementById('tv-free-play-overlay');
  const grid = document.getElementById('tv-free-play-grid');
  if (!ov || !grid) return;
  ov.style.display = 'flex';
  const allCats = [...CATEGORIES, { id: 'kopduel', name: '💥 Kopduel' }];
  grid.innerHTML = allCats.map(c => {
    const left = counts[c.id] || 0;
    return `
      <div class="free-cat-card" style="opacity:${left > 0 ? '1' : '0.35'};">
        <div style="font-size:1.1rem;font-weight:900;">${c.name}</div>
        <div style="font-size:1.5rem;font-weight:900;color:var(--gold);margin-top:4px;">${left}</div>
        <div style="font-size:0.75rem;opacity:0.8;">vragen over</div>
      </div>
    `;
  }).join('');
}

function startTurnOnTV() {
  if (turnOrder.length === 0) return;
  const activePlayer = PLAYERS.find(p => p.id === turnOrder[currentTurnIndex]);
  if (!activePlayer) return;

  renderTokens();
  updateTVLeaderboard();

  const sDice = document.getElementById('tv-sidebar-dice-box');
  if (sDice) sDice.style.display = 'flex';
  const nameEl = document.getElementById('tv-dice-turn-player');
  if (nameEl) {
    nameEl.innerText = `${activePlayer.name} gooit...`;
    nameEl.style.color = activePlayer.color;
  }
  const stEl = document.getElementById('tv-dice-status');
  if (stEl) stEl.innerText = 'Wachten op worp...';

  const cube = document.getElementById('tv-dice-cube');
  if (cube) {
    cube.style.transition = 'none';
    cube.style.transform = 'scale(0.58) rotateX(-15deg) rotateY(20deg)';
  }

  broadcastToAll({
    type: 'TURN_STARTED',
    activePlayerId: activePlayer.id,
    activePlayerName: activePlayer.name,
    players: PLAYERS
  });
}

function animateDiceCube(elementId, targetValue, scaleVal, onFinish) {
  const cube = document.getElementById(elementId);
  if (!cube) return;

  let step = 0;
  const totalSteps = 14;
  cube.style.transition = 'transform 0.14s linear';

  const rollInterval = setInterval(() => {
    step++;
    const randX = Math.floor(Math.random() * 4) * 90 + (step * 90);
    const randY = Math.floor(Math.random() * 4) * 90 + (step * 90);
    cube.style.transform = `scale(${scaleVal}) rotateX(${randX}deg) rotateY(${randY}deg)`;
    playAudioBeep(240 + (step * 15), 0.04);

    if (step >= totalSteps) {
      clearInterval(rollInterval);
      const target = DICE_ROTATIONS[targetValue] || { x: 0, y: 0 };
      cube.style.transition = 'transform 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      cube.style.transform = `scale(${scaleVal}) rotateX(${target.x + 1440}deg) rotateY(${target.y + 1440}deg)`;
      playAudioBeep(620, 0.18);
      setTimeout(() => {
        if (onFinish) onFinish();
      }, 600);
    }
  }, 130);
}

function animatePlayerJumpToTarget(player, targetPos, onComplete) {
  const stepDir = targetPos > player.pos ? 1 : -1;
  const interval = setInterval(() => {
    if (player.pos === targetPos) {
      clearInterval(interval);
      renderTokens();
      updateTVLeaderboard();
      broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted, freePlayMode });
      if (onComplete) setTimeout(onComplete, 550);
      return;
    }
    player.pos += stepDir;
    renderTokens();
    updateTVLeaderboard();
    playAudioBeep(stepDir === 1 ? 460 : 300, 0.07);
  }, 320);
}

function executePlayerStepsWithBounce(playerId, steps) {
  const sDice = document.getElementById('tv-sidebar-dice-box');
  if (sDice) sDice.style.display = 'none';
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) return;

  let remaining = steps;
  let direction = 1;

  const stepInterval = setInterval(() => {
    if (remaining <= 0) {
      clearInterval(stepInterval);
      broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted, freePlayMode });
      setTimeout(() => {
        evaluateTileArrival(player);
      }, 850);
      return;
    }

    if (player.pos === 63 && direction === 1) direction = -1;
    player.pos += direction;
    remaining--;

    renderTokens();
    updateTVLeaderboard();
    playAudioBeep(direction === 1 ? 420 : 280, 0.09);
  }, 700);
}

function evaluateTileArrival(player) {
  if (player.pos === 63) {
    confetti({ particleCount: 250, spread: 100, origin: { y: 0.6 } });
    document.getElementById('tv-win-overlay').style.display = 'flex';
    document.getElementById('tv-win-title').innerText = `🏆 ${player.name.toUpperCase()} HEEFT GEWONNEN!`;
    const rem = getRemainingQuestionsCatalog();
    broadcastToAll({
      type: 'GAME_FINISHED_WIN',
      winnerName: player.name,
      counts: rem.counts,
      catalog: rem.catalog
    });
    return;
  }

  const others = PLAYERS.filter(p => p.id !== player.id && p.pos === player.pos && p.pos > 1);
  if (others.length > 0) {
    prepareKopduelPreviewOnTV(player, others[0]);
    return;
  }

  const tileObj = BOARD_TILES[player.pos - 1];
  if (tileObj.type === 'special' || tileObj.type === 'start') {
    if (tileObj.type === 'start') {
      currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
      renderTokens();
      updateTVLeaderboard();
      sendBoardWaitState();
      return;
    }
    pendingSpecialTile = { player, tile: tileObj };
    broadcastToAll({
      type: 'SPECIAL_TILE_PENDING',
      playerId: player.id,
      playerName: player.name,
      tile: tileObj
    });
    return;
  }

  prepareCategoryPreviewOnTV(player, tileObj);
}

function showSpecialTileOverlayOnTV(player, tileObj) {
  document.getElementById('tv-special-overlay').style.display = 'flex';
  document.getElementById('tv-spec-icon').innerText = tileObj.icon;
  document.getElementById('tv-spec-title').innerText = `Vak ${tileObj.num}: ${tileObj.title}`;
  document.getElementById('tv-spec-desc').innerText = tileObj.desc;

  broadcastToAll({
    type: 'SPECIAL_TILE_TRIGGERED',
    playerId: player.id,
    playerName: player.name,
    tile: tileObj
  });
}

function resolveSpecialTileEffect(data) {
  document.getElementById('tv-special-overlay').style.display = 'none';
  pendingSpecialTile = null;
  const player = PLAYERS.find(p => p.id === data.playerId);
  if (!player) return;

  const tile = BOARD_TILES[player.pos - 1];

  const finishOrKopduel = () => {
    const others = PLAYERS.filter(p => p.id !== player.id && p.pos === player.pos && p.pos > 1 && p.pos < 63);
    if (others.length > 0) {
      prepareKopduelPreviewOnTV(player, others[0]);
      return;
    }
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    renderTokens();
    updateTVLeaderboard();
    sendBoardWaitState();
  };

  if (data.choice === 'KATER_SKIP') {
    player.skipTurns += 1;
    finishOrKopduel();
  } else if (data.choice === 'KATER_DRINK') {
    finishOrKopduel();
  } else if (tile.action === 'JUMP') {
    animatePlayerJumpToTarget(player, tile.target, finishOrKopduel);
  } else if (tile.action === 'MOVE_REL') {
    const newTarget = Math.max(1, Math.min(63, player.pos + tile.offset));
    animatePlayerJumpToTarget(player, newTarget, finishOrKopduel);
  } else if (tile.action === 'SKIP') {
    player.skipTurns += tile.turns;
    finishOrKopduel();
  } else if (tile.action === 'SWAP_BEHIND') {
    const behind = PLAYERS.filter(p => p.id !== player.id && p.pos < player.pos).sort((a, b) => b.pos - a.pos);
    if (behind.length > 0) {
      const targetP = behind[0];
      const myOldPos = player.pos;
      const targetOldPos = targetP.pos;
      targetP.pos = myOldPos;
      animatePlayerJumpToTarget(player, targetOldPos, finishOrKopduel);
    } else {
      finishOrKopduel();
    }
  } else {
    finishOrKopduel();
  }
}

function prepareKopduelPreviewOnTV(roller, defender) {
  stopTVMedia();
  activeKopduel = {
    p1Id: roller.id,
    p2Id: defender.id,
    p1Name: roller.name,
    p2Name: defender.name,
    rollerId: roller.id
  };
  currentQ = drawUniqueQuestion('kopduel', true);
  receivedAnswers = {};
  roundVerdicts = {};

  broadcastToAll({
    type: 'PLAYER_LANDED_PREVIEW',
    playerId: roller.id,
    playerName: `${roller.name} (gooier) vs ${defender.name}`,
    tileNum: roller.pos,
    categoryName: '💥 KOPDUEL',
    question: currentQ,
    isKopduel: true,
    activeKopduel,
    freePlayMode: false
  });
}

function handleKopduelVerdictOnTV(data) {
  if (data.outcome === 'TIE') {
    hideAllTVOverlays();
    const p1 = PLAYERS.find(x => x.id === activeKopduel.p1Id);
    const p2 = PLAYERS.find(x => x.id === activeKopduel.p2Id);
    setTimeout(() => {
      prepareKopduelPreviewOnTV(p1, p2);
    }, 1200);
    return;
  }

  const qMediaBox = document.getElementById('tv-media-box');
  if (qMediaBox) { qMediaBox.innerHTML = ''; qMediaBox.style.display = 'none'; }

  const roller = PLAYERS.find(x => x.id === activeKopduel.rollerId);
  const rollerWon = data.winnerId === activeKopduel.rollerId;
  const loserId = rollerWon ? activeKopduel.p2Id : activeKopduel.rollerId;

  const resBox = document.getElementById('tv-result-box');
  resBox.style.display = 'flex';
  resBox.innerHTML = [activeKopduel.p1Id, activeKopduel.p2Id].map(pid => {
    const p = PLAYERS.find(x => x.id === pid);
    const isWin = pid === data.winnerId;
    const isRoller = pid === activeKopduel.rollerId;
    const border = isWin ? '#10b981' : '#ef4444';
    const bg = isWin ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';

    let consequenceText = '';
    if (isRoller && isWin) consequenceText = '🏆 GEWONNEN! (+1 vakje vooruit & opdracht van dat vakje!)';
    else if (isRoller && !isWin) consequenceText = '❌ VERLOREN! (SHOTJE 🥃 + 1 vakje terug & opdracht van dat vakje!)';
    else if (!isRoller && isWin) consequenceText = `🏆 GEWONNEN! (${roller.name} neemt een shotje & 1 vakje terug!)`;
    else consequenceText = '❌ VERLOREN! (Neem direct een SHOTJE! 🥃)';

    return `
      <div class="res-row-card" style="background:${bg}; border-color:${border};">
        <div><strong>${p.name}</strong> gokte: <b>"${receivedAnswers[pid] || '-'}"</b></div>
        <div style="font-weight:900; color:${border};">${consequenceText}</div>
      </div>
    `;
  }).join('');

  document.getElementById('tv-q-status').innerText = `Juiste antwoord: ${currentQ.a}`;
  renderAnswerMediaOnTV();

  activeKopduel.rollerWon = rollerWon;

  const kdVerdicts = {};
  kdVerdicts[data.winnerId] = { ans: receivedAnswers[data.winnerId], correct: true };
  kdVerdicts[loserId] = { ans: receivedAnswers[loserId], correct: false };

  broadcastToAll({
    type: 'SHOW_PLAYER_RESULT',
    verdicts: kdVerdicts,
    goodText: rollerWon ? 'Kopduel gewonnen! +1 vakje vooruit!' : `Kopduel gewonnen! ${roller.name} gaat 1 vakje terug!`,
    badText: 'Kopduel verloren: Neem direct een SHOTJE! 🥃',
    isKopduel: true,
    freePlayMode: false
  });
}

function continueAfterKopduelMoveOnTV() {
  if (!activeKopduel) return;
  const roller = PLAYERS.find(x => x.id === activeKopduel.rollerId);
  const rollerWon = activeKopduel.rollerWon;
  activeKopduel = null;

  hideAllTVOverlays();
  stopTVMedia();
  if (!roller) return;

  const targetPos = rollerWon ? Math.min(63, roller.pos + 1) : Math.max(1, roller.pos - 1);
  animatePlayerJumpToTarget(roller, targetPos, () => {
    evaluateTileArrival(roller);
  });
}

function prepareCategoryPreviewOnTV(player, tileObj) {
  stopTVMedia();
  activeKopduel = null;
  currentQ = drawUniqueQuestion(tileObj.cat, true);
  receivedAnswers = {};
  roundVerdicts = {};

  broadcastToAll({
    type: 'PLAYER_LANDED_PREVIEW',
    playerId: player.id,
    playerName: player.name,
    tileNum: player.pos,
    categoryName: tileObj.catName,
    question: currentQ,
    isKopduel: false,
    freePlayMode: false
  });
}

function prepareFreePlayQuestionOnTV(catId, idKey) {
  stopTVMedia();
  activeKopduel = null;
  currentQ = idKey ? drawSpecificQuestion(catId, idKey) : drawUniqueQuestion(catId, false);
  if (!currentQ) {
    const rem = getRemainingQuestionsCatalog();
    renderTVFreePlayOverlay(rem.counts);
    broadcastToAll({ type: 'FREE_PLAY_CATEGORIES', counts: rem.counts, catalog: rem.catalog });
    return;
  }
  currentQ.group = true;
  receivedAnswers = {};
  roundVerdicts = {};

  const catObj = CATEGORIES.find(c => c.id === catId) || { name: '💥 Kopduel' };

  hideAllTVOverlays();
  broadcastToAll({
    type: 'PLAYER_LANDED_PREVIEW',
    playerId: '',
    playerName: 'Iedereen',
    tileNum: '-',
    categoryName: catObj.name,
    question: currentQ,
    isKopduel: false,
    freePlayMode: true
  });
}

function buildMediaHTML(type, mediaPath, audioId) {
  const safeSrc = encodeURI(mediaPath.trim());
  if (type === 'foto') {
    return `<img src="${safeSrc}" alt="Media">`;
  } else if (type === 'video') {
    return `<video src="${safeSrc}" controls playsinline preload="auto"></video>`;
  } else if (type === 'audio') {
    return `
      <div class="audio-player-wrap">
        <button class="btn btn-yellow audio-play-btn" onclick="toggleTVAudio('${audioId}', this)">🔊 Speel Audio Af</button>
        <audio id="${audioId}" src="${safeSrc}" controls playsinline preload="auto"></audio>
      </div>
    `;
  }
  return '';
}

function toggleTVAudio(audioId, btnEl) {
  const audio = document.getElementById(audioId);
  if (!audio) return;
  if (audio.paused) {
    audio.play().then(() => {
      if (btnEl) btnEl.innerText = '⏸️ Pauzeer Audio';
    }).catch(() => {});
  } else {
    audio.pause();
    if (btnEl) btnEl.innerText = '🔊 Speel Audio Af';
  }
}

function revealQuestionOnTV() {
  if (!currentQ) return;
  const activePlayer = PLAYERS.find(p => p.id === turnOrder[currentTurnIndex]);

  const ov = document.getElementById('tv-question-overlay');
  ov.style.display = 'flex';
  ov.classList.remove('has-results');
  document.getElementById('tv-result-box').style.display = 'none';
  document.getElementById('tv-answer-media-box').style.display = 'none';

  if (activeKopduel) {
    document.getElementById('tv-stakes-row').style.display = 'flex';
    document.getElementById('tv-q-cat').innerHTML = `💥 KOPDUEL: ${activeKopduel.p1Name} vs ${activeKopduel.p2Name}`;
    document.getElementById('tv-stake-good').innerText = `🏆 Win: ${activeKopduel.p1Name} +1 vak`;
    document.getElementById('tv-stake-bad').innerText = `🥃 Verlies: Shotje (${activeKopduel.p1Name} -1 vak)`;
  } else if (freePlayMode) {
    const catObj = CATEGORIES.find(c => c.id === currentQ.cat) || { name: '💥 Kopduel' };
    document.getElementById('tv-stakes-row').style.display = 'none';
    document.getElementById('tv-q-cat').innerHTML = `${catObj.name} • 👥 GROEPSVRAAG`;
  } else {
    const tileObj = activePlayer ? BOARD_TILES[activePlayer.pos - 1] : { catName: currentQ.cat };
    document.getElementById('tv-stakes-row').style.display = 'flex';
    document.getElementById('tv-q-cat').innerHTML = `${tileObj.catName} (Vak ${activePlayer ? activePlayer.pos : ''})${currentQ.group ? ' • 👥 GROEPSVRAAG' : ''}`;
    document.getElementById('tv-stake-good').innerText = `✅ Goed: ${currentQ.good}`;
    document.getElementById('tv-stake-bad').innerText = `❌ Fout: ${currentQ.bad}`;
  }

  document.getElementById('tv-q-text').style.display = 'block';
  document.getElementById('tv-q-text').innerText = currentQ.q;

  const mediaBox = document.getElementById('tv-media-box');
  mediaBox.innerHTML = '';
  if (currentQ.media && currentQ.type !== 'tekst') {
    mediaBox.style.display = 'flex';
    mediaBox.innerHTML = buildMediaHTML(currentQ.type, currentQ.media, 'tv-q-audio-el');
    if (currentQ.type === 'audio') {
      const aEl = document.getElementById('tv-q-audio-el');
      if (aEl) aEl.play().catch(() => {});
    }
  } else {
    mediaBox.style.display = 'none';
  }

  document.getElementById('tv-q-status').innerText = activeKopduel
    ? `${activeKopduel.p1Name} & ${activeKopduel.p2Name} vullen nu hun inschatting in...`
    : ((currentQ.group || freePlayMode) ? 'Groepsvraag! Iedereen typt nu een antwoord op zijn telefoon!' : `${activePlayer ? activePlayer.name : 'Speler'} denkt na en typt een antwoord...`);

  broadcastToAll({
    type: 'QUESTION_REVEALED',
    question: currentQ,
    activePlayerId: activePlayer ? activePlayer.id : '',
    activeKopduel,
    freePlayMode
  });
}

function triggerVarCheckOnTV(player) {
  const varOv = document.getElementById('tv-var-overlay');
  if (!varOv) return;
  varOv.style.display = 'flex';
  varOv.className = 'var-tv-banner var-state-checking';
  document.getElementById('tv-var-badge').innerText = 'VAR';
  document.getElementById('tv-var-status').innerText = 'CHECKING...';
  document.getElementById('tv-var-title').innerText = `${player.name.toUpperCase()} VRAAGT DE VAR AAN`;
  document.getElementById('tv-var-sub').innerText = 'De Scheids controleert het antwoord op internet';
  playAudioBeep(520, 0.3);
}

function resolveVarDecisionOnTV(playerId, decision) {
  const p = PLAYERS.find(x => x.id === playerId);
  const varOv = document.getElementById('tv-var-overlay');
  const statusEl = document.getElementById('tv-var-status');
  const title = document.getElementById('tv-var-title');
  const sub = document.getElementById('tv-var-sub');

  if (decision === 'GOAL') {
    if (roundVerdicts[playerId]) roundVerdicts[playerId].correct = true;
    if (varOv) {
      varOv.className = 'var-tv-banner var-state-goal';
      statusEl.innerText = '⚽ DOELPUNT!';
      title.innerText = `${p ? p.name.toUpperCase() : 'SPELER'} HEEFT GELIJK`;
      sub.innerText = 'BESLISSING: GOED • DE SCHEIDS MOET EEN ATJE TREKKEN! 🍺';
    }
    confetti({ particleCount: 150, spread: 85, origin: { y: 0.6 } });
    playAudioBeep(780, 0.35);
  } else {
    if (roundVerdicts[playerId]) roundVerdicts[playerId].correct = false;
    if (varOv) {
      varOv.className = 'var-tv-banner var-state-offside';
      statusEl.innerText = '🚩 GEEN DOELPUNT - BUITENSPEL';
      title.innerText = `${p ? p.name.toUpperCase() : 'SPELER'} ZAT ERNAAST`;
      sub.innerText = `BESLISSING: FOUT • ${p ? p.name.toUpperCase() : 'SPELER'} NEEMT DIRECT EEN SHOTJE! 🥃`;
    }
    playAudioBeep(220, 0.45);
  }

  setTimeout(() => {
    if (varOv) varOv.style.display = 'none';
    if (currentQ && Object.keys(roundVerdicts).length > 0) {
      displayRegularResultsOnTV(roundVerdicts);
    }
  }, 3600);
}

function renderAnswerMediaOnTV() {
  const ansMediaBox = document.getElementById('tv-answer-media-box');
  if (!ansMediaBox) return;
  ansMediaBox.innerHTML = '';
  if (currentQ && currentQ.ansMedia && currentQ.ansType && currentQ.ansType !== 'tekst') {
    ansMediaBox.style.display = 'flex';
    ansMediaBox.innerHTML = buildMediaHTML(currentQ.ansType, currentQ.ansMedia, 'tv-ans-audio-el');
    if (currentQ.ansType === 'audio') {
      const aEl = document.getElementById('tv-ans-audio-el');
      if (aEl) aEl.play().catch(() => {});
    }
  } else {
    ansMediaBox.style.display = 'none';
  }
}

function stopTVMedia() {
  const mediaBox = document.getElementById('tv-media-box');
  const ansMediaBox = document.getElementById('tv-answer-media-box');
  if (mediaBox) { mediaBox.innerHTML = ''; mediaBox.style.display = 'none'; }
  if (ansMediaBox) { ansMediaBox.innerHTML = ''; ansMediaBox.style.display = 'none'; }
}

function displayRegularResultsOnTV(verdicts) {
  const ov = document.getElementById('tv-question-overlay');
  ov.classList.add('has-results');

  const qMediaBox = document.getElementById('tv-media-box');
  if (qMediaBox) { qMediaBox.innerHTML = ''; qMediaBox.style.display = 'none'; }

  const resBox = document.getElementById('tv-result-box');
  resBox.style.display = 'flex';
  resBox.innerHTML = Object.keys(verdicts).map(pId => {
    const p = PLAYERS.find(x => x.id === pId);
    const v = verdicts[pId];
    if (!p) return '';
    const bg = v.correct ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
    const border = v.correct ? '#10b981' : '#ef4444';
    const label = freePlayMode
      ? (v.correct ? '✅ GOED!' : '❌ FOUT!')
      : (v.correct ? `✅ GOED! (${currentQ.good})` : `❌ FOUT! (${currentQ.bad})`);
    return `
      <div class="res-row-card" style="background:${bg}; border-color:${border};">
        <div><strong>${p.name}</strong>: "${v.ans}"</div>
        <div style="font-weight:900; color:${border};">${label}</div>
      </div>
    `;
  }).join('');

  document.getElementById('tv-q-status').innerText = `Juiste antwoord: ${currentQ.a}`;
  renderAnswerMediaOnTV();

  broadcastToAll({
    type: 'SHOW_PLAYER_RESULT',
    verdicts: verdicts,
    goodText: freePlayMode ? '' : currentQ.good,
    badText: freePlayMode ? '' : currentQ.bad,
    isKopduel: false,
    freePlayMode
  });
}

function applyCardPenaltyOnTV(playerId, cardType) {
  const p = PLAYERS.find(x => x.id === playerId);
  if (!p) return;

  let displayType = cardType;
  let title = '';
  let sub = '';

  if (cardType === 'geel') {
    p.yellowCards += 1;
    if (p.yellowCards >= 2) {
      p.yellowCards = 0;
      p.skipTurns += 1;
      displayType = 'rood';
      title = `🟨🟥 2E GEEL = ROOD: ${p.name.toUpperCase()}`;
      sub = '1 BEURT OVERSLAAN + ATJE TREKKEN! 🍺';
    } else {
      displayType = 'geel';
      title = `🟨 GELE KAART: ${p.name.toUpperCase()}`;
      sub = 'WEGENS SPELBEDERF: NEEM DIRECT 5 SLOKKEN! 🍺';
    }
  } else {
    p.skipTurns += 2;
    displayType = 'rood';
    title = `🟥 DIRECTE RODE KAART: ${p.name.toUpperCase()}`;
    sub = '2 BEURTEN GESCHORST + ATJE TREKKEN! 🍺';
  }

  updateTVLeaderboard();
  const cardOv = document.getElementById('tv-card-overlay');
  if (cardOv) {
    cardOv.style.display = 'flex';
    cardOv.className = `tv-card-overlay card-${displayType}`;
    document.getElementById('tv-card-title').innerText = title;
    document.getElementById('tv-card-sub').innerText = sub;
    setTimeout(() => { cardOv.style.display = 'none'; }, 4200);
  }

  playAudioBeep(displayType === 'rood' ? 200 : 480, 0.35);
  broadcastToAll({ type: 'CARD_PENALTY_DISPLAY', playerId: p.id, cardType: displayType, title, sub });
  broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted, freePlayMode });
}

let myVarAvailable = true;

function resetMobileBackground() {
  const mv = document.getElementById('mobile-view');
  if (mv) {
    mv.style.backgroundColor = 'transparent';
    mv.classList.remove('blink-yellow', 'blink-red');
  }
}

function hideAllMobileCards() {
  ['m-lobby-card', 'm-roll-order-card', 'm-turn-card', 'm-wait-turn-card', 'm-answer-card', 'm-result-card'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function updateMobileVarButton(show, available) {
  const varBtn = document.getElementById('m-var-badge');
  if (!varBtn) return;
  if (!show) {
    varBtn.style.display = 'none';
    return;
  }
  varBtn.style.display = 'inline-flex';
  varBtn.innerText = available ? '📺 VAR (1x)' : '📺 VAR (Op)';
  varBtn.disabled = !available;
  varBtn.style.opacity = available ? '1' : '0.4';
}

function handlePlayerIncomingData(data) {
  if (data.type === 'PLAYER_KICKED' && data.playerId === myPlayerId) {
    alert("Je bent door de scheids verwijderd.");
    location.reload();
    return;
  }

  if (data.type === 'SYNC_PLAYERS') {
    const me = data.players.find(x => x.id === myPlayerId);
    if (me) {
      myVarAvailable = me.varLeft;
      document.getElementById('m-player-name').style.color = me.color;
      document.getElementById('m-header-avatar').style.borderColor = me.color;
      if (data.gameStarted) {
        document.getElementById('m-tile-info').style.display = 'block';
        document.getElementById('m-tile-info').innerText = `Vak ${me.pos} (Nog ${63 - me.pos})`;
        updateMobileVarButton(true, me.varLeft);
      }
    }
  }
  else if (data.type === 'CARD_PENALTY_DISPLAY') {
    if (data.playerId === myPlayerId) {
      const mv = document.getElementById('mobile-view');
      mv.classList.remove('blink-yellow', 'blink-red');
      mv.classList.add(data.cardType === 'rood' ? 'blink-red' : 'blink-yellow');
      setTimeout(() => {
        mv.classList.remove('blink-yellow', 'blink-red');
      }, 4200);
    }
  }
  else if (data.type === 'START_WIEGELOOT') {
    resetMobileBackground();
    hideAllMobileCards();
    document.getElementById('m-tile-info').style.display = 'block';
    updateMobileVarButton(true, myVarAvailable);
    const isMyRoll = !data.activeRollers || data.activeRollers.includes(myPlayerId);
    if (isMyRoll) {
      document.getElementById('m-roll-order-card').style.display = 'flex';
      document.getElementById('m-btn-roll-order').style.display = 'inline-flex';
      document.getElementById('m-roll-order-result').innerText = data.isTieBreak ? '⚡ Gelijkspel! Gooi opnieuw!' : '';
    } else {
      document.getElementById('m-wait-turn-card').style.display = 'flex';
      document.getElementById('m-wait-turn-text').innerText = 'Tie-break voor de aftrap!';
      document.getElementById('m-wait-turn-sub').innerText = 'De koplopers gooien opnieuw voor wie mag beginnen.';
    }
  }
  else if (data.type === 'WIEGELOOT_WINNER_DECIDED') {
    resetMobileBackground();
    hideAllMobileCards();
    document.getElementById('m-wait-turn-card').style.display = 'flex';
    document.getElementById('m-wait-turn-text').innerText = `🏆 ${data.winnerName} mag beginnen!`;
    document.getElementById('m-wait-turn-sub').innerText = 'De Scheids stelt nu de tafelvolgorde in...';
  }
  else if (data.type === 'BOARD_ACTIVE_WAIT') {
    resetMobileBackground();
    hideAllMobileCards();
    const me = data.players.find(x => x.id === myPlayerId);
    if (me) {
      myVarAvailable = me.varLeft;
      document.getElementById('m-tile-info').innerText = `Vak ${me.pos} (Nog ${63 - me.pos})`;
      updateMobileVarButton(true, me.varLeft);
    }
    document.getElementById('m-wait-turn-card').style.display = 'flex';
    document.getElementById('m-wait-turn-text').innerText = 'Spelbord Actief';
    document.getElementById('m-wait-turn-sub').innerText = `Volgende aan de beurt: ${data.nextPlayerName}`;
  }
  else if (data.type === 'GAME_FINISHED_WIN') {
    resetMobileBackground();
    hideAllMobileCards();
    document.getElementById('m-wait-turn-card').style.display = 'flex';
    document.getElementById('m-wait-turn-text').innerText = `🏆 ${data.winnerName} heeft gewonnen!`;
    document.getElementById('m-wait-turn-sub').innerText = 'Wachten op de scheids voor de overige vragen...';
  }
  else if (data.type === 'FREE_PLAY_CATEGORIES') {
    resetMobileBackground();
    hideAllMobileCards();
    document.getElementById('m-wait-turn-card').style.display = 'flex';
    document.getElementById('m-wait-turn-text').innerText = '📚 Vrije Quizmodus';
    document.getElementById('m-wait-turn-sub').innerText = 'De scheids kiest nu de volgende vraag...';
  }
  else if (data.type === 'TURN_STARTED') {
    resetMobileBackground();
    hideAllMobileCards();
    const isMyTurn = data.activePlayerId === myPlayerId;
    if (isMyTurn) {
      document.getElementById('m-turn-card').style.display = 'flex';
      document.getElementById('m-btn-roll').style.display = 'inline-flex';
      document.getElementById('m-btn-step').style.display = 'none';
    } else {
      document.getElementById('m-wait-turn-card').style.display = 'flex';
      document.getElementById('m-wait-turn-text').innerText = `${data.activePlayerName} gooit nu!`;
      document.getElementById('m-wait-turn-sub').innerText = 'Kijk naar het grote scherm.';
    }
  }
  else if (data.type === 'SPECIAL_TILE_PENDING' || data.type === 'SPECIAL_TILE_TRIGGERED') {
    resetMobileBackground();
    hideAllMobileCards();
    document.getElementById('m-wait-turn-card').style.display = 'flex';
    document.getElementById('m-wait-turn-text').innerText = `🚨 ${data.tile.title}`;
    document.getElementById('m-wait-turn-sub').innerText = data.tile.desc;
  }
  else if (data.type === 'PLAYER_LANDED_PREVIEW') {
    resetMobileBackground();
    hideAllMobileCards();
    document.getElementById('m-wait-turn-card').style.display = 'flex';
    document.getElementById('m-wait-turn-text').innerHTML = `${data.categoryName}`;
    document.getElementById('m-wait-turn-sub').innerText = 'Kijk naar het bord! De scheids opent zo de vraag...';
  }
  else if (data.type === 'QUESTION_REVEALED') {
    resetMobileBackground();
    hideAllMobileCards();

    let shouldAnswer = false;
    if (data.freePlayMode) {
      shouldAnswer = true;
    } else if (data.activeKopduel) {
      shouldAnswer = (myPlayerId === data.activeKopduel.p1Id || myPlayerId === data.activeKopduel.p2Id);
    } else {
      shouldAnswer = data.question.group || data.activePlayerId === myPlayerId;
    }

    if (shouldAnswer) {
      document.getElementById('m-answer-card').style.display = 'flex';
      document.getElementById('m-q-cat').innerText = data.activeKopduel ? '💥 KOPDUEL INSCHATTING' : data.question.cat.toUpperCase();
      document.getElementById('m-q-text').innerText = data.question.q;
      document.getElementById('m-input-ans').value = '';
      document.getElementById('m-btn-submit-ans').style.display = 'inline-flex';
      const skipBtn = document.getElementById('m-btn-skip-ans');
      if (skipBtn) skipBtn.style.display = data.activeKopduel ? 'none' : 'inline-flex';
      document.getElementById('m-ans-status').innerText = '';
    } else {
      document.getElementById('m-wait-turn-card').style.display = 'flex';
      document.getElementById('m-wait-turn-text').innerText = 'Vraag is geopend!';
      document.getElementById('m-wait-turn-sub').innerText = 'De speler(s) aan de beurt vullen nu een antwoord in.';
    }
  }
  else if (data.type === 'SHOW_PLAYER_RESULT') {
    const myVerdict = data.verdicts[myPlayerId];
    if (myVerdict) {
      hideAllMobileCards();
      const mv = document.getElementById('mobile-view');
      mv.style.backgroundColor = myVerdict.correct ? '#16a34a' : '#dc2626';

      document.getElementById('m-result-card').style.display = 'flex';
      document.getElementById('m-result-icon').innerText = myVerdict.correct ? '✅' : '❌';
      document.getElementById('m-result-title').innerText = myVerdict.correct ? 'GOED!' : 'FOUT!';
      document.getElementById('m-result-sub').innerText = data.freePlayMode ? '' : (myVerdict.correct ? data.goodText : data.badText);
    }
  }
}

function playerUseVar() {
  if (!myVarAvailable) return;
  if (!confirm('Weet je zeker dat je jouw VAR wilt inzetten? (Gelijk = Scheids Atje | Fout = Jij een Shotje!)')) return;
  myVarAvailable = false;
  updateMobileVarButton(true, false);
  clientConn.send({ type: 'PLAYER_REQUEST_VAR', playerId: myPlayerId });
}

function playerRollOrder() {
  const roll = Math.floor(Math.random() * 6) + 1;
  document.getElementById('m-btn-roll-order').style.display = 'none';

  animateDiceCube('m-order-dice', roll, 0.72, () => {
    document.getElementById('m-roll-order-result').innerText = `Gegooid: ${roll}! Wachten op resultaat...`;
    clientConn.send({ type: 'PLAYER_WIEGELOOT_ROLL', playerId: myPlayerId, roll: roll });
  });
}

function playerRollDice() {
  pendingRoll = Math.floor(Math.random() * 6) + 1;
  document.getElementById('m-btn-roll').style.display = 'none';

  clientConn.send({ type: 'PLAYER_DICE_ROLL', playerId: myPlayerId, roll: pendingRoll });

  animateDiceCube('m-turn-dice', pendingRoll, 0.72, () => {
    const stepBtn = document.getElementById('m-btn-step');
    stepBtn.style.display = 'inline-flex';
    stepBtn.innerText = `🏃 Zet ${pendingRoll} Stappen!`;
  });
}

function playerExecuteSteps() {
  hideAllMobileCards();
  document.getElementById('m-wait-turn-card').style.display = 'flex';
  document.getElementById('m-wait-turn-text').innerText = 'Je pion loopt over het veld...';
  document.getElementById('m-wait-turn-sub').innerText = 'Kijk naar de TV!';
  clientConn.send({ type: 'PLAYER_EXECUTE_STEPS', playerId: myPlayerId, steps: pendingRoll });
}

function playerSubmitAnswer() {
  const ans = document.getElementById('m-input-ans').value.trim();
  if (!ans) return;
  document.getElementById('m-btn-submit-ans').style.display = 'none';
  const skipBtn = document.getElementById('m-btn-skip-ans');
  if (skipBtn) skipBtn.style.display = 'none';
  document.getElementById('m-ans-status').innerText = '✅ Antwoord verstuurd! Wachten op Scheids...';
  clientConn.send({ type: 'PLAYER_SUBMIT_ANSWER', playerId: myPlayerId, ans: ans, autoWrong: false });
}

function playerSkipQuestion() {
  document.getElementById('m-btn-submit-ans').style.display = 'none';
  const skipBtn = document.getElementById('m-btn-skip-ans');
  if (skipBtn) skipBtn.style.display = 'none';
  document.getElementById('m-ans-status').innerText = '🏳️ Vraag geskipt (Automatisch Fout). Wachten op Scheids...';
  clientConn.send({ type: 'PLAYER_SUBMIT_ANSWER', playerId: myPlayerId, ans: '🏳️ Geskipt', autoWrong: true });
}

function hideAllRefCards() {
  ['ref-lobby-card', 'ref-wiegeloot-card', 'ref-board-card', 'ref-special-card', 'ref-pre-question-card', 'ref-judge-card', 'ref-kopduel-card', 'ref-game-over-card', 'ref-free-play-card', 'ref-penalty-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function renderRefPlayerLists() {
  const lobbyList = document.getElementById('ref-player-list');
  const activeList = document.getElementById('ref-active-player-list');
  document.getElementById('ref-player-count').innerText = `Deelnemers (${PLAYERS.length}):`;

  lobbyList.innerHTML = PLAYERS.length === 0
    ? '<div style="opacity:0.5;">Nog geen spelers aangemeld...</div>'
    : PLAYERS.map(p => `
      <div style="background: rgba(255,255,255,0.06); padding: 8px 10px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${p.color};">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${p.selfie}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
          <span style="font-weight: 800; font-size: 0.9rem;">${p.name}</span>
        </div>
        <button class="btn btn-red" style="padding: 5px 10px; font-size: 0.72rem;" onclick="refKickPlayer('${p.id}', '${p.name}')">Kick ❌</button>
      </div>
    `).join('');

  if (activeList) {
    activeList.innerHTML = PLAYERS.map(p => `
      <div style="background: rgba(255,255,255,0.06); padding: 8px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${p.color};">
        <span style="font-weight: 800; font-size: 0.85rem;">${p.name} (Vak ${p.pos})</span>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-yellow" style="padding: 5px 8px; font-size: 0.7rem;" onclick="refGiveCard('${p.id}', 'geel')">🟨</button>
          <button class="btn btn-red" style="padding: 5px 8px; font-size: 0.7rem;" onclick="refGiveCard('${p.id}', 'rood')">🟥</button>
          <button class="btn btn-purple" style="padding: 5px 8px; font-size: 0.7rem;" onclick="refKickPlayer('${p.id}', '${p.name}')">❌</button>
        </div>
      </div>
    `).join('');
  }
}

function refKickPlayer(playerId, playerName) {
  if (!confirm(`Wil je ${playerName} verwijderen?`)) return;
  clientConn.send({ type: 'REF_KICK_PLAYER', playerId });
}

function refGiveCard(playerId, cardType) {
  clientConn.send({ type: 'REF_GIVE_CARD', playerId, cardType });
  toggleRefPenaltyModal();
}

function refStartGame() {
  if (PLAYERS.length === 0) return alert("Wacht tot er minimaal 1 speler in de dugout zit!");
  hideAllRefCards();
  document.getElementById('ref-wiegeloot-card').style.display = 'flex';
  document.getElementById('ref-top-cards-btn').style.display = 'inline-flex';
  document.getElementById('ref-status-sub').innerText = 'Startvolgorde Bepalen';
  clientConn.send({ type: 'REF_START_GAME' });
}

function renderRefManualOrderBuilder() {
  const list = document.getElementById('ref-wiegeloot-list');
  const starter = PLAYERS.find(x => x.id === firstStarterId);
  const remaining = PLAYERS.filter(x => !manualOrderSequence.includes(x.id));

  if (remaining.length === 0) {
    document.getElementById('ref-wiegeloot-status').innerText = 'Volgorde compleet!';
    list.innerHTML = manualOrderSequence.map((id, idx) => {
      const p = PLAYERS.find(x => x.id === id);
      return `
        <div style="display:flex; justify-content:space-between; background:rgba(16,185,129,0.2); border:1px solid #10b981; padding:8px 12px; border-radius:8px;">
          <span style="font-weight:800; color:${p.color};">${idx + 1}. ${p.name}</span>
          <span>✅</span>
        </div>
      `;
    }).join('');
    const btn = document.getElementById('ref-btn-to-board-initial');
    btn.style.display = 'inline-flex';
    btn.innerText = '🏟️ Bevestig Volgorde & Naar Bord';
    btn.onclick = () => {
      clientConn.send({ type: 'REF_SET_CUSTOM_ORDER', order: manualOrderSequence });
    };
    return;
  }

  document.getElementById('ref-wiegeloot-status').innerText =
    `1e is ${starter ? starter.name : ''}. Tik op wie er als #${manualOrderSequence.length + 1} naast zit:`;

  const chosenHtml = manualOrderSequence.map((id, idx) => {
    const p = PLAYERS.find(x => x.id === id);
    return `
      <div style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.06); padding:6px 10px; border-radius:8px; opacity:0.75;">
        <span style="font-weight:800; color:${p.color};">#${idx + 1} ${p.name}</span>
        <span>🔒</span>
      </div>
    `;
  }).join('');

  const pickHtml = remaining.map(p => `
    <button class="btn btn-blue" style="width:100%; justify-content:space-between; padding:10px 12px;" onclick="refAddPlayerToOrder('${p.id}')">
      <span>➕ Kies ${p.name} als #${manualOrderSequence.length + 1}</span>
    </button>
  `).join('');

  list.innerHTML = chosenHtml + pickHtml;
}

function refAddPlayerToOrder(pId) {
  if (!manualOrderSequence.includes(pId)) {
    manualOrderSequence.push(pId);
    renderRefManualOrderBuilder();
  }
}

function refGoToBoardInitial() {
  clientConn.send({ type: 'REF_SHOW_BOARD' });
}

function refAllowPlayerRoll() {
  document.getElementById('ref-btn-allow-roll').style.display = 'none';
  document.getElementById('ref-board-sub').innerText = 'Speler is nu aan het gooien en lopen...';
  clientConn.send({ type: 'REF_ALLOW_ROLL' });
}

function refConfirmSkipTurn() {
  clientConn.send({ type: 'REF_CONFIRM_SKIP' });
}

function refShowQuestion() {
  hideAllRefCards();
  if (activeKopduel) {
    document.getElementById('ref-kopduel-card').style.display = 'flex';
    document.getElementById('ref-kd-text').innerText = currentQ.q;
    document.getElementById('ref-kd-secret-ans').innerText = currentQ.a;
    document.getElementById('ref-kd-answers').innerHTML = '<div style="opacity:0.6; font-size:0.85rem;">Wachten op antwoorden van beide spelers...</div>';
    document.getElementById('ref-kd-actions').innerHTML = '';
    document.getElementById('ref-kd-to-board').style.display = 'none';
  } else {
    document.getElementById('ref-judge-card').style.display = 'flex';
    document.getElementById('ref-btn-show-result').style.display = 'none';
    document.getElementById('ref-btn-back-to-board').style.display = 'none';
    document.getElementById('ref-btn-back-to-board').innerText = freePlayMode ? '📚 Kies Volgende Vraag' : '🏟️ Naar Bord';
    document.getElementById('ref-answers-list').innerHTML = '<div style="opacity:0.6; font-size:0.85rem;">Wachten op antwoord...</div>';
  }
  clientConn.send({ type: 'REF_SHOW_QUESTION' });
}

function handleRefIncomingData(data) {
  if (data.type === 'SYNC_PLAYERS' || data.type === 'PLAYER_KICKED') {
    PLAYERS = data.players;
    renderRefPlayerLists();
  }
  else if (data.type === 'START_WIEGELOOT' || data.type === 'WIEGELOOT_UPDATE') {
    PLAYERS = data.players;
    document.getElementById('ref-btn-to-board-initial').style.display = 'none';
    const list = document.getElementById('ref-wiegeloot-list');
    list.innerHTML = PLAYERS.map(p => `
      <div style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.06); padding:8px 12px; border-radius:8px;">
        <span style="font-weight:700; color:${p.color};">${p.name}</span>
        <span style="font-weight:900; color:var(--gold);">${p.orderRoll > 0 ? '🎲 ' + p.orderRoll : '⏳...'}</span>
      </div>
    `).join('');
  }
  else if (data.type === 'WIEGELOOT_WINNER_DECIDED') {
    PLAYERS = data.players;
    firstStarterId = data.winnerId;
    manualOrderSequence = [data.winnerId];
    renderRefManualOrderBuilder();
  }
  else if (data.type === 'BOARD_ACTIVE_WAIT') {
    hideAllRefCards();
    document.getElementById('ref-board-card').style.display = 'flex';
    document.getElementById('ref-next-player-title').innerText = `Aan de beurt: ${data.nextPlayerName}`;

    if (data.nextPlayerSkip > 0) {
      document.getElementById('ref-board-sub').innerText = `🩼 Let op: ${data.nextPlayerName} moet nog ${data.nextPlayerSkip} beurt(en) overslaan!`;
      document.getElementById('ref-btn-allow-roll').style.display = 'none';
      document.getElementById('ref-btn-skip-turn').style.display = 'inline-flex';
    } else {
      document.getElementById('ref-board-sub').innerText = 'Klik hieronder wanneer de speler mag gooien.';
      document.getElementById('ref-btn-allow-roll').style.display = 'inline-flex';
      document.getElementById('ref-btn-skip-turn').style.display = 'none';
    }
  }
  else if (data.type === 'GAME_FINISHED_WIN') {
    hideAllRefCards();
    document.getElementById('ref-status-sub').innerText = 'Spel Afgelopen';
    document.getElementById('ref-game-over-card').style.display = 'flex';
    document.getElementById('ref-win-name').innerText = `🏆 ${data.winnerName} heeft gewonnen!`;
  }
  else if (data.type === 'FREE_PLAY_CATEGORIES') {
    freePlayMode = true;
    freePlayCatalog = data.catalog || {};
    selectedFreeCatId = '';
    hideAllRefCards();
    document.getElementById('ref-status-sub').innerText = 'Vrije Quizmodus';
    document.getElementById('ref-free-play-card').style.display = 'flex';
    renderRefFreePlayCategories(data.counts || {});
  }
  else if (data.type === 'SPECIAL_TILE_PENDING') {
    hideAllRefCards();
    document.getElementById('ref-special-card').style.display = 'flex';
    document.getElementById('ref-spec-badge').innerText = `Vak ${data.tile.num} (Op Bord)`;
    document.getElementById('ref-spec-title').innerText = data.tile.title;
    document.getElementById('ref-spec-desc').innerText = `${data.playerName} is geland! Klik hieronder om de uitleg groot op TV te tonen.`;
    document.getElementById('ref-spec-buttons').innerHTML = `
      <button class="btn btn-yellow" onclick="refOpenSpecialOnTV()">📺 Toon Speciaal Vakje op TV</button>
    `;
  }
  else if (data.type === 'SPECIAL_TILE_TRIGGERED') {
    hideAllRefCards();
    document.getElementById('ref-special-card').style.display = 'flex';
    document.getElementById('ref-spec-badge').innerText = `Vak ${data.tile.num}`;
    document.getElementById('ref-spec-title').innerText = data.tile.title;
    document.getElementById('ref-spec-desc').innerText = `${data.playerName}: ${data.tile.desc}`;

    const btnBox = document.getElementById('ref-spec-buttons');
    if (data.tile.action === 'CHOICE_KATER') {
      btnBox.innerHTML = `
        <button class="btn btn-yellow" onclick="refResolveSpecial('${data.playerId}', 'KATER_DRINK')">🍺 4 Slokken Adten (Doorspelen)</button>
        <button class="btn btn-blue" onclick="refResolveSpecial('${data.playerId}', 'KATER_SKIP')">😴 1 Beurt Overslaan</button>
      `;
    } else {
      btnBox.innerHTML = `
        <button class="btn btn-green" onclick="refResolveSpecial('${data.playerId}', 'DEFAULT')">✅ Uitvoeren & Verplaats Pion</button>
      `;
    }
  }
  else if (data.type === 'PLAYER_LANDED_PREVIEW') {
    hideAllRefCards();
    activeKopduel = data.isKopduel ? data.activeKopduel : null;
    freePlayMode = Boolean(data.freePlayMode);
    currentQ = data.question;

    document.getElementById('ref-pre-question-card').style.display = 'flex';
    document.getElementById('ref-pre-cat').innerHTML = data.freePlayMode ? `${data.categoryName} (P${data.question.priority || 2})` : `${data.categoryName} (Vak ${data.tileNum} • P${data.question.priority || 2})`;
    document.getElementById('ref-pre-title').innerText = data.freePlayMode ? 'Groepsvraag klaar!' : `${data.playerName} staat op het bord!`;
    document.getElementById('ref-preview-q').innerText = data.question.q;
    document.getElementById('ref-preview-a').innerText = data.question.a;

    document.getElementById('ref-q-text').innerText = data.question.q;
    document.getElementById('ref-q-secret-ans').innerText = data.question.a;
    roundVerdicts = {};
  }
  else if (data.type === 'REF_RECEIVE_ANSWERS') {
    receivedAnswers = data.answers;
    if (data.verdicts) Object.assign(roundVerdicts, data.verdicts);
    if (data.activeKopduel) {
      renderRefKopduelAnswers(data.answers, data.activeKopduel);
    } else {
      renderRefAnswers(data.answers);
    }
  }
  else if (data.type === 'REF_VAR_CHECK_PROMPT') {
    hideAllRefCards();
    document.getElementById('ref-special-card').style.display = 'flex';
    document.getElementById('ref-spec-badge').innerText = `📺 VAR CHECK`;
    document.getElementById('ref-spec-title').innerText = `${data.playerName} zet de VAR in!`;
    document.getElementById('ref-spec-desc').innerHTML =
      `<b>Vraag:</b> ${data.question.q}<br><b>CSV Antwoord:</b> ${data.question.a}<br><b>Antwoord ${data.playerName}:</b> "${data.givenAns}"<br><br>Zoek het op internet op en maak je beslissing:`;
    document.getElementById('ref-spec-buttons').innerHTML = `
      <button class="btn btn-green" onclick="refSendVarDecision('${data.playerId}', 'GOAL')">⚽ DOELPUNT (${data.playerName} gelijk = Scheids Atje!)</button>
      <button class="btn btn-red" onclick="refSendVarDecision('${data.playerId}', 'OFFSIDE')">🚩 BUITENSPEL (${data.playerName} fout = Shotje!)</button>
    `;
  }
}

function refOpenSpecialOnTV() {
  clientConn.send({ type: 'REF_OPEN_SPECIAL_OVERLAY' });
}

function refSendVarDecision(playerId, decision) {
  hideAllRefCards();
  if (currentQ) {
    document.getElementById('ref-judge-card').style.display = 'flex';
    document.getElementById('ref-btn-show-result').style.display = 'none';
    document.getElementById('ref-btn-back-to-board').style.display = 'inline-flex';
  } else {
    document.getElementById('ref-board-card').style.display = 'flex';
  }
  clientConn.send({ type: 'REF_VAR_DECISION', playerId, decision });
}

function refStartFreePlay() {
  clientConn.send({ type: 'REF_START_FREE_PLAY' });
}

function renderRefFreePlayCategories(counts) {
  const list = document.getElementById('ref-free-cat-list');
  const titleEl = document.getElementById('ref-free-title');
  if (titleEl) titleEl.innerText = '📚 Kies een Categorie';
  const allCats = [...CATEGORIES, { id: 'kopduel', name: '💥 Kopduel' }];
  list.innerHTML = allCats.map(c => {
    const left = counts[c.id] || 0;
    return `
      <button class="btn btn-blue" style="width:100%; justify-content:space-between;" ${left === 0 ? 'disabled' : ''} onclick="refOpenFreeCatQuestions('${c.id}')">
        <span>${c.name}</span>
        <span style="background:rgba(0,0,0,0.35); padding:3px 8px; border-radius:8px; font-size:0.78rem;">Nog ${left}</span>
      </button>
    `;
  }).join('');
}

function refOpenFreeCatQuestions(catId) {
  selectedFreeCatId = catId;
  const list = document.getElementById('ref-free-cat-list');
  const titleEl = document.getElementById('ref-free-title');
  const catObj = CATEGORIES.find(c => c.id === catId) || { name: '💥 Kopduel' };
  if (titleEl) titleEl.innerHTML = `${catObj.name} — Kies een vraag`;

  const items = freePlayCatalog[catId] || [];
  const backBtn = `<button class="btn btn-purple" style="width:100%; padding:8px; font-size:0.8rem;" onclick="refBackToFreeCats()">⬅️ Terug naar Categorieën</button>`;
  const rows = items.map(item => `
    <div class="free-q-pick-item" onclick="refSelectSpecificFreeQ('${catId}', '${item.idKey.replace(/'/g, "\\'")}')">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span class="prio-badge prio-${item.priority}">PRIORITEIT ${item.priority}</span>
        <span style="font-size:0.72rem; color:var(--gold); font-weight:800;">Tik om te kiezen ▶</span>
      </div>
      <div style="font-weight:800; font-size:0.84rem; line-height:1.25;">${item.q}</div>
      <div style="font-size:0.78rem; color:#4ade80; margin-top:4px;"><b>Antwoord:</b> ${item.a}</div>
    </div>
  `).join('');

  list.innerHTML = backBtn + rows;
}

function refBackToFreeCats() {
  const counts = {};
  Object.keys(freePlayCatalog).forEach(k => { counts[k] = freePlayCatalog[k].length; });
  renderRefFreePlayCategories(counts);
}

function refSelectSpecificFreeQ(catId, idKey) {
  clientConn.send({ type: 'REF_SELECT_FREE_QUESTION', catId, idKey });
}

function refResolveSpecial(playerId, choice) {
  clientConn.send({ type: 'REF_RESOLVE_SPECIAL', playerId, choice });
}

function renderRefKopduelAnswers(answers, kd) {
  const list = document.getElementById('ref-kd-answers');
  list.innerHTML = [kd.p1Id, kd.p2Id].map(pid => {
    const p = PLAYERS.find(x => x.id === pid);
    const ans = answers[pid];
    return `
      <div style="background: rgba(255,255,255,0.08); padding: 8px 10px; border-radius: 8px; border-left: 4px solid ${p ? p.color : '#fff'}; display:flex; justify-content:space-between;">
        <span style="font-weight:800;">${p ? p.name : ''}:</span>
        <span style="color:var(--gold); font-weight:900;">${ans ? `"${ans}"` : '⏳ Aan het typen...'}</span>
      </div>
    `;
  }).join('');

  if (answers[kd.p1Id] && answers[kd.p2Id]) {
    document.getElementById('ref-kd-actions').innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
        <button class="btn btn-green" style="padding:10px; font-size:0.8rem;" onclick="refPickKopduelWinner('${kd.p1Id}')">🏆 ${kd.p1Name} Wint (+1 vak)</button>
        <button class="btn btn-green" style="padding:10px; font-size:0.8rem;" onclick="refPickKopduelWinner('${kd.p2Id}')">🏆 ${kd.p2Name} Wint (${kd.p1Name} -1 vak)</button>
      </div>
      <button class="btn btn-red" style="padding:10px; font-size:0.8rem;" onclick="refPickKopduelTie()">🍻 Gelijkspel (Scheids Atje + Nieuwe Vraag)</button>
    `;
  }
}

function refPickKopduelWinner(winnerId) {
  document.getElementById('ref-kd-actions').innerHTML = '';
  const btn = document.getElementById('ref-kd-to-board');
  btn.style.display = 'inline-flex';
  btn.innerText = '🏃 Verplaats Pion & Volgende Vraag';
  btn.onclick = () => {
    clientConn.send({ type: 'REF_CONTINUE_AFTER_KOPDUEL' });
  };
  clientConn.send({ type: 'REF_KOPDUEL_VERDICT', outcome: 'WIN', winnerId });
}

function refPickKopduelTie() {
  clientConn.send({ type: 'REF_KOPDUEL_VERDICT', outcome: 'TIE' });
}

function renderRefAnswers(answers) {
  const list = document.getElementById('ref-answers-list');
  list.innerHTML = Object.keys(answers).map(pId => {
    const p = PLAYERS.find(x => x.id === pId);
    if (!p) return '';
    const judged = roundVerdicts[pId];
    return `
      <div style="background: rgba(255,255,255,0.08); padding: 8px 10px; border-radius: 10px; border-left: 4px solid ${p.color};">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight: 800; font-size:0.88rem;">${p.name}: "${answers[pId]}"</span>
          <span style="font-size:0.78rem; font-weight:900;">
            ${judged ? (judged.correct ? '✅ GOED' : '❌ FOUT') : ''}
          </span>
        </div>
        <div style="display: flex; gap: 6px; margin-top: 6px;">
          <button class="btn btn-green" style="padding: 6px; font-size: 0.78rem; flex:1;" onclick="refMarkAnswer('${pId}', true)">✅ Goed</button>
          <button class="btn btn-red" style="padding: 6px; font-size: 0.78rem; flex:1;" onclick="refMarkAnswer('${pId}', false)">❌ Fout</button>
        </div>
      </div>
    `;
  }).join('');

  if (Object.keys(roundVerdicts).length > 0) {
    document.getElementById('ref-btn-show-result').style.display = 'inline-flex';
  }
}

function refMarkAnswer(pId, isCorrect) {
  roundVerdicts[pId] = {
    ans: receivedAnswers[pId] || '',
    correct: isCorrect
  };
  renderRefAnswers(receivedAnswers);
  document.getElementById('ref-btn-show-result').style.display = 'inline-flex';
}

function refShowResult() {
  document.getElementById('ref-btn-show-result').style.display = 'none';
  document.getElementById('ref-btn-back-to-board').style.display = 'inline-flex';
  clientConn.send({
    type: 'REF_SHOW_RESULT',
    verdicts: roundVerdicts
  });
}

function refBackToBoard() {
  clientConn.send({ type: 'REF_ADVANCE_TURN_TO_BOARD' });
}

function toggleRefPenaltyModal() {
  const modal = document.getElementById('ref-penalty-modal');
  const isHidden = modal.style.display === 'none';
  modal.style.display = isHidden ? 'flex' : 'none';
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

function playAudioBeep(freq, duration) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}