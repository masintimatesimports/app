function loadAgents() {
    document.getElementById('content-area').innerHTML = `
        <div style="background:white; padding:30px; border-radius:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2><i class="fas fa-users-cog"></i> Agent Management</h2>
                <button class="btn-primary" onclick="showAddAgentModal()">
                    <i class="fas fa-plus"></i> Add New Agent
                </button>
            </div>
            
            <div style="margin-bottom: 30px;">
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <button class="btn-secondary" onclick="loadAgentList()">
                        <i class="fas fa-users"></i> Agents List
                    </button>
                    <button class="btn-secondary" onclick="loadCategories()">
                        <i class="fas fa-tags"></i> Manage Categories
                    </button>
                </div>
                <div id="agentContent">
                    <div style="text-align:center; padding:20px;">
                        <i class="fas fa-spinner fa-spin"></i> Loading...
                    </div>
                </div>
            </div>
        </div>
    `;
    
    loadAgentList();
}

async function loadAgentList() {
    const container = document.getElementById('agentContent');
    
    try {
        const response = await fetch('http://127.0.0.1:8000/agents/');
        const agents = await response.json();
        
        if (!agents || agents.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px; background:#f8fafc; border-radius:8px;">
                    <i class="fas fa-users fa-3x" style="color:#64748b;"></i>
                    <h3>No Agents Found</h3>
                    <p>Add your first agent to get started</p>
                    <button class="btn-primary" onclick="showAddAgentModal()" style="margin-top:15px;">
                        <i class="fas fa-plus"></i> Add First Agent
                    </button>
                </div>
            `;
            return;
        }
        

        let html = `
            <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                <h3>All Agents (${agents.length})</h3>
                <input type="text" id="agentSearch" placeholder="Search agents..." 
                    style="padding:8px 12px; border:1px solid #ddd; border-radius:6px; width:250px;" 
                    onkeyup="searchAgents()">
            </div>
            <div id="agentsTable">
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                            <th style="padding:12px; text-align:left;">ID</th> <!-- ADD THIS COLUMN -->
                            <th style="padding:12px; text-align:left;">Code</th>
                            <th style="padding:12px; text-align:left;">Name</th>
                            <th style="padding:12px; text-align:left;">Role</th>
                            <th style="padding:12px; text-align:left;">Mode</th>
                            <th style="padding:12px; text-align:left;">Specialization</th>
                            <th style="padding:12px; text-align:left;">Status</th>
                            <th style="padding:12px; text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        agents.forEach(agent => {
            html += `
                <tr style="border-bottom:1px solid #f1f5f9;" data-agent-id="${agent.agent_id}">
                    <td style="padding:12px;">
                        <strong>${agent.agent_id}</strong> <!-- ADD THIS CELL -->
                    </td>
                    <td style="padding:12px;">
                        <strong>${agent.agent_code}</strong>
                    </td>
                    <td style="padding:12px;">
                        <div style="font-weight:500;">${agent.agent_name}</div>
                        <div style="font-size:0.8em; color:#64748b;">${agent.contact_email || 'No email'}</div>
                    </td>
                    <td style="padding:12px;">
                        ${agent.agent_role?.role_name || 'N/A'}
                    </td>
                    <td style="padding:12px;">
                        ${agent.mode_type?.mode_name || 'N/A'}
                    </td>
                    <td style="padding:12px;">
                        ${agent.specialization?.spec_name || 'N/A'}
                    </td>
                    <td style="padding:12px;">
                        <span class="badge" style="background:${agent.active ? '#d1fae5' : '#fee2e2'}; 
                            color:${agent.active ? '#065f46' : '#991b1b'}; padding:4px 8px; border-radius:12px;">
                            ${agent.active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td style="padding:12px; text-align:center;">
                        <button class="btn-icon" onclick="editAgent(${agent.agent_id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="toggleAgentStatus(${agent.agent_id}, ${agent.active ? 'false' : 'true'})" 
                                style="color:${agent.active ? 'var(--danger)' : 'var(--success)'};" 
                                title="${agent.active ? 'Deactivate' : 'Activate'}">
                            <i class="fas ${agent.active ? 'fa-ban' : 'fa-check'}"></i>
                        </button>
                    </td>
                </tr>
            `;
        });


        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading agents:', error);
        container.innerHTML = `<div style="color:var(--danger); text-align:center; padding:20px;">Error loading agents: ${error.message}</div>`;
    }
}

