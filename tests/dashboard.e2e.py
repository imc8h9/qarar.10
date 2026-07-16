#!/usr/bin/env python3
"""
QARAR — DASHBOARD INTEGRITY E2E
اختبار سلامة لوحة التحكم — متصفح حقيقي

🔴 القاعدة: لا يُقبل «اختفى الـsplash» كدليل نجاح.
   يجب أن تظهر **لوحة التحكم الكاملة** — بكل عناصرها.

يفشل الاختبار فورًا لو ظهر: «تعذر تحميل لوحة التحكم»
"""
import sys, os, threading, http.server, socketserver, functools, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__)) + '/..'
PORT = 8096
G,R,Y,C,B,X = '\033[32m','\033[31m','\033[33m','\033[36m','\033[1m','\033[0m'
passed = failed = 0

def ok(c, l, d=''):
    global passed, failed
    if c: passed += 1; print(f'    {G}✓{X} {l}')
    else:
        failed += 1; print(f'    {R}✗ {l}{X}')
        if d: print(f'      {R}{d}{X}')
    return c

def sec(t):
    print(f'\n{B}{C}{t}{X}'); print('  ' + '─'*64)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass

hd = functools.partial(Q, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), hd)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
time.sleep(0.4)
BASE = f'http://127.0.0.1:{PORT}/index.html'

ERROR_TEXT = 'تعذر تحميل لوحة التحكم'


def assert_full_dashboard(pg, label, expect_level=None):
    """⭐ الفحص الحاسم: هل ظهرت لوحة التحكم *الكاملة*؟"""
    d = pg.evaluate('''() => {
        const v = document.querySelector('#view');
        const t = v ? v.innerText : '';
        return {
            text:      t,
            len:       t.length,
            cards:     v ? v.querySelectorAll('.card, .state-card, .metric, .qa').length : 0,
            navItems:  document.querySelectorAll('.nav-item').length,
            buttons:   v ? v.querySelectorAll('button').length : 0,
            svgs:      v ? v.querySelectorAll('svg').length : 0,
            level:     window.__recoveryLevel,
            store:     (typeof QararStore !== 'undefined')
                         ? (QararStore.__isFallback ? 'fallback' : 'real') : 'MISSING',
            engine:    (typeof QararEngine !== 'undefined')
                         ? (QararEngine.__isFallback ? 'fallback' : 'real') : 'MISSING'
        };
    }''')

    # 🔴 الشرط الأهم: لا رسالة خطأ مكان لوحة التحكم
    ok(ERROR_TEXT not in d['text'],
       f'{label}: ⭐ لا تظهر رسالة «{ERROR_TEXT}»',
       'ظهرت رسالة الخطأ بدل لوحة التحكم!')

    ok('٤٬٢٠٠' in d['text'], f'{label}: الرصيد ٤٬٢٠٠ ظاهر')
    ok(d['cards'] >= 6,      f'{label}: عناصر لوحة التحكم ({d["cards"]} عنصرًا)', 'أقل من 6')
    ok(d['navItems'] >= 10,  f'{label}: الشريط الجانبي كامل ({d["navItems"]} عنصر)')
    ok(d['buttons'] >= 3,    f'{label}: أزرار الإجراءات ({d["buttons"]})')
    ok(d['len'] > 400,       f'{label}: محتوى حقيقي ({d["len"]} حرف)')

    if expect_level is not None:
        ok(d['level'] == expect_level,
           f'{label}: مستوى الاسترداد = {expect_level}',
           f'الفعلي: {d["level"]}')

    print(f'      {Y}المتجر: {d["store"]} · المحرك: {d["engine"]} · المستوى: {d["level"]}{X}')
    return d


print(f'{B}══ QARAR — سلامة لوحة التحكم ══{X}')
print(f'{Y}لا يُقبل «اختفى الـsplash» — يجب أن تظهر المنصة الكاملة{X}')

