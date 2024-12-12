import { ITweetBody } from "../api/bot";
import { chatCompletion } from "../services/gpt";
import { logger } from "../logger";
import { twtqueue } from "../storage/queue";
import { tweetCounter } from "../utils/counter";
import { twitterClient } from "../utils/twitter";
import {
  getCacheKey,
  getRandomItem,
  isOlderThanXHours,
} from "../utils";
import { cacheClient } from "../storage/redis";
import { getUserProfileByUsername } from "./hotProfilesWorker";
import { ChatCompletion } from "openai/resources";

const newsUsername = "XNews";

const tweetHourCheckReset = 2.5;

export const generateAndTweet = async (prompt: string, newsPrompt: string) => {
  try {
    const lastTweetTimeCache = getCacheKey(`lasttweettime`);
    let lastTweetTimestamp = await cacheClient.get(lastTweetTimeCache);
    if (
      lastTweetTimestamp &&
      !isOlderThanXHours(parseInt(lastTweetTimestamp), tweetHourCheckReset)
    ) {
      console.log(
        `last tweeted less than ${tweetHourCheckReset} hour ago, not tweeting`
      );
      return;
    }

    // check if it's time to include latest news in the tweet or not
    const newsCacheKey = getCacheKey(`lastnewstime`);
    let timestamp = await cacheClient.get(newsCacheKey);
    let gptResponse: ChatCompletion.Choice;
    if (!timestamp || isOlderThanXHours(parseInt(timestamp), 3)) {
      console.log("---------NEWS TIME-----------");
      const userProfile = await getUserProfileByUsername(newsUsername);
      // fetch last post from MarioNawfal
      const tweets = await twitterClient.v2.userTimeline(userProfile.id, {
        max_results: 5,
      });
      const news = tweets?.data?.data[0];
      // compile tweet -> boom!
      gptResponse = await chatCompletion(newsPrompt, [
        {
          content: news.text,
          role: "user",
        },
      ]);
      await cacheClient.set(newsCacheKey, Date.now().toString());
    } else {
      gptResponse = await chatCompletion(prompt);
    }
    gptResponse = await chatCompletion(prompt);
    const tweet = gptResponse.message.content || "hello world!";
    // send tweet
    const res = await twitterClient.v2.tweet(tweet);
    await cacheClient.set(lastTweetTimeCache, Date.now().toString());
  } catch (err) {
    console.log(err);
  }
};

export const tweetWorker = async (data: ITweetBody) => {
  logger.info({
    message: "data in tweet queue worker",
    data,
  });

  await generateAndTweet(
    getRandomItem(data.prompt),
    getRandomItem(data.news_prompt)
  );

  tweetCounter.decrementRemaining();
  const remainingLimit = tweetCounter.getRemaining();

  logger.info({
    message: "Remaining Tweet Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused tweet worker from processing more data because rate limit is reached",
    });
    twtqueue.pause();
  }

  twtqueue.push(data);

  return;
};
