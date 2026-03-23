import { NextRequest, NextResponse } from "next/server";
import { verifyPayment, createPaymentRequest, payWithFacilitator } from "@x402/express";

// Config for x402
const paymentConfig = {
  "GET /api/weather": {
    accepts: [
      { network: "eip155:8453", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: "50000" } // $0.05 USDC (6 decimals)
    ],
    description: "Get weather forecast for next turn"
  }
} as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const signature = req.headers.get("pay-signature");

  // Verify x402 payment if signature present
  if (signature) {
    try {
      const valid = await verifyPayment({
        payment: {
          workflow: "exact",
          network: "eip155:8453",
          token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          amount: "50000",
        },
        signature,
        // In production, the facilitator will verify onchain; for demo we accept any valid signature
      });
      if (!valid) {
        return NextResponse.json({ error: "Invalid payment" }, { status: 402 });
      }
    } catch (err) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 402 });
    }
  } else {
    // No payment: return 402 with payment required header
    const requirement = createPaymentRequest(paymentConfig, "GET /api/weather");
    return NextResponse.json(
      { error: "Payment required", payRequest: requirement },
      { status: 402, headers: { "Pay-Request": JSON.stringify(requirement) } }
    );
  }

  // Payment verified — return weather data
  const forecasts = ["Sunny", "Rainy", "Stormy", "Cloudy", "Foggy"];
  const forecast = forecasts[Math.floor(Math.random() * forecasts.length)];
  return NextResponse.json({ forecast, timestamp: Date.now() });
}