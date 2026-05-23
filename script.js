// ============ FIREBASE CONFIG ============

const firebaseConfig = {
  apiKey: "AIzaSyBI2miUO3ypOreocKs_wk7YpPMAJpShUAg",
  authDomain: "tr4-senet.firebaseapp.com",
  databaseURL: "https://tr4-senet-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "tr4-senet",
  storageBucket: "tr4-senet.firebasestorage.app",
  messagingSenderId: "811854858128",
  appId: "1:811854858128:web:1ee2cfb98989c09ff91515"
}

firebase.initializeApp(firebaseConfig)
const db = firebase.database()

// ============ STATO ONLINE ============

const online = {
  salaRef: null,        // riferimento Firebase alla sala corrente
  codice: null,         // codice sala (es. "XK7F")
  mioNumero: null,      // 1 o 2 — chi sono io in questa sessione
  inAscolto: false,     // flag per evitare doppi listener
}

// ============ STATO DI GIOCO ============

const gameState = {
  modalita: null,       // "cpu" | "umano" | "online"
  difficolta: null,
  giocatoreCorrente: 1,
  faseTurno: "lancio",  // "lancio" | "selezione"
  risultatoDado: null,
  selezionata: null,
  celleEvidenziate: [],
  facceDado: { 1:"⚀", 2:"⚁", 3:"⚂", 4:"⚃", 6:"⚅" }
}

const percorsoP1 = [
  [1,3],[1,2],[1,1],[1,0],
  [2,0],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6],[2,7],[2,8],[2,9],[2,10],[2,11]
]
const percorsoP2 = [
  [3,3],[3,2],[3,1],[3,0],
  [2,0],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6],[2,7],[2,8],[2,9],[2,10],[2,11]
]
const SPECIALI = [4, 8, 12, 16]
const LUNGHEZZA_PERCORSO = 16

let pedine = []

const DOM = {
  board: document.getElementById("board"),
  menu: document.getElementById("menu"),
  sottomenu: document.getElementById("sottomenu"),
  dado1: document.getElementById("dado1"),
  dado2: document.getElementById("dado2"),
}

// ============ LOG DI GIOCO ============

let logEntries = []

function log(messaggio, tipo = "normale") {
  logEntries.push({ messaggio, tipo })
  aggiornaLogUI()
}

function nomePedina(pedina) {
  const lettera = pedina.id.replace(/[0-9]/g, "").toUpperCase()
  const numero = parseInt(pedina.id.replace(/[^0-9]/g, "")) + 1
  return `${lettera}${numero}`
}

function nomeGiocatore(n) {
  if (gameState.modalita === "cpu") return n === 1 ? "🔴 Giocatore 1" : "🤖 Computer"
  if (gameState.modalita === "online") return n === 1 ? "🔴 Giocatore 1" : "🔵 Giocatore 2"
  return n === 1 ? "🔴 Giocatore 1" : "🔵 Giocatore 2"
}

function aggiornaLogUI() {
  const logList = document.getElementById("log-list")
  if (!logList) return
  logList.innerHTML = ""
  ;[...logEntries].reverse().forEach((entry, i) => {
    const div = document.createElement("div")
    div.className = "log-entry log-" + entry.tipo
    div.textContent = (logEntries.length - i) + ". " + entry.messaggio
    logList.appendChild(div)
  })
  logList.scrollTop = 0
}

function copiaLog() {
  const testo = logEntries.map((e, i) => `${i + 1}. ${e.messaggio}`).join("\n")
  navigator.clipboard.writeText(testo).then(() => {
    const btn = document.getElementById("btn-copia-log")
    if (btn) {
      btn.textContent = "✅ Copiato!"
      setTimeout(() => { btn.textContent = "📋 Copia log" }, 1500)
    }
  })
}

function apriLogOverlay() {
  const overlay = document.getElementById("log-overlay")
  if (!overlay) return
  overlay.classList.add("aperto")
  aggiornaLogUI()
}

function chiudiLogOverlay() {
  const overlay = document.getElementById("log-overlay")
  if (overlay) overlay.classList.remove("aperto")
}

