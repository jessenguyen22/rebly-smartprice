import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  try {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const feature = formData.get("feature") as string;
    
    // Log the notification request
    console.log(`📧 Campaign Feature Notification Request:`, {
      shop: session.shop,
      email: email || 'shop owner email',
      feature: feature || 'campaign automation',
      timestamp: new Date().toISOString()
    });
    
    // In a real app, you would:
    // 1. Save to a notification list database table
    // 2. Send to email service (SendGrid, Mailchimp, etc.)
    // 3. Add to CRM system
    
    return json({
      success: true,
      message: "Thank you! We'll notify you when Campaign automation is available."
    });
    
  } catch (error) {
    console.error("Notification signup failed:", error);
    return json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Signup failed" 
      }, 
      { status: 500 }
    );
  }
};
