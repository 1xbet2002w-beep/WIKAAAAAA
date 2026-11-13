import type { MarketCategoryId, MarketCategoryMeta, SettlementOutcome, SettlementRule } from '../shared/types.ts';

export const MARKET_CATEGORIES: MarketCategoryMeta[] = [
  {
    id: 'match_result',
    nameAr: 'نتيجة المباراة',
    nameEn: 'Match Result',
    descriptionAr: '1X2، الفرصة المزدوجة، التعادل لا رهان (DNB)، الهاندكاب الأوروبي، المتأهل',
    settlementNoteAr: 'تُسوى على الوقت الأصلي (90 دقيقة + بدل الضائع) باستثناء سوق المتأهل (To Qualify).',
  },
  {
    id: 'handicap',
    nameAr: 'الهاندكاب الآسيوي والأوروبي',
    nameEn: 'Asian & European Handicap',
    descriptionAr: 'خطوط 0، ±0.25، ±0.5، ±0.75، ±1، ±1.25، ±1.5، ±1.75، ±2 وهاندكاب الأهداف',
    settlementNoteAr: 'الخطوط الكسرية الآسيوية (0.25 / 0.75 / 1.25 / 1.75) تدعم التسوية الجزئية: ربح نصف / خسارة نصف / استرداد.',
  },
  {
    id: 'total_goals',
    nameAr: 'إجمالي الأهداف',
    nameEn: 'Total Goals',
    descriptionAr: 'Over/Under 0.5 إلى 5.5، الخطوط الآسيوية، أهداف كل فريق، أهداف الأشواط',
    settlementNoteAr: 'الوقت الأصلي فقط؛ في الخطوط الآسيوية الصحيحة (مثل 2.0) يتم استرداد الرهان عند التطابق.',
  },
  {
    id: 'btts',
    nameAr: 'تسجيل الفريقين (BTTS)',
    nameEn: 'Both Teams To Score',
    descriptionAr: 'الفريقان يسجلان نعم/لا، في الشوط الأول أو الثاني، Clean Sheet',
    settlementNoteAr: 'يعتمد على تسجيل أهداف فعلية في الوقت الأصلي لكل شوط أو للمباراة كاملة حسب السوق.',
  },
  {
    id: 'half_markets',
    nameAr: 'أسواق الشوط الأول والثاني',
    nameEn: 'Half Markets',
    descriptionAr: 'نتيجة الشوط الأول/الثاني، الفرصة المزدوجة للأشواط، HT/FT، الشوط الأعلى أهدافًا',
    settlementNoteAr: 'أسواق الشوط الأول تُحسم بنهاية الشوط الأول؛ أسواق الشوط الثاني تحسب أهداف الشوط الثاني فقط.',
  },
  {
    id: 'corners',
    nameAr: 'أسواق الركنيات',
    nameEn: 'Corners',
    descriptionAr: 'إجمالي الركنيات، ركنيات كل فريق، الأكثر ركنيات، السباق إلى 3/5/7/9، الأشواط',
    settlementNoteAr: 'تُحتسب الركنيات المنفذة فعليًا فقط (الركنية المحتسبة دون تنفيذ عند الصافرة لا تُحسب).',
  },
  {
    id: 'cards',
    nameAr: 'أسواق البطاقات',
    nameEn: 'Cards',
    descriptionAr: 'البطاقات الصفراء والحمراء، الإجمالي، بطاقات كل فريق، هاندكاب البطاقات، بطاقة لاعب',
    settlementNoteAr: 'البطاقة الصفراء = 1 نقطة، الحمراء المباشرة = 2، صفراء ثانية = إجمالي 3 نقاط كحد أقصى للاعب.',
  },
  {
    id: 'shots',
    nameAr: 'أسواق التسديدات',
    nameEn: 'Shots',
    descriptionAr: 'إجمالي التسديدات، التسديدات على المرمى، تسديدات الفريقين واللاعبين',
    settlementNoteAr: 'تُسوى وفق الإحصاءات الرسمية لمزود البيانات المعتمد (Opta / API-Football) للوقت الأصلي.',
  },
  {
    id: 'player_props',
    nameAr: 'أسواق اللاعبين',
    nameEn: 'Player Props',
    descriptionAr: 'مسجل هدف في أي وقت، أول/آخر هداف، ثنائية، صناعة هدف، تمريرات وتدخلات',
    settlementNoteAr: 'تُلغى (VOID) إذا لم يشارك اللاعب أساسيًا أو لم يدخل الملعب حسب قاعدة السوق.',
  },
  {
    id: 'special_markets',
    nameAr: 'النتائج الخاصة',
    nameEn: 'Special Markets',
    descriptionAr: 'النتيجة الصحيحة، عدد الأهداف بالضبط، الفوز بشباك نظيفة، هدف قبل/بعد دقيقة محددة',
    settlementNoteAr: 'أسواق الوقت الإضافي وركلات الترجيح تشمل ما بعد الدقيقة 90 صراحةً عند ذكر ذلك في اسم السوق.',
  },
];

