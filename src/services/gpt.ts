import OpenAI from "openai";
import { ChatCompletionUserMessageParam } from "openai/resources";

let openaiclient: OpenAI;

// update this header
const promptConstantHeader = "";
const promptConstantFooter =
  "\n\nNote: Keep your post under 100 characters, use no emojis, no hashtags and keep everything lowercase.";

export type ModelType = "gpt-4o" | "grok-3";

export const chatCompletion = async (
  prompt: string,
  context?: ChatCompletionUserMessageParam[],
  model: ModelType = "gpt-4o",
  xaiConfig?: { api_key: string },
  openaiConfig?: { api_key: string }
) => {
  let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: promptConstantHeader + prompt + promptConstantFooter,
    },
  ];

  if (context) {
    messages = [...messages, ...context];
  }

  if (model === "grok-3") {
    if (!xaiConfig?.api_key) {
      throw new Error("xAI API key is required for Grok model");
    }
    
    // Use xAI's API endpoint
    const response = await fetch("https://api.xai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${xaiConfig.api_key}`
      },
      body: JSON.stringify({
        messages,
        model: "grok-3"
      })
    });

    const data = await response.json();
    return { message: { content: data.choices[0].message.content } };
  }

  // Initialize OpenAI client with config
  if (!openaiclient && openaiConfig?.api_key) {
    openaiclient = new OpenAI({
      apiKey: openaiConfig.api_key
    });
  }

  if (!openaiclient) {
    throw new Error("OpenAI client not initialized");
  }

  const completion = await openaiclient.chat.completions.create({
    messages: messages,
    model: "gpt-4o",
  });
  return completion.choices[0];
};
