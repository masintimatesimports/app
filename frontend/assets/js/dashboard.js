async function loadDashboard() {
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    // Add role indicator to dashboard
    const roleBadge = isAdmin ? 
        '<span style="background:#10b981; color:white; padding:4px 8px; border-radius:4px; font-size:0.8em; margin-left:10px;">Admin</span>' :
        '<span style="background:#3b82f6; color:white; padding:4px 8px; border-radius:4px; font-size:0.8em; margin-left:10px;">Business</span>';

    document.getElementById('content-area').innerHTML = `
        <div class="dashboard">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2>Dashboard ${roleBadge}</h2>
                ${isAdmin ? `
                <div style="display:flex; align-items:center; gap:10px;">
                    <label style="font-weight:500;">Select Agent:</label>
                    <select id="dashboardAgentSelect" style="padding:8px 12px; border:1px solid #ddd; border-radius:6px; min-width:200px;">
                        <option value="">Loading agents...</option>
                    </select>
                </div>
                ` : ''}
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <i class="fas fa-box"></i>
                    <h3>Total Shipments</h3>
                    <p id="total-shipments">0</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-clock"></i>
                    <h3>Pending Updates</h3>
                    <p id="pending-updates">0</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-file-excel"></i>
                    <h3>Excel Files</h3>
                    <p id="excel-files">0</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-calendar"></i>
                    <h3>Last Upload</h3>
                    <p id="last-upload">Never</p>
                </div>
            </div>
            <div class="quick-actions">
                <button class="action-btn" onclick="navigateTo('upload')">
                    <i class="fas fa-upload"></i> Upload Excel
                </button>
                <button class="action-btn" onclick="navigateTo('tracking')">
                    <i class="fas fa-search"></i> Track Shipment
                </button>
                <button class="action-btn" onclick="navigateTo('mapping')">
                    <i class="fas fa-columns"></i> Manage Mappings
                </button>
            </div>
            
            <div style="margin-top: 40px;">
                <h3>Recent Shipments</h3>
                <div id="recent-shipments" style="background:#f8fafc; padding:15px; border-radius:8px; min-height:150px;">
                    <div style="text-align:center; padding:20px; color:#64748b;">
                        <i class="fas fa-sync fa-spin"></i> Loading recent shipments...
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Load agents dropdown for admin
    if (isAdmin) {
        await loadAgentDropdown();
    }
    

    
    await loadDashboardStats();
}

async function loadAgentDropdown() {
    try {
        // Get agents list
        const agents = await Api.agents.getAll();
        
        const select = document.getElementById('dashboardAgentSelect');
        if (!select) return;
        
        // Clear and populate dropdown
        select.innerHTML = '<option value="">-- Select Agent --</option>';
        
        agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.agent_id;
            option.textContent = `${agent.agent_name} (${agent.agent_code})`;
            select.appendChild(option);
        });
        
        // Add change listener to refresh stats
        select.addEventListener('change', async () => {
            await loadDashboardStats();
        });
        
        // Auto-select first agent
        if (agents.length > 0) {
            select.value = agents[0].agent_id;
        }
        
    } catch (error) {
        console.error('Error loading agents dropdown:', error);
        const select = document.getElementById('dashboardAgentSelect');
        if (select) {
            select.innerHTML = '<option value="">Error loading agents</option>';
        }
    }
}

async function loadDashboardStats() {
    let agentId;
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    if (isAdmin) {
        // Get selected agent from dropdown
        const select = document.getElementById('dashboardAgentSelect');
        if (!select || !select.value) {
            showPlaceholderData('Please select an agent');
            return;
        }
        agentId = parseInt(select.value);
    } else {
        // Business user always uses Agent ID 1
        agentId = 1;
    }
    
    if (!agentId) {
        showPlaceholderData('Agent ID required');
        return;
    }
    
    try {
        // Update API.js to get agent ID from dashboard dropdown
        // Temporary override for dashboard
        const originalGetAgentId = Api.getAgentId;
        Api.getAgentId = () => agentId;
        
        // 1. Get total unique shipments count
        const totalData = await Api.shipments.getTotalCount();
        document.getElementById('total-shipments').textContent = totalData.count || 0;
        
        // 2. Get pending updates count
        const pendingData = await Api.shipments.getPendingCount();
        document.getElementById('pending-updates').textContent = pendingData.count || 0;
        
        // 3. Get Excel files count
        const filesData = await Api.uploads.getCount(agentId);
        document.getElementById('excel-files').textContent = filesData.count || 0;
        
        // 4. Get last upload date
        const uploadData = await Api.uploads.getLatest(agentId);
        if (uploadData && uploadData.uploaded_at) {
            const date = new Date(uploadData.uploaded_at);
            document.getElementById('last-upload').textContent = 
                `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else {
            document.getElementById('last-upload').textContent = 'Never';
        }
        
        // 5. Load recent shipments
        await loadRecentShipments(agentId);
        
        // Restore original function
        Api.getAgentId = originalGetAgentId;
        
    } catch (error) {
        console.error('Dashboard error:', error);
        showPlaceholderData(error.message);
    }
}

function showPlaceholderData(message = 'Select agent to view data') {
    document.getElementById('total-shipments').textContent = '--';
    document.getElementById('pending-updates').textContent = '--';
    document.getElementById('excel-files').textContent = '--';
    document.getElementById('last-upload').textContent = '--';
    
    const container = document.getElementById('recent-shipments');
    if (container) {
        container.innerHTML = 
            `<p style="color:#64748b; text-align:center;">${message}</p>`;
    }
}

async function loadRecentShipments(agentId) {
    const container = document.getElementById('recent-shipments');
    
    try {
        const shipments = await Api.shipments.getRecent(agentId, 6);
        
        if (!shipments || shipments.length === 0) {
            container.innerHTML = '<p style="color:#64748b; text-align:center;">No shipments yet. Upload your first Excel file!</p>';
            return;
        }
        
        let html = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:15px;">';
        
        shipments.forEach(shipment => {
            const status = shipment.clearance_status || 'Pending';
            const statusClass = status === 'Cleared' ? 'success' : 
                              status === 'Pending' ? 'warning' : 'secondary';
            
            html += `
                <div style="background:white; padding:15px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
                        <div>
                            <div style="font-weight:600; font-size:1.1em;">${shipment.hbl_number || 'N/A'}</div>
                            <div style="font-size:0.9em; color:#64748b; margin-top:5px;">
                                ${shipment.consignee || 'No consignee'}
                            </div>
                        </div>
                        <span class="badge badge-${statusClass}" style="font-size:0.8em;">
                            ${status}
                        </span>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.85em;">
                        <div>
                            <div style="color:#64748b;">PO Number</div>
                            <div style="font-weight:500;">${shipment.po_number || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="color:#64748b;">ETA</div>
                            <div style="font-weight:500;">${formatDate(shipment.eta) || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="color:#64748b;">Vessel</div>
                            <div style="font-weight:500;">${shipment.vessel_name || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="color:#64748b;">Updated</div>
                            <div style="font-weight:500;">${formatDateTime(shipment.last_excel_upload_at)}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading recent shipments:', error);
        container.innerHTML = 
            '<p style="color:var(--danger); text-align:center;">Error loading recent shipments: ' + error.message + '</p>';
    }
}

function formatDate(dateString) {
    if (!dateString) return null;
    try {
        return new Date(dateString).toLocaleDateString();
    } catch (e) {
        return dateString;
    }
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return 'N/A';
    try {
        const date = new Date(dateTimeString);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    } catch (e) {
        return dateTimeString;
    }
}

// Make function globally available
window.loadDashboard = loadDashboard;