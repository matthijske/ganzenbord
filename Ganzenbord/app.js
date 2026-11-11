/* KLEUREN VOOR DEELNEMERS */
const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#ec4899', '#06b6d4', '#f97316'];
let PLAYERS = [];
let gameStarted = false;

let turnOrder = [];
let currentTurnIndex = 0;
let pendingRoll = 0;
let currentQ = null;
let receivedAnswers = {};
let roundVerdicts = {};
let activeKopduel = null; // { p1Id, p2Id }

/* 3D DOBBELSTEEN ROTATIES */
const DICE_ROTATIONS = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  2: { x: 0, y: 90 },
  5: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 }
};

/* DE 7 DEFINITIEVE CATEGORIEËN */
const CATEGORIES = [
  { id: 'roemenie',    name: '🇷🇴 Roemenië',       short: 'Roemenië',  icon: '🇷🇴' },
  { id: 'wk',          name: '🌍 Het WK',          short: 'Het WK',    icon: '🌍' },
  { id: 'video_audio', name: '🎬 Video & Audio',   short: 'Media',     icon: '🎬' },
  { id: 'foto',        name: '📸 Foto',            short: 'Foto',      icon: '📸' },
  { id: 'algemeen',    name: '⚽ Algemeen',        short: 'Algemeen',  icon: '⚽' },
  { id: 'paspoort',    name: '🪪 Spelerspaspoort', short: 'Paspoort',  icon: '🪪' },
  { id: 'transfers',   name: '💰 Transferwaarde',  short: 'Transfers', icon: '💰' }
];

/* DE 12 SPECIALE VAKJES OP HET 63-VAKS BORD */
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

/* BOUW DE 63 VAKJES */
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

/* SPIRAAL MATRIX BEREKENEN VOOR 9 KOLOMMEN x 7 RIJEN (= 63 VAKJES) */
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

/* STANDAARD BACKUP-VRAGEN + CSV INLADEN */
let QUESTION_POOLS = {
  roemenie: [
    { cat: 'roemenie', type: 'tekst', media: '', q: 'Welke Roemeense club won in 1986 de Europacup 1 door FC Barcelona na penalty\'s te verslaan?', a: 'Steaua Boekarest', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false },
    { cat: 'roemenie', type: 'tekst', media: '', q: 'Welke Roemeense legende stond bekend als "De Maradona van de Karpaten"?', a: 'Gheorghe Hagi', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false }
  ],
  wk: [
    { cat: 'wk', type: 'tekst', media: '', q: 'In welk Zuid-Amerikaans land werd in 1930 het allereerste WK voetbal georganiseerd?', a: 'Uruguay', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false },
    { cat: 'wk', type: 'tekst', media: '', q: 'Wie scoorde in de verlenging van de WK-finale van 2014 de winnende goal voor Duitsland?', a: 'Mario Götze', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false }
  ],
  video_audio: [
    { cat: 'video_audio', type: 'tekst', media: '', q: 'Maak het legendarische commentaar van Jack van Gelder in 1998 af: "DENNIS BERGKAMP! DENNIS BERGKAMP! ..."', a: 'BERRRGKAMP!', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: true }
  ],
  foto: [
    { cat: 'foto', type: 'tekst', media: '', q: 'Welke Braziliaanse spits droeg tijdens het WK 2002 het iconische driehoekje voorop zijn verder kale hoofd?', a: 'Ronaldo (R9)', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false }
  ],
  algemeen: [
    { cat: 'algemeen', type: 'tekst', media: '', q: 'Welke club won de Champions League drie keer op rij tussen 2016 en 2018?', a: 'Real Madrid', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false }
  ],
  paspoort: [
    { cat: 'paspoort', type: 'tekst', media: '', q: 'Spelerspaspoort: FC Groningen -> PSV -> Chelsea -> Real Madrid -> Bayern München. Wie ben ik?', a: 'Arjen Robben', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false }
  ],
  transfers: [
    { cat: 'transfers', type: 'tekst', media: '', q: 'Voor welk recordbedrag (in miljoenen euro\'s) vertrok Neymar in 2017 van Barcelona naar PSG?', a: '222 miljoen euro', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken', group: false }
  ],
  kopduel: [
    { cat: 'kopduel', type: 'tekst', media: '', q: 'Inschattingsvraag: In welk jaar werd de allereerste gele en rode kaart geïntroduceerd op een WK?', a: '1970', good: 'Winnaar +1 vak', bad: 'Verliezer 3 slokken', group: true },
    { cat: 'kopduel', type: 'tekst', media: '', q: 'Inschattingsvraag: Hoeveel officiële interlands speelde Gheorghe Hagi voor Roemenië?', a: '124 interlands', good: 'Winnaar +1 vak', bad: 'Verliezer 3 slokken', group: true }
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

    const freshPools = { roemenie: [], wk: [], video_audio: [], foto: [], algemeen: [], paspoort: [], transfers: [], kopduel: [] };

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';');
      if (cols.length < 5) continue;
      const cat = cols[0].trim().toLowerCase();
      const type = (cols[1] || 'tekst').trim().toLowerCase();
      const media = (cols[2] || '').trim();
      const q = (cols[3] || '').trim();
      const a = (cols[4] || '').trim();
      const good = (cols[5] || 'Deel 3 slokken uit').trim();
      const bad = (cols[6] || 'Neem 3 slokken').trim();
      const group = (cols[7] || 'NEE').trim().toUpperCase() === 'JA';

      if (freshPools[cat] && q) {
        freshPools[cat].push({ cat, type, media, q, a, good, bad, group });
      }
    }

    Object.keys(freshPools).forEach(k => {
      if (freshPools[k].length > 0) {
        QUESTION_POOLS[k] = freshPools[k];
      }
    });
    BACKUP_POOLS = JSON.parse(JSON.stringify(QUESTION_POOLS));
    const statusEl = document.getElementById('tv-csv-status');
    if (statusEl) statusEl.innerText = `✅ vragen.csv geladen (${lines.length - 1} vragen klaar!)`;
  } catch (err) {
    const statusEl = document.getElementById('tv-csv-status');
    if (statusEl) statusEl.innerText = `ℹ️ Standaard vragen actief (plaats vragen.csv voor eigen vragen)`;
  }
}

