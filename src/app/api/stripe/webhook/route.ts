import { NextRequest, NextResponse } from "next/server";
import { stripeService } from "@/core/stripe/stripe-service";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    const result = await stripeService.handleWebhook(rawBody, signature);

    return NextResponse.json({ received: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    console.error("Stripe Webhook Error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
