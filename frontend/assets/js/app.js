// frontend/assets/js/app.js
console.log('App initializing...');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting app...');
    setupNavigation();
    loadDashboard();
});

// Navigation - REMOVE ONE OF THESE setupNavigation() FUNCTIONS
function setupNavigation() {
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    // Setup sidebar toggle FIRST
    setupSidebarToggle();
    
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
            const page = e.target.closest('a').getAttribute('href').substring(1);
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
    const pageTitles = {
        'dashboard': 'Dashboard Overview',
        'dashboard-delivered': 'Delivered Dashboard',
        'dashboard-pending': 'Pending Dashboard',
        'upload': 'Upload Excel',
        'tracking': 'Track Shipments',
        'fields': 'Custom Fields',
        'mapping': 'Column Mapping',
        'agents': 'Agent Management'
    };
    
    document.getElementById('page-title').textContent = pageTitles[page] || page;

    // Load page content
    switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'dashboard-delivered': 
            if (typeof loadDeliveredDashboard === 'function') {
                loadDeliveredDashboard();
            } else {
                console.error('Delivered dashboard not loaded');
                document.getElementById('content-area').innerHTML = 'Error: Delivered dashboard not found';
            }
            break;
        case 'dashboard-pending': 
            if (typeof loadPendingDashboard === 'function') {
                loadPendingDashboard();
            } else {
                console.error('Pending dashboard not loaded');
                document.getElementById('content-area').innerHTML = 'Error: Pending dashboard not found';
            }
            break;
        case 'upload': loadUpload(); break;
        case 'mapping': loadMapping(); break;
        case 'tracking': loadTracking(); break;
        case 'fields': loadFields(); break;
        case 'agents': 
            if (typeof loadAgents === 'function') {
                loadAgents();
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

function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    
    if (toggleBtn) {
        const icon = toggleBtn.querySelector('i');
        
        // Check localStorage for saved state
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
            icon.classList.remove('fa-chevron-left');
            icon.classList.add('fa-chevron-right');
        }
        
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            
            // Toggle icon
            if (sidebar.classList.contains('collapsed')) {
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-right');
                localStorage.setItem('sidebarCollapsed', 'true');
            } else {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-left');
                localStorage.setItem('sidebarCollapsed', 'false');
            }
        });
    }
    
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(event) {
            if (window.innerWidth <= 768 && 
                !sidebar.contains(event.target) && 
                !mobileToggle.contains(event.target) &&
                !event.target.closest('.mobile-menu-toggle')) {
                sidebar.classList.add('collapsed');
            }
        });
    }
    
    // Auto-collapse sidebar on mobile after clicking a link
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                sidebar.classList.add('collapsed');
            }
        });
    });
    
    // Handle window resize
    function handleResize() {
        if (window.innerWidth > 768) {
            // On desktop, remove mobile collapsed state
            sidebar.classList.remove('collapsed');
        }
    }
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
}

// Make functions globally available
window.apiCall = apiCall; // For backward compatibility
window.showNotification = showNotification;
window.navigateTo = navigateTo;

console.log('App initialized successfully');