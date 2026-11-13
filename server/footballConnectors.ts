import type { FootballConnectorConfig, LiveStats, MarketOption, MatchData, MatchEvent } from '../shared/types.ts';

interface ConnectorResult {
  matches: MatchData[];
  errors: string[];
  usedCache: boolean;
}

const realMatchesCache: { data: MatchData[]; fetchedAt: number } = {
  data: [],
  fetchedAt: 0,
};

const oddsHistoryMap = new Map<
  string,
  { current: number; previous?: number; direction: 'UP' | 'DOWN' | 'SAME' }
>();

export function applyOddsMovementTracking(matches: MatchData[]): void {
  for (const m of matches) {
    for (const opt of m.availableMarkets) {
      const prev = oddsHistoryMap.get(opt.id);
      if (!prev) {
        oddsHistoryMap.set(opt.id, { current: opt.odds, direction: 'SAME' });
        opt.oddsDirection = 'SAME';
      } else if (Math.abs(opt.odds - prev.current) >= 0.009) {
        const dir: 'UP' | 'DOWN' = opt.odds > prev.current ? 'UP' : 'DOWN';
        opt.previousOdds = prev.current;
        opt.oddsDirection = dir;
        oddsHistoryMap.set(opt.id, { current: opt.odds, previous: prev.current, direction: dir });
      } else {
        opt.previousOdds = prev.previous;
        opt.oddsDirection = prev.direction;
      }
    }
  }
}

const seenEventKeysMap = new Map<string, Set<string>>();

function markNewEvents(matchId: string, events: MatchEvent[]): MatchEvent[] {
  const sorted = [...events].sort((a, b) => a.minute - b.minute);
  const existing = seenEventKeysMap.get(matchId);
  if (!existing) {
    const initialSet = new Set(sorted.map((e) => `${e.minute}-${e.type}-${e.team}-${e.player}`));
    seenEventKeysMap.set(matchId, initialSet);
    return sorted;
  }
  const result = sorted.map((e) => {
    const key = `${e.minute}-${e.type}-${e.team}-${e.player}`;
    if (!existing.has(key)) {
      existing.add(key);
      return { ...e, isNew: true };
    }
    return e;
  });
  return result;
}

export function getCachedRealMatches(): MatchData[] {
  return realMatchesCache.data;
}

const LEAGUE_AR_MAP: Record<string, string> = {
  'uefa.nations': 'دوري الأمم الأوروبية',
  'uefa.w.nations': 'دوري الأمم الأوروبية للسيدات',
  'uefa.champions': 'دوري أبطال أوروبا',
  'uefa.europa': 'الدوري الأوروبي',
  'uefa.europa.conf': 'دوري المؤتمر الأوروبي',
  'uefa.euro': 'بطولة أمم أوروبا (يورو)',
  'uefa.euroq': 'تصفيات أمم أوروبا',
  'uefa.euro_u21': 'بطولة أمم أوروبا تحت 21 سنة',
  'uefa.euro_u21_qual': 'تصفيات أمم أوروبا تحت 21 سنة',
  'uefa.euro.u19': 'بطولة أمم أوروبا تحت 19 سنة',
  'eng.1': 'الدوري الإنجليزي الممتاز',
  'eng.2': 'دوري التشامبيونشيب الإنجليزي',
  'eng.3': 'دوري الدرجة الأولى الإنجليزي',
  'eng.4': 'دوري الدرجة الثانية الإنجليزي',
  'eng.fa': 'كأس الاتحاد الإنجليزي',
  'eng.league_cup': 'كأس الرابطة الإنجليزية',
  'esp.1': 'الدوري الإسباني (لا ليغا)',
  'esp.2': 'الدوري الإسباني الدرجة الثانية',
  'esp.copa_del_rey': 'كأس ملك إسبانيا',
  'ita.1': 'الدوري الإيطالي (سيري أ)',
  'ita.2': 'الدوري الإيطالي الدرجة الثانية',
  'ita.coppa_italia': 'كأس إيطاليا',
  'ger.1': 'الدوري الألماني (بوندسليغا)',
  'ger.2': 'الدوري الألماني الدرجة الثانية',
  'ger.dfb_pokal': 'كأس ألمانيا',
  'fra.1': 'الدوري الفرنسي (ليغ 1)',
  'fra.2': 'الدوري الفرنسي الدرجة الثانية',
  'fra.coupe_de_france': 'كأس فرنسا',
  'ned.1': 'الدوري الهولندي الممتاز',
  'por.1': 'الدوري البرتغالي الممتاز',
  'tur.1': 'الدوري التركي الممتاز',
  'bel.1': 'الدوري البلجيكي الممتاز',
  'sco.1': 'الدوري الإسكتلندي الممتاز',
  'gre.1': 'الدوري اليوناني الممتاز',
  'rus.1': 'الدوري الروسي الممتاز',
  'ksa.1': 'دوري روشن السعودي',
  'ksa.kings.cup': 'كأس خادم الحرمين الشريفين',
  'egy.1': 'الدوري المصري الممتاز',
  'fifa.world': 'كأس العالم FIFA',
  'fifa.wwc': 'كأس العالم للسيدات FIFA',
  'fifa.worldq.uefa': 'تصفيات كأس العالم — أوروبا',
  'fifa.worldq.caf': 'تصفيات كأس العالم — أفريقيا',
  'fifa.worldq.afc': 'تصفيات كأس العالم — آسيا',
  'fifa.worldq.conmebol': 'تصفيات كأس العالم — أمريكا الجنوبية',
  'fifa.worldq.concacaf': 'تصفيات كأس العالم — كونكاكاف',
  'fifa.worldq.ofc': 'تصفيات كأس العالم — أوقيانوسيا',
  'fifa.wcq.ply': 'الملحق العالمي لتصفيات كأس العالم',
  'fifa.friendly': 'مباريات دولية ودية (منتخبات)',
  'fifa.friendly.w': 'مباريات دولية ودية (منتخبات سيدات)',
  'fifa.friendly_u21': 'مباريات دولية ودية — تحت 21 سنة',
  'fifa.world.u20': 'كأس العالم تحت 20 سنة',
  'fifa.world.u17': 'كأس العالم تحت 17 سنة',
  'fifa.olympics': 'كرة القدم — الأولمبياد',
  'concacaf.nations.league': 'دوري أمم كونكاكاف',
  'concacaf.gold': 'الكأس الذهبية — كونكاكاف',
  'concacaf.gold_qual': 'تصفيات الكأس الذهبية — كونكاكاف',
  'concacaf.w.gold': 'الكأس الذهبية للسيدات — كونكاكاف',
  'concacaf.champions': 'كأس أبطال كونكاكاف',
  'caf.nations': 'كأس أمم أفريقيا',
  'caf.nations_qual': 'تصفيات كأس أمم أفريقيا',
  'caf.w.nations': 'كأس أمم أفريقيا للسيدات',
  'caf.championship': 'بطولة أمم أفريقيا للمحليين (CHAN)',
  'caf.champions': 'دوري أبطال أفريقيا',
  'caf.confed': 'كأس الكونفيدرالية الأفريقية',
  'afc.asian.cup': 'كأس آسيا للمنتخبات',
  'afc.cupq': 'تصفيات كأس آسيا',
  'afc.champions': 'دوري أبطال آسيا للنخبة',
  'afc.cup': 'دوري أبطال آسيا 2',
  'aff.championship': 'بطولة آسيان للمنتخبات',
  'global.gulf_cup': 'كأس الخليج العربي',
  'conmebol.america': 'كوبا أمريكا',
  'conmebol.libertadores': 'كوبا ليبرتادوريس',
  'conmebol.sudamericana': 'كوبا سودأميريكانا',
  'bra.1': 'الدوري البرازيلي الممتاز (Serie A)',
  'bra.2': 'الدوري البرازيلي الدرجة الثانية',
  'arg.1': 'الدوري الأرجنتيني الممتاز',
  'arg.supercopa': 'كأس السوبر الأرجنتيني',
  'col.1': 'الدوري الكولومبي الممتاز',
  'uru.1': 'الدوري الأوروغواياني الممتاز',
  'chi.1': 'الدوري التشيلي الممتاز',
  'mex.1': 'الدوري المكسيكي الممتاز (Liga MX)',
  'usa.1': 'الدوري الأمريكي (MLS)',
  'jpn.1': 'الدوري الياباني (J1 League)',
  'aus.1': 'الدوري الأسترالي (A-League)',
  'chn.1': 'الدوري الصيني الممتاز',
  'rsa.1': 'الدوري الجنوب أفريقي الممتاز',
  'club.friendly': 'مباريات ودية للأندية',
  'nonfifa': 'مباريات منتخبات دولية (غير تابعة لـ FIFA)',
};

