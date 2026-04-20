import { App } from "@modelcontextprotocol/ext-apps";

// Get element references
const stampsBtn = document.getElementById("stamps-btn")! as HTMLButtonElement;
const stampsTable = document.getElementById("stamps-table")!;
const fileInput = document.getElementById("file-input")! as HTMLInputElement;
const uploadBtn = document.getElementById("upload-btn")! as HTMLButtonElement;
const uploadResult = document.getElementById("upload-result")!;
const previewArea = document.getElementById("preview-area")!;
const historyBtn = document.getElementById("history-btn")! as HTMLButtonElement;
const historyTable = document.getElementById("history-table")!;

// Tab elements
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");

// Tab switching
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const tabName = (tab as HTMLElement).dataset.tab;
    
    // Remove active class from all tabs and contents
    tabs.forEach((t) => t.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));
    
    // Add active class to clicked tab and corresponding content
    tab.classList.add("active");
    document.getElementById(`${tabName}-tab`)?.classList.add("active");
  });
});

// Create app instance
const app = new App({ name: "Swarm MCP Interface", version: "1.0.0" });

// Modal upload elements
const modalFileInput = document.getElementById("modal-file-input")! as HTMLInputElement;
const modalUploadBtn = document.getElementById("modal-upload-btn")! as HTMLButtonElement;
const modalUploadResult = document.getElementById("modal-upload-result")!;
let modalActiveBatchId = "";

modalUploadBtn.addEventListener("click", () => {
  modalFileInput.value = "";
  modalFileInput.click();
});

modalFileInput.addEventListener("change", async () => {
  const file = modalFileInput.files?.[0];
  if (!file || !modalActiveBatchId) return;

  modalUploadBtn.disabled = true;
  modalUploadBtn.innerHTML = "<span>Uploading...</span>";
  modalUploadResult.innerHTML = '<span class="loading">Uploading to Swarm…</span>';

  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await app.callServerTool({
      name: "upload_file",
      arguments: {
        data: base64,
        isPath: false,
        name: file.name,
        postageBatchId: modalActiveBatchId,
      },
    });

    let reference = "";
    let url = "";
    if (response.structuredContent) {
      reference = response.structuredContent.reference || "";
      url = response.structuredContent.url || "";
    } else if (response.content?.[0]) {
      const parsed = JSON.parse(response.content[0].text);
      reference = parsed.reference || "";
      url = parsed.url || "";
    }

    modalUploadResult.innerHTML = `
      <p class="success" style="margin:0 0 0.4rem 0">✓ Uploaded: <strong>${file.name}</strong></p>
      <p style="margin:0 0 0.25rem 0;color:#94a3b8;font-size:0.8rem">Reference:</p>
      <p class="mono" style="margin:0 0 0.5rem 0">${reference}</p>
      <a href="${url}" target="_blank" style="color:#f97316;font-weight:600;font-size:0.875rem">${url}</a>
    `;
  } catch (err: any) {
    modalUploadResult.innerHTML = `<span class="error-msg">Upload failed: ${err.message}</span>`;
  } finally {
    modalUploadBtn.disabled = false;
    modalUploadBtn.innerHTML = "<span>Upload File to this Stamp</span>";
  }
});

// File selection handler
let selectedFile: File | null = null;
let fileBase64: string | null = null;

fileInput.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) {
    uploadBtn.disabled = true;
    selectedFile = null;
    fileBase64 = null;
    return;
  }

  selectedFile = file;
  uploadBtn.disabled = false;
  
  // Read file as base64
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64String = (e.target?.result as string).split(',')[1];
    fileBase64 = base64String;
  };
  reader.readAsDataURL(file);
  
  uploadResult.innerHTML = `<p style="color: #6b7280;">Selected: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(2)} KB)</p>`;
  previewArea.style.display = "none";
});

