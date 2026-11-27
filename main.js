// main.js — Core Engine, Disappearing Exploded Vehicles, Clean Cabin Seating & Car YouTube Player
import { buildWorld, clamp, PAL } from "./world.js";
import {
  createPlayer,
  spawnWorldEntities,
  shootGun,
  punchAttack,
  updateCombat,
  animateHuman,
} from "./entities.js";
import { buildHuman, randomOutfit } from "./Characters.js";

const THREE = window.THREE;
const $ = (id) => document.getElementById(id);

const SESSION_GAME_KEY = "lanka_openworld_session_v1";
const SESSION_MEDIA_KEY = "lanka_car_media_session_v1";

/* ---------- Balanced Web Audio & File Engine ---------- */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.lastHonkTime = 0;
    this.wadeAudio = new Audio("./රස_බලන්න_වඩේ_කඩේ.mp3");
    this.wadeAudio.preload = "auto";
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      comp.attack.value = 0.01;
      comp.release.value = 0.2;

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      comp.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.out = comp;

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 48;

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = "lowpass";
      this.engineFilter.frequency.value = 190;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0001;

      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.out);
      this.engineOsc.start();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  playTone(freq, type, duration, vol = 0.14, slideTo = null) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo)
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.out || this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
  updateEngine(vehicle, dt, ytPlaying = false) {
    if (!this.ctx || !this.engineGain) return;
    const now = this.ctx.currentTime;
    if (!vehicle || vehicle.exploded) {
      this.engineGain.gain.setTargetAtTime(0.0001, now, 0.08);
      return;
    }
    const spd = Math.abs(vehicle.speed);
    const baseFreq =
      vehicle.type === "bus" ? 36 : vehicle.type === "tuk" ? 64 : 46;
    const maxFreq =
      vehicle.type === "bus" ? 88 : vehicle.type === "tuk" ? 155 : 122;
    const targetFreq = baseFreq + Math.min(1, spd / 15) * (maxFreq - baseFreq);

    const musicDuck = ytPlaying ? 0.45 : 1.0;
    const targetVol = (0.032 + Math.min(1, spd / 15) * 0.045) * musicDuck;

    this.engineOsc.type = vehicle.type === "tuk" ? "triangle" : "sawtooth";
    this.engineFilter.frequency.setTargetAtTime(
      160 + Math.min(1, spd / 15) * 180,
      now,
      0.08,
    );
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.07);
    this.engineGain.gain.setTargetAtTime(targetVol, now, 0.08);
  }
  horn(isBus = false, volScale = 1.0) {
    this.init();
    const v = clamp(volScale, 0, 1);
    if (v <= 0.03) return;
    if (isBus) {
      this.playTone(175, "sawtooth", 0.34, 0.13 * v);
      this.playTone(220, "sawtooth", 0.34, 0.13 * v);
    } else {
      this.playTone(430, "triangle", 0.13, 0.11 * v);
      setTimeout(() => this.playTone(430, "triangle", 0.16, 0.11 * v), 155);
    }
  }
  trafficHonk(type, dist) {
    if (!this.ctx || dist > 42) return;
    const now = performance.now();
    if (now - this.lastHonkTime < 1600) return;
    this.lastHonkTime = now;
    const vol = clamp(1 - dist / 42, 0, 1) * 0.65;
    if (type === "tuk") {
      this.playTone(520, "triangle", 0.11, 0.09 * vol);
      setTimeout(() => this.playTone(520, "triangle", 0.12, 0.09 * vol), 140);
    } else {
      this.horn(type === "bus", vol);
    }
  }
  explosion() {
    this.init();
    this.playTone(110, "sawtooth", 0.65, 0.35, 24);
    this.playTone(75, "triangle", 0.85, 0.32, 20);
    setTimeout(() => this.playTone(90, "sawtooth", 0.45, 0.22, 28), 90);
  }
  bump(strong = false) {
    this.init();
    this.playTone(strong ? 130 : 180, "sine", 0.14, strong ? 0.2 : 0.1, 48);
  }
  shoot() {
    this.init();
    this.playTone(320, "sawtooth", 0.16, 0.22, 45);
  }
  punch() {
    this.init();
    this.playTone(160, "triangle", 0.12, 0.2, 55);
  }
  hit(headshot = false) {
    this.init();
    this.playTone(
      headshot ? 980 : 680,
      "triangle",
      0.11,
      0.2,
      headshot ? 420 : 220,
    );
  }
  cash() {
    this.init();
    this.playTone(587, "sine", 0.12, 0.16);
    setTimeout(() => this.playTone(880, "sine", 0.25, 0.18), 110);
  }
  wadeCall(dist = 0, maxDist = 28) {
    if (!this.wadeAudio || !this.wadeAudio.paused) return;
    this.updateWadeVolume(dist, maxDist);
    if (this.wadeAudio.volume <= 0.01) return;
    this.wadeAudio.currentTime = 0;
    this.wadeAudio.play().catch(() => {});
  }
  updateWadeVolume(dist, maxDist = 28) {
    if (!this.wadeAudio) return;
    const ratio = clamp(1 - Math.max(0, dist - 2.5) / (maxDist - 2.5), 0, 1);
    this.wadeAudio.volume = ratio * ratio;
  }
  stopWade() {
    if (this.wadeAudio && !this.wadeAudio.paused) {
      this.wadeAudio.pause();
      this.wadeAudio.currentTime = 0;
    }
  }
}
const sfx = new SoundEngine();

/* ---------- Session Storage Helpers (Media Player & Game Progress) ---------- */
function loadMediaSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_MEDIA_KEY)) || {};
  } catch (e) {
    return {};
  }
}
function saveMediaSession(patch) {
  try {
    const cur = loadMediaSession();
    sessionStorage.setItem(
      SESSION_MEDIA_KEY,
      JSON.stringify({ ...cur, ...patch }),
    );
  } catch (e) {}
}

/* ---------- In-Vehicle YouTube Media Player Popup ---------- */
function extractYouTubeId(input) {
  const str = (input || "").trim();
  if (!str) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

function setupCarMediaPlayer() {
  let box = $("car-media-player");
  if (box) return box;

  const saved = loadMediaSession();
  const initVol = saved.volume !== undefined ? saved.volume : 75;
  const initUrl = saved.url || "";

  box = document.createElement("div");
  box.id = "car-media-player";
  box.style.cssText = `
    position: fixed;
    right: 18px;
    bottom: 18px;
    width: 325px;
    background: rgba(15, 23, 42, 0.92);
    border: 1px solid rgba(250, 204, 21, 0.35);
    border-radius: 14px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
    color: #f8fafc;
    font-family: sans-serif;
    z-index: 1000;
    display: none;
    flex-direction: column;
    overflow: hidden;
    backdrop-filter: blur(8px);
  `;

  box.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(30,41,59,0.95);border-bottom:1px solid rgba(255,255,255,0.1);">
      <div style="display:flex;align-items:center;gap:7px;">
        <span style="width:9px;height:9px;border-radius:50%;background:#ef4444;display:inline-block;"></span>
        <span style="font-size:12px;font-weight:700;letter-spacing:0.4px;color:#facc15;">CAR YOUTUBE PLAYER</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:10px;color:#94a3b8;">[P] Cursor</span>
        <button id="yt-min-btn" title="Minimize/Expand" style="background:rgba(255,255,255,0.12);border:none;color:#fff;border-radius:5px;width:22px;height:22px;cursor:pointer;font-weight:bold;">${saved.minimized ? "+" : "–"}</button>
      </div>
    </div>

    <div id="yt-body" style="padding:10px;display:${saved.minimized ? "none" : "flex"};flex-direction:column;gap:8px;">
      <div style="display:flex;gap:5px;">
        <input id="yt-url-input" type="text" value="${initUrl.replace(/"/g, "&quot;")}" placeholder="Paste YouTube link or Video ID..."
          style="flex:1;padding:6px 8px;border-radius:7px;border:1px solid rgba(255,255,255,0.2);background:#0f172a;color:#fff;font-size:12px;outline:none;" />
        <button id="yt-load-btn" style="padding:6px 11px;border-radius:7px;border:none;background:#facc15;color:#0f172a;font-weight:700;font-size:12px;cursor:pointer;">Play</button>
      </div>

      <div style="display:flex;gap:5px;flex-wrap:wrap;">
        <button class="yt-preset" data-vid="jfKfPfyJRdk" style="flex:1;padding:4px 6px;font-size:11px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#e2e8f0;cursor:pointer;">Lofi Radio</button>
        <button class="yt-preset" data-vid="rUxyKA_-grg" style="flex:1;padding:4px 6px;font-size:11px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#e2e8f0;cursor:pointer;">Chill Beats</button>
        <button class="yt-preset" data-vid="5qap5aO4i9A" style="flex:1;padding:4px 6px;font-size:11px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#e2e8f0;cursor:pointer;">Drive Mix</button>
      </div>

      <div style="position:relative;width:100%;height:148px;background:#020617;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
        <iframe id="yt-iframe" width="100%" height="148" src="" title="YouTube Player"
          frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding-top:2px;">
        <div style="display:flex;gap:5px;">
          <button id="yt-play-btn" style="padding:5px 10px;border-radius:6px;border:none;background:#22c55e;color:#052e16;font-weight:700;font-size:11px;cursor:pointer;">▶ Play</button>
          <button id="yt-pause-btn" style="padding:5px 10px;border-radius:6px;border:none;background:#eab308;color:#422006;font-weight:700;font-size:11px;cursor:pointer;">❚❚ Pause</button>
          <button id="yt-mute-btn" style="padding:5px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;font-size:11px;cursor:pointer;">${saved.muted ? "🔇" : "🔊"}</button>
        </div>
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="font-size:11px;color:#94a3b8;">Vol</span>
          <input id="yt-vol-slider" type="range" min="0" max="100" value="${initVol}" style="width:68px;accent-color:#facc15;cursor:pointer;" />
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(box);
  return box;
}

const carMediaEl = setupCarMediaPlayer();
const ytIframe = $("yt-iframe");
const ytBody = $("yt-body");
const initialMedia = loadMediaSession();
let ytIsPlaying = false;
let ytMuted = !!initialMedia.muted;
let ytMinimized = !!initialMedia.minimized;

function sendYTCommand(func, args = []) {
  if (!ytIframe || !ytIframe.contentWindow) return;
  ytIframe.contentWindow.postMessage(
    JSON.stringify({ event: "command", func, args }),
    "*",
  );
}

function stopCarMediaPlayer() {
  sendYTCommand("stopVideo");
  ytIframe.src = "";
  ytIsPlaying = false;
  carMediaEl.style.display = "none";
}

function openCarMediaPlayerFromSession() {
  const s = loadMediaSession();
  ytMuted = !!s.muted;
  ytMinimized = !!s.minimized;
  const vol = s.volume !== undefined ? s.volume : 75;
  $("yt-vol-slider").value = vol;
  $("yt-mute-btn").textContent = ytMuted ? "🔇" : "🔊";
  ytBody.style.display = ytMinimized ? "none" : "flex";
  $("yt-min-btn").textContent = ytMinimized ? "+" : "–";
  if (s.url) $("yt-url-input").value = s.url;
  carMediaEl.style.display = "flex";

  if (s.vid && s.autoResume) {
    loadYouTubeVideo(s.vid, false);
  }
}

function loadYouTubeVideo(rawInput, updateInput = true) {
  const vid = extractYouTubeId(rawInput);
  if (!vid) {
    toast("Invalid YouTube link or Video ID");
    return;
  }
  const cleanUrl = rawInput.includes("http")
    ? rawInput.trim()
    : `https://youtu.be/${vid}`;
  if (updateInput) $("yt-url-input").value = cleanUrl;
  saveMediaSession({ vid, url: cleanUrl, autoResume: true });

  ytIframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`;
  ytIsPlaying = true;
  setTimeout(() => {
    const vol = parseInt($("yt-vol-slider").value, 10) || 75;
    sendYTCommand("setVolume", [vol]);
    if (ytMuted) sendYTCommand("mute");
  }, 1200);
}

$("yt-load-btn").addEventListener("click", () => {
  loadYouTubeVideo($("yt-url-input").value);
});
$("yt-url-input").addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.code === "Enter") loadYouTubeVideo($("yt-url-input").value);
});
$("yt-play-btn").addEventListener("click", () => {
  const s = loadMediaSession();
  if (!ytIframe.src) loadYouTubeVideo(s.vid || "jfKfPfyJRdk");
  else sendYTCommand("playVideo");
  ytIsPlaying = true;
  saveMediaSession({ autoResume: true });
});
$("yt-pause-btn").addEventListener("click", () => {
  sendYTCommand("pauseVideo");
  ytIsPlaying = false;
  saveMediaSession({ autoResume: false });
});
$("yt-mute-btn").addEventListener("click", () => {
  ytMuted = !ytMuted;
  sendYTCommand(ytMuted ? "mute" : "unMute");
  $("yt-mute-btn").textContent = ytMuted ? "🔇" : "🔊";
  saveMediaSession({ muted: ytMuted });
});
$("yt-vol-slider").addEventListener("input", (e) => {
  const v = parseInt(e.target.value, 10);
  sendYTCommand("setVolume", [v]);
  saveMediaSession({ volume: v });
});
$("yt-min-btn").addEventListener("click", () => {
  ytMinimized = !ytMinimized;
  ytBody.style.display = ytMinimized ? "none" : "flex";
  $("yt-min-btn").textContent = ytMinimized ? "+" : "–";
  saveMediaSession({ minimized: ytMinimized });
});
carMediaEl.querySelectorAll(".yt-preset").forEach((btn) => {
  btn.addEventListener("click", () => {
    const vid = btn.getAttribute("data-vid");
    loadYouTubeVideo(`https://youtu.be/${vid}`);
  });
});

