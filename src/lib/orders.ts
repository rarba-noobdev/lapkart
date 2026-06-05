import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase/client';
import type { Database } from '$lib/supabase/types';

export type OrderSummary = {
	id: string;
	createdAt: string;
	updatedAt: string;
	status: string;
	paymentStatus: string;
	paymentMethod: string;
	total: number;
	shipping: number;
	shippingName: string | null;
	shippingCity: string | null;
	shippingState: string | null;
	shippingPincode: string | null;
	shippingServiceType: string;
	items: Array<{
		id: string;
		title: string;
		image: string;
		brand: string;
		qty: number;
		price: number;
	}>;
	shipment: {
		status: string;
		awbCode: string | null;
		courierName: string | null;
		trackingUrl: string | null;
		expectedDeliveryDate: string | null;
	} | null;
	payment: {
		id: string;
		provider: string;
		status: string;
		amount: number | null;
		providerPaymentId: string | null;
		providerOrderId: string | null;
	} | null;
};

type RawOrder = {
	id: string;
	created_at: string;
	updated_at: string;
	status: string;
	payment_status: string;
	payment_method: string;
	total: number;
	shipping: number;
	shipping_name: string | null;
	shipping_city: string | null;
	shipping_state: string | null;
	shipping_pincode: string | null;
	shipping_service_type: string;
	order_items?: Array<{
		id: string;
		title: string;
		image: string;
		brand: string;
		qty: number;
		price: number;
	}>;
	shipments?: Array<{
		status: string;
		awb_code: string | null;
		courier_name: string | null;
		tracking_url: string | null;
		expected_delivery_date: string | null;
	}>;
	payments?: Array<{
		id: string;
		provider: string;
		status: string;
		amount: number | null;
		provider_payment_id: string | null;
		provider_order_id: string | null;
	}>;
};

const orderSelect = `
  id,
  created_at,
  updated_at,
  status,
  payment_status,
  payment_method,
  total,
  shipping,
  shipping_name,
  shipping_city,
  shipping_state,
  shipping_pincode,
  shipping_service_type,
  order_items(id,title,image,brand,qty,price),
  shipments(status,awb_code,courier_name,tracking_url,expected_delivery_date),
  payments(id,provider,status,amount,provider_payment_id,provider_order_id)
`;

type OrderClient = SupabaseClient<Database>;

function getClient(client?: OrderClient) {
	return client ?? supabase;
}

function normalizeOrder(order: RawOrder): OrderSummary {
	const shipment = order.shipments?.[0];
	const payment = order.payments?.[0];

	return {
		id: order.id,
		createdAt: order.created_at,
		updatedAt: order.updated_at,
		status: order.status,
		paymentStatus: order.payment_status,
		paymentMethod: order.payment_method,
		total: Number(order.total ?? 0),
		shipping: Number(order.shipping ?? 0),
		shippingName: order.shipping_name,
		shippingCity: order.shipping_city,
		shippingState: order.shipping_state,
		shippingPincode: order.shipping_pincode,
		shippingServiceType: order.shipping_service_type,
		items: (order.order_items ?? []).map((item) => ({
			id: item.id,
			title: item.title,
			image: item.image,
			brand: item.brand,
			qty: Number(item.qty ?? 0),
			price: Number(item.price ?? 0)
		})),
		shipment: shipment
			? {
					status: shipment.status,
					awbCode: shipment.awb_code,
					courierName: shipment.courier_name,
					trackingUrl: shipment.tracking_url,
					expectedDeliveryDate: shipment.expected_delivery_date
				}
			: null,
		payment: payment
			? {
					id: payment.id,
					provider: payment.provider,
					status: payment.status,
					amount: payment.amount,
					providerPaymentId: payment.provider_payment_id,
					providerOrderId: payment.provider_order_id
				}
			: null
	};
}

export async function listOrdersForUser(userId: string, client?: OrderClient) {
	const { data, error } = await getClient(client)
		.from('orders')
		.select(orderSelect)
		.eq('user_id', userId)
		.order('created_at', { ascending: false });

	if (error) throw error;
	return ((data ?? []) as RawOrder[]).map(normalizeOrder);
}

export async function getOrderById(userId: string, orderId: string, client?: OrderClient) {
	const { data, error } = await getClient(client)
		.from('orders')
		.select(orderSelect)
		.eq('user_id', userId)
		.eq('id', orderId)
		.maybeSingle();

	if (error) throw error;
	return data ? normalizeOrder(data as RawOrder) : null;
}
