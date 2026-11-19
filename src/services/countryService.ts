import { searchCountries } from "../api/countries.js";
import type { CountryApiResponse } from "../types.js";

const REQUEST_TIMEOUT_MS = 10_000;

interface InFlightRequest {
  controller: AbortController;
  promise: Promise<CountryApiResponse[]>;
  subscribers: number;
}

const cache = new Map<string, CountryApiResponse[]>();
const inFlight = new Map<string, InFlightRequest>();

function abortError(): DOMException {
  return new DOMException("Запрос отменён", "AbortError");
}

/**
 * Один сетевой запрос может обслуживать несколько потребителей.
 * У каждого потребителя собственный AbortSignal. Отмена одного потребителя
 * уменьшает счётчик подписчиков, но не отменяет запрос для остальных.
 * Когда подписчиков не осталось, сетевой запрос действительно отменяется.
 */
export function getCountries(
  query: string,
  callerSignal: AbortSignal
): Promise<CountryApiResponse[]> {
  const key = query.trim().toLocaleLowerCase();
  if (!key) return Promise.resolve([]);
  if (callerSignal.aborted) return Promise.reject(callerSignal.reason ?? abortError());

  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);

  let request = inFlight.get(key);

  if (!request) {
    const controller = new AbortController();
    const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const combinedSignal = AbortSignal.any([controller.signal, timeoutSignal]);

    const created: InFlightRequest = {
      controller,
      subscribers: 0,
      promise: Promise.resolve([])
    };

    created.promise = searchCountries(key, combinedSignal)
      .then((result) => {
        cache.set(key, result);
        return result;
      })
      .finally(() => {
        if (inFlight.get(key) === created) inFlight.delete(key);
      });

    request = created;
    inFlight.set(key, request);
  }

  request.subscribers += 1;
  const currentRequest = request;

  return new Promise((resolve, reject) => {
    let finished = false;

    const release = () => {
      if (finished) return;
      finished = true;
      callerSignal.removeEventListener("abort", onAbort);
      currentRequest.subscribers -= 1;

      if (currentRequest.subscribers === 0 && inFlight.get(key) === currentRequest) {
        currentRequest.controller.abort();
        inFlight.delete(key);
      }
    };

    const onAbort = () => {
      release();
      reject(callerSignal.reason ?? abortError());
    };

    callerSignal.addEventListener("abort", onAbort, { once: true });

    currentRequest.promise.then(
      (result) => {
        if (finished) return;
        release();
        resolve(result);
      },
      (error: unknown) => {
        if (finished) return;
        release();
        reject(error);
      }
    );

    // Защита от сигнала, отменённого между первоначальной проверкой и подпиской.
    if (callerSignal.aborted) onAbort();
  });
}

export function clearCountryCache(): void {
  cache.clear();
}

export function clearCountryServiceForTests(): void {
  for (const request of inFlight.values()) request.controller.abort();
  inFlight.clear();
  cache.clear();
}
