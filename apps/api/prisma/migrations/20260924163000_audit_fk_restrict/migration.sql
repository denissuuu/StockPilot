-- Les mouvements et ajustements conservent leur auteur : le trigger d'intégrité
-- PostgreSQL ne doit pas tenter de modifier une ligne immuable lors d'une suppression.
ALTER TABLE "StockMovement"
  DROP CONSTRAINT "StockMovement_createdById_fkey",
  ADD CONSTRAINT "StockMovement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockAdjustment"
  DROP CONSTRAINT "StockAdjustment_createdById_fkey",
  ADD CONSTRAINT "StockAdjustment_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
