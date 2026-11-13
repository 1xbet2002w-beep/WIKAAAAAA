export type MarketCategoryId =
  | 'match_result'
  | 'handicap'
  | 'total_goals'
  | 'btts'
  | 'half_markets'
  | 'corners'
  | 'cards'
  | 'shots'
  | 'player_props'
  | 'special_markets';

export type SettlementRule =
  | '90_MINS_ONLY'
  | 'INC_EXTRA_TIME'
  | 'ASIAN_SPLIT'
  | 'FIRST_HALF_ONLY'
  | 'SECOND_HALF_ONLY'
  | 'PLAYER_MUST_START';

export type SettlementOutcome =
  | 'PENDING'
  | 'WIN'
  | 'HALF_WIN'
  | 'PUSH'
  | 'HALF_LOSS'
  | 'LOSS'
  | 'VOID';

export interface MarketCategoryMeta {
  id: MarketCategoryId;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  settlementNoteAr: string;
}

export interface MarketOption {
  id: string;
  category: MarketCategoryId;
  marketNameAr: string;
  marketNameEn: string;
  selectionAr: string;
  selectionCode: string;
  odds: number;
  previousOdds?: number;
  oddsDirection?: 'UP' | 'DOWN' | 'SAME';
  line?: number;
  isAsianSplit?: boolean;
  settlementRule: SettlementRule;
  bookmakerName: string;
  impliedProbability: number;
  updatedAt: string;
  playerName?: string;
}

export interface MarketProjectionItem {
  rank: number;
  catalogIndex: number;
  catalogNameEn: string;
  category: MarketCategoryId;
  bestSelectionAr: string;
  estimatedProbability: number;
  fairReferenceOdds: number;
  liveBookmakerOdds?: number;
  previousBookmakerOdds?: number;
  oddsDirection?: 'UP' | 'DOWN' | 'SAME';
  bookmakerName?: string;
  sourceKind: 'LIVE_BOOKMAKER' | 'FAIR_MODEL';
  settlementRule: SettlementRule;
  rationaleAr: string;
}

export interface MatchEvent {
  minute: number;
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION' | 'VAR' | 'INJURY';
  team: 'HOME' | 'AWAY';
  player: string;
  detail: string;
  isNew?: boolean;
}

export interface LiveDynamicSignal {
  id: string;
  minute: number;
  triggerType: 'TIME_DECAY' | 'GOAL_SHIFT' | 'RED_CARD_IMPACT' | 'CORNER_SURGE' | 'CARD_TENSION' | 'ODDS_STEAM';
  titleAr: string;
  descriptionAr: string;
  suggestedMarketAr: string;
  estimatedProbability: number;
  referenceOdds: number;
  isLiveBookmakerOdds: boolean;
  createdAt: string;
}

export interface LiveStats {
  possessionHome: number;
  possessionAway: number;
  shotsHome: number;
  shotsAway: number;
  shotsOnTargetHome: number;
  shotsOnTargetAway: number;
  cornersHome: number;
  cornersAway: number;
  yellowCardsHome: number;
  yellowCardsAway: number;
  redCardsHome: number;
  redCardsAway: number;
  dangerousAttacksHome: number;
  dangerousAttacksAway: number;
  substitutionsHome: number;
  substitutionsAway: number;
}

export interface TeamProfile {
  id: string;
  nameAr: string;
  nameEn: string;
  shortCode: string;
  logoUrl?: string;
  last5Form: ('W' | 'D' | 'L')[];
  avgGoalsScored: number;
  avgGoalsConceded: number;
  homeWinRate: number;
  awayWinRate: number;
  avgCornersFor: number;
  avgCardsFor: number;
  avgShotsOnTarget: number;
  expectedLineup: string[];
  confirmedLineup?: string[];
  injuries: { player: string; reason: string; impact: 'HIGH' | 'MEDIUM' | 'LOW' }[];
}