const TEAM_AR_MAP: Record<string, string> = {
  Moldova: 'مولدوفا',
  Kazakhstan: 'كازاخستان',
  Bulgaria: 'بلغاريا',
  Iceland: 'أيسلندا',
  Luxembourg: 'لوكسمبورغ',
  Estonia: 'إستونيا',
  Scotland: 'إسكتلندا',
  'North Macedonia': 'مقدونيا الشمالية',
  Slovenia: 'سلوفينيا',
  Switzerland: 'سويسرا',
  Netherlands: 'هولندا',
  Greece: 'اليونان',
  Serbia: 'صربيا',
  Germany: 'ألمانيا',
  Andorra: 'أندورا',
  Gibraltar: 'جبل طارق',
  France: 'فرنسا',
  Italy: 'إيطاليا',
  Spain: 'إسبانيا',
  England: 'إنجلترا',
  Portugal: 'البرتغال',
  Belgium: 'بلجيكا',
  Croatia: 'كرواتيا',
  Denmark: 'الدنمارك',
  Sweden: 'السويد',
  Norway: 'النرويج',
  Poland: 'بولندا',
  Austria: 'النمسا',
  Turkey: 'تركيا',
  Türkiye: 'تركيا',
  Wales: 'ويلز',
  Ireland: 'أيرلندا',
  'Republic of Ireland': 'جمهورية أيرلندا',
  'Northern Ireland': 'أيرلندا الشمالية',
  Finland: 'فنلندا',
  Hungary: 'المجر',
  Czechia: 'التشيك',
  'Czech Republic': 'التشيك',
  Romania: 'رومانيا',
  Slovakia: 'سلوفاكيا',
  Ukraine: 'أوكرانيا',
  Georgia: 'جورجيا',
  Albania: 'ألبانيا',
  'Bosnia-Herzegovina': 'البوسنة والهرسك',
  'Bosnia and Herzegovina': 'البوسنة والهرسك',
  Montenegro: 'الجبل الأسود',
  Kosovo: 'كوسوفو',
  Cyprus: 'قبرص',
  Armenia: 'أرمينيا',
  Azerbaijan: 'أذربيجان',
  Latvia: 'لاتفيا',
  Lithuania: 'ليتوانيا',
  Malta: 'مالطا',
  'Faroe Islands': 'جزر فارو',
  Belarus: 'بيلاروسيا',
  Egypt: 'مصر',
  Morocco: 'المغرب',
  Tunisia: 'تونس',
  Algeria: 'الجزائر',
  Libya: 'ليبيا',
  Sudan: 'السودان',
  Mauritania: 'موريتانيا',
  Comoros: 'جزر القمر',
  Djibouti: 'جيبوتي',
  Somalia: 'الصومال',
  'Saudi Arabia': 'السعودية',
  Iraq: 'العراق',
  Jordan: 'الأردن',
  Qatar: 'قطر',
  UAE: 'الإمارات',
  'United Arab Emirates': 'الإمارات',
  Bahrain: 'البحرين',
  Oman: 'عُمان',
  Kuwait: 'الكويت',
  Syria: 'سوريا',
  Palestine: 'فلسطين',
  Lebanon: 'لبنان',
  Yemen: 'اليمن',
  Nigeria: 'نيجيريا',
  Senegal: 'السنغال',
  Cameroon: 'الكاميرون',
  Ghana: 'غانا',
  'Ivory Coast': 'ساحل العاج',
  "Côte d'Ivoire": 'ساحل العاج',
  Mali: 'مالي',
  'Burkina Faso': 'بوركينا فاسو',
  'South Africa': 'جنوب أفريقيا',
  'DR Congo': 'الكونغو الديمقراطية',
  Congo: 'الكونغو',
  Guinea: 'غينيا',
  'Equatorial Guinea': 'غينيا الاستوائية',
  Gabon: 'الغابون',
  Angola: 'أنغولا',
  Zambia: 'زامبيا',
  Mozambique: 'موزمبيق',
  Ethiopia: 'إثيوبيا',
  Burundi: 'بوروندي',
  'Cape Verde': 'الرأس الأخضر',
  Liberia: 'ليبيريا',
  Kenya: 'كينيا',
  Uganda: 'أوغندا',
  Tanzania: 'تنزانيا',
  Zimbabwe: 'زيمبابوي',
  Namibia: 'ناميبيا',
  Benin: 'بنين',
  Togo: 'توغو',
  Rwanda: 'رواندا',
  Malawi: 'مالاوي',
  Madagascar: 'مدغشقر',
  Botswana: 'بوتسوانا',
  Gambia: 'غامبيا',
  Niger: 'النيجر',
  SierraLeone: 'سيراليون',
  'Sierra Leone': 'سيراليون',
  Brazil: 'البرازيل',
  Argentina: 'الأرجنتين',
  Colombia: 'كولومبيا',
  Uruguay: 'أوروغواي',
  Chile: 'تشيلي',
  Ecuador: 'الإكوادور',
  Paraguay: 'باراغواي',
  Peru: 'بيرو',
  Venezuela: 'فنزويلا',
  Bolivia: 'بوليفيا',
  Canada: 'كندا',
  Guatemala: 'غواتيمالا',
  'El Salvador': 'السلفادور',
  Nicaragua: 'نيكاراغوا',
  'Puerto Rico': 'بورتوريكو',
  Bermuda: 'برمودا',
  Jamaica: 'جامايكا',
  Mexico: 'المكسيك',
  USA: 'أمريكا',
  'United States': 'أمريكا',
  'Costa Rica': 'كوستاريكا',
  Panama: 'بنما',
  Honduras: 'هندوراس',
  Haiti: 'هايتي',
  'Trinidad and Tobago': 'ترينيداد وتوباغو',
  'Antigua and Barbuda': 'أنتيغوا وباربودا',
  Curacao: 'كوراساو',
  Suriname: 'سورينام',
  Grenada: 'غرينادا',
  Dominica: 'دومينيكا',
  'St. Lucia': 'سانت لوسيا',
  'St. Kitts and Nevis': 'سانت كيتس ونيفيس',
  Montserrat: 'مونتسرات',
  'St. Martin': 'سانت مارتن',
  Japan: 'اليابان',
  'South Korea': 'كوريا الجنوبية',
  Australia: 'أستراليا',
  Iran: 'إيران',
  Uzbekistan: 'أوزبكستان',
  China: 'الصين',
  Thailand: 'تايلاند',
  Vietnam: 'فيتنام',
  Indonesia: 'إندونيسيا',
  Malaysia: 'ماليزيا',
  Singapore: 'سنغافورة',
  India: 'الهند',
  'New Zealand': 'نيوزيلندا',
};

function translateTeamName(nameEn: string): string {
  if (TEAM_AR_MAP[nameEn]) return TEAM_AR_MAP[nameEn];
  // Support U21 / Women suffixes like "Czechia U21" or "Germany Women"
  const uMatch = nameEn.match(/^(.+?)\s+(U\d{2}|Women)$/i);
  if (uMatch && TEAM_AR_MAP[uMatch[1]]) {
    const suffix = uMatch[2].toLowerCase() === 'women' ? 'سيدات' : uMatch[2].toUpperCase();
    return `${TEAM_AR_MAP[uMatch[1]]} (${suffix})`;
  }
  return nameEn;
}

function americanToDecimal(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  if (!str) return null;
  if (str === 'EVEN' || str === 'PK') return 2.0;
  const num = Number(str);
  if (!Number.isFinite(num) || num === 0) return null;
  if (num > 0) return Number((1 + num / 100).toFixed(2));
  return Number((1 + 100 / Math.abs(num)).toFixed(2));
}

const NATIONAL_EXACT_SLUGS = new Set([
  'fifa.world',
  'fifa.wwc',
  'fifa.friendly',
  'fifa.friendly.w',
  'fifa.friendly_u21',
  'fifa.worldq.uefa',
  'fifa.worldq.caf',
  'fifa.worldq.afc',
  'fifa.worldq.conmebol',
  'fifa.worldq.concacaf',
  'fifa.worldq.ofc',
  'fifa.wworldq.uefa',
  'fifa.wcq.ply',
  'fifa.wwcq.ply',
  'fifa.olympics',
  'fifa.w.olympics',
  'fifa.shebelieves',
  'fifa.conmebol.olympicsq',
  'fifa.concacaf.olympicsq',
  'fifa.w.concacaf.olympicsq',
  'fifa.world.u20',
  'fifa.world.u17',
  'fifa.wworld.u17',
  'uefa.nations',
  'uefa.w.nations',
  'uefa.euro',
  'uefa.euroq',
  'uefa.weuro',
  'uefa.euro_u21',
  'uefa.euro_u21_qual',
  'uefa.euro.u19',
  'uefa.worldq',
  'caf.nations',
  'caf.nations_qual',
  'caf.w.nations',
  'caf.championship',
  'caf.cosafa',
  'concacaf.nations.league',
  'concacaf.gold',
  'concacaf.gold_qual',
  'concacaf.w.gold',
  'concacaf.womens.championship',
  'concacaf.confederations_playoff',
  'concacaf.u23',
  'conmebol.america',
  'conmebol.america.femenina',
  'afc.asian.cup',
  'afc.w.asian.cup',
  'afc.cupq',
  'aff.championship',
  'afc.saff.championship',
  'global.gulf_cup',
  'global.finalissima',
  'global.w.finalissima',
  'global.u20.intercontinental_cup',
  'nonfifa',
]);

function detectTeamType(
  leagueName: string,
  slug?: string,
  homeName?: string,
  homeLogoUrl?: string,
  awayLogoUrl?: string
): 'CLUB' | 'NATIONAL' {
  const cleanSlug = (slug || '').toLowerCase().trim();
  if (cleanSlug && NATIONAL_EXACT_SLUGS.has(cleanSlug)) return 'NATIONAL';

  const txt = `${leagueName} ${cleanSlug} ${homeName || ''}`.toLowerCase();

  // Explicit club patterns take precedence over generic words like "friendly" or "women"
  const clubGuardKeywords = [
    'club friendly',
    'club.friendly',
    'ncaa',
    'womens super league',
    'liga f',
    'nwsl',
    'usl',
    'premier league',
    'championship',
    'la liga',
    'serie a',
    'serie b',
    'bundesliga',
    'ligue 1',
    'ligue 2',
    'champions league',
    'champions cup',
    'europa league',
    'conference league',
    'libertadores',
    'sudamericana',
    'recopa',
    'copa del rey',
    'coupe de france',
    'dfb pokal',
    'coppa italia',
    'fa cup',
    'efl',
    'leagues cup',
    'supercopa',
    'clausura',
    'apertura',
    'brasileiro',
    'club world cup',
    'fifa.cwc',
    'caf.champions',
    'caf.confed',
    'afc.champions',
  ];
  if (clubGuardKeywords.some((k) => txt.includes(k))) {
    // Only exception: AFF/SAFF/African Nations Championship (already handled in NATIONAL_EXACT_SLUGS or explicit national check)
    if (!txt.includes('championship qualifying') && !txt.includes('nations championship')) {
      return 'CLUB';
    }
  }

  // Country flag logo in ESPN is a definitive national-team indicator
  if (
    (homeLogoUrl && homeLogoUrl.includes('/countries/')) ||
    (awayLogoUrl && awayLogoUrl.includes('/countries/'))
  ) {
    return 'NATIONAL';
  }

  const nationalKeywords = [
    'world cup qualifying',
    'worldq',
    'nations league',
    'international friendly',
    'under-21 international',
    'u21 international',
    'gold cup',
    'africa cup of nations',
    'afcon',
    'asian cup',
    'copa america',
    'uefa euro',
    'european championship',
    'european under-21',
    'gulf cup',
    'olympic',
    'national team',
    'non-fifa friendly',
  ];
  return nationalKeywords.some((k) => txt.includes(k)) ? 'NATIONAL' : 'CLUB';
}

function formatApiErrors(errObj: any): string {
  if (!errObj) return '';
  if (Array.isArray(errObj)) return errObj.join(' | ');
  if (typeof errObj === 'object') {
    return Object.entries(errObj)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(' | ');
  }
  return String(errObj);
}

