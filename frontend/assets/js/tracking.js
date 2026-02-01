async function loadTracking() {
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    document.getElementById('content-area').innerHTML = `
        <div class="tracking-container">
            <h2><i class="fas fa-search"></i> Track Shipment</h2>
            
            ${isAdmin ? `
            <div class="input-group" style="margin-bottom:20px;">
                <label>Search in Agent (Optional):</label>
                <select id="trackAgentSelect" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                    <option value="">-- All Agents --</option>
                </select>
            </div>
            ` : ''}
            
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
    
    if (isAdmin) {
        await loadAgentsForTracking();
    }
}

async function loadAgentsForTracking() {
    try {
        const agents = await Api.agents.getAll();
        const select = document.getElementById('trackAgentSelect');
        if (select && agents.length > 0) {
            select.innerHTML = `
                <option value="">-- All Agents --</option>
                ${agents.map(agent => `
                    <option value="${agent.agent_id}">${agent.agent_name} (${agent.agent_code})</option>
                `).join('')}
            `;
        }
    } catch (error) {
        console.error('Error loading agents for tracking:', error);
    }
}

async function trackShipment() {
    const hbl = document.getElementById('trackHbl').value.trim();
    
    if (!hbl) {
        Api.showNotification('Please enter HBL number', 'error');
        return;
    }
    
    const results = document.getElementById('trackingResults');
    results.innerHTML = '<div style="padding:20px; text-align:center;">Searching...</div>';
    
    try {
        // Get user info
        const user = JSON.parse(localStorage.getItem('user'));
        const isAdmin = user && user.role === 'admin';
        
        let data;
        
        if (isAdmin) {
            // Admin can search across all agents or filter by selected agent
            const agentSelect = document.getElementById('trackAgentSelect');
            const agentId = agentSelect?.value || null;
            
            // Use the new search endpoint
            if (agentId) {
                // Search in specific agent
                data = await Api.fetchJson(`/shipments/search?hbl=${encodeURIComponent(hbl)}&agent_id=${agentId}`);
            } else {
                // Search across all agents
                data = await Api.fetchJson(`/shipments/search?hbl=${encodeURIComponent(hbl)}`);
            }
        } else {
            // Regular user - get their agent ID and search within it
            const agentId = Api.getAgentId();
            if (!agentId) {
                results.innerHTML = '<div style="color:var(--danger); text-align:center;">Please set Agent ID first</div>';
                return;
            }
            
            // Search in their agent only
            data = await Api.fetchJson(`/shipments/search?hbl=${encodeURIComponent(hbl)}&agent_id=${agentId}`);
        }
        
        // Display results
        if (!Array.isArray(data) || data.length === 0) {
            results.innerHTML = `
                <div style="text-align:center; padding:40px; background:#f8fafc; border-radius:8px;">
                    <i class="fas fa-box-open fa-3x" style="color:#64748b;"></i>
                    <h3>No shipment found</h3>
                    <p>No shipment found with HBL: ${hbl}</p>
                    ${isAdmin ? '<p style="font-size:0.9em; color:#64748b;">Try selecting a specific agent or check the HBL number</p>' : ''}
                </div>
            `;
            return;
        }
        
        renderDynamicSearchTable(data);

        // Display multiple results if admin searched across all agents
        if (isAdmin && data.length > 1) {
            displayMultipleShipments(data);
        } else {
            // Single result
            displaySingleShipment(data[0]);
        }
        
    } catch (error) {
        console.error('Error:', error);
        results.innerHTML = `
            <div style="text-align:center; padding:40px; background:#fee2e2; border-radius:88px; color:#dc2626;">
                <i class="fas fa-exclamation-circle fa-3x"></i>
                <h3>Error loading shipment</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function displaySingleShipment(shipment) {
    const status = shipment.clearance_status || 'Pending';
    const agentName = shipment.agent_name || `Agent ${shipment.agent_id}`;
    
    document.getElementById('trackingResults').innerHTML = `
        <div style="background:white; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08); margin-bottom:20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin:0; font-size:1.5em;">${shipment.hbl_number || 'N/A'}</h3>
                        <div style="opacity:0.9; font-size:0.9em; margin-top:5px;">
                            Agent: ${agentName}
                        </div>
                    </div>
                    <span style="padding:8px 16px; border-radius:20px; font-weight:600; background:rgba(255,255,255,0.2);">
                        ${status}
                    </span>
                </div>
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
                        <label style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:600; color:#64748b; font-size:0.9em;">Voyage:</span>
                            <button class="btn-secondary" onclick="updateStatusPrompt('${shipment.hbl_number}', ${shipment.agent_id})" style="padding:4px 8px; font-size:0.8em;">
                                <i class="fas fa-edit"></i> Update Status
                            </button>
                        </label>
                        <div style="color:#1e293b; font-size:1.1em;">${shipment.voyage_no || 'N/A'}</div>
                    </div>
                </div>
                
                <!-- ADD TABLE VIEW HERE -->
                <div id="detailTableView"></div>
            </div>
        </div>
    `;
    
    // Now render the table for this single shipment
    renderDynamicSearchTable([shipment]);
}

function displayMultipleShipments(shipments) {
    let html = `
        <div style="background:white; border-radius:8px; padding:20px;">
            <h3>Found ${shipments.length} shipments with HBL: ${document.getElementById('trackHbl').value}</h3>
            <div style="margin-top:20px; display:grid; gap:15px;">
    `;
    
    shipments.forEach(shipment => {
        const status = shipment.clearance_status || 'Pending';
        const agentName = shipment.agent_name || `Agent ${shipment.agent_id}`;
        
        html += `
            <div style="border:1px solid #e2e8f0; border-radius:8px; padding:15px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div>
                        <strong style="font-size:1.1em;">${shipment.hbl_number}</strong>
                        <div style="color:#64748b; font-size:0.9em;">Agent: ${agentName}</div>
                    </div>
                    <span style="padding:4px 12px; border-radius:12px; background:${status === 'Cleared' ? '#d1fae5' : '#fef3c7'}; color:${status === 'Cleared' ? '#065f46' : '#92400e'}; font-size:0.9em;">
                        ${status}
                    </span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; font-size:0.9em;">
                    <div>
                        <div style="color:#64748b;">PO:</div>
                        <div>${shipment.po_number || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="color:#64748b;">Consignee:</div>
                        <div>${shipment.consignee || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="color:#64748b;">ETA:</div>
                        <div>${formatDate(shipment.eta) || 'N/A'}</div>
                    </div>
                    <div style="text-align:right;">
                        <button class="btn-secondary" onclick="selectShipmentForView(${shipment.agent_id}, '${shipment.hbl_number}')" style="padding:6px 12px; font-size:0.9em;">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    document.getElementById('trackingResults').innerHTML = html;
}

function selectShipmentForView(agentId, hbl) {
    // Set the agent ID if it's not already set
    const agentIdInput = document.getElementById('agentId');
    if (agentIdInput) {
        agentIdInput.value = agentId;
    }
    
    // Search for this specific shipment
    document.getElementById('trackHbl').value = hbl;
    trackShipment();
}

function updateStatusPrompt(hbl, agentId = null) {
    const newStatus = prompt('Enter new clearance status:', 'Cleared');
    if (newStatus) {
        updateStatus(hbl, newStatus, agentId);
    }
}

async function updateStatus(hbl, status, agentId = null) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const isAdmin = user && user.role === 'admin';
        
        let targetAgentId = agentId;
        
        if (!targetAgentId && isAdmin) {
            // For admin updating from single view, need agent ID
            const agentSelect = document.getElementById('trackAgentSelect');
            targetAgentId = agentSelect?.value || Api.getAgentId();
        } else if (!targetAgentId) {
            targetAgentId = Api.getAgentId();
        }
        
        if (!targetAgentId) {
            Api.showNotification('Agent ID is required to update status', 'error');
            return;
        }
        
        const data = await Api.shipments.updateStatus(hbl, targetAgentId, status);
        
        Api.showNotification(data.updated ? "✅ Status updated" : "❌ Update failed");
        
        // Refresh if tracking the same HBL
        if (document.getElementById('trackHbl')?.value === hbl) {
            trackShipment();
        }
    } catch (error) {
        Api.showNotification(`Error: ${error.message}`, 'error');
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString();
    } catch (e) {
        return dateString;
    }
}


function renderDynamicSearchTable(data) {
    const rows = Array.isArray(data) ? data : [data];
    if (!rows.length) return;

    const columns = new Set();
    rows.forEach(obj => {
        Object.keys(obj || {}).forEach(k => columns.add(k));
    });

    const colList = [...columns];
    const targetId = rows.length === 1 ? 'detailTableView' : 'trackingResults';
    
    let html = `
        <div style="margin-top:20px; padding-top:20px; border-top:1px solid #e2e8f0;">
            <h4 style="margin:0 0 10px 0; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-table"></i> Complete Data Table
            </h4>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.9em; border:1px solid #e2e8f0;">
                    <thead>
                        <tr style="background:#f8fafc;">
    `;

    colList.forEach(col => {
        const displayName = col.replace(/_/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());
        html += `<th style="padding:8px 10px; text-align:left; border:1px solid #e2e8f0;">${displayName}</th>`;
    });

    html += `</tr></thead><tbody>`;

    rows.forEach((row, index) => {
        html += `<tr style="${index % 2 === 0 ? 'background:#fafafa;' : ''}">`;

        colList.forEach(col => {
            let val = row[col];

            if (val === null || val === undefined) {
                val = '<span style="color:#94a3b8; font-style:italic;">—</span>';
            } else if (typeof val === 'string') {
                if (col.toLowerCase().includes('date')) {
                    val = formatDate(val) || val;
                }
            }

            html += `<td style="padding:8px 10px; border:1px solid #e2e8f0; vertical-align:top;">${val}</td>`;
        });

        html += `</tr>`;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    const targetDiv = document.getElementById(targetId);
    if (targetDiv) {
        if (rows.length === 1) {
            targetDiv.innerHTML = html;
        } else {
            // For multiple results, replace the entire content
            document.getElementById('trackingResults').innerHTML = html;
        }
    }
}


// Make functions globally available
window.loadTracking = loadTracking;
window.trackShipment = trackShipment;
window.updateStatusPrompt = updateStatusPrompt;
window.selectShipmentForView = selectShipmentForView;