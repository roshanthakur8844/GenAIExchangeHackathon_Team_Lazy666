/* -------------------- Gemini config -------------------- */
/* Note: backend handles Gemini usage. Frontend calls /chat which triggers server-side Gemini.
   GEMINI_KEY kept false here so frontend uses backend; no key in client. */
const USE_DEMO_CLIENT = false; // frontend never uses key directly

async function askBackend(text) {
  try {
    const resp = await fetch("/chat", {
      method: "POST",
      body: new URLSearchParams({ message: text }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    const data = await resp.json();
    return data.reply || "Let's breathe together.";
  } catch (e) {
    console.warn("chat error", e);
    return "Network issue — let's take a soft breath together.";
  }
}

/* -------------------- Messaging & AI hooks -------------------- */
const msgs = document.getElementById("msgs");
function addMsg(t, who = "ai") {
  const m = document.createElement("div");
  m.className = `msg ${who === "me" ? "me" : "ai"}`;
  m.textContent = t;
  msgs.appendChild(m);
  msgs.scrollTop = msgs.scrollHeight;
}

const inp = document.getElementById("inp");
document.getElementById("send").onclick = onSend;
inp.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onSend();
});

async function onSend() {
  const text = inp.value.trim();
  if (!text) return;
  addMsg(text, "me");
  inp.value = "";
  const reply = await askBackend(text);
  addMsg(reply, "ai");

  // AI-driven actions
  if (/scroll|doom|tired|late|stressed/i.test(text)) {
    triggerBreak();
  }
  if (/rain|focus/i.test(text)) setAmbience("rain");
  else if (/bowl|meditate/i.test(text)) setAmbience("bowls");
  else if (/ocean|calm|relax/i.test(text)) setAmbience("ocean");
  rotateTip();
}

/* -------------------- Ambient sound control -------------------- */
const label = document.getElementById("soundLabel");
function stopAll() {
  ["ocean", "rain", "bowls"].forEach((id) => {
    const a = document.getElementById("amb-" + id);
    if (!a) return;
    a.pause();
    a.currentTime = 0;
  });
}
function setAmbience(which = "ocean") {
  stopAll();
  const a = document.getElementById("amb-" + which);
  if (!a) return;
  a.volume = 0.45;
  a.play().catch(() => {});
  label.textContent =
    (which === "ocean" ? "🌊 Ocean" : which === "rain" ? "🌧️ Rain" : "🔔 Bowls") +
    " ambience";
}
let unmuted = false;
["amb-ocean", "amb-rain", "amb-bowls"].forEach((id) => {
  const a = document.getElementById(id);
  if (a) a.muted = true;
});
setAmbience("ocean");
function unmuteAll() {
  if (unmuted) return;
  unmuted = true;
  ["amb-ocean", "amb-rain", "amb-bowls"].forEach((id) => {
    const a = document.getElementById(id);
    if (a) { a.muted = false; a.volume = 0.45; }
  });
}
["keydown", "pointerdown", "touchstart", "mousemove"].forEach((ev) =>
  window.addEventListener(ev, unmuteAll, { once: true })
);

/* -------------------- Break overlay + breath tone -------------------- */
const overlay = document.getElementById("overlay"),
  countEl = document.getElementById("count"),
  meter = document.getElementById("meter");
const skip = document.getElementById("skip"),
  done = document.getElementById("done");
let countdown = 60, timer;

function triggerBreak() {
  overlay.style.display = "flex";
  overlay.setAttribute("aria-hidden", "false");
  countdown = 60;
  countEl.textContent = countdown;
  meter.style.setProperty("--p", "0%");
  skip.disabled = true;
  done.disabled = true;
  skip.textContent = "Skip (10)";
  let lock = 10;
  setAmbience("ocean");
  startBreathTone();
  timer = setInterval(() => {
    countdown--;
    countEl.textContent = countdown;
    meter.style.setProperty("--p", 100 - (countdown / 60) * 100 + "%");
    if (lock > 0) {
      lock--;
      skip.textContent = `Skip (${lock})`;
      if (lock <= 0) skip.disabled = false;
    }
    if (countdown <= 0) {
      clearInterval(timer);
      endBreak();
    }
  }, 1000);
}

function endBreak() {
  overlay.style.display = "none";
  overlay.setAttribute("aria-hidden", "true");
  stopBreathTone();
  const chime = document.getElementById("chime");
  if (chime) chime.play().catch(() => {});
}
skip.onclick = () => { if (!skip.disabled) { clearInterval(timer); endBreak(); } };
done.onclick = () => { clearInterval(timer); endBreak(); };
document.getElementById("tab-break").onclick = () => triggerBreak();

/* WebAudio tone synced to orb animation */
let AC, osc, gain, raf;
function startBreathTone() {
  AC = new (window.AudioContext || window.webkitAudioContext)();
  osc = AC.createOscillator();
  gain = AC.createGain();
  osc.type = "sine";
  osc.connect(gain).connect(AC.destination);
  gain.gain.value = 0.001;
  osc.start();
  const start = performance.now();
  function loop(t) {
    const cyc = (t - start) % 12000;
    let phase = 0;
    if (cyc < 4000) phase = cyc / 4000;
    else if (cyc < 6000) phase = 1;
    else phase = 1 - (cyc - 6000) / 6000;
    const freq = 174 + 26 * phase;
    const vol = 0.002 + 0.02 * phase;
    osc.frequency.setValueAtTime(freq, AC.currentTime);
    gain.gain.setValueAtTime(vol, AC.currentTime);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
}
function stopBreathTone() {
  try { osc && osc.stop(); } catch {}
  cancelAnimationFrame(raf);
}

/* -------------------- Relax Zone waves + tips -------------------- */
const wave = document.getElementById("waves");
const wctx = wave ? wave.getContext("2d") : null;
function sizeW() { if (!wave) return; wave.width = wave.clientWidth; wave.height = wave.clientHeight; }
window.addEventListener("resize", sizeW);
sizeW();
let tt = 0;
(function drawW(){
  if (wctx) {
    wctx.clearRect(0,0,wave.width,wave.height);
    wctx.fillStyle = "#60a5fa44";
    wctx.beginPath();
    for (let x=0; x < wave.width; x++){
      const y = wave.height/2 + Math.sin((x+tt)/38)*18 + Math.sin((x+tt)/85)*10;
      if (x===0) wctx.moveTo(x,y); else wctx.lineTo(x,y);
    }
    wctx.lineTo(wave.width,wave.height); wctx.lineTo(0,wave.height); wctx.closePath(); wctx.fill();
    tt += 1.8;
  }
  requestAnimationFrame(drawW);
})();

const tip = document.getElementById("tip");
const tips = [
  "Place your phone face down; breathe in for 4, out for 6.",
  "Unfollow one noisy account after this breath.",
  "Turn brightness down a notch—your eyes will thank you.",
  "Stand up, roll your shoulders, then continue.",
  "Move the next app you open to a folder named “Later”."
];
function rotateTip(){ if (tip) tip.textContent = tips[Math.floor(Math.random()*tips.length)]; }
setInterval(rotateTip, 20000);


/* -------------------- Relaxing gradient + bubbles background -------------------- */
/* -------------------- Relaxing gradient + bubbles background -------------------- */
const bg = document.getElementById("bg");
const bctx = bg.getContext("2d");

function sizeBG() {
  bg.width = window.innerWidth;
  bg.height = window.innerHeight;
}
window.addEventListener("resize", sizeBG);
sizeBG();

let hue = 200;
let bubbles = [];
for (let i = 0; i < 20; i++) {
  bubbles.push({
    x: Math.random() * bg.width,
    y: bg.height + Math.random() * bg.height,
    r: 8 + Math.random() * 14,
    speed: 0.3 + Math.random() * 0.5,
  });
}

function drawBubbles() {
  // pastel gradient background
  hue += 0.05;
  const grad = bctx.createLinearGradient(0, 0, bg.width, bg.height);
  grad.addColorStop(0, `hsl(${hue % 360}, 70%, 92%)`);
  grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 70%, 96%)`);
  bctx.fillStyle = grad;
  bctx.fillRect(0, 0, bg.width, bg.height);

  // floating bubbles
  bctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let b of bubbles) {
    bctx.beginPath();
    bctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    bctx.fill();
    b.y -= b.speed;
    if (b.y < -b.r) {
      b.y = bg.height + b.r;
      b.x = Math.random() * bg.width;
    }
  }

  requestAnimationFrame(drawBubbles);
}
drawBubbles();


