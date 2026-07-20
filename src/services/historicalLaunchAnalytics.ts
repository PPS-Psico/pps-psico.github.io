import { supabase } from "../lib/supabaseClient";

export type HistoricalCapacityMode = "fijo" | "realizado" | "desconocido";

export interface HistoricalLaunchOffer {
  offerId: string;
  canonicalName: string;
  orientation: string;
  announcementAt: string;
  capacityMode: HistoricalCapacityMode;
  offeredCapacity: number | null;
  creditedHoursText: string;
  startDateNote: string;
  reviewStatus: "verified" | "needs_review";
  sourceConfidence: string;
  mappedLegacyRows: number;
  relaunches: number;
}

export interface HistoricalLaunchOfferList {
  available: boolean;
  source: string | null;
  year: number;
  cutoff: string;
  dateBasis: string | null;
  rows: HistoricalLaunchOffer[];
}

export const historicalOfferCutoff = (year: number): string => {
  if (year !== new Date().getFullYear()) return `${year}-12-31`;
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const fetchHistoricalLaunchOffers = async (
  year: number,
  cutoff = historicalOfferCutoff(year)
): Promise<HistoricalLaunchOfferList> => {
  const { data, error } = await supabase.rpc("get_historical_launch_offer_list", {
    p_year: year,
    p_cutoff: cutoff,
  });
  if (error) throw error;

  const payload = (data || {}) as Record<string, unknown>;
  const rawRows = Array.isArray(payload.rows)
    ? (payload.rows as Array<Record<string, unknown>>)
    : [];

  return {
    available: payload.available === true,
    source: typeof payload.source === "string" ? payload.source : null,
    year: Number(payload.year) || year,
    cutoff: typeof payload.cutoff === "string" ? payload.cutoff : cutoff,
    dateBasis: typeof payload.date_basis === "string" ? payload.date_basis : null,
    rows: rawRows.map((row) => {
      const capacityMode: HistoricalCapacityMode =
        row.capacity_mode === "fijo" || row.capacity_mode === "realizado"
          ? row.capacity_mode
          : "desconocido";
      const offeredCapacity =
        row.offered_capacity == null || !Number.isFinite(Number(row.offered_capacity))
          ? null
          : Number(row.offered_capacity);

      return {
        offerId: String(row.offer_id || ""),
        canonicalName: String(row.canonical_name || "Sin nombre"),
        orientation: String(row.orientation || "No informada"),
        announcementAt: String(row.announcement_at || ""),
        capacityMode,
        offeredCapacity,
        creditedHoursText: String(row.credited_hours_text || ""),
        startDateNote: String(row.start_date_note || ""),
        reviewStatus: row.review_status === "verified" ? "verified" : "needs_review",
        sourceConfidence: String(row.source_confidence || "review"),
        mappedLegacyRows: Number(row.mapped_legacy_rows) || 0,
        relaunches: Number(row.relaunches) || 0,
      };
    }),
  };
};
