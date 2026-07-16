/* ============================================================================
 * QARAR — PHASE A TEST SUITE
 * اختبارات المرحلة A — البيانات الديناميكية
 * ============================================================================
 * التشغيل: node tests/phase-a.test.js
 * ========================================================================= */

/* localStorage shim */
const _s = {};
global.localStorage = {
  getItem:    k => (_s[k] === undefined ? null : _s[k]),
  setItem:    (k, v) => { _s[k] = String(v); },
  removeItem: k => { delete _s[k]; }
};

const Engine = require('../src/decision-engine.js');
require('../src/demo-data.js');
const Store  = require('../src/data-store.js');
const Demo   = global.QararDemo;

const M = Engine.Money;
const R = x => M.toRiyal(x);   // هللة → ريال (للقراءة)

let pass = 0, fail = 0;
const failures = [];
const C = { g:'\x1b[32m', r:'\x1b[31m', c:'\x1b[36m', b:'\x1b[1m', d:'\x1b[2m', x:'\x1b[0m' };

function ok(cond, label, exp, act) {
  if (cond) { pass++; console.log(`  ${C.g}✓${C.x} ${label}`); }
  else {
    fail++; failures.push({label, exp, act});
    console.log(`  ${C.r}✗ ${label}${C.x}`);
    console.log(`    ${C.d}المتوقع:${C.x} ${exp}`);
    console.log(`    ${C.d}الفعلي: ${C.x} ${act}`);
  }
}
function eq(actual, expected, label) { ok(actual === expected, label, expected, actual); }
function sec(t) { console.log(`\n${C.b}${C.c}${t}${C.x}`); console.log(C.d + '─'.repeat(68) + C.x); }

/** تشغيل المحرك على سيناريو اللابتوب بالحالة الحالية */
const laptop = () => Engine.analyzeDecision(Store.buildEngineInput(Demo.LAPTOP_DECISION));

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 — سيناريو 70 الأصلي (Regression — يجب ألا ينكسر أبدًا)
 * ═════════════════════════════════════════════════════════════════════════ */
sec('١ — سيناريو 70 الأصلي (Regression) ⭐');

Store._resetForTest();
let r = laptop();

eq(R(r.currentBalance),          4200,  'الرصيد الحالي = 4,200');
eq(R(r.obligationsBeforeSalary), 1130,  'الالتزامات = 1,130  (650 + 180 + 300)');
eq(R(r.balanceAfterDecision),    1200,  'الرصيد بعد الشراء = 1,200');
eq(R(r.minimumBalance),            70,  '⭐ أقل رصيد = 70');
eq(R(r.safeMaximumAmount),       1570,  '⭐ أقصى مبلغ آمن = 1,570');
eq(r.riskLevel,        Engine.RISK.HIGH, 'مستوى الخطر = مرتفع');

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 — تغيير الكهرباء 650 → 900  ⇒  النتيجة −180
 * ═════════════════════════════════════════════════════════════════════════ */
sec('٢ — تغيير الكهرباء إلى 900 ⇒ النتيجة −180 ⭐');

Store._resetForTest();
Store.setBillManualForecast('vb_electricity', M.fromRiyal(900));
r = laptop();

console.log(`  ${C.d}الحساب: 4,200 − 3,000 − (900+180+300=1,380) = −180${C.x}`);
eq(R(r.obligationsBeforeSalary), 1380, 'الالتزامات صارت 1,380  (900 + 180 + 300)');
eq(R(r.minimumBalance),          -180, '⭐ أقل رصيد = −180');
eq(r.goesNegative,               true, 'الرصيد يصبح سالبًا');
eq(r.riskLevel,   Engine.RISK.CRITICAL,'مستوى الخطر تغيّر تلقائيًا → حرج');
eq(r.recommendation, Engine.RECOMMENDATION.NOT_ADVISED, 'التوصية تغيّرت → لا يُنصح');

/* إرجاع الكهرباء يُعيد النتيجة */
Store.setBillManualForecast('vb_electricity', M.fromRiyal(650));
r = laptop();
eq(R(r.minimumBalance), 70, 'إرجاع الكهرباء إلى 650 → يعود 70 (عكوس)');

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 — إضافة مصروف 200  ⇒  النتيجة −130
 * ═════════════════════════════════════════════════════════════════════════ */
sec('٣ — إضافة مصروف 200 ⇒ النتيجة −130 ⭐');