with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-sandbox'])

    # ═══ ١. المستوى الأول — كل شيء يعمل ═══
    sec('المستوى ١ — كل شيء يعمل')
    pg = br.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE, wait_until='networkidle')
    pg.click('.start-experience-btn'); time.sleep(1.8)
    assert_full_dashboard(pg, 'طبيعي', expect_level=1)
    ok(len(errs) == 0, 'طبيعي: لا أخطاء JavaScript', errs[0] if errs else '')
    pg.close()

    # ═══ ٢. المستوى الثاني — AI فشل ═══
    sec('المستوى ٢ — المساعد الذكي فشل (التطبيق يجب أن يبقى كاملًا)')
    ctx = br.new_context(); pg = ctx.new_page()
    pg.route('**/src/ai-agent.js', lambda r: r.abort())
    pg.route('**/api/**',          lambda r: r.abort())
    pg.goto(BASE, wait_until='domcontentloaded'); time.sleep(0.8)
    pg.click('.start-experience-btn'); time.sleep(1.8)
    assert_full_dashboard(pg, 'AI معطّل', expect_level=2)
    ctx.close()

    # ═══ ٣. المستوى الثالث — localStorage فشل ═══
    sec('المستوى ٣ — localStorage محظور (التطبيق يجب أن يبقى كاملًا)')
    ctx = br.new_context(); pg = ctx.new_page()
    pg.add_init_script('''
        Object.defineProperty(window, 'localStorage', {
            get(){ throw new Error('blocked'); }, configurable: true });
    ''')
    pg.goto(BASE, wait_until='networkidle')
    pg.click('.start-experience-btn'); time.sleep(1.8)
    assert_full_dashboard(pg, 'لا تخزين')
    ctx.close()

    # ═══ ٤. المستوى الرابع — data-store.js فشل ⭐ (حالتك) ═══
    sec('المستوى ٤ — 🔴 data-store.js فشل (هذه هي حالتك)')
    ctx = br.new_context(); pg = ctx.new_page()
    pg.route('**/src/data-store.js', lambda r: r.abort())
    pg.goto(BASE, wait_until='domcontentloaded'); time.sleep(0.8)
    pg.click('.start-experience-btn'); time.sleep(1.8)
    d = assert_full_dashboard(pg, '⭐ متجر معطّل')
    ok(d['store'] == 'fallback', '⭐ تم التحويل إلى المتجر البديل تلقائيًا')
    ctx.close()

    # ═══ ٥. المحرك فشل ═══
    sec('المحرك فشل (decision-engine.js)')
    ctx = br.new_context(); pg = ctx.new_page()
    pg.route('**/src/decision-engine.js', lambda r: r.abort())
    pg.goto(BASE, wait_until='domcontentloaded'); time.sleep(0.8)
    pg.click('.start-experience-btn'); time.sleep(1.8)
    d = assert_full_dashboard(pg, 'محرك معطّل')
    ok(d['engine'] == 'fallback', 'تم التحويل إلى المحرك البديل')
    ctx.close()

    # ═══ ٦. 🔴 كل الملفات فشلت ═══
    sec('🔴 الحالة القصوى — كل ملفات src/*.js فشلت')
    ctx = br.new_context(); pg = ctx.new_page()
    pg.route('**/src/*.js', lambda r: r.abort())
    pg.goto(BASE, wait_until='domcontentloaded'); time.sleep(0.9)
    pg.click('.start-experience-btn'); time.sleep(2.2)
    d = assert_full_dashboard(pg, '⭐⭐ كل الملفات ميتة')
    ok(d['store'] == 'fallback' and d['engine'] == 'fallback',
       '⭐⭐ المتجر والمحرك البديلان يعملان')
    ctx.close()

    # ═══ ٧. Golden Path كامل ═══
    sec('⭐ Golden Path الكامل (طبيعي)')
    pg = br.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE, wait_until='networkidle')
    pg.click('.start-experience-btn'); time.sleep(1.8)

    ok('الرئيسية' in pg.inner_text('body'), '١. لوحة التحكم — عنوان «الرئيسية»')
    ok('٤٬٢٠٠' in pg.inner_text('#view'),   '٢. الرصيد = ٤٬٢٠٠')

    nav2 = pg.evaluate("() => document.querySelectorAll('#sideNav .nav-item, .side-nav .nav-item, .nav-item')[1]?.innerText || ''")
    ok('البيئة' in nav2, f'٣. البيئة التجريبية = الخيار الثاني')

    # Sandbox → add expense 200
    pg.click('[data-goto="sandbox"]'); time.sleep(1.2)
    ok('SANDBOX' in pg.inner_text('#view'), '٤. البيئة التجريبية فُتحت')
    pg.click('.kind-btn.expense'); time.sleep(0.7)
    pg.fill('#txTitle', 'بقالة'); pg.fill('#txAmount', '200'); time.sleep(0.3)
    pg.click('[data-action="saveTx"]'); time.sleep(1.5)
    bal = pg.evaluate('() => QararStore.getBalance()')
    ok(bal == 400000, f'٥. مصروف 200 → الرصيد {bal/100:,.0f} (متوقع 4,000)')

    # Decision → -130
    pg.click('[data-goto="decision"]'); time.sleep(1.2)
    pg.click('[data-action="simulateDecision"]'); time.sleep(2.0)
    res = pg.inner_text('#decisionResult')
    ok('١٣٠' in res, '٦. ⭐ نتيجة القرار = −١٣٠')
    ok(ERROR_TEXT not in pg.inner_text('#view'), '٧. لا رسالة خطأ')

    # Delete → back to 70
    pg.click('[data-goto="sandbox"]'); time.sleep(1.2)
    pg.click('[data-action="askDeleteTx"]'); time.sleep(0.7)
    pg.click('[data-action="confirmDeleteTx"]'); time.sleep(1.4)
    pg.click('[data-goto="decision"]'); time.sleep(1.2)
    pg.click('[data-action="simulateDecision"]'); time.sleep(2.0)
    res = pg.inner_text('#decisionResult')
    ok('٧٠' in res, '٨. ⭐ حذف العملية → النتيجة عادت ٧٠')

    # Bills → 900 → -180
    pg.click('[data-goto="bills"]'); time.sleep(1.3)
    pg.click('[data-action="editBillForecast"]'); time.sleep(0.7)
    pg.fill('#billAmt', '900')
    pg.click('[data-action="saveBillForecast"]'); time.sleep(1.4)
    pg.click('[data-goto="decision"]'); time.sleep(1.2)
    pg.click('[data-action="simulateDecision"]'); time.sleep(2.0)
    res = pg.inner_text('#decisionResult')
    ok('١٨٠' in res, '٩. ⭐ كهرباء 900 → النتيجة −١٨٠')

    # Assistant survives
    pg.click('[data-goto="assistant"]'); time.sleep(1.4)
    ok(ERROR_TEXT not in pg.inner_text('#view'), '١٠. المساعد لا يُسقِط التطبيق')

    ok(len(errs) == 0, '⭐ Golden Path بلا أخطاء JavaScript',
       errs[0] if errs else '')
    pg.close()

    br.close()

httpd.shutdown()

print('\n' + '═'*68)
total = passed + failed
if failed == 0:
    print(f'{B}{G}  ✓ نجحت جميع اختبارات لوحة التحكم: {passed}/{total}{X}')
    print('═'*68)
    print(f'\n{B}{G}  ⭐ لوحة التحكم الكاملة تظهر في *كل* حالات الفشل{X}')
    print(f'{B}{G}  ⭐ لا تظهر «تعذر تحميل لوحة التحكم» أبدًا{X}\n')
    sys.exit(0)
else:
    print(f'{B}{R}  ✗ فشل {failed} من {total}{X}')
    print('═'*68 + '\n')
    sys.exit(1)
