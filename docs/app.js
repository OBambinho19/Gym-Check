
const DEFAULT_TEMPLATES = {
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

const LS_SESSIONS_V2 = "gym_tracker_sessions_v2";
const LS_TEMPLATES_V1 = "gym_tracker_templates_v1";
const LS_SESSIONS_V1 = "gym_tracker_sessions_v1"; // migrate old

const $ = (id) => document.getElementById(id);

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function todayISO(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function cleanNumber(x) {
  if (x === "" || x === null || x === undefined) return "";
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : "";
}

let templates = null;
let sessions = [];
let draft = null;

// storage
function loadTemplates() {
  try {
    const raw = localStorage.getItem(LS_TEMPLATES_V1);
    templates = raw ? JSON.parse(raw) : structuredClone(DEFAULT_TEMPLATES);
  } catch {
    templates = structuredClone(DEFAULT_TEMPLATES);
  }
}
function saveTemplates() {
  localStorage.setItem(LS_TEMPLATES_V1, JSON.stringify(templates));
}
function loadSessions() {
  try {
    const raw = localStorage.getItem(LS_SESSIONS_V2);
    sessions = raw ? JSON.parse(raw) : [];
  } catch {
    sessions = [];
  }
  if (!sessions.length) {
    try {
      const raw1 = localStorage.getItem(LS_SESSIONS_V1);
      if (raw1) {
        const s1 = JSON.parse(raw1);
        if (Array.isArray(s1) && s1.length) {
          sessions = s1.map(old => ({
            id: old.id || uid(),
            date: old.date,
            blocks: [{
              id: uid(),
              group: old.muscleGroup || "Sesión",
              entries: (old.entries||[]).map(e => ({...e}))
            }]
          }));
          saveSessions();
        }
      }
    } catch {}
  }
}
function saveSessions() {
  localStorage.setItem(LS_SESSIONS_V2, JSON.stringify(sessions));
}

function groups() {
  return Object.keys(templates);
}

function lastUsed(exName) {
  for (const s of sessions) {
    for (const b of (s.blocks || [])) {
      const e = (b.entries || []).find(x => x.name === exName && x.selected);
      if (e && e.sets && e.sets.length) {
        const withW = e.sets.filter(t => typeof t.weight === "number" && !Number.isNaN(t.weight));
        if (!withW.length) continue;
        const max = withW.reduce((a,b)=> (b.weight > a.weight ? b : a));
        return { date: s.date, group: b.group, reps: max.reps, weight: max.weight };
      }
    }
  }
  return null;
}

function initControls() {
  $("date").value = todayISO();
  $("tplGroup").innerHTML = groups().map(x => `<option value="${x}">${x}</option>`).join("");
}

// navigation
function setActiveTab(id) {
  for (const t of ["tabWorkout","tabTemplates","tabHistory"]) $(t).classList.remove("active");
  $(id).classList.add("active");
  $("viewWorkout").hidden = id !== "tabWorkout";
  $("viewTemplates").hidden = id !== "tabTemplates";
  $("viewHistory").hidden = id !== "tabHistory";
  if (id === "tabTemplates") renderTemplates();
  if (id === "tabHistory") renderHistory();
}

// workout
function makeBlock(group) {
  return {
    id: uid(),
    group,
    entries: (templates[group] || []).map(name => ({ name, selected:false, sets:[] }))
  };
}

function newSession() {
  const date = $("date").value || todayISO();
  draft = { id: uid(), date, blocks: [] };
  $("addBlockBtn").disabled = false;
  $("saveBtn").disabled = false;
  addBlock();
  renderDraft();
}

function addBlock() {
  if (!draft) return;
  const g = groups()[0];
  draft.blocks.push(makeBlock(g));
  renderDraft();
}

function changeBlockGroup(blockId, newGroup) {
  const idx = draft.blocks.findIndex(b => b.id === blockId);
  if (idx === -1) return;
  draft.blocks[idx] = makeBlock(newGroup);
  renderDraft();
}
function removeBlock(blockId) {
  draft.blocks = draft.blocks.filter(b => b.id !== blockId);
  renderDraft();
}

function toggleExercise(blockId, exName) {
  const block = draft.blocks.find(b => b.id === blockId);
  if (!block) return;
  block.entries = block.entries.map(e => {
    if (e.name !== exName) return e;
    const selected = !e.selected;
    return { ...e, selected, sets: selected ? e.sets : [] };
  });
  renderDraft();
}
function addSet(blockId, exName) {
  const block = draft.blocks.find(b => b.id === blockId);
  if (!block) return;
  block.entries = block.entries.map(e => e.name === exName ? ({...e, sets:[...e.sets, { reps:"", weight:"" }]}) : e);
  renderDraft();
}
function updateSet(blockId, exName, idx, field, value) {
  const block = draft.blocks.find(b => b.id === blockId);
  if (!block) return;
  block.entries = block.entries.map(e => {
    if (e.name !== exName) return e;
    const sets = e.sets.map((s,i)=> i===idx ? ({...s, [field]: value}) : s);
    return {...e, sets};
  });
}
function removeSet(blockId, exName, idx) {
  const block = draft.blocks.find(b => b.id === blockId);
  if (!block) return;
  block.entries = block.entries.map(e => e.name === exName ? ({...e, sets: e.sets.filter((_,i)=> i!==idx)}) : e);
  renderDraft();
}

function saveDraft() {
  if (!draft) return;
  const cleaned = {
    ...draft,
    blocks: draft.blocks.map(b => ({ 
      ...b,
      entries: b.entries.map(e => ({ 
        ...e,
        sets: e.sets.map(s => ({ reps: cleanNumber(s.reps), weight: cleanNumber(s.weight) }))
      }))
    }))
  };
  sessions.unshift(cleaned);
  saveSessions();
  draft = null;
  $("addBlockBtn").disabled = true;
  $("saveBtn").disabled = true;
  renderDraft();
  renderHistory();
}

function cancelDraft() {
  draft = null;
  $("addBlockBtn").disabled = true;
  $("saveBtn").disabled = true;
  renderDraft();
}

// templates
function renderTemplates() {
  const group = $("tplGroup").value;
  const list = templates[group] || [];
  $("tplList").innerHTML = list.map((name, idx) => `
    <div class="tpl-item">
      <input value="${name.replaceAll('"','&quot;')}" oninput="tplRename('${group}', ${idx}, this.value)" />
      <button class="btn btn-danger" onclick="tplDelete('${group}', ${idx})">Borrar</button>
    </div>
  `).join("") || `<p class="muted">No hay ejercicios. Añade alguno.</p>`;
}
function tplAdd() {
  const group = $("tplGroup").value;
  const name = prompt("Nombre del ejercicio:");
  if (!name) return;
  templates[group] = templates[group] || [];
  templates[group].push(name.trim());
  saveTemplates();
  renderTemplates();
}
function tplRename(group, idx, value) {
  templates[group][idx] = (value || "").trim();
  saveTemplates();
}
function tplDelete(group, idx) {
  if (!confirm("¿Borrar este ejercicio de la plantilla?")) return;
  templates[group].splice(idx, 1);
  saveTemplates();
  renderTemplates();
}
function tplReset() {
  if (!confirm("¿Resetear plantillas a las originales?")) return;
  templates = structuredClone(DEFAULT_TEMPLATES);
  saveTemplates();
  initControls();
  renderTemplates();
}

// history
function renderHistory() {
  const wrap = $("history");
  if (!sessions.length) {
    wrap.innerHTML = `<p class="muted">Aún no hay sesiones guardadas.</p>`;
    return;
  }
  wrap.innerHTML = sessions.slice(0, 60).map(s => {
    const g = (s.blocks||[]).map(b=>b.group).join(" + ");
    const lines = (s.blocks||[]).flatMap(b => (b.entries||[]).filter(e=>e.selected).map(e => {
      const sets = (e.sets||[]).length ? (e.sets||[]).map(t => `${t.weight}kg×${t.reps}`).join(" | ") : "sin series";
      return `• <strong>${b.group}</strong> — ${e.name}: ${sets}`;
    }));
    return `
      <div class="session">
        <div class="session__title">
          <strong>${s.date} — ${g || "Sesión"}</strong>
          <button class="btn btn--ghost" onclick="deleteSession('${s.id}')">Borrar</button>
        </div>
        <div class="muted small" style="margin-top:8px">${lines.join("<br>") || "—"}</div>
      </div>
    `;
  }).join("");
}
function deleteSession(id) {
  sessions = sessions.filter(s => s.id !== id);
  saveSessions();
  renderHistory();
}
function exportData() {
  const data = { exportedAt: new Date().toISOString(), templates, sessions };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gym-tracker-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.sessions) || !data.templates) throw new Error("Formato inválido");
      if (!confirm("Esto sobrescribirá tus datos actuales. ¿Continuar?")) return;
      templates = data.templates;
      sessions = data.sessions;
      saveTemplates(); saveSessions();
      initControls(); renderTemplates(); renderHistory();
      alert("Importado OK.");
    } catch (e) {
      alert("No se pudo importar: " + (e?.message || "error"));
    }
  };
  reader.readAsText(file);
}

