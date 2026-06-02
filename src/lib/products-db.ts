import { useEffect, useState } from "react";
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
  };
}

const SELECT = "id,title,brand,category,image,images,source_url,price,mrp,rating,reviews,stock,compatibility,warranty,highlights";

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function useProducts() {
  const hydrated = useHydrated();
  const query = useQuery({
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
  return { ...query, data: hydrated ? query.data : undefined, isLoading: !hydrated || query.isLoading };
}

export function useProduct(id: string | undefined) {
  const hydrated = useHydrated();
  const query = useQuery({
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
  return { ...query, data: hydrated ? query.data : undefined, isLoading: !hydrated || query.isLoading };
}

export function useProductsByIds(ids: string[]) {
  const hydrated = useHydrated();
  const key = [...new Set(ids)].sort();
  const query = useQuery({
    queryKey: ["products", "by-ids", key],
    enabled: key.length > 0,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(SELECT)
        .in("id", key);
      if (error) throw error;
      return (data as Row[]).map(normalize);
    },
    staleTime: 60_000,
  });
  return { ...query, data: hydrated ? query.data : undefined, isLoading: !hydrated || query.isLoading };
}
