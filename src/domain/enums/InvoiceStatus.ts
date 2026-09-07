export const InvoiceStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  VOID: "VOID",
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];