/* TREK 1 UNIEKE VRAAG ZONDER HERHALING */
function drawUniqueQuestion(catId) {
  let pool = QUESTION_POOLS[catId];
  if (!pool || pool.length === 0) {
    // Als alle vragen van deze categorie op zijn, hervul eenmalig vanuit backup
    QUESTION_POOLS[catId] = JSON.parse(JSON.stringify(BACKUP_POOLS[catId] || BACKUP_POOLS.algemeen));
    pool = QUESTION_POOLS[catId];
  }
  const idx = Math.floor(Math.random() * pool.length);
  const picked = pool.splice(idx, 1)[0];
  return picked;
}

/* PEERJS VARIABELEN */
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

/* ========================================================
   1. TABLET / TV MODUS
   ======================================================== */
function initTV() {
  myRole = 'tv';
  document.getElementById('view-select').style.display = 'none';
  document.getElementById('tv-view').style.display = 'block';
  document.getElementById('fs-toggle').style.display = 'block';

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
    div.className = `tile ${tile.type} ${catClass}`;
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
  BOARD_TILES.forEach(t => {
    const el = document.getElementById(`tokens-tile-${t.num}`);
    if (el) {
      el.innerHTML = '';
      el.classList.remove('multi');
    }
  });

  PLAYERS.forEach(p => {
    const el = document.getElementById(`tokens-tile-${p.pos}`);
    if (el) {
      const tok = document.createElement('div');
      tok.className = 'p-token';
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
  const sorted = [...PLAYERS].sort((a, b) => b.pos - a.pos);
  const activePlayerId = turnOrder[currentTurnIndex];

  document.getElementById('tv-leaderboard').innerHTML = sorted.map((p, idx) => {
    const dist = 63 - p.pos;
    const isActive = p.id === activePlayerId;
    const skipBadge = p.skipTurns > 0 ? ` • 🩼 ${p.skipTurns}x` : '';
    const yellowBadge = p.yellowCards > 0 ? ` • 🟨` : '';
    return `
      <div class="lb-card ${isActive ? 'active-turn' : ''}" style="border-color: ${p.color};">
        <img src="${p.selfie}" class="lb-avatar" style="border-color: ${p.color};">
        <div class="lb-info">
          <div class="lb-top">
            <span style="color: ${p.color};">${idx + 1}. ${p.name}</span>
          </div>
          <div class="lb-sub">Vak ${p.pos} (${dist === 0 ? '🏆 DOEL' : 'Nog ' + dist})${skipBadge}${yellowBadge}</div>
        </div>
      </div>
    `;
  }).join('');
}

/* ========================================================
   2. SPELER REGISTRATIE & SELFIE
   ======================================================== */
async function showPlayerSetup() {
  document.getElementById('view-select').style.display = 'none';
  document.getElementById('player-setup-view').style.display = 'flex';

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 250, height: 250 },
      audio: false
    });
    document.getElementById('camera-stream').srcObject = cameraStream;
  } catch (err) {
    console.warn("Camera fallback actief");
  }
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
      clientConn.send({
        type: 'PLAYER_JOIN',
        playerId: myPlayerId,
        name: name,
        selfie: mySelfieData
      });
    });
    clientConn.on('data', handlePlayerIncomingData);
  });
}

/* ========================================================
   3. SCHEIDSRECHTER LOGIN
   ======================================================== */
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

