import { logger } from "../logger";
import { fetchTokenPriceCounter, SOLStakingCounter } from "../utils/counter";
import {
  fetchtokenpricequeue,
  priorityreplyqueue,
  solstakequeue,
} from "../storage/queue";
import { cacheClient } from "../storage/redis";
import { getCacheKey, isOlderThanXHours } from "../utils";
import { getUserProfileByUsername } from "./hotProfilesWorker";
import { twitterClient } from "../utils/twitter";
import { TweetV2 } from "twitter-api-v2";
import { IMentionBody, IReplyBody } from "../utils/interfaces";
import { agent } from "../utils/agentkit";
import { fetchPrice, stakeWithJup } from "solana-agent-kit/dist/tools";

const mentionsHourCheckReset = 0.02;

export const verifyAndHandleFetchTokenPriceMentions = async (data: TweetV2) => {
  const text = data.text;

  try {
    if (!text.toLowerCase().includes("under the rule of @nerobossai")) {
      logger.info("invalid token price fetch tweet");
      return {
        isCreated: false,
        isError: false,
      };
    }

    // parse token amount
    const tokenMintAddress = text
      .split("target token mint")[1]
      .trim()
      .split(" ")[0]
      .trim();

    const price = await fetchPrice(agent, tokenMintAddress);

    return {
      isCreated: true,
      isError: false,
      tokenMintAddress,
      price,
    };
  } catch (err) {
    console.error("unable to verify fetch token price tweet", err);
    return {
      isCreated: false,
      isError: true,
    };
  }
};

export const fetchTokenPriceAndReply = async (data: IMentionBody) => {
  try {
    const lastTokenMentionedCheck = getCacheKey(
      `lastfetchtokenpricementionedcheck`
    );
    let lastMentionedCheckTimestamp = await cacheClient.get(
      lastTokenMentionedCheck
    );
    if (
      lastMentionedCheckTimestamp &&
      !isOlderThanXHours(
        parseInt(lastMentionedCheckTimestamp),
        mentionsHourCheckReset
      )
    ) {
      logger.info({
        message: `last checked fetch token price checked less than ${mentionsHourCheckReset} hour ago, not checking`,
      });
      return;
    }

    const userProfile = await getUserProfileByUsername(data.mentioned_handle);
    const tweets = await twitterClient.v2.userMentionTimeline(userProfile.id, {
      expansions: [
        "attachments.poll_ids",
        "attachments.media_keys",
        "author_id",
        "referenced_tweets.id",
        "in_reply_to_user_id",
        "edit_history_tweet_ids",
        "geo.place_id",
        "entities.mentions.username",
        "referenced_tweets.id.author_id",
      ],
    });
    console.log("---------Fetch Token Price Mentions (Unverified)---------");
    console.log(tweets?.data?.data);
    console.log("--------------------------");
    await Promise.all(
      tweets?.data?.data?.map(async (d) => {
        try {
          // check if tweet is already used for replies
          const twtCacheKey = getCacheKey(`solstakingtwtidused${d.id}`);
          const cData = await cacheClient.get(twtCacheKey);
          if (cData) {
            console.log("tweet already used for reply - sol staking");
            return;
          }

          // verify and handle airdrop mentions
          const { isCreated, isError, price, tokenMintAddress } =
            await verifyAndHandleFetchTokenPriceMentions(d);

          if (isCreated) {
            const replyWorkerInput: IReplyBody = {
              tweetId: d.id,
              text: `@${userProfile?.username} Token price Details: \n- price: ${price} \n- token mint address: ${tokenMintAddress}`,
              sendImage: false,
              randomImage: false,
              imageLinks: [],
              imageLink: "",
            };

            priorityreplyqueue.push(replyWorkerInput);
          }

          if (isError) {
            const replyWorkerInput: IReplyBody = {
              tweetId: d.id,
              text: `👾 Oops! Seems like there was a hiccup with your fetch token price attempt! \nNeed more help? Drop by our Telegram https://t.me/nerobossai 🤖✨`,
              sendImage: false,
              randomImage: false,
              imageLinks: [],
              imageLink: "",
            };
            priorityreplyqueue.push(replyWorkerInput);
          }

          await cacheClient.set(twtCacheKey, "fetch token price tweet");
        } catch (err) {
          console.log("error in generateReplyAndPost", err);
        }
      })
    );
    await cacheClient.set(lastTokenMentionedCheck, Date.now().toString());
  } catch (err) {
    console.log(err);
  }
};

export const fetchTokenPriceWorker = async (data: IMentionBody) => {
  logger.info({
    message: "data in fetch token price queue worker",
    data,
  });
  await fetchTokenPriceAndReply(data);
  fetchTokenPriceCounter.decrementRemaining();
  const remainingLimit = fetchTokenPriceCounter.getRemaining();

  logger.info({
    message: "Remaining fetch token price Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused fetch token price worker from processing more data because rate limit is reached",
    });
    fetchtokenpricequeue.pause();
  }
  fetchtokenpricequeue.push(data);
  return;
};
