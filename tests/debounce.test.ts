import { describe, expect, it, vi } from "vitest";
import { debounce } from "../src/utils/debounce.js";

describe("debounce", () => {
  it("выполняет функцию только после паузы", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = debounce(callback, 300);

    debounced("s");
    vi.advanceTimersByTime(200);
    debounced("sp");
    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("sp");
    vi.useRealTimers();
  });

  it("поддерживает cancel", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = debounce(callback, 100);
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
