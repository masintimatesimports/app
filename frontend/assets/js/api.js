// frontend/assets/js/api.js
console.log('Initializing API Service...');

class ApiService {
    constructor() {
        this.baseUrl = window.AppConfig.API_BASE;
        console.log('API Base URL:', this.baseUrl);
    }

    // Generic fetch helper
    async fetchJson(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        console.log(`API Request: ${options.method || 'GET'} ${url}`);
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch (e) {
                    // Could not parse JSON error response
                }
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            this.showNotification(error.message, 'error');
            throw error;
        }
    }

    // Generic fetch helper for FormData (for file uploads)
    async fetchFormData(endpoint, formData) {
        const url = `${this.baseUrl}${endpoint}`;
        
        console.log(`API Request: POST ${url} (FormData)`);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch (e) {
                    // Could not parse JSON error response
                }
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            this.showNotification(error.message, 'error');
            throw error;
        }
    }

    // Shipments API
    // Shipments API
    shipments = {
        getTotalCount: () => this.fetchJson('/shipments/total-count'),
        getPendingCount: () => this.fetchJson('/shipments/pending-count'),
        getRecent: (agentId, limit = 6) => 
            this.fetchJson(`/shipments/recent?agent_id=${agentId}&limit=${limit}`),
        
        // Updated: Can be called with or without agentId
        getByHbl: (hbl, agentId = null) => {
            let url = `/shipments/search?hbl=${encodeURIComponent(hbl)}`;
            if (agentId) {
                url += `&agent_id=${agentId}`;
            }
            return this.fetchJson(url);
        },
        
        // New: Generic search method
        search: (hbl, agentId = null) => {
            let url = `/shipments/search?hbl=${encodeURIComponent(hbl)}`;
            if (agentId) {
                url += `&agent_id=${agentId}`;
            }
            return this.fetchJson(url);
        },
        
        updateStatus: (hbl, agentId, status) =>
            this.fetchJson(`/shipments/${hbl}/status?agent_id=${agentId}&status=${status}`, {
                method: 'PATCH'
            }),
        
        // Legacy: Kept for backward compatibility
        searchByHbl: (hbl, agentId) => 
            this.fetchJson(`/shipments/search?hbl=${encodeURIComponent(hbl)}&agent_id=${agentId}`)
    };

    // Agents API
    agents = {
        getAll: (active = true) => this.fetchJson(`/agents/?active=${active}`),
        getById: (id) => this.fetchJson(`/agents/${id}`),
        create: (data) => this.fetchJson('/agents/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        update: (id, data) => this.fetchJson(`/agents/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
        
        // Categories
        getRoles: () => this.fetchJson('/agents/roles/'),
        createRole: (data) => this.fetchJson('/agents/roles/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        updateRole: (id, data) => this.fetchJson(`/agents/roles/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
        
        getModes: () => this.fetchJson('/agents/modes/'),
        createMode: (data) => this.fetchJson('/agents/modes/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        updateMode: (id, data) => this.fetchJson(`/agents/modes/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
        
        getSpecializations: () => this.fetchJson('/agents/specializations/'),
        createSpecialization: (data) => this.fetchJson('/agents/specializations/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        updateSpecialization: (id, data) => this.fetchJson(`/agents/specializations/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
        getDropdownList: () => this.fetchJson('/agents/dropdown-list'),
        
        // Status management
        updateStatus: (agentId, active) => 
            this.fetchJson(`/agents/${agentId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ active })
            })
    };

    // Uploads API
    uploads = {
        excel: (formData) => this.fetchFormData('/uploads/excel', formData),
        getCount: (agentId) => this.fetchJson(`/uploads/count?agent_id=${agentId}`),
        getLatest: (agentId) => this.fetchJson(`/uploads/latest?agent_id=${agentId}`)
    };

    // Mappings API
    mappings = {
        getAll: (agentId) => this.fetchJson(`/mappings/all?agent_id=${agentId}`),
        getForSheet: (agentId, sheetName) => 
            this.fetchJson(`/mappings/?agent_id=${agentId}&sheet_name=${encodeURIComponent(sheetName)}`),
        save: (agentId, sheetName, mappings) => 
            this.fetchJson('/mappings/', {
                method: 'POST',
                body: JSON.stringify({
                    agent_id: agentId,
                    sheet_name: sheetName,
                    mappings: mappings
                })
            }),
        delete: (agentId, sheetName) => 
            this.fetchJson(`/mappings/${agentId}/${encodeURIComponent(sheetName)}`, {
                method: 'DELETE'
            }),
        deleteMapping: (agentId, sheetName, columnName) =>
            this.fetchJson(`/mappings/${agentId}/${encodeURIComponent(sheetName)}/${encodeURIComponent(columnName)}`, {
                method: 'DELETE'
            })
    };

    // Fields API
    fields = {
        getAll: () => this.fetchJson('/fields/'),
        create: (data) => this.fetchJson('/fields/', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        update: (id, data) => this.fetchJson(`/fields/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
        delete: (id) => this.fetchJson(`/fields/${id}`, {
            method: 'DELETE'
        })
    };

    // Helper: Get current agent ID (enhanced version)
    // In api.js, update the getAgentId() method:
    getAgentId() {
        // Try multiple possible element IDs
        const agentIdElements = [
            document.getElementById('uploadAgentSelect'),  // Admin upload dropdown
            document.getElementById('uploadAgentId'),      // Regular upload input
            document.getElementById('trackAgentSelect'),   // Tracking page dropdown
            document.getElementById('agentId'),            // Main sidebar input
            document.getElementById('mapAgentId')          // Mapping page input
        ];
        
        let agentId = null;
        let element = null;
        
        for (const el of agentIdElements) {
            if (el && el.value) {
                agentId = el.value;
                element = el;
                break;
            }
        }
        
        if (!agentId) {
            this.showNotification('Please select/enter Agent ID first', 'error');
            // Focus on the first available agent input
            const firstAgentInput = agentIdElements.find(el => el);
            if (firstAgentInput) {
                firstAgentInput.focus();
            }
            throw new Error('Agent ID is required');
        }
        
        const parsedId = parseInt(agentId);
        if (isNaN(parsedId) || parsedId <= 0) {
            this.showNotification('Agent ID must be a positive number', 'error');
            if (element) {
                element.focus();
                element.select();
            }
            throw new Error('Invalid Agent ID');
        }
        
        return parsedId;
    }

    // Helper: Show notification (enhanced)
    showNotification(message, type = 'info') {
        // Remove any existing notifications first
        const existingNotifications = document.querySelectorAll('.api-notification');
        existingNotifications.forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
        
        // Use existing showNotification function if available
        if (window.showNotification && window.showNotification !== this.showNotification) {
            window.showNotification(message, type);
            return;
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `api-notification notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            background: ${type === 'error' ? '#fef2f2' : 
                        type === 'success' ? '#f0fdf4' : 
                        type === 'warning' ? '#fffbeb' : '#eff6ff'};
            color: ${type === 'error' ? '#991b1b' : 
                    type === 'success' ? '#065f46' : 
                    type === 'warning' ? '#92400e' : '#1e40af'};
            border: 1px solid ${type === 'error' ? '#fecaca' : 
                            type === 'success' ? '#bbf7d0' : 
                            type === 'warning' ? '#fde68a' : '#dbeafe'};
            border-left: 4px solid ${type === 'error' ? '#ef4444' : 
                                type === 'success' ? '#10b981' : 
                                type === 'warning' ? '#f59e0b' : '#3b82f6'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-width: 300px;
            max-width: 500px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 
                              type === 'success' ? 'fa-check-circle' : 
                              type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; font-size: 1.2em; cursor: pointer; color: inherit; opacity: 0.7;">×</button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Add CSS animation if not already present
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Helper: Make API call with automatic agent ID injection
    async callWithAgent(endpoint, options = {}) {
        try {
            const agentId = this.getAgentId();
            const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}agent_id=${agentId}`;
            return await this.fetchJson(url, options);
        } catch (error) {
            // Error already handled by getAgentId or fetchJson
            throw error;
        }
    }

    // Helper: Validate response data
    validateResponse(data, expectedFields = []) {
        if (!data) {
            throw new Error('No data received from server');
        }
        
        if (expectedFields.length > 0) {
            const missingFields = expectedFields.filter(field => !(field in data));
            if (missingFields.length > 0) {
                console.warn(`Missing fields in response: ${missingFields.join(', ')}`);
            }
        }
        
        return data;
    }

    // Helper: Debounce function for search inputs
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Helper: Format error message
    formatError(error) {
        if (error.message.includes('Failed to fetch')) {
            return 'Unable to connect to server. Please check your internet connection.';
        }
        if (error.message.includes('NetworkError')) {
            return 'Network error occurred. Please try again.';
        }
        if (error.message.includes('timeout')) {
            return 'Request timeout. Server is taking too long to respond.';
        }
        return error.message;
    }
}

// Create global instance
window.Api = new ApiService();
console.log('API Service ready!');

// Add global error handler for unhandled promises
window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.message) {
        console.error('Unhandled promise rejection:', event.reason);
        // Optionally show notification for unexpected errors
        // Api.showNotification('An unexpected error occurred', 'error');
    }
});

// Add global fetch error handler
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    try {
        return await originalFetch.apply(this, args);
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
};