#!/usr/bin/env python3
"""
QARAR — DECISION FLOW E2E
اختبار «اختبار القرار» — قلب المشروع

🔴 كل اختبار ينقر الزر الحقيقي ويقرأ النتيجة من الشاشة.
   لا استدعاء لـQararEngine.analyzeDecision() بدلًا عن المستخدم.
"""
import sys, os, threading, http.server, socketserver, functools, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__)) + '/..'
PORT = 8092
G,R,Y,C,B,X = '\033[32m','\033[31m','\033[33m','\033[36m','\033[1m','\033[0m'
passed = failed = 0

def ok(c,l,d=''):
    global passed, failed
    if c: passed+=1; print(f'    {G}✓{X} {l}')
    else:
        failed+=1; print(f'    {R}✗ {l}{X}')
        if d: print(f'      {R}{d}{X}')
    return c

def sec(t):
    print(f'\n{B}{C}{t}{X}'); print('  '+'─'*64)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass

hd = functools.partial(Q, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), hd)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
time.sleep(0.4)
BASE = f'http://127.0.0.1:{PORT}/index.html'

AR = {'0':'٠','1':'١','2':'٢','3':'٣','4':'٤','5':'٥','6':'٦','7':'٧','8':'٨','9':'٩'}
def ar(n):
    s = f'{abs(int(n)):,}'.replace(',', '٬')
    return ''.join(AR.get(c,c) for c in s)

def start(pg):
    pg.goto(BASE, wait_until='networkidle')
    pg.click('.start-experience-btn')
    pg.wait_for_function('() => !!window.__qararEntered', timeout=5000)
    time.sleep(0.8)

def reset(pg):
    pg.click('[data-goto="settings"]'); time.sleep(1.0)
    pg.click('[data-action="resetDemo"]'); time.sleep(0.6)
    pg.click('[data-action="confirmReset"]'); time.sleep(1.6)

def analyze(pg, wait=2.6):
    """⭐ ينقر الزر الحقيقي"""
    pg.click('[data-goto="decision"]'); time.sleep(1.2)
    pg.click('[data-action="simulateDecision"]')
    time.sleep(wait)
    el = pg.query_selector('#decisionResult')
    return el.inner_text() if el else ''

def add_tx(pg, kind, title, amt):
    pg.click('[data-goto="sandbox"]'); time.sleep(1.1)
    pg.click(f'.kind-btn.{kind}'); time.sleep(0.6)
    pg.fill('#txTitle', title); pg.fill('#txAmount', str(amt)); time.sleep(0.3)
    pg.click('[data-action="saveTx"]'); time.sleep(1.5)

def set_elec(pg, amt):
    pg.click('[data-goto="bills"]'); time.sleep(1.2)
    pg.click('[data-action="editBillForecast"]'); time.sleep(0.7)
    pg.fill('#billAmt', str(amt))
    pg.click('[data-action="saveBillForecast"]'); time.sleep(1.5)


print(f'{B}══ QARAR — اختبار القرار (قلب المشروع) ══{X}')