function normalizeApiFootballFixture(f: any): MatchData {
  const isLive = ['1H', 'HT', '2H', 'ET', 'P'].includes(f.fixture?.status?.short);
  const statusMap: Record<string, MatchData['status']> = {
    '1H': 'LIVE_1H',
    HT: 'HT',
    '2H': 'LIVE_2H',
    NS: 'NS',
  };
  const kickoff = f.fixture?.date || new Date().toISOString();
  const todayStr = new Date().toISOString().slice(0, 10);
  const dateGroup: 'TODAY' | 'TOMORROW' = kickoff.slice(0, 10) === todayStr ? 'TODAY' : 'TOMORROW';
  const leagueName = f.league?.name || 'بطولة كرة قدم';
  const isNational = f.teams?.home?.national === true || detectTeamType(leagueName, f.league?.country) === 'NATIONAL';

  const homeName = f.teams?.home?.name || 'Home';
  const awayName = f.teams?.away?.name || 'Away';

  return {
    id: `af-${f.fixture?.id}`,
    mode: isLive ? 'LIVE' : 'PREMATCH',
    dateGroup,
    teamType: isNational ? 'NATIONAL' : 'CLUB',
    leagueId: String(f.league?.id ?? 'unknown'),
    leagueNameAr: leagueName,
    leagueNameEn: leagueName,
    leagueLogoUrl: f.league?.logo,
    roundName: f.league?.round,
    venue: f.fixture?.venue?.name,
    countryAr: f.league?.country || '',
    kickoffTime: kickoff,
    status: statusMap[f.fixture?.status?.short] ?? 'NS',
    minute: f.fixture?.status?.elapsed ?? null,
    scoreHome: f.goals?.home ?? null,
    scoreAway: f.goals?.away ?? null,
    htScoreHome: f.score?.halftime?.home ?? null,
    htScoreAway: f.score?.halftime?.away ?? null,
    lineupConfirmed: false,
    homeTeam: {
      id: String(f.teams?.home?.id ?? 'h'),
      nameAr: translateTeamName(homeName),
      nameEn: homeName,
      shortCode: homeName.slice(0, 3).toUpperCase(),
      logoUrl: f.teams?.home?.logo,
      last5Form: ['W', 'D', 'W', 'L', 'W'],
      avgGoalsScored: 1.6,
      avgGoalsConceded: 1.1,
      homeWinRate: 58,
      awayWinRate: 44,
      avgCornersFor: 5.2,
      avgCardsFor: 1.9,
      avgShotsOnTarget: 4.8,
      expectedLineup: [],
      injuries: [],
    },
    awayTeam: {
      id: String(f.teams?.away?.id ?? 'a'),
      nameAr: translateTeamName(awayName),
      nameEn: awayName,
      shortCode: awayName.slice(0, 3).toUpperCase(),
      logoUrl: f.teams?.away?.logo,
      last5Form: ['D', 'W', 'L', 'W', 'D'],
      avgGoalsScored: 1.4,
      avgGoalsConceded: 1.2,
      homeWinRate: 54,
      awayWinRate: 41,
      avgCornersFor: 4.8,
      avgCardsFor: 2.1,
      avgShotsOnTarget: 4.3,
      expectedLineup: [],
      injuries: [],
    },
    h2hSummary: { played: 4, homeWins: 2, draws: 1, awayWins: 1, avgGoals: 2.5, bttsRate: 50 },
    availableMarkets: [],
    feedUpdatedAt: new Date().toISOString(),
    feedSource: 'API_FOOTBALL',
    isDemo: false,
  };
}

function getEspnStat(statsArr: any[], name: string): number {
  const found = (statsArr || []).find((s) => s.name === name);
  const val = Number(found?.displayValue);
  return Number.isFinite(val) ? val : 0;
}

function parseEspnClockMinute(displayClock?: string): number | null {
  if (!displayClock) return null;
  const m = String(displayClock).match(/\d+/);
  return m ? Number(m[0]) : null;
}