/* ---------- Clean Compact Prompts & Vehicle Health Row Inside Player Meter ---------- */
let vehHpRowEl = null;

function refineHUDLayout() {
  const interact = $("interact");
  if (interact) {
    interact.style.cssText = `
      position: fixed;
      top: 72px;
      bottom: auto;
      left: 50%;
      right: auto;
      transform: translateX(-50%);
      width: max-content;
      max-width: 90vw;
      height: auto;
      padding: 7px 16px;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(250, 204, 21, 0.55);
      border-radius: 999px;
      color: #fef08a;
      font-family: sans-serif;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
      pointer-events: none;
      z-index: 960;
      display: none;
    `;
  }

  const toastEl = $("toast");
  if (toastEl) {
    toastEl.style.cssText = `
      position: fixed;
      top: 112px;
      bottom: auto;
      left: 50%;
      right: auto;
      transform: translateX(-50%);
      width: max-content;
      max-width: 90vw;
      height: auto;
      padding: 7px 16px;
      background: rgba(15, 23, 42, 0.86);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 10px;
      color: #ffffff;
      font-family: sans-serif;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
      pointer-events: none;
      z-index: 955;
      display: none;
    `;
  }

  const hpBar = $("hp-bar");
  const stamBar = $("stam-bar");
  if (hpBar && stamBar && !$("veh-hp-bar")) {
    const hpTrack = hpBar.parentElement;
    const stamTrack = stamBar.parentElement;

    if (
      hpTrack &&
      stamTrack &&
      hpTrack.parentElement === stamTrack.parentElement
    ) {
      const vehTrack = stamTrack.cloneNode(true);
      const inner =
        vehTrack.querySelector("#stam-bar") || vehTrack.firstElementChild;
      if (inner) {
        inner.id = "veh-hp-bar";
        inner.style.width = "100%";
        inner.style.background = "#f59e0b";
      }
      vehTrack.id = "veh-hp-row";
      vehTrack.style.marginTop = "5px";
      vehTrack.style.display = "none";
      stamTrack.parentElement.insertBefore(vehTrack, stamTrack.nextSibling);
      vehHpRowEl = vehTrack;
    } else if (stamTrack && stamTrack.parentElement) {
      const stamRow = stamTrack.parentElement;
      const vehRow = stamRow.cloneNode(true);
      vehRow.id = "veh-hp-row";
      const inner = vehRow.querySelector("#stam-bar");
      if (inner) {
        inner.id = "veh-hp-bar";
        inner.style.width = "100%";
        inner.style.background = "#f59e0b";
      }
      vehRow.querySelectorAll("span, label, div").forEach((el) => {
        if (
          el.children.length === 0 &&
          /stam|stamina|energy|run/i.test(el.textContent)
        ) {
          el.textContent = "VEH";
        }
      });
      vehRow.style.display = "none";
      if (stamRow.parentElement) {
        stamRow.parentElement.insertBefore(vehRow, stamRow.nextSibling);
      }
      vehHpRowEl = vehRow;
    }
  }
}
refineHUDLayout();

function setupCrosshair() {
  let el = $("crosshair");
  if (!el) {
    el = document.createElement("div");
    el.id = "crosshair";
    document.body.appendChild(el);
  }
  el.style.cssText = `
    position: fixed;
    left: 50%;
    top: 50%;
    width: 30px;
    height: 30px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 999;
    display: none;
    transition: transform 0.08s ease-out;
  `;
  el.innerHTML = `
    <div class="ch-dot" style="position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#ffffff;box-shadow:0 0 3px #000;"></div>
    <div class="ch-line" style="position:absolute;left:50%;top:0;width:2px;height:7px;margin-left:-1px;background:#ffffff;box-shadow:0 0 2px #000;"></div>
    <div class="ch-line" style="position:absolute;left:50%;bottom:0;width:2px;height:7px;margin-left:-1px;background:#ffffff;box-shadow:0 0 2px #000;"></div>
    <div class="ch-line" style="position:absolute;top:50%;left:0;width:7px;height:2px;margin-top:-1px;background:#ffffff;box-shadow:0 0 2px #000;"></div>
    <div class="ch-line" style="position:absolute;top:50%;right:0;width:7px;height:2px;margin-top:-1px;background:#ffffff;box-shadow:0 0 2px #000;"></div>
    <div id="hitmarker" style="position:absolute;inset:0;opacity:0;transform:scale(0.8);pointer-events:none;transition:opacity 0.06s linear;">
      <div class="hm-tick" style="position:absolute;left:50%;top:50%;width:9px;height:2px;background:#ffffff;box-shadow:0 0 3px #000;transform:translate(-13px,-9px) rotate(45deg);"></div>
      <div class="hm-tick" style="position:absolute;left:50%;top:50%;width:9px;height:2px;background:#ffffff;box-shadow:0 0 3px #000;transform:translate(4px,-9px) rotate(-45deg);"></div>
      <div class="hm-tick" style="position:absolute;left:50%;top:50%;width:9px;height:2px;background:#ffffff;box-shadow:0 0 3px #000;transform:translate(-13px,7px) rotate(-45deg);"></div>
      <div class="hm-tick" style="position:absolute;left:50%;top:50%;width:9px;height:2px;background:#ffffff;box-shadow:0 0 3px #000;transform:translate(4px,7px) rotate(45deg);"></div>
    </div>
  `;
  return el;
}
const crosshairEl = setupCrosshair();
const hitmarkerEl = $("hitmarker");
let hitMarkerTimer = 0;

function triggerHitMarker(isHeadshot = false) {
  hitMarkerTimer = 0.2;
  sfx.hit(isHeadshot);
  if (!hitmarkerEl) return;
  const col = isHeadshot ? "#ff2e2e" : "#ffffff";
  hitmarkerEl.querySelectorAll(".hm-tick").forEach((t) => {
    t.style.background = col;
  });
  hitmarkerEl.style.opacity = "1";
  hitmarkerEl.style.transform = isHeadshot ? "scale(1.4)" : "scale(1.18)";
}

function updateCrosshairUI(visible, isAiming, onTarget) {
  const show = visible || hitMarkerTimer > 0;
  crosshairEl.style.display = show ? "block" : "none";
  if (!show) return;

  const color = onTarget ? "#ff3b3b" : "#ffffff";
  const sc = isAiming ? (onTarget ? 0.85 : 0.75) : onTarget ? 1.15 : 1.0;
  crosshairEl.style.transform = `translate(-50%, -50%) scale(${sc})`;
  crosshairEl.querySelectorAll(".ch-dot, .ch-line").forEach((part) => {
    part.style.opacity = visible ? "1" : "0";
    part.style.background = color;
  });
}

/* ---------- On-Screen Mouse Sensitivity Slider in Pause Menu ---------- */
let sensMultiplier =
  parseFloat(localStorage.getItem("lanka_mouse_sens")) || 1.0;

function setupSensitivityControl() {
  const ov = $("ov");
  if (!ov || $("sens-wrap")) return;

  const wrap = document.createElement("div");
  wrap.id = "sens-wrap";
  wrap.style.cssText = `
    margin: 14px 0 18px;
    padding: 10px 16px;
    background: rgba(15, 23, 42, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 240px;
    color: #f8fafc;
    font-family: sans-serif;
    font-size: 13px;
  `;
  wrap.innerHTML = `
    <div style="width:100%;display:flex;justify-content:space-between;font-weight:600;letter-spacing:0.4px;">
      <span>MOUSE SENSITIVITY</span>
      <span id="sens-val" style="color:#facc15;">${sensMultiplier.toFixed(2)}x</span>
    </div>
    <input id="sens-slider" type="range" min="0.2" max="2.5" step="0.05" value="${sensMultiplier}"
      style="width:100%;accent-color:#facc15;cursor:pointer;" />
  `;

  const goBtn = $("go");
  if (goBtn && goBtn.parentNode === ov) ov.insertBefore(wrap, goBtn);
  else ov.appendChild(wrap);

  const slider = $("sens-slider");
  const valLabel = $("sens-val");
  slider.addEventListener("input", (e) => {
    sensMultiplier = parseFloat(e.target.value);
    valLabel.textContent = sensMultiplier.toFixed(2) + "x";
    localStorage.setItem("lanka_mouse_sens", sensMultiplier);
  });
}
setupSensitivityControl();

// Renderer & Tone Mapping
const SHADOWS = true;
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.shadowMap.enabled = SHADOWS;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const MAX_SCALE = Math.min(window.devicePixelRatio || 1, 1.25),
  MIN_SCALE = 0.75;
let scale = MAX_SCALE;
function applyRes() {
  renderer.setPixelRatio(scale);
  renderer.setSize(innerWidth, innerHeight, false);
}
applyRes();

const FOG = PAL.fog;
const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG);
scene.fog = new THREE.Fog(FOG, 110, 330);

const camera = new THREE.PerspectiveCamera(
  60,
  innerWidth / innerHeight,
  0.3,
  420,
);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  applyRes();
});

const SUN = new THREE.Vector3(0.5, 0.62, -0.4).normalize();
scene.add(new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 0.62));
const sunL = new THREE.DirectionalLight(PAL.sun, 0.95);
sunL.position.copy(SUN).multiplyScalar(110);
sunL.castShadow = SHADOWS;
sunL.shadow.mapSize.set(2048, 2048);
sunL.shadow.camera.near = 20;
sunL.shadow.camera.far = 260;
const dCam = 42;
sunL.shadow.camera.left = -dCam;
sunL.shadow.camera.right = dCam;
sunL.shadow.camera.top = dCam;
sunL.shadow.camera.bottom = -dCam;
sunL.shadow.bias = -0.0005;
scene.add(sunL, sunL.target);

const {
  cols,
  sky,
  clouds,
  landmarks,
  bounds,
  mapShapes,
  areas,
  regions,
  tick,
} = buildWorld(scene);

/* ---------- Spatial grid: collision checks only look at nearby colliders ---------- */
const CELL = 24;
const grid = new Map();
const gk = (ix, iz) => (ix + 100) * 400 + (iz + 100);
for (const c of cols) {
  const ix0 = Math.floor(c.x0 / CELL),
    ix1 = Math.floor(c.x1 / CELL),
    iz0 = Math.floor(c.z0 / CELL),
    iz1 = Math.floor(c.z1 / CELL);
  for (let ix = ix0; ix <= ix1; ix++)
    for (let iz = iz0; iz <= iz1; iz++) {
      const k = gk(ix, iz);
      let a = grid.get(k);
      if (!a) grid.set(k, (a = []));
      a.push(c);
    }
}
let gridStamp = 0;
const _near = [];
function nearCols(x, z, pad = 0) {
  gridStamp++;
  _near.length = 0;
  const ix0 = Math.floor((x - pad) / CELL),
    ix1 = Math.floor((x + pad) / CELL),
    iz0 = Math.floor((z - pad) / CELL),
    iz1 = Math.floor((z + pad) / CELL);
  for (let ix = ix0; ix <= ix1; ix++)
    for (let iz = iz0; iz <= iz1; iz++) {
      const a = grid.get(gk(ix, iz));
      if (!a) continue;
      for (const c of a)
        if (c._s !== gridStamp) {
          c._s = gridStamp;
          _near.push(c);
        }
    }
  return _near;
}

/* ---------- Hospital Landmark & Respawn Point Setup ---------- */
function findHospitalSpawn() {
  const existing = landmarks.find((l) => /hosp/i.test(l.name));
  if (existing) return { name: existing.name, x: existing.x, z: existing.z };

  const candidates = [
    { x: 24, z: -14 },
    { x: -28, z: -14 },
    { x: 36, z: 14 },
    { x: 0, z: -14 },
  ];
  let spot = candidates[0];
  for (const cand of candidates) {
    const blocked = cols.some(
      (c) =>
        c.h > 0.2 &&
        cand.x > c.x0 - 3 &&
        cand.x < c.x1 + 3 &&
        cand.z > c.z0 - 3 &&
        cand.z < c.z1 + 3,
    );
    if (!blocked) {
      spot = cand;
      break;
    }
  }
  const hosp = {
    name: "Colombo General Hospital",
    x: spot.x,
    z: spot.z,
    color: "#ef4444",
  };
  landmarks.push(hosp);

  const padGroup = new THREE.Group();
  padGroup.position.set(hosp.x, 0.04, hosp.z);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.75, 24),
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bar1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.45), crossMat);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 1.5), crossMat);
  padGroup.add(ring, bar1, bar2);
  scene.add(padGroup);

  return hosp;
}
const HOSPITAL = findHospitalSpawn();

const player = createPlayer(scene);
const playerBaseScale = player.g.scale.x || 1;
player.g.traverse((ch) => {
  if (ch.isMesh) {
    ch.castShadow = true;
    ch.userData.origMat = ch.material;
  }
});

