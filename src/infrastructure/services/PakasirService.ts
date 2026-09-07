import type { IPakasirService, PakasirCreateResponse, PakasirDetailResponse } from "../../application/ports/IPakasirService.js";
import { logger } from "./WinstonLogger.js";

export class PakasirService implements IPakasirService {
  private projectSlug: string;
  private apiKey: string;

  constructor() {
    this.projectSlug = process.env.PAKASIR_PROJECT_SLUG || "depodomain";
    this.apiKey = process.env.PAKASIR_API_KEY || "xxx123";
  }

  async createTransaction(method: string, orderId: string, amount: number): Promise<PakasirCreateResponse> {
    let mappedMethod = method.toLowerCase();
    if (mappedMethod === "mandiri" || mappedMethod === "va_mandiri") mappedMethod = "bni_va";
    else if (mappedMethod === "bca" || mappedMethod === "va_bca") mappedMethod = "bri_va";
    else if (mappedMethod === "gopay") mappedMethod = "qris";

    const pakasirUrl = `https://app.pakasir.com/api/transactioncreate/${mappedMethod}`;
    const pakasirPayload = {
      project: this.projectSlug,
      order_id: String(orderId),
      amount: Number(amount),
      api_key: this.apiKey,
    };

    let pakasirData: any = null;
    try {
      const response = await fetch(pakasirUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pakasirPayload),
      });

      if (response.ok) {
        pakasirData = await response.json();
      } else {
        const errText = await response.text();
        logger.warn(`Pakasir API returned error status ${response.status}: ${errText}`);
      }
    } catch (err) {
      logger.error(`Gagal menghubungi API Pakasir: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!pakasirData || !pakasirData.payment) {
      logger.warn("Menggunakan response tiruan (mock) Pakasir untuk pengujian local.");
      const calculatedFee = method.toLowerCase() === "qris" 
        ? Math.round(amount * 0.008)
        : 3500;
      pakasirData = {
        payment: {
          project: this.projectSlug,
          order_id: orderId,
          amount: amount,
          fee: calculatedFee,
          total_payment: amount + calculatedFee,
          payment_method: method,
          payment_number: method.toLowerCase() === "qris" 
            ? "00020101021226610016ID.CO.SHOPEE.WWW01189360091800216005230208216005230303UME51440014ID.CO.QRIS.WWW0215ID10243228429300303UME5204792953033605409100003.005802ID5907Pakasir6012KAB. KEBUMEN61055439262230519SP25RZRATEQI2HQ65Q46304A079"
            : `89022${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          expired_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }
      };
    }

    return pakasirData;
  }

  async getTransactionDetail(orderId: string, amount: number): Promise<PakasirDetailResponse | null> {
    const detailUrl = `https://app.pakasir.com/api/transactiondetail?project=${this.projectSlug}&amount=${amount}&order_id=${orderId}&api_key=${this.apiKey}`;
    try {
      const response = await fetch(detailUrl);
      if (response.ok) {
        return (await response.json()) as PakasirDetailResponse;
      }
    } catch (err) {
      logger.error(`Gagal memanggil detail transaksi Pakasir: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  }

  async simulatePayment(orderId: string, amount: number): Promise<void> {
    try {
      await fetch("https://app.pakasir.com/api/paymentsimulation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project: this.projectSlug,
          order_id: String(orderId),
          amount,
          api_key: this.apiKey,
        }),
      });
    } catch (err) {
      logger.warn(`Simulasi Pakasir eksternal dilewati: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
