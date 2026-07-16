#!/usr/bin/env python3
"""
QARAR — FUNCTIONAL E2E (P0)
اختبار وظيفي — نقر حقيقي · تحقّق من الـDOM

🔴 القواعد:
  1. لا نستدعي QararStore/QararEngine بدلًا عن المستخدم — **ننقر الأزرار**.
  2. لا يكفي أن يتغير المتجر — **يجب أن يتغير ما يراه المستخدم على الشاشة**.
  3. المسار الطبيعي يجب أن يعمل على **المتجر الحقيقي** — لا Fallback صامت.
"""
import sys, os, threading, http.server, socketserver, functools, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__)) + '/..'
PORT = 8095
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

# ── أرقام عربية ──
AR = {'0':'٠','1':'١','2':'٢','3':'٣','4':'٤','5':'٥','6':'٦','7':'٧','8':'٨','9':'٩'}
def ar(n):
    """4000 → ٤٬٠٠٠"""
    s = f'{abs(int(n)):,}'.replace(',', '٬')
    return ''.join(AR.get(c, c) for c in s)


def start(pg):
    pg.goto(BASE, wait_until='networkidle')
    pg.click('.start-experience-btn')
    pg.wait_for_function('() => !!window.__qararEntered', timeout=5000)
    time.sleep(0.8)

def reset_demo(pg):
    """إعادة الضبط عبر واجهة المستخدم (نقر)"""
    pg.click('[data-goto="settings"]'); time.sleep(1.0)
    pg.click('[data-action="resetDemo"]'); time.sleep(0.6)
    pg.click('[data-action="confirmReset"]'); time.sleep(1.5)

def add_tx(pg, kind, title, amount):
    """إضافة عملية بالنقر"""
    pg.click('[data-goto="sandbox"]'); time.sleep(1.1)
    pg.click(f'.kind-btn.{kind}'); time.sleep(0.6)
    pg.fill('#txTitle', title)
    pg.fill('#txAmount', str(amount))
    time.sleep(0.3)
    pg.click('[data-action="saveTx"]'); time.sleep(1.5)

def dom_balance(pg):
    """الرصيد كما **يراه المستخدم**"""
    pg.click('[data-goto="sandbox"]'); time.sleep(1.1)
    return pg.inner_text('#liveBalance').strip()

def analyze(pg):
    """تشغيل التحليل بالنقر"""
    pg.click('[data-goto="decision"]'); time.sleep(1.1)
    pg.click('[data-action="simulateDecision"]'); time.sleep(1.6)
    return pg.inner_text('#decisionResult')

def set_bill(pg, amount):
    pg.click('[data-goto="bills"]'); time.sleep(1.2)
    pg.click('[data-action="editBillForecast"]'); time.sleep(0.7)
    pg.fill('#billAmt', str(amount))
    pg.click('[data-action="saveBillForecast"]'); time.sleep(1.5)


print(f'{B}══ QARAR — اختبار وظيفي (نقر حقيقي) ══{X}')
print(f'{Y}لا يكفي تغيّر المتجر — يجب أن تتغير الشاشة{X}')

