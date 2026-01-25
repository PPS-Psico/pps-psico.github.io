/// <reference types="@testing-library/jest-dom" />

// Type extensions for jest-dom matchers
declare namespace jest {
  interface Matchers<R = void> {
    toBeInTheDocument(): R;
    toHaveAttribute(name: string, value?: any): R;
    toHaveStyle(style: any): R;
    toHaveTextContent(text: string | RegExp): R;
  }
}