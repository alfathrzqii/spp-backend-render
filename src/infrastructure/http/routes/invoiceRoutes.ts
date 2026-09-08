import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { offlinePaymentSchema } from "../schemas/paymentSchema.js";
import { container } from "../../../main/container.js";

const router = Router();
const invoiceController = container.invoiceController;
const pakasirController = container.pakasirController;

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
  optionalAuthMiddleware,
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
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
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
