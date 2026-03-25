import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

function verifyStripeSignature(payload: string, signature: string): boolean {
  try {
    const parts = signature.split(",");
    const timestamp = parts.find(p => p.startsWith("t="))?.split("=")[1];
    const sig = parts.find(p => p.startsWith("v1="))?.split("v1=")[1];
    if (!timestamp || !sig) return false;
    const expected = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest("hex");
    return sig === expected;
  } catch { return false; }
}

async function supabasePost(table: string, data: Record<string, unknown>) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
}

async function supabasePatch(table: string, filter: string, data: Record<string, unknown>) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
}

async function logAudit(action: string, entityType: string, entityId: string, details: string) {
  try {
    await supabasePost("audit_logs", {
      user_email: "stripe-webhook",
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details.slice(0, 500),
    });
  } catch { /* audit logging should never block */ }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") || "";
    if (signature && !verifyStripeSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    const data = event.data?.object;

    // Log ALL webhook events
    await logAudit(event.type, "stripe", event.id || "", JSON.stringify(data || {}).slice(0, 400));

    switch (event.type) {
      // ✅ Pago completado — create order
      case "checkout.session.completed": {
        if (data) {
          const metadata = data.metadata || {};
          await supabasePost("orders", {
            order_number: `DUL-${Date.now()}`,
            customer_name: data.customer_details?.name || "Cliente",
            customer_email: data.customer_details?.email || "",
            customer_phone: data.customer_details?.phone || "",
            total_price: (data.amount_total || 0) / 100,
            currency: data.currency?.toUpperCase() || "MXN",
            payment_status: "completed",
            stripe_payment_id: data.payment_intent || data.id,
            event_id: metadata.event_id || null,
            quantity: Number(metadata.quantity) || 1,
            zone_name: metadata.zone_name || null,
            unit_price: metadata.unit_price ? Number(metadata.unit_price) : (data.amount_total || 0) / 100,
            purchased_at: new Date().toISOString(),
            utm_source: metadata.utm_source || null,
            utm_medium: metadata.utm_medium || null,
            utm_campaign: metadata.utm_campaign || null,
          });
        }
        break;
      }

      // ✅ Pago exitoso — confirmation log
      case "payment_intent.succeeded": {
        if (data) {
          await logAudit("Pago confirmado", "payment", data.id, `$${(data.amount || 0) / 100} MXN — ${data.receipt_email || ""}`);
        }
        break;
      }

      // ❌ Pago fallido — log + audit (escalations table may not exist yet)
      case "payment_intent.payment_failed": {
        if (data) {
          const errorMsg = data.last_payment_error?.message || "Error desconocido";
          await logAudit(
            "Pago fallido",
            "payment",
            data.id,
            `PAGO FALLIDO: $${(data.amount || 0) / 100} MXN — ${errorMsg} — ${data.receipt_email || ""}`
          );
          // Try escalations table (may not exist yet)
          try {
            await supabasePost("escalations", {
              client_id: data.receipt_email || data.id,
              reason: "pago_fallido",
              event_mentioned: "",
              situation: `Pago fallido: ${errorMsg} — $${(data.amount || 0) / 100} MXN`,
              action_required: "Contactar al cliente para reintentar pago",
              resolved: false,
            });
          } catch { /* table may not exist — audit log is the fallback */ }
        }
        break;
      }

      // 🚨 Disputa/Chargeback
      case "charge.dispute.created": {
        if (data) {
          await logAudit(
            "DISPUTA CREADA",
            "dispute",
            data.charge || data.id,
            `URGENTE: $${(data.amount || 0) / 100} MXN — Razón: ${data.reason || "no especificada"}`
          );
          try {
            await supabasePost("escalations", {
              client_id: data.charge || data.id,
              reason: "disputa",
              event_mentioned: "",
              situation: `DISPUTA CREADA: $${(data.amount || 0) / 100} MXN — Razón: ${data.reason || "no especificada"}`,
              action_required: "URGENTE: Responder disputa en Stripe dentro de 7 días",
              resolved: false,
            });
          } catch { /* table may not exist */ }
        }
        break;
      }

      // 💰 Reembolso — update order status + audit log
      case "charge.refunded": {
        if (data) {
          const paymentIntent = data.payment_intent;
          await logAudit(
            "Reembolso procesado",
            "refund",
            data.id,
            `Reembolso $${(data.amount_refunded || 0) / 100} MXN — PI: ${paymentIntent || "N/A"}`
          );
          // Update the order to payment_status: refunded
          if (paymentIntent) {
            await supabasePatch(
              "orders",
              `stripe_payment_id=eq.${paymentIntent}`,
              { payment_status: "refunded", updated_at: new Date().toISOString() }
            );
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
