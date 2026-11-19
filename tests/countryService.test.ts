import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCountryServiceForTests, getCountries } from "../src/services/countryService.js";

describe("getCountries", () => {
  afterEach(() => {
    clearCountryServiceForTests();
    vi.unstubAllGlobals();
  });

  it("переиспользует один сетевой запрос для одинаковых запросов", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = new AbortController();
    const second = new AbortController();
    const firstPromise = getCountries("spain", first.signal);
    const secondPromise = getCountries("spain", second.signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(new Response(JSON.stringify([{ name: "Spain" }]), { status: 200 }));

    await expect(firstPromise).resolves.toEqual([{ name: "Spain" }]);
    await expect(secondPromise).resolves.toEqual([{ name: "Spain" }]);
  });

  it("отмена одного потребителя не ломает другого", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = new AbortController();
    const second = new AbortController();
    const firstPromise = getCountries("france", first.signal);
    const secondPromise = getCountries("france", second.signal);

    first.abort();
    await expect(firstPromise).rejects.toMatchObject({ name: "AbortError" });

    resolveFetch(new Response(JSON.stringify([{ name: "France" }]), { status: 200 }));
    await expect(secondPromise).resolves.toEqual([{ name: "France" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