Store._resetForTest();
const expTx = Store.addTransaction({
  type: 'expense', amountMinor: M.fromRiyal(200),
  title: 'بقالة', merchantOrSource: 'Panda',
  transactionDate: Demo.TODAY
});
r = laptop();

console.log(`  ${C.d}الحساب: (4,200 − 200 = 4,000) − 3,000 − 1,130 = −130${C.x}`);
eq(R(Store.getBalance()), 4000, 'المصروف نقص الرصيد → 4,000');
eq(R(r.minimumBalance),   -130, '⭐ أقل رصيد = −130');
eq(r.goesNegative,        true, 'الرصيد يصبح سالبًا');

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 — إضافة دخل 1,000  ⇒  النتيجة 1,070
 * ═════════════════════════════════════════════════════════════════════════ */
sec('٤ — إضافة دخل 1,000 ⇒ النتيجة 1,070 ⭐');

Store._resetForTest();
Store.addTransaction({
  type: 'income', amountMinor: M.fromRiyal(1000),
  title: 'مكافأة', merchantOrSource: 'العمل',
  transactionDate: Demo.TODAY
});
r = laptop();

console.log(`  ${C.d}الحساب: (4,200 + 1,000 = 5,200) − 3,000 − 1,130 = 1,070${C.x}`);
eq(R(Store.getBalance()), 5200, 'الدخل زاد الرصيد → 5,200');
eq(R(r.minimumBalance),   1070, '⭐ أقل رصيد = 1,070');
eq(r.goesNegative,       false, 'الرصيد لا يصبح سالبًا');
ok(r.riskLevel !== Engine.RISK.CRITICAL, 'مستوى الخطر تحسّن', '≠ حرج', r.riskLevelAr);
/* أقصى آمن = 5,200 − 1,130 − 1,500 = 2,570 */
eq(R(r.safeMaximumAmount), 2570, 'أقصى مبلغ آمن تغيّر → 2,570');

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 — حذف العملية يُعيد النتيجة
 * ═════════════════════════════════════════════════════════════════════════ */
sec('٥ — حذف العملية يُعيد النتيجة');

Store._resetForTest();
const t1 = Store.addTransaction({
  type:'expense', amountMinor:M.fromRiyal(200), title:'بقالة', transactionDate:Demo.TODAY
});
eq(R(laptop().minimumBalance), -130, 'بعد الإضافة: −130');

Store.deleteTransaction(t1.id);
eq(R(Store.getBalance()),        4200, 'بعد الحذف: الرصيد عاد 4,200');
eq(R(laptop().minimumBalance),     70, 'بعد الحذف: النتيجة عادت 70 ✓');
eq(Store.getTransactions().length,  0, 'قائمة العمليات فارغة');

/* ═══════════════════════════════════════════════════════════════════════════
 * 6 — تعديل العملية لا يكررها
 * ═════════════════════════════════════════════════════════════════════════ */
sec('٦ — تعديل العملية لا يكررها');

Store._resetForTest();
const t2 = Store.addTransaction({
  type:'expense', amountMinor:M.fromRiyal(200), title:'بقالة', transactionDate:Demo.TODAY
});
eq(Store.getTransactions().length, 1, 'عملية واحدة بعد الإضافة');

Store.updateTransaction(t2.id, { amountMinor: M.fromRiyal(500) });
eq(Store.getTransactions().length, 1, 'ما زالت عملية واحدة بعد التعديل (لا تكرار) ✓');
eq(R(Store.getBalance()),       3700, 'الرصيد = 4,200 − 500 = 3,700 (لا 4,200−200−500)');
eq(Store.getTransaction(t2.id).id, t2.id, 'الـid لم يتغير');

/* تغيير النوع من مصروف إلى دخل */
Store.updateTransaction(t2.id, { type:'income' });
eq(R(Store.getBalance()), 4700, 'تغيير النوع إلى دخل → 4,200 + 500 = 4,700');

/* ═══════════════════════════════════════════════════════════════════════════
 * 7 & 8 — Income يزيد / Expense ينقص
 * ═════════════════════════════════════════════════════════════════════════ */
sec('٧+٨ — Income يزيد الرصيد · Expense ينقصه');

Store._resetForTest();
Store.addTransaction({type:'income', amountMinor:M.fromRiyal(500), title:'دخل', transactionDate:Demo.TODAY});
eq(R(Store.getBalance()), 4700, 'دخل 500 → 4,700 (زاد)');

