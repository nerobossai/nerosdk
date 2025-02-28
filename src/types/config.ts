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

export interface AlexaConfig {
    invocation_name: string;
    skill_id: string;
    from_env_file: boolean;
}

export interface Platforms {
    slack?: SlackConfig;
    discord?: DiscordConfig;
    alexa?: AlexaConfig;
}

export interface AIConfig {
    api_key: string;
    from_env_file: boolean;
}

// Add to your existing BotConfig interface:
export interface BotConfig {
    details: {
        // ... existing properties ...
        model?: "gpt-4o" | "grok-3";
        xai_config?: AIConfig;
        openai_config?: AIConfig;
        platforms?: Platforms;
    }
} 