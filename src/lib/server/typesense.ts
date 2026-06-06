import { env } from '$env/dynamic/private';
import { Client } from 'typesense';

type TypesenseConfig = {
	host: string;
	port: number;
	protocol: string;
	adminApiKey: string;
	collection: string;
};

let client: Client | null = null;
let clientSignature = '';

export function readTypesenseConfig(): TypesenseConfig | null {
	const host = env.TYPESENSE_HOST?.trim();
	const adminApiKey = env.TYPESENSE_ADMIN_API_KEY?.trim();

	if (!host || !adminApiKey) return null;

	const protocol = env.TYPESENSE_PROTOCOL?.trim() || 'http';
	const port = Number(env.TYPESENSE_PORT || (protocol === 'https' ? 443 : 8108));

	if (!Number.isFinite(port) || port <= 0) return null;

	return {
		host,
		port,
		protocol,
		adminApiKey,
		collection: env.TYPESENSE_PRODUCTS_COLLECTION?.trim() || 'lapkart_products'
	};
}

export function isTypesenseConfigured() {
	return Boolean(readTypesenseConfig());
}

export function getTypesenseClient() {
	const config = readTypesenseConfig();
	if (!config) return null;

	const signature = `${config.protocol}://${config.host}:${config.port}:${config.adminApiKey}`;
	if (client && clientSignature === signature) return client;

	client = new Client({
		nodes: [
			{
				host: config.host,
				port: config.port,
				protocol: config.protocol
			}
		],
		apiKey: config.adminApiKey,
		connectionTimeoutSeconds: 3,
		numRetries: 1,
		retryIntervalSeconds: 0.1
	});
	clientSignature = signature;
	return client;
}
