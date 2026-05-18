/**
 * A Night With The Paratha — core game logic.
 * Media: assets/sounds/ and assets/images/ (see ASSETS.txt).
 */
const ASSET_SOUNDS = {
  menuAmbience: "assets/sounds/menu.mp3",
  officeAmbience: "assets/sounds/ambiance.mp3",
  doorClose: "assets/sounds/doorclose.mp3",
  doorOpen: "assets/sounds/dooropen.mp3",
  cameraOpen: "assets/sounds/camopen.mp3",
  /** Short click when choosing a feed on the map (use camswitch.mp3 or cameraselect.mp3). */
  cameraSelect: "assets/sounds/camswitch.mp3",
  cameraStatic: "assets/sounds/camstatic.mp3",
  powerOut: "assets/sounds/powerout.mp3",
  scream: "assets/sounds/scream.mp3",
  win6am: "assets/sounds/6am.mp3",
  parathaLaugh: "assets/sounds/Parathalaugh.mp3",
  phoneCall1: "assets/sounds/phonecall1.mp3",
};

const ASSET_IMAGES = {
  jumpscare: "assets/images/jumpscare.jpg",
  hallEntity: "assets/images/hall.jpg",
  camSprites: {
    khalid: "assets/images/khalid.png",
    billo: "assets/images/billo.png",
    labib: "assets/images/labib.png",
    jibran: "assets/images/jibran.png",
  },
  camRoomBg: [
    "assets/images/stage.jpg",
    "assets/images/dining.jpg",
    "assets/images/arcade.jpg",
    "assets/images/kitchen.jpg",
    "assets/images/storage.jpg",
    "assets/images/counter.jpg",
    "assets/images/securityhall.jpg",
    "assets/images/lobby.jpg",
    "assets/images/bathroom.jpg",
  ],
};

const CAMERAS = [
  { id: "01", label: "CAM 01 — STAGE", room: 0 },
  { id: "02", label: "CAM 02 — DINING AREA", room: 1 },
  { id: "03", label: "CAM 03 — ARCADE", room: 2 },
  { id: "04", label: "CAM 04 — KITCHEN", room: 3 },
  { id: "05", label: "CAM 05 — STORAGE", room: 4 },
  { id: "06", label: "CAM 06 — COUNTER", room: 5 },
  { id: "07", label: "CAM 07 — SECURITY HALL", room: 6 },
  { id: "08", label: "CAM 08 — LOBBY", room: 7 },
  { id: "09", label: "CAM 09 — BATHROOM HALL", room: 8 },
];

/** Single-night difficulty (all animatronics active from the start). */
const NIGHT_MOVE_FACTOR = 0.52;
const AI_TICK_MS = 1900;

const ANIMATRONICS = [
  {
    key: "khalid",
    suit: "Brown Lion",
    name: "Khalid Parathawala",
    path: [0, 2, 4, 6, 8],
    aggression: 1,
  },
  {
    key: "billo",
    suit: "Blue Cat",
    name: "Billo Baji",
    path: [0, 1, 2, 3,6, 8],
    aggression: 1.05,
  },
  {
    key: "labib",
    suit: "Orange Fox",
    name: "Labib Lumbri",
    path: [4, 6, 5, 7],
    aggression: 1.12,
  },
  {
    key: "jibran",
    suit: "Green Croc",
    name: "Jibran Juban",
    path: [0, 1, 5, 6, 7],
    aggression: 1.08,
  },
];

/** One night ≈ 10 minutes real time (12 AM → 6 AM on the clock). */
const NIGHT_DURATION_MS = 10 * 60 * 1000;

let officeAmbienceNode = null;
let menuAmbienceNode = null;
let cameraStaticNode = null;
let soundsEnabled = true;

function playOneShot(key, volume = 0.55) {
  const path = ASSET_SOUNDS[key];
  if (!path) return;
  playUrl(path, volume);
}

function playUrl(url, volume = 0.55) {
  if (!url || !soundsEnabled) return;
  try {
    const a = new Audio(url);
    a.volume = volume;
    a.play().catch(() => {});
  } catch (_) {}
}

function startLoop(key, volume = 0.25) {
  const path = ASSET_SOUNDS[key];
  if (!path) return null;
  try {
    const a = new Audio(path);
    a.loop = true;
    a.volume = soundsEnabled ? volume : 0;
    a.preload = "auto";
    const p = a.play();
    if (p !== undefined) {
      p.catch(() => {
        /* Autoplay blocked until user gesture — armMenuAmbienceOnFirstGesture will retry */
      });
    }
    return a;
  } catch (_) {
    return null;
  }
}

