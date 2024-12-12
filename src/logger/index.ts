import winston, { format } from "winston";

const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    time: 3,
    http: 4,
    verbose: 5,
    debug: 6,
    silly: 7,
  },
};

export const logger = winston.createLogger({
  format: format.combine(format.timestamp(), format.json()),
  level: process.env.NODE_ENV === "development" ? "debug" : "verbose",
  levels: logLevels.levels,
  defaultMeta: { service: "nerosdk" },
  transports: [
    new winston.transports.Console(),
  ],
});
