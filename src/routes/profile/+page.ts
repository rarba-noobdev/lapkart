import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data, depends }) => {
	depends('app:profile');
	return data;
};