function creaLogPanel() {
  const vecchio = document.getElementById("log-panel")
  if (vecchio) vecchio.remove()
  const oldStyle = document.getElementById("log-style")
  if (oldStyle) oldStyle.remove()
  const vecchioOverlay = document.getElementById("log-overlay")
  if (vecchioOverlay) vecchioOverlay.remove()
  const vecchioBt = document.getElementById("btn-apri-log")
  if (vecchioBt) vecchioBt.remove()

  const overlay = document.createElement("div")
  overlay.id = "log-overlay"
  overlay.innerHTML = `
    <div id="log-panel-inner">
      <div id="log-header">
        <span>📜 Log di partita</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="btn-copia-log" onclick="copiaLog()">📋 Copia log</button>
          <button id="btn-chiudi-log" onclick="chiudiLogOverlay()">✕</button>
        </div>
      </div>
      <div id="log-list"></div>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.addEventListener("click", e => { if (e.target === overlay) chiudiLogOverlay() })

  const btn = document.createElement("button")
  btn.id = "btn-apri-log"
  btn.title = "Apri log di partita"
  btn.textContent = "📜"
  btn.onclick = apriLogOverlay
  document.body.appendChild(btn)

  function posizionaBtn() {
    const board = document.getElementById("board")
    if (!board) return
    const rect = board.getBoundingClientRect()
    btn.style.top   = (rect.top + -140) + "px"
    btn.style.right = (window.innerWidth - rect.right + -115) + "px"
  }
  posizionaBtn()
  window.addEventListener("resize", posizionaBtn)
}

// ============ SETUP MENU ============

function scegliVsComputer() {
  gameState.modalita = "cpu"
  DOM.sottomenu.innerHTML = `
    <h3>Difficoltà</h3>
    <button onclick="avviaGioco('facile')">Facile</button>
    <button onclick="avviaGioco('medio')">Medio</button>
    <button onclick="avviaGioco('difficile')">Difficile</button>
  `
}

function scegliVsUmano() {
  gameState.modalita = "umano"
  DOM.sottomenu.innerHTML = `
    <h3>Modalità</h3>
    <button onclick="avviaGioco('offline')">Offline</button>
    <button onclick="apriMenuOnline()">Online</button>
  `
}

// ============ MENU ONLINE ============

function apriMenuOnline() {
  gameState.modalita = "online"
  DOM.sottomenu.innerHTML = `
    <div id="menu-online">
      <h3>Modalità Online</h3>
      <button onclick="creaPartitaOnline()">🏛️ Crea sala</button>
      <div class="separatore-online">oppure</div>
      <div class="join-row">
        <input id="input-codice" type="text" maxlength="4" placeholder="Codice sala" autocomplete="off" />
        <button onclick="uniscitiOnline()">🚪 Entra</button>
      </div>
      <div id="stato-online"></div>
    </div>
  `
}

function statoOnline(msg, tipo = "") {
  const el = document.getElementById("stato-online")
  if (el) {
    el.textContent = msg
    el.className = "stato-online " + tipo
  }
}

function generaCodice() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

async function creaPartitaOnline() {
  const codice = generaCodice()
  online.codice = codice
  online.mioNumero = 1

  const salaRef = db.ref(`partite/${codice}`)
  online.salaRef = salaRef

  await salaRef.set({
    giocatore1: true,
    giocatore2: false,
    avviata: false,
    stato: null,
    log: null
  })

  // Pulizia automatica alla disconnessione del creatore
  salaRef.onDisconnect().remove()

  statoOnline(`Sala creata! Codice: ${codice} — Aspetto l'avversario...`, "attesa")

  // Mostra il codice in grande
  mostraCodiceInAttesa(codice)

  // Aspetta che si unisca il giocatore 2
  salaRef.child("giocatore2").on("value", snap => {
    if (snap.val() === true) {
      salaRef.child("giocatore2").off()
      avviaPartitaOnline()
    }
  })
}

function mostraCodiceInAttesa(codice) {
  const menu = document.getElementById("menu-online")
  if (!menu) return
  menu.innerHTML = `
    <h3>In attesa dell'avversario</h3>
    <div class="codice-sala">${codice}</div>
    <div class="codice-label">Condividi questo codice con l'avversario</div>
    <div id="stato-online" class="stato-online attesa">In attesa di connessione...</div>
    <button onclick="annullaOnline()" style="margin-top:12px; font-size:0.65rem; opacity:0.6;">✕ Annulla</button>
  `
}

