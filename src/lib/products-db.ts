import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/catalog";

type Row = {
  id: string;
  title: string;
  brand: string;
  category: string;
  image: string;
  images: string[] | null;
  source_url: string | null;
  price: string | number;
  mrp: string | number;
  rating: string | number;
  reviews: number;
  stock: number;
  compatibility: string | null;
  warranty: string | null;
  highlights: string[] | null;
  authenticity_grade?: "oem" | "compatible" | "refurbished" | "open_box" | null;
  condition_grade?: "new" | "open_box" | "refurbished" | "used" | null;
  hsn_code?: string | null;
  gst_rate?: string | number | null;
  doa_policy_days?: number | null;
  local_delivery_eligible?: boolean | null;
  cod_eligible?: boolean | null;
};

function normalize(r: Row): Product {
  return {
    id: r.id,
    title: r.title,
    brand: r.brand,
    category: r.category,
    image: r.image,
    images: r.images ?? undefined,
    source_url: r.source_url ?? undefined,
    price: Number(r.price),
    mrp: Number(r.mrp),
    rating: Number(r.rating),
    reviews: r.reviews,
    stock: r.stock,
    compatibility: r.compatibility ?? "",
    warranty: r.warranty ?? "",
    highlights: r.highlights ?? [],
    authenticity_grade: r.authenticity_grade ?? "compatible",
    condition_grade: r.condition_grade ?? "new",
    hsn_code: r.hsn_code ?? undefined,
    gst_rate: Number(r.gst_rate ?? 18),
    doa_policy_days: r.doa_policy_days ?? 7,
    local_delivery_eligible: r.local_delivery_eligible ?? true,
    cod_eligible: r.cod_eligible ?? true,
  };
}

const SELECT =
  "id,title,brand,category,image,images,source_url,price,mrp,rating,reviews,stock,compatibility,warranty,highlights,authenticity_grade,condition_grade,hsn_code,gst_rate,doa_policy_days,local_delivery_eligible,cod_eligible";

export function useProducts() {
  return useQuery({
    queryKey: ["products", "all"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(normalize);
    },
    staleTime: 60_000,
  });
}
export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["products", "by-id", id],
    enabled: !!id,
    queryFn: async (): Promise<Product | null> => {
      const { data, error } = await supabase
        .from("products")
        .select(SELECT)
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      return data ? normalize(data as Row) : null;
    },
    staleTime: 60_000,
  });
}

export function useProductsByIds(ids: string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["products", "by-ids", key],
    enabled: key.length > 0,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase.from("products").select(SELECT).in("id", key);
      if (error) throw error;
      return (data as Row[]).map(normalize);
    },
    staleTime: 60_000,
  });
}

