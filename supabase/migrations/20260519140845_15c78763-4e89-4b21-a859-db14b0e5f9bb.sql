
CREATE TABLE public.repair_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  laptop_brand text NOT NULL,
  laptop_model text NOT NULL,
  service_type text NOT NULL,
  issue_description text,
  contact_phone text NOT NULL,
  preferred_date date,
  status text NOT NULL DEFAULT 'pending',
  estimated_cost numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.repair_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repair select own" ON public.repair_bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "repair insert own" ON public.repair_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "repair admins all" ON public.repair_bookings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.trade_in_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  age_years integer NOT NULL,
  condition text NOT NULL,
  ram_gb integer,
  storage_gb integer,
  notes text,
  estimated_value numeric,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trade_in_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tradein select own" ON public.trade_in_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tradein insert own" ON public.trade_in_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tradein admins all" ON public.trade_in_requests FOR ALL USING (public.has_role(auth.uid(), 'admin'));
