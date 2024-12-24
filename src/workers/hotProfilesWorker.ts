import { chatCompletion } from "../services/gpt";
import { logger } from "../logger";
import { hotprofilesqueue, replyqueue } from "../storage/queue";
import { hotProfilesCounter } from "../utils/counter";
import { twitterClient } from "../utils/twitter";
import { getCacheKey } from "../utils";
import { cacheClient } from "../storage/redis";
import { UserV2 } from "twitter-api-v2";
import { ChatCompletionUserMessageParam } from "openai/resources";
import { IHotProfileBody, IReplyBody } from "../utils/interfaces";

export type FetchUserAndCommentProps = {
  username: string;
  prompt: string;
};

export const getUserProfileByUsername = async (
  username: string,
  invalidate: boolean = false
): Promise<UserV2> => {
  const cacheKey = getCacheKey(`twtuser${username}`);
  let userProfile: UserV2 = JSON.parse(
    (await cacheClient.get(cacheKey)) || "{}"
  );

  if (!userProfile || !userProfile.id || invalidate) {
    const tmp = await twitterClient.v2.userByUsername(username, {
      "user.fields": ["public_metrics"],
    });
    userProfile = tmp.data;
    if (tmp.data) {
      await cacheClient.set(cacheKey, JSON.stringify(userProfile), {
        EX: 60 * 60 * 24, // 1 day
      });
    }
  }

  console.log(`=============user profile of ${username} is:=============`);
  console.log(userProfile);
  console.log(`=========================================================`);
  return userProfile;
};

export const getUserProfileByUserid = async (
  userid: string,
  invalidate: boolean = false
): Promise<UserV2> => {
  const cacheKey = getCacheKey(`twtuserid${userid}`);
  let userProfile: UserV2 = JSON.parse(
    (await cacheClient.get(cacheKey)) || "{}"
  );

  if (!userProfile || !userProfile.id || invalidate) {
    const tmp = await twitterClient.v2.user(userid, {
      "user.fields": ["public_metrics"],
    });
    userProfile = tmp.data;
    if (tmp.data) {
      await cacheClient.set(cacheKey, JSON.stringify(userProfile), {
        EX: 60 * 60 * 24, // 1 day
      });
    }
  }

  return userProfile;
};

const fetchUserAndComment = async ({
  username,
  prompt,
}: FetchUserAndCommentProps) => {
  try {
    // console.log("----------not checking hot profiles-----------")
    // return;

    const userProfile = await getUserProfileByUsername(username);
    const tweets = await twitterClient.v2.userTimeline(userProfile.id, {
      max_results: 5,
      expansions: ["attachments.media_keys"],
    });
    console.log(`---------HOT PROFILES - ${username}---------`);
    console.log(tweets?.data?.data);
    console.log("--------------------------");
    await Promise.all(
      tweets?.data?.data?.map(async (d) => {
        try {
          // check if tweet is already used for replies
          const twtCacheKey = getCacheKey(`twtidused${d.id}`);
          const data = await cacheClient.get(twtCacheKey);
          if (data) {
            console.log("tweet already used for reply - hot profiles");
            return;
          }

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
          const gptResponse = await chatCompletion(prompt, context);
          // send tweet in comment/reply queue
          const replyWorkerInput: IReplyBody = {
            tweetId: d.id,
            text: gptResponse.message.content || "hello world!",
            sendImage: false,
            randomImage: false,
            imageLinks: [],
            imageLink: "",
          };
          console.log("Pushing data in reply worker - hot profile");
          replyqueue.push(replyWorkerInput);
          await cacheClient.set(twtCacheKey, JSON.stringify(replyWorkerInput));
        } catch (err) {
          console.log("error in fetchUserAndComment", err);
        }
      })
    );
  } catch (err) {
    console.log(err);
    // logger.error(err);
  }
};

export const hotProfilesWorker = async (data: IHotProfileBody) => {
  logger.info({
    message: "data in hot profiles queue worker",
    data,
  });

  hotProfilesCounter.decrementRemaining();
  await fetchUserAndComment({ username: data.twthandle, prompt: data.prompt });

  const remainingLimit = hotProfilesCounter.getRemaining();

  logger.info({
    message: "Remaining Hot Profiles Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused hot profiles worker from processing more data because rate limit is reached",
    });
    hotprofilesqueue.pause();
  }

  hotprofilesqueue.push(data);

  return;
};
