/**
 * ═══════════════════════════════════════════════════════
 * PACS ENGINEER — game.js
 * Core game engine. Handles:
 *  - Screen management
 *  - Level loading and rendering
 *  - Node drag, port connections, canvas lines
 *  - Config panel (IP / AE Title / port fixing)
 *  - AE Title matching puzzle
 *  - Study queue (drag to destination)
 *  - Storage bar management
 *  - Timer, score, emergency events
 *  - Win/loss detection
 *  - Leaderboard (localStorage)
 *  - Toast notifications, system log
 * ═══════════════════════════════════════════════════════
 */

'use strict';

/* ─────────────────────────────────────
   GAME STATE
───────────────────────────────────── */
const G = {
  currentLevel: 0,
  score: 0,
  studiesOk: 0,
  studiesFailed: 0,
  timerSec: 0,
  timerInterval: null,
  emergencyInterval: null,
  paused: false,
  gameActive: false,

  // Node graph
  nodes: [],      // { def, el, x, y }
  connections: [], // { from, to, fromPort, toPort }

  // Canvas drawing
  canvas: null,
  ctx: null,

  // Drag state (node dragging)
  draggingNode: null,
  dragOffX: 0,
  dragOffY: 0,

  // Wire drawing state
  wiringFrom: null,  // { nodeId, portEl }
  wiringPreview: null, // {x1,y1,x2,y2}

  // Config state
  editingNode: null,

  // AE puzzle state
  aeSelected: null,

  // Level data
  levelDef: null,
  configsFixed: 0,
  connectionsRequired: [],
  studyData: [],
  storageLevels: { pacs:0, archive:0, cloud:0 },

  // Emergency
  emergencyActive: false,
  emergencyTimerSec: 0,
  emergencyEventInterval: null,
};

/* ─────────────────────────────────────
   SCREEN MANAGER
───────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

/* ─────────────────────────────────────
   INIT
───────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  bindTitleScreen();
  bindHowTo();
  bindLeaderboard();
  bindGameButtons();
  loadTitleStats();
  showScreen('screen-title');
});

function initCanvas() {
  G.canvas = document.getElementById('connectionCanvas');
  G.ctx = G.canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  const area = document.getElementById('gameArea');
  if (!area) return;
  G.canvas.width  = area.offsetWidth;
  G.canvas.height = area.offsetHeight;
  redrawLines();
}

/* ─────────────────────────────────────
   TITLE SCREEN
───────────────────────────────────── */
function bindTitleScreen() {
  document.getElementById('btnStart').addEventListener('click', () => {
    G.currentLevel = 0;
    G.score = 0;
    G.studiesOk = 0;
    G.studiesFailed = 0;
    startLevel(G.currentLevel);
  });
  document.getElementById('btnLeaderboard').addEventListener('click', () => {
    renderLeaderboard();
    showScreen('screen-leaderboard');
  });
  document.getElementById('btnHowTo').addEventListener('click', () => showScreen('screen-howto'));
}

function loadTitleStats() {
  const lb = getLeaderboard();
  const best = lb.length ? Math.max(...lb.map(e=>e.score)) : '—';
  const played = parseInt(localStorage.getItem('pacsgame_played') || '0');
  const cleared = parseInt(localStorage.getItem('pacsgame_cleared') || '0');
  document.getElementById('tsBestScore').textContent = best;
  document.getElementById('tsLevelsCleared').textContent = cleared;
  document.getElementById('tsGamesPlayed').textContent = played;
}

/* ─────────────────────────────────────
   HOW TO PLAY
───────────────────────────────────── */
function bindHowTo() {
  document.getElementById('btnHowToBack').addEventListener('click', () => showScreen('screen-title'));
}

/* ─────────────────────────────────────
   LEADERBOARD
───────────────────────────────────── */
function bindLeaderboard() {
  document.getElementById('btnLBBack').addEventListener('click', () => showScreen('screen-title'));
  document.getElementById('btnClearLB').addEventListener('click', () => {
    if (confirm('Clear leaderboard?')) {
      localStorage.removeItem('pacsgame_lb');
      renderLeaderboard();
    }
  });
}

function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem('pacsgame_lb') || '[]'); }
  catch { return []; }
}

function saveLeaderboard(entries) {
  localStorage.setItem('pacsgame_lb', JSON.stringify(entries));
}

function addLeaderboardEntry(name, score, level) {
  const lb = getLeaderboard();
  lb.push({ name: name || 'ANON', score, level, date: new Date().toLocaleDateString() });
  lb.sort((a,b) => b.score - a.score);
  saveLeaderboard(lb.slice(0,10));
}

