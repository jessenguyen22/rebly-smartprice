import { json } from '@remix-run/node';
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { RollbackService } from '../lib/services/RollbackService';

// GET /api/rollback/:jobId - Get rollback job progress
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    
    if (!params.jobId) {
      return json({ error: 'Job ID is required' }, { status: 400 });
    }

    const rollbackService = new RollbackService(session.shop);
    const progress = await rollbackService.getRollbackProgress(params.jobId);

    if (!progress) {
      return json({ error: 'Rollback job not found' }, { status: 404 });
    }

    return json({ success: true, progress });
  } catch (error: any) {
    console.error('Failed to get rollback progress:', error);
    return json(
      { error: error.message || 'Failed to get rollback progress' },
      { status: 500 }
    );
  }
}

// DELETE /api/rollback/:jobId - Cancel rollback job
export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { session } = await authenticate.admin(request);
    
    if (!params.jobId) {
      return json({ error: 'Job ID is required' }, { status: 400 });
    }

    const rollbackService = new RollbackService(session.shop);
    await rollbackService.cancelRollbackJob(params.jobId);

    return json({ 
      success: true, 
      message: 'Rollback job cancelled successfully' 
    });
  } catch (error: any) {
    console.error('Failed to cancel rollback job:', error);
    return json(
      { error: error.message || 'Failed to cancel rollback job' },
      { status: error.message?.includes('Cannot cancel') ? 400 : 500 }
    );
  }
}
