/* ============================================================================
 * QARAR — DATA STORE (Adapter Layer)
 * طبقة البيانات — محوّل قابل للاستبدال
 * ============================================================================
 *
 * ⚠️ حفظ مؤقت للعرض (Temporary Demo Persistence)
 *
 * هذه الطبقة تستخدم localStorage حاليًا كحل مؤقت لإثبات استمرار البيانات.
 * الغرض من عزلها في ملف واحد: عند الانتقال إلى Supabase، نستبدل
 * *هذا الملف فقط* — دون لمس الواجهة أو المحرك.
 *
 * الواجهة (API) ستبقى كما هي:
 *   Store.getProfile()      →  Supabase: select from profiles
 *   Store.addTransaction()  →  Supabase: insert into transactions
 *   ... إلخ
 *
 * قاعدة صارمة: لا يستدعي أي ملف آخر localStorage مباشرة. كل شيء يمر من هنا.
 * ========================================================================= */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'qarar_demo_state_v1';

  /* ─────────────────────────────────────────────────────────────────────────
   * الحالة الافتراضية (من بيانات Demo)
   * ─────────────────────────────────────────────────────────────────────── */

  function defaultState() {
    const D = global.QararDemo;
    return {
      version: 1,
      profile: {
        name:           D.PROFILE.name,
        openingBalance: D.PROFILE.currentBalance,   // الرصيد الافتتاحي
        safeFloor:      D.PROFILE.safeFloor,
        monthlyIncome:  D.PROFILE.monthlyIncome,
        nextSalaryDate: D.PROFILE.nextSalaryDate,
        asOfDate:       D.PROFILE.asOfDate
      },
      obligations:   D.PROFILE.obligations.slice(),
      transactions:  [],                            // العمليات المضافة في Sandbox
      decisions:     [],                            // القرارات المخططة (لا تخصم!)
      goals:         [],                            // أهداف الادخار
      merchantRules: Object.assign({}, D.MERCHANT_RULES)
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * القراءة والكتابة (المكان الوحيد الذي يلمس localStorage)
   * ─────────────────────────────────────────────────────────────────────── */

  let memoryFallback = null;   // احتياطي لو كان localStorage معطلًا

  function read() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fresh = defaultState();
        write(fresh);
        return fresh;
      }
      const parsed = JSON.parse(raw);
      // ترقية النسخة إن اختلفت
      if (parsed.version !== 1) {
        const fresh = defaultState();
        write(fresh);
        return fresh;
      }
      return parsed;
    } catch (e) {
      // localStorage معطل (وضع التصفح الخاص، أو فتح الملف مباشرة في بعض المتصفحات)
      // نتابع بالذاكرة — التطبيق يعمل، لكن لا يحفظ بعد إعادة التحميل
      console.warn('[Qarar] تعذر استخدام التخزين المحلي — سيعمل التطبيق بالذاكرة فقط.', e);
      if (!memoryFallback) memoryFallback = defaultState();
      return memoryFallback;
    }
  }

  function write(state) {
    memoryFallback = state;
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('[Qarar] تعذر الحفظ في التخزين المحلي.', e);
      return false;
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * الرصيد الحالي = الرصيد الافتتاحي + الدخل − المصروفات
   *
   * 🔴 مهم: القرارات المخططة *لا* تُخصم من الرصيد.
   *    القرار خطة، لا عملية منفذة. لا يتحول إلى مصروف حقيقي
   *    إلا إذا أكد المستخدم صراحةً أنه نفّذه.
   * ─────────────────────────────────────────────────────────────────────── */

  function computeBalance(state) {
    let balance = state.profile.openingBalance;
    state.transactions.forEach(function (t) {
      if (t.type === 'income') {
        balance += t.amount;
      } else {
        balance -= t.amount;
      }
    });
    return balance;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * واجهة المتجر العامة (Public API)
   * هذه الدوال هي ما تستدعيه الواجهة — وهي ما سيُعاد كتابته لـSupabase
   * ─────────────────────────────────────────────────────────────────────── */

  const Store = {

    /* ── الملف المالي ── */

    getProfile() {
      return read().profile;
    },

    updateProfile(patch) {
      const state = read();
      state.profile = Object.assign({}, state.profile, patch);
      write(state);
      return state.profile;
    },

    /* ── الرصيد ── */

    getBalance() {
      return computeBalance(read());
    },

    /* ── العمليات (Sandbox) ── */

    getTransactions() {
      // الأحدث أولًا
      return read().transactions.slice().sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
    },

    addTransaction(tx) {
      const state = read();

      const record = {
        id:        't_' + Date.now() + '_' + state.transactions.length,
        name:      tx.name,
        merchant:  tx.merchant || tx.name,
        amount:    tx.amount,              // بالهللة
        type:      tx.type,                // 'income' | 'expense'
        date:      tx.date,
        category:  tx.category || Store.classifyMerchant(tx.merchant || tx.name),
        icon:      tx.icon || (tx.type === 'income' ? '💰' : '💳'),
        createdAt: new Date().toISOString()   // طابع زمني للسجل فقط — لا يدخل في أي حساب مالي
      };

      state.transactions.push(record);
      write(state);
      return record;
    },

    deleteTransaction(id) {
      const state = read();
      state.transactions = state.transactions.filter(t => t.id !== id);
      write(state);
    },

    /* ── تصنيف التجار (التعلم) ── */

    classifyMerchant(merchantName) {
      const state = read();
      const key = String(merchantName || '').toLowerCase().trim();
      for (const rule in state.merchantRules) {
        if (key.includes(rule)) {
          return state.merchantRules[rule];
        }
      }
      return 'أخرى';
    },

    learnMerchant(merchantName, category) {
      const state = read();
      const key = String(merchantName || '').toLowerCase().trim();
      if (key) {
        state.merchantRules[key] = category;
        write(state);
      }
    },

    /* ── الالتزامات ── */

    getObligations() {
      return read().obligations.slice().sort(function (a, b) {
        return a.dueDate.localeCompare(b.dueDate);
      });
    },

    addObligation(o) {
      const state = read();
      state.obligations.push(Object.assign({
        id: 'o_' + Date.now()
      }, o));
      write(state);
    },

    /* ── القرارات المخططة (لا تخصم من الرصيد!) ── */

    getDecisions() {
      return read().decisions.slice();
    },

    saveDecision(decision, analysis) {
      const state = read();
      state.decisions.push({
        id:        'd_' + Date.now(),
        decision:  decision,
        // نحفظ ملخص التحليل فقط (لا الخط الزمني الكامل — يوفّر مساحة)
        summary: {
          minimumBalance:    analysis.minimumBalance,
          riskLevel:         analysis.riskLevel,
          recommendation:    analysis.recommendation,
          safeMaximumAmount: analysis.safeMaximumAmount
        },
        status:    'planned',      // planned | executed | cancelled
        createdAt: new Date().toISOString()
      });
      write(state);
    },

    deleteDecision(id) {
      const state = read();
      state.decisions = state.decisions.filter(d => d.id !== id);
      write(state);
    },

    /* ── أهداف الادخار ── */

    getGoals() {
      return read().goals.slice();
    },

    addGoal(goal) {
      const state = read();
      state.goals.push(Object.assign({
        id:     'g_' + Date.now(),
        saved:  0
      }, goal));
      write(state);
    },

    /* ── بناء مُدخل المحرك من الحالة الحالية ── */

    buildEngineInput(newDecision) {
      const state   = read();
      const profile = state.profile;

      return {
        asOfDate:       profile.asOfDate,
        currentBalance: computeBalance(state),
        safeFloor:      profile.safeFloor,
        monthlyIncome:  profile.monthlyIncome,
        nextSalaryDate: profile.nextSalaryDate,
        obligations:    state.obligations,
        newDecision:    newDecision || null
      };
    },

    /* ── إعادة الضبط (لتجربة حكم جديد) ── */

    reset() {
      const fresh = defaultState();
      write(fresh);
      return fresh;
    },

    /* ── هل التخزين يعمل فعلًا؟ ── */

    isPersistent() {
      try {
        const probe = '__qarar_probe__';
        global.localStorage.setItem(probe, '1');
        global.localStorage.removeItem(probe);
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Store;
  }
  global.QararStore = Store;

})(typeof globalThis !== 'undefined' ? globalThis : this);