async function uniscitiOnline() {
  const input = document.getElementById("input-codice")
  if (!input) return
  const codice = input.value.trim().toUpperCase()
  if (codice.length !== 4) {
    statoOnline("Inserisci un codice di 4 caratteri.", "errore")
    return
  }

  const salaRef = db.ref(`partite/${codice}`)
  const snap = await salaRef.once("value")
  const data = snap.val()

  if (!data) {
    statoOnline("Sala non trovata. Controlla il codice.", "errore")
    return
  }
  if (data.avviata) {
    statoOnline("Partita già in corso.", "errore")
    return
  }
  if (data.giocatore2) {
    statoOnline("Sala già piena.", "errore")
    return
  }

  online.codice = codice
  online.mioNumero = 2
  online.salaRef = salaRef

  await salaRef.child("giocatore2").set(true)

  avviaPartitaOnline()
}

function annullaOnline() {
  if (online.salaRef) {
    online.salaRef.remove()
    online.salaRef = null
  }
  online.codice = null
  online.mioNumero = null
  scegliVsUmano()
}

// ============ AVVIO PARTITA ONLINE ============

function avviaPartitaOnline() {
  DOM.menu.style.display = "none"
  DOM.sottomenu.style.display = "none"
  document.body.style.paddingTop = "8px"
  document.querySelector(".intestazione").style.marginBottom = "8px"
  document.querySelectorAll(".barra-controlli").forEach(el => el.style.display = "flex")

  logEntries = []
  creaLogPanel()
  inizializzaPedine()

  // Solo G1 scrive lo stato iniziale
  if (online.mioNumero === 1) {
    online.salaRef.child("avviata").set(true)
    pubblicaStato()
  }

  // Mostra badge "Tu sei G1/G2"
  mostraBadgeGiocatore()

  // Aggiorna controlli (disabilita i pulsanti dell'avversario)
  aggiornaControlliOnline()

  // Inizia ascolto Firebase
  ascoltaStato()

  log(`Partita online iniziata — Sei il Giocatore ${online.mioNumero}`, "turno")
  log(`— Turno di ${nomeGiocatore(1)} —`, "turno")
  disegnaBoard()
}

function mostraBadgeGiocatore() {
  const vecchio = document.getElementById("badge-giocatore")
  if (vecchio) vecchio.remove()
  const badge = document.createElement("div")
  badge.id = "badge-giocatore"
  badge.className = online.mioNumero === 1 ? "badge-g1" : "badge-g2"
  badge.textContent = online.mioNumero === 1 ? "🔴 Tu sei Giocatore 1" : "🔵 Tu sei Giocatore 2"
  // Inserisce sopra il wrapper
  const wrapper = document.getElementById("wrapper")
  wrapper.parentNode.insertBefore(badge, wrapper)
}

function aggiornaControlliOnline() {
  if (gameState.modalita !== "online") return
  const barraG1 = document.querySelector(".barraG1")
  const barraG2 = document.querySelector(".barraG2")
  if (!barraG1 || !barraG2) return

  // Disabilita tutti i bottoni dell'altra barra
  const miaBarra   = online.mioNumero === 1 ? barraG1 : barraG2
  const suaBarra   = online.mioNumero === 1 ? barraG2 : barraG1

  miaBarra.querySelectorAll("button").forEach(b => b.disabled = false)
  suaBarra.querySelectorAll("button").forEach(b => {
    b.disabled = true
    b.style.opacity = "0.35"
    b.style.cursor  = "not-allowed"
  })
}

// ============ SINCRONIZZAZIONE FIREBASE ============

function pubblicaStato() {
  if (!online.salaRef) return

  // Serializza lo stato (no funzioni, no ref DOM)
  const payload = {
    giocatoreCorrente: gameState.giocatoreCorrente,
    faseTurno: gameState.faseTurno,
    risultatoDado: gameState.risultatoDado ?? null,
    selezionataId: gameState.selezionata ? gameState.selezionata.id : null,
    celleEvidenziate: gameState.celleEvidenziate,
    pedine: pedine.map(p => ({
      id: p.id,
      giocatore: p.giocatore,
      pos: p.pos,
      slot: p.slot,
      uscita: p.uscita ?? false
    })),
    logEntries: logEntries.slice(-80), // ultimi 80 per non sforare i limiti
    ts: Date.now()
  }

  online.salaRef.child("stato").set(payload)
}

