import OBR from "https://esm.sh/@owlbear-rodeo/sdk@2.0.0";

const STORAGE_KEY = "obr_dice_macros";
const MAX_MACROS = 10;
const BROADCAST_CHANNEL = "com.twobarkdesign.flapjack-macros.roll";

// Elements
const macroNameInput = document.getElementById("macro-name");
const diceCountInput = document.getElementById("dice-count");
const diceTypeSelect = document.getElementById("dice-type");
const modifierInput = document.getElementById("modifier");
const addMacroBtn = document.getElementById("add-macro-btn");
const macroList = document.getElementById("macro-list");
const macroCount = document.getElementById("macro-count");
const resultBox = document.getElementById("result-box");
const resultFormula = document.getElementById("result-formula");
const resultBreakdown = document.getElementById("result-breakdown");
const resultTotal = document.getElementById("result-total");

// State
let macros = [];

// Initialize Owlbear Rodeo SDK
OBR.onReady(async () => {
  loadMacros();
  render();

  // Listen for broadcast messages from other connected players
  OBR.broadcast.onMessage(BROADCAST_CHANNEL, (event) => {
    if (!event || !event.data) return;

    const {
      rollerId,
      rollerName = "A player",
      formulaText = "",
      breakdownText = "",
      total = "--",
      variant = "WARNING"
    } = event.data;

    // Ignore self-broadcasts if received locally
    if (rollerId && rollerId === OBR.player.id) return;

    // Display notification banner on the receiving player's screen
    OBR.notification.show(`${rollerName} rolled ${formulaText}: ${breakdownText}`, variant);

    // Update the receiving player's popover UI
    resultBox.classList.remove("empty");
    resultFormula.textContent = `${rollerName}: ${formulaText}`;
    resultBreakdown.textContent = breakdownText;
    resultTotal.textContent = total;
  });
});

// Load macros from localStorage
function loadMacros() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      macros = JSON.parse(data);
      if (!Array.isArray(macros)) macros = [];
    } catch {
      macros = [];
    }
  }
}

// Persist macros to localStorage
function saveMacros() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
}

// Cryptographically secure die roller
function rollDie(sides) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % sides) + 1;
}

// Roll logic
async function rollMacro(macro) {
  const rolls = [];
  for (let i = 0; i < macro.count; i++) {
    rolls.push(rollDie(macro.die));
  }

  const diceSum = rolls.reduce((sum, val) => sum + val, 0);
  const total = diceSum + macro.modifier;
  
  // Check if roll achieved maximum possible dice score
  const maxPossibleDiceSum = macro.count * macro.die;
  const isMaxRoll = diceSum === maxPossibleDiceSum;

  // Build formula text (e.g. "Sword Attack (1d20+5)")
  const modSign = macro.modifier >= 0 ? `+${macro.modifier}` : `${macro.modifier}`;
  const modFormula = macro.modifier !== 0 ? modSign : "";
  const formulaText = `${macro.name} (${macro.count}d${macro.die}${modFormula})`;

  // Build breakdown string
  let breakdownText = rolls.join(" + ");
  if (macro.modifier > 0) {
    breakdownText += ` + ${macro.modifier}`;
  } else if (macro.modifier < 0) {
    breakdownText += ` - ${Math.abs(macro.modifier)}`;
  }
  breakdownText += ` = ${total}`;

  if (isMaxRoll) {
    breakdownText += " 🥞";
  }

  // Get current player's Owlbear display name
  let playerName = "A player";
  try {
    const rawPlayerName = await OBR.player.getName();
    if (rawPlayerName && rawPlayerName.trim()) {
      playerName = rawPlayerName.trim();
    }
  } catch (err) {
    console.warn("Could not retrieve player name:", err);
  }

  // 1. Update local UI & local notification banner
  resultBox.classList.remove("empty");
  resultFormula.textContent = formulaText;
  resultBreakdown.textContent = breakdownText;
  resultTotal.textContent = total;
  OBR.notification.show(`${formulaText}: ${breakdownText}`, "WARNING");

  // 2. Broadcast roll to all players listening on the channel
  await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, {
    rollerId: OBR.player.id,
    rollerName: playerName,
    formulaText,
    breakdownText,
    total,
    variant: "WARNING"
  });
}

// Render dynamic elements
function render() {
  macroCount.textContent = `${macros.length} / ${MAX_MACROS}`;
  addMacroBtn.disabled = macros.length >= MAX_MACROS;

  macroList.innerHTML = "";
  if (macros.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.style.fontSize = "0.8rem";
    emptyMsg.style.color = "#9ca3af";
    emptyMsg.textContent = "No macros created yet.";
    macroList.appendChild(emptyMsg);
    return;
  }

  const fragment = document.createDocumentFragment();

  macros.forEach((macro, index) => {
    const item = document.createElement("div");
    item.className = "macro-item";
    item.setAttribute("role", "listitem");

    const modSign = macro.modifier > 0 ? `+${macro.modifier}` : (macro.modifier < 0 ? `${macro.modifier}` : "");
    const tag = `${macro.count}d${macro.die}${modSign}`;

    const runBtn = document.createElement("button");
    runBtn.className = "macro-run-btn";
    runBtn.type = "button";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = macro.name;

    const tagSpan = document.createElement("span");
    tagSpan.className = "macro-tag";
    tagSpan.textContent = tag;

    runBtn.appendChild(nameSpan);
    runBtn.appendChild(tagSpan);

    runBtn.onclick = () => {
      runBtn.classList.remove("rolling");
      void runBtn.offsetWidth;
      runBtn.classList.add("rolling");
      rollMacro(macro);
    };
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.type = "button";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", `Delete ${macro.name} macro`);
    deleteBtn.onclick = () => {
      const confirmed = window.confirm(`Delete the "${macro.name}" macro?`);
      if (!confirmed) return;

      macros.splice(index, 1);
      saveMacros();
      render();
    };

    item.appendChild(runBtn);
    item.appendChild(deleteBtn);
    fragment.appendChild(item);
  });

  macroList.appendChild(fragment);
}

// Form Submission
addMacroBtn.addEventListener("click", () => {
  if (macros.length >= MAX_MACROS) return;

  const name = macroNameInput.value.trim();
  const count = parseInt(diceCountInput.value, 10);
  const die = parseInt(diceTypeSelect.value, 10);
  const modifier = parseInt(modifierInput.value, 10) || 0;

  if (!name) {
    alert("Please provide a name for the macro.");
    macroNameInput.focus();
    return;
  }
  if (isNaN(count) || count < 1 || count > 50) {
    alert("Count must be between 1 and 50.");
    diceCountInput.focus();
    return;
  }

  macros.push({ name, count, die, modifier });
  saveMacros();
  render();

  macroNameInput.value = "";
  diceCountInput.value = "1";
  modifierInput.value = "0";
  macroNameInput.focus();
});
