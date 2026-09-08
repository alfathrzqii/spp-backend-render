// Repositories (Infrastructure/Database)
import { PrismaUserRepository } from "../infrastructure/database/PrismaUserRepository.js";
import { PrismaStudentRepository } from "../infrastructure/database/PrismaStudentRepository.js";
import { PrismaInvoiceRepository } from "../infrastructure/database/PrismaInvoiceRepository.js";
import { PrismaCategoryRepository } from "../infrastructure/database/PrismaCategoryRepository.js";
import { PrismaSppTariffRepository } from "../infrastructure/database/PrismaSppTariffRepository.js";
import { PrismaTransactionRepository } from "../infrastructure/database/PrismaTransactionRepository.js";
import { PrismaActivityLogRepository } from "../infrastructure/database/PrismaActivityLogRepository.js";
import { PrismaExtraEquipmentTariffRepository } from "../infrastructure/database/PrismaExtraEquipmentTariffRepository.js";
import { PrismaFulldayTariffRepository } from "../infrastructure/database/PrismaFulldayTariffRepository.js";
import { PrismaReRegistrationTariffRepository } from "../infrastructure/database/PrismaReRegistrationTariffRepository.js";
import { PrismaSdExtracurricularRepository } from "../infrastructure/database/PrismaSdExtracurricularRepository.js";
import { PrismaSchoolUnitRepository } from "../infrastructure/database/PrismaSchoolUnitRepository.js";

// Services (Infrastructure)
import { PasswordHasher } from "../infrastructure/services/PasswordHasher.js";
import { TokenService } from "../infrastructure/services/TokenService.js";
import { PakasirService } from "../infrastructure/services/PakasirService.js";
import { logger } from "../infrastructure/services/WinstonLogger.js";
import type { ILogger } from "../domain/services/ILogger.js";

// Use Cases
import { LoginUseCase } from "../application/use-cases/LoginUseCase.js";
import { GetMeUseCase } from "../application/use-cases/GetMeUseCase.js";
import { GetUsersUseCase } from "../application/use-cases/GetUsersUseCase.js";
import { CreateUserUseCase } from "../application/use-cases/CreateUserUseCase.js";
import { UpdateUserUseCase } from "../application/use-cases/UpdateUserUseCase.js";
import { DeleteUserUseCase } from "../application/use-cases/DeleteUserUseCase.js";

import { CreateCategoryUseCase } from "../application/use-cases/CreateCategoryUseCase.js";
import { GetCategoriesUseCase } from "../application/use-cases/GetCategoriesUseCase.js";
import { UpdateCategoryUseCase } from "../application/use-cases/UpdateCategoryUseCase.js";
import { DeleteCategoryUseCase } from "../application/use-cases/DeleteCategoryUseCase.js";

import { CreateStudentUseCase } from "../application/use-cases/CreateStudentUseCase.js";
import { GetStudentsUseCase } from "../application/use-cases/GetStudentsUseCase.js";
import { UpdateStudentUseCase } from "../application/use-cases/UpdateStudentUseCase.js";
import { DeleteStudentUseCase } from "../application/use-cases/DeleteStudentUseCase.js";
import { ImportStudentsUseCase } from "../application/use-cases/ImportStudentsUseCase.js";
import { GetParentChildrenUseCase } from "../application/use-cases/GetParentChildrenUseCase.js";

import { ProcessOfflinePaymentUseCase } from "../application/use-cases/ProcessOfflinePaymentUseCase.js";
import { GetAllInvoicesUseCase } from "../application/use-cases/GetAllInvoicesUseCase.js";
import { UpdateInvoiceStatusUseCase } from "../application/use-cases/UpdateInvoiceStatusUseCase.js";
import { DeleteInvoiceUseCase } from "../application/use-cases/DeleteInvoiceUseCase.js";
import { GetUnpaidInvoicesUseCase } from "../application/use-cases/GetUnpaidInvoicesUseCase.js";
import { GetClassRecapUseCase } from "../application/use-cases/GetClassRecapUseCase.js";
import { GetStudentInvoicesUseCase } from "../application/use-cases/GetStudentInvoicesUseCase.js";

