import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { initializeCampaignProcessing } from '../services/campaign-session-integration.server';
import { prisma } from '../db.server';

// Debug endpoint to check current cooldowns
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { admin, session } = await initializeCampaignProcessing.initializeCampaignProcessingFromLoader({
      request,
      params: {},
      context: {}
    });

    const url = new URL(request.url);
    const variantId = url.searchParams.get('variantId');

    let where = {};
    if (variantId) {
      where = { variantId };
    }

    // Get all active cooldowns
    const cooldowns = await prisma.priceCooldown.findMany({
      where,
      select: {
        id: true,
        variantId: true,
        type: true,
        expiresAt: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Add human-readable expiry info
    const cooldownsWithInfo = cooldowns.map(cooldown => ({
      ...cooldown,
      isExpired: new Date() > cooldown.expiresAt,
      minutesRemaining: Math.max(0, Math.ceil((cooldown.expiresAt.getTime() - Date.now()) / (1000 * 60))),
      expiresAtFormatted: cooldown.expiresAt.toISOString()
    }));

    return json({
      success: true,
      cooldowns: cooldownsWithInfo,
      totalCount: cooldowns.length,
      activeCount: cooldownsWithInfo.filter(c => !c.isExpired).length
    });

  } catch (error) {
    console.error('Error checking cooldowns:', error);
    return json({ 
      error: 'Failed to check cooldowns',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
