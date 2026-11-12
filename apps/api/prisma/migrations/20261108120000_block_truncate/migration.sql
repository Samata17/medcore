-- TRUNCATE skips row-level triggers, so block it separately on append-only tables.
CREATE TRIGGER "Vital_no_truncate" BEFORE TRUNCATE ON "Vital"
  FOR EACH STATEMENT EXECUTE FUNCTION medcore_block_mutation();
CREATE TRIGGER "Diagnosis_no_truncate" BEFORE TRUNCATE ON "Diagnosis"
  FOR EACH STATEMENT EXECUTE FUNCTION medcore_block_mutation();
CREATE TRIGGER "ClinicalNote_no_truncate" BEFORE TRUNCATE ON "ClinicalNote"
  FOR EACH STATEMENT EXECUTE FUNCTION medcore_block_mutation();
CREATE TRIGGER "AuditLog_no_truncate" BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION medcore_block_mutation();