import '@testing-library/jest-dom/vitest'

// jsdom nem implementálja a ResizeObserver-t, amit a recharts (a
// ResponsiveContainer) a diagramok méretezéséhez használ — polyfill nélkül a
// diagramokat tartalmazó komponensek tesztelése ReferenceError-ral elszállna.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserverStub,
  });
}