function ascoltaStato() {
  if (online.inAscolto || !online.salaRef) return
  online.inAscolto = true

  online.salaRef.child("stato").on("value", snap => {
    const data = snap.val()
    if (!data) return

    // Ignora aggiornamenti scritti da me stesso (stessa fonte)
    // Criterio: se il turno corrente è il mio, l'ho scritto io → skip
    // In realtà il listener si attiva sempre, incluso dopo il mio set().
    // Usiamo un flag temporaneo per ignorare l'eco del proprio write.
    if (online._skipNext) {
      online._skipNext = false
      return
    }

    // Applica lo stato remoto solo se non è il mio turno
    // (se è il mio turno, ho già lo stato corretto in locale)
    applicaStatoRemoto(data)
  })
}

function applicaStatoRemoto(data) {
  // Aggiorna pedine
  pedine = data.pedine.map(p => ({ ...p }))

  // Aggiorna gameState
  gameState.giocatoreCorrente = data.giocatoreCorrente
  gameState.faseTurno = data.faseTurno
  gameState.risultatoDado = data.risultatoDado
  gameState.celleEvidenziate = data.celleEvidenziate || []
  gameState.selezionata = data.selezionataId
    ? pedine.find(p => p.id === data.selezionataId) ?? null
    : null

  // Aggiorna log (solo le entry nuove)
  if (data.logEntries && data.logEntries.length > logEntries.length) {
    logEntries = data.logEntries
    aggiornaLogUI()
  }

  // Aggiorna dado UI
  if (data.risultatoDado !== null) {
    const dadoDiv = data.giocatoreCorrente === 1 ? DOM.dado1 : DOM.dado2
    dadoDiv.classList.remove("shake")
    void dadoDiv.offsetWidth
    dadoDiv.classList.add("shake")
    dadoDiv.textContent = gameState.facceDado[data.risultatoDado] ?? data.risultatoDado
  }

  disegnaBoard()
}

// Helper: pubblica e segnala che il prossimo evento "value" è nostro
function pubblicaESalta() {
  online._skipNext = true
  pubblicaStato()
}

// ============ SETUP LOCALE (offline / cpu) ============

function avviaGioco(opzione) {
  gameState.difficolta = opzione

  DOM.menu.style.display = "none"
  DOM.sottomenu.style.display = "none"
  document.body.style.paddingTop = "8px"
  document.querySelector(".intestazione").style.marginBottom = "8px"
  document.querySelectorAll(".barra-controlli").forEach(el => el.style.display = "flex")

  logEntries = []
  creaLogPanel()

  inizializzaPedine()
  disegnaBoard()

  log(`Partita iniziata — ${gameState.modalita === "cpu" ? "vs Computer (" + opzione + ")" : "vs Umano (" + opzione + ")"}`, "turno")
  log(`— Turno di ${nomeGiocatore(1)} —`, "turno")
}

function inizializzaPedine() {
  pedine = [
    { id: "r0", giocatore: 1, pos: 0, slot: 0 },
    { id: "r1", giocatore: 1, pos: 0, slot: 1 },
    { id: "r2", giocatore: 1, pos: 0, slot: 2 },
    { id: "b0", giocatore: 2, pos: 0, slot: 0 },
    { id: "b1", giocatore: 2, pos: 0, slot: 1 },
    { id: "b2", giocatore: 2, pos: 0, slot: 2 },
  ]
}

// ============ COORDINATE FISICHE ============

function coordFisiche(giocatore, pos) {
  if (pos === 0) return null
  return giocatore === 1 ? percorsoP1[pos - 1] : percorsoP2[pos - 1]
}

function coordPartenza(giocatore) {
  return giocatore === 1
    ? [[0,0],[0,1],[0,2]]
    : [[4,0],[4,1],[4,2]]
}

// ============ DISEGNA BOARD ============

