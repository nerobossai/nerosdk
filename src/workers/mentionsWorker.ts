import { IMentionBody, IReplyBody } from "../api/bot";
import { logger } from "../logger";
import { mentionsCounter } from "../utils/counter";
import { mentionsqueue, replyqueue } from "../storage/queue";
import { cacheClient } from "../storage/redis";
import { chatCompletion } from "../services/gpt";
import { getCacheKey, isOlderThanXHours } from "../utils";
import { twitterClient } from "../utils/twitter";
import {
  getUserProfileByUserid,
  getUserProfileByUsername,
} from "./hotProfilesWorker";
import { TweetV2 } from "twitter-api-v2";
import { ChatCompletionUserMessageParam } from "openai/resources";

const mentionsHourCheckReset = 0.02;

export const verifyAndHandleAirdropMentions = async (data: TweetV2) => {
  try {
    console.log("validating airdrop request for tweet", data);

    if (
      !data.referenced_tweets ||
      data.referenced_tweets.length === 0 ||
      !data.author_id
    ) {
      console.log("invalid tweet for airdrop");
      return;
    }
    if (data.referenced_tweets[0].type !== "quoted") {
      console.log("invalid tweet for airdrop");
      return;
    }

    const tweetId = data.referenced_tweets[0].id;
    const airdropCacheKey = getCacheKey("ACTIVEAIRDROPS");
    let airdropDetails: any = await cacheClient.get(airdropCacheKey);
    if (!airdropDetails) {
      console.log("no active airdrops found");
      return;
    }

    airdropDetails = JSON.parse(airdropDetails);
    if (!airdropDetails[tweetId]) {
      console.log("QT referenced id not available for airdrop");
      return;
    }

    const airdropMetadata = airdropDetails[tweetId];

    // ask gpt what it thinks
    const gptResponse = await chatCompletion(
      airdropMetadata.metadata.validatorPrompt,
      [
        {
          content: data.text,
          role: "user",
        },
      ]
    );

    console.log("neroboss decision for airdrop?", gptResponse.message.content);

    let sendAirdrop = false;

    if (gptResponse.message.content?.toLowerCase().includes("true")) {
      sendAirdrop = true;
    } else {
      // check followers count
      let userProfile = await getUserProfileByUserid(data.author_id);
      if (!userProfile.public_metrics) {
        userProfile = await getUserProfileByUserid(data.author_id, true);
      }
      if (
        (userProfile.public_metrics?.followers_count || 0) >=
        airdropMetadata.metadata.minFollowersCount
      ) {
        sendAirdrop = true;
      }
    }

    if (!sendAirdrop) {
      console.log("QT not worthy enough");
      return;
    }

    airdropMetadata.count += 1;
    if (airdropMetadata.count >= airdropMetadata.limit) {
      delete airdropDetails[tweetId];
    } else {
      console.log("updating metadata cache", airdropMetadata);
      airdropDetails[tweetId] = airdropMetadata;
      await cacheClient.set(airdropCacheKey, JSON.stringify(airdropDetails));
    }
  } catch (err) {
    console.log("Airdrop Error", err);
  }
};

export const generateReplyAndPost = async (data: IMentionBody) => {
  try {
    const lastMentionedCheck = getCacheKey(`lastmentionedcheck`);
    let lastMentionedCheckTimestamp = await cacheClient.get(lastMentionedCheck);
    if (
      lastMentionedCheckTimestamp &&
      !isOlderThanXHours(
        parseInt(lastMentionedCheckTimestamp),
        mentionsHourCheckReset
      )
    ) {
      logger.info({
        message: `last checked mentioned less than ${mentionsHourCheckReset} hour ago, not checking`,
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
    console.log("---------Mentions---------");
    console.log(tweets?.data?.data);
    console.log("--------------------------");
    await Promise.all(
      tweets?.data?.data?.map(async (d) => {
        try {
          // check if tweet is already used for replies
          const twtCacheKey = getCacheKey(`twtidused${d.id}`);
          const cData = await cacheClient.get(twtCacheKey);
          if (cData) {
            console.log("tweet already used for reply - mentions");
            return;
          }

          // verify and handle airdrop mentions
          await verifyAndHandleAirdropMentions(d);

          let context: ChatCompletionUserMessageParam[];

          if (
            d.attachments?.media_keys &&
            d.attachments?.media_keys?.length > 0
          ) {
            context = [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: d.text,
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: d.attachments?.media_keys[0],
                      detail: "low",
                    },
                  },
                ],
              },
            ];
          } else {
            context = [
              {
                content: d.text,
                role: "user",
              },
            ];
          }

          // generate reply
          const gptResponse = await chatCompletion(data.prompt, context);
          // send tweet in comment/reply queue
          const replyWorkerInput: IReplyBody = {
            tweetId: d.id,
            text: gptResponse.message.content || "hello world!",
            sendImage: false,
            randomImage: false,
            imageLinks: [],
            imageLink: "",
          };
          console.log("Pushing data in reply worker - mentions");
          replyqueue.push(replyWorkerInput);
          await cacheClient.set(twtCacheKey, JSON.stringify(replyWorkerInput));
        } catch (err) {
          console.log("error in generateReplyAndPost", err);
        }
      })
    );
    await cacheClient.set(lastMentionedCheck, Date.now().toString());
  } catch (err) {
    console.log(err);
  }
};

export const mentionsWorker = async (data: IMentionBody) => {
  logger.info({
    message: "data in mentions queue worker",
    data,
  });
  await generateReplyAndPost(data);
  mentionsCounter.decrementRemaining();
  const remainingLimit = mentionsCounter.getRemaining();

  logger.info({
    message: "Remaining Mentions Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused mention worker from processing more data because rate limit is reached",
    });
    mentionsqueue.pause();
  }
  mentionsqueue.push(data);
  return;
};
