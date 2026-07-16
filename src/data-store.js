/* ============================================================================
 * QARAR — DATA STORE  (Single Source of Truth)
 * طبقة البيانات الموحدة — المصدر الوحيد للحقيقة
 * ============================================================================
 *
 * ⚠️ الحفظ الحالي: localStorage — حفظ مؤقت للعرض فقط.
 *    ليس حفظًا دائمًا. لا يعمل عبر الأجهزة. سيُستبدل بـSupabase لاحقًا.
 *
 * قواعد صارمة:
 *   1. هذا هو الملف الوحيد الذي يلمس localStorage.
 *   2. كل صفحة (Dashboard/Sandbox/Decision/Assistant) تقرأ من هنا — مصدر واحد.
 *   3. بعد أي تعديل ناجح → recalculateFinancialSnapshot() → إشعار كل الصفحات.
 *   4. كل المبالغ بالهللة (amountMinor) — أعداد صحيحة فقط.
 *   5. Planned Decision ≠ Transaction. القرار المخطط لا يخصم من الرصيد.
 *
 * منع الحساب المزدوج (Double Counting):
 *   - التزام/فاتورة settled=true → لا تُحسب كحدث مستقبلي (دُفعت فعلًا).
 *   - قرار status='executed' → صار Transaction، لا يُحسب كتوقع.
 *   - حذف العملية المرتبطة → يفك التسوية ويعيد الحدث للظهور.
 * ========================================================================= */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'qarar_state_v2';

  /* ─── الحالة الافتراضية ─── */

  function defaultState() {
    const D = global.QararDemo;
    return {
      version: 2,
      profile: {
        name:                D.PROFILE.name,
        openingBalanceMinor: D.PROFILE.openingBalanceMinor,
        monthlyIncomeMinor:  D.PROFILE.monthlyIncomeMinor,
        salaryDate:          D.PROFILE.salaryDate,
        safeBalanceMinor:    D.PROFILE.safeBalanceMinor,
        currency:            'SAR',
        timezone:            'Asia/Riyadh',
        asOfDate:            D.PROFILE.asOfDate
      },
      transactions:     [],
      obligations:      D.OBLIGATIONS.map(o => Object.assign({}, o)),
      variableBills:    D.VARIABLE_BILLS.map(b => Object.assign({}, b)),
      billHistory:      D.BILL_HISTORY.map(h => Object.assign({}, h)),
      plannedDecisions: [],
      savingsGoals:     [],
      merchantRules:    Object.assign({}, D.MERCHANT_RULES)
    };
  }

  /* ─── القراءة والكتابة (المكان الوحيد الذي يلمس localStorage) ─── */

  let memoryState = null;

  function read() {
    if (memoryState) return memoryState;
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) { memoryState = defaultState(); persist(); return memoryState; }
      const parsed = JSON.parse(raw);
      if (parsed.version !== 2) { memoryState = defaultState(); persist(); return memoryState; }
      memoryState = parsed;
      return memoryState;
    } catch (e) {
      console.warn('[Qarar] التخزين المحلي غير متاح — العمل بالذاكرة فقط.');
      memoryState = defaultState();
      return memoryState;
    }
  }

  function persist() {
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState)); return true; }
    catch (e) { return false; }
  }

  /* ─── نظام الاشتراك: أي تغيير يُعيد الحساب ويُخطر كل الصفحات ─── */

  const subscribers = [];

  function subscribe(fn) {
    subscribers.push(fn);
    return function () {
      const i = subscribers.indexOf(fn);
      if (i >= 0) subscribers.splice(i, 1);
    };
  }

  function recalculateFinancialSnapshot() {
    persist();
    const snap = getSnapshot();
    subscribers.forEach(fn => {
      try { fn(snap); } catch (e) { console.error('[Qarar] subscriber error', e); }
    });
    return snap;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * توقع الفواتير المتغيرة — منطق بسيط وقابل للتفسير
   * لا ندّعي دقة علمية. نستخدم: متوسط · وسيط · متوسط مرجّح · اتجاه · نطاق · ثقة
   * ─────────────────────────────────────────────────────────────────────── */

  function forecastBill(billId) {
    const state = read();
    const bill  = state.variableBills.find(b => b.id === billId);
    if (!bill) return null;

    /* تعديل يدوي من المستخدم → يُستخدم كما هو */
    if (bill.manualForecastMinor != null) {
      return {
        billId, title: bill.title,
        expectedMinor:  bill.manualForecastMinor,
        isManual:       true,
        confidence:     'manual',
        confidenceAr:   'تعديل يدوي',
        note:           'قيمة أدخلتها بنفسك — المحرك يستخدمها كما هي.',
        rangeLowMinor:  bill.manualForecastMinor,
        rangeHighMinor: bill.manualForecastMinor,
        history: state.billHistory.filter(h => h.billId === billId),
        entryCount: state.billHistory.filter(h => h.billId === billId).length
      };
    }

    const entries = state.billHistory
      .filter(h => h.billId === billId)
      .sort((a, b) => a.billingPeriod.localeCompare(b.billingPeriod));

    const amounts = entries.map(e => e.amountMinor);
    const n = amounts.length;

    if (n === 0) {
      return {
        billId, title: bill.title,
        expectedMinor:  bill.defaultAmountMinor || 0,
        isManual:       false,
        confidence:     'none',
        confidenceAr:   'لا توجد بيانات',
        note:           'البيانات غير كافية لتوقع عالي الثقة.',
        rangeLowMinor:  bill.defaultAmountMinor || 0,
        rangeHighMinor: bill.defaultAmountMinor || 0,
        history: [], entryCount: 0
      };
    }

    const sum     = amounts.reduce((a, b) => a + b, 0);
    const average = Math.round(sum / n);
    const sorted  = amounts.slice().sort((a, b) => a - b);
    const median  = n % 2 ? sorted[(n - 1) / 2]
                          : Math.round((sorted[n/2 - 1] + sorted[n/2]) / 2);
    const min  = sorted[0];
    const max  = sorted[n - 1];
    const last = amounts[n - 1];

    /* متوسط مرجّح — الأحدث له وزن أعلى */
    let ws = 0, wt = 0;
    amounts.forEach((a, i) => { const w = i + 1; ws += a * w; wt += w; });
    const weighted = Math.round(ws / wt);

    /* اتجاه بسيط */
    let trend = 'stable', trendAr = 'مستقر';
    if (n >= 2) {
      const change = (last - amounts[0]) / (amounts[0] || 1);
      if (change >  0.10) { trend = 'rising';  trendAr = 'تصاعدي'; }
      if (change < -0.10) { trend = 'falling'; trendAr = 'تنازلي'; }
    }

    const expected = weighted;

    /* الثقة — صريحة، بلا مبالغة */
    let confidence, confidenceAr, note;
    if (n < 3) {
      confidence='low';    confidenceAr='منخفضة';
      note='البيانات غير كافية لتوقع عالي الثقة. أضف قراءات أكثر.';
    } else if (n < 5) {
      confidence='medium'; confidenceAr='متوسطة';
      note=`مبني على ${n.toLocaleString('ar-SA')} قراءات — توقع تقريبي.`;
    } else {
      confidence='good';   confidenceAr='جيدة';
      note=`مبني على ${n.toLocaleString('ar-SA')} قراءات.`;
    }

    const spread  = Math.max(max - min, Math.round(expected * 0.10));
    const padding = n < 3 ? Math.round(spread * 0.75) : Math.round(spread * 0.5);

    return {
      billId, title: bill.title,
      expectedMinor:  expected,
      isManual:       false,
      averageMinor:   average,
      medianMinor:    median,
      weightedMinor:  weighted,
      minMinor:       min,
      maxMinor:       max,
      lastMinor:      last,
      trend, trendAr,
      confidence, confidenceAr, note,
      rangeLowMinor:  Math.max(0, expected - padding),
      rangeHighMinor: expected + padding,
      history: entries,
      entryCount: n
    };
  }

  /* ─── الرصيد = الافتتاحي + الدخل − المصروفات  (القرارات المخططة لا تُخصم) ─── */

  function computeBalance(state) {
    let b = state.profile.openingBalanceMinor;
    state.transactions.forEach(t => {
      if (t.type === 'income') b += t.amountMinor;
      else                     b -= t.amountMinor;
    });
    return b;
  }

  /* ─── بناء الالتزامات للمحرك (مع منع الحساب المزدوج) ─── */

  function buildEngineObligations() {
    const state = read();
    const list = [];

    state.obligations.forEach(o => {
      if (!o.active || o.settled) return;      // 🔴 settled = دُفع فعلًا
      list.push({
        id: o.id, name: o.title, amount: o.amountMinor,
        dueDate: o.nextDueDate, category: o.category || 'التزامات',
        isEssential: o.essentiality === 'essential',
        icon: o.icon || '📄', kind: 'obligation'
      });
    });

    state.variableBills.forEach(b => {
      if (!b.active || b.settled) return;      // 🔴
      const fc = forecastBill(b.id);
      if (!fc || !fc.expectedMinor) return;
      list.push({
        id: b.id, name: b.title,
        amount: fc.expectedMinor,              // ⭐ القيمة المتوقعة، لا رقمًا ثابتًا
        dueDate: b.usualDueDate, category: b.category || 'فواتير',
        isEssential: b.essentiality !== 'optional',
        icon: b.icon || '📄', kind: 'variable_bill',
        isForecast: true, confidence: fc.confidence
      });
    });

    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  /* ─── اللقطة المالية الموحدة ─── */

  function getSnapshot() {
    const state = read();
    return {
      profile:          Object.assign({}, state.profile),
      balanceMinor:     computeBalance(state),
      transactions:     state.transactions.slice(),
      obligations:      buildEngineObligations(),
      rawObligations:   state.obligations.slice(),
      variableBills:    state.variableBills.slice(),
      billForecasts:    state.variableBills.map(b => forecastBill(b.id)).filter(Boolean),
      plannedDecisions: state.plannedDecisions.slice(),
      savingsGoals:     state.savingsGoals.slice()
    };
  }

  function buildEngineInput(newDecision) {
    const state = read();
    return {
      asOfDate:       state.profile.asOfDate,
      currentBalance: computeBalance(state),
      safeFloor:      state.profile.safeBalanceMinor,
      monthlyIncome:  state.profile.monthlyIncomeMinor,
      nextSalaryDate: state.profile.salaryDate,
      obligations:    buildEngineObligations(),
      newDecision:    newDecision || null
    };
  }

  /* ─── منع الإرسال المزدوج ─── */

  const recentSubmits = {};
  let seq = 0;

  function isDuplicateSubmit(fp) {
    const now = Date.now();
    if (recentSubmits[fp] && (now - recentSubmits[fp]) < 1500) return true;
    recentSubmits[fp] = now;
    return false;
  }

  function nowIso() { return new Date().toISOString(); }   // سجل فقط — لا يدخل حسابًا ماليًا
  function uid(p)   { return p + '_' + Date.now().toString(36) + '_' + (++seq).toString(36); }

  /* ═══════════════ الواجهة العامة ═══════════════ */

  const Store = {

    subscribe, getSnapshot, buildEngineInput, recalculateFinancialSnapshot,

    /* ── الملف المالي ── */
    getProfile() { return Object.assign({}, read().profile); },

    updateProfile(patch) {
      const state = read();
      ['openingBalanceMinor','monthlyIncomeMinor','safeBalanceMinor'].forEach(k => {
        if (patch[k] != null) {
          const v = Number(patch[k]);
          if (!Number.isInteger(v) || v < 0) throw new Error('قيمة غير صالحة: ' + k);
        }
      });
      state.profile = Object.assign({}, state.profile, patch);
      recalculateFinancialSnapshot();
      return state.profile;
    },

    getBalance() { return computeBalance(read()); },

    /* ── العمليات ── */
    getTransactions() {
      return read().transactions.slice().sort((a, b) =>
        (b.transactionDate + b.createdAt).localeCompare(a.transactionDate + a.createdAt));
    },

    getTransaction(id) { return read().transactions.find(t => t.id === id) || null; },

    addTransaction(tx) {
      const state = read();
      const amount = Math.abs(Number(tx.amountMinor));
      if (!Number.isInteger(amount) || amount <= 0)
        throw new Error('المبلغ يجب أن يكون عددًا صحيحًا موجبًا بالهللة');
      if (tx.type !== 'income' && tx.type !== 'expense')
        throw new Error("نوع العملية يجب أن يكون income أو expense");

      const fp = `${tx.type}|${amount}|${tx.title}|${tx.transactionDate}`;
      if (isDuplicateSubmit(fp)) throw new Error('DUPLICATE_SUBMIT');

      const rec = {
        id: uid('tx'),
        type: tx.type,
        amountMinor: amount,                 // موجب دائمًا — النوع يحدد الإشارة
        title: tx.title,
        merchantOrSource: tx.merchantOrSource || tx.title,
        category: tx.category || Store.classifyMerchant(tx.merchantOrSource || tx.title),
        transactionDate: tx.transactionDate,
        notes: tx.notes || '',
        source: tx.source || 'sandbox',
        icon: tx.icon || (tx.type === 'income' ? '💰' : '💳'),
        linkedObligationId: tx.linkedObligationId || null,
        linkedDecisionId:   tx.linkedDecisionId   || null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      state.transactions.push(rec);
      recalculateFinancialSnapshot();
      return rec;
    },

    updateTransaction(id, patch) {
      const state = read();
      const i = state.transactions.findIndex(t => t.id === id);
      if (i < 0) throw new Error('العملية غير موجودة');

      if (patch.amountMinor != null) {
        const a = Math.abs(Number(patch.amountMinor));
        if (!Number.isInteger(a) || a <= 0) throw new Error('مبلغ غير صالح');
        patch.amountMinor = a;
      }
      if (patch.type && patch.type !== 'income' && patch.type !== 'expense')
        throw new Error('نوع غير صالح');

      /* تعديل في المكان — نفس الـid، لا تكرار */
      state.transactions[i] = Object.assign({}, state.transactions[i], patch, {
        id, createdAt: state.transactions[i].createdAt, updatedAt: nowIso()
      });
      recalculateFinancialSnapshot();
      return state.transactions[i];
    },

    deleteTransaction(id) {
      const state = read();
      const tx = state.transactions.find(t => t.id === id);
      const before = state.transactions.length;
      state.transactions = state.transactions.filter(t => t.id !== id);
      if (state.transactions.length === before) return false;

      /* فك التسوية — الحدث يعود للظهور كتوقع مستقبلي */
      if (tx && tx.linkedObligationId) {
        const o = state.obligations.find(x => x.id === tx.linkedObligationId);
        if (o) o.settled = false;
        const b = state.variableBills.find(x => x.id === tx.linkedObligationId);
        if (b) b.settled = false;
      }
      if (tx && tx.linkedDecisionId) {
        const d = state.plannedDecisions.find(x => x.id === tx.linkedDecisionId);
        if (d) d.status = 'planned';
      }
      recalculateFinancialSnapshot();
      return true;
    },

    /* ── تصنيف التجار ── */
    classifyMerchant(name) {
      const rules = read().merchantRules;
      const key = String(name || '').toLowerCase().trim();
      for (const r in rules) if (key.includes(r)) return rules[r];
      return 'أخرى';
    },

    learnMerchant(name, category) {
      const state = read();
      const key = String(name || '').toLowerCase().trim();
      if (!key) return;
      state.merchantRules[key] = category;
      recalculateFinancialSnapshot();
    },

    /* ── الالتزامات ── */
    getObligations() { return read().obligations.slice(); },

    addObligation(o) {
      const state = read();
      const a = Math.abs(Number(o.amountMinor));
      if (!Number.isInteger(a) || a <= 0) throw new Error('مبلغ غير صالح');
      state.obligations.push({
        id: uid('ob'), title: o.title, amountMinor: a,
        frequency: o.frequency || 'monthly',
        nextDueDate: o.nextDueDate,
        essentiality: o.essentiality || 'essential',
        category: o.category || 'التزامات',
        icon: o.icon || '📄', active: true, settled: false
      });
      recalculateFinancialSnapshot();
    },

    updateObligation(id, patch) {
      const state = read();
      const o = state.obligations.find(x => x.id === id);
      if (!o) throw new Error('الالتزام غير موجود');
      if (patch.amountMinor != null) {
        const a = Math.abs(Number(patch.amountMinor));
        if (!Number.isInteger(a) || a <= 0) throw new Error('مبلغ غير صالح');
        patch.amountMinor = a;
      }
      Object.assign(o, patch);
      recalculateFinancialSnapshot();
      return o;
    },

    deleteObligation(id) {
      const state = read();
      state.obligations = state.obligations.filter(o => o.id !== id);
      recalculateFinancialSnapshot();
    },

    settleObligation(id, paidDate) {
      const state = read();
      const o = state.obligations.find(x => x.id === id);
      if (!o) throw new Error('الالتزام غير موجود');
      Store.addTransaction({
        type: 'expense', amountMinor: o.amountMinor, title: o.title,
        merchantOrSource: o.title, category: o.category,
        transactionDate: paidDate || state.profile.asOfDate,
        icon: o.icon, source: 'manual', linkedObligationId: id
      });
      o.settled = true;                    // 🔴 لا يُحسب مرة أخرى كتوقع
      recalculateFinancialSnapshot();
    },

    /* ── الفواتير المتغيرة ── */
    getVariableBills()   { return read().variableBills.slice(); },
    getBillForecast(id)  { return forecastBill(id); },
    getAllBillForecasts(){ return read().variableBills.map(b => forecastBill(b.id)).filter(Boolean); },

    getBillHistory(billId) {
      return read().billHistory.filter(h => h.billId === billId)
        .sort((a, b) => b.billingPeriod.localeCompare(a.billingPeriod));
    },

    addBillEntry(entry) {
      const state = read();
      const a = Math.abs(Number(entry.amountMinor));
      if (!Number.isInteger(a) || a <= 0) throw new Error('مبلغ غير صالح');

      /* نفس الشهر → تحديث بدل تكرار */
      const ex = state.billHistory.find(
        h => h.billId === entry.billId && h.billingPeriod === entry.billingPeriod);
      if (ex) {
        ex.amountMinor = a;
        ex.updatedAt = nowIso();
      } else {
        state.billHistory.push({
          id: uid('bh'), billId: entry.billId,
          billingPeriod: entry.billingPeriod,
          amountMinor: a,
          expectedDate: entry.expectedDate || null,
          paidDate: entry.paidDate || null,
          source: entry.source || 'manual',
          createdAt: nowIso(), updatedAt: nowIso()
        });
      }
      recalculateFinancialSnapshot();
    },

    deleteBillEntry(id) {
      const state = read();
      state.billHistory = state.billHistory.filter(h => h.id !== id);
      recalculateFinancialSnapshot();
    },

    /** تعديل التوقع يدويًا — المحرك يستخدم هذه القيمة كما هي */
    setBillManualForecast(billId, amountMinor) {
      const state = read();
      const b = state.variableBills.find(x => x.id === billId);
      if (!b) throw new Error('الفاتورة غير موجودة');
      if (amountMinor == null) {
        b.manualForecastMinor = null;      // إلغاء → العودة للتوقع المحسوب
      } else {
        const a = Math.abs(Number(amountMinor));
        if (!Number.isInteger(a) || a <= 0) throw new Error('مبلغ غير صالح');
        b.manualForecastMinor = a;
      }
      recalculateFinancialSnapshot();
      return b;
    },

    updateVariableBill(billId, patch) {
      const state = read();
      const b = state.variableBills.find(x => x.id === billId);
      if (!b) throw new Error('الفاتورة غير موجودة');
      Object.assign(b, patch);
      recalculateFinancialSnapshot();
      return b;
    },

    /* ── القرارات المخططة (لا تُخصم) ── */
    getPlannedDecisions() { return read().plannedDecisions.slice(); },

    savePlannedDecision(decision, analysis) {
      const state = read();
      const rec = {
        id: uid('pd'),
        title: decision.name,
        type: decision.type,
        amountMinor: decision.amount,
        plannedDate: decision.targetDate,
        paymentMethod: decision.paymentMode,
        essentiality: decision.isEssential ? 'essential' : 'optional',
        months: decision.months || null,
        status: 'planned',
        summary: analysis ? {
          minimumBalanceMinor: analysis.minimumBalance,
          riskLevel:           analysis.riskLevel,
          recommendation:      analysis.recommendation,
          safeMaximumMinor:    analysis.safeMaximumAmount
        } : null,
        createdAt: nowIso()
      };
      state.plannedDecisions.push(rec);
      recalculateFinancialSnapshot();
      return rec;
    },

    /** ⭐ تنفيذ القرار → Transaction. يُخصم مرة واحدة فقط. */
    executeDecision(id) {
      const state = read();
      const d = state.plannedDecisions.find(x => x.id === id);
      if (!d) throw new Error('القرار غير موجود');
      if (d.status === 'executed') throw new Error('ALREADY_EXECUTED');   // 🔴

      Store.addTransaction({
        type: 'expense', amountMinor: d.amountMinor, title: d.title,
        merchantOrSource: d.title, category: 'قرارات',
        transactionDate: state.profile.asOfDate,
        icon: '🎯', source: 'manual', linkedDecisionId: id
      });
      d.status = 'executed';
      d.executedAt = nowIso();
      recalculateFinancialSnapshot();
      return d;
    },

    cancelDecision(id) {
      const state = read();
      const d = state.plannedDecisions.find(x => x.id === id);
      if (d) d.status = 'cancelled';
      recalculateFinancialSnapshot();
    },

    deleteDecision(id) {
      const state = read();
      state.plannedDecisions = state.plannedDecisions.filter(d => d.id !== id);
      recalculateFinancialSnapshot();
    },

    /* ── الأهداف ── */
    getGoals() { return read().savingsGoals.slice(); },

    addGoal(goal) {
      const state = read();
      state.savingsGoals.push(Object.assign({
        id: uid('gl'), savedMinor: 0, createdAt: nowIso()
      }, goal));
      recalculateFinancialSnapshot();
    },

    /* ── عادات الإنفاق (من العمليات الفعلية) ── */
    getSpendingHabits() {
      const byCat = {};
      read().transactions.filter(t => t.type === 'expense').forEach(t => {
        if (!byCat[t.category]) byCat[t.category] = { category: t.category, totalMinor: 0, count: 0 };
        byCat[t.category].totalMinor += t.amountMinor;
        byCat[t.category].count++;
      });
      return Object.values(byCat)
        .map(c => Object.assign(c, { averageMinor: Math.round(c.totalMinor / c.count) }))
        .sort((a, b) => b.totalMinor - a.totalMinor);
    },

    /* ── إعادة الضبط ── */
    reset() {
      memoryState = defaultState();
      Object.keys(recentSubmits).forEach(k => delete recentSubmits[k]);
      recalculateFinancialSnapshot();
      return memoryState;
    },

    isPersistent() {
      try { global.localStorage.setItem('__p__','1'); global.localStorage.removeItem('__p__'); return true; }
      catch (e) { return false; }
    },

    /* للاختبارات فقط */
    _resetForTest() {
      memoryState = defaultState();
      Object.keys(recentSubmits).forEach(k => delete recentSubmits[k]);
      return memoryState;
    },
    _clearSubmitGuard() {
      Object.keys(recentSubmits).forEach(k => delete recentSubmits[k]);
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Store;
  global.QararStore = Store;

})(typeof globalThis !== 'undefined' ? globalThis : this);
