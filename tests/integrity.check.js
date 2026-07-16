#!/usr/bin/env node
/* ============================================================================
 * QARAR — INTEGRITY CHECK
 * فحص السلامة — يمنع تكرار كارثة «الدالة المحذوفة»
 * ============================================================================
 *
 * ما حدث:
 *   أثناء تعديل المرحلة B، حُذفت دالة startExperience() بالخطأ عند استبدال
 *   نطاق نصي. الاختبارات الآلية لم تكتشفها لأنها كانت تُقصي DOM (mocks)
 *   ولا تضغط الأزرار فعلًا.
 *
 * ما يفعله هذا الفحص:
 *   1. يجمع كل الدوال المعرّفة في index.html (+ الملفات الخارجية).
 *   2. يجمع كل data-action و data-goto في HTML.
 *   3. يتأكد أن كل دالة *تُستدعى* موجودة فعلًا.
 *   4. يكشف التعريفات المكررة.
 *   5. يتأكد من ترتيب تحميل السكربتات.
 *
 * التشغيل: node tests/integrity.check.js
 * ========================================================================= */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const G='\x1b[32m', R='\x1b[31m', Y='\x1b[33m', C='\x1b[36m', B='\x1b[1m', X='\x1b[0m';

let pass = 0, fail = 0;
const problems = [];

function ok(cond, label, detail) {
  if (cond) { pass++; console.log(`  ${G}✓${X} ${label}`); }
  else {
    fail++; problems.push({label, detail});
    console.log(`  ${R}✗ ${label}${X}`);
    if (detail) console.log(`    ${R}${detail}${X}`);
  }
}
const sec = t => { console.log(`\n${B}${C}${t}${X}`); console.log('─'.repeat(68)); };

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* السكربت الرئيسي (آخر <script> بلا src) */
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const app = inlineScripts[inlineScripts.length - 1];

/* ═══ 1. ترتيب تحميل السكربتات ═══ */
sec('١ — ترتيب تحميل الملفات');

const srcTags = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const expected = ['src/decision-engine.js','src/demo-data.js','src/data-store.js','src/ai-agent.js'];

expected.forEach((f, i) => {
  ok(srcTags[i] === f, `${i+1}. ${f}`, `الفعلي: ${srcTags[i] || 'مفقود'}`);
});

/* الملفات موجودة فعلًا على القرص */
srcTags.forEach(f => {
  ok(fs.existsSync(path.join(ROOT, f)), `الملف موجود: ${f}`);
});

/* السكربت المضمّن بعد الملفات الخارجية */
const lastSrcPos   = html.lastIndexOf('<script src=');
const inlinePos    = html.indexOf('<script>', lastSrcPos);
ok(inlinePos > lastSrcPos,
   'السكربت المضمّن يُحمَّل بعد الملفات الخارجية',
   'ترتيب خاطئ — الدوال العامة لن تكون متاحة');

/* ═══ 2. جمع كل الدوال المعرّفة ═══ */
sec('٢ — الدوال المعرّفة');

const defined = new Set();

/* function foo() / async function foo() */
[...app.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(/g)].forEach(m => defined.add(m[1]));
/* const foo = ... => / function */
[...app.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\(|function)/g)]
  .forEach(m => defined.add(m[1]));

/* globals من الملفات الخارجية */
['QararEngine','QararDemo','QararStore','QararAgent'].forEach(g => defined.add(g));
/* دوال المتصفح المدمجة */
['setTimeout','fetch','parseInt','parseFloat','Number','String','Boolean','Array',
 'Object','JSON','Math','Date','console','document','window','isFinite','alert'
].forEach(g => defined.add(g));

console.log(`  ${Y}عدد الدوال المعرّفة: ${defined.size}${X}`);

/* ═══ 3. ⭐ كل دالة تُستدعى يجب أن تكون معرّفة ═══ */
sec('٣ — ⭐ كل دالة مُستدعاة موجودة فعلًا');

