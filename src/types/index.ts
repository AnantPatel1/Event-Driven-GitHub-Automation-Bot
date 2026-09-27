// Common domain interfaces and types for GitHub Automation Bot

export type SupportedEventType = 'issues' | 'pull_request' | 'push';

export type ConditionOperator = 'contains' | 'equals' | 'starts_with';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: string;
}

export type ActionType = 'github.add_label' | 'github.comment' | 'slack.notify' | 'ai.triage';

export interface AiTriageResult {
  summary: string;
  suggestedLabel: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  priorityReason: string;
  confidence: number;
  provider: string;
}

export interface ActionDefinition {
  type: ActionType;
  label?: string;
  comment?: string;
  message?: string;
}

export interface RuleConfig {
  id: string;
  repositoryId: string;
  eventType: SupportedEventType;
  conditions: RuleCondition[];
  actions: ActionDefinition[];
  enabled: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export type EventProcessingStatus = 'PENDING' | 'PROCESSED' | 'FAILED' | 'IGNORED';

export type ActionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
  uptimeSeconds?: number;
  database?: 'connected' | 'disconnected';
  environment?: string;
}

export interface UserSummary {
  id: string;
  githubId: string;
  githubUsername: string;
  createdAt: string | Date;
}

export interface RepositorySummary {
  id: string;
  githubRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  webhookId?: string | null;
  ruleCount?: number;
  createdAt: string | Date;
}

export interface AuthUser {
  id: string;
  githubId: string;
  githubUsername: string;
  createdAt: string | Date;
}

export interface AuthMeResponse {
  authenticated: boolean;
  user?: AuthUser;
  error?: string;
}

export interface RepositoryItem {
  id?: string;
  githubRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  description?: string | null;
  isPrivate?: boolean;
  defaultBranch?: string;
  isConnected: boolean;
  webhookId?: string | null;
  ruleCount: number;
  createdAt?: string | Date;
}

export interface ConnectRepositoryResponse {
  success: boolean;
  repository: RepositorySummary;
  message?: string;
}

export interface DisconnectRepositoryResponse {
  success: boolean;
  message: string;
}

export interface RuleItem {
  id: string;
  repositoryId: string;
  repositoryName?: string;
  eventType: SupportedEventType;
  conditions: RuleCondition[];
  actions: ActionDefinition[];
  enabled: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface BotActionItem {
  id: string;
  eventId: string;
  type: ActionType;
  status: ActionStatus;
  details?: Record<string, unknown> | null;
  error?: string | null;
  attempts: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface GitHubEventItem {
  id: string;
  repositoryId?: string | null;
  repositoryName?: string | null;
  deliveryId: string;
  eventType: string;
  action?: string | null;
  status: EventProcessingStatus;
  receivedAt: string | Date;
  processedAt?: string | Date | null;
  createdAt: string | Date;
  actions: BotActionItem[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  totalActions?: number;
}

export interface PaginatedEventsResponse {
  events: GitHubEventItem[];
  pagination: PaginationMeta;
}

export interface CreateRuleDto {
  repositoryId: string;
  eventType: SupportedEventType;
  conditions: RuleCondition[];
  actions: ActionDefinition[];
  enabled?: boolean;
}

export interface SlackIntegrationItem {
  id: string;
  userId: string;
  repositoryId?: string | null;
  repositoryName?: string | null;
  channelName?: string | null;
  webhookUrlMask: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface SaveSlackIntegrationDto {
  webhookUrl: string;
  repositoryId?: string | null;
  channelName?: string | null;
}

export interface TestSlackIntegrationDto {
  webhookUrl?: string;
  integrationId?: string;
  channelName?: string | null;
}

export interface TestSlackResult {
  success: boolean;
  statusCode?: number;
  message: string;
}