import { CreatePakasirTransactionUseCase } from "../application/use-cases/CreatePakasirTransactionUseCase.js";
import { CheckPakasirStatusUseCase } from "../application/use-cases/CheckPakasirStatusUseCase.js";
import { HandlePakasirWebhookUseCase } from "../application/use-cases/HandlePakasirWebhookUseCase.js";
import { SyncPakasirTransactionsUseCase } from "../application/use-cases/SyncPakasirTransactionsUseCase.js";
import { SimulatePakasirPaymentUseCase } from "../application/use-cases/SimulatePakasirPaymentUseCase.js";
import { PayOnlineSimulatedUseCase } from "../application/use-cases/PayOnlineSimulatedUseCase.js";

import { CreateTransactionUseCase } from "../application/use-cases/CreateTransactionUseCase.js";
import { GetTransactionsUseCase } from "../application/use-cases/GetTransactionsUseCase.js";
import { UpdateTransactionUseCase } from "../application/use-cases/UpdateTransactionUseCase.js";
import { DeleteTransactionUseCase } from "../application/use-cases/DeleteTransactionUseCase.js";

import { GetActivityLogsUseCase } from "../application/use-cases/GetActivityLogsUseCase.js";

import { CreateExtraEquipmentTariffUseCase } from "../application/use-cases/CreateExtraEquipmentTariffUseCase.js";
import { GetExtraEquipmentTariffsUseCase } from "../application/use-cases/GetExtraEquipmentTariffsUseCase.js";
import { UpdateExtraEquipmentTariffUseCase } from "../application/use-cases/UpdateExtraEquipmentTariffUseCase.js";
import { DeleteExtraEquipmentTariffUseCase } from "../application/use-cases/DeleteExtraEquipmentTariffUseCase.js";

import { CreateFulldayTariffUseCase } from "../application/use-cases/CreateFulldayTariffUseCase.js";
import { GetFulldayTariffsUseCase } from "../application/use-cases/GetFulldayTariffsUseCase.js";
import { UpdateFulldayTariffUseCase } from "../application/use-cases/UpdateFulldayTariffUseCase.js";
import { DeleteFulldayTariffUseCase } from "../application/use-cases/DeleteFulldayTariffUseCase.js";

import { CreateReRegistrationTariffUseCase } from "../application/use-cases/CreateReRegistrationTariffUseCase.js";
import { GetReRegistrationTariffsUseCase } from "../application/use-cases/GetReRegistrationTariffsUseCase.js";
import { UpdateReRegistrationTariffUseCase } from "../application/use-cases/UpdateReRegistrationTariffUseCase.js";
import { DeleteReRegistrationTariffUseCase } from "../application/use-cases/DeleteReRegistrationTariffUseCase.js";

import { CreateSdExtracurricularUseCase } from "../application/use-cases/CreateSdExtracurricularUseCase.js";
import { GetSdExtracurricularsUseCase } from "../application/use-cases/GetSdExtracurricularsUseCase.js";
import { UpdateSdExtracurricularUseCase } from "../application/use-cases/UpdateSdExtracurricularUseCase.js";
import { DeleteSdExtracurricularUseCase } from "../application/use-cases/DeleteSdExtracurricularUseCase.js";

import { CreateSppTariffUseCase } from "../application/use-cases/CreateSppTariffUseCase.js";
import { GetSppTariffsUseCase } from "../application/use-cases/GetSppTariffsUseCase.js";
import { UpdateSppTariffUseCase } from "../application/use-cases/UpdateSppTariffUseCase.js";
import { DeleteSppTariffUseCase } from "../application/use-cases/DeleteSppTariffUseCase.js";

// Controllers
import { AuthController } from "../infrastructure/http/controllers/AuthController.js";
import { UserController } from "../infrastructure/http/controllers/UserController.js";
import { CategoryController } from "../infrastructure/http/controllers/CategoryController.js";
import { StudentController } from "../infrastructure/http/controllers/StudentController.js";
import { ParentController } from "../infrastructure/http/controllers/ParentController.js";
import { InvoiceController } from "../infrastructure/http/controllers/InvoiceController.js";
import { PakasirController } from "../infrastructure/http/controllers/PakasirController.js";
import { TransactionController } from "../infrastructure/http/controllers/TransactionController.js";
import { ActivityLogController } from "../infrastructure/http/controllers/ActivityLogController.js";
import { ExtraEquipmentTariffController } from "../infrastructure/http/controllers/ExtraEquipmentTariffController.js";
import { FulldayTariffController } from "../infrastructure/http/controllers/FulldayTariffController.js";
import { ReRegistrationTariffController } from "../infrastructure/http/controllers/ReRegistrationTariffController.js";
import { SdExtracurricularController } from "../infrastructure/http/controllers/SdExtracurricularController.js";
import { SppTariffController } from "../infrastructure/http/controllers/SppTariffController.js";

