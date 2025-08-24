import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { generateCSVExport, generatePDFExport } from "../services/export-service.server";
import type { ExportJobData } from "../services/export-service.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  try {
    const formData = await request.formData();
    const format = formData.get("format") as string;
    const jobDataJson = formData.get("jobData") as string;
    
    if (!format || !jobDataJson) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }
    
    if (format !== "csv" && format !== "pdf") {
      return json({ error: "Invalid export format" }, { status: 400 });
    }
    
    const jobData: ExportJobData = JSON.parse(jobDataJson);
    
    // Add shop domain from session
    jobData.shopDomain = session.shop;
    
    let exportResult;
    
    if (format === "csv") {
      exportResult = await generateCSVExport(jobData);
    } else {
      exportResult = await generatePDFExport(jobData);
    }
    
    return json({
      success: true,
      downloadUrl: exportResult.downloadUrl,
      filename: exportResult.filename,
      expiresAt: exportResult.expiresAt
    });
    
  } catch (error) {
    console.error("Export generation failed:", error);
    return json(
      { 
        error: error instanceof Error ? error.message : "Export generation failed" 
      }, 
      { status: 500 }
    );
  }
};
