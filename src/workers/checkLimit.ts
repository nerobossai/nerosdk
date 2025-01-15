import { logger } from "../logger";
import {
  replyqueue,
  hotprofilesqueue,
  twtqueue,
  mentionsqueue,
  tokencreationqueue,
  priorityreplyqueue,
  githubcreationqueue,
} from "../storage/queue";
import {
  HOT_PROFILE_RESET_LIMIT_TIME_IN_MS,
  MENTIONS_RESET_LIMIT_TIME_IN_MS,
  MENTIONS_TOKEN_CREATION_RESET_LIMIT_TIME_IN_MS,
  PRIORITY_RESET_LIMIT_TIME_IN_MS,
  RESET_LIMIT_TIME_IN_MS,
  TWT_RESET_LIMIT_TIME_IN_MS,
} from "../utils/constants";
import {
  counter,
  githubCounter,
  hotProfilesCounter,
  mentionsCounter,
  priorityCounter,
  tokenCreationCounter,
  tweetCounter,
} from "../utils/counter";

export const resetLimitJob = () => {
  logger.info({
    message: "in reset limit job function",
  });
  setTimeout(() => {
    logger.info({
      message: "resetting reply limit",
    });
    counter.resetRemaining();
    replyqueue.resume(); // incase queue is paused
    resetLimitJob();
  }, RESET_LIMIT_TIME_IN_MS);
};

export const resetTweetLimitJob = () => {
  logger.info({
    message: "in reset tweet limit job function",
  });
  setTimeout(() => {
    logger.info({
      message: "resetting tweet limit",
    });
    tweetCounter.resetRemaining();
    twtqueue.resume(); // incase queue is paused
    resetTweetLimitJob();
  }, TWT_RESET_LIMIT_TIME_IN_MS);
};

export const resetHotProfilesLimitJob = () => {
  logger.info({
    message: "in reset hot profiles limit job function",
  });
  setTimeout(() => {
    logger.info({
      message: "resetting hotprofile limit",
    });
    hotProfilesCounter.resetRemaining();
    hotprofilesqueue.resume(); // incase queue is paused
    resetHotProfilesLimitJob();
  }, HOT_PROFILE_RESET_LIMIT_TIME_IN_MS);
};

export const resetMentionsLimitJob = () => {
  logger.info({
    message: "in reset mentions limit job function",
  });
  setTimeout(() => {
    logger.info({
      message: "resetting mentions limit",
    });
    mentionsCounter.resetRemaining();
    mentionsqueue.resume(); // incase queue is paused
    resetMentionsLimitJob();
  }, MENTIONS_RESET_LIMIT_TIME_IN_MS);
};

export const resetTokenCreationLimitJob = () => {
  logger.info({
    message: "in reset token creation limit job function",
  });
  setTimeout(() => {
    logger.info({
      message: "resetting token creation limit",
    });
    tokenCreationCounter.resetRemaining();
    tokencreationqueue.resume(); // incase queue is paused
    resetTokenCreationLimitJob();
  }, MENTIONS_TOKEN_CREATION_RESET_LIMIT_TIME_IN_MS);
};

export const resetPriorityReplyLimitJob = () => {
  logger.info({
    message: "in priority reply reset limit job function",
  });
  setTimeout(() => {
    logger.info({
      message: "resetting priority reply limit",
    });
    priorityCounter.resetRemaining();
    priorityreplyqueue.resume(); // incase queue is paused
    resetPriorityReplyLimitJob();
  }, PRIORITY_RESET_LIMIT_TIME_IN_MS);
};

export const resetGithubLimitJob = () => {
  logger.info({
    message: "in github reset limit job function",
  });
  setTimeout(() => {
    logger.info({
      message: "resetting github limit",
    });
    githubCounter.resetRemaining();
    githubcreationqueue.resume(); // incase queue is paused
    resetGithubLimitJob();
  }, MENTIONS_TOKEN_CREATION_RESET_LIMIT_TIME_IN_MS);
};
