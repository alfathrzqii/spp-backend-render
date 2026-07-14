-- AlterEnum
-- This migration will add the 'WALI_KELAS' value to the 'Role' enum. It is not possible to add values to a type inside a transaction block on PostgreSQL databases.
-- So we need to alter the type first.
ALTER TYPE "Role" ADD VALUE 'WALI_KELAS';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "class_name" VARCHAR(50);
