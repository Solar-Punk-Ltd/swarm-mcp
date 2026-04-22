import { App } from "@modelcontextprotocol/ext-apps";

// ---------------------------------------------------------------------------
// Element references
// ---------------------------------------------------------------------------
const stampsTable = document.getElementById("stamps-table")!;
const buyStampBtn = document.getElementById("buy-stamp-btn")! as HTMLButtonElement;
const fileInput = document.getElementById("file-input")! as HTMLInputElement;
const uploadBtn = document.getElementById("upload-btn")! as HTMLButtonElement;
const uploadResult = document.getElementById("upload-result")!;
const previewArea = document.getElementById("preview-area")!;
const fileNameDisplay = document.getElementById("file-name-display")!;
const selectAssetBtn = document.getElementById("select-asset-btn")! as HTMLButtonElement;
// Upload step UI
const uploadStep1El = document.getElementById("upload-step-1")!;
const uploadStep2El = document.getElementById("upload-step-2")!;
const uploadStampList = document.getElementById("upload-stamp-list")!;
const uploadContinueBtn = document.getElementById("upload-continue-btn")! as HTMLButtonElement;
const uploadSelectedStampLabel = document.getElementById("upload-selected-stamp-label")!;
const uploadChangeStampBtn = document.getElementById("upload-change-stamp-btn")! as HTMLButtonElement;
const uploadStep1Indicator = document.getElementById("upload-step-1-indicator")!;
const uploadStep2Indicator = document.getElementById("upload-step-2-indicator")!;
const historyTable = document.getElementById("history-table")!;
const historyBtn = document.getElementById("history-btn")! as HTMLButtonElement;

// Stamp modal
const stampModal = document.getElementById("stamp-modal")!;
const modalTitle = document.getElementById("modal-title")!;
const modalBody = document.getElementById("modal-body")!;
const modalClose = document.getElementById("modal-close")!;
const modalFileInput = document.getElementById("modal-file-input")! as HTMLInputElement;
const modalUploadBtn = document.getElementById("modal-upload-btn")! as HTMLButtonElement;
const modalUploadResult = document.getElementById("modal-upload-result")!;
const extendSubmitBtn = document.getElementById("extend-submit-btn")! as HTMLButtonElement;
const extendSizeInput = document.getElementById("extend-size")! as HTMLInputElement;
const extendDurationInput = document.getElementById("extend-duration")! as HTMLInputElement;
const extendResult = document.getElementById("extend-result")!;

// Buy stamp modal
const buyStampModal = document.getElementById("buy-stamp-modal")!;
const buyModalClose = document.getElementById("buy-modal-close")!;
const buySizeInput = document.getElementById("buy-size")! as HTMLInputElement;
const buyDurationInput = document.getElementById("buy-duration")! as HTMLInputElement;
const buyLabelInput = document.getElementById("buy-label")! as HTMLInputElement;
const buySubmitBtn = document.getElementById("buy-submit-btn")! as HTMLButtonElement;
const buyResult = document.getElementById("buy-result")!;
const buyCostEstimate = document.getElementById("buy-cost-estimate")!;
const buyCostValue = document.getElementById("buy-cost-value")!;

// History item modal
const histItemModal = document.getElementById("hist-item-modal")!;
const histItemClose = document.getElementById("hist-item-close")!;
const hiName = document.getElementById("hi-name")!;
const hiReference = document.getElementById("hi-reference")!;
const hiSize = document.getElementById("hi-size")!;
const hiDate = document.getElementById("hi-date")!;
const hiTime = document.getElementById("hi-time")!;
const hiStamp = document.getElementById("hi-stamp")!;
const hiUrl = document.getElementById("hi-url")! as HTMLAnchorElement;
const hiCopyBtn = document.getElementById("hi-copy-btn")! as HTMLButtonElement;

// ---------------------------------------------------------------------------
// App instance + SDK type helpers
// ---------------------------------------------------------------------------
const app = new App({ name: "Swarm MCP Interface", version: "1.0.0" });

