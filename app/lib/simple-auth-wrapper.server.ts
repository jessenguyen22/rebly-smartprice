import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';

/**
 * Simple authentication wrapper that logs more details for debugging
 */
export class SimpleAuthWrapper {
  /**
   * Debug authenticate loader with detailed logging
   */
  static async authenticateLoader(args: LoaderFunctionArgs) {
    console.log('🔐 SimpleAuthWrapper: Starting loader authentication');
    console.log('📝 Request URL:', args.request.url);
    console.log('📝 Request Method:', args.request.method);
    
    // Log headers for debugging
    const authHeader = args.request.headers.get('Authorization');
    console.log('📝 Auth Header present:', !!authHeader);
    if (authHeader) {
      console.log('📝 Auth Header type:', authHeader.substring(0, 20) + '...');
    }
    
    try {
      console.log('🚀 Calling authenticate.admin...');
      const result = await authenticate.admin(args.request);
      
      if (result?.session) {
        console.log('✅ Authentication successful!');
        console.log('🏪 Shop:', result.session.shop);
        console.log('🌐 Online:', result.session.isOnline);
        console.log('⏰ Expires:', result.session.expires);
        console.log('🔑 Has Access Token:', !!result.session.accessToken);
        
        // Check token expiry
        if (result.session.expires) {
          const now = new Date();
          const expiresAt = new Date(result.session.expires);
          const minutesLeft = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));
          console.log(`⏳ Token expires in ${minutesLeft} minutes`);
          
          if (minutesLeft < 5) {
            console.log('⚠️ Token expires very soon!');
          }
        }
        
        return result;
      } else {
        console.log('❌ No session in authentication result');
        throw new Error('No session found');
      }
    } catch (error) {
      console.error('❌ Authentication error details:', {
        type: error?.constructor?.name || 'Unknown',
        message: (error as any)?.message || 'No message',
        status: error instanceof Response ? error.status : undefined,
        headers: error instanceof Response ? Object.fromEntries(error.headers.entries()) : undefined
      });
      
      // Don't modify the error, just re-throw it
      throw error;
    }
  }

  /**
   * Debug authenticate action with detailed logging  
   */
  static async authenticateAction(args: ActionFunctionArgs) {
    console.log('🔐 SimpleAuthWrapper: Starting action authentication');
    console.log('📝 Request URL:', args.request.url);
    console.log('📝 Request Method:', args.request.method);
    
    const authHeader = args.request.headers.get('Authorization');
    console.log('📝 Auth Header present:', !!authHeader);
    
    try {
      const result = await authenticate.admin(args.request);
      
      if (result?.session) {
        console.log('✅ Action authentication successful!');
        console.log('🏪 Shop:', result.session.shop);
        
        return result;
      } else {
        console.log('❌ No session in action authentication result');
        throw new Error('No session found');
      }
    } catch (error) {
      console.error('❌ Action authentication error:', error);
      throw error;
    }
  }
}
