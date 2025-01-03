import express from "express";
import { logger } from "../logger";
import {
  deploytokenqueue,
  fetchtokenpricequeue,
  hotprofilesqueue,
  mentionsqueue,
  nftcreationqueue,
  solstakequeue,
  tokenairdropqueue,
  tokencreationqueue,
  tokenlendqueue,
  tokenswapqueue,
  twtqueue,
} from "../storage/queue";
import { BadRequestError } from "../utils/errors";
import { IHotProfileBody, ISvmAgentKit } from "../utils/interfaces";
import { DEFAULT_X_HANDLE } from "../utils/constants";
import { SvmAgentKits } from "../sendai/agentkit";

const router = express.Router();

router.post<{}>("/start", async (req, res, next) => {
  try {
    const { details } = req.body;
    if (!details) throw new BadRequestError();

    // configure agent kits
    if (details.svm) {
      details.svm.map((svm: ISvmAgentKit) => {
        SvmAgentKits.create(svm);
      });
    }

    // send request in internal queue
    twtqueue.push(details);
    hotprofilesqueue.pause();
    (details.hotprofiles || []).map((d: IHotProfileBody) => {
      hotprofilesqueue.push(d);
    });
    hotprofilesqueue.resume();
    mentionsqueue.push({
      mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
      prompt: details.replies_prompt,
    });

    // Create Token
    tokencreationqueue.push({
      mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
      prompt: details.replies_prompt,
    });

    // create token using SENDAI solana-agent-ket
    if (details.sendai.deployToken) {
      deploytokenqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
      });
    }

    // create NFT collection using metaplex code
    if (details.sendai.createNftCollection) {
      nftcreationqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
      });
    }

    // swap tokens using jupiter api
    if (details.sendai.swapTokens) {
      tokenswapqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
      });
    }

    // lend tokens
    if (details.sendai.lendTokens) {
      tokenlendqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
      });
    }

    // stake solana
    if (details.sendai.stakeSOL) {
      solstakequeue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
      });
    }

    // fetch tokens
    if (details.sendai.fetchTokenPrice) {
      fetchtokenpricequeue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
      });
    }

    // airdrop SPL tokens
    if (details.sendai.airdropTokens) {
      tokenairdropqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
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
