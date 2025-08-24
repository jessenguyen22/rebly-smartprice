import { Outlet, useRouteError } from '@remix-run/react';
import { Page, Spinner } from '@shopify/polaris';
import { boundary } from '@shopify/shopify-app-remix/server';
import { Suspense } from 'react';

export default function CampaignsLayout() {
  return (
    <Suspense fallback={
      <Page>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '200px' 
        }}>
          <Spinner />
        </div>
      </Page>
    }>
      <Outlet />
    </Suspense>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
