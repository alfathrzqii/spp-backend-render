import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import prisma from "../../database/prisma.js";
import bcrypt from "bcrypt";

const router = Router();

// Only SUPER_ADMIN can manage users
router.use(authMiddleware, roleMiddleware(["SUPER_ADMIN"]));

router.get("/", async (req, res, next) => {
  try {
    const roleFilter = req.query.role || undefined;
    const where: any = {};
    if (roleFilter) where.role = roleFilter;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        schoolUnitId: true,
        className: true,
        schoolUnit: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      success: true,
      message: "Daftar pengguna berhasil diambil",
      data: users,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, email, phoneNumber, password, role, schoolUnitId, className } = req.body;

    if (!name || !phoneNumber || !password || !role) {
      res.status(400).json({ success: false, message: "Nama, No HP, Password, dan Peran wajib diisi" });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (existing) {
      res.status(400).json({ success: false, message: "Nomor HP sudah digunakan oleh akun lain" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email: email || null,
        phoneNumber,
        password: passwordHash,
        role,
        schoolUnitId: schoolUnitId ? Number(schoolUnitId) : null,
        className: role === "WALI_KELAS" ? className : null,
      },
    });

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
});

router.put("/:id", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const { name, email, phoneNumber, password, role, schoolUnitId, className } = req.body;

    const existing = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: "User tidak ditemukan" });
      return;
    }

    if (phoneNumber && phoneNumber !== existing.phoneNumber) {
      const dup = await prisma.user.findUnique({ where: { phoneNumber } });
      if (dup) {
        res.status(400).json({ success: false, message: "Nomor HP sudah digunakan oleh akun lain" });
        return;
      }
    }

    const data: any = {
      name: name || existing.name,
      email: email !== undefined ? email : existing.email,
      phoneNumber: phoneNumber || existing.phoneNumber,
      role: role || existing.role,
      schoolUnitId: schoolUnitId !== undefined ? (schoolUnitId ? Number(schoolUnitId) : null) : existing.schoolUnitId,
      className: role === "WALI_KELAS" ? (className || (existing as any).className) : null,
    };

    if (password && password.trim().length > 0) {
      data.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
    });

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
});

router.delete("/:id", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const currentUser = req.user!;

    if (currentUser.id === userId) {
      res.status(400).json({ success: false, message: "Anda tidak diizinkan untuk menghapus akun Anda sendiri" });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: "User tidak ditemukan" });
      return;
    }

    if (existing.role === "PARENT") {
      const studentCount = await prisma.student.count({
        where: { parentId: userId },
      });
      if (studentCount > 0) {
        res.status(400).json({ success: false, message: "Gagal menghapus: Akun wali murid masih terikat dengan data siswa aktif" });
        return;
      }
    }

    await prisma.user.delete({ where: { id: userId } });

    res.status(200).json({
      success: true,
      message: "Akun pengguna berhasil dihapus",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
