import { IReplyBody, ITweetBody } from "../utils/interfaces";
import { logger } from "../logger";
import { githubCounter } from "../utils/counter";
import { githubcreationqueue, priorityreplyqueue } from "../storage/queue";
import { cacheClient } from "../storage/redis";
import { getCacheKey, isOlderThanXHours } from "../utils";
import { getUserProfileByUsername } from "./hotProfilesWorker";
import { twitterClient } from "../utils/twitter";
import { TweetV2 } from "twitter-api-v2";
import { openaiclient } from "../services/gpt";
import axios from "axios";

const mentionsHourCheckReset = 0.02;

const availableTools: any = [
  {
    type: "function",
    function: {
      name: "feature_request",
      description:
        "Use this function to create new feature request in nerosdk's github repo",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "suitable title for the feature request",
          },
          description: {
            type: "string",
            description:
              "brief description about what user needs or requesting for",
          },
          tags: {
            type: "string",
            description: "comma seperated tags for the issue",
          },
        },
        required: ["title", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bug_report",
      description: "Use this function when user reports new bug in nerosdk",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "suitable title for the feature request",
          },
          description: {
            type: "string",
            description:
              "brief description about what user needs or requesting for",
          },
          tags: {
            type: "string",
            description: "comma seperated tags for the issue",
          },
        },
        required: ["title", "description"],
      },
    },
  },
];

const githubPrompt =
  "hey chatgpt, please verify if user wants to use any of the available github tools or not";

const raiseNewFeatureRequest = async (
  args: {
    title: string;
    description: string;
    tags: string;
  },
  config: ITweetBody,
  tweet: TweetV2
) => {
  try {
    const headers = {
      Authorization: `Bearer ${
        config.github_config?.from_env
          ? process.env[config.github_config.auth_token]
          : config.github_config?.auth_token
      }`,
      Accept: "application/vnd.github+json",
    };

    const labels = (args.tags || "").split(",");

    const resp = await axios.post(
      `https://api.github.com/repos/${config.github_config?.owner}/${config.github_config?.repo_name}/issues`,
      {
        title: `[FR][NEROBOT] ${args.title}`,
        body: `${args.description}\n\nIssue created via tweet: https://x.com/x/status/${tweet.id}`,
        labels: ["nerobot", ...labels.map((l) => l.trim())],
      },
      { headers }
    );

    return {
      isCreated: true,
      isError: false,
      link: resp.data.url,
      replyBody: `Feature request created successfully and devs will pick it up asap 🚀\nLink: ${resp.data.html_url}`,
    };
  } catch (err) {
    return {
      isCreated: false,
      isError: true,
    };
  }
};

const raiseBugIssueRequest = async (
  args: {
    title: string;
    description: string;
    tags: string;
  },
  config: ITweetBody,
  tweet: TweetV2
) => {
  try {
    const headers = {
      Authorization: `Bearer ${
        config.github_config?.from_env
          ? process.env[config.github_config.auth_token]
          : config.github_config?.auth_token
      }`,
      Accept: "application/vnd.github+json",
    };

    const labels = (args.tags || "").split(",");

    const resp = await axios.post(
      `https://api.github.com/repos/${config.github_config?.owner}/${config.github_config?.repo_name}/issues`,
      {
        title: `[BUG][NEROBOT] ${args.title}`,
        body: `${args.description}\n\nIssue created via tweet: https://x.com/x/status/${tweet.id}`,
        labels: ["nerobot", "bug", ...labels.map((l) => l.trim())],
      },
      { headers }
    );

    return {
      isCreated: true,
      isError: false,
      link: resp.data.url,
      replyBody: `Bug report submitted successfully and devs will fix it asap 🚀\nLink: ${resp.data.html_url}`,
    };
  } catch (err) {
    return {
      isCreated: false,
      isError: true,
    };
  }
};

const toolToFunction = {
  feature_request: raiseNewFeatureRequest,
  bug_report: raiseBugIssueRequest,
};

const verifyAndHandleGithubTasks = async (
  data: TweetV2,
  config: ITweetBody
): Promise<any> => {
  const text = data.text;

  try {
    // verify if text is related to any of the github thing?
    const messages: any = [
      {
        role: "system",
        content: githubPrompt,
      },
      {
        role: "user",
        content: text,
      },
    ];
    const completion = await openaiclient.chat.completions.create({
      messages: messages,
      model: "gpt-4o",
      tools: availableTools,
      tool_choice: "auto",
    });

    console.log(completion.choices[0].message);
    if (!completion.choices[0].message.tool_calls) {
      return {
        isCreated: false,
        isError: false,
      };
    }

    const toolConfig = completion.choices[0].message.tool_calls[0].function;
    const args = JSON.parse(toolConfig.arguments);

    console.log(
      "Tool call detected:",
      completion.choices[0].message.tool_calls[0].function
    );

    switch (toolConfig.name) {
      case "feature_request": {
        return toolToFunction.feature_request(args, config, data);
      }
      case "bug_report": {
        return toolToFunction.bug_report(args, config, data);
      }
      default: {
        return {
          isCreated: false,
          isError: false,
        };
      }
    }
  } catch (err) {
    console.error("unable to verify github tweet", err);
    return {
      isCreated: false,
      isError: true,
    };
  }
};

export const handleGithubAndReply = async (data: ITweetBody) => {
  try {
    const lastGithubMentionedCheck = getCacheKey(`lastgithubmentionedcheck`);
    let lastMentionedCheckTimestamp = await cacheClient.get(
      lastGithubMentionedCheck
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

    const userProfile = await getUserProfileByUsername(
      data.metadata.twitter_handle
    );
    const tweets = await twitterClient.v2.userMentionTimeline(userProfile.id, {
      max_results: 20,
      "media.fields": ["url", "preview_image_url"],
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
    console.log("---------Github Mentions (Unverified)---------");
    console.log(tweets?.data?.data);
    console.log("--------------------------");
    await Promise.all(
      tweets?.data?.data?.map(async (d) => {
        try {
          // check if tweet is already used for replies
          if (d.id === "1878790113574232504") return;
          const twtCacheKey = getCacheKey(`githubtwtidused${d.id}`);
          const cData = await cacheClient.get(twtCacheKey);
          if (cData) {
            console.log("tweet already used for reply - github worker");
            return;
          }

          // verify and handle airdrop mentions
          const { isCreated, link, replyBody, isError } =
            await verifyAndHandleGithubTasks(d, data);

          if (isCreated) {
            const replyInput: IReplyBody = {
              tweetId: d.id,
              text: replyBody,
              sendImage: false,
              randomImage: false,
              imageLinks: [],
              imageLink: "",
              // isNerocity: true,
            };
            priorityreplyqueue.push(replyInput);
          }

          await cacheClient.set(twtCacheKey, "github reply tweet");
        } catch (err) {
          console.log("error in generateReplyAndPost", err);
        }
      })
    );
    await cacheClient.set(lastGithubMentionedCheck, Date.now().toString());
  } catch (err) {
    console.log(err);
  }
};

export const githubWorker = async (data: ITweetBody) => {
  logger.info({
    message: "data in github queue worker",
    data,
  });
  await handleGithubAndReply(data);
  githubCounter.decrementRemaining();
  const remainingLimit = githubCounter.getRemaining();

  logger.info({
    message: "Remaining GitHub Rate Limit",
    remainingLimit,
  });

  if (remainingLimit <= 0) {
    logger.info({
      message:
        "Paused github worker from processing more data because rate limit is reached",
    });
    githubcreationqueue.pause();
  }
  githubcreationqueue.push(data);
  return;
};