function disegnaBoard() {
  const board = [
    new Array(3).fill(null),
    new Array(4).fill(null),
    new Array(12).fill(null),
    new Array(4).fill(null),
    new Array(3).fill(null),
  ]

  for (const giocatore of [1, 2]) {
    const emoji = giocatore === 1 ? "🔴" : "🔵"
    const celle = coordPartenza(giocatore)
    pedine
      .filter(p => p.giocatore === giocatore && p.pos === 0 && !p.uscita)
      .forEach(p => {
        board[celle[p.slot][0]][celle[p.slot][1]] = { pedina: p, emoji }
      })
  }

  for (const p of pedine) {
    if (p.pos === 0 || p.uscita) continue
    const emoji = p.giocatore === 1 ? "🔴" : "🔵"
    const [col, row] = coordFisiche(p.giocatore, p.pos)
    board[col][row] = { pedina: p, emoji }
  }

  const c = DOM.board
  c.innerHTML = ""
  c.style.display = "flex"
  c.style.flexDirection = "row"

  const SPECIALI_COORDS = [
    [1,0],[3,0],[2,3],[2,7],[2,11]
  ]

  for (let col = 0; col < board.length; col++) {
    const colDiv = document.createElement("div")
    colDiv.style.display = "flex"
    colDiv.style.flexDirection = "column-reverse"

    for (let row = 0; row < board[col].length; row++) {
      const cell = document.createElement("div")
      cell.style.width = "50px"
      cell.style.height = "50px"
      cell.style.border = "1px solid black"
      cell.style.display = "flex"
      cell.style.alignItems = "center"
      cell.style.justifyContent = "center"
      cell.style.fontSize = "1.5em"
      cell.style.cursor = "pointer"
      cell.style.boxSizing = "border-box"

      const contenuto = board[col][row]

      const èSpecialeVisiva = SPECIALI_COORDS.some(([c,r]) => c === col && r === row)
      if (èSpecialeVisiva) cell.style.backgroundColor = "lightblue"

      const èEvidenziata = gameState.celleEvidenziate.some(([c,r]) => c === col && r === row)
      if (èEvidenziata) cell.style.backgroundColor = "yellow"

      if (contenuto) {
        cell.textContent = contenuto.emoji
        if (gameState.selezionata && gameState.selezionata.id === contenuto.pedina.id) {
          cell.style.border = "3px solid orange"
        }
        cell.onclick = () => selezionaPedina(contenuto.pedina)
      } else if (èSpecialeVisiva) {
        cell.textContent = "⭐"
      }

      colDiv.appendChild(cell)
    }

    c.appendChild(colDiv)
  }
}

// ============ LOGICA DI GIOCO ============

function mossePossibili(dado) {
  return pedine.filter(p => {
    if (p.giocatore !== gameState.giocatoreCorrente) return false
    if (p.uscita) return false
    const nuovaPos = p.pos + dado
    if (nuovaPos > LUNGHEZZA_PERCORSO) return false

    if (nuovaPos > 0) {
      const occupante = pedine.find(altra =>
        altra.id !== p.id &&
        altra.giocatore === p.giocatore &&
        !altra.uscita &&
        altra.pos === nuovaPos
      )
      if (occupante) return false
    }

    return true
  })
}

function selezionaPedina(pedina) {
  if (gameState.faseTurno !== "selezione") return
  if (pedina.giocatore !== gameState.giocatoreCorrente) return

  // In modalità online, solo il giocatore di turno può selezionare
  if (gameState.modalita === "online" && pedina.giocatore !== online.mioNumero) return
  if (gameState.modalita === "online" && gameState.giocatoreCorrente !== online.mioNumero) return

  const dado = gameState.risultatoDado
  const nuovaPos = pedina.pos + dado

  if (nuovaPos > LUNGHEZZA_PERCORSO) return

  const occupante = pedine.find(altra =>
    altra.id !== pedina.id &&
    altra.giocatore === pedina.giocatore &&
    !altra.uscita &&
    altra.pos === nuovaPos
  )
  if (occupante) return

  gameState.selezionata = pedina

  const coordFrom = pedina.pos === 0
    ? coordPartenza(pedina.giocatore)[pedina.slot]
    : coordFisiche(pedina.giocatore, pedina.pos)

  const evidenziate = coordFrom ? [coordFrom] : []
  if (nuovaPos <= LUNGHEZZA_PERCORSO && nuovaPos > 0) {
    evidenziate.push(coordFisiche(pedina.giocatore, nuovaPos))
  }

  gameState.celleEvidenziate = evidenziate
  disegnaBoard()

  // Pubblica la selezione in tempo reale così l'avversario vede l'evidenziatura
  if (gameState.modalita === "online") pubblicaESalta()
}

