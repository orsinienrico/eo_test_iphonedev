"use strict";

/* ---------- Logica di analisi (pura, testabile anche in Node) ---------- */

const MONTHS = "gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic";
const DAYS = "oggi|domani|dopodomani|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica|monday|tuesday|wednesday|thursday|friday";
const RANGES = "fine (?:mese|settimana|anno|giornata|trimestre)|(?:la )?prossima settimana|settimana prossima|next week|end of (?:day|week|month|year)|eod|eow|q[1-4]";
const NUMERIC = "\\d{1,2}[\\/.\\-]\\d{1,2}(?:[\\/.\\-]\\d{2,4})?|\\d{1,2} (?:" + MONTHS + ")\\w*";

const ACTION_VERBS = [
  "deve", "devono", "dovrà", "dovra", "dovranno", "prepara", "preparerà", "invia", "invierà",
  "manda", "manderà", "scrive", "scriverà", "verifica", "verificherà", "controlla", "controllerà",
  "organizza", "organizzerà", "contatta", "contatterà", "aggiorna", "aggiornerà", "chiama",
  "chiamerà", "prenota", "prenoterà", "condivide", "condividerà", "si occupa", "si occuperà",
  "prende in carico", "porta", "porterà", "fissa", "fisserà", "completa", "completerà", "crea",
  "creerà", "consegna", "consegnerà", "raccoglie", "raccoglierà", "will", "needs to", "to do",
  "todo", "action", "da fare", "follow up", "follow-up"
];

const DECISION_WORDS = [
  "deciso", "decidiamo", "decidono", "decisione", "abbiamo deciso", "approvato", "approvata",
  "concordato", "confermato", "confermata", "stabilito", "si va con", "si procede", "d'accordo",
  "decided", "agreed", "approved", "confirmed", "go with"
];

const OPEN_WORDS = [
  "da chiarire", "da definire", "da verificare", "da valutare", "da capire", "in sospeso",
  "aperto", "aperta", "non è chiaro", "non e chiaro", "dubbio", "tbd", "open question",
  "to be decided", "da decidere"
];

const NOT_NAMES = new Set([
  "Il", "Lo", "La", "Le", "Gli", "Un", "Una", "Uno", "Poi", "Quindi", "Inoltre", "Infine",
  "Si", "Ci", "Non", "Per", "Entro", "Deciso", "Confermato", "Approvato", "Azione", "Action",
  "The", "We", "They", "Then", "Also"
]);

const BOUNDARY_BEFORE = "(?:^|[^\\p{L}])";
const BOUNDARY_AFTER = "(?![\\p{L}])";

function wordRegex(list) {
  const body = list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(BOUNDARY_BEFORE + "(?:" + body + ")" + BOUNDARY_AFTER, "iu");
}

const RE_ACTION = wordRegex(ACTION_VERBS);
const RE_DECISION = wordRegex(DECISION_WORDS);
const RE_OPEN = wordRegex(OPEN_WORDS);
const RE_DEADLINE = new RegExp(
  "(?:entro|by|per|before)\\s+(?:il\\s+|la\\s+|l')?(?:" + DAYS + "|" + RANGES + "|" + NUMERIC + ")",
  "iu"
);

const NAME = "[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ']+";
const VERBS_ALT = ACTION_VERBS
  .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const RE_OWNER = new RegExp(
  "(?:^|[^A-Za-zÀ-ÿ'@])@?(" + NAME + "(?:\\s+(?:e|and)\\s+" + NAME + ")?)\\s+(?:" + VERBS_ALT + ")(?![a-zà-ÿ])"
);

/** Divide il testo in frasi, togliendo elenchi puntati e numerazioni. */
function splitSentences(text) {
  const out = [];
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  for (const rawLine of lines) {
    const line = rawLine
      .replace(/^[\s\-*•·]+/, "")
      .replace(/^\d+[.)]\s+/, "")
      .replace(/(\d)\.(\d)/g, "$1\u0001$2") // non spezzare date/decimali
      .trim();
    if (!line) continue;
    const parts = line.match(/[^.!?;]+[.!?;]?/g) || [];
    for (const p of parts) {
      const s = p.replace(/\u0001/g, ".").trim();
      if (s.length >= 3) out.push(s);
    }
  }
  return out;
}

function findOwner(sentence) {
  const m = sentence.match(RE_OWNER);
  if (!m) return "";
  const first = m[1].split(/\s+/)[0];
  return NOT_NAMES.has(first) ? "" : m[1];
}

function findDeadline(sentence) {
  const m = sentence.match(RE_DEADLINE);
  return m ? m[0].trim() : "";
}

function cleanSentence(s) {
  return s.replace(/^(?:deciso|decisione|azione|action|todo|punto aperto)\s*[:\-–]\s*/i, "").trim();
}