function stopLoop(node) {
  if (node) {
    try {
      node.pause();
      node.currentTime = 0;
    } catch (_) {}
  }
}

/* --- Menu static canvas --- */
function initMenuStatic() {
  const canvas = document.getElementById("menu-static");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  function resize() {
    const vp = document.getElementById("viewport-43");
    canvas.width = vp?.clientWidth || window.innerWidth;
    canvas.height = vp?.clientHeight || window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);
  const vp = document.getElementById("viewport-43");
  if (vp && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resize).observe(vp);
  }
  function frame() {
    if (!document.getElementById("screen-menu")?.classList.contains("active")) {
      requestAnimationFrame(frame);
      return;
    }
    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
      d[i + 3] = 40;
    }
    ctx.putImageData(img, 0, 0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* --- Screens --- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function refreshMenu() {
  stopLoop(menuAmbienceNode);
  menuAmbienceNode = null;
  if (document.getElementById("screen-menu")?.classList.contains("active")) {
    menuAmbienceNode = startLoop("menuAmbience", 0.45);
  }
}

/** Browsers block audio until a click/tap/keypress; start menu music on first gesture. */
function armMenuAmbienceOnFirstGesture() {
  const kick = () => {
    document.removeEventListener("pointerdown", kick, true);
    document.removeEventListener("keydown", kick, true);
    if (!document.getElementById("screen-menu")?.classList.contains("active")) return;
    const a = menuAmbienceNode;
    if (a && !a.paused) return;
    stopLoop(menuAmbienceNode);
    menuAmbienceNode = null;
    menuAmbienceNode = startLoop("menuAmbience", 0.45);
  };
  document.addEventListener("pointerdown", kick, true);
  document.addEventListener("keydown", kick, true);
}

function syncFullscreenButton() {
  const btn = document.getElementById("btn-fullscreen");
  if (!btn) return;
  btn.textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
}

/* --- Game state --- */
let game = null;

function createNightState() {
  const bots = ANIMATRONICS.map((def) => {
    const { key, suit, name, path, aggression } = def;
    return { key, suit, name, path, aggression, pathIndex: 0 };
  });
  return {
    night: 1,
    power: 100,
    hour: 0,
    elapsedMs: 0,
    doorClosed: false,
    lightOn: false,
    camsUp: false,
    selectedCam: 0,
    bots,
    aiAccumulator: 0,
    blackout: false,
    ended: false,
    powerOutJumpscarePending: false,
    powerOutTimerId: null,
    nightTimers: [],
    jumpscareUiTimerId: null,
    paused: false,
  };
}

function clearAllNightTimers(g) {
  if (!g) return;
  if (g.powerOutTimerId) {
    clearTimeout(g.powerOutTimerId);
    g.powerOutTimerId = null;
  }
  if (g.jumpscareUiTimerId) {
    clearTimeout(g.jumpscareUiTimerId);
    g.jumpscareUiTimerId = null;
  }
  if (g.nightTimers?.length) {
    g.nightTimers.forEach((id) => clearTimeout(id));
    g.nightTimers = [];
  }
}

function playPhoneCallIntro() {
  playUrl(ASSET_SOUNDS.phoneCall1, 0.8);
}

function scheduleParathaLaughs(g) {
  if (!g?.nightTimers) return;
  const nLaughs = Math.random() < 0.5 ? 1 : 2;
  const startAfter = NIGHT_DURATION_MS * 0.12;
  const windowLen = NIGHT_DURATION_MS * 0.72;
  for (let i = 0; i < nLaughs; i++) {
    const delay = startAfter + Math.random() * windowLen;
    const id = window.setTimeout(() => {
      if (game !== g || g.ended || g.blackout || g.paused) return;
      playOneShot("parathaLaugh", 0.55);
    }, delay);
    g.nightTimers.push(id);
  }
}

function currentRoom(bot) {
  return bot.path[bot.pathIndex];
}

function atDoor(bot) {
  return bot.pathIndex >= bot.path.length - 1;
}

function formatClock(hourFloat) {
  const h = Math.min(5, Math.floor(hourFloat));
  const labels = ["12:00 AM", "1:00 AM", "2:00 AM", "3:00 AM", "4:00 AM", "5:00 AM"];
  if (hourFloat >= 6) return "6:00 AM";
  return labels[h] || "12:00 AM";
}

function buildCamButtons() {
  const grid = document.getElementById("cam-buttons");
  if (!grid) return;
  grid.innerHTML = "";
  CAMERAS.forEach((cam, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `CAM ${cam.id}`;
    b.dataset.index = String(i);
    b.addEventListener("click", () => selectCamera(i));
    grid.appendChild(b);
  });
}

function selectCamera(i) {
  if (!game || game.ended || game.paused) return;
  game.selectedCam = i;
  playOneShot("cameraSelect", 0.72);
  updateCamUI();
}

function updateCamButtonStyles() {
  const grid = document.getElementById("cam-buttons");
  if (!grid) return;
  grid.querySelectorAll("button").forEach((b, i) => {
    b.classList.toggle("selected", i === game.selectedCam);
  });
}

function updateCamUI() {
  if (!game) return;
  const cam = CAMERAS[game.selectedCam];
  const nameEl = document.getElementById("cam-name");
  if (nameEl) nameEl.textContent = cam.label;
  const roomBg = document.getElementById("cam-room-bg");
  if (roomBg && ASSET_IMAGES.camRoomBg) {
    const bgPath = ASSET_IMAGES.camRoomBg[cam.room];
    if (bgPath) {
      roomBg.style.backgroundImage = `url("${bgPath}")`;
    } else {
      roomBg.style.backgroundImage = "";
    }
  }
  const feed = document.getElementById("cam-sprites");
  if (!feed) return;
  feed.innerHTML = "";
  const room = cam.room;
  game.bots.forEach((bot) => {
    if (currentRoom(bot) !== room) return;
    const div = document.createElement("div");
    div.className = `cam-bot ${bot.key}`;
    div.title = `${bot.suit} — ${bot.name}`;
    const imgPath = ASSET_IMAGES.camSprites?.[bot.key];
    if (imgPath) {
      const img = document.createElement("img");
      img.src = imgPath;
      img.alt = bot.name;
      img.style.maxHeight = "100px";
      img.style.objectFit = "contain";
      div.style.background = "transparent";
      div.appendChild(img);
    }
    feed.appendChild(div);
  });
  updateCamButtonStyles();
}

function updateHUD() {
  if (!game) return;
  const nightEl = document.getElementById("hud-night");
  const clockEl = document.getElementById("hud-clock");
  const camClock = document.getElementById("cam-time-hud");
  const pct = document.getElementById("power-pct");
  const fill = document.getElementById("power-fill");
  const doorState = document.getElementById("door-state");
  const doorPanel = document.getElementById("door-panel");
  const btnDoor = document.getElementById("btn-door");
  const hall = document.querySelector(".hall");
  const hallEntity = document.getElementById("hall-entity");

  if (nightEl) nightEl.textContent = "Until 6 AM";
  const clk = formatClock(game.hour);
  if (clockEl) clockEl.textContent = clk;
  if (camClock) camClock.textContent = clk;
  if (pct) pct.textContent = `${Math.max(0, Math.ceil(game.power))}%`;
  if (fill) fill.style.width = `${Math.max(0, game.power)}%`;

  if (doorState) doorState.textContent = game.doorClosed ? "SHUT" : "OPEN";
  if (btnDoor) btnDoor.classList.toggle("active", game.doorClosed);
  if (doorPanel) doorPanel.classList.toggle("closed", game.doorClosed);

  const someoneAtDoor = game.bots.some((b) => atDoor(b));
  if (hall) hall.classList.toggle("lit", game.lightOn && !game.blackout);
  if (hallEntity) {
    const show = game.lightOn && someoneAtDoor && !game.blackout;
    hallEntity.classList.toggle("hidden", !show);
    const hallImg = ASSET_IMAGES.hallEntity;
    if (hallImg && hallEntity.dataset.imgApplied !== "1") {
      hallEntity.style.backgroundImage = `url("${hallImg}")`;
      hallEntity.style.backgroundSize = "contain";
      hallEntity.style.backgroundRepeat = "no-repeat";
      hallEntity.style.backgroundPosition = "center bottom";
      hallEntity.dataset.imgApplied = "1";
      hallEntity.classList.add("has-image");
    } else if (!hallImg) {
      hallEntity.classList.remove("has-image");
    }
  }
}

function syncCameraStaticLoop() {
  stopLoop(cameraStaticNode);
  cameraStaticNode = null;
  if (!game?.camsUp || game.ended || game.blackout || game.paused) return;
  if (!ASSET_SOUNDS.cameraStatic) return;
  cameraStaticNode = startLoop("cameraStatic", 0.22);
}

function setCamsUp(on) {
  if (!game || game.ended || game.blackout || game.paused) return;
  const was = game.camsUp;
  game.camsUp = on;
  const overlay = document.getElementById("camera-overlay");
  if (overlay) overlay.classList.toggle("hidden", !on);
  if (!on) {
    stopLoop(cameraStaticNode);
    cameraStaticNode = null;
    return;
  }
  if (!was) {
    playOneShot("cameraOpen", 0.4);
  }
  syncCameraStaticLoop();
  updateCamUI();
}

function endGame(jumpscareBot, reasonText) {
  if (!game || game.ended) return;
  clearAllNightTimers(game);
  game.powerOutJumpscarePending = false;
  game.ended = true;
  game.paused = false;
  document.getElementById("pause-overlay")?.classList.add("hidden");
  stopLoop(officeAmbienceNode);
  officeAmbienceNode = null;
  stopLoop(cameraStaticNode);
  cameraStaticNode = null;
  game.camsUp = false;
  document.getElementById("camera-overlay")?.classList.add("hidden");
  playOneShot("scream", 0.88);

  const face = document.getElementById("jumpscare-face");
  if (face && ASSET_IMAGES.jumpscare) {
    face.style.backgroundImage = `url("${ASSET_IMAGES.jumpscare}")`;
    face.style.backgroundSize = "cover";
    face.style.backgroundPosition = "center";
    face.classList.add("has-image");
  } else if (face) {
    face.classList.remove("has-image");
  }
  if (face && jumpscareBot) {
    face.title = jumpscareBot.name;
  }

  const goReason = document.getElementById("go-reason");
  if (goReason) {
    goReason.textContent = reasonText || "You are no longer the night guard.";
  }

  const wrap = document.querySelector(".jumpscare-wrap");
  const panel = document.getElementById("gameover-panel");
  if (wrap) wrap.classList.remove("hidden");
  if (panel) panel.classList.add("during-scare");

  showScreen("screen-gameover");

  game.jumpscareUiTimerId = window.setTimeout(() => {
    if (wrap) wrap.classList.add("hidden");
    if (panel) panel.classList.remove("during-scare");
    game.jumpscareUiTimerId = null;
  }, 2000);
}

function winNight() {
  if (!game || game.ended) return;
  clearAllNightTimers(game);
  game.powerOutJumpscarePending = false;
  game.ended = true;
  game.paused = false;
  document.getElementById("pause-overlay")?.classList.add("hidden");
  stopLoop(officeAmbienceNode);
  officeAmbienceNode = null;
  stopLoop(cameraStaticNode);
  cameraStaticNode = null;
  playOneShot("win6am", 0.6);
  document.getElementById("win-message").textContent =
    "Morning, Humayun. One long night at the Pakistani Paratha Restaraunt — and you walked out.";
  showScreen("screen-win");
}

function tickAI(dtMs) {
  if (!game || game.ended || game.blackout || game.paused) return;
  const factor = NIGHT_MOVE_FACTOR;
  game.aiAccumulator += dtMs;
  const interval = AI_TICK_MS;
  while (game.aiAccumulator >= interval) {
    game.aiAccumulator -= interval;
    game.bots.forEach((bot) => {
      if (atDoor(bot) && game.doorClosed) return;
      const roll = Math.random();
      const stepsLeft = bot.path.length - 1 - bot.pathIndex;
      const moveP =
        0.075 *
        factor *
        bot.aggression *
        (1 + stepsLeft * 0.065);
      if (roll < moveP && bot.pathIndex < bot.path.length - 1) {
        bot.pathIndex += 1;
      }
    });
  }

  const killer = game.bots.find((b) => atDoor(b) && !game.doorClosed);
  if (killer) {
    endGame(killer, `${killer.name} found you.`);
  }

  if (game.camsUp) updateCamUI();
}

function tickPower(dtMs) {
  if (!game || game.ended || game.paused) return;
  const sec = dtMs / 1000;
  let rate = 0.12;
  if (game.doorClosed) rate += 0.32;
  if (game.lightOn) rate += 0.38;
  if (game.camsUp) rate += 0.22;
  game.power -= rate * sec;
  if (game.power <= 0) {
    game.power = 0;
    if (!game.blackout) {
      game.blackout = true;
      game.lightOn = false;
      game.camsUp = false;
      stopLoop(cameraStaticNode);
      cameraStaticNode = null;
      const overlay = document.getElementById("camera-overlay");
      if (overlay) overlay.classList.add("hidden");
      document.getElementById("blackout")?.classList.remove("hidden");
      playOneShot("powerOut", 0.7);
      stopLoop(officeAmbienceNode);
      officeAmbienceNode = null;
      game.powerOutJumpscarePending = true;
      game.powerOutTimerId = window.setTimeout(() => {
        if (game && game.powerOutJumpscarePending && !game.ended) {
          const bot = game.bots[(Math.random() * game.bots.length) | 0];
          endGame(bot, "The backup generator never came. Neither did you.");
        }
      }, 4500);
    }
  }
}

function tickTime(dtMs) {
  if (!game || game.ended || game.paused) return;
  game.elapsedMs += dtMs;
  game.hour = (game.elapsedMs / NIGHT_DURATION_MS) * 6;
  if (game.hour >= 6) {
    game.hour = 6;
    winNight();
  }
}

let lastTs = 0;
function gameLoop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(100, ts - lastTs);
  lastTs = ts;
  if (game && !game.ended && document.getElementById("screen-game")?.classList.contains("active")) {
    if (!game.paused) {
      tickPower(dt);
      tickTime(dt);
      tickAI(dt);
    }
    updateHUD();
  }
  requestAnimationFrame(gameLoop);
}

