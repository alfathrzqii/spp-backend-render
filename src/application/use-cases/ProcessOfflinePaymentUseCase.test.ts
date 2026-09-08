import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessOfflinePaymentUseCase } from './ProcessOfflinePaymentUseCase.js';
import { mockDeep } from 'vitest-mock-extended';
import type { IInvoiceRepository } from '../../domain/repositories/IInvoiceRepository.js';
import type { IStudentRepository } from '../../domain/repositories/IStudentRepository.js';
import type { ISppTariffRepository } from '../../domain/repositories/ISppTariffRepository.js';
import { InvoiceType, InvoiceStatus, CategoryType, PaymentMethod } from '../../domain/enums/index.js';
import { Student } from '../../domain/entities/Student.js';

describe('ProcessOfflinePaymentUseCase', () => {
  let processOfflinePaymentUseCase: ProcessOfflinePaymentUseCase;
  const mockInvoiceRepository = mockDeep<IInvoiceRepository>();
  const mockStudentRepository = mockDeep<IStudentRepository>();
  const mockSppTariffRepository = mockDeep<ISppTariffRepository>();

  beforeEach(() => {
    processOfflinePaymentUseCase = new ProcessOfflinePaymentUseCase(
      mockInvoiceRepository,
      mockStudentRepository,
      mockSppTariffRepository
    );
    vi.clearAllMocks();
  });

  const input = {
    studentId: 1,
    month: 8,
    year: 2026,
    recordedById: 10,
  };

  const mockStudent = new Student(1, '123', 'John Doe', '10A', 1, 5, 2026, 10);
  const mockTariff = { id: 1, schoolUnitId: 1, year: 2026, amount: 500000 };

  it('should process payment when invoice does not exist', async () => {
    mockInvoiceRepository.findByUniqueComposite.mockResolvedValue(null);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockSppTariffRepository.findByUnitAndYear.mockResolvedValue(mockTariff);

    const amountToPay = 450000; // 500000 - 10%
    const mockResult = {
      invoice: { id: 100, studentId: 1, month: 8, year: 2026, amount: amountToPay },
      transaction: { id: 200, amount: amountToPay }
    };
    mockInvoiceRepository.createOfflinePayment.mockResolvedValue(mockResult);

    const result = await processOfflinePaymentUseCase.execute(input);

    expect(result).toEqual({
      invoiceId: 100,
      studentId: 1,
      month: 8,
      year: 2026,
      amountPaid: amountToPay,
      transactionId: 200,
    });

    expect(mockInvoiceRepository.createOfflinePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 1,
        amount: amountToPay,
        status: InvoiceStatus.PAID,
      }),
      expect.objectContaining({
        type: CategoryType.INCOME,
        amount: amountToPay,
        schoolUnitId: 1,
      }),
      undefined
    );
  });

  it('should process payment when invoice exists and is unpaid', async () => {
    const existingInvoice = {
      id: 100,
      studentId: 1,
      invoiceType: InvoiceType.SPP,
      month: 8,
      year: 2026,
      amount: 450000,
      status: InvoiceStatus.PENDING
    };
    mockInvoiceRepository.findByUniqueComposite.mockResolvedValue(existingInvoice as any);
    mockInvoiceRepository.getPaidAmount.mockResolvedValue(0);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);

    const mockResult = {
      invoice: { id: 100, studentId: 1, month: 8, year: 2026, amount: 450000 },
      transaction: { id: 200, amount: 450000 }
    };
    mockInvoiceRepository.createOfflinePayment.mockResolvedValue(mockResult);

    const result = await processOfflinePaymentUseCase.execute(input);

    expect(result.amountPaid).toBe(450000);
    expect(mockInvoiceRepository.createOfflinePayment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 100, status: InvoiceStatus.PAID }),
      expect.any(Object),
      100
    );
  });

  it('should throw error if invoice is already paid', async () => {
    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockInvoiceRepository.findByUniqueComposite.mockResolvedValue({
      status: InvoiceStatus.PAID
    } as any);

    await expect(processOfflinePaymentUseCase.execute(input)).rejects.toThrow(
      'Gagal: Tagihan SPP siswa untuk bulan dan tahun tersebut sudah lunas'
    );
  });

  it('should throw error if student not found', async () => {
    mockInvoiceRepository.findByUniqueComposite.mockResolvedValue(null);
    mockStudentRepository.findById.mockResolvedValue(null);

    await expect(processOfflinePaymentUseCase.execute(input)).rejects.toThrow(
      'Gagal: Siswa tidak ditemukan'
    );
  });

  it('should throw error if tariff not configured', async () => {
    mockInvoiceRepository.findByUniqueComposite.mockResolvedValue(null);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockSppTariffRepository.findByUnitAndYear.mockResolvedValue(null);

    await expect(processOfflinePaymentUseCase.execute(input)).rejects.toThrow(
      'Gagal: Master tarif SPP untuk angkatan siswa ini belum dikonfigurasi'
    );
  });

  it('should throw error if billing period is before enrollment or before July 2026', async () => {
    mockStudentRepository.findById.mockResolvedValue(mockStudent);

    await expect(
      processOfflinePaymentUseCase.execute({
        ...input,
        month: 5,
        year: 2026,
      })
    ).rejects.toThrow(
      'Akses ditolak: Tagihan tidak tersedia untuk periode sebelum siswa terdaftar atau sebelum sistem dimulai (Juli 2026)'
    );
  });
});
