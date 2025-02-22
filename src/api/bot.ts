import express from "express";
import { logger } from "../logger";
import {
  deploytokenqueue,
  fetchtokenpricequeue,
  githubcreationqueue,
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
import { SlackWorker } from '../workers/slackWorker';
import { DiscordWorker } from '../workers/discordWorker';
import { AlexaWorker } from '../workers/alexaWorker';

const router = express.Router();

router.post<{}>("/start", async (req, res, next) => {
  try {
    const { details } = req.body;
    if (!details) throw new BadRequestError();

    // Initialize Slack if configured
    if (details.platforms?.slack) {
      try {
        const slackWorker = new SlackWorker({ details });
        await slackWorker.init();
        logger.info('Slack worker initialized successfully');
      } catch (error) {
        logger.error({
          message: 'Failed to initialize Slack worker',
          error,
          type: 'SLACK_INIT_ERROR',
        });
      }
    }

    // Initialize Discord if configured
    if (details.platforms?.discord) {
      try {
        const discordWorker = new DiscordWorker({ details });
        await discordWorker.init();
        logger.info('Discord worker initialized successfully');
      } catch (error) {
        logger.error({
          message: 'Failed to initialize Discord worker',
          error,
          type: 'DISCORD_INIT_ERROR',
        });
      }
    }

    // Initialize Alexa if configured
    if (details.platforms?.alexa) {
      try {
        const alexaWorker = new AlexaWorker({ details });
        await alexaWorker.init();
        logger.info('Alexa worker initialized successfully');
      } catch (error) {
        logger.error({
          message: 'Failed to initialize Alexa worker',
          error,
          type: 'ALEXA_INIT_ERROR',
        });
      }
    }

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
      request: details,
    });

    // Create Token
    tokencreationqueue.push({
      mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
      prompt: details.replies_prompt,
      request: details,
    });

    if (details.github_config) {
      githubcreationqueue.push(details);
    }

    // create token using SENDAI solana-agent-ket
    if (details.sendai.deployToken) {
      deploytokenqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
        request: details,
      });
    }

    // create NFT collection using metaplex code
    if (details.sendai.createNftCollection) {
      nftcreationqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
        request: details,
      });
    }

    // swap tokens using jupiter api
    if (details.sendai.swapTokens) {
      tokenswapqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
        request: details,
      });
    }

    // lend tokens
    if (details.sendai.lendTokens) {
      tokenlendqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
        request: details,
      });
    }

    // stake solana
    if (details.sendai.stakeSOL) {
      solstakequeue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
        request: details,
      });
    }

    // fetch tokens
    if (details.sendai.fetchTokenPrice) {
      fetchtokenpricequeue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
        request: details,
      });
    }

    // airdrop SPL tokens
    if (details.sendai.airdropTokens) {
      tokenairdropqueue.push({
        mentioned_handle: details?.metadata?.twitter_handle || DEFAULT_X_HANDLE,
        prompt: details.replies_prompt,
        request: details,
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