function startNight() {
  lastTs = 0;
  clearAllNightTimers(game);
  stopLoop(cameraStaticNode);
  cameraStaticNode = null;
  document.getElementById("pause-overlay")?.classList.add("hidden");
  game = createNightState();
  const face = document.getElementById("jumpscare-face");
  if (face) {
    face.classList.remove("has-image");
    face.style.backgroundImage = "";
    face.title = "";
  }
  const hallEnt = document.getElementById("hall-entity");
  if (hallEnt) {
    hallEnt.dataset.imgApplied = "0";
    hallEnt.style.backgroundImage = "";
    hallEnt.classList.remove("has-image");
  }
  document.getElementById("blackout")?.classList.add("hidden");
  document.getElementById("camera-overlay")?.classList.add("hidden");
  stopLoop(officeAmbienceNode);
  officeAmbienceNode = startLoop("officeAmbience", 0.22);
  showScreen("screen-game");
  buildCamButtons();
  updateHUD();
  updateCamUI();
  scheduleParathaLaughs(game);
  window.setTimeout(() => {
    if (game && !game.ended && !game.paused) {
      playPhoneCallIntro();
    }
  }, 900);
}

function updatePauseSoundsLabel() {
  const btn = document.getElementById("btn-pause-sounds");
  if (btn) btn.textContent = soundsEnabled ? "Sounds: On" : "Sounds: Off";
}

