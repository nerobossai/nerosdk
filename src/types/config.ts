export interface SlackConfig {
    api_key: string;
    from_env_file: boolean;
    channels: string[];
}

export interface Platforms {
    slack?: SlackConfig;
}

// Add to your existing BotConfig interface:
export interface BotConfig {
    details: {
        // ... existing properties ...
        platforms?: Platforms;
    }
} 