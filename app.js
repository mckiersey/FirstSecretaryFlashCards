const storageKey = "flash-card-app-v1";

const state = {
  cards: [],
  currentIndex: 0,
  showAnswer: false,
  filter: "all",
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  clearDeck: document.querySelector("#clearDeck"),
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
  move(1);
}

els.fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importFile(file);
});

els.clearDeck.addEventListener("click", () => {
  if (!state.cards.length || confirm("Clear all cards and progress from this browser?")) {
    state.cards = [];
    state.currentIndex = 0;
    state.showAnswer = false;
    render();
  }
});

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
  render();
});

els.prevCard.addEventListener("click", () => move(-1));
els.nextCard.addEventListener("click", () => move(1));
els.rightCard.addEventListener("click", () => recordResult("right"));
els.wrongCard.addEventListener("click", () => recordResult("wrong"));

load();
render();
