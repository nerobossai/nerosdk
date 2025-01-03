require("dotenv").config();

import { SolanaAgentKit } from "solana-agent-kit";
import { ISvmAgentKit } from "../utils/interfaces";

export const agent = new SolanaAgentKit(
  process.env.PRIVATE_KEY as string,
  process.env.RPC_URL as string,
  process.env.OPENAI_API_KEY as string
);

export class SvmAgentKits {
  public static kits: any = {};
  public static async create(args: ISvmAgentKit) {
    if (args.name in SvmAgentKits.kits)
      throw new Error("agent kit already configured");

    SvmAgentKits.kits[args.name] = {
      raw: args,
      agent: new SolanaAgentKit(
        (args.from_env_file
          ? process.env[args.environments.private_key]
          : args.environments.private_key) as string,
        (args.from_env_file
          ? process.env[args.environments.rpc_endpoint]
          : args.environments.rpc_endpoint) as string,
        process.env.OPENAI_API_KEY as string
      ),
    };
  }

  public static getAllCatchPhrasesWithAgent() {
    const data = Object.values(SvmAgentKits.kits).map((d: any) => {
      return {
        phrase: d.raw.tweet_catch_phrase,
        agent: d.agent,
      };
    });
    return data;
  }

  public static getAgent(name: string) {
    if (!SvmAgentKits.kits[name]) return null;
    return SvmAgentKits.kits[name].agent;
  }

  public static getRaw(name: string) {
    if (!SvmAgentKits.kits[name]) return null;
    return SvmAgentKits.kits[name].raw;
  }
}
