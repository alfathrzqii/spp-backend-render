import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginUseCase } from './LoginUseCase.js';
import { User } from '../../domain/entities/User.js';
import { mockDeep } from 'vitest-mock-extended';
import type { IUserRepository } from '../../domain/repositories/IUserRepository.js';
import type { PasswordHasher } from '../../infrastructure/services/PasswordHasher.js';

describe('LoginUseCase', () => {
  let loginUseCase: LoginUseCase;
  const mockUserRepository = mockDeep<IUserRepository>();
  const mockPasswordHasher = mockDeep<PasswordHasher>();

  beforeEach(() => {
    loginUseCase = new LoginUseCase(mockUserRepository, mockPasswordHasher);
    vi.clearAllMocks();
  });

  it('should login successfully with email', async () => {
    const email = 'test@example.com';
    const password = 'password123';
    const hashedPassword = 'hashedPassword';
    const user = new User(1, 'Test User', email, '08123456789', hashedPassword, 'ADMIN', null);

    mockUserRepository.findByEmail.mockResolvedValue(user);
    mockPasswordHasher.compare.mockResolvedValue(true);

    const result = await loginUseCase.execute(email, password);

    expect(result).toBe(user);
    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
    expect(mockPasswordHasher.compare).toHaveBeenCalledWith(password, hashedPassword);
  });

  it('should login successfully with phone number', async () => {
    const phoneNumber = '08123456789';
    const password = 'password123';
    const hashedPassword = 'hashedPassword';
    const user = new User(1, 'Test User', 'test@example.com', phoneNumber, hashedPassword, 'ADMIN', null);

    mockUserRepository.findByPhoneNumber.mockResolvedValue(user);
    mockPasswordHasher.compare.mockResolvedValue(true);

    const result = await loginUseCase.execute(phoneNumber, password);

    expect(result).toBe(user);
    expect(mockUserRepository.findByPhoneNumber).toHaveBeenCalledWith(phoneNumber);
  });

  it('should throw error if user not found', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);

    await expect(loginUseCase.execute('wrong@example.com', 'password')).rejects.toThrow('Email/Nomor HP atau password salah');
  });

  it('should throw error if password incorrect', async () => {
    const user = new User(1, 'Test User', 'test@example.com', '08123456789', 'hashed', 'ADMIN', null);
    mockUserRepository.findByEmail.mockResolvedValue(user);
    mockPasswordHasher.compare.mockResolvedValue(false);

    await expect(loginUseCase.execute('test@example.com', 'wrongpassword')).rejects.toThrow('Email/Nomor HP atau password salah');
  });
});
