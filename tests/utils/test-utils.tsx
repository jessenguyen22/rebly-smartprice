import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';

// Custom render function that includes Polaris AppProvider
function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AppProvider i18n={enTranslations}>
        {children}
      </AppProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
