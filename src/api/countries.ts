import type { CountryApiResponse } from "../types.js";

const API_BASE_URL = "https://countries.dev/name";

export class HttpError extends Error {
  public readonly status: number;

  constructor(status: number, message = `HTTP error: ${status}`) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function mapCountryResponse(raw: CountryApiResponse): import("../types.js").CountryCard {
  const name =
    typeof raw.name === "string"
      ? raw.name
      : raw.name?.common ?? raw.name?.official ?? "Неизвестная страна";

  const capital = Array.isArray(raw.capital)
    ? raw.capital.join(", ")
    : raw.capital ?? "Нет данных";

  const languages = Array.isArray(raw.languages)
    ? raw.languages.map((item) =>
        typeof item === "string" ? item : (item.name ?? "Неизвестный язык")
      )
    : Object.values(raw.languages ?? {});

  const currency = Array.isArray(raw.currencies)
    ? raw.currencies.map((item) =>
        typeof item === "string" ? item : (item.name ?? item.code ?? "Неизвестная валюта")
      )
    : Object.values(raw.currencies ?? {}).map((item) => item.name ?? "Неизвестная валюта");

  return {
    name,
    flag: raw.flags?.svg ?? raw.flags?.png ?? raw.flag ?? "",
    capital,
    region: raw.subregion ? `${raw.region ?? "Регион не указан"} · ${raw.subregion}` : raw.region ?? "Нет данных",
    population: raw.population ?? 0,
    description: raw.flags?.alt ?? `${name} — страна${raw.region ? ` региона ${raw.region}` : ""}.`,
    area: typeof raw.area === "number" ? raw.area : null,
    borders: raw.borders ?? [],
    languages,
    currency
  };
}

/**
 * 404 у countries.dev означает отсутствие совпадений, поэтому возвращаем [].
 * Любой другой HTTP-статус, отличный от 2xx, считается настоящей ошибкой.
 */
export async function searchCountries(
  query: string,
  signal: AbortSignal
): Promise<CountryApiResponse[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const response = await fetch(
    `${API_BASE_URL}/${encodeURIComponent(normalizedQuery)}`,
    { method: "GET", signal, headers: { Accept: "application/json" } }
  );

  if (response.status === 404) return [];
  if (!response.ok) {
    throw new HttpError(response.status, `Не удалось загрузить страны (HTTP ${response.status})`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Сервер вернул данные в неожиданном формате");
  }

  return data as CountryApiResponse[];
}
