import { Page, Card, EmptyState, Button } from '@shopify/polaris';
import { useRouteError, isRouteErrorResponse, Link } from '@remix-run/react';

export function CampaignErrorBoundary() {
  const error = useRouteError();

  let title = 'Something went wrong';
  let message = 'An unexpected error occurred while loading the campaign.';

  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 404:
        title = 'Campaign not found';
        message = 'The campaign you\'re looking for doesn\'t exist or has been removed.';
        break;
      case 403:
        title = 'Access denied';
        message = 'You don\'t have permission to view this campaign.';
        break;
      case 500:
        title = 'Server error';
        message = 'There was a problem loading the campaign data.';
        break;
    }
  }

  return (
    <Page
      backAction={{
        content: 'Campaigns',
        url: '/app/campaigns'
      }}
    >
      <Card>
        <EmptyState
          heading={title}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>{message}</p>
          <div style={{ marginTop: '1rem' }}>
            <Button variant="primary" url="/app/campaigns">
              Back to Campaigns
            </Button>
          </div>
        </EmptyState>
      </Card>
    </Page>
  );
}

export function CampaignListErrorBoundary() {
  const error = useRouteError();

  return (
    <Page title="Campaigns">
      <Card>
        <EmptyState
          heading="Unable to load campaigns"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>There was a problem loading your campaign data. Please try again.</p>
          <div style={{ marginTop: '1rem' }}>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </EmptyState>
      </Card>
    </Page>
  );
}
