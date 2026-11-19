import { HttpError, mapCountryResponse } from "./api/countries.js";
import type { CountryCard, CountryApiResponse } from "./types.js";
import { debounce } from "./utils/debounce.js";
import { getCountries } from "./services/countryService.js";
import { getSearchHistory, saveSearchQuery } from "./services/historyService.js";

const input = document.querySelector<HTMLInputElement>("#search-input")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clear-button")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const errorPanel = document.querySelector<HTMLDivElement>("#error-panel")!;
const errorMessage = document.querySelector<HTMLSpanElement>("#error-message")!;
const retryButton = document.querySelector<HTMLButtonElement>("#retry-button")!;
const results = document.querySelector<HTMLDivElement>("#results")!;
const emptyState = document.querySelector<HTMLParagraphElement>("#empty-state")!;
const historySection = document.querySelector<HTMLElement>("#history-section")!;
const historyList = document.querySelector<HTMLDivElement>("#history-list")!;
const dialog = document.querySelector<HTMLDialogElement>("#country-dialog")!;
const details = document.querySelector<HTMLDivElement>("#country-details")!;
const closeDialog = document.querySelector<HTMLButtonElement>("#close-dialog")!;

const DEBOUNCE_MS = 350;
let activeController: AbortController | null = null;
let latestQuery = "";

function setStatus(message: string): void {
  status.textContent = message;
}

function clearResults(): void {
  results.replaceChildren();
  emptyState.hidden = true;
}

function showError(error: unknown): void {
  if (error instanceof DOMException && error.name === "AbortError") return;
  if (error instanceof DOMException && error.name === "TimeoutError") {
    errorMessage.textContent = "Сервер долго не отвечает. Проверьте соединение и попробуйте ещё раз.";
  } else if (error instanceof HttpError) {
    errorMessage.textContent = `Ошибка сервера: ${error.status}. Попробуйте повторить запрос.`;
  } else {
    errorMessage.textContent =
      error instanceof Error ? error.message : "Произошла неизвестная ошибка.";
  }

  errorPanel.hidden = false;
  setStatus("");
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showCountryDetails(country: CountryCard): void {
  details.replaceChildren();

  const heading = createElement("h2", "details-title", country.name);
  const description = createElement("p", "details-description", country.description);
  const list = createElement("dl", "details-list");

  const rows: Array<[string, string]> = [
    ["Столица", country.capital],
    ["Регион", country.region],
    ["Население", country.population.toLocaleString("ru-RU")],
    ["Площадь", country.area === null ? "Нет данных" : `${country.area.toLocaleString("ru-RU")} км²`],
    ["Границы", country.borders.length ? country.borders.join(", ") : "Нет сухопутных границ / данных"],
    ["Языки", country.languages.join(", ") || "Нет данных"],
    ["Валюта", country.currency.join(", ") || "Нет данных"]
  ];

  for (const [term, value] of rows) {
    list.append(createElement("dt", "", term), createElement("dd", "", value));
  }

  details.append(heading, description, list);
  dialog.showModal();
}

function renderCountries(rawCountries: CountryApiResponse[]): void {
  clearResults();

  const countries = rawCountries.map(mapCountryResponse);
  if (countries.length === 0) {
    emptyState.hidden = false;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const country of countries) {
    const card = createElement("button", "country-card");
    card.type = "button";
    card.setAttribute("aria-label", `Подробнее: ${country.name}`);

    const flag = createElement("img", "country-flag");
    if (country.flag) {
      flag.src = country.flag;
      flag.alt = `Флаг: ${country.name}`;
      flag.loading = "lazy";
    } else {
      flag.hidden = true;
    }

    const title = createElement("h2", "country-name", country.name);
    const capital = createElement("p", "country-meta", `Столица: ${country.capital}`);
    const region = createElement("p", "country-meta", `Регион: ${country.region}`);
    const population = createElement(
      "p",
      "country-meta",
      `Население: ${country.population.toLocaleString("ru-RU")}`
    );

    card.append(flag, title, capital, region, population);
    card.addEventListener("click", () => showCountryDetails(country));
    fragment.append(card);
  }

  results.append(fragment);
}

function renderHistory(): void {
  const history = getSearchHistory();
  historyList.replaceChildren();
  historySection.hidden = history.length === 0;

  for (const query of history) {
    const button = createElement("button", "history-chip", query);
    button.type = "button";
    button.addEventListener("click", () => {
      input.value = query;
      startSearch(query);
    });
    historyList.append(button);
  }
}

async function performSearch(query: string, controller: AbortController): Promise<void> {
  if (controller.signal.aborted || query !== latestQuery) return;

  errorPanel.hidden = true;
  setStatus("Ищем страны…");

  try {
    const countries = await getCountries(query, controller.signal);

    // Дополнительная проверка UI-состояния: результат отображается только для
    // актуального ввода. Отмена при этом всё равно выполняется настоящим abort().
    if (controller.signal.aborted || query !== latestQuery) return;

    renderCountries(countries);
    setStatus(countries.length ? `Найдено стран: ${countries.length}` : "");
    saveSearchQuery(query);
    renderHistory();
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    if (controller.signal.aborted || query !== latestQuery) return;
    showError(error);
  }
}

const debouncedSearch = debounce((query: string, controller: AbortController) => {
  void performSearch(query, controller);
}, DEBOUNCE_MS);

function startSearch(rawQuery: string): void {
  const query = rawQuery.trim();
  latestQuery = query;

  // Отменяем предыдущего потребителя немедленно при каждом изменении ввода,
  // не дожидаясь окончания debounce.
  activeController?.abort();
  activeController = null;
  debouncedSearch.cancel();

  errorPanel.hidden = true;
  clearResults();

  if (!query) {
    setStatus("");
    return;
  }

  const controller = new AbortController();
  activeController = controller;
  setStatus("Ожидание поиска…");
  debouncedSearch(query, controller);
}

input.addEventListener("input", () => startSearch(input.value));

clearButton.addEventListener("click", () => {
  input.value = "";
  startSearch("");
  input.focus();
});

retryButton.addEventListener("click", () => {
  if (latestQuery) startSearch(latestQuery);
});

closeDialog.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event: MouseEvent) => {
  if (event.target === dialog) dialog.close();
});

renderHistory();
