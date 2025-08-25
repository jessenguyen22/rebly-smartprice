import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
import { initializeCampaignProcessing } from '../services/campaign-session-integration.server';
import { prisma } from '../db.server';

// Debug endpoint to clear variant cooldowns for testing
export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin, session } = await initializeCampaignProcessing.initializeCampaignProcessingFromAction({
      request,
      params: {},
      context: {}
    });

    const body = await request.json();
    const { variantId } = body;

    if (!variantId) {
      return json({ error: 'variantId is required' }, { status: 400 });
    }

    // Clear price cooldown for variant
    const result = await prisma.priceCooldown.deleteMany({
      where: {
        variantId,
        type: 'PRICE_UPDATE'
      }
    });

    console.log(`🧹 Cleared ${result.count} price cooldowns for variant: ${variantId}`);

    return json({ 
      success: true, 
      message: `Cleared ${result.count} cooldowns for variant ${variantId}` 
    });

  } catch (error) {
    console.error('Error clearing cooldown:', error);
    return json({ 
      error: 'Failed to clear cooldown',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