// Handle List Stamps button
stampsBtn.addEventListener("click", async () => {
  stampsBtn.disabled = true;
  stampsBtn.innerHTML = "<span>Loading...</span>";
  stampsTable.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const response = await app.callServerTool({ 
      name: "list_postage_stamps", 
      arguments: {} 
    });

    // Get selected stamps first
    let selectedStampsResponse;
    let selectedLabels: string[] = [];
    try {
      selectedStampsResponse = await app.callServerTool({
        name: "list_selected_stamps",
        arguments: {}
      });
      if (selectedStampsResponse.content && selectedStampsResponse.content[0]) {
        const parsed = JSON.parse(selectedStampsResponse.content[0].text);
        selectedLabels = parsed.selectedStamps || [];
      }
    } catch (error) {
      console.error('Failed to load selected stamps:', error);
    }

    // Extract structured data
    let stamps: any[] = [];
    let rawData: any[] = [];
    
    if (response.structuredContent) {
      if (response.structuredContent.summary) {
        stamps = response.structuredContent.summary;
      }
      if (response.structuredContent.raw) {
        rawData = response.structuredContent.raw;
      }
    } else if (response.content && response.content[0]) {
      const parsed = JSON.parse(response.content[0].text);
      stamps = parsed.summary || [];
      rawData = parsed.raw || [];
    }

    if (stamps.length === 0) {
      stampsTable.innerHTML = '<p class="loading">No postage stamps available.</p>';
    } else {
      // Build table from raw data (more detailed)
      let tableHTML = '<table><thead><tr>';
      tableHTML += '<th style="width: 40px;"></th>';
      tableHTML += '<th>Label</th>';
      tableHTML += '<th>Batch ID</th>';
      tableHTML += '<th>Depth</th>';
      tableHTML += '<th>Utilization</th>';
      tableHTML += '<th>Immutable</th>';
      tableHTML += '<th>Usage</th>';
      tableHTML += '<th>Size</th>';
      tableHTML += '<th>Remaining</th>';
      tableHTML += '<th>Duration (days)</th>';
      tableHTML += '</tr></thead><tbody>';

      (rawData.length > 0 ? rawData : stamps).forEach((stamp: any, index: number) => {
        const label = stamp.label || '-';
        const isSelected = selectedLabels.includes(label);
        const batchId = stamp.batchID || stamp.stampID || 'N/A';
        const displayBatchId = batchId !== 'N/A' && batchId.length > 8 
          ? `${batchId.slice(0, 8)}…${batchId.slice(-8)}` 
          : batchId;
        const sizeMB = stamp.size?.bytes ? (stamp.size.bytes / 1_000_000).toFixed(2) + ' MB' : 'N/A';
        const remainingMB = stamp.remainingSize?.bytes ? (stamp.remainingSize.bytes / 1_000_000).toFixed(2) + ' MB' : 'N/A';
        const durationDays = stamp.duration?.seconds ? (stamp.duration.seconds / 86400).toFixed(1) + 'd' : 'N/A';
        const immutable = stamp.immutableFlag ? '<span class="usable-yes">Yes</span>' : '<span style="color:#94a3b8">No</span>';
        tableHTML += `<tr data-batch-id="${batchId}">`;
        tableHTML += `<td><input type="checkbox" class="stamp-checkbox" data-batch-id="${batchId}" ${isSelected ? 'checked' : ''} /></td>`;
        tableHTML += `<td><button class="stamp-label-btn" data-batch-id="${batchId}">${label || '<em style="color:#64748b">no label</em>'}</button></td>`;
        tableHTML += `<td class="batch-id" title="${batchId}">${displayBatchId}</td>`;
        tableHTML += `<td>${stamp.depth ?? 'N/A'}</td>`;
        tableHTML += `<td>${stamp.utilization ?? 'N/A'}</td>`;
        tableHTML += `<td>${immutable}</td>`;
        tableHTML += `<td>${stamp.usageText ?? 'N/A'}</td>`;
        tableHTML += `<td>${sizeMB}</td>`;
        tableHTML += `<td>${remainingMB}</td>`;
        tableHTML += `<td>${durationDays}</td>`;
        tableHTML += '</tr>';
      });

      tableHTML += '</tbody></table>';
      stampsTable.innerHTML = tableHTML;

      // Store stamps data on window for modal access
      (window as any).__stampsRawData = rawData.length > 0 ? rawData : stamps;

      // Add label click listeners for detail modal
      const labelBtns = document.querySelectorAll('.stamp-label-btn') as NodeListOf<HTMLButtonElement>;
      labelBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const batchId = (e.currentTarget as HTMLButtonElement).dataset.batchId || '';
          const allStamps = (window as any).__stampsRawData as any[];
          const stamp = allStamps.find((s: any) => (s.batchID || s.stampID) === batchId);
          if (!stamp) return;

          const sizeMB = stamp.size?.bytes ? (stamp.size.bytes / 1_000_000).toFixed(3) + ' MB' : 'N/A';
          const remainingMB = stamp.remainingSize?.bytes ? (stamp.remainingSize.bytes / 1_000_000).toFixed(3) + ' MB' : 'N/A';
          const theoreticalMB = stamp.theoreticalSize?.bytes ? (stamp.theoreticalSize.bytes / 1_000_000).toFixed(0) + ' MB' : 'N/A';
          const durationDays = stamp.duration?.seconds ? (stamp.duration.seconds / 86400).toFixed(1) + ' days' : 'N/A';
          const usagePct = typeof stamp.usage === 'number' ? Math.round(stamp.usage * 100) : 0;

          modalActiveBatchId = batchId;
          modalUploadResult.innerHTML = "";
          document.getElementById('modal-title')!.textContent = stamp.label ? `Stamp: ${stamp.label}` : 'Stamp Details';
          document.getElementById('modal-body')!.innerHTML = `
            <div class="detail-row full">
              <span class="detail-label">Batch ID</span>
              <span class="detail-value mono">${stamp.batchID || stamp.stampID || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Label</span>
              <span class="detail-value">${stamp.label || '—'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Depth</span>
              <span class="detail-value">${stamp.depth ?? 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Bucket Depth</span>
              <span class="detail-value">${stamp.bucketDepth ?? 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Utilization</span>
              <span class="detail-value">${stamp.utilization ?? 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Immutable</span>
              <span class="detail-value" style="color:${stamp.immutableFlag ? '#10b981' : '#94a3b8'}">${stamp.immutableFlag ? 'Yes' : 'No'}</span>
            </div>
            <div class="detail-row full">
              <span class="detail-label">Usage — ${stamp.usageText ?? usagePct + '%'}</span>
              <div class="detail-bar-wrap"><div class="detail-bar" style="width:${usagePct}%"></div></div>
            </div>
            <div class="detail-row">
              <span class="detail-label">Used Size</span>
              <span class="detail-value">${sizeMB}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Remaining</span>
              <span class="detail-value">${remainingMB}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Theoretical Max</span>
              <span class="detail-value">${theoreticalMB}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Duration Left</span>
              <span class="detail-value">${durationDays}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Block Number</span>
              <span class="detail-value mono">${stamp.blockNumber ?? 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Amount</span>
              <span class="detail-value mono">${stamp.amount ?? 'N/A'}</span>
            </div>
          `;
          document.getElementById('stamp-modal')!.classList.add('open');
        });
      });

      // Modal close
      document.getElementById('modal-close')!.onclick = () =>
        document.getElementById('stamp-modal')!.classList.remove('open');
      document.getElementById('stamp-modal')!.addEventListener('click', (e) => {
        if (e.target === e.currentTarget)
          (e.currentTarget as HTMLElement).classList.remove('open');
      });

      // Add checkbox event listeners
      const checkboxes = document.querySelectorAll('.stamp-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', async (e) => {
          const target = e.target as HTMLInputElement;
          const batchId = target.dataset.batchId || '';
          const isChecked = target.checked;
          
          // Find the label from the stamps data
          const stamp = (rawData.length > 0 ? rawData : stamps).find((s: any) => 
            (s.batchID || s.stampID) === batchId
          );
          const label = stamp?.label || batchId;
          
          try {
            await app.callServerTool({
              name: "select_postage_stamp",
              arguments: {
                label: label,
                selected: isChecked
              }
            });
          } catch (error) {
            console.error('Failed to update stamp selection:', error);
            // Revert checkbox state on error
            target.checked = !isChecked;
          }
        });
      });
    }
  } catch (error: any) {
    stampsTable.innerHTML = `<div class="error">Error loading stamps: ${error.message}</div>`;
    console.error(error);
  } finally {
    stampsBtn.disabled = false;
    stampsBtn.innerHTML = "<span>Load Postage Stamps</span>";
  }
});

