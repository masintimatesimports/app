function loadTracking() {
    document.getElementById('content-area').innerHTML = `
        <div class="tracking-container">
            <h2><i class="fas fa-search"></i> Track Shipment</h2>
            <p>Search for shipment details by HBL number</p>
            
            <div class="search-box">
                <div class="input-group" style="max-width: 500px;">
                    <label>Enter HBL Number</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="trackHbl" placeholder="e.g., HBL12345" style="flex: 1;">
                        <button class="btn-primary" onclick="trackShipment()">
                            <i class="fas fa-search"></i> Search
                        </button>
                    </div>
                </div>
            </div>
            
            <div id="trackingResults" style="margin-top: 30px;"></div>
        </div>
    `;
}

async function trackShipment() {
    const hbl = document.getElementById('trackHbl').value.trim();
    const agentId = document.getElementById('agentId').value;
    
    if (!agentId) {
        showNotification('Please enter Agent ID first', 'error');
        return;
    }
    
    if (!hbl) {
        showNotification('Please enter HBL number', 'error');
        return;
    }
    
    const results = document.getElementById('trackingResults');
    results.innerHTML = '<div style="padding:20px; text-align:center;">Searching...</div>';
    
    try {
        const url = `http://127.0.0.1:8000/shipments/${encodeURIComponent(hbl)}?agent_id=${agentId}`;
        const res = await fetch(url);
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            results.innerHTML = `
                <div style="text-align:center; padding:40px; background:#f8fafc; border-radius:8px;">
                    <i class="fas fa-box-open fa-3x" style="color:#64748b;"></i>
                    <h3>No shipment found</h3>
                    <p>No shipment found with HBL: ${hbl}</p>
                </div>
            `;
            return;
        }
        
        const shipment = data[0];
        const status = shipment.clearance_status || 'Pending';
        
        results.innerHTML = `
            <div style="background:white; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08);">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin:0; font-size:1.5em;">${shipment.hbl_number || 'N/A'}</h3>
                    <span style="padding:8px 16px; border-radius:20px; font-weight:600; background:rgba(255,255,255,0.2);">
                        ${status}
                    </span>
                </div>
                
                <div style="padding: 25px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; margin-bottom: 25px;">
                        <div>
                            <label style="font-weight:600; color:#64748b; font-size:0.9em;">MBL Number:</label>
                            <div style="color:#1e293b; font-size:1.1em;">${shipment.mbl_number || 'N/A'}</div>
                        </div>
                        <div>
                            <label style="font-weight:600; color:#64748b; font-size:0.9em;">PO Number:</label>
                            <div style="color:#1e293b; font-size:1.1em;">${shipment.po_number || 'N/A'}</div>
                        </div>
                        <div>
                            <label style="font-weight:600; color:#64748b; font-size:0.9em;">Consignee:</label>
                            <div style="color:#1e293b; font-size:1.1em;">${shipment.consignee || 'N/A'}</div>
                        </div>
                        <div>
                            <label style="font-weight:600; color:#64748b; font-size:0.9em;">ETA:</label>
                            <div style="color:#1e293b; font-size:1.1em;">${formatDate(shipment.eta) || 'N/A'}</div>
                        </div>
                        <div>
                            <label style="font-weight:600; color:#64748b; font-size:0.9em;">Vessel:</label>
                            <div style="color:#1e293b; font-size:1.1em;">${shipment.vessel_name || 'N/A'}</div>
                        </div>
                        <div>
                            <label style="font-weight:600; color:#64748b; font-size:0.9em;">Voyage:</label>
                            <div style="color:#1e293b; font-size:1.1em;">${shipment.voyage_no || 'N/A'}</div>
                        </div>
                    </div>
                    
                    <div>
                        <button class="btn-secondary" onclick="updateStatusPrompt('${shipment.hbl_number}')">
                            <i class="fas fa-edit"></i> Update Status
                        </button>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error:', error);
        results.innerHTML = `
            <div style="text-align:center; padding:40px; background:#fee2e2; border-radius:8px; color:#dc2626;">
                <i class="fas fa-exclamation-circle fa-3x"></i>
                <h3>Error loading shipment</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function updateStatusPrompt(hbl) {
    const newStatus = prompt('Enter new clearance status:', 'Cleared');
    if (newStatus) {
        updateStatus(hbl, newStatus);
    }
}

async function updateStatus(hbl, status) {
    const agentId = document.getElementById('agentId').value;
    
    try {
        const res = await fetch(
            `http://127.0.0.1:8000/shipments/${hbl}/status?agent_id=${agentId}&status=${status}`,
            { method: "PATCH" }
        );

        const data = await res.json();
        showNotification(data.updated ? "✅ Status updated" : "❌ Update failed");
        
        // Refresh if tracking the same HBL
        if (document.getElementById('trackHbl')?.value === hbl) {
            trackShipment();
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
}

// Make functions globally available
window.loadTracking = loadTracking;
window.trackShipment = trackShipment;
window.updateStatusPrompt = updateStatusPrompt;