with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))

    # ═══ TEST 1 — Baseline ═══
    sec('TEST 1 — Baseline: لابتوب 3,000 (متوقع ٧٠)')
    start(pg)

    fb = pg.evaluate('() => ({store: !!QararStore.__isFallback, '
                     'engine: !!(window.QararEngine && QararEngine.__isFallback)})')
    ok(fb['store'] is False,  '⭐ المتجر الحقيقي (لا Fallback)')
    ok(fb['engine'] is False, '⭐ المحرك الحقيقي (لا Fallback)')

    pg.click('[data-goto="decision"]'); time.sleep(1.2)
    ok(pg.is_visible('#decisionAmount'), 'النموذج ظاهر')
    ok(pg.input_value('#decisionAmount') == '3000', 'المبلغ 3000')

    # ⭐ شاشة التحميل تظهر عند النقر
    pg.click('[data-action="simulateDecision"]')
    time.sleep(0.25)
    loading_seen = pg.evaluate(
        "() => { const l=document.querySelector('#loading'); "
        "return !!l && getComputedStyle(l).display !== 'none'; }")
    ok(loading_seen, '⭐ شاشة التحميل المميزة ظهرت')

    time.sleep(2.4)
    loading_gone = pg.evaluate(
        "() => getComputedStyle(document.querySelector('#loading')).display === 'none'")
    ok(loading_gone, 'شاشة التحميل اختفت')

    res = pg.inner_text('#decisionResult')
    ok(len(res) > 300, f'⭐ النتيجة ظهرت ({len(res)} حرف)', 'لا نتيجة!')
    ok('تحليل أثر القرار' in res, '⭐ رأس النتيجة واضح')
    ok(ar(70) in res,   '⭐⭐ أقل رصيد = ٧٠')
    ok(ar(1570) in res, '⭐⭐ أقصى مبلغ آمن = ١٬٥٧٠')
    ok(ar(1200) in res, 'الرصيد بعد القرار = ١٬٢٠٠')
    ok(ar(1430) in res, 'الفرق عن الحد الآمن = −١٬٤٣٠')
    ok('مرتفع' in res,  '⭐ مستوى الخطر = مرتفع')
    ok('انتظر نزول الراتب' in res or 'لا يُنصح' in res, '⭐ التوصية = تأجيل')
    ok('لماذا؟' in res, 'قسم «لماذا؟» ظاهر')
    ok('الخط الزمني' in res, 'الخط الزمني ظاهر')

    btn = pg.evaluate("() => { const b=document.querySelector('[data-action=\"simulateDecision\"]');"
                      "return {disabled:b.disabled, text:b.textContent.trim()}; }")
    ok(btn['disabled'] is False, 'الزر عاد للعمل')
    ok('تحليل' in btn['text'],   'نص الزر عاد')

    # ═══ TEST 2 — مصروف 200 → −١٣٠ ═══
    sec('TEST 2 — بعد مصروف 200 (متوقع −١٣٠)')
    reset(pg)
    add_tx(pg, 'expense', 'بقالة', 200)
    res = analyze(pg)
    ok(ar(130) in res, '⭐⭐ النتيجة = −١٣٠')
    ok(ar(4000) in res, 'الرصيد الحالي = ٤٬٠٠٠')

    # ═══ TEST 3 — كهرباء 900 → −١٨٠ ═══
    sec('TEST 3 — بعد كهرباء 900 (متوقع −١٨٠)')
    reset(pg)
    set_elec(pg, 900)
    res = analyze(pg)
    ok(ar(180) in res, '⭐⭐ النتيجة = −١٨٠')

    # ═══ TEST 4 — دخل 1000 → ١٬٠٧٠ ═══
    sec('TEST 4 — بعد دخل 1,000 (متوقع ١٬٠٧٠)')
    reset(pg)
    add_tx(pg, 'income', 'مكافأة', 1000)
    res = analyze(pg)
    ok(ar(1070) in res, '⭐⭐ النتيجة = ١٬٠٧٠')
    ok(ar(5200) in res, 'الرصيد = ٥٬٢٠٠')

    # ═══ CASE 5 — مصروف + كهرباء → −٣٨٠ ═══
    sec('CASE 5 — مصروف 200 + كهرباء 900 (متوقع −٣٨٠)')
    reset(pg)
    add_tx(pg, 'expense', 'بقالة', 200)
    set_elec(pg, 900)
    res = analyze(pg)
    ok(ar(380) in res, '⭐⭐ النتيجة = −٣٨٠  (4000−3000−1380)')

    # ═══ TEST 5 — تغيير المبلغ ═══
    sec('TEST 5 — تغيير المبلغ 3000 → 2200')
    reset(pg)
    pg.click('[data-goto="decision"]'); time.sleep(1.2)
    pg.fill('#decisionAmount', '2200'); time.sleep(0.3)
    pg.click('[data-action="simulateDecision"]'); time.sleep(2.4)
    res = pg.inner_text('#decisionResult')
    # 4200 − 2200 − 1130 = 870
    ok(ar(870) in res, '⭐ النتيجة تغيّرت = ٨٧٠')
    # 4200 − 2200 = 2000 (الرصيد بعد القرار) — دليل أن النتيجة أُعيد حسابها
    ok(ar(2000) in res, 'الرصيد بعد القرار = ٢٬٠٠٠ (أُعيد الحساب)')

    # ═══ TEST 6 — الضغط مرتين ═══
    sec('TEST 6 — الضغط مرتين بسرعة')
    reset(pg)
    pg.click('[data-goto="decision"]'); time.sleep(1.2)
    errs.clear()
    pg.click('[data-action="simulateDecision"]')
    try:
        pg.click('[data-action="simulateDecision"]', timeout=300, force=True)
    except Exception:
        pass
    time.sleep(2.6)
    heads = pg.evaluate("() => document.querySelectorAll('#decisionResult .result-header').length")
    ok(heads == 1, f'⭐ نتيجة واحدة فقط (عدد الرؤوس: {heads})')
    ok(len(errs) == 0, 'لا أخطاء')

    # ═══ TEST 7 — مبلغ غير صالح ═══
    sec('TEST 7 — مبلغ غير صالح')
    pg.fill('#decisionAmount', '0'); time.sleep(0.3)
    pg.click('[data-action="simulateDecision"]'); time.sleep(2.2)
    res = pg.inner_text('#decisionResult')
    ok('تعذر تحليل القرار' in res, '⭐ رسالة خطأ واضحة')
    ok('إعادة المحاولة' in res, 'زر إعادة المحاولة موجود')
    btn = pg.evaluate("() => document.querySelector('[data-action=\"simulateDecision\"]').disabled")
    ok(btn is False, '⭐ الزر لم يمت')

    # الاسترداد: نُصلح المبلغ ونعيد
    pg.fill('#decisionAmount', '3000'); time.sleep(0.3)
    pg.click('[data-action="simulateDecision"]'); time.sleep(2.4)
    res = pg.inner_text('#decisionResult')
    ok(ar(70) in res, '⭐ الاسترداد بعد الخطأ يعمل')

    # ═══ TEST 8 — خطأ قسري في المحرك ═══
    sec('TEST 8 — خطأ قسري في المحرك')
    pg.evaluate("""() => {
        window.__realEngine = QararEngine.analyzeDecision;
        QararEngine.analyzeDecision = () => { throw new Error('عطل اختباري'); };
    }""")
    pg.click('[data-action="simulateDecision"]'); time.sleep(2.2)
    res = pg.inner_text('#decisionResult')
    ok('تعذر تحليل القرار' in res, '⭐ حالة خطأ ظاهرة')
    btn = pg.evaluate("() => document.querySelector('[data-action=\"simulateDecision\"]').disabled")
    ok(btn is False, '⭐ الزر عاد للعمل')
    ld = pg.evaluate("() => getComputedStyle(document.querySelector('#loading')).display")
    ok(ld == 'none', '⭐ شاشة التحميل لم تعلق')

    # نُعيد المحرك
    pg.evaluate("() => { QararEngine.analyzeDecision = window.__realEngine; }")
    pg.click('[data-action="simulateDecision"]'); time.sleep(2.4)
    ok(ar(70) in pg.inner_text('#decisionResult'), 'الصفحة ما زالت صالحة')

    # ═══ TEST 9 — البدائل تُعيد التحليل ═══
    sec('TEST 9 — زر «تأجيل إلى بعد الراتب» يُعيد التحليل')
    reset(pg)
    res = analyze(pg)
    ok(ar(70) in res, 'التحليل الأساسي')
    risk_before = 'مرتفع' in res

    pg.click('[data-action="applyAlt"][data-alt="delay_to_salary"]')
    time.sleep(3.2)
    res2 = pg.inner_text('#decisionResult')
    ok(len(res2) > 300, '⭐ النتيجة الجديدة ظهرت')
    lower = ('منخفض' in res2 or 'متوسط' in res2)
    ok(lower, '⭐⭐ انخفض مستوى الخطر بعد التأجيل',
       f'ما زال: {res2[:60]}')

    date_now = pg.input_value('#decisionDate')
    ok(date_now != '2026-07-12', f'⭐ التاريخ تغيّر إلى {date_now}')

    # ═══ TEST 10 — الحفظ بعد Refresh ═══
    sec('TEST 10 — التحليل يستخدم القيم المحفوظة بعد Refresh')
    reset(pg)
    add_tx(pg, 'expense', 'بقالة', 200)
    set_elec(pg, 900)

    pg.reload(wait_until='networkidle')
    pg.click('.start-experience-btn')
    pg.wait_for_function('() => !!window.__qararEntered', timeout=5000)
    time.sleep(1.0)

    fb = pg.evaluate('() => !!QararStore.__isFallback')
    ok(fb is False, 'ما زال على المتجر الحقيقي')

    res = analyze(pg)
    ok(ar(380) in res, '⭐⭐ بعد Refresh: النتيجة = −٣٨٠')

    ok(len(errs) == 0, f'⭐ صفر أخطاء في كل المسار ({len(errs)})',
       errs[0] if errs else '')

    br.close()

httpd.shutdown()

print('\n' + '═'*68)
total = passed + failed
if failed == 0:
    print(f'{B}{G}  ✓ نجحت جميع اختبارات اختبار القرار: {passed}/{total}{X}')
    print('═'*68)
    print(f'\n{B}{G}  ⭐ الزر يستدعي المحرك الحقيقي{X}')
    print(f'{B}{G}  ⭐ النتيجة تعتمد على البيانات الحالية{X}')
    print(f'{B}{G}  ⭐ شاشة التحميل المميزة عادت{X}\n')
    sys.exit(0)
else:
    print(f'{B}{R}  ✗ فشل {failed} من {total}{X}')
    print('═'*68 + '\n')
    sys.exit(1)