function confermaMossa(giocatorePulsante) {
  if (giocatorePulsante !== gameState.giocatoreCorrente) return
  if (!gameState.selezionata || gameState.risultatoDado === null) return

  // Online: solo il giocatore di turno può confermare
  if (gameState.modalita === "online" && giocatorePulsante !== online.mioNumero) return

  const pedina = gameState.selezionata
  const dado = gameState.risultatoDado
  const nuovaPos = pedina.pos + dado

  if (nuovaPos > LUNGHEZZA_PERCORSO) return

  if (nuovaPos >= 5) {
    const avversaria = pedine.find(altra =>
      altra.giocatore !== pedina.giocatore &&
      !altra.uscita &&
      altra.pos === nuovaPos
    )
    if (avversaria) {
      avversaria.pos = 0
      log(`💥 ${nomeGiocatore(giocatorePulsante)} cattura la pedina ${nomePedina(avversaria)} di ${nomeGiocatore(avversaria.giocatore)}! Torna alla partenza.`, "cattura")
    }
  }

  const vecchiaPos = pedina.pos
  pedina.pos = nuovaPos

  if (nuovaPos === LUNGHEZZA_PERCORSO) {
    pedina.uscita = true
    log(`🏆 ${nomeGiocatore(giocatorePulsante)} porta la pedina ${nomePedina(pedina)} all'uscita!`, "uscita")
  } else {
    log(`${nomeGiocatore(giocatorePulsante)} muove pedina ${nomePedina(pedina)}: pos. ${vecchiaPos} → ${nuovaPos}`, "mossa")
  }

  gameState.selezionata = null
  gameState.celleEvidenziate = []
  gameState.risultatoDado = null

  disegnaBoard()

  if (pedine.filter(p => p.giocatore === gameState.giocatoreCorrente && !p.uscita).length === 0) {
    log(`🎉 ${nomeGiocatore(gameState.giocatoreCorrente).toUpperCase()} VINCE LA PARTITA!`, "vittoria")
    if (gameState.modalita === "online") pubblicaStato()
    setTimeout(() => alert("GIOCATORE " + gameState.giocatoreCorrente + " VINCE!"), 100)
    return
  }

  const èSpeciale = SPECIALI.includes(nuovaPos)
  const dadoEraSeiFaRilancio = dado === 6

  if (èSpeciale || dadoEraSeiFaRilancio) {
    if (èSpeciale && nuovaPos !== LUNGHEZZA_PERCORSO) {
      log(`⭐ Casella speciale! ${nomeGiocatore(giocatorePulsante)} rilancia.`, "speciale")
    } else if (dadoEraSeiFaRilancio) {
      log(`🎲 Dado = 6, ${nomeGiocatore(giocatorePulsante)} rilancia.`, "speciale")
    }
    gameState.faseTurno = "lancio"
    if (gameState.modalita === "online") pubblicaESalta()
    else if (gameState.giocatoreCorrente === 2 && gameState.modalita === "cpu") eseguiTurnoIA()
  } else {
    if (gameState.modalita === "online") {
      // Pubblica prima di cambiare turno così l'avversario riceve lo stato aggiornato
      // poi cambia turno localmente e pubblica di nuovo
      cambiaTurno()
      pubblicaESalta()
    } else {
      cambiaTurno()
    }
  }
}

function giocaTurno(giocatorePulsante) {
  if (giocatorePulsante !== gameState.giocatoreCorrente) return
  if (gameState.faseTurno !== "lancio") return

  // Online: solo il giocatore di turno può lanciare
  if (gameState.modalita === "online" && giocatorePulsante !== online.mioNumero) return

  const risultato = lanciaDado()
  gameState.risultatoDado = risultato
  gameState.faseTurno = "selezione"

  log(`${nomeGiocatore(giocatorePulsante)} lancia il dado → ${gameState.facceDado[risultato]} (${risultato})`, "dado")

  if (gameState.modalita === "online") pubblicaESalta()

  const mosse = mossePossibili(risultato)
  if (mosse.length === 0) {
    log(`${nomeGiocatore(giocatorePulsante)} non ha mosse disponibili. Turno saltato.`, "nessuna")
    setTimeout(() => {
      gameState.risultatoDado = null
      gameState.faseTurno = "lancio"

      if (risultato === 6) {
        if (gameState.modalita === "online") pubblicaESalta()
        else if (gameState.giocatoreCorrente === 2 && gameState.modalita === "cpu") eseguiTurnoIA()
      } else {
        cambiaTurno()
        if (gameState.modalita === "online") pubblicaESalta()
      }
    }, 800)
  }
}

