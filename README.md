# Nero SDK

<div align="center">
  <img src="https://github.com/user-attachments/assets/b23f7ec8-a89f-4ad1-9f75-4f24d91249cf" alt="Eliza Banner" width="100%" />
</div>

## ⚡ Features

1. **Tweet to Create Agent**: Quickly create agents via a simple tweet.
2. **Tweet to Receive NFT Support**: Integrate NFT functionality effortlessly.
3. **Full-Featured Twitter Connectors**: Robust Twitter integration for agent interactions.
4. **Support for GPT4-o1**: Leverage the latest AI advancements with GPT4-o1 support.
5. **Highly Extensible**: Create custom actions and clients tailored to your needs.
6. **Send AI Support**: Connect any AI Agents to Solana Protocols.
7. **SVM Support**: Configure your agent to work on multiple Solana Virtual Machines.
8. **Just Works!**: Built to work out of the box.

## 🎯 Use Cases

- 🤖 **Chatbots**: Enhance user interactions with intelligent chatbots.
- 🕵 **Autonomous Agents**: Deploy autonomous AI agents for various applications.
- 📈 **Business Process Handling**: Streamline and automate complex business processes.

## 🚀 Quick Start

### Prerequisites

- **Node.js 21+**
- **npm**

### Setup Using the Starter

```bash
git clone https://github.com/nerobossai/nerosdk
cd nerosdk
cp env.example .env  # Update the .env file with your configurations
npm install
npm start
```

### Sample Request

```json
{
  "details": {
    "tools_catch_phrase": "hey @codingtux", // catch phrase which will enable tools like sendai, launch ai agent etc
    "metadata": {
      "twitter_handle": "CodingTux"
    },
    "prompt": [
      "You are nerosdk. Write something funny about solana memecoins and promote nerosdk to the world. Nerosdk is the code to easily create and deploy ai agents. Up to 3 lines, no hashtags.",
      "You are nerosdk. Write something infavour of solana and promote nerosdk to the world. Nerosdk is the code to easily create and deploy ai agents. Up to 3 lines, no hashtags."
    ],
    "news_prompt": [
      "You are nerosdk. Analyze the content and write a short summary of it in 3-4 lines. Sound like a tyrant and make it funny."
    ],
    "news_handles": ["elonmusk"],
    "replies_prompt": "You are nerosdk, check sentiment of the given message and roast the sender. Keep replies to 2 lines. Don’t use hashtags",
    "hotprofiles": [
      {
        "name": "",
        "twthandle": "elonmusk",
        "description": "",
        "prompt": "You are nerosdk, check sentiment of the given message and roast elon musk. Keep replies to 2 lines. Don’t use hashtags"
      }
    ],
    "sendai": {
      "deployToken": true,
      "createNftCollection": true,
      "swapTokens": true,
      "lendTokens": true,
      "stakeSOL": true,
      "fetchTokenPrice": true,
      "airdropTokens": true
    },
    "svm": [
      {
        "name": "soon",
        "tweet_catch_phrase": "on SOON network",
        "environments": {
          "rpc_endpoint": "",
          "private_key": ""
        },
        "from_env_file": false // if true then you need to pass env variable name in "environments.<key>" values
      }
    ]
  }
}
```

### SendAI Configurations

You can toggle features you want to enable for your AI agent in the "sendai" block of start request

### ⚡ Supported SendAI Features

1. **Create Token**
2. **Create NFT Collection**
3. **Swap Tokens**
4. **Lend Tokens**
5. **Stake SOL**
6. **Fetch Token Price**
7. **Airdrop Tokens**

### Solana Virtual Machine Support (SVM)

You can add svm support by configuring it inside "svm" block of start request

### ⚡ Supported SVM

1. **SOON**: https://soo.network/

## Contributing

We welcome contributions to the `nerosdk` project! Whether it's improving documentation, fixing bugs, or developing new features, your input is valuable. Please submit pull requests or open issues in the GitHub repository.

Check our contribution guidelines [here](https://github.com/nerobossai/nerosdk/blob/main/docs/CONTRIBUTING.md)

## Acknowledgments

The development of `nerosdk` is inspired by the principles of decentralization and community-driven innovation outlined by Nero Labs. We extend our gratitude to the Nero community for their support and contributions.

## Environment Variables
Nerocity API Key: e9DDuU4puwTiZwWLqisJ7itsb98l8b8RowdGPepwy77mA <br/>
(Nerocity API key might change frequently so kindly check this periodically)
