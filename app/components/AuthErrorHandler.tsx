import React, { useEffect } from 'react';
import { useFetcher } from '@remix-run/react';

interface AuthErrorHandlerProps {
  children: React.ReactNode;
}

/**
 * Component to handle authentication errors and automatic retry
 */
export function AuthErrorHandler({ children }: AuthErrorHandlerProps) {
  const fetcher = useFetcher();

  useEffect(() => {
    // Listen for authentication errors
    const handleAuthError = (event: CustomEvent) => {
      console.log('🚫 Authentication error detected:', event.detail);
      
      // Show user-friendly message
      if (confirm('Your session has expired. Would you like to refresh the page?')) {
        window.location.reload();
      }
    };

    // Listen for CORS errors which might indicate session issues
    const handleCORSError = () => {
      console.log('🌐 CORS error detected, might be session issue');
      // Could indicate session problems
    };

    window.addEventListener('auth-error', handleAuthError as EventListener);
    window.addEventListener('cors-error', handleCORSError);

    return () => {
      window.removeEventListener('auth-error', handleAuthError as EventListener);
      window.removeEventListener('cors-error', handleCORSError);
    };
  }, []);

  return <>{children}</>;
}

/**
 * Hook to handle authentication errors in components
 */
export function useAuthErrorHandler() {
  const handleAuthError = (error: any) => {
    if (error?.status === 401 || error?.status === 302) {
      console.log('🚫 Authentication error in component');
      
      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('auth-error', {
        detail: { error, timestamp: new Date().toISOString() }
      }));
    }
  };

  const retryWithRefresh = async (operation: () => Promise<any>, maxRetries = 2) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.log(`Attempt ${attempt}/${maxRetries} failed:`, error);
        
        if (attempt < maxRetries && (error as any)?.status === 401) {
          console.log('🔄 Retrying after authentication error...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          handleAuthError(error);
          throw error;
        }
      }
    }
  };

  return { handleAuthError, retryWithRefresh };
}
