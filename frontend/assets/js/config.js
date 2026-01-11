// frontend/assets/js/config.js
console.log('Loading configuration...');

// Environment detection
const isDevelopment = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';

// API Configuration
const API_BASE = isDevelopment 
    ? 'http://127.0.0.1:8000'  // Local development
    : 'https://web-production-21853.up.railway.app';  // Production

console.log(`Environment: ${isDevelopment ? 'Development' : 'Production'}`);
console.log(`API Base URL: ${API_BASE}`);

// Export configuration
window.AppConfig = {
    API_BASE: API_BASE,
    IS_DEVELOPMENT: isDevelopment,
    APP_NAME: 'ShipTrack',
    VERSION: '1.0.0'
};