function searchAgents() {
    const search = document.getElementById('agentSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#agentsTable tbody tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let found = false;
        
        // Search in all cells except the last one (actions column)
        for (let i = 0; i < cells.length - 1; i++) {
            if (cells[i].textContent.toLowerCase().includes(search)) {
                found = true;
                break;
            }
        }
        
        row.style.display = found ? '' : 'none';
    });
}

async function loadCategories() {
    const container = document.getElementById('agentContent');
    container.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Loading categories...</div>';
    
    try {
        // Load all categories in parallel
        const [rolesRes, modesRes, specsRes] = await Promise.all([
            fetch('http://127.0.0.1:8000/agents/roles/').catch(() => ({ok: false})),
            fetch('http://127.0.0.1:8000/agents/modes/').catch(() => ({ok: false})),
            fetch('http://127.0.0.1:8000/agents/specializations/').catch(() => ({ok: false}))
        ]);
        
        const roles = rolesRes.ok ? await rolesRes.json() : [];
        const modes = modesRes.ok ? await modesRes.json() : [];
        const specs = specsRes.ok ? await specsRes.json() : [];
        
        let html = `
            <h3>Manage Categories</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-top:20px;">
                
                <!-- Agent Roles -->
                <div style="background:#f8fafc; padding:20px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h4><i class="fas fa-user-tag"></i> Agent Roles</h4>
                        <button class="btn-primary" onclick="showAddCategoryModal('role')" style="font-size:0.9em;">
                            <i class="fas fa-plus"></i> Add Role
                        </button>
                    </div>
                    <div id="rolesList">
                        ${renderCategoryList(roles, 'role')}
                    </div>
                </div>
                
                <!-- Mode Types -->
                <div style="background:#f8fafc; padding:20px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h4><i class="fas fa-shipping-fast"></i> Mode Types</h4>
                        <button class="btn-primary" onclick="showAddCategoryModal('mode')" style="font-size:0.9em;">
                            <i class="fas fa-plus"></i> Add Mode
                        </button>
                    </div>
                    <div id="modesList">
                        ${renderCategoryList(modes, 'mode')}
                    </div>
                </div>
                
                <!-- Specializations -->
                <div style="background:#f8fafc; padding:20px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h4><i class="fas fa-certificate"></i> Specializations</h4>
                        <button class="btn-primary" onclick="showAddCategoryModal('spec')" style="font-size:0.9em;">
                            <i class="fas fa-plus"></i> Add Specialization
                        </button>
                    </div>
                    <div id="specsList">
                        ${renderCategoryList(specs, 'spec')}
                    </div>
                </div>
                
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading categories:', error);
        container.innerHTML = `<div style="color:var(--danger); padding:20px;">Error loading categories: ${error.message}</div>`;
    }
}

function renderCategoryList(items, type) {
    if (!items || items.length === 0) {
        return '<div style="color:#64748b; text-align:center; padding:10px;">No items found</div>';
    }
    
    let html = '';
    items.forEach(item => {
        const id = type === 'role' ? item.role_id : type === 'mode' ? item.mode_id : item.spec_id;
        const name = type === 'role' ? item.role_name : type === 'mode' ? item.mode_name : item.spec_name;
        
        html += `
            <div style="background:white; padding:12px; margin-bottom:8px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:500;">${name}</div>
                    ${item.description ? `<div style="font-size:0.8em; color:#64748b;">${item.description}</div>` : ''}
                </div>
                <div>
                    <span class="badge" style="background:${item.is_active ? '#d1fae5' : '#fee2e2'}; 
                          color:${item.is_active ? '#065f46' : '#991b1b'}; padding:2px 6px; border-radius:10px; font-size:0.7em;">
                        ${item.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button class="btn-icon" onclick="editCategory('${type}', ${id})" style="margin-left:5px;">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    return html;
}

function showAddAgentModal() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000;">
            <div style="background:white; border-radius:12px; width:90%; max-width:600px; max-height:90vh; overflow:auto;">
                <div style="padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0;">Add New Agent</h3>
                    <button onclick="closeCurrentModal()" style="background:none; border:none; font-size:1.5em; cursor:pointer; color:#64748b;">×</button>
                </div>
                <div style="padding:20px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        <div>
                            <label style="display:block; margin-bottom:5px; font-weight:500;">Agent Code *</label>
                            <input type="text" id="agentCode" placeholder="e.g., AG001" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;" required>
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:5px; font-weight:500;">Agent Name *</label>
                            <input type="text" id="agentName" placeholder="e.g., ABC Logistics" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;" required>
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:5px; font-weight:500;">Agent Role</label>
                            <select id="agentRole" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                                <option value="">-- Select Role --</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:5px; font-weight:500;">Mode Type</label>
                            <select id="agentMode" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                                <option value="">-- Select Mode --</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:5px; font-weight:500;">Specialization</label>
                            <select id="agentSpec" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                                <option value="">-- Select Specialization --</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:5px; font-weight:500;">Contact Email</label>
                            <input type="email" id="agentEmail" placeholder="email@example.com" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:5px; font-weight:500;">Phone</label>
                            <input type="text" id="agentPhone" placeholder="+1234567890" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                        </div>
                        <div style="grid-column:span 2;">
                            <label style="display:block; margin-bottom:5px; font-weight:500;">Address</label>
                            <textarea id="agentAddress" rows="3" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;"></textarea>
                        </div>
                    </div>
                </div>
                <div style="padding:20px; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; gap:10px;">
                    <button class="btn-secondary" onclick="closeCurrentModal()">Cancel</button>
                    <button class="btn-primary" onclick="saveAgent()">Save Agent</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Load dropdown options
    loadCategoryDropdowns();
}

async function loadCategoryDropdowns() {
    try {
        const [rolesRes, modesRes, specsRes] = await Promise.all([
            fetch('http://127.0.0.1:8000/agents/roles/').catch(() => ({ok: false})),
            fetch('http://127.0.0.1:8000/agents/modes/').catch(() => ({ok: false})),
            fetch('http://127.0.0.1:8000/agents/specializations/').catch(() => ({ok: false}))
        ]);
        
        const roles = rolesRes.ok ? await rolesRes.json() : [];
        const modes = modesRes.ok ? await modesRes.json() : [];
        const specs = specsRes.ok ? await specsRes.json() : [];
        
        // Populate role dropdown
        const roleSelect = document.getElementById('agentRole');
        roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.role_id;
            option.textContent = role.role_name;
            roleSelect.appendChild(option);
        });
        
        // Populate mode dropdown
        const modeSelect = document.getElementById('agentMode');
        modes.forEach(mode => {
            const option = document.createElement('option');
            option.value = mode.mode_id;
            option.textContent = mode.mode_name;
            modeSelect.appendChild(option);
        });
        
        // Populate specialization dropdown
        const specSelect = document.getElementById('agentSpec');
        specs.forEach(spec => {
            const option = document.createElement('option');
            option.value = spec.spec_id;
            option.textContent = spec.spec_name;
            specSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading category dropdowns:', error);
    }
}

async function saveAgent() {
    const agentData = {
        agent_code: document.getElementById('agentCode').value.trim(),
        agent_name: document.getElementById('agentName').value.trim(),
        agent_role_id: document.getElementById('agentRole').value ? parseInt(document.getElementById('agentRole').value) : null,
        mode_type_id: document.getElementById('agentMode').value ? parseInt(document.getElementById('agentMode').value) : null,
        specialization_id: document.getElementById('agentSpec').value ? parseInt(document.getElementById('agentSpec').value) : null,
        contact_email: document.getElementById('agentEmail').value.trim() || null,
        contact_phone: document.getElementById('agentPhone').value.trim() || null,
        address: document.getElementById('agentAddress').value.trim() || null
    };
    
    if (!agentData.agent_code || !agentData.agent_name) {
        showNotification('Agent Code and Name are required', 'error');
        return;
    }
    
    try {
        const response = await fetch('http://127.0.0.1:8000/agents/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentData)
        });
        
        if (response.ok) {
            showNotification('Agent created successfully', 'success');
            closeCurrentModal();
            loadAgentList();
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create agent');
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function showAddCategoryModal(type) {
    const typeLabels = {
        'role': 'Agent Role',
        'mode': 'Mode Type',
        'spec': 'Specialization'
    };
    
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000;">
            <div style="background:white; border-radius:12px; width:90%; max-width:400px;">
                <div style="padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0;">Add ${typeLabels[type]}</h3>
                    <button onclick="closeCurrentModal()" style="background:none; border:none; font-size:1.5em; cursor:pointer; color:#64748b;">×</button>
                </div>
                <div style="padding:20px;">
                    <div style="margin-bottom:15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500;">Name *</label>
                        <input type="text" id="catName" placeholder="Enter name" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;" required>
                    </div>
                    <div style="margin-bottom:15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500;">Description</label>
                        <textarea id="catDesc" rows="3" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;"></textarea>
                    </div>
                    <div style="margin-bottom:15px;">
                        <label style="display:block; margin-bottom:5px; font-weight:500;">Sort Order</label>
                        <input type="number" id="catOrder" value="0" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                    </div>
                </div>
                <div style="padding:20px; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; gap:10px;">
                    <button class="btn-secondary" onclick="closeCurrentModal()">Cancel</button>
                    <button class="btn-primary" onclick="saveCategory('${type}')">Save</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function saveCategory(type) {
    const name = document.getElementById('catName').value.trim();
    const desc = document.getElementById('catDesc').value.trim();
    const order = parseInt(document.getElementById('catOrder').value) || 0;
    
    if (!name) {
        showNotification('Name is required', 'error');
        return;
    }
    
    const endpoint = type === 'role' ? 'roles' : type === 'mode' ? 'modes' : 'specializations';
    const typeLabels = {
        'role': 'Agent Role',
        'mode': 'Mode Type',
        'spec': 'Specialization'
    };
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/agents/${endpoint}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                description: desc || null,
                sort_order: order
            })
        });
        
        if (response.ok) {
            showNotification(`${typeLabels[type]} created successfully`, 'success');
            closeCurrentModal();
            loadCategories();
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create category');
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function toggleAgentStatus(agentId, newStatus) {
    const statusText = newStatus === 'true' ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${statusText} this agent?`)) {
        return;
    }
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/agents/${agentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: newStatus === 'true' })
        });
        
        if (response.ok) {
            showNotification(`Agent ${statusText}d successfully`, 'success');
            loadAgentList();
        } else {
            throw new Error('Failed to update agent status');
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Modal close functions
function closeCurrentModal() {
    const modals = document.querySelectorAll('div[style*="position:fixed"]');
    if (modals.length > 0) {
        modals[modals.length - 1].remove();
    }
}

function closeModal(button) {
    const modal = button.closest('div[style*="position:fixed"]');
    if (modal) {
        modal.remove();
    }
}

// Edit Agent functionality
async function editAgent(agentId) {
    try {
        // Get agent data
        const response = await fetch(`http://127.0.0.1:8000/agents/${agentId}`);
        const agent = await response.json();
        
        // Create edit modal
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000;">
                <div style="background:white; border-radius:12px; width:90%; max-width:600px; max-height:90vh; overflow:auto;">
                    <div style="padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0;">Edit Agent: ${agent.agent_code}</h3>
                        <button onclick="closeCurrentModal()" style="background:none; border:none; font-size:1.5em; cursor:pointer; color:#64748b;">×</button>
                    </div>
                    <div style="padding:20px;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                            <div>
                                <label style="display:block; margin-bottom:5px; font-weight:500;">Agent Code *</label>
                                <input type="text" id="editAgentCode" value="${agent.agent_code}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;" required readonly>
                            </div>
                            <div>
                                <label style="display:block; margin-bottom:5px; font-weight:500;">Agent Name *</label>
                                <input type="text" id="editAgentName" value="${agent.agent_name}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;" required>
                            </div>
                            <div>
                                <label style="display:block; margin-bottom:5px; font-weight:500;">Agent Role</label>
                                <select id="editAgentRole" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                                    <option value="">-- Select Role --</option>
                                </select>
                            </div>
                            <div>
                                <label style="display:block; margin-bottom:5px; font-weight:500;">Mode Type</label>
                                <select id="editAgentMode" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                                    <option value="">-- Select Mode --</option>
                                </select>
                            </div>
                            <div>
                                <label style="display:block; margin-bottom:5px; font-weight:500;">Specialization</label>
                                <select id="editAgentSpec" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                                    <option value="">-- Select Specialization --</option>
                                </select>
                            </div>
                            <div>
                                <label style="display:block; margin-bottom:5px; font-weight:500;">Contact Email</label>
                                <input type="email" id="editAgentEmail" value="${agent.contact_email || ''}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                            </div>
                            <div>
                                <label style="display:block; margin-bottom:5px; font-weight:500;">Phone</label>
                                <input type="text" id="editAgentPhone" value="${agent.contact_phone || ''}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                            </div>
                            <div style="grid-column:span 2;">
                                <label style="display:block; margin-bottom:5px; font-weight:500;">Address</label>
                                <textarea id="editAgentAddress" rows="3" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">${agent.address || ''}</textarea>
                            </div>
                            <div style="grid-column:span 2;">
                                <label style="display:flex; align-items:center; gap:8px;">
                                    <input type="checkbox" id="editAgentActive" ${agent.active ? 'checked' : ''}>
                                    Active Agent
                                </label>
                            </div>
                        </div>
                    </div>
                    <div style="padding:20px; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; gap:10px;">
                        <button class="btn-secondary" onclick="closeCurrentModal()">Cancel</button>
                        <button class="btn-primary" onclick="updateAgent(${agentId})">Update Agent</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Load dropdowns with current selection
        await loadEditCategoryDropdowns(agent);
        
    } catch (error) {
        console.error('Error loading agent for edit:', error);
        showNotification(`Error loading agent: ${error.message}`, 'error');
    }
}


async function editCategory(type, id) {
    const typeLabels = {
        'role': 'Agent Role',
        'mode': 'Mode Type', 
        'spec': 'Specialization'
    };
    
    const endpoint = type === 'role' ? 'roles' : type === 'mode' ? 'modes' : 'specializations';
    
    try {
        // Get category data
        const response = await fetch(`http://127.0.0.1:8000/agents/${endpoint}/`);
        const categories = await response.json();
        const category = categories.find(c => 
            type === 'role' ? c.role_id === id : 
            type === 'mode' ? c.mode_id === id : c.spec_id === id
        );
        
        if (!category) {
            showNotification('Category not found', 'error');
            return;
        }
        
        // Create edit modal
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000;">
                <div style="background:white; border-radius:12px; width:90%; max-width:400px;">
                    <div style="padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0;">Edit ${typeLabels[type]}</h3>
                        <button onclick="closeCurrentModal()" style="background:none; border:none; font-size:1.5em; cursor:pointer; color:#64748b;">×</button>
                    </div>
                    <div style="padding:20px;">
                        <div style="margin-bottom:15px;">
                            <label style="display:block; margin-bottom:5px; font-weight:500;">Name *</label>
                            <input type="text" id="editCatName" value="${type === 'role' ? category.role_name : type === 'mode' ? category.mode_name : category.spec_name}" 
                                   style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;" required>
                        </div>
                        <div style="margin-bottom:15px;">
                            <label style="display:block; margin-bottom:5px; font-weight:500;">Description</label>
                            <textarea id="editCatDesc" rows="3" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">${category.description || ''}</textarea>
                        </div>
                        <div style="margin-bottom:15px;">
                            <label style="display:block; margin-bottom:5px; font-weight:500;">Sort Order</label>
                            <input type="number" id="editCatOrder" value="${category.sort_order || 0}" 
                                   style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                        </div>
                        <div style="margin-bottom:15px;">
                            <label style="display:flex; align-items:center; gap:8px;">
                                <input type="checkbox" id="editCatActive" ${category.is_active ? 'checked' : ''}>
                                Active
                            </label>
                        </div>
                    </div>
                    <div style="padding:20px; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; gap:10px;">
                        <button class="btn-secondary" onclick="closeCurrentModal()">Cancel</button>
                        <button class="btn-primary" onclick="updateCategory('${type}', ${id})">Update</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error loading category for edit:', error);
        showNotification(`Error loading category: ${error.message}`, 'error');
    }
}

async function updateCategory(type, id) {
    const name = document.getElementById('editCatName').value.trim();
    const desc = document.getElementById('editCatDesc').value.trim();
    const order = parseInt(document.getElementById('editCatOrder').value) || 0;
    const isActive = document.getElementById('editCatActive').checked;
    
    if (!name) {
        showNotification('Name is required', 'error');
        return;
    }
    
    const endpoint = type === 'role' ? 'roles' : type === 'mode' ? 'modes' : 'specializations';
    const typeLabels = {
        'role': 'Agent Role',
        'mode': 'Mode Type',
        'spec': 'Specialization'
    };
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/agents/${endpoint}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,  // This will be mapped to correct column in backend
                description: desc || null,
                sort_order: order,
                is_active: isActive
            })
        });
        
        if (response.ok) {
            showNotification(`${typeLabels[type]} updated successfully`, 'success');
            const modal = document.querySelector('div[style*="position:fixed"]');
            if (modal) modal.remove();
            loadCategories(); // Refresh the categories list
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update category');
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function loadEditCategoryDropdowns(agent) {
    try {
        const [rolesRes, modesRes, specsRes] = await Promise.all([
            fetch('http://127.0.0.1:8000/agents/roles/').catch(() => ({ok: false})),
            fetch('http://127.0.0.1:8000/agents/modes/').catch(() => ({ok: false})),
            fetch('http://127.0.0.1:8000/agents/specializations/').catch(() => ({ok: false}))
        ]);
        
        const roles = rolesRes.ok ? await rolesRes.json() : [];
        const modes = modesRes.ok ? await modesRes.json() : [];
        const specs = specsRes.ok ? await specsRes.json() : [];
        
        // Populate role dropdown
        const roleSelect = document.getElementById('editAgentRole');
        roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.role_id;
            option.textContent = role.role_name;
            option.selected = (agent.agent_role_id === role.role_id);
            roleSelect.appendChild(option);
        });
        
        // Populate mode dropdown
        const modeSelect = document.getElementById('editAgentMode');
        modes.forEach(mode => {
            const option = document.createElement('option');
            option.value = mode.mode_id;
            option.textContent = mode.mode_name;
            option.selected = (agent.mode_type_id === mode.mode_id);
            modeSelect.appendChild(option);
        });
        
        // Populate specialization dropdown
        const specSelect = document.getElementById('editAgentSpec');
        specs.forEach(spec => {
            const option = document.createElement('option');
            option.value = spec.spec_id;
            option.textContent = spec.spec_name;
            option.selected = (agent.specialization_id === spec.spec_id);
            specSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading category dropdowns for edit:', error);
    }
}

async function updateAgent(agentId) {
    const agentData = {
        agent_name: document.getElementById('editAgentName').value.trim(),
        agent_role_id: document.getElementById('editAgentRole').value ? parseInt(document.getElementById('editAgentRole').value) : null,
        mode_type_id: document.getElementById('editAgentMode').value ? parseInt(document.getElementById('editAgentMode').value) : null,
        specialization_id: document.getElementById('editAgentSpec').value ? parseInt(document.getElementById('editAgentSpec').value) : null,
        contact_email: document.getElementById('editAgentEmail').value.trim() || null,
        contact_phone: document.getElementById('editAgentPhone').value.trim() || null,
        address: document.getElementById('editAgentAddress').value.trim() || null,
        active: document.getElementById('editAgentActive').checked
    };
    
    if (!agentData.agent_name) {
        showNotification('Agent Name is required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/agents/${agentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentData)
        });
        
        if (response.ok) {
            showNotification('Agent updated successfully', 'success');
            // FIX: Close modal FIRST, then refresh list
            const modal = document.querySelector('div[style*="position:fixed"]');
            if (modal) modal.remove();
            loadAgentList();
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update agent');
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}



// Make functions globally available
window.loadAgents = loadAgents;
window.showAddAgentModal = showAddAgentModal;
window.saveAgent = saveAgent;
window.loadCategories = loadCategories;
window.showAddCategoryModal = showAddCategoryModal;
window.saveCategory = saveCategory;
window.toggleAgentStatus = toggleAgentStatus;
window.editAgent = editAgent;
window.editCategory = editCategory;  // This is the CORRECT function
window.searchAgents = searchAgents;
window.renderCategoryList = renderCategoryList;
window.closeCurrentModal = closeCurrentModal;
window.closeModal = closeModal;
window.updateAgent = updateAgent;
window.updateCategory = updateCategory;  // Add this