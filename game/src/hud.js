// hud.js — DOM HUD + 2D minimap for Costa Mirada.
// Original code written for this game. All DOM ids match index.html.
// Minimap draws roads, beach, player arrow, mission marker, police,
// traffic dots and enemies on a circular canvas.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), wanted: $('wanted'), cash: $('cash'), clock: $('clock'),
    objName: $('obj-name'), objText: $('obj-text'), objDist: $('obj-dist'),
    healthFill: $('healthfill'), speed: $('speed'), vehicleName: $('vehiclename'),
    toast: $('toast'), dialog: $('dialog'), interact: $('interact'),
    crosshair: $('crosshair'), ammo: $('ammo'),
    minimap: $('minimap-canvas'),
  };
  const mm = el.minimap.getContext('2d');
  let toastTimer = null;
  let dialogTimer = null;

  function show(id, on) { el[id]?.classList.toggle('hidden', !on); }

  return {
    showHud(on) { el.hud.classList.toggle('hidden', !on); },
    setObjective(name, text) {
      el.objName.textContent = name;
      el.objText.textContent = text;
    },
    setObjectiveText(text) { el.objText.textContent = text; },
    setObjectiveDist(text) { el.objDist.textContent = text; },
    setWanted(stars) {
      let html = '';
      for (let i = 0; i < 5; i++) html += `<span class="star${i < stars ? ' on' : ''}">★</span>`;
      el.wanted.innerHTML = html;
    },
    setCash(money) { el.cash.textContent = `$${Math.floor(money).toLocaleString('en-US')}`; },
    setClock(day, hours) {
      const h = Math.floor(hours) % 24;
      const m = Math.floor((hours % 1) * 60);
      const label = h < 6 || h >= 20 ? 'NIGHT' : h < 12 ? 'MORNING' : h < 17 ? 'AFTERNOON' : 'EVENING';
      el.clock.textContent = `DAY ${day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${label}`;
    },
    setHealth(hp) {
      el.healthFill.style.width = `${Math.max(0, Math.min(100, hp))}%`;
    },
    setSpeed(kmh, vehicleName) {
      el.speed.textContent = String(Math.round(Math.abs(kmh)));
      el.vehicleName.textContent = vehicleName || '';
    },
    setAmmo(ammo, show) {
      el.ammo.classList.toggle('hidden', !show);
      if (show) el.ammo.textContent = `AMMO ${ammo} · [Click] shoot · [F] punch`;
    },
    showCrosshair(on) { el.crosshair.classList.toggle('hidden', !on); },
    showInteract(text) {
      if (text) { el.interact.textContent = text; el.interact.classList.remove('hidden'); }
      else el.interact.classList.add('hidden');
    },
    toast(text, ms = 2600) {
      el.toast.textContent = text;
      el.toast.classList.remove('hidden');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.toast.classList.add('hidden'), ms);
    },
    showDialog(who, text, ms = 4200) {
      el.dialog.innerHTML = `<span class="who">${who}:</span> ${text}`;
      el.dialog.classList.remove('hidden');
      if (dialogTimer) clearTimeout(dialogTimer);
      dialogTimer = setTimeout(() => el.dialog.classList.add('hidden'), ms);
    },
    hideDialog() { el.dialog.classList.add('hidden'); },
    // Minimap: world coords (-260..260) -> canvas (340x340, center 170).
    drawMinimap(state) {
      // state: { playerX, playerZ, heading, marker, police:[{x,z}], traffic:[{x,z}],
      //         enemies:[{x,z}], chase:{x,z}|null, passenger:{x,z}|null }
      const W = 340, C = W / 2;
      const scale = W / 560;
      const toX = (x) => C + (x + 10) * scale;
      const toY = (z) => C + z * scale;
      mm.clearRect(0, 0, W, W);
      mm.fillStyle = '#0d2f45';
      mm.fillRect(0, 0, W, W);
      // Ocean + sand (west).
      mm.fillStyle = '#1e6f9e';
      mm.fillRect(0, 0, toX(-310), W);
      mm.fillStyle = '#e8d8a8';
      mm.fillRect(toX(-310), 0, toX(-240) - toX(-310), W);
      // Blocks.
      mm.fillStyle = '#2a4a3a';
      for (let bx = -4; bx < 4; bx++) for (let bz = -4; bz < 4; bz++) {
        mm.fillRect(toX(bx * 60 + 8), toY(bz * 60 + 8), 44 * scale, 44 * scale);
      }
      // Roads.
      mm.strokeStyle = '#5a5a66';
      mm.lineWidth = 7;
      for (const c of [-240, -180, -120, -60, 0, 60, 120, 180, 240]) {
        mm.beginPath(); mm.moveTo(toX(-250), toY(c)); mm.lineTo(toX(250), toY(c)); mm.stroke();
        mm.beginPath(); mm.moveTo(toX(c), toY(-250)); mm.lineTo(toX(c), toY(250)); mm.stroke();
      }
      // Passenger.
      if (state.passenger) {
        mm.fillStyle = '#7dff8a';
        mm.beginPath(); mm.arc(toX(state.passenger.x), toY(state.passenger.z), 6, 0, Math.PI * 2); mm.fill();
      }
      // Enemies.
      mm.fillStyle = '#ff4040';
      for (const e of state.enemies || []) {
        mm.beginPath(); mm.arc(toX(e.x), toY(e.z), 5, 0, Math.PI * 2); mm.fill();
      }
      // Chase target.
      if (state.chase) {
        mm.fillStyle = '#ff4040';
        mm.beginPath(); mm.arc(toX(state.chase.x), toY(state.chase.z), 7, 0, Math.PI * 2); mm.fill();
        mm.strokeStyle = '#fff'; mm.lineWidth = 2;
        mm.beginPath(); mm.arc(toX(state.chase.x), toY(state.chase.z), 10, 0, Math.PI * 2); mm.stroke();
      }
      // Police.
      mm.fillStyle = '#4080ff';
      for (const p of state.police || []) {
        mm.beginPath(); mm.arc(toX(p.x), toY(p.z), 5, 0, Math.PI * 2); mm.fill();
      }
      // Traffic.
      mm.fillStyle = '#c8c8d8';
      for (const t of state.traffic || []) {
        mm.fillRect(toX(t.x) - 2, toY(t.z) - 2, 4, 4);
      }
      // Mission marker (pulsing yellow diamond).
      if (state.marker) {
        const pulse = 7 + Math.sin(performance.now() * 0.006) * 2.5;
        mm.fillStyle = '#ffd23e';
        mm.save();
        mm.translate(toX(state.marker.x), toY(state.marker.z));
        mm.rotate(Math.PI / 4);
        mm.fillRect(-pulse / 1.4, -pulse / 1.4, pulse * 1.4, pulse * 1.4);
        mm.restore();
      }
      // Player arrow.
      mm.save();
      mm.translate(toX(state.playerX), toY(state.playerZ));
      mm.rotate(state.heading);
      mm.fillStyle = '#fff';
      mm.beginPath();
      mm.moveTo(0, -9); mm.lineTo(6, 7); mm.lineTo(0, 3); mm.lineTo(-6, 7);
      mm.closePath(); mm.fill();
      mm.strokeStyle = '#000'; mm.lineWidth = 1.5; mm.stroke();
      mm.restore();
    },
  };
}