function normalizeEspnEvent(
  ev: any,
  dateGroupOverride?: 'TODAY' | 'TOMORROW',
  leagueOverride?: { slug?: string; name?: string; logoUrl?: string }
): MatchData | null {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;
  const state = ev?.status?.type?.state; // 'pre' | 'in' | 'post'

  const kickoffMs = ev?.date ? new Date(ev.date).getTime() : Date.now();
  const hoursFromNow = (kickoffMs - Date.now()) / 3600000;

  // Exclude stale finished matches (> 20h old) and stale unstarted ghosts (> 8h past)
  if (state === 'post' && hoursFromNow < -20) return null;
  if (state === 'pre' && hoursFromNow < -8) return null;

  const todayUtc = new Date().toISOString().slice(0, 10);
  const kickoffDateUtc = ev?.date ? String(ev.date).slice(0, 10) : todayUtc;
  const dateGroup: 'TODAY' | 'TOMORROW' =
    state === 'in' || state === 'post'
      ? 'TODAY'
      : kickoffDateUtc > todayUtc && hoursFromNow > 6
      ? 'TOMORROW'
      : dateGroupOverride || 'TODAY';

  const competitors = comp.competitors || [];
  const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
  const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
  if (!homeComp || !awayComp) return null;

  const isLive = state === 'in';
  const isFinished = state === 'post';
  const statusName = ev?.status?.type?.name || '';
  const period = ev?.status?.period || 1;
  const matchStatus: MatchData['status'] =
    isFinished
      ? 'FT'
      : statusName === 'STATUS_HALFTIME'
      ? 'HT'
      : isLive
      ? period >= 2
        ? 'LIVE_2H'
        : 'LIVE_1H'
      : 'NS';

  const oddsList = comp.odds || [];
  const firstOdds = oddsList.find((o: any) => o && (o.moneyline || o.homeTeamOdds || o.total || o.pointSpread));

  // Extract exact league tag if available inside tracking or links
  const trackingLeague =
    leagueOverride?.slug ||
    firstOdds?.moneyline?.home?.close?.link?.tracking?.tags?.league ||
    firstOdds?.total?.over?.close?.link?.tracking?.tags?.league ||
    '';

  const slug = ev?.season?.slug || '';
  const noteHeadline = comp?.notes?.[0]?.headline || '';
  const leagueDisplayEn =
    leagueOverride?.name ||
    (slug
      ? slug
          .split('-')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      : noteHeadline || 'بطولة كرة قدم دولية/محلية');

  const leagueDisplayAr = LEAGUE_AR_MAP[trackingLeague] || leagueDisplayEn;

  const homeNameEn = homeComp.team?.displayName || homeComp.team?.shortDisplayName || 'Home';
  const awayNameEn = awayComp.team?.displayName || awayComp.team?.shortDisplayName || 'Away';
  const homeNameAr = translateTeamName(homeNameEn);
  const awayNameAr = translateTeamName(awayNameEn);

  const teamType = detectTeamType(
    `${leagueDisplayEn} ${trackingLeague}`,
    trackingLeague || slug,
    homeNameEn,
    homeComp.team?.logo,
    awayComp.team?.logo
  );

  const homeStatsArr = homeComp.statistics || [];
  const awayStatsArr = awayComp.statistics || [];
  const details = comp.details || [];

  let yellowH = 0;
  let yellowA = 0;
  let redH = 0;
  let redA = 0;
  let subH = 0;
  let subA = 0;
  const rawEvents: MatchEvent[] = [];

  for (const d of details) {
    const isHomeEv = String(d?.team?.id) === String(homeComp.team?.id);
    const teamSide: 'HOME' | 'AWAY' = isHomeEv ? 'HOME' : 'AWAY';
    const min = parseEspnClockMinute(d?.clock?.displayValue) ?? 0;
    const typeText = String(d?.type?.text || '').toLowerCase();
    const player = d?.athletesInvolved?.[0]?.displayName || d?.type?.text || 'لاعب';

    if (d?.yellowCard) {
      if (isHomeEv) yellowH++;
      else yellowA++;
      rawEvents.push({ minute: min, type: 'YELLOW_CARD', team: teamSide, player, detail: d?.type?.text || 'بطاقة صفراء' });
    } else if (d?.redCard) {
      if (isHomeEv) redH++;
      else redA++;
      rawEvents.push({ minute: min, type: 'RED_CARD', team: teamSide, player, detail: d?.type?.text || 'بطاقة حمراء' });
    } else if (d?.scoringPlay) {
      rawEvents.push({ minute: min, type: 'GOAL', team: teamSide, player, detail: d?.type?.text || 'هدف' });
    } else if (typeText.includes('substitution') || d?.substitution) {
      if (isHomeEv) subH++;
      else subA++;
      rawEvents.push({ minute: min, type: 'SUBSTITUTION', team: teamSide, player, detail: d?.type?.text || 'تبديل' });
    } else if (typeText.includes('var')) {
      rawEvents.push({ minute: min, type: 'VAR', team: teamSide, player, detail: d?.type?.text || 'مراجعة VAR' });
    }
  }

  const liveEvents = markNewEvents(`espn-${ev.id}`, rawEvents);

  let liveStats: LiveStats | undefined;
  if ((isLive || isFinished) && (homeStatsArr.length > 0 || awayStatsArr.length > 0)) {
    const possH = Math.round(getEspnStat(homeStatsArr, 'possessionPct')) || 50;
    const possA = Math.round(getEspnStat(awayStatsArr, 'possessionPct')) || (100 - possH);
    liveStats = {
      possessionHome: possH,
      possessionAway: possA,
      shotsHome: getEspnStat(homeStatsArr, 'totalShots'),
      shotsAway: getEspnStat(awayStatsArr, 'totalShots'),
      shotsOnTargetHome: getEspnStat(homeStatsArr, 'shotsOnTarget'),
      shotsOnTargetAway: getEspnStat(awayStatsArr, 'shotsOnTarget'),
      cornersHome: getEspnStat(homeStatsArr, 'wonCorners'),
      cornersAway: getEspnStat(awayStatsArr, 'wonCorners'),
      yellowCardsHome: yellowH,
      yellowCardsAway: yellowA,
      redCardsHome: redH,
      redCardsAway: redA,
      dangerousAttacksHome: getEspnStat(homeStatsArr, 'shotAssists') * 5 + getEspnStat(homeStatsArr, 'totalShots') * 2,
      dangerousAttacksAway: getEspnStat(awayStatsArr, 'shotAssists') * 5 + getEspnStat(awayStatsArr, 'totalShots') * 2,
      substitutionsHome: subH,
      substitutionsAway: subA,
    };
  }

  // Extract REAL Odds from Bet365 / DraftKings inside ESPN feed (1X2, Total Goals O/U, Point Spread / AH)
  const availableMarkets: MarketOption[] = [];
  if (firstOdds) {
    const bookie = firstOdds.provider?.displayName || firstOdds.provider?.name || 'Bookmaker Feed';
    const nowIso = new Date().toISOString();

    const homeDec =
      firstOdds.homeTeamOdds?.value
        ? Number(Number(firstOdds.homeTeamOdds.value).toFixed(2))
        : americanToDecimal(firstOdds.moneyline?.home?.close?.odds || firstOdds.moneyline?.home?.open?.odds);

    const drawDec =
      firstOdds.drawOdds?.value
        ? Number(Number(firstOdds.drawOdds.value).toFixed(2))
        : americanToDecimal(firstOdds.moneyline?.draw?.close?.odds || firstOdds.drawOdds?.moneyLine);

    const awayDec =
      firstOdds.awayTeamOdds?.value
        ? Number(Number(firstOdds.awayTeamOdds.value).toFixed(2))
        : americanToDecimal(firstOdds.moneyline?.away?.close?.odds || firstOdds.moneyline?.away?.open?.odds);

    if (homeDec && homeDec >= 1.01) {
      availableMarkets.push({
        id: `espn-${ev.id}-1`,
        category: 'match_result',
        marketNameAr: 'نتيجة المباراة (1X2)',
        marketNameEn: 'Match Result',
        selectionAr: `فوز ${homeNameAr} (1)`,
        selectionCode: '1',
        odds: homeDec,
        settlementRule: '90_MINS_ONLY',
        bookmakerName: bookie,
        impliedProbability: Math.round((1 / homeDec) * 1000) / 10,
        updatedAt: nowIso,
      });
    }
    if (drawDec && drawDec >= 1.01) {
      availableMarkets.push({
        id: `espn-${ev.id}-X`,
        category: 'match_result',
        marketNameAr: 'نتيجة المباراة (1X2)',
        marketNameEn: 'Match Result',
        selectionAr: 'التعادل (X)',
        selectionCode: 'X',
        odds: drawDec,
        settlementRule: '90_MINS_ONLY',
        bookmakerName: bookie,
        impliedProbability: Math.round((1 / drawDec) * 1000) / 10,
        updatedAt: nowIso,
      });
    }
    if (awayDec && awayDec >= 1.01) {
      availableMarkets.push({
        id: `espn-${ev.id}-2`,
        category: 'match_result',
        marketNameAr: 'نتيجة المباراة (1X2)',
        marketNameEn: 'Match Result',
        selectionAr: `فوز ${awayNameAr} (2)`,
        selectionCode: '2',
        odds: awayDec,
        settlementRule: '90_MINS_ONLY',
        bookmakerName: bookie,
        impliedProbability: Math.round((1 / awayDec) * 1000) / 10,
        updatedAt: nowIso,
      });
    }

    // Total Goals Over/Under from DraftKings
    if (firstOdds.total) {
      const overLineRaw = firstOdds.total.over?.close?.line || firstOdds.total.over?.open?.line || `o${firstOdds.overUnder ?? 2.5}`;
      const lineNum = Number(String(overLineRaw).replace(/[^0-9.]/g, '')) || Number(firstOdds.overUnder ?? 2.5);
      const overDec = americanToDecimal(firstOdds.total.over?.close?.odds || firstOdds.total.over?.open?.odds);
      const underDec = americanToDecimal(firstOdds.total.under?.close?.odds || firstOdds.total.under?.open?.odds);

      if (overDec && overDec >= 1.01) {
        availableMarkets.push({
          id: `espn-${ev.id}-ov-${lineNum}`,
          category: 'total_goals',
          marketNameAr: 'إجمالي الأهداف',
          marketNameEn: 'Total Goals',
          selectionAr: `أكثر من ${lineNum} هدف`,
          selectionCode: `OVER_${lineNum}`,
          odds: overDec,
          line: lineNum,
          settlementRule: Number.isInteger(lineNum) ? 'ASIAN_SPLIT' : '90_MINS_ONLY',
          bookmakerName: bookie,
          impliedProbability: Math.round((1 / overDec) * 1000) / 10,
          updatedAt: nowIso,
        });
      }
      if (underDec && underDec >= 1.01) {
        availableMarkets.push({
          id: `espn-${ev.id}-un-${lineNum}`,
          category: 'total_goals',
          marketNameAr: 'إجمالي الأهداف',
          marketNameEn: 'Total Goals',
          selectionAr: `أقل من ${lineNum} هدف`,
          selectionCode: `UNDER_${lineNum}`,
          odds: underDec,
          line: lineNum,
          settlementRule: Number.isInteger(lineNum) ? 'ASIAN_SPLIT' : '90_MINS_ONLY',
          bookmakerName: bookie,
          impliedProbability: Math.round((1 / underDec) * 1000) / 10,
          updatedAt: nowIso,
        });
      }
    }

    // Point Spread / Asian Handicap from DraftKings
    if (firstOdds.pointSpread) {
      const hLine = Number(firstOdds.pointSpread.home?.close?.line ?? firstOdds.pointSpread.home?.open?.line);
      const hDec = americanToDecimal(firstOdds.pointSpread.home?.close?.odds || firstOdds.pointSpread.home?.open?.odds);
      const aLine = Number(firstOdds.pointSpread.away?.close?.line ?? firstOdds.pointSpread.away?.open?.line);
      const aDec = americanToDecimal(firstOdds.pointSpread.away?.close?.odds || firstOdds.pointSpread.away?.open?.odds);

      if (Number.isFinite(hLine) && hDec && hDec >= 1.01) {
        availableMarkets.push({
          id: `espn-${ev.id}-ah-h-${hLine}`,
          category: 'handicap',
          marketNameAr: 'الهاندكاب الآسيوي',
          marketNameEn: 'Asian Handicap',
          selectionAr: `${homeNameAr} (${hLine > 0 ? `+${hLine}` : hLine})`,
          selectionCode: `AH_HOME_${hLine > 0 ? `+${hLine}` : hLine}`,
          odds: hDec,
          line: hLine,
          isAsianSplit: Math.abs((hLine * 4) % 2) === 1,
          settlementRule: 'ASIAN_SPLIT',
          bookmakerName: bookie,
          impliedProbability: Math.round((1 / hDec) * 1000) / 10,
          updatedAt: nowIso,
        });
      }
      if (Number.isFinite(aLine) && aDec && aDec >= 1.01) {
        availableMarkets.push({
          id: `espn-${ev.id}-ah-a-${aLine}`,
          category: 'handicap',
          marketNameAr: 'الهاندكاب الآسيوي',
          marketNameEn: 'Asian Handicap',
          selectionAr: `${awayNameAr} (${aLine > 0 ? `+${aLine}` : aLine})`,
          selectionCode: `AH_AWAY_${aLine > 0 ? `+${aLine}` : aLine}`,
          odds: aDec,
          line: aLine,
          isAsianSplit: Math.abs((aLine * 4) % 2) === 1,
          settlementRule: 'ASIAN_SPLIT',
          bookmakerName: bookie,
          impliedProbability: Math.round((1 / aDec) * 1000) / 10,
          updatedAt: nowIso,
        });
      }
    }
  }

  return {
    id: `espn-${ev.id}`,
    mode: isLive || isFinished ? 'LIVE' : 'PREMATCH',
    dateGroup,
    teamType,
    leagueId: trackingLeague || slug || 'soccer',
    leagueNameAr: leagueDisplayAr,
    leagueNameEn: leagueDisplayEn,
    leagueLogoUrl: leagueOverride?.logoUrl,
    roundName: slug ? slug.replace(/-/g, ' ') : undefined,
    venue: comp.venue?.fullName || ev.venue?.fullName,
    countryAr: teamType === 'NATIONAL' ? 'مباراة منتخبات' : 'أندية',
    kickoffTime: ev.date || new Date().toISOString(),
    status: matchStatus,
    minute: isFinished ? 90 : isLive ? parseEspnClockMinute(ev?.status?.displayClock) : null,
    scoreHome: isLive || isFinished ? Number(homeComp.score ?? 0) : null,
    scoreAway: isLive || isFinished ? Number(awayComp.score ?? 0) : null,
    htScoreHome: null,
    htScoreAway: null,
    lineupConfirmed: false,
    homeTeam: {
      id: String(homeComp.team?.id || 'h'),
      nameAr: homeNameAr,
      nameEn: homeNameEn,
      shortCode: homeComp.team?.abbreviation || homeNameEn.slice(0, 3).toUpperCase(),
      logoUrl: homeComp.team?.logo,
      last5Form: ['W', 'D', 'W', 'D', 'W'],
      avgGoalsScored: 1.45,
      avgGoalsConceded: 1.15,
      homeWinRate: 56,
      awayWinRate: 42,
      avgCornersFor: 5.0,
      avgCardsFor: 1.9,
      avgShotsOnTarget: 4.5,
      expectedLineup: [],
      injuries: [],
    },
    awayTeam: {
      id: String(awayComp.team?.id || 'a'),
      nameAr: awayNameAr,
      nameEn: awayNameEn,
      shortCode: awayComp.team?.abbreviation || awayNameEn.slice(0, 3).toUpperCase(),
      logoUrl: awayComp.team?.logo,
      last5Form: ['D', 'W', 'L', 'W', 'D'],
      avgGoalsScored: 1.35,
      avgGoalsConceded: 1.2,
      homeWinRate: 52,
      awayWinRate: 40,
      avgCornersFor: 4.7,
      avgCardsFor: 2.0,
      avgShotsOnTarget: 4.2,
      expectedLineup: [],
      injuries: [],
    },
    h2hSummary: { played: 3, homeWins: 1, draws: 1, awayWins: 1, avgGoals: 2.4, bttsRate: 50 },
    liveStats,
    liveEvents: liveEvents.length > 0 ? liveEvents : undefined,
    availableMarkets,
    feedUpdatedAt: new Date().toISOString(),
    feedSource: 'ESPN_PUBLIC',
    isDemo: false,
  };
}