// draft render
function renderDraft() {
  const wrap = $("draft");
  if (!draft) { wrap.innerHTML = ""; return; }
  wrap.innerHTML = `
    <div class="session">
      <div class="session__title">
        <strong>Sesión — ${draft.date}</strong>
        <span class="pill">En edición</span>
      </div>
      ${draft.blocks.map((b, bIdx) => `
        <div class="block">
          <div class="block__head">
            <div class="field">
              <label>Grupo ${bIdx+1}</label>
              <select onchange="changeBlockGroup('${b.id}', this.value)">
                ${groups().map(g => `<option value="${g}" ${g===b.group ? "selected" : ""}>${g}</option>`).join("")}
              </select>
            </div>
            <button class="btn btn-danger" onclick="removeBlock('${b.id}')">Quitar grupo</button>
          </div>
          ${b.entries.map(ex => {
            const last = lastUsed(ex.name);
            const safe = ex.name.replace(/'/g, "\\'");
            return `
              <div class="exercise">
                <div class="exercise__head">
                  <label class="exercise__name" style="margin:0">
                    <input class="checkbox" type="checkbox" ${ex.selected ? "checked" : ""} onchange="toggleExercise('${b.id}','${safe}')">
                    ${ex.name}
                  </label>
                  <div class="exercise__last">${last ? `Último: ${last.weight} kg × ${last.reps} (${last.date})` : "Sin historial"}</div>
                </div>
                ${ex.selected ? `
                  <div style="margin-top:10px">
                    <button class="btn btn--ghost" onclick="addSet('${b.id}','${safe}')">+ Añadir serie</button>
                    ${ex.sets.length ? `
                      <div class="sets">
                        ${ex.sets.map((s,idx)=>`
                          <div class="setrow">
                            <span>Serie ${idx+1}</span>
                            <input placeholder="Reps" inputmode="numeric" value="${s.reps}" oninput="updateSet('${b.id}','${safe}',${idx},'reps',this.value)">
                            <input placeholder="Peso (kg)" inputmode="decimal" value="${s.weight}" oninput="updateSet('${b.id}','${safe}',${idx},'weight',this.value)">
                            <button class="btn btn-danger" onclick="removeSet('${b.id}','${safe}',${idx})">Quitar</button>
                          </div>
                        `).join("")}
                      </div>
                    ` : ""}
                  </div>
                ` : ""}
              </div>
            `;
          }).join("")}
        </div>
      `).join("")}
      <div class="row" style="margin-top:12px">
        <button class="btn btn--ghost" onclick="cancelDraft()">Cancelar</button>
      </div>
    </div>
  `;
}

// PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

// boot
loadTemplates(); loadSessions(); initControls(); renderHistory(); renderTemplates();
$("tabWorkout").addEventListener("click", () => setActiveTab("tabWorkout"));
$("tabTemplates").addEventListener("click", () => setActiveTab("tabTemplates"));
$("tabHistory").addEventListener("click", () => setActiveTab("tabHistory"));
setActiveTab("tabWorkout");

$("newBtn").addEventListener("click", newSession);
$("addBlockBtn").addEventListener("click", addBlock);
$("saveBtn").addEventListener("click", saveDraft);
$("tplGroup").addEventListener("change", renderTemplates);
$("tplAddExerciseBtn").addEventListener("click", tplAdd);
$("tplResetBtn").addEventListener("click", tplReset);
$("exportBtn").addEventListener("click", exportData);
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) importData(file);
  e.target.value = "";
});

// expose
window.changeBlockGroup = changeBlockGroup;
window.removeBlock = removeBlock;
window.toggleExercise = toggleExercise;
window.addSet = addSet;
window.updateSet = updateSet;
window.removeSet = removeSet;
window.cancelDraft = cancelDraft;
window.deleteSession = deleteSession;
window.tplRename = tplRename;
window.tplDelete = tplDelete;
