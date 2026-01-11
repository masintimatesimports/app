async function loadDashboard() {
    document.getElementById('content-area').innerHTML = `
        <div class="dashboard">
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
    
    await loadDashboardStats();
}

async function loadDashboardStats() {
    const agentId = Api.getAgentId();
    if (!agentId) {
        showPlaceholderData();
        return;
    }
    
    try {
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
        
    } catch (error) {
        console.error('Dashboard error:', error);
        showPlaceholderData();
        
        // Still try to show recent shipments if agent ID is valid
        if (agentId) {
            try {
                await loadRecentShipments(agentId);
            } catch (shipmentsError) {
                console.error('Recent shipments error:', shipmentsError);
            }
        }
    }
}

function showPlaceholderData() {
    document.getElementById('total-shipments').textContent = '--';
    document.getElementById('pending-updates').textContent = '--';
    document.getElementById('excel-files').textContent = '--';
    document.getElementById('last-upload').textContent = '--';
    
    const container = document.getElementById('recent-shipments');
    if (container) {
        container.innerHTML = 
            '<p style="color:#64748b; text-align:center;">Enter Agent ID to view recent shipments</p>';
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