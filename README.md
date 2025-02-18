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
8. **GitHub Support**: Allows agent to create issues, request new feature, code review etc via twitter and by itself.
9. **Slack Integration**: Interact with your AI agent directly through Slack channels.
10. **Discord Integration**: Chat with your AI agent in Discord servers and channels.
11. **Just Works!**: Built to work out of the box.

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
    "github_config": {
      "owner": "nerobossai",
      "repo_link": "https://github.com/nerobossai/nerosdk",
      "repo_name": "nerosdk",
      "available_tags": ["enhancement", "bounty", "bug"],
      "auth_token": "GITHUB_AUTH_TOKEN",
      "from_env": true
    },
    "prompt": [
      "You are nerosdk. Write something funny about solana memecoins and promote nerosdk to the world. Nerosdk is the code to easily create and deploy ai agents. Up to 3 lines, no hashtags.",
      "You are nerosdk. Write something infavour of solana and promote nerosdk to the world. Nerosdk is the code to easily create and deploy ai agents. Up to 3 lines, no hashtags."
    ],
    "news_prompt": [
      "You are nerosdk. Analyze the content and write a short summary of it in 3-4 lines. Sound like a tyrant and make it funny."
    ],
    "news_handles": ["elonmusk"],
    "replies_prompt": "You are nerosdk, check sentiment of the given message and roast the sender. Keep replies to 2 lines. Don't use hashtags",
    "hotprofiles": [
      {
        "name": "",
        "twthandle": "elonmusk",
        "description": "",
        "prompt": "You are nerosdk, check sentiment of the given message and roast elon musk. Keep replies to 2 lines. Don't use hashtags"
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
    ],
    "platforms": {
      "slack": {
        "api_key": "YOUR_SLACK_BOT_TOKEN",
        "from_env_file": true,  // if true, api_key should be an env variable name
        "channels": ["general", "ai-bot"]  // channels to monitor
      }
    }
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

### GitHub Configuration
To enable your agent to interact with github you need to set "github_config" in start request

### ⚡ Supported GitHub Features

1. **New Feature Request via Tweet**
2. **Create Bug Issue via Tweet**
3. ...more coming soon

### Slack Integration
To enable Slack integration, configure the "platforms" block in your start request:

```json
{
  "details": {
    // ... other configurations ...
    "platforms": {
      "slack": {
        "api_key": "YOUR_SLACK_BOT_TOKEN",
        "from_env_file": true,  // if true, api_key should be an env variable name
        "channels": ["general", "ai-bot"]  // channels to monitor
      }
    }
  }
}
```

### ⚡ Supported Slack Features

1. **Message Broadcasting**: Send messages to configured channels
2. **Direct Responses**: Mention "neroboss" in any channel to interact with the agent
3. **Real-time Monitoring**: Listens and responds to messages in configured channels

### Discord Integration
To enable Discord integration, configure the "platforms" block in your start request:

```json
{
  "details": {
    // ... other configurations ...
    "platforms": {
      "discord": {
        "token": "YOUR_DISCORD_BOT_TOKEN",
        "from_env_file": true,  // if true, token should be an env variable name
        "channels": ["channel-id-1", "channel-id-2"]  // channel IDs to monitor
      }
    }
  }
}
```

### ⚡ Supported Discord Features

1. **Message Broadcasting**: Send messages to configured channels
2. **Direct Responses**: Mention "neroboss" in any channel to interact with the agent
3. **Real-time Monitoring**: Listens and responds to messages in configured channels

#### Discord Setup Steps
1. Create a Discord application in the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a bot for your application and get the bot token
3. Enable the following Privileged Gateway Intents:
   - Message Content Intent
   - Server Members Intent
   - Presence Intent
4. Invite the bot to your server with proper permissions
5. Use channel IDs in the configuration (Enable Developer Mode in Discord to copy channel IDs)

## Contributing

We welcome contributions to the `nerosdk` project! Whether it's improving documentation, fixing bugs, or developing new features, your input is valuable. Please submit pull requests or open issues in the GitHub repository.

Check our contribution guidelines [here](https://github.com/nerobossai/nerosdk/blob/main/docs/CONTRIBUTING.md)

## Acknowledgments

The development of `nerosdk` is inspired by the principles of decentralization and community-driven innovation outlined by Nero Labs. We extend our gratitude to the Nero community for their support and contributions.

## Environment Variables

Nerocity API Key: e9DDuU4puwTiZwWLqisJ7itsb98l8b8RowdGPepwy77mA <br/>
(Nerocity API key might change frequently so kindly check this periodically)