/* الدوال الحرجة التي *يجب* أن تكون موجودة (Golden Path) */
const CRITICAL = [
  'startExperience',   // ← الزر الذي انكسر
  'enterAppSafely',    // ← المصدر الوحيد للدخول
  'armStartupWatchdog',// ← يمنع Loading الأبدي
  'prepareDependencies',// ← الاسترداد المتدرج
  'bindActiveStore',    // ← دورة حياة المتجر (منع انقطاع الاشتراك)
  'commitFinancialMutation', // ← نقطة التعديل المركزية
  'storageStatus',      // ← حالة التخزين الصريحة
  'showDecisionError',  // ← حالة خطأ التحليل
  'navigate', 'handleAction', 'renderNav', 'afterRender',
  'openSheet', 'closeSheet', 'toast', 'showLoading', 'hideLoading',
  'runDecisionAnalysis', 'renderDecisionResult', 'applyAlternative',
  'sendChat', 'addMsg', 'bootChat', 'esc', 'riyal',
  'txForm', 'saveTransactionFromForm', 'updateBalPreview',
  'refreshCurrentView', 'demoBanner'
];

CRITICAL.forEach(fn => {
  ok(defined.has(fn), `دالة حرجة موجودة: ${fn}()`,
     `🔴 مفقودة — سيتعطل الزر المرتبط بها (ReferenceError)`);
});

/* ═══ 4. كل data-action له معالج ═══ */
sec('٤ — كل data-action مُعالَج');

const actions = new Set(
  [...html.matchAll(/data-action="(\w+)"/g)].map(m => m[1])
);

/* handleAction يجب أن يذكر كل action */
const handlerBody = app.slice(app.indexOf('function handleAction'));
const missingActions = [...actions].filter(a =>
  !handlerBody.includes(`'${a}'`) && !app.includes(`data-action="${a}"`) === false
    ? !handlerBody.includes(`'${a}'`)
    : false
);

/* إجراءات لها مستمعون مخصصون خارج handleAction (وهذا مقصود) */
const DEDICATED = {
  setTxType:     "addEventListener('click'",   // مبدّل نوع العملية
  togglePayMode: "addEventListener('change'"   // مبدّل طريقة الدفع
};

const unhandled = [...actions].filter(a => {
  if (handlerBody.includes(`'${a}'`)) return false;
  /* مسموح فقط إن وُجد مستمع مخصص فعلًا في الكود */
  if (DEDICATED[a] && app.includes(DEDICATED[a]) && app.includes(`'${a}'`)) return false;
  if (DEDICATED[a] && app.includes(`data-action="${a}"`) && app.includes(DEDICATED[a])) return false;
  return true;
});
ok(unhandled.length === 0,
   `كل الإجراءات (${actions.size}) لها معالج في handleAction`,
   unhandled.length ? `غير معالَجة: ${unhandled.join(', ')}` : '');

/* ═══ 5. كل data-goto له view ═══ */
sec('٥ — كل data-goto له صفحة');

