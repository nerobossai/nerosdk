// redis
import { createClient } from "redis";

require("dotenv").config();

export const cacheClient = createClient({
  socket: {
    host: process.env.REDIS_URL || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
  password: process.env.REDIS_PASSWORD,
});
