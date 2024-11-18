import process from 'node:process';

export const recipes_base_url = process.env['CONTENT_URL_BASE'];
if (!recipes_base_url) {
	throw new Error(
		'Misconfigured - BASE_URL must be set to the base URL of the recipes API',
	);
}
export const capi_base_url = process.env['CAPI_BASE_URL'];
if (!capi_base_url) {
	throw new Error('Misconfigured - CAPI_BASE_URL must be set up');
}
export const capi_key = process.env['CAPI_KEY'];
if (!capi_key) {
	throw new Error('Misconfigured - CAPI_KEY must be set');
}
