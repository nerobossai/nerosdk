import { logger } from "../logger";
import { NFTCreationCounter } from "../utils/counter";
import { priorityreplyqueue, nftcreationqueue } from "../storage/queue";
import { cacheClient } from "../storage/redis";
import { getCacheKey, isOlderThanXHours } from "../utils";
import {
  getUserProfileByUserid,
  getUserProfileByUsername,
} from "./hotProfilesWorker";
import { twitterClient } from "../utils/twitter";
import { TweetV2 } from "twitter-api-v2";
import axios from "axios";
import { Blob } from "formdata-node";
import { IMentionBody, IReplyBody } from "../utils/interfaces";
import { createGenericFile } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { deploy_collection } from "solana-agent-kit/dist/tools";
import { agent } from "../sendai/agentkit";

const mentionsHourCheckReset = 0.02;

const umi = createUmi(process.env.RPC_URL as string);

export const verifyAndHandleNFTMentions = async (
  data: TweetV2,
  request: IMentionBody
) => {
  const text = data.text;

  try {
    if (!text.toLowerCase().includes(request.request.tools_catch_phrase)) {
      logger.info("invalid NFT launch tweet");
      return {
        isCreated: false,
        isError: false,
      };
    }

    // parse ticker
    const symbol = text.split("new nft")[1].trim().split(" ")[0].trim();

    // parse description
    const description = text.split("who is")[1].trim().split("\n")[0].trim();

    // parse agent name
    const NFTName = text.split("NFT name:")[1].trim().split("\n")[0].trim();

    let imageLink;

    if (text.includes("Image Link:")) {
      imageLink = text.split("Image Link:")[1].trim().split("\n")[0].trim();
    }

    if (
      !imageLink &&
      data.attachments?.media_keys &&
      data.attachments.media_keys[0]
    ) {
      imageLink = data.attachments.media_keys[0];
    }

    if (!imageLink) {
      throw new Error("no Image found");
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
      message: "NFT creation tweet found",
      symbol,
      description,
      NFTName,
      creatorAddress,
      imageLink,
    });

    let userProfile = await getUserProfileByUserid(data.author_id!);

    const metaResp = await axios.get(imageLink, {
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

    const nftMetadata = {
      name: NFTName,
      symbol,
      description,
      image,
      social: {
        telegram: telegram || "",
        website: website || "",
        twitter: twitterProfile,
      },
    };

    const umiJsonFile = createGenericFile(
      JSON.stringify(nftMetadata),
      `${NFTName}-metadata`,
      {
        tags: [{ name: "Content-Type", value: "JSON" }],
      }
    );

    const uri = (await umi.uploader.upload([umiJsonFile]))[0];

    const collection = await deploy_collection(agent, {
      name: NFTName,
      uri: uri,
      royaltyBasisPoints: 500, // 5%
      creators: [
        {
          address: creatorAddress,
          percentage: 100,
        },
      ],
    });

    return {
      isCreated: true,
      isError: false,
      collection: collection,
      userProfile,
      pfp: imageLink,
      nftMetadata,
    };
  } catch (err) {
    console.error("unable to verify NFT creation tweet", err);
    return {
      isCreated: false,
      isError: true,
    };
  }
};

export const generateNFTCollectionAndReply = async (data: IMentionBody) => {
  try {
    const lastTokenMentionedCheck = getCacheKey(`lastnftmentionedcheck`);
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
        message: `last checked nft creation checked less than ${mentionsHourCheckReset} hour ago, not checking`,
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
    console.log(
      "---------NFT Collection Creation Mentions (Unverified)---------"
    );
    console.log(tweets?.data?.data);
    console.log("--------------------------");
    await Promise.all(
      tweets?.data?.data?.map(async (d) => {
        try {
          // check if tweet is already used for replies
          const twtCacheKey = getCacheKey(`nftcreationtwtidused${d.id}`);
          const cData = await cacheClient.get(twtCacheKey);
          if (cData) {
            console.log("tweet already used for reply - nft creation");
            return;
          }

          // verify and handle airdrop mentions
          const { isCreated, userProfile, nftMetadata, isError } =
            await verifyAndHandleNFTMentions(d, data);

          if (isCreated) {
            const replyWorkerInput: IReplyBody = {
              tweetId: d.id,
              text: `@${userProfile?.username} your NFT Collection ${nftMetadata?.symbol} is created`,
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
              text: `👾 Oops! Seems like there was a hiccup with your NFT Collection launch attempt! \nNeed more help? Drop by our Telegram https://t.me/nerobossai 🤖✨`,
              sendImage: false,
              randomImage: false,
              imageLinks: [],
              imageLink: "",
            };
            priorityreplyqueue.push(replyWorkerInput);
          }

          await cacheClient.set(twtCacheKey, "NFT creation tweet");
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

export const NFTCreationWorker = async (data: IMentionBody) => {
  logger.info({
    message: "data in NFT creation queue worker",
    data,
  });
  await generateNFTCollectionAndReply(data);
  NFTCreationCounter.decrementRemaining();
  const remainingLimit = NFTCreationCounter.getRemaining();

  logger.info({
    message: "Remaining NFT Creation Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused NFT creation worker from processing more data because rate limit is reached",
    });
    nftcreationqueue.pause();
  }
  nftcreationqueue.push(data);
  return;
};
