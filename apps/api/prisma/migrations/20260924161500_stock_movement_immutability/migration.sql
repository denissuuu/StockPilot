-- Les mouvements de stock sont des événements immuables : aucune correction directe n'est autorisée.
CREATE OR REPLACE FUNCTION prevent_stock_movement_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Les mouvements de stock sont immuables';
END;
$$;

CREATE TRIGGER stock_movement_immutable
BEFORE UPDATE OR DELETE ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION prevent_stock_movement_mutation();