// structuredContent is typed as {} in newer SDK builds — cast via helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sc = (r: { structuredContent?: unknown }): any => (r.structuredContent ?? {}) as any;
// content items are a union type that may not have .text — access safely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tc = (content: unknown[]): string => ((content?.[0]) as any)?.text ?? "";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMB(bytes?: number): string {
  if (bytes == null || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / 1_000_000;
  if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
  if (mb < 1000) return `${mb.toFixed(2)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

type TTLSeverity = "ok" | "warn" | "critical";
function ttlFromSeconds(seconds?: number): { text: string; severity: TTLSeverity } {
  if (!seconds || seconds <= 0) return { text: "expired", severity: "critical" };
  const days = seconds / 86400;
  if (days <= 3) {
    if (seconds < 3600) return { text: `${Math.max(1, Math.round(seconds / 60))} min`, severity: "critical" };
    return { text: `${(seconds / 3600).toFixed(1)} hrs`, severity: "critical" };
  }
  const display = days < 10 ? days.toFixed(1) : Math.round(days).toString();
  return { text: `${display} days`, severity: days <= 14 ? "warn" : "ok" };
}

// ---------------------------------------------------------------------------
// Tabs  (new-tab / new-tab-content classes)
// ---------------------------------------------------------------------------
const tabs = document.querySelectorAll<HTMLButtonElement>(".new-tab");
const tabContents = document.querySelectorAll<HTMLElement>(".new-tab-content");

function activateTab(name: string) {
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  tabContents.forEach((c) => c.classList.toggle("active", c.id === `${name}-tab`));
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    if (!name) return;
    activateTab(name);
    if (name === "stamps") loadStamps();
    if (name === "history") loadHistory();
    if (name === "status") loadNodeStatus();
    if (name === "upload") {
      resetUploadWorkflow();
      if (lastStampsData.length === 0) {
        loadStamps().then(() => renderUploadStampPicker()).catch(() => {});
      } else {
        renderUploadStampPicker();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Modal helpers
// ---------------------------------------------------------------------------
function openModal(el: HTMLElement)  { el.classList.add("open"); }
function closeModal(el: HTMLElement) { el.classList.remove("open"); }

[stampModal, buyStampModal].forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal(overlay as HTMLElement);
  });
});
modalClose.addEventListener("click",   () => closeModal(stampModal));
buyModalClose.addEventListener("click", () => closeModal(buyStampModal));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModal(stampModal); closeModal(buyStampModal); }
});

// ---------------------------------------------------------------------------
// Stamps list
// ---------------------------------------------------------------------------
let lastStampsData: any[] = [];
let modalActiveBatchId = "";

function renderStampCard(stamp: any): string {
  const batchId  = stamp.batchID || stamp.stampID || "";
  const label    = stamp.label || "unlabeled";
  const usagePct = typeof stamp.usage === "number" ? Math.round(stamp.usage * 100) : 0;
  const sizeBytes      = stamp.size?.bytes ?? 0;
  const remainingBytes = stamp.remainingSize?.bytes ?? 0;
  const usedBytes      = Math.max(0, sizeBytes - remainingBytes);
  const { text: ttlText, severity } = ttlFromSeconds(stamp.duration?.seconds);
  const fillClass  = severity === "critical" ? "stamp-progress-bar-fill fill-critical" : "stamp-progress-bar-fill";
  const sizeLabel  = `${formatMB(usedBytes)} / ${formatMB(sizeBytes)}`;

  return `
    <div class="stamp-card" data-batch-id="${esc(batchId)}">
      <div class="stamp-card-bar"></div>
      <div class="stamp-card-inner">
        <div class="stamp-label" title="${esc(label)}">${esc(label)}</div>
        <div class="stamp-progress-wrap">
          <div class="stamp-progress-bar-bg">
            <div class="${fillClass}" style="width:${usagePct}%"></div>
          </div>
          <div class="stamp-pct">${usagePct}%</div>
        </div>
        <div class="stamp-size-badge" title="${esc(sizeLabel)}">${esc(sizeLabel)}</div>
        <div class="stamp-ttl-badge ${severity}" title="${esc(ttlText)}">
          <div class="stamp-ttl-dot"></div>
          <span>${esc(ttlText)}</span>
        </div>
      </div>
    </div>`;
}

async function loadStamps() {
  stampsTable.innerHTML = `<div class="state-text">Loading postage stamps…</div>`;
  try {
    const response = await app.callServerTool({ name: "list_postage_stamps", arguments: {} });
    let rawData: any[] = [];
    if (sc(response).raw) rawData = sc(response).raw;
    else if (response.content?.[0]) {
      try { const p = JSON.parse(tc(response.content)); rawData = p.raw || p.summary || []; }
      catch { rawData = []; }
    }
    lastStampsData = rawData;
    (window as any).__stampsRawData = rawData;
    renderUploadStampPicker();

    if (rawData.length === 0) {
      stampsTable.innerHTML = `<div class="state-text">No postage stamps yet.</div>`;
      return;
    }

    stampsTable.innerHTML = rawData.map(renderStampCard).join("");
    stampsTable.querySelectorAll<HTMLElement>(".stamp-card").forEach((card) => {
      card.addEventListener("click", () => {
        const bid   = card.dataset.batchId || "";
        const stamp = lastStampsData.find((s) => (s.batchID || s.stampID) === bid);
        if (stamp) openStampModal(stamp);
      });
    });
  } catch (error: any) {
    stampsTable.innerHTML = `<div class="state-error">Error loading stamps: ${esc(error?.message || String(error))}</div>`;
  }
}

// Auto-load on startup
loadStamps();

// ---------------------------------------------------------------------------
// Stamp detail modal
// ---------------------------------------------------------------------------
function openStampModal(stamp: any) {
  const batchId       = stamp.batchID || stamp.stampID || "";
  const label         = stamp.label || "Stamp";
  const usagePct      = typeof stamp.usage === "number" ? Math.round(stamp.usage * 100) : 0;
  const usedMB        = stamp.size?.bytes           ? (stamp.size.bytes           / 1_000_000).toFixed(2) + " MB" : "N/A";
  const freeMB        = stamp.remainingSize?.bytes  ? (stamp.remainingSize.bytes  / 1_000_000).toFixed(2) + " MB" : "N/A";
  const maxMB         = stamp.theoreticalSize?.bytes ? (stamp.theoreticalSize.bytes / 1_000_000).toFixed(0) + " MB" : "N/A";
  const ttlObj        = stamp.duration?.seconds ? ttlFromSeconds(stamp.duration.seconds) : null;
  const ttlText       = ttlObj ? ttlObj.text : "N/A";
  const lockColor     = stamp.immutableFlag ? "#f97316" : "#4b5563";
  const lockText      = stamp.immutableFlag ? "YES" : "NO";

  modalActiveBatchId = batchId;
  modalUploadResult.innerHTML = "";
  extendSizeInput.value = "";
  extendDurationInput.value = "";
  extendResult.innerHTML = "";
  modalTitle.textContent = `${label.toUpperCase()} DETAILS`;

  modalBody.innerHTML = `
    <!-- Technical data card -->
    <div class="d-card">
      <div class="d-section-label">BATCH_HASH</div>
      <span class="d-batch-value">${esc(batchId) || "N/A"}</span>
      <div class="d-metrics-grid">
        <div>
          <div class="d-metric-label">DEPTH</div>
          <div class="d-metric-value">${stamp.depth ?? "N/A"}</div>
        </div>
        <div>
          <div class="d-metric-label">BUCKET</div>
          <div class="d-metric-value">${stamp.bucketDepth ?? "N/A"}</div>
        </div>
        <div>
          <div class="d-metric-label">UTIL</div>
          <div class="d-metric-value">${stamp.utilization ?? "N/A"}</div>
        </div>
        <div>
          <div class="d-metric-label">LOCK</div>
          <div class="d-metric-value" style="color:${lockColor}">${lockText}</div>
        </div>
        <div>
          <div class="d-metric-label">BLOCK</div>
          <div class="d-metric-value">${stamp.blockNumber ?? "N/A"}</div>
        </div>
        <div>
          <div class="d-metric-label">AMOUNT</div>
          <div class="d-metric-value" style="font-size:0.82rem">${stamp.amount ?? "N/A"}</div>
        </div>
      </div>
    </div>
    <!-- Capacity load card -->
    <div class="d-card" style="margin-bottom:0.9rem">
      <div class="d-cap-header">
        <span class="d-section-label" style="margin-bottom:0">CAPACITY LOAD</span>
        <span class="d-cap-pct">${usagePct}%</span>
      </div>
      <div class="d-cap-bar-bg">
        <div class="d-cap-bar-fill" style="width:${usagePct}%"></div>
      </div>
      <div class="d-stats-row">
        <div class="d-stat">
          <div class="d-stat-label">USED</div>
          <div class="d-stat-value">${esc(usedMB)}</div>
        </div>
        <div class="d-stat">
          <div class="d-stat-label">FREE</div>
          <div class="d-stat-value">${esc(freeMB)}</div>
        </div>
        <div class="d-stat">
          <div class="d-stat-label">MAX</div>
          <div class="d-stat-value">${esc(maxMB)}</div>
        </div>
        <div class="d-stat">
          <div class="d-stat-label">TTL</div>
          <div class="d-stat-value">${esc(ttlText)}</div>
        </div>
      </div>
    </div>`;
  openModal(stampModal);
}

// Upload to stamp
modalUploadBtn.addEventListener("click", () => { modalFileInput.value = ""; modalFileInput.click(); });

modalFileInput.addEventListener("change", async () => {
  const file = modalFileInput.files?.[0];
  if (!file || !modalActiveBatchId) return;
  modalUploadBtn.disabled = true;
  modalUploadBtn.innerHTML = "<span>Uploading…</span>";
  modalUploadResult.innerHTML = `<span class="loading-text">Uploading to Swarm…</span>`;
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const response = await app.callServerTool({
      name: "upload_file",
      arguments: { data: base64, isPath: false, name: file.name, postageBatchId: modalActiveBatchId },
    });
    let reference = ""; let url = "";
    if (response.structuredContent) { reference = sc(response).reference || ""; url = sc(response).url || ""; }
    else if (response.content?.[0]) {
      try { const p = JSON.parse(tc(response.content)); reference = p.reference || ""; url = p.url || ""; } catch { /* ignore */ }
    }
    modalUploadResult.innerHTML = `
      <div class="result-success" style="margin-top:0.5rem">
        <strong>✓ Uploaded: ${esc(file.name)}</strong>
        <div style="font-family:monospace;font-size:0.75rem;margin-top:0.35rem;word-break:break-all">${esc(reference)}</div>
        ${url ? `<a href="${esc(url)}" target="_blank" class="swarm-link" style="font-size:0.78rem;word-break:break-all">${esc(url)}</a>` : ""}
      </div>`;
  } catch (err: any) {
    modalUploadResult.innerHTML = `<div class="result-error">${esc(err?.message || String(err))}</div>`;
  } finally {
    modalUploadBtn.disabled = false;
    modalUploadBtn.innerHTML = "<span>TARGET UPLOAD</span>";
  }
});

// Extend stamp
extendSubmitBtn.addEventListener("click", async () => {
  const size     = parseFloat(extendSizeInput.value);
  const duration = extendDurationInput.value.trim();
  if ((!size || size <= 0) && !duration) {
    extendResult.innerHTML = `<div class="result-error">Enter a size (MB) and/or a duration to extend.</div>`;
    return;
  }
  extendSubmitBtn.disabled = true;
  extendSubmitBtn.innerHTML = "<span>Extending…</span>";
  extendResult.innerHTML = `<span class="loading-text">Extending postage stamp…</span>`;
  try {
    const args: Record<string, any> = { postageBatchId: modalActiveBatchId };
    if (size > 0) args.size = size;
    if (duration) args.duration = duration;
    const response = await app.callServerTool({ name: "extend_postage_stamp", arguments: args });
    let message = "";
    if (response.structuredContent) message = sc(response).message || "";
    else if (response.content?.[0]) {
      try { message = JSON.parse(tc(response.content)).message || ""; } catch { message = tc(response.content); }
    }
    extendResult.innerHTML = `
      <div class="result-success">
        <strong>✓ Stamp extended!</strong>
        ${message ? `<div style="margin-top:0.35rem;font-size:0.8rem">${esc(message)}</div>` : ""}
      </div>`;
    loadStamps();
  } catch (err: any) {
    extendResult.innerHTML = `<div class="result-error">Failed: ${esc(err?.message || String(err))}</div>`;
  } finally {
    extendSubmitBtn.disabled = false;
    extendSubmitBtn.innerHTML = "<span>Extend Stamp</span>";
  }
});

// ---------------------------------------------------------------------------
// Upload tab
// ---------------------------------------------------------------------------
let selectedFile: File | null = null;
let fileBase64: string | null = null;
let uploadSelectedBatchId = "";

// ---- Step 1: Stamp picker ----
function renderUploadStampPicker() {
  const stamps = lastStampsData;
  if (stamps.length === 0) {
    uploadStampList.innerHTML = `<div class="state-text">No stamps available. Buy one first.</div>`;
    return;
  }
  uploadStampList.innerHTML = stamps.map((stamp: any) => {
    const batchId = stamp.batchID || stamp.stampID || "";
    const label   = stamp.label || "unlabeled";
    const usagePct = typeof stamp.usage === "number" ? Math.round(stamp.usage * 100) : 0;
    const { text: ttlText, severity } = ttlFromSeconds(stamp.duration?.seconds);
    const selected = batchId === uploadSelectedBatchId ? " selected" : "";
    return `
      <div class="upload-stamp-option${selected}" data-batch-id="${esc(batchId)}">
        <div class="upload-stamp-option-radio"><div class="upload-stamp-option-radio-dot"></div></div>
        <div class="upload-stamp-option-inner">
          <div class="stamp-label" style="width:auto;margin-bottom:0.3rem">${esc(label)}</div>
          <div style="display:flex;align-items:center;gap:0.6rem">
            <div class="stamp-progress-bar-bg" style="flex:1;height:4px">
              <div class="stamp-progress-bar-fill${severity === 'critical' ? ' fill-critical' : ''}" style="width:${usagePct}%"></div>
            </div>
            <div class="stamp-ttl-badge ${severity}" style="padding:0.15rem 0.5rem;font-size:0.68rem">
              <div class="stamp-ttl-dot"></div><span>${esc(ttlText)}</span>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");

  uploadStampList.querySelectorAll<HTMLElement>(".upload-stamp-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      uploadSelectedBatchId = opt.dataset.batchId || "";
      uploadStampList.querySelectorAll(".upload-stamp-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      uploadContinueBtn.disabled = false;
    });
  });
  uploadContinueBtn.disabled = !uploadSelectedBatchId;
}

