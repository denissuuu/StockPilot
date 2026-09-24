-- Contraintes métier applicatives au niveau PostgreSQL.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_costPrice_nonnegative" CHECK ("costPrice" >= 0),
  ADD CONSTRAINT "Product_salePrice_nonnegative" CHECK ("salePrice" >= 0),
  ADD CONSTRAINT "Product_taxRate_valid" CHECK ("taxRate" >= 0 AND "taxRate" <= 100),
  ADD CONSTRAINT "Product_minStock_nonnegative" CHECK ("minStock" >= 0);

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_quantity_nonzero" CHECK ("quantity" <> 0);

ALTER TABLE "StockAdjustment"
  ADD CONSTRAINT "StockAdjustment_quantity_nonzero" CHECK ("quantity" <> 0);

ALTER TABLE "PurchaseOrderLine"
  ADD CONSTRAINT "PurchaseOrderLine_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "PurchaseOrderLine_receivedQuantity_valid" CHECK ("receivedQuantity" >= 0 AND "receivedQuantity" <= "quantity"),
  ADD CONSTRAINT "PurchaseOrderLine_unitCost_nonnegative" CHECK ("unitCost" >= 0);

ALTER TABLE "SaleLine"
  ADD CONSTRAINT "SaleLine_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "SaleLine_unitPrice_nonnegative" CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "SaleLine_unitCost_nonnegative" CHECK ("unitCost" >= 0);