function renderLeaderboard() {
  const list = document.getElementById('lbList');
  const lb = getLeaderboard();
  if (!lb.length) {
    list.innerHTML = '<div class="lb-empty">NO ENTRIES YET — BE THE FIRST</div>';
    return;
  }
  const medals = ['🥇','🥈','🥉'];
  list.innerHTML = lb.map((e,i) => `
    <div class="lb-row">
      <span>${medals[i] || (i+1)}</span>
      <span>${e.name}</span>
      <span>${e.score.toLocaleString()}</span>
      <span>${e.level}</span>
      <span>${e.date}</span>
    </div>
  `).join('');
}

/* ─────────────────────────────────────
   GAME BUTTONS (HUD / pause / quit)
───────────────────────────────────── */
function bindGameButtons() {
  document.getElementById('btnPause').addEventListener('click', pauseGame);
  document.getElementById('btnQuit').addEventListener('click', () => { if(confirm('Quit to menu?')) quitToMenu(); });
  document.getElementById('btnResume').addEventListener('click', resumeGame);
  document.getElementById('btnPauseQuit').addEventListener('click', quitToMenu);
  document.getElementById('btnConfigClose').addEventListener('click', closeConfig);
  document.getElementById('btnConfigSave').addEventListener('click', applyConfig);
  document.getElementById('btnNextLevel').addEventListener('click', () => {
    G.currentLevel++;
    if (G.currentLevel >= LEVELS.length) {
      showVictory();
    } else {
      startLevel(G.currentLevel);
    }
  });
  document.getElementById('btnRetryLC').addEventListener('click', () => startLevel(G.currentLevel));
  document.getElementById('btnRetryGO').addEventListener('click', () => {
    G.score = 0; G.studiesOk = 0; G.studiesFailed = 0; G.currentLevel = 0;
    startLevel(0);
  });
  document.getElementById('btnGoMenu').addEventListener('click', quitToMenu);
  document.getElementById('btnSaveScore').addEventListener('click', () => {
    const name = document.getElementById('nameInput').value.trim().toUpperCase() || 'ENGINEER';
    addLeaderboardEntry(name, G.score, G.levelDef ? G.levelDef.id : 1);
    toast('Score saved to leaderboard!', 'success');
    document.getElementById('btnSaveScore').disabled = true;
  });
}

/* ─────────────────────────────────────
   LEVEL LOADING
───────────────────────────────────── */
function startLevel(idx) {
  stopAllTimers();
  clearGameArea();

  G.levelDef = LEVELS[idx];
  if (!G.levelDef) { showVictory(); return; }

  G.nodes = [];
  G.connections = [];
  G.wiringFrom = null;
  G.configsFixed = 0;
  G.paused = false;
  G.gameActive = true;
  G.storageLevels = { ...G.levelDef.storage };
  G.studyData = G.levelDef.studyQueue.map(s => ({ ...s }));
  G.connectionsRequired = G.levelDef.solution.map(s => [...s]);

  // HUD
  document.getElementById('hudLevel').textContent = String(G.levelDef.id).padStart(2,'0');
  document.getElementById('hudObjective').textContent = G.levelDef.objective;
  document.getElementById('hudScore').textContent = G.score;
  document.getElementById('hudStudiesOk').textContent = G.studiesOk;

  // Build nodes
  G.levelDef.nodes.forEach(nd => buildNode(nd));

  // Build study queue
  renderStudyQueue();

  // Update storage bars
  updateStorageBars();

  // Start timer
  G.timerSec = G.levelDef.timeLimit;
  updateTimer();
  G.timerInterval = setInterval(tickTimer, 1000);

  // AE puzzle overlay if needed
  if (G.levelDef.puzzleType === 'ae_match') {
    setTimeout(() => renderAEPuzzle(), 400);
  }

  // Emergency events
  const emergChance = G.levelDef.emergencyChance || 0.3;
  scheduleEmergency(emergChance);

  // Increment games played
  const played = parseInt(localStorage.getItem('pacsgame_played') || '0');
  localStorage.setItem('pacsgame_played', played + 1);

  showScreen('screen-game');
  resizeCanvas();

  logMsg(`LVL ${G.levelDef.id}: ${G.levelDef.title}`, 'info');
  logMsg(G.levelDef.story.slice(0,80) + '...', 'warn');
  toast(`Level ${G.levelDef.id}: ${G.levelDef.title}`, 'info');
  setTimeout(() => toast(`HINT: ${G.levelDef.hint}`, 'warn'), 1500);
}

function clearGameArea() {
  document.getElementById('nodesContainer').innerHTML = '';
  document.getElementById('studyQueue').innerHTML = '';
  document.getElementById('msgList').innerHTML = '';
  document.getElementById('emergencyBanner').classList.remove('active');
  document.querySelectorAll('.ae-puzzle').forEach(e=>e.remove());
  if (G.ctx) G.ctx.clearRect(0, 0, G.canvas.width, G.canvas.height);
}