export class Container {
  // Repositories
  public readonly userRepository = new PrismaUserRepository();
  public readonly studentRepository = new PrismaStudentRepository();
  public readonly invoiceRepository = new PrismaInvoiceRepository();
  public readonly categoryRepository = new PrismaCategoryRepository();
  public readonly sppTariffRepository = new PrismaSppTariffRepository();
  public readonly transactionRepository = new PrismaTransactionRepository();
  public readonly activityLogRepository = new PrismaActivityLogRepository();
  public readonly extraEquipmentTariffRepository = new PrismaExtraEquipmentTariffRepository();
  public readonly fulldayTariffRepository = new PrismaFulldayTariffRepository();
  public readonly reRegistrationTariffRepository = new PrismaReRegistrationTariffRepository();
  public readonly sdExtracurricularRepository = new PrismaSdExtracurricularRepository();
  public readonly schoolUnitRepository = new PrismaSchoolUnitRepository();

  // Services
  public readonly logger: ILogger = logger;
  public readonly passwordHasher = new PasswordHasher();
  public readonly tokenService = new TokenService();
  public readonly pakasirService = new PakasirService();

  // Use Cases
  public readonly loginUseCase = new LoginUseCase(this.userRepository, this.passwordHasher);
  public readonly getMeUseCase = new GetMeUseCase(this.userRepository);
  public readonly getUsersUseCase = new GetUsersUseCase(this.userRepository);
  public readonly createUserUseCase = new CreateUserUseCase(this.userRepository, this.passwordHasher);
  public readonly updateUserUseCase = new UpdateUserUseCase(this.userRepository, this.passwordHasher);
  public readonly deleteUserUseCase = new DeleteUserUseCase(this.userRepository);

  public readonly createCategoryUseCase = new CreateCategoryUseCase(this.categoryRepository);
  public readonly getCategoriesUseCase = new GetCategoriesUseCase(this.categoryRepository);
  public readonly updateCategoryUseCase = new UpdateCategoryUseCase(this.categoryRepository);
  public readonly deleteCategoryUseCase = new DeleteCategoryUseCase(this.categoryRepository);

  public readonly createStudentUseCase = new CreateStudentUseCase(
    this.studentRepository,
    this.userRepository,
    this.sppTariffRepository,
    this.passwordHasher
  );
  public readonly getStudentsUseCase = new GetStudentsUseCase(this.studentRepository);
  public readonly updateStudentUseCase = new UpdateStudentUseCase(this.studentRepository, this.invoiceRepository);
  public readonly deleteStudentUseCase = new DeleteStudentUseCase(this.studentRepository);
  public readonly importStudentsUseCase = new ImportStudentsUseCase(
    this.passwordHasher,
    this.studentRepository,
    this.schoolUnitRepository
  );
  public readonly getParentChildrenUseCase = new GetParentChildrenUseCase(this.studentRepository);

  public readonly processOfflinePaymentUseCase = new ProcessOfflinePaymentUseCase(
    this.invoiceRepository,
    this.studentRepository,
    this.sppTariffRepository,
    this.extraEquipmentTariffRepository,
    this.fulldayTariffRepository
  );
  public readonly getAllInvoicesUseCase = new GetAllInvoicesUseCase(this.invoiceRepository);
  public readonly updateInvoiceStatusUseCase = new UpdateInvoiceStatusUseCase(
    this.invoiceRepository,
    this.studentRepository,
    this.sppTariffRepository
  );
  public readonly deleteInvoiceUseCase = new DeleteInvoiceUseCase(this.invoiceRepository);
  public readonly getUnpaidInvoicesUseCase = new GetUnpaidInvoicesUseCase(
    this.studentRepository,
    this.invoiceRepository,
    this.sppTariffRepository,
    this.extraEquipmentTariffRepository,
    this.fulldayTariffRepository,
    this.userRepository
  );
  public readonly getClassRecapUseCase = new GetClassRecapUseCase(
    this.studentRepository,
    this.schoolUnitRepository,
    this.sppTariffRepository,
    this.invoiceRepository,
    this.userRepository
  );
  public readonly getStudentInvoicesUseCase = new GetStudentInvoicesUseCase(
    this.invoiceRepository,
    this.studentRepository,
    this.sppTariffRepository,
    this.extraEquipmentTariffRepository,
    this.fulldayTariffRepository,
    this.userRepository,
    this.pakasirService,
    this.logger
  );