Store.addTransaction({type:'expense', amountMinor:M.fromRiyal(300), title:'مصروف', transactionDate:Demo.TODAY});
eq(R(Store.getBalance()), 4400, 'مصروف 300 → 4,400 (نقص)');

/* المبلغ يُخزَّن موجبًا دائمًا */
Store._resetForTest();
const negTx = Store.addTransaction({
  type:'expense', amountMinor: -M.fromRiyal(200), title:'اختبار', transactionDate:Demo.TODAY
});
eq(negTx.amountMinor, M.fromRiyal(200), 'المبلغ يُخزَّن موجبًا دائمًا (النوع يحدد الإشارة)');
eq(R(Store.getBalance()), 4000, 'ومع ذلك يُخصم بشكل صحيح → 4,000');

/* ═══════════════════════════════════════════════════════════════════════════
 * 9 — Planned Decision لا يخصم الرصيد
 * ═════════════════════════════════════════════════════════════════════════ */
sec('٩ — القرار المخطط لا يخصم من الرصيد ⭐');

Store._resetForTest();
const before = Store.getBalance();
const pd = Store.savePlannedDecision({
  name:'شراء لابتوب', type:'purchase',
  amount: M.fromRiyal(3000), targetDate: Demo.TODAY,
  isEssential:false, paymentMode:'one_time'
}, laptop());

eq(R(Store.getBalance()), R(before), 'الرصيد لم يتغير بعد حفظ القرار المخطط (4,200) ✓');
eq(Store.getTransactions().length, 0, 'لم تُنشأ أي عملية');
eq(Store.getPlannedDecisions()[0].status, 'planned', 'حالة القرار = مخطط');

/* ═══════════════════════════════════════════════════════════════════════════
 * 10 — تنفيذ القرار يخصم مرة واحدة فقط
 * ═════════════════════════════════════════════════════════════════════════ */
sec('١٠ — تنفيذ القرار يخصم مرة واحدة فقط');

Store.executeDecision(pd.id);
eq(R(Store.getBalance()), 1200, 'بعد التنفيذ: 4,200 − 3,000 = 1,200 ✓');
eq(Store.getTransactions().length, 1, 'أُنشئت عملية واحدة');
eq(Store.getPlannedDecisions()[0].status, 'executed', 'حالة القرار = منفّذ');

/* محاولة التنفيذ مرة ثانية → مرفوضة */
let doubleErr = null;
try { Store.executeDecision(pd.id); } catch (e) { doubleErr = e.message; }
eq(doubleErr, 'ALREADY_EXECUTED', '🔴 التنفيذ مرتين مرفوض (منع الخصم المزدوج)');
eq(R(Store.getBalance()), 1200, 'الرصيد ما زال 1,200 (لم يُخصم مرتين) ✓');

/* ═══════════════════════════════════════════════════════════════════════════
 * 11 — تغيير الفاتورة يحدّث Timeline
 * ═════════════════════════════════════════════════════════════════════════ */
sec('١١ — تغيير الفاتورة يحدّث الخط الزمني');

Store._resetForTest();
const tlBefore = laptop().timeline.find(t => t.label.includes('الكهرباء'));
eq(R(Math.abs(tlBefore.amount)), 650, 'الخط الزمني يعرض كهرباء 650');

Store.setBillManualForecast('vb_electricity', M.fromRiyal(900));
const tlAfter = laptop().timeline.find(t => t.label.includes('الكهرباء'));
eq(R(Math.abs(tlAfter.amount)), 900, 'بعد التعديل: الخط الزمني يعرض 900 ✓');
ok(tlAfter.balanceAfter !== tlBefore.balanceAfter, 'الرصيد في الخط الزمني تغيّر',
   'مختلف', 'متطابق');

/* ═══════════════════════════════════════════════════════════════════════════
 * 12 — منع الحساب المزدوج (Double Counting)
 * ═════════════════════════════════════════════════════════════════════════ */
sec('١٢ — منع الحساب المزدوج ⭐');

Store._resetForTest();
const obsBefore = Store.buildEngineInput(null).obligations.length;
eq(obsBefore, 3, 'قبل الدفع: 3 التزامات قادمة');

/* دفع الإنترنت فعليًا → يصبح Transaction ولا يبقى توقعًا */
Store.settleObligation('ob_internet', Demo.TODAY);
const obsAfter = Store.buildEngineInput(null).obligations.length;