function stopAllTimers() {
  clearInterval(G.timerInterval);
  clearInterval(G.emergencyEventInterval);
  clearInterval(G.emergencyInterval);
  G.timerInterval = null;
  G.emergencyEventInterval = null;
  G.emergencyInterval = null;
  G.emergencyActive = false;
}

/* ─────────────────────────────────────
   NODE BUILDING
───────────────────────────────────── */
function buildNode(nd) {
  const el = document.createElement('div');
  el.className = `game-node ${nd.status === 'error' ? 'error' : nd.status === 'warn' ? '' : ''}`;
  el.id = `node-${nd.id}`;
  el.style.left = nd.x + 'px';
  el.style.top  = nd.y + 'px';

  // Config button
  const cfgBtn = document.createElement('button');
  cfgBtn.className = `node-config-btn ${nd.hasConfig ? '' : 'hidden'}`;
  cfgBtn.textContent = '⚙';
  cfgBtn.title = 'Configure node';
  cfgBtn.addEventListener('click', (e) => { e.stopPropagation(); openConfig(nd.id); });
  el.appendChild(cfgBtn);

  // Header
  el.innerHTML += `
    <div class="node-header">
      <span class="node-icon">${nd.icon}</span>
      <span class="node-title">${nd.label}</span>
      <div class="node-status-dot ${nd.status === 'ok' ? 'ok' : nd.status === 'warn' ? 'warn' : ''}"></div>
    </div>
    <div class="node-body">
      <div class="node-info">
        AE: <span>${nd.info.ae}</span><br/>
        IP: <span>${nd.info.ip}</span><br/>
        PORT: <span>${nd.info.port}</span>
      </div>
    </div>
  `;

  // Output port (right side)
  const outPorts = document.createElement('div');
  outPorts.className = 'node-ports';
  const outPort = document.createElement('div');
  outPort.className = 'port output';
  outPort.dataset.nodeId = nd.id;
  outPort.dataset.portType = 'output';
  outPort.addEventListener('mousedown', onPortMouseDown);
  outPorts.appendChild(outPort);
  el.appendChild(outPorts);

  // Input port (left side)
  const inPorts = document.createElement('div');
  inPorts.className = 'node-ports input-ports';
  const inPort = document.createElement('div');
  inPort.className = 'port input';
  inPort.dataset.nodeId = nd.id;
  inPort.dataset.portType = 'input';
  inPort.addEventListener('mouseup', onPortMouseUp);
  inPorts.appendChild(inPort);
  el.appendChild(inPorts);

  // Node drag
  el.addEventListener('mousedown', onNodeMouseDown);

  document.getElementById('nodesContainer').appendChild(el);

  G.nodes.push({ def: nd, el, x: nd.x, y: nd.y });
}

function getNodeData(id) {
  return G.nodes.find(n => n.def.id === id);
}

/* ─────────────────────────────────────
   NODE DRAGGING
───────────────────────────────────── */
function onNodeMouseDown(e) {
  if (e.target.classList.contains('port') || e.target.classList.contains('node-config-btn')) return;
  const el = e.currentTarget;
  G.draggingNode = el;
  const rect = el.getBoundingClientRect();
  const areaRect = document.getElementById('gameArea').getBoundingClientRect();
  G.dragOffX = e.clientX - rect.left;
  G.dragOffY = e.clientY - rect.top;
  el.style.zIndex = 50;
  e.preventDefault();
}

document.addEventListener('mousemove', (e) => {
  // Node drag
  if (G.draggingNode) {
    const areaRect = document.getElementById('gameArea').getBoundingClientRect();
    const x = e.clientX - areaRect.left - G.dragOffX;
    const y = e.clientY - areaRect.top  - G.dragOffY;
    G.draggingNode.style.left = Math.max(0, x) + 'px';
    G.draggingNode.style.top  = Math.max(0, y) + 'px';
    const nd = G.nodes.find(n => n.el === G.draggingNode);
    if (nd) { nd.x = x; nd.y = y; }
    redrawLines();
  }
  // Wire preview
  if (G.wiringFrom) {
    const areaRect = document.getElementById('gameArea').getBoundingClientRect();
    G.wiringPreview = {
      x2: e.clientX - areaRect.left,
      y2: e.clientY - areaRect.top
    };
    redrawLines();
  }
});

document.addEventListener('mouseup', (e) => {
  if (G.draggingNode) {
    G.draggingNode.style.zIndex = 20;
    G.draggingNode = null;
  }
  if (G.wiringFrom && !e.target.classList.contains('port')) {
    G.wiringFrom = null;
    G.wiringPreview = null;
    redrawLines();
  }
});

/* ─────────────────────────────────────
   PORT WIRING (connection drawing)
───────────────────────────────────── */
function onPortMouseDown(e) {
  e.stopPropagation();
  const port = e.currentTarget;
  const nodeId = port.dataset.nodeId;
  G.wiringFrom = { nodeId, portEl: port };
  const pos = getPortCenter(port);
  G.wiringPreview = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
}

