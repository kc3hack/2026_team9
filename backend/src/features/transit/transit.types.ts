/** Request to look up transit directions. */
export type TransitQuery = {
  /** Address or place name of the starting point (e.g. "大阪駅"). */
  origin: string;
  /** Address or place name of the destination (e.g. "京都大学"). */
  destination: string;
  /**
   * ISO-8601 datetime by which you must *arrive*.
   * When provided the Directions API calculates routes backwards from this time.
   */
  arrivalTime?: string;
};

/** A single step inside a transit route. */
export type TransitStep = {
  /** WALKING · TRANSIT */
  mode: string;
  /** Human-readable instruction (HTML tags stripped). */
  instruction: string;
  durationMinutes: number;
  /** Present only when `mode === "TRANSIT"`. */
  transitDetails?: {
    /** Line / route name (e.g. "JR京都線"). */
    line: string;
    departureStop: string;
    arrivalStop: string;
    numStops: number;
  };
};

/** A complete route option. */
export type TransitRoute = {
  /** e.g. "8:12" */
  departureTime: string;
  /** e.g. "9:05" */
  arrivalTime: string;
  durationMinutes: number;
  summary: string;
  steps: TransitStep[];
};

/** Result of a transit directions lookup. */
export type TransitResult = {
  routes: TransitRoute[];
  /** The first (best) route, or null if nothing found. */
  bestRoute: TransitRoute | null;
};
