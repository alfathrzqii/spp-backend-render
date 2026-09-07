import type { Request, Response, NextFunction } from "express";
import type { GetUsersUseCase } from "../../../application/use-cases/GetUsersUseCase.js";
import type { CreateUserUseCase } from "../../../application/use-cases/CreateUserUseCase.js";
import type { UpdateUserUseCase } from "../../../application/use-cases/UpdateUserUseCase.js";
import type { DeleteUserUseCase } from "../../../application/use-cases/DeleteUserUseCase.js";
import type { Role } from "../../../domain/enums/Role.js";
import { logActivity } from "../../utils/activityLogger.js";

export class UserController {
  constructor(
    private getUsersUseCase: GetUsersUseCase,
    private createUserUseCase: CreateUserUseCase,
    private updateUserUseCase: UpdateUserUseCase,
    private deleteUserUseCase: DeleteUserUseCase
  ) {}

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roleFilter = req.query.role ? (req.query.role as Role) : undefined;
      const users = await this.getUsersUseCase.execute(roleFilter ? { role: roleFilter } : undefined);

      res.status(200).json({
        success: true,
        message: "Daftar pengguna berhasil diambil",
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, phoneNumber, password, role, schoolUnitId, className } = req.body;

      const newUser = await this.createUserUseCase.execute({
        name,
        email,
        phoneNumber,
        password,
        role,
        schoolUnitId,
        className,
      });

      if (req.user) {
        await logActivity(
          req.user.id,
          "CREATE_USER",
          `Membuat akun pengguna baru: ${name} (${role}) dengan No HP ${phoneNumber}`,
          req
        );
      }

      res.status(201).json({
        success: true,
        message: "Akun pengguna berhasil dibuat",
        data: {
          id: newUser.id,
          name: newUser.name,
          phoneNumber: newUser.phoneNumber,
          role: newUser.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = Number(req.params.id);
      const { name, email, phoneNumber, password, role, schoolUnitId, className } = req.body;

      const updatedUser = await this.updateUserUseCase.execute(userId, {
        name,
        email,
        phoneNumber,
        password,
        role,
        schoolUnitId,
        className,
      });

      if (req.user) {
        await logActivity(
          req.user.id,
          "UPDATE_USER",
          `Mengupdate data akun pengguna: ${updatedUser.name} (ID: ${userId})`,
          req
        );
      }

      res.status(200).json({
        success: true,
        message: "Data pengguna berhasil diperbarui",
        data: {
          id: updatedUser.id,
          name: updatedUser.name,
          phoneNumber: updatedUser.phoneNumber,
          role: updatedUser.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = Number(req.params.id);
      const currentUserId = req.user!.id;

      const deletedUser = await this.deleteUserUseCase.execute(userId, currentUserId);

      if (req.user) {
        await logActivity(
          req.user.id,
          "DELETE_USER",
          `Menghapus akun pengguna: ${deletedUser.name} (ID: ${userId}, Role: ${deletedUser.role})`,
          req
        );
      }

      res.status(200).json({
        success: true,
        message: "Akun pengguna berhasil dihapus",
      });
    } catch (error) {
      next(error);
    }
  }
}
