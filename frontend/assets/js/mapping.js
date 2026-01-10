function loadMapping() {
    document.getElementById('content-area').innerHTML = `
        <div class="upload-container">
            <h2><i class="fas fa-columns"></i> Column Mapping</h2>
            <p>Manage Excel column mappings</p>
            
            <div class="input-group">
                <label>Agent ID</label>
                <input type="number" id="mapAgentId" placeholder="Agent ID" value="1" onchange="loadAllSheets()">
            </div>
            
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
    
    // Load existing sheets and mappings
    loadAllSheets();
    
    // Setup file input
    const fileInput = document.getElementById('mappingFile');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            if (e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
            }
        });
    }
}

let workbook = null;
let currentSheet = '';

// Load all sheets that have mappings for this agent
async function loadAllSheets() {
    const agentId = document.getElementById('mapAgentId').value;
    if (!agentId) return;
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/mappings/all?agent_id=${agentId}`);
        let mappingsData = [];
        
        if (response.ok) {
            mappingsData = await response.json();
        }
        
        // Group by sheet_name
        const sheets = {};
        mappingsData.forEach(mapping => {
            if (!sheets[mapping.sheet_name]) {
                sheets[mapping.sheet_name] = [];
            }
            sheets[mapping.sheet_name].push(mapping);
        });
        
        // Display all existing mappings
        let html = '';
        if (Object.keys(sheets).length > 0) {
            Object.keys(sheets).forEach(sheetName => {
                html += `
                    <div style="background:white; border-radius:8px; padding:15px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <h4 style="margin:0;"><i class="fas fa-table"></i> ${sheetName}</h4>
                            <div>
                                <button class="btn-secondary" onclick="editSheet('${sheetName}')" style="margin-right:5px;">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn-icon" onclick="deleteAllMappings('${sheetName}')" style="color:var(--danger);">
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
            '<p style="color:var(--danger);">Error loading mappings: ' + error.message + '</p>';
    }
}

// Handle file upload - FIXED with TRIM
function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
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
    };
    reader.readAsArrayBuffer(file);
}

// Load sheet for mapping (with existing data) - FIXED with TRIM
async function loadSheetForMapping() {
    const agentId = document.getElementById('mapAgentId').value;
    const sheetName = document.getElementById('sheetSelect').value;
    
    if (!agentId || !sheetName) {
        document.getElementById('mappingFormContainer').style.display = 'none';
        return;
    }
    
    currentSheet = sheetName;
    document.getElementById('currentSheetName').textContent = sheetName;
    
    try {
        // Load existing mappings for this sheet
        const response = await fetch(
            `http://127.0.0.1:8000/mappings/?agent_id=${agentId}&sheet_name=${encodeURIComponent(sheetName)}`
        );
        
        let existingMappings = {};
        if (response.ok) {
            existingMappings = await response.json();
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
            excelColumns = [];
        }
        
        // Render mapping form
        await renderMappingForm(excelColumns, existingMappings);
        
        document.getElementById('mappingFormContainer').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading sheet:', error);
        alert('Error loading sheet: ' + error.message);
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
    const agentId = document.getElementById('mapAgentId').value;
    const sheetName = currentSheet;
    
    if (!agentId || !sheetName) {
        alert('Please select Agent ID and Sheet');
        return;
    }
    
    const mappings = {};
    const selects = document.querySelectorAll('#mappingForm select');
    
    selects.forEach(select => {
        const fieldKey = String(select.dataset.field).trim(); // TRIM field key
        const excelCol = String(select.value).trim(); // TRIM Excel column
        if (excelCol) {
            mappings[fieldKey] = excelCol;
        }
    });
    
    if (!mappings.hbl_number) {
        alert('HBL Number mapping is REQUIRED');
        return;
    }
    
    // Validate no duplicate Excel columns
    const excelColumns = Object.values(mappings);
    const uniqueColumns = new Set(excelColumns);
    if (excelColumns.length !== uniqueColumns.size) {
        alert('❌ Error: Same Excel column mapped to multiple fields!');
        return;
    }
    
    try {
        const response = await fetch('http://127.0.0.1:8000/mappings/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent_id: parseInt(agentId),
                sheet_name: sheetName,
                mappings: mappings
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('✅ Mappings saved successfully!');
            loadAllSheets(); // Refresh existing mappings list
            loadSheetForMapping(); // Refresh current form
        } else {
            alert(`❌ Error: ${data.detail || 'Unknown error'}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

function editSheet(sheetName) {
    document.getElementById('sheetSelect').value = sheetName;
    loadSheetForMapping();
    // Scroll to mapping form
    document.getElementById('mappingFormContainer').scrollIntoView({ behavior: 'smooth' });
}

async function deleteAllMappings(sheetName) {
    const agentId = document.getElementById('mapAgentId').value;
    
    if (!confirm(`Delete ALL mappings for sheet "${sheetName}"?`)) return;
    
    try {
        const response = await fetch(
            `http://127.0.0.1:8000/mappings/?agent_id=${agentId}&sheet_name=${encodeURIComponent(sheetName)}`
        );
        
        if (response.ok) {
            const mappings = await response.json();
            
            // Delete each mapping
            for (const [stdCol] of Object.entries(mappings)) {
                await fetch(
                    `http://127.0.0.1:8000/mappings/${agentId}/${encodeURIComponent(sheetName)}/${stdCol}`,
                    { method: 'DELETE' }
                );
            }
            
            alert('All mappings deleted!');
            loadAllSheets();
        }
    } catch (error) {
        alert('Error deleting mappings: ' + error.message);
    }
}

async function getStandardFields() {
    try {
        const response = await fetch('http://127.0.0.1:8000/fields');
        if (response.ok) {
            const fields = await response.json();
            return fields.map(f => ({
                key: String(f.field_key).trim(),
                label: f.field_label,
                required: f.required
            }));
        }
    } catch (error) {
        console.error('Failed to load fields:', error);
    }
    
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

window.loadMapping = loadMapping;