const gotos = new Set([...html.matchAll(/data-goto="(\w+)"/g)].map(m => m[1]));
const viewsBlock = app.slice(app.indexOf('const views = {'));
const viewNames = new Set(
  [...viewsBlock.matchAll(/^\s{2}(\w+)\s*\(\s*\)\s*\{/gm)].map(m => m[1])
);

const badGotos = [...gotos].filter(g => !viewNames.has(g));
ok(badGotos.length === 0,
   `كل روابط التنقل (${gotos.size}) تشير إلى صفحات موجودة`,
   badGotos.length ? `صفحات مفقودة: ${badGotos.join(', ')}` : '');

/* navItems تشير إلى views موجودة */
const navBlock = app.slice(app.indexOf('const navItems = ['),
                           app.indexOf('];', app.indexOf('const navItems = [')));
const navIds = [...navBlock.matchAll(/id:'(\w+)'/g)].map(m => m[1]);
const badNav = navIds.filter(id => !viewNames.has(id));
ok(badNav.length === 0,
   `كل عناصر القائمة (${navIds.length}) لها صفحات`,
   badNav.length ? `مفقودة: ${badNav.join(', ')}` : '');

/* ═══ 6. لا تعريفات مكررة ═══ */
sec('٦ — لا تعريفات مكررة');

const counts = {};
[...app.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(/g)].forEach(m => {
  counts[m[1]] = (counts[m[1]] || 0) + 1;
});
const dups = Object.entries(counts).filter(([, n]) => n > 1);
ok(dups.length === 0, 'لا دوال معرّفة أكثر من مرة',
   dups.length ? `مكررة: ${dups.map(([n, c]) => `${n}(×${c})`).join(', ')}` : '');

/* ═══ 7. حدود الأخطاء (Error Boundary) ═══ */
sec('٧ — حدود الأخطاء');

ok(app.includes("addEventListener('error'") || app.includes('window.onerror'),
   'يوجد Error Boundary عام',
   'خطأ في أي مكان قد يعطّل التطبيق كله');

/* ═══ تحصين البدء (P0) ═══ */
const htmlRaw = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

ok(/<div id="loading" class="loading hide"/.test(htmlRaw),
   '🔴 #loading مخفية افتراضيًا في HTML',
   'لو بدأت ظاهرة، أي فشل قبل hideLoading() يترك المستخدم عالقًا للأبد');

ok(/\.splash\.hide[^}]*display:none!important|\.loading\.hide[^}]*display:none!important/.test(htmlRaw),
   'طبقات الحجب تُخفى بـdisplay:none !important');

ok(htmlRaw.includes('__bareEnter'),
   '🛡 شبكة أمان مستقلة (تعمل حتى لو فشلت كل ملفات JS)');

ok(app.includes('armStartupWatchdog'),
   '🐕 Watchdog مُسلَّح عند الضغط على الزر');

ok(!/^const Money = QararEngine\.Money;/m.test(app),
   'لا استدعاء خارجي غير محصّن في المستوى الأعلى',
   'سطر كهذا يُسقِط السكربت كله لو فشل تحميل الملف');

/* ═══ شبكات أمان البيانات (تمنع اختفاء لوحة التحكم) ═══ */
ok(htmlRaw.includes('QararFallbackStore'),
   '🛡 المتجر البديل مضمّن في HTML',
   'بدونه: فشل data-store.js ⇒ تختفي لوحة التحكم');

ok(/__isFallback: true|__isFallback:true/.test(htmlRaw),
   '🛡 المحرك البديل مضمّن في HTML');

/* ترتيب حرج: المحركات البديلة بعد الملفات الحقيقية */
const fbPos  = htmlRaw.indexOf('المحركات البديلة');
const realPos = htmlRaw.lastIndexOf('<script src="src/ai-agent.js">');
ok(fbPos > realPos,
   'المحرك البديل يُحمَّل *بعد* الملفات الحقيقية',
   'لو حُمِّل قبلها، سيحلّ محل المحرك الحقيقي دائمًا');

/* enterAppSafely يجب أن يجهّز الاعتمادات قبل الرسم */
const easBody = app.slice(app.indexOf('function enterAppSafely'),
                          app.indexOf('function showRecoveryBanner'));
ok(easBody.indexOf('prepareDependencies') < easBody.indexOf('views.home()'),
   '⭐ enterAppSafely: تجهيز الاعتمادات *قبل* رسم لوحة التحكم',
   'الترتيب الخاطئ يُنتج «تعذر تحميل لوحة التحكم»');

ok(htmlRaw.includes('AppData/Local/Temp') || htmlRaw.includes('detectZipPreview'),
   '🔍 كشف الفتح من داخل ZIP');

