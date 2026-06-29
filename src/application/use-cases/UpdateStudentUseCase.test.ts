import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateStudentUseCase } from './UpdateStudentUseCase.js';
import { mockDeep } from 'vitest-mock-extended';
import type { IStudentRepository } from '../../domain/repositories/IStudentRepository.js';
import { Student } from '../../domain/entities/Student.js';

describe('UpdateStudentUseCase', () => {
  let updateStudentUseCase: UpdateStudentUseCase;
  const mockStudentRepository = mockDeep<IStudentRepository>();

  beforeEach(() => {
    updateStudentUseCase = new UpdateStudentUseCase(mockStudentRepository);
    vi.clearAllMocks();
  });

  const mockStudent = new Student(1, '12345', 'John Doe', '10A', 1, 10, 2023, 10);
  const adminUser = { role: 'ADMIN', schoolUnitId: null };
  const unitAdminUser = { role: 'UNIT_ADMIN', schoolUnitId: 1 };
  const otherUnitAdminUser = { role: 'UNIT_ADMIN', schoolUnitId: 2 };

  it('should allow ADMIN to update any student', async () => {
    const updateData = { name: 'John Updated' };
    const updatedStudent = { ...mockStudent, ...updateData };

    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockStudentRepository.update.mockResolvedValue(updatedStudent as any);

    const result = await updateStudentUseCase.execute(1, updateData, adminUser);

    expect(result).toEqual(updatedStudent);
    expect(mockStudentRepository.update).toHaveBeenCalledWith(1, updateData);
  });

  it('should allow UNIT_ADMIN to update student in their unit', async () => {
    const updateData = { discountPercentage: 15 };
    const updatedStudent = { ...mockStudent, ...updateData };

    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockStudentRepository.update.mockResolvedValue(updatedStudent as any);

    const result = await updateStudentUseCase.execute(1, updateData, unitAdminUser);

    expect(result).toEqual(updatedStudent);
    expect(mockStudentRepository.update).toHaveBeenCalledWith(1, updateData);
  });

  it('should throw error if UNIT_ADMIN tries to update student in different unit', async () => {
    mockStudentRepository.findById.mockResolvedValue(mockStudent);

    await expect(updateStudentUseCase.execute(1, { name: 'Hack' }, otherUnitAdminUser)).rejects.toThrow(
      'Akses ditolak: Anda tidak memiliki otoritas untuk mengelola unit sekolah ini'
    );
    expect(mockStudentRepository.update).not.toHaveBeenCalled();
  });

  it('should throw error if student not found', async () => {
    mockStudentRepository.findById.mockResolvedValue(null);

    await expect(updateStudentUseCase.execute(999, { name: 'Ghost' }, adminUser)).rejects.toThrow(
      'Data siswa tidak ditemukan'
    );
  });
});
