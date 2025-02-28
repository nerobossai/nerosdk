// @ts-ignore
import { Client, GatewayIntentBits, TextChannel, Message } from 'discord.js';
import { BotConfig } from '../types/config';
import { chatCompletion, ModelType } from '../services/gpt';

export class DiscordWorker {
    private client: Client;
    private channels: string[];
    private xaiConfig?: { api_key: string };
    private openaiConfig?: { api_key: string };
    private model: ModelType;

    constructor(config: BotConfig) {
        const discordConfig = config.details.platforms?.discord;
        
        if (!discordConfig) {
            throw new Error('Discord configuration is missing');
        }

        const token = discordConfig.from_env_file 
            ? process.env[discordConfig.token]
            : discordConfig.token;

        if (!token) {
            throw new Error('Discord token is not configured');
        }

        // Store AI configurations
        this.xaiConfig = config.details.xai_config?.from_env_file
            ? { api_key: process.env[config.details.xai_config.api_key] || '' }
            : { api_key: config.details.xai_config?.api_key || '' };

        this.openaiConfig = config.details.openai_config?.from_env_file
            ? { api_key: process.env[config.details.openai_config.api_key] || '' }
            : { api_key: config.details.openai_config?.api_key || '' };

        this.model = config.details.model || 'gpt-4o';

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ]
        });
        this.channels = discordConfig.channels || [];

        this.setupMessageHandler();
    }

    private setupMessageHandler(): void {
        this.client.on('messageCreate', async (message: Message) => {
            try {
                // Ignore bot messages
                if (message.author.bot) return;

                // Check if message mentions "neroboss"
                if (message.content.toLowerCase().includes('neroboss')) {
                    const response = await this.generateResponse(message.content);
                    await message.reply(response);
                }
            } catch (error) {
                console.error('Error handling Discord message:', error);
            }
        });
    }

    private async generateResponse(message: string): Promise<string> {
        try {
            const completion = await chatCompletion(
                "You are nerosdk, an AI assistant. Respond helpfully but with personality. Keep responses concise:", 
                [{ role: "user", content: message }],
                this.model,
                this.model === "grok-3" ? this.xaiConfig : undefined,
                this.openaiConfig
            );
            return completion.message.content || "I'm having trouble processing that request.";
        } catch (error) {
            console.error('Error generating response:', error);
            return "I encountered an error while processing your request.";
        }
    }

    /**
     * Initialize the Discord worker
     */
    public async init(): Promise<void> {
        try {
            await this.client.login(this.getToken());
            console.log('Successfully connected to Discord');
        } catch (error) {
            console.error('Failed to initialize Discord connection:', error);
            throw error;
        }
    }

    /**
     * Send a message to specified Discord channels
     */
    public async broadcastMessage(message: string): Promise<void> {
        for (const channelId of this.channels) {
            try {
                const channel = await this.client.channels.fetch(channelId);
                if (channel instanceof TextChannel) {
                    await channel.send(message);
                    console.log(`Message sent to Discord channel: ${channelId}`);
                }
            } catch (error) {
                console.error(`Failed to send message to channel ${channelId}:`, error);
            }
        }
    }

    /**
     * Send a message to a specific Discord channel
     */
    public async sendMessage(channelId: string, message: string): Promise<void> {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (channel instanceof TextChannel) {
                await channel.send(message);
                console.log(`Message sent to Discord channel: ${channelId}`);
            }
        } catch (error) {
            console.error(`Failed to send message to channel ${channelId}:`, error);
        }
    }

    private getToken(): string {
        const discordConfig = this.client.options.discordConfig;
        return discordConfig?.from_env_file 
            ? process.env[discordConfig.token] || ''
            : discordConfig?.token || '';
    }
} 