function onPortMouseUp(e) {
  e.stopPropagation();
  if (!G.wiringFrom) return;
  const toPort = e.currentTarget;
  const toNodeId = toPort.dataset.nodeId;
  const fromNodeId = G.wiringFrom.nodeId;

  if (fromNodeId === toNodeId) { G.wiringFrom = null; G.wiringPreview = null; redrawLines(); return; }

  // Check if connection already exists
  const exists = G.connections.find(c => c.from === fromNodeId && c.to === toNodeId);
  if (exists) { toast('Connection already exists', 'warn'); G.wiringFrom=null;G.wiringPreview=null;redrawLines();return; }

  // Add connection
  G.connections.push({ from: fromNodeId, to: toNodeId });
  markPortConnected(G.wiringFrom.portEl);
  markPortConnected(toPort);
  logMsg(`Connected: ${fromNodeId} → ${toNodeId}`, 'ok');
  toast(`Route established: ${fromNodeId} → ${toNodeId}`, 'success');
  addScore(50);

  G.wiringFrom = null;
  G.wiringPreview = null;
  redrawLines();
  checkWinCondition();
}

function markPortConnected(portEl) {
  portEl.classList.add('connected');
}

/* ─────────────────────────────────────
   CANVAS LINES
───────────────────────────────────── */
function getPortCenter(portEl) {
  const areaRect = document.getElementById('gameArea').getBoundingClientRect();
  const r = portEl.getBoundingClientRect();
  return {
    x: r.left + r.width/2 - areaRect.left,
    y: r.top  + r.height/2 - areaRect.top
  };
}

function getNodePortPosition(nodeId, type) {
  const nd = getNodeData(nodeId);
  if (!nd) return { x:0, y:0 };
  const portEls = nd.el.querySelectorAll(`.port.${type}`);
  if (!portEls.length) return { x:0, y:0 };
  return getPortCenter(portEls[0]);
}

function redrawLines() {
  if (!G.ctx) return;
  G.ctx.clearRect(0, 0, G.canvas.width, G.canvas.height);

  // Draw existing connections
  G.connections.forEach(conn => {
    const p1 = getNodePortPosition(conn.from, 'output');
    const p2 = getNodePortPosition(conn.to,   'input');
    drawCurve(p1, p2, '#00e5ff', false);
  });

  // Draw preview wire
  if (G.wiringFrom && G.wiringPreview) {
    const p1 = getPortCenter(G.wiringFrom.portEl);
    drawCurve(p1, { x: G.wiringPreview.x2, y: G.wiringPreview.y2 }, '#ffb700', true);
  }
}

function drawCurve(p1, p2, color, dashed) {
  const ctx = G.ctx;
  const dx = Math.abs(p2.x - p1.x) * 0.5;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.bezierCurveTo(p1.x + dx, p1.y, p2.x - dx, p2.y, p2.x, p2.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dashed ? [5,4] : [6,3]);
  ctx.shadowColor = color;
  ctx.shadowBlur = dashed ? 0 : 6;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
}

/* ─────────────────────────────────────
   CONFIG PANEL
───────────────────────────────────── */
function openConfig(nodeId) {
  const nd = getNodeData(nodeId);
  if (!nd) return;
  G.editingNode = nodeId;

  document.getElementById('configTitle').textContent = `CONFIG: ${nd.def.label.toUpperCase()}`;

  const fields = document.getElementById('configFields');
  fields.innerHTML = '';

  const info = nd.def.info;
  const correct = nd.def.correctConfig || {};

  // Render editable fields (only fields with wrong values)
  const fieldDefs = [
    { key:'ip',   label:'IP Address', type:'text' },
    { key:'port', label:'Port',       type:'text' },
    { key:'ae',   label:'AE Title',   type:'text' },
  ];

  fieldDefs.forEach(fd => {
    if (!(fd.key in info)) return;
    const div = document.createElement('div');
    div.className = 'config-field';
    const isWrong = fd.key in correct;
    div.innerHTML = `
      <label>${fd.label} ${isWrong ? '<span style="color:var(--red)">⚠ INCORRECT</span>' : ''}</label>
      <input type="${fd.type}" id="cfg_${fd.key}" value="${info[fd.key]}" data-key="${fd.key}"/>
    `;
    fields.appendChild(div);
  });

  document.getElementById('configPanel').classList.remove('hidden');
}

function closeConfig() {
  document.getElementById('configPanel').classList.add('hidden');
  G.editingNode = null;
}

