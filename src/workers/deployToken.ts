import { logger } from "../logger";
import { tokenDeployCounter } from "../utils/counter";
import { deploytokenqueue, priorityreplyqueue } from "../storage/queue";
import { cacheClient } from "../storage/redis";
import { getCacheKey, isOlderThanXHours } from "../utils";
import { getUserProfileByUsername } from "./hotProfilesWorker";
import { twitterClient } from "../utils/twitter";
import { TweetV2 } from "twitter-api-v2";
import { IMentionBody, IReplyBody } from "../utils/interfaces";
import { agent as defaultAgent, SvmAgentKits } from "../sendai/agentkit";

const mentionsHourCheckReset = 0.02;

export const verifyAndHandleStakeSOLMentions = async (
  data: TweetV2,
  request: IMentionBody
) => {
  const text = data.text;

  try {
    if (!text.toLowerCase().includes(request.request.tools_catch_phrase)) {
      logger.info("invalid token deploy tweet");
      return {
        isCreated: false,
        isError: false,
      };
    }

    // parse token amount
    const amount = text.split("amount")[1].trim().split("\n")[0].trim();
    const name = text.split("name")[1].trim().split("\n")[0].trim();
    const uri = text.split("uri")[1].trim().split("\n")[0].trim();
    const decimals = text.split("decimals")[1].trim().split("\n")[0].trim();
    const symbol = text.split("symbol")[1].trim().split("\n")[0].trim();
    const intialSupply = text
      .split("initialSupply")[1]
      .trim()
      .split("\n")[0]
      .trim();

    let agent = defaultAgent;
    const svmData = SvmAgentKits.getAllCatchPhrasesWithAgent();

    svmData.map((svm) => {
      if (!text.toLowerCase().includes(svm.phrase)) return;
      agent = svm.agent;
    });

    const mintAddress = await agent.deployToken(
      name,
      uri,
      symbol,
      parseInt(decimals),
      parseInt(intialSupply)
    );

    return {
      isCreated: true,
      isError: false,
      amount,
      uri,
      symbol,
      name,
      mintAddress,
    };
  } catch (err) {
    console.error("unable to verify token deploy tweet", err);
    return {
      isCreated: false,
      isError: true,
    };
  }
};

export const deployTokenAndReply = async (data: IMentionBody) => {
  try {
    const lastTokenMentionedCheck = getCacheKey(
      `lasttokendeploymentionedcheck`
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
        message: `last checked token deploy checked less than ${mentionsHourCheckReset} hour ago, not checking`,
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
    console.log("---------Token deploy Mentions (Unverified)---------");
    console.log(tweets?.data?.data);
    console.log("--------------------------");
    await Promise.all(
      tweets?.data?.data?.map(async (d) => {
        try {
          // check if tweet is already used for replies
          const twtCacheKey = getCacheKey(`tokendeploytwtidused${d.id}`);
          const cData = await cacheClient.get(twtCacheKey);
          if (cData) {
            console.log("tweet already used for reply - token deploy");
            return;
          }

          // verify and handle stake mentions
          const { isCreated, isError, amount, name, symbol, mintAddress, uri } =
            await verifyAndHandleStakeSOLMentions(d, data);

          if (isCreated) {
            const replyWorkerInput: IReplyBody = {
              tweetId: d.id,
              text: `@${userProfile?.username} Token deploy Details: \n- Amount: ${amount} \n- mint address: ${mintAddress} \n- name: ${name} \n- symbol: ${symbol} \n- uri: ${uri}`,
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
              text: `👾 Oops! Seems like there was a hiccup with your Token deploy attempt! \nNeed more help? Drop by our Telegram https://t.me/nerobossai 🤖✨`,
              sendImage: false,
              randomImage: false,
              imageLinks: [],
              imageLink: "",
            };
            priorityreplyqueue.push(replyWorkerInput);
          }

          await cacheClient.set(twtCacheKey, "Token deploy tweet");
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

export const TokenDeployWorker = async (data: IMentionBody) => {
  logger.info({
    message: "data in token deploy queue worker",
    data,
  });
  await deployTokenAndReply(data);
  tokenDeployCounter.decrementRemaining();
  const remainingLimit = tokenDeployCounter.getRemaining();

  logger.info({
    message: "Remaining token deploy Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused token deploy worker from processing more data because rate limit is reached",
    });
    deploytokenqueue.pause();
  }
  deploytokenqueue.push(data);
  return;
};