export interface MatchData {
  id: string;
  mode: 'LIVE' | 'PREMATCH';
  dateGroup: 'TODAY' | 'TOMORROW';
  teamType: 'CLUB' | 'NATIONAL';
  leagueId: string;
  leagueNameAr: string;
  leagueNameEn: string;
  leagueLogoUrl?: string;
  roundName?: string;
  venue?: string;
  countryAr: string;
  kickoffTime: string;
  status: 'LIVE_1H' | 'HT' | 'LIVE_2H' | 'NS' | 'DELAYED' | 'FT';
  minute: number | null;
  scoreHome: number | null;
  scoreAway: number | null;
  htScoreHome: number | null;
  htScoreAway: number | null;
  homeTeam: TeamProfile;
  awayTeam: TeamProfile;
  lineupConfirmed: boolean;
  h2hSummary: {
    played: number;
    homeWins: number;
    draws: number;
    awayWins: number;
    avgGoals: number;
    bttsRate: number;
  };
  liveStats?: LiveStats;
  liveEvents?: MatchEvent[];
  availableMarkets: MarketOption[];
  feedUpdatedAt: string;
  feedSource: 'API_FOOTBALL' | 'FOOTBALL_DATA' | 'ODDS_API' | 'ESPN_PUBLIC' | 'DEMO_STUDIO';
  isDemo: boolean;
  feedStale?: boolean;
  feedOutage?: boolean;
  outageReason?: string;
}

export type ModelSlotId = 'analyst_alpha' | 'analyst_beta' | 'analyst_gamma';

export type AIProviderType = 'GEMINI' | 'DEEPSEEK' | 'OPENAI_COMPATIBLE' | 'GROQ' | 'OPENROUTER';

export interface AIModelConfig {
  slotId: ModelSlotId;
  displayNameAr: string;
  roleTitleAr: string;
  provider: AIProviderType;
  modelName: string;
  endpointUrl?: string;
  enabled: boolean;
  hasCustomKey?: boolean;
  maskedCustomKey?: string;
  status: 'READY' | 'MISSING_KEY' | 'RATE_LIMITED' | 'OFFLINE';
}

export interface FootballConnectorConfig {
  id: 'api_football' | 'football_data' | 'the_odds_api' | 'espn_public';
  name: string;
  descriptionAr: string;
  baseUrl: string;
  hasKey: boolean;
  maskedKey: string;
  rateLimitDaily: number;
  requestsUsedToday: number;
  lastSyncAt: string | null;
  status: 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR' | 'RATE_LIMITED';
  lastError?: string;
}

export interface SystemSettings {
  dataSourceMode: 'REAL_API' | 'DEMO_STUDIO';
  maxDebateRounds: number;
  cacheTtlSeconds: number;
  connectors: FootballConnectorConfig[];
  aiModels: AIModelConfig[];
  geminiConfigured: boolean;
}

export interface AnalysisConfig {
  mode: 'LIVE' | 'PREMATCH';
  targetOdds: number;
  oddsTolerance: number;
  oddsMode: 'SINGLE' | 'COMBINED';
  targetProbability: number;
  maxResults: number | 'ALL';
  selectedCategories: MarketCategoryId[] | 'ALL';
  maxDebateRounds: number;
  matchIds?: string[];
}

export interface ModelMarketOpinion {
  slotId: ModelSlotId;
  modelDisplayName: string;
  providerLabel: string;
  estimatedProbability: number;
  confidenceInEvidence: number;
  stance: 'SUPPORT' | 'CAUTION' | 'REJECT';
  reasoningAr: string;
  keyEvidence: string[];
  identifiedRisks: string[];
}

export type DebateStage =
  | 'ROUND_1_INDEPENDENT'
  | 'ROUND_2_CROSS_REVIEW'
  | 'ROUND_3_DEBATE_CHALLENGE'
  | 'ROUND_4_REASSESSMENT'
  | 'FINAL_DECISION';