export const SETTLEMENT_RULE_LABELS: Record<SettlementRule, string> = {
  '90_MINS_ONLY': 'الوقت الأصلي فقط (90 دقيقة + بدل الضائع)',
  'INC_EXTRA_TIME': 'يشمل الوقت الإضافي وركلات الترجيح',
  'ASIAN_SPLIT': 'تسوية آسيوية مقسّمة (نصف ربح / نصف خسارة / استرداد)',
  'FIRST_HALF_ONLY': 'الشوط الأول فقط (45 دقيقة + بدل الضائع)',
  'SECOND_HALF_ONLY': 'أحداث الشوط الثاني فقط',
  'PLAYER_MUST_START': 'يُلغى (VOID) إذا لم يبدأ اللاعب أساسيًا',
};

/**
 * Evaluates Asian Handicap settlement including quarter lines (+0.25, -0.75, etc.)
 * Diff = (teamGoals - oppGoals) + handicapLine
 */
export function settleAsianHandicap(goalDiff: number, line: number): { outcome: SettlementOutcome; returnMultiplier: number } {
  // Quarter lines split into two half-bets at line - 0.25 and line + 0.25
  const isQuarter = Math.abs((line * 4) % 2) === 1;
  if (!isQuarter) {
    const adjusted = goalDiff + line;
    if (adjusted > 0) return { outcome: 'WIN', returnMultiplier: 1 };
    if (adjusted === 0) return { outcome: 'PUSH', returnMultiplier: 0 };
    return { outcome: 'LOSS', returnMultiplier: -1 };
  }

  const lineA = line - 0.25;
  const lineB = line + 0.25;
  const resA = goalDiff + lineA;
  const resB = goalDiff + lineB;

  const scoreA = resA > 0 ? 1 : resA === 0 ? 0 : -1;
  const scoreB = resB > 0 ? 1 : resB === 0 ? 0 : -1;
  const avg = (scoreA + scoreB) / 2;

  if (avg === 1) return { outcome: 'WIN', returnMultiplier: 1 };
  if (avg === 0.5) return { outcome: 'HALF_WIN', returnMultiplier: 0.5 };
  if (avg === 0) return { outcome: 'PUSH', returnMultiplier: 0 };
  if (avg === -0.5) return { outcome: 'HALF_LOSS', returnMultiplier: -0.5 };
  return { outcome: 'LOSS', returnMultiplier: -1 };
}

/**
 * Evaluates Asian Total Goals / Corners Over/Under including quarter lines (e.g. Over 2.25, Under 2.75)
 */
export function settleAsianTotal(actualTotal: number, line: number, side: 'OVER' | 'UNDER'): { outcome: SettlementOutcome; returnMultiplier: number } {
  const sign = side === 'OVER' ? 1 : -1;
  const isQuarter = Math.abs((line * 4) % 2) === 1;

  if (!isQuarter) {
    const diff = (actualTotal - line) * sign;
    if (diff > 0) return { outcome: 'WIN', returnMultiplier: 1 };
    if (diff === 0) return { outcome: 'PUSH', returnMultiplier: 0 };
    return { outcome: 'LOSS', returnMultiplier: -1 };
  }

  const lineA = line - 0.25;
  const lineB = line + 0.25;
  const dA = (actualTotal - lineA) * sign;
  const dB = (actualTotal - lineB) * sign;
  const sA = dA > 0 ? 1 : dA === 0 ? 0 : -1;
  const sB = dB > 0 ? 1 : dB === 0 ? 0 : -1;
  const avg = (sA + sB) / 2;

  if (avg === 1) return { outcome: 'WIN', returnMultiplier: 1 };
  if (avg === 0.5) return { outcome: 'HALF_WIN', returnMultiplier: 0.5 };
  if (avg === 0) return { outcome: 'PUSH', returnMultiplier: 0 };
  if (avg === -0.5) return { outcome: 'HALF_LOSS', returnMultiplier: -0.5 };
  return { outcome: 'LOSS', returnMultiplier: -1 };
}

export function getCategoryMeta(id: MarketCategoryId): MarketCategoryMeta {
  return MARKET_CATEGORIES.find((c) => c.id === id) ?? MARKET_CATEGORIES[0];
}

export interface CatalogMarketSpec {
  index: number;
  nameEn: string;
  nameAr: string;
  category: MarketCategoryId;
  settlementRule: SettlementRule;
}

