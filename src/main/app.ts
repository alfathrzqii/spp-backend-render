import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "../infrastructure/http/routes/authRoutes.js";
import sppTariffRoutes from "../infrastructure/http/routes/sppTariffRoutes.js";

const app = express();

app.use(express.json());
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/spp-tariffs", sppTariffRoutes);

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
