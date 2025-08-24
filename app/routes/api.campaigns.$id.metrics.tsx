import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
// import { CampaignService } from "~/lib/services/CampaignService";
// import { authenticateUser } from "~/lib/auth.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // await authenticateUser(request);

    if (!params.id) {
      return json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    // const campaignService = new CampaignService();
    // const metrics = await campaignService.getCampaignMetrics(params.id);

    // Mock response for now
    const metrics = {
      campaignId: params.id,
      totalTriggers: 0,
      lastTriggered: null,
      affectedProducts: 0,
      priceChanges: [],
      webhookStatus: {
        isActive: true,
        lastProcessed: null,
        processingErrors: 0,
        avgProcessingTime: 250,
        successRate: 100
      },
      performanceStats: {
        totalRevenue: 0,
        avgOrderValue: 0,
        conversionRate: 0,
        inventoryTurnover: 0,
        priceOptimizationScore: 85
      }
    };

    return json({ success: true, metrics });
  } catch (error: any) {
    console.error("Failed to get campaign metrics:", error);
    return json(
      { error: error.message || "Failed to get campaign metrics" },
      { status: error.message?.includes("not found") ? 404 : 500 }
    );
  }
}
