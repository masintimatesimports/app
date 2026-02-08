async function loadPendingDashboard() {
    document.getElementById('content-area').innerHTML = `
        <div class="dashboard">
            <h2><i class="fas fa-clock" style="color:#f59e0b;"></i> Pending Operations</h2>
            
            <!-- Compact Overview & Priority Side-by-Side -->
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px; margin: 20px 0;">
                
                <!-- Left: Compact Status Overview -->
                <div>
                    <h3 style="margin-bottom: 15px; color: #475569; font-size: 16px;">📊 Status</h3>
                    <div id="compact-overview" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="text-align: center; color: #64748b;">
                            <i class="fas fa-spinner fa-spin"></i> Loading...
                        </div>
                    </div>
                </div>
                
                <!-- Right: Priority Heatmap -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 style="color: #475569; font-size: 16px;">🎯 Priority Heatmap</h3>
                        <span id="total-pending-count" style="background: #f1f5f9; padding: 4px 10px; border-radius: 12px; font-size: 12px; color: #475569;">
                            Total: Loading...
                        </span>
                    </div>
                    <div id="priority-heatmap" style="background: #f8fafc; padding: 20px; border-radius: 10px;">
                        <div style="text-align: center; color: #64748b;">
                            <i class="fas fa-spinner fa-spin"></i> Loading priority data...
                        </div>
                    </div>
                </div>
                
            </div>
            
            <!-- Agent Distribution (Compact) -->
            <div style="margin: 30px 0;">
                <h3 style="margin-bottom: 15px; color: #475569; font-size: 16px;">👥 Agent Distribution</h3>
                <div id="agent-distribution" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <div style="text-align: center; color: #64748b;">
                        Loading agent data...
                    </div>
                </div>
            </div>
            
            <!-- Recent Pending (Optional) -->
            <div style="margin: 30px 0;">
                <h3 style="margin-bottom: 15px; color: #475569; font-size: 16px;">📋 Recent Pending Shipments</h3>
                <div id="recent-pending" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <div style="text-align: center; color: #64748b;">
                        <i class="fas fa-spinner fa-spin"></i> Loading recent shipments...
                    </div>
                </div>
            </div>
        </div>
    `;
    
    await loadPendingOperationsData();
}

async function loadPendingOperationsData() {
    try {
        const data = await Api.shipments.getPendingOperations();
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        // 1. Update Compact Overview
        updateCompactOverview(data.summary);
        
        // 2. Update Priority Heatmap
        updatePriorityHeatmap(data.priority_heatmap, data.summary.total);
        
        // 3. Update Agent Distribution
        updateAgentDistribution(data.agent_distribution, data.summary.total);
        
        // 4. Load Recent Pending
        await loadRecentPending();
        
    } catch (error) {
        console.error('Error loading pending operations:', error);
        showError(error.message);
    }
}

