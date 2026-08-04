/* Upstream shapes — only the fields we actually read, everything optional
   because RTT omits empty fields rather than sending nulls. */

export type RttTemporalPoint = {
  scheduleAdvertised?: string;
  realtimeForecast?: string;
  realtimeActual?: string;
  realtimeAdvertisedLateness?: number;
  isCancelled?: boolean;
  cancellationReasonCode?: string;
};

export type RttTemporalData = {
  arrival?: RttTemporalPoint;
  departure?: RttTemporalPoint;
  displayAs?: string | null;
};

export type RttReason = {
  type?: "DELAY" | "CANCEL";
  code?: string;
  system?: string;
  shortText?: string;
  longText?: string | null;
};

export type RttGeoLocation = {
  namespace?: string;
  description?: string;
  shortCodes?: string[];
  longCodes?: string[];
};

export type RttScheduleMetadata = {
  uniqueIdentity?: string;
  namespace?: string;
  identity?: string;
  departureDate?: string;
  operator?: { code?: string; name?: string };
  modeType?: string;
  inPassengerService?: boolean;
};

export type RttLocationPair = {
  location?: RttGeoLocation;
  temporalData?: RttTemporalPoint;
};

export type RttLineUpService = {
  temporalData?: RttTemporalData;
  reasons?: RttReason[];
  origin?: RttLocationPair[];
  destination?: RttLocationPair[];
  scheduleMetadata?: RttScheduleMetadata;
};

export type RttLineUpResponse = {
  services?: RttLineUpService[];
};

export type RttServiceLocation = {
  temporalData?: RttTemporalData;
  reasons?: RttReason[];
  location?: RttGeoLocation;
};

export type RttServiceResponse = {
  service?: {
    scheduleMetadata?: RttScheduleMetadata;
    locations?: RttServiceLocation[];
  };
};

export type RttStopsResponse = {
  stops?: { namespace?: string; description?: string; shortCode?: string }[];
  locations?: { namespace?: string; description?: string; shortCode?: string }[];
};

/* Our DTOs — the only shapes that ever leave the server. */

export type RailVerdict = "ontime" | "delayed" | "cancelled" | "unknown";

export type RailStation = {
  code: string;
  name: string;
};

export type RailServiceSummary = {
  serviceUid: string;
  runDate: string;
  /** advertised departure "HH:MM" at the queried origin */
  depTime?: string;
  operator?: string;
  /** the service's terminus, e.g. "Ely" */
  headsTo?: string;
  status: RailVerdict;
  latenessMins?: number;
  /** true when lateness comes from a forecast rather than an actual report */
  estimated?: boolean;
  reasonShort?: string;
  reasonLong?: string;
  /** TRAIN, or — deliciously — REPLACEMENT_BUS */
  mode?: string;
};

export type RailServiceVerdict = {
  serviceUid: string;
  runDate: string;
  status: RailVerdict;
  /** arrival lateness in minutes at the chosen destination */
  latenessMins?: number;
  estimated?: boolean;
  reasonShort?: string;
  reasonLong?: string;
  depTime?: string;
  origin?: string;
  destination?: string;
};
