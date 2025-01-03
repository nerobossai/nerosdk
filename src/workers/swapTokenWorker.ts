import { logger } from "../logger";
import { tokenSwapCounter } from "../utils/counter";
import { priorityreplyqueue, tokenswapqueue } from "../storage/queue";
import { cacheClient } from "../storage/redis";
import { getCacheKey, isOlderThanXHours } from "../utils";
import { getUserProfileByUsername } from "./hotProfilesWorker";
import { twitterClient } from "../utils/twitter";
import { TweetV2 } from "twitter-api-v2";
import { IMentionBody, IReplyBody } from "../utils/interfaces";
import { trade } from "solana-agent-kit/dist/tools";
import { agent as defaultAgent, SvmAgentKits } from "../sendai/agentkit";
import { PublicKey } from "@solana/web3.js";

const mentionsHourCheckReset = 0.02;

export const verifyAndHandleTokenSwapMentions = async (
  data: TweetV2,
  request: IMentionBody
) => {
  const text = data.text;

  try {
    if (!text.toLowerCase().includes(request.request.tools_catch_phrase)) {
      logger.info("invalid token launch tweet");
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

    // parse source token mint
    const sourceTokenMint = text
      .split("source token mint")[1]
      .trim()
      .split("\n")[0]
      .trim();

    // parse token amount
    const amount = text.split("amount")[1].trim().split("\n")[0].trim();

    // parse slippage
    const slippage = text.split("slippage")[1].trim().split("\n")[0].trim();

    let agent = defaultAgent;
    const svmData = SvmAgentKits.getAllCatchPhrasesWithAgent();

    svmData.map((svm) => {
      if (!text.toLowerCase().includes(svm.phrase)) return;
      agent = svm.agent;
    });

    const signature = await trade(
      agent,
      new PublicKey(targetTokenMint),
      parseFloat(amount),
      new PublicKey(sourceTokenMint),
      parseFloat(slippage)
    );

    return {
      isCreated: true,
      isError: false,
      targetTokenMint,
      sourceTokenMint,
      amount,
      slippage,
      signature,
    };
  } catch (err) {
    console.error("unable to verify token swap tweet", err);
    return {
      isCreated: false,
      isError: true,
    };
  }
};

export const swapTokenAndReply = async (data: IMentionBody) => {
  try {
    const lastTokenMentionedCheck = getCacheKey(`lasttokenswapmentionedcheck`);
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
        message: `last checked token swap checked less than ${mentionsHourCheckReset} hour ago, not checking`,
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
    console.log("---------Token Swap Mentions (Unverified)---------");
    console.log(tweets?.data?.data);
    console.log("--------------------------");
    await Promise.all(
      tweets?.data?.data?.map(async (d) => {
        try {
          // check if tweet is already used for replies
          const twtCacheKey = getCacheKey(`tokenswaptwtidused${d.id}`);
          const cData = await cacheClient.get(twtCacheKey);
          if (cData) {
            console.log("tweet already used for reply - token swap");
            return;
          }

          // verify and handle airdrop mentions
          const {
            isCreated,
            isError,
            sourceTokenMint,
            targetTokenMint,
            amount,
            slippage,
            signature,
          } = await verifyAndHandleTokenSwapMentions(d, data);

          if (isCreated) {
            const replyWorkerInput: IReplyBody = {
              tweetId: d.id,
              text: `@${userProfile?.username} Swap Details:\n- Source Token Mint: ${sourceTokenMint}\n- Target Token Mint: ${targetTokenMint}\n- Amount: ${amount}\n- Slippage: ${slippage}%\n- Signature: ${signature}`,
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
              text: `👾 Oops! Seems like there was a hiccup with your token swap attempt! \nNeed more help? Drop by our Telegram https://t.me/nerobossai 🤖✨`,
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

export const tokenSwapWorker = async (data: IMentionBody) => {
  logger.info({
    message: "data in token swap queue worker",
    data,
  });
  await swapTokenAndReply(data);
  tokenSwapCounter.decrementRemaining();
  const remainingLimit = tokenSwapCounter.getRemaining();

  logger.info({
    message: "Remaining Token Swap Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused token swap worker from processing more data because rate limit is reached",
    });
    tokenswapqueue.pause();
  }
  tokenswapqueue.push(data);
  return;
};