export interface DebateEntry {
  id: string;
  stage: DebateStage;
  roundNumber: number;
  speakerSlotId: ModelSlotId | 'AGGREGATOR';
  speakerNameAr: string;
  targetSlotId?: ModelSlotId;
  matchId: string;
  matchLabelAr: string;
  marketSelectionId?: string;
  stance: 'ANALYSIS' | 'OBJECTION' | 'COUNTER_EVIDENCE' | 'REVISION' | 'VERDICT';
  messageAr: string;
  probabilityAdjustment?: number;
  timestamp: string;
}

export interface AnalyzedPick {
  id: string;
  matchId: string;
  leagueNameAr: string;
  homeTeamAr: string;
  awayTeamAr: string;
  kickoffTime: string;
  mode: 'LIVE' | 'PREMATCH';
  liveMinute?: number | null;
  liveScore?: string | null;
  marketId: string;
  category: MarketCategoryId;
  marketNameAr: string;
  selectionAr: string;
  selectionCode: string;
  odds: number;
  bookmakerName: string;
  settlementRule: SettlementRule;
  statisticalBaselineProb: number;
  bookmakerFairProb: number;
  estimatedProbability: number;
  modelAgreement: number;
  dataQuality: number;
  evidenceStrength: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'QUALIFIED' | 'NEEDS_REVIEW' | 'DISQUALIFIED';
  qualificationReasonAr: string;
  reasonsAr: string[];
  objectionsAr: string[];
  contradictionDetected: boolean;
  isMathematicallySettled?: boolean;
  modelOpinions: ModelMarketOpinion[];
  lastUpdatedAt: string;
  isDemo: boolean;
}

export interface AccumulatorPick {
  id: string;
  legs: AnalyzedPick[];
  combinedOdds: number;
  combinedProbability: number;
  correlationAdjustedProbability: number;
  hasCorrelatedLegs: boolean;
  correlationWarningAr?: string;
  averageAgreement: number;
  minDataQuality: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface WarRoomResult {
  sessionId: string;
  createdAt: string;
  config: AnalysisConfig;
  matchesScanned: number;
  marketsAnalyzed: number;
  qualifiedCount: number;
  needsReviewCount: number;
  disqualifiedCount: number;
  missingModels: string[];
  warningsAr: string[];
  emptyReasonAr?: string;
  picks: AnalyzedPick[];
  accumulators: AccumulatorPick[];
  debateLog: DebateEntry[];
  cachedHit: boolean;
  isDemo: boolean;
}

export interface PredictionRecord {
  id: string;
  fingerprint: string;
  createdAt: string;
  matchId: string;
  leagueNameAr: string;
  homeTeamAr: string;
  awayTeamAr: string;
  kickoffTime: string;
  mode: 'LIVE' | 'PREMATCH';
  category: MarketCategoryId;
  marketNameAr: string;
  selectionAr: string;
  odds: number;
  estimatedProbability: number;
  modelAgreement: number;
  dataQuality: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  modelProbs: Record<ModelSlotId, number>;
  settlementOutcome: SettlementOutcome;
  settledAt?: string;
  settledScore?: string;
  isDemo: boolean;
  immutableHash: string;
}

export interface PerformanceMetrics {
  totalPredictions: number;
  settledCount: number;
  pendingCount: number;
  wonCount: number;
  halfWonCount: number;
  pushCount: number;
  halfLostCount: number;
  lostCount: number;
  voidCount: number;
  actualWinRate: number;
  roiPercent: number;
  brierScore: number | null;
  logLoss: number | null;
  collectiveAccuracy: number;
  perModelStats: {
    slotId: ModelSlotId;
    displayNameAr: string;
    brierScore: number | null;
    accuracyPercent: number;
    predictionsEvaluated: number;
  }[];
  byCategory: {
    category: MarketCategoryId;
    nameAr: string;
    total: number;
    won: number;
    winRate: number;
  }[];
  byLeague: {
    leagueNameAr: string;
    total: number;
    won: number;
    winRate: number;
  }[];
}
