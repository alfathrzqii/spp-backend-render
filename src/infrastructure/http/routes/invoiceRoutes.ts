import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { InvoiceController } from "../controllers/InvoiceController.js";
import { PrismaInvoiceRepository } from "../../database/PrismaInvoiceRepository.js";
import { PrismaStudentRepository } from "../../database/PrismaStudentRepository.js";
import { PrismaSppTariffRepository } from "../../database/PrismaSppTariffRepository.js";
import { PrismaExtraEquipmentTariffRepository } from "../../database/PrismaExtraEquipmentTariffRepository.js";
import { PrismaFulldayTariffRepository } from "../../database/PrismaFulldayTariffRepository.js";
import { PrismaReRegistrationTariffRepository } from "../../database/PrismaReRegistrationTariffRepository.js";
import { PakasirService } from "../../services/PakasirService.js";
import { PakasirController } from "../controllers/PakasirController.js";
import { ProcessOfflinePaymentUseCase } from "../../../application/use-cases/ProcessOfflinePaymentUseCase.js";
import { GetAllInvoicesUseCase } from "../../../application/use-cases/GetAllInvoicesUseCase.js";
import { UpdateInvoiceStatusUseCase } from "../../../application/use-cases/UpdateInvoiceStatusUseCase.js";
import { DeleteInvoiceUseCase } from "../../../application/use-cases/DeleteInvoiceUseCase.js";
import { GetUnpaidInvoicesUseCase } from "../../../application/use-cases/GetUnpaidInvoicesUseCase.js";
import { GetClassRecapUseCase } from "../../../application/use-cases/GetClassRecapUseCase.js";
import { GetStudentInvoicesUseCase } from "../../../application/use-cases/GetStudentInvoicesUseCase.js";
import { CreatePakasirTransactionUseCase } from "../../../application/use-cases/CreatePakasirTransactionUseCase.js";
import { CheckPakasirStatusUseCase } from "../../../application/use-cases/CheckPakasirStatusUseCase.js";
import { HandlePakasirWebhookUseCase } from "../../../application/use-cases/HandlePakasirWebhookUseCase.js";
import { SyncPakasirTransactionsUseCase } from "../../../application/use-cases/SyncPakasirTransactionsUseCase.js";
import { SimulatePakasirPaymentUseCase } from "../../../application/use-cases/SimulatePakasirPaymentUseCase.js";
import { PayOnlineSimulatedUseCase } from "../../../application/use-cases/PayOnlineSimulatedUseCase.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { offlinePaymentSchema } from "../schemas/paymentSchema.js";
import { logger } from "../../services/WinstonLogger.js";
import prisma from "../../database/prisma.js";

const router = Router();

// Repositories & Services
const invoiceRepo = new PrismaInvoiceRepository();
const studentRepo = new PrismaStudentRepository();
const sppTariffRepo = new PrismaSppTariffRepository();
const extraEquipmentTariffRepo = new PrismaExtraEquipmentTariffRepository();
const fulldayTariffRepo = new PrismaFulldayTariffRepository(prisma);
const reRegistrationTariffRepo = new PrismaReRegistrationTariffRepository();
const pakasirService = new PakasirService();

// Core Invoice Use Cases
const processOfflinePaymentUseCase = new ProcessOfflinePaymentUseCase(
  invoiceRepo,
  studentRepo,
  sppTariffRepo,
  extraEquipmentTariffRepo,
  fulldayTariffRepo
);
const getAllInvoicesUseCase = new GetAllInvoicesUseCase(invoiceRepo);
const updateInvoiceStatusUseCase = new UpdateInvoiceStatusUseCase(invoiceRepo, studentRepo, sppTariffRepo);
const deleteInvoiceUseCase = new DeleteInvoiceUseCase(invoiceRepo);
const getUnpaidInvoicesUseCase = new GetUnpaidInvoicesUseCase();
const getClassRecapUseCase = new GetClassRecapUseCase();
const getStudentInvoicesUseCase = new GetStudentInvoicesUseCase(invoiceRepo);

// Pakasir & Online Payment Use Cases
const createPakasirTransactionUseCase = new CreatePakasirTransactionUseCase(
  invoiceRepo,
  studentRepo,
  sppTariffRepo,
  pakasirService,
  reRegistrationTariffRepo,
  extraEquipmentTariffRepo,
  fulldayTariffRepo
);
const checkPakasirStatusUseCase = new CheckPakasirStatusUseCase(
  invoiceRepo,
  studentRepo,
  pakasirService,
  logger
);
const handlePakasirWebhookUseCase = new HandlePakasirWebhookUseCase(
  invoiceRepo,
  studentRepo,
  logger
);
const syncPakasirTransactionsUseCase = new SyncPakasirTransactionsUseCase(
  invoiceRepo,
  pakasirService,
  logger
);
const simulatePakasirPaymentUseCase = new SimulatePakasirPaymentUseCase(
  invoiceRepo,
  studentRepo,
  pakasirService,
  logger
);
const payOnlineSimulatedUseCase = new PayOnlineSimulatedUseCase(
  invoiceRepo,
  studentRepo,
  sppTariffRepo,
  reRegistrationTariffRepo,
  extraEquipmentTariffRepo
);

// Controllers
const pakasirController = new PakasirController(
  createPakasirTransactionUseCase,
  checkPakasirStatusUseCase,
  handlePakasirWebhookUseCase,
  syncPakasirTransactionsUseCase,
  simulatePakasirPaymentUseCase,
  payOnlineSimulatedUseCase,
  studentRepo
);

const invoiceController = new InvoiceController(
  processOfflinePaymentUseCase,
  studentRepo,
  getAllInvoicesUseCase,
  updateInvoiceStatusUseCase,
  deleteInvoiceUseCase,
  getUnpaidInvoicesUseCase,
  getClassRecapUseCase,
  getStudentInvoicesUseCase
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
  pakasirController.payOnlineSimulated.bind(pakasirController)
);

// Pakasir Payment Gateway Routes
router.post(
  "/pakasir/create",
  pakasirController.createPakasirTransaction.bind(pakasirController)
);

router.get(
  "/pakasir/status",
  pakasirController.checkPakasirStatus.bind(pakasirController)
);

router.post(
  "/pakasir/webhook",
  pakasirController.handlePakasirWebhook.bind(pakasirController)
);

router.post(
  "/pakasir/simulate",
  pakasirController.simulatePakasirPayment.bind(pakasirController)
);

router.post(
  "/pakasir/sync",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN", "PARENT"]),
  pakasirController.syncPakasirTransactions.bind(pakasirController)
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
