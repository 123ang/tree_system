/**
 * Get the API base URL
 * In production, uses the same origin (relative URLs)
 * In development, uses localhost:3000
 */
export const getApiBaseUrl = (): string => {
  // Check if we're in production (running on a domain, not localhost)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If running on localhost or 127.0.0.1, use localhost:3000 for dev
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000/api';
    }
    
    // In production, use the same origin (relative URLs)
    // This works because Nginx proxies /api to the backend
    return '/api';
  }
  
  // Fallback for SSR or other environments
  return (import.meta.env?.VITE_API_URL as string) || 'http://localhost:3000/api';
};

export const API_BASE_URL = getApiBaseUrl();

