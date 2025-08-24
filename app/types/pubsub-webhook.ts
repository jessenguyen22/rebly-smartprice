// Google Cloud Pub/Sub webhook types for Shopify integration

export interface ShopifyWebhookMessage {
  messageId: string;
  publishTime: any;
  topic: string;
  shopDomain: string;
  apiVersion: string;
  webhookId: string;
  eventId: string;
  triggeredAt: string;
  payload: any;
  attributes: { [key: string]: string };
}

export interface PubSubWebhookConfig {
  projectId: string;
  topicName: string;
  subscriptionName: string;
  deadLetterTopicName: string;
  serviceAccountKeyPath: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  messageId: string;
  processingTimeMs: number;
  error?: string;
  campaignsTriggered?: number;
  variantsUpdated?: number;
}

export interface PubSubHealthCheck {
  subscriptionExists: boolean;
  topicExists: boolean;
  messagesAvailable?: number;
  lastProcessedAt?: Date;
  connectionStatus: 'healthy' | 'degraded' | 'down';
}
