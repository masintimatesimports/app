class AgentDropdown {
    constructor() {
        this.agents = [];
        this.selectedAgentId = null;
    }
    
    async init(containerId, defaultValue = null) {
        try {
            this.agents = await Api.agents.getDropdownList();
            
            const container = document.getElementById(containerId);
            if (!container) return;
            
            let html = `<label style="display:block; margin-bottom:5px; font-weight:500;">Select Agent</label>`;
            html += `<select id="${containerId}-select" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">`;
            html += `<option value="">-- Select Agent --</option>`;
            
            this.agents.forEach(agent => {
                html += `<option value="${agent.id}" ${defaultValue == agent.id ? 'selected' : ''}>${agent.name}</option>`;
            });
            
            html += `</select>`;
            container.innerHTML = html;
            
            // Set default if provided
            if (defaultValue) {
                this.setSelectedAgent(defaultValue);
            }
            
            // Add change listener
            const select = document.getElementById(`${containerId}-select`);
            if (select) {
                select.addEventListener('change', (e) => {
                    this.selectedAgentId = e.target.value;
                });
            }
            
        } catch (error) {
            console.error('Error loading agents dropdown:', error);
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `<div style="color:var(--danger);">Error loading agents</div>`;
            }
        }
    }
    
    getSelectedAgentId() {
        const select = document.getElementById(this.containerId + '-select');
        return select ? parseInt(select.value) : null;
    }
    
    setSelectedAgent(agentId) {
        const select = document.getElementById(this.containerId + '-select');
        if (select) {
            select.value = agentId;
            this.selectedAgentId = agentId;
        }
    }
}

// Global instance
window.AgentDropdown = new AgentDropdown();