function updateCompactOverview(summary) {
    const container = document.getElementById('compact-overview');
    
    const total = summary.total || 0;
    
    const overviewHtml = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Total -->
            <div style="text-align: center; margin-bottom: 10px;">
                <div style="font-size: 28px; font-weight: bold; color: #1e293b;">${total}</div>
                <div style="font-size: 12px; color: #64748b;">Total Pending</div>
            </div>
            
            <!-- Status Breakdown -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%;"></div>
                        <span style="font-size: 13px; color: #475569;">Overdue</span>
                    </div>
                    <div style="font-weight: 600; color: #1e293b;">${summary.overdue}</div>
                </div>
                
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></div>
                        <span style="font-size: 13px; color: #475569;">Arrived</span>
                    </div>
                    <div style="font-weight: 600; color: #1e293b;">${summary.arrived}</div>
                </div>
                
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></div>
                        <span style="font-size: 13px; color: #475569;">En Route</span>
                    </div>
                    <div style="font-weight: 600; color: #1e293b;">${summary.en_route}</div>
                </div>
            </div>
            
            <!-- Mini Chart -->
            <div style="height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden; margin-top: 10px;">
                ${total > 0 ? `
                    <div style="height: 100%; display: flex;">
                        <div style="width: ${(summary.overdue / total) * 100}%; background: #ef4444;"></div>
                        <div style="width: ${(summary.arrived / total) * 100}%; background: #f59e0b;"></div>
                        <div style="width: ${(summary.en_route / total) * 100}%; background: #10b981;"></div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    container.innerHTML = overviewHtml;
}

function updatePriorityHeatmap(priorityData, total) {
    const container = document.getElementById('priority-heatmap');
    const totalSpan = document.getElementById('total-pending-count');
    
    totalSpan.textContent = `Total: ${total}`;
    
    const priorityConfig = {
        "critical": {
            label: "CRITICAL",
            sublabel: ">7 days overdue",
            color: "#ef4444",
            icon: "fa-fire"
        },
        "high": {
            label: "HIGH", 
            sublabel: "4-7 days overdue",
            color: "#f97316",
            icon: "fa-exclamation-triangle"
        },
        "medium": {
            label: "MEDIUM",
            sublabel: "1-3 days overdue",
            color: "#f59e0b",
            icon: "fa-exclamation-circle"
        },
        "low": {
            label: "LOW",
            sublabel: "On time / Future",
            color: "#10b981",
            icon: "fa-check-circle"
        }
    };
    
    let heatmapHtml = '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">';
    
    Object.keys(priorityConfig).forEach(category => {
        const config = priorityConfig[category];
        const data = priorityData[category] || { count: 0, sample: [] };
        const percentage = total > 0 ? ((data.count / total) * 100).toFixed(0) : 0;
        
        heatmapHtml += `
            <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border-top: 3px solid ${config.color};">
                <div style="margin-bottom: 10px;">
                    <i class="fas ${config.icon}" style="color: ${config.color}; font-size: 20px;"></i>
                </div>
                <div style="font-size: 24px; font-weight: bold; color: #1e293b; margin-bottom: 5px;">
                    ${data.count}
                </div>
                <div style="font-size: 12px; font-weight: 600; color: ${config.color}; margin-bottom: 3px;">
                    ${config.label}
                </div>
                <div style="font-size: 10px; color: #64748b; margin-bottom: 8px;">
                    ${config.sublabel}
                </div>
                <div style="font-size: 11px; color: #94a3b8;">
                    ${percentage}% of total
                </div>
            </div>
        `;
    });
    
    heatmapHtml += '</div>';
    container.innerHTML = heatmapHtml;
}

function updateAgentDistribution(agentData, total) {
    const container = document.getElementById('agent-distribution');
    
    if (!agentData || Object.keys(agentData).length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #64748b;">No agent data available</div>';
        return;
    }
    
    // Convert to array and sort by count
    const agents = Object.entries(agentData)
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count);
    
    let distributionHtml = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">';
    
    agents.forEach(agent => {
        const percentage = total > 0 ? ((agent.count / total) * 100).toFixed(0) : 0;
        const barWidth = total > 0 ? (agent.count / total) * 100 : 0;
        
        distributionHtml += `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <div style="font-weight: 600; color: #475569;">
                        Agent ${agent.id}
                    </div>
                    <div style="font-weight: 600; color: #3b82f6;">
                        ${percentage}%
                    </div>
                </div>
                <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 5px;">
                    <div style="height: 100%; background: #3b82f6; width: ${barWidth}%; border-radius: 4px;"></div>
                </div>
                <div style="font-size: 12px; color: #64748b; text-align: right;">
                    ${agent.count} BLs
                </div>
            </div>
        `;
    });
    
    distributionHtml += '</div>';
    container.innerHTML = distributionHtml;
}

async function loadRecentPending() {
    try {
        // Get all agents first
        const agents = await Api.agents.getAll();
        
        if (!Array.isArray(agents) || agents.length === 0) {
            document.getElementById('recent-pending').innerHTML = 
                '<div style="text-align: center; color: #64748b;">No agents found</div>';
            return;
        }
        
        // Get pending shipments for each agent
        let allPending = [];
        
        for (const agent of agents) {
            try {
                // Use search endpoint with empty HBL to get all shipments for agent
                const agentShipments = await Api.shipments.search('', agent.agent_id);
                
                if (Array.isArray(agentShipments)) {
                    // Filter for PENDING status
                    const agentPending = agentShipments.filter(s => 
                        s.standardized_status === 'PENDING' || 
                        (s.clearance_status && 
                         s.clearance_status.toUpperCase() !== 'DELIVERED' &&
                         s.clearance_status.toUpperCase() !== 'CLEARED')
                    );
                    
                    // Add agent name to each shipment
                    const pendingWithAgent = agentPending.map(shipment => ({
                        ...shipment,
                        agent_name: agent.agent_name,
                        agent_code: agent.agent_code
                    }));
                    
                    allPending = [...allPending, ...pendingWithAgent];
                }
            } catch (error) {
                console.error(`Error loading shipments for agent ${agent.agent_id}:`, error);
                // Continue with other agents
            }
        }
        
        // Sort by last_excel_upload_at or created_at (newest first)
        allPending.sort((a, b) => {
            const dateA = a.last_excel_upload_at || a.created_at;
            const dateB = b.last_excel_upload_at || b.created_at;
            return new Date(dateB) - new Date(dateA);
        });
        
        // Take only recent ones (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recent = allPending
            .filter(shipment => {
                const shipDate = shipment.last_excel_upload_at || shipment.created_at;
                return new Date(shipDate) >= thirtyDaysAgo;
            })
            .slice(0, 6); // Last 6 recent ones
        
        let html = '';
        if (recent.length === 0) {
            html = '<div style="text-align: center; color: #64748b;">No recent pending shipments (last 30 days)</div>';
        } else {
            html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">';
            
            recent.forEach(shipment => {
                // Format ETA
                let etaDisplay = 'N/A';
                if (shipment.eta) {
                    const etaDate = new Date(shipment.eta);
                    if (etaDate.getFullYear() > 2000) { // Filter out old/bad dates
                        etaDisplay = etaDate.toLocaleDateString();
                    }
                }
                
                // Format consignee (shorten if too long)
                let consignee = shipment.consignee || 'No consignee';
                if (consignee.length > 20) {
                    consignee = consignee.substring(0, 20) + '...';
                }
                
                html += `
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 3px solid #f59e0b;">
                        <div style="font-weight: 600; color: #1e293b; margin-bottom: 5px; font-size: 14px;">
                            ${shipment.hbl_number || 'N/A'}
                        </div>
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 3px;">
                            ${consignee}
                        </div>
                        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 3px;">
                            <i class="fas fa-calendar"></i> ETA: ${etaDisplay}
                        </div>
                        <div style="font-size: 11px; color: #3b82f6; display: flex; justify-content: space-between;">
                            <span><i class="fas fa-user"></i> ${shipment.agent_name || `Agent ${shipment.agent_id}`}</span>
                            <span>${shipment.agent_code || ''}</span>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
        }
        
        document.getElementById('recent-pending').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading recent pending:', error);
        document.getElementById('recent-pending').innerHTML = 
            '<div style="text-align: center; color: #ef4444; padding: 20px;">' +
            '<i class="fas fa-exclamation-circle"></i> Error loading recent shipments<br>' +
            '<small>' + error.message + '</small>' +
            '</div>';
    }
}

function showError(message) {
    const container = document.getElementById('content-area');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <i class="fas fa-exclamation-triangle fa-2x" style="margin-bottom: 15px;"></i>
                <h4 style="margin-bottom: 10px;">Error Loading Dashboard</h4>
                <p style="color: #64748b;">${message}</p>
                <button onclick="loadPendingDashboard()" style="margin-top: 20px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Make function available
window.loadPendingDashboard = loadPendingDashboard;