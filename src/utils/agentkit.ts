import { SolanaAgentKit } from "solana-agent-kit";

export const agent = new SolanaAgentKit(
  process.env.PRIVATE_KEY as string,
  process.env.RPC_URL as string,
  process.env.OPENAI_API_KEY as string
);
