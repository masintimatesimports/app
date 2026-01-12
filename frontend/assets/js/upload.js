// upload.js - COMPLETE WORKING VERSION WITH AGENT SELECTION
let detectedSheets = [];
let selectedSheets = new Set();
let allAgents = [];

async function loadUpload() {
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    // Load all agents if admin
    if (isAdmin) {
        try {
            allAgents = await Api.agents.getAll();
        } catch (error) {
            console.error('Error loading agents:', error);
            allAgents = [];
        }
    }
    
    document.getElementById('content-area').innerHTML = `
        <div class="upload-container">
            <h2><i class="fas fa-file-upload"></i> Upload Excel File</h2>
            
            <!-- Agent Selection Section -->
            <div class="input-group">
                <label>Select Agent for Upload</label>
                ${isAdmin && allAgents.length > 0 ? `
                    <select id="uploadAgentSelect" class="agent-select" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
                        <option value="">-- Select Agent --</option>
                        ${allAgents.map(agent => `
                            <option value="${agent.agent_id}">${agent.agent_name} (${agent.agent_code})</option>
                        `).join('')}
                    </select>
                ` : `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="number" id="uploadAgentId" placeholder="Enter Agent ID" 
                               value="${document.getElementById('agentId')?.value || ''}"
                               style="flex:1; padding:10px; border:1px solid #ddd; border-radius:6px;">
                        <span style="font-size:0.9em; color:#64748b;">
                            (Current Agent: ${document.getElementById('agentId')?.value || 'Not set'})
                        </span>
                    </div>
                `}
            </div>
            
            <p>Upload your shipment data from Excel files</p>
            
            <!-- File Selection -->
            <div class="input-group">
                <label>Select Excel File</label>
                <input type="file" id="excelFile" accept=".xlsx,.xls" class="file-input-field">
            </div>
            
            <!-- Sheets Selection -->
            <div id="sheetsSection" style="display:none; margin-top:20px;">
                <label>Select Sheets to Import:</label>
                <div id="sheetsList" class="sheets-list"></div>
            </div>
            
            <!-- Upload Button -->
            <button class="btn-primary" onclick="uploadExcel()" id="uploadBtn" style="margin-top:20px;">
                <i class="fas fa-upload"></i> Upload Selected Sheets
            </button>
            
            <!-- Status Display -->
            <div id="uploadStatus" style="margin-top:20px;"></div>
        </div>
    `;
    
    setupFileInput();
}

function setupFileInput() {
    const fileInput = document.getElementById('excelFile');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            detectSheets(e.target.files[0]);
        });
    }
}

function detectSheets(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'array' });
            detectedSheets = workbook.SheetNames;
            selectedSheets.clear(); // Clear previous selections
            renderSheetsList();
            document.getElementById('sheetsSection').style.display = 'block';
        } catch (error) {
            Api.showNotification('Error reading Excel file: ' + error.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderSheetsList() {
    const container = document.getElementById('sheetsList');
    if (!container) return;
    
    container.innerHTML = detectedSheets.map(sheet => `
        <div class="sheet-item" onclick="toggleSheet('${sheet}')">
            <i class="fas fa-table"></i>
            <span>${sheet}</span>
            <i class="fas fa-check-circle" style="margin-left: auto; color: ${selectedSheets.has(sheet) ? '#10b981' : '#cbd5e1'}"></i>
        </div>
    `).join('');
}

function toggleSheet(sheet) {
    if (selectedSheets.has(sheet)) {
        selectedSheets.delete(sheet);
    } else {
        selectedSheets.add(sheet);
    }
    renderSheetsList();
}

// CRITICAL: Update the getAgentId function in api.js
// Add this method to your ApiService class in api.js:

async function uploadExcel() {
    // Get agent ID based on selection
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = user && user.role === 'admin';
    
    let agentId;
    if (isAdmin) {
        const select = document.getElementById('uploadAgentSelect');
        if (!select || !select.value) {
            Api.showNotification('Please select an agent from the dropdown', 'error');
            return;
        }
        agentId = parseInt(select.value);
    } else {
        // For non-admin, use the input field
        const input = document.getElementById('uploadAgentId');
        if (!input || !input.value) {
            Api.showNotification('Please enter Agent ID', 'error');
            return;
        }
        agentId = parseInt(input.value);
    }
    
    if (!agentId || isNaN(agentId) || agentId <= 0) {
        Api.showNotification('Invalid Agent ID', 'error');
        return;
    }
    
    const fileInput = document.getElementById('excelFile');
    
    if (!fileInput || !fileInput.files[0]) {
        Api.showNotification('Please select an Excel file', 'error');
        return;
    }
    
    if (selectedSheets.size === 0) {
        Api.showNotification('Please select at least one sheet', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("agent_id", agentId);
    formData.append("sheets", Array.from(selectedSheets).join(","));

    const uploadStatus = document.getElementById("uploadStatus");
    if (uploadStatus) {
        uploadStatus.innerHTML = '<div style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Uploading...</div>';
    }

    // Disable upload button during upload
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    }

    try {
        const data = await Api.uploads.excel(formData);
        
        if (uploadStatus) {
            if (data.rows_processed > 0) {
                uploadStatus.innerHTML = `
                    <div style="background:#d1fae5; color:#065f46; padding:15px; border-radius:6px; text-align:center;">
                        <i class="fas fa-check-circle"></i> Successfully processed ${data.rows_processed} rows
                    </div>
                `;
            } else {
                uploadStatus.innerHTML = `
                    <div style="background:#fef3c7; color:#92400e; padding:15px; border-radius:6px; text-align:center;">
                        <i class="fas fa-exclamation-triangle"></i> No rows processed. Check your Excel format.
                    </div>
                `;
            }
            
            if (data.errors && data.errors.length > 0) {
                uploadStatus.innerHTML += `
                    <div style="margin-top:10px; color:#dc2626;">
                        <strong>Errors:</strong>
                        <ul style="text-align:left; font-size:0.9em;">
                            ${data.errors.slice(0, 5).map(error => `<li>${error.error || error}</li>`).join('')}
                            ${data.errors.length > 5 ? `<li>...and ${data.errors.length - 5} more errors</li>` : ''}
                        </ul>
                    </div>
                `;
            }
        }
        
        // Refresh dashboard stats if on dashboard
        if (typeof loadDashboardStats === 'function') {
            setTimeout(loadDashboardStats, 1000);
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        if (uploadStatus) {
            uploadStatus.innerHTML = `
                <div style="background:#fee2e2; color:#dc2626; padding:15px; border-radius:6px; text-align:center;">
                    <i class="fas fa-exclamation-circle"></i> Error: ${error.message}
                </div>
            `;
        }
    } finally {
        // Re-enable upload button
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Selected Sheets';
        }
    }
}

// Make functions globally available
window.loadUpload = loadUpload;
window.toggleSheet = toggleSheet;
window.uploadExcel = uploadExcel;
window.detectSheets = detectSheets;