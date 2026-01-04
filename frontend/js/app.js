const API_BASE = "http://127.0.0.1:8000";
let detectedSheets = [];
let selectedSheets = new Set();

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
            detectedSheets = workbook.SheetNames;
            
            // Clear and reset
            selectedSheets.clear();
            detectedSheets.forEach(sheet => selectedSheets.add(sheet));
            
            renderMultiSelect();
            
            document.getElementById("sheetsContainer").style.display = "block";
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
