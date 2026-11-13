import type { MarketCategoryId, SettlementRule } from '../../shared/types';

export interface BetExplainInput {
  selectionAr: string;
  selectionCode?: string;
  marketNameAr?: string;
  marketNameEn?: string;
  catalogIndex?: number;
  category?: MarketCategoryId;
  line?: number;
  homeTeamAr?: string;
  awayTeamAr?: string;
  settlementRule?: SettlementRule;
}

/**
 * Generates a concise, crystal-clear Arabic explanation of what the bet means
 * and the exact conditions required to WIN, PUSH (refund), or LOSE.
 */
export function buildBetExplanationAr(input: BetExplainInput): string {
  const code = (input.selectionCode || '').toUpperCase();
  const sel = input.selectionAr || '';
  const mEn = (input.marketNameEn || '').toLowerCase();
  const home = input.homeTeamAr || 'الفريق المضيف';
  const away = input.awayTeamAr || 'الفريق الضيف';

  // Extract numeric line from input.line or selection text if needed
  const numMatch = sel.match(/([+-]?\d+(?:\.\d+)?)/);
  const parsedLine = input.line ?? (numMatch ? Number(numMatch[1]) : undefined);

  // 1. 1X2 / Full Time / Match Result
  if (code === '1' || (input.catalogIndex === 1 && sel.includes(home)) || (input.catalogIndex === 5 && sel.includes(home))) {
    return `يربح إذا انتهت المباراة (90 دقيقة + بدل الضائع) بفوز ${home} بأي نتيجة؛ يخسر عند التعادل أو فوز ${away}.`;
  }
  if (code === '2' || (input.catalogIndex === 1 && sel.includes(away)) || (input.catalogIndex === 5 && sel.includes(away))) {
    return `يربح إذا انتهت المباراة (90 دقيقة + بدل الضائع) بفوز ${away} بأي نتيجة؛ يخسر عند التعادل أو فوز ${home}.`;
  }
  if (code === 'X' || (input.catalogIndex === 1 && sel.includes('التعادل')) || (input.catalogIndex === 5 && sel.includes('التعادل'))) {
    return `يربح إذا انتهى الوقت الأصلي بالتعادل (0-0، 1-1، إلخ)؛ يخسر عند فوز أي من الفريقين.`;
  }

  // 2. Double Chance
  if (code === '1X' || sel.includes('(1X)') || sel.includes('أو التعادل')) {
    const team = sel.includes(away) ? away : home;
    const opp = team === home ? away : home;
    return `يربح إذا فاز ${team} أو انتهت المباراة بالتعادل في الوقت الأصلي؛ يخسر فقط إذا فاز ${opp}.`;
  }
  if (code === 'X2' || sel.includes('(X2)')) {
    return `يربح إذا فاز ${away} أو انتهت المباراة بالتعادل في الوقت الأصلي؛ يخسر فقط إذا فاز ${home}.`;
  }
  if (code === '12' || sel.includes('(12)')) {
    return `يربح إذا فاز أي من الفريقين (${home} أو ${away}) في الوقت الأصلي؛ يخسر فقط عند التعادل.`;
  }

  // 3. Draw No Bet (DNB)
  if (code.includes('DNB') || sel.includes('DNB') || sel.includes('التعادل لا رهان')) {
    const team = code.includes('AWAY') || sel.includes(away) ? away : home;
    return `يربح إذا فاز ${team}، ويُسترد كامل مبلغ الرهان (Push) إذا انتهى الوقت الأصلي بالتعادل.`;
  }

  // 4. Corners Markets
  if (input.category === 'corners' || input.catalogIndex === 25 || input.catalogIndex === 26 || input.catalogIndex === 27 || sel.includes('ركني')) {
    if (input.catalogIndex === 27 || sel.includes('أكثر ركنيات') || code.includes('MOST_CORNERS')) {
      const team = sel.includes(away) || code.includes('AWAY') ? away : home;
      return `يربح إذا نفّذ ${team} عدد ركنيات أكبر من خصمه طوال الـ 90 دقيقة (تُحسب الركنيات المنفذة فقط).`;
    }
    if (input.catalogIndex === 26 || sel.includes('هاندكاب الركنيات')) {
      return `تُضاف قيمة الهاندكاب لركنيات الفريق المختار؛ يربح إذا تفوق مجموع ركنياته المعدل على الخصم.`;
    }
    if (parsedLine !== undefined) {
      const isOver = code.includes('OVER') || sel.includes('أكثر');
      const minNeeded = Math.floor(parsedLine) + 1;
      const maxAllowed = Math.ceil(parsedLine) - 1;
      return isOver
        ? `يربح عند تنفيذ ${minNeeded} ركنية فأكثر إجمالًا للفريقين في الوقت الأصلي (الركنية المحتسبة دون تنفيذ لا تُحسب).`
        : `يربح إذا توقف مجموع ركنيات الفريقين عند ${maxAllowed} ركنية أو أقل حتى صافرة النهاية.`;
    }
  }

  // 5. Cards Markets
  if (input.category === 'cards' || input.catalogIndex === 28 || input.catalogIndex === 29 || sel.includes('بطاقة')) {
    if (input.catalogIndex === 29 || sel.includes('حمراء')) {
      const isNo = sel.includes('لا');
      return isNo
        ? `يربح إذا انتهى الوقت الأصلي دون إشهار أي بطاقة حمراء (مباشرة أو صفراء ثانية) لأي لاعب داخل الملعب.`
        : `يربح إذا أُشهرت بطاقة حمراء واحدة على الأقل خلال الوقت الأصلي للمباراة.`;
    }
    if (parsedLine !== undefined) {
      const isOver = code.includes('OVER') || sel.includes('أكثر');
      const minNeeded = Math.floor(parsedLine) + 1;
      const maxAllowed = Math.ceil(parsedLine) - 1;
      return isOver
        ? `يربح عند إشهار ${minNeeded} بطاقات صفراء فأكثر إجمالًا للفريقين في الوقت الأصلي.`
        : `يربح إذا لم يتجاوز مجموع البطاقات الصفراء في المباراة ${maxAllowed} بطاقات.`;
    }
  }

  // 6. Shots on Target
  if (input.category === 'shots' || code.includes('SOT') || sel.includes('تسديدة')) {
    if (parsedLine !== undefined) {
      const isOver = code.includes('OVER') || sel.includes('أكثر') || sel.includes('+');
      const minNeeded = Math.floor(parsedLine) + 1;
      return isOver
        ? `يربح عند تسجيل ${minNeeded} تسديدات بين الخشبات الثلاث فأكثر وفق الإحصاء الرسمي للوقت الأصلي.`
        : `يربح إذا بقيت التسديدات على المرمى أقل من ${parsedLine} حتى نهاية الوقت الأصلي.`;
    }
  }

  // 7. Player Props
  if (input.category === 'player_props' || input.catalogIndex === 30 || mEn.includes('player') || sel.includes('يسجل في أي وقت')) {
    return `يربح إذا سجّل اللاعب المحدد هدفًا واحدًا على الأقل في الوقت الأصلي؛ يُلغى الرهان (Void) إذا لم يبدأ أساسيًا حسب القاعدة.`;
  }

  // 8. Half Time / Full Time & Half Markets
  if (input.catalogIndex === 6 || mEn.includes('half time / full time')) {
    return `رهان مركّب: يربح فقط إذا تحقق الترتيب المحدد لنتيجة الشوط الأول عند الدقيقة 45 ونتيجة نهاية المباراة عند الدقيقة 90 معًا.`;
  }
  if (input.catalogIndex === 4 || code.startsWith('1H_') || sel.includes('الشوط الأول') || sel.includes('الشوط 1')) {
    if (parsedLine !== undefined) {
      const isOver = code.includes('OVER') || sel.includes('أكثر');
      const minNeeded = Math.floor(parsedLine) + 1;
      return isOver
        ? `يربح إذا شَهد الشوط الأول وحده ${minNeeded} هدف فأكثر قبل صافرة الاستراحة.`
        : `يربح إذا انتهى الشوط الأول بـ ${Math.floor(parsedLine)} أهداف أو أقل (بما يشمل 0-0 للخط 0.5).`;
    }
    return `يُحسم هذا السوق بنهاية الشوط الأول فقط (45 دقيقة + بدل الضائع) ولا يتأثر بأحداث الشوط الثاني.`;
  }

  // 9. Asian & European Handicap
  if (input.category === 'handicap' || input.catalogIndex === 12 || input.catalogIndex === 13 || input.catalogIndex === 14 || sel.includes('هاندكاب')) {
    if (input.catalogIndex === 13 || input.catalogIndex === 14 || sel.includes('أوروبي')) {
      return `يُضاف فارق الأهداف المحدد لرصيد الفريق قبل التسوية؛ يربح إذا ظل متفوقًا بعد الإضافة (لا يوجد استرداد في الهاندكاب الأوروبي).`;
    }
    if (parsedLine !== undefined) {
      const isQuarter = Math.abs((parsedLine * 4) % 2) === 1;
      if (isQuarter) {
        return `خط آسيوي رُبعي (${parsedLine > 0 ? `+${parsedLine}` : parsedLine}): ينقسم الرهان لنصفين متجاورين، ويدعم الربح الكامل أو نصف الربح + استرداد النصف، أو نصف الخسارة عند التطابق.`;
      }
      if (Number.isInteger(parsedLine)) {
        return `خط آسيوي صحيح (${parsedLine > 0 ? `+${parsedLine}` : parsedLine}): تُضاف القيمة لنتيجة الفريق؛ يربح عند التفوق، ويُسترد كامل الرهان (Push) عند التعادل بعد الإضافة.`;
      }
      return parsedLine > 0
        ? `يبدأ الفريق بأفضلية +${parsedLine} هدف؛ يربح إذا فاز أو تعادل (أو خسر بفارق أقل من ${parsedLine} هدف).`
        : `يبدأ الفريق بعجز ${parsedLine} هدف؛ يربح فقط إذا فاز بفارق أكبر من ${Math.abs(parsedLine)} هدف.`;
    }
  }

  // 10. Both Teams To Score (BTTS)
  if (input.category === 'btts' || input.catalogIndex === 10 || code.includes('BTTS') || sel.includes('الفريقين') || sel.includes('الفريقان يسجلان')) {
    const isNo = code === 'BTTS_NO' || sel.includes(': لا');
    return isNo
      ? `يربح إذا فشل أحد الفريقين على الأقل في التسجيل (انتهاء اللقاء بشباك نظيفة لطرف واحد أو 0-0).`
      : `يربح إذا هزّ كل من ${home} و${away} الشباك مرة واحدة على الأقل في الوقت الأصلي (النتيجة 1-1 فأعلى).`;
  }

  // 11. Team / Individual Total
  if (input.catalogIndex === 8 || input.catalogIndex === 16 || code.includes('HOME_OVER') || code.includes('AWAY_OVER')) {
    const targetGoals = parsedLine !== undefined ? Math.floor(parsedLine) + 1 : 1;
    const team = sel.includes(away) || code.includes('AWAY') ? away : home;
    return `يربح إذا أحرز ${targetGoals === 1 ? team + ' هدفًا واحدًا على الأقل' : team + ` ${targetGoals} أهداف فأكثر`} في الوقت الأصلي بغض النظر عن النتيجة النهائية.`;
  }

  // 12. Total Goals Over/Under
  if (input.category === 'total_goals' || input.catalogIndex === 7 || code.startsWith('OVER_') || code.startsWith('UNDER_') || sel.includes('هدف')) {
    if (sel.includes('كلا الشوطين') || input.catalogIndex === 23) {
      return `يربح إذا سُجّل هدف واحد على الأقل في الشوط الأول وهدف واحد على الأقل في الشوط الثاني.`;
    }
    if (input.catalogIndex === 24) {
      return `يربح إذا تمكّن الفريق المحدد من التسجيل داخل الشوط الأول وداخل الشوط الثاني كلٍ على حدة.`;
    }
    if (input.catalogIndex === 15 || sel.includes('نطاق')) {
      return `يربح إذا وقع مجموع أهداف الفريقين في نهاية الـ 90 دقيقة ضمن النطاق العددي المحدد بالضبط.`;
    }
    if (input.catalogIndex === 17 || sel.includes('أول فريق يسجل')) {
      return `يربح إذا افتتح الفريق المختار التسجيل أولاً في المباراة؛ يخسر إذا سجل الخصم أولاً أو انتهت 0-0.`;
    }
    if (input.catalogIndex === 18 || sel.includes('آخر فريق يسجل')) {
      return `يربح إذا كان آخر هدف مُسجل في الوقت الأصلي من نصيب الفريق المختار (حتى لو فاز الخصم).`;
    }
    if (parsedLine !== undefined) {
      const isOver = code.includes('OVER') || sel.includes('أكثر');
      if (Number.isInteger(parsedLine)) {
        return isOver
          ? `خط آسيوي صحيح: يربح عند ${parsedLine + 1} أهداف فأكثر، ويُسترد الرهان بالكامل إذا انتهى المجموع ${parsedLine} بالضبط.`
          : `خط آسيوي صحيح: يربح عند ${parsedLine - 1} أهداف أو أقل، ويُسترد الرهان إذا انتهى المجموع ${parsedLine} بالضبط.`;
      }
      const minNeeded = Math.floor(parsedLine) + 1;
      const maxAllowed = Math.floor(parsedLine);
      return isOver
        ? `يربح إذا بلغ إجمالي أهداف الفريقين ${minNeeded} أهداف فأكثر في الوقت الأصلي؛ يخسر عند ${maxAllowed} أو أقل.`
        : `يربح إذا انتهى الوقت الأصلي بمجموع ${maxAllowed} ${maxAllowed <= 1 ? 'هدف' : 'أهداف'} أو أقل؛ يخسر إذا سُجّل ${minNeeded} فأكثر.`;
    }
  }

  // 13. Special Markets (Odd/Even, Correct Score, Next Goal, No Goal, Winning Margin, Exact Goals)
  if (input.catalogIndex === 9 || sel.includes('زوجي') || sel.includes('فردي')) {
    return sel.includes('زوجي')
      ? `يربح إذا كان مجموع أهداف المباراة النهائي رقمًا زوجيًا (0-0، 1-1، 2-0، 2-2، 3-1...).`
      : `يربح إذا كان مجموع أهداف المباراة النهائي رقمًا فرديًا (1-0، 2-1، 3-0...).`;
  }
  if (input.catalogIndex === 11 || code.startsWith('CS_') || sel.includes('النتيجة الصحيحة')) {
    return `يربح فقط إذا انتهى الوقت الأصلي بهذه النتيجة الدقيقة تمامًا؛ أي هدف إضافي أو ناقص يُخسر الرهان.`;
  }
  if (input.catalogIndex === 19 || sel.includes('الهدف التالي') || sel.includes('الهدف رقم')) {
    return `يختص بالهدف القادم فقط في زمن المباراة المباشر؛ يربح بمجرد تسجيل الفريق المختار للهدف التالي (أو عدم تسجيل أي هدف).`;
  }
  if (input.catalogIndex === 20 || sel.includes('عدم تسجيل')) {
    return `يربح إذا بقيت الشباك ساكنة دون أي أهداف إضافية منذ لحظة الرهان وحتى صافرة النهاية.`;
  }
  if (input.catalogIndex === 21 || sel.includes('فارق')) {
    return `يربح إذا انتهت المباراة بفارق الأهداف المحدد بالضبط بين الفريقين في الوقت الأصلي.`;
  }
  if (input.catalogIndex === 22 || sel.includes('العدد الدقيق')) {
    return `يربح فقط إذا تطابق مجموع أهداف الفريقين مع الرقم المحدد بالضبط عند الدقيقة 90.`;
  }
  if (code.includes('WIN_TO_NIL') || sel.includes('شباك نظيفة')) {
    return `يربح فقط إذا فاز الفريق المحدد وحافظ على نظافة شباكه (لم يستقبل أي هدف طوال الـ 90 دقيقة).`;
  }

  if (input.settlementRule === 'FIRST_HALF_ONLY') {
    return `يُقيّم هذا الخيار على أحداث ونتيجة الشوط الأول فقط (45 دقيقة + بدل الضائع).`;
  }
  if (input.settlementRule === 'ASIAN_SPLIT') {
    return `سوق آسيوي يدعم الاسترداد أو التسوية الجزئية (نصف ربح/نصف خسارة) حسب فارق التطابق مع الخط.`;
  }
  return `يُحسم هذا الرهان وفق النتيجة والإحصاء الرسمي في الوقت الأصلي للمباراة (90 دقيقة + بدل الضائع).`;
}
