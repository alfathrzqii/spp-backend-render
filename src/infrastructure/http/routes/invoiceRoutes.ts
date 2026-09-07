import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { InvoiceController } from "../controllers/InvoiceController.js";
import { PrismaInvoiceRepository } from "../../database/PrismaInvoiceRepository.js";
import { PrismaStudentRepository } from "../../database/PrismaStudentRepository.js";
import { PrismaSppTariffRepository } from "../../database/PrismaSppTariffRepository.js";
import { PrismaExtraEquipmentTariffRepository } from "../../database/PrismaExtraEquipmentTariffRepository.js";
import { PrismaFulldayTariffRepository } from "../../database/PrismaFulldayTariffRepository.js";
import { ProcessOfflinePaymentUseCase } from "../../../application/use-cases/ProcessOfflinePaymentUseCase.js";
import { GetAllInvoicesUseCase } from "../../../application/use-cases/GetAllInvoicesUseCase.js";
import { UpdateInvoiceStatusUseCase } from "../../../application/use-cases/UpdateInvoiceStatusUseCase.js";
import { DeleteInvoiceUseCase } from "../../../application/use-cases/DeleteInvoiceUseCase.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { offlinePaymentSchema } from "../schemas/paymentSchema.js";
import prisma from "../../database/prisma.js";

const router = Router();

// Repositories
const invoiceRepo = new PrismaInvoiceRepository();
const studentRepo = new PrismaStudentRepository();
const sppTariffRepo = new PrismaSppTariffRepository();
const extraEquipmentTariffRepo = new PrismaExtraEquipmentTariffRepository();
const fulldayTariffRepo = new PrismaFulldayTariffRepository(prisma);

// Use Cases
const processOfflinePaymentUseCase = new ProcessOfflinePaymentUseCase(
  invoiceRepo,
  studentRepo,
  sppTariffRepo,
  extraEquipmentTariffRepo,
  fulldayTariffRepo
);
const getAllInvoicesUseCase = new GetAllInvoicesUseCase(invoiceRepo);
const updateInvoiceStatusUseCase = new UpdateInvoiceStatusUseCase(invoiceRepo, sppTariffRepo);
const deleteInvoiceUseCase = new DeleteInvoiceUseCase(invoiceRepo);

// Controller
const invoiceController = new InvoiceController(
  processOfflinePaymentUseCase,
  studentRepo,
  getAllInvoicesUseCase,
  updateInvoiceStatusUseCase,
  deleteInvoiceUseCase
);

// Routes
router.get(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  invoiceController.getAllInvoices.bind(invoiceController)
);

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
  invoiceController.getStudentInvoices.bind(invoiceController)
);

router.post(
  "/pay-online-simulated",
  authMiddleware,
  invoiceController.payOnlineSimulated.bind(invoiceController)
);

// Pakasir Payment Gateway Routes
router.post(
  "/pakasir/create",
  invoiceController.createPakasirTransaction.bind(invoiceController)
);

router.get(
  "/pakasir/status",
  invoiceController.checkPakasirStatus.bind(invoiceController)
);

router.post(
  "/pakasir/webhook",
  invoiceController.handlePakasirWebhook.bind(invoiceController)
);

router.post(
  "/pakasir/simulate",
  invoiceController.simulatePakasirPayment.bind(invoiceController)
);

router.post(
  "/pakasir/sync",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN", "PARENT"]),
  invoiceController.syncPakasirTransactions.bind(invoiceController)
);

router.put(
  "/:id/status",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  invoiceController.updateStatus.bind(invoiceController)
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  invoiceController.deleteInvoice.bind(invoiceController)
);

export default router;
