/* ============================================================================
 * QARAR — DEMO DATA (Schema v2)
 * بيانات العرض — سيناريو اللابتوب المرجعي
 * ============================================================================
 *
 * ⚠️ بيئة تجريبية — لا توجد بيانات مصرفية حقيقية.
 *
 * كل المبالغ بالهللة (1 ريال = 100 هللة).
 *
 * ── السيناريو المرجعي ──
 *   الرصيد الافتتاحي : 4,200 ريال
 *   الراتب           : بعد 6 أيام (12,500 ريال)
 *   كهرباء (متغيرة)  :   650 ريال  ← فاتورة متغيرة، قابلة للتعديل
 *   ماء (متغيرة)     :   180 ريال  ← فاتورة متغيرة، قابلة للتعديل
 *   إنترنت (ثابت)    :   300 ريال  ← التزام ثابت
 *   ─────────────────────────────
 *   مجموع الالتزامات : 1,130 ريال
 *   الحد الآمن       : 1,500 ريال
 *
 *   قرار الاختبار: لابتوب 3,000 ريال اليوم
 *     4,200 − 3,000 = 1,200            ← الرصيد بعد الشراء
 *     1,200 − 1,130 =    70            ← أقل رصيد ⭐
 *     4,200 − 1,130 − 1,500 = 1,570    ← أقصى مبلغ آمن ⭐
 *
 * ── ملاحظة مهمة عن توقع الكهرباء ──
 *   الكهرباء فاتورة *متغيرة* لها سجل شهري حقيقي (520 / 610 / 730 / 680).
 *   المتوسط المرجّح لهذا السجل = 665 ريالًا، وليس 650.
 *
 *   لذلك نبدأ العرض بـ«تعديل يدوي» ظاهر وصريح على قيمة 650 —
 *   وهي حالة مشروعة تمامًا (المستخدم يعرف فاتورته القادمة).
 *
 *   هذا يحقق شيئين معًا:
 *     1. سيناريو الـ70 يعمل بدقة (الأساس المرجعي محفوظ).
 *     2. الفاتورة تبقى *قابلة للتعديل بالكامل* — غيّرها إلى 900
 *        فيتغير كل شيء، أو احذف التعديل اليدوي فيعود التوقع المحسوب (665).
 *
 *   لم نُزوّر التوقع ليعطي 650؛ بل جعلنا مصدر الرقم شفافًا وظاهرًا للمستخدم.
 * ========================================================================= */

