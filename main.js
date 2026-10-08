import OBR from "https://esm.sh/@owlbear-rodeo/sdk";

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

  // Listen for rolls broadcast by ANY player in the room
  OBR.broadcast.onMessage(BROADCAST_CHANNEL, (event) => {
    const { rollerName, formulaText, breakdownText, total } = event.data;

    // Show a notification banner to other players
    OBR.notification.show(`${rollerName} rolled ${formulaText}: ${breakdownText}`);

    // Update the popover result display if it is currently open
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
    } catch {
      macros = [];
    }
  }
}

// Persist macros to localStorage
function saveMacros() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
}

// Roll logic
async function rollMacro(macro) {
  const rolls = [];
  for (let i = 0; i < macro.count; i++) {
    rolls.push(Math.floor(Math.random() * macro.die) + 1);
  }

  const diceSum = rolls.reduce((sum, val) => sum + val, 0);
  const total = diceSum + macro.modifier;
  
  // Build formula text (e.g. "Sword Attack (1d20+5)")
  const modSign = macro.modifier >= 0 ? `+${macro.modifier}` : `${macro.modifier}`;
  const modFormula = macro.modifier !== 0 ? modSign : "";
  const formulaText = `${macro.name} (${macro.count}d${macro.die}${modFormula})`;

  // Build breakdown string (e.g. "3 + 2 + 1 = 6" or "14 - 2 = 12")
  let breakdownParts = [...rolls];
  let breakdownText = breakdownParts.join(" + ");

  if (macro.modifier > 0) {
    breakdownText += ` + ${macro.modifier}`;
  } else if (macro.modifier < 0) {
    breakdownText += ` - ${Math.abs(macro.modifier)}`;
  }
  breakdownText += ` = ${total}`;

  // Get current player's Owlbear display name
  const playerName = await OBR.player.getName();

  // Update local UI & notification
  resultBox.classList.remove("empty");
  resultFormula.textContent = formulaText;
  resultBreakdown.textContent = breakdownText;
  resultTotal.textContent = total;
  OBR.notification.show(`${formulaText}: ${breakdownText}`);

  // Broadcast roll to all other connected players in the room
  OBR.broadcast.sendMessage(BROADCAST_CHANNEL, {
    rollerName: playerName || "A player",
    formulaText,
    breakdownText,
    total
  });
}

// Render dynamic elements
function render() {
  macroCount.textContent = `${macros.length} / ${MAX_MACROS}`;
  addMacroBtn.disabled = macros.length >= MAX_MACROS;

  macroList.innerHTML = "";
  if (macros.length === 0) {
    macroList.innerHTML = `<p style="font-size: 0.8rem; color: #9ca3af;">No macros created yet.</p>`;
    return;
  }

  macros.forEach((macro, index) => {
    const item = document.createElement("div");
    item.className = "macro-item";

    const modSign = macro.modifier > 0 ? `+${macro.modifier}` : (macro.modifier < 0 ? `${macro.modifier}` : "");
    const tag = `${macro.count}d${macro.die}${modSign}`;

    const runBtn = document.createElement("button");
    runBtn.className = "macro-run-btn";
    runBtn.innerHTML = `<span>${macro.name}</span><span class="macro-tag">${tag}</span>`;
    runBtn.onclick = () => {
      runBtn.classList.remove("rolling");
      // Trigger reflow to restart animation if clicked repeatedly
      void runBtn.offsetWidth;
      runBtn.classList.add("rolling");
      rollMacro(macro);
    };
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.title = "Delete macro";
    deleteBtn.onclick = () => {
      macros.splice(index, 1);
      saveMacros();
      render();
    };

    item.appendChild(runBtn);
    item.appendChild(deleteBtn);
    macroList.appendChild(item);
  });
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
    return;
  }
  if (isNaN(count) || count < 1) {
    alert("Count must be at least 1.");
    return;
  }

  macros.push({ name, count, die, modifier });
  saveMacros();
  render();

  // Reset inputs
  macroNameInput.value = "";
  diceCountInput.value = "1";
  modifierInput.value = "0";
});
