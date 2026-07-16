/* ============================================================================
 * QARAR — AI AGENT (Client)
 * وكيل المساعد الذكي — جانب المتصفح
 * ============================================================================
 *
 * ⭐ النقطة الجوهرية:
 *   الذكاء الاصطناعي يفهم السؤال ويستخرج البيانات.
 *   **محرك القرار (هنا، في المتصفح) هو الذي يحسب.**
 *
 *   لهذا يعطي المساعد *نفس أرقام النموذج اليدوي بالضبط* —
 *   لأن كليهما يستدعي QararEngine.analyzeDecision() على نفس البيانات.
 *
 * التدفق:
 *   رسالة → /api/assistant (AI: نية + بيانات) → محرك القرار (حساب) → عرض
 *                    ↓ فشل
 *              Fallback محلي (قواعد) → نفس المحرك → عرض
 * ========================================================================= */

(function (global) {
  'use strict';

  const API_URL = '/api/assistant';

  /* ─── حالة الوكيل ─── */

  const Agent = {
    history: [],          // سجل المحادثة (يُرسل للـAI للسياق)
    draft:   null,        // المسودة الحالية (قرار/عملية بانتظار التأكيد)
    mode:    'unknown',   // 'ai' | 'fallback' | 'unknown'
    lastError: null
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * الاتصال بالمساعد الذكي
   * ─────────────────────────────────────────────────────────────────────── */

  async function askAI(userMessage) {
    Agent.history.push({ role: 'user', content: userMessage });

    try {
      const res = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: Agent.history,
          today:    QararStore.getProfile().asOfDate
        })
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();

      if (!data.ok) {
        /* 🔴 المزود فشل أو المفتاح غير مضبوط → Fallback */
        Agent.mode = 'fallback';
        Agent.lastError = data.error || 'المساعد الذكي غير متاح';
        return { ok: false, fallback: true, error: Agent.lastError, missingKey: data.missingKey };
      }

      Agent.mode = 'ai';
      Agent.lastError = null;
      Agent.history.push({ role: 'assistant', content: data.result.reply });

      return { ok: true, result: data.result, provider: data.provider };

    } catch (err) {
      /* لا شبكة / لا سيرفر (فتح الملف مباشرة) → Fallback */
      Agent.mode = 'fallback';
      Agent.lastError = 'تعذر الاتصال بالمساعد الذكي';
      return { ok: false, fallback: true, error: Agent.lastError };
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * ⭐ تشغيل محرك القرار على بيانات الوكيل
   *
   * هذه هي الدالة التي تضمن التطابق مع النموذج اليدوي.
   * الذكاء الاصطناعي لا يمرّ من هنا — الأرقام تُحسب محليًا.
   * ─────────────────────────────────────────────────────────────────────── */

  function runEngine(data) {
    const M = QararEngine.Money;
    const profile = QararStore.getProfile();

    /* تحليل بلا قرار جديد (سؤال عن الوضع الحالي) */
    if (!data || !data.amountRiyal) {
      /* مسبار صغير لاستخراج أقصى مبلغ آمن */
      const probe = QararEngine.analyzeDecision(QararStore.buildEngineInput({
        type: 'purchase', name: 'probe', amount: 100,
        targetDate: profile.asOfDate, isEssential: false, paymentMode: 'one_time'
      }));
      return { kind: 'snapshot', result: probe };
    }

    /* تحليل قرار كامل */
    const decision = {
      type:        mapIntentToType(data.intent),
      name:        data.title || 'قرار',
      amount:      M.fromRiyal(data.amountRiyal),
      targetDate:  data.date || profile.asOfDate,
      isEssential: data.isEssential === true,
      paymentMode: data.paymentMode || 'one_time',
      months:      data.months || 6
    };

    const result = QararEngine.analyzeDecision(
      QararStore.buildEngineInput(decision)
    );

    return { kind: 'decision', result, decision };
  }

  function mapIntentToType(intent) {
    const map = {
      purchase_decision:     'purchase',
      travel_decision:       'travel',
      subscription_decision: 'subscription',
      installment_decision:  'installment',
      education_expense:     'education',
      saving_goal:           'savings_goal',
      add_expense:           'purchase'
    };
    return map[intent] || 'general';
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Fallback محلي — عند تعطل الذكاء الاصطناعي
   *
   * ⚠️ هذا وضع احتياطي محدود، وليس ذكاءً اصطناعيًا.
   *    يفهم بقواعد نصية بسيطة فقط. يُعلَن عنه صراحةً للمستخدم.
   * ─────────────────────────────────────────────────────────────────────── */

  function fallbackParse(text) {
    const q = String(text || '');

    /* استخراج مبلغ */
    const numMatch = q.match(/(\d[\d,٬.]*)/);
    const amount = numMatch ? Number(numMatch[1].replace(/[,٬]/g, '')) : null;

    const isIncome   = /بعت|مكافأة|جاني|استلمت|حوالة|جائزة|دخل|راتب|استرد/.test(q);
    const isBill     = /فاتورة|كهرباء|ماء|الماء/.test(q);
    const askBalance = /رصيد|كم عندي|كم لدي/.test(q);
    const askSafe    = /أقدر أصرف|كم أصرف|أقصى|بأمان|حد آمن/.test(q);
    const askCommit  = /التزامات|فواتير قادمة|مستحق|كم علي/.test(q);
    const askBuy     = /أشتري|اشتري|أقدر|شراء|أبغى|ناوي|لابتوب|جوال|سيارة/.test(q);

    if (isBill && amount) {
      const billId = /ماء|الماء/.test(q) ? 'vb_water' : 'vb_electricity';
      return {
        intent: 'add_or_update_bill',
        reply:  `أحدّث توقع الفاتورة إلى ${amount.toLocaleString('ar-SA')} ريال؟`,
        data: { title: billId==='vb_water'?'فاتورة الماء':'فاتورة الكهرباء',
                amountRiyal: amount, billId, date: null,
                isEssential: true, paymentMode: null, months: null,
                category: 'فواتير', transactionType: null },
        missingFields: [], action: 'confirm_bill', needsConfirmation: true
      };
    }

    if (isIncome && amount) {
      return {
        intent: 'add_income',
        reply:  `أسجّل دخل بقيمة ${amount.toLocaleString('ar-SA')} ريال؟`,
        data: { title: 'دخل إضافي', amountRiyal: amount, date: null,
                isEssential: null, paymentMode: null, months: null,
                category: 'دخل', billId: null, transactionType: 'income' },
        missingFields: [], action: 'confirm_transaction', needsConfirmation: true
      };
    }

    if ((askBuy || askSafe) && amount) {
      return {
        intent: 'purchase_decision',
        reply:  'خلني أحلل أثر هذا القرار بمحرك القرار.',
        data: { title: 'قرار شراء', amountRiyal: amount, date: null,
                isEssential: false, paymentMode: 'one_time', months: null,
                category: null, billId: null, transactionType: null },
        missingFields: [], action: 'analyze', needsConfirmation: false
      };
    }

    if (askBalance || askSafe || askCommit) {
      return {
        intent: askCommit ? 'ask_upcoming_commitments'
              : askSafe   ? 'ask_safe_spending' : 'ask_balance',
        reply:  'خلني أجيب لك الأرقام من محرك القرار.',
        data: { title:null, amountRiyal:null, date:null, isEssential:null,
                paymentMode:null, months:null, category:null, billId:null,
                transactionType:null },
        missingFields: [], action: 'analyze', needsConfirmation: false
      };
    }

    return {
      intent: 'unknown',
      reply:  'المساعد الذكي غير متاح حاليًا، وأنا في الوضع الاحتياطي المحدود.\n\n'
            + 'جرّب صيغة تتضمن مبلغًا، مثل:\n'
            + '• «هل أقدر أشتري لابتوب بـ3000؟»\n'
            + '• «كم أقدر أصرف بأمان؟»\n'
            + '• «فاتورة الكهرباء صارت 900»\n\n'
            + 'أو استخدم نموذج «اختبار القرار» للتحليل الكامل.',
      data: { title:null, amountRiyal:null, date:null, isEssential:null,
              paymentMode:null, months:null, category:null, billId:null,
              transactionType:null },
      missingFields: [], action: 'none', needsConfirmation: false
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * ⭐ الدالة الرئيسية — معالجة رسالة المستخدم
   * ─────────────────────────────────────────────────────────────────────── */

  async function processMessage(text, callbacks) {
    const cb = callbacks || {};
    const emit = (stage, payload) => { if (cb.onStage) cb.onStage(stage, payload); };

    emit('thinking');

    /* 1. اسأل الذكاء الاصطناعي */
    const ai = await askAI(text);

    let parsed, usedFallback = false;

    if (ai.ok) {
      parsed = ai.result;
      emit('understood', { intent: parsed.intent, mode: 'ai' });
    } else {
      usedFallback = true;
      parsed = fallbackParse(text);
      emit('fallback', { error: ai.error, missingKey: ai.missingKey });
    }

    /* 2. هل يحتاج تأكيدًا قبل الحفظ؟ */
    if (parsed.needsConfirmation && parsed.action !== 'none') {
      Agent.draft = parsed;
      emit('awaiting_confirmation', parsed);
      return {
        type: 'confirmation',
        reply: parsed.reply,
        draft: parsed,
        usedFallback
      };
    }

    /* 3. هل يحتاج تحليلًا؟ → ⭐ استدعِ المحرك */
    if (parsed.action === 'analyze') {
      emit('analyzing');
      const engineOut = runEngine(parsed.data ?
        Object.assign({}, parsed.data, { intent: parsed.intent }) : null);

      return {
        type: 'analysis',
        reply: parsed.reply,
        engine: engineOut,
        intent: parsed.intent,
        usedFallback
      };
    }

    /* 4. مجرد رد/سؤال */
    return {
      type: 'reply',
      reply: parsed.reply,
      intent: parsed.intent,
      missingFields: parsed.missingFields,
      usedFallback
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * تنفيذ المسودة بعد تأكيد المستخدم
   * 🔴 لا شيء يُحفظ قبل استدعاء هذه الدالة
   * ─────────────────────────────────────────────────────────────────────── */

  function confirmDraft() {
    if (!Agent.draft) return { ok: false, error: 'لا توجد مسودة' };

    const M = QararEngine.Money;
    const d = Agent.draft;
    const data = d.data;
    const profile = QararStore.getProfile();

    try {
      if (d.action === 'confirm_transaction') {
        const tx = QararStore.addTransaction({
          type:             data.transactionType || 'expense',
          amountMinor:      M.fromRiyal(data.amountRiyal),
          title:            data.title || 'عملية',
          merchantOrSource: data.title || 'غير محدد',
          category:         data.category || undefined,
          transactionDate:  data.date || profile.asOfDate,
          source:           'sandbox'
        });
        Agent.draft = null;
        return {
          ok: true, kind: 'transaction', record: tx,
          message: data.transactionType === 'income'
            ? `سُجّل الدخل — الرصيد الآن ${M.formatWithCurrency(QararStore.getBalance())}`
            : `سُجّل المصروف — الرصيد الآن ${M.formatWithCurrency(QararStore.getBalance())}`
        };
      }

      if (d.action === 'confirm_bill') {
        QararStore.setBillManualForecast(data.billId, M.fromRiyal(data.amountRiyal));
        Agent.draft = null;
        return {
          ok: true, kind: 'bill',
          message: `حُدّثت الفاتورة — أُعيد حساب كل قراراتك.`
        };
      }

      if (d.action === 'confirm_obligation') {
        QararStore.addObligation({
          title:        data.title || 'التزام',
          amountMinor:  M.fromRiyal(data.amountRiyal),
          nextDueDate:  data.date || profile.asOfDate,
          essentiality: data.isEssential ? 'essential' : 'optional'
        });
        Agent.draft = null;
        return { ok: true, kind: 'obligation', message: 'أُضيف الالتزام.' };
      }

      if (d.action === 'confirm_goal') {
        QararStore.addGoal({
          name:        data.title || 'هدف ادخار',
          targetMinor: M.fromRiyal(data.amountRiyal),
          targetDate:  data.date || null
        });
        Agent.draft = null;
        return { ok: true, kind: 'goal', message: 'أُضيف هدف الادخار.' };
      }

      return { ok: false, error: 'إجراء غير معروف' };

    } catch (e) {
      Agent.draft = null;
      return { ok: false, error: e.message };
    }
  }

  function cancelDraft() {
    Agent.draft = null;
    return { ok: true };
  }

  function resetConversation() {
    Agent.history = [];
    Agent.draft = null;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * فحص توفر المساعد الذكي (عند فتح الصفحة)
   * ─────────────────────────────────────────────────────────────────────── */

  async function probeAvailability() {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'مرحبا' }],
          today: QararStore.getProfile().asOfDate
        })
      });
      const data = await res.json();
      Agent.mode = data.ok ? 'ai' : 'fallback';
      return { available: !!data.ok, error: data.error, missingKey: data.missingKey };
    } catch (e) {
      Agent.mode = 'fallback';
      return { available: false, error: 'لا يوجد سيرفر (وضع محلي)' };
    }
  }

  const QararAgent = {
    processMessage, confirmDraft, cancelDraft, resetConversation,
    probeAvailability, runEngine,
    getMode:   () => Agent.mode,
    getDraft:  () => Agent.draft,
    getError:  () => Agent.lastError,
    _fallbackParse: fallbackParse   // للاختبار
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = QararAgent;
  global.QararAgent = QararAgent;

})(typeof globalThis !== 'undefined' ? globalThis : this);
