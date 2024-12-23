import express from "express";
import { logger } from "../logger";
import {
  fetchtokenpricequeue,
  hotprofilesqueue,
  mentionsqueue,
  nftcreationqueue,
  solstakequeue,
  tokencreationqueue,
  tokenlendqueue,
  tokenswapqueue,
  twtqueue,
} from "../storage/queue";
import { BadRequestError } from "../utils/errors";
import { IHotProfileBody } from "../utils/interfaces";

const router = express.Router();

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

    if (details.nftCollection) {
      nftcreationqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || "nerobossai",
        prompt: details.replies_prompt,
      });
    }

    if (details.swapTokens) {
      tokenswapqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || "nerobossai",
        prompt: details.replies_prompt,
      });
    }

    if (details.lendTokens) {
      tokenlendqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || "nerobossai",
        prompt: details.replies_prompt,
      });
    }

    if (details.stakeSOL) {
      solstakequeue.push({
        mentioned_handle: details?.metadata?.twitter_handle || "nerobossai",
        prompt: details.replies_prompt,
      });
    }

    if (details.fetchTokenPrice) {
      fetchtokenpricequeue.push({
        mentioned_handle: details?.metadata?.twitter_handle || "nerobossai",
        prompt: details.replies_prompt,
      });
    }

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
