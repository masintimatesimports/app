// frontend/assets/js/dashboards/deliveredDashboard.js

async function loadDeliveredDashboard() {
    document.getElementById('content-area').innerHTML = `
        <div class="dashboard">
            <h2><i class="fas fa-check-circle" style="color:#10b981;"></i> Delivered Dashboard</h2>
            
            <!-- Simple Stats -->
            <div style="margin:20px 0;">
                <div class="stat-card" style="border-top-color:#10b981; max-width:300px;">
                    <i class="fas fa-check-circle" style="color:#10b981;"></i>
                    <h3>Total Delivered</h3>
                    <p id="total-delivered">0</p>
                </div>
            </div>
            
            <!-- Last 5 Deliveries -->
            <div style="margin-top:30px;">
                <h3>Last 5 Delivered Shipments</h3>
                <div id="delivered-list" style="margin-top:10px;">
                    <p style="color:#64748b;">Loading...</p>
                </div>
            </div>
        </div>
    `;
    
    await loadDeliveredData();
}

async function loadDeliveredData() {
    try {
        // Get standardized status counts from backend (SAME AS MAIN DASHBOARD)
        const statusData = await Api.shipments.getStandardizedCounts();
        
        if (!statusData) {
            document.getElementById('total-delivered').textContent = '0';
            document.getElementById('delivered-list').innerHTML = '<p style="color:#64748b;">No data found</p>';
            return;
        }
        
        // Get DELIVERED count from backend's standardized counts
        const deliveredCount = statusData.DELIVERED || 0;
        
        // Show count
        document.getElementById('total-delivered').textContent = deliveredCount;
        
        // For last 5 delivered shipments, use search endpoint
        const shipments = await Api.shipments.search('');
        
        if (!Array.isArray(shipments)) {
            document.getElementById('delivered-list').innerHTML = '<p style="color:#64748b;">No shipment details found</p>';
            return;
        }
        
        // Filter for DELIVERED status (match backend logic)
        const deliveredDisplay = shipments.filter(s => 
            s.clearance_status && 
            s.clearance_status.toUpperCase().includes('DELIVERED')
        );
        
        // Show last 5
        const lastFive = deliveredDisplay.slice(0, 5);
        
        let html = '';
        if (lastFive.length === 0) {
            html = '<p style="color:#64748b;">No delivered shipments found</p>';
        } else {
            lastFive.forEach(shipment => {
                html += `
                    <div style="background:white; padding:10px; margin:5px 0; border-radius:5px; border-left:3px solid #10b981;">
                        <strong>${shipment.hbl_number || 'N/A'}</strong> - ${shipment.consignee || 'No consignee'}
                        <br><small>Status: ${shipment.clearance_status || 'Delivered'} | Agent: ${shipment.agent_id || 'N/A'}</small>
                    </div>
                `;
            });
        }
        
        document.getElementById('delivered-list').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading delivered data:', error);
        document.getElementById('delivered-list').innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
    }
}

// Make function available
window.loadDeliveredDashboard = loadDeliveredDashboard;