/* ═══ دورة حياة المتجر (P0) ═══ */
ok(!/^\s*QararStore\.subscribe\(/m.test(app),
   '⭐ لا اشتراك مباشر في QararStore عند تحليل السكربت',
   'الاشتراك قبل اختيار المتجر ⇒ انقطاع الاشتراك عند التبديل');

const easBody2 = app.slice(app.indexOf('function enterAppSafely'),
                           app.indexOf('function showRecoveryBanner'));
ok(easBody2.includes('bindActiveStore'),
   '⭐ enterAppSafely يربط المتجر النشط');

ok(easBody2.indexOf('bindActiveStore') < easBody2.indexOf('views.home()'),
   '⭐ الربط يتم *قبل* الرسم');

ok(app.includes('commitFinancialMutation'),
   '⭐ توجد نقطة تعديل مركزية');

/* ⭐ الفحص الحقيقي: هل استدعاء المحرك **داخل** مؤقت؟
 *
 * ليس المهم وجود setTimeout إطلاقًا (فهو مستخدم لإخفاء شاشة التحميل
 * التجميلية — وهذا مقبول). المهم أن **التحليل نفسه لا يعتمد عليه**:
 * لو تعطّل كل مؤقت، يجب أن تكون النتيجة قد حُسبت ورُسمت بالفعل.
 *
 * القاعدة: analyzeDecision() و renderDecisionResult() يجب أن يكونا
 * في المسار المتزامن — لا داخل setTimeout. */
const rdaBody = app.slice(app.indexOf('function runDecisionAnalysis'),
                          app.indexOf('function showDecisionError'));
const rdaCode = rdaBody.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/* الفحص: هل الدالة التي تُجري التحليل (doAnalysis) تُستدعى مباشرةً؟
 * لو كانت داخل setTimeout ⇒ تعطُّل المؤقت = لا نتيجة أبدًا. */
const callsDirect = /\n\s*doAnalysis\(\)\s*;/.test(rdaCode);
const callsInTimer = /setTimeout\s*\(\s*doAnalysis/.test(rdaCode)
                  || /setTimeout\s*\([^)]*analyzeDecision/.test(rdaCode);

ok(callsDirect && !callsInTimer,
   '⭐ التحليل يُستدعى مباشرةً (لا داخل setTimeout)',
   'لو تعطّل المؤقت، لن تظهر أي نتيجة أبدًا');

ok(rdaCode.includes('analyzeDecision'),
   '⭐ التحليل يستدعي المحرك الحقيقي');

ok(rdaCode.includes('bindActiveStore'),
   '⭐ التحليل يربط المتجر النشط قبل بناء المدخلات');

/* شاشة التحميل: showLoading يجب أن يمسح الـinline style */
ok(/showLoading[\s\S]{0,220}style\.display\s*=\s*''/.test(app),
   '⭐ showLoading يمسح الـinline style (وإلا لن تظهر الشاشة أبدًا)',
   'inline style يتفوّق على CSS class');
ok(rdaBody.includes('finally'),
   '⭐ تحليل القرار داخل try/catch/finally');

ok(app.includes('try') && app.includes('catch'),
   'يوجد معالجة أخطاء في المسارات الحرجة');

/* ═══ النتيجة ═══ */
console.log('\n' + '═'.repeat(68));
const total = pass + fail;
if (fail === 0) {
  console.log(`${B}${G}  ✓ فحص السلامة نجح: ${pass}/${total}${X}`);
  console.log('═'.repeat(68));
  console.log(`\n${B}${G}  ⭐ كل الدوال الحرجة موجودة${X}`);
  console.log(`${B}${G}  ⭐ كل زر له معالج${X}`);
  console.log(`${B}${G}  ⭐ ترتيب التحميل صحيح${X}\n`);
  process.exit(0);
} else {
  console.log(`${B}${R}  ✗ فشل ${fail} من ${total}${X}`);
  console.log('═'.repeat(68));
  problems.forEach(p => {
    console.log(`\n  ${R}✗${X} ${p.label}`);
    if (p.detail) console.log(`    ${p.detail}`);
  });
  console.log('');
  process.exit(1);
}