export const BOOKMAKER_30_MARKETS: CatalogMarketSpec[] = [
  { index: 1, nameEn: 'Match Result (1X2)', nameAr: 'نتيجة المباراة (1X2)', category: 'match_result', settlementRule: '90_MINS_ONLY' },
  { index: 2, nameEn: 'Double Chance', nameAr: 'الفرصة المزدوجة', category: 'match_result', settlementRule: '90_MINS_ONLY' },
  { index: 3, nameEn: 'Draw No Bet', nameAr: 'التعادل لا رهان (DNB)', category: 'match_result', settlementRule: '90_MINS_ONLY' },
  { index: 4, nameEn: 'Half Time Result', nameAr: 'نتيجة الشوط الأول', category: 'half_markets', settlementRule: 'FIRST_HALF_ONLY' },
  { index: 5, nameEn: 'Full Time Result', nameAr: 'النتيجة الكاملة للمباراة', category: 'match_result', settlementRule: '90_MINS_ONLY' },
  { index: 6, nameEn: 'Half Time / Full Time', nameAr: 'الشوط الأول / نهاية المباراة', category: 'half_markets', settlementRule: '90_MINS_ONLY' },
  { index: 7, nameEn: 'Over/Under', nameAr: 'أكثر / أقل من الأهداف', category: 'total_goals', settlementRule: '90_MINS_ONLY' },
  { index: 8, nameEn: 'Individual Total', nameAr: 'الإجمالي الفردي للفريق', category: 'total_goals', settlementRule: '90_MINS_ONLY' },
  { index: 9, nameEn: 'Total (Odd/Even)', nameAr: 'مجموع الأهداف (فردي/زوجي)', category: 'special_markets', settlementRule: '90_MINS_ONLY' },
  { index: 10, nameEn: 'Both Teams To Score', nameAr: 'كلا الفريقين يسجل (BTTS)', category: 'btts', settlementRule: '90_MINS_ONLY' },
  { index: 11, nameEn: 'Correct Score', nameAr: 'النتيجة الصحيحة', category: 'special_markets', settlementRule: '90_MINS_ONLY' },
  { index: 12, nameEn: 'Asian Handicap', nameAr: 'الهاندكاب الآسيوي', category: 'handicap', settlementRule: 'ASIAN_SPLIT' },
  { index: 13, nameEn: 'European Handicap', nameAr: 'الهاندكاب الأوروبي', category: 'handicap', settlementRule: '90_MINS_ONLY' },
  { index: 14, nameEn: 'Handicap Result', nameAr: 'نتيجة الهاندكاب', category: 'handicap', settlementRule: '90_MINS_ONLY' },
  { index: 15, nameEn: 'Total In Interval', nameAr: 'نطاق إجمالي الأهداف', category: 'total_goals', settlementRule: '90_MINS_ONLY' },
  { index: 16, nameEn: 'Team Total', nameAr: 'إجمالي أهداف الفريق', category: 'total_goals', settlementRule: '90_MINS_ONLY' },
  { index: 17, nameEn: 'First Team To Score', nameAr: 'أول فريق يسجل', category: 'total_goals', settlementRule: '90_MINS_ONLY' },
  { index: 18, nameEn: 'Last Team To Score', nameAr: 'آخر فريق يسجل', category: 'total_goals', settlementRule: '90_MINS_ONLY' },
  { index: 19, nameEn: 'Next Goal', nameAr: 'الهدف التالي', category: 'special_markets', settlementRule: '90_MINS_ONLY' },
  { index: 20, nameEn: 'No Goal', nameAr: 'عدم تسجيل أهداف إضافية', category: 'special_markets', settlementRule: '90_MINS_ONLY' },
  { index: 21, nameEn: 'Winning Margin', nameAr: 'فارق الفوز', category: 'special_markets', settlementRule: '90_MINS_ONLY' },
  { index: 22, nameEn: 'Exact Number Of Goals', nameAr: 'العدد الدقيق للأهداف', category: 'special_markets', settlementRule: '90_MINS_ONLY' },
  { index: 23, nameEn: 'Goal In Both Halves', nameAr: 'هدف في كلا الشوطين', category: 'total_goals', settlementRule: '90_MINS_ONLY' },
  { index: 24, nameEn: 'Team To Score In Both Halves', nameAr: 'فريق يسجل في الشوطين', category: 'total_goals', settlementRule: '90_MINS_ONLY' },
  { index: 25, nameEn: 'Corners Total', nameAr: 'إجمالي الركنيات', category: 'corners', settlementRule: '90_MINS_ONLY' },
  { index: 26, nameEn: 'Corners Handicap', nameAr: 'هاندكاب الركنيات', category: 'corners', settlementRule: '90_MINS_ONLY' },
  { index: 27, nameEn: 'Corners Result', nameAr: 'الأكثر ركنيات (1X2)', category: 'corners', settlementRule: '90_MINS_ONLY' },
  { index: 28, nameEn: 'Yellow Cards Total', nameAr: 'إجمالي البطاقات الصفراء', category: 'cards', settlementRule: '90_MINS_ONLY' },
  { index: 29, nameEn: 'Red Card – Yes/No', nameAr: 'بطاقة حمراء (نعم/لا)', category: 'cards', settlementRule: '90_MINS_ONLY' },
  { index: 30, nameEn: 'Player To Score Anytime', nameAr: 'لاعب يسجل في أي وقت', category: 'player_props', settlementRule: 'PLAYER_MUST_START' },
];