function applyConfig() {
  const nd = getNodeData(G.editingNode);
  if (!nd) return;
  const correct = nd.def.correctConfig || {};
  let allCorrect = true;
  let anyFixed = false;

  document.querySelectorAll('#configFields input').forEach(input => {
    const key = input.dataset.key;
    const val = input.value.trim();
    if (correct[key]) {
      if (val === correct[key]) {
        nd.def.info[key] = val;
        anyFixed = true;
        logMsg(`Fixed ${key.toUpperCase()} on ${nd.def.label}: ${val}`, 'ok');
      } else {
        allCorrect = false;
        input.style.borderColor = 'var(--red)';
        toast(`Incorrect ${key.toUpperCase()} value!`, 'error');
      }
    } else {
      nd.def.info[key] = val;
    }
  });

  if (!allCorrect) return;

  // Update display
  const body = nd.el.querySelector('.node-info');
  if (body) {
    body.innerHTML = `AE: <span>${nd.def.info.ae}</span><br/>IP: <span>${nd.def.info.ip}</span><br/>PORT: <span>${nd.def.info.port}</span>`;
  }

  // Mark node fixed
  nd.def.hasConfig = false;
  nd.def.status = 'ok';
  nd.el.classList.remove('error','configuring');
  nd.el.classList.add('ok');
  nd.el.querySelector('.node-status-dot').className = 'node-status-dot ok';
  nd.el.querySelector('.node-config-btn').classList.add('hidden');

  G.configsFixed++;
  addScore(200);
  toast(`${nd.def.label} configuration fixed! +200pts`, 'success');
  closeConfig();
  checkWinCondition();
}

/* ─────────────────────────────────────
   AE TITLE PUZZLE
───────────────────────────────────── */
function renderAEPuzzle() {
  const level = G.levelDef;
  if (!level.aePairs) return;

  const overlay = document.createElement('div');
  overlay.className = 'ae-puzzle config-overlay';
  overlay.id = 'aePuzzleOverlay';

  const allAEs = level.aePairs.flatMap(p => [p.correct, ...p.wrong]).sort(() => Math.random()-0.5);
  const modalities = level.aePairs.map(p => p.modality);

  overlay.innerHTML = `
    <div class="config-box" style="min-width:520px;max-width:90vw">
      <div class="config-title">⚡ AE TITLE MISMATCH — FIX THE ROUTING TABLE</div>
      <p style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text2);text-align:center;margin-bottom:1rem">
        Select a modality, then click its correct AE Title
      </p>
      <div class="ae-grid">
        <div class="ae-column">
          <div class="ae-column-title">Modalities</div>
          ${modalities.map(m => `<div class="ae-item" data-ae-mod="${m}" onclick="selectAEModality('${m}',this)">${m}</div>`).join('')}
        </div>
        <div class="ae-column">
          <div class="ae-column-title">AE Titles</div>
          ${allAEs.map(ae => `<div class="ae-item" data-ae-val="${ae}" onclick="selectAETitle('${ae}',this)">${ae}</div>`).join('')}
        </div>
      </div>
      <div id="aeStatus" style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text3);text-align:center;margin-top:1rem"></div>
      <div style="margin-top:1rem;text-align:center">
        <button class="btn-ghost" style="width:auto;padding:0.6rem 2rem" onclick="closeAEPuzzle()">CLOSE PANEL</button>
      </div>
    </div>
  `;

  document.getElementById('gameArea').appendChild(overlay);
}

let aeSelectedMod = null;

window.selectAEModality = function(mod, el) {
  aeSelectedMod = mod;
  document.querySelectorAll('[data-ae-mod]').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
};

window.selectAETitle = function(ae, el) {
  if (!aeSelectedMod) {
    toast('Select a modality first', 'warn');
    return;
  }
  const level = G.levelDef;
  const pair = level.aePairs.find(p => p.modality === aeSelectedMod);
  if (!pair) return;

  if (ae === pair.correct) {
    el.classList.add('matched');
    const modEl = document.querySelector(`[data-ae-mod="${aeSelectedMod}"]`);
    if (modEl) modEl.classList.add('matched');

    logMsg(`AE matched: ${aeSelectedMod} → ${ae}`, 'ok');
    toast(`✓ Correct AE Title for ${aeSelectedMod}!`, 'success');
    addScore(150);
    G.configsFixed++;

    // Also fix the node
    const nd = G.nodes.find(n => n.def.label.toLowerCase().includes(aeSelectedMod.toLowerCase()));
    if (nd) {
      nd.def.info.ae = ae;
      nd.def.status = 'ok';
      nd.el.classList.remove('error');
      nd.el.classList.add('ok');
      nd.el.querySelector('.node-status-dot').className = 'node-status-dot ok';
    }

    aeSelectedMod = null;
    document.querySelectorAll('[data-ae-mod]').forEach(e => e.classList.remove('selected'));
    checkWinCondition();
  } else {
    toast(`✗ Wrong AE Title for ${aeSelectedMod}`, 'error');
    addScore(-25);
    el.style.background = 'var(--red-dim)';
    setTimeout(() => el.style.background = '', 500);
  }
};

