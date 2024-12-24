import { logger } from "../logger";
import { priorityreplyqueue } from "../storage/queue";
import { getImageFromUrl, getRandomFromArray } from "../utils";
import { priorityCounter } from "../utils/counter";
import { IReplyBody } from "../utils/interfaces";
import { twitterClient } from "../utils/twitter";

const sendReply = async (tweetId: string, text: string, config: IReplyBody) => {
  try {
    let mediaIds: any = [];
    try {
      if (config.sendImage) {
        let imageLink = config.randomImage
          ? getRandomFromArray(config.imageLinks)
          : config.imageLink;

        const image = await getImageFromUrl(imageLink);
        if (image) {
          const mediaId = await twitterClient.v1.uploadMedia(image.data, {
            mimeType: image.headers["content-type"],
          });
          console.log(mediaIds);
          mediaIds.push(mediaId);
        }
      }
    } catch (err: any) {
      logger.error({
        message: err.message,
        type: "TWITTER_MEDIA_UPLOAD_ERROR",
      });
    }

    if (mediaIds.length > 0) {
      logger.info({
        message: "Uploading media to reply",
        mediaIds,
        type: "TWITTER_MEDIA_IDS",
      });
    }

    let media;

    if (mediaIds.length > 0) {
      media = {
        media_ids: mediaIds,
      };
    }

    let res = await twitterClient.v2.reply(text, tweetId);

    // async req
    console.log(res);
    logger.info({
      tweetId,
      text,
      type: "PRIORITY_REPLY_SUCCESS",
    });
  } catch (err) {
    console.log("reply error", err);
    console.log(
      "Early pausing the queue and sending original tweet back in queue"
    );
    priorityreplyqueue.pause();
    priorityreplyqueue.push(config);
  }
};

export const priorityReplyWorker = async (data: IReplyBody) => {
  logger.info({
    message: "data in priority reply worker",
    data,
  });
  // sending reply
  await sendReply(data.tweetId, data.text, data);
  priorityCounter.decrementRemaining();
  const remainingLimit = priorityCounter.getRemaining();

  logger.info({
    message: "Remaining Reply Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused priority reply worker from processing more data because rate limit is reached",
    });
    priorityreplyqueue.pause();
  }
  return;
};
