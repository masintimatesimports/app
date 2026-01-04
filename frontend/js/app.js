const API_BASE = "http://127.0.0.1:8000";
let detectedSheets = [];
let selectedSheets = new Set();
let workbookGlobal = null;

const STANDARD_COLUMNS = [
    "hbl_number",
    "mbl_number",
    "po_number",
    "consignee",
    "eta",
    "vessel_name",
    "voyage_no",
    "clearance_status"
];

// --------------------
// Detect Sheets from Excel
// --------------------
function detectSheets() {
    const file = document.getElementById("excelFile").files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        alert("XLSX library not loaded. Please refresh the page.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const workbook = XLSX.read(e.target.result, { type: "array" });
            workbookGlobal = workbook;
            detectedSheets = workbook.SheetNames;
            
            // Clear selections - do NOT auto-select all sheets
            selectedSheets.clear();
            
            renderMultiSelect();
            
            document.getElementById("sheetsContainer").style.display = "block";
            // populate mapping sheet select and show mapping section
            populateMappingSheetSelect();
        } catch (error) {
            alert("Error reading Excel file: " + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderMultiSelect() {
    renderTags();
    renderDropdown();
}

function renderTags() {
    const tagsContainer = document.getElementById("selectedTags");
    tagsContainer.innerHTML = "";
    
    selectedSheets.forEach(sheet => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.innerHTML = `${sheet} <button onclick="removeSheet('${sheet}')" class="remove-tag">×</button>`;
        tagsContainer.appendChild(tag);
    });
}

function renderDropdown() {
    const dropdown = document.getElementById("selectDropdown");
    const search = document.getElementById("selectSearch").value.toLowerCase();
    
    dropdown.innerHTML = "";
    
    const filtered = detectedSheets.filter(sheet => 
        sheet.toLowerCase().includes(search)
    );
    
    if (filtered.length === 0) {
        dropdown.innerHTML = "<div class='dropdown-item'>No sheets found</div>";
        return;
    }
    
    filtered.forEach(sheet => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        if (selectedSheets.has(sheet)) {
            item.classList.add("selected");
        }
        
        item.textContent = sheet;
        item.onclick = () => toggleSheet(sheet);
        
        dropdown.appendChild(item);
    });
}

function toggleSheet(sheet) {
    if (selectedSheets.has(sheet)) {
        selectedSheets.delete(sheet);
    } else {
        selectedSheets.add(sheet);
    }
    renderMultiSelect();
}

function removeSheet(sheet) {
    selectedSheets.delete(sheet);
    renderMultiSelect();
}

// Toggle dropdown visibility
document.addEventListener("DOMContentLoaded", function() {
    const search = document.getElementById("selectSearch");
    const dropdown = document.getElementById("selectDropdown");
    
    search.addEventListener("focus", function() {
        dropdown.style.display = "block";
        renderDropdown();
    });
    
    search.addEventListener("input", function() {
        dropdown.style.display = "block";
        renderDropdown();
    });
    
    document.addEventListener("click", function(e) {
        if (!e.target.closest("#customMultiSelect")) {
            dropdown.style.display = "none";
        }
    });
});

    // --------------------
    // Column Mapping UI
    // --------------------
    function populateMappingSheetSelect() {
        const sel = document.getElementById("mappingSheetSelect");
        sel.innerHTML = "";
        detectedSheets.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            sel.appendChild(opt);
        });
        document.getElementById('mappingSection').style.display = 'block';
        sel.onchange = () => loadMappingForSheet(sel.value);
        // load first by default
        if (detectedSheets.length > 0) loadMappingForSheet(detectedSheets[0]);
    }

    function getExcelColumnsForSheet(sheetName) {
        if (!workbookGlobal) return [];
        const ws = workbookGlobal.Sheets[sheetName];
        if (!ws) return [];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const firstRow = rows && rows.length > 0 ? rows[0] : [];
        return firstRow.map(c => String(c));
    }

    async function loadMappingForSheet(sheetName) {
        const cols = getExcelColumnsForSheet(sheetName);
        // fetch existing mapping from backend
        const agentId = document.getElementById('agentId').value || '';
        let existing = {};
        if (agentId) {
            try {
                const res = await fetch(`${API_BASE}/mappings?agent_id=${agentId}&sheet_name=${encodeURIComponent(sheetName)}`);
                if (res.ok) existing = await res.json();
            } catch (e) {
                console.error('Error fetching existing mapping', e);
            }
        }
        renderMappingForm(cols, existing);
    }

    function renderMappingForm(excelColumns, existingMap) {
        const container = document.getElementById('mappingFormContainer');
        container.innerHTML = '';

        STANDARD_COLUMNS.forEach(std => {
            const row = document.createElement('div');
            row.className = 'mapping-row';
            const label = document.createElement('label');
            label.textContent = `Shipment field: ${std}`;
            const select = document.createElement('select');
            select.dataset.std = std;
            const noneOpt = document.createElement('option');
            noneOpt.value = 'None';
            noneOpt.textContent = 'None';
            select.appendChild(noneOpt);

            excelColumns.forEach(c => {
                const o = document.createElement('option');
                o.value = c;
                o.textContent = c;
                select.appendChild(o);
            });

            if (existingMap && existingMap[std]) {
                const val = existingMap[std];
                const match = Array.from(select.options).find(o => o.value === val);
                if (match) match.selected = true;
            }

            row.appendChild(label);
            row.appendChild(select);
            container.appendChild(row);
        });
    }

    async function saveMapping() {
        const agentIdRaw = document.getElementById('agentId').value;
        const sheet = document.getElementById('mappingSheetSelect').value;
        const agentId = Number(agentIdRaw);
        if (!agentIdRaw || !Number.isInteger(agentId) || agentId <= 0 || !sheet) {
            alert('Agent ID (positive integer) and sheet are required');
            return;
        }
        const selects = Array.from(document.querySelectorAll('#mappingFormContainer select'));
        const mappings = {};
        for (const s of selects) {
            const std = s.dataset.std;
            const val = s.value;
            if (val && val !== 'None') mappings[std] = val;
        }
        // validations
        if (!mappings.hbl_number) {
            document.getElementById('mappingStatus').textContent = '❌ hbl_number mapping is required';
            return;
        }
        const mappedCols = Object.values(mappings);
        const unique = new Set(mappedCols);
        if (mappedCols.length !== unique.size) {
            document.getElementById('mappingStatus').textContent = '❌ Same Excel column mapped more than once';
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/mappings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_id: agentId, sheet_name: sheet, mappings })
            });
            if (!res.ok) {
                const txt = await res.text();
                document.getElementById('mappingStatus').textContent = `Error saving mappings: ${res.status} ${txt}`;
                return;
            }
            const data = await res.json();
            document.getElementById('mappingStatus').textContent = '✅ Column mapping saved successfully';
        } catch (e) {
            console.error(e);
            document.getElementById('mappingStatus').textContent = `Error: ${e.message}`;
        }
    }

