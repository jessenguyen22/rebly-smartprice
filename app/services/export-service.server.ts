import fs from 'fs/promises';
import path from 'path';

export interface ExportResult {
  variantId: string;
  success: boolean;
  productTitle?: string;
  variantTitle?: string;
  inventory?: number;
  oldPrice?: string;
  newPrice?: string;
  reason?: string;
  error?: string;
}

export interface ExportJobData {
  jobName: string;
  actionType: string;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  results: ExportResult[];
  createdAt: Date;
  shopDomain: string;
}

export interface ExportMetadata {
  filename: string;
  filePath: string;
  downloadUrl: string;
  expiresAt: Date;
}

// Ensure export directory exists
async function ensureExportDirectory() {
  const exportDir = path.join(process.cwd(), 'public', 'exports');
  try {
    await fs.access(exportDir);
  } catch {
    await fs.mkdir(exportDir, { recursive: true });
  }
  return exportDir;
}

// Generate CSV export
export async function generateCSVExport(data: ExportJobData): Promise<ExportMetadata> {
  const exportDir = await ensureExportDirectory();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `pricing-job-results-${timestamp}.csv`;
  const filePath = path.join(exportDir, filename);

  // CSV headers
  const headers = [
    'Product Title',
    'Variant Title', 
    'Variant ID',
    'Status',
    'Old Price',
    'New Price',
    'Inventory',
    'Reason/Error'
  ];

  // CSV rows
  const rows = data.results.map(result => [
    `"${(result.productTitle || 'Unknown').replace(/"/g, '""')}"`,
    `"${(result.variantTitle || 'Unknown').replace(/"/g, '""')}"`,
    result.variantId,
    result.success ? 'Updated' : (result.reason ? 'Skipped' : 'Failed'),
    result.oldPrice || '',
    result.newPrice || '',
    result.inventory !== undefined ? result.inventory.toString() : '',
    `"${((result.reason || result.error || '').replace(/"/g, '""'))}"`
  ]);

  // Summary rows
  const summaryRows = [
    [],
    ['=== JOB SUMMARY ==='],
    ['Job Name', `"${data.jobName}"`],
    ['Action Type', data.actionType],
    ['Shop Domain', data.shopDomain],
    ['Created At', new Date(data.createdAt).toISOString()],
    ['Total Processed', data.totalProcessed.toString()],
    ['Success Count', data.successCount.toString()],
    ['Failure Count', data.failureCount.toString()],
    ['Skipped Count', data.skippedCount.toString()],
    ['Success Rate', `${data.totalProcessed > 0 ? Math.round((data.successCount / data.totalProcessed) * 100) : 0}%`]
  ];

  // Combine all data
  const csvContent = [
    `# Pricing Job Results Export - ${data.jobName}`,
    `# Generated on ${new Date().toISOString()}`,
    ``,
    headers.join(','),
    ...rows.map(row => row.join(',')),
    ...summaryRows.map(row => row.join(','))
  ].join('\n');

  await fs.writeFile(filePath, csvContent, 'utf-8');

  return {
    filename,
    filePath,
    downloadUrl: `/exports/${filename}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
}

// Generate PDF export (simplified version using HTML to PDF approach)
export async function generatePDFExport(data: ExportJobData): Promise<ExportMetadata> {
  const exportDir = await ensureExportDirectory();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `pricing-job-results-${timestamp}.pdf`;
  const filePath = path.join(exportDir, filename);

  // For now, we'll create a simple HTML version and note that PDF conversion needs puppeteer
  // This is a placeholder implementation - in production you'd use puppeteer or similar
  const htmlContent = generateHTMLReport(data);
  const htmlFilename = filename.replace('.pdf', '.html');
  const htmlFilePath = path.join(exportDir, htmlFilename);
  
  await fs.writeFile(htmlFilePath, htmlContent, 'utf-8');

  return {
    filename: htmlFilename, // Return HTML for now
    filePath: htmlFilePath,
    downloadUrl: `/exports/${htmlFilename}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
}

// Generate HTML report for PDF conversion
function generateHTMLReport(data: ExportJobData): string {
  const successRate = data.totalProcessed > 0 ? Math.round((data.successCount / data.totalProcessed) * 100) : 0;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Pricing Job Results - ${data.jobName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .summary { background: #f5f5f5; padding: 20px; margin-bottom: 30px; border-radius: 5px; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .summary-item { display: flex; justify-content: space-between; }
    .summary-item strong { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f8f9fa; font-weight: bold; }
    .status-updated { color: #28a745; font-weight: bold; }
    .status-skipped { color: #ffc107; font-weight: bold; }
    .status-failed { color: #dc3545; font-weight: bold; }
    .price-change { font-weight: bold; color: #007bff; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Pricing Job Results Report</h1>
    <h2>${data.jobName}</h2>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Shop:</strong> ${data.shopDomain}</p>
  </div>

  <div class="summary">
    <h3>Job Summary</h3>
    <div class="summary-grid">
      <div class="summary-item">
        <span>Action Type:</span>
        <strong>${data.actionType}</strong>
      </div>
      <div class="summary-item">
        <span>Total Processed:</span>
        <strong>${data.totalProcessed}</strong>
      </div>
      <div class="summary-item">
        <span>Successfully Updated:</span>
        <strong style="color: #28a745;">${data.successCount}</strong>
      </div>
      <div class="summary-item">
        <span>Skipped:</span>
        <strong style="color: #ffc107;">${data.skippedCount}</strong>
      </div>
      <div class="summary-item">
        <span>Failed:</span>
        <strong style="color: #dc3545;">${data.failureCount}</strong>
      </div>
      <div class="summary-item">
        <span>Success Rate:</span>
        <strong style="color: ${successRate >= 80 ? '#28a745' : successRate >= 50 ? '#ffc107' : '#dc3545'};">${successRate}%</strong>
      </div>
    </div>
  </div>

  <h3>Detailed Results</h3>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>Variant</th>
        <th>Status</th>
        <th>Price Change</th>
        ${data.actionType === 'inventory_rules' ? '<th>Inventory</th>' : ''}
        <th>Reason/Error</th>
      </tr>
    </thead>
    <tbody>
      ${data.results.map(result => `
        <tr>
          <td>${result.productTitle || 'Unknown'}</td>
          <td>${result.variantTitle || 'Unknown'}</td>
          <td class="status-${result.success ? 'updated' : (result.reason ? 'skipped' : 'failed')}">
            ${result.success ? 'Updated' : (result.reason ? 'Skipped' : 'Failed')}
          </td>
          <td>
            ${result.success && result.oldPrice && result.newPrice 
              ? `<span class="price-change">$${result.oldPrice} → $${result.newPrice}</span>`
              : 'N/A'
            }
          </td>
          ${data.actionType === 'inventory_rules' 
            ? `<td>${result.inventory !== undefined ? result.inventory : 'N/A'}</td>`
            : ''
          }
          <td>${result.reason || result.error || ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>This report was generated by Rebly SmartPrice on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;
}

// Cleanup expired exports (utility function)
export async function cleanupExpiredExports(): Promise<number> {
  const exportDir = await ensureExportDirectory();
  const files = await fs.readdir(exportDir);
  const now = Date.now();
  let deletedCount = 0;

  for (const file of files) {
    const filePath = path.join(exportDir, file);
    const stats = await fs.stat(filePath);
    const fileAge = now - stats.mtime.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (fileAge > maxAge) {
      await fs.unlink(filePath);
      deletedCount++;
    }
  }

  return deletedCount;
}