// Handle Upload File button
uploadBtn.addEventListener("click", async () => {
  if (!selectedFile || !fileBase64) {
    uploadResult.innerHTML = '<div class="error">No file selected</div>';
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.innerHTML = "<span>Uploading...</span>";
  uploadResult.innerHTML = '<p class="loading">Uploading to Swarm...</p>';
  previewArea.style.display = "none";

  try {
    const response = await app.callServerTool({
      name: "upload_file",
      arguments: {
        data: fileBase64,
        isPath: false,
        name: selectedFile.name
      }
    });

    // Extract upload result
    let reference = "";
    let url = "";
    let message = "";

    if (response.structuredContent) {
      reference = response.structuredContent.reference || "";
      url = response.structuredContent.url || "";
      message = response.structuredContent.message || "Upload successful";
    } else if (response.content && response.content[0]) {
      const parsed = JSON.parse(response.content[0].text);
      reference = parsed.reference || "";
      url = parsed.url || "";
      message = parsed.message || "Upload successful";
    }

    // Display result
    let html = '<div class="file-info">';
    html += `<p style="margin: 0 0 0.5rem 0; color: #059669; font-weight: 600;">✓ ${message}</p>`;
    html += `<p style="margin: 0 0 0.5rem 0;"><strong>File:</strong> ${selectedFile.name}</p>`;
    html += `<p style="margin: 0 0 0.5rem 0;"><strong>Reference:</strong> <code style="background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.85rem;">${reference}</code></p>`;
    html += `<p style="margin: 0;"><strong>URL:</strong> <a href="${url}" target="_blank" class="swarm-link">${url}</a></p>`;
    html += '</div>';

    // Display full response
    html += `<details style="margin-top: 1rem;"><summary style="cursor: pointer; font-weight: 600; margin-bottom: 0.5rem;">Full Response</summary>`;
    html += `<pre style="background: #1f2937; color: #e5e7eb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.85rem;">${JSON.stringify(response, null, 2)}</pre>`;
    html += `</details>`;

    uploadResult.innerHTML = html;

    // Preview - try to display as image (check file type OR extension)
    const fileName = selectedFile.name.toLowerCase();
    const isImageExtension = fileName.endsWith('.png') || fileName.endsWith('.jpg') || 
                             fileName.endsWith('.jpeg') || fileName.endsWith('.gif') || 
                             fileName.endsWith('.webp') || fileName.endsWith('.svg') ||
                             fileName.endsWith('.bmp');
    
    const isProbablyImage = selectedFile.type.startsWith("image/") || isImageExtension;
    
    previewArea.style.display = "block";
    
    if (isProbablyImage && fileBase64) {
      // Show image preview from base64 (more reliable than Swarm URL immediately)
      const dataUrl = `data:${selectedFile.type || 'image/png'};base64,${fileBase64}`;
      
      let previewHtml = '<div style="width: 100%;">';
      previewHtml += '<h3 style="margin: 0 0 1rem 0; color: #374151;">Preview:</h3>';
      previewHtml += `<img src="${dataUrl}" alt="${selectedFile.name}" style="max-width: 100%; max-height: 400px; border-radius: 0.5rem; margin-bottom: 1rem;" />`;
      previewHtml += '<div style="display: flex; gap: 0.5rem; justify-content: center;">';
      previewHtml += `<button id="open-btn" style="display: inline-block; padding: 0.5rem 1rem; background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600; border: none; cursor: pointer;"><span>Open in Browser</span></button>`;
      previewHtml += '</div>';
      previewHtml += '</div>';;
      
      previewArea.innerHTML = previewHtml;
      
      // Add click handler
      document.getElementById('open-btn')?.addEventListener('click', async () => {
        try {
          await app.callServerTool({ name: "open_url", arguments: { url } });
        } catch (error) {
          console.error('Failed to open URL:', error);
        }
      });
    } else {
      // Non-image file - just show open option
      let previewHtml = '<div style="width: 100%; text-align: center;">';
      previewHtml += '<p style="color: #6b7280; margin-bottom: 1rem;">✓ File uploaded successfully</p>';
      previewHtml += '<div style="display: flex; gap: 0.5rem; justify-content: center;">';
      previewHtml += `<button id="open-btn" style="display: inline-block; padding: 0.5rem 1rem; background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600; border: none; cursor: pointer;"><span>Open in Browser</span></button>`;
      previewHtml += '</div>';
      previewHtml += '</div>';
      
      previewArea.innerHTML = previewHtml;
      
      // Add click handler
      document.getElementById('open-btn')?.addEventListener('click', async () => {
        try {
          await app.callServerTool({ name: "open_url", arguments: { url } });
        } catch (error) {
          console.error('Failed to open URL:', error);
        }
      });
    }

  } catch (error: any) {
    uploadResult.innerHTML = `<div class="error">Upload failed: ${error.message}</div>`;
    console.error(error);
  } finally {
    uploadBtn.disabled = fileBase64 === null;
    uploadBtn.innerHTML = "<span>Upload to Swarm</span>";
  }
});

// Connect to host
app.connect();

// --- Upload History ---

async function loadHistory() {
  historyBtn.disabled = true;
  historyBtn.innerHTML = "<span>Loading...</span>";
  historyTable.innerHTML = '<div class="loading">Loading history...</div>';

  try {
    const response = await app.callServerTool({
      name: "list_upload_history",
      arguments: {}
    });

    let entries: any[] = [];
    if (response.structuredContent?.history) {
      entries = response.structuredContent.history;
    } else if (response.content?.[0]) {
      const parsed = JSON.parse(response.content[0].text);
      entries = parsed.history || [];
    }

    if (entries.length === 0) {
      historyTable.innerHTML = '<p class="loading">No uploads yet in this session.</p>';
      return;
    }

    let html = '<table><thead><tr>';
    html += '<th>#</th><th>File Name</th><th>Reference</th><th>Size</th><th>Time</th><th></th>';
    html += '</tr></thead><tbody>';

    entries.forEach((entry: any) => {
      const shortRef = entry.reference
        ? `${entry.reference.slice(0, 8)}…${entry.reference.slice(-8)}`
        : 'N/A';
      const name = entry.name ? `<strong>${entry.name}</strong><br>` : '';
      const sizeKB = entry.sizeBytes != null
        ? (entry.sizeBytes / 1024).toFixed(1) + ' KB'
        : '—';
      const time = entry.timestamp
        ? new Date(entry.timestamp).toLocaleTimeString()
        : '—';
      const typeBadge = entry.type === 'file'
        ? '📁'
        : entry.type === 'folder'
          ? '📂'
          : '📄';
      const displayName = entry.name
        ? `${typeBadge} ${entry.name}`
        : `${typeBadge} <span style="color:#64748b;font-style:italic">${entry.type}</span>`;

      html += `<tr>`;
      html += `<td style="color:#64748b;font-size:0.85rem">${entry.id}</td>`;
      html += `<td>${displayName}</td>`;
      html += `<td class="batch-id"><span title="${entry.reference}">${shortRef}</span></td>`;
      html += `<td>${sizeKB}</td>`;
      html += `<td style="white-space:nowrap">${time}</td>`;
      html += `<td><a href="${entry.url}" target="_blank" class="swarm-link" style="font-size:0.85rem">Open ↗</a></td>`;
      html += `</tr>`;
    });

    html += '</tbody></table>';
    historyTable.innerHTML = html;
  } catch (error: any) {
    historyTable.innerHTML = `<div class="error">Failed to load history: ${error.message}</div>`;
  } finally {
    historyBtn.disabled = false;
    historyBtn.innerHTML = "<span>Refresh History</span>";
  }
}

historyBtn.addEventListener("click", loadHistory);

// Auto-load history when switching to History tab
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    if ((tab as HTMLElement).dataset.tab === "history") {
      loadHistory();
    }
  });
});
