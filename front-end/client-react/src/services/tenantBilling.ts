import { request } from "./session";
import type { PublicPlan, PublicPlans, Quote } from "./contracts";
export interface Subscription {
  plan: PublicPlan;
  status: string;
  employeeCount: number;
  currency: string;
  priceAtSubscription: string;
  employeeAmount: string;
  featureAmount: string;
  billingInterval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  selectedAddOns: { featureId: string; name: string; amount: string }[];
}
export interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  currency: string;
  status: string;
  dueDate: string;
  issueDate: string;
}
interface Payment {
  id: string;
  provider: string;
  providerReference: string;
  amount: string;
  currency: string;
  status: string;
  paidAt: string;
  failedAt: string;
  createdAt: string;
}
export interface Selection {
  planId: string;
  employeeCount: number;
  featureIds: string[];
}
const base = "/api/v1/tenant";
export const billing = {
  load: async () => {
    const [subscription, invoices, payments] = await Promise.all([
      request<Subscription>(`${base}/subscription`),
      request<{ items: Invoice[] }>(`${base}/subscription/invoices`),
      request<{ items: Payment[] }>(`${base}/subscription/payments`),
    ]);
    return { subscription, invoices: invoices.items, payments: payments.items };
  },
  plans: () =>
    request<PublicPlans>(`${base}/onboarding/plans`, { authenticated: false }),
  quote: (body: Selection, signal: AbortSignal) =>
    request<Quote>(`${base}/onboarding/quotes`, {
      method: "POST",
      body,
      signal,
      authenticated: false,
    }),
  change: (body: Selection) =>
    request(`${base}/subscription/plan-changes`, { method: "POST", body }),
  cancel: (reason: string) =>
    request(`${base}/subscription/cancellations`, {
      method: "POST",
      body: { reason },
    }),
};
type CheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type Checkout = new (options: object) => { open: () => void };
declare global {
  interface Window {
    Razorpay?: Checkout;
  }
}
let checkoutLoader: Promise<void> | undefined;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutLoader)
    checkoutLoader = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () =>
        window.Razorpay
          ? resolve()
          : reject(new Error("Payment checkout is unavailable."));
      script.onerror = () =>
        reject(new Error("Payment checkout could not load. Please retry."));
      document.head.append(script);
    }).catch((error) => {
      checkoutLoader = undefined;
      throw error;
    });
  return checkoutLoader;
}
export async function payInvoice(invoice: Invoice) {
  // The backend checks ownership, status and provider configuration before creating an order.
  const order = await request<{
    keyId: string;
    amount: number;
    currency: string;
    orderId: string;
  }>(`${base}/billing/invoices/${invoice.id}/payment-orders`, {
    method: "POST",
  });
  await loadCheckout();
  return new Promise<void>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "FinStack",
      description: `Subscription invoice ${invoice.invoiceNumber}`,
      modal: {
        ondismiss: () =>
          reject(
            new Error("Payment checkout closed. Your invoice remains unpaid."),
          ),
      },
      handler: (response: CheckoutResponse) => {
        request(`${base}/billing/razorpay/verify`, {
          method: "POST",
          body: { invoiceId: invoice.id, ...response },
        }).then(() => resolve(), reject);
      },
    });
    checkout.open();
  });
}
