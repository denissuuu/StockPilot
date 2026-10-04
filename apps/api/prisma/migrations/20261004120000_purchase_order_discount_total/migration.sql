-- La remise appliquée aux lignes d'achat n'était pas totalisée dans l'en-tête :
-- subtotal + taxTotal <> total dès qu'une ligne était remisée.
ALTER TABLE "PurchaseOrder"
  ADD COLUMN "discountTotal" DECIMAL(16,2) NOT NULL DEFAULT 0;

-- Renseigne la colonne à partir des lignes déjà enregistrées, en distinguant la
-- base HT remisée de la taxe : base HT = lineTotal - taxAmount, remise = lineSubtotal - base HT.
UPDATE "PurchaseOrder" AS po
SET "discountTotal" = COALESCE((
  SELECT SUM(ROUND(pol."lineSubtotal" - (pol."lineTotal" - pol."taxAmount"), 2))
  FROM "PurchaseOrderLine" AS pol
  WHERE pol."purchaseOrderId" = po."id"
), 0);
