import { json } from '@remix-run/node';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { RollbackService } from '../lib/services/RollbackService';

// GET /api/campaigns/:id/rollback - Get rollback confirmation data
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    
    if (!params.id) {
      return json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const url = new URL(request.url);
    const filters = {
      productIds: url.searchParams.get('productIds')?.split(','),
      variantIds: url.searchParams.get('variantIds')?.split(','),
      dateRange: url.searchParams.get('dateFrom') ? {
        from: new Date(url.searchParams.get('dateFrom')!),
        to: new Date(url.searchParams.get('dateTo') || Date.now())
      } : undefined
    };

    const rollbackService = new RollbackService(session.shop);
    const confirmation = await rollbackService.getRollbackConfirmation(params.id, filters);

    return json({ success: true, confirmation });
  } catch (error: any) {
    console.error('Failed to get rollback confirmation:', error);
    return json(
      { error: error.message || 'Failed to get rollback confirmation' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
}

// POST /api/campaigns/:id/rollback - Create rollback job
export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { session } = await authenticate.admin(request);
    
    if (!params.id) {
      return json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { filters, execute = false } = body;

    const rollbackService = new RollbackService(session.shop);
    
    if (execute) {
      // Create and execute rollback job
      const job = await rollbackService.createRollbackJob(params.id, filters);
      await rollbackService.executeRollbackJob(job.id);
      
      return json({ 
        success: true, 
        message: 'Rollback job created and executed',
        job: {
          id: job.id,
          status: 'RUNNING',
          campaignId: params.id
        }
      });
    } else {
      // Just create rollback job
      const job = await rollbackService.createRollbackJob(params.id, filters);
      
      return json({ 
        success: true, 
        message: 'Rollback job created',
        job
      });
    }
  } catch (error: any) {
    console.error('Failed to create rollback job:', error);
    return json(
      { error: error.message || 'Failed to create rollback job' },
      { status: 500 }
    );
  }
}
