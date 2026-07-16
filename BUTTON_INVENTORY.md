# BUTTON_INVENTORY — قرار (Qarar)
## جرد وظيفي كامل قبل مرحلة UI/UX Polish (v2.7)

هذا الملف هو **مرجع السلامة الوظيفية** (Functional Source of Truth) قبل أي تعديل بصري.
كل عنصر أدناه يجب أن يبقى يعمل بنفس الطريقة بعد التلميع.

القاعدة المطبَّقة: **لم يُعدَّل أي ملف داخل `src/`** (المحرك، المتجر، البيانات، الوكيل).
التعديلات محصورة في `index.html` (CSS + قوالب العرض) دون تغيير:
`data-action` · `data-goto` · `data-ask` · أي `id` مستهلَك في JavaScript · أي منطق.

---

## ١. عناصر التنقل (data-goto) — الوجهات

| data-goto | الوجهة (View) | يعمل على Desktop | يعمل على Mobile | من Quick Actions |
|-----------|---------------|------------------|-----------------|-------------------|
| home | الرئيسية | ✓ | ✓ (شريط سفلي) | ✓ |
| sandbox | البيئة التجريبية | ✓ | ✓ | ✓ |
| decision | اختبار القرار | ✓ | ✓ | ✓ |
| assistant | المساعد | ✓ | ✓ | ✓ |
| bills | الالتزامات والفواتير | ✓ | ✓ (المزيد) | — |
| analysis | التحليل | ✓ | ✓ (المزيد) | — |
| forecast | التوقعات | ✓ | ✓ (المزيد) | — |
| reports | التقارير | ✓ | ✓ (المزيد) | — |
| family | الملف العائلي | ✓ | ✓ (المزيد) | — |
| settings | الإعدادات | ✓ | ✓ (المزيد) | — |

كل هذه الوجهات تمر عبر `navigate(id, load)` → لا تغيير في المنطق.

---

## ٢. الأزرار الوظيفية (data-action) — المعالِج

جميعها تُوجَّه إلى `handleAction(action, el)` عبر تفويض حدث واحد على `document`.

