import { Client, GatewayIntentBits, TextChannel, Message } from 'discord.js';
import { BotConfig } from '../types/config';
import { chatCompletion } from '../services/gpt';

export class DiscordWorker {
    private client: Client;
    private channels: string[];

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
            const prompt = "You are nerosdk, an AI assistant. Analyze the following message and respond helpfully but with a bit of sass. Keep your response concise and engaging: ";
            
            const completion = await chatCompletion(prompt, [{
                role: "user",
                content: message
            }]);

            return completion.message.content || "Sorry, I'm having trouble thinking of a response right now!";
        } catch (error) {
            console.error('Error generating response:', error);
            return "Oops, my brain had a hiccup! Try asking me again in a moment.";
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