export interface PakasirPaymentInfo {
  project?: string;
  order_id?: string;
  amount?: number;
  fee?: number;
  total_payment?: number;
  payment_method?: string;
  payment_number?: string;
  expired_at?: string;
  [key: string]: any;
}

export interface PakasirCreateResponse {
  payment?: PakasirPaymentInfo;
  [key: string]: any;
}

export interface PakasirDetailResponse {
  transaction?: {
    status?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface IPakasirService {
  createTransaction(method: string, orderId: string, amount: number): Promise<PakasirCreateResponse>;
  getTransactionDetail(orderId: string, amount: number): Promise<PakasirDetailResponse | null>;
  simulatePayment(orderId: string, amount: number): Promise<void>;
}
