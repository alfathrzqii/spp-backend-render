import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessOfflinePaymentUseCase } from './ProcessOfflinePaymentUseCase.js';
import { mockDeep } from 'vitest-mock-extended';
import type { IInvoiceRepository } from '../../domain/repositories/IInvoiceRepository.js';
import type { IStudentRepository } from '../../domain/repositories/IStudentRepository.js';
import type { ISppTariffRepository } from '../../domain/repositories/ISppTariffRepository.js';
import { InvoiceType, InvoiceStatus, CategoryType, PaymentMethod } from '@prisma/client';
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
    month: 5,
    year: 2023,
    recordedById: 10,
  };

  const mockStudent = new Student(1, '123', 'John Doe', '10A', 1, 5, 2023, 10);
  const mockTariff = { id: 1, schoolUnitId: 1, year: 2023, amount: 500000 };

  it('should process payment when invoice does not exist', async () => {
    mockInvoiceRepository.findByUniqueComposite.mockResolvedValue(null);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockSppTariffRepository.findByUnitAndYear.mockResolvedValue(mockTariff);

    const amountToPay = 450000; // 500000 - 10%
    const mockResult = {
      invoice: { id: 100, studentId: 1, month: 5, year: 2023, amount: amountToPay },
      transaction: { id: 200, amount: amountToPay }
    };
    mockInvoiceRepository.createOfflinePayment.mockResolvedValue(mockResult);

    const result = await processOfflinePaymentUseCase.execute(input);

    expect(result).toEqual({
      invoiceId: 100,
      studentId: 1,
      month: 5,
      year: 2023,
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
      month: 5,
      year: 2023,
      amount: 450000,
      status: InvoiceStatus.UNPAID
    };
    mockInvoiceRepository.findByUniqueComposite.mockResolvedValue(existingInvoice);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);

    const mockResult = {
      invoice: { id: 100, studentId: 1, month: 5, year: 2023, amount: 450000 },
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
    mockInvoiceRepository.findByUniqueComposite.mockResolvedValue({
      status: InvoiceStatus.PAID
    });

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
});
