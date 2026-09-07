export const PaymentMethod = {
  CASH: "CASH",
  MIDTRANS: "MIDTRANS",
  TRANSFER: "TRANSFER",
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
