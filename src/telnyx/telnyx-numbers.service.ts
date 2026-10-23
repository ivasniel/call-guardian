import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from "@nestjs/common";

export interface AvailableTelnyxNumber {
  phoneNumber: string;
  exactAreaCode: boolean;
  actualAreaCode: string;
  features: string[];
  supportsVoice: boolean;
  supportsSms: boolean;
  supportsMms: boolean;
  costInformation: {
    monthly_cost?: string;
    upfront_cost?: string;
    currency?: string;
  } | null;
  regionInformation: unknown[];
  reservable: boolean;
}

export interface AvailableNumbersSearchResult {
  areaCode: string;
  countryCode: string;
  bestEffort: boolean;
  total: number;
  exactMatches: number;
  numbers: AvailableTelnyxNumber[];
}

export interface PhoneNumberSearchFilters {
  areaCode?: string;
  state?: string;
  city?: string;
  bestEffort?: boolean;
  limit?: number;
}

@Injectable()
export class TelnyxNumbersService {
  async searchAvailableNumbers(
    filters: PhoneNumberSearchFilters,
  ): Promise<AvailableNumbersSearchResult> {
    const areaCode = String(filters.areaCode ?? "").trim();
    const state = String(filters.state ?? "")
      .trim()
      .toUpperCase();
    const city = String(filters.city ?? "").trim();
    const bestEffort = filters.bestEffort === true;
    const limit = filters.limit ?? 10;

    if (areaCode && !/^[2-9]\d{2}$/.test(areaCode)) {
      throw new BadRequestException("Invalid area code");
    }

    if (state && !/^[A-Z]{2}$/.test(state)) {
      throw new BadRequestException("State must be a two-letter abbreviation");
    }

    if (city && (city.length > 100 || !/^[a-zA-Z][a-zA-Z .'-]*$/.test(city))) {
      throw new BadRequestException("Invalid city");
    }

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25) {
      throw new BadRequestException("Limit must be between 1 and 25");
    }

    if (!areaCode && !state && !city) {
      throw new BadRequestException(
        "Provide at least an area code, state or city",
      );
    }

    const apiKey = process.env.TELNYX_API_KEY;

    if (!apiKey) {
      throw new InternalServerErrorException(
        "Telnyx API credentials are not configured",
      );
    }

    const url = new URL("https://api.telnyx.com/v2/available_phone_numbers");

    // Country is ALWAYS enforced by the backend.
    url.searchParams.set("filter[country_code]", "US");
    url.searchParams.set("filter[phone_number_type]", "local");
    url.searchParams.set("filter[features]", "voice");
    url.searchParams.set("filter[limit]", String(limit));
    url.searchParams.set("filter[best_effort]", String(bestEffort));

    if (areaCode) {
      url.searchParams.set("filter[national_destination_code]", areaCode);
    }

    if (state) {
      url.searchParams.set("filter[administrative_area]", state);
    }

    if (city) {
      url.searchParams.set("filter[locality]", city);
    }

    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new ServiceUnavailableException("Unable to connect to Telnyx");
    }

    if (!response.ok) {
      const errorBody = await response.text();

      console.error("Telnyx Number Search Error:", {
        status: response.status,
        body: errorBody.slice(0, 2000),
      });

      throw new BadGatewayException(
        `Telnyx number search failed (HTTP ${response.status})`,
      );
    }

    let payload: any;

    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException("Telnyx returned an invalid response");
    }

    if (!Array.isArray(payload?.data)) {
      throw new BadGatewayException("Unexpected Telnyx response format");
    }

    const numbers: AvailableTelnyxNumber[] = payload.data
      .filter((item: any) => {
        // Conserva aquí tu validación de números de Estados Unidos.
        const phoneNumber = String(item.phone_number ?? "");

        if (!/^\+1\d{10}$/.test(phoneNumber)) {
          return false;
        }

        const regions = Array.isArray(item.region_information)
          ? item.region_information
          : [];

        const countryCode = String(
          regions.find((region: any) => region.region_type === "country_code")
            ?.region_name ?? "",
        ).toUpperCase();

        return countryCode === "US";
      })
      .map((item: any): AvailableTelnyxNumber => {
        const phoneNumber = String(item.phone_number);

        const features = Array.isArray(item.features)
          ? item.features
              .map((feature: any) => String(feature?.name ?? ""))
              .filter(Boolean)
          : [];

        return {
          phoneNumber,
          exactAreaCode: !!areaCode && phoneNumber.startsWith(`+1${areaCode}`),
          actualAreaCode: phoneNumber.slice(2, 5),
          features,
          supportsVoice: features.includes("voice"),
          supportsSms: features.includes("sms"),
          supportsMms: features.includes("mms"),
          costInformation: item.cost_information ?? null,
          regionInformation: item.region_information ?? [],
          reservable: item.reservable ?? false,
        };
      }); // IMPORTANTE: cerramos aquí el map()

    numbers.sort((a, b) => Number(b.exactAreaCode) - Number(a.exactAreaCode));

    // Este return pertenece a searchAvailableNumbers(),
    // NO al map().
    return {
      areaCode,
      countryCode: "US",
      bestEffort,
      total: numbers.length,
      exactMatches: areaCode
        ? numbers.filter((n) => n.exactAreaCode).length
        : numbers.length,
      numbers,
    };
  }
}
