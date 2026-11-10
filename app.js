/* KLEUREN VOOR DEELNEMERS */
const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#ec4899', '#06b6d4', '#f97316'];
let PLAYERS = [];
let gameStarted = false;

let turnOrder = [];
let currentTurnIndex = 0;
let pendingRoll = 0;
let currentQ = null;
let receivedAnswers = {};

/* 3D DOBBELSTEEN ROTATIES VOOR ELK OOG (1 t/m 6) */
const DICE_ROTATIONS = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  2: { x: 0, y: 90 },
  5: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 }
};

/* SPEELVELD OPBOUW (45 VAKJES) */
const BOARD_TILES = [];
const CATEGORIES = [
  { id: 'roemenie', name: '🇷🇴 Roemeens Voetbal', icon: '🇷🇴' },
  { id: 'wk', name: '🌍 Het WK', icon: '🌍' },
  { id: 'audio', name: '🔊 Beeld & Geluid', icon: '🔊' },
  { id: 'algemeen', name: '⚽ Algemene Kennis', icon: '⚽' },
  { id: 'kelder', name: '🍺 Kelderklasse', icon: '🍺' },
  { id: 'var', name: '⚖️ VAR & Scheids', icon: '⚖️' }
];

for (let i = 1; i <= 45; i++) {
  let type = 'normal';
  let icon = '⚽';
  let name = 'Vak ' + i;
  let cat = CATEGORIES[i % CATEGORIES.length].id;

  if (i === 1) { type = 'start'; icon = '🚪'; name = 'Kleedkamer'; }
  else if (i === 10) { type = 'special'; icon = '☕'; name = 'De Rust'; }
  else if (i === 20) { type = 'special'; icon = '🚑'; name = 'De Put (Kruisband)'; }
  else if (i === 30) { type = 'special'; icon = '🟥'; name = 'Schorsing (Bajes)'; }
  else if (i === 40) { type = 'special'; icon = '💀'; name = 'VAR Buitenspel'; }
  else if (i === 45) { type = 'finish'; icon = '🏆'; name = 'De Kantine'; }
  else {
    icon = CATEGORIES[i % CATEGORIES.length].icon;
    name = CATEGORIES[i % CATEGORIES.length].name.split(' ')[1];
  }
  BOARD_TILES.push({ num: i, type, icon, name, cat });
}

/* VRAGENLIJST */
const QUESTIONS = [
  { cat: 'roemenie', q: 'Welke Roemeense club won in 1986 de Europacup 1 door FC Barcelona na penalty\'s te verslaan?', a: 'Steaua Boekarest', group: true },
  { cat: 'roemenie', q: 'Welke Roemeense legende stond bekend als "De Maradona van de Karpaten"?', a: 'Gheorghe Hagi', group: false },
  { cat: 'wk', q: 'In welk land werd het allereerste WK voetbal in 1930 gespeeld?', a: 'Uruguay', group: true },
  { cat: 'wk', q: 'Wie maakte in de WK-finale van 2014 in de verlenging de winnende goal voor Duitsland?', a: 'Mario Götze', group: false },
  { cat: 'audio', q: 'Maak het legendarische commentaar van Jack van Gelder in 1998 af: "DENNIS BERGKAMP! DENNIS BERGKAMP! ..."', a: 'BERRRGKAMP!', group: true },
  { cat: 'algemeen', q: 'Welke club won de Champions League drie keer op rij tussen 2016 en 2018?', a: 'Real Madrid', group: false },
  { cat: 'kelder', q: 'Wat is de ongeschreven straf als je in de kelderklasse een cornervlag doormidden schiet?', a: 'Kist bier / Rondje voor het team', group: false },
  { cat: 'var', q: 'Mag de scheidsrechter nog een rode kaart geven nadat hij al voor het einde van de wedstrijd heeft gefloten?', a: 'Ja, zolang hij nog op het veld staat', group: false }
];

/* PEERJS CONNECTIE VARIABELEN */
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
  // Volledig scherm knop ALLEEN zichtbaar op TV/Tablet
  document.getElementById('fs-toggle').style.display = 'block';

  buildBoard();
  updateTVLeaderboard();

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