function restorePlayerAppearance() {
  scene.add(player.g);
  player.g.scale.setScalar(playerBaseScale);
  player.g.rotation.set(0, P.rot, 0);
  player.g.visible = true;
  player.g.traverse((ch) => {
    if (ch.isMesh && ch.userData.origMat) {
      ch.material = ch.userData.origMat;
    }
  });
  resetDriverLegs(player.h || player);
  player.blob.visible = true;
}

const entities = spawnWorldEntities(scene);
entities.bullets = entities.bullets || [];
entities.sparks = entities.sparks || [];
const { vehicles, traffic, pedestrians, targets } = entities;
const allVehicles = [...vehicles, ...traffic];
const sirenCars = allVehicles.filter((v) => v.siren);

/* ---------- Vehicle Health, Cabin Seating & Zero-Clipping Driver Pose ---------- */
function getVehicleDims(type) {
  if (type === "bus") return { halfW: 1.32, halfL: 4.75 };
  if (type === "tuk") return { halfW: 0.82, halfL: 1.52 };
  return { halfW: 1.04, halfL: 2.22 };
}

function getVehicleMaxHp(type) {
  if (type === "bus") return 280;
  if (type === "police") return 180;
  if (type === "tuk") return 100;
  return 150;
}

function getDriverSeatConfig(type) {
  // Hips sit directly on the seat cushion; legs hide inside the cabin footwell so zero body parts ever poke out under the vehicle
  if (type === "bus") return { scale: 0.86, x: 0.24, y: 0.04, z: 1.92 };
  if (type === "tuk") return { scale: 0.84, x: 0.0, y: -0.26, z: 0.2 };
  return { scale: 0.82, x: 0.34, y: -0.34, z: -0.06 };
}

function resetDriverLegs(h) {
  if (!h || !h.legs) return;
  h.legs[0].visible = true;
  h.legs[1].visible = true;
  h.legs[0].scale.set(1, 1, 1);
  h.legs[1].scale.set(1, 1, 1);
  if (h.knees && h.knees.length) {
    h.knees[0].visible = true;
    h.knees[1].visible = true;
    h.knees[0].scale.set(1, 1, 1);
    h.knees[1].scale.set(1, 1, 1);
  }
}

function poseDriver(h, steer = 0) {
  if (!h || !h.legs || !h.arms) return;
  h.upper.rotation.set(0.06, -steer * 0.12, 0);
  h.upper.position.y = h.hipY;

  // Hide lower legs inside the vehicle cabin so knees and shoes never poke through the floorboard
  h.legs[0].visible = false;
  h.legs[1].visible = false;

  h.arms[0].rotation.set(-1.08 + steer * 0.14, 0, -0.2);
  h.arms[1].rotation.set(-1.08 - steer * 0.14, 0, 0.2);
  if (h.elbows && h.elbows.length) {
    h.elbows[0].rotation.x = -0.52;
    h.elbows[1].rotation.x = -0.52;
  }
  if (h.head) h.head.rotation.set(0, steer * 0.25, 0);
}

for (const v of allVehicles) {
  v.dims = getVehicleDims(v.type);
  v.maxHp = getVehicleMaxHp(v.type);
  v.hp = v.maxHp;
  v.exploded = false;
  v.wreckTimer = 0;
  v.smokeTimer = 0;

  v.root.traverse((ch) => {
    if (ch.isMesh) {
      ch.castShadow = true;
      ch.receiveShadow = true;
      if (
        ch.material &&
        ch.material.color &&
        ch.position.y > 0.75 &&
        (ch.material.color.getHex() === 0x1e293b ||
          ch.material.color.getHex() === 0x0f172a ||
          ch.material.color.getHex() === 0x334155 ||
          ch.material.color.getHex() === 0x1a2634 ||
          ch.material.color.getHex() === 0x223344)
      ) {
        ch.material = ch.material.clone();
        ch.material.transparent = true;
        ch.material.opacity = 0.42;
      }
    }
  });
}

for (const v of traffic) {
  const driverRig = buildHuman(randomOutfit("normal"), false);
  const seat = getDriverSeatConfig(v.type);
  driverRig.g.scale.setScalar(seat.scale);
  driverRig.g.position.set(seat.x, seat.y, seat.z);
  poseDriver(driverRig, 0);
  v.body.add(driverRig.g);
  v.driver = driverRig;
  v.honkTimer = 1.5 + Math.random() * 3.0;
}

function initPedestrianData(n) {
  n.money = 150 + Math.floor(Math.random() * 1850);
  n.waveBlend = 0;
  n.deathHandled = false;
  n.deathTimer = 0;
  n.g.traverse((ch) => {
    if (ch.isMesh) {
      ch.castShadow = true;
      ch.receiveShadow = true;
    }
  });
}
for (const p of pedestrians) initPedestrianData(p);

for (const t of targets) {
  t.g.traverse((ch) => {
    if (ch.isMesh) {
      ch.castShadow = true;
      ch.receiveShadow = true;
    }
  });
}

/* ---------- Floating Money Pickups & Vehicle Explosion Particles ---------- */
const moneyPickups = [];
const fxParticles = [];
const cashGeo = new THREE.BoxGeometry(0.42, 0.14, 0.24);
const cashMat = new THREE.MeshStandardMaterial({
  color: 0x22c55e,
  emissive: 0x15803d,
  emissiveIntensity: 0.55,
  roughness: 0.35,
});
const bandMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
const bandGeo = new THREE.BoxGeometry(0.1, 0.15, 0.25);

function spawnFloatingMoney(x, z, amount) {
  if (!amount || amount <= 0) return;
  const g = new THREE.Group();
  const bill = new THREE.Mesh(cashGeo, cashMat);
  const band = new THREE.Mesh(bandGeo, bandMat);
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.48, 16),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.35;
  g.add(bill, band, glow);
  g.position.set(x, 0.55, z);
  scene.add(g);

  moneyPickups.push({
    g,
    x,
    z,
    amount,
    age: 0,
  });
}

function spawnParticle(x, y, z, vx, vy, vz, color, size = 0.45, life = 0.9) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(size, 7, 6),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    }),
  );
  m.position.set(x, y, z);
  scene.add(m);
  fxParticles.push({ m, vx, vy, vz, life, maxLife: life });
}

function removeExplodedVehicle(v) {
  if (!v) return;
  scene.remove(v.root);
  v.root.visible = false;
  const iAll = allVehicles.indexOf(v);
  if (iAll !== -1) allVehicles.splice(iAll, 1);
  const iVeh = vehicles.indexOf(v);
  if (iVeh !== -1) vehicles.splice(iVeh, 1);
  const iTraf = traffic.indexOf(v);
  if (iTraf !== -1) traffic.splice(iTraf, 1);
  const iSir = sirenCars.indexOf(v);
  if (iSir !== -1) sirenCars.splice(iSir, 1);
}

function damageVehicle(v, dmg, hitByPlayer = true) {
  if (!v || v.exploded) return;
  v.hp = Math.max(0, v.hp - dmg);
  if (v.hp <= 0) {
    explodeVehicle(v);
  } else if (hitByPlayer && v.driver && !v.hijacked) {
    v.cruise = Math.max(v.cruise, 14);
  }
}

function explodeVehicle(v) {
  if (!v || v.exploded) return;
  v.exploded = true;
  v.wreckTimer = 2.2; // Burns briefly, then disappears cleanly from the world
  v.hp = 0;
  v.speed = 0;
  sfx.explosion();
  screenShake = 0.65;

  const vx = v.root.position.x;
  const vz = v.root.position.z;
  const wasPlayerInside = activeVehicle === v;

  if (wasPlayerInside) {
    activeVehicle = null;
    cursorUnlockedForUI = false;
    restorePlayerAppearance();
    stopCarMediaPlayer();
    sfx.updateEngine(null, 0, false);
  }

  v.root.traverse((ch) => {
    if (ch.isMesh && ch.material && ch.material.color && !ch.userData.origMat) {
      ch.material = ch.material.clone();
      ch.material.color.setHex(0x1f2937);
      ch.material.opacity = 1;
      ch.material.transparent = false;
    }
  });
  if (v.driver) {
    v.body.remove(v.driver.g);
    v.driver = null;
  }

  for (let i = 0; i < 24; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 8;
    const isFire = i < 14;
    spawnParticle(
      vx + (Math.random() - 0.5) * 1.4,
      0.7 + Math.random() * 1.1,
      vz + (Math.random() - 0.5) * 1.4,
      Math.cos(ang) * spd,
      3.5 + Math.random() * 6.5,
      Math.sin(ang) * spd,
      isFire ? (i % 2 === 0 ? 0xf97316 : 0xfacc15) : 0x334155,
      isFire ? 0.55 + Math.random() * 0.45 : 0.75 + Math.random() * 0.5,
      isFire ? 0.65 : 1.35,
    );
  }

  for (const n of pedestrians) {
    if (
      n.hp > 0 &&
      Math.hypot(n.g.position.x - vx, n.g.position.z - vz) < 6.5
    ) {
      n.hp = 0;
      n.knockDown = 1.2;
      n.knockVx = (n.g.position.x - vx) * 2.5;
      n.knockVz = (n.g.position.z - vz) * 2.5;
      n.knockVy = 5.0;
    }
  }

  const playerDist = Math.hypot(P.x - vx, P.z - vz);
  if (wasPlayerInside || playerDist < 6.5) {
    triggerPlayerDeathAndHospitalRespawn();
  } else {
    toast("Vehicle Exploded!");
  }
}

/* ---------- Mission Checkpoint Beacon ---------- */
const beaconGeo = new THREE.CylinderGeometry(2.6, 2.6, 14, 16, 1, true);
const beaconMat = new THREE.MeshBasicMaterial({
  color: 0x22c55e,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const beacon = new THREE.Mesh(beaconGeo, beaconMat);
beacon.position.y = 7;
beacon.visible = false;
scene.add(beacon);

/* ---------- Game State & Session Storage Load/Save ---------- */
const BASE_MOUSE_SENS = 0.0046;
const BASE_AIM_SENS = 0.0032;

function loadGameSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_GAME_KEY)) || null;
  } catch (e) {
    return null;
  }
}
const savedSession = loadGameSession();

const P = {
  x: savedSession?.x ?? -4,
  y: 0,
  z: savedSession?.z ?? 2,
  vx: 0,
  vz: 0,
  vy: 0,
  ground: true,
  rot: savedSession?.rot ?? Math.PI / 2,
  r: 0.4,
  walkT: 0,
  turnSmooth: 0,
};
let yaw = savedSession?.yaw ?? -Math.PI / 2,
  pitch = savedSession?.pitch ?? 0.22,
  started = false,
  paused = true,
  locked = false,
  dragging = false,
  cursorUnlockedForUI = false;
const keys = {};

let activeVehicle = null,
  hijackState = null,
  aiming = false,
  armed = !!savedSession?.armed,
  targetLocked = false;
let ammo = savedSession?.ammo ?? 12,
  reserveAmmo = savedSession?.reserveAmmo ?? 60,
  health = savedSession?.health > 0 ? savedSession.health : 100,
  stamina = savedSession?.stamina ?? 100,
  cash = savedSession?.cash ?? 1500;
let shotCooldown = 0,
  punchCooldown = 0,
  toastTimer = 0,
  hudTick = 0,
  saveTick = 0,
  gameMinutes = savedSession?.gameMinutes ?? 10 * 60 + 30;
let playerMeetTimer = 0,
  playerWaveBlend = 0,
  playerHitTimer = 0,
  hospitalRespawnTimer = 0,
  screenShake = 0;
let mission = null,
  lastLoc = "";

player.g.position.set(P.x, P.y, P.z);
player.g.rotation.y = P.rot;
player.pistol.visible = armed;

function saveGameSession() {
  try {
    sessionStorage.setItem(
      SESSION_GAME_KEY,
      JSON.stringify({
        x: Number(P.x.toFixed(2)),
        z: Number(P.z.toFixed(2)),
        rot: Number(P.rot.toFixed(3)),
        yaw: Number(yaw.toFixed(3)),
        pitch: Number(pitch.toFixed(3)),
        cash,
        health,
        stamina,
        ammo,
        reserveAmmo,
        armed,
        gameMinutes,
        loc: lastLoc,
      }),
    );
  } catch (e) {}
}
addEventListener("beforeunload", saveGameSession);

function triggerPlayerDeathAndHospitalRespawn() {
  if (hospitalRespawnTimer > 0) return;
  health = 0;
  hospitalRespawnTimer = 2.2;
  armed = false;
  aiming = false;
  player.pistol.visible = false;
  restorePlayerAppearance();
  player.g.rotation.x = -Math.PI / 2;
  player.g.position.set(P.x, 0.25, P.z);
  updateCrosshairUI(false, false, false);
  updateHud();
  toast("WASTED! Ambulance taking you to Hospital...");
}

const raycaster = new THREE.Raycaster();
const tracers = [];

function toast(msg) {
  $("toast").textContent = msg;
  $("toast").style.display = "block";
  toastTimer = 2.4;
}

