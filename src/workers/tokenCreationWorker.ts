import { logger } from "../logger";
import { tokenCreationCounter } from "../utils/counter";
import { priorityreplyqueue, tokencreationqueue } from "../storage/queue";
import { cacheClient } from "../storage/redis";
import {
  createTokenMetadata,
  getCacheKey,
  isOlderThanXHours,
  launchToken,
  LaunchTokenType,
} from "../utils";
import {
  getUserProfileByUserid,
  getUserProfileByUsername,
} from "./hotProfilesWorker";
import { twitterClient } from "../utils/twitter";
import { TweetV2 } from "twitter-api-v2";
import axios from "axios";
import { Blob } from "formdata-node";
import { IMentionBody, IReplyBody } from "../utils/interfaces";

const mentionsHourCheckReset = 0.1;

export const verifyAndHandleTokenMentions = async (
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

    // parse ticker
    const ticker = text.split("new agent")[1].trim().split(" ")[0].trim();

    // parse description
    const description = text.split("who is")[1].trim().split("\n")[0].trim();

    // parse agent name
    const agentName = text.split("Agent name:")[1].trim().split("\n")[0].trim();

    let pfpLink;

    if (text.includes("PFP Link:")) {
      pfpLink = text.split("PFP Link:")[1].trim().split("\n")[0].trim();
    }

    if (
      !pfpLink &&
      data.attachments?.media_keys &&
      data.attachments.media_keys[0]
    ) {
      pfpLink = data.attachments.media_keys[0];
    }

    if (!pfpLink) {
      throw new Error("no pfp found");
    }

    let twitter;
    let telegram;
    let website;

    if (text.toLowerCase().includes("twitter username:")) {
      twitter = text.split("Twitter Username:")[1].trim().split("\n")[0].trim();
    }

    if (text.toLowerCase().includes("x username:")) {
      twitter = text.split("X Username:")[1].trim().split("\n")[0].trim();
    }

    if (text.toLowerCase().includes("telegram link:")) {
      telegram = text.split("Telegram Link:")[1].trim().split("\n")[0].trim();
    }

    if (text.toLowerCase().includes("website link:")) {
      website = text.split("Website Link:")[1].trim().split("\n")[0].trim();
    }

    if (twitter) {
      twitter = twitter.replace("@", "");
    }

    // parse creator address
    const creatorAddress = text
      .split("Creator:")[1]
      .trim()
      .split("\n")[0]
      .trim();

    logger.info({
      message: "token creation tweet found",
      ticker,
      description,
      agentName,
      creatorAddress,
      pfpLink,
    });

    let userProfile = await getUserProfileByUserid(data.author_id!);

    const metaResp = await axios.get(pfpLink, {
      responseType: "arraybuffer",
    });
    const contentType = metaResp.headers["content-type"];

    let image = metaResp.data;
    image = new Blob([image], {
      type: contentType,
    });

    let twitterProfile;

    if (twitter) {
      const userDetails = await getUserProfileByUsername(twitter);
      if (userDetails && userDetails.id && userDetails.username) {
        twitterProfile = {
          userId: userDetails.id,
          username: userDetails.username,
        };
      }
    }

    // const send image to ipfs
    const tokenMetadata = await createTokenMetadata({
      file: image,
      name: agentName,
      symbol: ticker,
      description: description,
      twitter: twitter ? `https://x.com/${twitter}` : "",
      telegram: telegram || "",
      website: website || "",
    });
    const metadataUri = tokenMetadata.metadataUri;

    // call nerocity api
    const payload: LaunchTokenType = {
      name: agentName,
      ticker,
      image: tokenMetadata.metadata.image,
      description,
      prompt: description,
      tokenMetadata: tokenMetadata.metadata,
      metadataUri,
      createdBy: creatorAddress,
      createdByTwitter: {
        userId: data.author_id!,
        username: userProfile.username,
        tweetId: data.id,
      },
      social: {
        telegram: telegram || "",
        website: website || "",
        twitter: twitterProfile,
      },
    };
    const resp = await launchToken(payload);
    return {
      isCreated: true,
      isError: false,
      mint: resp.mintPublicKey,
      userProfile,
      pfp: pfpLink,
      tokenMetadata,
    };
  } catch (err) {
    console.error("unable to verify token creation tweet", err);
    return {
      isCreated: false,
      isError: true,
    };
  }
};

export const generateTokenAndReply = async (data: IMentionBody) => {
  try {
    const lastTokenMentionedCheck = getCacheKey(`lasttokenmentionedcheck`);
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
        message: `last checked token creation checked less than ${mentionsHourCheckReset} hour ago, not checking`,
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
    console.log("---------Token Creation Mentions (Unverified)---------");
    console.log(tweets?.data?.data);
    console.log("--------------------------");
    await Promise.all(
      tweets?.data?.data?.map(async (d) => {
        try {
          // check if tweet is already used for replies
          const twtCacheKey = getCacheKey(`tokentwtidused${d.id}`);
          const cData = await cacheClient.get(twtCacheKey);
          if (cData) {
            console.log("tweet already used for reply - token creation");
            return;
          }

          // verify and handle airdrop mentions
          const { isCreated, mint, userProfile, pfp, tokenMetadata, isError } =
            await verifyAndHandleTokenMentions(d, data);

          if (isCreated) {
            const replyWorkerInput: IReplyBody = {
              tweetId: d.id,
              text: `@${userProfile?.username} I grant ${tokenMetadata.metadata.symbol} citizenship at @nerocityai\nAgent Dashboard: https://nerocity.ai/${mint}\nAdd twitter account for your agent at nerocity.ai`,
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
              text: `👾 Oops! Seems like there was a hiccup with your coin launch attempt! Check out our super simple guide for launching coins via Twitter here: https://docs.nerocity.ai \nNeed more help? Drop by our Telegram https://t.me/nerobossai 🤖✨`,
              sendImage: false,
              randomImage: false,
              imageLinks: [],
              imageLink: "",
            };
            priorityreplyqueue.push(replyWorkerInput);
          }

          await cacheClient.set(twtCacheKey, "token creation tweet");
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

export const tokenCreationWorker = async (data: IMentionBody) => {
  logger.info({
    message: "data in token creation queue worker",
    data,
  });
  await generateTokenAndReply(data);
  tokenCreationCounter.decrementRemaining();
  const remainingLimit = tokenCreationCounter.getRemaining();

  logger.info({
    message: "Remaining Token Creation Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused token creation worker from processing more data because rate limit is reached",
    });
    tokencreationqueue.pause();
  }
  tokencreationqueue.push(data);
  return;
};
