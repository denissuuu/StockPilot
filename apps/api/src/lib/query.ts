import { z } from 'zod';
import { badRequest } from './errors.js';
import { endOfDay, startOfDay } from './dates.js';

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

/**
 * Traduit une période demandée en filtre de date, élargi aux journées entières.
 *
 * Une période s'exprime en jours, pas en instants : « du 1er au 10 » doit inclure
 * le 10 dans sa totalité. La borne haute valait minuit du 10, si bien que la
 * dernière journée demandée disparaissait du résultat. Les bornes sont aussi
 * rendues symétriques, pour qu'un même filtre s'applique identiquement partout.
 */
export function wholeDayFilter(input: DateRangeInput): { gte?: Date; lte?: Date } {
  return {
    ...(input.from ? { gte: startOfDay(input.from) } : {}),
    ...(input.to ? { lte: endOfDay(input.to) } : {}),
  };
}

export function boundedDateRange(input: DateRangeInput): { from: Date; to: Date } {
  const to = input.to ?? new Date();
  const from = input.from ?? new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  const maxDays = 366;
  if (to.getTime() - from.getTime() > maxDays * 24 * 60 * 60 * 1000) {
    throw badRequest('La période ne peut pas dépasser 366 jours');
  }
  return { from, to };
}