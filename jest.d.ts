/// <reference types="@testing-library/jest-dom" />

import "@testing-library/jest-dom";

// Type definitions for import.meta polyfill in Jest
interface ImportMeta {
  readonly env: {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_GA4_MEASUREMENT_ID?: string;
    readonly VITE_SENTRY_DSN?: string;
    readonly VITE_ENABLE_MONITORING_IN_DEV?: string;
    readonly VITE_APP_VERSION?: string;
    readonly VITE_VAPID_PUBLIC_KEY?: string;
    readonly VITE_ONESIGNAL_APP_ID?: string;
    readonly VITE_ONESIGNAL_SAFARI_WEB_ID?: string;
  };
}

declare global {
  namespace jest {
    interface Matchers<R = void> {
      toBeInTheDocument(): R;
      toHaveAttribute(name: string, value?: any): R;
      toHaveStyle(style: any): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveValue(value?: string | string[] | number): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toBeRequired(): R;
      toBeInvalid(): R;
      toBeValid(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHtml(html: string): R;
      toHaveClass(...classNames: string[]): R;
      toHaveFocus(): R;
      toHaveFormValues(expectedValues: Record<string, any>): R;
    }
  }
}

// Support for @jest/globals if used
declare module "@jest/expect" {
  interface Matchers<R> {
    toBeInTheDocument(): R;
    toHaveAttribute(name: string, value?: any): R;
    toHaveStyle(style: any): R;
    toHaveTextContent(text: string | RegExp): R;
    toHaveValue(value?: string | string[] | number): R;
    toBeVisible(): R;
    toBeDisabled(): R;
    toBeEnabled(): R;
    toBeRequired(): R;
    toBeInvalid(): R;
    toBeValid(): R;
    toContainElement(element: HTMLElement | null): R;
    toContainHtml(html: string): R;
    toHaveClass(...classNames: string[]): R;
    toHaveFocus(): R;
    toHaveFormValues(expectedValues: Record<string, any>): R;
  }
}
