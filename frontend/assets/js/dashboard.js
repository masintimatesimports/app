function loadDashboard() {
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
    
    loadDashboardStats();
}


async function loadDashboardStats() {
    const agentId = document.getElementById('agentId').value;
    
    try {
        // 1. Get total unique shipments count - NO AGENT FILTER
        const totalRes = await fetch(`http://127.0.0.1:8000/shipments/total-count`);
        if (totalRes.ok) {
            const data = await totalRes.json();
            document.getElementById('total-shipments').textContent = data.count || 0;
        } else {
            console.error('Failed to get total count:', await totalRes.text());
            document.getElementById('total-shipments').textContent = '--';
        }
        
        // 2. Get pending updates - NO AGENT FILTER
        const pendingRes = await fetch(`http://127.0.0.1:8000/shipments/pending-count`);
        if (pendingRes.ok) {
            const pendingData = await pendingRes.json();
            document.getElementById('pending-updates').textContent = pendingData.count || 0;
        } else {
            document.getElementById('pending-updates').textContent = '--';
        }
        
        // 3. Get Excel files count - STILL WITH AGENT FILTER
        if (agentId) {
            const filesRes = await fetch(`http://127.0.0.1:8000/uploads/count?agent_id=${agentId}`);
            if (filesRes.ok) {
                const filesData = await filesRes.json();
                document.getElementById('excel-files').textContent = filesData.count || 0;
            } else {
                document.getElementById('excel-files').textContent = '--';
            }
        } else {
            document.getElementById('excel-files').textContent = '--';
        }
        
        // 4. Get last upload date - STILL WITH AGENT FILTER
        if (agentId) {
            const lastUploadRes = await fetch(`http://127.0.0.1:8000/uploads/latest?agent_id=${agentId}`);
            if (lastUploadRes.ok) {
                const uploadData = await lastUploadRes.json();
                if (uploadData && uploadData.uploaded_at) {
                    const date = new Date(uploadData.uploaded_at);
                    document.getElementById('last-upload').textContent = 
                        `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                } else {
                    document.getElementById('last-upload').textContent = 'Never';
                }
            } else {
                document.getElementById('last-upload').textContent = '--';
            }
        } else {
            document.getElementById('last-upload').textContent = '--';
        }
        
        // 5. Load recent shipments - WITH AGENT FILTER
        if (agentId) {
            await loadRecentShipments(agentId);
        } else {
            document.getElementById('recent-shipments').innerHTML = 
                '<p style="color:#64748b; text-align:center;">Enter Agent ID to view recent shipments</p>';
        }
        
    } catch (error) {
        console.error('Dashboard error:', error);
        showPlaceholderData();
    }
}

function showPlaceholderData() {
    document.getElementById('total-shipments').textContent = '--';
    document.getElementById('pending-updates').textContent = '--';
    document.getElementById('excel-files').textContent = '--';
    document.getElementById('last-upload').textContent = '--';
}

async function loadRecentShipments(agentId) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/shipments/recent?agent_id=${agentId}&limit=6`);
        const container = document.getElementById('recent-shipments');
        
        if (!response.ok || !response.data) {
            container.innerHTML = '<p style="color:#64748b; text-align:center;">No shipments yet. Upload your first Excel file!</p>';
            return;
        }
        
        const shipments = await response.json();
        
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
        document.getElementById('recent-shipments').innerHTML = 
            '<p style="color:var(--danger); text-align:center;">Error loading recent shipments</p>';
    }
}

function formatDate(dateString) {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return 'N/A';
    const date = new Date(dateTimeString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
}

window.loadDashboard = loadDashboard;