function updateHud() {
  $("hp-bar").style.width = clamp(health, 0, 100) + "%";
  $("stam-bar").style.width = clamp(stamina, 0, 100) + "%";
  $("cash").textContent = "LKR " + cash.toLocaleString();
  const ammoStr = `${ammo} / ${reserveAmmo}`;
  $("ammo").textContent = armed ? `PISTOL: ${ammoStr}` : "PISTOL: HOLSTERED";
  $("ammo-bottom").textContent = armed ? ammoStr : "HOLSTERED";
  $("speed").textContent = activeVehicle
    ? `${activeVehicle.type.toUpperCase()} • ${Math.round(Math.abs(activeVehicle.speed) * 8)} km/h`
    : "ON FOOT";

  const vBar = $("veh-hp-bar");
  const vRow = vehHpRowEl || $("veh-hp-row");
  if (vBar && vRow) {
    if (activeVehicle && !activeVehicle.exploded) {
      const pct = Math.round((activeVehicle.hp / activeVehicle.maxHp) * 100);
      vRow.style.display = "";
      vBar.style.width = pct + "%";
      vBar.style.background =
        pct > 50 ? "#f59e0b" : pct > 25 ? "#f97316" : "#ef4444";
    } else {
      vRow.style.display = "none";
    }
  }

  const hrs = Math.floor(gameMinutes / 60) % 24;
  const mins = Math.floor(gameMinutes % 60);
  const ampm = hrs >= 12 ? "PM" : "AM";
  const h12 = hrs % 12 || 12;
  $("time-display").textContent =
    `${h12}:${mins.toString().padStart(2, "0")} ${ampm}`;
}

function startTaxiMission() {
  if (!activeVehicle) {
    toast("Enter a Tuk-Tuk or Car first to start a Taxi Job!");
    return;
  }
  const pick = landmarks[Math.floor(Math.random() * landmarks.length)];
  mission = {
    phase: "pickup",
    target: pick,
    reward: 450 + Math.floor(Math.random() * 400),
  };
  beacon.position.set(pick.x, 7, pick.z);
  beacon.material.color.setHex(0xf5c518);
  beacon.visible = true;
  $("mission-text").textContent = `Pick up at ${pick.name}`;
  toast(`Taxi Job Started! Head to ${pick.name}`);
}

/* ---------- Input Handling ---------- */
addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (paused || hospitalRespawnTimer > 0) return;

  if (e.code === "KeyP" && !e.repeat && activeVehicle) {
    if (locked) {
      cursorUnlockedForUI = true;
      document.exitPointerLock();
      toast("Cursor unlocked for YouTube Player — Click road to steer");
    } else {
      cursorUnlockedForUI = false;
      lockPointer();
    }
    return;
  }

  if (e.code === "KeyE" && !e.repeat && !hijackState) toggleVehicle();
  if (e.code === "KeyH" && !e.repeat && activeVehicle)
    sfx.horn(activeVehicle.type === "bus");
  if (e.code === "KeyM" && !e.repeat) startTaxiMission();
  if (e.code === "Digit1" && !e.repeat && !hijackState) {
    armed = !armed;
    const showGun = armed && !activeVehicle;
    player.pistol.visible = showGun;
    updateCrosshairUI(showGun, aiming, targetLocked);
    if (showGun && !locked) lockPointer();
    updateHud();
    saveGameSession();
    toast(armed ? "Pistol equipped" : "Pistol holstered");
  }
  if (e.code === "KeyR" && !e.repeat && armed) {
    const take = Math.min(12 - ammo, reserveAmmo);
    ammo += take;
    reserveAmmo -= take;
    updateHud();
    saveGameSession();
    toast(take ? "Magazine Reloaded" : "No reserve ammo");
  }
});
addEventListener("keyup", (e) => {
  keys[e.code] = false;
});
addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
});

addEventListener("mousemove", (e) => {
  if (!started || paused || !(locked || dragging)) return;
  const sens = (aiming ? BASE_AIM_SENS : BASE_MOUSE_SENS) * sensMultiplier;
  yaw -= e.movementX * sens;
  pitch = clamp(pitch + e.movementY * sens, -0.45, 1.15);

  if (armed && !activeVehicle && !hijackState && hospitalRespawnTimer <= 0) {
    P.rot = yaw + Math.PI;
    player.g.rotation.y = P.rot;
  }
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  if (paused || hospitalRespawnTimer > 0) return;
  sfx.init();
  cursorUnlockedForUI = false;
  if (!locked) lockPointer();
  if (e.button === 2) {
    aiming = true;
    updateCrosshairUI(armed && !activeVehicle, aiming, targetLocked);
    return;
  }
  if (e.button === 0) {
    dragging = true;
    if (!activeVehicle && !hijackState) {
      if (armed) shoot();
      else punch();
    }
  }
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) dragging = false;
  if (e.button === 2) {
    aiming = false;
    updateCrosshairUI(armed && !activeVehicle, false, targetLocked);
  }
});

function lockPointer() {
  try {
    const r = canvas.requestPointerLock({ unadjustedMovement: true });
    if (r && r.catch) r.catch(() => canvas.requestPointerLock());
  } catch (e) {
    try {
      canvas.requestPointerLock();
    } catch (err) {}
  }
}
document.addEventListener("pointerlockchange", () => {
  const was = locked;
  locked = document.pointerLockElement === canvas;
  if (was && !locked && started) {
    if (cursorUnlockedForUI && activeVehicle) return;

    $("ov").querySelector("h1").textContent = "PAUSED";
    $("ovt").textContent =
      "Game Paused. Adjust sensitivity below or click RESUME.";
    $("go").textContent = "RESUME";
    $("ov").style.display = "flex";
    paused = true;
    dragging = false;
    aiming = false;
    sfx.stopWade();
    sfx.updateEngine(null, 0, false);
    saveGameSession();
    updateCrosshairUI(false, false, false);
  }
});
$("go").addEventListener("click", () => {
  sfx.init();
  started = true;
  paused = false;
  cursorUnlockedForUI = false;
  $("ov").style.display = "none";
  updateCrosshairUI(armed && !activeVehicle, aiming, targetLocked);
  updateHud();
  lockPointer();
});

/* ---------- Vehicle Entry, Hijack Pull-Driver-Out Animation & Seat Sync ---------- */
function finishVehicleEntry(v) {
  hijackState = null;
  if (v.exploded) return;
  activeVehicle = v;
  v.speed = 0;
  v.steer = 0;
  v.hijacked = true;
  if (!vehicles.includes(v)) vehicles.push(v);

  const seat = getDriverSeatConfig(v.type);
  v.body.add(player.g);
  player.g.scale.setScalar(seat.scale);
  player.g.position.set(seat.x, seat.y, seat.z);
  player.g.rotation.set(0, 0, 0);
  player.g.visible = true;
  poseDriver(player.h || player, 0);

  player.blob.visible = false;
  player.pistol.visible = false;
  aiming = false;
  updateCrosshairUI(false, false, false);
  P.x = v.root.position.x;
  P.z = v.root.position.z;

  openCarMediaPlayerFromSession();

  const label =
    v.type === "tuk"
      ? "Tuk-Tuk"
      : v.type === "bus"
        ? "CTB Bus"
        : v.type === "police"
          ? "Police Car"
          : "Car";
  toast(`Driving ${label} — Press [P] for YouTube Player, [M] for Taxi Job`);
}

function toggleVehicle() {
  if (activeVehicle) {
    const v = activeVehicle;
    activeVehicle = null;
    cursorUnlockedForUI = false;

    const side = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    P.x = v.root.position.x + side.x * (v.dims.halfW + 0.9);
    P.z = v.root.position.z + side.z * (v.dims.halfW + 0.9);
    P.y = 0;
    P.vx = P.vz = 0;
    restorePlayerAppearance();
    player.g.position.set(P.x, P.y, P.z);
    player.pistol.visible = armed;

    stopCarMediaPlayer();
    sfx.updateEngine(null, 0, false);
    if (!locked) lockPointer();

    updateCrosshairUI(armed, aiming, targetLocked);
    saveGameSession();
    toast("Exited vehicle");
    return;
  }

  let best = null,
    dist = 5.0;
  for (const v of allVehicles) {
    if (v.exploded) continue;
    const d = Math.hypot(P.x - v.root.position.x, P.z - v.root.position.z);
    if (d < dist) {
      best = v;
      dist = d;
    }
  }
  if (best) {
    const hasDriver = !!best.driver;
    best.speed = 0;
    best.hijacked = true;
    player.pistol.visible = false;
    aiming = false;
    updateCrosshairUI(false, false, false);

    hijackState = {
      v: best,
      timer: 0,
      duration: hasDriver ? 1.05 : 0.45,
      hasDriver,
      driverPulled: false,
      doorSoundPlayed: false,
    };
  }
}

function updateHijackAnimation(dt) {
  if (!hijackState) return;
  const h = hijackState;
  const v = h.v;
  if (v.exploded) {
    hijackState = null;
    restorePlayerAppearance();
    return;
  }
  h.timer += dt;

  v.speed = 0;
  const seat = getDriverSeatConfig(v.type);
  const sin = Math.sin(v.yaw);
  const cos = Math.cos(v.yaw);

  const doorSideDist = v.dims.halfW + 0.68;
  const doorWorldX = v.root.position.x + doorSideDist * cos + seat.z * sin;
  const doorWorldZ = v.root.position.z - doorSideDist * sin + seat.z * cos;

  const seatWorldX = v.root.position.x + seat.x * cos + seat.z * sin;
  const seatWorldZ = v.root.position.z - seat.x * sin + seat.z * cos;
  const seatWorldY = Math.max(0.05, (v.body.position.y || 0.45) + seat.y);

  const rig = player.h || player;

  if (h.hasDriver) {
    if (h.timer < 0.48) {
      const t1 = h.timer / 0.48;
      const smooth1 = t1 * t1 * (3 - 2 * t1);
      P.x += (doorWorldX - P.x) * Math.min(1, dt * 16);
      P.z += (doorWorldZ - P.z) * Math.min(1, dt * 16);
      P.y = 0;

      P.rot = Math.atan2(-cos, sin);
      player.g.position.set(P.x, P.y, P.z);
      player.g.rotation.y = P.rot;

      if (!h.doorSoundPlayed && h.timer > 0.12) {
        h.doorSoundPlayed = true;
        sfx.bump(false);
      }

      animateHuman(rig, h.timer * 8, 0, true);
      const yank = Math.sin(smooth1 * Math.PI);
      rig.upper.rotation.x = -0.34 * yank;
      rig.arms[0].rotation.set(-1.55 + yank * 0.48, 0, -0.18);
      rig.arms[1].rotation.set(-1.55 + yank * 0.48, 0, 0.18);
      if (rig.elbows && rig.elbows.length) {
        rig.elbows[0].rotation.x = -0.45 - yank * 0.55;
        rig.elbows[1].rotation.x = -0.45 - yank * 0.55;
      }

      if (v.driver) {
        v.driver.g.position.x =
          seat.x + smooth1 * (v.dims.halfW + 0.35 - seat.x);
        v.driver.upper.rotation.z = -smooth1 * 0.45;
      }
    } else {
      if (!h.driverPulled && v.driver) {
        h.driverPulled = true;
        sfx.punch();
        const drv = v.driver;
        v.driver = null;

        scene.add(drv.g);
        resetDriverLegs(drv);
        drv.g.scale.setScalar(0.95);
        const throwX = doorWorldX + cos * 0.75;
        const throwZ = doorWorldZ - sin * 0.75;
        drv.g.position.set(throwX, 0, throwZ);
        drv.g.rotation.set(0, Math.atan2(cos, -sin), 0);

        const pulledNpc = {
          g: drv.g,
          h: drv,
          legs: drv.legs,
          dir: cos >= 0 ? 1 : -1,
          phase: 0,
          minX: -480,
          maxX: 480,
          speed: 2.3,
          wait: 0,
          yaw: Math.atan2(cos, -sin),
          hp: 100,
          vel: new THREE.Vector3(cos * 3.5, 0, -sin * 3.5),
          stun: 0,
          hitTimer: 0.75,
          panic: 6.5,
          panicDirX: cos || 1,
          panicDirZ: -sin || 0.4,
          downTimer: 0,
          flashTimer: 0,
        };
        initPedestrianData(pulledNpc);
        pedestrians.push(pulledNpc);
        toast("Pulled driver out!");
      }

      const raw2 = clamp((h.timer - 0.48) / (h.duration - 0.48), 0, 1);
      const t2 = raw2 * raw2 * (3 - 2 * raw2);
      P.x = doorWorldX + (seatWorldX - doorWorldX) * t2;
      P.z = doorWorldZ + (seatWorldZ - doorWorldZ) * t2;
      P.y = seatWorldY * t2;
      P.rot = v.yaw;

      player.g.position.set(P.x, P.y, P.z);
      player.g.rotation.y = P.rot;
      player.g.scale.setScalar(
        playerBaseScale + (seat.scale - playerBaseScale) * t2,
      );

      if (t2 > 0.55) {
        poseDriver(rig, 0);
      }
    }
  } else {
    const rawT = clamp(h.timer / h.duration, 0, 1);
    const t = rawT * rawT * (3 - 2 * rawT);
    P.x = P.x + (seatWorldX - P.x) * Math.min(1, dt * 10);
    P.z = P.z + (seatWorldZ - P.z) * Math.min(1, dt * 10);
    P.y = seatWorldY * t;
    P.rot = v.yaw;

    player.g.position.set(P.x, P.y, P.z);
    player.g.rotation.y = P.rot;
    player.g.scale.setScalar(
      playerBaseScale + (seat.scale - playerBaseScale) * t,
    );
    poseDriver(rig, 0);
  }

  player.blob.position.set(P.x, 0.14, P.z);

  if (h.timer >= h.duration) {
    finishVehicleEntry(v);
  }
}