function applyLoopVolumesAfterSoundToggle() {
  if (menuAmbienceNode) menuAmbienceNode.volume = soundsEnabled ? 0.45 : 0;
  if (officeAmbienceNode) officeAmbienceNode.volume = soundsEnabled ? 0.22 : 0;
  if (cameraStaticNode) cameraStaticNode.volume = soundsEnabled ? 0.22 : 0;
}

function pauseGame() {
  if (!game || game.ended || game.blackout || game.paused) return;
  game.paused = true;
  document.getElementById("pause-overlay")?.classList.remove("hidden");
  stopLoop(officeAmbienceNode);
  officeAmbienceNode = null;
  stopLoop(cameraStaticNode);
  cameraStaticNode = null;
  updatePauseSoundsLabel();
}

function resumeGame() {
  if (!game || !game.paused || game.ended) return;
  game.paused = false;
  document.getElementById("pause-overlay")?.classList.add("hidden");
  if (!game.blackout) {
    officeAmbienceNode = startLoop("officeAmbience", 0.22);
    if (game.camsUp) {
      syncCameraStaticLoop();
    }
  }
}

function togglePauseFromGame() {
  if (!game || game.ended || game.blackout) return;
  if (game.paused) resumeGame();
  else pauseGame();
}

function returnToMainMenuFromGame() {
  clearAllNightTimers(game);
  stopLoop(officeAmbienceNode);
  officeAmbienceNode = null;
  stopLoop(cameraStaticNode);
  cameraStaticNode = null;
  game = null;
  document.getElementById("pause-overlay")?.classList.add("hidden");
  document.getElementById("camera-overlay")?.classList.add("hidden");
  document.getElementById("blackout")?.classList.add("hidden");
  showScreen("screen-menu");
  refreshMenu();
}

