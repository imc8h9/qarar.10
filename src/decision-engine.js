/* ============================================================================
 * QARAR — FINANCIAL DECISION IMPACT ENGINE
 * محرك أثر القرار المالي — منصة قرار
 * ============================================================================
 *
 * قلب المشروع. هذا الملف يحسب الأرقام. لا شيء آخر يحسبها.
 *
 * القواعد الصارمة (غير قابلة للتفاوض):
 *   1. حتمي تمامًا (Deterministic): نفس المدخلات ⇒ نفس المخرجات، دائمًا.
 *   2. لا Math.random()      — صفر عشوائية.
 *   3. لا new Date()         — التاريخ يُمرَّر كمُدخل (asOfDate).
 *   4. لا استدعاء AI         — الذكاء الاصطناعي يستدعي هذا المحرك، لا العكس.
 *   5. لا لمس DOM            — المحرك لا يعرف شيئًا عن الواجهة.
 *   6. لا حفظ بيانات         — المحرك يحسب فقط، طبقة أخرى تحفظ.
 *   7. كل المبالغ بالهللة    — أعداد صحيحة فقط. لا أرقام عشرية للمال.
 *
 * لماذا الهللة؟
 *   في جافاسكربت:  0.1 + 0.2 === 0.3  →  false  (!!)
 *   لو حسبنا المال بأرقام عشرية، سيظهر أمام الحكام رقم مثل 1199.9999999998
 *   الحل: نخزن ونحسب بالهللة (عدد صحيح)، ونقسم على 100 عند العرض فقط.
 *   1 ريال = 100 هللة   |   3,000 ريال = 300,000 هللة
 *
 * الاختبار المرجعي (سيناريو اللابتوب):
 *   4,200 − 3,000 = 1,200        ← الرصيد بعد الشراء
 *   1,200 − 1,130 =    70        ← أقل رصيد قبل الراتب
 *   4,200 − 1,130 − 1,500 = 1,570 ← أقصى مبلغ آمن
 *   هذه الأرقام تُحسب هنا. لا تُكتب يدويًا في أي مكان.
 * ========================================================================= */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────────────
   * أدوات المال (Money) — كل شيء بالهللة
   * ─────────────────────────────────────────────────────────────────────── */

  const Money = {
    /** ريال → هللة  (3000 → 300000) */
    fromRiyal(riyal) {
      return Math.round(Number(riyal) * 100);
    },
    /** هللة → ريال  (300000 → 3000) */
    toRiyal(halala) {
      return Number(halala) / 100;
    },
    /** هللة → نص عربي منسق  (300000 → "٣٬٠٠٠") */
    format(halala) {
      const riyal = Money.toRiyal(halala);
      return riyal.toLocaleString('ar-SA', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    },
    /** هللة → نص مع العملة */
    formatWithCurrency(halala) {
      return Money.format(halala) + ' ر.س';
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * أدوات التاريخ — بدون new Date() داخل الحسابات
   * كل التواريخ نصوص بصيغة "YYYY-MM-DD"
   * ─────────────────────────────────────────────────────────────────────── */

  const DateUtil = {
    /** "2026-07-12" → عدد الأيام منذ حقبة ثابتة (للمقارنة والحساب) */
    toDayNumber(iso) {
      const [y, m, d] = String(iso).split('-').map(Number);
      // Date.UTC دالة نقية — لا تقرأ ساعة النظام، تحسب فقط
      return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
    },
    /** عدد الأيام → "YYYY-MM-DD" */
    fromDayNumber(n) {
      const dt = new Date(n * 86400000); // بناء من رقم مُمرَّر، لا من الساعة
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },
    /** أضف أيامًا إلى تاريخ */
    addDays(iso, days) {
      return DateUtil.fromDayNumber(DateUtil.toDayNumber(iso) + days);
    },
    /** الفرق بالأيام بين تاريخين (b − a) */
    diffDays(a, b) {
      return DateUtil.toDayNumber(b) - DateUtil.toDayNumber(a);
    },
    /** تنسيق عربي للعرض: "2026-07-18" → "١٨ يوليو ٢٠٢٦" */
    formatArabic(iso) {
      const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                      'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      const [y, m, d] = String(iso).split('-').map(Number);
      return `${Number(d).toLocaleString('ar-SA')} ${months[m - 1]}`;
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * ثوابت المحرك
   * ─────────────────────────────────────────────────────────────────────── */

  const RISK = {
    LOW:      'low',
    MEDIUM:   'medium',
    HIGH:     'high',
    CRITICAL: 'critical'
  };

  const RISK_LABEL_AR = {
    low:      'منخفض',
    medium:   'متوسط',
    high:     'مرتفع',
    critical: 'حرج'
  };

  const RECOMMENDATION = {
    PROCEED:           'proceed',
    PROCEED_CAUTION:   'proceed_with_caution',
    REDUCE_AMOUNT:     'reduce_amount',
    WAIT_FOR_SALARY:   'wait_for_salary',
    DELAY_TO_DATE:     'delay_to_date',
    CONVERT_TO_GOAL:   'convert_to_goal',
    NOT_ADVISED:       'not_advised'
  };

  const RECOMMENDATION_LABEL_AR = {
    proceed:              'نفّذ القرار',
    proceed_with_caution: 'نفّذه بحذر',
    reduce_amount:        'قلّل المبلغ',
    wait_for_salary:      'انتظر نزول الراتب',
    delay_to_date:        'أجّله إلى تاريخ لاحق',
    convert_to_goal:      'حوّله إلى هدف ادخار',
    not_advised:          'لا يُنصح به حاليًا'
  };

  /** أفق التحليل: كم يومًا ننظر إلى الأمام */
  const HORIZON_DAYS = 90;

  /** عتبة "متوسط الخطر": الرصيد قريب من الحد الآمن (ضمن 25% فوقه) */
  const CAUTION_MULTIPLIER = 1.25;

  /* ─────────────────────────────────────────────────────────────────────────
   * التحقق من صحة المدخلات
   * ─────────────────────────────────────────────────────────────────────── */

  function validateInput(input) {
    const errors = [];

    if (!input || typeof input !== 'object') {
      return ['المدخلات غير صالحة'];
    }
    if (!input.asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.asOfDate)) {
      errors.push('تاريخ التحليل (asOfDate) مطلوب بصيغة YYYY-MM-DD');
    }
    if (!Number.isInteger(input.currentBalance)) {
      errors.push('الرصيد الحالي يجب أن يكون عددًا صحيحًا بالهللة');
    }
    if (!Number.isInteger(input.safeFloor) || input.safeFloor < 0) {
      errors.push('الحد الآمن يجب أن يكون عددًا صحيحًا غير سالب بالهللة');
    }
    if (input.newDecision) {
      const d = input.newDecision;
      if (!Number.isInteger(d.amount) || d.amount <= 0) {
        errors.push('مبلغ القرار يجب أن يكون عددًا صحيحًا موجبًا بالهللة');
      }
      if (!d.targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(d.targetDate)) {
        errors.push('تاريخ القرار مطلوب بصيغة YYYY-MM-DD');
      }
      if (d.paymentMode === 'installment') {
        if (!Number.isInteger(d.months) || d.months < 1) {
          errors.push('عدد أشهر التقسيط يجب أن يكون عددًا صحيحًا ≥ 1');
        }
      }
    }
    return errors;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * بناء قائمة الأحداث المالية المستقبلية
   * (فواتير + التزامات + راتب + القرار الجديد)
   * ─────────────────────────────────────────────────────────────────────── */

  function buildEvents(input) {
    const events = [];
    const start = DateUtil.toDayNumber(input.asOfDate);
    const end   = start + HORIZON_DAYS;

    // ── 1. الفواتير والالتزامات القادمة (خصم) ──
    (input.obligations || []).forEach(function (o) {
      const day = DateUtil.toDayNumber(o.dueDate);
      if (day >= start && day <= end) {
        events.push({
          day:        day,
          date:       o.dueDate,
          type:       'obligation',
          label:      o.name,
          category:   o.category || 'فواتير',
          amount:     -Math.abs(o.amount),   // خصم = سالب
          isEssential: o.isEssential !== false, // افتراضيًا أساسي
          icon:       o.icon || '📄'
        });
      }
    });

    // ── 2. الراتب (إضافة) ──
    if (input.nextSalaryDate && Number.isInteger(input.monthlyIncome) && input.monthlyIncome > 0) {
      let salaryDay = DateUtil.toDayNumber(input.nextSalaryDate);
      // الرواتب المتكررة داخل أفق التحليل (كل ~30 يومًا)
      while (salaryDay <= end) {
        if (salaryDay >= start) {
          events.push({
            day:        salaryDay,
            date:       DateUtil.fromDayNumber(salaryDay),
            type:       'income',
            label:      'الراتب الشهري',
            category:   'دخل',
            amount:     Math.abs(input.monthlyIncome),  // دخل = موجب
            isEssential: false,
            icon:       '💰'
          });
        }
        salaryDay += 30;
      }
    }

    // ── 3. القرار الجديد (خصم — مرة واحدة أو أقساط) ──
    if (input.newDecision) {
      const d = input.newDecision;
      const decisionDay = DateUtil.toDayNumber(d.targetDate);

      if (d.paymentMode === 'installment' && d.months >= 1) {
        // التقسيط: نوزّع المبلغ على عدد الأشهر
        const monthly = Math.round(d.amount / d.months);
        for (let i = 0; i < d.months; i++) {
          const day = decisionDay + (i * 30);
          if (day >= start && day <= end) {
            events.push({
              day:        day,
              date:       DateUtil.fromDayNumber(day),
              type:       'decision',
              label:      `${d.name || 'القرار'} — قسط ${(i + 1).toLocaleString('ar-SA')}/${d.months.toLocaleString('ar-SA')}`,
              category:   d.type || 'قرار',
              amount:     -monthly,
              isEssential: !!d.isEssential,
              isDecision: true,
              icon:       '🎯'
            });
          }
        }
      } else {
        // دفعة واحدة
        if (decisionDay >= start && decisionDay <= end) {
          events.push({
            day:        decisionDay,
            date:       d.targetDate,
            type:       'decision',
            label:      d.name || 'القرار الجديد',
            category:   d.type || 'قرار',
            amount:     -Math.abs(d.amount),
            isEssential: !!d.isEssential,
            isDecision: true,
            icon:       '🎯'
          });
        }
      }
    }

    // ترتيب زمني.
    // ملاحظة مهمة: عند تساوي اليوم، نضع الخصومات (السالب) قبل الدخل (الموجب).
    // لماذا؟ لأن هذا هو الافتراض المتحفظ (worst case) — يمنعنا من إظهار
    // وضع مالي أفضل من الحقيقة. الأمان المالي أهم من التفاؤل.
    events.sort(function (a, b) {
      if (a.day !== b.day) return a.day - b.day;
      return a.amount - b.amount;   // السالب أولًا
    });

    return events;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * بناء الخط الزمني: نمشي يومًا بيوم ونحسب الرصيد بعد كل حدث
   * ─────────────────────────────────────────────────────────────────────── */

  function buildTimeline(startingBalance, events) {
    let balance = startingBalance;
    const timeline = [];

    events.forEach(function (ev) {
      const balanceBefore = balance;
      balance = balance + ev.amount;    // الخصم سالب، الدخل موجب

      timeline.push({
        date:          ev.date,
        day:           ev.day,
        label:         ev.label,
        category:      ev.category,
        icon:          ev.icon,
        type:          ev.type,
        amount:        ev.amount,
        balanceBefore: balanceBefore,
        balanceAfter:  balance,
        isEssential:   ev.isEssential,
        isDecision:    !!ev.isDecision
      });
    });

    return timeline;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * تحليل الخط الزمني: أقل رصيد، متى، وهل توجد فواتير غير مغطاة
   * ─────────────────────────────────────────────────────────────────────── */

  function analyzeTimeline(startingBalance, timeline, safeFloor, salaryDate, asOfDate) {
    let minimumBalance     = startingBalance;
    let minimumBalanceDate = asOfDate;
    let goesNegative       = startingBalance < 0;
    let daysBelowSafeFloor = 0;
    const unfundedBills    = [];

    const salaryDay = salaryDate ? DateUtil.toDayNumber(salaryDate) : null;
    let balanceBeforeSalary = startingBalance;
    let sawSalary = false;

    timeline.forEach(function (t) {
      // تتبّع أقل رصيد على الإطلاق
      if (t.balanceAfter < minimumBalance) {
        minimumBalance     = t.balanceAfter;
        minimumBalanceDate = t.date;
      }

      if (t.balanceAfter < 0) {
        goesNegative = true;
      }

      if (t.balanceAfter < safeFloor) {
        daysBelowSafeFloor++;
      }

      // فاتورة أساسية لا يغطيها الرصيد المتاح قبلها
      if (t.isEssential && t.amount < 0 && t.balanceBefore < Math.abs(t.amount)) {
        unfundedBills.push({
          name:   t.label,
          amount: Math.abs(t.amount),
          date:   t.date,
          shortfall: Math.abs(t.amount) - t.balanceBefore
        });
      }

      // الرصيد المتبقي قبل نزول الراتب (أهم رقم في سيناريو اللابتوب)
      if (salaryDay !== null && !sawSalary) {
        if (t.type === 'income' && t.day >= salaryDay) {
          sawSalary = true;                       // وصلنا الراتب — توقف
        } else {
          balanceBeforeSalary = t.balanceAfter;   // ما زلنا قبله
        }
      }
    });

    return {
      minimumBalance:      minimumBalance,
      minimumBalanceDate:  minimumBalanceDate,
      goesNegative:        goesNegative,
      daysBelowSafeFloor:  daysBelowSafeFloor,
      unfundedBills:       unfundedBills,
      balanceBeforeSalary: salaryDay !== null ? balanceBeforeSalary : minimumBalance
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * تحديد مستوى الخطر — قواعد صريحة وقابلة للاختبار
   * ─────────────────────────────────────────────────────────────────────── */

  function assessRisk(analysis, safeFloor) {
    const reasons = [];
    let level = RISK.LOW;

    // حرج — الرصيد يصبح سالبًا
    if (analysis.goesNegative) {
      level = RISK.CRITICAL;
      reasons.push({
        code: 'NEGATIVE_BALANCE',
        text: 'الرصيد سيصبح سالبًا خلال الفترة القادمة.'
      });
    }

    // حرج — فاتورة أساسية لن تُغطى
    if (analysis.unfundedBills.length > 0) {
      level = RISK.CRITICAL;
      analysis.unfundedBills.forEach(function (b) {
        reasons.push({
          code: 'UNFUNDED_BILL',
          text: `فاتورة أساسية (${b.name}) بمبلغ ${Money.formatWithCurrency(b.amount)} `
              + `قد لا تُغطى بالرصيد المتاح في ${DateUtil.formatArabic(b.date)}.`
        });
      });
    }

    // مرتفع — أقل رصيد تحت الحد الآمن
    if (level !== RISK.CRITICAL && analysis.minimumBalance < safeFloor) {
      level = RISK.HIGH;
      const gap = safeFloor - analysis.minimumBalance;
      reasons.push({
        code: 'BELOW_SAFE_FLOOR',
        text: `أقل رصيد متوقع (${Money.formatWithCurrency(analysis.minimumBalance)}) `
            + `أقل من حدك الآمن (${Money.formatWithCurrency(safeFloor)}) `
            + `بفارق ${Money.formatWithCurrency(gap)}.`
      });
    }

    // متوسط — الرصيد قريب من الحد الآمن (ضمن 25% فوقه)
    if (level === RISK.LOW && analysis.minimumBalance < safeFloor * CAUTION_MULTIPLIER) {
      level = RISK.MEDIUM;
      reasons.push({
        code: 'NEAR_SAFE_FLOOR',
        text: `أقل رصيد متوقع قريب من حدك الآمن — الهامش ضيق ولا يحتمل مفاجآت.`
      });
    }

    // منخفض
    if (level === RISK.LOW) {
      reasons.push({
        code: 'SAFE',
        text: 'الرصيد المتوقع يبقى فوق حدك الآمن طوال الفترة القادمة.'
      });
    }

    return { level: level, reasons: reasons };
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * حساب أقصى مبلغ آمن
   *
   * المنطق: نأخذ الرصيد الحالي، ونطرح كل الالتزامات القادمة قبل الراتب،
   * ونطرح الحد الآمن. الباقي = ما يمكن إنفاقه بأمان الآن.
   *
   * سيناريو اللابتوب:  4,200 − 1,130 − 1,500 = 1,570 ريال
   * هذا الرقم يُحسب هنا — لا يُكتب يدويًا في أي مكان.
   * ─────────────────────────────────────────────────────────────────────── */

  function calculateSafeMaximum(input, events) {
    const start = DateUtil.toDayNumber(input.asOfDate);
    const salaryDay = input.nextSalaryDate
      ? DateUtil.toDayNumber(input.nextSalaryDate)
      : start + 30;

    // مجموع الالتزامات (غير القرار) بين اليوم وموعد الراتب
    let obligationsBeforeSalary = 0;
    events.forEach(function (ev) {
      if (ev.isDecision) return;               // نستثني القرار نفسه
      if (ev.amount >= 0) return;              // نستثني الدخل
      if (ev.day >= start && ev.day <= salaryDay) {
        obligationsBeforeSalary += Math.abs(ev.amount);
      }
    });

    const safeMax = input.currentBalance - obligationsBeforeSalary - input.safeFloor;

    return {
      safeMaximumAmount:       Math.max(0, safeMax),
      obligationsBeforeSalary: obligationsBeforeSalary
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * إيجاد أفضل تاريخ لتنفيذ القرار
   * نجرّب التنفيذ في كل تاريخ ونختار أول تاريخ يصبح فيه الخطر مقبولًا
   * ─────────────────────────────────────────────────────────────────────── */

  function findRecommendedDate(input) {
    if (!input.newDecision) return null;

    const start = DateUtil.toDayNumber(input.asOfDate);

    // نجرّب كل يوم حتى 60 يومًا للأمام
    for (let offset = 0; offset <= 60; offset++) {
      const tryDate = DateUtil.fromDayNumber(start + offset);

      const trial = Object.assign({}, input, {
        newDecision: Object.assign({}, input.newDecision, { targetDate: tryDate })
      });

      const events   = buildEvents(trial);
      const timeline = buildTimeline(trial.currentBalance, events);
      const analysis = analyzeTimeline(
        trial.currentBalance, timeline, trial.safeFloor,
        trial.nextSalaryDate, trial.asOfDate
      );
      const risk = assessRisk(analysis, trial.safeFloor);

      // أول تاريخ يصبح فيه الخطر منخفضًا أو متوسطًا
      if (risk.level === RISK.LOW || risk.level === RISK.MEDIUM) {
        return {
          date:      tryDate,
          daysFromNow: offset,
          riskLevel: risk.level
        };
      }
    }

    return null;   // لا يوجد تاريخ آمن خلال 60 يومًا
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * بناء البدائل
   * ─────────────────────────────────────────────────────────────────────── */

  function buildAlternatives(input, riskLevel, safeMax, recommendedDate) {
    const alternatives = [];
    const d = input.newDecision;
    if (!d) return alternatives;

    const isRisky = (riskLevel === RISK.HIGH || riskLevel === RISK.CRITICAL);

    // 1. تأجيل إلى ما بعد الراتب
    if (isRisky && input.nextSalaryDate) {
      const daysToSalary = DateUtil.diffDays(input.asOfDate, input.nextSalaryDate);
      alternatives.push({
        id:    'delay_to_salary',
        icon:  '📅',
        title: 'تأجيل إلى ما بعد الراتب',
        description: `انتظر ${daysToSalary.toLocaleString('ar-SA')} أيام حتى نزول الراتب `
                   + `(${DateUtil.formatArabic(input.nextSalaryDate)}) — عندها يصبح القرار آمنًا.`,
        newDate: DateUtil.addDays(input.nextSalaryDate, 0),
        impact: 'يزيل الخطر تمامًا'
      });
    }

    // 2. تقليل المبلغ إلى الحد الآمن
    if (isRisky && safeMax > 0 && safeMax < d.amount) {
      alternatives.push({
        id:    'reduce_amount',
        icon:  '✂️',
        title: 'تقليل المبلغ',
        description: `أقصى مبلغ يمكنك دفعه الآن بأمان هو `
                   + `${Money.formatWithCurrency(safeMax)} بدل ${Money.formatWithCurrency(d.amount)}.`,
        newAmount: safeMax,
        impact: `توفير ${Money.formatWithCurrency(d.amount - safeMax)}`
      });
    }

    // 3. تحويل إلى هدف ادخار
    if (isRisky) {
      const months = 3;
      const monthly = Math.ceil(d.amount / months);
      alternatives.push({
        id:    'convert_to_goal',
        icon:  '🎯',
        title: 'تحويل إلى هدف ادخار',
        description: `ادّخر ${Money.formatWithCurrency(monthly)} شهريًا لمدة `
                   + `${months.toLocaleString('ar-SA')} أشهر للوصول إلى `
                   + `${Money.formatWithCurrency(d.amount)} دون ضغط مالي.`,
        monthlyAmount: monthly,
        months: months,
        impact: 'صفر خطر'
      });
    }

    // 4. أفضل موعد مقترح
    if (isRisky && recommendedDate && recommendedDate.daysFromNow > 0) {
      alternatives.push({
        id:    'delay_to_date',
        icon:  '⏳',
        title: 'أفضل موعد للتنفيذ',
        description: `${DateUtil.formatArabic(recommendedDate.date)} — `
                   + `بعد ${recommendedDate.daysFromNow.toLocaleString('ar-SA')} يومًا من الآن.`,
        newDate: recommendedDate.date,
        impact: `الخطر يصبح: ${RISK_LABEL_AR[recommendedDate.riskLevel]}`
      });
    }

    // 5. إلغاء القرار
    if (isRisky) {
      alternatives.push({
        id:    'cancel',
        icon:  '✕',
        title: 'إلغاء القرار',
        description: 'لا تنفّذ القرار حاليًا وأبقِ وضعك المالي كما هو.',
        impact: 'لا تغيير'
      });
    }

    return alternatives;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * تحديد التوصية النهائية
   * ─────────────────────────────────────────────────────────────────────── */

  function determineRecommendation(riskLevel, safeMax, decisionAmount, recommendedDate) {
    if (riskLevel === RISK.CRITICAL) {
      return RECOMMENDATION.NOT_ADVISED;
    }
    if (riskLevel === RISK.HIGH) {
      // إن وُجد تاريخ آمن قريب → أجّل
      if (recommendedDate && recommendedDate.daysFromNow > 0) {
        return RECOMMENDATION.WAIT_FOR_SALARY;
      }
      // إن أمكن تقليل المبلغ → قلّل
      if (safeMax > 0 && safeMax < decisionAmount) {
        return RECOMMENDATION.REDUCE_AMOUNT;
      }
      return RECOMMENDATION.NOT_ADVISED;
    }
    if (riskLevel === RISK.MEDIUM) {
      return RECOMMENDATION.PROCEED_CAUTION;
    }
    return RECOMMENDATION.PROCEED;
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * الدالة الرئيسية — نقطة الدخول الوحيدة للمحرك
   * ═══════════════════════════════════════════════════════════════════════ */

  function analyzeDecision(input) {

    // ── 1. التحقق من صحة المدخلات ──
    const errors = validateInput(input);
    if (errors.length > 0) {
      return {
        ok:     false,
        errors: errors
      };
    }

    // ── 2. بناء الأحداث المالية ──
    const events = buildEvents(input);

    // ── 3. الخط الزمني (مع القرار) ──
    const timeline = buildTimeline(input.currentBalance, events);

    // ── 4. الخط الزمني (بدون القرار) — للمقارنة ──
    const inputWithout = Object.assign({}, input, { newDecision: null });
    const eventsWithout   = buildEvents(inputWithout);
    const timelineWithout = buildTimeline(input.currentBalance, eventsWithout);
    const analysisWithout = analyzeTimeline(
      input.currentBalance, timelineWithout, input.safeFloor,
      input.nextSalaryDate, input.asOfDate
    );

    // ── 5. تحليل الخط الزمني (مع القرار) ──
    const analysis = analyzeTimeline(
      input.currentBalance, timeline, input.safeFloor,
      input.nextSalaryDate, input.asOfDate
    );

    // ── 6. تقييم الخطر ──
    const risk = assessRisk(analysis, input.safeFloor);

    // ── 7. أقصى مبلغ آمن ──
    const safeCalc = calculateSafeMaximum(input, events);

    // ── 8. أفضل تاريخ ──
    const recommendedDate = findRecommendedDate(input);

    // ── 9. البدائل ──
    const alternatives = buildAlternatives(
      input, risk.level, safeCalc.safeMaximumAmount, recommendedDate
    );

    // ── 10. التوصية ──
    const decisionAmount = input.newDecision ? input.newDecision.amount : 0;
    const recommendation = determineRecommendation(
      risk.level, safeCalc.safeMaximumAmount, decisionAmount, recommendedDate
    );

    // ── 11. الرصيد بعد القرار مباشرة ──
    const balanceAfterDecision = input.newDecision
      ? input.currentBalance - (
          input.newDecision.paymentMode === 'installment'
            ? Math.round(input.newDecision.amount / input.newDecision.months)
            : input.newDecision.amount
        )
      : input.currentBalance;

    // ── 12. النتيجة النهائية ──
    return {
      ok: true,

      // المدخلات (للشفافية والتتبع)
      input: {
        asOfDate:       input.asOfDate,
        currentBalance: input.currentBalance,
        safeFloor:      input.safeFloor,
        decisionAmount: decisionAmount
      },

      // الأرقام الأساسية (كلها محسوبة، لا مكتوبة)
      currentBalance:        input.currentBalance,
      balanceAfterDecision:  balanceAfterDecision,
      minimumBalance:        analysis.minimumBalance,
      minimumBalanceDate:    analysis.minimumBalanceDate,
      balanceBeforeSalary:   analysis.balanceBeforeSalary,
      safeFloor:             input.safeFloor,
      gapFromSafeFloor:      analysis.minimumBalance - input.safeFloor,
      daysBelowSafeFloor:    analysis.daysBelowSafeFloor,
      goesNegative:          analysis.goesNegative,
      unfundedBills:         analysis.unfundedBills,

      obligationsBeforeSalary: safeCalc.obligationsBeforeSalary,
      safeMaximumAmount:       safeCalc.safeMaximumAmount,

      // المقارنة: بدون القرار مقابل مع القرار
      comparison: {
        withoutDecision: {
          minimumBalance:     analysisWithout.minimumBalance,
          minimumBalanceDate: analysisWithout.minimumBalanceDate,
          belowSafeFloor:     analysisWithout.minimumBalance < input.safeFloor
        },
        withDecision: {
          minimumBalance:     analysis.minimumBalance,
          minimumBalanceDate: analysis.minimumBalanceDate,
          belowSafeFloor:     analysis.minimumBalance < input.safeFloor
        },
        difference: analysis.minimumBalance - analysisWithout.minimumBalance
      },

      // الخطر والتوصية
      riskLevel:        risk.level,
      riskLevelAr:      RISK_LABEL_AR[risk.level],
      riskReasons:      risk.reasons,
      recommendation:   recommendation,
      recommendationAr: RECOMMENDATION_LABEL_AR[recommendation],

      // البدائل والتوقيت
      recommendedDate: recommendedDate,
      alternatives:    alternatives,

      // الخط الزمني الكامل
      timeline: timeline
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * التصدير
   * ─────────────────────────────────────────────────────────────────────── */

  const QararEngine = {
    analyzeDecision: analyzeDecision,
    Money:           Money,
    DateUtil:        DateUtil,
    RISK:            RISK,
    RISK_LABEL_AR:   RISK_LABEL_AR,
    RECOMMENDATION:  RECOMMENDATION,
    RECOMMENDATION_LABEL_AR: RECOMMENDATION_LABEL_AR,
    // مُصدَّرة للاختبار
    _internal: {
      buildEvents:         buildEvents,
      buildTimeline:       buildTimeline,
      analyzeTimeline:     analyzeTimeline,
      assessRisk:          assessRisk,
      calculateSafeMaximum: calculateSafeMaximum,
      validateInput:       validateInput
    }
  };

  // يعمل في المتصفح وفي Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QararEngine;
  }
  global.QararEngine = QararEngine;

})(typeof globalThis !== 'undefined' ? globalThis : this);