eq(obsAfter, 2, '🔴 بعد الدفع: الإنترنت لم يعد يُحسب كتوقع (2 التزامات) ✓');
eq(R(Store.getBalance()), 3900, 'الرصيد = 4,200 − 300 = 3,900 (خُصم مرة واحدة)');

/* أقل رصيد = 3,900 − 3,000 − (650+180) = 70 — نفس النتيجة! لا تكرار */
r = laptop();
eq(R(r.obligationsBeforeSalary), 830, 'الالتزامات المتبقية = 830 (650 + 180)');
eq(R(r.minimumBalance), 70, 'أقل رصيد ما زال 70 — لم يُحسب الإنترنت مرتين ✓');

/* حذف العملية → يعود الالتزام للظهور */
const settleTx = Store.getTransactions()[0];
Store.deleteTransaction(settleTx.id);
eq(Store.buildEngineInput(null).obligations.length, 3, 'حذف العملية → عاد الالتزام للتوقعات');
eq(R(Store.getBalance()), 4200, 'الرصيد عاد 4,200');

/* ═══════════════════════════════════════════════════════════════════════════
 * 13 — المسار اليدوي والمساعد يعيدان نفس النتيجة
 * ═════════════════════════════════════════════════════════════════════════ */
sec('١٣ — المسار اليدوي والمساعد: نفس النتيجة ⭐');

Store._resetForTest();
/* كلاهما يبني المُدخل من نفس المتجر ويستدعي نفس المحرك */
const manual    = Engine.analyzeDecision(Store.buildEngineInput(Demo.LAPTOP_DECISION));
const assistant = Engine.analyzeDecision(Store.buildEngineInput({
  type:'purchase', name:'شراء لابتوب', amount:M.fromRiyal(3000),
  targetDate: Demo.TODAY, isEssential:false, paymentMode:'one_time'
}));

eq(manual.minimumBalance,    assistant.minimumBalance,    'أقل رصيد متطابق (70)');
eq(manual.safeMaximumAmount, assistant.safeMaximumAmount, 'أقصى آمن متطابق (1,570)');
eq(manual.riskLevel,         assistant.riskLevel,         'مستوى الخطر متطابق');

/* وبعد تغيير الكهرباء — يبقيان متطابقين */
Store.setBillManualForecast('vb_electricity', M.fromRiyal(900));
const m2 = Engine.analyzeDecision(Store.buildEngineInput(Demo.LAPTOP_DECISION));
const a2 = Engine.analyzeDecision(Store.buildEngineInput({
  type:'purchase', name:'شراء لابتوب', amount:M.fromRiyal(3000),
  targetDate: Demo.TODAY, isEssential:false, paymentMode:'one_time'
}));
eq(R(m2.minimumBalance), -180, 'بعد كهرباء 900: اليدوي = −180');
eq(R(a2.minimumBalance), -180, 'بعد كهرباء 900: المساعد = −180 (متطابق) ✓');

/* ═══════════════════════════════════════════════════════════════════════════
 * 14 — الضغط المزدوج لا ينشئ عمليتين
 * ═════════════════════════════════════════════════════════════════════════ */
sec('١٤ — منع الإرسال المزدوج');

Store._resetForTest();
const payload = {
  type:'expense', amountMinor:M.fromRiyal(200),
  title:'بقالة', transactionDate:Demo.TODAY
};
Store.addTransaction(payload);
let dupErr = null;
try { Store.addTransaction(payload); } catch (e) { dupErr = e.message; }

eq(dupErr, 'DUPLICATE_SUBMIT', 'الإضافة الفورية المكررة مرفوضة');
eq(Store.getTransactions().length, 1, 'عملية واحدة فقط ✓');

/* لكن نفس العملية بعد فترة → مسموحة (قد تكون شراءً حقيقيًا ثانيًا) */
Store._clearSubmitGuard();
Store.addTransaction(payload);
eq(Store.getTransactions().length, 2, 'نفس العملية بعد فترة → مسموحة (شراء ثانٍ)');

/* ═══════════════════════════════════════════════════════════════════════════
 * 15 — توقع الفواتير المتغيرة
 * ═════════════════════════════════════════════════════════════════════════ */
sec('١٥ — توقع الفواتير المتغيرة');

Store._resetForTest();
Store.setBillManualForecast('vb_electricity', null);   // إلغاء التعديل اليدوي
const fc = Store.getBillForecast('vb_electricity');

