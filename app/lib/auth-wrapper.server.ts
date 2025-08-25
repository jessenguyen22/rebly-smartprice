import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { SessionTokenManager } from './session-token-manager.server';

/**
 * Enhanced authentication wrapper with automatic token refresh and session management
 */
export class AuthWrapper {
  /**
   * Authenticate a loader request with enhanced error handling and token refresh
   */
  static async authenticateLoader(args: LoaderFunctionArgs) {
    try {
      console.log('🔐 Authenticating loader request with token refresh support');
      
      // First try enhanced authentication with token refresh
      const result = await SessionTokenManager.authenticateWithRefresh(args.request);
      
      console.log('✅ Loader authentication successful for shop:', result.session.shop);
      return result;
    } catch (error) {
      console.error('❌ Loader authentication failed:', error);
      
      // If it's a redirect response (302), let it through
      if (error instanceof Response) {
        console.log('🔄 Authentication redirect response detected');
        throw error;
      }
      
      // For other errors, log and re-throw
      console.error('🚨 Authentication error, attempting fallback...');
      
      // Fallback to original authenticate method
      try {
        const fallbackResult = await authenticate.admin(args.request);
        console.log('✅ Fallback authentication successful');
        return fallbackResult;
      } catch (fallbackError) {
        console.error('❌ Fallback authentication also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Authenticate an action request with enhanced error handling and token refresh
   */
  static async authenticateAction(args: ActionFunctionArgs) {
    try {
      console.log('🔐 Authenticating action request with token refresh support');
      
      // First try enhanced authentication with token refresh
      const result = await SessionTokenManager.authenticateWithRefresh(args.request);
      
      console.log('✅ Action authentication successful for shop:', result.session.shop);
      return result;
    } catch (error) {
      console.error('❌ Action authentication failed:', error);
      
      // If it's a redirect response (302), let it through
      if (error instanceof Response) {
        console.log('🔄 Authentication redirect response detected');
        throw error;
      }
      
      // For other errors, log and re-throw
      console.error('🚨 Authentication error, attempting fallback...');
      
      // Fallback to original authenticate method
      try {
        const fallbackResult = await authenticate.admin(args.request);
        console.log('✅ Fallback authentication successful');
        return fallbackResult;
      } catch (fallbackError) {
        console.error('❌ Fallback authentication also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }
      console.error('🚨 Unexpected authentication error:', error);
      throw error;
    }
  }

  /**
   * Check if an error is related to session expiry
   */
  static isSessionError(error: unknown): boolean {
    if (error instanceof Response) {
      return error.status === 302 || error.status === 401;
    }
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('session') || 
             message.includes('auth') || 
             message.includes('token') ||
             message.includes('unauthorized');
    }
    
    return false;
  }

  /**
   * Handle GraphQL authentication errors
   */
  static handleGraphQLAuthError(response: Response): boolean {
    if (response.status === 302) {
      console.error('🚫 GraphQL authentication failed - session expired');
      return true;
    }
    return false;
  }

  /**
   * Retry authentication-related operations
   */
  static async withRetry<T>(
    operation: () => Promise<T>, 
    maxRetries: number = 2
  ): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (this.isSessionError(error)) {
          console.log(`⚠️ Session error on attempt ${attempt}, retrying...`);
          
          // Add small delay between retries
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        } else {
          // Non-session error, don't retry
          throw error;
        }
      }
    }
    
    console.error(`❌ All ${maxRetries} authentication attempts failed`);
    throw lastError;
  }
}
