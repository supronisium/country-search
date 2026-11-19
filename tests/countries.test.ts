import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, mapCountryResponse, searchCountries } from "../src/api/countries.js";

describe("mapCountryResponse", () => {
  it("преобразует REST-подобный ответ API", () => {
    const country = mapCountryResponse({
      name: { common: "Spain", official: "Kingdom of Spain" },
      flags: { svg: "https://example.com/es.svg" },
      capital: ["Madrid"],
      region: "Europe",
      subregion: "Southern Europe",
      population: 47350000,
      area: 505990,
      borders: ["AND", "FRA", "GIB", "PRT"],
      languages: { spa: "Spanish" },
      currencies: { EUR: { name: "Euro", symbol: "€" } }
    });

    expect(country.name).toBe("Spain");
    expect(country.capital).toBe("Madrid");
    expect(country.languages).toEqual(["Spanish"]);
    expect(country.currency).toEqual(["Euro"]);
    expect(country.borders).toContain("PRT");
    expect(country.area).toBe(505990);
  });

  it("поддерживает строковые поля и массивы языков/валют", () => {
    const country = mapCountryResponse({
      name: "Example",
      flag: "🇪🇽",
      capital: "Sample City",
      languages: [{ name: "Examplean" }],
      currencies: [{ name: "Example dollar" }]
    });

    expect(country.name).toBe("Example");
    expect(country.capital).toBe("Sample City");
    expect(country.languages).toEqual(["Examplean"]);
    expect(country.currency).toEqual(["Example dollar"]);
  });
});

describe("searchCountries", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("возвращает пустой массив при 404", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 404 }));
    await expect(searchCountries("no-such-country", new AbortController().signal)).resolves.toEqual([]);
  });

  it("бросает HttpError при другом HTTP-статусе", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 500 }));
    await expect(searchCountries("spain", new AbortController().signal)).rejects.toBeInstanceOf(HttpError);
  });

  it("передаёт AbortSignal в fetch и возвращает JSON", async () => {
    const payload = [{ name: "Spain" }];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    const controller = new AbortController();

    await expect(searchCountries("spain", controller.signal)).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(
      "https://countries.dev/name/spain",
      expect.objectContaining({ signal: controller.signal })
    );
  });
});
