#!/usr/bin/env python3
"""
QARAR — REAL BROWSER E2E TEST
اختبار المتصفح الحقيقي — لا DOM mocks

يشغّل خادم HTTP حقيقي، يفتح Chromium حقيقي، ويضغط الأزرار فعلًا.
يلتقط كل JavaScript error من الـConsole.

هذا الاختبار هو ما كان ناقصًا — ولهذا مرّت المشكلة.
"""
import sys, os, threading, http.server, socketserver, functools, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__)) + '/..'
PORT = 8099

G, R, Y, C, B, X = '\033[32m', '\033[31m', '\033[33m', '\033[36m', '\033[1m', '\033[0m'

passed, failed = 0, 0
def check(cond, label, detail=''):
    global passed, failed
    if cond:
        passed += 1
        print(f'  {G}✓{X} {label}')
    else:
        failed += 1
        print(f'  {R}✗ {label}{X}')
        if detail: print(f'    {detail}')
    return cond

def sec(t):
    print(f'\n{B}{C}{t}{X}')
    print('─' * 68)

# ── خادم HTTP حقيقي (كما لو كان منشورًا) ──
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

handler = functools.partial(Quiet, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
time.sleep(0.4)

print(f'{B}══ QARAR — اختبار المتصفح الحقيقي ══{X}')
print(f'{Y}الخادم: http://127.0.0.1:{PORT}  (بدون /api — يحاكي غياب الذكاء الاصطناعي){X}')

errors = []      # JS errors
console_errs = []

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1280, 'height': 900})

    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: console_errs.append(m.text) if m.type == 'error' else None)

    # ═══ 1. تحميل الصفحة ═══
    sec('١ — تحميل الصفحة')
    page.goto(f'http://127.0.0.1:{PORT}/index.html', wait_until='networkidle')
    time.sleep(0.5)

    check(len(errors) == 0, 'لا أخطاء JavaScript عند التحميل',
          f'{R}أول خطأ: {errors[0] if errors else ""}{X}')

    # هل الملفات حُمّلت؟
    loaded = page.evaluate('''() => ({
        engine: typeof QararEngine !== 'undefined',
        demo:   typeof QararDemo   !== 'undefined',
        store:  typeof QararStore  !== 'undefined',
        agent:  typeof QararAgent  !== 'undefined',
        start:  typeof startExperience,
        nav:    typeof navigate,
        action: typeof handleAction
    })''')
    check(loaded['engine'], 'QararEngine محمّل')
    check(loaded['demo'],   'QararDemo محمّل')
    check(loaded['store'],  'QararStore محمّل')
    check(loaded['agent'],  'QararAgent محمّل')
    check(loaded['action'] == 'function', 'handleAction معرّفة')
    check(loaded['nav']    == 'function', 'navigate معرّفة')
    check(loaded['start']  == 'function',
          '⭐ startExperience معرّفة',
          f'{R}النوع الفعلي: {loaded["start"]}  ← هذا سبب تعطل الزر!{X}')

    # ═══ 2. شاشة البداية ═══
    sec('٢ — شاشة البداية')
    splash_visible = page.is_visible('#splash')
    check(splash_visible, 'شاشة البداية ظاهرة')

    btn = page.query_selector('[data-action="startExperience"]')
    check(btn is not None, 'زر «ابدأ التجربة الآن» موجود')

    # ═══ 3. ⭐ الضغط على الزر (الاختبار الحاسم) ═══
    sec('٣ — ⭐ الضغط على «ابدأ التجربة الآن»')

    errors.clear()
    btn.click()
    time.sleep(2.0)   # ننتظر الأنيميشن (1150ms) + هامش

    if errors:
        print(f'  {R}JS ERROR عند الضغط:{X}')
        for e in errors[:3]:
            print(f'    {R}{e}{X}')

    check(len(errors) == 0, 'لا خطأ JavaScript عند الضغط',
          f'{R}{errors[0] if errors else ""}{X}')

    splash_gone = page.evaluate(
        "() => { const s=document.querySelector('#splash'); "
        "return !s || getComputedStyle(s).display==='none' || s.classList.contains('hidden') "
        "|| getComputedStyle(s).opacity==='0'; }")
    check(splash_gone, '⭐⭐ شاشة البداية اختفت (الزر يعمل!)',
          f'{R}الزر لا يعمل — المستخدم عالق في شاشة البداية{X}')

    app_visible = page.evaluate(
        "() => { const a=document.querySelector('.app-shell'); "
        "return !!a && !a.classList.contains('prelaunch'); }")
    check(app_visible, 'واجهة المنصة ظهرت')

    if not splash_gone:
        print(f'\n{R}{B}  ✗✗ فشل حاسم — لا فائدة من متابعة بقية الاختبارات{X}')
        browser.close(); httpd.shutdown()
        sys.exit(1)

    # ═══ 4. Dashboard ═══
    sec('٤ — لوحة التحكم')
    body = page.inner_text('#view')
    check('٤٬٢٠٠' in body or '4,200' in body, 'الرصيد 4,200 ظاهر',
          f'المحتوى: {body[:120]}')

    # ═══ 5. Sandbox ═══
    sec('٥ — البيئة التجريبية')
    errors.clear()
    page.click('[data-goto="sandbox"]')
    time.sleep(1.2)
    check(len(errors) == 0, 'التنقل إلى Sandbox بلا أخطاء',
          f'{R}{errors[0] if errors else ""}{X}')

    bal = page.inner_text('#liveBalance') if page.query_selector('#liveBalance') else ''
    check('٤٬٢٠٠' in bal, f'الرصيد المعروض: {bal}')

    # ═══ 6. إضافة عملية ═══
    sec('٦ — إضافة مصروف 200')
    errors.clear()
    page.click('.kind-btn.expense')
    time.sleep(0.7)
    check(page.is_visible('#txTitle'), 'نموذج العملية فُتح')

    page.fill('#txTitle', 'بقالة')
    page.fill('#txAmount', '200')
    time.sleep(0.4)

    page.click('[data-action="saveTx"]')
    time.sleep(1.5)

    check(len(errors) == 0, 'الحفظ بلا أخطاء', f'{R}{errors[0] if errors else ""}{X}')

    new_bal = page.evaluate('() => QararStore.getBalance()')
    check(new_bal == 400000, f'⭐ الرصيد تغيّر → {new_bal/100:,.0f} ر.س (متوقع 4,000)')

    # ═══ 7. اختبار القرار ═══
    sec('٧ — اختبار القرار')
    errors.clear()
    page.click('[data-goto="decision"]')
    time.sleep(1.3)
    check(len(errors) == 0, 'التنقل إلى اختبار القرار بلا أخطاء',
          f'{R}{errors[0] if errors else ""}{X}')
    check(page.is_visible('#decisionAmount'), 'نموذج القرار ظاهر')

    # ═══ 8. تشغيل التحليل ═══
    sec('٨ — ⭐ تشغيل التحليل')
    errors.clear()
    page.click('[data-action="simulateDecision"]')
    time.sleep(2.0)

    check(len(errors) == 0, 'التحليل بلا أخطاء', f'{R}{errors[0] if errors else ""}{X}')

    res = page.inner_text('#decisionResult') if page.query_selector('#decisionResult') else ''
    check(len(res) > 100, 'نتيجة التحليل ظهرت')
    check('؜-١٣٠' in res or '-١٣٠' in res or '١٣٠' in res,
          '⭐ النتيجة تعرض −130 (تأثرت بالمصروف!)',
          f'المحتوى: {res[:200]}')

    # ═══ 9. المساعد (بلا API) ═══
    sec('٩ — المساعد بلا سيرفر AI (يجب ألا يتعطل)')
    errors.clear()
    page.click('[data-goto="assistant"]')
    time.sleep(1.5)
    check(len(errors) == 0, 'فتح المساعد بلا أخطاء', f'{R}{errors[0] if errors else ""}{X}')

    page.fill('#chatText', 'هل أقدر أشتري لابتوب بـ3000؟')
    page.click('[data-action="sendChat"]')
    time.sleep(3.0)

    msgs = page.inner_text('#messages')
    check(len(errors) == 0, '⭐ غياب AI لا يعطل التطبيق', f'{R}{errors[0] if errors else ""}{X}')
    check(len(msgs) > 50, 'المساعد ردّ (وضع احتياطي)')

    # ═══ 10. إعادة التحميل (الحفظ) ═══
    sec('١٠ — الحفظ بعد إعادة التحميل')
    page.reload(wait_until='networkidle')
    time.sleep(0.8)
    kept = page.evaluate('() => QararStore.getBalance()')
    check(kept == 400000, f'البيانات محفوظة بعد Refresh ({kept/100:,.0f} ر.س)')

    # ═══ 11. الجوال ═══
    sec('١١ — الجوال')
    page.set_viewport_size({'width': 390, 'height': 844})
    time.sleep(0.5)
    nav = page.evaluate('''() => {
        const n = document.querySelector('#mobileNav');
        return { visible: getComputedStyle(n).display !== 'none',
                 more: !!n.querySelector('[data-action="moreNav"]'),
                 second: n.querySelectorAll('button')[1]?.innerText || '' };
    }''')
    check(nav['visible'], 'شريط الجوال ظاهر')
    check(nav['more'], 'زر «المزيد» موجود')
    check('البيئة' in nav['second'], f'Sandbox في المركز الثاني ({nav["second"].strip()})')

    browser.close()

httpd.shutdown()

# ═══ النتيجة ═══
print('\n' + '═' * 68)
total = passed + failed
if failed == 0:
    print(f'{B}{G}  ✓ نجحت جميع اختبارات المتصفح الحقيقي: {passed}/{total}{X}')
    print('═' * 68)
    print(f'\n{B}{G}  ⭐ زر «ابدأ التجربة الآن» يعمل فعليًا{X}')
    print(f'{B}{G}  ⭐ Golden Path كامل من البداية للنهاية{X}')
    print(f'{B}{G}  ⭐ يعمل بلا سيرفر AI وبلا إنترنت{X}\n')
    sys.exit(0)
else:
    print(f'{B}{R}  ✗ فشل {failed} من {total}{X}')
    print('═' * 68)
    if errors:
        print(f'\n{R}أخطاء JavaScript:{X}')
        for e in errors[:5]: print(f'  {e}')
    print()
    sys.exit(1)