function vehicleBlocked(x, z, yawAng, v) {
  const pad = v.radius;
  for (const c of nearCols(x, z, pad + 2)) {
    if (!c.b) continue;
    if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad)
      return true;
  }
  for (const other of allVehicles) {
    if (other === v) continue;
    const d = Math.hypot(x - other.root.position.x, z - other.root.position.z);
    if (d < v.radius + other.radius) return true;
  }
  return false;
}

function isPassingLaneClear(v, vx, testZ) {
  const pad = v.radius + 0.45;
  const lookAheadX = vx + v.dir * (v.radius + 5.0);
  for (const c of nearCols(lookAheadX, testZ, pad + 2)) {
    if (!c.b) continue;
    if (
      lookAheadX > c.x0 - pad &&
      lookAheadX < c.x1 + pad &&
      testZ > c.z0 - pad &&
      testZ < c.z1 + pad
    ) {
      return false;
    }
  }
  for (const other of allVehicles) {
    if (other === v) continue;
    const ox = other.root.position.x;
    const oz = other.root.position.z;
    if (
      Math.abs(ox - vx) < v.radius + other.radius + 7.5 &&
      Math.abs(oz - testZ) < 2.35
    ) {
      return false;
    }
  }
  return true;
}

function updateVehicle(dt, v, playerControlled) {
  if (v.exploded) return;

  if (v.hp < v.maxHp * 0.5) {
    v.smokeTimer = (v.smokeTimer || 0) - dt;
    if (v.smokeTimer <= 0) {
      v.smokeTimer = v.hp < v.maxHp * 0.25 ? 0.08 : 0.18;
      const sx = v.root.position.x + Math.sin(v.yaw) * (v.dims.halfL * 0.65);
      const sz = v.root.position.z + Math.cos(v.yaw) * (v.dims.halfL * 0.65);
      spawnParticle(
        sx,
        0.95,
        sz,
        (Math.random() - 0.5) * 0.8,
        1.8 + Math.random(),
        (Math.random() - 0.5) * 0.8,
        v.hp < v.maxHp * 0.25 && Math.random() < 0.4 ? 0xf97316 : 0x475569,
        0.32,
        0.75,
      );
    }
  }

  if (playerControlled) {
    const maxFwd =
      v.type === "bus"
        ? 11.5
        : v.type === "tuk"
          ? 13.0
          : v.type === "police"
            ? 17.5
            : 15.5;
    const maxRev = -6.5;

    let targetSpd = 0;
    if (keys.KeyW) targetSpd = maxFwd;
    else if (keys.KeyS) targetSpd = maxRev;

    const accelRate =
      (keys.KeyW && v.speed < 0) || (keys.KeyS && v.speed > 0) ? 6.5 : 2.6;
    v.speed += (targetSpd - v.speed) * Math.min(1, dt * accelRate);
    if (!keys.KeyW && !keys.KeyS) {
      v.speed *= Math.exp(-1.8 * dt);
      if (Math.abs(v.speed) < 0.04) v.speed = 0;
    }

    const rawSteer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
    v.steer += (rawSteer - v.steer) * Math.min(1, dt * 10);

    const absSpd = Math.abs(v.speed);
    if (absSpd > 0.12) {
      const lowSpeedFactor = Math.min(1, absSpd / 2.6);
      const highSpeedDamp = 1 / (1 + absSpd * 0.032);
      const baseTurnRate =
        v.type === "tuk" ? 2.45 : v.type === "bus" ? 1.28 : 1.92;
      const revSign = v.speed < -0.15 ? -1 : 1;
      const nextYaw =
        v.yaw +
        v.steer * baseTurnRate * lowSpeedFactor * highSpeedDamp * revSign * dt;

      if (!vehicleBlocked(v.root.position.x, v.root.position.z, nextYaw, v)) {
        v.yaw = nextYaw;
      }
    }

    const nx = v.root.position.x + Math.sin(v.yaw) * v.speed * dt;
    const nz = v.root.position.z + Math.cos(v.yaw) * v.speed * dt;
    const px = v.root.position.x,
      pz = v.root.position.z;

    if (vehicleBlocked(px, pz, v.yaw, v) || !vehicleBlocked(nx, nz, v.yaw, v)) {
      v.root.position.x = clamp(nx, bounds.x0, bounds.x1);
      v.root.position.z = clamp(nz, bounds.z0, bounds.vz1);
    } else if (!vehicleBlocked(nx, pz, v.yaw, v)) {
      v.root.position.x = clamp(nx, bounds.x0, bounds.x1);
      if (Math.abs(v.speed) > 5)
        damageVehicle(v, Math.abs(v.speed) * 1.4, true);
      v.speed *= 0.85;
    } else if (!vehicleBlocked(px, nz, v.yaw, v)) {
      v.root.position.z = clamp(nz, bounds.z0, bounds.vz1);
      if (Math.abs(v.speed) > 5)
        damageVehicle(v, Math.abs(v.speed) * 1.4, true);
      v.speed *= 0.85;
    } else {
      if (Math.abs(v.speed) > 3.5) {
        sfx.bump(true);
        damageVehicle(v, Math.abs(v.speed) * 2.4, true);
      }
      v.speed = -v.speed * 0.2;
    }

    P.x = v.root.position.x;
    P.z = v.root.position.z;
    P.y = 0;
    P.rot = v.yaw;

    poseDriver(player.h || player, v.steer);
    sfx.updateEngine(v, dt, ytIsPlaying);
  } else {
    if (v.baseZ === undefined) v.baseZ = v.root.position.z;
    if (v.passOffsetZ === undefined) v.passOffsetZ = 0;

    let blocked = false;
    let stoppedObstacle = null;
    const vx = v.root.position.x;
    const vz = v.root.position.z;
    const stopDist = v.radius + 5.8;

    const dxPlayer = (P.x - vx) * v.dir;
    const dzPlayer = Math.abs(P.z - vz);
    if (
      (dxPlayer > -1.5 && dxPlayer < stopDist + 4.5 && dzPlayer < 2.6) ||
      (hijackState && hijackState.v === v)
    ) {
      if (hijackState && hijackState.v === v) {
        blocked = true;
      } else if (!activeVehicle || Math.abs(activeVehicle.speed) < 1.3) {
        stoppedObstacle = {
          x: P.x,
          z: P.z,
          radius: activeVehicle ? activeVehicle.radius : 1.2,
        };
        if (dxPlayer > -1.5 && dxPlayer < stopDist && dzPlayer < 2.3) {
          blocked = true;
        }
      } else if (dxPlayer > 0 && dxPlayer < stopDist && dzPlayer < 2.3) {
        blocked = true;
      }
    }

    for (const other of allVehicles) {
      if (other === v) continue;
      const dx = (other.root.position.x - vx) * v.dir;
      const dz = Math.abs(other.root.position.z - vz);
      const detectRange = v.radius + other.radius + 8.5;
      if (dx > 0 && dx < detectRange && dz < 2.3) {
        if (Math.abs(other.speed) < 1.2 && !stoppedObstacle) {
          stoppedObstacle = {
            x: other.root.position.x,
            z: other.root.position.z,
            radius: other.radius,
          };
        }
        if (dx < v.radius + other.radius + 3.4) {
          blocked = true;
        }
      }
    }

    if (stoppedObstacle && !(hijackState && hijackState.v === v)) {
      if (v.passOffsetZ === 0) {
        const preferred = v.dir > 0 ? -3.2 : 3.2;
        const alternate = -preferred;
        if (isPassingLaneClear(v, vx, v.baseZ + preferred)) {
          v.passOffsetZ = preferred;
          v.passTargetX = stoppedObstacle.x;
        } else if (isPassingLaneClear(v, vx, v.baseZ + alternate)) {
          v.passOffsetZ = alternate;
          v.passTargetX = stoppedObstacle.x;
        }
      }
    } else if (v.passOffsetZ !== 0) {
      const pastDist = (vx - (v.passTargetX ?? vx)) * v.dir;
      if (pastDist > v.radius + 4.8) {
        if (isPassingLaneClear(v, vx, v.baseZ)) {
          v.passOffsetZ = 0;
        }
      }
    }

    const wantZ = v.baseZ + v.passOffsetZ;
    const zDiff = wantZ - v.root.position.z;
    const maxLatSpd = Math.min(3.4, Math.abs(v.speed) * 0.55 + 0.8);
    const vzMove = clamp(zDiff * 2.8, -maxLatSpd, maxLatSpd);
    v.root.position.z += vzMove * dt;

    if (
      stoppedObstacle &&
      v.passOffsetZ !== 0 &&
      Math.abs(v.root.position.z - stoppedObstacle.z) > v.dims.halfW + 0.85
    ) {
      blocked = false;
    }

    if (blocked && !(hijackState && hijackState.v === v)) {
      v.honkTimer = (v.honkTimer ?? 2.0) - dt;
      if (v.honkTimer <= 0) {
        const distToPlayer = Math.hypot(P.x - vx, P.z - vz);
        sfx.trafficHonk(v.type, distToPlayer);
        v.honkTimer = 3.8 + Math.random() * 4.2;
      }
    } else {
      v.honkTimer = Math.max(0.8, (v.honkTimer ?? 1.5) - dt * 0.3);
    }

    const cruiseMult = v.passOffsetZ !== 0 ? 0.85 : 1.0;
    const targetSpd = blocked ? 0 : v.cruise * cruiseMult * v.dir;
    v.speed += (targetSpd - v.speed) * Math.min(1, dt * (blocked ? 7.5 : 4));
    v.root.position.x += v.speed * dt;

    const baseYaw = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const targetYaw =
      Math.abs(v.speed) > 0.25 ? Math.atan2(v.speed, vzMove) : baseYaw;
    const yawDiff = Math.atan2(
      Math.sin(targetYaw - v.yaw),
      Math.cos(targetYaw - v.yaw),
    );
    v.yaw += yawDiff * Math.min(1, dt * 8);
    v.steer = clamp(yawDiff * 2.5, -0.7, 0.7);
    if (v.driver) poseDriver(v.driver, v.steer);

    if (v.root.position.x > bounds.x1 - 26) {
      v.root.position.x = bounds.x0 + 26;
      v.passOffsetZ = 0;
      v.root.position.z = v.baseZ;
    }
    if (v.root.position.x < bounds.x0 + 26) {
      v.root.position.x = bounds.x1 - 26;
      v.passOffsetZ = 0;
      v.root.position.z = v.baseZ;
    }
  }

  v.root.rotation.y = v.yaw;
  v.wheels.forEach((w) => {
    w.rotation.x -= (v.speed * dt * 2.2) / (v.type === "bus" ? 1.2 : 1);
  });
  const st = v.steer * 0.44;
  for (const w of v.frontWheels)
    w.rotation.y += (st - w.rotation.y) * Math.min(1, dt * 12);

  const acc = (v.speed - v._ps) / Math.max(dt, 1e-3);
  v._ps = v.speed;
  const k = Math.min(1, dt * 6);
  const wantRoll =
    -v.steer *
    Math.min(1, Math.abs(v.speed) / 10) *
    (v.type === "bus" ? 0.055 : 0.045);
  const wantPitch = clamp(-acc * 0.0035, -0.045, 0.045);
  v.body.rotation.z += (wantRoll - v.body.rotation.z) * k;
  v.body.rotation.x += (wantPitch - v.body.rotation.x) * k;
}

function spawnTracer(start, end) {
  const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
  const mat = new THREE.LineBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.9,
  });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ line, life: 0.12 });
}

/* ---------- Crosshair Target Detection & Aim Point ---------- */
const _centerNDC = new THREE.Vector2(0, 0);
const _aimPoint = new THREE.Vector3();

function getCrosshairAimPoint(checkOnly = false) {
  raycaster.setFromCamera(_centerNDC, camera);
  raycaster.far = 75;

  const activeNpcMeshes = [];
  for (const p of pedestrians) {
    if (p.hp > 0 && p.g.visible) activeNpcMeshes.push(p.g);
  }
  const activeBoards = targets.filter((t) => t.active).map((t) => t.board);

  const npcHits = raycaster.intersectObjects(activeNpcMeshes, true);
  const boardHits = raycaster.intersectObjects(activeBoards, false);

  let closest = null;
  if (npcHits.length) closest = npcHits[0];
  if (
    boardHits.length &&
    (!closest || boardHits[0].distance < closest.distance)
  ) {
    closest = boardHits[0];
  }

  targetLocked = !!closest;
  if (checkOnly) return closest;

  if (closest) {
    _aimPoint.copy(closest.point);
  } else {
    _aimPoint
      .copy(raycaster.ray.origin)
      .addScaledVector(raycaster.ray.direction, 65);
  }
  return closest;
}

function punch() {
  if (armed || activeVehicle || hijackState || punchCooldown > 0) return;
  punchCooldown = 0.38;
  sfx.punch();
  punchAttack(scene, player, entities, triggerHitMarker);
}