/** Analizza le note e restituisce decisioni, azioni e punti aperti. */
function analyze(text) {
  const decisions = [];
  const actions = [];
  const open = [];

  for (const sentence of splitSentences(text)) {
    const isQuestion = sentence.includes("?");
    const isOpen = isQuestion || RE_OPEN.test(sentence);
    if (isOpen) {
      open.push(cleanSentence(sentence));
      continue;
    }

    const isDecision = RE_DECISION.test(sentence);
    const hasVerb = RE_ACTION.test(sentence);
    const deadline = findDeadline(sentence);

    if (isDecision) decisions.push(cleanSentence(sentence));

    if (hasVerb || (!isDecision && deadline)) {
      actions.push({
        text: cleanSentence(sentence),
        owner: findOwner(sentence),
        deadline
      });
    }
  }
  return { decisions, actions, open };
}

/** Compone la bozza di email di follow-up in italiano. */
function buildFollowup(result, date) {
  const when = (date || new Date()).toLocaleDateString("it-IT");
  const lines = [];
  lines.push("Oggetto: Follow-up riunione del " + when);
  lines.push("");
  lines.push("Ciao a tutti,");
  lines.push("");
  lines.push("grazie per la partecipazione. Ecco il riepilogo di quanto emerso.");

  if (result.decisions.length) {
    lines.push("", "DECISIONI");
    result.decisions.forEach(d => lines.push("- " + d));
  }
  if (result.actions.length) {
    lines.push("", "AZIONI");
    result.actions.forEach(a => {
      const extra = [a.owner && "owner: " + a.owner, a.deadline].filter(Boolean).join(", ");
      lines.push("- " + a.text + (extra ? " (" + extra + ")" : ""));
    });
  }
  if (result.open.length) {
    lines.push("", "PUNTI APERTI");
    result.open.forEach(o => lines.push("- " + o));
  }
  if (!result.decisions.length && !result.actions.length && !result.open.length) {
    lines.push("", "(Nessun elemento riconosciuto: completa il riepilogo a mano.)");
  }

  lines.push("", "Fatemi sapere se manca qualcosa o se qualcosa va corretto.", "", "Un saluto");
  return lines.join("\n");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { splitSentences, analyze, buildFollowup };
}

/* ---------- Interfaccia ---------- */

if (typeof document !== "undefined") {
  const $ = id => document.getElementById(id);

  const SAMPLE = [
    "Riunione piano migrazione servizio clienti.",
    "Deciso di migrare il servizio entro fine mese.",
    "Marco prepara il piano di rilascio entro venerdì.",
    "Laura deve contattare il fornitore per il contratto entro il 15/10.",
    "Confermato il budget di fase uno.",
    "Chi si occupa dei test di carico?",
    "Da chiarire la data esatta del go-live."
  ].join("\n");

  function fillList(id, items, render) {
    const ul = $(id);
    ul.replaceChildren();
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Nessun elemento trovato.";
      ul.appendChild(li);
      return;
    }
    items.forEach(item => {
      const li = document.createElement("li");
      render(li, item);
      ul.appendChild(li);
    });
  }

  function addTag(li, text) {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = text;
    li.appendChild(span);
  }

  function setStatus(msg) {
    $("status").textContent = msg;
    if (msg) setTimeout(() => { if ($("status").textContent === msg) $("status").textContent = ""; }, 2500);
  }

  function run() {
    const text = $("notes").value.trim();
    if (!text) {
      $("results").classList.add("hidden");
      $("notes").focus();
      return;
    }
    const result = analyze(text);
    fillList("decisions", result.decisions, (li, d) => { li.textContent = d; });
    fillList("actions", result.actions, (li, a) => {
      li.appendChild(document.createTextNode(a.text));
      if (a.owner) addTag(li, a.owner);
      if (a.deadline) addTag(li, a.deadline);
    });
    fillList("open", result.open, (li, o) => { li.textContent = o; });
    $("followup").value = buildFollowup(result);
    $("results").classList.remove("hidden");
    $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function copyFollowup() {
    const text = $("followup").value;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copiato negli appunti.");
    } catch (e) {
      $("followup").select();
      const ok = document.execCommand && document.execCommand("copy");
      setStatus(ok ? "Copiato negli appunti." : "Copia non riuscita: seleziona il testo a mano.");
    }
  }

  function openMail() {
    const text = $("followup").value;
    const lines = text.split("\n");
    let subject = "Follow-up riunione";
    let body = text;
    if (/^Oggetto:/i.test(lines[0])) {
      subject = lines[0].replace(/^Oggetto:\s*/i, "");
      body = lines.slice(2).join("\n");
    }
    window.location.href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  $("analyze").addEventListener("click", run);
  $("example").addEventListener("click", () => { $("notes").value = SAMPLE; run(); });
  $("clear").addEventListener("click", () => {
    $("notes").value = "";
    $("results").classList.add("hidden");
    $("notes").focus();
  });
  $("copy").addEventListener("click", copyFollowup);
  $("mail").addEventListener("click", openMail);
}
