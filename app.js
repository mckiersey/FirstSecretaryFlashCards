const storageKey = "flash-card-app-v1";
const cloudConfigKey = "flash-card-supabase-config-v1";
const tableName = "flashcards";

const state = {
  cards: [],
  currentIndex: 0,
  showAnswer: false,
  filter: "all",
  cloud: null,
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  tabButtons: document.querySelectorAll(".tab"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  addCardForm: document.querySelector("#addCardForm"),
  newQuestion: document.querySelector("#newQuestion"),
  newAnswer: document.querySelector("#newAnswer"),
  newColumnC: document.querySelector("#newColumnC"),
  newColumnD: document.querySelector("#newColumnD"),
  addStatus: document.querySelector("#addStatus"),
  exportExcel: document.querySelector("#exportExcel"),
  clearDeck: document.querySelector("#clearDeck"),
  supabaseUrl: document.querySelector("#supabaseUrl"),
  supabaseKey: document.querySelector("#supabaseKey"),
  saveCloud: document.querySelector("#saveCloud"),
  loadCloud: document.querySelector("#loadCloud"),
  cloudStatus: document.querySelector("#cloudStatus"),
  totalCards: document.querySelector("#totalCards"),
  rightCount: document.querySelector("#rightCount"),
  wrongCount: document.querySelector("#wrongCount"),
  accuracy: document.querySelector("#accuracy"),
  filterButtons: document.querySelectorAll(".filter"),
  emptyState: document.querySelector("#emptyState"),
  cardPanel: document.querySelector("#cardPanel"),
  positionLabel: document.querySelector("#positionLabel"),
  cardStats: document.querySelector("#cardStats"),
  flashCard: document.querySelector("#flashCard"),
  faceLabel: document.querySelector("#faceLabel"),
  cardText: document.querySelector("#cardText"),
  extraInfo: document.querySelector("#extraInfo"),
  extraOneLabel: document.querySelector("#extraOneLabel"),
  extraOneValue: document.querySelector("#extraOneValue"),
  extraTwoLabel: document.querySelector("#extraTwoLabel"),
  extraTwoValue: document.querySelector("#extraTwoValue"),
  answerEditor: document.querySelector("#answerEditor"),
  answerInput: document.querySelector("#answerInput"),
  saveAnswer: document.querySelector("#saveAnswer"),
  prevCard: document.querySelector("#prevCard"),
  nextCard: document.querySelector("#nextCard"),
  rightCard: document.querySelector("#rightCard"),
  wrongCard: document.querySelector("#wrongCard"),
};

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (Number(char) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(char) / 4)))).toString(16),
  );
}

function load() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    state.cards = Array.isArray(parsed.cards) ? parsed.cards : [];
    state.currentIndex = Number.isInteger(parsed.currentIndex) ? parsed.currentIndex : 0;
  } catch {
    state.cards = [];
  }
}

function save() {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      cards: state.cards,
      currentIndex: state.currentIndex,
    }),
  );
}

function isMacPlatform() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  return /mac/i.test(platform);
}

function updatePlatformFeatures() {
  els.exportExcel.classList.toggle("hidden", !isMacPlatform());
}

function setActiveTab(tabId) {
  els.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });

  els.tabPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== tabId);
  });
}