function renderLobbyTV() {
  const container = document.getElementById('tv-lobby-players');
  document.getElementById('tv-lobby-count').innerText = `Verbonden Spelers (${PLAYERS.length})`;
  if (PLAYERS.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; opacity:0.5;">Wachten op de eerste spelers...</div>';
    return;
  }
  container.innerHTML = PLAYERS.map(p => `
    <div class="lobby-player-card" style="border-color: ${p.color};">
      <img src="${p.selfie}" alt="${p.name}" style="border-color: ${p.color};">
      <div style="font-weight: 800; color: ${p.color}; font-size: 1.05rem;">${p.name}</div>
    </div>
  `).join('');
}

/* ========================================================
   2. SPELER REGISTRATIE & SELFIE CAMERA
   ======================================================== */
async function showPlayerSetup() {
  document.getElementById('view-select').style.display = 'none';
  document.getElementById('player-setup-view').style.display = 'flex';

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 300, height: 300 },
      audio: false
    });
    document.getElementById('camera-stream').srcObject = cameraStream;
  } catch (err) {
    console.warn("Camera niet direct beschikbaar, gebruik bestand-knop.");
  }
}

function takeSelfie() {
  const video = document.getElementById('camera-stream');
  const canvas = document.getElementById('selfie-canvas');
  const ctx = canvas.getContext('2d');

  // Teken gespiegeld vierkant op canvas (160x160 voor snelle overdracht)
  canvas.width = 160;
  canvas.height = 160;
  ctx.translate(160, 0);
  ctx.scale(-1, 1);

  const size = Math.min(video.videoWidth || 160, video.videoHeight || 160);
  const sx = ((video.videoWidth || 160) - size) / 2;
  const sy = ((video.videoHeight || 160) - size) / 2;
  ctx.drawImage(video, sx, sy, size, size, 0, 0, 160, 160);

  mySelfieData = canvas.toDataURL('image/jpeg', 0.75);

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
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 160, 160);
      mySelfieData = canvas.toDataURL('image/jpeg', 0.75);

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

  if (!code || code.length !== 4) {
    alert("Vul de 4-cijferige kamercode van de TV in!");
    return;
  }
  if (!name) {
    alert("Vul eerst je naam in!");
    return;
  }
  if (!mySelfieData) {
    alert("Maak eerst een selfie voor op je pion!");
    return;
  }

  // Stop de camera-stream zodat batterij bespaard blijft
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
  }

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
      orderRoll: 0
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
      checkAllRollOrderFinished();
    }
  }
  else if (data.type === 'PLAYER_DICE_ROLL') {
    document.getElementById('tv-dice-status').innerText = 'De dobbelsteen rolt...';
    animateDiceCube('tv-dice-cube', data.roll, 1, () => {
      document.getElementById('tv-dice-status').innerText = `Gegooid: ${data.roll}! Wachten op 'Zet Stappen'...`;
    });
  }
  else if (data.type === 'PLAYER_EXECUTE_STEPS') {
    executePlayerSteps(data.playerId, data.steps);
  }
  else if (data.type === 'PLAYER_SUBMIT_ANSWER') {
    receivedAnswers[data.playerId] = data.ans;
    broadcastToAll({ type: 'REF_RECEIVE_ANSWERS', answers: receivedAnswers });
  }
  else if (data.type === 'REF_SINGLE_VERDICT') {
    showSipAlert(data.msg);
    broadcastToAll({ type: 'SIP_ALERT', msg: data.msg });
  }
  else if (data.type === 'REF_FINISH_ROUND') {
    document.getElementById('tv-question-overlay').style.display = 'none';
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    setTimeout(() => startTurn(), 800);
  }
  else if (data.type === 'REF_CARD_PENALTY') {
    showSipAlert(data.msg);
    broadcastToAll({ type: 'SIP_ALERT', msg: data.msg });
  }
}

function broadcastToAll(msg) {
  connections.forEach(c => {
    if (c.open) c.send(msg);
  });
}