console.log(`  ${C.d}السجل: 520 · 610 · 730 · 680${C.x}`);
eq(fc.entryCount,          4,   'عدد القراءات = 4');
eq(R(fc.lastMinor),      680,   'آخر مبلغ = 680');
eq(R(fc.averageMinor),   635,   'المتوسط = 635');
eq(R(fc.medianMinor),    645,   'الوسيط = 645');
eq(R(fc.minMinor),       520,   'الأدنى = 520');
eq(R(fc.maxMinor),       730,   'الأعلى = 730');
eq(R(fc.weightedMinor),  665,   'المتوسط المرجّح = 665 (الأحدث وزنه أعلى)');
eq(fc.trend,        'rising',   'الاتجاه = تصاعدي');
eq(fc.confidence,   'medium',   'الثقة = متوسطة (4 قراءات)');
ok(fc.rangeLowMinor < fc.expectedMinor && fc.expectedMinor < fc.rangeHighMinor,
   'يوجد نطاق متوقع حول القيمة', 'low < exp < high', 'خطأ');

/* التوقع يدخل المحرك فعلًا */
r = laptop();
eq(R(r.obligationsBeforeSalary), 665 + 180 + 300,
   'المحرك يستخدم التوقع (665) لا الرقم الثابت ✓');

/* بيانات قليلة → ثقة منخفضة + تحذير صريح */
Store._resetForTest();
Store.updateVariableBill('vb_water', { manualForecastMinor: null });
['bh_w1','bh_w2','bh_w3'].forEach(id => Store.deleteBillEntry(id));
const lowFc = Store.getBillForecast('vb_water');
eq(lowFc.confidence, 'low', 'قراءة واحدة → ثقة منخفضة');
ok(lowFc.note.includes('غير كافية'), 'رسالة صريحة: البيانات غير كافية',
   'تحتوي "غير كافية"', lowFc.note);

/* التعديل اليدوي يتفوّق على التوقع */
Store._resetForTest();
Store.setBillManualForecast('vb_electricity', M.fromRiyal(900));
const manFc = Store.getBillForecast('vb_electricity');
eq(R(manFc.expectedMinor), 900, 'التعديل اليدوي (900) يتفوّق على التوقع المحسوب');
eq(manFc.isManual, true, 'مُعلَّم كتعديل يدوي');

/* ═══════════════════════════════════════════════════════════════════════════
 * 16 — مصدر واحد للحقيقة (كل الصفحات تتفق)
 * ═════════════════════════════════════════════════════════════════════════ */
sec('١٦ — مصدر واحد للحقيقة');

Store._resetForTest();
Store.addTransaction({type:'expense', amountMinor:M.fromRiyal(200), title:'بقالة', transactionDate:Demo.TODAY});

const snap  = Store.getSnapshot();
const input = Store.buildEngineInput(null);

eq(snap.balanceMinor, Store.getBalance(),   'Snapshot و getBalance متطابقان');
eq(input.currentBalance, Store.getBalance(),'مُدخل المحرك يستخدم نفس الرصيد');
eq(snap.obligations.length, input.obligations.length, 'الالتزامات متطابقة');
eq(R(snap.balanceMinor), 4000, 'كل المصادر تقول 4,000');

/* الاشتراك يُخطر عند التغيير */
let notified = 0;
const unsub = Store.subscribe(() => notified++);
Store.addTransaction({type:'income', amountMinor:M.fromRiyal(100), title:'دخل', transactionDate:Demo.TODAY});
ok(notified > 0, 'recalculateFinancialSnapshot أخطر المشتركين', '> 0', notified);
unsub();

/* ═══════════════════════════════════════════════════════════════════════════
 * 17 — التحقق من المدخلات
 * ═════════════════════════════════════════════════════════════════════════ */
sec('١٧ — رفض المدخلات غير الصالحة');

Store._resetForTest();
let e1=null,e2=null,e3=null;
try{ Store.addTransaction({type:'expense', amountMinor:0, title:'x', transactionDate:Demo.TODAY}); }catch(e){ e1=e.message; }
try{ Store.addTransaction({type:'invalid', amountMinor:100, title:'x', transactionDate:Demo.TODAY}); }catch(e){ e2=e.message; }
try{ Store.addTransaction({type:'expense', amountMinor:12.5, title:'x', transactionDate:Demo.TODAY}); }catch(e){ e3=e.message; }

