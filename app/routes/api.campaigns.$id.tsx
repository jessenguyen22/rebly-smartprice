import { json } from '@remix-run/node';
import type { ActionFunction, LoaderFunction } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { CampaignService } from '../lib/services/CampaignService';
import { CampaignValidationService } from '../lib/services/CampaignValidationService';
import { StatusUpdateSchema, type StatusUpdate } from '../lib/validation/campaignValidation';
import { z } from 'zod';
import db from '../db.server';
import { initializeCampaignProcessing } from '../services/campaign-session-integration.server';

const validationService = new CampaignValidationService();

// GET /api/campaigns/:id - Get single campaign
export const loader: LoaderFunction = async (args) => {
  try {
    const { admin, session } = await initializeCampaignProcessing.initializeCampaignProcessingFromLoader(args);
    const campaignService = new CampaignService(session.shop);
    const campaignId = args.params.id;

    if (!campaignId) {
      return json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const campaign = await campaignService.getCampaign(campaignId);
    
    if (!campaign) {
      return json({ error: 'Campaign not found' }, { status: 404 });
    }

    return json({ campaign });

  } catch (error) {
    console.error('Error fetching campaign:', error);
    return json({ 
      error: 'Failed to fetch campaign',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

// PUT/PATCH /api/campaigns/:id - Update campaign
export const action: ActionFunction = async (args) => {
  try {
    const { admin, session } = await initializeCampaignProcessing.initializeCampaignProcessingFromAction(args);
    const campaignService = new CampaignService(session.shop);
    const campaignId = args.params.id;
    const method = args.request.method;

    if (!campaignId) {
      return json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    // Check if campaign exists
    const existingCampaign = await campaignService.getCampaign(campaignId);
    if (!existingCampaign) {
      return json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (method === 'DELETE') {
      // Delete campaign (soft delete by setting status to ARCHIVED)
      await campaignService.updateCampaignStatus(campaignId, 'ARCHIVED');
      return json({ message: 'Campaign archived successfully' });
    }

    // Parse request body
    const body = await args.request.json();

    if (method === 'PATCH') {
      // Status update only
      const validation = StatusUpdateSchema.safeParse(body);
      if (!validation.success) {
        return json({ 
          error: 'Invalid status update data',
          details: validation.error.issues
        }, { status: 400 });
      }

      const { status } = validation.data;

      // Validate activation if activating
      if (status === 'ACTIVE') {
        const activationValidation = await validationService.validateCampaignActivation(campaignId);
        if (!activationValidation.isValid) {
          return json({
            error: 'Campaign cannot be activated',
            details: activationValidation.errors
          }, { status: 400 });
        }
      }

      const updatedCampaign = await campaignService.updateCampaignStatus(campaignId, status);
      return json({ 
        campaign: updatedCampaign,
        message: `Campaign ${status.toLowerCase()} successfully`
      });
    }

    if (method === 'PUT') {
      // Full campaign update - simplified for now
      return json({ error: 'Full campaign updates not implemented yet' }, { status: 501 });
    }

    return json({ error: 'Method not allowed' }, { status: 405 });

  } catch (error) {
    console.error('Error in campaign action:', error);
    
    if (error instanceof z.ZodError) {
      return json({ 
        error: 'Validation failed',
        details: error.issues
      }, { status: 400 });
    }

    return json({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
