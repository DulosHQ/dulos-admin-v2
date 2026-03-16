import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const STRIPE_WEBHOOK_SECRET = "whsec_p5BUrQHnlhi6AMzmzl9kXvQaIslAwVff";
const SUPABASE_URL = "https://udjwabtyhjcrpyuffavz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU5MzkzNCwiZXhwIjoyMDg5MTY5OTM0fQ.-1ABMJP5sYUyW1MDg2W7T8ZE3ipe5x_Lvmec9UdZkO8";

function verifyStripeSignature(payload: string, signature: string): boolean {
  try {
    const parts = signature.split(",");
    const timestamp = parts.find(p => p.startsWith("t="))?.split("=")[1];
    const sig = parts.find(p => p.startsWith("v1="))?.split("=")[1];
    if (!timestamp || !sig) return false;
    const expected = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest("hex");
    return sig === expected;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

    // Verify signature in production
    if (signature && !verifyStripeSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);

    // Log webhook
    await fetch(`${SUPABASE_URL}/rest/v1/dulos_audit_logs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_email: "stripe-webhook",
        action: event.type || "webhook",
        entity_type: "stripe",
        entity_id: event.id || "",
        details: JSON.stringify(event).slice(0, 500),
      }),
    });

    // Handle payment events
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      const data = event.data?.object;
      if (data) {
        await fetch(`${SUPABASE_URL}/rest/v1/dulos_orders`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            order_number: `DUL-${Date.now()}`,
            customer_name: data.customer_details?.name || "Cliente",
            customer_email: data.customer_details?.email || "",
            total_price: (data.amount_total || data.amount || 0) / 100,
            payment_status: "completed",
            stripe_payment_id: data.payment_intent || data.id || "",
          }),
        });
      }
    }

    // Handle refunds
    if (event.type === "charge.refunded") {
      const data = event.data?.object;
      if (data) {
        await fetch(`${SUPABASE_URL}/rest/v1/dulos_audit_logs`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            user_email: "stripe-webhook",
            action: "Reembolso procesado",
            entity_type: "refund",
            entity_id: data.id,
            details: `Reembolso $${(data.amount_refunded || 0) / 100} MXN`,
          }),
        });
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
