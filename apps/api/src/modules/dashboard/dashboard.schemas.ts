import { z } from 'zod';

import { coherentDateRange, dateRangeShape, isCoherentDateRange } from '../../lib/query.js';

export const dashboardSchema = z.object({
  ...dateRangeShape,
  granularity: z.enum(['day', 'week', 'month']).default('day'),
}).refine(isCoherentDateRange, coherentDateRange);

export type DashboardInput = z.infer<typeof dashboardSchema>;