function shuffleCards(cards) {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function setCloudStatus(message) {
  els.cloudStatus.textContent = message;
}

function loadCloudConfig() {
  const saved = localStorage.getItem(cloudConfigKey);
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function saveCloudConfig(config) {
  localStorage.setItem(cloudConfigKey, JSON.stringify(config));
}

function connectCloud(config) {
  if (!config?.url || !config?.key || !window.supabase?.createClient) {
    state.cloud = null;
    setCloudStatus("Not connected");
    return false;
  }

  state.cloud = window.supabase.createClient(config.url, config.key);
  els.supabaseUrl.value = config.url;
  els.supabaseKey.value = config.key;
  setCloudStatus("Connected");
  return true;
}

function rowToCard(row) {
  const extraColumns = Array.isArray(row.extra_data?.columns)
    ? row.extra_data.columns
    : Object.entries(row.extra_data || {}).map(([header, value]) => ({ header, value }));

  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    right: row.right_count || 0,
    wrong: row.wrong_count || 0,
    lastReviewed: row.last_reviewed,
    createdAt: row.created_at,
    extraColumns,
  };
}

function cardExtraColumns(card) {
  if (Array.isArray(card.extraColumns)) return card.extraColumns;

  return Object.entries(card.extraData || {}).map(([header, value]) => ({ header, value }));
}

function cardToRow(card) {
  return {
    id: card.id,
    question: card.question,
    answer: card.answer,
    right_count: card.right,
    wrong_count: card.wrong,
    last_reviewed: card.lastReviewed,
    created_at: card.createdAt,
    extra_data: { columns: cardExtraColumns(card) },
  };
}

async function loadFromCloud() {
  if (!state.cloud) {
    setCloudStatus("Save a Supabase connection first");
    return;
  }

  setCloudStatus("Loading cloud cards...");
  const { data, error } = await state.cloud.from(tableName).select("*").order("created_at", { ascending: true });

  if (error) {
    setCloudStatus(`Cloud load failed: ${error.message}`);
    return;
  }

  state.cards = shuffleCards(data.map(rowToCard));
  state.currentIndex = 0;
  state.showAnswer = false;
  state.filter = "all";
  setCloudStatus(`Loaded ${state.cards.length} cloud cards`);
  render();
}

async function replaceCloudDeck() {
  if (!state.cloud) return;

  setCloudStatus("Saving cloud deck...");
  const { error: deleteError } = await state.cloud.from(tableName).delete().not("id", "is", null);

  if (deleteError) {
    setCloudStatus(`Cloud save failed: ${deleteError.message}`);
    return;
  }

  if (!state.cards.length) {
    setCloudStatus("Cloud deck cleared");
    return;
  }

  const { error: insertError } = await state.cloud.from(tableName).insert(state.cards.map(cardToRow));

  if (insertError) {
    setCloudStatus(`Cloud save failed: ${insertError.message}`);
    return;
  }

  setCloudStatus(`Saved ${state.cards.length} cards to cloud`);
}

async function saveCardToCloud(card) {
  if (!state.cloud || !card) return;

  const { error } = await state.cloud.from(tableName).upsert(cardToRow(card));
  setCloudStatus(error ? `Cloud update failed: ${error.message}` : "Cloud saved");
}

async function addCard(card) {
  state.cards.push(card);
  state.currentIndex = state.cards.length - 1;
  state.showAnswer = false;
  state.filter = "all";
  save();
  await saveCardToCloud(card);
  render();
}

function answerInfoColumns(card) {
  const columns = cardExtraColumns(card);
  return [
    columns[0] || { header: "Sub-Capability", value: "" },
    columns[1] || { header: "Capability", value: "" },
  ];
}

function filteredCards() {
  if (state.filter === "missed") {
    return state.cards.filter((card) => card.wrong > 0);
  }

  if (state.filter === "unseen") {
    return state.cards.filter((card) => card.right + card.wrong === 0);
  }

  return state.cards;
}

function currentCard() {
  return filteredCards()[state.currentIndex];
}

function clampIndex() {
  const cards = filteredCards();
  if (state.currentIndex >= cards.length) state.currentIndex = Math.max(cards.length - 1, 0);
  if (state.currentIndex < 0) state.currentIndex = 0;
}

function updateStats() {
  const totalRight = state.cards.reduce((sum, card) => sum + card.right, 0);
  const totalWrong = state.cards.reduce((sum, card) => sum + card.wrong, 0);
  const attempts = totalRight + totalWrong;

  els.totalCards.textContent = state.cards.length;
  els.rightCount.textContent = totalRight;
  els.wrongCount.textContent = totalWrong;
  els.accuracy.textContent = attempts ? `${Math.round((totalRight / attempts) * 100)}%` : "0%";
}

function render() {
  clampIndex();
  updateStats();

  els.filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });

  const cards = filteredCards();
  const card = currentCard();
  const hasCard = Boolean(card);

  els.emptyState.classList.toggle("hidden", hasCard);
  els.cardPanel.classList.toggle("hidden", !hasCard);

  if (!hasCard) {
    els.emptyState.querySelector("h2").textContent = state.cards.length ? "No cards match this filter" : "No cards yet";
    els.emptyState.querySelector("p").textContent = state.cards.length
      ? "Pick another filter or import more cards."
      : "Upload an Excel or CSV file to start.";
    save();
    return;
  }

  els.positionLabel.textContent = `Card ${state.currentIndex + 1} of ${cards.length}`;
  els.cardStats.textContent = `${card.right} right / ${card.wrong} wrong`;
  els.faceLabel.textContent = state.showAnswer ? "Answer" : "Question";
  els.cardText.textContent = state.showAnswer ? card.answer : card.question;
  els.answerEditor.classList.toggle("hidden", !state.showAnswer);
  els.wrongCard.classList.toggle("hidden", !state.showAnswer);
  els.rightCard.classList.toggle("hidden", !state.showAnswer);
  els.answerInput.value = card.answer;

  const [firstExtra, secondExtra] = answerInfoColumns(card);
  els.extraOneLabel.textContent = firstExtra.header || "Sub-Capability";
  els.extraOneValue.textContent = firstExtra.value || "";
  els.extraTwoLabel.textContent = secondExtra.header || "Capability";
  els.extraTwoValue.textContent = secondExtra.value || "";
  save();
}

function normalizeHeader(value, index) {
  const header = String(value ?? "").trim();
  return header || `Column ${index + 1}`;
}

