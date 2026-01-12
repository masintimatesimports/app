let workbook = null;
let currentSheet = '';

async function loadMapping() {
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    document.getElementById('content-area').innerHTML = `
        <div class="upload-container">
            <h2><i class="fas fa-columns"></i> Column Mapping</h2>
            <p>Manage Excel column mappings</p>
            
            ${isAdmin ? `
            <div class="input-group">
                <label>Select Agent</label>
                <select id="mapAgentSelect" onchange="loadAllSheets()" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                    <option value="">Loading agents...</option>
                </select>
            </div>
            ` : `
            <input type="hidden" id="mapAgentId" value="1">
            `}
            
            <!-- Section 1: View/Edit Existing Mappings -->
            <div id="existingSection" style="margin-top:30px;">
                <h3><i class="fas fa-list"></i> Existing Mappings</h3>
                <div id="allMappingsList" style="margin:15px 0;">
                    <p style="color:#64748b;">Loading existing mappings...</p>
                </div>
            </div>
            
            <!-- Section 2: Add/Update Mappings -->
            <div style="margin-top:30px; border-top:1px solid #e2e8f0; padding-top:20px;">
                <h3><i class="fas fa-plus"></i> Add/Update Mappings</h3>
                
                <div class="input-group">
                    <label>Select Sheet</label>
                    <select id="sheetSelect" onchange="loadSheetForMapping()">
                        <option value="">-- Select Sheet --</option>
                    </select>
                </div>
                
                <div class="input-group" style="margin-top:15px;">
                    <label>Upload Excel File (Optional - to see columns)</label>
                    <input type="file" id="mappingFile" accept=".xlsx,.xls">
                </div>
                
                <div id="mappingFormContainer" style="display:none; margin-top:20px;">
                    <h4>Map Columns for: <span id="currentSheetName"></span></h4>
                    <div id="mappingForm"></div>
                    <button class="btn-primary" onclick="saveMapping()" style="margin-top:20px;">
                        <i class="fas fa-save"></i> Save Mappings
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Setup file input
    const fileInput = document.getElementById('mappingFile');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            if (e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
            }
        });
    }
    
    // Load existing sheets and mappings
    await loadAllSheets();
    if (isAdmin) {
        await loadMappingAgents();
    }

}

// Load all sheets that have mappings for this agent
async function loadAllSheets() {
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    let agentId;
    if (isAdmin) {
        const select = document.getElementById('mapAgentSelect');
        agentId = select ? select.value : null;
    } else {
        const hiddenInput = document.getElementById('mapAgentId');
        agentId = hiddenInput ? hiddenInput.value : "1";
    }
    
    if (!agentId) {
        document.getElementById('allMappingsList').innerHTML = 
            '<p style="color:#64748b; text-align:center;">Select an agent to view mappings</p>';
        return;
    }
    
    try {
        const mappingsData = await Api.mappings.getAll(parseInt(agentId));
        
        // Group by sheet_name
        const sheets = {};
        if (Array.isArray(mappingsData)) {
            mappingsData.forEach(mapping => {
                if (!sheets[mapping.sheet_name]) {
                    sheets[mapping.sheet_name] = [];
                }
                sheets[mapping.sheet_name].push(mapping);
            });
        }
        
        // Display all existing mappings
        let html = '';
        if (Object.keys(sheets).length > 0) {
            Object.keys(sheets).forEach(sheetName => {
                html += `
                    <div style="background:white; border-radius:8px; padding:15px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <h4 style="margin:0;"><i class="fas fa-table"></i> ${sheetName}</h4>
                            <div>
                                <button class="btn-secondary" onclick="editSheet('${sheetName.replace(/'/g, "\\'")}')" style="margin-right:5px;">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn-icon" onclick="deleteAllMappings('${sheetName.replace(/'/g, "\\'")}')" style="color:var(--danger);">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px;">
                `;
                
                sheets[sheetName].forEach(mapping => {
                    html += `
                        <div style="background:#f8fafc; padding:8px 12px; border-radius:6px; font-size:0.9em;">
                            <strong>${mapping.standard_column_name}</strong> 
                            <span style="color:#64748b;">→</span> 
                            ${mapping.excel_column_name}
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            });
        } else {
            html = '<p style="color:#64748b; text-align:center;">No existing mappings found for this agent.</p>';
        }
        
        document.getElementById('allMappingsList').innerHTML = html;
        
        // Populate sheet dropdown
        const sheetSelect = document.getElementById('sheetSelect');
        const existingOptions = Array.from(sheetSelect.options).map(o => o.value);
        
        // Add sheet names to dropdown if not already there
        Object.keys(sheets).forEach(sheetName => {
            if (!existingOptions.includes(sheetName)) {
                const option = document.createElement('option');
                option.value = sheetName;
                option.textContent = sheetName;
                sheetSelect.appendChild(option);
            }
        });
        
    } catch (error) {
        console.error('Error loading all sheets:', error);
        document.getElementById('allMappingsList').innerHTML = 
            `<div style="color:var(--danger); padding:20px; text-align:center;">
                Error loading mappings: ${error.message}
            </div>`;
    }
}

