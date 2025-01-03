import { logger } from "../logger";
import { SOLStakingCounter } from "../utils/counter";
import { priorityreplyqueue, solstakequeue } from "../storage/queue";
import { cacheClient } from "../storage/redis";
import { getCacheKey, isOlderThanXHours } from "../utils";
import { getUserProfileByUsername } from "./hotProfilesWorker";
import { twitterClient } from "../utils/twitter";
import { TweetV2 } from "twitter-api-v2";
import { IMentionBody, IReplyBody } from "../utils/interfaces";
import { agent as defaultAgent, SvmAgentKits } from "../sendai/agentkit";
import { stakeWithJup } from "solana-agent-kit/dist/tools";

const mentionsHourCheckReset = 0.02;

export const verifyAndHandleStakeSOLMentions = async (
  data: TweetV2,
  request: IMentionBody
) => {
  const text = data.text;

  try {
    if (!text.toLowerCase().includes(request.request.tools_catch_phrase)) {
      logger.info("invalid sol staking tweet");
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

    const signature = await stakeWithJup(agent, parseFloat(amount));

    return {
      isCreated: true,
      isError: false,
      amount,
      signature,
    };
  } catch (err) {
    console.error("unable to verify SOL Staking tweet", err);
    return {
      isCreated: false,
      isError: true,
    };
  }
};

export const stakeSOLAndReply = async (data: IMentionBody) => {
  try {
    const lastTokenMentionedCheck = getCacheKey(`lastSOLstakementionedcheck`);
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
        message: `last checked SOL staking checked less than ${mentionsHourCheckReset} hour ago, not checking`,
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
    console.log("---------SOL Staking Mentions (Unverified)---------");
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

          // verify and handle stake mentions
          const { isCreated, isError, amount, signature } =
            await verifyAndHandleStakeSOLMentions(d, data);

          if (isCreated) {
            const replyWorkerInput: IReplyBody = {
              tweetId: d.id,
              text: `@${userProfile?.username} SOL Stake Details: \n- Amount: ${amount} \n- Signature: ${signature}`,
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
              text: `👾 Oops! Seems like there was a hiccup with your SOL staking attempt! \nNeed more help? Drop by our Telegram https://t.me/nerobossai 🤖✨`,
              sendImage: false,
              randomImage: false,
              imageLinks: [],
              imageLink: "",
            };
            priorityreplyqueue.push(replyWorkerInput);
          }

          await cacheClient.set(twtCacheKey, "SOL staking tweet");
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

export const SOLStakingWorker = async (data: IMentionBody) => {
  logger.info({
    message: "data in SOL staking queue worker",
    data,
  });
  await stakeSOLAndReply(data);
  SOLStakingCounter.decrementRemaining();
  const remainingLimit = SOLStakingCounter.getRemaining();

  logger.info({
    message: "Remaining SOL staking Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused SOL staking worker from processing more data because rate limit is reached",
    });
    solstakequeue.pause();
  }
  solstakequeue.push(data);
  return;
};
