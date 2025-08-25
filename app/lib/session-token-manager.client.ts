/**
 * Client-side Session Token Manager for Shopify Embedded Apps
 * Handles automatic refresh of session tokens to prevent authentication failures
 */

declare global {
  interface Window {
    shopify?: {
      idToken?: () => Promise<string>;
      environment?: {
        embedded: boolean;
      };
    };
  }
}

export class ClientSessionTokenManager {
  private static instance: ClientSessionTokenManager;
  private currentToken: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private tokenListeners: ((token: string) => void)[] = [];
  private isInitialized = false;

  public static getInstance(): ClientSessionTokenManager {
    if (!ClientSessionTokenManager.instance) {
      ClientSessionTokenManager.instance = new ClientSessionTokenManager();
    }
    return ClientSessionTokenManager.instance;
  }

  /**
   * Initialize the session token manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔄 Initializing Client Session Token Manager...');
    
    try {
      // Check if we're in an embedded Shopify app
      if (!this.isEmbeddedApp()) {
        console.log('⚠️ Not in embedded app context, skipping session token management');
        return;
      }

      // Get initial token
      await this.refreshToken();
      
      // Start periodic refresh (every 30 seconds to be safe)
      this.startPeriodicRefresh();
      
      this.isInitialized = true;
      console.log('✅ Client Session Token Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Client Session Token Manager:', error);
    }
  }

  /**
   * Check if we're running in an embedded Shopify app
   */
  private isEmbeddedApp(): boolean {
    return !!(window.shopify?.environment?.embedded || window.parent !== window);
  }

  /**
   * Get the current session token
   */
  public getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Refresh the session token
   */
  public async refreshToken(): Promise<string | null> {
    try {
      if (!window.shopify?.idToken) {
        console.error('❌ Shopify idToken function not available');
        return null;
      }

      console.log('🔄 Refreshing session token...');
      const newToken = await window.shopify.idToken();
      
      if (newToken) {
        this.currentToken = newToken;
        this.notifyListeners(newToken);
        console.log('✅ Session token refreshed successfully');
        return newToken;
      } else {
        console.error('❌ Failed to get new session token');
        return null;
      }
    } catch (error) {
      console.error('❌ Error refreshing session token:', error);
      return null;
    }
  }

  /**
   * Start periodic token refresh
   */
  private startPeriodicRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    // Refresh every 30 seconds (session tokens expire after 1 minute)
    this.refreshTimer = setInterval(() => {
      this.refreshToken();
    }, 30000);

    console.log('🔁 Started periodic token refresh (every 30s)');
  }

  /**
   * Stop periodic token refresh
   */
  public stopPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      console.log('⏹️ Stopped periodic token refresh');
    }
  }

  /**
   * Add a listener for token updates
   */
  public addTokenListener(listener: (token: string) => void): void {
    this.tokenListeners.push(listener);
  }

  /**
   * Remove a token listener
   */
  public removeTokenListener(listener: (token: string) => void): void {
    const index = this.tokenListeners.indexOf(listener);
    if (index > -1) {
      this.tokenListeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of token update
   */
  private notifyListeners(token: string): void {
    this.tokenListeners.forEach(listener => {
      try {
        listener(token);
      } catch (error) {
        console.error('❌ Error in token listener:', error);
      }
    });
  }

  /**
   * Enhanced fetch function that automatically includes fresh session token
   */
  public async enhancedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    try {
      // Get fresh token before making request
      const token = await this.refreshToken();
      
      if (!token) {
        console.warn('⚠️ No session token available, making request without it');
      }

      // Prepare headers
      const headers = new Headers(options.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      // Make request with fresh token
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // If we get 401/302, try to refresh token and retry once
      if (response.status === 401 || response.status === 302) {
        console.log('🔄 Auth failed, retrying with fresh token...');
        const freshToken = await this.refreshToken();
        
        if (freshToken) {
          headers.set('Authorization', `Bearer ${freshToken}`);
          return fetch(url, {
            ...options,
            headers,
          });
        }
      }

      return response;
    } catch (error) {
      console.error('❌ Error in enhanced fetch:', error);
      throw error;
    }
  }

  /**
   * Cleanup when manager is no longer needed
   */
  public cleanup(): void {
    this.stopPeriodicRefresh();
    this.tokenListeners = [];
    this.currentToken = null;
    this.isInitialized = false;
    console.log('🧹 Client Session Token Manager cleaned up');
  }
}

// Global function to get the session token manager
export const getSessionTokenManager = () => ClientSessionTokenManager.getInstance();
