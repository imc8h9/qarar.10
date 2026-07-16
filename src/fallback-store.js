/* ============================================================================
 * QARAR — FALLBACK STORE  (شبكة أمان البيانات)
 * ============================================================================
 *
 * الغرض الوحيد: **ألا تختفي المنصة أبدًا** لو فشل تحميل ملف بيانات.
 *
 * ما حدث سابقًا:
 *   فشل تحميل ملف واحد (`data-store.js`) ⇒ `QararStore` غير معرّف
 *   ⇒ `views.home()` ينهار ⇒ المستخدم يرى «تعذر تحميل لوحة التحكم»
 *   بدل المنصة الكاملة. هذا غير مقبول.
 *
 * الحل: متجر بديل **مضمّن داخل index.html نفسه** (لا ملف خارجي يمكن أن يفشل)،
 *       يقدّم **نفس الواجهة تمامًا** التي تتوقعها الصفحات.
 *
 * 🔴 قواعد صارمة:
 *   1. لا يعتمد على أي ملف خارجي إطلاقًا (ولا حتى decision-engine).
 *   2. لا يستخدم localStorage (يعمل في الذاكرة — لهذا هو «بديل»).
 *   3. يحمل **نفس بيانات العرض** (4,200 · 650 · 180 · 300 · 1,500).
 *   4. يُستخدم *فقط* عند فشل المتجر الحقيقي — وإلا فالمتجر الحقيقي هو الأصل.
 *
 * النتيجة: **لوحة التحكم تُعرض كاملة في كل الأحوال.**
 * ========================================================================= */

