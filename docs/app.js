const TEMPLATES = {
  "Pierna": [
    "Prensa",
    "Peso Muerto",
    "Búlgaras",
    "Extensión cuádriceps"
  ],
  "Pecho": [
    "Press inclinado",
    "Contractor",
    "Cierre polea alto",
    "Cierre polea bajo"
  ],
  "Espalda": [
    "Lumbares",
    "Remo Dorsal",
    "Remo alto",
    "Remo unilateral",
    "Jalón Dorsal",
    "Jalón alto",
    "Pull Over"
  ],
  "Hombro": [
    "Pres Militar máquina",
    "Press militar mancuerna",
    "Elevaciones laterales",
    "Pájaros polea",
    "Flexiones escápula",
    "Levantamientos en Y",
    "Face Pull"
  ],
  "Bíceps": [
    "Predicador",
    "Polea",
    "Bayesian",
    "Waitress",
    "Curl",
    "Concentrado"
  ],
  "Tríceps": [
    "Katana",
    "Extensión polea",
    "Press estrecho",
    "Extensión unilateral"
  ]
};
const LS_KEY = "gym_tracker_sessions_v1";

const $ = (id) => document.getElementById(id);

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function todayISO(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

let sessions = [];
let draft = null;

// --------- storage ----------
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    sessions = raw ? JSON.parse(raw) : [];
  } catch {
    sessions = [];
  }
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(sessions));
}

// --------- helpers ----------
function lastUsed(exName) {
  for (const s of sessions) {
    const e = (s.entries || []).find(x => x.name === exName && x.selected);
    if (e && e.sets && e.sets.length) {
      // pick max weight set if possible
      const withW = e.sets.filter(t => typeof t.weight === "number" && !Number.isNaN(t.weight));
      if (!withW.length) return null;
      const max = withW.reduce((a,b)=> (b.weight > a.weight ? b : a));
      return { date: s.date, group: s.muscleGroup, reps: max.reps, weight: max.weight };
    }
  }
  return null;
}

function cleanNumber(x) {
  if (x === "" || x === null || x === undefined) return "";
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : "";
}

// --------- UI ----------
function initControls() {
  $("date").value = todayISO();
  const groupSel = $("group");
  groupSel.innerHTML = Object.keys(TEMPLATES).map(g => `<option value="${g}">${g}</option>`).join("");
}

function newSession() {
  const date = $("date").value || todayISO();
  const group = $("group").value;
  draft = {
    id: uid(),
    date,
    muscleGroup: group,
    entries: TEMPLATES[group].map(name => ({ name, selected:false, sets:[] }))
  };
  renderDraft();
}

function toggleExercise(name) {
  draft.entries = draft.entries.map(e => {
    if (e.name !== name) return e;
    const selected = !e.selected;
    return { ...e, selected, sets: selected ? e.sets : [] };
  });
  renderDraft();
}

function addSet(name) {
  draft.entries = draft.entries.map(e => {
    if (e.name !== name) return e;
    return { ...e, sets: [...e.sets, { reps:"", weight:"" }] };
  });
  renderDraft();
}

function updateSet(name, idx, field, value) {
  draft.entries = draft.entries.map(e => {
    if (e.name !== name) return e;
    const sets = e.sets.map((s,i)=> i===idx ? ({ ...s, [field]: value }) : s);
    return { ...e, sets };
  });
}

function removeSet(name, idx) {
  draft.entries = draft.entries.map(e => {
    if (e.name !== name) return e;
    const sets = e.sets.filter((_,i)=> i!==idx);
    return { ...e, sets };
  });
  renderDraft();
}

function saveDraft() {
  const cleaned = {
    ...draft,
    entries: draft.entries.map(e => ({
      ...e,
      sets: e.sets.map(s => ({
        reps: cleanNumber(s.reps),
        weight: cleanNumber(s.weight),
      }))
    }))
  };
  sessions.unshift(cleaned);
  save();
  draft = null;
  renderDraft();
  renderHistory();
}