window.closeAEPuzzle = function() {
  const ov = document.getElementById('aePuzzleOverlay');
  if (ov) ov.remove();
};

/* ─────────────────────────────────────
   STUDY QUEUE
───────────────────────────────────── */
function renderStudyQueue() {
  const list = document.getElementById('studyQueue');
  list.innerHTML = '';
  G.studyData.forEach(study => buildStudyCard(study));
  document.getElementById('queueCount').textContent = G.studyData.length;
}

function buildStudyCard(study) {
  const list = document.getElementById('studyQueue');
  const card = document.createElement('div');
  card.className = `study-card${study.stat ? ' stat' : ''}`;
  card.id = `study-${study.id}`;
  card.draggable = true;
  card.innerHTML = `
    <div class="sc-modality">${study.modality}</div>
    <div class="sc-patient">${study.patient}</div>
    <div class="sc-size">${study.size}</div>
    ${study.stat ? '<div class="sc-stat">⚡ STAT</div>' : ''}
  `;

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('studyId', study.id);
    card.classList.add('dragging');
    highlightDropZones(study.destination);
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    clearDropHighlights();
  });

  list.appendChild(card);
}

function highlightDropZones(dest) {
  const nodeEls = document.querySelectorAll(`[id^="node-"]`);
  nodeEls.forEach(el => {
    const nd = G.nodes.find(n => n.el === el);
    if (nd && ['pacs','archive','cloud'].includes(nd.def.type)) {
      el.classList.add('drop-zone-active');
      el.addEventListener('dragover', onStudyDragOver);
      el.addEventListener('drop', onStudyDrop);
    }
  });
}

function clearDropHighlights() {
  document.querySelectorAll('.drop-zone-active').forEach(el => {
    el.classList.remove('drop-zone-active');
    el.removeEventListener('dragover', onStudyDragOver);
    el.removeEventListener('drop', onStudyDrop);
  });
}

function onStudyDragOver(e) { e.preventDefault(); }

function onStudyDrop(e) {
  e.preventDefault();
  const studyId = e.dataTransfer.getData('studyId');
  const nodeEl = e.currentTarget;
  const nd = G.nodes.find(n => n.el === nodeEl);
  if (!nd) return;

  const study = G.studyData.find(s => s.id === studyId);
  if (!study) return;

  const targetType = nd.def.type; // pacs / archive / cloud
  const isCorrect = study.destination === targetType || targetType === 'pacs'; // pacs accepts anything

  if (isCorrect) {
    routeStudy(study, targetType);
  } else {
    toast(`Wrong destination for ${study.modality} study`, 'error');
    addScore(-50);
    logMsg(`Study misrouted: ${study.modality} → ${targetType}`, 'error');
    G.studiesFailed++;
  }
  clearDropHighlights();
}

function routeStudy(study, dest) {
  // Remove from queue
  G.studyData = G.studyData.filter(s => s.id !== study.id);
  const card = document.getElementById(`study-${study.id}`);
  if (card) {
    card.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => card.remove(), 300);
  }

  // Increase storage
  const sizeMB = parseInt(study.size) || 100;
  const sizePct = sizeMB / 50; // ~50MB = 1%
  G.storageLevels[dest] = Math.min(100, G.storageLevels[dest] + sizePct);
  updateStorageBars();

  G.studiesOk++;
  document.getElementById('hudStudiesOk').textContent = G.studiesOk;
  document.getElementById('queueCount').textContent = G.studyData.length;

  const pts = study.stat ? 150 : 80;
  addScore(pts);
  logMsg(`Study routed: ${study.patient} → ${dest.toUpperCase()} (+${pts}pts)`, 'ok');
  toast(`Study routed to ${dest.toUpperCase()}${study.stat ? ' — STAT BONUS!' : ''}`, 'success');

  // Check storage overflow
  if (G.storageLevels[dest] >= (G.levelDef.storageLimit || 85)) {
    storageOverflow(dest);
  }

  checkWinCondition();
}

/* ─────────────────────────────────────
   STORAGE BARS
───────────────────────────────────── */
function updateStorageBars() {
  ['pacs','archive','cloud'].forEach(type => {
    const pct = Math.round(G.storageLevels[type]);
    const bar = document.getElementById(`bar${type.charAt(0).toUpperCase()+type.slice(1)}`);
    const lbl = document.getElementById(`pct${type.charAt(0).toUpperCase()+type.slice(1)}`);
    if (!bar||!lbl) return;
    bar.style.width = pct + '%';
    lbl.textContent = pct + '%';
    bar.classList.remove('warn','crit');
    if (pct >= 90) bar.classList.add('crit');
    else if (pct >= 70) bar.classList.add('warn');
  });
}

