let detectedSheets = [];
let selectedSheets = new Set();

function loadUpload() {
    document.getElementById('content-area').innerHTML = `
        <div class="upload-container">
            <h2><i class="fas fa-file-upload"></i> Upload Excel File</h2>
            <p>Upload your shipment data from Excel files</p>
            
            <div class="input-group">
                <label>Select Excel File</label>
                <input type="file" id="excelFile" accept=".xlsx,.xls" class="file-input-field">
            </div>
            
            <div id="sheetsSection" style="display:none; margin-top:20px;">
                <label>Select Sheets to Import:</label>
                <div id="sheetsList" class="sheets-list"></div>
            </div>
            
            <button class="btn-primary" onclick="uploadExcel()" id="uploadBtn" style="margin-top:20px;">
                <i class="fas fa-upload"></i> Upload Selected Sheets
            </button>
            
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
            showNotification('Error reading Excel file: ' + error.message, 'error');
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

async function uploadExcel() {
    const agentId = document.getElementById('agentId').value;
    const fileInput = document.getElementById('excelFile');
    
    if (!agentId) {
        showNotification('Please enter Agent ID first', 'error');
        return;
    }
    
    if (!fileInput || !fileInput.files[0]) {
        showNotification('Please select an Excel file', 'error');
        return;
    }
    
    if (selectedSheets.size === 0) {
        showNotification('Please select at least one sheet', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("agent_id", agentId);
    formData.append("sheets", Array.from(selectedSheets).join(","));

    document.getElementById("uploadStatus").innerHTML = "Uploading...";

    try {
        const res = await fetch("http://127.0.0.1:8000/uploads/excel", {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        document.getElementById("uploadStatus").innerHTML = 
            `✅ Processed ${data.rows_processed || 0} rows`;
            
        if (data.errors && data.errors.length > 0) {
            document.getElementById("uploadStatus").innerHTML += 
                `<br><small>With ${data.errors.length} errors</small>`;
        }
    } catch (error) {
        document.getElementById("uploadStatus").innerHTML = 
            `❌ Error: ${error.message}`;
    }
}

// Make functions globally available
window.loadUpload = loadUpload;
window.toggleSheet = toggleSheet;
window.uploadExcel = uploadExcel;
window.detectSheets = detectSheets;