/* ========================================================
   TV DATA AFHANDELING & SPELVERLOOP
   ======================================================== */
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
      drunkVarLeft: true
    });
    renderLobbyTV();
    renderTokens();
    updateTVLeaderboard();
    broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted });
  }
  else if (data.type === 'REF_JOIN') {
    broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted });
  }
  else if (data.type === 'REF_KICK_PLAYER') {
    PLAYERS = PLAYERS.filter(p => p.id !== data.playerId);
    turnOrder = turnOrder.filter(id => id !== data.playerId);
    renderLobbyTV();
    renderTokens();
    updateTVLeaderboard();
    broadcastToAll({ type: 'PLAYER_KICKED', playerId: data.playerId, players: PLAYERS, gameStarted });
  }
  else if (data.type === 'REF_START_GAME') {
    if (PLAYERS.length === 0) return;
    gameStarted = true;
    document.getElementById('tv-lobby-overlay').style.display = 'none';
    document.getElementById('tv-roll-order-overlay').style.display = 'flex';
    renderTVRollOrder();
    broadcastToAll({ type: 'START_WIEGELOOT', players: PLAYERS });
  }
  else if (data.type === 'PLAYER_WIEGELOOT_ROLL') {
    const p = PLAYERS.find(x => x.id === data.playerId);
    if (p) {
      p.orderRoll = data.roll;
      renderTVRollOrder();
      const allRolled = PLAYERS.length > 0 && PLAYERS.every(x => x.orderRoll > 0);
      if (allRolled) {
        turnOrder = [...PLAYERS].sort((a, b) => b.orderRoll - a.orderRoll).map(x => x.id);
        const winner = PLAYERS.find(x => x.id === turnOrder[0]);
        document.getElementById('tv-roll-order-sub').innerText = `${winner.name} heeft het hoogste gegooid en mag beginnen!`;
      }
      broadcastToAll({ type: 'WIEGELOOT_UPDATE', players: PLAYERS, allRolled, turnOrder });
    }
  }
  else if (data.type === 'REF_SHOW_BOARD') {
    hideAllTVOverlays();
    updateTVLeaderboard();
    sendBoardWaitState();
  }
  else if (data.type === 'REF_CONFIRM_SKIP') {
    const p = PLAYERS.find(x => x.id === turnOrder[currentTurnIndex]);
    if (p && p.skipTurns > 0) {
      p.skipTurns--;
      showSipAlert(`⏭️ ${p.name} slaat deze beurt over! (Nog ${p.skipTurns} over)`);
    }
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    updateTVLeaderboard();
    sendBoardWaitState();
  }
  else if (data.type === 'REF_ALLOW_ROLL') {
    startTurnOnTV();
  }
  else if (data.type === 'PLAYER_DICE_ROLL') {
    document.getElementById('tv-dice-status').innerText = 'De dobbelsteen rolt...';
    animateDiceCube('tv-dice-cube', data.roll, 1, () => {
      document.getElementById('tv-dice-status').innerText = `Gegooid: ${data.roll}! Klik op 'Zet Stappen'...`;
    });
  }
  else if (data.type === 'PLAYER_EXECUTE_STEPS') {
    executePlayerStepsWithBounce(data.playerId, data.steps);
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
    document.getElementById('tv-q-status').innerText = `${p ? p.name : 'Speler'} heeft een antwoord ingediend!`;
    broadcastToAll({ type: 'REF_RECEIVE_ANSWERS', answers: receivedAnswers, activeKopduel });
  }
  else if (data.type === 'REF_SHOW_RESULT') {
    displayRegularResultsOnTV(data.verdicts);
  }
  else if (data.type === 'PLAYER_USE_DRUNK_VAR') {
    const p = PLAYERS.find(x => x.id === data.playerId);
    if (p && p.drunkVarLeft && roundVerdicts[p.id]) {
      p.drunkVarLeft = false;
      roundVerdicts[p.id].correct = true;
      showSipAlert(`🍺 DRONKEN VAR INGEZET DOOR ${p.name.toUpperCase()}! Antwoord telt nu als GOED -> Deel 3 slokken uit!`);
      displayRegularResultsOnTV(roundVerdicts);
      broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted });
    }
  }
  else if (data.type === 'REF_KOPDUEL_VERDICT') {
    handleKopduelVerdictOnTV(data);
  }
  else if (data.type === 'REF_ADVANCE_TURN_TO_BOARD') {
    hideAllTVOverlays();
    stopTVMedia();
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    updateTVLeaderboard();
    sendBoardWaitState();
  }
  else if (data.type === 'REF_GIVE_CARD') {
    applyCardPenaltyOnTV(data.playerId, data.cardType);
  }
}

