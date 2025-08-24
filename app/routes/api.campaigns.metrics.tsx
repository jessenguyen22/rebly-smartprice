import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
// import { CampaignService } from "~/lib/services/CampaignService";
// import { authenticateUser } from "~/lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // await authenticateUser(request);

    // const campaignService = new CampaignService();
    // const aggregateMetrics = await campaignService.getAggregateMetrics();

    // Mock response for now
    const aggregateMetrics = {
      totalCampaigns: 5,
      activeCampaigns: 3,
      totalTriggers: 127,
      totalPriceChanges: 234,
      avgSuccessRate: 96.5,
      topPerformingCampaigns: [
        {
          campaignId: "camp_1",
          campaignName: "Competitive Price Matching",
          triggerCount: 45,
          successRate: 98.2,
          totalPriceChanges: 89,
          avgResponseTime: 230,
          lastActiveDate: new Date()
        },
        {
          campaignId: "camp_2", 
          campaignName: "Inventory Optimization",
          triggerCount: 32,
          successRate: 95.1,
          totalPriceChanges: 67,
          avgResponseTime: 280,
          lastActiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        {
          campaignId: "camp_3",
          campaignName: "Dynamic Pricing",
          triggerCount: 28,
          successRate: 94.8,
          totalPriceChanges: 51,
          avgResponseTime: 195,
          lastActiveDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        }
      ]
    };

    return json({ success: true, metrics: aggregateMetrics });
  } catch (error: any) {
    console.error("Failed to get aggregate metrics:", error);
    return json(
      { error: error.message || "Failed to get aggregate metrics" },
      { status: 500 }
    );
  }
}
