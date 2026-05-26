import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "../infrastructure/http/routes/authRoutes.js";
import sppTariffRoutes from "../infrastructure/http/routes/sppTariffRoutes.js";
import categoryRoutes from "../infrastructure/http/routes/categoryRoutes.js";
import studentRoutes from "../infrastructure/http/routes/studentRoutes.js";
import transactionRoutes from "../infrastructure/http/routes/transactionRoutes.js";
import invoiceRoutes from "../infrastructure/http/routes/invoiceRoutes.js";

const app = express();

app.use(express.json());
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/spp-tariffs", sppTariffRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/invoices", invoiceRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const message = err.message || "Internal Server Error";
  const status = message === "Email atau password salah" ? 401 : 500;

  res.status(status).json({
    success: false,
    message,
  });
});

export default app;
