// frontend/assets/js/app.js
console.log('App initializing...');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting app...');
    setupNavigation();
    loadDashboard();
});

// Navigation
function setupNavigation() {
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    // Update topbar with user info
    const welcomeText = document.getElementById('welcome-text');
    const roleIndicator = document.getElementById('role-indicator');
    
    if (welcomeText && user) {
        welcomeText.textContent = `Welcome, ${user.username}`;
    }
    
    if (roleIndicator) {
        roleIndicator.innerHTML = isAdmin ? 
            '<span style="background:#10b981; color:white; padding:4px 8px; border-radius:12px;">Admin</span>' :
            '<span style="background:#3b82f6; color:white; padding:4px 8px; border-radius:12px;">Business</span>';
    }
    
    // Add logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = function() {
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        };
    }
    
    // Business users see limited menu (keep this part)
    if (!isAdmin) {
        const allowedPages = ['dashboard', 'tracking'];
        const navItems = document.querySelectorAll('.nav-menu li');
        
        navItems.forEach(item => {
            const link = item.querySelector('a');
            const page = link.getAttribute('href').substring(1);
            if (!allowedPages.includes(page)) {
                item.style.display = 'none';
            }
        });
    }
    
    // Sidebar links (keep this part)
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

// Legacy API helper (for backward compatibility)
async function apiCall(endpoint, options = {}) {
    const agentId = document.getElementById('agentId').value;
    if (!agentId) {
        Api.showNotification('Please enter Agent ID first', 'error');
        return null;
    }

    const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}agent_id=${agentId}`;
    
    try {
        return await Api.fetchJson(url, options);
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

// Notification system
function showNotification(message, type = 'info') {
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
window.apiCall = apiCall; // For backward compatibility
window.showNotification = showNotification;
window.navigateTo = navigateTo;

console.log('App initialized successfully');