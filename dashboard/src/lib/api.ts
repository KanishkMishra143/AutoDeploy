const isProd = process.env.NODE_ENV === 'production';

// Use the environment variable if it exists (Vercel), otherwise fallback to our primary domain
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.auto-deploy.tech';

export const API_BASE_URL = isProd 
    ? publicApiUrl 
    : 'http://127.0.0.1:8000';

// Automatically convert http(s) to ws(s) for the log streaming
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');
