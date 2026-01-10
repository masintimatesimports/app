const API_BASE = "http://127.0.0.1:8000";

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    loadDashboard();
});

// Navigation
function setupNavigation() {
    // Sidebar links
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.getAttribute('href').substring(1);
            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    // Update active nav item
    document.querySelectorAll('.nav-menu a').forEach(a => {
        a.classList.remove('active');
        if (a.getAttribute('href') === `#${page}`) {
            a.classList.add('active');
        }
    });

    // Update page title
    document.getElementById('page-title').textContent = 
        page.charAt(0).toUpperCase() + page.slice(1);

    // Load page content
    switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'upload': loadUpload(); break;
        case 'mapping': loadMapping(); break;
        case 'tracking': loadTracking(); break;
        case 'fields': loadFields(); break;
        case 'agents': 
    if (typeof loadAgents === 'function') {
        loadAgents();
    } else {
        console.error('loadAgents function not found');
        document.getElementById('content-area').innerHTML = 'Error loading agents page';
    }
    break;
        default: loadDashboard();
    }
}

// API helper
async function apiCall(endpoint, options = {}) {
    const agentId = document.getElementById('agentId').value;
    if (!agentId) {
        alert('Please enter Agent ID first');
        return null;
    }

    const url = `${API_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}agent_id=${agentId}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showNotification(error.message, 'error');
        return null;
    }
}

// Notification system
function showNotification(message, type = 'info') {
    // Simple notification - you can improve this later
    const div = document.createElement('div');
    div.innerHTML = `<div style="position:fixed; top:20px; right:20px; padding:15px; background:${type === 'error' ? '#fee' : '#efe'}; border:1px solid #ccc; border-radius:5px; z-index:1000;">
        ${message} <button onclick="this.parentElement.remove()" style="margin-left:10px;">×</button>
    </div>`;
    document.body.appendChild(div.firstChild);
    setTimeout(() => {
        if (div.firstChild && div.firstChild.parentNode) {
            div.firstChild.remove();
        }
    }, 5000);
}

// Make functions globally available
window.apiCall = apiCall;
window.showNotification = showNotification;
window.navigateTo = navigateTo;