(function (global) {
  'use strict';

  const M = (riyal) => Math.round(riyal * 100);      // ريال → هللة

  /** تاريخ ثابت — حتى تكون نتائج العرض قابلة للتكرار أمام الحكام */
  const DEMO_TODAY = '2026-07-12';

  function daysFromToday(n) {
    const [y, m, d] = DEMO_TODAY.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  /* ─── 1. الملف المالي ─── */

  const PROFILE = {
    name:                'أحمد',
    openingBalanceMinor: M(4200),
    monthlyIncomeMinor:  M(12500),
    salaryDate:          daysFromToday(6),
    safeBalanceMinor:    M(1500),
    currency:            'SAR',
    timezone:            'Asia/Riyadh',
    asOfDate:            DEMO_TODAY
  };

  /* ─── 2. الالتزامات الثابتة ─── */

  const OBLIGATIONS = [
    {
      id:           'ob_internet',
      title:        'اشتراك الإنترنت',
      amountMinor:  M(300),
      frequency:    'monthly',
      nextDueDate:  daysFromToday(5),
      essentiality: 'essential',
      category:     'اشتراكات',
      icon:         '🌐',
      active:       true,
      settled:      false
    }
  ];

  /* ─── 3. الفواتير المتغيرة ─── */

  const VARIABLE_BILLS = [
    {
      id:                  'vb_electricity',
      title:               'فاتورة الكهرباء',
      category:            'فواتير',
      usualDueDate:        daysFromToday(3),
      essentiality:        'essential',
      icon:                '⚡',
      active:              true,
      settled:             false,
      defaultAmountMinor:  M(650),
      /* تعديل يدوي ظاهر — المستخدم يعرف فاتورته القادمة.
         احذفه من الواجهة ليعود التوقع المحسوب من السجل (665 ريالًا). */
      manualForecastMinor: M(650)
    },
    {
      id:                  'vb_water',
      title:               'فاتورة الماء',
      category:            'فواتير',
      usualDueDate:        daysFromToday(4),
      essentiality:        'essential',
      icon:                '💧',
      active:              true,
      settled:             false,
      defaultAmountMinor:  M(180),
      manualForecastMinor: M(180)
    }
  ];

  /* ─── 4. سجل الفواتير الشهري (بيانات حقيقية قابلة للتحليل) ─── */

  const BILL_HISTORY = [
    /* الكهرباء — سجل 4 أشهر (اتجاه تصاعدي) */
    { id:'bh_e1', billId:'vb_electricity', billingPeriod:'2026-03', amountMinor:M(520), source:'manual', createdAt:'', updatedAt:'' },
    { id:'bh_e2', billId:'vb_electricity', billingPeriod:'2026-04', amountMinor:M(610), source:'manual', createdAt:'', updatedAt:'' },
    { id:'bh_e3', billId:'vb_electricity', billingPeriod:'2026-05', amountMinor:M(730), source:'manual', createdAt:'', updatedAt:'' },
    { id:'bh_e4', billId:'vb_electricity', billingPeriod:'2026-06', amountMinor:M(680), source:'manual', createdAt:'', updatedAt:'' },

    /* الماء — سجل 4 أشهر (مستقر) */
    { id:'bh_w1', billId:'vb_water', billingPeriod:'2026-03', amountMinor:M(165), source:'manual', createdAt:'', updatedAt:'' },
    { id:'bh_w2', billId:'vb_water', billingPeriod:'2026-04', amountMinor:M(175), source:'manual', createdAt:'', updatedAt:'' },
    { id:'bh_w3', billId:'vb_water', billingPeriod:'2026-05', amountMinor:M(190), source:'manual', createdAt:'', updatedAt:'' },
    { id:'bh_w4', billId:'vb_water', billingPeriod:'2026-06', amountMinor:M(180), source:'manual', createdAt:'', updatedAt:'' }
  ];

  /* ─── 5. قرار الاختبار المرجعي ─── */

  const LAPTOP_DECISION = {
    type:        'purchase',
    name:        'شراء لابتوب',
    amount:      M(3000),
    targetDate:  DEMO_TODAY,
    isEssential: false,
    paymentMode: 'one_time'
  };

  /* ─── 6. قواعد تصنيف التجار ─── */

  const MERCHANT_RULES = {
    'panda':    'بقالة',
    'بندة':     'بقالة',
    'تميمي':    'بقالة',
    'mcdonald': 'مطاعم',
    'ماكدونالد':'مطاعم',
    'مطعم':     'مطاعم',
    'netflix':  'اشتراكات',
    'stc':      'فواتير',
    'uber':     'تنقل',
    'بنزين':    'تنقل',
    'كهرباء':   'فواتير',
    'ماء':      'فواتير'
  };

  /* ─── 7. السيناريوهات السريعة ─── */

  const SCENARIOS = [
    { title:'شراء لابتوب', amount:3000, type:'purchase',     icon:'💻', essential:false },
    { title:'رحلة عائلية', amount:4200, type:'travel',       icon:'✈️', essential:false },
    { title:'اشتراك نادي', amount:350,  type:'subscription', icon:'🏋️', essential:false },
    { title:'رسوم مدرسية', amount:6000, type:'education',    icon:'🎒', essential:true  }
  ];

  /* ─── 8. فئات العمليات ─── */

  const CATEGORIES = [
    'بقالة','مطاعم','فواتير','اشتراكات','تعليم','صحة',
    'تنقل','ترفيه','تسوق وتقنية','سكن','أقساط','تحويلات','دخل','قرارات','أخرى'
  ];

  const QararDemo = {
    TODAY:           DEMO_TODAY,
    PROFILE, OBLIGATIONS, VARIABLE_BILLS, BILL_HISTORY,
    LAPTOP_DECISION, MERCHANT_RULES, SCENARIOS, CATEGORIES,
    daysFromToday, M
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = QararDemo;
  global.QararDemo = QararDemo;

})(typeof globalThis !== 'undefined' ? globalThis : this);
