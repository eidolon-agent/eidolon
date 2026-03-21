import { EventEmitter } from 'events';

// Optional: remove if not used
// import { ethers } from 'ethers';

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

    try {
      // ⚠️ dynamic require (safe fallback)
      const { CDPClient } = require('@coinbase/cdp-sdk');

      this.cdp = new CDPClient({
        apiKey: config.apiKey,
      }) as CDPClient;

    } catch (err: any) {
      throw new Error(`Failed to initialize CDP SDK: ${err?.message || err}`);
    }
  }

  /**
   * Express middleware for x402 payment enforcement
   */
  createMiddleware(resource: { path: string; method: string }, priceUSD: number) {
    return async (req: any, res: any, next: Function) => {
      const clientId = req.header?.('X-Client-ID') || 'anonymous';

      let paid = false;

      try {
        paid = await this.cdp.x402.verifyPayment({
          clientId,
          resource: resource.path,
          amount: priceUSD,
        });
      } catch (err: any) {
        this.emit('error', `[CDP verifyPayment] ${err?.message || err}`);
      }

      if (!paid) {
        res.set('X-402-Payment-Required', `${priceUSD} USDC`);
        res.set('X-402-Payment-Address', this.paymentAddress);
        res.set('X-402-Payment-Description', `Access to ${resource.path}`);
        res.set('X-Payment-Provider', 'coinbase-cdp');

        return res.status(402).json({
          error: 'Payment required',
          priceUSD,
          paymentAddress: this.paymentAddress,
          resource: resource.path,
        });
      }

      // Optional: trigger charge callback
      if (this.onCharge) {
        try {
          await this.onCharge(clientId, priceUSD, resource.path);
        } catch (err: any) {
          this.emit('error', `[CDP onCharge] ${err?.message || err}`);
        }
      }

      next();
    };
  }

  /**
   * Create payment request
   */
  async requestPayment(
    clientId: string,
    resource: string,
    amount: number
  ): Promise<{
    paymentAddress: string;
    amount: string;
    deadline: string;
    memo?: string;
  }> {
    try {
      return await this.cdp.x402.createPaymentRequest({
        clientId,
        resource,
        amount,
        currency: 'USDC',
        expiresIn: 900,
      });
    } catch (err: any) {
      this.emit('error', `[CDP requestPayment] ${err?.message || err}`);
      throw err;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(clientId: string, resource: string) {
    try {
      return await this.cdp.x402.getPaymentStatus({ clientId, resource });
    } catch (err: any) {
      this.emit('error', `[CDP getPaymentStatus] ${err?.message || err}`);
      return { paid: false, amountPaid: 0 };
    }
  }

  /**
   * Register webhook
   */
  async registerWebhook(url: string, events: string[] = ['payment.verified']) {
    try {
      await this.cdp.webhooks.create({ url, events });
      this.emit('log', `[CDP] Webhook registered: ${url}`);
    } catch (err: any) {
      this.emit('error', `[CDP webhook] ${err?.message || err}`);
    }
  }
    }
