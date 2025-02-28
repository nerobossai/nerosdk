import { WebClient, LogLevel } from '@slack/web-api';
import { RTMClient } from '@slack/rtm-api';
import { BotConfig } from '../types/config';
import { chatCompletion, ModelType } from '../services/gpt';

export class SlackWorker {
    private webClient: WebClient;
    private rtmClient: RTMClient;
    private channels: string[];
    private xaiConfig?: { api_key: string };
    private openaiConfig?: { api_key: string };
    private model: ModelType;

    constructor(config: BotConfig) {
        const slackConfig = config.details.platforms?.slack;
        
        if (!slackConfig) {
            throw new Error('Slack configuration is missing');
        }

        const apiKey = slackConfig.from_env_file 
            ? process.env[slackConfig.api_key]
            : slackConfig.api_key;

        if (!apiKey) {
            throw new Error('Slack API key is not configured');
        }

        this.webClient = new WebClient(apiKey, {
            logLevel: LogLevel.ERROR
        });
        this.rtmClient = new RTMClient(apiKey);
        this.channels = slackConfig.channels || [];
        
        // Store AI configurations
        this.xaiConfig = config.details.xai_config?.from_env_file
            ? { api_key: process.env[config.details.xai_config.api_key] || '' }
            : { api_key: config.details.xai_config?.api_key || '' };

        this.openaiConfig = config.details.openai_config?.from_env_file
            ? { api_key: process.env[config.details.openai_config.api_key] || '' }
            : { api_key: config.details.openai_config?.api_key || '' };

        this.model = config.details.model || 'gpt-4o';
        
        // Setup message handler
        this.setupMessageHandler();
    }

    private setupMessageHandler(): void {
        this.rtmClient.on('message', async (event) => {
            try {
                // Check if message mentions "neroboss"
                if (event.text && event.text.toLowerCase().includes('neroboss')) {
                    const response = await this.generateResponse(event.text);
                    await this.sendMessage(event.channel, response);
                }
            } catch (error) {
                console.error('Error handling message:', error);
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
     * Initialize the Slack worker
     */
    public async init(): Promise<void> {
        try {
            // Test the web client connection
            await this.webClient.auth.test();
            // Start RTM client
            await this.rtmClient.start();
            console.log('Successfully connected to Slack');
        } catch (error) {
            console.error('Failed to initialize Slack connection:', error);
            throw error;
        }
    }

    /**
     * Send a message to specified Slack channels
     */
    public async broadcastMessage(message: string): Promise<void> {
        for (const channel of this.channels) {
            try {
                await this.webClient.chat.postMessage({
                    channel,
                    text: message,
                });
                console.log(`Message sent to Slack channel: ${channel}`);
            } catch (error) {
                console.error(`Failed to send message to channel ${channel}:`, error);
            }
        }
    }

    /**
     * Send a message to a specific Slack channel
     */
    public async sendMessage(channel: string, message: string): Promise<void> {
        try {
            await this.webClient.chat.postMessage({
                channel,
                text: message,
            });
            console.log(`Message sent to Slack channel: ${channel}`);
        } catch (error) {
            console.error(`Failed to send message to channel ${channel}:`, error);
        }
    }
} 