| data-action | الصفحة | الوظيفة | النتيجة المتوقعة | يفتح Sheet؟ | يغيّر بيانات؟ | يستدعي المحرك؟ |
|-------------|--------|---------|-------------------|-------------|----------------|-----------------|
| startExperience | Splash | فتح المنصة | إخفاء splash وعرض الرئيسية | لا | لا | لا |
| closeSheet | أي Sheet | إغلاق الورقة | إغلاق | لا | لا | لا |
| simulateDecision | decision | تحليل الأثر | نتيجة القرار كاملة | لا | لا | ✓ `runDecisionAnalysis` |
| retryAnalysis | decision (خطأ) | إعادة التحليل | إعادة تشغيل التحليل | لا | لا | ✓ |
| resetFromError | decision (خطأ) | إعادة ضبط + تحليل | ضبط البيانات ثم تحليل | لا | ✓ reset | ✓ |
| applyAlt | نتيجة القرار | تطبيق بديل | تعبئة/تعديل حسب البديل | لا | حسب البديل | ✓ |
| confirmGoal | Sheet هدف | إنشاء هدف ادخار | هدف جديد — لا خصم | يُغلق | ✓ addGoal | لا |
| scenario | decision | تعبئة سيناريو جاهز | ملء النموذج | لا | لا | لا |
| saveDecisionPlan | نتيجة القرار | حفظ كقرار مخطط | حفظ — لا خصم | لا | ✓ savePlannedDecision | لا |
| proceedAnyway | نتيجة القرار | المتابعة رغم التحذير | فتح تأكيد التنفيذ | يفتح | لا (بعد) | لا |
| confirmExecute | Sheet تأكيد | تنفيذ القرار فعليًا | خصم مرة واحدة | يُغلق | ✓ executeDecision | لا |
| openAddTx | sandbox | فتح نموذج عملية | فتح نموذج دخل/مصروف | يفتح | لا (بعد) | لا |
| editTx | sandbox | تعديل عملية | فتح النموذج معبأً | يفتح | لا (بعد) | لا |
| saveTx | Sheet عملية | حفظ العملية | إضافة/تعديل + تحديث الرصيد | يُغلق | ✓ | لا |
| askDeleteTx | sandbox | تأكيد حذف عملية | فتح تأكيد الحذف | يفتح | لا (بعد) | لا |
| confirmDeleteTx | Sheet حذف | حذف العملية | حذف + استعادة الرصيد | يُغلق | ✓ deleteTransaction | لا |
| editBillForecast | bills | تعديل قيمة فاتورة متوقعة | فتح نموذج التعديل | يفتح | لا (بعد) | لا |
| saveBillForecast | Sheet فاتورة | حفظ القيمة المتوقعة | تحديث يؤثر على القرار | يُغلق | ✓ | يؤثر لاحقًا |
| addBillEntry | bills | إضافة قراءة فاتورة | فتح نموذج القراءة | يفتح | لا (بعد) | لا |
| saveBillEntry | Sheet قراءة | حفظ القراءة | حفظ قراءة جديدة | يُغلق | ✓ | يؤثر لاحقًا |
| clearManual | bills | مسح القيمة اليدوية | استعادة المتوقع تلقائيًا | لا | ✓ | يؤثر لاحقًا |
| editObligation | bills | تعديل التزام | فتح النموذج معبأً | يفتح | لا (بعد) | لا |
| addObligation | bills | التزام جديد | فتح نموذج فارغ | يفتح | لا (بعد) | لا |
| saveObligation | Sheet التزام | حفظ التزام | تحديث التزام | يُغلق | ✓ | يؤثر لاحقًا |
| saveNewObligation | Sheet التزام | إضافة التزام | التزام جديد | يُغلق | ✓ | يؤثر لاحقًا |
| editProfile | settings | تعديل الملف المالي | فتح نموذج الملف | يفتح | لا (بعد) | لا |
| saveProfile | Sheet ملف | حفظ الملف المالي | تحديث + إعادة حساب | يُغلق | ✓ updateProfile | ✓ |
| savePermissions | permissions | حفظ الموافقات | إشعار حفظ | لا | لا | لا |
| editFamily | family | فتح الإعدادات | الانتقال إلى settings | لا | لا | لا |
| resetDemo | settings | فتح تأكيد الضبط | تأكيد إعادة الضبط | يفتح | لا (بعد) | لا |
| confirmReset | Sheet ضبط | إعادة ضبط البيانات | استعادة سيناريو العرض | يُغلق | ✓ reset | لا |
| notifications | topbar | فتح التنبيهات | ورقة التنبيهات | يفتح | لا | لا |
| moreNav | Mobile nav | فتح جميع الأقسام | شبكة أقسام | يفتح | لا | لا |
| sendChat | assistant | إرسال رسالة | رد المساعد | لا | حسب الرسالة | حسب النية |
| applyAltChat | assistant | تطبيق بديل عبر الشات | إرسال رسالة البديل | لا | لا | ✓ (عبر الرد) |
| agentConfirm | assistant | تأكيد مسودة | تنفيذ المسودة | لا | ✓ | لا |
| agentEdit | assistant | تعديل المسودة | إلغاء + طلب تعديل | لا | لا | لا |
| agentCancel | assistant | إلغاء المسودة | إلغاء — لا حفظ | لا | لا | لا |
| statusPlan | home | «ماذا أفعل الآن؟» | الانتقال إلى decision | لا | لا | لا |
| exportReport | reports | تحميل PDF تجريبي | إشعار (قيد التطوير) | لا | لا | لا |
| reminder | forecast/reports | إضافة تذكير | إشعار (قيد التطوير) | لا | لا | لا |
| toggle | permissions/settings | تبديل مفتاح | on/off بصري | لا | لا | لا |
| setTxType | Sheet عملية | تبديل دخل/مصروف | تحديث نوع + معاينة الرصيد | لا | لا (بعد) | لا |
| togglePayMode | decision (select) | إظهار حقل الأشهر | تغيير معالَج في `change` | لا | لا | لا |

---

## ٣. عناصر أخرى مرتبطة بالمنطق (لا تُلمَس أسماؤها)

- `data-ask="..."` → رقائق أسئلة المساعد → `sendChat(text)`.
- `id="decisionName" / decisionAmount / decisionType / decisionDate / decisionEssential / decisionPayMode / decisionMonths`
  → مدخلات محرك القرار — **أسماء ثابتة إلزاميًا**.
- `id="decisionResult"` → حاوية النتيجة.
- `id="monthsField"` → حقل الأشهر (يُظهر/يُخفى في `change`).
- `id="txAmount" / txType / txTitle / txMerchant / txDate / txCategory / txNotes / txId`
  → مدخلات نموذج العملية.
- `id="balAfter" / saveTxBtn` → معاينة الرصيد وزر الحفظ.
- `id="billAmt" / billId / billError` → نموذج الفاتورة.
- `id="pfBal" / pfInc / pfDate / pfSafe` → نموذج الملف المالي.
- `id="chatText" / messages / agentStatus` → المساعد.
- `id="pageTitle" / view / desktopNav / mobileNav / splash / loading / toast` → البنية.

---

## ٤. المسار الذهبي (Golden Path) — قِيَم مرجعية إلزامية

مصدر الحقيقة الرقمي: `node tests/engine.test.js` → **44/44** قبل التلميع.

- الرصيد الأساسي: 4,200
- قرار اللابتوب: 3,000 · الحد الآمن: 1,500
- أقل رصيد (السيناريو الأساس): **70**
- أقصى مبلغ آمن: **1,570**
- + مصروف 200 → **−130**
- كهرباء 650 → 900 → **−180**

هذه الأرقام تخرج من المحرك حصريًا ولم تُكتب يدويًا في الواجهة.
بما أن مجلد `src/` لم يُمس، تبقى مطابقة 100%.