function storageOverflow(type) {
  logMsg(`CRITICAL: ${type.toUpperCase()} storage overflow!`, 'error');
  toast(`⚠ ${type.toUpperCase()} STORAGE FULL — STUDIES BEING LOST!`, 'error');
  addScore(-300);
  // Don't end game — just penalize and warn
}

/* ─────────────────────────────────────
   TIMER
───────────────────────────────────── */
function updateTimer() {
  const t = G.timerSec;
  const totalTime = G.levelDef ? G.levelDef.timeLimit : 60;
  const pct = t / totalTime;
  const circumference = 213.6;
  const offset = circumference * (1 - pct);

  const circle = document.getElementById('timerCircle');
  const numEl = document.getElementById('timerNum');
  circle.style.strokeDashoffset = offset;
  numEl.textContent = t;

  circle.classList.remove('warn','danger');
  if (pct < 0.2) { circle.classList.add('danger'); numEl.style.color='var(--red)'; }
  else if (pct < 0.4) { circle.classList.add('warn'); numEl.style.color='var(--amber)'; }
  else { numEl.style.color='var(--cyan)'; }
}

function tickTimer() {
  if (G.paused || !G.gameActive) return;
  G.timerSec--;
  updateTimer();

  // Emergency random events (low probability each second)
  if (!G.emergencyActive && Math.random() < 0.015) {
    triggerEmergency();
  }

  if (G.timerSec <= 0) {
    timeUp();
  }
}

function timeUp() {
  stopAllTimers();
  G.gameActive = false;
  logMsg('TIME EXPIRED — evaluating workflow...', 'warn');

  // Check if pass condition met
  if (checkPassCondition()) {
    levelComplete();
  } else {
    gameOver('Time ran out before workflow was fully restored.');
  }
}

/* ─────────────────────────────────────
   WIN CONDITION
───────────────────────────────────── */
function checkWinCondition() {
  if (!G.gameActive) return;
  if (checkPassCondition()) {
    setTimeout(() => levelComplete(), 400);
  }
}

function checkPassCondition() {
  const cond = G.levelDef.passCondition;
  const level = G.levelDef;

  // Check connections
  if (cond.connectionsOk) {
    const allConnected = level.solution.every(([from,to]) =>
      G.connections.some(c => c.from === from && c.to === to)
    );
    if (!allConnected) return false;
  }

  // Check config fixes
  if (cond.configFixed && G.configsFixed < cond.configFixed) return false;

  // Check AE fixes
  if (cond.aeFixed && G.configsFixed < cond.aeFixed) return false;

  // Check studies routed
  if (cond.studiesRouted && G.studiesOk < cond.studiesRouted) return false;

  // Check storage threshold
  if (cond.storageBelow) {
    if (G.storageLevels.pacs >= cond.storageBelow) return false;
  }

  return true;
}

/* ─────────────────────────────────────
   LEVEL COMPLETE / GAME OVER
───────────────────────────────────── */
function levelComplete() {
  stopAllTimers();
  G.gameActive = false;

  const timeBonus = G.timerSec * 5;
  const studyBonus = G.studiesOk * 30;
  const total = G.levelDef.baseScore + timeBonus + studyBonus;
  G.score += total;

  const accuracy = G.studiesOk + G.studiesFailed > 0
    ? Math.round(G.studiesOk / (G.studiesOk + G.studiesFailed) * 100)
    : 100;

  const stars = accuracy >= 95 ? 3 : accuracy >= 75 ? 2 : 1;

  document.getElementById('lcTitle').textContent = G.levelDef.title.toUpperCase() + ' — RESTORED';
  document.getElementById('lcScore').textContent = total.toLocaleString();
  document.getElementById('lcTime').textContent = G.timerSec + 's';
  document.getElementById('lcStudies').textContent = G.studiesOk;
  document.getElementById('lcAccuracy').textContent = accuracy + '%';
  document.getElementById('starsRow').innerHTML = '⭐'.repeat(stars) + '☆'.repeat(3-stars);

  const cleared = parseInt(localStorage.getItem('pacsgame_cleared') || '0');
  localStorage.setItem('pacsgame_cleared', Math.max(cleared, G.levelDef.id));

  const isLast = G.currentLevel >= LEVELS.length - 1;
  document.getElementById('btnNextLevel').textContent = isLast ? '⬡ FINAL SCORE' : 'NEXT LEVEL ►';

  showScreen('screen-levelcomplete');
}

function gameOver(reason) {
  stopAllTimers();
  G.gameActive = false;
  document.getElementById('goScore').textContent = G.score.toLocaleString();
  document.getElementById('goLevel').textContent = G.levelDef ? G.levelDef.id : 1;
  document.getElementById('goReason').textContent = reason || 'The hospital imaging system has gone offline.';
  document.getElementById('btnSaveScore').disabled = false;
  showScreen('screen-gameover');
}

