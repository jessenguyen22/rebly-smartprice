import { Page, Layout, Card, SkeletonPage, SkeletonBodyText, SkeletonDisplayText } from '@shopify/polaris';

export function CampaignLoadingState() {
  return (
    <SkeletonPage 
      primaryAction 
    >
      <Layout>
        <Layout.Section>
          <Card>
            <SkeletonBodyText lines={3} />
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <SkeletonBodyText lines={2} />
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function CampaignListLoadingState() {
  return (
    <SkeletonPage 
      primaryAction 
    >
      <Layout>
        <Layout.Section>
          {[...Array(3)].map((_, index) => (
            <Card key={index}>
              <SkeletonBodyText lines={2} />
            </Card>
          ))}
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}
