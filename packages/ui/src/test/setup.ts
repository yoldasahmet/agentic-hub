import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * jsdom lacks the layout APIs React Flow and Radix call. These stand-ins
 * report zero-size boxes, which is enough to render and interact.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class DOMMatrixStub {
  m22 = 1;
}

Object.assign(globalThis, {
  ResizeObserver: globalThis.ResizeObserver ?? ResizeObserverStub,
  DOMMatrixReadOnly: globalThis.DOMMatrixReadOnly ?? DOMMatrixStub,
});
if (typeof window !== "undefined") {
  window.matchMedia ??= (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
}

afterEach(() => cleanup());
