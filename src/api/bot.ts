import express from "express";
import { logger } from "../logger";
import {
  hotprofilesqueue,
  mentionsqueue,
  tokencreationqueue,
  twtqueue,
} from "../storage/queue";
import { BadRequestError } from "../utils/errors";

const router = express.Router();

export interface IRegisterAirdropBody {
  tweetId: string;
  limit: number;
  validatorPrompt: string;
  minFollowersCount: number;
}

export interface IReplyBody {
  tweetId: string;
  text: string;
  sendImage: boolean;
  randomImage: boolean;
  imageLinks: Array<any>;
  imageLink: string;
}

export interface IHotProfileBody {
  name: string;
  twthandle: string;
  description: string;
  prompt: string;
}

export interface ITweetBody {
  metadata: {
    twitter_handle: string;
    tg_handle?: string;
  };
  uniqueid: string;
  prompt: [string];
  news_prompt: [string];
  news_handles: [string];
  hotprofiles_prompt: string;
  replies_prompt: string;
  hotprofiles: [IHotProfileBody];
}

export interface IMentionBody {
  prompt: string;
  mentioned_handle: string;
}

router.post<{}>("/start", async (req, res, next) => {
  try {
    const { details } = req.body;
    if (!details) throw new BadRequestError();
    // send request in internal queue
    twtqueue.push(details);
    hotprofilesqueue.pause();
    (details.hotprofiles || []).map((d: IHotProfileBody) => {
      hotprofilesqueue.push(d);
    });
    hotprofilesqueue.resume();
    mentionsqueue.push({
      mentioned_handle: details?.metadata?.twitter_handle || "nerobossai",
      prompt: details.replies_prompt,
    });
    tokencreationqueue.push({
      mentioned_handle: details?.metadata?.twitter_handle || "nerobossai",
      prompt: details.replies_prompt,
    });
    return res.json({
      message: "request registered in queue",
    });
  } catch (err: any) {
    console.log(err);
    logger.error({
      message: err.message,
      type: "REGISTER_PROMPT_ERROR",
    });
    next(err);
  }
});

export default router;
