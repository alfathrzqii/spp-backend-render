import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { InvoiceController } from "../controllers/InvoiceController.js";
import { PrismaInvoiceRepository } from "../../database/PrismaInvoiceRepository.js";
import { PrismaStudentRepository } from "../../database/PrismaStudentRepository.js";
import { PrismaSppTariffRepository } from "../../database/PrismaSppTariffRepository.js";
import { ProcessOfflinePaymentUseCase } from "../../../application/use-cases/ProcessOfflinePaymentUseCase.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { offlinePaymentSchema } from "../schemas/paymentSchema.js";

const router = Router();

// Repositories
const invoiceRepo = new PrismaInvoiceRepository();
const studentRepo = new PrismaStudentRepository();
const sppTariffRepo = new PrismaSppTariffRepository();

// Use Cases
const processOfflinePaymentUseCase = new ProcessOfflinePaymentUseCase(
  invoiceRepo,
  studentRepo,
  sppTariffRepo
);

// Controller
const invoiceController = new InvoiceController(
  processOfflinePaymentUseCase,
  studentRepo
);

// Routes
router.post(
  "/pay-offline",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  validateRequest(offlinePaymentSchema),
  invoiceController.payOffline.bind(invoiceController)
);

router.get(
  "/unpaid",
  authMiddleware,
  invoiceController.getUnpaid.bind(invoiceController)
);

router.get(
  "/class-recap",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN", "WALI_KELAS"] as any),
  invoiceController.getClassRecap.bind(invoiceController)
);

router.get(
  "/student/:studentNumber",
  authMiddleware,
  invoiceController.getStudentInvoices.bind(invoiceController)
);

router.post(
  "/pay-online-simulated",
  authMiddleware,
  invoiceController.payOnlineSimulated.bind(invoiceController)
);

export default router;
