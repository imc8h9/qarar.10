/* ============================================================================
 * QARAR — DEMO DATA
 * بيانات تجريبية — سيناريو اللابتوب المرجعي
 * ============================================================================
 *
 * ⚠️ بيئة تجريبية — لا توجد بيانات مصرفية حقيقية.
 *
 * كل المبالغ بالهللة (1 ريال = 100 هللة).
 *
 * السيناريو المرجعي:
 *   الرصيد الحالي:      4,200 ريال
 *   الراتب:             بعد 6 أيام
 *   كهرباء:               650 ريال  (قبل الراتب)
 *   ماء:                  180 ريال  (قبل الراتب)
 *   إنترنت:               300 ريال  (قبل الراتب)
 *   ─────────────────────────────────
 *   مجموع الالتزامات:   1,130 ريال
 *   الحد الآمن:         1,500 ريال
 *
 *   قرار الاختبار: شراء لابتوب بـ 3,000 ريال اليوم
 *
 *   النتيجة المتوقعة (محسوبة، غير مكتوبة):
 *     4,200 − 3,000 = 1,200 ريال   ← الرصيد بعد الشراء
 *     1,200 − 1,130 =    70 ريالًا  ← أقل رصيد قبل الراتب
 *     4,200 − 1,130 − 1,500 = 1,570 ريالًا ← أقصى مبلغ آمن
 * ========================================================================= */

(function (global) {
  'use strict';

  const M = (riyal) => Math.round(riyal * 100);   // ريال → هللة

  /**
   * تاريخ ثابت للعرض — نستخدم تاريخًا محددًا حتى تكون النتائج
   * قابلة للتكرار تمامًا أمام الحكام (لا تتغير بتغير اليوم).
   */
  const DEMO_TODAY = '2026-07-12';

  /** حساب تاريخ بعد عدد أيام من DEMO_TODAY */
  function daysFromToday(n) {
    const [y, m, d] = DEMO_TODAY.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * الملف المالي التجريبي
   * ─────────────────────────────────────────────────────────────────────── */

  const DEMO_PROFILE = {
    name:           'أحمد',
    asOfDate:       DEMO_TODAY,

    currentBalance: M(4200),      // 420,000 هللة
    safeFloor:      M(1500),      // 150,000 هللة — الحد الآمن
    monthlyIncome:  M(12500),     // الراتب الشهري

    nextSalaryDate: daysFromToday(6),   // الراتب بعد 6 أيام

    /** الالتزامات القادمة قبل الراتب — المجموع 1,130 ريال */
    obligations: [
      {
        id:          'bill_electricity',
        name:        'فاتورة الكهرباء',
        amount:      M(650),           // 65,000 هللة
        dueDate:     daysFromToday(3),
        category:    'فواتير',
        isEssential: true,
        icon:        '⚡'
      },
      {
        id:          'bill_water',
        name:        'فاتورة الماء',
        amount:      M(180),           // 18,000 هللة
        dueDate:     daysFromToday(4),
        category:    'فواتير',
        isEssential: true,
        icon:        '💧'
      },
      {
        id:          'sub_internet',
        name:        'اشتراك الإنترنت',
        amount:      M(300),           // 30,000 هللة
        dueDate:     daysFromToday(5),
        category:    'اشتراكات',
        isEssential: true,
        icon:        '🌐'
      }
    ]
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * قرار الاختبار المرجعي — شراء اللابتوب
   * ─────────────────────────────────────────────────────────────────────── */

  const DEMO_LAPTOP_DECISION = {
    type:        'purchase',
    name:        'شراء لابتوب',
    amount:      M(3000),          // 300,000 هللة
    targetDate:  DEMO_TODAY,       // اليوم
    isEssential: false,
    paymentMode: 'one_time'
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * عمليات تجريبية أولية (Sandbox)
   * ─────────────────────────────────────────────────────────────────────── */

  const DEMO_TRANSACTIONS = [
    { id:'t1', name:'الراتب الشهري',  merchant:'صاحب العمل', amount: M(12500), type:'income',  date: daysFromToday(-24), category:'دخل',    icon:'💰' },
    { id:'t2', name:'بقالة',          merchant:'Panda',      amount: M(310),   type:'expense', date: daysFromToday(-18), category:'بقالة',  icon:'🛒' },
    { id:'t3', name:'إيجار',          merchant:'المالك',     amount: M(3500),  type:'expense', date: daysFromToday(-20), category:'سكن',    icon:'🏠' },
    { id:'t4', name:'مطعم',           merchant:"McDonald's", amount: M(85),    type:'expense', date: daysFromToday(-12), category:'مطاعم',  icon:'🍔' },
    { id:'t5', name:'اشتراك Netflix', merchant:'Netflix',    amount: M(56),    type:'expense', date: daysFromToday(-10), category:'اشتراكات', icon:'🎬' },
    { id:'t6', name:'بنزين',          merchant:'محطة وقود',  amount: M(120),   type:'expense', date: daysFromToday(-7),  category:'تنقل',   icon:'⛽' },
    { id:'t7', name:'بقالة',          merchant:'Panda',      amount: M(275),   type:'expense', date: daysFromToday(-3),  category:'بقالة',  icon:'🛒' }
  ];

  /* ─────────────────────────────────────────────────────────────────────────
   * قواعد تصنيف التجار (تعلم أسماء التجار)
   * ─────────────────────────────────────────────────────────────────────── */

  const DEMO_MERCHANT_RULES = {
    'panda':      'بقالة',
    'mcdonald':   'مطاعم',
    'netflix':    'اشتراكات',
    'stc':        'فواتير',
    'uber':       'تنقل'
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * السيناريوهات السريعة لصفحة القرار
   * ─────────────────────────────────────────────────────────────────────── */

  const DEMO_SCENARIOS = [
    { title:'شراء لابتوب',   amount: 3000, type:'purchase',     icon:'💻', essential:false },
    { title:'رحلة عائلية',   amount: 4200, type:'travel',       icon:'✈️', essential:false },
    { title:'اشتراك نادي',   amount: 350,  type:'subscription', icon:'🏋️', essential:false },
    { title:'رسوم مدرسية',   amount: 6000, type:'education',    icon:'🎒', essential:true  }
  ];

  const QararDemo = {
    TODAY:            DEMO_TODAY,
    PROFILE:          DEMO_PROFILE,
    LAPTOP_DECISION:  DEMO_LAPTOP_DECISION,
    TRANSACTIONS:     DEMO_TRANSACTIONS,
    MERCHANT_RULES:   DEMO_MERCHANT_RULES,
    SCENARIOS:        DEMO_SCENARIOS,
    daysFromToday:    daysFromToday,
    M:                M
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QararDemo;
  }
  global.QararDemo = QararDemo;

})(typeof globalThis !== 'undefined' ? globalThis : this);
