import { logger } from "../logger";
import { tokenAirdropCounter, tokenSwapCounter } from "../utils/counter";
import {
  priorityreplyqueue,
  tokenairdropqueue,
  tokenswapqueue,
} from "../storage/queue";
import { cacheClient } from "../storage/redis";
import { getCacheKey, isOlderThanXHours } from "../utils";
import { getUserProfileByUsername } from "./hotProfilesWorker";
import { twitterClient } from "../utils/twitter";
import { TweetV2 } from "twitter-api-v2";
import { IMentionBody, IReplyBody } from "../utils/interfaces";
import {
  getAirdropCostEstimate,
  sendCompressedAirdrop,
  trade,
} from "solana-agent-kit/dist/tools";
import { agent } from "../utils/agentkit";
import { PublicKey } from "@solana/web3.js";

const mentionsHourCheckReset = 0.02;

export const verifyAndHandleTokenAirdropMentions = async (data: TweetV2) => {
  const text = data.text;

  try {
    if (!text.toLowerCase().includes("under the rule of @nerobossai")) {
      logger.info("invalid token airdrop tweet");
      return {
        isCreated: false,
        isError: false,
      };
    }

    // parse target token mint
    const targetTokenMint = text
      .split("target token mint")[1]
      .trim()
      .split(" ")[0]
      .trim();

    // parse token amount
    const amount = text.split("amount")[1].trim().split("\n")[0].trim();

    const publicKeysText = text.split("to the following users:")[1].trim(); // Get everything after "to the following users:"

    // Split the public keys by comma and trim any extra whitespace
    const publicKeys = publicKeysText
      .split(",")
      .map((key) => new PublicKey(key.trim()));

    const signature = await sendCompressedAirdrop(
      agent,
      new PublicKey(targetTokenMint),
      parseInt(amount), // amount per recipient
      6,
      publicKeys,
      30_000
    );

    const airdropCostEstimate = getAirdropCostEstimate(
      publicKeys.length,
      30_000
    );

    return {
      isCreated: true,
      isError: false,
      targetTokenMint,
      amount,
      airdropCostEstimate,
      signature,
      airdropCount: publicKeys.length,
    };
  } catch (err) {
    console.error("unable to verify token swap tweet", err);
    return {
      isCreated: false,
      isError: true,
    };
  }
};

export const airdropTokensAndReply = async (data: IMentionBody) => {
  try {
    const lastTokenMentionedCheck = getCacheKey(
      `lasttokenairdropmentionedcheck`
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
        message: `last checked token airdrop checked less than ${mentionsHourCheckReset} hour ago, not checking`,
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
    console.log("---------Token Airdrop Mentions (Unverified)---------");
    console.log(tweets?.data?.data);
    console.log("--------------------------");
    await Promise.all(
      tweets?.data?.data?.map(async (d) => {
        try {
          // check if tweet is already used for replies
          const twtCacheKey = getCacheKey(`tokenairdroptwtidused${d.id}`);
          const cData = await cacheClient.get(twtCacheKey);
          if (cData) {
            console.log("tweet already used for reply - token airdrop");
            return;
          }

          // verify and handle airdrop mentions
          const {
            isCreated,
            isError,
            targetTokenMint,
            amount,
            airdropCostEstimate,
            airdropCount,
            signature,
          } = await verifyAndHandleTokenAirdropMentions(d);

          if (isCreated) {
            const replyWorkerInput: IReplyBody = {
              tweetId: d.id,
              text: `@${userProfile?.username} Airdrop Details:\n- Token Mint: ${targetTokenMint}\n- amount per user: ${amount}\n- Airdrop count: ${airdropCount}\n- Estimated Cost: ${airdropCostEstimate}%\n- Signature: ${signature}`,
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
              text: `👾 Oops! Seems like there was a hiccup with your token airdrop attempt! \nNeed more help? Drop by our Telegram https://t.me/nerobossai 🤖✨`,
              sendImage: false,
              randomImage: false,
              imageLinks: [],
              imageLink: "",
            };
            priorityreplyqueue.push(replyWorkerInput);
          }

          await cacheClient.set(twtCacheKey, "token swap tweet");
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

export const tokenAirdropWorker = async (data: IMentionBody) => {
  logger.info({
    message: "data in token airdrop queue worker",
    data,
  });
  await airdropTokensAndReply(data);
  tokenAirdropCounter.decrementRemaining();
  const remainingLimit = tokenAirdropCounter.getRemaining();

  logger.info({
    message: "Remaining Token Airdrop Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused token airdrop worker from processing more data because rate limit is reached",
    });
    tokenairdropqueue.pause();
  }
  tokenairdropqueue.push(data);
  return;
};
