-- CreateIndex
CREATE INDEX "invoices_student_id_invoice_type_year_idx" ON "invoices"("student_id", "invoice_type", "year");

-- CreateIndex
CREATE INDEX "students_school_unit_id_class_name_idx" ON "students"("school_unit_id", "class_name");

-- CreateIndex
CREATE INDEX "transactions_school_unit_id_date_idx" ON "transactions"("school_unit_id", "date");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_invoice_id_idx" ON "transactions"("invoice_id");

-- CreateIndex
CREATE INDEX "transactions_category_id_idx" ON "transactions"("category_id");
