import { z } from 'zod';

export const ContributorInfo = z.object({
	contributorType: z.enum(['Profile', 'Byline']),
	nameOrId: z.string(),
	docCount: z.number(),
});

export const ContributorsReport = z.object({
	hits: z.number(),
	results: z.array(ContributorInfo),
});
