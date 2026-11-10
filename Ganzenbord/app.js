/* KLEUREN VOOR DEELNEMERS */
const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#ec4899', '#06b6d4', '#f97316'];
let PLAYERS = [];
let gameStarted = false;

let turnOrder = [];
let currentTurnIndex = 0;
let pendingRoll = 0;
let currentQ = null;
let receivedAnswers = {};
let roundVerdicts = {}; // { playerId: { ans: '...', correct: true/false } }

/* 3D DOBBELSTEEN ROTATIES */
const DICE_ROTATIONS = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  2: { x: 0, y: 90 },
  5: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 }
};

/* CATEGORIEËN MET STRAF & BELONING */
const CATEGORIES = [
  { id: 'roemenie', name: '🇷🇴 Roemenië & Voetbal', icon: '🇷🇴', good: 'Deel 2 slokken uit', bad: 'Neem 2 slokken' },
  { id: 'wk', name: '🌍 Het WK', icon: '🌍', good: 'Deel 2 slokken uit', bad: 'Neem 2 slokken' },
  { id: 'audio', name: '🔊 Beeld & Geluid', icon: '🔊', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken' },
  { id: 'algemeen', name: '⚽ Algemene Kennis', icon: '⚽', good: 'Deel 2 slokken uit', bad: 'Neem 2 slokken' },
  { id: 'kelder', name: '🍺 Kelderklasse', icon: '🍺', good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken' },
  { id: 'var', name: '⚖️ VAR & Scheids', icon: '⚖️', good: 'Deel een half glas uit', bad: 'Neem 4 slokken' }
];

/* 45 VAKJES OPBOUWEN */
const BOARD_TILES = [];
for (let i = 1; i <= 45; i++) {
  let type = 'normal';
  let icon = '⚽';
  let name = 'Vak ' + i;
  let catObj = CATEGORIES[i % CATEGORIES.length];

  if (i === 1) { type = 'start'; icon = '🚪'; name = 'Kleedkamer'; }
  else if (i === 10) { type = 'special'; icon = '☕'; name = 'De Rust'; }
  else if (i === 20) { type = 'special'; icon = '🚑'; name = 'De Put'; }
  else if (i === 30) { type = 'special'; icon = '🟥'; name = 'Schorsing'; }
  else if (i === 40) { type = 'special'; icon = '💀'; name = 'VAR Buitenspel'; }
  else if (i === 45) { type = 'finish'; icon = '🏆'; name = 'De Kantine'; }
  else {
    icon = catObj.icon;
    name = catObj.name.split(' ')[1];
  }
  BOARD_TILES.push({ num: i, type, icon, name, cat: catObj.id });
}

/* VRAGENLIJST */
const QUESTIONS = [
  { cat: 'roemenie', q: 'Welke Roemeense club won in 1986 de Europacup 1 door FC Barcelona na penalty\'s te verslaan?', a: 'Steaua Boekarest', group: false, good: 'Deel 3 slokken uit', bad: 'Neem 2 slokken' },
  { cat: 'roemenie', q: 'Welke Roemeense legende stond bekend als "De Maradona van de Karpaten"?', a: 'Gheorghe Hagi', group: false, good: 'Deel 2 slokken uit', bad: 'Neem 2 slokken' },
  { cat: 'wk', q: 'In welk land werd het allereerste WK voetbal in 1930 gespeeld?', a: 'Uruguay', group: false, good: 'Deel 2 slokken uit', bad: 'Neem 2 slokken' },
  { cat: 'wk', q: 'Wie maakte in de WK-finale van 2014 in de verlenging de winnende goal voor Duitsland?', a: 'Mario Götze', group: false, good: 'Deel 2 slokken uit', bad: 'Neem 2 slokken' },
  { cat: 'audio', q: 'Maak het legendarische commentaar van Jack van Gelder in 1998 af: "DENNIS BERGKAMP! DENNIS BERGKAMP! ..."', a: 'BERRRGKAMP!', group: false, good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken' },
  { cat: 'algemeen', q: 'Welke club won de Champions League drie keer op rij tussen 2016 en 2018?', a: 'Real Madrid', group: false, good: 'Deel 2 slokken uit', bad: 'Neem 2 slokken' },
  { cat: 'kelder', q: 'Wat is de ongeschreven straf als je in de kelderklasse de wedstrijdbal over het hek de sloot in schiet?', a: 'Zelf halen (nat pak) of rondje bier', group: false, good: 'Deel 2 slokken uit', bad: 'Neem 2 slokken' },
  { cat: 'var', q: 'Mag de scheidsrechter nog een rode kaart geven nadat hij al voor het einde van de wedstrijd heeft gefloten?', a: 'Ja, zolang hij nog op het veld staat', group: false, good: 'Deel 3 slokken uit', bad: 'Neem 3 slokken' }
];

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
   TV DATA AFHANDELING & SPELVERLOOP (ONDER REGIE VAN SCHEIDS)
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
    // Verberg alle overlays en toon puur het spelbord
    document.getElementById('tv-roll-order-overlay').style.display = 'none';
    document.getElementById('tv-dice-overlay').style.display = 'none';
    document.getElementById('tv-question-overlay').style.display = 'none';
    updateTVLeaderboard();

    const nextPlayer = PLAYERS.find(p => p.id === turnOrder[currentTurnIndex]);
    broadcastToAll({
      type: 'BOARD_ACTIVE_WAIT',
      nextPlayerId: nextPlayer ? nextPlayer.id : '',
      nextPlayerName: nextPlayer ? nextPlayer.name : '',
      players: PLAYERS
    });
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
    executePlayerStepsSlowly(data.playerId, data.steps);
  }
  else if (data.type === 'REF_SHOW_QUESTION') {
    // Toon nu de daadwerkelijke vraag op TV én op het scherm van de speler
    document.getElementById('tv-q-text').style.display = 'block';
    document.getElementById('tv-q-text').innerText = currentQ.q;
    const activePlayer = PLAYERS.find(p => p.id === turnOrder[currentTurnIndex]);
    document.getElementById('tv-q-status').innerText = currentQ.group
      ? 'Iedereen kan nu antwoorden op zijn telefoon!'
      : `${activePlayer.name} denkt na en typt een antwoord...`;

    broadcastToAll({
      type: 'QUESTION_REVEALED',
      question: currentQ,
      activePlayerId: activePlayer.id
    });
  }
  else if (data.type === 'PLAYER_SUBMIT_ANSWER') {
    receivedAnswers[data.playerId] = data.ans;
    const p = PLAYERS.find(x => x.id === data.playerId);
    document.getElementById('tv-q-status').innerText = `${p ? p.name : 'Speler'} heeft een antwoord ingediend!`;
    broadcastToAll({ type: 'REF_RECEIVE_ANSWERS', answers: receivedAnswers });
  }
  else if (data.type === 'REF_SHOW_RESULT') {
    // Toon op TV het antwoord van de speler + GOED of FOUT
    const resBox = document.getElementById('tv-result-box');
    resBox.style.display = 'flex';
    resBox.innerHTML = Object.keys(data.verdicts).map(pId => {
      const p = PLAYERS.find(x => x.id === pId);
      const v = data.verdicts[pId];
      if (!p) return '';
      const bg = v.correct ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
      const border = v.correct ? '#10b981' : '#ef4444';
      const label = v.correct ? `✅ GOED! (${currentQ.good})` : `❌ FOUT! (${currentQ.bad})`;
      return `
        <div style="background: ${bg}; border: 3px solid ${border}; padding: 14px 20px; border-radius: 14px;">
          <div style="font-size: 1rem; opacity: 0.85;">Antwoord van <strong>${p.name}</strong>:</div>
          <div style="font-size: 1.5rem; font-weight: 900; margin: 4px 0;">"${v.ans}"</div>
          <div style="font-size: 1.2rem; font-weight: 900; color: ${border};">${label}</div>
        </div>
      `;
    }).join('');
    document.getElementById('tv-q-status').innerText = `Juiste antwoord: ${currentQ.a}`;

    // Stuur naar spelers zodat hun scherm felgroen of felrood kleurt
    broadcastToAll({
      type: 'SHOW_PLAYER_RESULT',
      verdicts: data.verdicts,
      goodText: currentQ.good,
      badText: currentQ.bad
    });
  }
  else if (data.type === 'REF_ADVANCE_TURN_TO_BOARD') {
    document.getElementById('tv-question-overlay').style.display = 'none';
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    updateTVLeaderboard();

    const nextPlayer = PLAYERS.find(p => p.id === turnOrder[currentTurnIndex]);
    broadcastToAll({
      type: 'BOARD_ACTIVE_WAIT',
      nextPlayerId: nextPlayer ? nextPlayer.id : '',
      nextPlayerName: nextPlayer ? nextPlayer.name : '',
      players: PLAYERS
    });
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

/* EXTRA LANGZAAM STAPJE VOOR STAPJE LOPEN (850ms PER VAKJE + PAUZE BIJ LANDING) */
function executePlayerStepsSlowly(playerId, steps) {
  document.getElementById('tv-dice-overlay').style.display = 'none';
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) return;

  let remaining = steps;
  const stepInterval = setInterval(() => {
    if (remaining <= 0 || player.pos >= 45) {
      clearInterval(stepInterval);
      broadcastToAll({ type: 'SYNC_PLAYERS', players: PLAYERS, gameStarted });
      // Wacht rustig 1.2 seconden op het vakje zodat iedereen ziet waar de pion is geland
      setTimeout(() => {
        prepareCategoryPreviewOnTV(player);
      }, 1200);
      return;
    }
    player.pos++;
    remaining--;
    renderTokens();
    updateTVLeaderboard();
    playAudioBeep(420, 0.09);
  }, 850);
}

function prepareCategoryPreviewOnTV(player) {
  if (player.pos >= 45) {
    player.pos = 45;
    confetti({ particleCount: 220, spread: 90, origin: { y: 0.6 } });
    showSipAlert(`🏆 KAMPIOEN! ${player.name} heeft de Kantine bereikt!`);
    return;
  }

  // KOPDUEL CHECK
  const others = PLAYERS.filter(p => p.id !== player.id && p.pos === player.pos);
  if (others.length > 0) {
    const msg = `💥 KOPDUEL op Vak ${player.pos}! ${player.name} & ${others[0].name} nemen 2 slokken!`;
    showSipAlert(msg);
    broadcastToAll({ type: 'SIP_ALERT', msg });
  }

  const tileObj = BOARD_TILES[player.pos - 1];
  const catObj = CATEGORIES.find(c => c.id === tileObj.cat) || CATEGORIES[0];

  // Kies een vraag uit deze categorie (of willekeurig als fallback)
  const matchingQs = QUESTIONS.filter(q => q.cat === catObj.id);
  currentQ = matchingQs.length > 0
    ? matchingQs[Math.floor(Math.random() * matchingQs.length)]
    : QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];

  receivedAnswers = {};
  roundVerdicts = {};

  // Toon op TV ALLEEN nog de categorie en de straf/beloning (nog niet de vraag)
  document.getElementById('tv-question-overlay').style.display = 'flex';
  document.getElementById('tv-q-cat').innerText = `${catObj.name} (Vak ${player.pos})`;
  document.getElementById('tv-stake-good').innerText = `✅ Goed: ${currentQ.good}`;
  document.getElementById('tv-stake-bad').innerText = `❌ Fout: ${currentQ.bad}`;
  document.getElementById('tv-q-text').style.display = 'none';
  document.getElementById('tv-result-box').style.display = 'none';
  document.getElementById('tv-q-status').innerText = `${player.name} staat klaar. Wachten tot de Scheidsrechter de vraag toont...`;

  broadcastToAll({
    type: 'PLAYER_LANDED_PREVIEW',
    playerId: player.id,
    playerName: player.name,
    tileNum: player.pos,
    categoryName: catObj.name,
    question: currentQ
  });
}

/* ========================================================
   MOBIEL: SPELER FUNCTIES
   ======================================================== */
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
    resetMobileBackground();
    hideAllMobileCards();
    document.getElementById('m-tile-info').style.display = 'block';
    document.getElementById('m-roll-order-card').style.display = 'flex';
  }
  else if (data.type === 'BOARD_ACTIVE_WAIT') {
    resetMobileBackground();
    hideAllMobileCards();
    const me = data.players.find(x => x.id === myPlayerId);
    if (me) {
      document.getElementById('m-tile-info').style.display = 'block';
      document.getElementById('m-tile-info').innerText = `Vak ${me.pos} (Nog ${45 - me.pos} te gaan)`;
    }
    document.getElementById('m-wait-turn-card').style.display = 'flex';
    document.getElementById('m-wait-turn-text').innerText = 'Wachten op de Scheidsrechter...';
    document.getElementById('m-wait-turn-sub').innerText = `Binnenkort aan de beurt: ${data.nextPlayerName}`;
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
      document.getElementById('m-wait-turn-text').innerText = `${data.activePlayerName} is nu aan de beurt!`;
      document.getElementById('m-wait-turn-sub').innerText = 'Kijk naar het grote scherm.';
    }
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
    const shouldAnswer = data.question.group || data.activePlayerId === myPlayerId;
    if (shouldAnswer) {
      document.getElementById('m-answer-card').style.display = 'flex';
      document.getElementById('m-q-cat').innerText = data.question.cat.toUpperCase();
      document.getElementById('m-q-text').innerText = data.question.q;
      document.getElementById('m-input-ans').value = '';
      document.getElementById('m-btn-submit-ans').style.display = 'inline-flex';
      document.getElementById('m-ans-status').innerText = '';
    } else {
      document.getElementById('m-wait-turn-card').style.display = 'flex';
      document.getElementById('m-wait-turn-text').innerText = 'Vraag is geopend!';
      document.getElementById('m-wait-turn-sub').innerText = 'De speler die aan de beurt is vult nu een antwoord in.';
    }
  }
  else if (data.type === 'SHOW_PLAYER_RESULT') {
    const myVerdict = data.verdicts[myPlayerId];
    if (myVerdict) {
      hideAllMobileCards();
      const mv = document.getElementById('mobile-view');
      mv.style.backgroundColor = myVerdict.correct ? '#16a34a' : '#dc2626'; // Volledig scherm felgroen of felrood

      document.getElementById('m-result-card').style.display = 'flex';
      document.getElementById('m-result-icon').innerText = myVerdict.correct ? '✅' : '❌';
      document.getElementById('m-result-title').innerText = myVerdict.correct ? 'GOED!' : 'FOUT!';
      document.getElementById('m-result-sub').innerText = myVerdict.correct ? data.goodText : data.badText;
    }
  }
  else if (data.type === 'SIP_ALERT') {
    showSipAlert(data.msg);
  }
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
  document.getElementById('m-ans-status').innerText = '✅ Antwoord verstuurd! Wachten op oordeel...';
  clientConn.send({ type: 'PLAYER_SUBMIT_ANSWER', playerId: myPlayerId, ans: ans });
}