(function (global) {
  'use strict';

  var M = function (r) { return Math.round(r * 100); };   // ريال → هللة

  var TODAY = '2026-07-12';

  function daysFrom(n) {
    var p = TODAY.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]) + n * 86400000);
    return d.getUTCFullYear() + '-' +
           String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
           String(d.getUTCDate()).padStart(2, '0');
  }

  /* ─── الحالة (في الذاكرة فقط) ─── */

  function freshState() {
    return {
      profile: {
        name:                'أحمد',
        openingBalanceMinor: M(4200),
        monthlyIncomeMinor:  M(12500),
        salaryDate:          daysFrom(6),
        safeBalanceMinor:    M(1500),
        currency:            'SAR',
        timezone:            'Asia/Riyadh',
        asOfDate:            TODAY
      },
      transactions: [],
      obligations: [
        { id:'ob_internet', title:'اشتراك الإنترنت', amountMinor:M(300),
          frequency:'monthly', nextDueDate:daysFrom(5), essentiality:'essential',
          category:'اشتراكات', icon:'🌐', active:true, settled:false }
      ],
      variableBills: [
        { id:'vb_electricity', title:'فاتورة الكهرباء', category:'فواتير',
          usualDueDate:daysFrom(3), essentiality:'essential', icon:'⚡',
          active:true, settled:false, defaultAmountMinor:M(650),
          manualForecastMinor:M(650) },
        { id:'vb_water', title:'فاتورة الماء', category:'فواتير',
          usualDueDate:daysFrom(4), essentiality:'essential', icon:'💧',
          active:true, settled:false, defaultAmountMinor:M(180),
          manualForecastMinor:M(180) }
      ],
      billHistory: [
        { id:'h1', billId:'vb_electricity', billingPeriod:'2026-03', amountMinor:M(520) },
        { id:'h2', billId:'vb_electricity', billingPeriod:'2026-04', amountMinor:M(610) },
        { id:'h3', billId:'vb_electricity', billingPeriod:'2026-05', amountMinor:M(730) },
        { id:'h4', billId:'vb_electricity', billingPeriod:'2026-06', amountMinor:M(680) },
        { id:'h5', billId:'vb_water', billingPeriod:'2026-05', amountMinor:M(190) },
        { id:'h6', billId:'vb_water', billingPeriod:'2026-06', amountMinor:M(180) }
      ],
      plannedDecisions: [],
      savingsGoals:     [],
      merchantRules: { 'panda':'بقالة', 'بندة':'بقالة', 'مطعم':'مطاعم',
                       'netflix':'اشتراكات', 'بنزين':'تنقل' }
    };
  }

  var state = freshState();
  var subs  = [];
  var seq   = 0;

  function uid(p) { return p + '_fb_' + (++seq); }

  function balance() {
    var b = state.profile.openingBalanceMinor;
    state.transactions.forEach(function (t) {
      b += (t.type === 'income' ? t.amountMinor : -t.amountMinor);
    });
    return b;
  }

  function forecast(billId) {
    var bill = state.variableBills.filter(function (b) { return b.id === billId; })[0];
    if (!bill) return null;

    var entries = state.billHistory
      .filter(function (h) { return h.billId === billId; })
      .sort(function (a, b) { return a.billingPeriod.localeCompare(b.billingPeriod); });

    if (bill.manualForecastMinor != null) {
      return {
        billId: billId, title: bill.title,
        expectedMinor: bill.manualForecastMinor,
        isManual: true, confidence: 'manual', confidenceAr: 'تعديل يدوي',
        note: 'قيمة أدخلتها بنفسك.',
        rangeLowMinor: bill.manualForecastMinor,
        rangeHighMinor: bill.manualForecastMinor,
        history: entries, entryCount: entries.length
      };
    }

    var a = entries.map(function (e) { return e.amountMinor; });
    var n = a.length;
    if (!n) {
      return { billId: billId, title: bill.title,
        expectedMinor: bill.defaultAmountMinor || 0, isManual: false,
        confidence: 'none', confidenceAr: 'لا توجد بيانات',
        note: 'البيانات غير كافية لتوقع عالي الثقة.',
        rangeLowMinor: bill.defaultAmountMinor || 0,
        rangeHighMinor: bill.defaultAmountMinor || 0,
        history: [], entryCount: 0 };
    }

    var sum = a.reduce(function (x, y) { return x + y; }, 0);
    var avg = Math.round(sum / n);
    var srt = a.slice().sort(function (x, y) { return x - y; });
    var med = n % 2 ? srt[(n - 1) / 2] : Math.round((srt[n/2 - 1] + srt[n/2]) / 2);

    var ws = 0, wt = 0;
    a.forEach(function (v, i) { ws += v * (i + 1); wt += (i + 1); });
    var weighted = Math.round(ws / wt);

    var trend = 'stable', trendAr = 'مستقر';
    if (n >= 2) {
      var ch = (a[n-1] - a[0]) / (a[0] || 1);
      if (ch >  0.10) { trend = 'rising';  trendAr = 'تصاعدي'; }
      if (ch < -0.10) { trend = 'falling'; trendAr = 'تنازلي'; }
    }

    var conf, confAr, note;
    if (n < 3)      { conf='low';    confAr='منخفضة'; note='البيانات غير كافية لتوقع عالي الثقة.'; }
    else if (n < 5) { conf='medium'; confAr='متوسطة'; note='توقع تقريبي مبني على ' + n + ' قراءات.'; }
    else            { conf='good';   confAr='جيدة';   note='مبني على ' + n + ' قراءات.'; }

    var spread = Math.max(srt[n-1] - srt[0], Math.round(weighted * 0.10));
    var pad = n < 3 ? Math.round(spread * 0.75) : Math.round(spread * 0.5);

    return {
      billId: billId, title: bill.title,
      expectedMinor: weighted, isManual: false,
      averageMinor: avg, medianMinor: med, weightedMinor: weighted,
      minMinor: srt[0], maxMinor: srt[n-1], lastMinor: a[n-1],
      trend: trend, trendAr: trendAr,
      confidence: conf, confidenceAr: confAr, note: note,
      rangeLowMinor: Math.max(0, weighted - pad),
      rangeHighMinor: weighted + pad,
      history: entries, entryCount: n
    };
  }

  function engineObligations() {
    var list = [];
    state.obligations.forEach(function (o) {
      if (!o.active || o.settled) return;
      list.push({ id:o.id, name:o.title, amount:o.amountMinor, dueDate:o.nextDueDate,
        category:o.category, isEssential:o.essentiality === 'essential',
        icon:o.icon, kind:'obligation' });
    });
    state.variableBills.forEach(function (b) {
      if (!b.active || b.settled) return;
      var f = forecast(b.id);
      if (!f || !f.expectedMinor) return;
      list.push({ id:b.id, name:b.title, amount:f.expectedMinor, dueDate:b.usualDueDate,
        category:b.category, isEssential:b.essentiality !== 'optional',
        icon:b.icon, kind:'variable_bill', isForecast:true, confidence:f.confidence });
    });
    return list.sort(function (x, y) { return x.dueDate.localeCompare(y.dueDate); });
  }

  function notify() {
    var snap = Store.getSnapshot();
    subs.forEach(function (fn) { try { fn(snap); } catch (e) {} });
  }

  /* ─── نفس واجهة QararStore تمامًا ─── */

  var Store = {
    __isFallback: true,      // ← علامة صريحة

    subscribe: function (fn) {
      subs.push(fn);
      return function () {
        var i = subs.indexOf(fn);
        if (i >= 0) subs.splice(i, 1);
      };
    },

    recalculateFinancialSnapshot: function () { notify(); return Store.getSnapshot(); },

    getProfile: function () { var p = {}; for (var k in state.profile) p[k] = state.profile[k]; return p; },

    updateProfile: function (patch) {
      for (var k in patch) state.profile[k] = patch[k];
      notify();
      return Store.getProfile();
    },

    getBalance: function () { return balance(); },

    getSnapshot: function () {
      return {
        profile:          Store.getProfile(),
        balanceMinor:     balance(),
        transactions:     state.transactions.slice(),
        obligations:      engineObligations(),
        rawObligations:   state.obligations.slice(),
        variableBills:    state.variableBills.slice(),
        billForecasts:    state.variableBills.map(function (b) { return forecast(b.id); }),
        plannedDecisions: state.plannedDecisions.slice(),
        savingsGoals:     state.savingsGoals.slice()
      };
    },

    buildEngineInput: function (newDecision) {
      return {
        asOfDate:       state.profile.asOfDate,
        currentBalance: balance(),
        safeFloor:      state.profile.safeBalanceMinor,
        monthlyIncome:  state.profile.monthlyIncomeMinor,
        nextSalaryDate: state.profile.salaryDate,
        obligations:    engineObligations(),
        newDecision:    newDecision || null
      };
    },

    getTransactions: function () {
      return state.transactions.slice().sort(function (a, b) {
        return b.transactionDate.localeCompare(a.transactionDate);
      });
    },

    getTransaction: function (id) {
      return state.transactions.filter(function (t) { return t.id === id; })[0] || null;
    },

    addTransaction: function (tx) {
      var amt = Math.abs(Number(tx.amountMinor));
      if (!isFinite(amt) || amt <= 0) throw new Error('مبلغ غير صالح');
      if (tx.type !== 'income' && tx.type !== 'expense') throw new Error('نوع غير صالح');
      var rec = {
        id: uid('tx'), type: tx.type, amountMinor: Math.round(amt),
        title: tx.title, merchantOrSource: tx.merchantOrSource || tx.title,
        category: tx.category || Store.classifyMerchant(tx.merchantOrSource || tx.title),
        transactionDate: tx.transactionDate, notes: tx.notes || '',
        source: tx.source || 'sandbox',
        icon: tx.icon || (tx.type === 'income' ? '💰' : '💳'),
        linkedObligationId: tx.linkedObligationId || null,
        linkedDecisionId: tx.linkedDecisionId || null,
        createdAt: '', updatedAt: ''
      };
      state.transactions.push(rec);
      notify();
      return rec;
    },

    updateTransaction: function (id, patch) {
      var i = -1;
      state.transactions.forEach(function (t, k) { if (t.id === id) i = k; });
      if (i < 0) throw new Error('العملية غير موجودة');
      if (patch.amountMinor != null) patch.amountMinor = Math.abs(Number(patch.amountMinor));
      for (var k in patch) state.transactions[i][k] = patch[k];
      state.transactions[i].id = id;
      notify();
      return state.transactions[i];
    },

    deleteTransaction: function (id) {
      var before = state.transactions.length;
      state.transactions = state.transactions.filter(function (t) { return t.id !== id; });
      notify();
      return state.transactions.length < before;
    },

    classifyMerchant: function (name) {
      var key = String(name || '').toLowerCase();
      for (var r in state.merchantRules) if (key.indexOf(r) >= 0) return state.merchantRules[r];
      return 'أخرى';
    },

    learnMerchant: function (n, c) {
      state.merchantRules[String(n || '').toLowerCase()] = c;
      notify();
    },

    getObligations:  function () { return state.obligations.slice(); },
    addObligation:   function (o) {
      state.obligations.push({
        id: uid('ob'), title: o.title, amountMinor: Math.abs(Number(o.amountMinor)),
        frequency: o.frequency || 'monthly', nextDueDate: o.nextDueDate,
        essentiality: o.essentiality || 'essential',
        category: o.category || 'التزامات', icon: o.icon || '📄',
        active: true, settled: false
      });
      notify();
    },
    updateObligation: function (id, patch) {
      var o = state.obligations.filter(function (x) { return x.id === id; })[0];
      if (!o) throw new Error('غير موجود');
      if (patch.amountMinor != null) patch.amountMinor = Math.abs(Number(patch.amountMinor));
      for (var k in patch) o[k] = patch[k];
      notify();
      return o;
    },
    deleteObligation: function (id) {
      state.obligations = state.obligations.filter(function (o) { return o.id !== id; });
      notify();
    },
    settleObligation: function (id, date) {
      var o = state.obligations.filter(function (x) { return x.id === id; })[0];
      if (!o) throw new Error('غير موجود');
      Store.addTransaction({ type:'expense', amountMinor:o.amountMinor, title:o.title,
        transactionDate: date || state.profile.asOfDate, icon:o.icon,
        linkedObligationId: id });
      o.settled = true;
      notify();
    },

    getVariableBills:    function () { return state.variableBills.slice(); },
    getBillForecast:     function (id) { return forecast(id); },
    getAllBillForecasts: function () {
      return state.variableBills.map(function (b) { return forecast(b.id); });
    },
    getBillHistory: function (id) {
      return state.billHistory.filter(function (h) { return h.billId === id; });
    },
    addBillEntry: function (e) {
      var ex = state.billHistory.filter(function (h) {
        return h.billId === e.billId && h.billingPeriod === e.billingPeriod; })[0];
      if (ex) ex.amountMinor = Math.abs(Number(e.amountMinor));
      else state.billHistory.push({ id: uid('bh'), billId: e.billId,
        billingPeriod: e.billingPeriod, amountMinor: Math.abs(Number(e.amountMinor)) });
      notify();
    },
    deleteBillEntry: function (id) {
      state.billHistory = state.billHistory.filter(function (h) { return h.id !== id; });
      notify();
    },
    setBillManualForecast: function (id, amt) {
      var b = state.variableBills.filter(function (x) { return x.id === id; })[0];
      if (!b) throw new Error('غير موجودة');
      b.manualForecastMinor = (amt == null) ? null : Math.abs(Number(amt));
      notify();
      return b;
    },
    updateVariableBill: function (id, patch) {
      var b = state.variableBills.filter(function (x) { return x.id === id; })[0];
      if (!b) throw new Error('غير موجودة');
      for (var k in patch) b[k] = patch[k];
      notify();
      return b;
    },

    getPlannedDecisions: function () { return state.plannedDecisions.slice(); },
    savePlannedDecision: function (d, a) {
      var rec = { id: uid('pd'), title: d.name, type: d.type, amountMinor: d.amount,
        plannedDate: d.targetDate, paymentMethod: d.paymentMode,
        essentiality: d.isEssential ? 'essential' : 'optional',
        months: d.months || null, status: 'planned',
        summary: a ? { minimumBalanceMinor: a.minimumBalance, riskLevel: a.riskLevel,
                       recommendation: a.recommendation,
                       safeMaximumMinor: a.safeMaximumAmount } : null,
        createdAt: '' };
      state.plannedDecisions.push(rec);
      notify();
      return rec;
    },
    executeDecision: function (id) {
      var d = state.plannedDecisions.filter(function (x) { return x.id === id; })[0];
      if (!d) throw new Error('غير موجود');
      if (d.status === 'executed') throw new Error('ALREADY_EXECUTED');
      Store.addTransaction({ type:'expense', amountMinor:d.amountMinor, title:d.title,
        transactionDate: state.profile.asOfDate, icon:'🎯', linkedDecisionId:id });
      d.status = 'executed';
      notify();
      return d;
    },
    cancelDecision: function (id) {
      var d = state.plannedDecisions.filter(function (x) { return x.id === id; })[0];
      if (d) d.status = 'cancelled';
      notify();
    },
    deleteDecision: function (id) {
      state.plannedDecisions = state.plannedDecisions.filter(function (d) { return d.id !== id; });
      notify();
    },

    getGoals: function () { return state.savingsGoals.slice(); },
    addGoal:  function (g) {
      g.id = uid('gl'); g.savedMinor = 0;
      state.savingsGoals.push(g);
      notify();
    },

    getSpendingHabits: function () {
      var by = {};
      state.transactions.filter(function (t) { return t.type === 'expense'; })
        .forEach(function (t) {
          if (!by[t.category]) by[t.category] = { category:t.category, totalMinor:0, count:0 };
          by[t.category].totalMinor += t.amountMinor;
          by[t.category].count++;
        });
      return Object.keys(by).map(function (k) {
        by[k].averageMinor = Math.round(by[k].totalMinor / by[k].count);
        return by[k];
      }).sort(function (a, b) { return b.totalMinor - a.totalMinor; });
    },

    reset: function () { state = freshState(); notify(); return state; },

    /* 🔴 صريح: هذا متجر بديل — لا يحفظ */
    isPersistent: function () { return false; },

    _resetForTest:     function () { state = freshState(); return state; },
    _clearSubmitGuard: function () {}
  };

  global.QararFallbackStore = Store;

})(typeof globalThis !== 'undefined' ? globalThis : this);
