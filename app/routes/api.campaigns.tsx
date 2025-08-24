import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { CampaignService } from '../lib/services/CampaignService';
// import { CampaignValidationService } from '../lib/services/CampaignValidationService';
import { validateCampaignInput, validateStatusUpdate, type CampaignFilters } from '../lib/validation/campaignValidation';
import { initializeCampaignProcessing } from '../services/campaign-session-integration.server';

// GET /api/campaigns - List all campaigns
export async function loader(args: LoaderFunctionArgs) {
  try {
    const { session } = await initializeCampaignProcessing.initializeCampaignProcessingFromLoader(args);
    const url = new URL(args.request.url);
    
    const filters: CampaignFilters = {
      status: url.searchParams.get('status') as any,
      search: url.searchParams.get('search') || undefined,
      sortBy: (url.searchParams.get('sortBy') as any) || 'createdAt',
      sortOrder: (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: parseInt(url.searchParams.get('limit') || '20')
    };

    const campaignService = new CampaignService(session.shop);
    const result = await campaignService.getCampaigns(filters);

    return json(result);
  } catch (error) {
    console.error('[API] Failed to fetch campaigns:', error);
    return json(
      { 
        error: 'Failed to fetch campaigns',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/campaigns - Create new campaign
// PUT /api/campaigns - Update campaign
export async function action(args: ActionFunctionArgs) {
  try {
    const { session } = await initializeCampaignProcessing.initializeCampaignProcessingFromAction(args);
    const formData = await args.request.formData();
    const method = args.request.method;

    const campaignService = new CampaignService(session.shop);
    // const validationService = new CampaignValidationService();

    if (method === 'POST') {
      // Create new campaign
      const campaignData = JSON.parse(formData.get('campaignData') as string);
      
      // Validate input
      const validation = validateCampaignInput(campaignData);
      if (!validation.isValid) {
        return json(
          { error: 'Validation failed', details: validation.errors },
          { status: 400 }
        );
      }

      // Validate business rules
      // const ruleValidation = await validationService.validateCampaignRules(campaignData.rules);
      // if (!ruleValidation.isValid) {
      //   return json(
      //     { error: 'Rule validation failed', details: ruleValidation.errors },
      //     { status: 400 }
      //   );
      // }

      const campaign = await campaignService.createCampaign(campaignData, session.id);
      return json({ campaign, message: 'Campaign created successfully' });

    } else if (method === 'PUT') {
      // Update existing campaign
      const campaignId = formData.get('campaignId') as string;
      const campaignData = JSON.parse(formData.get('campaignData') as string);

      if (!campaignId) {
        return json(
          { error: 'Campaign ID is required for update' },
          { status: 400 }
        );
      }

      // Validate input
      const validation = validateCampaignInput(campaignData);
      if (!validation.isValid) {
        return json(
          { error: 'Validation failed', details: validation.errors },
          { status: 400 }
        );
      }

      const campaign = await campaignService.updateCampaign(campaignId, campaignData, session.id);
      return json({ campaign, message: 'Campaign updated successfully' });

    } else {
      return json(
        { error: `Method ${method} not allowed` },
        { status: 405 }
      );
    }

  } catch (error) {
    console.error('[API] Campaign action failed:', error);
    return json(
      { 
        error: 'Campaign operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
