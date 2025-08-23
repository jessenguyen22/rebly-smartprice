import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  TextField,
  Banner,
  Icon,
  Badge,
} from "@shopify/polaris";
import { 
  TitleBar,
  useAppBridge
} from "@shopify/app-bridge-react";
import { 
  CalendarIcon,
  AutomationIcon,
  NotificationIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  
  return json({
    estimatedReleaseDate: "Q2 2025",
    currentFeatures: [
      "Manual pricing jobs with bulk operations",
      "Advanced rule-based pricing logic", 
      "Complete audit trail and analytics",
      "Database dashboard for monitoring"
    ],
    upcomingFeatures: [
      "Automated campaign triggers based on inventory levels",
      "Time-based pricing campaigns (flash sales, seasonal)",
      "Competitor price monitoring and auto-adjustment",
      "A/B testing for pricing strategies",
      "Advanced analytics and performance insights"
    ]
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const email = formData.get("email") as string;
  
  // Mock signup - in production this would save to database or email service
  console.log(`Campaign feature notification signup: ${email} for shop: ${session.shop}`);
  
  return json({
    success: true,
    message: "Thank you! We'll notify you when campaign automation is available."
  });
};

export default function CampaignsComingSoon() {
  const { estimatedReleaseDate, currentFeatures, upcomingFeatures } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [email, setEmail] = useState("");
  const shopify = useAppBridge();

  const isLoading = ["loading", "submitting"].includes(fetcher.state);
  const isSuccess = fetcher.data?.success;

  const handleSubmit = () => {
    if (!email.trim()) {
      shopify.toast.show("Please enter a valid email address", { isError: true });
      return;
    }
    
    const formData = new FormData();
    formData.append("email", email);
    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <Page>
      <TitleBar title="Campaign Automation - Coming Soon" />
      
      <BlockStack gap="500">
        {/* Success Banner */}
        {isSuccess && (
          <Banner tone="success" title="Signup Successful">
            {fetcher.data?.message}
          </Banner>
        )}

        {/* Hero Section */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between">
                  <BlockStack gap="300">
                    <Text as="h1" variant="headingXl">
                      Campaign Automation
                    </Text>
                    <Text as="p" variant="bodyLg" tone="subdued">
                      Powerful automated pricing campaigns are coming to streamline your pricing strategy.
                    </Text>
                  </BlockStack>
                  <Icon source={AutomationIcon} tone="subdued" />
                </InlineStack>
                
                <InlineStack gap="400">
                  <Badge tone="info">{`Expected: ${estimatedReleaseDate}`}</Badge>
                  <Badge tone="attention">Beta Access Available</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  What's Available Now
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  While automated campaigns are in development, you can already use these powerful features:
                </Text>
                <BlockStack gap="300">
                  {currentFeatures.map((feature, index) => (
                    <InlineStack key={index} gap="200" align="start">
                      <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        backgroundColor: 'var(--p-color-icon-success)', 
                        borderRadius: '50%',
                        marginTop: '6px',
                        flexShrink: 0
                      }} />
                      <Text as="p" variant="bodyMd">
                        {feature}
                      </Text>
                    </InlineStack>
                  ))}
                </BlockStack>
                
                <InlineStack gap="300">
                  <Button url="/app/pricing-job" variant="primary">
                    Create Pricing Job Now
                  </Button>
                  <Button url="/app/database" variant="secondary">
                    View Analytics Dashboard
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              {/* Coming Features */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingLg">
                    Coming in Campaign Automation
                  </Text>
                  <BlockStack gap="300">
                    {upcomingFeatures.map((feature, index) => (
                      <InlineStack key={index} gap="200" align="start">
                        <div style={{ 
                          width: '8px', 
                          height: '8px', 
                          backgroundColor: 'var(--p-color-icon-info)', 
                          borderRadius: '50%',
                          marginTop: '6px',
                          flexShrink: 0
                        }} />
                        <Text as="p" variant="bodyMd">
                          {feature}
                        </Text>
                      </InlineStack>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Notification Signup */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">
                      Get Early Access
                    </Text>
                    <Icon source={NotificationIcon} tone="subdued" />
                  </InlineStack>
                  
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Be the first to know when campaign automation launches. We'll send you early access and setup guides.
                  </Text>
                  
                  {!isSuccess ? (
                    <BlockStack gap="300">
                      <TextField
                        label="Email address"
                        value={email}
                        onChange={setEmail}
                        type="email"
                        placeholder="your-email@example.com"
                        autoComplete="email"
                      />
                      <Button
                        variant="primary"
                        onClick={handleSubmit}
                        loading={isLoading}
                        disabled={!email.trim()}
                      >
                        Notify Me When Available
                      </Button>
                    </BlockStack>
                  ) : (
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" tone="success">
                        ✓ You're signed up for early access notifications!
                      </Text>
                      <Button 
                        variant="secondary" 
                        onClick={() => {
                          setEmail("");
                          fetcher.load("/app/campaigns");
                        }}
                      >
                        Sign up another email
                      </Button>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>

        {/* Call to Action */}
        <Layout>
          <Layout.Section>
            <Card background="bg-surface-info">
              <BlockStack gap="300">
                <Text as="h2" variant="headingLg">
                  Ready to Get Started?
                </Text>
                <Text as="p" variant="bodyMd">
                  Don't wait for automation - start managing your pricing efficiently today with our manual pricing job tools.
                </Text>
                <InlineStack gap="300">
                  <Button url="/app/pricing-job" variant="primary">
                    Create Your First Pricing Job
                  </Button>
                  <Button url="/app" variant="secondary">
                    Back to Dashboard
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