function shoot() {
  if (!armed || activeVehicle || hijackState || shotCooldown > 0) return;
  if (ammo <= 0) {
    toast("Empty magazine — Press [R] to reload");
    return;
  }
  ammo--;
  shotCooldown = 0.22;
  sfx.shoot();
  updateHud();

  P.rot = yaw + Math.PI;
  player.g.rotation.y = P.rot;

  shootGun(scene, player, entities);

  const closest = getCrosshairAimPoint(false);
  const start = new THREE.Vector3();
  (player.muzzleTip || player.pistol).getWorldPosition(start);

  if (entities.bullets.length) {
    const latestBullet = entities.bullets[entities.bullets.length - 1];
    const dir = _aimPoint.clone().sub(latestBullet.pos).normalize();
    latestBullet.vel.copy(dir).multiplyScalar(75);
    latestBullet.mesh.rotation.y = Math.atan2(dir.x, dir.z);
  }

  if (closest) {
    const obj = targets.find((t) => t.board === closest.object);
    if (obj) {
      triggerHitMarker(false);
      obj.hp--;
      obj.board.material.color.setHex(
        obj.hp === 2 ? 0xf59e0b : obj.hp === 1 ? 0xef4444 : 0x555555,
      );
      if (obj.hp <= 0) {
        obj.active = false;
        obj.g.visible = false;
        obj.respawnTimer = 8;
        cash += 150;
        sfx.cash();
        saveGameSession();
        toast("Target Destroyed! +LKR 150");
      } else {
        toast(`Target Hit! (${obj.hp} HP left)`);
      }
    }
  }
  spawnTracer(start, _aimPoint.clone());
}

/* ---------- Solid Player, Vehicle & NPC Collisions ---------- */
function collide() {
  for (const c of nearCols(P.x, P.z, 2)) {
    if (P.y >= c.h - 0.1) continue;
    if (
      P.x < c.x0 - P.r ||
      P.x > c.x1 + P.r ||
      P.z < c.z0 - P.r ||
      P.z > c.z1 + P.r
    )
      continue;
    const cx = clamp(P.x, c.x0, c.x1),
      cz = clamp(P.z, c.z0, c.z1);
    const dx = P.x - cx,
      dz = P.z - cz,
      d2 = dx * dx + dz * dz;
    if (d2 >= P.r * P.r) continue;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2),
        k = (P.r - d) / d;
      P.x += dx * k;
      P.z += dz * k;
    } else {
      const l = P.x - c.x0,
        r = c.x1 - P.x,
        t = P.z - c.z0,
        b = c.z1 - P.z,
        m = Math.min(l, r, t, b);
      if (m === l) P.x = c.x0 - P.r;
      else if (m === r) P.x = c.x1 + P.r;
      else if (m === t) P.z = c.z0 - P.r;
      else P.z = c.z1 + P.r;
    }
  }

  if (!activeVehicle && !hijackState && P.y < 1.8) {
    for (const v of allVehicles) {
      const vx = v.root.position.x;
      const vz = v.root.position.z;
      if (Math.hypot(P.x - vx, P.z - vz) > 6.5) continue;

      const dims = v.dims || getVehicleDims(v.type);
      const dx = P.x - vx;
      const dz = P.z - vz;
      const sin = Math.sin(v.yaw);
      const cos = Math.cos(v.yaw);

      const localFwd = dx * sin + dz * cos;
      const localSide = dx * cos - dz * sin;

      const clampSide = clamp(localSide, -dims.halfW, dims.halfW);
      const clampFwd = clamp(localFwd, -dims.halfL, dims.halfL);

      const offSide = localSide - clampSide;
      const offFwd = localFwd - clampFwd;
      const distSq = offSide * offSide + offFwd * offFwd;

      if (distSq < P.r * P.r) {
        let pushSide = 0,
          pushFwd = 0;
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const pen = (P.r - dist) / dist;
          pushSide = offSide * pen;
          pushFwd = offFwd * pen;
        } else {
          const penS = dims.halfW + P.r - Math.abs(localSide);
          const penF = dims.halfL + P.r - Math.abs(localFwd);
          if (penS < penF) pushSide = (localSide >= 0 ? 1 : -1) * penS;
          else pushFwd = (localFwd >= 0 ? 1 : -1) * penF;
        }

        const worldPushX = pushSide * cos + pushFwd * sin;
        const worldPushZ = -pushSide * sin + pushFwd * cos;
        P.x += worldPushX;
        P.z += worldPushZ;

        if (Math.abs(v.speed) > 2.4 && playerHitTimer <= 0) {
          const len = Math.hypot(worldPushX, worldPushZ) || 1;
          const knockSpd = Math.min(11, Math.abs(v.speed) * 1.15);
          P.vx = (worldPushX / len) * knockSpd;
          P.vz = (worldPushZ / len) * knockSpd;
          P.vy = 4.2;
          P.ground = false;
          playerHitTimer = 0.55;
          health = Math.max(0, health - Math.round(Math.abs(v.speed) * 2.2));
          sfx.bump(true);
          if (health <= 0) triggerPlayerDeathAndHospitalRespawn();
          else toast("Hit by vehicle! Watch the road!");
        }
      }
    }
  }
}

function floorAt() {
  let f = 0;
  for (const c of nearCols(P.x, P.z, 1)) {
    if (
      c.h <= 1.8 &&
      P.y >= c.h - 0.35 &&
      P.x > c.x0 - 0.2 &&
      P.x < c.x1 + 0.2 &&
      P.z > c.z0 - 0.2 &&
      P.z < c.z1 + 0.2
    ) {
      f = Math.max(f, c.h);
    }
  }
  return f;
}

function collideNPC(n) {
  const r = 0.38;
  const pos = n.g.position;
  if (pos.y < 0 && !n.knockDown) pos.y = 0;

  for (const c of nearCols(pos.x, pos.z, 2)) {
    if (pos.y >= c.h - 0.1) continue;
    if (
      pos.x < c.x0 - r ||
      pos.x > c.x1 + r ||
      pos.z < c.z0 - r ||
      pos.z > c.z1 + r
    )
      continue;

    const cx = clamp(pos.x, c.x0, c.x1),
      cz = clamp(pos.z, c.z0, c.z1);
    const dx = pos.x - cx,
      dz = pos.z - cz,
      d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;

    let pushX = 0,
      pushZ = 0;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2),
        k = (r - d) / d;
      pushX = dx * k;
      pushZ = dz * k;
    } else {
      const l = pos.x - c.x0,
        ri = c.x1 - pos.x,
        t = pos.z - c.z0,
        b = c.z1 - pos.z,
        m = Math.min(l, ri, t, b);
      if (m === l) pushX = c.x0 - r - pos.x;
      else if (m === ri) pushX = c.x1 + r - pos.x;
      else if (m === t) pushZ = c.z0 - r - pos.z;
      else pushZ = c.z1 + r - pos.z;
    }
    pos.x += pushX;
    pos.z += pushZ;

    if (n.panic > 0) {
      if (Math.abs(pushX) > Math.abs(pushZ)) {
        n.panicDirX = Math.sign(pushX) * 0.35;
        if (Math.abs(n.panicDirZ) < 0.25)
          n.panicDirZ = (Math.random() < 0.5 ? 1 : -1) * 0.92;
      } else {
        n.panicDirZ = Math.sign(pushZ) * 0.35;
        if (Math.abs(n.panicDirX) < 0.25) n.panicDirX = (n.dir || 1) * 0.92;
      }
      const len = Math.hypot(n.panicDirX, n.panicDirZ) || 1;
      n.panicDirX /= len;
      n.panicDirZ /= len;
    } else if (Math.abs(pushX) > 0.01) {
      n.dir *= -1;
    }
  }

  for (const v of allVehicles) {
    const vx = v.root.position.x;
    const vz = v.root.position.z;
    if (Math.hypot(pos.x - vx, pos.z - vz) > 6.5) continue;

    const dims = v.dims || getVehicleDims(v.type);
    const dx = pos.x - vx;
    const dz = pos.z - vz;
    const sin = Math.sin(v.yaw);
    const cos = Math.cos(v.yaw);

    const localFwd = dx * sin + dz * cos;
    const localSide = dx * cos - dz * sin;

    const clampSide = clamp(localSide, -dims.halfW, dims.halfW);
    const clampFwd = clamp(localFwd, -dims.halfL, dims.halfL);

    const offSide = localSide - clampSide;
    const offFwd = localFwd - clampFwd;
    const distSq = offSide * offSide + offFwd * offFwd;

    if (distSq < r * r) {
      let pushSide = 0,
        pushFwd = 0;
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const pen = (r - dist) / dist;
        pushSide = offSide * pen;
        pushFwd = offFwd * pen;
      } else {
        const penS = dims.halfW + r - Math.abs(localSide);
        const penF = dims.halfL + r - Math.abs(localFwd);
        if (penS < penF) pushSide = (localSide >= 0 ? 1 : -1) * penS;
        else pushFwd = (localFwd >= 0 ? 1 : -1) * penF;
      }

      const worldPushX = pushSide * cos + pushFwd * sin;
      const worldPushZ = -pushSide * sin + pushFwd * cos;
      pos.x += worldPushX;
      pos.z += worldPushZ;

      const vSpd = Math.abs(v.speed);
      if (vSpd > 3.2 && !n.knockDown && n.hp > 0) {
        const len = Math.hypot(worldPushX, worldPushZ) || 1;
        const launch = Math.min(12, vSpd * 1.15);
        n.knockVx = (worldPushX / len) * launch + Math.sin(v.yaw) * vSpd * 0.4;
        n.knockVz = (worldPushZ / len) * launch + Math.cos(v.yaw) * vSpd * 0.4;
        n.knockVy = 3.8;
        n.knockDown = 2.0;
        n.hp = Math.max(0, n.hp - Math.round(vSpd * 10));
        sfx.hit(false);
        v.speed *= 0.84;

        for (const other of pedestrians) {
          if (
            other !== n &&
            other.hp > 0 &&
            Math.hypot(other.g.position.x - pos.x, other.g.position.z - pos.z) <
              14
          ) {
            other.panic = 5.5;
            other.panicDirX = Math.sign(other.g.position.x - pos.x) || 1;
            other.panicDirZ = Math.sign(other.g.position.z - pos.z) || 0.5;
          }
        }
      } else if (vSpd > 0.8 && !n.knockDown && n.hp > 0) {
        n.hitTimer = 0.55;
        n.dir *= -1;
        sfx.bump(false);
      }
    }
  }
}

/* ---------- Respawn Replacement NPC When One Is Eliminated ---------- */
function spawnReplacementNPC() {
  const angle = Math.random() * Math.PI * 2;
  const dist = 120 + Math.random() * 55;
  const sx = clamp(
    P.x + Math.cos(angle) * dist,
    bounds.x0 + 30,
    bounds.x1 - 30,
  );
  const sz = clamp(
    P.z + Math.sin(angle) * dist,
    bounds.z0 + 30,
    bounds.z1 - 30,
  );
  const rig = buildHuman(randomOutfit("normal"), false);
  rig.g.position.set(sx, 0, sz);
  scene.add(rig.g);

  const npc = {
    g: rig.g,
    h: rig,
    legs: rig.legs,
    dir: Math.random() < 0.5 ? 1 : -1,
    phase: Math.random() * 6,
    minX: sx - 35,
    maxX: sx + 35,
    speed: 1.3 + Math.random() * 0.7,
    wait: 0,
    yaw: 0,
    hp: 100,
    vel: new THREE.Vector3(),
    stun: 0,
    panic: 0,
    panicDirX: 1,
    panicDirZ: 0,
    downTimer: 0,
    flashTimer: 0,
  };
  initPedestrianData(npc);
  pedestrians.push(npc);
}

