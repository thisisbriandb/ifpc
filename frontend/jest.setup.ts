import '@testing-library/jest-dom';
import React from 'react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock next/image to remove fetchPriority and priority DOM attribute warnings in tests
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { fetchPriority, fill, priority, ...rest } = props;
    return React.createElement('img', rest);
  },
}));

// Mock recharts ResponsiveContainer to prevent size 0 warning in JSDOM
jest.mock('recharts', () => {
  const originalModule = jest.requireActual('recharts');
  return {
    ...originalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { style: { width: 800, height: 400 } }, children),
  };
});

// Mock react-markdown (ESM package)
jest.mock('react-markdown', () => {
  return function ReactMarkdown({ children }: { children: React.ReactNode }) {
    return React.createElement('div', null, children);
  };
});

// ResizeObserver mock
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// matchMedia mock
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
