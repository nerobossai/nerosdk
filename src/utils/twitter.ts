import { TwitterApi } from "twitter-api-v2";

// read-write twitter client
export const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_REPLY_API_KEY as string,
  appSecret: process.env.TWITTER_REPLY_API_SECRET as string,
  accessToken: process.env.TWITTER_REPLY_ACCESS_TOKEN as string,
  accessSecret: process.env.TWITTER_REPLY_ACCESS_SECRET as string,
});
