import { App } from "@modelcontextprotocol/ext-apps";

// Get element references
const timeBtn = document.getElementById("time-btn")! as HTMLButtonElement;
const stampsBtn = document.getElementById("stamps-btn")! as HTMLButtonElement;
const result = document.getElementById("result")!;
const stampsCard = document.getElementById("stamps-card")!;
const stampsTable = document.getElementById("stamps-table")!;

// Create app instance
const app = new App({ name: "Swarm MCP Interface", version: "1.0.0" });

// Handle Get Time button
timeBtn.addEventListener("click", async () => {
  timeBtn.disabled = true;
  timeBtn.textContent = "Loading...";
  result.textContent = "Communicating with Swarm...";
  stampsCard.style.display = "none";

  try {
    const response = await app.callServerTool({ name: "get-time", arguments: {} });
    
    // Display structured response
    let html = '<div style="margin-bottom: 1rem;">';
    html += `<h3 style="margin: 0 0 0.5rem 0; color: #059669;">✓ Response received</h3>`;
    
    // Display timestamp if available
    const time = response.content?.find((c) => c.type === "text")?.text;
    if (time) {
      html += `<p style="margin: 0 0 1rem 0;"><strong>Server Time:</strong> <span class="timestamp">${time}</span></p>`;
    }
    
    // Display structured content
    if (response.structuredContent) {
      html += `<details open><summary style="cursor: pointer; font-weight: 600; margin-bottom: 0.5rem;">Structured Content</summary>`;
      html += `<pre style="background: #1f2937; color: #10b981; padding: 1rem; border-radius: 0.5rem; overflow-x: auto;">${JSON.stringify(response.structuredContent, null, 2)}</pre>`;
      html += `</details>`;
    }
    
    // Display full response
    html += `<details style="margin-top: 1rem;"><summary style="cursor: pointer; font-weight: 600; margin-bottom: 0.5rem;">Full Response</summary>`;
    html += `<pre style="background: #1f2937; color: #e5e7eb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto;">${JSON.stringify(response, null, 2)}</pre>`;
    html += `</details>`;
    html += '</div>';
    
    result.innerHTML = html;
  } catch (error: any) {
    result.innerHTML = `<div class="error">ERROR: ${error.message}</div>`;
    console.error(error);
  } finally {
    timeBtn.disabled = false;
    timeBtn.textContent = "Get Time";
  }
});

// Handle List Stamps button
stampsBtn.addEventListener("click", async () => {
  stampsBtn.disabled = true;
  stampsBtn.textContent = "Loading...";
  result.textContent = "Loading postage stamps...";
  stampsTable.innerHTML = '<div class="loading">Loading...</div>';
  stampsCard.style.display = "block";

  try {
    const response = await app.callServerTool({ 
      name: "list_postage_stamps", 
      arguments: {} 
    });

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
      result.textContent = "No results.";
    } else {
      // Build table from raw data (more detailed)
      let tableHTML = '<table><thead><tr>';
      tableHTML += '<th>Label</th>';
      tableHTML += '<th>Batch ID</th>';
      tableHTML += '<th>Usable</th>';
      tableHTML += '<th>Usage</th>';
      tableHTML += '<th>Depth</th>';
      tableHTML += '<th>Bucket Depth</th>';
      tableHTML += '<th>Immutable</th>';
      tableHTML += '</tr></thead><tbody>';

      (rawData.length > 0 ? rawData : stamps).forEach((stamp: any) => {
        tableHTML += '<tr>';
        tableHTML += `<td><strong>${stamp.label || '-'}</strong></td>`;
        tableHTML += `<td class="batch-id">${stamp.batchID || stamp.stampID || 'N/A'}</td>`;
        tableHTML += `<td class="${stamp.usable ? 'usable-yes' : 'usable-no'}">${stamp.usable ? 'Yes' : 'No'}</td>`;
        tableHTML += `<td>${stamp.usageText || stamp.usage || 'N/A'}</td>`;
        tableHTML += `<td>${stamp.depth || 'N/A'}</td>`;
        tableHTML += `<td>${stamp.bucketDepth || 'N/A'}</td>`;
        tableHTML += `<td>${stamp.immutable !== undefined ? (stamp.immutable || stamp.immutableFlag ? '✓' : '✗') : 'N/A'}</td>`;
        tableHTML += '</tr>';
      });

      tableHTML += '</tbody></table>';
      stampsTable.innerHTML = tableHTML;
      
      // Display structured response summary
      let html = '<div style="margin-bottom: 1rem;">';
      html += `<p style="margin: 0;"><span class="timestamp">${stamps.length} postage stamps found</span></p>`;
      html += `<details style="margin-top: 1rem;"><summary style="cursor: pointer; font-weight: 600; margin-bottom: 0.5rem;">Full Response</summary>`;
      html += `<pre style="background: #1f2937; color: #e5e7eb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.85rem;">${JSON.stringify(response, null, 2)}</pre>`;
      html += `</details>`;
      html += '</div>';
      result.innerHTML = html;
    }
  } catch (error: any) {
    stampsTable.innerHTML = `<div class="error">Error loading stamps: ${error.message}</div>`;
    result.innerHTML = `<div class="error">ERROR: ${error.message}</div>`;
    console.error(error);
  } finally {
    stampsBtn.disabled = false;
    stampsBtn.textContent = "List Postage Stamps";
  }
});

// Connect to host
app.connect();
