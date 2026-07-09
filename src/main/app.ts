import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import httpLogger from "../infrastructure/http/middleware/httpLogger.js";
import { logger } from "../infrastructure/services/WinstonLogger.js";
import authRoutes from "../infrastructure/http/routes/authRoutes.js";
import sppTariffRoutes from "../infrastructure/http/routes/sppTariffRoutes.js";
import categoryRoutes from "../infrastructure/http/routes/categoryRoutes.js";
import studentRoutes from "../infrastructure/http/routes/studentRoutes.js";
import transactionRoutes from "../infrastructure/http/routes/transactionRoutes.js";
import invoiceRoutes from "../infrastructure/http/routes/invoiceRoutes.js";
import userRoutes from "../infrastructure/http/routes/userRoutes.js";
import parentRoutes from "../infrastructure/http/routes/parentRoutes.js";

const app = express();

app.use(httpLogger);
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
app.use("/api/users", userRoutes);
app.use("/api/parent", parentRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  if (status === 500) {
    logger.error(err.message, err.stack);
  }

  res.status(status).json({
    success: false,
    message,
  });
});

export default app;
