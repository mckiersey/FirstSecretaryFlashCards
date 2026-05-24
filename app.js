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
  answerEditor: document.querySelector("#answerEditor"),
  answerInput: document.querySelector("#answerInput"),
  saveAnswer: document.querySelector("#saveAnswer"),
  prevCard: document.querySelector("#prevCard"),
  nextCard: document.querySelector("#nextCard"),
  rightCard: document.querySelector("#rightCard"),
  wrongCard: document.querySelector("#wrongCard"),
};

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
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
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    right: row.right_count || 0,
    wrong: row.wrong_count || 0,
    lastReviewed: row.last_reviewed,
    createdAt: row.created_at,
  };
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

  state.cards = data.map(rowToCard);
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
  els.answerInput.value = card.answer;
  save();
}

function parseRows(rows) {
  return rows
    .map((row) => {
      const keys = Object.keys(row);
      const questionKey = keys.find((key) => key.trim().toLowerCase() === "question") || keys[0];
      const answerKey = keys.find((key) => key.trim().toLowerCase() === "answer") || keys[1];
      const question = String(row[questionKey] ?? "").trim();
      const answer = String(row[answerKey] ?? "").trim();

      if (!question || !answer) return null;

      return {
        id: makeId(),
        question,
        answer,
        right: 0,
        wrong: 0,
        lastReviewed: null,
        createdAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

async function importFile(file) {
  const workbook = XLSX.read(await file.arrayBuffer());
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  const cards = parseRows(rows);

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
render();
