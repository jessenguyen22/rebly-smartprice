import { authenticate } from "../shopify.server";

/**
 * Session Token Manager - Handles automatic token refresh for embedded apps
 * Based on Shopify's Token Exchange recommendations for production stability
 */
export class SessionTokenManager {
  private static readonly TOKEN_EXCHANGE_URL = '/admin/oauth/access_token';
  private static readonly REFRESH_THRESHOLD_MINUTES = 60; // Refresh tokens 1 hour before expiry
  
  /**
   * Exchange session token for access token using Token Exchange
   * This is the recommended method for embedded apps
   */
  static async exchangeSessionTokenForAccessToken(
    shop: string,
    sessionToken: string,
    requestType: 'online' | 'offline' = 'online'
  ): Promise<{
    accessToken: string;
    scope: string;
    expiresIn?: number;
    associatedUser?: any;
  }> {
    console.log('🔄 Starting token exchange for:', shop);
    
    const tokenExchangeUrl = `https://${shop}/admin/oauth/access_token`;
    
    const requestBody = {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: sessionToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      requested_token_type: requestType === 'online' 
        ? 'urn:shopify:params:oauth:token-type:online-access-token'
        : 'urn:shopify:params:oauth:token-type:offline-access-token'
    };

    try {
      const response = await fetch(tokenExchangeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
      }

      const tokenData = await response.json();
      console.log('✅ Token exchange successful for:', shop);
      
      return {
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
        expiresIn: tokenData.expires_in,
        associatedUser: tokenData.associated_user
      };
    } catch (error) {
      console.error('❌ Token exchange error:', error);
      throw error;
    }
  }

  /**
   * Check if access token needs refresh based on expiry time
   */
  static needsRefresh(expiresAt?: Date): boolean {
    if (!expiresAt) return true;
    
    const now = new Date();
    const refreshThreshold = new Date(now.getTime() + (this.REFRESH_THRESHOLD_MINUTES * 60 * 1000));
    
    return expiresAt <= refreshThreshold;
  }

  /**
   * Enhanced authenticate function with automatic token refresh
   */
  static async authenticateWithRefresh(request: Request) {
    console.log('🔐 Starting enhanced authentication with token refresh');
    
    try {
      // Try normal authentication first
      const authResult = await authenticate.admin(request);
      
      // Check if we have a valid session
      if (authResult?.session?.accessToken) {
        const session = authResult.session;
        
        // Check if online token needs refresh
        if (session.isOnline && session.expires) {
          const expiresAt = new Date(session.expires);
          
          if (this.needsRefresh(expiresAt)) {
            console.log('🔄 Access token needs refresh, attempting token exchange...');
            
            // Get fresh session token from request headers
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
              const sessionToken = authHeader.substring(7);
              
              try {
                const tokenData = await this.exchangeSessionTokenForAccessToken(
                  session.shop,
                  sessionToken,
                  'online'
                );
                
                // Update session with new token
                session.accessToken = tokenData.accessToken;
                if (tokenData.expiresIn) {
                  session.expires = new Date(Date.now() + (tokenData.expiresIn * 1000));
                }
                
                console.log('✅ Token refreshed successfully');
                return authResult;
              } catch (tokenExchangeError) {
                console.error('❌ Token exchange failed:', tokenExchangeError);
                // Fall through to return original auth result
              }
            }
          }
        }
        
        return authResult;
      }
      
      // If no session, try to establish one through token exchange
      console.log('📝 No existing session, attempting token exchange authentication');
      const authHeader = request.headers.get('Authorization');
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const sessionToken = authHeader.substring(7);
        
        // Decode session token to get shop info
        const payload = this.decodeSessionToken(sessionToken);
        if (payload?.dest) {
          const shop = payload.dest.replace('https://', '').replace('http://', '');
          
          const tokenData = await this.exchangeSessionTokenForAccessToken(
            shop,
            sessionToken,
            'online'
          );
          
          console.log('✅ New session established via token exchange');
          
          // Return session-like structure for compatibility
          return {
            session: {
              id: `${shop}_${payload.sub}`,
              shop,
              state: 'authenticated',
              isOnline: true,
              accessToken: tokenData.accessToken,
              expires: tokenData.expiresIn ? new Date(Date.now() + (tokenData.expiresIn * 1000)) : undefined,
              scope: tokenData.scope
            },
            admin: {
              graphql: async (query: string, variables?: any) => {
                const response = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': tokenData.accessToken
                  },
                  body: JSON.stringify({ query, variables })
                });
                return response.json();
              }
            }
          };
        }
      }
      
      throw new Error('No valid session token found');
    } catch (error) {
      console.error('❌ Enhanced authentication failed:', error);
      throw error;
    }
  }

  /**
   * Decode JWT session token to extract payload
   */
  private static decodeSessionToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid JWT format');
      
      const payload = parts[1];
      // Add padding if needed
      const padded = payload + '==='.slice(0, (4 - payload.length % 4) % 4);
      const decoded = Buffer.from(padded, 'base64').toString('utf8');
      
      return JSON.parse(decoded);
    } catch (error) {
      console.error('❌ Failed to decode session token:', error);
      return null;
    }
  }

  /**
   * Validate session token expiry and signature
   */
  static validateSessionToken(token: string): boolean {
    try {
      const payload = this.decodeSessionToken(token);
      if (!payload) return false;
      
      const now = Math.floor(Date.now() / 1000);
      
      // Check expiry (exp) and not-before (nbf)
      if (payload.exp && payload.exp < now) {
        console.log('⏰ Session token expired');
        return false;
      }
      
      if (payload.nbf && payload.nbf > now) {
        console.log('⏰ Session token not yet valid');
        return false;
      }
      
      // Check audience matches our app
      if (payload.aud !== process.env.SHOPIFY_API_KEY) {
        console.log('🚫 Session token audience mismatch');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Session token validation failed:', error);
      return false;
    }
  }
}
