const isProd = process.env.NODE_ENV === 'production';
export const API_BASE_URL = isProd ? 'https://api.auto-deploy.tech' : 'http://127.0.0.1:8000';
export const WS_BASE_URL = isProd ? 'wss://api.auto-deploy.tech' : 'ws://127.0.0.1:8000';
