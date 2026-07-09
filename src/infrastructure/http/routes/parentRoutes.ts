import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import prisma from "../../database/prisma.js";

const router = Router();

router.get("/children", authMiddleware, roleMiddleware(["PARENT"]), async (req, res, next) => {
  try {
    const user = req.user!;
    const children = await prisma.student.findMany({
      where: { parentId: user.id },
      include: {
        schoolUnit: { select: { name: true } },
      },
    });

    res.status(200).json({
      success: true,
      message: "Data anak berhasil diambil",
      data: children,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
