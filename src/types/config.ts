export interface SlackConfig {
    api_key: string;
    from_env_file: boolean;
    channels: string[];
}

export interface DiscordConfig {
    token: string;
    from_env_file: boolean;
    channels: string[];
}

export interface Platforms {
    slack?: SlackConfig;
    discord?: DiscordConfig;
}

// Add to your existing BotConfig interface:
export interface BotConfig {
    details: {
        // ... existing properties ...
        platforms?: Platforms;
    }
} 