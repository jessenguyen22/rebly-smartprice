import { render as testingLibraryRender } from '@testing-library/react';
import { AppProvider } from '@shopify/polaris';
import en from '@shopify/polaris/locales/en.json';

function renderWithProvider(ui: React.ReactElement, options = {}) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProvider i18n={en}>
      {children}
    </AppProvider>
  );

  return testingLibraryRender(ui, { wrapper: Wrapper, ...options });
}

export * from '@testing-library/react';
export { renderWithProvider as render };