function goToUploadStep2() {
  const stamp = lastStampsData.find((s: any) => (s.batchID || s.stampID) === uploadSelectedBatchId);
  uploadSelectedStampLabel.textContent = stamp?.label || uploadSelectedBatchId.slice(0, 16) + "…" || "—";
  uploadStep1El.style.display = "none";
  uploadStep2El.style.display = "block";
  uploadStep1Indicator.classList.remove("active"); uploadStep1Indicator.classList.add("done");
  uploadStep2Indicator.classList.add("active");
}

function goToUploadStep1() {
  uploadStep2El.style.display = "none";
  uploadStep1El.style.display = "block";
  uploadStep2Indicator.classList.remove("active");
  uploadStep1Indicator.classList.remove("done"); uploadStep1Indicator.classList.add("active");
  uploadResult.innerHTML = "";
  previewArea.style.display = "none";
}

function resetUploadWorkflow() {
  selectedFile = null;
  fileBase64 = null;
  uploadSelectedBatchId = "";
  fileInput.value = "";
  fileNameDisplay.textContent = "// No file selected";
  uploadBtn.disabled = true;
  uploadBtn.innerHTML = "<span>UPLOAD</span>";
  goToUploadStep1();
}

uploadContinueBtn.addEventListener("click", goToUploadStep2);
uploadChangeStampBtn.addEventListener("click", goToUploadStep1);

