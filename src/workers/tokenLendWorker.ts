import { logger } from "../logger";
import { tokenLendingCounter, tokenSwapCounter } from "../utils/counter";
import {
  priorityreplyqueue,
  tokenlendqueue,
  tokenswapqueue,
} from "../storage/queue";
import { cacheClient } from "../storage/redis";
import { getCacheKey, isOlderThanXHours } from "../utils";
import { getUserProfileByUsername } from "./hotProfilesWorker";
import { twitterClient } from "../utils/twitter";
import { TweetV2 } from "twitter-api-v2";
import { IMentionBody, IReplyBody } from "../utils/interfaces";
import { agent as defaultAgent, SvmAgentKits } from "../sendai/agentkit";

const mentionsHourCheckReset = 0.02;

export const verifyAndHandleTokenLendingMentions = async (
  data: TweetV2,
  request: IMentionBody
) => {
  const text = data.text;

  try {
    if (!text.toLowerCase().includes(request.request.tools_catch_phrase)) {
      logger.info("invalid token lending tweet");
      return {
        isCreated: false,
        isError: false,
      };
    }

    // parse token amount
    const amount = text.split("amount")[1].trim().split("\n")[0].trim();

    let agent = defaultAgent;
    const svmData = SvmAgentKits.getAllCatchPhrasesWithAgent();

    svmData.map((svm) => {
      if (!text.toLowerCase().includes(svm.phrase)) return;
      agent = svm.agent;
    });

    const signature = await agent.lendAssets(parseFloat(amount));

    return {
      isCreated: true,
      isError: false,
      amount,
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

export const lendTokenAndReply = async (data: IMentionBody) => {
  try {
    const lastTokenMentionedCheck = getCacheKey(`lasttokenlendmentionedcheck`);
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
        message: `last checked token lending checked less than ${mentionsHourCheckReset} hour ago, not checking`,
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
    console.log("---------Token Lending Mentions (Unverified)---------");
    console.log(tweets?.data?.data);
    console.log("--------------------------");
    await Promise.all(
      tweets?.data?.data?.map(async (d) => {
        try {
          // check if tweet is already used for replies
          const twtCacheKey = getCacheKey(`tokenlendingtwtidused${d.id}`);
          const cData = await cacheClient.get(twtCacheKey);
          if (cData) {
            console.log("tweet already used for reply - token lending");
            return;
          }

          // verify and handle airdrop mentions
          const { isCreated, isError, amount, signature } =
            await verifyAndHandleTokenLendingMentions(d, data);

          if (isCreated) {
            const replyWorkerInput: IReplyBody = {
              tweetId: d.id,
              text: `@${userProfile?.username} Lend Details: \n- Amount: ${amount} \n- Signature: ${signature}`,
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
              text: `👾 Oops! Seems like there was a hiccup with your token lending attempt! \nNeed more help? Drop by our Telegram https://t.me/nerobossai 🤖✨`,
              sendImage: false,
              randomImage: false,
              imageLinks: [],
              imageLink: "",
            };
            priorityreplyqueue.push(replyWorkerInput);
          }

          await cacheClient.set(twtCacheKey, "token lending tweet");
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

export const tokenLendingWorker = async (data: IMentionBody) => {
  logger.info({
    message: "data in token lending queue worker",
    data,
  });
  await lendTokenAndReply(data);
  tokenLendingCounter.decrementRemaining();
  const remainingLimit = tokenLendingCounter.getRemaining();

  logger.info({
    message: "Remaining Token Lending Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused token lending worker from processing more data because rate limit is reached",
    });
    tokenlendqueue.pause();
  }
  tokenlendqueue.push(data);
  return;
};