  public readonly createPakasirTransactionUseCase = new CreatePakasirTransactionUseCase(
    this.invoiceRepository,
    this.studentRepository,
    this.sppTariffRepository,
    this.pakasirService,
    this.reRegistrationTariffRepository,
    this.extraEquipmentTariffRepository,
    this.fulldayTariffRepository
  );
  public readonly checkPakasirStatusUseCase = new CheckPakasirStatusUseCase(
    this.invoiceRepository,
    this.studentRepository,
    this.pakasirService,
    this.logger
  );
  public readonly handlePakasirWebhookUseCase = new HandlePakasirWebhookUseCase(
    this.invoiceRepository,
    this.studentRepository,
    this.logger
  );
  public readonly syncPakasirTransactionsUseCase = new SyncPakasirTransactionsUseCase(
    this.invoiceRepository,
    this.pakasirService,
    this.logger
  );
  public readonly simulatePakasirPaymentUseCase = new SimulatePakasirPaymentUseCase(
    this.invoiceRepository,
    this.studentRepository,
    this.pakasirService,
    this.logger
  );
  public readonly payOnlineSimulatedUseCase = new PayOnlineSimulatedUseCase(
    this.invoiceRepository,
    this.studentRepository,
    this.sppTariffRepository,
    this.reRegistrationTariffRepository,
    this.extraEquipmentTariffRepository
  );

  public readonly createTransactionUseCase = new CreateTransactionUseCase(
    this.transactionRepository,
    this.categoryRepository
  );
  public readonly getTransactionsUseCase = new GetTransactionsUseCase(this.transactionRepository);
  public readonly updateTransactionUseCase = new UpdateTransactionUseCase(
    this.transactionRepository,
    this.categoryRepository
  );
  public readonly deleteTransactionUseCase = new DeleteTransactionUseCase(this.transactionRepository);

  public readonly getActivityLogsUseCase = new GetActivityLogsUseCase(this.activityLogRepository);

  public readonly createExtraEquipmentTariffUseCase = new CreateExtraEquipmentTariffUseCase(
    this.extraEquipmentTariffRepository
  );
  public readonly getExtraEquipmentTariffsUseCase = new GetExtraEquipmentTariffsUseCase(
    this.extraEquipmentTariffRepository
  );
  public readonly updateExtraEquipmentTariffUseCase = new UpdateExtraEquipmentTariffUseCase(
    this.extraEquipmentTariffRepository
  );
  public readonly deleteExtraEquipmentTariffUseCase = new DeleteExtraEquipmentTariffUseCase(
    this.extraEquipmentTariffRepository
  );

  public readonly createFulldayTariffUseCase = new CreateFulldayTariffUseCase(this.fulldayTariffRepository);
  public readonly getFulldayTariffsUseCase = new GetFulldayTariffsUseCase(this.fulldayTariffRepository);
  public readonly updateFulldayTariffUseCase = new UpdateFulldayTariffUseCase(this.fulldayTariffRepository);
  public readonly deleteFulldayTariffUseCase = new DeleteFulldayTariffUseCase(this.fulldayTariffRepository);

  public readonly createReRegistrationTariffUseCase = new CreateReRegistrationTariffUseCase(
    this.reRegistrationTariffRepository
  );
  public readonly getReRegistrationTariffsUseCase = new GetReRegistrationTariffsUseCase(
    this.reRegistrationTariffRepository
  );
  public readonly updateReRegistrationTariffUseCase = new UpdateReRegistrationTariffUseCase(
    this.reRegistrationTariffRepository
  );
  public readonly deleteReRegistrationTariffUseCase = new DeleteReRegistrationTariffUseCase(
    this.reRegistrationTariffRepository
  );

