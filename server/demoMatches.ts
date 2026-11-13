import type { MarketOption, MatchData, SettlementRule } from '../shared/types.ts';

function mkOpt(
  id: string,
  category: MarketOption['category'],
  marketNameAr: string,
  marketNameEn: string,
  selectionAr: string,
  selectionCode: string,
  odds: number,
  settlementRule: SettlementRule,
  line?: number,
  isAsianSplit?: boolean,
  playerName?: string
): MarketOption {
  return {
    id,
    category,
    marketNameAr,
    marketNameEn,
    selectionAr,
    selectionCode,
    odds,
    line,
    isAsianSplit,
    settlementRule,
    bookmakerName: 'Pinnacle / Bet365 Feed',
    impliedProbability: Math.round((1 / odds) * 1000) / 10,
    updatedAt: new Date().toISOString(),
    playerName,
  };
}

export function createInitialDemoMatches(): MatchData[] {
  const now = new Date();
  const isoNow = now.toISOString();
  const todayLater1 = new Date(now.getTime() + 2 * 3600 * 1000).toISOString();
  const todayLater2 = new Date(now.getTime() + 4 * 3600 * 1000).toISOString();
  const tomorrow1 = new Date(now.getTime() + 22 * 3600 * 1000).toISOString();
  const tomorrow2 = new Date(now.getTime() + 25 * 3600 * 1000).toISOString();

  return [
    // ================= LIVE MATCHES (3) =================
    {
      id: 'demo-live-ars-liv',
      mode: 'LIVE',
      dateGroup: 'TODAY',
      teamType: 'CLUB',
      leagueId: 'epl',
      leagueNameAr: 'الدوري الإنجليزي الممتاز',
      leagueNameEn: 'Premier League',
      countryAr: 'إنجلترا',
      kickoffTime: new Date(now.getTime() - 68 * 60000).toISOString(),
      status: 'LIVE_2H',
      minute: 67,
      scoreHome: 1,
      scoreAway: 1,
      htScoreHome: 1,
      htScoreAway: 0,
      lineupConfirmed: true,
      homeTeam: {
        id: 'ars',
        nameAr: 'آرسنال',
        nameEn: 'Arsenal',
        shortCode: 'ARS',
        last5Form: ['W', 'W', 'D', 'W', 'W'],
        avgGoalsScored: 2.15,
        avgGoalsConceded: 0.85,
        homeWinRate: 74,
        awayWinRate: 58,
        avgCornersFor: 6.8,
        avgCardsFor: 1.9,
        avgShotsOnTarget: 6.1,
        expectedLineup: ['Raya', 'White', 'Saliba', 'Gabriel', 'Timber', 'Rice', 'Odegaard', 'Merino', 'Saka', 'Havertz', 'Martinelli'],
        confirmedLineup: ['Raya', 'White', 'Saliba', 'Gabriel', 'Timber', 'Rice', 'Odegaard', 'Merino', 'Saka', 'Havertz', 'Martinelli'],
        injuries: [{ player: 'Calafiori', reason: 'إصابة عضلية', impact: 'LOW' }],
      },
      awayTeam: {
        id: 'liv',
        nameAr: 'ليفربول',
        nameEn: 'Liverpool',
        shortCode: 'LIV',
        last5Form: ['W', 'W', 'W', 'D', 'W'],
        avgGoalsScored: 2.25,
        avgGoalsConceded: 0.92,
        homeWinRate: 78,
        awayWinRate: 64,
        avgCornersFor: 6.4,
        avgCardsFor: 1.8,
        avgShotsOnTarget: 6.5,
        expectedLineup: ['Alisson', 'Alexander-Arnold', 'Konate', 'Van Dijk', 'Robertson', 'Gravenberch', 'Mac Allister', 'Szoboszlai', 'Salah', 'Nunez', 'Diaz'],
        confirmedLineup: ['Alisson', 'Alexander-Arnold', 'Konate', 'Van Dijk', 'Robertson', 'Gravenberch', 'Mac Allister', 'Szoboszlai', 'Salah', 'Nunez', 'Diaz'],
        injuries: [{ player: 'Jota', reason: 'إصابة في الكاحل', impact: 'MEDIUM' }],
      },
      h2hSummary: { played: 10, homeWins: 3, draws: 4, awayWins: 3, avgGoals: 2.9, bttsRate: 80 },
      liveStats: {
        possessionHome: 53,
        possessionAway: 47,
        shotsHome: 13,
        shotsAway: 11,
        shotsOnTargetHome: 6,
        shotsOnTargetAway: 5,
        cornersHome: 7,
        cornersAway: 5,
        yellowCardsHome: 2,
        yellowCardsAway: 2,
        redCardsHome: 0,
        redCardsAway: 0,
        dangerousAttacksHome: 58,
        dangerousAttacksAway: 52,
        substitutionsHome: 2,
        substitutionsAway: 2,
      },
      liveEvents: [
        { minute: 19, type: 'GOAL', team: 'HOME', player: 'بوكايو ساكا', detail: 'تسديدة يسارية من داخل المنطقة' },
        { minute: 38, type: 'YELLOW_CARD', team: 'AWAY', player: 'ماك أليستر', detail: 'تدخل تكتيكي في وسط الملعب' },
        { minute: 54, type: 'GOAL', team: 'AWAY', player: 'محمد صلاح', detail: 'هجمة مرتدة سريعة' },
        { minute: 62, type: 'SUBSTITUTION', team: 'HOME', player: 'تروسارد', detail: 'دخول بدلًا من مارتينيلي' },
      ],
      availableMarkets: [
        mkOpt('m1-1x', 'match_result', 'الفرصة المزدوجة', 'Double Chance', 'آرسنال أو التعادل (1X)', '1X', 1.32, '90_MINS_ONLY'),
        mkOpt('m1-x2', 'match_result', 'الفرصة المزدوجة', 'Double Chance', 'ليفربول أو التعادل (X2)', 'X2', 1.44, '90_MINS_ONLY'),
        mkOpt('m1-dnb1', 'match_result', 'التعادل لا رهان', 'Draw No Bet', 'آرسنال (DNB)', 'DNB_HOME', 1.85, '90_MINS_ONLY'),
        mkOpt('m1-ah025', 'handicap', 'هاندكاب آسيوي', 'Asian Handicap', 'آرسنال +0.25', 'AH_HOME_+0.25', 1.42, 'ASIAN_SPLIT', 0.25, true),
        mkOpt('m1-ov25', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أكثر من 2.5 هدف', 'OVER_2.5', 1.62, '90_MINS_ONLY', 2.5),
        mkOpt('m1-ov15', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أكثر من 1.5 هدف (محسوم)', 'OVER_1.5', 1.01, '90_MINS_ONLY', 1.5),
        mkOpt('m1-un35', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أقل من 3.5 هدف', 'UNDER_3.5', 1.38, '90_MINS_ONLY', 3.5),
        mkOpt('m1-btts', 'btts', 'تسجيل الفريقين', 'BTTS', 'الفريقان يسجلان: نعم (محسوم)', 'BTTS_YES', 1.01, '90_MINS_ONLY'),
        mkOpt('m1-c135', 'corners', 'إجمالي الركنيات', 'Total Corners', 'أكثر من 13.5 ركنية', 'CORNERS_OVER_13.5', 1.45, '90_MINS_ONLY', 13.5),
        mkOpt('m1-c155', 'corners', 'إجمالي الركنيات', 'Total Corners', 'أقل من 16.5 ركنية', 'CORNERS_UNDER_16.5', 1.30, '90_MINS_ONLY', 16.5),
        mkOpt('m1-card45', 'cards', 'إجمالي البطاقات', 'Total Cards', 'أكثر من 4.5 بطاقة', 'CARDS_OVER_4.5', 1.48, '90_MINS_ONLY', 4.5),
        mkOpt('m1-sot125', 'shots', 'التسديدات على المرمى', 'Shots on Target', 'أكثر من 12.5 تسديدة على المرمى', 'SOT_OVER_12.5', 1.36, '90_MINS_ONLY', 12.5),
        mkOpt('m1-last1', 'special_markets', 'الفريق الذي يسجل آخرًا', 'Last Team to Score', 'آرسنال يسجل الهدف الأخير', 'LAST_HOME', 2.25, '90_MINS_ONLY'),
      ],
      feedUpdatedAt: isoNow,
      feedSource: 'DEMO_STUDIO',
      isDemo: true,
    },
    {
      id: 'demo-live-rma-fcb',
      mode: 'LIVE',
      dateGroup: 'TODAY',
      teamType: 'CLUB',
      leagueId: 'laliga',
      leagueNameAr: 'الدوري الإسباني',
      leagueNameEn: 'La Liga',
      countryAr: 'إسبانيا',
      kickoffTime: new Date(now.getTime() - 39 * 60000).toISOString(),
      status: 'LIVE_1H',
      minute: 38,
      scoreHome: 0,
      scoreAway: 0,
      htScoreHome: null,
      htScoreAway: null,
      lineupConfirmed: true,
      homeTeam: {
        id: 'rma',
        nameAr: 'ريال مدريد',
        nameEn: 'Real Madrid',
        shortCode: 'RMA',
        last5Form: ['W', 'W', 'W', 'L', 'W'],
        avgGoalsScored: 2.35,
        avgGoalsConceded: 0.95,
        homeWinRate: 81,
        awayWinRate: 65,
        avgCornersFor: 6.9,
        avgCardsFor: 2.1,
        avgShotsOnTarget: 6.8,
        expectedLineup: ['Courtois', 'Carvajal', 'Militao', 'Rudiger', 'Mendy', 'Valverde', 'Tchouameni', 'Bellingham', 'Rodrygo', 'Mbappe', 'Vinicius'],
        confirmedLineup: ['Courtois', 'Carvajal', 'Militao', 'Rudiger', 'Mendy', 'Valverde', 'Tchouameni', 'Bellingham', 'Rodrygo', 'Mbappe', 'Vinicius'],
        injuries: [{ player: 'Alaba', reason: 'إصابة ركبة', impact: 'MEDIUM' }],
      },
      awayTeam: {
        id: 'fcb',
        nameAr: 'برشلونة',
        nameEn: 'Barcelona',
        shortCode: 'FCB',
        last5Form: ['W', 'W', 'W', 'W', 'D'],
        avgGoalsScored: 2.55,
        avgGoalsConceded: 1.1,
        homeWinRate: 80,
        awayWinRate: 68,
        avgCornersFor: 6.6,
        avgCardsFor: 2.2,
        avgShotsOnTarget: 7.0,
        expectedLineup: ['Pena', 'Kounde', 'Cubarsi', 'Martinez', 'Balde', 'Casado', 'Pedri', 'Olmo', 'Yamal', 'Lewandowski', 'Raphinha'],
        confirmedLineup: ['Pena', 'Kounde', 'Cubarsi', 'Martinez', 'Balde', 'Casado', 'Pedri', 'Olmo', 'Yamal', 'Lewandowski', 'Raphinha'],
        injuries: [{ player: 'Ter Stegen', reason: 'إصابة طويلة', impact: 'HIGH' }],
      },
      h2hSummary: { played: 12, homeWins: 6, draws: 1, awayWins: 5, avgGoals: 3.4, bttsRate: 75 },
      liveStats: {
        possessionHome: 45,
        possessionAway: 55,
        shotsHome: 8,
        shotsAway: 7,
        shotsOnTargetHome: 4,
        shotsOnTargetAway: 3,
        cornersHome: 4,
        cornersAway: 3,
        yellowCardsHome: 1,
        yellowCardsAway: 2,
        redCardsHome: 0,
        redCardsAway: 0,
        dangerousAttacksHome: 39,
        dangerousAttacksAway: 42,
        substitutionsHome: 0,
        substitutionsAway: 0,
      },
      liveEvents: [
        { minute: 14, type: 'YELLOW_CARD', team: 'AWAY', player: 'كوبارسي', detail: 'إعاقة فينيسيوس' },
        { minute: 27, type: 'YELLOW_CARD', team: 'HOME', player: 'تشواميني', detail: 'تدخل متأخر' },
        { minute: 33, type: 'VAR', team: 'HOME', player: 'مبابي', detail: 'مراجعة تسلل وإلغاء ركلة جزاء' },
      ],
      availableMarkets: [
        mkOpt('m2-ov05', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أكثر من 0.5 هدف', 'OVER_0.5', 1.14, '90_MINS_ONLY', 0.5),
        mkOpt('m2-ov15', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أكثر من 1.5 هدف', 'OVER_1.5', 1.44, '90_MINS_ONLY', 1.5),
        mkOpt('m2-btts', 'btts', 'تسجيل الفريقين', 'BTTS', 'الفريقان يسجلان: نعم', 'BTTS_YES', 1.92, '90_MINS_ONLY'),
        mkOpt('m2-1h-un05', 'half_markets', 'أهداف الشوط الأول', '1H Goals', 'أقل من 0.5 هدف في الشوط الأول', '1H_UNDER_0.5', 1.33, 'FIRST_HALF_ONLY', 0.5),
        mkOpt('m2-c95', 'corners', 'إجمالي الركنيات', 'Total Corners', 'أكثر من 9.5 ركنية', 'CORNERS_OVER_9.5', 1.32, '90_MINS_ONLY', 9.5),
        mkOpt('m2-card55', 'cards', 'إجمالي البطاقات', 'Total Cards', 'أكثر من 5.5 بطاقة', 'CARDS_OVER_5.5', 1.36, '90_MINS_ONLY', 5.5),
        mkOpt('m2-sot105', 'shots', 'التسديدات على المرمى', 'Shots on Target', 'أكثر من 10.5 تسديدة على المرمى', 'SOT_OVER_10.5', 1.34, '90_MINS_ONLY', 10.5),
        mkOpt('m2-mbappe', 'player_props', 'مسجل هدف في أي وقت', 'Anytime Goalscorer', 'كيليان مبابي يسجل في أي وقت', 'PLAYER_GOAL_MBAPPE', 2.30, 'PLAYER_MUST_START', undefined, false, 'كيليان مبابي'),
      ],
      feedUpdatedAt: isoNow,
      feedSource: 'DEMO_STUDIO',
      isDemo: true,
    },
    {
      id: 'demo-live-hil-nas',
      mode: 'LIVE',
      dateGroup: 'TODAY',
      teamType: 'CLUB',
      leagueId: 'spl',
      leagueNameAr: 'دوري روشن السعودي',
      leagueNameEn: 'Saudi Pro League',
      countryAr: 'السعودية',
      kickoffTime: new Date(now.getTime() - 55 * 60000).toISOString(),
      status: 'LIVE_2H',
      minute: 54,
      scoreHome: 2,
      scoreAway: 0,
      htScoreHome: 1,
      htScoreAway: 0,
      lineupConfirmed: true,
      homeTeam: {
        id: 'hil',
        nameAr: 'الهلال',
        nameEn: 'Al-Hilal',
        shortCode: 'HIL',
        last5Form: ['W', 'W', 'W', 'W', 'W'],
        avgGoalsScored: 2.75,
        avgGoalsConceded: 0.72,
        homeWinRate: 88,
        awayWinRate: 76,
        avgCornersFor: 7.4,
        avgCardsFor: 1.6,
        avgShotsOnTarget: 7.2,
        expectedLineup: ['Bounou', 'Cancelo', 'Koulibaly', 'Al-Bulayhi', 'Lodi', 'Neves', 'Milinkovic-Savic', 'Malcom', 'Al-Dawsari', 'Mitrovic', 'Leonardo'],
        confirmedLineup: ['Bounou', 'Cancelo', 'Koulibaly', 'Al-Bulayhi', 'Lodi', 'Neves', 'Milinkovic-Savic', 'Malcom', 'Al-Dawsari', 'Mitrovic', 'Leonardo'],
        injuries: [],
      },
      awayTeam: {
        id: 'nas',
        nameAr: 'النصر',
        nameEn: 'Al-Nassr',
        shortCode: 'NAS',
        last5Form: ['W', 'D', 'W', 'L', 'W'],
        avgGoalsScored: 2.2,
        avgGoalsConceded: 1.15,
        homeWinRate: 74,
        awayWinRate: 62,
        avgCornersFor: 6.1,
        avgCardsFor: 2.3,
        avgShotsOnTarget: 6.0,
        expectedLineup: ['Bento', 'Al-Ghannam', 'Simakan', 'Laporte', 'Boushal', 'Brozovic', 'Al-Khaibari', 'Otavio', 'Mane', 'Talisca', 'Ronaldo'],
        confirmedLineup: ['Bento', 'Al-Ghannam', 'Simakan', 'Laporte', 'Boushal', 'Brozovic', 'Al-Khaibari', 'Otavio', 'Mane', 'Talisca', 'Ronaldo'],
        injuries: [],
      },
      h2hSummary: { played: 10, homeWins: 6, draws: 2, awayWins: 2, avgGoals: 3.1, bttsRate: 60 },
      liveStats: {
        possessionHome: 59,
        possessionAway: 41,
        shotsHome: 12,
        shotsAway: 6,
        shotsOnTargetHome: 6,
        shotsOnTargetAway: 2,
        cornersHome: 6,
        cornersAway: 2,
        yellowCardsHome: 1,
        yellowCardsAway: 3,
        redCardsHome: 0,
        redCardsAway: 0,
        dangerousAttacksHome: 54,
        dangerousAttacksAway: 29,
        substitutionsHome: 1,
        substitutionsAway: 2,
      },
      liveEvents: [
        { minute: 22, type: 'GOAL', team: 'HOME', player: 'ميتروفيتش', detail: 'رأسية متقنة داخل الصندوق' },
        { minute: 49, type: 'GOAL', team: 'HOME', player: 'سالم الدوسري', detail: 'انطلاقة فردية وتسديدة قوية' },
      ],
      availableMarkets: [
        mkOpt('m3-1', 'match_result', 'نتيجة المباراة', 'Match Result', 'فوز الهلال (1)', '1', 1.12, '90_MINS_ONLY'),
        mkOpt('m3-1x', 'match_result', 'الفرصة المزدوجة', 'Double Chance', 'الهلال أو التعادل (1X)', '1X', 1.04, '90_MINS_ONLY'),
        mkOpt('m3-ah-125', 'handicap', 'هاندكاب آسيوي', 'Asian Handicap', 'الهلال -1.25', 'AH_HOME_-1.25', 1.31, 'ASIAN_SPLIT', -1.25, true),
        mkOpt('m3-ov25', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أكثر من 2.5 هدف', 'OVER_2.5', 1.34, '90_MINS_ONLY', 2.5),
        mkOpt('m3-c105', 'corners', 'إجمالي الركنيات', 'Total Corners', 'أكثر من 10.5 ركنية', 'CORNERS_OVER_10.5', 1.35, '90_MINS_ONLY', 10.5),
        mkOpt('m3-btts-no', 'btts', 'تسجيل الفريقين', 'BTTS', 'الفريقان يسجلان: لا', 'BTTS_NO', 1.68, '90_MINS_ONLY'),
      ],
      feedUpdatedAt: isoNow,
      feedSource: 'DEMO_STUDIO',
      isDemo: true,
    },

    // ================= PREMATCH MATCHES (5) =================
    {
      id: 'demo-pre-mci-psg',
      mode: 'PREMATCH',
      dateGroup: 'TODAY',
      teamType: 'CLUB',
      leagueId: 'ucl',
      leagueNameAr: 'دوري أبطال أوروبا',
      leagueNameEn: 'UEFA Champions League',
      countryAr: 'أوروبا',
      kickoffTime: todayLater1,
      status: 'NS',
      minute: null,
      scoreHome: null,
      scoreAway: null,
      htScoreHome: null,
      htScoreAway: null,
      lineupConfirmed: true,
      homeTeam: {
        id: 'mci',
        nameAr: 'مانشستر سيتي',
        nameEn: 'Manchester City',
        shortCode: 'MCI',
        last5Form: ['W', 'W', 'D', 'W', 'W'],
        avgGoalsScored: 2.45,
        avgGoalsConceded: 0.9,
        homeWinRate: 82,
        awayWinRate: 64,
        avgCornersFor: 7.8,
        avgCardsFor: 1.5,
        avgShotsOnTarget: 6.9,
        expectedLineup: ['Ederson', 'Walker', 'Dias', 'Gvardiol', 'Ake', 'Kovacic', 'De Bruyne', 'Foden', 'Savinho', 'Doku', 'Haaland'],
        confirmedLineup: ['Ederson', 'Walker', 'Dias', 'Gvardiol', 'Ake', 'Kovacic', 'De Bruyne', 'Foden', 'Savinho', 'Doku', 'Haaland'],
        injuries: [{ player: 'Rodri', reason: 'إصابة ركبة', impact: 'HIGH' }],
      },
      awayTeam: {
        id: 'psg',
        nameAr: 'باريس سان جيرمان',
        nameEn: 'Paris Saint-Germain',
        shortCode: 'PSG',
        last5Form: ['W', 'D', 'W', 'W', 'L'],
        avgGoalsScored: 2.15,
        avgGoalsConceded: 1.15,
        homeWinRate: 79,
        awayWinRate: 61,
        avgCornersFor: 6.5,
        avgCardsFor: 2.0,
        avgShotsOnTarget: 6.3,
        expectedLineup: ['Donnarumma', 'Hakimi', 'Marquinhos', 'Pacho', 'Mendes', 'Vitinha', 'Neves', 'Zaire-Emery', 'Dembele', 'Barcola', 'Ramos'],
        confirmedLineup: ['Donnarumma', 'Hakimi', 'Marquinhos', 'Pacho', 'Mendes', 'Vitinha', 'Neves', 'Zaire-Emery', 'Dembele', 'Barcola', 'Ramos'],
        injuries: [{ player: 'Hernandez', reason: 'غير جاهز بدنيًا', impact: 'LOW' }],
      },
      h2hSummary: { played: 7, homeWins: 4, draws: 1, awayWins: 2, avgGoals: 2.85, bttsRate: 71 },
      availableMarkets: [
        mkOpt('p1-1', 'match_result', 'نتيجة المباراة', 'Match Result', 'فوز مانشستر سيتي (1)', '1', 1.64, '90_MINS_ONLY'),
        mkOpt('p1-1x', 'match_result', 'الفرصة المزدوجة', 'Double Chance', 'مانشستر سيتي أو التعادل (1X)', '1X', 1.22, '90_MINS_ONLY'),
        mkOpt('p1-dnb1', 'match_result', 'التعادل لا رهان', 'Draw No Bet', 'مانشستر سيتي (DNB)', 'DNB_HOME', 1.29, '90_MINS_ONLY'),
        mkOpt('p1-ah-075', 'handicap', 'هاندكاب آسيوي', 'Asian Handicap', 'مانشستر سيتي -0.75', 'AH_HOME_-0.75', 1.82, 'ASIAN_SPLIT', -0.75, true),
        mkOpt('p1-ov15', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أكثر من 1.5 هدف', 'OVER_1.5', 1.24, '90_MINS_ONLY', 1.5),
        mkOpt('p1-ov25', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أكثر من 2.5 هدف', 'OVER_2.5', 1.66, '90_MINS_ONLY', 2.5),
        mkOpt('p1-btts', 'btts', 'تسجيل الفريقين', 'BTTS', 'الفريقان يسجلان: نعم', 'BTTS_YES', 1.68, '90_MINS_ONLY'),
        mkOpt('p1-1h-ov05', 'half_markets', 'أهداف الشوط الأول', '1H Goals', 'أكثر من 0.5 هدف في الشوط الأول', '1H_OVER_0.5', 1.31, 'FIRST_HALF_ONLY', 0.5),
        mkOpt('p1-c95', 'corners', 'إجمالي الركنيات', 'Total Corners', 'أكثر من 9.5 ركنية', 'CORNERS_OVER_9.5', 1.52, '90_MINS_ONLY', 9.5),
        mkOpt('p1-c-home', 'corners', 'الأكثر ركنيات', 'Most Corners', 'مانشستر سيتي الأكثر ركنيات', 'MOST_CORNERS_HOME', 1.34, '90_MINS_ONLY'),
        mkOpt('p1-card35', 'cards', 'إجمالي البطاقات', 'Total Cards', 'أكثر من 3.5 بطاقة', 'CARDS_OVER_3.5', 1.44, '90_MINS_ONLY', 3.5),
        mkOpt('p1-sot95', 'shots', 'التسديدات على المرمى', 'Shots on Target', 'أكثر من 9.5 تسديدة على المرمى', 'SOT_OVER_9.5', 1.58, '90_MINS_ONLY', 9.5),
        mkOpt('p1-haaland', 'player_props', 'مسجل هدف في أي وقت', 'Anytime Goalscorer', 'إيرلينغ هالاند يسجل في أي وقت', 'PLAYER_GOAL_HAALAND', 1.72, 'PLAYER_MUST_START', undefined, false, 'إيرلينغ هالاند'),
        mkOpt('p1-cs-21', 'special_markets', 'النتيجة الصحيحة', 'Correct Score', 'فوز مانشستر سيتي 2-1', 'CS_2_1', 7.80, '90_MINS_ONLY'),
      ],
      feedUpdatedAt: isoNow,
      feedSource: 'DEMO_STUDIO',
      isDemo: true,
    },
    {
      id: 'demo-pre-bay-lev',
      mode: 'PREMATCH',
      dateGroup: 'TODAY',
      teamType: 'CLUB',
      leagueId: 'bundesliga',
      leagueNameAr: 'الدوري الألماني',
      leagueNameEn: 'Bundesliga',
      countryAr: 'ألمانيا',
      kickoffTime: todayLater2,
      status: 'NS',
      minute: null,
      scoreHome: null,
      scoreAway: null,
      htScoreHome: null,
      htScoreAway: null,
      lineupConfirmed: false,
      homeTeam: {
        id: 'bay',
        nameAr: 'بايرن ميونخ',
        nameEn: 'Bayern Munich',
        shortCode: 'BAY',
        last5Form: ['W', 'W', 'W', 'D', 'W'],
        avgGoalsScored: 2.65,
        avgGoalsConceded: 0.95,
        homeWinRate: 84,
        awayWinRate: 67,
        avgCornersFor: 7.2,
        avgCardsFor: 1.7,
        avgShotsOnTarget: 7.4,
        expectedLineup: ['Neuer', 'Laimer', 'Upamecano', 'Kim', 'Davies', 'Kimmich', 'Pavlovic', 'Olise', 'Musiala', 'Coman', 'Kane'],
        injuries: [{ player: 'Ito', reason: 'إصابة قدم', impact: 'LOW' }],
      },
      awayTeam: {
        id: 'lev',
        nameAr: 'باير ليفركوزن',
        nameEn: 'Bayer Leverkusen',
        shortCode: 'LEV',
        last5Form: ['W', 'D', 'W', 'W', 'W'],
        avgGoalsScored: 2.2,
        avgGoalsConceded: 1.1,
        homeWinRate: 76,
        awayWinRate: 68,
        avgCornersFor: 6.0,
        avgCardsFor: 2.1,
        avgShotsOnTarget: 5.9,
        expectedLineup: ['Hradecky', 'Tapsoba', 'Tah', 'Hincapie', 'Frimpong', 'Xhaka', 'Andrich', 'Grimaldo', 'Wirtz', 'Terrier', 'Boniface'],
        injuries: [{ player: 'Adli', reason: 'إصابة عضلية', impact: 'MEDIUM' }],
      },
      h2hSummary: { played: 8, homeWins: 3, draws: 3, awayWins: 2, avgGoals: 3.1, bttsRate: 75 },
      availableMarkets: [
        mkOpt('p2-ov15', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أكثر من 1.5 هدف', 'OVER_1.5', 1.18, '90_MINS_ONLY', 1.5),
        mkOpt('p2-ov25', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أكثر من 2.5 هدف', 'OVER_2.5', 1.48, '90_MINS_ONLY', 2.5),
        mkOpt('p2-btts', 'btts', 'تسجيل الفريقين', 'BTTS', 'الفريقان يسجلان: نعم', 'BTTS_YES', 1.50, '90_MINS_ONLY'),
        mkOpt('p2-1x', 'match_result', 'الفرصة المزدوجة', 'Double Chance', 'بايرن ميونخ أو التعادل (1X)', '1X', 1.28, '90_MINS_ONLY'),
        mkOpt('p2-ah0', 'handicap', 'هاندكاب آسيوي', 'Asian Handicap', 'بايرن ميونخ 0.0 (DNB)', 'AH_HOME_0', 1.38, 'ASIAN_SPLIT', 0),
        mkOpt('p2-1h-ov05', 'half_markets', 'أهداف الشوط الأول', '1H Goals', 'أكثر من 0.5 هدف في الشوط الأول', '1H_OVER_0.5', 1.29, 'FIRST_HALF_ONLY', 0.5),
        mkOpt('p2-c85', 'corners', 'إجمالي الركنيات', 'Total Corners', 'أكثر من 8.5 ركنية', 'CORNERS_OVER_8.5', 1.33, '90_MINS_ONLY', 8.5),
        mkOpt('p2-kane', 'player_props', 'تسديدات اللاعب على المرمى', 'Player Shots on Target', 'هاري كين +1.5 تسديدة على المرمى', 'PLAYER_SOT_KANE_1.5', 1.55, 'PLAYER_MUST_START', 1.5, false, 'هاري كين'),
      ],
      feedUpdatedAt: isoNow,
      feedSource: 'DEMO_STUDIO',
      isDemo: true,
    },
    {
      id: 'demo-pre-int-juv',
      mode: 'PREMATCH',
      dateGroup: 'TODAY',
      teamType: 'CLUB',
      leagueId: 'seriea',
      leagueNameAr: 'الدوري الإيطالي',
      leagueNameEn: 'Serie A',
      countryAr: 'إيطاليا',
      kickoffTime: todayLater2,
      status: 'NS',
      minute: null,
      scoreHome: null,
      scoreAway: null,
      htScoreHome: null,
      htScoreAway: null,
      lineupConfirmed: true,
      homeTeam: {
        id: 'int',
        nameAr: 'إنتر ميلان',
        nameEn: 'Inter Milan',
        shortCode: 'INT',
        last5Form: ['W', 'W', 'D', 'W', 'W'],
        avgGoalsScored: 2.1,
        avgGoalsConceded: 0.78,
        homeWinRate: 80,
        awayWinRate: 66,
        avgCornersFor: 6.4,
        avgCardsFor: 1.9,
        avgShotsOnTarget: 5.8,
        expectedLineup: ['Sommer', 'Pavard', 'Acerbi', 'Bastoni', 'Dumfries', 'Barella', 'Calhanoglu', 'Mkhitaryan', 'Dimarco', 'Thuram', 'Martinez'],
        confirmedLineup: ['Sommer', 'Pavard', 'Acerbi', 'Bastoni', 'Dumfries', 'Barella', 'Calhanoglu', 'Mkhitaryan', 'Dimarco', 'Thuram', 'Martinez'],
        injuries: [],
      },
      awayTeam: {
        id: 'juv',
        nameAr: 'يوفنتوس',
        nameEn: 'Juventus',
        shortCode: 'JUV',
        last5Form: ['D', 'W', 'D', 'W', 'D'],
        avgGoalsScored: 1.45,
        avgGoalsConceded: 0.72,
        homeWinRate: 66,
        awayWinRate: 54,
        avgCornersFor: 5.1,
        avgCardsFor: 2.2,
        avgShotsOnTarget: 4.5,
        expectedLineup: ['Di Gregorio', 'Cambiaso', 'Gatti', 'Kalulu', 'Cabal', 'Locatelli', 'Thuram', 'Conceicao', 'Koopmeiners', 'Yildiz', 'Vlahovic'],
        confirmedLineup: ['Di Gregorio', 'Cambiaso', 'Gatti', 'Kalulu', 'Cabal', 'Locatelli', 'Thuram', 'Conceicao', 'Koopmeiners', 'Yildiz', 'Vlahovic'],
        injuries: [{ player: 'Bremer', reason: 'إصابة رباط صليبي', impact: 'HIGH' }],
      },
      h2hSummary: { played: 10, homeWins: 4, draws: 4, awayWins: 2, avgGoals: 2.0, bttsRate: 50 },
      availableMarkets: [
        mkOpt('p3-1x', 'match_result', 'الفرصة المزدوجة', 'Double Chance', 'إنتر ميلان أو التعادل (1X)', '1X', 1.25, '90_MINS_ONLY'),
        mkOpt('p3-un35', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أقل من 3.5 هدف', 'UNDER_3.5', 1.27, '90_MINS_ONLY', 3.5),
        mkOpt('p3-un25', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أقل من 2.5 هدف', 'UNDER_2.5', 1.72, '90_MINS_ONLY', 2.5),
        mkOpt('p3-card45', 'cards', 'إجمالي البطاقات', 'Total Cards', 'أكثر من 4.5 بطاقة', 'CARDS_OVER_4.5', 1.62, '90_MINS_ONLY', 4.5),
        mkOpt('p3-ht-x', 'half_markets', 'نتيجة الشوط الأول', '1H Result', 'تعادل الشوط الأول (X)', '1H_X', 2.08, 'FIRST_HALF_ONLY'),
        mkOpt('p3-ah+05', 'handicap', 'هاندكاب آسيوي', 'Asian Handicap', 'يوفنتوس +1.5', 'AH_AWAY_+1.5', 1.26, 'ASIAN_SPLIT', 1.5),
      ],
      feedUpdatedAt: isoNow,
      feedSource: 'DEMO_STUDIO',
      isDemo: true,
    },
    {
      id: 'demo-pre-ahly-zam',
      mode: 'PREMATCH',
      dateGroup: 'TOMORROW',
      teamType: 'CLUB',
      leagueId: 'egy',
      leagueNameAr: 'الدوري المصري الممتاز',
      leagueNameEn: 'Egyptian Premier League',
      countryAr: 'مصر',
      kickoffTime: tomorrow1,
      status: 'NS',
      minute: null,
      scoreHome: null,
      scoreAway: null,
      htScoreHome: null,
      htScoreAway: null,
      lineupConfirmed: false,
      homeTeam: {
        id: 'ahl',
        nameAr: 'الأهلي',
        nameEn: 'Al Ahly',
        shortCode: 'AHL',
        last5Form: ['W', 'W', 'W', 'D', 'W'],
        avgGoalsScored: 2.05,
        avgGoalsConceded: 0.65,
        homeWinRate: 83,
        awayWinRate: 70,
        avgCornersFor: 6.7,
        avgCardsFor: 1.8,
        avgShotsOnTarget: 6.1,
        expectedLineup: ['El-Shenawy', 'Hany', 'Rabi', 'Ibrahim', 'Attiat-Allah', 'Attia', 'Ashour', 'Afsha', 'El-Shahat', 'Wessam', 'Taher'],
        injuries: [],
      },
      awayTeam: {
        id: 'zam',
        nameAr: 'الزمالك',
        nameEn: 'Zamalek',
        shortCode: 'ZAM',
        last5Form: ['W', 'D', 'W', 'L', 'W'],
        avgGoalsScored: 1.6,
        avgGoalsConceded: 1.0,
        homeWinRate: 71,
        awayWinRate: 56,
        avgCornersFor: 5.5,
        avgCardsFor: 2.4,
        avgShotsOnTarget: 5.0,
        expectedLineup: ['Awwad', 'Gaber', 'Mathlouthi', 'Abdelmaguid', 'Fatouh', 'Dunga', 'Maher', 'Saeed', 'Zizo', 'Mansi', 'Shalaby'],
        injuries: [{ player: 'El-Wensh', reason: 'تأهيل بدني', impact: 'MEDIUM' }],
      },
      h2hSummary: { played: 10, homeWins: 6, draws: 2, awayWins: 2, avgGoals: 2.4, bttsRate: 50 },
      availableMarkets: [
        mkOpt('p4-1x', 'match_result', 'الفرصة المزدوجة', 'Double Chance', 'الأهلي أو التعادل (1X)', '1X', 1.24, '90_MINS_ONLY'),
        mkOpt('p4-dnb1', 'match_result', 'التعادل لا رهان', 'Draw No Bet', 'الأهلي (DNB)', 'DNB_HOME', 1.38, '90_MINS_ONLY'),
        mkOpt('p4-un35', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أقل من 3.5 هدف', 'UNDER_3.5', 1.28, '90_MINS_ONLY', 3.5),
        mkOpt('p4-card45', 'cards', 'إجمالي البطاقات', 'Total Cards', 'أكثر من 4.5 بطاقة', 'CARDS_OVER_4.5', 1.42, '90_MINS_ONLY', 4.5),
        mkOpt('p4-c85', 'corners', 'إجمالي الركنيات', 'Total Corners', 'أكثر من 8.5 ركنية', 'CORNERS_OVER_8.5', 1.40, '90_MINS_ONLY', 8.5),
      ],
      feedUpdatedAt: isoNow,
      feedSource: 'DEMO_STUDIO',
      isDemo: true,
    },
    {
      id: 'demo-pre-atm-bil',
      mode: 'PREMATCH',
      dateGroup: 'TOMORROW',
      teamType: 'CLUB',
      leagueId: 'laliga',
      leagueNameAr: 'الدوري الإسباني',
      leagueNameEn: 'La Liga',
      countryAr: 'إسبانيا',
      kickoffTime: tomorrow2,
      status: 'NS',
      minute: null,
      scoreHome: null,
      scoreAway: null,
      htScoreHome: null,
      htScoreAway: null,
      lineupConfirmed: false,
      homeTeam: {
        id: 'atm',
        nameAr: 'أتلتيكو مدريد',
        nameEn: 'Atletico Madrid',
        shortCode: 'ATM',
        last5Form: ['W', 'D', 'W', 'W', 'L'],
        avgGoalsScored: 1.8,
        avgGoalsConceded: 0.85,
        homeWinRate: 77,
        awayWinRate: 52,
        avgCornersFor: 5.9,
        avgCardsFor: 2.3,
        avgShotsOnTarget: 5.1,
        expectedLineup: ['Oblak', 'Llorente', 'Gimenez', 'Lenglet', 'Galan', 'Barrios', 'Koke', 'Gallagher', 'Simeone', 'Griezmann', 'Alvarez'],
        injuries: [],
      },
      awayTeam: {
        id: 'bil',
        nameAr: 'أتلتيك بلباو',
        nameEn: 'Athletic Bilbao',
        shortCode: 'ATH',
        last5Form: ['W', 'W', 'D', 'W', 'D'],
        avgGoalsScored: 1.65,
        avgGoalsConceded: 0.9,
        homeWinRate: 73,
        awayWinRate: 50,
        avgCornersFor: 5.8,
        avgCardsFor: 2.2,
        avgShotsOnTarget: 4.9,
        expectedLineup: ['Simon', 'De Marcos', 'Vivian', 'Paredes', 'Yuri', 'Jauregizar', 'Ruiz de Galarreta', 'I.Williams', 'Sancet', 'N.Williams', 'Guruzeta'],
        injuries: [],
      },
      h2hSummary: { played: 10, homeWins: 5, draws: 2, awayWins: 3, avgGoals: 2.1, bttsRate: 40 },
      availableMarkets: [
        mkOpt('p5-un35', 'total_goals', 'إجمالي الأهداف', 'Total Goals', 'أقل من 3.5 هدف', 'UNDER_3.5', 1.26, '90_MINS_ONLY', 3.5),
        mkOpt('p5-1x', 'match_result', 'الفرصة المزدوجة', 'Double Chance', 'أتلتيكو أو التعادل (1X)', '1X', 1.31, '90_MINS_ONLY'),
        mkOpt('p5-home-ov05', 'total_goals', 'أهداف الفريق المضيف', 'Home Team Goals', 'أتلتيكو يسجل +0.5 هدف', 'HOME_OVER_0.5', 1.24, '90_MINS_ONLY', 0.5),
        mkOpt('p5-card45', 'cards', 'إجمالي البطاقات', 'Total Cards', 'أكثر من 4.5 بطاقة', 'CARDS_OVER_4.5', 1.46, '90_MINS_ONLY', 4.5),
        mkOpt('p5-win-nil', 'special_markets', 'الفوز بشباك نظيفة', 'Win to Nil', 'أتلتيكو يفوز دون استقبال هدف', 'HOME_WIN_TO_NIL', 2.95, '90_MINS_ONLY'),
      ],
      feedUpdatedAt: isoNow,
      feedSource: 'DEMO_STUDIO',
      isDemo: true,
    },
  ];
}

/**
 * Advances LIVE demo matches deterministically on ?live=true polls:
 * - Advances match clock & transitions 1H -> HT -> 2H
 * - Accumulates live stats (shots, corners, dangerous attacks, cards, subs)
 * - Emits new match events (GOAL, YELLOW_CARD, SUBSTITUTION, VAR) marked isNew: true
 * - Proposes new higher Over/Under lines when old lines settle and recalculates live odds + UP/DOWN ticks
 */
export function tickDemoLiveMatches(matches: MatchData[]): void {
  const nowIso = new Date().toISOString();

  for (const m of matches) {
    if (m.mode !== 'LIVE' || m.status === 'FT') continue;
    m.feedUpdatedAt = nowIso;

    const currentMin = m.minute ?? 1;
    const nextMin = currentMin < 90 ? currentMin + 1 : 90;
    m.minute = nextMin;

    if (nextMin >= 90) {
      m.status = 'FT';
      if (m.htScoreHome === null) m.htScoreHome = m.scoreHome ?? 0;
      if (m.htScoreAway === null) m.htScoreAway = m.scoreAway ?? 0;
      continue;
    }

    if (nextMin === 45 && m.status === 'LIVE_1H') {
      m.status = 'HT';
      if (m.htScoreHome === null) m.htScoreHome = m.scoreHome ?? 0;
      if (m.htScoreAway === null) m.htScoreAway = m.scoreAway ?? 0;
    } else if (nextMin >= 46 && (m.status === 'LIVE_1H' || m.status === 'HT')) {
      m.status = 'LIVE_2H';
      if (m.htScoreHome === null) m.htScoreHome = m.scoreHome ?? 0;
      if (m.htScoreAway === null) m.htScoreAway = m.scoreAway ?? 0;
    }

    if (!m.liveStats) {
      m.liveStats = {
        possessionHome: 50,
        possessionAway: 50,
        shotsHome: 4,
        shotsAway: 4,
        shotsOnTargetHome: 2,
        shotsOnTargetAway: 2,
        cornersHome: 2,
        cornersAway: 2,
        yellowCardsHome: 0,
        yellowCardsAway: 0,
        redCardsHome: 0,
        redCardsAway: 0,
        dangerousAttacksHome: 18,
        dangerousAttacksAway: 18,
        substitutionsHome: 0,
        substitutionsAway: 0,
      };
    }

    if (!m.liveEvents) m.liveEvents = [];
    // Age out old isNew markers
    for (const ev of m.liveEvents) {
      if (ev.isNew && nextMin - ev.minute > 2) {
        ev.isNew = false;
      }
    }

    // Advance live stats organically with match time
    if (nextMin < 90 || currentMin < 90) {
      m.liveStats.dangerousAttacksHome += nextMin % 2 === 0 ? 2 : 1;
      m.liveStats.dangerousAttacksAway += nextMin % 2 === 1 ? 2 : 1;
      if (nextMin % 3 === 0) m.liveStats.shotsHome += 1;
      if (nextMin % 4 === 0) m.liveStats.shotsAway += 1;
      if (nextMin % 5 === 0) m.liveStats.cornersHome += 1;
      if (nextMin % 6 === 0) m.liveStats.cornersAway += 1;
      if (nextMin % 7 === 0) m.liveStats.shotsOnTargetHome += 1;
      if (nextMin % 8 === 0) m.liveStats.shotsOnTargetAway += 1;
    }

    const alreadyAtMinute = m.liveEvents.some((e) => e.minute === nextMin);
    let goalScoredNow = false;

    if (!alreadyAtMinute && nextMin < 90) {
      const homeStar = m.homeTeam.confirmedLineup?.[9] || m.homeTeam.expectedLineup?.[9] || m.homeTeam.nameAr;
      const awayStar = m.awayTeam.confirmedLineup?.[9] || m.awayTeam.expectedLineup?.[9] || m.awayTeam.nameAr;

      if (nextMin % 13 === 0) {
        // Dynamic Live Goal
        const homeScores = nextMin % 2 === 1;
        if (homeScores) {
          m.scoreHome = (m.scoreHome ?? 0) + 1;
          m.liveStats.shotsOnTargetHome += 1;
        } else {
          m.scoreAway = (m.scoreAway ?? 0) + 1;
          m.liveStats.shotsOnTargetAway += 1;
        }
        m.liveEvents.push({
          minute: nextMin,
          type: 'GOAL',
          team: homeScores ? 'HOME' : 'AWAY',
          player: homeScores ? homeStar : awayStar,
          detail: 'هدف مباشر حي يغيّر تسعير الأسواق والخطوط',
          isNew: true,
        });
        goalScoredNow = true;
      } else if (nextMin % 11 === 0) {
        const isHomeCard = nextMin % 2 === 0;
        if (isHomeCard) m.liveStats.yellowCardsHome += 1;
        else m.liveStats.yellowCardsAway += 1;
        m.liveEvents.push({
          minute: nextMin,
          type: 'YELLOW_CARD',
          team: isHomeCard ? 'HOME' : 'AWAY',
          player: isHomeCard ? m.homeTeam.expectedLineup?.[5] || 'لاعب الوسط' : m.awayTeam.expectedLineup?.[5] || 'لاعب الوسط',
          detail: 'إنذار مباشر لتدخل تكتيكي',
          isNew: true,
        });
      } else if (nextMin >= 58 && nextMin % 9 === 0) {
        const isHomeSub = nextMin % 2 === 1;
        if (isHomeSub) m.liveStats.substitutionsHome += 1;
        else m.liveStats.substitutionsAway += 1;
        m.liveEvents.push({
          minute: nextMin,
          type: 'SUBSTITUTION',
          team: isHomeSub ? 'HOME' : 'AWAY',
          player: isHomeSub ? 'تبديل هجومي' : 'تبديل تنشيطي',
          detail: 'ضخ دماء جديدة في الثلث الهجومي',
          isNew: true,
        });
      } else if (nextMin % 17 === 0) {
        m.liveEvents.push({
          minute: nextMin,
          type: 'VAR',
          team: 'HOME',
          player: 'غرفة الفيديو VAR',
          detail: 'فحص سريع لحالة داخل منطقة الجزاء — استمرار اللعب',
          isNew: true,
        });
      }
    }

    const totalGoals = (m.scoreHome ?? 0) + (m.scoreAway ?? 0);
    const totalCorners = m.liveStats.cornersHome + m.liveStats.cornersAway;

    // Propose a fresh dynamic Over/Under line if goals reached or exceeded active lines
    if (goalScoredNow) {
      const nextLine = totalGoals + 0.5;
      const hasNextOver = m.availableMarkets.some((o) => o.selectionCode === `OVER_${nextLine}`);
      if (!hasNextOver) {
        m.availableMarkets.push(
          mkOpt(
            `${m.id}-ov-${nextLine}`,
            'total_goals',
            'إجمالي الأهداف',
            'Total Goals',
            `أكثر من ${nextLine} هدف`,
            `OVER_${nextLine}`,
            1.58,
            '90_MINS_ONLY',
            nextLine
          ),
          mkOpt(
            `${m.id}-un-${nextLine}`,
            'total_goals',
            'إجمالي الأهداف',
            'Total Goals',
            `أقل من ${nextLine} هدف`,
            `UNDER_${nextLine}`,
            2.25,
            '90_MINS_ONLY',
            nextLine
          )
        );
      }
    }

    // Recalculate live odds dynamically with time decay & live events
    const timeFactor = Math.max(0.08, (90 - nextMin) / 90);
    for (let i = 0; i < m.availableMarkets.length; i++) {
      const opt = m.availableMarkets[i];
      if (opt.odds <= 1.02) continue;
      const prev = opt.odds;
      let next = prev;

      if (opt.category === 'total_goals' && opt.line !== undefined) {
        if (opt.selectionCode.startsWith('OVER_')) {
          if (totalGoals > opt.line) {
            next = 1.01;
          } else {
            // Over gets slightly harder as time runs out without a goal, or drops after a goal
            const delta = goalScoredNow ? -0.14 : 0.03;
            next = Math.min(8.5, Math.max(1.05, Number((prev + delta).toFixed(2))));
          }
        } else if (opt.selectionCode.startsWith('UNDER_')) {
          if (totalGoals > opt.line) {
            next = 25.0;
          } else {
            const delta = goalScoredNow ? 0.25 : -0.02;
            next = Math.min(12.0, Math.max(1.04, Number((prev + delta).toFixed(2))));
          }
        }
      } else if (opt.category === 'corners' && opt.line !== undefined && opt.selectionCode.startsWith('CORNERS_OVER_')) {
        if (totalCorners > opt.line) {
          next = 1.01;
        } else {
          const paceStep = m.liveStats.cornersHome + m.liveStats.cornersAway >= opt.line - 2 ? -0.03 : 0.02;
          next = Math.max(1.05, Number((prev + paceStep).toFixed(2)));
        }
      } else if (opt.selectionCode === 'BTTS_YES' && (m.scoreHome ?? 0) > 0 && (m.scoreAway ?? 0) > 0) {
        next = 1.01;
      } else {
        const diff = (m.scoreHome ?? 0) - (m.scoreAway ?? 0);
        let dirStep = (i % 2 === 0 ? 1 : -1) * 0.02;
        if (opt.selectionCode === '1' || opt.selectionCode === '1X') {
          dirStep = diff > 0 ? -0.02 * (1 + (1 - timeFactor)) : diff < 0 ? 0.05 : 0.01;
        } else if (opt.selectionCode === '2' || opt.selectionCode === 'X2') {
          dirStep = diff < 0 ? -0.02 * (1 + (1 - timeFactor)) : diff > 0 ? 0.05 : 0.01;
        }
        next = Math.min(15.0, Math.max(1.03, Number((prev + dirStep).toFixed(2))));
      }

      if (Math.abs(next - prev) >= 0.01) {
        opt.previousOdds = prev;
        opt.oddsDirection = next > prev ? 'UP' : 'DOWN';
        opt.odds = next;
        opt.impliedProbability = Math.round((1 / next) * 1000) / 10;
        opt.updatedAt = nowIso;
      } else {
        opt.oddsDirection = 'SAME';
      }
    }
  }
}

export function tickDemoLiveOdds(matches: MatchData[]): void {
  tickDemoLiveMatches(matches);
}