/* ---------- 2D Radar Minimap Renderer ---------- */
const mapCtx = $("minimap").getContext("2d");
const northEl = $("radar-north");
function drawMinimap() {
  const ctx = mapCtx,
    R = 82,
    zoom = 0.72;
  ctx.clearRect(0, 0, 164, 164);
  ctx.save();
  ctx.translate(R, R);
  ctx.rotate(yaw);
  northEl.style.left = 50 + Math.sin(yaw) * 43 + "%";
  northEl.style.top = 50 - Math.cos(yaw) * 43 + "%";

  const toMap = (wx, wz) => [(wx - P.x) * zoom, (wz - P.z) * zoom];

  for (const s of mapShapes) {
    if (
      s.x1 < P.x - 140 ||
      s.x0 > P.x + 140 ||
      s.z1 < P.z - 140 ||
      s.z0 > P.z + 140
    )
      continue;
    ctx.fillStyle = s.color;
    const [sx, sz] = toMap(s.x0, s.z0);
    ctx.fillRect(sx, sz, (s.x1 - s.x0) * zoom, (s.z1 - s.z0) * zoom);
  }

  for (const lm of landmarks) {
    const [lx, lz] = toMap(lm.x, lm.z);
    ctx.fillStyle = lm.color;
    ctx.beginPath();
    ctx.arc(lx, lz, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const v of allVehicles) {
    if (v.exploded) continue;
    const [vx, vz] = toMap(v.root.position.x, v.root.position.z);
    ctx.fillStyle = v === activeVehicle ? "#38bdf8" : "#facc15";
    ctx.fillRect(vx - 2.5, vz - 2.5, 5, 5);
  }

  for (const m of moneyPickups) {
    const [mx, mz] = toMap(m.x, m.z);
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(mx, mz, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (mission) {
    const [mx, mz] = toMap(mission.target.x, mission.target.z);
    ctx.strokeStyle = mission.phase === "pickup" ? "#f5c518" : "#22c55e";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(mx, mz, 6.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(R, R - 6);
  ctx.lineTo(R + 4.5, R + 5);
  ctx.lineTo(R, R + 2.5);
  ctx.lineTo(R - 4.5, R + 5);
  ctx.closePath();
  ctx.fill();
}

/* ---------- Main Update Step ---------- */
function update(dt) {
  gameMinutes += dt * 1.5;
  tick(dt);
  const sirenPhase = Math.floor(performance.now() / 160) % 2 === 0;
  for (const v of sirenCars) {
    if (!v.exploded) {
      v.siren[0].visible = sirenPhase;
      v.siren[1].visible = !sirenPhase;
    }
  }
  if (shotCooldown > 0) shotCooldown -= dt;
  if (punchCooldown > 0) punchCooldown -= dt;
  if (playerMeetTimer > 0) playerMeetTimer = Math.max(0, playerMeetTimer - dt);
  if (playerHitTimer > 0) playerHitTimer = Math.max(0, playerHitTimer - dt);
  if (screenShake > 0) screenShake = Math.max(0, screenShake - dt * 1.5);
  if (toastTimer > 0 && (toastTimer -= dt) <= 0)
    $("toast").style.display = "none";

  // Count down blown-up vehicle wreck timers and make them disappear cleanly
  for (let vi = allVehicles.length - 1; vi >= 0; vi--) {
    const v = allVehicles[vi];
    if (v.exploded) {
      v.wreckTimer -= dt;
      if (v.wreckTimer <= 0) {
        removeExplodedVehicle(v);
      }
    }
  }

  // Handle Hospital Respawn countdown if player died
  if (hospitalRespawnTimer > 0) {
    hospitalRespawnTimer -= dt;
    if (hospitalRespawnTimer <= 0) {
      hospitalRespawnTimer = 0;
      health = 100;
      stamina = 100;
      P.x = HOSPITAL.x;
      P.y = 0;
      P.z = HOSPITAL.z;
      P.vx = P.vz = P.vy = 0;
      P.ground = true;
      restorePlayerAppearance();
      player.g.position.set(P.x, P.y, P.z);
      updateHud();
      saveGameSession();
      toast(`Discharged from ${HOSPITAL.name} (100 HP)`);
    }
    return;
  }

  if (hitMarkerTimer > 0) {
    hitMarkerTimer = Math.max(0, hitMarkerTimer - dt);
    if (hitmarkerEl) {
      hitmarkerEl.style.opacity = (hitMarkerTimer / 0.2).toFixed(2);
      if (hitMarkerTimer === 0) hitmarkerEl.style.transform = "scale(0.8)";
    }
  }

  if (entities.bullets && entities.bullets.length) {
    for (let bi = entities.bullets.length - 1; bi >= 0; bi--) {
      const b = entities.bullets[bi];
      if (!b || !b.pos) continue;
      for (const v of allVehicles) {
        if (v.exploded || v === activeVehicle) continue;
        const dims = v.dims || getVehicleDims(v.type);
        const dx = b.pos.x - v.root.position.x;
        const dz = b.pos.z - v.root.position.z;
        if (Math.hypot(dx, dz) > 6.5) continue;
        const sin = Math.sin(v.yaw);
        const cos = Math.cos(v.yaw);
        const lFwd = dx * sin + dz * cos;
        const lSide = dx * cos - dz * sin;
        if (
          Math.abs(lSide) < dims.halfW + 0.2 &&
          Math.abs(lFwd) < dims.halfL + 0.2 &&
          b.pos.y >= 0.1 &&
          b.pos.y <= 2.3
        ) {
          triggerHitMarker(false);
          spawnParticle(
            b.pos.x,
            b.pos.y,
            b.pos.z,
            (Math.random() - 0.5) * 3,
            2,
            (Math.random() - 0.5) * 3,
            0xfacc15,
            0.18,
            0.25,
          );
          damageVehicle(v, 22, true);
          if (b.mesh) scene.remove(b.mesh);
          entities.bullets.splice(bi, 1);
          break;
        }
      }
    }
  }

  updateCombat(scene, entities, dt, triggerHitMarker);

  const collectRadius = activeVehicle ? 3.2 : 2.1;
  for (let i = moneyPickups.length - 1; i >= 0; i--) {
    const m = moneyPickups[i];
    m.age += dt;
    m.g.rotation.y += dt * 2.6;
    m.g.position.y = 0.52 + Math.sin(m.age * 3.8) * 0.16;

    if (Math.hypot(P.x - m.x, P.z - m.z) < collectRadius) {
      cash += m.amount;
      sfx.cash();
      updateHud();
      saveGameSession();
      toast(`Collected +LKR ${m.amount.toLocaleString()}!`);
      scene.remove(m.g);
      moneyPickups.splice(i, 1);
    }
  }

  for (let i = fxParticles.length - 1; i >= 0; i--) {
    const pt = fxParticles[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      scene.remove(pt.m);
      pt.m.geometry.dispose();
      pt.m.material.dispose();
      fxParticles.splice(i, 1);
      continue;
    }
    pt.m.position.x += pt.vx * dt;
    pt.m.position.y += pt.vy * dt;
    pt.m.position.z += pt.vz * dt;
    pt.vy -= 5.5 * dt;
    pt.m.material.opacity = clamp(pt.life / pt.maxLife, 0, 1);
  }

  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) {
      scene.remove(tracers[i].line);
      tracers[i].line.geometry.dispose();
      tracers[i].line.material.dispose();
      tracers.splice(i, 1);
    }
  }
  for (const t of targets) {
    if (!t.active && (t.respawnTimer -= dt) <= 0) {
      t.active = true;
      t.hp = 3;
      t.g.visible = true;
      t.board.material.color.setHex(0xd74a3a);
    }
  }

  if (keys.KeyQ || keys.ArrowLeft) yaw += 1.9 * dt;
  if (keys.ArrowRight) yaw -= 1.9 * dt;
  if (keys.ArrowUp) pitch = clamp(pitch - 1.2 * dt, -0.45, 1.15);
  if (keys.ArrowDown) pitch = clamp(pitch + 1.2 * dt, -0.45, 1.15);

  if (
    activeVehicle &&
    activeVehicle.speed > 1.5 &&
    !keys.ArrowLeft &&
    !keys.ArrowRight &&
    !keys.KeyQ
  ) {
    const want = activeVehicle.yaw + Math.PI;
    yaw +=
      Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) *
      (1 - Math.exp(-1.6 * dt));
  }

  if (hijackState) {
    updateHijackAnimation(dt);
  } else if (activeVehicle) {
    updateVehicle(dt, activeVehicle, true);
  } else {
    const ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const fx = -Math.sin(yaw),
      fz = -Math.cos(yaw),
      rx = -fz,
      rz = fx;
    let mxv = fx * iz + rx * ix,
      mzv = fz * iz + rz * ix;
    const len = Math.hypot(mxv, mzv);

    const wantsRun = (keys.ShiftLeft || keys.ShiftRight) && len > 0;
    if (wantsRun && stamina > 0) stamina = Math.max(0, stamina - 22 * dt);
    else stamina = Math.min(100, stamina + 14 * dt);

    const spd = wantsRun && stamina > 2 ? 8.8 : 4.7;
    if (len > 0) {
      mxv /= len;
      mzv /= len;
    }
    const k = 1 - Math.exp(-(P.ground ? 12 : 3) * dt);
    P.vx += (mxv * spd * (len > 0 ? 1 : 0) - P.vx) * k;
    P.vz += (mzv * spd * (len > 0 ? 1 : 0) - P.vz) * k;
    P.x = clamp(P.x + P.vx * dt, bounds.x0, bounds.x1);
    P.z = clamp(P.z + P.vz * dt, bounds.z0, bounds.z1);
    collide();

    if (keys.Space && P.ground) {
      P.vy = 9.2;
      P.ground = false;
    }
    P.vy -= 26 * dt;
    P.y += P.vy * dt;
    const fl = floorAt();
    if (P.y <= fl) {
      P.y = fl;
      P.vy = 0;
      P.ground = true;
    } else P.ground = false;

    const sp = Math.hypot(P.vx, P.vz);
    let turnRate = 0;

    if (armed) {
      const tr = yaw + Math.PI;
      const d = Math.atan2(Math.sin(tr - P.rot), Math.cos(tr - P.rot));
      P.rot += d;
      turnRate = clamp((d / Math.max(dt, 1e-3)) * 0.25, -1.5, 1.5);
    } else if (sp > 0.3) {
      const tr = Math.atan2(P.vx, P.vz);
      const d = Math.atan2(Math.sin(tr - P.rot), Math.cos(tr - P.rot));
      const step = d * (1 - Math.exp(-14 * dt));
      P.rot += step;
      turnRate = clamp((step / Math.max(dt, 1e-3)) * 0.25, -1.5, 1.5);
    }
    P.turnSmooth += (turnRate - P.turnSmooth) * Math.min(1, dt * 10);

    if (P.ground) P.walkT += dt * sp * 2.2;

    const fwdSpeed = P.vx * Math.sin(P.rot) + P.vz * Math.cos(P.rot);
    const sideSpeed = P.vx * Math.cos(P.rot) - P.vz * Math.sin(P.rot);

    player.animate(P.walkT, sp, P.ground, armed, aiming, {
      velY: P.vy,
      turn: P.turnSmooth,
      lookPitch: armed ? -pitch * 0.65 : 0,
      fwdSpeed,
      sideSpeed,
      hit: playerHitTimer > 0,
    });

    const wantPlayerWave =
      playerMeetTimer > 0 && !armed && playerHitTimer <= 0 ? 1 : 0;
    playerWaveBlend +=
      (wantPlayerWave - playerWaveBlend) * (1 - Math.exp(-10 * dt));
    if (playerWaveBlend > 0.02) {
      const rig = player.h || player;
      if (rig.arms && rig.arms[1]) {
        const waveArmX = -2.15 + Math.sin(performance.now() * 0.014) * 0.22;
        rig.arms[1].rotation.x +=
          (waveArmX - rig.arms[1].rotation.x) * playerWaveBlend;
        rig.arms[1].rotation.z +=
          (-0.25 - rig.arms[1].rotation.z) * playerWaveBlend;
        if (rig.elbows && rig.elbows[1]) {
          rig.elbows[1].rotation.x +=
            (-0.55 - rig.elbows[1].rotation.x) * playerWaveBlend;
        }
      }
    }

    player.g.position.set(P.x, P.y, P.z);
    player.g.rotation.y = P.rot;
    player.blob.position.set(P.x, 0.14, P.z);
    player.blob.scale.setScalar(clamp(1 - P.y * 0.12, 0.4, 1));
  }

  for (const v of traffic) {
    if (!v.hijacked && !v.exploded) updateVehicle(dt, v, false);
  }

  for (let i = pedestrians.length - 1; i >= 0; i--) {
    const n = pedestrians[i];

    if (n.hp <= 0) {
      if (!n.deathHandled) {
        n.deathHandled = true;
        n.deathTimer = 1.25;
        if (n.speech) n.speech.visible = false;
        if (n.isVendor) sfx.stopWade();
        spawnFloatingMoney(n.g.position.x, n.g.position.z, n.money || 250);
      }
      n.deathTimer -= dt;
      n.g.rotation.x += (-Math.PI / 2 - n.g.rotation.x) * Math.min(1, dt * 8);
      n.g.position.y = Math.max(0.2, n.g.position.y - 1.2 * dt);
      animateHuman(n.h, 0, 0, true, { dead: true });

      if (n.deathTimer <= 0) {
        scene.remove(n.g);
        pedestrians.splice(i, 1);
        if (!n.isVendor) spawnReplacementNPC();
      }
      continue;
    }

    const dx = n.g.position.x - P.x,
      dz = n.g.position.z - P.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 220) continue;

    if (n.meetCooldown > 0) n.meetCooldown -= dt;
    if (n.hitTimer > 0) n.hitTimer -= dt;

    if (n.knockDown > 0) {
      n.knockDown -= dt;
      n.g.position.x += (n.knockVx || 0) * dt;
      n.g.position.z += (n.knockVz || 0) * dt;
      n.knockVx *= Math.exp(-4.5 * dt);
      n.knockVz *= Math.exp(-4.5 * dt);
      n.knockVy = (n.knockVy || 0) - 22 * dt;
      n.g.position.y = Math.max(0.22, n.g.position.y + n.knockVy * dt);
      n.g.rotation.x += (-Math.PI / 2 - n.g.rotation.x) * Math.min(1, dt * 10);
      animateHuman(n.h, 0, 0, true, { dead: true });

      if (n.knockDown <= 0 && n.hp > 0) {
        n.g.position.y = 0;
        n.g.rotation.x = 0;
        n.panic = 5.0;
        n.panicDirX = n.dir || 1;
        n.panicDirZ = 0.4;
      }
      continue;
    }

    if (!activeVehicle && !hijackState && n.hp > 0 && P.y < 1.5) {
      const minDist = P.r + 0.38;
      if (dist < minDist && dist > 1e-4) {
        const push = (minDist - dist) * 0.5;
        const nx = dx / dist;
        const nz = dz / dist;
        n.g.position.x += nx * push;
        n.g.position.z += nz * push;
        P.x -= nx * push;
        P.z -= nz * push;

        const playerSpd = Math.hypot(P.vx, P.vz);
        if (playerSpd > 5.5 && n.hitTimer <= 0) {
          n.hitTimer = 0.48;
          n.g.position.x += nx * 0.35;
          n.g.position.z += nz * 0.35;
          sfx.bump(false);
        } else if ((n.meetCooldown || 0) <= 0) {
          n.meetTimer = 1.35;
          n.meetCooldown = 7.0;
          playerMeetTimer = 1.05;
        }
      }
    }

    if (n.hp > 0 && !n.isVendor) {
      if (n.homeZ === undefined) n.homeZ = n.g.position.z;
      let sideSteer = 0;
      let nearbyCount = 0;

      for (let j = 0; j < pedestrians.length; j++) {
        if (i === j) continue;
        const m = pedestrians[j];
        if (m.hp <= 0 || m.knockDown > 0) continue;

        const mdx = m.g.position.x - n.g.position.x;
        const mdz = m.g.position.z - n.g.position.z;
        const mdist = Math.hypot(mdx, mdz);

        if (mdist < 2.2) nearbyCount++;

        if (mdist < 2.0 && mdx * n.dir > 0 && Math.abs(mdz) < 0.72) {
          sideSteer += n.dir > 0 ? 0.55 : -0.55;
        }

        if (mdist < 0.72 && mdist > 1e-4 && j > i) {
          const push = (0.72 - mdist) * 0.55;
          const nx = mdx / mdist;
          const nz = mdz / mdist || (n.dir > 0 ? -1 : 1);
          if (!m.isVendor) {
            m.g.position.x += nx * push * 0.5;
            m.g.position.z += nz * push * 1.4;
          }
          n.g.position.x -= nx * push * 0.5;
          n.g.position.z -= nz * push * 1.4;

          if (
            nearbyCount <= 1 &&
            (n.meetCooldown || 0) <= 0 &&
            (m.meetCooldown || 0) <= 0
          ) {
            n.meetTimer = 0.85;
            n.meetCooldown = 10.0;
            m.meetTimer = 0.85;
            m.meetCooldown = 10.0;
          }
        }
      }

      const targetZ =
        sideSteer !== 0 ? n.homeZ + clamp(sideSteer, -0.65, 0.65) : n.homeZ;
      n.g.position.z += (targetZ - n.g.position.z) * Math.min(1, dt * 3.5);
    }

    collideNPC(n);

    if (n.stun > 0 || n.panic > 0) {
      if (n.speech) n.speech.visible = false;
      if (n.isVendor) sfx.stopWade();
      continue;
    }

    if (n.isVendor) {
      if (n.homeX === undefined) n.homeX = n.g.position.x;
      if (n.homeZ === undefined) n.homeZ = n.g.position.z;
      n.g.position.x = n.homeX;
      n.g.position.z = n.homeZ;

      const triggerDist = 14;
      const maxHearDist = 28;
      const isNear = dist < triggerDist;

      const wantYaw = isNear ? Math.atan2(-dx, -dz) : 0;
      n.yaw +=
        Math.atan2(Math.sin(wantYaw - n.yaw), Math.cos(wantYaw - n.yaw)) *
        (1 - Math.exp(-6 * dt));
      n.g.rotation.y = n.yaw;

      if (isNear) {
        if (!n.wasNear) {
          n.yellTimer = 0;
          n.wasNear = true;
        }
        n.yellTimer = (n.yellTimer ?? 0) - dt;
        if (n.yellTimer <= 0 && sfx.wadeAudio.paused) {
          n.yellTimer = 4.5 + Math.random() * 2.0;
          n.yellAnim = 2.4;
          if (n.speech) n.speech.visible = true;
          sfx.wadeCall(dist, maxHearDist);
        }
      } else {
        n.wasNear = false;
      }

      sfx.updateWadeVolume(dist, maxHearDist);

      n.phase += dt * 3;
      animateHuman(n.h, n.phase, 0, true, { hit: n.hitTimer > 0 });

      const wantVendorWave =
        (n.yellAnim > 0 || !sfx.wadeAudio.paused) && dist < maxHearDist ? 1 : 0;
      n.waveBlend =
        (n.waveBlend || 0) +
        (wantVendorWave - (n.waveBlend || 0)) * (1 - Math.exp(-10 * dt));

      if (n.waveBlend > 0.02) {
        if (n.yellAnim > 0) n.yellAnim -= dt;
        const targetArmX = -2.35 + Math.sin(performance.now() * 0.012) * 0.28;
        n.h.arms[1].rotation.x +=
          (targetArmX - n.h.arms[1].rotation.x) * n.waveBlend;
        n.h.arms[1].rotation.z +=
          (-0.22 - n.h.arms[1].rotation.z) * n.waveBlend;
        if (n.h.elbows.length) {
          n.h.elbows[1].rotation.x +=
            (-0.45 - n.h.elbows[1].rotation.x) * n.waveBlend;
        }
      } else if (n.speech) {
        n.speech.visible = false;
      }
      continue;
    }

    const scared = keys.KeyH && dist < 12;
    n.wait -= dt;
    if (n.wait <= 0 && !scared && Math.random() < dt * 0.05)
      n.wait = 2 + Math.random() * 3;

    const meeting = (n.meetTimer || 0) > 0 && !scared;
    if (meeting) n.meetTimer -= dt;

    const idle = (n.wait > 0 || n.hitTimer > 0) && !scared;
    const sp = idle ? 0 : n.speed * (scared ? 2.8 : 1);

    n.g.position.x += n.dir * sp * dt;
    if (n.g.position.x > n.maxX) {
      n.g.position.x = n.maxX;
      n.dir = -1;
    }
    if (n.g.position.x < n.minX) {
      n.g.position.x = n.minX;
      n.dir = 1;
    }

    collideNPC(n);

    const want = idle
      ? dist < 9
        ? Math.atan2(-dx, -dz)
        : n.yaw
      : n.dir > 0
        ? Math.PI / 2
        : -Math.PI / 2;
    n.yaw +=
      Math.atan2(Math.sin(want - n.yaw), Math.cos(want - n.yaw)) *
      (1 - Math.exp(-8 * dt));
    n.g.rotation.y = n.yaw;
    n.phase += dt * (3 + sp * 2.2);

    const wantWave = meeting && n.hitTimer <= 0 ? 1 : 0;
    n.waveBlend =
      (n.waveBlend || 0) +
      (wantWave - (n.waveBlend || 0)) * (1 - Math.exp(-10 * dt));

    animateHuman(n.h, n.phase, sp, true, {
      hit: n.hitTimer > 0,
      lookPitch:
        n.waveBlend > 0.05
          ? Math.sin(performance.now() * 0.01) * 0.14 * n.waveBlend
          : 0,
    });

    if (n.waveBlend > 0.02) {
      const targetArmX = -2.2 + Math.sin(performance.now() * 0.014) * 0.24;
      n.h.arms[1].rotation.x +=
        (targetArmX - n.h.arms[1].rotation.x) * n.waveBlend;
      n.h.arms[1].rotation.z += (-0.25 - n.h.arms[1].rotation.z) * n.waveBlend;
      if (n.h.elbows.length) {
        n.h.elbows[1].rotation.x +=
          (-0.5 - n.h.elbows[1].rotation.x) * n.waveBlend;
      }
    }
  }

  if (mission) {
    beacon.rotation.y += dt * 2;
    const dist = Math.hypot(P.x - mission.target.x, P.z - mission.target.z);
    if (dist < 4.5) {
      if (mission.phase === "pickup") {
        let dest = landmarks[Math.floor(Math.random() * landmarks.length)];
        while (dest === mission.target)
          dest = landmarks[Math.floor(Math.random() * landmarks.length)];
        const prev = mission.target;
        mission.phase = "dropoff";
        mission.target = dest;
        mission.reward =
          Math.round(
            (250 + Math.hypot(dest.x - prev.x, dest.z - prev.z) * 1.1) / 10,
          ) * 10;
        beacon.position.set(dest.x, 7, dest.z);
        beacon.material.color.setHex(0x22c55e);
        $("mission-text").textContent = `Drop at ${dest.name}`;
        sfx.cash();
        toast(`Passenger onboard! Drive to ${dest.name}`);
      } else {
        cash += mission.reward;
        sfx.cash();
        saveGameSession();
        toast(`Drop-off Complete! Earned +LKR ${mission.reward}`);
        $("mission-text").textContent = "Press [M] for next Taxi Job";
        beacon.visible = false;
        mission = null;
      }
    }
  }

  let loc = "Lanka Main Road";
  for (const a of areas)
    if (P.x > a.x0 && P.x < a.x1 && P.z > a.z0 && P.z < a.z1) {
      loc = a.name;
      break;
    }
  if (loc !== lastLoc) {
    $("loc").textContent = loc;
    lastLoc = loc;
  }

  if (!activeVehicle && !hijackState) {
    const nearV = allVehicles.find(
      (v) =>
        !v.exploded &&
        Math.hypot(P.x - v.root.position.x, P.z - v.root.position.z) < 5.0,
    );
    if (nearV) {
      $("interact").textContent = nearV.driver
        ? "Press [E] to Pull Driver & Take Vehicle"
        : "Press [E] to Enter Vehicle";
      $("interact").style.display = "block";
    } else {
      $("interact").style.display = "none";
    }
  } else {
    $("interact").style.display = "none";
  }

  const camDist = activeVehicle
    ? activeVehicle.type === "bus"
      ? 9.8
      : 6.8
    : aiming
      ? 2.3
      : armed
        ? 3.5
        : 4.8;
  const targetY = P.y + (activeVehicle ? 1.85 : 1.72);
  const sideOffset = activeVehicle ? 0 : aiming ? 0.68 : 0.52;

  const tx = P.x + Math.cos(yaw) * sideOffset;
  const tz = P.z - Math.sin(yaw) * sideOffset;
  const shakeX =
    screenShake > 0 ? (Math.random() - 0.5) * screenShake * 0.7 : 0;
  const shakeY =
    screenShake > 0 ? (Math.random() - 0.5) * screenShake * 0.7 : 0;

  const cx = tx + Math.sin(yaw) * Math.cos(pitch) * camDist + shakeX;
  let cy = targetY + Math.sin(pitch) * camDist + shakeY;
  const cz = tz + Math.cos(yaw) * Math.cos(pitch) * camDist;

  for (const c of nearCols(cx, cz, 1)) {
    if (!c.b || cy > c.h) continue;
    if (
      cx > c.x0 - 0.3 &&
      cx < c.x1 + 0.3 &&
      cz > c.z0 - 0.3 &&
      cz < c.z1 + 0.3
    ) {
      cy = Math.max(cy, c.h + 0.4);
    }
  }

  camera.position.set(cx, Math.max(0.45, cy), cz);
  camera.lookAt(tx, targetY, tz);
  sky.position.copy(camera.position);

  if ((armed && !activeVehicle && !hijackState) || hitMarkerTimer > 0) {
    if (armed && !activeVehicle && !hijackState) getCrosshairAimPoint(true);
    updateCrosshairUI(
      armed && !activeVehicle && !hijackState,
      aiming,
      targetLocked,
    );
  }

  if (SHADOWS) {
    const sx = Math.round(P.x / 8) * 8,
      sz = Math.round(P.z / 8) * 8;
    sunL.target.position.set(sx, 0, sz);
    sunL.position.set(sx + SUN.x * 110, SUN.y * 110, sz + SUN.z * 110);
    sunL.target.updateMatrixWorld();
  }

  for (const c of clouds) {
    c.position.x += 1.4 * dt;
    if (c.position.x > 440) c.position.x = -440;
  }

  if ((hudTick += dt) > 0.12) {
    updateHud();
    drawMinimap();
    for (const r of regions)
      r.obj.visible = Math.hypot(r.cx - P.x, r.cz - P.z) < r.r + 340;
    for (const v of traffic)
      v.root.visible =
        Math.hypot(v.root.position.x - P.x, v.root.position.z - P.z) < 340;
    for (const n of pedestrians)
      n.g.visible =
        Math.hypot(n.g.position.x - P.x, n.g.position.z - P.z) < 200;
    hudTick = 0;
  }

  if ((saveTick += dt) > 2.5) {
    saveGameSession();
    saveTick = 0;
  }
}

/* ---------- Render Loop ---------- */
let last = performance.now(),
  frames = 0,
  fpsTimer = 0,
  warm = 0,
  lowCount = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  frames++;
  fpsTimer += dt;
  warm += dt;
  if (fpsTimer >= 0.5) {
    const fps = Math.round(frames / fpsTimer);
    $("fps").textContent = fps + " FPS";
    if (warm > 4) {
      if (fps < 26) {
        if (++lowCount >= 4 && scale > MIN_SCALE) {
          scale = Math.max(MIN_SCALE, scale - 0.1);
          applyRes();
          lowCount = 0;
        }
      } else {
        lowCount = 0;
        if (fps > 52 && scale < MAX_SCALE) {
          scale = Math.min(MAX_SCALE, scale + 0.05);
          applyRes();
        }
      }
    }
    frames = 0;
    fpsTimer = 0;
  }

  if (!paused) update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
