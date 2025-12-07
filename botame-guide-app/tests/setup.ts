import '@testing-library/jest-dom';

// Polyfill for setImmediate (required by Playwright)
if (typeof globalThis.setImmediate === 'undefined') {
  (globalThis as any).setImmediate = (fn: (...args: any[]) => void, ...args: any[]) => {
    return setTimeout(fn, 0, ...args);
  };
}

if (typeof globalThis.clearImmediate === 'undefined') {
  (globalThis as any).clearImmediate = (id: any) => {
    return clearTimeout(id);
  };
}

// Mock window.electron for tests
Object.defineProperty(window, 'electron', {
  value: {
    invoke: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
  writable: true,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Suppress console errors during tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
