// Test setup for vitest
import { beforeAll } from 'vitest';
import '@testing-library/jest-dom';
import * as dotenv from 'dotenv';

// Load environment variables for tests
beforeAll(() => {
  dotenv.config({ path: '.env' });
});

// Mock Shopify Polaris components that may cause issues in tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