function buildBoard() {
  const grid = document.getElementById('board-grid');
  grid.innerHTML = '';
  BOARD_TILES.forEach(tile => {
    const div = document.createElement('div');
    div.className = `tile ${tile.type}`;
    div.id = `tile-${tile.num}`;
    div.innerHTML = `
      <span class="tile-num">${tile.num}</span>
      <div class="tile-icon">${tile.icon}</div>
      <div class="tile-name">${tile.name}</div>
      <div class="tile-tokens" id="tokens-tile-${tile.num}"></div>
    `;
    grid.appendChild(div);
  });
  renderTokens();
}

function renderTokens() {
  BOARD_TILES.forEach(t => {
    const el = document.getElementById(`tokens-tile-${t.num}`);
    if (el) el.innerHTML = '';
  });

  PLAYERS.forEach(p => {
    const el = document.getElementById(`tokens-tile-${p.pos}`);
    if (el) {
      const tok = document.createElement('div');
      tok.className = 'p-token';
      tok.style.borderColor = p.color;
      tok.innerHTML = `<img src="${p.selfie}" alt="${p.name}">`;
      el.appendChild(tok);
    }
  });
}

function updateTVLeaderboard() {
  const sorted = [...PLAYERS].sort((a, b) => b.pos - a.pos);
  const activePlayerId = turnOrder[currentTurnIndex];

  document.getElementById('tv-leaderboard').innerHTML = sorted.map((p, idx) => {
    const dist = 45 - p.pos;
    const isActive = p.id === activePlayerId;
    return `
      <div class="lb-card ${isActive ? 'active-turn' : ''}" style="border-color: ${p.color};">
        <img src="${p.selfie}" class="lb-avatar" style="border-color: ${p.color};">
        <div class="lb-info">
          <div class="lb-top">
            <span style="color: ${p.color};">${idx + 1}. ${p.name}</span>
          </div>
          <div class="lb-sub">Vak ${p.pos} • ${dist === 0 ? '🏆 FINISH' : 'Nog ' + dist + ' vakjes'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderTVRollOrder() {
  const grid = document.getElementById('tv-roll-order-grid');
  grid.innerHTML = PLAYERS.map(p => `
    <div class="lobby-player-card" style="border-color: ${p.color};">
      <img src="${p.selfie}" style="border-color: ${p.color};">
      <h3 style="color:${p.color};">${p.name}</h3>
      <div style="font-size: 2.5rem; font-weight: 900; color: var(--gold);">
        ${p.orderRoll > 0 ? p.orderRoll : '🎲'}
      </div>
      <div style="font-size: 0.8rem; opacity: 0.7;">
        ${p.orderRoll > 0 ? 'Gegooid!' : 'Aan het gooien...'}
      </div>
    </div>
  `).join('');
}

function checkAllRollOrderFinished() {
  if (PLAYERS.length > 0 && PLAYERS.every(p => p.orderRoll > 0)) {
    turnOrder = [...PLAYERS].sort((a, b) => b.orderRoll - a.orderRoll).map(p => p.id);
    setTimeout(() => {
      document.getElementById('tv-roll-order-overlay').style.display = 'none';
      startTurn();
    }, 2200);
  }
}

function startTurn() {
  if (turnOrder.length === 0) return;
  const activePlayer = PLAYERS.find(p => p.id === turnOrder[currentTurnIndex]);
  if (!activePlayer) return;

  updateTVLeaderboard();

  document.getElementById('tv-dice-overlay').style.display = 'flex';
  document.getElementById('tv-dice-player-avatar').innerHTML = `<img src="${activePlayer.selfie}">`;
  document.getElementById('tv-dice-player-avatar').style.borderColor = activePlayer.color;
  document.getElementById('tv-dice-turn-player').innerText = `${activePlayer.name} is aan de beurt!`;
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

/* ========================================================
   ECHTE 3D ROLLENDE DOBBELSTEEN MET OGEN (STAP VOOR STAP)
   ======================================================== */
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

function executePlayerSteps(playerId, steps) {
  document.getElementById('tv-dice-overlay').style.display = 'none';
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) return;

  let remaining = steps;
  const stepInterval = setInterval(() => {
    if (remaining <= 0 || player.pos >= 45) {
      clearInterval(stepInterval);
      broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted });
      checkTileLanded(player);
      return;
    }
    player.pos++;
    remaining--;
    renderTokens();
    updateTVLeaderboard();
    playAudioBeep(440, 0.07);
  }, 380);
}

function checkTileLanded(player) {
  if (player.pos >= 45) {
    player.pos = 45;
    confetti({ particleCount: 220, spread: 90, origin: { y: 0.6 } });
    showSipAlert(`🏆 KAMPIOEN! ${player.name} heeft de Kantine bereikt!`);
    return;
  }

  // KOPDUEL ALS TWEE SPELERS OP DEZELFDE PLEK KOMEN
  const others = PLAYERS.filter(p => p.id !== player.id && p.pos === player.pos);
  if (others.length > 0) {
    const msg = `💥 KOPDUEL op Vak ${player.pos}! ${player.name} & ${others[0].name} nemen 2 slokken!`;
    showSipAlert(msg);
    broadcastToAll({ type: 'SIP_ALERT', msg });
  }

  currentQ = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  receivedAnswers = {};

  document.getElementById('tv-question-overlay').style.display = 'flex';
  document.getElementById('tv-q-cat').innerText = currentQ.cat.toUpperCase();
  document.getElementById('tv-q-text').innerText = currentQ.q;
  document.getElementById('tv-q-status').innerText = currentQ.group
    ? 'Groepsvraag: Iedereen voert antwoord in op zijn telefoon!'
    : `${player.name} voert een antwoord in op zijn telefoon...`;

  broadcastToAll({
    type: 'TRIGGER_QUESTION',
    question: currentQ,
    activePlayerId: player.id
  });
}

/* ========================================================
   MOBIEL: SPELER FUNCTIES
   ======================================================== */
function handlePlayerIncomingData(data) {
  if (data.type === 'PLAYER_KICKED' && data.playerId === myPlayerId) {
    alert("Je bent door de scheidsrechter uit de kleedkamer verwijderd.");
    location.reload();
    return;
  }

  if (data.type === 'SYNC_PLAYERS') {
    const me = data.players.find(x => x.id === myPlayerId);
    if (me) {
      document.getElementById('m-player-name').style.color = me.color;
      document.getElementById('m-header-avatar').style.borderColor = me.color;
      if (data.gameStarted) {
        const tileEl = document.getElementById('m-tile-info');
        tileEl.style.display = 'block';
        tileEl.innerText = `Vak ${me.pos} (Nog ${45 - me.pos} te gaan)`;
      }
    }
  }
  else if (data.type === 'START_WIEGELOOT') {
    document.getElementById('m-tile-info').style.display = 'block';
    document.getElementById('m-lobby-card').style.display = 'none';
    document.getElementById('m-roll-order-card').style.display = 'flex';
  }
  else if (data.type === 'TURN_STARTED') {
    const me = data.players.find(x => x.id === myPlayerId);
    if (me) {
      document.getElementById('m-tile-info').style.display = 'block';
      document.getElementById('m-tile-info').innerText = `Vak ${me.pos} (Nog ${45 - me.pos} te gaan)`;
    }

    const isMyTurn = data.activePlayerId === myPlayerId;
    document.getElementById('m-roll-order-card').style.display = 'none';
    document.getElementById('m-answer-card').style.display = 'none';
    document.getElementById('m-turn-card').style.display = isMyTurn ? 'flex' : 'none';
    document.getElementById('m-wait-turn-card').style.display = isMyTurn ? 'none' : 'flex';
    document.getElementById('m-wait-turn-text').innerText = `${data.activePlayerName} is nu aan het gooien...`;

    document.getElementById('m-btn-roll').style.display = 'inline-flex';
    document.getElementById('m-btn-step').style.display = 'none';
  }
  else if (data.type === 'TRIGGER_QUESTION') {
    const shouldAnswer = data.question.group || data.activePlayerId === myPlayerId;
    document.getElementById('m-turn-card').style.display = 'none';
    document.getElementById('m-wait-turn-card').style.display = shouldAnswer ? 'none' : 'flex';
    document.getElementById('m-answer-card').style.display = shouldAnswer ? 'flex' : 'none';

    if (shouldAnswer) {
      document.getElementById('m-q-cat').innerText = data.question.cat.toUpperCase();
      document.getElementById('m-q-text').innerText = data.question.q;
      document.getElementById('m-input-ans').value = '';
      document.getElementById('m-btn-submit-ans').style.display = 'inline-flex';
      document.getElementById('m-ans-status').innerText = '';
    } else {
      document.getElementById('m-wait-turn-text').innerText = 'Vraag wordt beantwoord...';
    }
  }
  else if (data.type === 'SIP_ALERT') {
    showSipAlert(data.msg);
  }
}

function playerRollOrder() {
  const roll = Math.floor(Math.random() * 6) + 1;
  document.getElementById('m-btn-roll-order').style.display = 'none';

  animateDiceCube('m-order-dice', roll, 0.75, () => {
    document.getElementById('m-roll-order-result').innerText = `Je hebt ${roll} gegooid!`;
    clientConn.send({ type: 'PLAYER_WIEGELOOT_ROLL', playerId: myPlayerId, roll: roll });
  });
}

function playerRollDice() {
  pendingRoll = Math.floor(Math.random() * 6) + 1;
  document.getElementById('m-btn-roll').style.display = 'none';

  clientConn.send({ type: 'PLAYER_DICE_ROLL', playerId: myPlayerId, roll: pendingRoll });

  animateDiceCube('m-turn-dice', pendingRoll, 0.75, () => {
    const stepBtn = document.getElementById('m-btn-step');
    stepBtn.style.display = 'inline-flex';
    stepBtn.innerText = `🏃 Zet ${pendingRoll} Stappen!`;
  });
}

function playerExecuteSteps() {
  document.getElementById('m-turn-card').style.display = 'none';
  document.getElementById('m-wait-turn-card').style.display = 'flex';
  document.getElementById('m-wait-turn-text').innerText = 'Je pion loopt over het veld...';
  clientConn.send({ type: 'PLAYER_EXECUTE_STEPS', playerId: myPlayerId, steps: pendingRoll });
}

function playerSubmitAnswer() {
  const ans = document.getElementById('m-input-ans').value.trim();
  if (!ans) return;
  document.getElementById('m-btn-submit-ans').style.display = 'none';
  document.getElementById('m-ans-status').innerText = '✅ Antwoord verstuurd naar de Scheids!';
  clientConn.send({ type: 'PLAYER_SUBMIT_ANSWER', playerId: myPlayerId, ans: ans });
}

/* ========================================================
   SCHEIDSRECHTER FUNCTIES (INCL. KICK & VERBORGEN KAARTEN)
   ======================================================== */
function renderRefPlayerLists() {
  const lobbyList = document.getElementById('ref-player-list');
  const activeList = document.getElementById('ref-active-player-list');
  document.getElementById('ref-player-count').innerText = `Deelnemers (${PLAYERS.length}):`;

  const html = PLAYERS.length === 0
    ? '<div style="opacity:0.5;">Nog geen spelers aangemeld...</div>'
    : PLAYERS.map(p => `
      <div style="background: rgba(255,255,255,0.06); padding: 8px 12px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${p.color};">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${p.selfie}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover;">
          <span style="font-weight: 800;">${p.name}</span>
        </div>
        <button class="btn btn-red" style="padding: 6px 12px; font-size: 0.75rem;" onclick="refKickPlayer('${p.id}', '${p.name}')">
          Kick ❌
        </button>
      </div>
    `).join('');

  if (lobbyList) lobbyList.innerHTML = html;
  if (activeList) activeList.innerHTML = html;
}

function refKickPlayer(playerId, playerName) {
  if (!confirm(`Weet je zeker dat je ${playerName} wilt verwijderen?`)) return;
  clientConn.send({ type: 'REF_KICK_PLAYER', playerId });
}

function refStartGame() {
  if (PLAYERS.length === 0) {
    alert("Wacht tot er minimaal 1 speler in de kleedkamer zit!");
    return;
  }
  document.getElementById('ref-lobby-card').style.display = 'none';
  document.getElementById('ref-controls-card').style.display = 'flex';
  document.getElementById('ref-status-sub').innerText = 'Wedstrijd Beheer';
  clientConn.send({ type: 'REF_START_GAME' });
}

function handleRefIncomingData(data) {
  if (data.type === 'SYNC_PLAYERS' || data.type === 'PLAYER_KICKED') {
    PLAYERS = data.players;
    renderRefPlayerLists();
  }
  else if (data.type === 'TRIGGER_QUESTION') {
    document.getElementById('ref-judge-card').style.display = 'flex';
    document.getElementById('ref-q-text').innerText = data.question.q;
    document.getElementById('ref-q-secret-ans').innerText = data.question.a;
    document.getElementById('ref-answers-list').innerHTML = '<div style="opacity:0.6;">Wachten tot antwoorden binnenkomen...</div>';
  }
  else if (data.type === 'REF_RECEIVE_ANSWERS') {
    renderRefAnswers(data.answers);
  }
}

function renderRefAnswers(answers) {
  const list = document.getElementById('ref-answers-list');
  list.innerHTML = Object.keys(answers).map(pId => {
    const p = PLAYERS.find(x => x.id === pId);
    if (!p) return '';
    return `
      <div id="verdict-row-${pId}" style="background: rgba(255,255,255,0.08); padding: 12px; border-radius: 10px; border-left: 4px solid ${p.color};">
        <div style="display:flex; align-items:center; gap:8px;">
          <img src="${p.selfie}" style="width:26px; height:26px; border-radius:50%; object-fit:cover;">
          <span style="font-weight: 800;">${p.name}:</span>
        </div>
        <div style="font-size: 1.1rem; color: #fff; margin: 6px 0; font-weight:700;">"${answers[pId]}"</div>
        <div style="display: flex; gap: 8px; margin-top: 6px;">
          <button class="btn btn-green" style="padding: 8px 12px; font-size: 0.8rem; flex:1;" onclick="refVerdict('${pId}', true)">
            ✅ Goed (Deel 2 slokken uit)
          </button>
          <button class="btn btn-red" style="padding: 8px 12px; font-size: 0.8rem; flex:1;" onclick="refVerdict('${pId}', false)">
            ❌ Fout (Neem 2 slokken)
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function refVerdict(pId, isCorrect) {
  const p = PLAYERS.find(x => x.id === pId);
  if (!p) return;

  const msg = isCorrect
    ? `✅ ${p.name} heeft het GOED! Deel 2 slokken uit! 🍺`
    : `❌ ${p.name} heeft het FOUT! Zelf 2 slokken drinken! 🍺`;

  const row = document.getElementById(`verdict-row-${pId}`);
  if (row) row.style.opacity = '0.45';

  clientConn.send({ type: 'REF_SINGLE_VERDICT', msg });
}

function refFinishRound() {
  document.getElementById('ref-judge-card').style.display = 'none';
  clientConn.send({ type: 'REF_FINISH_ROUND' });
}

function refCardPenalty(type) {
  if (PLAYERS.length === 0) return;
  const names = PLAYERS.map(p => p.name).join(', ');
  const pName = prompt(`Aan wie geef je deze kaart? (${names})`);
  const p = PLAYERS.find(x => x.name.toLowerCase() === pName?.trim().toLowerCase());
  if (!p) return;

  const msg = type === 'geel'
    ? `🟨 GELE KAART voor ${p.name}! Neem 2 strafslokken!`
    : `🟥 RODE KAART voor ${p.name}! Trek een ADTJE! 🍺`;

  clientConn.send({ type: 'REF_CARD_PENALTY', msg });
}

/* ========================================================
   ALGEMENE HULPFUNCTIES (GELUID, MELDINGEN & FULLSCREEN)
   ======================================================== */
function showSipAlert(msg) {
  const banner = document.getElementById('sip-alert');
  banner.innerText = msg;
  banner.style.display = 'block';
  setTimeout(() => { banner.style.display = 'none'; }, 4200);
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
