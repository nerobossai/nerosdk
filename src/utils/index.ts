import { logger } from "../logger";
import axios from "axios";
import { NEROCITY_API } from "./constants";
import crypto from "crypto";
import { FormData } from "formdata-node";

export type TokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  showName: boolean;
  createdOn: string;
  twitter: string;
};

export type LaunchTokenType = {
  name: string;
  ticker: string;
  description: string;
  image: string;
  prompt: string;
  tokenMetadata: TokenMetadata;
  metadataUri: string;
  createdBy: string;
  createdByTwitter: {
    username: string;
    userId: string;
    tweetId: string;
  };
  social?: {
    twitter?: {
      userId: string;
      username: string;
    };
    telegram?: string;
    website?: string;
  };
};

export type CreateTokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  file: Blob;
  twitter?: string;
  telegram?: string;
  website?: string;
};

/**
 * Get a image object/buffer from url
 * @returns image buffer
 */
export const getImageFromUrl = async (url: string) => {
  try {
    const image = await axios.get(url, {
      responseType: "arraybuffer",
    });

    return image;
  } catch (err) {
    logger.error(err);
    return;
  }
};

export const getRandomFromArray = (array: Array<any>) => {
  try {
    if (array.length === 0) return;
    return array[Math.floor(Math.random() * array.length)];
  } catch (err) {
    logger.error(err);
    return;
  }
};

export const generateRandomId = (size: number = 6) => {
  return Math.random()
    .toString(36)
    .slice(2, size + 2);
};

export const getCacheKey = (key: string) => {
  return `NEROSDKBRAIN#${key}`;
};

export const isOlderThanXHours = (timestamp: number, xHour: number) => {
  const currentTime = Date.now();
  const timeDifference = currentTime - timestamp;
  const hoursDifference = timeDifference / (1000 * 60 * 60);
  return hoursDifference > xHour;
};

export const getRandomItem = <T>(arr: T[]): T => {
  // Ensure the array is not empty
  if (arr.length === 0) throw new Error("expected atleast 1 length");

  // Get a random index within the array's bounds
  const randomIndex = Math.floor(Math.random() * arr.length);

  // Return the item at the random index
  return arr[randomIndex];
};

export const launchToken = async (data: LaunchTokenType) => {
  try {
    const resp = await axios.post(`${NEROCITY_API}/hooks/launch-token`, data, {
      headers: {
        "martian-api-key": process.env.NEROCITY_API_KEY,
      },
    });
    return resp.data;
  } catch (err) {
    console.log("error creating token", err);
  }
};

export const createTokenMetadata = async (create: CreateTokenMetadata) => {
  const formData = new FormData();
  formData.append("file", create.file);
  formData.append("name", create.name);
  formData.append("symbol", create.symbol);
  formData.append("description", create.description);
  formData.append("twitter", create.twitter || "");
  formData.append("telegram", create.telegram || "");
  formData.append("website", create.website || "");
  formData.append("showName", "true");
  const pump = await axios.post("https://pump.fun/api/ipfs", formData);
  return pump.data;
};

export const getStringHash = (content: string) => {
  const hashSum = crypto.createHash("sha1");
  hashSum.update(content);
  return hashSum.digest("hex").toString();
};
