async function loadPendingDashboard() {
    document.getElementById('content-area').innerHTML = `
        <div class="dashboard">
            <h2><i class="fas fa-clock" style="color:#f59e0b;"></i> Pending Dashboard</h2>
            
            <!-- Stats Row -->
            <div style="display: flex; gap: 15px; margin: 20px 0; flex-wrap: wrap;">
                <div class="stat-card" style="border-top-color:#f59e0b;">
                    <i class="fas fa-clock" style="color:#f59e0b;"></i>
                    <h3>Total Pending</h3>
                    <p id="total-pending">0</p>
                </div>
                <div class="stat-card" style="border-top-color:#3b82f6;">
                    <i class="fas fa-ship" style="color:#3b82f6;"></i>
                    <h3>Active Vessels</h3>
                    <p id="active-vessels">0</p>
                </div>
            </div>
            
            <!-- Vessel Cards -->
            <div style="margin-top: 30px;">
                <h3><i class="fas fa-ship"></i> Vessel Overview</h3>
                <div id="vessel-cards" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; margin-top: 15px;">
                    <div style="text-align: center; padding: 30px; color: #64748b;">
                        <i class="fas fa-spinner fa-spin fa-2x"></i>
                        <p style="margin-top: 10px;">Loading vessel data...</p>
                    </div>
                </div>
            </div>
            
            <!-- Legend -->
            <div style="margin-top: 20px; padding: 10px; background: #f8fafc; border-radius: 6px; font-size: 12px;">
                <div style="display: flex; gap: 15px; align-items: center;">
                    <span><span style="display: inline-block; width: 10px; height: 10px; background: #ef4444; border-radius: 50%; margin-right: 5px;"></span> Overdue</span>
                    <span><span style="display: inline-block; width: 10px; height: 10px; background: #f59e0b; border-radius: 50%; margin-right: 5px;"></span> High (≤2 days)</span>
                    <span><span style="display: inline-block; width: 10px; height: 10px; background: #3b82f6; border-radius: 50%; margin-right: 5px;"></span> Medium (≤5 days)</span>
                    <span><span style="display: inline-block; width: 10px; height: 10px; background: #10b981; border-radius: 50%; margin-right: 5px;"></span> Normal</span>
                </div>
            </div>
        </div>
    `;
    
    await loadVesselData();
}

async function loadVesselData() {
    try {
        const [statusData, vesselData] = await Promise.all([
            Api.shipments.getStandardizedCounts(),
            Api.shipments.getVesselSummary()
        ]);
        
        // Update total pending
        let totalPending = 0;
        if (statusData) {
            Object.entries(statusData).forEach(([status, count]) => {
                if (status !== 'DELIVERED' && status !== 'CLEARED') {
                    totalPending += count;
                }
            });
        }
        document.getElementById('total-pending').textContent = totalPending;
        
        // Update vessel cards
        if (Array.isArray(vesselData)) {
            const uniqueVessels = new Set(vesselData.map(v => v.vessel)).size;
            document.getElementById('active-vessels').textContent = uniqueVessels;
            
            let cardsHtml = '';
            if (vesselData.length === 0) {
                cardsHtml = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">No vessel data available</div>';
            } else {
                vesselData.forEach(item => {
                    // Determine card color based on criticality
                    let cardColor, textColor, daysText;
                    
                    if (item.days_until_eta < 0) {
                        cardColor = '#fee2e2';
                        textColor = '#b91c1c';
                        daysText = `${Math.abs(item.days_until_eta)} days overdue`;
                    } else if (item.days_until_eta <= 2) {
                        cardColor = '#fef3c7';
                        textColor = '#92400e';
                        daysText = `${item.days_until_eta} days to ETA`;
                    } else if (item.days_until_eta <= 5) {
                        cardColor = '#dbeafe';
                        textColor = '#1e40af';
                        daysText = `${item.days_until_eta} days to ETA`;
                    } else {
                        cardColor = '#d1fae5';
                        textColor = '#065f46';
                        daysText = `${item.days_until_eta} days to ETA`;
                    }
                    
                    cardsHtml += `
                        <div class="vessel-card" 
                             style="background: ${cardColor}; padding: 15px; border-radius: 8px; cursor: pointer;"
                             onclick="showVesselDetails('${item.vessel}', '${item.voyage}')"
                             title="Click for details">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div>
                                    <div style="font-weight: 600; font-size: 16px; color: ${textColor};">
                                        ${item.vessel}
                                    </div>
                                    <div style="font-size: 13px; color: #64748b; margin-top: 3px;">
                                        Voyage: ${item.voyage}
                                    </div>
                                </div>
                                <div style="background: white; padding: 4px 10px; border-radius: 12px; font-size: 14px; font-weight: 600; color: ${textColor};">
                                    ${item.bl_count} BLs
                                </div>
                            </div>
                            
                            <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 13px; color: #64748b;">
                                        <i class="fas fa-calendar"></i> ETA: ${item.eta}
                                    </div>
                                    <div style="font-size: 13px; color: ${textColor}; font-weight: 500; margin-top: 3px;">
                                        <i class="fas fa-clock"></i> ${daysText}
                                    </div>
                                </div>
                                <div style="font-size: 11px; padding: 3px 8px; background: ${textColor}20; color: ${textColor}; border-radius: 10px;">
                                    ${item.criticality.toUpperCase()}
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            document.getElementById('vessel-cards').innerHTML = cardsHtml;
        }
        
    } catch (error) {
        console.error('Error loading vessel data:', error);
        document.getElementById('vessel-cards').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ef4444;">
                <i class="fas fa-exclamation-circle fa-2x"></i>
                <p style="margin-top: 10px;">Error loading vessel data: ${error.message}</p>
            </div>
        `;
    }
}

// Function for card click (you can expand this later)
function showVesselDetails(vessel, voyage) {
    alert(`Showing details for:\nVessel: ${vessel}\nVoyage: ${voyage}\n\n(Detailed view can be implemented here)`);
    // You can replace this with modal or navigation to detailed view
}

// Make functions available globally
window.loadPendingDashboard = loadPendingDashboard;
window.showVesselDetails = showVesselDetails;