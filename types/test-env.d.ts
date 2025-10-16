/* eslint-disable */
// @ts-nocheck - temporary shim until @types/jest and testing libs are installed

declare namespace NodeJS {
  interface Global {
    jest?: any;
  }
}

// Minimal Jest globals
declare var describe: (name: string, fn: () => void) => void;
declare var it: (name: string, fn: () => void) => void;
declare var test: (name: string, fn: () => void) => void;
declare var beforeEach: (fn: () => void) => void;
declare var afterEach: (fn: () => void) => void;
declare var beforeAll: (fn: () => void) => void;
declare var afterAll: (fn: () => void) => void;
declare var expect: any;
declare var jest: any;

// Allow importing @testing-library/react without types in the editor
declare module '@testing-library/react' {
  export * from 'react';
  export const render: any;
  export const screen: any;
  export const fireEvent: any;
  export const waitFor: any;
  export const within: any;
}

declare module '@testing-library/jest-dom' {
  const whatever: any;
  export default whatever;
}

// Allow importing @testing-library/jest-dom/extend-expect if present
declare module '@testing-library/jest-dom/extend-expect' {
  const whatever: any;
  export default whatever;
}
