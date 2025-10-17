// jest.setup.ts
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({ get: jest.fn(), entries: jest.fn(() => []) }),
  usePathname: () => '/',
  redirect: jest.fn(), // if you need real behavior, make this throw a NEXT_REDIRECT error
  notFound: jest.fn(), // likewise can throw a NEXT_NOT_FOUND error if desired
}));

// Simple mock for next/font/google so tests don’t blow up
jest.mock('next/font/google', () => {
  const mock = () => ({ className: 'mock-font', variable: 'mock-font-var', style: {} });
  return new Proxy({}, { get: () => mock });
});

// Optional: reset mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});