selectAssetBtn.addEventListener("click", () => { fileInput.value = ""; fileInput.click(); });

fileInput.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) { uploadBtn.disabled = true; selectedFile = null; fileBase64 = null; fileNameDisplay.textContent = "// No file selected"; return; }
  selectedFile = file;
  uploadBtn.disabled = false;
  fileNameDisplay.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => { fileBase64 = (ev.target?.result as string).split(",")[1]; };
  reader.readAsDataURL(file);
  uploadResult.innerHTML = "";
  previewArea.style.display = "none";
});

uploadBtn.addEventListener("click", async () => {
  if (!selectedFile || !fileBase64) { uploadResult.innerHTML = `<div class="state-error">No file selected.</div>`; return; }
  uploadBtn.disabled = true;
  uploadBtn.innerHTML = "<span>UPLOADING…</span>";
  uploadResult.innerHTML = `<span class="loading-text">Uploading to Swarm…</span>`;
  previewArea.style.display = "none";
  try {
    const response = await app.callServerTool({
      name: "upload_file",
      arguments: { data: fileBase64, isPath: false, name: selectedFile.name, postageBatchId: uploadSelectedBatchId || undefined },
    });
    let reference = ""; let url = ""; let message = "";
    if (response.structuredContent) {
      reference = sc(response).reference || ""; url = sc(response).url || ""; message = sc(response).message || "Upload successful";
    } else if (response.content?.[0]) {
      try { const p = JSON.parse(tc(response.content)); reference = p.reference || ""; url = p.url || ""; message = p.message || "Upload successful"; }
      catch { message = tc(response.content); }
    }
    uploadResult.innerHTML = `
      <div class="result-success">
        <strong>✓ ${esc(message)}</strong>
        <div style="margin-top:0.4rem"><strong>File:</strong> ${esc(selectedFile.name)}</div>
        <div style="margin-top:0.25rem;font-family:monospace;font-size:0.78rem;word-break:break-all">${esc(reference)}</div>
        ${url ? `<div style="margin-top:0.35rem"><a href="${esc(url)}" target="_blank" class="swarm-link">${esc(url)}</a></div>` : ""}
      </div>`;
    const isImage = selectedFile.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(selectedFile.name);
    if (isImage && fileBase64) {
      const dataUrl = `data:${selectedFile.type || "image/png"};base64,${fileBase64}`;
      previewArea.style.display = "block";
      previewArea.innerHTML = `<img src="${esc(dataUrl)}" alt="${esc(selectedFile.name)}" />`;
    }
    loadHistory().catch(() => {});
  } catch (error: any) {
    uploadResult.innerHTML = `<div class="state-error">Upload failed: ${esc(error?.message || String(error))}</div>`;
  } finally {
    uploadBtn.disabled = fileBase64 === null;
    uploadBtn.innerHTML = "<span>UPLOAD</span>";
    if (!fileBase64) fileNameDisplay.textContent = "// No file selected";
  }
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
const FILE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

async function loadHistory() {
  historyTable.innerHTML = `<div class="state-text">Loading history…</div>`;
  try {
    const response = await app.callServerTool({ name: "list_upload_history", arguments: {} });
    let entries: any[] = [];
    if (sc(response).history) entries = sc(response).history;
    else if (response.content?.[0]) {
      try { entries = JSON.parse(tc(response.content)).history || []; } catch { entries = []; }
    }
    if (entries.length === 0) {
      historyTable.innerHTML = `<div class="state-text">No uploads yet in this session.</div>`;
      return;
    }
    const fileIcon = FILE_ICON;
    let html = "";
    entries.forEach((entry: any) => {
      const shortRef = entry.reference ? `${entry.reference.slice(0, 12)}…` : "N/A";
      const sizeKB   = entry.sizeBytes != null ? (entry.sizeBytes / 1024).toFixed(1) + "…" : "—";
      const time     = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "—";
      const name     = entry.name || entry.type || "data";
      const url      = entry.url ? ` style="cursor:pointer" onclick="window.open('${esc(entry.url)}','_blank')"` : "";
      html += `<div class="hist-card"${url}>`;
      html += `<span class="hist-icon">${fileIcon}</span>`;
      html += `<span class="hist-name" title="${esc(entry.reference ?? "")}">${esc(name)}</span>`;
      html += `<span class="hist-ref-pill" title="${esc(entry.reference ?? "")}">${esc(shortRef)}</span>`;
      html += `<span class="hist-size-pill">${esc(sizeKB)}</span>`;
      html += `<span class="hist-time">${esc(time)}</span>`;
      html += `</div>`;
    });
    historyTable.innerHTML = html;
    // Wire click handlers to open detail modal
    historyTable.querySelectorAll<HTMLElement>(".hist-card").forEach((card, i) => {
      card.addEventListener("click", () => openHistoryItemModal(entries[i]));
    });
  } catch (error: any) {
    historyTable.innerHTML = `<div class="state-error">Failed to load history: ${esc(error?.message || String(error))}</div>`;
  }
}

function openHistoryItemModal(entry: any) {
  const ts = entry.timestamp ? new Date(entry.timestamp) : null;
  const sizeKB = entry.sizeBytes != null ? (entry.sizeBytes / 1024).toFixed(1) + " KB" : "—";
  const dateStr = ts ? ts.toLocaleDateString("en-CA") : "—"; // YYYY-MM-DD
  const timeStr = ts ? ts.toLocaleTimeString() : "—";
  hiName.textContent      = entry.name || entry.type || "—";
  hiReference.textContent = entry.reference || "—";
  hiSize.textContent      = sizeKB;
  hiDate.textContent      = dateStr;
  hiTime.textContent      = timeStr;
  hiStamp.textContent     = entry.postageBatchId || "—";
  if (entry.url) { hiUrl.href = entry.url; hiUrl.textContent = entry.url; }
  else           { hiUrl.removeAttribute("href"); hiUrl.textContent = "—"; }
  openModal(histItemModal);
}

histItemClose.addEventListener("click", () => closeModal(histItemModal));
histItemModal.addEventListener("click", (e) => { if (e.target === histItemModal) closeModal(histItemModal); });

hiCopyBtn.addEventListener("click", async () => {
  const ref = hiReference.textContent || "";
  if (!ref || ref === "—") return;
  try {
    await navigator.clipboard.writeText(ref);
    hiCopyBtn.innerHTML = "<span>COPIED ✓</span>";
    setTimeout(() => { hiCopyBtn.innerHTML = "<span>COPY HASH</span>"; }, 1800);
  } catch { /* ignore */ }
});

historyBtn.addEventListener("click", () => {
  historyBtn.disabled = true;
  historyBtn.innerHTML = "<span>Loading…</span>";
  loadHistory();
});

// ---------------------------------------------------------------------------
// Node Status tab
// ---------------------------------------------------------------------------
const statusContent  = document.getElementById("status-content")!;

function dot(ok: boolean | null): string {
  const cls = ok === true ? "ok" : ok === false ? "error" : "unknown";
  return `<span class="status-dot ${cls}"></span>`;
}

function statusVal(v: unknown, cls?: string): string {
  if (v == null) return `<span class="status-val muted">—</span>`;
  const extra = cls ? ` ${cls}` : "";
  return `<span class="status-val${extra}">${esc(String(v))}</span>`;
}

function row(label: string, value: string): string {
  return `<div class="status-row"><span class="status-key">${label}</span>${value}</div>`;
}

function fmtBzz(val?: unknown): string {
  if (val == null || val === "") return "—";
  try {
    return `${parseFloat(String(val)).toFixed(4)} BZZ`;
  } catch { return String(val); }
}

function fmtEth(val?: unknown): string {
  if (val == null || val === "") return "—";
  try {
    return `${parseFloat(String(val)).toFixed(4)} xDAI`;
  } catch { return String(val); }
}

function renderNodeStatus(data: any): string {
  const s  = data.status   ?? {};
  const h  = data.health   ?? {};
  const ni = data.nodeInfo ?? {};
  const w  = data.wallet   ?? {};
  const c  = data.chain    ?? {};

  const isHealthy = h.status === "ok";
  const connected = s.connectedPeers ?? null;
  const mode: string = ni.beeMode ?? "unknown";
  const modeClass = ["full", "light", "dev"].includes(mode) ? mode : "unknown";

  return `
    <div class="status-panel">
      <div class="status-panel-header">
        <span class="status-panel-title">${dot(isHealthy)} Node Status</span>
        <button id="status-refresh-icon" class="status-refresh-icon" title="Refresh">↻</button>
      </div>

      <div class="status-section">
        <div class="status-section-label">Health</div>
        ${row("status", statusVal(h.status ?? (data.health == null ? null : "?"), isHealthy ? "green" : "red"))}
        ${row("version", statusVal(h.version ?? ni.apiVersion ?? null))}
        ${row("mode", `<span class="status-mode-badge ${modeClass}">${esc(mode)}</span>`)}
      </div>

      <div class="status-section">
        <div class="status-section-label">Network</div>
        ${row("peers", statusVal(s.connectedPeers ?? null, connected > 0 ? "green" : "orange"))}
        ${row("neighborhood", statusVal(s.neighborhoodSize ?? null))}
        ${row("depth", statusVal(s.storageRadius ?? null))}
      </div>

      <div class="status-section">
        <div class="status-section-label">Wallet</div>
        ${row("BZZ", statusVal(fmtBzz(w.bzzBalance), "orange"))}
        ${row("xDAI", statusVal(fmtEth(w.nativeTokenBalance)))}
      </div>

      <div class="status-section">
        <div class="status-section-label">Chain</div>
        ${row("block", statusVal(c.currentBlock ?? null))}
        ${row("gas", statusVal(c.gasPrice ?? null))}
        ${row("time", statusVal(c.blockTime ? new Date(Number(c.blockTime) * 1000).toLocaleTimeString() : null))}
      </div>
    </div>`;
}

async function loadNodeStatus() {
  statusContent.innerHTML = `<div class="state-text">Loading node status…</div>`;
  // disable inline refresh button if present
  const btn = statusContent.querySelector<HTMLButtonElement>("#status-refresh-icon");
  if (btn) btn.disabled = true;
  try {
    const response = await app.callServerTool({ name: "get_node_status", arguments: {} });
    const data = sc(response);
    statusContent.innerHTML = renderNodeStatus(data);
    // Wire inline refresh button (rendered inside statusContent)
    const refreshIcon = statusContent.querySelector<HTMLButtonElement>("#status-refresh-icon");
    if (refreshIcon) refreshIcon.addEventListener("click", () => loadNodeStatus());
  } catch (err: any) {
    statusContent.innerHTML = `<div class="state-error">Failed to fetch status: ${esc(err?.message || String(err))}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Buy stamp modal
// ---------------------------------------------------------------------------
buyStampBtn.addEventListener("click", () => {
  buySizeInput.value = ""; buyDurationInput.value = ""; buyLabelInput.value = ""; buyResult.innerHTML = "";
  buyCostEstimate.style.display = "none";
  buyCostValue.textContent = "—";
  openModal(buyStampModal);
});

// ---------------------------------------------------------------------------
// Cost estimation (debounced)
// ---------------------------------------------------------------------------
let _costDebounce: ReturnType<typeof setTimeout> | null = null;

async function updateCostEstimate() {
  const size = parseFloat(buySizeInput.value);
  const duration = buyDurationInput.value.trim();
  if (!size || size <= 0 || !duration) {
    buyCostEstimate.style.display = "none";
    return;
  }
  buyCostValue.textContent = "…";
  buyCostEstimate.style.display = "block";
  try {
    const response = await app.callServerTool({ name: "get_storage_cost", arguments: { size, duration } });
    const data = sc(response);
    const bzz = data.bzz ?? tc(response.content ?? []);
    buyCostValue.textContent = bzz ? parseFloat(bzz).toFixed(4) : "N/A";
  } catch {
    buyCostValue.textContent = "N/A";
  }
}

function scheduleCostEstimate() {
  if (_costDebounce) clearTimeout(_costDebounce);
  _costDebounce = setTimeout(updateCostEstimate, 600);
}

buySizeInput.addEventListener("input", scheduleCostEstimate);
buyDurationInput.addEventListener("input", scheduleCostEstimate);

buySubmitBtn.addEventListener("click", async () => {
  const size     = parseFloat(buySizeInput.value);
  const duration = buyDurationInput.value.trim();
  const label    = buyLabelInput.value.trim();
  if (!size || size <= 0) { buyResult.innerHTML = `<div class="result-error">Please enter a valid size in MB.</div>`; return; }
  if (!duration)           { buyResult.innerHTML = `<div class="result-error">Please enter a duration (e.g. 1d, 1w, 1month).</div>`; return; }
  buySubmitBtn.disabled = true;
  buySubmitBtn.innerHTML = "<span>Buying…</span>";
  buyResult.innerHTML = `<span class="loading-text">Buying postage stamp…</span>`;
  try {
    const args: Record<string, any> = { size, duration };
    if (label) args.label = label;
    const response = await app.callServerTool({ name: "create_postage_stamp", arguments: args });
    let batchId = ""; let message = "";
    if (response.structuredContent) { batchId = sc(response).batchID || sc(response).stampID || ""; message = sc(response).message || ""; }
    else if (response.content?.[0]) {
      const text = tc(response.content);
      try { const p = JSON.parse(text); batchId = p.batchID || p.stampID || p.reference || ""; message = p.message || ""; }
      catch { message = text; }
    }
    buyResult.innerHTML = `
      <div class="result-success">
        <strong>✓ Stamp purchased!</strong>
        ${message ? `<div style="margin-top:0.3rem;font-size:0.8rem">${esc(message)}</div>` : ""}
        ${batchId ? `<div style="margin-top:0.4rem;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#4b5563">Batch ID</div><div style="font-family:monospace;font-size:0.75rem;word-break:break-all">${esc(batchId)}</div>` : ""}
      </div>`;
    loadStamps();
  } catch (err: any) {
    buyResult.innerHTML = `<div class="result-error">Failed: ${esc(err?.message || String(err))}</div>`;
  } finally {
    buySubmitBtn.disabled = false;
    buySubmitBtn.innerHTML = "<span>Buy Stamp</span>";
  }
});

// ---------------------------------------------------------------------------
// MCP tool input handler
// ---------------------------------------------------------------------------
app.ontoolinput = async (params) => {
  const args        = params.arguments as any;
  const tab         = args?.tab as string | undefined;
  const stampQuery  = args?.stamp as string | undefined;
  const modal       = args?.modal as string | undefined;

  if (modal === "buy-stamp") {
    activateTab("stamps");
    buySizeInput.value = ""; buyDurationInput.value = ""; buyLabelInput.value = ""; buyResult.innerHTML = "";
    openModal(buyStampModal);
    return;
  }

  if (stampQuery) {
    activateTab("stamps");
    if (lastStampsData.length === 0) await loadStamps();
    const query = stampQuery.toLowerCase();
    const stamp = lastStampsData.find((s: any) =>
      (s.label ?? "").toLowerCase() === query ||
      (s.batchID ?? "").toLowerCase().startsWith(query) ||
      (s.stampID ?? "").toLowerCase().startsWith(query)
    );
    if (stamp) openStampModal(stamp);
    return;
  }

  if (tab) {
    activateTab(tab);
    if (tab === "stamps") loadStamps();
    if (tab === "history") loadHistory();
    if (tab === "status") loadNodeStatus();
    if (tab === "upload") {
      if (lastStampsData.length === 0) {
        loadStamps().catch(() => {});
      } else {
        renderUploadStampPicker();
      }
    }
  }
};

// Connect to host
app.connect();
