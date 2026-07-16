/* ============================================================================
 * QARAR — ENGINE TEST SUITE
 * اختبارات محرك القرار المالي
 * ============================================================================
 *
 * التشغيل:  node tests/engine.test.js
 *
 * الهدف: إثبات أن الرقم 70 والرقم 1,570 يخرجان من الحساب،
 *        ولم يُكتبا يدويًا في أي مكان.
 * ========================================================================= */

const Engine = require('../src/decision-engine.js');
const Demo   = require('../src/demo-data.js');

const { Money } = Engine;

/* ── أدوات الاختبار ── */

let passed = 0;
let failed = 0;
const failures = [];

const C = {
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m', reset: '\x1b[0m'
};

function assert(condition, label, expected, actual) {
  if (condition) {
    passed++;
    console.log(`  ${C.green}✓${C.reset} ${label}`);
  } else {
    failed++;
    failures.push({ label, expected, actual });
    console.log(`  ${C.red}✗ ${label}${C.reset}`);
    console.log(`    ${C.dim}المتوقع:${C.reset} ${expected}`);
    console.log(`    ${C.dim}الفعلي: ${C.reset} ${actual}`);
  }
}

function assertEquals(actual, expected, label) {
  assert(actual === expected, label, expected, actual);
}

function section(title) {
  console.log(`\n${C.bold}${C.cyan}${title}${C.reset}`);
  console.log(C.dim + '─'.repeat(66) + C.reset);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * الاختبار 1 — سيناريو اللابتوب (الاختبار المرجعي الإلزامي)
 * ═════════════════════════════════════════════════════════════════════════ */

section('الاختبار 1 — سيناريو اللابتوب المرجعي ⭐');

/* المُدخل مبني بنفس أرقام السيناريو المرجعي (schema v2).
   هذا اختبار Regression للمحرك وحده — معزول عن المتجر. */
const laptopInput = {
  asOfDate:       Demo.PROFILE.asOfDate,
  currentBalance: Demo.PROFILE.openingBalanceMinor,
  safeFloor:      Demo.PROFILE.safeBalanceMinor,
  monthlyIncome:  Demo.PROFILE.monthlyIncomeMinor,
  nextSalaryDate: Demo.PROFILE.salaryDate,
  obligations: [
    { id:'e', name:'فاتورة الكهرباء', amount: Money.fromRiyal(650),
      dueDate: Demo.daysFromToday(3), isEssential:true, icon:'⚡' },
    { id:'w', name:'فاتورة الماء',   amount: Money.fromRiyal(180),
      dueDate: Demo.daysFromToday(4), isEssential:true, icon:'💧' },
    { id:'i', name:'اشتراك الإنترنت', amount: Money.fromRiyal(300),
      dueDate: Demo.daysFromToday(5), isEssential:true, icon:'🌐' }
  ],
  newDecision:    Demo.LAPTOP_DECISION
};

const r = Engine.analyzeDecision(laptopInput);

console.log(`\n  ${C.dim}المدخلات:${C.reset}`);
console.log(`    الرصيد الحالي     : ${Money.formatWithCurrency(laptopInput.currentBalance)}`);
console.log(`    سعر اللابتوب      : ${Money.formatWithCurrency(Demo.LAPTOP_DECISION.amount)}`);
console.log(`    الحد الآمن        : ${Money.formatWithCurrency(laptopInput.safeFloor)}`);
console.log(`    الالتزامات        : كهرباء 650 + ماء 180 + إنترنت 300`);
console.log(`\n  ${C.dim}المخرجات المحسوبة:${C.reset}`);
console.log(`    الرصيد بعد الشراء : ${Money.formatWithCurrency(r.balanceAfterDecision)}`);
console.log(`    مجموع الالتزامات  : ${Money.formatWithCurrency(r.obligationsBeforeSalary)}`);
console.log(`    ${C.bold}أقل رصيد متوقع    : ${Money.formatWithCurrency(r.minimumBalance)}${C.reset}  ⭐`);
console.log(`    الفرق عن الحد الآمن: ${Money.formatWithCurrency(r.gapFromSafeFloor)}`);
console.log(`    ${C.bold}أقصى مبلغ آمن     : ${Money.formatWithCurrency(r.safeMaximumAmount)}${C.reset}  ⭐`);
console.log(`    مستوى الخطر       : ${r.riskLevelAr}`);
console.log(`    التوصية           : ${r.recommendationAr}\n`);

assertEquals(r.ok, true, 'المحرك أرجع نتيجة صالحة');

// ⭐ الرقم 1,200 — الرصيد بعد الشراء (4,200 − 3,000)
assertEquals(
  r.balanceAfterDecision, Money.fromRiyal(1200),
  'الرصيد بعد القرار = 1,200 ريال  (4,200 − 3,000)'
);

// ⭐ الرقم 1,130 — مجموع الالتزامات (650 + 180 + 300)
assertEquals(
  r.obligationsBeforeSalary, Money.fromRiyal(1130),
  'مجموع الالتزامات = 1,130 ريال  (650 + 180 + 300)'
);

// ⭐⭐ الرقم 70 — أقل رصيد متوقع (1,200 − 1,130)  ← الرقم الأهم في المشروع
assertEquals(
  r.minimumBalance, Money.fromRiyal(70),
  '⭐ أقل رصيد متوقع = 70 ريالًا  (1,200 − 1,130)'
);

// ⭐ الفرق عن الحد الآمن (70 − 1,500 = −1,430)
assertEquals(
  r.gapFromSafeFloor, Money.fromRiyal(-1430),
  'الفرق عن الحد الآمن = −1,430 ريالًا  (70 − 1,500)'
);

// ⭐⭐ الرقم 1,570 — أقصى مبلغ آمن (4,200 − 1,130 − 1,500)
assertEquals(
  r.safeMaximumAmount, Money.fromRiyal(1570),
  '⭐ أقصى مبلغ آمن = 1,570 ريالًا  (4,200 − 1,130 − 1,500)'
);

// مستوى الخطر
assertEquals(r.riskLevel, Engine.RISK.HIGH, 'مستوى الخطر = مرتفع');

// التوصية = تأجيل
assert(
  r.recommendation === Engine.RECOMMENDATION.WAIT_FOR_SALARY ||
  r.recommendation === Engine.RECOMMENDATION.NOT_ADVISED,
  'التوصية = انتظار الراتب / لا يُنصح',
  'wait_for_salary أو not_advised',
  r.recommendation
);

// الرصيد لا يصبح سالبًا
assertEquals(r.goesNegative, false, 'الرصيد لا يصبح سالبًا');

// توجد بدائل معروضة
assert(r.alternatives.length >= 3, 'توجد 3 بدائل على الأقل', '≥ 3', r.alternatives.length);

// يوجد سبب واضح للتحذير
assert(r.riskReasons.length > 0, 'يوجد سبب واضح للتحذير', '> 0', r.riskReasons.length);

/* ═══════════════════════════════════════════════════════════════════════════
 * الاختبار 2 — إثبات أن الأرقام محسوبة، لا مكتوبة
 * ═════════════════════════════════════════════════════════════════════════ */

section('الاختبار 2 — إثبات الحساب (تغيير المدخلات يغيّر النتيجة)');

// نغيّر الرصيد من 4,200 إلى 10,000 → يجب أن تتغير كل الأرقام
const richInput = Object.assign({}, laptopInput, {
  currentBalance: Money.fromRiyal(10000)
});
const r2 = Engine.analyzeDecision(richInput);

// 10,000 − 3,000 − 1,130 = 5,870
assertEquals(
  r2.minimumBalance, Money.fromRiyal(5870),
  'رصيد 10,000 → أقل رصيد = 5,870  (ليس 70 — الرقم محسوب!)'
);

// 10,000 − 1,130 − 1,500 = 7,370
assertEquals(
  r2.safeMaximumAmount, Money.fromRiyal(7370),
  'رصيد 10,000 → أقصى آمن = 7,370  (ليس 1,570 — الرقم محسوب!)'
);

assertEquals(r2.riskLevel, Engine.RISK.LOW, 'رصيد 10,000 → الخطر منخفض');
assertEquals(r2.recommendation, Engine.RECOMMENDATION.PROCEED, 'رصيد 10,000 → التوصية: نفّذ');

// نغيّر سعر اللابتوب إلى 1,000 فقط
const cheapInput = Object.assign({}, laptopInput, {
  newDecision: Object.assign({}, Demo.LAPTOP_DECISION, { amount: Money.fromRiyal(1000) })
});
const r3 = Engine.analyzeDecision(cheapInput);

// 4,200 − 1,000 − 1,130 = 2,070
assertEquals(
  r3.minimumBalance, Money.fromRiyal(2070),
  'لابتوب بـ1,000 → أقل رصيد = 2,070  (فوق الحد الآمن)'
);
assertEquals(r3.riskLevel, Engine.RISK.LOW, 'لابتوب بـ1,000 → الخطر منخفض');

/* ═══════════════════════════════════════════════════════════════════════════
 * الاختبار 3 — الحتمية (نفس المدخلات ⇒ نفس المخرجات)
 * ═════════════════════════════════════════════════════════════════════════ */

section('الاختبار 3 — الحتمية (Determinism)');

const runA = Engine.analyzeDecision(laptopInput);
const runB = Engine.analyzeDecision(laptopInput);
const runC = Engine.analyzeDecision(laptopInput);

assertEquals(
  JSON.stringify(runA) === JSON.stringify(runB) &&
  JSON.stringify(runB) === JSON.stringify(runC),
  true,
  'ثلاث تشغيلات متتالية → نتائج متطابقة تمامًا'
);

assertEquals(runA.minimumBalance, runB.minimumBalance, 'أقل رصيد ثابت عبر التشغيلات');
assertEquals(runA.safeMaximumAmount, runC.safeMaximumAmount, 'أقصى مبلغ آمن ثابت');

/* فحص نقاء الكود المصدري.
 *
 * مهم: نحذف التعليقات أولًا قبل الفحص.
 * السبب: التعليقات نفسها تذكر "لا Math.random()" — ولو فحصنا النص الخام
 * لظهرت نتيجة إيجابية كاذبة. نحن نفحص الكود الفعلي، لا الشرح المكتوب عنه. */
const fs = require('fs');
const rawSource = fs.readFileSync(__dirname + '/../src/decision-engine.js', 'utf8');

const codeOnly = rawSource
  .replace(/\/\*[\s\S]*?\*\//g, '')   // حذف تعليقات /* ... */
  .replace(/\/\/.*$/gm, '');          // حذف تعليقات //

assertEquals(
  /Math\.random\s*\(/.test(codeOnly), false,
  'الكود الفعلي لا يحتوي على Math.random()  (صفر عشوائية)'
);

assertEquals(
  /Date\.now\s*\(/.test(codeOnly), false,
  'الكود الفعلي لا يحتوي على Date.now()'
);

/* new Date() فارغة = قراءة ساعة النظام = كسر الحتمية.
 * لكن new Date(رقم) = بناء من قيمة مُمرَّرة = آمن وحتمي.
 * نمنع الأولى فقط. */
assertEquals(
  /new\s+Date\s*\(\s*\)/.test(codeOnly), false,
  'الكود لا يقرأ ساعة النظام (لا new Date() فارغة)'
);

/* تحقق سلوكي — أقوى من فحص النص:
 * المحرك يجب أن يستخدم التاريخ المُمرَّر، لا تاريخ اليوم الفعلي. */
const fixedDateRun = Engine.analyzeDecision(laptopInput);
assertEquals(
  fixedDateRun.input.asOfDate, laptopInput.asOfDate,
  'المحرك يستخدم التاريخ المُمرَّر (asOfDate)، لا تاريخ اليوم'
);

/* ═══════════════════════════════════════════════════════════════════════════
 * الاختبار 4 — دقة الأموال (الهللة)
 * ═════════════════════════════════════════════════════════════════════════ */

section('الاختبار 4 — دقة الأموال (لا أخطاء عشرية)');

// المشكلة الكلاسيكية في جافاسكربت
assertEquals(0.1 + 0.2 === 0.3, false, 'تأكيد: 0.1 + 0.2 ≠ 0.3 في جافاسكربت (لهذا نستخدم الهللة)');

// حلنا: أعداد صحيحة
assertEquals(Money.fromRiyal(0.1) + Money.fromRiyal(0.2), Money.fromRiyal(0.3),
  'بالهللة: 0.1 + 0.2 = 0.3 بدقة تامة ✓');

assertEquals(Money.fromRiyal(3000), 300000, 'تحويل: 3,000 ريال = 300,000 هللة');
assertEquals(Money.toRiyal(300000), 3000, 'تحويل عكسي: 300,000 هللة = 3,000 ريال');

// كل المخرجات أعداد صحيحة
assertEquals(Number.isInteger(r.minimumBalance), true, 'أقل رصيد عدد صحيح (هللة)');
assertEquals(Number.isInteger(r.safeMaximumAmount), true, 'أقصى مبلغ آمن عدد صحيح (هللة)');
assertEquals(Number.isInteger(r.balanceAfterDecision), true, 'الرصيد بعد القرار عدد صحيح');

/* ═══════════════════════════════════════════════════════════════════════════
 * الاختبار 5 — الحالات الحرجة
 * ═════════════════════════════════════════════════════════════════════════ */

section('الاختبار 5 — الحالات الحرجة');

// رصيد سالب — قرار أكبر من الرصيد بكثير
const criticalInput = Object.assign({}, laptopInput, {
  newDecision: Object.assign({}, Demo.LAPTOP_DECISION, { amount: Money.fromRiyal(8000) })
});
const rCrit = Engine.analyzeDecision(criticalInput);

assertEquals(rCrit.goesNegative, true, 'قرار 8,000 برصيد 4,200 → الرصيد يصبح سالبًا');
assertEquals(rCrit.riskLevel, Engine.RISK.CRITICAL, 'قرار 8,000 → الخطر حرج');
assertEquals(rCrit.recommendation, Engine.RECOMMENDATION.NOT_ADVISED, 'قرار 8,000 → لا يُنصح');
assert(rCrit.unfundedBills.length > 0, 'قرار 8,000 → توجد فواتير غير مغطاة', '> 0', rCrit.unfundedBills.length);

// التقسيط يقلل الأثر الفوري
const installmentInput = Object.assign({}, laptopInput, {
  newDecision: Object.assign({}, Demo.LAPTOP_DECISION, {
    paymentMode: 'installment',
    months: 6
  })
});
const rInst = Engine.analyzeDecision(installmentInput);

// 3,000 ÷ 6 = 500 شهريًا → 4,200 − 500 = 3,700
assertEquals(
  rInst.balanceAfterDecision, Money.fromRiyal(3700),
  'تقسيط 6 أشهر → الرصيد بعد أول قسط = 3,700  (4,200 − 500)'
);
assert(
  rInst.minimumBalance > r.minimumBalance,
  'التقسيط يعطي أقل رصيد أفضل من الدفع مرة واحدة',
  `> ${Money.format(r.minimumBalance)}`,
  Money.format(rInst.minimumBalance)
);

/* ═══════════════════════════════════════════════════════════════════════════
 * الاختبار 6 — التحقق من المدخلات
 * ═════════════════════════════════════════════════════════════════════════ */

section('الاختبار 6 — رفض المدخلات غير الصالحة');

const bad1 = Engine.analyzeDecision({ asOfDate: 'غير-صالح', currentBalance: 100, safeFloor: 0 });
assertEquals(bad1.ok, false, 'تاريخ غير صالح → مرفوض');

const bad2 = Engine.analyzeDecision({
  asOfDate: '2026-07-12', currentBalance: 420000, safeFloor: 150000,
  newDecision: { amount: -5000, targetDate: '2026-07-12' }
});
assertEquals(bad2.ok, false, 'مبلغ سالب → مرفوض');

const bad3 = Engine.analyzeDecision({
  asOfDate: '2026-07-12', currentBalance: 1234.56, safeFloor: 150000
});
assertEquals(bad3.ok, false, 'رصيد بأرقام عشرية → مرفوض (يجب أن يكون هللة صحيحة)');

/* ═══════════════════════════════════════════════════════════════════════════
 * الاختبار 7 — المقارنة (مع/بدون القرار)
 * ═════════════════════════════════════════════════════════════════════════ */

section('الاختبار 7 — المقارنة: المستقبل بدون القرار مقابل معه');

// بدون القرار: 4,200 − 1,130 = 3,070 (فوق الحد الآمن)
assertEquals(
  r.comparison.withoutDecision.minimumBalance, Money.fromRiyal(3070),
  'بدون القرار → أقل رصيد = 3,070  (آمن)'
);
assertEquals(
  r.comparison.withoutDecision.belowSafeFloor, false,
  'بدون القرار → فوق الحد الآمن ✓'
);
assertEquals(
  r.comparison.withDecision.belowSafeFloor, true,
  'مع القرار → تحت الحد الآمن ✗'
);
// الفرق: 70 − 3,070 = −3,000 (بالضبط سعر اللابتوب)
assertEquals(
  r.comparison.difference, Money.fromRiyal(-3000),
  'الفرق = −3,000 ريالًا (بالضبط سعر اللابتوب) ✓'
);

/* ═══════════════════════════════════════════════════════════════════════════
 * النتيجة النهائية
 * ═════════════════════════════════════════════════════════════════════════ */

console.log('\n' + '═'.repeat(66));
const total = passed + failed;
if (failed === 0) {
  console.log(`${C.bold}${C.green}  ✓ نجحت جميع الاختبارات: ${passed}/${total}${C.reset}`);
  console.log('═'.repeat(66));
  console.log(`\n${C.bold}${C.green}  ⭐ الرقم 70 ريالًا:   محسوب من المحرك ✓${C.reset}`);
  console.log(`${C.bold}${C.green}  ⭐ الرقم 1,570 ريالًا: محسوب من المحرك ✓${C.reset}`);
  console.log(`${C.bold}${C.green}  ⭐ المحرك حتمي:        لا عشوائية ✓${C.reset}\n`);
  process.exit(0);
} else {
  console.log(`${C.bold}${C.red}  ✗ فشلت ${failed} اختبارات من ${total}${C.reset}`);
  console.log('═'.repeat(66));
  failures.forEach(f => {
    console.log(`\n  ${C.red}✗${C.reset} ${f.label}`);
    console.log(`    المتوقع: ${f.expected}`);
    console.log(`    الفعلي:  ${f.actual}`);
  });
  console.log('');
  process.exit(1);
}
