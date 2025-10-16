import '@testing-library/jest-dom/extend-expect';

// Mock next/navigation error in test environment if needed
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), back: jest.fn() }) }));
