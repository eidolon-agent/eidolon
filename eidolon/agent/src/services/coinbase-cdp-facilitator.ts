import { EventEmitter } from 'events';
import { ethers } from 'ethers';

// TODO: Update import if CDP SDK structure differs
// The x402 methods are likely under CDPClient.x402
interface CDPClient {
  x402: {
    verifyPayment: (params: { clientId: string; resource: string; amount: number }) => Promise<boolean>;
    createPaymentRequest: (params: { 
      clientId: string; 
      resource: string; 
      amount: number; 
      currency?: string; 
      expiresIn?: number 
    }) => Promise<{
      paymentAddress: string;
      amount: string;
      deadline: string;
      memo?: string;
    }>;
    getPaymentStatus: (params: { clientId: string; resource: string }) => Promise<{
      paid: boolean;
      amountPaid: number;
      txHash?: string;
      paidAt?: string;
    }>;
  };
  webhooks: {
    create: (params: { url: string; events: string[] }) => Promise<any>;
  };
}

export class CoinbaseCDPFacilitator extends EventEmitter {
  private cdp: CDPClient;
  private paymentAddress: string;
  private onCharge?: (clientId: string, amount: number, resource: string) => Promise<void>;

  constructor(config: {
    apiKey: string;
    paymentAddress: string;
    onCharge?: (clientId: string, amount: number, resource: string) => Promise<void>;
  }) {
    super();
    this.paymentAddress = config.paymentAddress;
    this.onCharge = config.onCharge;
    
    // Initialize CDP client (pseudo-code — adjust to actual SDK)
    // @ts-ignore — replace with real CDPClient import and construction
    this.cdp = new (require('@coinbase/cdp-sdk').CDPClient)({ 
      apiKey: config.apiKey,
      // other options: network, etc.
    }) as CDPClient;
  }

  /**
   * Creates Express middleware that enforces x402 payment.
   * Use this in route definitions.
   */
  createMiddleware(resource: { path: string; method: string }, priceUSD: number) {
    return async (req: any, res: any, next: Function) => {
      const clientId = req.header('X-Client-ID') || 'anonymous';
      
      // Verify payment via Coinbase CDP
      let paid = false;
      try {
        paid = await this.cdp.x402.verifyPayment({
          clientId,
          resource: resource.path,
          amount: priceUSD,
        });
      } catch (err) {
        this.emit('error', `CDP payment verification error: ${err.message}`);
      }

      if (!paid) {
        // Return 402 Payment Required with x402 headers
        res.set('X-402-Payment-Required', `${priceUSD} USDC`);
        res.set('X-402-Payment-Address', this.paymentAddress);
        res.set('X-402-Payment-Description', `Access to ${resource.path}`);
        res.set('X-Payment-Provider', 'coinbase-cdp');
        return res.status(402).json({ 
          error: 'Payment required',
          priceUSD,
          paymentAddress: this.paymentAddress,
          resource: resource.path
        });
      }

      // Payment verified — proceed to handler
      next();
    };
  }

  /**
   * Generate a payment request for a client.
   * Returns details needed to construct the on-chain payment transaction.
   */
  async requestPayment(clientId: string, resource: string, amount: number): Promise<{
    paymentAddress: string;
    amount: string;
    deadline: string;
    memo?: string;
  }> {
    try {
      const req = await this.cdp.x402.createPaymentRequest({
        clientId,
        resource,
        amount,
        currency: 'USDC',
        expiresIn: 900, // 15 minutes
      });
      return req;
    } catch (err) {
      this.emit('error', `CDP createPaymentRequest error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Check payment status for a client/resource.
   */
  async getPaymentStatus(clientId: string, resource: string): Promise<{
    paid: boolean;
    amountPaid: number;
    txHash?: string;
    paidAt?: string;
  }> {
    try {
      return await this.cdp.x402.getPaymentStatus({ clientId, resource });
    } catch (err) {
      this.emit('error', `CDP getPaymentStatus error: ${err.message}`);
      return { paid: false, amountPaid: 0 };
    }
  }

  /**
   * Register a webhook endpoint for payment events.
   * Useful for asynchronous notification of payments.
   */
  async registerWebhook(url: string, events: string[] = ['payment.verified']) {
    try {
      await this.cdp.webhooks.create({ url, events });
      this.emit('log', `[CDP] Registered webhook ${url} for events: ${events.join(', ')}`);
    } catch (err) {
      this.emit('error', `CDP webhook registration error: ${err.message}`);
    }
  }
}