// --------------------
// Upload Excel
// --------------------
async function uploadExcel() {
    const agentId = document.getElementById("agentId").value;
    const file = document.getElementById("excelFile").files[0];
    
    const selectedSheetsList = Array.from(selectedSheets).join(",");

    if (!agentId || !file || !selectedSheetsList) {
        alert("Agent ID, file, and at least one sheet are required");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("agent_id", agentId);
    formData.append("sheets", selectedSheetsList);

    document.getElementById("uploadStatus").innerText = "Uploading...";

    try {
        const res = await fetch(`${API_BASE}/uploads/excel`, {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        document.getElementById("uploadStatus").innerText =
            `Processed ${data.rows_processed} rows`;
        console.log(data);
    } catch (error) {
        document.getElementById("uploadStatus").innerText = `Error: ${error.message}`;
        console.error(error);
    }
}

// --------------------
// Track Shipment
// --------------------
async function trackShipment() {
    const agentId = document.getElementById("agentId").value;
    const hbl = document.getElementById("trackHbl").value;

    if (!agentId || !hbl) {
        alert("Agent ID and HBL required");
        return;
    }

    try {
        const url = `${API_BASE}/shipments/${hbl}?agent_id=${agentId}`;
        console.log("Fetching from:", url);
        
        const res = await fetch(url);
        console.log("Response status:", res.status);
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log("Track result data:", data);
        
        const trackResultDiv = document.getElementById("trackResult");
        
        if (!Array.isArray(data) || data.length === 0) {
            trackResultDiv.innerHTML = "<p>No shipment found</p>";
            return;
        }
        
        const shipment = data[0];
        const statusClass = (shipment.clearance_status || 'pending').replace(/\s+/g, '-').toLowerCase();
        trackResultDiv.innerHTML = `
            <div class="shipment-card">
                <div class="shipment-header">
                    <h3>${shipment.hbl_number}</h3>
                    <span class="status-badge ${statusClass}">${shipment.clearance_status || 'Pending'}</span>
                </div>
                <div class="shipment-details">
                    <div class="detail-row">
                        <span class="label">MBL:</span>
                        <span class="value">${shipment.mbl_number || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">PO Number:</span>
                        <span class="value">${shipment.po_number || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Consignee:</span>
                        <span class="value">${shipment.consignee || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Vessel:</span>
                        <span class="value">${shipment.vessel_name || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Voyage:</span>
                        <span class="value">${shipment.voyage_no || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">ETA:</span>
                        <span class="value">${shipment.eta || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Last Upload:</span>
                        <span class="value">${new Date(shipment.last_excel_upload_at).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Error:", error);
        document.getElementById("trackResult").innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

// --------------------
// Update Status
// --------------------
async function updateStatus() {
    const agentId = document.getElementById("agentId").value;
    const hbl = document.getElementById("statusHbl").value;
    const status = document.getElementById("newStatus").value;

    if (!agentId || !hbl || !status) {
        alert("All fields required");
        return;
    }

    const res = await fetch(
        `${API_BASE}/shipments/${hbl}/status?agent_id=${agentId}&status=${status}`,
        { method: "PATCH" }
    );

    const data = await res.json();
    document.getElementById("statusResult").innerText =
        data.updated ? "Status updated successfully" : "Update failed";
}
