import { randomUUID } from "node:crypto";
import { config } from "./config.js";

type OlaLocation = {
  lat?: number;
  lng?: number;
};

type OlaAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type OlaPlace = {
  name?: string;
  description?: string;
  formatted_address?: string;
  place_id?: string;
  types?: string[];
  geometry?: { location?: OlaLocation };
  address_components?: OlaAddressComponent[];
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

const OLA_MAPS_BASE_URL = "https://api.olamaps.io";
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function ensureOlaMapsConfig() {
  if (!config.olaMapsApiKey && !(config.olaMapsClientId && config.olaMapsClientSecret)) {
    throw new Error("Ola Maps credentials are not configured");
  }
}

async function getOlaMapsAccessToken() {
  if (!config.olaMapsClientId || !config.olaMapsClientSecret) return null;
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }

  const response = await fetch(`${OLA_MAPS_BASE_URL}/auth/v1/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "openid",
      client_id: config.olaMapsClientId,
      client_secret: config.olaMapsClientSecret,
    }),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) as { access_token?: string; expires_in?: number } : {};
  if (!response.ok || !data.access_token) {
    throw new Error(`Ola Maps OAuth failed with HTTP ${response.status}`);
  }

  cachedAccessToken = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000,
  };
  return cachedAccessToken.value;
}

async function olaMapsRequest<T>(path: string, params: Record<string, string>, method = "GET") {
  ensureOlaMapsConfig();
  const url = new URL(path, OLA_MAPS_BASE_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const accessToken = await getOlaMapsAccessToken();
  if (!accessToken) url.searchParams.set("api_key", config.olaMapsApiKey);

  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "X-Request-Id": randomUUID(),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error_message" in data
        ? String((data as { error_message?: unknown }).error_message)
        : `Ola Maps request failed with HTTP ${response.status}`;
    throw new Error(message || `Ola Maps request failed with HTTP ${response.status}`);
  }
  return data as T;
}

function componentValue(components: OlaAddressComponent[] | undefined, type: string) {
  return components?.find((component) => component.types?.includes(type))?.long_name ?? "";
}

function normalizePlace(place: OlaPlace) {
  const components = place.address_components;
  const location = place.geometry?.location;
  const street = componentValue(components, "street_address");
  const neighborhood = componentValue(components, "neighborhood");
  const sublocality = componentValue(components, "sublocality");
  const name = place.name ?? place.structured_formatting?.main_text ?? "";
  const line1 = [name, street].filter((part, index, values) => part && values.indexOf(part) === index).join(", ");
  const line2 = [neighborhood, sublocality]
    .filter((part, index, values) => part && !line1.includes(part) && values.indexOf(part) === index)
    .join(", ");

  return {
    placeId: place.place_id ?? null,
    formattedAddress: place.formatted_address ?? place.description ?? "",
    line1,
    line2,
    city: componentValue(components, "locality") || componentValue(components, "administrative_area_level_3"),
    state: componentValue(components, "administrative_area_level_1"),
    pincode: componentValue(components, "postal_code"),
    latitude: typeof location?.lat === "number" ? location.lat : null,
    longitude: typeof location?.lng === "number" ? location.lng : null,
  };
}

export async function autocompleteOlaPlaces(input: string, location?: { latitude: number; longitude: number }) {
  const data = await olaMapsRequest<{ predictions?: OlaPlace[] }>("/places/v1/autocomplete", {
    input,
    ...(location ? { location: `${location.latitude},${location.longitude}` } : {}),
  });

  return (data.predictions ?? []).slice(0, 6).map((prediction) => {
    const location = prediction.geometry?.location;
    return {
      placeId: prediction.place_id ?? "",
      description: prediction.description ?? "",
      mainText: prediction.structured_formatting?.main_text ?? prediction.name ?? "",
      secondaryText: prediction.structured_formatting?.secondary_text ?? "",
      latitude: typeof location?.lat === "number" ? location.lat : null,
      longitude: typeof location?.lng === "number" ? location.lng : null,
      types: prediction.types ?? [],
    };
  });
}

export async function reverseGeocodeOlaPlace(latitude: number, longitude: number) {
  const data = await olaMapsRequest<{ results?: OlaPlace[] }>("/places/v1/reverse-geocode", {
    latlng: `${latitude},${longitude}`,
  });
  const result = data.results?.[0];
  if (!result) throw new Error("Ola Maps did not return an address for this pin");
  return normalizePlace(result);
}

export async function getOlaDeliveryRoute(destination: { latitude: number; longitude: number }) {
  if (!Number.isFinite(config.lapkartDispatchLatitude) || !Number.isFinite(config.lapkartDispatchLongitude)) {
    throw new Error("LapKart dispatch coordinates are not configured");
  }

  const data = await olaMapsRequest<{
    routes?: Array<{
      legs?: Array<{
        distance?: number;
        duration?: number;
        readable_distance?: string;
        readable_duration?: string;
      }>;
    }>;
  }>("/routing/v1/directions/basic", {
    origin: `${config.lapkartDispatchLatitude},${config.lapkartDispatchLongitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    steps: "false",
    overview: "false",
  }, "POST");
  const leg = data.routes?.[0]?.legs?.[0];
  if (!leg || typeof leg.distance !== "number" || typeof leg.duration !== "number") {
    throw new Error("Ola Maps did not return a delivery route");
  }

  return {
    distanceMeters: leg.distance,
    durationSeconds: leg.duration,
    readableDistance: leg.readable_distance ?? "",
    readableDuration: leg.readable_duration ?? "",
  };
}
