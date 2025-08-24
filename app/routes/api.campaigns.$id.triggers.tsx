import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
// import { CampaignService } from "~/lib/services/CampaignService";
// import { authenticateUser } from "~/lib/auth.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    // await authenticateUser(request);

    if (!params.id) {
      return json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { 
      triggerReason, 
      productIds, 
      successful, 
      processingTime,
      errorMessage 
    } = body;

    // Validate required fields
    if (!triggerReason || !Array.isArray(productIds) || typeof successful !== 'boolean') {
      return json(
        { error: "Missing required fields: triggerReason, productIds, successful" },
        { status: 400 }
      );
    }

    // const campaignService = new CampaignService();
    // await campaignService.recordTriggerEvent(
    //   params.id,
    //   triggerReason,
    //   productIds,
    //   successful,
    //   processingTime || 0,
    //   errorMessage
    // );

    // Mock successful response
    console.log("Recording trigger event:", {
      campaignId: params.id,
      triggerReason,
      productIds,
      successful,
      processingTime,
      errorMessage
    });

    return json({ 
      success: true, 
      message: "Trigger event recorded successfully",
      eventId: `trigger_${Date.now()}`
    });
  } catch (error: any) {
    console.error("Failed to record trigger event:", error);
    return json(
      { error: error.message || "Failed to record trigger event" },
      { status: 500 }
    );
  }
}