function cancelDraft() {
  draft = null;
  renderDraft();
}

function deleteSession(id) {
  sessions = sessions.filter(s => s.id !== id);
  save();
  renderHistory();
}

function exportData() {
  const data = {
    exportedAt: new Date().toISOString(),
    sessions
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gym-tracker-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function renderDraft() {
  const wrap = $("draft");
  if (!draft) {
    wrap.innerHTML = "";
    return;
  }

  wrap.innerHTML = `
    <div class="session">
      <div class="session__title">
        <strong>${draft.muscleGroup} — ${draft.date}</strong>
        <span class="pill">Sesión en edición</span>
      </div>

      ${draft.entries.map(ex => {
        const last = lastUsed(ex.name);
        const safe = ex.name.replace(/'/g, "\\'");
        return `
          <div class="exercise">
            <div class="exercise__head">
              <label class="exercise__name" style="margin:0">
                <input class="checkbox" type="checkbox" ${ex.selected ? "checked" : ""} onchange="toggleExercise('${safe}')">
                ${ex.name}
              </label>
              <div class="exercise__last">${last ? `Último: ${last.weight} kg × ${last.reps} (${last.date})` : "Sin historial"}</div>
            </div>

            ${ex.selected ? `
              <div style="margin-top:10px">
                <button class="btn btn--ghost" onclick="addSet('${safe}')">+ Añadir serie</button>

                ${ex.sets.length ? `
                  <div class="sets">
                    ${ex.sets.map((s,idx)=>`
                      <div class="setrow">
                        <span>Serie ${idx+1}</span>
                        <input placeholder="Reps" inputmode="numeric" value="${s.reps}" oninput="updateSet('${safe}',${idx},'reps',this.value)">
                        <input placeholder="Peso (kg)" inputmode="decimal" value="${s.weight}" oninput="updateSet('${safe}',${idx},'weight',this.value)">
                        <button class="btn btn-danger" onclick="removeSet('${safe}',${idx})">Quitar</button>
                      </div>
                    `).join("")}
                  </div>
                ` : ""}
              </div>
            ` : ""}
          </div>
        `;
      }).join("")}

      <div class="row" style="margin-top:12px">
        <button class="btn" onclick="saveDraft()">Guardar sesión</button>
        <button class="btn btn--ghost" onclick="cancelDraft()">Cancelar</button>
      </div>
    </div>
  `;
}

function renderHistory() {
  const wrap = $("history");
  if (!sessions.length) {
    wrap.innerHTML = `<p class="muted">Aún no hay sesiones guardadas.</p>`;
    return;
  }

  wrap.innerHTML = sessions.slice(0, 40).map(s => `
    <div class="session">
      <div class="session__title">
        <strong>${s.date} — ${s.muscleGroup}</strong>
        <button class="btn btn--ghost" onclick="deleteSession('${s.id}')">Borrar</button>
      </div>
      <div class="muted small" style="margin-top:8px">
        ${(s.entries||[]).filter(e=>e.selected).map(e=>{
          const sets = (e.sets||[]).length
            ? (e.sets||[]).map(t => `${t.weight}kg×${t.reps}`).join(" | ")
            : "sin series";
          return `• ${e.name}: ${sets}`;
        }).join("<br>")}
      </div>
    </div>
  `).join("");
}

// --------- PWA ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}

// Install button (works on some browsers; iOS uses Share → Add to Home Screen)
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = $("installBtn");
  btn.hidden = false;
  btn.addEventListener("click", async () => {
    btn.hidden = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });
});

// --------- boot ----------
load();
initControls();
renderHistory();

$("newBtn").addEventListener("click", newSession);
$("exportBtn").addEventListener("click", exportData);

// expose functions for inline handlers
window.toggleExercise = toggleExercise;
window.addSet = addSet;
window.updateSet = updateSet;
window.removeSet = removeSet;
window.saveDraft = saveDraft;
window.cancelDraft = cancelDraft;
window.deleteSession = deleteSession;