function showVictory() {
  document.getElementById('goScore').textContent = G.score.toLocaleString();
  document.getElementById('goLevel').textContent = 'ALL ' + LEVELS.length;
  document.getElementById('goReason').textContent = '🏆 ALL LEVELS COMPLETED — Hospital imaging fully restored!';
  document.getElementById('btnSaveScore').disabled = false;
  showScreen('screen-gameover');
}

/* ─────────────────────────────────────
   EMERGENCY EVENTS
───────────────────────────────────── */
function scheduleEmergency(chance) {
  const delay = 15000 + Math.random() * 20000;
  G.emergencyEventInterval = setTimeout(() => {
    if (G.gameActive && Math.random() < chance) triggerEmergency();
  }, delay);
}

function triggerEmergency() {
  if (G.emergencyActive) return;
  G.emergencyActive = true;

  const event = EMERGENCY_EVENTS[Math.floor(Math.random() * EMERGENCY_EVENTS.length)];
  G.emergencyTimerSec = 30;

  const banner = document.getElementById('emergencyBanner');
  document.getElementById('emergencyDesc').textContent = event.desc;
  document.getElementById('emergencyTimer').textContent = G.emergencyTimerSec;
  banner.classList.add('active');

  logMsg(`🚨 EMERGENCY: ${event.desc}`, 'error');
  toast(`🚨 STAT CASE: ${event.desc}`, 'error');

  // Add emergency study to queue
  const emergStudy = {
    id: 'emerg_' + Date.now(),
    modality: event.modality,
    patient: 'STAT — PRIORITY',
    size: event.size,
    stat: true,
    destination: 'pacs',
    emergencyBonus: event.bonus
  };
  G.studyData.unshift(emergStudy);
  buildStudyCard(emergStudy);
  document.getElementById('queueCount').textContent = G.studyData.length;

  // Emergency countdown
  G.emergencyInterval = setInterval(() => {
    if (!G.gameActive || G.paused) return;
    G.emergencyTimerSec--;
    document.getElementById('emergencyTimer').textContent = G.emergencyTimerSec;

    if (G.emergencyTimerSec <= 0) {
      clearInterval(G.emergencyInterval);
      banner.classList.remove('active');
      G.emergencyActive = false;
      // Check if study was routed
      const still = G.studyData.find(s => s.id === emergStudy.id);
      if (still) {
        toast('EMERGENCY CASE TIMED OUT — penalty!', 'error');
        addScore(-500);
        G.studyData = G.studyData.filter(s => s.id !== emergStudy.id);
        const card = document.getElementById(`study-${emergStudy.id}`);
        if (card) card.remove();
        document.getElementById('queueCount').textContent = G.studyData.length;
      } else {
        addScore(emergStudy.emergencyBonus || 300);
        toast(`Emergency handled! +${emergStudy.emergencyBonus || 300}pts bonus`, 'success');
      }
    }
  }, 1000);
}

/* ─────────────────────────────────────
   PAUSE / RESUME / QUIT
───────────────────────────────────── */
function pauseGame() {
  G.paused = true;
  document.getElementById('pauseOverlay').classList.remove('hidden');
}
function resumeGame() {
  G.paused = false;
  document.getElementById('pauseOverlay').classList.add('hidden');
}
function quitToMenu() {
  stopAllTimers();
  G.gameActive = false;
  G.paused = false;
  document.getElementById('pauseOverlay').classList.add('hidden');
  clearGameArea();
  loadTitleStats();
  showScreen('screen-title');
}

/* ─────────────────────────────────────
   SCORE
───────────────────────────────────── */
function addScore(pts) {
  G.score = Math.max(0, G.score + pts);
  const el = document.getElementById('hudScore');
  if (el) el.textContent = G.score;
}

/* ─────────────────────────────────────
   SYSTEM LOG
───────────────────────────────────── */
function logMsg(msg, type='info') {
  const list = document.getElementById('msgList');
  if (!list) return;
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  const ts = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  div.textContent = `[${ts}] ${msg}`;
  list.prepend(div);
  // Keep max 20 entries
  while (list.children.length > 20) list.lastChild.remove();
}

/* ─────────────────────────────────────
   TOAST NOTIFICATIONS
───────────────────────────────────── */
function toast(msg, type='info') {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3300);
}

/* ─────────────────────────────────────
   KEYBOARD SHORTCUTS
───────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (!G.gameActive) return;
  if (e.key === 'Escape') {
    if (!document.getElementById('configPanel').classList.contains('hidden')) {
      closeConfig();
    } else if (G.paused) {
      resumeGame();
    } else {
      pauseGame();
    }
  }
  if (e.key === 'p' || e.key === 'P') {
    G.paused ? resumeGame() : pauseGame();
  }
});