/* ========================================================
   SCHEIDSRECHTER FUNCTIES (VOLLEDIGE TEMPO-CONTROLE)
   ======================================================== */
function hideAllRefCards() {
  ['ref-lobby-card', 'ref-wiegeloot-card', 'ref-board-card', 'ref-pre-question-card', 'ref-judge-card', 'ref-penalty-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function renderRefPlayerLists() {
  const lobbyList = document.getElementById('ref-player-list');
  const activeList = document.getElementById('ref-active-player-list');
  document.getElementById('ref-player-count').innerText = `Deelnemers (${PLAYERS.length}):`;

  const html = PLAYERS.length === 0
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

  if (lobbyList) lobbyList.innerHTML = html;
  if (activeList) activeList.innerHTML = html;
}

function refKickPlayer(playerId, playerName) {
  if (!confirm(`Wil je ${playerName} verwijderen?`)) return;
  clientConn.send({ type: 'REF_KICK_PLAYER', playerId });
}

function refStartGame() {
  if (PLAYERS.length === 0) return alert("Wacht tot er minimaal 1 speler in de kleedkamer zit!");
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

function refShowQuestion() {
  hideAllRefCards();
  document.getElementById('ref-judge-card').style.display = 'flex';
  document.getElementById('ref-btn-show-result').style.display = 'none';
  document.getElementById('ref-btn-back-to-board').style.display = 'none';
  document.getElementById('ref-answers-list').innerHTML = '<div style="opacity:0.6; font-size:0.85rem;">Wachten op antwoord van speler...</div>';
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
    document.getElementById('ref-board-sub').innerText = 'Klik hieronder wanneer de speler mag gooien.';
    document.getElementById('ref-btn-allow-roll').style.display = 'inline-flex';
  }
  else if (data.type === 'PLAYER_LANDED_PREVIEW') {
    hideAllRefCards();
    document.getElementById('ref-pre-question-card').style.display = 'flex';
    document.getElementById('ref-pre-cat').innerText = `${data.categoryName} (Vak ${data.tileNum})`;
    document.getElementById('ref-pre-title').innerText = `${data.playerName} is geland!`;
    document.getElementById('ref-preview-q').innerText = data.question.q;

    // Bereid alvast het beoordelingsscherm voor
    document.getElementById('ref-q-text').innerText = data.question.q;
    document.getElementById('ref-q-secret-ans').innerText = data.question.a;
    roundVerdicts = {};
  }
  else if (data.type === 'REF_RECEIVE_ANSWERS') {
    receivedAnswers = data.answers;
    renderRefAnswers(data.answers);
  }
}

function renderRefAnswers(answers) {
  const list = document.getElementById('ref-answers-list');
  list.innerHTML = Object.keys(answers).map(pId => {
    const p = PLAYERS.find(x => x.id === pId);
    if (!p) return '';
    const judged = roundVerdicts[pId];
    return `
      <div style="background: rgba(255,255,255,0.08); padding: 10px; border-radius: 10px; border-left: 4px solid ${p.color};">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight: 800; font-size:0.9rem;">${p.name}: "${answers[pId]}"</span>
          <span id="badge-${pId}" style="font-size:0.8rem; font-weight:900;">
            ${judged ? (judged.correct ? '✅ GOED' : '❌ FOUT') : ''}
          </span>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="btn btn-green" style="padding: 8px; font-size: 0.8rem; flex:1;" onclick="refMarkAnswer('${pId}', true)">
            ✅ Goed
          </button>
          <button class="btn btn-red" style="padding: 8px; font-size: 0.8rem; flex:1;" onclick="refMarkAnswer('${pId}', false)">
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
  // Zodra er een oordeel is geklikt, verschijnt de knop 'Show Resultaat'
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
   ALGEMENE HULPFUNCTIES
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