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

export interface INFTCollection {
  name: string;
  uri: string;
  royaltyBasisPoints: number;
  creators: Array<{
    address: string;
    percentage: number;
  }>;
}

export interface ISvmAgentKit {
  name: string;
  tweet_catch_phrase: string;
  enabled: boolean;
  environments: {
    rpc_endpoint: string;
    private_key: string;
  };
  from_env_file: boolean;
}