function cambiaTurno() {
  gameState.giocatoreCorrente = gameState.giocatoreCorrente === 1 ? 2 : 1
  gameState.faseTurno = "lancio"
  gameState.selezionata = null
  gameState.celleEvidenziate = []

  log(`— Turno di ${nomeGiocatore(gameState.giocatoreCorrente)} —`, "turno")

  if (gameState.giocatoreCorrente === 2 && gameState.modalita === "cpu") {
    eseguiTurnoIA()
  }
}

// ============ DADO ============

function lanciaDado() {
  const r = Math.random()
  let risultato
  if (r < 0.225) risultato = 1
  else if (r < 0.45) risultato = 2
  else if (r < 0.675) risultato = 3
  else if (r < 0.9) risultato = 4
  else risultato = 6

  const dadoDiv = gameState.giocatoreCorrente === 1 ? DOM.dado1 : DOM.dado2
  dadoDiv.classList.remove("shake")
  void dadoDiv.offsetWidth
  dadoDiv.classList.add("shake")
  dadoDiv.textContent = gameState.facceDado[risultato]

  return risultato
}

// ============ INTELLIGENZA ARTIFICIALE ============

function mossaIA() {
  const mosse = mossePossibili(gameState.risultatoDado)
  if (mosse.length === 0) return null

  const difficolta = gameState.difficolta

  if (difficolta === "facile") {
    return mosse[Math.floor(Math.random() * mosse.length)]
  }

  const valutate = mosse.map(pedina => {
    const nuovaPos = pedina.pos + gameState.risultatoDado
    let punteggio = nuovaPos

    if (SPECIALI.includes(nuovaPos)) punteggio += 20

    const avversaria = pedine.find(a =>
      a.giocatore !== pedina.giocatore &&
      !a.uscita &&
      a.pos === nuovaPos
    )
    if (avversaria && nuovaPos >= 5) punteggio += 50
    if (nuovaPos === LUNGHEZZA_PERCORSO) punteggio += 100

    if (difficolta === "difficile") {
      if (nuovaPos >= 5 && nuovaPos < LUNGHEZZA_PERCORSO) {
        const dadiPossibili = [1, 2, 3, 4, 6]
        const espostaAlCattura = pedine.some(avv =>
          avv.giocatore !== pedina.giocatore &&
          !avv.uscita &&
          dadiPossibili.some(d => avv.pos + d === nuovaPos)
        )
        if (espostaAlCattura) punteggio -= 30
      }
      punteggio += pedina.pos * 0.01
    }

    return { pedina, punteggio }
  })

  valutate.sort((a, b) => b.punteggio - a.punteggio)

  if (difficolta === "medio") return valutate[0].pedina

  if (difficolta === "difficile") {
    if (valutate.length > 1 && Math.random() < 0.10) return valutate[1].pedina
    return valutate[0].pedina
  }

  return valutate[0].pedina
}

function eseguiTurnoIA() {
  if (gameState.giocatoreCorrente !== 2 || gameState.modalita !== "cpu") return

  setTimeout(() => {
    const risultato = lanciaDado()
    gameState.risultatoDado = risultato
    gameState.faseTurno = "selezione"

    log(`${nomeGiocatore(2)} lancia il dado → ${gameState.facceDado[risultato]} (${risultato})`, "dado")

    const mosse = mossePossibili(risultato)
    if (mosse.length === 0) {
      log(`${nomeGiocatore(2)} non ha mosse disponibili. Turno saltato.`, "nessuna")
      setTimeout(() => {
        gameState.risultatoDado = null
        gameState.faseTurno = "lancio"
        if (risultato === 6) eseguiTurnoIA()
        else cambiaTurno()
      }, 600)
      return
    }

    setTimeout(() => {
      const pedina = mossaIA()
      if (!pedina) return
      gameState.selezionata = pedina
      disegnaBoard()
      setTimeout(() => { confermaMossa(2) }, 700)
    }, 600)
  }, 800)
}