// Handle file upload - FIXED with TRIM
function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            workbook = XLSX.read(e.target.result, { type: 'array' });
            const sheetNames = workbook.SheetNames;
            
            const sheetSelect = document.getElementById('sheetSelect');
            
            // Add new sheet names to dropdown
            sheetNames.forEach(sheetName => {
                if (!Array.from(sheetSelect.options).some(o => o.value === sheetName)) {
                    const option = document.createElement('option');
                    option.value = sheetName;
                    option.textContent = sheetName;
                    sheetSelect.appendChild(option);
                }
            });
            
            // Auto-select first sheet
            if (sheetNames.length > 0 && !sheetSelect.value) {
                sheetSelect.value = sheetNames[0];
                loadSheetForMapping();
            }
        } catch (error) {
            Api.showNotification('Error reading Excel file: ' + error.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Load sheet for mapping (with existing data) - FIXED with TRIM
async function loadSheetForMapping() {
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    let agentId;
    if (isAdmin) {
        const select = document.getElementById('mapAgentSelect');
        agentId = select ? select.value : null;
    } else {
        const hiddenInput = document.getElementById('mapAgentId');
        agentId = hiddenInput ? hiddenInput.value : "1";
    }
    
    const sheetSelect = document.getElementById('sheetSelect');
    const sheetName = sheetSelect ? sheetSelect.value : '';
    
    if (!agentId || !sheetName) {
        document.getElementById('mappingFormContainer').style.display = 'none';
        return;
    }
    
    currentSheet = sheetName;
    document.getElementById('currentSheetName').textContent = sheetName;
    
    try {
        // Load existing mappings for this sheet
        let existingMappings = {};
        try {
            const mappings = await Api.mappings.getForSheet(parseInt(agentId), sheetName);
            if (mappings && typeof mappings === 'object') {
                existingMappings = mappings;
            }
        } catch (mappingError) {
            console.log('No existing mappings found for this sheet:', mappingError.message);
            // Continue with empty mappings
        }
        
        // Get Excel columns (if workbook loaded) - FIXED: TRIM columns
        let excelColumns = [];
        if (workbook) {
            try {
                const worksheet = workbook.Sheets[sheetName];
                const firstRow = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
                // TRIM all column names and remove duplicates
                excelColumns = (firstRow || [])
                    .map(col => String(col).trim())
                    .filter((col, index, self) => col && self.indexOf(col) === index);
            } catch (e) {
                console.warn('Could not read sheet from workbook:', e.message);
            }
        }
        
        // If no Excel columns from file, show empty options
        if (excelColumns.length === 0) {
            excelColumns = ['No columns detected - upload file first'];
        }
        
        // Render mapping form
        await renderMappingForm(excelColumns, existingMappings);
        
        document.getElementById('mappingFormContainer').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading sheet:', error);
        Api.showNotification('Error loading sheet: ' + error.message, 'error');
    }
}

// Render mapping form - FIXED with TRIM
async function renderMappingForm(excelColumns, existingMappings) {
    const standardFields = await getStandardFields();
    
    let html = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:15px;">';
    
    standardFields.forEach(field => {
        // TRIM the existing mapping value for comparison
        const currentValue = existingMappings[field.key] ? String(existingMappings[field.key]).trim() : '';
        
        html += `
            <div class="input-group">
                <label>${field.label} ${field.required ? '<span style="color:red">*</span>' : ''}</label>
                <select id="map_${field.key}" data-field="${field.key}">
                    <option value="">-- Not Mapped --</option>
                    ${excelColumns.map(col => {
                        const trimmedCol = String(col).trim();
                        return `
                            <option value="${trimmedCol}" ${currentValue === trimmedCol ? 'selected' : ''}>
                                ${trimmedCol}
                            </option>
                        `;
                    }).join('')}
                </select>
            </div>
        `;
    });
    
    html += '</div>';
    document.getElementById('mappingForm').innerHTML = html;
}

// Save mapping - FIXED with TRIM
async function saveMapping() {
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    let agentId;
    if (isAdmin) {
        const select = document.getElementById('mapAgentSelect');
        agentId = select ? parseInt(select.value) : null;
    } else {
        const hiddenInput = document.getElementById('mapAgentId');
        agentId = hiddenInput ? parseInt(hiddenInput.value) : 1;
    }
    const sheetName = currentSheet;
    
    if (!agentId || !sheetName) {
        Api.showNotification('Please select Agent ID and Sheet', 'error');
        return;
    }
    
    const mappings = {};
    const selects = document.querySelectorAll('#mappingForm select');
    
    selects.forEach(select => {
        const fieldKey = String(select.dataset.field).trim(); // TRIM field key
        const excelCol = String(select.value).trim(); // TRIM Excel column
        if (excelCol && excelCol !== '-- Not Mapped --') {
            mappings[fieldKey] = excelCol;
        }
    });
    
    if (!mappings.hbl_number) {
        Api.showNotification('HBL Number mapping is REQUIRED', 'error');
        return;
    }
    
    // Validate no duplicate Excel columns
    const excelColumns = Object.values(mappings);
    const uniqueColumns = new Set(excelColumns);
    if (excelColumns.length !== uniqueColumns.size) {
        Api.showNotification('❌ Error: Same Excel column mapped to multiple fields!', 'error');
        return;
    }
    
    try {
        const result = await Api.mappings.save(agentId, sheetName, mappings);
        
        if (result && result.saved) {
            Api.showNotification('✅ Mappings saved successfully!', 'success');
            await loadAllSheets(); // Refresh existing mappings list
            await loadSheetForMapping(); // Refresh current form
        } else {
            Api.showNotification(`❌ Error: ${result.detail || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        Api.showNotification(`Error: ${error.message}`, 'error');
    }
}

async function editSheet(sheetName) {
    const sheetSelect = document.getElementById('sheetSelect');
    if (sheetSelect) {
        sheetSelect.value = sheetName;
        await loadSheetForMapping();
    }
    // Scroll to mapping form
    const formContainer = document.getElementById('mappingFormContainer');
    if (formContainer) {
        formContainer.scrollIntoView({ behavior: 'smooth' });
    }
}
async function deleteAllMappings(sheetName) {
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    let agentId;
    if (isAdmin) {
        const select = document.getElementById('mapAgentSelect');
        agentId = select ? select.value : null;
    } else {
        const hiddenInput = document.getElementById('mapAgentId');
        agentId = hiddenInput ? hiddenInput.value : "1";
    }
    
    if (!agentId) {
        Api.showNotification('Please enter Agent ID first', 'error');
        return;
    }
    
    if (!confirm(`Delete ALL mappings for sheet "${sheetName}"?`)) return;
    
    try {
        await Api.mappings.delete(parseInt(agentId), sheetName);
        Api.showNotification('All mappings deleted!', 'success');
        await loadAllSheets();
    } catch (error) {
        Api.showNotification('Error deleting mappings: ' + error.message, 'error');
    }
}


async function getStandardFields() {
    try {
        const fields = await Api.fields.getAll();
        if (Array.isArray(fields) && fields.length > 0) {
            return fields.map(f => ({
                key: String(f.field_key).trim(),
                label: f.field_label,
                required: f.required
            }));
        }
    } catch (error) {
        console.error('Failed to load fields from API:', error);
        // Fallback to default fields
    }
    
    // Default fields if API fails or returns empty
    return [
        { key: 'hbl_number', label: 'HBL Number', required: true },
        { key: 'mbl_number', label: 'MBL Number', required: false },
        { key: 'po_number', label: 'PO Number', required: false },
        { key: 'consignee', label: 'Consignee', required: false },
        { key: 'eta', label: 'ETA', required: false },
        { key: 'vessel_name', label: 'Vessel Name', required: false },
        { key: 'voyage_no', label: 'Voyage No', required: false },
        { key: 'clearance_status', label: 'Clearance Status', required: false }
    ];
}

async function loadMappingAgents() {
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    if (!isAdmin) return; // Business users use Agent ID 1
    
    try {
        const agents = await Api.agents.getAll();
        const select = document.getElementById('mapAgentSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Select Agent --</option>';
        
        agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.agent_id;
            option.textContent = `${agent.agent_name} (${agent.agent_code})`;
            select.appendChild(option);
        });
        
        // Auto-select first agent and load sheets
        if (agents.length > 0) {
            select.value = agents[0].agent_id;
            setTimeout(() => loadAllSheets(), 100);
        }
        
    } catch (error) {
        console.error('Error loading agents for mapping:', error);
        const select = document.getElementById('mapAgentSelect');
        if (select) {
            select.innerHTML = '<option value="">Error loading agents</option>';
        }
    }
}

// Make functions globally available
window.loadMapping = loadMapping;
window.handleFileUpload = handleFileUpload;
window.loadSheetForMapping = loadSheetForMapping;
window.saveMapping = saveMapping;
window.editSheet = editSheet;
window.deleteAllMappings = deleteAllMappings;
window.loadAllSheets = loadAllSheets;
window.loadMappingAgents = loadMappingAgents;