function attachOddsFromOddsApi(matches: MatchData[], events: any[]): void {
  for (const ev of events) {
    const homeLow = String(ev.home_team || '').toLowerCase();
    const awayLow = String(ev.away_team || '').toLowerCase();
    const matched = matches.find(
      (m) =>
        m.homeTeam.nameEn.toLowerCase().includes(homeLow.slice(0, 5)) ||
        m.awayTeam.nameEn.toLowerCase().includes(awayLow.slice(0, 5))
    );
    const targetMatch: MatchData = matched ?? {
      id: `odds-${ev.id}`,
      mode: new Date(ev.commence_time).getTime() <= Date.now() ? 'LIVE' : 'PREMATCH',
      dateGroup:
        new Date(ev.commence_time).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10) ? 'TODAY' : 'TOMORROW',
      teamType: detectTeamType(ev.sport_title || '', ev.sport_key, ev.home_team),
      leagueId: String(ev.sport_key || 'soccer'),
      leagueNameAr: ev.sport_title || 'مباراة رسمية',
      leagueNameEn: ev.sport_title || 'Official Match',
      countryAr: 'دولي',
      kickoffTime: ev.commence_time,
      status: new Date(ev.commence_time).getTime() <= Date.now() ? 'LIVE_1H' : 'NS',
      minute: null,
      scoreHome: null,
      scoreAway: null,
      htScoreHome: null,
      htScoreAway: null,
      lineupConfirmed: false,
      homeTeam: {
        id: `h-${ev.id}`,
        nameAr: translateTeamName(ev.home_team),
        nameEn: ev.home_team,
        shortCode: String(ev.home_team).slice(0, 3).toUpperCase(),
        last5Form: ['W', 'D', 'W', 'D', 'W'],
        avgGoalsScored: 1.5,
        avgGoalsConceded: 1.1,
        homeWinRate: 55,
        awayWinRate: 45,
        avgCornersFor: 5.0,
        avgCardsFor: 1.9,
        avgShotsOnTarget: 4.6,
        expectedLineup: [],
        injuries: [],
      },
      awayTeam: {
        id: `a-${ev.id}`,
        nameAr: translateTeamName(ev.away_team),
        nameEn: ev.away_team,
        shortCode: String(ev.away_team).slice(0, 3).toUpperCase(),
        last5Form: ['D', 'W', 'L', 'W', 'D'],
        avgGoalsScored: 1.35,
        avgGoalsConceded: 1.2,
        homeWinRate: 52,
        awayWinRate: 40,
        avgCornersFor: 4.7,
        avgCardsFor: 2.0,
        avgShotsOnTarget: 4.2,
        expectedLineup: [],
        injuries: [],
      },
      h2hSummary: { played: 2, homeWins: 1, draws: 0, awayWins: 1, avgGoals: 2.4, bttsRate: 50 },
      availableMarkets: [],
      feedUpdatedAt: new Date().toISOString(),
      feedSource: 'ODDS_API',
      isDemo: false,
    };

    const bookmaker = ev.bookmakers?.[0];
    if (bookmaker) {
      const discovered: MarketOption[] = [];
      for (const mkt of bookmaker.markets || []) {
        if (mkt.key === 'h2h') {
          for (const out of mkt.outcomes || []) {
            const isHome = out.name === ev.home_team;
            const isDraw = out.name === 'Draw';
            const code = isHome ? '1' : isDraw ? 'X' : '2';
            const labelAr = isHome
              ? `فوز ${targetMatch.homeTeam.nameAr} (1)`
              : isDraw
              ? 'التعادل (X)'
              : `فوز ${targetMatch.awayTeam.nameAr} (2)`;
            discovered.push({
              id: `${targetMatch.id}-h2h-${code}`,
              category: 'match_result',
              marketNameAr: 'نتيجة المباراة (1X2)',
              marketNameEn: 'Match Result',
              selectionAr: labelAr,
              selectionCode: code,
              odds: Number(out.price),
              settlementRule: '90_MINS_ONLY',
              bookmakerName: bookmaker.title,
              impliedProbability: Math.round((1 / Number(out.price)) * 1000) / 10,
              updatedAt: bookmaker.last_update || new Date().toISOString(),
            });
          }
        } else if (mkt.key === 'totals') {
          for (const out of mkt.outcomes || []) {
            const isOver = String(out.name).toLowerCase() === 'over';
            const line = Number(out.point ?? 2.5);
            discovered.push({
              id: `${targetMatch.id}-tot-${out.name}-${line}`,
              category: 'total_goals',
              marketNameAr: 'إجمالي الأهداف',
              marketNameEn: 'Total Goals',
              selectionAr: `${isOver ? 'أكثر من' : 'أقل من'} ${line} هدف`,
              selectionCode: `${isOver ? 'OVER' : 'UNDER'}_${line}`,
              odds: Number(out.price),
              line,
              settlementRule: Number.isInteger(line) ? 'ASIAN_SPLIT' : '90_MINS_ONLY',
              bookmakerName: bookmaker.title,
              impliedProbability: Math.round((1 / Number(out.price)) * 1000) / 10,
              updatedAt: bookmaker.last_update || new Date().toISOString(),
            });
          }
        } else if (mkt.key === 'spreads') {
          for (const out of mkt.outcomes || []) {
            const isHome = out.name === ev.home_team;
            const line = Number(out.point ?? 0);
            discovered.push({
              id: `${targetMatch.id}-ah-${isHome ? 'h' : 'a'}-${line}`,
              category: 'handicap',
              marketNameAr: 'الهاندكاب الآسيوي',
              marketNameEn: 'Asian Handicap',
              selectionAr: `${out.name} (${line > 0 ? `+${line}` : line})`,
              selectionCode: `${isHome ? 'AH_HOME' : 'AH_AWAY'}_${line > 0 ? `+${line}` : line}`,
              odds: Number(out.price),
              line,
              isAsianSplit: Math.abs((line * 4) % 2) === 1,
              settlementRule: 'ASIAN_SPLIT',
              bookmakerName: bookmaker.title,
              impliedProbability: Math.round((1 / Number(out.price)) * 1000) / 10,
              updatedAt: bookmaker.last_update || new Date().toISOString(),
            });
          }
        }
      }
      if (discovered.length > 0) {
        targetMatch.availableMarkets = discovered;
      }
    }

    if (!matched) {
      matches.push(targetMatch);
    }
  }
}