function hideAllTVOverlays() {
  ['tv-lobby-overlay', 'tv-roll-order-overlay', 'tv-dice-overlay', 'tv-special-overlay', 'tv-question-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
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
  grid.innerHTML = PLAYERS.map(p => `
    <div class="lobby-player-card" style="border-color: ${p.color};">
      <img src="${p.selfie}" style="border-color: ${p.color};">
      <h3 style="color:${p.color};">${p.name}</h3>
      <div style="font-size: 2.3rem; font-weight: 900; color: var(--gold);">
        ${p.orderRoll > 0 ? p.orderRoll : '🎲'}
      </div>
      <div style="font-size: 0.75rem; opacity: 0.7;">
        ${p.orderRoll > 0 ? 'Gegooid!' : 'Aan het gooien...'}
      </div>
    </div>
  `).join('');
}

function startTurnOnTV() {
  if (turnOrder.length === 0) return;
  const activePlayer = PLAYERS.find(p => p.id === turnOrder[currentTurnIndex]);
  if (!activePlayer) return;

  updateTVLeaderboard();

  document.getElementById('tv-dice-overlay').style.display = 'flex';
  document.getElementById('tv-dice-player-avatar').innerHTML = `<img src="${activePlayer.selfie}">`;
  document.getElementById('tv-dice-player-avatar').style.borderColor = activePlayer.color;
  document.getElementById('tv-dice-turn-player').innerText = `${activePlayer.name} mag gooien!`;
  document.getElementById('tv-dice-turn-player').style.color = activePlayer.color;
  document.getElementById('tv-dice-status').innerText = 'Wachten op worp vanaf telefoon...';

  const cube = document.getElementById('tv-dice-cube');
  cube.style.transition = 'none';
  cube.style.transform = 'rotateX(-15deg) rotateY(20deg)';

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

/* STAP VOOR STAP LOPEN + EXACT UITGOOIEN OP 63 (TERUGLOPEN + SLOKKEN PER STAP TE VEEL) */
function executePlayerStepsWithBounce(playerId, steps) {
  document.getElementById('tv-dice-overlay').style.display = 'none';
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) return;

  let remaining = steps;
  let direction = 1;
  let overshootSteps = 0;

  const stepInterval = setInterval(() => {
    if (remaining <= 0) {
      clearInterval(stepInterval);
      broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted });

      if (overshootSteps > 0) {
        const msg = `⚠️ TE VER GEGOOID! ${player.name} loopt ${overshootSteps} stap(pen) terug en drinkt ${overshootSteps} slok(ken)! 🍺`;
        showSipAlert(msg);
        broadcastToAll({ type: 'SIP_ALERT', msg });
      }

      setTimeout(() => {
        evaluateTileArrival(player);
      }, 1200);
      return;
    }

    if (player.pos === 63 && direction === 1) {
      direction = -1;
    }

    player.pos += direction;
    if (direction === -1) overshootSteps++;
    remaining--;

    renderTokens();
    updateTVLeaderboard();
    playAudioBeep(direction === 1 ? 420 : 280, 0.09);
  }, 850);
}

function evaluateTileArrival(player) {
  if (player.pos === 63) {
    confetti({ particleCount: 250, spread: 100, origin: { y: 0.6 } });
    showSipAlert(`🏆 KAMPIOEN! ${player.name} staat in het Doel & de Kantine!`);
    return;
  }

  // 1. CHECK OP KOPDUEL (ALS ER AL EEN ANDERE SPELER OP DIT VAKJE STAAT)
  const others = PLAYERS.filter(p => p.id !== player.id && p.pos === player.pos);
  if (others.length > 0) {
    startKopduelOnTV(player, others[0]);
    return;
  }

  // 2. CHECK OP SPECIAAL VAKJE
  const tileObj = BOARD_TILES[player.pos - 1];
  if (tileObj.type === 'special') {
    showSpecialTileOnTV(player, tileObj);
    return;
  }

  // 3. REGULIERE VRAAG VOORBEREIDEN
  prepareCategoryPreviewOnTV(player, tileObj);
}

function showSpecialTileOnTV(player, tileObj) {
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
  const player = PLAYERS.find(p => p.id === data.playerId);
  if (!player) return;

  const tile = BOARD_TILES[player.pos - 1];

  if (data.choice === 'KATER_SKIP') {
    player.skipTurns += 1;
    showSipAlert(`😴 ${player.name} kiest voor bankzitten (1 beurt overslaan)!`);
  } else if (data.choice === 'KATER_DRINK') {
    showSipAlert(`🍺 ${player.name} adt 4 slokken tegen de kater en blijft in het veld!`);
  } else if (tile.action === 'JUMP') {
    player.pos = tile.target;
    renderTokens();
    showSipAlert(`🚀 ${player.name} verplaatst naar Vak ${tile.target}!`);
  } else if (tile.action === 'MOVE_REL') {
    player.pos = Math.min(63, player.pos + tile.offset);
    renderTokens();
    showSipAlert(`💵 Scheids drinkt 2 slokken! ${player.name} schuift door naar Vak ${player.pos}!`);
  } else if (tile.action === 'SKIP') {
    player.skipTurns += tile.turns;
    showSipAlert(`🩼 ${player.name} moet ${tile.turns} beurt(en) overslaan!`);
  } else if (tile.action === 'SWAP_BEHIND') {
    const behind = PLAYERS.filter(p => p.id !== player.id && p.pos < player.pos).sort((a, b) => b.pos - a.pos);
    if (behind.length > 0) {
      const targetP = behind[0];
      const tempPos = player.pos;
      player.pos = targetP.pos;
      targetP.pos = tempPos;
      renderTokens();
      showSipAlert(`🔄 WISSEL! ${player.name} ruilt van plek met ${targetP.name} (die 2 slokken drinkt)!`);
    } else {
      showSipAlert(`🔄 Er staat niemand achter ${player.name}! Geen wissel mogelijk.`);
    }
  }

  // Na een speciaal vakje gaat de beurt naar de volgende speler op het bord
  currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
  updateTVLeaderboard();
  sendBoardWaitState();
}