  public readonly createSdExtracurricularUseCase = new CreateSdExtracurricularUseCase(
    this.sdExtracurricularRepository
  );
  public readonly getSdExtracurricularsUseCase = new GetSdExtracurricularsUseCase(
    this.sdExtracurricularRepository
  );
  public readonly updateSdExtracurricularUseCase = new UpdateSdExtracurricularUseCase(
    this.sdExtracurricularRepository
  );
  public readonly deleteSdExtracurricularUseCase = new DeleteSdExtracurricularUseCase(
    this.sdExtracurricularRepository
  );

  public readonly createSppTariffUseCase = new CreateSppTariffUseCase(this.sppTariffRepository);
  public readonly getSppTariffsUseCase = new GetSppTariffsUseCase(this.sppTariffRepository);
  public readonly updateSppTariffUseCase = new UpdateSppTariffUseCase(this.sppTariffRepository);
  public readonly deleteSppTariffUseCase = new DeleteSppTariffUseCase(this.sppTariffRepository);

  // Controllers
  public readonly authController = new AuthController(
    this.loginUseCase,
    this.getMeUseCase,
    this.tokenService
  );
  public readonly userController = new UserController(
    this.getUsersUseCase,
    this.createUserUseCase,
    this.updateUserUseCase,
    this.deleteUserUseCase
  );
  public readonly categoryController = new CategoryController(
    this.createCategoryUseCase,
    this.getCategoriesUseCase,
    this.updateCategoryUseCase,
    this.deleteCategoryUseCase
  );
  public readonly studentController = new StudentController(
    this.createStudentUseCase,
    this.getStudentsUseCase,
    this.updateStudentUseCase,
    this.deleteStudentUseCase,
    this.importStudentsUseCase
  );
  public readonly parentController = new ParentController(this.getParentChildrenUseCase);
  public readonly invoiceController = new InvoiceController(
    this.processOfflinePaymentUseCase,
    this.getAllInvoicesUseCase,
    this.updateInvoiceStatusUseCase,
    this.deleteInvoiceUseCase,
    this.getUnpaidInvoicesUseCase,
    this.getClassRecapUseCase,
    this.getStudentInvoicesUseCase
  );
  public readonly pakasirController = new PakasirController(
    this.createPakasirTransactionUseCase,
    this.checkPakasirStatusUseCase,
    this.handlePakasirWebhookUseCase,
    this.syncPakasirTransactionsUseCase,
    this.simulatePakasirPaymentUseCase,
    this.payOnlineSimulatedUseCase
  );
  public readonly transactionController = new TransactionController(
    this.createTransactionUseCase,
    this.getTransactionsUseCase,
    this.updateTransactionUseCase,
    this.deleteTransactionUseCase
  );
  public readonly activityLogController = new ActivityLogController(this.getActivityLogsUseCase);
  public readonly extraEquipmentTariffController = new ExtraEquipmentTariffController(
    this.createExtraEquipmentTariffUseCase,
    this.getExtraEquipmentTariffsUseCase,
    this.updateExtraEquipmentTariffUseCase,
    this.deleteExtraEquipmentTariffUseCase
  );
  public readonly fulldayTariffController = new FulldayTariffController(
    this.createFulldayTariffUseCase,
    this.updateFulldayTariffUseCase,
    this.deleteFulldayTariffUseCase,
    this.getFulldayTariffsUseCase
  );
  public readonly reRegistrationTariffController = new ReRegistrationTariffController(
    this.createReRegistrationTariffUseCase,
    this.getReRegistrationTariffsUseCase,
    this.updateReRegistrationTariffUseCase,
    this.deleteReRegistrationTariffUseCase
  );
  public readonly sdExtracurricularController = new SdExtracurricularController(
    this.createSdExtracurricularUseCase,
    this.getSdExtracurricularsUseCase,
    this.updateSdExtracurricularUseCase,
    this.deleteSdExtracurricularUseCase
  );
  public readonly sppTariffController = new SppTariffController(
    this.createSppTariffUseCase,
    this.getSppTariffsUseCase,
    this.updateSppTariffUseCase,
    this.deleteSppTariffUseCase
  );
}

export const container = new Container();
