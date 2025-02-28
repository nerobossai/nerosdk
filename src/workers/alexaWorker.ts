import { SkillBuilders, HandlerInput, ResponseBuilder } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import { BotConfig } from '../types/config';
import { chatCompletion } from '../services/gpt';

export class AlexaWorker {
    private skill: any;
    public invocationName: string;
    private xaiConfig?: { api_key: string };
    private openaiConfig?: { api_key: string };
    private model: string;

    constructor(config: BotConfig) {
        const alexaConfig = config.details.platforms?.alexa;
        
        if (!alexaConfig) {
            throw new Error('Alexa configuration is missing');
        }

        this.invocationName = alexaConfig.invocation_name || 'nero boss';
        
        // Store AI configurations
        this.xaiConfig = config.details.xai_config?.from_env_file
            ? { api_key: process.env[config.details.xai_config.api_key] || '' }
            : { api_key: config.details.xai_config?.api_key || '' };

        this.openaiConfig = config.details.openai_config?.from_env_file
            ? { api_key: process.env[config.details.openai_config.api_key] || '' }
            : { api_key: config.details.openai_config?.api_key || '' };

        this.model = config.details.model || 'gpt-4o';

        this.skill = SkillBuilders.custom()
            .addRequestHandlers(
                this.launchRequestHandler(),
                this.neroIntentHandler(),
                this.helpIntentHandler(),
                this.stopIntentHandler()
            )
            .create();
    }

    private launchRequestHandler() {
        const invocationName = this.invocationName;
        return {
            canHandle(handlerInput: HandlerInput) {
                return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
            },
            handle(handlerInput: HandlerInput) {
                const speechText = `Welcome to ${invocationName}! How can I help you today?`;
                return handlerInput.responseBuilder
                    .speak(speechText)
                    .reprompt(speechText)
                    .withSimpleCard(invocationName, speechText)
                    .getResponse();
            }
        };
    }

    private neroIntentHandler() {
        const invocationName = this.invocationName;
        return {
            canHandle(handlerInput: HandlerInput) {
                const request = handlerInput.requestEnvelope.request;
                return request.type === 'IntentRequest'
                    && request.intent.name === 'NeroIntent';
            },
            async handle(handlerInput: HandlerInput): Promise<any> {
                const request = handlerInput.requestEnvelope.request as IntentRequest;
                const query = request.intent.slots?.query?.value;
                let response = '';

                try {
                    response = await this.generateResponse(query || '');
                } catch (error) {
                    console.error('Error generating response:', error);
                    response = "I encountered an error while processing your request.";
                }

                return handlerInput.responseBuilder
                    .speak(response)
                    .reprompt('What else would you like to know?')
                    .withSimpleCard(invocationName, response)
                    .getResponse();
            }
        };
    }

    private async generateResponse(query: string): Promise<string> {
        try {
            const completion = await chatCompletion(
                "You are nerosdk, an AI assistant. Respond helpfully but with personality. Keep responses concise and clear for voice:", 
                [{ role: "user", content: query }],
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

    private helpIntentHandler() {
        return {
            canHandle(handlerInput: HandlerInput) {
                return handlerInput.requestEnvelope.request.type === 'IntentRequest'
                    && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
            },
            handle(handlerInput: HandlerInput) {
                const speechText = 'You can ask me anything! Just start with "ask nero boss" followed by your question.';
                return handlerInput.responseBuilder
                    .speak(speechText)
                    .reprompt(speechText)
                    .withSimpleCard('Help', speechText)
                    .getResponse();
            }
        };
    }

    private stopIntentHandler() {
        return {
            canHandle(handlerInput: HandlerInput) {
                return handlerInput.requestEnvelope.request.type === 'IntentRequest'
                    && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
            },
            handle(handlerInput: HandlerInput) {
                const speechText = 'Goodbye!';
                return handlerInput.responseBuilder
                    .speak(speechText)
                    .withSimpleCard('Goodbye', speechText)
                    .getResponse();
            }
        };
    }

    public async init(): Promise<void> {
        try {
            // Verify skill configuration
            await this.skill.invoke({
                "type": "LaunchRequest"
            });
            console.log('Successfully initialized Alexa skill');
        } catch (error) {
            console.error('Failed to initialize Alexa skill:', error);
            throw error;
        }
    }
} 