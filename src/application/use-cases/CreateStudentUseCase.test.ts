import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateStudentUseCase, type CreateStudentRequest } from './CreateStudentUseCase.js';
import { mockDeep } from 'vitest-mock-extended';
import type { IStudentRepository } from '../../domain/repositories/IStudentRepository.js';
import type { IUserRepository } from '../../domain/repositories/IUserRepository.js';
import type { ISppTariffRepository } from '../../domain/repositories/ISppTariffRepository.js';
import type { PasswordHasher } from '../../infrastructure/services/PasswordHasher.js';
import { Student } from '../../domain/entities/Student.js';
import { User } from '../../domain/entities/User.js';

describe('CreateStudentUseCase', () => {
  let createStudentUseCase: CreateStudentUseCase;
  const mockStudentRepository = mockDeep<IStudentRepository>();
  const mockUserRepository = mockDeep<IUserRepository>();
  const mockSppTariffRepository = mockDeep<ISppTariffRepository>();
  const mockPasswordHasher = mockDeep<PasswordHasher>();

  beforeEach(() => {
    createStudentUseCase = new CreateStudentUseCase(
      mockStudentRepository,
      mockUserRepository,
      mockSppTariffRepository,
      mockPasswordHasher
    );
    vi.clearAllMocks();
  });

  const studentData: CreateStudentRequest = {
    studentNumber: '12345',
    name: 'John Doe',
    className: '10A',
    schoolUnitId: 1,
    enrollmentYear: 2023,
    discountPercentage: 10,
    parentName: 'Parent Doe',
    parentPhoneNumber: '08123456789',
    parentEmail: 'parent@example.com',
  };

  const mockTariff = {
    id: 1,
    schoolUnitId: 1,
    year: 2023,
    amount: 500000,
  };

  it('should create a student with a new parent account', async () => {
    mockStudentRepository.findByStudentNumber.mockResolvedValue(null);
    mockSppTariffRepository.findByUnitAndYear.mockResolvedValue(mockTariff);
    mockUserRepository.findByPhoneNumber.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue('hashedPassword');

    const expectedStudent = new Student(
      1,
      studentData.studentNumber,
      studentData.name,
      studentData.className,
      studentData.schoolUnitId,
      10, // parentId
      studentData.enrollmentYear,
      studentData.discountPercentage
    );
    mockStudentRepository.create.mockResolvedValue(expectedStudent);

    const result = await createStudentUseCase.execute(studentData);

    expect(result).toBeInstanceOf(Student);
    expect(result).toEqual(expectedStudent);
    expect(mockPasswordHasher.hash).toHaveBeenCalledWith('parent123');
    expect(mockStudentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studentNumber: studentData.studentNumber,
        parentId: undefined, // It will be undefined because it's passed as second argument data
      }),
      expect.objectContaining({
        name: studentData.parentName,
        passwordHash: 'hashedPassword',
      })
    );
  });

  it('should create a student with an existing parent account', async () => {
    const existingParent = new User(10, 'Parent Doe', 'parent@example.com', '08123456789', 'hash', 'PARENT', null);
    mockStudentRepository.findByStudentNumber.mockResolvedValue(null);
    mockSppTariffRepository.findByUnitAndYear.mockResolvedValue(mockTariff);
    mockUserRepository.findByPhoneNumber.mockResolvedValue(existingParent);

    const expectedStudent = new Student(
      1,
      studentData.studentNumber,
      studentData.name,
      studentData.className,
      studentData.schoolUnitId,
      10,
      studentData.enrollmentYear,
      studentData.discountPercentage
    );
    mockStudentRepository.create.mockResolvedValue(expectedStudent);

    const result = await createStudentUseCase.execute(studentData);

    expect(result).toEqual(expectedStudent);
    expect(mockPasswordHasher.hash).not.toHaveBeenCalled();
    expect(mockStudentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: 10,
      }),
      undefined
    );
  });

  it('should throw error if student number already exists', async () => {
    mockStudentRepository.findByStudentNumber.mockResolvedValue({ id: 1 } as any);

    await expect(createStudentUseCase.execute(studentData)).rejects.toThrow(
      'Gagal: Nomor induk siswa (NIS) sudah terdaftar'
    );
  });

  it('should throw error if SPP tariff is not configured', async () => {
    mockStudentRepository.findByStudentNumber.mockResolvedValue(null);
    mockSppTariffRepository.findByUnitAndYear.mockResolvedValue(null);

    await expect(createStudentUseCase.execute(studentData)).rejects.toThrow(
      'Gagal: Tarif dasar SPP untuk unit dan angkatan ini belum dikonfigurasi'
    );
  });
});
