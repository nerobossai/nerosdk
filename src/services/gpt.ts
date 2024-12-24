import OpenAI from "openai";
import { ChatCompletionUserMessageParam } from "openai/resources";

const openai = new OpenAI();

// update this header
const promptConstantHeader = "";
const promptConstantFooter =
  "\n\nNote: Keep your post under 100 characters, use no emojis, no hashtags and keep everything lowercase.";

export const chatCompletion = async (
  prompt: string,
  context?: ChatCompletionUserMessageParam[]
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

  const completion = await openai.chat.completions.create({
    messages: messages,
    model: "gpt-4o",
  });
  return completion.choices[0];
};
