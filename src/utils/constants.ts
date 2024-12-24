export const REPLY_WINDOW = 1;
export const TWEET_WINDOW = 1;
export const MENTIONS_WINDOW = 1;

export const ONE_HOUR_IN_MS = 3600000;
export const ONE_MIN_IN_MS = 60000;

export const PRIORITY_RESET_LIMIT_TIME_IN_MS = ONE_MIN_IN_MS; // 1 min
export const RESET_LIMIT_TIME_IN_MS = 120000; // 2 min
// export const MENTIONS_RESET_LIMIT_TIME_IN_MS = 900000; // 15 min
export const MENTIONS_RESET_LIMIT_TIME_IN_MS = 120000; // 2 min
export const MENTIONS_TOKEN_CREATION_RESET_LIMIT_TIME_IN_MS = 120000; // 2 min
// export const TWT_RESET_LIMIT_TIME_IN_MS = ONE_HOUR_IN_MS * 4; // 4 hours
export const TWT_RESET_LIMIT_TIME_IN_MS = 900000; // 15 min
export const HOT_PROFILE_RESET_LIMIT_TIME_IN_MS = 150000; // 2.5 min

export const DEFAULT_X_HANDLE = "nerobossai";

export const LOGTYPES = {
  ERROR: "ERROR",
  UNCAUGHT_ERROR: "UNCAUGHT_ERROR",
  INTERNAL: "INTERNAL",
};
export const ERROR_TYPES = {
  INTERNAL: "INTERNAL_ERROR",
  SEND_QUEUE: "SEND_QUEUE_ERROR",
};
export const NEROCITY_API = "https://api.neroboss.ai";
