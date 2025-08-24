import { json, redirect } from '@remix-run/node';
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData, useNavigation, useSubmit, useActionData } from '@remix-run/react';
import { Page, BlockStack } from '@shopify/polaris';
import { TitleBar } from '@shopify/app-bridge-react';
import { authenticate } from '../shopify.server';
import { Breadcrumb } from '../components/navigation/Breadcrumb';
import { CampaignForm } from '../components/campaigns/CampaignForm';
import { CampaignService } from '../lib/services/CampaignService';
import type { CreateCampaignData, TargetProductCriteria } from '../types/campaign';
import type { CampaignInput } from '../lib/validation/campaignValidation';
import { initializeCampaignProcessing } from '../services/campaign-session-integration.server';
import { prisma } from '../db.server';

// Helper function to ensure shop exists in database
async function ensureShopExists(shopDomain: string, accessToken?: string): Promise<void> {
  try {
    await prisma.shopifyShop.upsert({
      where: { shopDomain },
      update: { 
        accessToken: accessToken || undefined,
        updatedAt: new Date() 
      },
      create: {
        shopDomain,
        accessToken: accessToken || null,
      }
    });
    console.log(`✅ Shop record ensured for: ${shopDomain}`);
  } catch (error) {
    console.error('Failed to ensure shop exists:', error);
    throw error;
  }
}

// Transform CreateCampaignData to CampaignInput format
function transformCampaignData(data: CreateCampaignData): CampaignInput {
  // Transform TargetProductCriteria[] to the expected format
  const targetProducts: CampaignInput['targetProducts'] = {
    productIds: [],
    collections: [],
    tags: [],
    vendors: [],
    productTypes: []
  };

  data.targetProducts.forEach((criteria: TargetProductCriteria) => {
    switch (criteria.type) {
      case 'product':
        if (Array.isArray(criteria.value)) {
          targetProducts.productIds = [...(targetProducts.productIds || []), ...criteria.value];
        } else if (criteria.value) {
          targetProducts.productIds = [...(targetProducts.productIds || []), criteria.value];
        }
        break;
      case 'collection':
        if (Array.isArray(criteria.value)) {
          targetProducts.collections = [...(targetProducts.collections || []), ...criteria.value];
        } else if (criteria.value) {
          targetProducts.collections = [...(targetProducts.collections || []), criteria.value];
        }
        break;
      case 'tag':
        if (Array.isArray(criteria.value)) {
          targetProducts.tags = [...(targetProducts.tags || []), ...criteria.value];
        } else if (criteria.value) {
          targetProducts.tags = [...(targetProducts.tags || []), criteria.value];
        }
        break;
    }
  });

  return {
    name: data.name,
    description: data.description,
    targetProducts,
    rules: data.rules.map(rule => ({
      description: rule.description,
      whenCondition: rule.whenCondition,
      whenOperator: rule.whenOperator as any,
      whenValue: rule.whenValue,
      thenAction: rule.thenAction as any,
      thenMode: rule.thenMode as any,
      thenValue: rule.thenValue,
      changeCompareAt: rule.changeCompareAt || false
    })),
    priority: data.priority || 1
  };
}

export const meta: MetaFunction = () => {
  return [
    { title: "Create Campaign - SmartPrice" },
    { name: "description", content: "Create a new automated pricing campaign for your products." },
  ];
};

export async function loader(args: LoaderFunctionArgs) {
  try {
    const { admin, session } = await initializeCampaignProcessing.initializeCampaignProcessingFromLoader(args);
    
    // Ensure shop exists in database
    await ensureShopExists(session.shop, session.accessToken);
    
    // Mock products data - would fetch from Shopify in real implementation
    const mockProducts = [
      {
        id: 'gid://shopify/Product/1',
        title: 'Premium T-Shirt',
        handle: 'premium-tshirt',
        image: { url: 'https://via.placeholder.com/100', altText: 'Premium T-Shirt' },
        variants: [
          { id: 'gid://shopify/ProductVariant/1', title: 'Small', price: '29.99' },
          { id: 'gid://shopify/ProductVariant/2', title: 'Medium', price: '29.99' },
          { id: 'gid://shopify/ProductVariant/3', title: 'Large', price: '29.99' }
        ]
      },
      {
        id: 'gid://shopify/Product/2',
        title: 'Designer Jeans',
        handle: 'designer-jeans',
        image: { url: 'https://via.placeholder.com/100', altText: 'Designer Jeans' },
        variants: [
          { id: 'gid://shopify/ProductVariant/4', title: '32W x 32L', price: '89.99' },
          { id: 'gid://shopify/ProductVariant/5', title: '34W x 32L', price: '89.99' }
        ]
      }
    ];
    
    return json({
      products: mockProducts,
      shopDomain: session.shop
    });
  } catch (error) {
    console.error('Failed to load create campaign data:', error);
    return json({
      products: [],
      shopDomain: '',
      error: 'Failed to load create campaign data'
    });
  }
}

export async function action(args: ActionFunctionArgs) {
  try {
    const { admin, session } = await initializeCampaignProcessing.initializeCampaignProcessingFromAction(args);
    
    // Ensure shop exists in database before creating campaign
    await ensureShopExists(session.shop, session.accessToken);
    
    const campaignService = new CampaignService(session.shop);
    
    const formData = await args.request.formData();
    const campaignDataStr = formData.get('campaignData') as string;
    
    if (!campaignDataStr) {
      return json({ error: 'Campaign data is required' }, { status: 400 });
    }

    const campaignData: CreateCampaignData = JSON.parse(campaignDataStr);
    
    // Transform the campaign data to the expected format
    const transformedData = transformCampaignData(campaignData);
    
    // Create the campaign
    const campaign = await campaignService.createCampaign(transformedData);
    
    // Redirect to the campaign details page
    return redirect(`/app/campaigns/${campaign.id}`);
  } catch (error) {
    console.error('Failed to create campaign:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Failed to create campaign' 
    }, { status: 500 });
  }
}

export default function CampaignCreate() {
  const { products } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();
  
  const isSubmitting = navigation.state === 'submitting';

  const handleSubmit = async (data: CreateCampaignData) => {
    const formData = new FormData();
    formData.append('campaignData', JSON.stringify(data));
    submit(formData, { method: 'POST' });
  };

  const handleCancel = () => {
    window.location.href = '/app/campaigns';
  };

  return (
    <Page
      backAction={{
        content: 'Campaigns',
        url: '/app/campaigns'
      }}
      title="Create Campaign"
    >
      <TitleBar title="Create Campaign" />
      <BlockStack gap="500">
        <Breadcrumb items={[
          {label: 'Campaigns', url: '/app/campaigns'},
          {label: 'Create Campaign'}
        ]} />
        
        <CampaignForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </BlockStack>
    </Page>
  );
}
