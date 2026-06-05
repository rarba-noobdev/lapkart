export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	// Allows to automatically instantiate createClient with right options
	// instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
	__InternalSupabase: {
		PostgrestVersion: '14.5';
	};
	public: {
		Tables: {
			addresses: {
				Row: {
					city: string;
					created_at: string;
					formatted_address: string | null;
					full_name: string;
					id: string;
					is_default: boolean;
					latitude: number | null;
					line1: string;
					line2: string | null;
					location_source: string | null;
					longitude: number | null;
					ola_place_id: string | null;
					phone: string;
					pincode: string;
					state: string;
					user_id: string;
				};
				Insert: {
					city: string;
					created_at?: string;
					formatted_address?: string | null;
					full_name: string;
					id?: string;
					is_default?: boolean;
					latitude?: number | null;
					line1: string;
					line2?: string | null;
					location_source?: string | null;
					longitude?: number | null;
					ola_place_id?: string | null;
					phone: string;
					pincode: string;
					state: string;
					user_id: string;
				};
				Update: {
					city?: string;
					created_at?: string;
					formatted_address?: string | null;
					full_name?: string;
					id?: string;
					is_default?: boolean;
					latitude?: number | null;
					line1?: string;
					line2?: string | null;
					location_source?: string | null;
					longitude?: number | null;
					ola_place_id?: string | null;
					phone?: string;
					pincode?: string;
					state?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			admin_order_events: {
				Row: {
					admin_user_id: string | null;
					created_at: string;
					event_type: string;
					from_state: Json;
					id: string;
					metadata: Json;
					order_id: string;
					reason: string;
					to_state: Json;
				};
				Insert: {
					admin_user_id?: string | null;
					created_at?: string;
					event_type: string;
					from_state?: Json;
					id?: string;
					metadata?: Json;
					order_id: string;
					reason: string;
					to_state?: Json;
				};
				Update: {
					admin_user_id?: string | null;
					created_at?: string;
					event_type?: string;
					from_state?: Json;
					id?: string;
					metadata?: Json;
					order_id?: string;
					reason?: string;
					to_state?: Json;
				};
				Relationships: [
					{
						foreignKeyName: 'admin_order_events_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					}
				];
			};
			admin_user_events: {
				Row: {
					admin_user_id: string | null;
					created_at: string;
					event_type: string;
					from_state: Json;
					id: string;
					metadata: Json;
					reason: string;
					target_user_id: string;
					to_state: Json;
				};
				Insert: {
					admin_user_id?: string | null;
					created_at?: string;
					event_type: string;
					from_state?: Json;
					id?: string;
					metadata?: Json;
					reason?: string;
					target_user_id: string;
					to_state?: Json;
				};
				Update: {
					admin_user_id?: string | null;
					created_at?: string;
					event_type?: string;
					from_state?: Json;
					id?: string;
					metadata?: Json;
					reason?: string;
					target_user_id?: string;
					to_state?: Json;
				};
				Relationships: [];
			};
			business_accounts: {
				Row: {
					admin_note: string | null;
					billing_address: string | null;
					billing_email: string | null;
					business_phone: string | null;
					city: string | null;
					created_at: string;
					gstin: string | null;
					id: string;
					pincode: string | null;
					pro_tier: string;
					shop_name: string;
					state: string | null;
					updated_at: string;
					user_id: string;
					verification_status: string;
				};
				Insert: {
					admin_note?: string | null;
					billing_address?: string | null;
					billing_email?: string | null;
					business_phone?: string | null;
					city?: string | null;
					created_at?: string;
					gstin?: string | null;
					id?: string;
					pincode?: string | null;
					pro_tier?: string;
					shop_name: string;
					state?: string | null;
					updated_at?: string;
					user_id: string;
					verification_status?: string;
				};
				Update: {
					admin_note?: string | null;
					billing_address?: string | null;
					billing_email?: string | null;
					business_phone?: string | null;
					city?: string | null;
					created_at?: string;
					gstin?: string | null;
					id?: string;
					pincode?: string | null;
					pro_tier?: string;
					shop_name?: string;
					state?: string | null;
					updated_at?: string;
					user_id?: string;
					verification_status?: string;
				};
				Relationships: [];
			};
			checkout_sessions: {
				Row: {
					address: Json;
					amount_paise: number;
					coupon_code: string | null;
					coupon_id: string | null;
					coupon_snapshot: Json | null;
					created_at: string;
					currency: string;
					delivery_estimate: Json;
					discount_total: number;
					expires_at: string;
					id: string;
					items: Json;
					order_id: string | null;
					razorpay_order_id: string;
					save_address: boolean;
					selected_courier: Json;
					shipping: number;
					status: string;
					subtotal: number;
					total: number;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					address: Json;
					amount_paise: number;
					coupon_code?: string | null;
					coupon_id?: string | null;
					coupon_snapshot?: Json | null;
					created_at?: string;
					currency?: string;
					delivery_estimate: Json;
					discount_total?: number;
					expires_at: string;
					id?: string;
					items: Json;
					order_id?: string | null;
					razorpay_order_id: string;
					save_address?: boolean;
					selected_courier: Json;
					shipping: number;
					status?: string;
					subtotal: number;
					total: number;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					address?: Json;
					amount_paise?: number;
					coupon_code?: string | null;
					coupon_id?: string | null;
					coupon_snapshot?: Json | null;
					created_at?: string;
					currency?: string;
					delivery_estimate?: Json;
					discount_total?: number;
					expires_at?: string;
					id?: string;
					items?: Json;
					order_id?: string | null;
					razorpay_order_id?: string;
					save_address?: boolean;
					selected_courier?: Json;
					shipping?: number;
					status?: string;
					subtotal?: number;
					total?: number;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'checkout_sessions_coupon_id_fkey';
						columns: ['coupon_id'];
						isOneToOne: false;
						referencedRelation: 'coupons';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'checkout_sessions_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					}
				];
			};
			coupon_redemptions: {
				Row: {
					coupon_id: string;
					created_at: string;
					discount_amount: number;
					id: string;
					order_id: string;
					user_id: string;
				};
				Insert: {
					coupon_id: string;
					created_at?: string;
					discount_amount: number;
					id?: string;
					order_id: string;
					user_id: string;
				};
				Update: {
					coupon_id?: string;
					created_at?: string;
					discount_amount?: number;
					id?: string;
					order_id?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'coupon_redemptions_coupon_id_fkey';
						columns: ['coupon_id'];
						isOneToOne: false;
						referencedRelation: 'coupons';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'coupon_redemptions_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					}
				];
			};
			coupons: {
				Row: {
					active: boolean;
					code: string;
					created_at: string;
					description: string | null;
					discount_type: string;
					discount_value: number;
					ends_at: string | null;
					id: string;
					max_discount: number | null;
					minimum_subtotal: number;
					per_user_limit: number;
					starts_at: string | null;
					updated_at: string;
					usage_limit: number | null;
				};
				Insert: {
					active?: boolean;
					code: string;
					created_at?: string;
					description?: string | null;
					discount_type: string;
					discount_value: number;
					ends_at?: string | null;
					id?: string;
					max_discount?: number | null;
					minimum_subtotal?: number;
					per_user_limit?: number;
					starts_at?: string | null;
					updated_at?: string;
					usage_limit?: number | null;
				};
				Update: {
					active?: boolean;
					code?: string;
					created_at?: string;
					description?: string | null;
					discount_type?: string;
					discount_value?: number;
					ends_at?: string | null;
					id?: string;
					max_discount?: number | null;
					minimum_subtotal?: number;
					per_user_limit?: number;
					starts_at?: string | null;
					updated_at?: string;
					usage_limit?: number | null;
				};
				Relationships: [];
			};
			order_cancellation_requests: {
				Row: {
					admin_note: string | null;
					created_at: string;
					id: string;
					order_id: string;
					reason: string;
					refund_id: string | null;
					requested_at: string;
					resolved_at: string | null;
					status: string;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					admin_note?: string | null;
					created_at?: string;
					id?: string;
					order_id: string;
					reason: string;
					refund_id?: string | null;
					requested_at?: string;
					resolved_at?: string | null;
					status?: string;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					admin_note?: string | null;
					created_at?: string;
					id?: string;
					order_id?: string;
					reason?: string;
					refund_id?: string | null;
					requested_at?: string;
					resolved_at?: string | null;
					status?: string;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'order_cancellation_requests_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'order_cancellation_requests_refund_id_fkey';
						columns: ['refund_id'];
						isOneToOne: false;
						referencedRelation: 'refunds';
						referencedColumns: ['id'];
					}
				];
			};
			order_invoices: {
				Row: {
					created_at: string;
					generated_at: string;
					id: string;
					invoice_number: string;
					invoice_url: string | null;
					order_id: string;
					status: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					generated_at?: string;
					id?: string;
					invoice_number: string;
					invoice_url?: string | null;
					order_id: string;
					status?: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					generated_at?: string;
					id?: string;
					invoice_number?: string;
					invoice_url?: string | null;
					order_id?: string;
					status?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'order_invoices_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: true;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					}
				];
			};
			order_items: {
				Row: {
					brand: string;
					id: string;
					image: string;
					order_id: string;
					price: number;
					product_id: string | null;
					qty: number;
					title: string;
					unit_price: number | null;
				};
				Insert: {
					brand: string;
					id?: string;
					image: string;
					order_id: string;
					price: number;
					product_id?: string | null;
					qty: number;
					title: string;
					unit_price?: number | null;
				};
				Update: {
					brand?: string;
					id?: string;
					image?: string;
					order_id?: string;
					price?: number;
					product_id?: string | null;
					qty?: number;
					title?: string;
					unit_price?: number | null;
				};
				Relationships: [
					{
						foreignKeyName: 'order_items_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					}
				];
			};
			orders: {
				Row: {
					coupon_code: string | null;
					coupon_id: string | null;
					created_at: string;
					delivery_promise_snapshot: Json;
					discount_total: number;
					id: string;
					payment_method: string;
					payment_status: string;
					risk_score: number;
					shipping: number;
					shipping_address: string;
					shipping_charge_estimate: number | null;
					shipping_city: string | null;
					shipping_country: string;
					shipping_courier_company_id: number | null;
					shipping_courier_name: string | null;
					shipping_email: string | null;
					shipping_estimate: Json;
					shipping_expected_delivery_date: string | null;
					shipping_formatted_address: string | null;
					shipping_latitude: number | null;
					shipping_line1: string | null;
					shipping_line2: string | null;
					shipping_location_source: string | null;
					shipping_longitude: number | null;
					shipping_name: string;
					shipping_phone: string;
					shipping_pincode: string | null;
					shipping_place_id: string | null;
					shipping_route_distance_meters: number | null;
					shipping_route_duration_seconds: number | null;
					shipping_service_type: string;
					shipping_state: string | null;
					status: string;
					subtotal: number;
					total: number;
					tracking: Json;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					coupon_code?: string | null;
					coupon_id?: string | null;
					created_at?: string;
					delivery_promise_snapshot?: Json;
					discount_total?: number;
					id?: string;
					payment_method?: string;
					payment_status?: string;
					risk_score?: number;
					shipping?: number;
					shipping_address: string;
					shipping_charge_estimate?: number | null;
					shipping_city?: string | null;
					shipping_country?: string;
					shipping_courier_company_id?: number | null;
					shipping_courier_name?: string | null;
					shipping_email?: string | null;
					shipping_estimate?: Json;
					shipping_expected_delivery_date?: string | null;
					shipping_formatted_address?: string | null;
					shipping_latitude?: number | null;
					shipping_line1?: string | null;
					shipping_line2?: string | null;
					shipping_location_source?: string | null;
					shipping_longitude?: number | null;
					shipping_name: string;
					shipping_phone: string;
					shipping_pincode?: string | null;
					shipping_place_id?: string | null;
					shipping_route_distance_meters?: number | null;
					shipping_route_duration_seconds?: number | null;
					shipping_service_type?: string;
					shipping_state?: string | null;
					status?: string;
					subtotal: number;
					total: number;
					tracking?: Json;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					coupon_code?: string | null;
					coupon_id?: string | null;
					created_at?: string;
					delivery_promise_snapshot?: Json;
					discount_total?: number;
					id?: string;
					payment_method?: string;
					payment_status?: string;
					risk_score?: number;
					shipping?: number;
					shipping_address?: string;
					shipping_charge_estimate?: number | null;
					shipping_city?: string | null;
					shipping_country?: string;
					shipping_courier_company_id?: number | null;
					shipping_courier_name?: string | null;
					shipping_email?: string | null;
					shipping_estimate?: Json;
					shipping_expected_delivery_date?: string | null;
					shipping_formatted_address?: string | null;
					shipping_latitude?: number | null;
					shipping_line1?: string | null;
					shipping_line2?: string | null;
					shipping_location_source?: string | null;
					shipping_longitude?: number | null;
					shipping_name?: string;
					shipping_phone?: string;
					shipping_pincode?: string | null;
					shipping_place_id?: string | null;
					shipping_route_distance_meters?: number | null;
					shipping_route_duration_seconds?: number | null;
					shipping_service_type?: string;
					shipping_state?: string | null;
					status?: string;
					subtotal?: number;
					total?: number;
					tracking?: Json;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'orders_coupon_id_fkey';
						columns: ['coupon_id'];
						isOneToOne: false;
						referencedRelation: 'coupons';
						referencedColumns: ['id'];
					}
				];
			};
			payments: {
				Row: {
					amount: number | null;
					created_at: string;
					id: string;
					method: string | null;
					order_id: string;
					provider: string;
					provider_order_id: string | null;
					provider_payment_id: string | null;
					provider_signature: string | null;
					raw_payload: Json;
					status: string;
				};
				Insert: {
					amount?: number | null;
					created_at?: string;
					id?: string;
					method?: string | null;
					order_id: string;
					provider?: string;
					provider_order_id?: string | null;
					provider_payment_id?: string | null;
					provider_signature?: string | null;
					raw_payload?: Json;
					status?: string;
				};
				Update: {
					amount?: number | null;
					created_at?: string;
					id?: string;
					method?: string | null;
					order_id?: string;
					provider?: string;
					provider_order_id?: string | null;
					provider_payment_id?: string | null;
					provider_signature?: string | null;
					raw_payload?: Json;
					status?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'payments_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					}
				];
			};
			product_questions: {
				Row: {
					answer: string | null;
					answered_at: string | null;
					answered_by: string | null;
					created_at: string;
					id: string;
					product_id: string;
					question: string;
					status: string;
					updated_at: string;
					user_id: string | null;
				};
				Insert: {
					answer?: string | null;
					answered_at?: string | null;
					answered_by?: string | null;
					created_at?: string;
					id?: string;
					product_id: string;
					question: string;
					status?: string;
					updated_at?: string;
					user_id?: string | null;
				};
				Update: {
					answer?: string | null;
					answered_at?: string | null;
					answered_by?: string | null;
					created_at?: string;
					id?: string;
					product_id?: string;
					question?: string;
					status?: string;
					updated_at?: string;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'product_questions_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
			product_reviews: {
				Row: {
					admin_note: string | null;
					body: string;
					created_at: string;
					id: string;
					order_id: string | null;
					product_id: string;
					rating: number;
					status: string;
					title: string | null;
					updated_at: string;
					user_id: string;
					verified_purchase: boolean;
				};
				Insert: {
					admin_note?: string | null;
					body: string;
					created_at?: string;
					id?: string;
					order_id?: string | null;
					product_id: string;
					rating: number;
					status?: string;
					title?: string | null;
					updated_at?: string;
					user_id: string;
					verified_purchase?: boolean;
				};
				Update: {
					admin_note?: string | null;
					body?: string;
					created_at?: string;
					id?: string;
					order_id?: string | null;
					product_id?: string;
					rating?: number;
					status?: string;
					title?: string | null;
					updated_at?: string;
					user_id?: string;
					verified_purchase?: boolean;
				};
				Relationships: [
					{
						foreignKeyName: 'product_reviews_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'product_reviews_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
			products: {
				Row: {
					authenticity_grade: string;
					brand: string;
					breadth_cm: number | null;
					category: string;
					cod_eligible: boolean;
					compatibility: string | null;
					condition_grade: string;
					created_at: string;
					description: string | null;
					doa_policy_days: number;
					gst_rate: number;
					height_cm: number | null;
					highlights: string[] | null;
					hsn_code: string | null;
					id: string;
					image: string;
					images: string[] | null;
					length_cm: number | null;
					local_delivery_eligible: boolean;
					mrp: number;
					price: number;
					rating: number;
					reviews: number;
					search_keywords: string[] | null;
					sku: string | null;
					source_url: string | null;
					status: string;
					stock: number;
					title: string;
					updated_at: string;
					warranty: string | null;
					weight_kg: number | null;
				};
				Insert: {
					authenticity_grade?: string;
					brand: string;
					breadth_cm?: number | null;
					category: string;
					cod_eligible?: boolean;
					compatibility?: string | null;
					condition_grade?: string;
					created_at?: string;
					description?: string | null;
					doa_policy_days?: number;
					gst_rate?: number;
					height_cm?: number | null;
					highlights?: string[] | null;
					hsn_code?: string | null;
					id?: string;
					image: string;
					images?: string[] | null;
					length_cm?: number | null;
					local_delivery_eligible?: boolean;
					mrp: number;
					price: number;
					rating?: number;
					reviews?: number;
					search_keywords?: string[] | null;
					sku?: string | null;
					source_url?: string | null;
					status?: string;
					stock?: number;
					title: string;
					updated_at?: string;
					warranty?: string | null;
					weight_kg?: number | null;
				};
				Update: {
					authenticity_grade?: string;
					brand?: string;
					breadth_cm?: number | null;
					category?: string;
					cod_eligible?: boolean;
					compatibility?: string | null;
					condition_grade?: string;
					created_at?: string;
					description?: string | null;
					doa_policy_days?: number;
					gst_rate?: number;
					height_cm?: number | null;
					highlights?: string[] | null;
					hsn_code?: string | null;
					id?: string;
					image?: string;
					images?: string[] | null;
					length_cm?: number | null;
					local_delivery_eligible?: boolean;
					mrp?: number;
					price?: number;
					rating?: number;
					reviews?: number;
					search_keywords?: string[] | null;
					sku?: string | null;
					source_url?: string | null;
					status?: string;
					stock?: number;
					title?: string;
					updated_at?: string;
					warranty?: string | null;
					weight_kg?: number | null;
				};
				Relationships: [];
			};
			profiles: {
				Row: {
					avatar_url: string | null;
					created_at: string;
					full_name: string | null;
					id: string;
					phone: string | null;
					updated_at: string;
				};
				Insert: {
					avatar_url?: string | null;
					created_at?: string;
					full_name?: string | null;
					id: string;
					phone?: string | null;
					updated_at?: string;
				};
				Update: {
					avatar_url?: string | null;
					created_at?: string;
					full_name?: string | null;
					id?: string;
					phone?: string | null;
					updated_at?: string;
				};
				Relationships: [];
			};
			refunds: {
				Row: {
					amount: number;
					cancellation_request_id: string | null;
					created_at: string;
					id: string;
					order_id: string;
					payment_id: string | null;
					processed_at: string | null;
					provider: string;
					provider_refund_id: string | null;
					raw_payload: Json;
					reason: string | null;
					requested_by: string | null;
					return_request_id: string | null;
					speed: string;
					status: string;
					updated_at: string;
				};
				Insert: {
					amount: number;
					cancellation_request_id?: string | null;
					created_at?: string;
					id?: string;
					order_id: string;
					payment_id?: string | null;
					processed_at?: string | null;
					provider?: string;
					provider_refund_id?: string | null;
					raw_payload?: Json;
					reason?: string | null;
					requested_by?: string | null;
					return_request_id?: string | null;
					speed?: string;
					status?: string;
					updated_at?: string;
				};
				Update: {
					amount?: number;
					cancellation_request_id?: string | null;
					created_at?: string;
					id?: string;
					order_id?: string;
					payment_id?: string | null;
					processed_at?: string | null;
					provider?: string;
					provider_refund_id?: string | null;
					raw_payload?: Json;
					reason?: string | null;
					requested_by?: string | null;
					return_request_id?: string | null;
					speed?: string;
					status?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'refunds_cancellation_request_id_fkey';
						columns: ['cancellation_request_id'];
						isOneToOne: false;
						referencedRelation: 'order_cancellation_requests';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'refunds_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'refunds_payment_id_fkey';
						columns: ['payment_id'];
						isOneToOne: false;
						referencedRelation: 'payments';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'refunds_return_request_id_fkey';
						columns: ['return_request_id'];
						isOneToOne: false;
						referencedRelation: 'return_requests';
						referencedColumns: ['id'];
					}
				];
			};
			return_request_items: {
				Row: {
					created_at: string;
					id: string;
					order_item_id: string;
					qty: number;
					reason: string | null;
					return_request_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					order_item_id: string;
					qty: number;
					reason?: string | null;
					return_request_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					order_item_id?: string;
					qty?: number;
					reason?: string | null;
					return_request_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'return_request_items_order_item_id_fkey';
						columns: ['order_item_id'];
						isOneToOne: false;
						referencedRelation: 'order_items';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'return_request_items_return_request_id_fkey';
						columns: ['return_request_id'];
						isOneToOne: false;
						referencedRelation: 'return_requests';
						referencedColumns: ['id'];
					}
				];
			};
			return_requests: {
				Row: {
					admin_note: string | null;
					condition_notes: string | null;
					created_at: string;
					id: string;
					order_id: string;
					photos: string[];
					reason: string;
					received_at: string | null;
					refund_id: string | null;
					requested_at: string;
					resolved_at: string | null;
					reverse_shipment_id: string | null;
					status: string;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					admin_note?: string | null;
					condition_notes?: string | null;
					created_at?: string;
					id?: string;
					order_id: string;
					photos?: string[];
					reason: string;
					received_at?: string | null;
					refund_id?: string | null;
					requested_at?: string;
					resolved_at?: string | null;
					reverse_shipment_id?: string | null;
					status?: string;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					admin_note?: string | null;
					condition_notes?: string | null;
					created_at?: string;
					id?: string;
					order_id?: string;
					photos?: string[];
					reason?: string;
					received_at?: string | null;
					refund_id?: string | null;
					requested_at?: string;
					resolved_at?: string | null;
					reverse_shipment_id?: string | null;
					status?: string;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'return_requests_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'return_requests_refund_id_fkey';
						columns: ['refund_id'];
						isOneToOne: false;
						referencedRelation: 'refunds';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'return_requests_reverse_shipment_id_fkey';
						columns: ['reverse_shipment_id'];
						isOneToOne: false;
						referencedRelation: 'shipments';
						referencedColumns: ['id'];
					}
				];
			};
			shipment_events: {
				Row: {
					awb_code: string | null;
					id: string;
					location: string | null;
					message: string | null;
					provider: string;
					raw_payload: Json;
					received_at: string;
					shipment_id: string | null;
					status: string;
					status_code: number | null;
					status_time: string | null;
				};
				Insert: {
					awb_code?: string | null;
					id?: string;
					location?: string | null;
					message?: string | null;
					provider?: string;
					raw_payload?: Json;
					received_at?: string;
					shipment_id?: string | null;
					status: string;
					status_code?: number | null;
					status_time?: string | null;
				};
				Update: {
					awb_code?: string | null;
					id?: string;
					location?: string | null;
					message?: string | null;
					provider?: string;
					raw_payload?: Json;
					received_at?: string;
					shipment_id?: string | null;
					status?: string;
					status_code?: number | null;
					status_time?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'shipment_events_shipment_id_fkey';
						columns: ['shipment_id'];
						isOneToOne: false;
						referencedRelation: 'shipments';
						referencedColumns: ['id'];
					}
				];
			};
			shipment_packages: {
				Row: {
					breadth_cm: number;
					created_at: string;
					declared_value: number;
					height_cm: number;
					id: string;
					item_count: number;
					length_cm: number;
					order_item_ids: string[];
					package_number: number;
					raw_payload: Json;
					shipment_id: string;
					sku_summary: string | null;
					updated_at: string;
					weight_kg: number;
				};
				Insert: {
					breadth_cm: number;
					created_at?: string;
					declared_value?: number;
					height_cm: number;
					id?: string;
					item_count?: number;
					length_cm: number;
					order_item_ids?: string[];
					package_number?: number;
					raw_payload?: Json;
					shipment_id: string;
					sku_summary?: string | null;
					updated_at?: string;
					weight_kg: number;
				};
				Update: {
					breadth_cm?: number;
					created_at?: string;
					declared_value?: number;
					height_cm?: number;
					id?: string;
					item_count?: number;
					length_cm?: number;
					order_item_ids?: string[];
					package_number?: number;
					raw_payload?: Json;
					shipment_id?: string;
					sku_summary?: string | null;
					updated_at?: string;
					weight_kg?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'shipment_packages_shipment_id_fkey';
						columns: ['shipment_id'];
						isOneToOne: false;
						referencedRelation: 'shipments';
						referencedColumns: ['id'];
					}
				];
			};
			shipments: {
				Row: {
					actual_delivery_at: string | null;
					applied_weight_kg: number | null;
					awb_code: string | null;
					billed_weight_kg: number | null;
					cod_amount: number;
					courier_company_id: number | null;
					courier_name: string | null;
					created_at: string;
					error_code: string | null;
					error_message: string | null;
					expected_delivery_date: string | null;
					id: string;
					invoice_url: string | null;
					label_url: string | null;
					last_status_at: string | null;
					last_status_code: number | null;
					manifest_url: string | null;
					order_id: string;
					pickup_location_id: string | null;
					pickup_scheduled_date: string | null;
					provider: string;
					raw_awb_response: Json;
					raw_create_response: Json;
					raw_payload: Json;
					request_payload: Json;
					return_request_id: string | null;
					shipment_number: number;
					shipping_charge: number | null;
					shipping_direction: string;
					shipping_service_type: string;
					shiprocket_channel_order_id: string | null;
					shiprocket_order_id: number | null;
					shiprocket_shipment_id: number | null;
					status: string;
					tracking_url: string | null;
					updated_at: string;
				};
				Insert: {
					actual_delivery_at?: string | null;
					applied_weight_kg?: number | null;
					awb_code?: string | null;
					billed_weight_kg?: number | null;
					cod_amount?: number;
					courier_company_id?: number | null;
					courier_name?: string | null;
					created_at?: string;
					error_code?: string | null;
					error_message?: string | null;
					expected_delivery_date?: string | null;
					id?: string;
					invoice_url?: string | null;
					label_url?: string | null;
					last_status_at?: string | null;
					last_status_code?: number | null;
					manifest_url?: string | null;
					order_id: string;
					pickup_location_id?: string | null;
					pickup_scheduled_date?: string | null;
					provider?: string;
					raw_awb_response?: Json;
					raw_create_response?: Json;
					raw_payload?: Json;
					request_payload?: Json;
					return_request_id?: string | null;
					shipment_number?: number;
					shipping_charge?: number | null;
					shipping_direction?: string;
					shipping_service_type?: string;
					shiprocket_channel_order_id?: string | null;
					shiprocket_order_id?: number | null;
					shiprocket_shipment_id?: number | null;
					status?: string;
					tracking_url?: string | null;
					updated_at?: string;
				};
				Update: {
					actual_delivery_at?: string | null;
					applied_weight_kg?: number | null;
					awb_code?: string | null;
					billed_weight_kg?: number | null;
					cod_amount?: number;
					courier_company_id?: number | null;
					courier_name?: string | null;
					created_at?: string;
					error_code?: string | null;
					error_message?: string | null;
					expected_delivery_date?: string | null;
					id?: string;
					invoice_url?: string | null;
					label_url?: string | null;
					last_status_at?: string | null;
					last_status_code?: number | null;
					manifest_url?: string | null;
					order_id?: string;
					pickup_location_id?: string | null;
					pickup_scheduled_date?: string | null;
					provider?: string;
					raw_awb_response?: Json;
					raw_create_response?: Json;
					raw_payload?: Json;
					request_payload?: Json;
					return_request_id?: string | null;
					shipment_number?: number;
					shipping_charge?: number | null;
					shipping_direction?: string;
					shipping_service_type?: string;
					shiprocket_channel_order_id?: string | null;
					shiprocket_order_id?: number | null;
					shiprocket_shipment_id?: number | null;
					status?: string;
					tracking_url?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'shipments_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'shipments_pickup_location_id_fkey';
						columns: ['pickup_location_id'];
						isOneToOne: false;
						referencedRelation: 'shipping_pickup_locations';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'shipments_return_request_id_fkey';
						columns: ['return_request_id'];
						isOneToOne: false;
						referencedRelation: 'return_requests';
						referencedColumns: ['id'];
					}
				];
			};
			shipping_batch_items: {
				Row: {
					batch_id: string;
					created_at: string;
					error_message: string | null;
					id: string;
					order_id: string | null;
					provider_reference: string | null;
					response_payload: Json;
					shipment_id: string | null;
					status: string;
					updated_at: string;
				};
				Insert: {
					batch_id: string;
					created_at?: string;
					error_message?: string | null;
					id?: string;
					order_id?: string | null;
					provider_reference?: string | null;
					response_payload?: Json;
					shipment_id?: string | null;
					status?: string;
					updated_at?: string;
				};
				Update: {
					batch_id?: string;
					created_at?: string;
					error_message?: string | null;
					id?: string;
					order_id?: string | null;
					provider_reference?: string | null;
					response_payload?: Json;
					shipment_id?: string | null;
					status?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'shipping_batch_items_batch_id_fkey';
						columns: ['batch_id'];
						isOneToOne: false;
						referencedRelation: 'shipping_batches';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'shipping_batch_items_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'shipping_batch_items_shipment_id_fkey';
						columns: ['shipment_id'];
						isOneToOne: false;
						referencedRelation: 'shipments';
						referencedColumns: ['id'];
					}
				];
			};
			shipping_batches: {
				Row: {
					batch_type: string;
					completed_at: string | null;
					created_at: string;
					error_message: string | null;
					failure_count: number;
					id: string;
					invoice_url: string | null;
					label_url: string | null;
					manifest_url: string | null;
					provider: string;
					request_payload: Json;
					requested_by: string | null;
					response_payload: Json;
					started_at: string | null;
					status: string;
					success_count: number;
					total_count: number;
					updated_at: string;
				};
				Insert: {
					batch_type: string;
					completed_at?: string | null;
					created_at?: string;
					error_message?: string | null;
					failure_count?: number;
					id?: string;
					invoice_url?: string | null;
					label_url?: string | null;
					manifest_url?: string | null;
					provider?: string;
					request_payload?: Json;
					requested_by?: string | null;
					response_payload?: Json;
					started_at?: string | null;
					status?: string;
					success_count?: number;
					total_count?: number;
					updated_at?: string;
				};
				Update: {
					batch_type?: string;
					completed_at?: string | null;
					created_at?: string;
					error_message?: string | null;
					failure_count?: number;
					id?: string;
					invoice_url?: string | null;
					label_url?: string | null;
					manifest_url?: string | null;
					provider?: string;
					request_payload?: Json;
					requested_by?: string | null;
					response_payload?: Json;
					started_at?: string | null;
					status?: string;
					success_count?: number;
					total_count?: number;
					updated_at?: string;
				};
				Relationships: [];
			};
			shipping_pickup_locations: {
				Row: {
					address_line1: string;
					address_line2: string | null;
					city: string;
					contact_name: string | null;
					country: string;
					created_at: string;
					email: string | null;
					id: string;
					is_active: boolean;
					is_default: boolean;
					latitude: number | null;
					longitude: number | null;
					phone: string;
					pickup_location: string;
					pincode: string;
					provider: string;
					provider_location_id: string | null;
					raw_payload: Json;
					state: string;
					updated_at: string;
				};
				Insert: {
					address_line1: string;
					address_line2?: string | null;
					city: string;
					contact_name?: string | null;
					country?: string;
					created_at?: string;
					email?: string | null;
					id?: string;
					is_active?: boolean;
					is_default?: boolean;
					latitude?: number | null;
					longitude?: number | null;
					phone: string;
					pickup_location: string;
					pincode: string;
					provider?: string;
					provider_location_id?: string | null;
					raw_payload?: Json;
					state: string;
					updated_at?: string;
				};
				Update: {
					address_line1?: string;
					address_line2?: string | null;
					city?: string;
					contact_name?: string | null;
					country?: string;
					created_at?: string;
					email?: string | null;
					id?: string;
					is_active?: boolean;
					is_default?: boolean;
					latitude?: number | null;
					longitude?: number | null;
					phone?: string;
					pickup_location?: string;
					pincode?: string;
					provider?: string;
					provider_location_id?: string | null;
					raw_payload?: Json;
					state?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			stock_notification_events: {
				Row: {
					created_at: string;
					email: string;
					id: string;
					payload: Json;
					processed_at: string | null;
					product_id: string;
					status: string;
					stock_notification_id: string;
					user_id: string | null;
				};
				Insert: {
					created_at?: string;
					email: string;
					id?: string;
					payload?: Json;
					processed_at?: string | null;
					product_id: string;
					status?: string;
					stock_notification_id: string;
					user_id?: string | null;
				};
				Update: {
					created_at?: string;
					email?: string;
					id?: string;
					payload?: Json;
					processed_at?: string | null;
					product_id?: string;
					status?: string;
					stock_notification_id?: string;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'stock_notification_events_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'stock_notification_events_stock_notification_id_fkey';
						columns: ['stock_notification_id'];
						isOneToOne: false;
						referencedRelation: 'stock_notifications';
						referencedColumns: ['id'];
					}
				];
			};
			stock_notifications: {
				Row: {
					created_at: string;
					email: string;
					id: string;
					notified_at: string | null;
					product_id: string;
					status: string;
					user_id: string | null;
				};
				Insert: {
					created_at?: string;
					email: string;
					id?: string;
					notified_at?: string | null;
					product_id: string;
					status?: string;
					user_id?: string | null;
				};
				Update: {
					created_at?: string;
					email?: string;
					id?: string;
					notified_at?: string | null;
					product_id?: string;
					status?: string;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'stock_notifications_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
			user_roles: {
				Row: {
					created_at: string;
					id: string;
					role: Database['public']['Enums']['app_role'];
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					role?: Database['public']['Enums']['app_role'];
					user_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					role?: Database['public']['Enums']['app_role'];
					user_id?: string;
				};
				Relationships: [];
			};
			wishlist_items: {
				Row: {
					created_at: string;
					id: string;
					product_id: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					product_id: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					product_id?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'wishlist_items_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			complete_checkout_payment: {
				Args: {
					p_address_payload: Json;
					p_checkout_session_razorpay_order_id: string;
					p_items: Json;
					p_order_id: string;
					p_order_payload: Json;
					p_payment_payload: Json;
					p_save_address: boolean;
					p_user_id: string;
				};
				Returns: string;
			};
			is_admin: { Args: never; Returns: boolean };
		};
		Enums: {
			app_role: 'admin' | 'user';
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema['Enums']
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	public: {
		Enums: {
			app_role: ['admin', 'user']
		}
	}
} as const;