export async function fetchRealMatchesFromConnectors(
  connectors: FootballConnectorConfig[],
  rawKeys: Record<string, string>,
  cacheTtlSeconds: number,
  onUsageIncrement: (connectorId: FootballConnectorConfig['id'], status: FootballConnectorConfig['status'], error?: string) => void,
  forceLiveRefresh = false
): Promise<ConnectorResult> {
  const now = Date.now();
  const effectiveTtlSeconds = forceLiveRefresh ? Math.min(cacheTtlSeconds, 10) : cacheTtlSeconds;
  if (realMatchesCache.data.length > 0 && now - realMatchesCache.fetchedAt < effectiveTtlSeconds * 1000) {
    return { matches: realMatchesCache.data, errors: [], usedCache: true };
  }

  const matches: MatchData[] = [];
  const errors: string[] = [];

  const apiFootball = connectors.find((c) => c.id === 'api_football');
  const footballData = connectors.find((c) => c.id === 'football_data');
  const oddsApi = connectors.find((c) => c.id === 'the_odds_api');

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // 1. API-Football (if key configured)
  const afKey = rawKeys['api_football'];
  if (apiFootball && afKey) {
    try {
      const [liveRes, todayRes, tomorrowRes] = await Promise.all([
        fetch('https://v3.football.api-sports.io/fixtures?live=all', {
          headers: { 'x-apisports-key': afKey },
        }),
        fetch(`https://v3.football.api-sports.io/fixtures?date=${todayStr}`, {
          headers: { 'x-apisports-key': afKey },
        }),
        fetch(`https://v3.football.api-sports.io/fixtures?date=${tomorrowStr}`, {
          headers: { 'x-apisports-key': afKey },
        }),
      ]);

      if (!liveRes.ok || !todayRes.ok) {
        const msg = `API-Football أرجع حالة HTTP ${!liveRes.ok ? liveRes.status : todayRes.status}`;
        errors.push(msg);
        onUsageIncrement('api_football', liveRes.status === 429 ? 'RATE_LIMITED' : 'ERROR', msg);
      } else {
        const liveJson = await liveRes.json();
        const todayJson = await todayRes.json();
        const tomorrowJson = tomorrowRes.ok ? await tomorrowRes.json() : { response: [] };

        const errMsg = formatApiErrors(liveJson.errors) || formatApiErrors(todayJson.errors);
        if (errMsg) {
          const fullMsg = `تنبيه API-Football: ${errMsg}`;
          errors.push(fullMsg);
          onUsageIncrement('api_football', 'ERROR', fullMsg);
        } else {
          const seen = new Set<string>();
          for (const item of [
            ...(liveJson.response || []),
            ...(todayJson.response || []),
            ...(tomorrowJson.response || []),
          ]) {
            const norm = normalizeApiFootballFixture(item);
            if (!seen.has(norm.id)) {
              seen.add(norm.id);
              matches.push(norm);
            }
          }
          onUsageIncrement('api_football', 'CONNECTED');
        }
      }
    } catch (err: any) {
      const msg = `تعذر الاتصال بـ API-Football: ${err?.message || 'خطأ شبكة'}`;
      errors.push(msg);
      onUsageIncrement('api_football', 'ERROR', msg);
    }
  }

  // 2. Football-Data.org (if key configured)
  const fdKey = rawKeys['football_data'];
  if (footballData && fdKey && matches.length === 0) {
    try {
      const res = await fetch('https://api.football-data.org/v4/matches', {
        headers: { 'X-Auth-Token': fdKey },
      });
      if (!res.ok) {
        const msg = `Football-Data.org أرجع حالة ${res.status}`;
        errors.push(msg);
        onUsageIncrement('football_data', res.status === 429 ? 'RATE_LIMITED' : 'ERROR', msg);
      } else {
        const json = await res.json();
        for (const m of json.matches || []) {
          const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';
          const compName = m.competition?.name || 'بطولة كرة قدم';
          matches.push({
            id: `fd-${m.id}`,
            mode: isLive ? 'LIVE' : 'PREMATCH',
            dateGroup: 'TODAY',
            teamType: detectTeamType(compName, m.competition?.code),
            leagueId: String(m.competition?.code || 'fd'),
            leagueNameAr: compName,
            leagueNameEn: compName,
            countryAr: m.area?.name || '',
            kickoffTime: m.utcDate,
            status: m.status === 'PAUSED' ? 'HT' : isLive ? 'LIVE_1H' : 'NS',
            minute: m.minute ?? null,
            scoreHome: m.score?.fullTime?.home ?? null,
            scoreAway: m.score?.fullTime?.away ?? null,
            htScoreHome: m.score?.halfTime?.home ?? null,
            htScoreAway: m.score?.halfTime?.away ?? null,
            lineupConfirmed: false,
            homeTeam: {
              id: String(m.homeTeam?.id || 'h'),
              nameAr: translateTeamName(m.homeTeam?.shortName || m.homeTeam?.name || 'المضيف'),
              nameEn: m.homeTeam?.name || 'Home',
              shortCode: m.homeTeam?.tla || 'HOM',
              logoUrl: m.homeTeam?.crest,
              last5Form: ['W', 'D', 'W', 'L', 'W'],
              avgGoalsScored: 1.5,
              avgGoalsConceded: 1.1,
              homeWinRate: 56,
              awayWinRate: 44,
              avgCornersFor: 5.1,
              avgCardsFor: 1.9,
              avgShotsOnTarget: 4.5,
              expectedLineup: [],
              injuries: [],
            },
            awayTeam: {
              id: String(m.awayTeam?.id || 'a'),
              nameAr: translateTeamName(m.awayTeam?.shortName || m.awayTeam?.name || 'الضيف'),
              nameEn: m.awayTeam?.name || 'Away',
              shortCode: m.awayTeam?.tla || 'AWY',
              logoUrl: m.awayTeam?.crest,
              last5Form: ['D', 'W', 'L', 'W', 'D'],
              avgGoalsScored: 1.4,
              avgGoalsConceded: 1.2,
              homeWinRate: 52,
              awayWinRate: 41,
              avgCornersFor: 4.8,
              avgCardsFor: 2.0,
              avgShotsOnTarget: 4.2,
              expectedLineup: [],
              injuries: [],
            },
            h2hSummary: { played: 4, homeWins: 2, draws: 1, awayWins: 1, avgGoals: 2.5, bttsRate: 50 },
            availableMarkets: [],
            feedUpdatedAt: new Date().toISOString(),
            feedSource: 'FOOTBALL_DATA',
            isDemo: false,
          });
        }
        onUsageIncrement('football_data', 'CONNECTED');
      }
    } catch (err: any) {
      const msg = `تعذر الاتصال بـ Football-Data.org: ${err?.message || 'خطأ شبكة'}`;
      errors.push(msg);
      onUsageIncrement('football_data', 'ERROR', msg);
    }
  }

  // 3. ESPN Global All-Soccer + Full National Teams & Major Club Leagues Coverage (Yesterday/Today/Tomorrow)
  const ESPN_PRIORITY_LEAGUES = [
    // National Team Competitions (All Confederations + Friendlies + Youth + Women)
    'fifa.friendly', 'fifa.friendly.w', 'fifa.friendly_u21', 'nonfifa',
    'fifa.world', 'fifa.wwc', 'fifa.wcq.ply', 'fifa.wwcq.ply',
    'fifa.worldq.uefa', 'fifa.worldq.caf', 'fifa.worldq.afc', 'fifa.worldq.conmebol', 'fifa.worldq.concacaf', 'fifa.worldq.ofc',
    'uefa.nations', 'uefa.w.nations', 'uefa.euro', 'uefa.euroq', 'uefa.euro_u21', 'uefa.euro_u21_qual', 'uefa.euro.u19',
    'caf.nations', 'caf.nations_qual', 'caf.w.nations', 'caf.championship', 'caf.cosafa',
    'concacaf.nations.league', 'concacaf.gold', 'concacaf.gold_qual', 'concacaf.w.gold', 'concacaf.u23',
    'afc.asian.cup', 'afc.cupq', 'aff.championship', 'afc.saff.championship', 'global.gulf_cup',
    'conmebol.america', 'conmebol.america.femenina',
    'fifa.olympics', 'fifa.w.olympics', 'fifa.world.u20', 'fifa.world.u17',
    // Major Club Leagues & Domestic/Continental Cups Worldwide
    'uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'uefa.wchampions',
    'eng.1', 'eng.2', 'eng.3', 'eng.4', 'eng.fa', 'eng.league_cup', 'eng.w.1',
    'esp.1', 'esp.2', 'esp.copa_del_rey', 'esp.w.1',
    'ita.1', 'ita.2', 'ita.coppa_italia',
    'ger.1', 'ger.2', 'ger.dfb_pokal',
    'fra.1', 'fra.2', 'fra.coupe_de_france', 'fra.w.1',
    'ned.1', 'ned.2', 'por.1', 'tur.1', 'bel.1', 'sco.1', 'gre.1', 'aut.1', 'rus.1', 'swe.1', 'den.1', 'nor.1',
    'ksa.1', 'ksa.kings.cup', 'afc.champions', 'afc.cup', 'caf.champions', 'caf.confed',
    'conmebol.libertadores', 'conmebol.sudamericana', 'concacaf.champions', 'concacaf.central.american.cup',
    'bra.1', 'bra.2', 'arg.1', 'arg.2', 'arg.supercopa', 'col.1', 'uru.1', 'chi.1', 'ecu.1', 'par.1', 'per.1', 'ven.1',
    'mex.1', 'mex.2', 'usa.1', 'usa.nwsl', 'aus.1', 'jpn.1', 'chn.1', 'ind.1', 'rsa.1', 'club.friendly',
  ];

  if (matches.length === 0) {
    try {
      const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
      const yyyymmddYesterday = yesterday.toISOString().slice(0, 10).replace(/-/g, '');
      const yyyymmddToday = todayStr.replace(/-/g, '');
      const yyyymmddTomorrow = tomorrowStr.replace(/-/g, '');
      const dateCodes = [yyyymmddYesterday, yyyymmddToday, yyyymmddTomorrow];

      const eventMap = new Map<
        string,
        { ev: any; dateHint: 'TODAY' | 'TOMORROW'; leagueOverride?: { slug?: string; name?: string; logoUrl?: string } }
      >();

      // 3a. Always fetch global 'all' across yesterday/today/tomorrow
      const allResponses = await Promise.all(
        dateCodes.map(async (d, idx) => {
          try {
            const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${d}`, {
              signal: AbortSignal.timeout(5000),
            });
            return { json: r.ok ? await r.json() : null, dateHint: (idx === 2 ? 'TOMORROW' : 'TODAY') as 'TODAY' | 'TOMORROW' };
          } catch {
            return { json: null, dateHint: 'TODAY' as const };
          }
        })
      );

      for (const item of allResponses) {
        for (const ev of item.json?.events || []) {
          eventMap.set(ev.id, { ev, dateHint: item.dateHint });
        }
      }

      // 3b. Fetch all National Team & Major Club leagues across the 3-day window so nothing is truncated by 'all' cap
      // On rapid 10s live refreshes when cache already exists, refresh 'all' + active live/today leagues; otherwise full 90-slug sweep
      const cachedLiveLeagues = new Set(
        realMatchesCache.data.filter((m) => m.mode === 'LIVE' || m.dateGroup === 'TODAY').map((m) => m.leagueId)
      );
      const slugsToFetch =
        forceLiveRefresh && realMatchesCache.data.length > 0 && now - realMatchesCache.fetchedAt < 60 * 1000
          ? ESPN_PRIORITY_LEAGUES.filter((s) => cachedLiveLeagues.has(s) || s.includes('fifa') || s.includes('nations') || s.includes('caf'))
          : ESPN_PRIORITY_LEAGUES;

      const tasks: Array<{ slug: string; d: string; dateHint: 'TODAY' | 'TOMORROW' }> = [];
      for (const slug of slugsToFetch) {
        const activeDates =
          forceLiveRefresh && realMatchesCache.data.length > 0 && now - realMatchesCache.fetchedAt < 60 * 1000
            ? [yyyymmddYesterday, yyyymmddToday]
            : dateCodes;
        for (const d of activeDates) {
          tasks.push({ slug, d, dateHint: d === yyyymmddTomorrow ? 'TOMORROW' : 'TODAY' });
        }
      }

      for (let i = 0; i < tasks.length; i += 35) {
        const chunk = tasks.slice(i, i + 35);
        await Promise.all(
          chunk.map(async ({ slug, d, dateHint }) => {
            try {
              const r = await fetch(
                `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(slug)}/scoreboard?dates=${d}`,
                { signal: AbortSignal.timeout(4500) }
              );
              if (!r.ok) return;
              const j = await r.json();
              const leagueObj = j.leagues?.[0];
              const leagueOverride = {
                slug: leagueObj?.slug || slug,
                name: leagueObj?.name,
                logoUrl: leagueObj?.logos?.[0]?.href,
              };
              for (const ev of j.events || []) {
                eventMap.set(ev.id, { ev, dateHint, leagueOverride });
              }
            } catch {
              // Ignore individual league timeout
            }
          })
        );
      }

      // Preserve any cached tomorrow/club matches during rapid live-only sweeps
      if (forceLiveRefresh && realMatchesCache.data.length > 0 && now - realMatchesCache.fetchedAt < 60 * 1000) {
        for (const existing of realMatchesCache.data) {
          const rawId = existing.id.replace('espn-', '');
          if (!eventMap.has(rawId) && existing.mode === 'PREMATCH') {
            matches.push(existing);
          }
        }
      }

      const seenIds = new Set(matches.map((m) => m.id));
      for (const { ev, dateHint, leagueOverride } of eventMap.values()) {
        const norm = normalizeEspnEvent(ev, dateHint, leagueOverride);
        if (norm && !seenIds.has(norm.id)) {
          seenIds.add(norm.id);
          matches.push(norm);
        }
      }

      if (matches.length > 0) {
        onUsageIncrement('espn_public', 'CONNECTED');
      } else {
        onUsageIncrement('espn_public', 'ERROR', 'لم تُرجع تغذية ESPN أي مباريات جارية أو قادمة لليوم والغد');
      }
    } catch (err: any) {
      const msg = `تعذر الاتصال بتغذية ESPN العالمية: ${err?.message || 'خطأ شبكة'}`;
      errors.push(msg);
      onUsageIncrement('espn_public', 'ERROR', msg);
    }
  }

  // 4. Attach real bookmaker odds from The Odds API if configured
  const oddsKey = rawKeys['the_odds_api'];
  if (oddsApi && oddsKey) {
    try {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${encodeURIComponent(oddsKey)}&regions=eu&markets=h2h,totals,spreads`
      );
      if (!res.ok) {
        const msg = `The Odds API أرجع حالة ${res.status}`;
        errors.push(msg);
        onUsageIncrement('the_odds_api', res.status === 429 ? 'RATE_LIMITED' : 'ERROR', msg);
      } else {
        const events = await res.json();
        if (Array.isArray(events)) {
          attachOddsFromOddsApi(matches, events);
        }
        onUsageIncrement('the_odds_api', 'CONNECTED');
      }
    } catch (err: any) {
      const msg = `تعذر الاتصال بـ The Odds API: ${err?.message || 'خطأ شبكة'}`;
      errors.push(msg);
      onUsageIncrement('the_odds_api', 'ERROR', msg);
    }
  }

  if (matches.length > 0) {
    // Sort LIVE running first, then PREMATCH by kickoff time ascending, then FT
    matches.sort((a, b) => {
      const rank = (m: MatchData) => (m.mode === 'LIVE' && m.status !== 'FT' ? 0 : m.mode === 'PREMATCH' ? 1 : 2);
      const rDiff = rank(a) - rank(b);
      if (rDiff !== 0) return rDiff;
      return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
    });
    applyOddsMovementTracking(matches);
    realMatchesCache.data = matches;
    realMatchesCache.fetchedAt = now;
  }

  return { matches, errors: matches.length > 0 ? [] : errors, usedCache: false };
}

function extractEspnMarketsFromOddsObj(
  evId: string,
  firstOdds: any,
  homeNameAr: string,
  awayNameAr: string
): MarketOption[] {
  if (!firstOdds) return [];
  const availableMarkets: MarketOption[] = [];
  const bookie = firstOdds.provider?.displayName || firstOdds.provider?.name || 'Bookmaker Feed';
  const nowIso = new Date().toISOString();

  const homeDec =
    firstOdds.homeTeamOdds?.value
      ? Number(Number(firstOdds.homeTeamOdds.value).toFixed(2))
      : americanToDecimal(firstOdds.homeTeamOdds?.moneyLine || firstOdds.moneyline?.home?.close?.odds || firstOdds.moneyline?.home?.open?.odds);

  const drawDec =
    firstOdds.drawOdds?.value
      ? Number(Number(firstOdds.drawOdds.value).toFixed(2))
      : americanToDecimal(firstOdds.drawOdds?.moneyLine || firstOdds.moneyline?.draw?.close?.odds);

  const awayDec =
    firstOdds.awayTeamOdds?.value
      ? Number(Number(firstOdds.awayTeamOdds.value).toFixed(2))
      : americanToDecimal(firstOdds.awayTeamOdds?.moneyLine || firstOdds.moneyline?.away?.close?.odds || firstOdds.moneyline?.away?.open?.odds);

  if (homeDec && homeDec >= 1.01) {
    availableMarkets.push({
      id: `espn-${evId}-1`,
      category: 'match_result',
      marketNameAr: 'نتيجة المباراة (1X2)',
      marketNameEn: 'Match Result',
      selectionAr: `فوز ${homeNameAr} (1)`,
      selectionCode: '1',
      odds: homeDec,
      settlementRule: '90_MINS_ONLY',
      bookmakerName: bookie,
      impliedProbability: Math.round((1 / homeDec) * 1000) / 10,
      updatedAt: nowIso,
    });
  }
  if (drawDec && drawDec >= 1.01) {
    availableMarkets.push({
      id: `espn-${evId}-X`,
      category: 'match_result',
      marketNameAr: 'نتيجة المباراة (1X2)',
      marketNameEn: 'Match Result',
      selectionAr: 'التعادل (X)',
      selectionCode: 'X',
      odds: drawDec,
      settlementRule: '90_MINS_ONLY',
      bookmakerName: bookie,
      impliedProbability: Math.round((1 / drawDec) * 1000) / 10,
      updatedAt: nowIso,
    });
  }
  if (awayDec && awayDec >= 1.01) {
    availableMarkets.push({
      id: `espn-${evId}-2`,
      category: 'match_result',
      marketNameAr: 'نتيجة المباراة (1X2)',
      marketNameEn: 'Match Result',
      selectionAr: `فوز ${awayNameAr} (2)`,
      selectionCode: '2',
      odds: awayDec,
      settlementRule: '90_MINS_ONLY',
      bookmakerName: bookie,
      impliedProbability: Math.round((1 / awayDec) * 1000) / 10,
      updatedAt: nowIso,
    });
  }

  if (firstOdds.total) {
    const overLineRaw = firstOdds.total.over?.close?.line || firstOdds.total.over?.open?.line || `o${firstOdds.overUnder ?? 2.5}`;
    const lineNum = Number(String(overLineRaw).replace(/[^0-9.]/g, '')) || Number(firstOdds.overUnder ?? 2.5);
    const overDec = americanToDecimal(firstOdds.total.over?.close?.odds || firstOdds.total.over?.open?.odds || firstOdds.overOdds);
    const underDec = americanToDecimal(firstOdds.total.under?.close?.odds || firstOdds.total.under?.open?.odds || firstOdds.underOdds);

    if (overDec && overDec >= 1.01) {
      availableMarkets.push({
        id: `espn-${evId}-ov-${lineNum}`,
        category: 'total_goals',
        marketNameAr: 'إجمالي الأهداف',
        marketNameEn: 'Total Goals',
        selectionAr: `أكثر من ${lineNum} هدف`,
        selectionCode: `OVER_${lineNum}`,
        odds: overDec,
        line: lineNum,
        settlementRule: Number.isInteger(lineNum) ? 'ASIAN_SPLIT' : '90_MINS_ONLY',
        bookmakerName: bookie,
        impliedProbability: Math.round((1 / overDec) * 1000) / 10,
        updatedAt: nowIso,
      });
    }
    if (underDec && underDec >= 1.01) {
      availableMarkets.push({
        id: `espn-${evId}-un-${lineNum}`,
        category: 'total_goals',
        marketNameAr: 'إجمالي الأهداف',
        marketNameEn: 'Total Goals',
        selectionAr: `أقل من ${lineNum} هدف`,
        selectionCode: `UNDER_${lineNum}`,
        odds: underDec,
        line: lineNum,
        settlementRule: Number.isInteger(lineNum) ? 'ASIAN_SPLIT' : '90_MINS_ONLY',
        bookmakerName: bookie,
        impliedProbability: Math.round((1 / underDec) * 1000) / 10,
        updatedAt: nowIso,
      });
    }
  }

  if (firstOdds.pointSpread) {
    const hLine = Number(firstOdds.pointSpread.home?.close?.line ?? firstOdds.pointSpread.home?.open?.line);
    const hDec = americanToDecimal(firstOdds.pointSpread.home?.close?.odds || firstOdds.pointSpread.home?.open?.odds);
    const aLine = Number(firstOdds.pointSpread.away?.close?.line ?? firstOdds.pointSpread.away?.open?.line);
    const aDec = americanToDecimal(firstOdds.pointSpread.away?.close?.odds || firstOdds.pointSpread.away?.open?.odds);

    if (Number.isFinite(hLine) && hDec && hDec >= 1.01) {
      availableMarkets.push({
        id: `espn-${evId}-ah-h-${hLine}`,
        category: 'handicap',
        marketNameAr: 'الهاندكاب الآسيوي',
        marketNameEn: 'Asian Handicap',
        selectionAr: `${homeNameAr} (${hLine > 0 ? `+${hLine}` : hLine})`,
        selectionCode: `AH_HOME_${hLine > 0 ? `+${hLine}` : hLine}`,
        odds: hDec,
        line: hLine,
        isAsianSplit: Math.abs((hLine * 4) % 2) === 1,
        settlementRule: 'ASIAN_SPLIT',
        bookmakerName: bookie,
        impliedProbability: Math.round((1 / hDec) * 1000) / 10,
        updatedAt: nowIso,
      });
    }
    if (Number.isFinite(aLine) && aDec && aDec >= 1.01) {
      availableMarkets.push({
        id: `espn-${evId}-ah-a-${aLine}`,
        category: 'handicap',
        marketNameAr: 'الهاندكاب الآسيوي',
        marketNameEn: 'Asian Handicap',
        selectionAr: `${awayNameAr} (${aLine > 0 ? `+${aLine}` : aLine})`,
        selectionCode: `AH_AWAY_${aLine > 0 ? `+${aLine}` : aLine}`,
        odds: aDec,
        line: aLine,
        isAsianSplit: Math.abs((aLine * 4) % 2) === 1,
        settlementRule: 'ASIAN_SPLIT',
        bookmakerName: bookie,
        impliedProbability: Math.round((1 / aDec) * 1000) / 10,
        updatedAt: nowIso,
      });
    }
  }

  return availableMarkets;
}

/**
 * Fetches deep live details (rosters/lineups, real recent form, fresh pickcenter/odds)
 * for a single match when the user opens its MatchDetailPage.
 */
export async function enrichMatchDeepDetails(match: MatchData): Promise<MatchData> {
  if (!match.id.startsWith('espn-')) {
    return match;
  }

  const espnId = match.id.replace('espn-', '');
  const leagueCandidates = Array.from(new Set([match.leagueId || 'all', 'all']));

  let summaryJson: any = null;
  for (const lg of leagueCandidates) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(lg)}/summary?event=${encodeURIComponent(espnId)}`;
      const res = await fetch(url);
      if (res.ok) {
        summaryJson = await res.json();
        if (summaryJson && (summaryJson.rosters || summaryJson.boxscore || summaryJson.pickcenter || summaryJson.odds || summaryJson.header)) {
          break;
        }
      }
    } catch {
      // Try next league slug fallback
    }
  }

  if (!summaryJson) {
    return match;
  }

  const enriched: MatchData = {
    ...match,
    homeTeam: { ...match.homeTeam },
    awayTeam: { ...match.awayTeam },
    availableMarkets: [...match.availableMarkets],
    feedUpdatedAt: new Date().toISOString(),
  };

  // 1. Update live clock, status & scores from header if available
  const comp = summaryJson.header?.competitions?.[0];
  if (comp) {
    const state = comp.status?.type?.state;
    const statusName = comp.status?.type?.name || '';
    const period = comp.status?.period || 1;
    if (state === 'in' || state === 'post') {
      enriched.mode = 'LIVE';
      enriched.status =
        state === 'post' ? 'FT' : statusName === 'STATUS_HALFTIME' ? 'HT' : period >= 2 ? 'LIVE_2H' : 'LIVE_1H';
      enriched.minute = state === 'post' ? 90 : parseEspnClockMinute(comp.status?.displayClock) ?? enriched.minute;
      const comps = comp.competitors || [];
      const hC = comps.find((c: any) => c.homeAway === 'home');
      const aC = comps.find((c: any) => c.homeAway === 'away');
      if (hC && hC.score !== undefined) enriched.scoreHome = Number(hC.score);
      if (aC && aC.score !== undefined) enriched.scoreAway = Number(aC.score);
    }
  }

  // 1b. Update liveEvents from summaryJson.keyEvents or header.competitions[0].details
  let yellowH = enriched.liveStats?.yellowCardsHome ?? 0;
  let yellowA = enriched.liveStats?.yellowCardsAway ?? 0;
  let redH = enriched.liveStats?.redCardsHome ?? 0;
  let redA = enriched.liveStats?.redCardsAway ?? 0;
  let subH = enriched.liveStats?.substitutionsHome ?? 0;
  let subA = enriched.liveStats?.substitutionsAway ?? 0;

  const rawSummaryEvents: MatchEvent[] = [];
  const summaryKeyEvents = Array.isArray(summaryJson.keyEvents) ? summaryJson.keyEvents : [];
  const headerDetails = Array.isArray(comp?.details) ? comp.details : [];

  if (summaryKeyEvents.length > 0) {
    yellowH = 0; yellowA = 0; redH = 0; redA = 0; subH = 0; subA = 0;
    for (const ke of summaryKeyEvents) {
      const teamSide: 'HOME' | 'AWAY' = String(ke?.team?.id) === enriched.homeTeam.id ? 'HOME' : 'AWAY';
      const min = parseEspnClockMinute(ke?.clock?.displayValue) ?? 0;
      const typeStr = String(ke?.type?.text || ke?.text || '').toLowerCase();
      const player = ke?.participants?.[0]?.athlete?.displayName || ke?.athletesInvolved?.[0]?.displayName || ke?.type?.text || 'لاعب';
      const detailText = ke?.shortText || ke?.text || ke?.type?.text || '';

      if (typeStr.includes('yellow')) {
        if (teamSide === 'HOME') yellowH++; else yellowA++;
        rawSummaryEvents.push({ minute: min, type: 'YELLOW_CARD', team: teamSide, player, detail: detailText || 'بطاقة صفراء' });
      } else if (typeStr.includes('red')) {
        if (teamSide === 'HOME') redH++; else redA++;
        rawSummaryEvents.push({ minute: min, type: 'RED_CARD', team: teamSide, player, detail: detailText || 'بطاقة حمراء' });
      } else if (ke?.scoringPlay || typeStr.includes('goal') || typeStr.includes('penalty - scored')) {
        rawSummaryEvents.push({ minute: min, type: 'GOAL', team: teamSide, player, detail: detailText || 'هدف' });
      } else if (typeStr.includes('substitution')) {
        if (teamSide === 'HOME') subH++; else subA++;
        rawSummaryEvents.push({ minute: min, type: 'SUBSTITUTION', team: teamSide, player, detail: detailText || 'تبديل' });
      } else if (typeStr.includes('var')) {
        rawSummaryEvents.push({ minute: min, type: 'VAR', team: teamSide, player, detail: detailText || 'مراجعة VAR' });
      }
    }
  } else if (headerDetails.length > 0) {
    yellowH = 0; yellowA = 0; redH = 0; redA = 0; subH = 0; subA = 0;
    for (const d of headerDetails) {
      const teamSide: 'HOME' | 'AWAY' = String(d?.team?.id) === enriched.homeTeam.id ? 'HOME' : 'AWAY';
      const min = parseEspnClockMinute(d?.clock?.displayValue) ?? 0;
      const typeText = String(d?.type?.text || '').toLowerCase();
      const player = d?.athletesInvolved?.[0]?.displayName || d?.type?.text || 'لاعب';
      if (d?.yellowCard) {
        if (teamSide === 'HOME') yellowH++; else yellowA++;
        rawSummaryEvents.push({ minute: min, type: 'YELLOW_CARD', team: teamSide, player, detail: d?.type?.text || 'بطاقة صفراء' });
      } else if (d?.redCard) {
        if (teamSide === 'HOME') redH++; else redA++;
        rawSummaryEvents.push({ minute: min, type: 'RED_CARD', team: teamSide, player, detail: d?.type?.text || 'بطاقة حمراء' });
      } else if (d?.scoringPlay) {
        rawSummaryEvents.push({ minute: min, type: 'GOAL', team: teamSide, player, detail: d?.type?.text || 'هدف' });
      } else if (typeText.includes('substitution') || d?.substitution) {
        if (teamSide === 'HOME') subH++; else subA++;
        rawSummaryEvents.push({ minute: min, type: 'SUBSTITUTION', team: teamSide, player, detail: d?.type?.text || 'تبديل' });
      } else if (typeText.includes('var')) {
        rawSummaryEvents.push({ minute: min, type: 'VAR', team: teamSide, player, detail: d?.type?.text || 'مراجعة VAR' });
      }
    }
  }

  if (rawSummaryEvents.length > 0) {
    enriched.liveEvents = markNewEvents(enriched.id, rawSummaryEvents);
  }

  // 1c. Update liveStats from boxscore.teams
  const boxTeams = Array.isArray(summaryJson.boxscore?.teams) ? summaryJson.boxscore.teams : [];
  if (enriched.mode === 'LIVE' && boxTeams.length >= 2) {
    const hBox = boxTeams.find((t: any) => String(t?.team?.id) === enriched.homeTeam.id) || boxTeams[0];
    const aBox = boxTeams.find((t: any) => String(t?.team?.id) === enriched.awayTeam.id) || boxTeams[1];
    const hStats = hBox?.statistics || [];
    const aStats = aBox?.statistics || [];
    if (hStats.length > 0 || aStats.length > 0) {
      const possH = Math.round(getEspnStat(hStats, 'possessionPct')) || enriched.liveStats?.possessionHome || 50;
      const possA = Math.round(getEspnStat(aStats, 'possessionPct')) || (100 - possH);
      enriched.liveStats = {
        possessionHome: possH,
        possessionAway: possA,
        shotsHome: getEspnStat(hStats, 'totalShots') || enriched.liveStats?.shotsHome || 0,
        shotsAway: getEspnStat(aStats, 'totalShots') || enriched.liveStats?.shotsAway || 0,
        shotsOnTargetHome: getEspnStat(hStats, 'shotsOnTarget') || enriched.liveStats?.shotsOnTargetHome || 0,
        shotsOnTargetAway: getEspnStat(aStats, 'shotsOnTarget') || enriched.liveStats?.shotsOnTargetAway || 0,
        cornersHome: getEspnStat(hStats, 'wonCorners') || enriched.liveStats?.cornersHome || 0,
        cornersAway: getEspnStat(aStats, 'wonCorners') || enriched.liveStats?.cornersAway || 0,
        yellowCardsHome: getEspnStat(hStats, 'yellowCards') || yellowH,
        yellowCardsAway: getEspnStat(aStats, 'yellowCards') || yellowA,
        redCardsHome: getEspnStat(hStats, 'redCards') || redH,
        redCardsAway: getEspnStat(aStats, 'redCards') || redA,
        dangerousAttacksHome: getEspnStat(hStats, 'shotAssists') * 5 + getEspnStat(hStats, 'totalShots') * 2,
        dangerousAttacksAway: getEspnStat(aStats, 'shotAssists') * 5 + getEspnStat(aStats, 'totalShots') * 2,
        substitutionsHome: subH,
        substitutionsAway: subA,
      };
    }
  }

  // 2. Real Rosters / Lineups (used for Player To Score Anytime & confirmed starters)
  if (Array.isArray(summaryJson.rosters)) {
    for (const r of summaryJson.rosters) {
      const isHome = r.homeAway === 'home' || String(r.team?.id) === enriched.homeTeam.id;
      const targetTeam = isHome ? enriched.homeTeam : enriched.awayTeam;
      const players: string[] = [];
      const starters: string[] = [];
      for (const entry of r.roster || []) {
        const name = entry.athlete?.displayName || entry.athlete?.shortName;
        if (name) {
          players.push(name);
          if (entry.starter) starters.push(name);
        }
      }
      if (starters.length >= 7) {
        targetTeam.confirmedLineup = starters;
        enriched.lineupConfirmed = true;
      }
      if (players.length > 0) {
        targetTeam.expectedLineup = starters.length > 0 ? starters : players.slice(0, 11);
      }
    }
  }

  // 3. Real lastFiveGames form & goals averages from boxscore.form
  const formArr = summaryJson.boxscore?.form || summaryJson.lastFiveGames;
  if (Array.isArray(formArr)) {
    for (const fItem of formArr) {
      const isHome = String(fItem.team?.id) === enriched.homeTeam.id;
      const targetTeam = isHome ? enriched.homeTeam : enriched.awayTeam;
      const events = fItem.events || [];
      if (events.length > 0) {
        const results: ('W' | 'D' | 'L')[] = [];
        let scored = 0;
        let conceded = 0;
        for (const ev of events.slice(0, 5)) {
          const resChar = String(ev.gameResult || '').toUpperCase();
          if (resChar === 'W' || resChar === 'D' || resChar === 'L') {
            results.push(resChar);
          }
          const hS = Number(ev.homeTeamScore);
          const aS = Number(ev.awayTeamScore);
          if (Number.isFinite(hS) && Number.isFinite(aS)) {
            const teamWasHome = String(ev.homeTeamId) === targetTeam.id || String(ev.atVs).toLowerCase() === 'vs';
            scored += teamWasHome ? hS : aS;
            conceded += teamWasHome ? aS : hS;
          }
        }
        if (results.length > 0) {
          targetTeam.last5Form = results;
        }
        if (events.length > 0 && scored + conceded > 0) {
          targetTeam.avgGoalsScored = Number(Math.max(0.4, scored / Math.min(5, events.length)).toFixed(2));
          targetTeam.avgGoalsConceded = Number(Math.max(0.4, conceded / Math.min(5, events.length)).toFixed(2));
        }
      }
    }
  }

  // 4. Refresh real bookmaker odds from summary.pickcenter or summary.odds
  const oddsSources = [...(summaryJson.pickcenter || []), ...(summaryJson.odds || [])];
  if (oddsSources.length > 0) {
    const mergedMap = new Map<string, MarketOption>();
    for (const existing of enriched.availableMarkets) {
      mergedMap.set(existing.id, existing);
    }
    for (const src of oddsSources) {
      const extracted = extractEspnMarketsFromOddsObj(espnId, src, enriched.homeTeam.nameAr, enriched.awayTeam.nameAr);
      for (const mkt of extracted) {
        mergedMap.set(mkt.id, mkt);
      }
    }
    enriched.availableMarkets = Array.from(mergedMap.values());
  }

  applyOddsMovementTracking([enriched]);
  const cachedIdx = realMatchesCache.data.findIndex((x) => x.id === enriched.id);
  if (cachedIdx >= 0) {
    realMatchesCache.data[cachedIdx] = enriched;
  }
  return enriched;
}

export function clearRealMatchesCache(): void {
  realMatchesCache.data = [];
  realMatchesCache.fetchedAt = 0;
}