with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))

    # ═══ TEST 11 (أولًا) — المسار الطبيعي على المتجر الحقيقي ═══
    sec('TEST 11 — ⭐ المسار الطبيعي يستخدم المتجر الحقيقي (لا Fallback صامت)')
    start(pg)
    st = pg.evaluate('''() => ({
        fb: !!QararStore.__isFallback,
        engFb: !!(window.QararEngine && QararEngine.__isFallback),
        persist: QararStore.isPersistent(),
        level: window.__recoveryLevel
    })''')
    ok(st['fb'] is False,     '⭐ QararStore.__isFallback !== true', f"fallback={st['fb']}")
    ok(st['engFb'] is False,  'المحرك الحقيقي (لا بديل)')
    ok(st['persist'] is True, 'التخزين المحلي يعمل')
    ok(st['level'] == 1,      'مستوى الاسترداد = 1 (طبيعي)', f"level={st['level']}")

    # ═══ TEST 1 — مصروف ═══
    sec('TEST 1 — إضافة مصروف 200 (نقر)')
    reset_demo(pg)
    before = dom_balance(pg)
    ok(ar(4200) in before, f'الرصيد قبل (DOM): {before}')

    add_tx(pg, 'expense', 'بقالة', 200)
    after = pg.inner_text('#liveBalance').strip()
    ok(ar(4000) in after, f'⭐ الرصيد بعد (DOM): {after} — متوقع ٤٬٠٠٠',
       'الشاشة لم تتحدث!')

    txt = pg.inner_text('#view')
    ok('بقالة' in txt, 'العملية ظهرت في القائمة')

    store = pg.evaluate('() => QararStore.getBalance()')
    ok(store == 400000, f'المتجر متوافق مع الشاشة ({store})')

    # ═══ TEST 7 — القرار بعد المصروف ═══
    sec('TEST 7 — القرار بعد المصروف (متوقع −١٣٠)')
    res = analyze(pg)
    ok(ar(130) in res, f'⭐ النتيجة تعرض −١٣٠', res[:120])
    ok('تعذر' not in res, 'لا رسالة خطأ')

    # ═══ TEST 3 — تعديل العملية ═══
    sec('TEST 3 — تعديل العملية 200 → 350 (الفرق فقط)')
    pg.click('[data-goto="sandbox"]'); time.sleep(1.1)
    pg.click('[data-action="editTx"]'); time.sleep(0.7)
    pg.fill('#txAmount', '350'); time.sleep(0.3)
    pg.click('[data-action="saveTx"]'); time.sleep(1.5)
    after = pg.inner_text('#liveBalance').strip()
    ok(ar(3850) in after, f'⭐ الرصيد = ٣٬٨٥٠ (وليس ٣٬٦٥٠)  الفعلي: {after}',
       'حُسبت العملية مرتين!')
    cnt = pg.evaluate('() => QararStore.getTransactions().length')
    ok(cnt == 1, f'عملية واحدة فقط (لا تكرار) — العدد: {cnt}')

    # ═══ TEST 4 — حذف العملية ═══
    sec('TEST 4 — حذف العملية')
    pg.click('[data-action="askDeleteTx"]'); time.sleep(0.6)
    pg.click('[data-action="confirmDeleteTx"]'); time.sleep(1.5)
    after = pg.inner_text('#liveBalance').strip()
    ok(ar(4200) in after, f'⭐ الرصيد عاد ٤٬٢٠٠ — الفعلي: {after}')

    res = analyze(pg)
    ok(ar(70) in res, '⭐ نتيجة القرار عادت ٧٠')

    # ═══ TEST 2 — دخل ═══
    sec('TEST 2 — إضافة دخل 1,000 (نقر)')
    reset_demo(pg)
    add_tx(pg, 'income', 'مكافأة', 1000)
    after = pg.inner_text('#liveBalance').strip()
    ok(ar(5200) in after, f'⭐ الرصيد = ٥٬٢٠٠ — الفعلي: {after}')

    # ═══ TEST 9 — الدخل يؤثر على القرار ═══
    sec('TEST 9 — الدخل يغيّر نتيجة القرار (متوقع ١٬٠٧٠)')
    res = analyze(pg)
    ok(ar(1070) in res, '⭐ النتيجة = ١٬٠٧٠')

    # ═══ TEST 5 — حفظ الفاتورة ═══
    sec('TEST 5 — ⭐ حفظ فاتورة الكهرباء 650 → 900')
    reset_demo(pg)
    pg.click('[data-goto="bills"]'); time.sleep(1.2)
    before = pg.inner_text('#view')
    ok(ar(650) in before, 'قبل: تعرض ٦٥٠')

    set_bill(pg, 900)
    after = pg.inner_text('#view')
    ok(ar(900) in after, '⭐ بعد الحفظ: الصفحة تعرض ٩٠٠ فورًا', 'لم تُحفظ!')
    ok('تعديل يدوي' in after, 'شارة «تعديل يدوي» ظاهرة')

    sheet = pg.evaluate("() => { const s=document.querySelector('#sheet'); "
                        "return s ? getComputedStyle(s).display : 'none'; }")
    ok(sheet == 'none' or not pg.is_visible('#billAmt'), 'النافذة أُغلقت')

    # ═══ TEST 8 — القرار بعد تغيير الفاتورة ═══
    sec('TEST 8 — القرار بعد كهرباء 900 (متوقع −١٨٠)')
    res = analyze(pg)
    ok(ar(180) in res, '⭐ النتيجة = −١٨٠')

    # ═══ TEST 10 + P0-8 — الحفظ الحقيقي بعد Refresh ═══
    sec('TEST 10 — ⭐ الحفظ الحقيقي بعد Refresh')
    # الحالة الآن: كهرباء 900. نضيف مصروف 200.
    add_tx(pg, 'expense', 'بقالة', 200)
    bal_before = pg.inner_text('#liveBalance').strip()
    ok(ar(4000) in bal_before, f'قبل Refresh: الرصيد ٤٬٠٠٠')

    pg.reload(wait_until='networkidle')
    pg.click('.start-experience-btn')
    pg.wait_for_function('() => !!window.__qararEntered', timeout=5000)
    time.sleep(1.0)

    fb = pg.evaluate('() => !!QararStore.__isFallback')
    ok(fb is False, 'بعد Refresh: ما زال على المتجر الحقيقي')

    bal_after = dom_balance(pg)
    ok(ar(4000) in bal_after, f'⭐ الرصيد بقي ٤٬٠٠٠ بعد Refresh — الفعلي: {bal_after}')

    pg.click('[data-goto="bills"]'); time.sleep(1.2)
    bills = pg.inner_text('#view')
    ok(ar(900) in bills, '⭐ الكهرباء بقيت ٩٠٠ بعد Refresh')

    # P0-8: 4000 − 3000 − 1380 = −380
    res = analyze(pg)
    ok(ar(380) in res, '⭐ النتيجة بعد Refresh = −٣٨٠  (4000−3000−1380)')

    # حذف المصروف → 4200، والقرار → −180
    pg.click('[data-goto="sandbox"]'); time.sleep(1.1)
    pg.click('[data-action="askDeleteTx"]'); time.sleep(0.6)
    pg.click('[data-action="confirmDeleteTx"]'); time.sleep(1.5)
    ok(ar(4200) in pg.inner_text('#liveBalance'), 'حذف المصروف → ٤٬٢٠٠')
    res = analyze(pg)
    ok(ar(180) in res, 'القرار عاد −١٨٠')

    # ═══ TEST 6 — Baseline ═══
    sec('TEST 6 — Baseline بعد إعادة الضبط (متوقع ٧٠)')
    reset_demo(pg)
    bal = dom_balance(pg)
    ok(ar(4200) in bal, f'الرصيد ٤٬٢٠٠')
    res = analyze(pg)
    ok(ar(70) in res, '⭐ النتيجة = ٧٠')
    ok(ar(1570) in res, '⭐ أقصى مبلغ آمن = ١٬٥٧٠')

    # ═══ TEST 12 — لا أزرار ميتة ═══
    sec('TEST 12 — لا أخطاء JavaScript في كل المسار')
    ok(len(errs) == 0, f'⭐ صفر أخطاء Uncaught ({len(errs)})',
       errs[0] if errs else '')

    br.close()

httpd.shutdown()

print('\n' + '═'*68)
total = passed + failed
if failed == 0:
    print(f'{B}{G}  ✓ نجحت جميع الاختبارات الوظيفية: {passed}/{total}{X}')
    print('═'*68)
    print(f'\n{B}{G}  ⭐ كل تغيير يظهر على الشاشة فورًا{X}')
    print(f'{B}{G}  ⭐ الحفظ حقيقي ويبقى بعد Refresh{X}')
    print(f'{B}{G}  ⭐ المسار الطبيعي على المتجر الحقيقي{X}\n')
    sys.exit(0)
else:
    print(f'{B}{R}  ✗ فشل {failed} من {total}{X}')
    print('═'*68 + '\n')
    sys.exit(1)