function parseTable(table) {
  const firstContentRow = table.findIndex((row) => row.some((cell) => String(cell ?? "").trim()));
  if (firstContentRow === -1) return [];

  const headers = table[firstContentRow].map(normalizeHeader);
  const questionIndex = headers.findIndex((header) => header.trim().toLowerCase() === "question");
  const answerIndex = headers.findIndex((header) => header.trim().toLowerCase() === "answer");
  const qIndex = questionIndex >= 0 ? questionIndex : 0;
  const aIndex = answerIndex >= 0 ? answerIndex : 1;

  return table
    .slice(firstContentRow + 1)
    .map((cells) => {
      if (!cells.some((cell) => String(cell ?? "").trim())) return null;

      const question = String(cells[qIndex] ?? "").trim();
      const answer = String(cells[aIndex] ?? "").trim();
      if (!question || !answer) return null;

      const extraColumns = headers
        .map((header, index) => ({
          header,
          value: String(cells[index] ?? "").trim(),
        }))
        .filter((_, index) => index !== qIndex && index !== aIndex);

      cells.forEach((cell, index) => {
        if (index === qIndex || index === aIndex) return;
        if (index < headers.length) return;

        const value = String(cell ?? "").trim();
        extraColumns.push({
          header: headers[index] || `Column ${index + 1}`,
          value,
        });
      });

      return {
        id: makeId(),
        question,
        answer,
        right: 0,
        wrong: 0,
        lastReviewed: null,
        createdAt: new Date().toISOString(),
        extraColumns,
      };
    })
    .filter(Boolean);
}

async function importFile(file) {
  const workbook = XLSX.read(await file.arrayBuffer());
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const table = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", blankrows: true });
  const cards = shuffleCards(parseTable(table));

  if (!cards.length) {
    alert("No question/answer rows found. Use columns named Question and Answer, or put them in the first two columns.");
    return;
  }

  state.cards = cards;
  state.currentIndex = 0;
  state.showAnswer = false;
  state.filter = "all";
  render();
  await replaceCloudDeck();
}

function exportToExcel() {
  if (!state.cards.length) {
    alert("No cards to export yet.");
    return;
  }

  const extraHeaders = [...new Set(state.cards.flatMap((card) => cardExtraColumns(card).map(({ header }) => header)))];
  const rows = state.cards.map((card) => ({
    Question: card.question,
    Answer: card.answer,
    ...Object.fromEntries(
      extraHeaders.map((header) => [
        header,
        cardExtraColumns(card).find((column) => column.header === header)?.value || "",
      ]),
    ),
    Right: card.right,
    Wrong: card.wrong,
    LastReviewed: card.lastReviewed || "",
    CreatedAt: card.createdAt || "",
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Flashcards");
  XLSX.writeFile(workbook, "flashcards-export.xlsx");
}

function formCard() {
  const question = els.newQuestion.value.trim();
  const answer = els.newAnswer.value.trim();

  if (!question || !answer) return null;

  return {
    id: makeId(),
    question,
    answer,
    right: 0,
    wrong: 0,
    lastReviewed: null,
    createdAt: new Date().toISOString(),
    extraColumns: [
      { header: "Sub-Capability", value: els.newColumnC.value.trim() },
      { header: "Capability", value: els.newColumnD.value.trim() },
    ],
  };
}

function move(delta) {
  state.currentIndex += delta;
  state.showAnswer = false;
  render();
}

function recordResult(kind) {
  const card = currentCard();
  if (!card) return;

  card[kind] += 1;
  card.lastReviewed = new Date().toISOString();
  saveCardToCloud(card);
  move(1);
}

els.fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importFile(file);
});

els.exportExcel.addEventListener("click", exportToExcel);

els.tabButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveTab(button.dataset.tab));
});

els.addCardForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const card = formCard();
  if (!card) {
    els.addStatus.textContent = "Question and answer are required.";
    return;
  }

  await addCard(card);
  els.addCardForm.reset();
  els.addStatus.textContent = "Card added.";
  setActiveTab("studyTab");
});

els.clearDeck.addEventListener("click", () => {
  if (!state.cards.length || confirm("Clear all cards and progress from this browser and connected cloud database?")) {
    state.cards = [];
    state.currentIndex = 0;
    state.showAnswer = false;
    render();
    replaceCloudDeck();
  }
});

els.saveCloud.addEventListener("click", async () => {
  const config = {
    url: els.supabaseUrl.value.trim(),
    key: els.supabaseKey.value.trim(),
  };

  saveCloudConfig(config);
  if (connectCloud(config)) await loadFromCloud();
});

els.loadCloud.addEventListener("click", loadFromCloud);

els.filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    state.currentIndex = 0;
    state.showAnswer = false;
    render();
  });
});

els.flashCard.addEventListener("click", () => {
  state.showAnswer = !state.showAnswer;
  render();
});

els.saveAnswer.addEventListener("click", () => {
  const card = currentCard();
  if (!card) return;

  card.answer = els.answerInput.value.trim();
  saveCardToCloud(card);
  render();
});

els.prevCard.addEventListener("click", () => move(-1));
els.nextCard.addEventListener("click", () => move(1));
els.rightCard.addEventListener("click", () => recordResult("right"));
els.wrongCard.addEventListener("click", () => recordResult("wrong"));

load();
connectCloud(loadCloudConfig());
updatePlatformFeatures();
render();