/* KOPDUEL OPZETTEN */
function startKopduelOnTV(p1, p2) {
  activeKopduel = { p1Id: p1.id, p2Id: p2.id, p1Name: p1.name, p2Name: p2.name };
  currentQ = drawUniqueQuestion('kopduel');
  receivedAnswers = {};
  roundVerdicts = {};

  showSipAlert(`💥 KOPDUEL OP VAK ${p1.pos}: ${p1.name} vs ${p2.name}!`);

  document.getElementById('tv-question-overlay').style.display = 'flex';
  document.getElementById('tv-q-cat').innerText = `💥 KOPDUEL: ${p1.name} vs ${p2.name}`;
  document.getElementById('tv-stake-good').innerText = `🏆 Winnaar: 1 vakje vooruit`;
  document.getElementById('tv-stake-bad').innerText = `🍺 Verliezer: 3 slokken (Gelijk = Scheids Atje!)`;
  document.getElementById('tv-q-text').style.display = 'none';
  document.getElementById('tv-media-box').style.display = 'none';
  document.getElementById('tv-result-box').style.display = 'none';
  document.getElementById('tv-q-status').innerText = `Kopduel! Wachten tot de Scheidsrechter de inschattingsvraag toont...`;

  broadcastToAll({
    type: 'PLAYER_LANDED_PREVIEW',
    playerId: p1.id,
    playerName: `${p1.name} & ${p2.name}`,
    tileNum: p1.pos,
    categoryName: '💥 KOPDUEL',
    question: currentQ,
    isKopduel: true,
    activeKopduel
  });
}

