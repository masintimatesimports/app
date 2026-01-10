function loadFields() {
    document.getElementById('content-area').innerHTML = `
        <div style="background:white; padding:30px; border-radius:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2><i class="fas fa-cog"></i> Custom Fields Management</h2>
                <button class="btn-primary" onclick="showAddFieldModal()">
                    <i class="fas fa-plus"></i> Add New Field
                </button>
            </div>
            
            <p>Manage custom fields for your shipment data</p>
            
            <div id="fieldsList" style="margin-top:20px;">
                <div style="text-align:center; padding:40px; background:#f8fafc; border-radius:8px;">
                    <i class="fas fa-sliders-h fa-3x" style="color:#64748b;"></i>
                    <h3>No custom fields yet</h3>
                    <p>Add your first custom field to extend shipment data</p>
                </div>
            </div>
        </div>
        
        <!-- Modal will be added dynamically -->
    `;
}

function showAddFieldModal() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000;">
            <div style="background:white; border-radius:12px; width:90%; max-width:500px; max-height:90vh; overflow:auto;">
                <div style="padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0;">Add Custom Field</h3>
                    <button onclick="this.closest('div[style*=\"position:fixed\"]').remove()" style="background:none; border:none; font-size:1.5em; cursor:pointer; color:#64748b;">×</button>
                </div>
                <div style="padding:20px;">
                    <div style="margin-bottom:20px;">
                        <label style="display:block; margin-bottom:8px; font-weight:500; color:#1e293b;">Field Key (unique)</label>
                        <input type="text" id="fieldKeyInput" placeholder="e.g., supplier" style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>
                    <div style="margin-bottom:20px;">
                        <label style="display:block; margin-bottom:8px; font-weight:500; color:#1e293b;">Field Label</label>
                        <input type="text" id="fieldLabelInput" placeholder="e.g., Supplier Name" style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>
                    <div style="margin-bottom:20px;">
                        <label style="display:block; margin-bottom:8px; font-weight:500; color:#1e293b;">Field Type</label>
                        <select id="fieldTypeSelect" style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:6px;">
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                        </select>
                    </div>
                    <div style="margin-bottom:20px;">
                        <label style="display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" id="fieldRequiredCheckbox">
                            Required Field
                        </label>
                    </div>
                </div>
                <div style="padding:20px; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; gap:10px;">
                    <button class="btn-secondary" onclick="this.closest('div[style*=\"position:fixed\"]').remove()">Cancel</button>
                    <button class="btn-primary" onclick="createField()">Create Field</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal.firstChild);
}

async function createField() {
    const fieldData = {
        field_key: document.getElementById('fieldKeyInput').value.trim(),
        field_label: document.getElementById('fieldLabelInput').value.trim(),
        field_type: document.getElementById('fieldTypeSelect').value,
        required: document.getElementById('fieldRequiredCheckbox').checked
    };
    
    if (!fieldData.field_key || !fieldData.field_label) {
        showNotification('Key and Label are required', 'error');
        return;
    }
    
    try {
        const response = await fetch('http://127.0.0.1:8000/fields', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fieldData)
        });
        
        if (response.ok) {
            showNotification('Custom field created successfully', 'success');
            // Close modal
            document.querySelector('div[style*="position:fixed"]')?.remove();
            // Reload fields list
            loadFields();
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create field');
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Make functions globally available
window.loadFields = loadFields;
window.showAddFieldModal = showAddFieldModal;
window.createField = createField;