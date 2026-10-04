import { z } from 'zod';
import { badRequest } from './errors.js';

/**
 * Une période dont le début est postérieur à la fin ne filtre rien : la requête
 * répond avec un jeu vide, que l'appelant lit comme « aucune donnée » plutôt que
 * comme « bornes invalides ».
 */
export function isCoherentDateRange(value: { from?: Date; to?: Date }): boolean {
  return !value.from || !value.to || value.from <= value.to;
}

/** Message et champ fautifs, partagés avec tous les refine() concernés. */
export const coherentDateRange = {
  message: 'La date de début doit être antérieure à la date de fin',
  path: ['from'],
};

/**
 * Les deux bornes seules, à étaler dans un objet zod qui filtre sur une période.
 * Redéclarées module par module, elles avaient divergé : une liste d'ajustements
 * avait oublié le contrôle d'ordre, et le tableau de bord affichait un texte
 * différent de celui des ventes, achats et mouvements.
 */
export const dateRangeShape = {
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
};

/** Les mêmes bornes, prêtes à être utilisées seules. */
export const dateRangeSchema = z.object(dateRangeShape).refine(isCoherentDateRange, coherentDateRange);

export type DateRangeInput = z.infer<typeof dateRangeSchema>;

export function boundedDateRange(input: DateRangeInput): { from: Date; to: Date } {
  const to = input.to ?? new Date();
  const from = input.from ?? new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  const maxDays = 366;
  if (to.getTime() - from.getTime() > maxDays * 24 * 60 * 60 * 1000) {
    throw badRequest('La période ne peut pas dépasser 366 jours');
  }
  return { from, to };
}