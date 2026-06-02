import { useEffect, useRef, useState } from "react";
import { AlertCircle, Crosshair, Loader2, LocateFixed, MapPin, Search } from "lucide-react";

export type DeliveryPin = {
  latitude: number;
  longitude: number;
  source: "ola_maps" | "browser_geolocation";
};

export type ResolvedDeliveryAddress = {
  placeId: string | null;
  formattedAddress: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
};

type Suggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  latitude: number | null;
  longitude: number | null;
};

type Props = {
  value: DeliveryPin | null;
  onChange: (pin: DeliveryPin) => void;
  onAddressResolved?: (address: ResolvedDeliveryAddress) => void;
  addressLabel?: string;
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8080";
const olaMapsKey = import.meta.env.VITE_OLA_MAPS_API_KEY ?? "";
const olaMapsStyleUrl = import.meta.env.VITE_OLA_MAPS_STYLE_URL ?? "";
const defaultOlaMapsStyleUrl = "https://api.olamaps.io/tiles/vector/v1/styles/default-light-lite/style.json?key=0.4.0";
const defaultCenter = { latitude: 12.9716, longitude: 77.5946 };
const fallbackRasterStyle = {
  version: 8,
  sources: {
    openStreetMap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [{ id: "openStreetMap", type: "raster", source: "openStreetMap" }],
};

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}

export function DeliveryMapPicker({ value, onChange, onAddressResolved, addressLabel }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const suppressNextSearchRef = useRef(false);
  const [loading, setLoading] = useState(Boolean(olaMapsKey));
  const [mapError, setMapError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [center, setCenter] = useState(value ?? { ...defaultCenter, source: "ola_maps" as const });
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!olaMapsKey || !containerRef.current) return;
    let active = true;
    let loadTimer: number | undefined;

    async function mountMap() {
      try {
        setLoading(true);
        const { OlaMaps } = await import("olamaps-web-sdk");
        const olaMaps = new OlaMaps({ apiKey: olaMapsKey });
        const initial = value ?? defaultCenter;
        const options = {
          container: containerRef.current,
          center: [initial.longitude, initial.latitude],
          zoom: value ? 16 : 12,
        };
        let fallbackActive = false;
        let map;
        try {
          map = await olaMaps.init({
            ...options,
            style: olaMapsStyleUrl || defaultOlaMapsStyleUrl,
          });
        } catch {
          fallbackActive = true;
          map = await olaMaps.init({ ...options, style: fallbackRasterStyle });
        }

        if (!active) {
          map?.remove?.();
          return;
        }

        const useFallbackStyle = () => {
          if (fallbackActive) return;
          fallbackActive = true;
          map.setStyle?.(fallbackRasterStyle);
          setMapError(null);
          setLoading(false);
        };
        mapRef.current = map;
        map.on?.("styleimagemissing", (event: { id?: string }) => {
          if (!event.id || map.hasImage?.(event.id)) return;
          map.addImage?.(event.id, {
            width: 1,
            height: 1,
            data: new Uint8Array([0, 0, 0, 0]),
          });
        });
        map.on?.("load", () => {
          if (loadTimer) window.clearTimeout(loadTimer);
          setLoading(false);
          setMapError(null);
        });
        map.on?.("error", () => {
          if (!map.loaded?.()) useFallbackStyle();
        });
        loadTimer = window.setTimeout(() => {
          if (!map.loaded?.()) useFallbackStyle();
        }, 7000);
        map.addControl?.(olaMaps.addNavigationControls({ showCompass: false }), "top-right");
        map.on?.("moveend", () => {
          const nextCenter = map.getCenter();
          if (!nextCenter) return;
          setCenter({
            latitude: roundCoordinate(nextCenter.lat),
            longitude: roundCoordinate(nextCenter.lng),
            source: "ola_maps",
          });
        });
        map.on?.("click", (event: { lngLat?: { lat: number; lng: number } }) => {
          if (!event.lngLat) return;
          const pin = {
            latitude: roundCoordinate(event.lngLat.lat),
            longitude: roundCoordinate(event.lngLat.lng),
            source: "ola_maps" as const,
          };
          map.easeTo?.({ center: [pin.longitude, pin.latitude], zoom: 16 });
          setCenter(pin);
          onChange(pin);
          void resolvePin(pin);
        });
        setMapError(null);
      } catch (error) {
        setMapError(error instanceof Error ? error.message : "Could not load Ola Maps");
      } finally {
        if (active && mapRef.current?.loaded?.()) setLoading(false);
      }
    }

    mountMap();

    return () => {
      active = false;
      if (loadTimer) window.clearTimeout(loadTimer);
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!value || !mapRef.current) return;
    mapRef.current.easeTo?.({ center: [value.longitude, value.latitude], zoom: 16 });
    setCenter(value);
  }, [value?.latitude, value?.longitude]);

  useEffect(() => {
    const input = query.trim();
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }
    if (input.length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        const url = new URL(`${apiBase}/maps/autocomplete`);
        url.searchParams.set("input", input.slice(0, 160));
        url.searchParams.set("latitude", String(center.latitude));
        url.searchParams.set("longitude", String(center.longitude));
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json() as { suggestions?: Suggestion[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not search addresses");
        setSuggestions(data.suggestions ?? []);
        setLocationError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setLocationError(error instanceof Error ? error.message : "Could not search addresses");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const resolvePin = async (pin: DeliveryPin, selectedPlaceId?: string) => {
    try {
      setResolving(true);
      const url = new URL(`${apiBase}/maps/reverse-geocode`);
      url.searchParams.set("latitude", String(pin.latitude));
      url.searchParams.set("longitude", String(pin.longitude));
      const response = await fetch(url);
      const data = await response.json() as ResolvedDeliveryAddress & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not resolve this address");
      const resolved = { ...data, placeId: selectedPlaceId || data.placeId };
      suppressNextSearchRef.current = true;
      setQuery(resolved.formattedAddress);
      onAddressResolved?.(resolved);
      setLocationError(null);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Could not resolve this address");
    } finally {
      setResolving(false);
    }
  };

  const selectSuggestion = (suggestion: Suggestion) => {
    if (suggestion.latitude === null || suggestion.longitude === null) {
      setLocationError("This Ola Maps result does not include a selectable pin");
      return;
    }
    const pin = {
      latitude: roundCoordinate(suggestion.latitude),
      longitude: roundCoordinate(suggestion.longitude),
      source: "ola_maps" as const,
    };
    suppressNextSearchRef.current = true;
    setQuery(suggestion.description);
    setSuggestions([]);
    setCenter(pin);
    onChange(pin);
    mapRef.current?.easeTo?.({ center: [pin.longitude, pin.latitude], zoom: 16 });
    void resolvePin(pin, suggestion.placeId);
  };

  const useMapCenter = () => {
    const mapCenter = mapRef.current?.getCenter?.();
    const pin = mapCenter
      ? {
          latitude: roundCoordinate(mapCenter.lat),
          longitude: roundCoordinate(mapCenter.lng),
          source: "ola_maps" as const,
        }
      : center;
    setCenter(pin);
    onChange(pin);
    void resolvePin(pin);
  };

  const useBrowserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Browser location is not available");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pin = {
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
          source: "browser_geolocation" as const,
        };
        setCenter(pin);
        onChange(pin);
        mapRef.current?.easeTo?.({ center: [pin.longitude, pin.latitude], zoom: 16 });
        void resolvePin(pin);
        setLocating(false);
      },
      () => {
        setLocationError("Could not read browser location");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  if (!olaMapsKey) {
    return (
      <div className="rounded-lg border border-[var(--border-faint)] bg-white p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-[var(--heat-100)]" />
          <div>
            <p className="text-label-medium text-foreground">Ola Maps key required</p>
            <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
              Browser GPS can still attach coordinates for local testing.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={useBrowserLocation}
          disabled={locating}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border-muted)] px-4 text-label-medium disabled:opacity-60"
        >
          <LocateFixed className="size-4" />
          {locating ? "Locating" : "Use browser location"}
        </button>
        {value && <CoordinateReadout pin={value} />}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white">
      <div className="border-b border-[var(--border-faint)] p-4">
        <label className="text-mono-x-small uppercase tracking-[0.16em] text-[var(--black-alpha-48)]">
          Search address or landmark
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-[var(--black-alpha-48)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Enter area, landmark, or pincode"
            className="h-10 w-full rounded-md border border-[var(--border-muted)] bg-white pl-9 pr-10 text-body-small outline-none focus:border-[var(--heat-100)]"
          />
          {searching && <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-[var(--heat-100)]" />}
          {suggestions.length > 0 && (
            <div className="absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-md border border-[var(--border-muted)] bg-white shadow-[0_16px_32px_rgba(0,0,0,0.12)]">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.placeId}
                  type="button"
                  onClick={() => selectSuggestion(suggestion)}
                  className="flex w-full items-start gap-3 border-b border-[var(--border-faint)] px-3 py-3 text-left last:border-b-0 hover:bg-[var(--background-lighter)]"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--heat-100)]" />
                  <span>
                    <span className="block text-label-small text-foreground">{suggestion.mainText}</span>
                    <span className="mt-0.5 block text-body-small text-[var(--black-alpha-56)]">{suggestion.secondaryText}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="relative h-[320px] bg-[var(--background-lighter)]">
        <div ref={containerRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="grid size-12 place-items-center rounded-full bg-[var(--heat-100)] text-white shadow-[0_10px_30px_rgba(249,115,22,0.32)]">
            <MapPin className="size-6" />
          </div>
        </div>
        {(loading || mapError) && (
          <div className="absolute inset-0 grid place-items-center bg-white/80 px-6 text-center backdrop-blur-sm">
            <p className="text-body-small text-[var(--black-alpha-72)]">
              {mapError ?? "Loading Ola Maps"}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-[var(--border-faint)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-mono-x-small uppercase tracking-[0.16em] text-[var(--black-alpha-48)]">
            {addressLabel || "delivery pin"}
          </p>
          <p className="mt-1 text-body-small text-[var(--black-alpha-72)]">
            {value
              ? `${value.latitude}, ${value.longitude}`
              : `${center.latitude}, ${center.longitude}`}
          </p>
          {(locationError || resolving) && (
            <p className={`mt-1 text-body-small ${locationError ? "text-red-700" : "text-[var(--black-alpha-56)]"}`}>
              {locationError ?? "Resolving selected address"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={useBrowserLocation}
            disabled={locating}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border-muted)] px-4 text-label-medium disabled:opacity-60"
          >
            <LocateFixed className="size-4" />
            {locating ? "Locating" : "GPS"}
          </button>
          <button
            type="button"
            onClick={useMapCenter}
            disabled={resolving}
            className="button button-primary relative inline-flex h-10 items-center gap-2 rounded-md px-4 text-label-medium disabled:opacity-60"
          >
            {resolving ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
            Confirm pin
          </button>
        </div>
      </div>
    </div>
  );
}

function CoordinateReadout({ pin }: { pin: DeliveryPin }) {
  return (
    <p className="mt-3 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-2 text-body-small text-[var(--black-alpha-72)]">
      {pin.latitude}, {pin.longitude}
    </p>
  );
}
