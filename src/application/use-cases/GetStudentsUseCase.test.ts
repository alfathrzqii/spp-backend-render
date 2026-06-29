import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetStudentsUseCase } from './GetStudentsUseCase.js';
import { mockDeep } from 'vitest-mock-extended';
import type { IStudentRepository } from '../../domain/repositories/IStudentRepository.js';
import { Student } from '../../domain/entities/Student.js';

describe('GetStudentsUseCase', () => {
  let getStudentsUseCase: GetStudentsUseCase;
  const mockStudentRepository = mockDeep<IStudentRepository>();

  beforeEach(() => {
    getStudentsUseCase = new GetStudentsUseCase(mockStudentRepository);
    vi.clearAllMocks();
  });

  const mockStudents = [
    {
      ...new Student(1, '123', 'John Doe', '10A', 1, 1, 2023, 0),
      parent: { name: 'Parent One', email: 'parent1@example.com', phoneNumber: '08123456789' }
    },
    {
      ...new Student(2, '124', 'Jane Doe', '10B', 1, 2, 2023, 0),
      parent: { name: 'Parent Two', email: 'parent2@example.com', phoneNumber: '08123456790' }
    }
  ];

  it('should return all students when no filter is provided', async () => {
    mockStudentRepository.findAll.mockResolvedValue(mockStudents);

    const result = await getStudentsUseCase.execute();

    expect(result).toEqual(mockStudents);
    expect(mockStudentRepository.findAll).toHaveBeenCalledWith(undefined);
  });

  it('should filter students by schoolUnitId', async () => {
    const filter = { schoolUnitId: 1 };
    mockStudentRepository.findAll.mockResolvedValue(mockStudents);

    const result = await getStudentsUseCase.execute(filter);

    expect(result).toEqual(mockStudents);
    expect(mockStudentRepository.findAll).toHaveBeenCalledWith(filter);
  });

  it('should filter students by search term', async () => {
    const filter = { search: 'John' };
    const filteredStudents = [mockStudents[0]];
    mockStudentRepository.findAll.mockResolvedValue(filteredStudents);

    const result = await getStudentsUseCase.execute(filter);

    expect(result).toEqual(filteredStudents);
    expect(mockStudentRepository.findAll).toHaveBeenCalledWith(filter);
  });

  it('should filter students by className', async () => {
    const filter = { className: '10A' };
    const filteredStudents = [mockStudents[0]];
    mockStudentRepository.findAll.mockResolvedValue(filteredStudents);

    const result = await getStudentsUseCase.execute(filter);

    expect(result).toEqual(filteredStudents);
    expect(mockStudentRepository.findAll).toHaveBeenCalledWith(filter);
  });
});
