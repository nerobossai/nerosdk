import fastq from "fastq";
import type { queue } from "fastq";
import {
  IHotProfileBody,
  IMentionBody,
  IReplyBody,
  ITweetBody,
} from "../api/bot";
import { replyWorker } from "../workers/replyWorker";
import { tweetWorker } from "../workers/tweetWorker";
import { hotProfilesWorker } from "../workers/hotProfilesWorker";
import { mentionsWorker } from "../workers/mentionsWorker";
import { tokenCreationWorker } from "../workers/tokenCreationWorker";
import { priorityReplyWorker } from "../workers/priorityReplyWorker";

// create queue
export const replyqueue: queue<IReplyBody> = fastq.promise(replyWorker, 1);
export const priorityreplyqueue: queue<IReplyBody> = fastq.promise(
  priorityReplyWorker,
  1
);
export const twtqueue: queue<ITweetBody> = fastq.promise(tweetWorker, 1);
export const hotprofilesqueue: queue<IHotProfileBody> = fastq.promise(
  hotProfilesWorker,
  1
);
export const mentionsqueue: queue<IMentionBody> = fastq.promise(
  mentionsWorker,
  1
);
export const tokencreationqueue: queue<IMentionBody> = fastq.promise(
  tokenCreationWorker,
  1
);
