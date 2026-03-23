import { NextRequest, NextResponse } from "next/server";
import { verifyPayment, createPaymentRequest } from "@x402/express";

const paymentConfig = {
  "POST /api/buy-building": {
    accepts: [
      { network: "eip155:8453", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: "100000" } // $0.10
    ],
    description: "Purchase a new building (house)"
  }
} as const;

export async function POST(req: NextRequest) {
  const signature = req.headers.get("pay-signature");

  if (!signature) {
    const requirement = createPaymentRequest(paymentConfig, "POST /api/buy-building");
    return NextResponse.json(
      { error: "Payment required", payRequest: requirement },
      { status: 402, headers: { "Pay-Request": JSON.stringify(requirement) } }
    );
  }

  // Verify payment
  try {
    const valid = await verifyPayment({
      payment: {
        workflow: "exact",
        network: "eip155:8453",
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amount: "100000",
      },
      signature,
    });
    if (!valid) {
      return NextResponse.json({ error: "Invalid payment" }, { status: 402 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Payment verification failed" }, { status: 402 });
  }

  // In a full implementation, you'd now mint a building NFT to the user's address
  // For demo, we just confirm payment
  return NextResponse.json({ success: true, message: "Building purchased! (simulated)" });
}