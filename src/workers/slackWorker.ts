import { WebClient, LogLevel } from '@slack/web-api';
import { RTMClient } from '@slack/rtm-api';
import { BotConfig } from '../types/config';

export class SlackWorker {
    private webClient: WebClient;
    private rtmClient: RTMClient;
    private channels: string[];

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
        // Here you can implement your custom logic to generate responses
        // For now, returning a simple response
        return `Hey there! 👋 I noticed you mentioned me. How can I help you today?`;
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