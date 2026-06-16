const defaultWebOrigins = [
	'http://127.0.0.1:5173',
	'http://localhost:5173',
	'http://127.0.0.1:8080',
	'http://localhost:8080',
	'http://127.0.0.1:8081',
	'http://localhost:8081',
	'https://www.lapkart.store',
	'https://lapkart.store'
];

function numberEnv(name: string, fallback: number) {
	const value = Number(Deno.env.get(name) ?? fallback);
	return Number.isFinite(value) ? value : fallback;
}

export const config = {
	webOrigins: (Deno.env.get('WEB_ORIGIN') ?? defaultWebOrigins.join(','))
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean),
	supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
	supabaseServiceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
	razorpayKeyId: Deno.env.get('RAZORPAY_KEY_ID') ?? '',
	razorpayKeySecret: Deno.env.get('RAZORPAY_KEY_SECRET') ?? '',
	shiprocketBaseUrl:
		Deno.env.get('SHIPROCKET_BASE_URL') ?? 'https://apiv2.shiprocket.in/v1/external',
	shiprocketEmail: Deno.env.get('SHIPROCKET_EMAIL') ?? '',
	shiprocketPassword: Deno.env.get('SHIPROCKET_PASSWORD') ?? '',
	shiprocketPickupLocation: Deno.env.get('SHIPROCKET_PICKUP_LOCATION') ?? '',
	shiprocketWebhookToken: Deno.env.get('SHIPROCKET_WEBHOOK_TOKEN') ?? '',
	shiprocketDefaultWeightKg: numberEnv('SHIPROCKET_DEFAULT_WEIGHT_KG', 0.5),
	shiprocketDefaultLengthCm: numberEnv('SHIPROCKET_DEFAULT_LENGTH_CM', 20),
	shiprocketDefaultBreadthCm: numberEnv('SHIPROCKET_DEFAULT_BREADTH_CM', 15),
	shiprocketDefaultHeightCm: numberEnv('SHIPROCKET_DEFAULT_HEIGHT_CM', 5),
	fulfillmentProvider: (Deno.env.get('FULFILLMENT_PROVIDER') ?? 'manual').toLowerCase(),
	allowShiprocketWithTestPayments:
		(Deno.env.get('ALLOW_SHIPROCKET_WITH_TEST_PAYMENTS') ?? '').toLowerCase() === 'true',
	lapkartDispatchPincode: Deno.env.get('LAPKART_DISPATCH_PINCODE') ?? '',
	lapkartDispatchLatitude: numberEnv('LAPKART_DISPATCH_LATITUDE', Number.NaN),
	lapkartDispatchLongitude: numberEnv('LAPKART_DISPATCH_LONGITUDE', Number.NaN),
	olaMapsApiKey: Deno.env.get('OLA_MAPS_API_KEY') ?? '',
	olaMapsClientId: Deno.env.get('OLA_MAPS_CLIENT_ID') ?? '',
	olaMapsClientSecret: Deno.env.get('OLA_MAPS_CLIENT_SECRET') ?? '',
	notificationEmailFrom: Deno.env.get('NOTIFICATION_EMAIL_FROM') ?? '',
	resendApiKey: Deno.env.get('RESEND_API_KEY') ?? '',
	whatsappAccessToken: Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '',
	whatsappPhoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
	whatsappBackInStockTemplate: Deno.env.get('WHATSAPP_BACK_IN_STOCK_TEMPLATE') ?? ''
};