function handleKopduelVerdictOnTV(data) {
  if (data.outcome === 'TIE') {
    // Gelijkspel! Scheidsrechter moet een atje doen en er komt direct een nieuwe kopduel-vraag!
    const msg = `🍻 GELIJKSPEL IN HET KOPDUEL! De Scheidsrechter moet een ATJE trekken! Nieuwe vraag komt eraan...`;
    showSipAlert(msg);
    broadcastToAll({ type: 'SIP_ALERT', msg });

    const p1 = PLAYERS.find(x => x.id === activeKopduel.p1Id);
    const p2 = PLAYERS.find(x => x.id === activeKopduel.p2Id);
    setTimeout(() => {
      startKopduelOnTV(p1, p2);
    }, 2800);
    return;
  }

  // Winnaar bekend! Toon beide antwoorden + winnaar op het TV scherm
  const winner = PLAYERS.find(x => x.id === data.winnerId);
  const loserId = data.winnerId === activeKopduel.p1Id ? activeKopduel.p2Id : activeKopduel.p1Id;
  const loser = PLAYERS.find(x => x.id === loserId);

  const resBox = document.getElementById('tv-result-box');
  resBox.style.display = 'flex';
  resBox.innerHTML = [activeKopduel.p1Id, activeKopduel.p2Id].map(pid => {
    const p = PLAYERS.find(x => x.id === pid);
    const isWin = pid === data.winnerId;
    const border = isWin ? '#10b981' : '#ef4444';
    const bg = isWin ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
    return `
      <div style="background: ${bg}; border: 3px solid ${border}; padding: 12px 18px; border-radius: 14px;">
        <div style="font-size: 0.95rem;"><strong>${p.name}</strong> gokte: <span style="font-size:1.3rem; font-weight:900;">"${receivedAnswers[pid] || '-'}"</span></div>
        <div style="font-weight:900; color:${border}; margin-top:4px;">
          ${isWin ? '🏆 WINNAAR (+1 vakje vooruit!)' : '❌ VERLIEZER (Neem 3 slokken!)'}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('tv-q-status').innerText = `Juiste antwoord: ${currentQ.a}`;

  // Verplaats winnaar 1 vakje vooruit
  if (winner && winner.pos < 63) {
    winner.pos += 1;
    renderTokens();
    updateTVLeaderboard();
  }

  // Laat telefoons van de twee duellisten groen/rood kleuren
  const kdVerdicts = {};
  kdVerdicts[data.winnerId] = { ans: receivedAnswers[data.winnerId], correct: true };
  kdVerdicts[loserId] = { ans: receivedAnswers[loserId], correct: false };

  broadcastToAll({
    type: 'SHOW_PLAYER_RESULT',
    verdicts: kdVerdicts,
    goodText: 'Je wint het Kopduel en gaat 1 vakje vooruit!',
    badText: 'Kopduel verloren: Neem 3 slokken!',
    isKopduel: true
  });

  activeKopduel = null;
}

/* REGULIERE VRAAG VOORBEREIDEN */
function prepareCategoryPreviewOnTV(player, tileObj) {
  activeKopduel = null;
  currentQ = drawUniqueQuestion(tileObj.cat);
  receivedAnswers = {};
  roundVerdicts = {};

  document.getElementById('tv-question-overlay').style.display = 'flex';
  document.getElementById('tv-q-cat').innerText = `${tileObj.catName} (Vak ${player.pos})${currentQ.group ? ' • 👥 GROEPSVRAAG' : ''}`;
  document.getElementById('tv-stake-good').innerText = `✅ Goed: ${currentQ.good}`;
  document.getElementById('tv-stake-bad').innerText = `❌ Fout: ${currentQ.bad}`;
  document.getElementById('tv-q-text').style.display = 'none';
  document.getElementById('tv-media-box').style.display = 'none';
  document.getElementById('tv-result-box').style.display = 'none';
  document.getElementById('tv-q-status').innerText = `${player.name} staat klaar op Vak ${player.pos}. Wachten op 'Show Vraag'...`;

  broadcastToAll({
    type: 'PLAYER_LANDED_PREVIEW',
    playerId: player.id,
    playerName: player.name,
    tileNum: player.pos,
    categoryName: tileObj.catName,
    question: currentQ,
    isKopduel: false
  });
}

function revealQuestionOnTV() {
  document.getElementById('tv-q-text').style.display = 'block';
  document.getElementById('tv-q-text').innerText = currentQ.q;

  // Toon foto, audio of video als dat in de CSV staat
  const mediaBox = document.getElementById('tv-media-box');
  mediaBox.innerHTML = '';
  if (currentQ.media && currentQ.type !== 'tekst') {
    mediaBox.style.display = 'flex';
    if (currentQ.type === 'foto') {
      mediaBox.innerHTML = `<img src="${currentQ.media}" alt="Vraag Foto">`;
    } else if (currentQ.type === 'audio') {
      mediaBox.innerHTML = `<audio src="${currentQ.media}" controls autoplay></audio>`;
    } else if (currentQ.type === 'video') {
      mediaBox.innerHTML = `<video src="${currentQ.media}" controls autoplay></video>`;
    }
  } else {
    mediaBox.style.display = 'none';
  }

  const activePlayer = PLAYERS.find(p => p.id === turnOrder[currentTurnIndex]);
  document.getElementById('tv-q-status').innerText = activeKopduel
    ? `${activeKopduel.p1Name} & ${activeKopduel.p2Name} vullen nu hun inschatting in...`
    : (currentQ.group ? 'Groepsvraag! Iedereen typt nu een antwoord op zijn telefoon!' : `${activePlayer.name} denkt na en typt een antwoord...`);

  broadcastToAll({
    type: 'QUESTION_REVEALED',
    question: currentQ,
    activePlayerId: activePlayer.id,
    activeKopduel
  });
}

function stopTVMedia() {
  const mediaBox = document.getElementById('tv-media-box');
  if (mediaBox) mediaBox.innerHTML = '';
}

function displayRegularResultsOnTV(verdicts) {
  const resBox = document.getElementById('tv-result-box');
  resBox.style.display = 'flex';
  resBox.innerHTML = Object.keys(verdicts).map(pId => {
    const p = PLAYERS.find(x => x.id === pId);
    const v = verdicts[pId];
    if (!p) return '';
    const bg = v.correct ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
    const border = v.correct ? '#10b981' : '#ef4444';
    const label = v.correct ? `✅ GOED! (${currentQ.good})` : `❌ FOUT! (${currentQ.bad})`;
    return `
      <div style="background: ${bg}; border: 3px solid ${border}; padding: 12px 18px; border-radius: 14px;">
        <div style="font-size: 0.95rem; opacity: 0.9;">Antwoord van <strong>${p.name}</strong>: "${v.ans}"</div>
        <div style="font-size: 1.15rem; font-weight: 900; color: ${border}; margin-top: 4px;">${label}</div>
      </div>
    `;
  }).join('');
  document.getElementById('tv-q-status').innerText = `Juiste antwoord: ${currentQ.a}`;

  broadcastToAll({
    type: 'SHOW_PLAYER_RESULT',
    verdicts: verdicts,
    goodText: currentQ.good,
    badText: currentQ.bad,
    isKopduel: false
  });
}

function applyCardPenaltyOnTV(playerId, cardType) {
  const p = PLAYERS.find(x => x.id === playerId);
  if (!p) return;

  let msg = '';
  if (cardType === 'geel') {
    p.yellowCards += 1;
    if (p.yellowCards >= 2) {
      p.yellowCards = 0;
      p.skipTurns += 1;
      msg = `🟨🟥 TWEEDE GEEL = ROOD voor ${p.name}! 1 beurt overslaan + ATJE TREKKEN! 🍺`;
    } else {
      msg = `🟨 GELE KAART voor ${p.name} wegens spelbederf! Neem direct 5 slokken! 🍺`;
    }
  } else {
    p.skipTurns += 2;
    msg = `🟥 DIRECTE RODE KAART voor ${p.name}! 2 wedstrijden (beurten) geschorst + ATJE TREKKEN! 🍺`;
  }

  updateTVLeaderboard();
  showSipAlert(msg);
  broadcastToAll({ type: 'SIP_ALERT', msg });
  broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted });
}

/* ========================================================
   MOBIEL: SPELER FUNCTIES
   ======================================================== */
let myDrunkVarAvailable = true;

function resetMobileBackground() {
  const mv = document.getElementById('mobile-view');
  if (mv) mv.style.backgroundColor = 'transparent';
}

function hideAllMobileCards() {
  ['m-lobby-card', 'm-roll-order-card', 'm-turn-card', 'm-wait-turn-card', 'm-answer-card', 'm-result-card'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function handlePlayerIncomingData(data) {
  if (data.type === 'PLAYER_KICKED' && data.playerId === myPlayerId) {
    alert("Je bent door de scheidsrechter verwijderd.");
    location.reload();
    return;
  }

  if (data.type === 'SYNC_PLAYERS') {
    const me = data.players.find(x => x.id === myPlayerId);
    if (me) {
      myDrunkVarAvailable = me.drunkVarLeft;
      document.getElementById('m-player-name').style.color = me.color;
      document.getElementById('m-header-avatar').style.borderColor = me.color;
      if (data.gameStarted) {
        document.getElementById('m-tile-info').style.display = 'block';
        document.getElementById('m-tile-info').innerText = `Vak ${me.pos} (Nog ${63 - me.pos})`;
        const varBadge = document.getElementById('m-var-badge');
        varBadge.style.display = 'block';
        varBadge.innerText = me.drunkVarLeft ? '🍺 VAR: 1x' : '🍺 VAR: Gebruikt';
        varBadge.style.opacity = me.drunkVarLeft ? '1' : '0.4';
      }
    }
  }
  else if (data.type === 'START_WIEGELOOT') {
    resetMobileBackground();
    hideAllMobileCards();
    document.getElementById('m-tile-info').style.display = 'block';
    document.getElementById('m-var-badge').style.display = 'block';
    document.getElementById('m-roll-order-card').style.display = 'flex';
  }
  else if (data.type === 'BOARD_ACTIVE_WAIT') {
    resetMobileBackground();
    hideAllMobileCards();
    const me = data.players.find(x => x.id === myPlayerId);
    if (me) {
      myDrunkVarAvailable = me.drunkVarLeft;
      document.getElementById('m-tile-info').innerText = `Vak ${me.pos} (Nog ${63 - me.pos})`;
    }
    document.getElementById('m-wait-turn-card').style.display = 'flex';
    document.getElementById('m-wait-turn-text').innerText = 'Spelbord Actief';
    document.getElementById('m-wait-turn-sub').innerText = `Volgende aan de beurt: ${data.nextPlayerName}`;
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
  else if (data.type === 'SPECIAL_TILE_TRIGGERED') {
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
    document.getElementById('m-wait-turn-text').innerText = `${data.categoryName}`;
    document.getElementById('m-wait-turn-sub').innerText = 'Wachten tot de scheidsrechter de vraag toont...';
  }
  else if (data.type === 'QUESTION_REVEALED') {
    resetMobileBackground();
    hideAllMobileCards();

    let shouldAnswer = false;
    if (data.activeKopduel) {
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
      document.getElementById('m-result-sub').innerText = myVerdict.correct ? data.goodText : data.badText;

      // Toon Dronken VAR knop ALLEEN als antwoord fout is, het GEEN kopduel is, en speler zijn VAR nog heeft
      const varBtn = document.getElementById('m-btn-drunk-var');
      if (!myVerdict.correct && !data.isKopduel && myDrunkVarAvailable) {
        varBtn.style.display = 'inline-flex';
      } else {
        varBtn.style.display = 'none';
      }
    }
  }
  else if (data.type === 'SIP_ALERT') {
    showSipAlert(data.msg);
  }
}

function playerUseDrunkVar() {
  myDrunkVarAvailable = false;
  document.getElementById('m-btn-drunk-var').style.display = 'none';
  clientConn.send({ type: 'PLAYER_USE_DRUNK_VAR', playerId: myPlayerId });
}

function playerRollOrder() {
  const roll = Math.floor(Math.random() * 6) + 1;
  document.getElementById('m-btn-roll-order').style.display = 'none';

  animateDiceCube('m-order-dice', roll, 0.72, () => {
    document.getElementById('m-roll-order-result').innerText = `Gegooid: ${roll}! Wachten op scheids...`;
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
  document.getElementById('m-ans-status').innerText = '✅ Antwoord verstuurd! Wachten op Scheids...';
  clientConn.send({ type: 'PLAYER_SUBMIT_ANSWER', playerId: myPlayerId, ans: ans });
}

/* ========================================================
   SCHEIDSRECHTER FUNCTIES
   ======================================================== */
function hideAllRefCards() {
  ['ref-lobby-card', 'ref-wiegeloot-card', 'ref-board-card', 'ref-special-card', 'ref-pre-question-card', 'ref-judge-card', 'ref-kopduel-card', 'ref-penalty-modal'].forEach(id => {
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
        <button class="btn btn-red" style="padding: 5px 10px; font-size: 0.72rem;" onclick="refKickPlayer('${p.id}', '${p.name}')">
          Kick ❌
        </button>
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
    document.getElementById('ref-answers-list').innerHTML = '<div style="opacity:0.6; font-size:0.85rem;">Wachten op antwoord...</div>';
  }
  clientConn.send({ type: 'REF_SHOW_QUESTION' });
}

function handleRefIncomingData(data) {
  if (data.type === 'SYNC_PLAYERS' || data.type === 'PLAYER_KICKED') {
    PLAYERS = data.players;
    renderRefPlayerLists();
  }
  else if (data.type === 'WIEGELOOT_UPDATE') {
    PLAYERS = data.players;
    const list = document.getElementById('ref-wiegeloot-list');
    list.innerHTML = PLAYERS.map(p => `
      <div style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.06); padding:8px 12px; border-radius:8px;">
        <span style="font-weight:700; color:${p.color};">${p.name}</span>
        <span style="font-weight:900; color:var(--gold);">${p.orderRoll > 0 ? '🎲 ' + p.orderRoll : '⏳...'}</span>
      </div>
    `).join('');

    if (data.allRolled) {
      document.getElementById('ref-wiegeloot-status').innerText = 'Iedereen heeft gegooid!';
      document.getElementById('ref-btn-to-board-initial').style.display = 'inline-flex';
    }
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
        <button class="btn btn-green" onclick="refResolveSpecial('${data.playerId}', 'DEFAULT')">✅ Uitvoeren & Naar Bord</button>
      `;
    }
  }
  else if (data.type === 'PLAYER_LANDED_PREVIEW') {
    hideAllRefCards();
    activeKopduel = data.isKopduel ? data.activeKopduel : null;
    currentQ = data.question;

    document.getElementById('ref-pre-question-card').style.display = 'flex';
    document.getElementById('ref-pre-cat').innerText = `${data.categoryName} (Vak ${data.tileNum})`;
    document.getElementById('ref-pre-title').innerText = `${data.playerName} staat klaar!`;
    document.getElementById('ref-preview-q').innerText = data.question.q;
    document.getElementById('ref-preview-a').innerText = data.question.a;

    document.getElementById('ref-q-text').innerText = data.question.q;
    document.getElementById('ref-q-secret-ans').innerText = data.question.a;
    roundVerdicts = {};
  }
  else if (data.type === 'REF_RECEIVE_ANSWERS') {
    receivedAnswers = data.answers;
    if (data.activeKopduel) {
      renderRefKopduelAnswers(data.answers, data.activeKopduel);
    } else {
      renderRefAnswers(data.answers);
    }
  }
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

  // Zodra beide duellisten geantwoord hebben, kan de scheidsrechter kiezen wie gewonnen heeft
  if (answers[kd.p1Id] && answers[kd.p2Id]) {
    document.getElementById('ref-kd-actions').innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
        <button class="btn btn-green" style="padding:10px; font-size:0.8rem;" onclick="refPickKopduelWinner('${kd.p1Id}')">🏆 ${kd.p1Name} Wint</button>
        <button class="btn btn-green" style="padding:10px; font-size:0.8rem;" onclick="refPickKopduelWinner('${kd.p2Id}')">🏆 ${kd.p2Name} Wint</button>
      </div>
      <button class="btn btn-red" style="padding:10px; font-size:0.8rem;" onclick="refPickKopduelTie()">🍻 Gelijkspel (Scheids Atje + Nieuwe Vraag)</button>
    `;
  }
}

function refPickKopduelWinner(winnerId) {
  document.getElementById('ref-kd-actions').innerHTML = '';
  document.getElementById('ref-kd-to-board').style.display = 'inline-flex';
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
          <button class="btn btn-green" style="padding: 6px; font-size: 0.78rem; flex:1;" onclick="refMarkAnswer('${pId}', true)">
            ✅ Goed
          </button>
          <button class="btn btn-red" style="padding: 6px; font-size: 0.78rem; flex:1;" onclick="refMarkAnswer('${pId}', false)">
            ❌ Fout
          </button>
        </div>
      </div>
    `;
  }).join('');
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

/* ========================================================
   ALGEMENE HULPFUNCTIES
   ======================================================== */
function showSipAlert(msg) {
  const banner = document.getElementById('sip-alert');
  banner.innerText = msg;
  banner.style.display = 'block';
  setTimeout(() => { banner.style.display = 'none'; }, 4500);
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