ok(!!e1, 'مبلغ صفر مرفوض', 'خطأ', e1);
ok(!!e2, 'نوع غير صالح مرفوض', 'خطأ', e2);
ok(!!e3, 'مبلغ عشري مرفوض (يجب هللة صحيحة)', 'خطأ', e3);
eq(Store.getTransactions().length, 0, 'لم تُحفظ أي عملية غير صالحة');

/* ═══════════════════════════════════════════════════════════════════════════
 * 18 — لا أسرار في الكود
 * ═════════════════════════════════════════════════════════════════════════ */
sec('١٨ — لا أسرار في ملفات الواجهة');

const fs = require('fs');
const files = ['../index.html','../src/decision-engine.js','../src/data-store.js','../src/demo-data.js'];
let secretFound = false;
files.forEach(f => {
  const src = fs.readFileSync(__dirname + '/' + f, 'utf8');
  if (/sk-[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{20,}/i.test(src)) {
    secretFound = true;
    console.log(`    ${C.r}مفتاح في ${f}${C.x}`);
  }
});
eq(secretFound, false, '🔒 لا يوجد أي API Key في ملفات الواجهة');

/* ═══════════════════════════════════════════════════════════════════════════
 * 19 — ترتيب التنقل: Sandbox في المركز الثاني
 * ═════════════════════════════════════════════════════════════════════════ */
sec('١٩ — ترتيب التنقل');

const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const navBlock = html.slice(html.indexOf('const navItems = ['), html.indexOf('];', html.indexOf('const navItems = [')));
const ids = [...navBlock.matchAll(/id:'([a-z]+)'/g)].map(m => m[1]);

eq(ids[0], 'home',      'التنقل #1 = الرئيسية');
eq(ids[1], 'sandbox',   '⭐ التنقل #2 = البيئة التجريبية');
eq(ids[2], 'decision',  'التنقل #3 = اختبار القرار');
eq(ids[3], 'assistant', 'التنقل #4 = المساعد');
ok(html.includes('moreNav'), 'زر «المزيد» موجود للجوال', 'موجود', 'مفقود');
ok(html.includes("navItems.slice(0,4)"), 'شريط الجوال يعرض 4 + المزيد', 'موجود', 'مفقود');

/* ═══════════════════════════════════════════════════════════════════════════
 * 20 — الحتمية ما زالت سليمة
 * ═════════════════════════════════════════════════════════════════════════ */
sec('٢٠ — الحتمية');

Store._resetForTest();
const runA = laptop(), runB = laptop(), runC = laptop();
eq(JSON.stringify(runA) === JSON.stringify(runB) &&
   JSON.stringify(runB) === JSON.stringify(runC), true,
   'ثلاث تشغيلات → نتائج متطابقة تمامًا');

const engineSrc = fs.readFileSync(__dirname + '/../src/decision-engine.js', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
eq(/Math\.random\s*\(/.test(engineSrc), false, 'لا Math.random() في المحرك');
eq(/new\s+Date\s*\(\s*\)/.test(engineSrc), false, 'لا new Date() فارغة في المحرك');

/* ═══════════════════════════════════════════════════════════════════════════ */

console.log('\n' + '═'.repeat(68));
const total = pass + fail;
if (fail === 0) {
  console.log(`${C.b}${C.g}  ✓ نجحت جميع اختبارات المرحلة A: ${pass}/${total}${C.x}`);
  console.log('═'.repeat(68));
  console.log(`\n${C.b}${C.g}  ⭐ 70      ← الأساس محفوظ${C.x}`);
  console.log(`${C.b}${C.g}  ⭐ −180    ← كهرباء 900 (محسوب)${C.x}`);
  console.log(`${C.b}${C.g}  ⭐ −130    ← مصروف 200 (محسوب)${C.x}`);
  console.log(`${C.b}${C.g}  ⭐ 1,070   ← دخل 1,000 (محسوب)${C.x}`);
  console.log(`${C.b}${C.g}  🔒 لا حساب مزدوج · لا أسرار · Sandbox #2${C.x}\n`);
  process.exit(0);
} else {
  console.log(`${C.b}${C.r}  ✗ فشل ${fail} من ${total}${C.x}`);
  console.log('═'.repeat(68));
  failures.forEach(f => {
    console.log(`\n  ${C.r}✗${C.x} ${f.label}`);
    console.log(`    المتوقع: ${f.exp}`);
    console.log(`    الفعلي:  ${f.act}`);
  });
  console.log('');
  process.exit(1);
}