/* --- Wire UI --- */
function init() {
  initMenuStatic();
  refreshMenu();
  armMenuAmbienceOnFirstGesture();

  document.getElementById("btn-new-game")?.addEventListener("click", () => {
    stopLoop(menuAmbienceNode);
    menuAmbienceNode = null;
    startNight();
  });

  document.getElementById("btn-fullscreen")?.addEventListener("click", async () => {
    const el = document.getElementById("fs-target");
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (_) {}
    syncFullscreenButton();
  });
  document.addEventListener("fullscreenchange", syncFullscreenButton);
  syncFullscreenButton();

  document.getElementById("btn-how")?.addEventListener("click", () => showScreen("screen-how"));
  document.getElementById("btn-how-back")?.addEventListener("click", () => {
    showScreen("screen-menu");
    refreshMenu();
  });

  document.getElementById("btn-pause")?.addEventListener("click", () => {
    pauseGame();
  });

  document.getElementById("btn-pause-resume")?.addEventListener("click", () => {
    resumeGame();
  });

  document.getElementById("btn-pause-sounds")?.addEventListener("click", () => {
    soundsEnabled = !soundsEnabled;
    updatePauseSoundsLabel();
    applyLoopVolumesAfterSoundToggle();
  });

  document.getElementById("btn-pause-menu")?.addEventListener("click", () => {
    returnToMainMenuFromGame();
  });

  document.getElementById("btn-door")?.addEventListener("click", () => {
    if (!game || game.ended || game.blackout || game.paused) return;
    game.doorClosed = !game.doorClosed;
    playOneShot(game.doorClosed ? "doorClose" : "doorOpen", 0.5);
    updateHUD();
  });

  const btnLight = document.getElementById("btn-light");
  const lightOn = () => {
    if (!game || game.ended || game.blackout || game.paused) return;
    game.lightOn = true;
    updateHUD();
  };
  const lightOff = () => {
    if (!game) return;
    game.lightOn = false;
    updateHUD();
  };
  btnLight?.addEventListener("mousedown", lightOn);
  btnLight?.addEventListener("mouseup", lightOff);
  btnLight?.addEventListener("mouseleave", lightOff);
  btnLight?.addEventListener("touchstart", (e) => {
    e.preventDefault();
    lightOn();
  });
  btnLight?.addEventListener("touchend", lightOff);

  document.getElementById("btn-cams")?.addEventListener("click", () => {
    if (!game || game.ended || game.blackout || game.paused) return;
    setCamsUp(!game.camsUp);
  });

  document.getElementById("btn-close-cams")?.addEventListener("click", () => setCamsUp(false));

  document.getElementById("btn-retry")?.addEventListener("click", () => {
    startNight();
  });

  document.getElementById("btn-menu")?.addEventListener("click", () => {
    clearAllNightTimers(game);
    game = null;
    document.querySelector(".jumpscare-wrap")?.classList.add("hidden");
    document.getElementById("gameover-panel")?.classList.remove("during-scare");
    showScreen("screen-menu");
    refreshMenu();
  });

  document.getElementById("btn-win-retry")?.addEventListener("click", () => {
    startNight();
  });

  document.getElementById("btn-win-menu")?.addEventListener("click", () => {
    showScreen("screen-menu");
    refreshMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (!game || game.ended || game.blackout) return;
    if (e.code === "Escape") {
      if (game.paused) {
        resumeGame();
        return;
      }
      if (game.camsUp) {
        setCamsUp(false);
        return;
      }
      togglePauseFromGame();
    }
    if (e.code === "KeyP" && !e.repeat) {
      togglePauseFromGame();
    }
  });

  requestAnimationFrame(gameLoop);
  updatePauseSoundsLabel();
}

document.addEventListener("DOMContentLoaded", init);
