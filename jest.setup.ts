import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/',
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

// Mock next/font/google
jest.mock('next/font/google', () => {
  const mockFont = () => ({
    className: 'mock-font',
    variable: 'mock-font-var',
    style: {},
  });
  return new Proxy({}, {
    get: () => mockFont,
  });
});
