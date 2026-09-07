export const InvoiceType = {
  SPP: "SPP",
  EKSTRAKURIKULER: "EKSTRAKURIKULER",
  KEGIATAN: "KEGIATAN",
  LAINNYA: "LAINNYA",
  UANG_PENGEMBANGAN: "UANG_PENGEMBANGAN",
  DAFTAR_ULANG: "DAFTAR_ULANG",
  UANG_PERALATAN: "UANG_PERALATAN",
  SERAGAM: "SERAGAM",
  FULLDAY: "FULLDAY",
} as const;

export type InvoiceType = (typeof InvoiceType)[keyof typeof InvoiceType];
