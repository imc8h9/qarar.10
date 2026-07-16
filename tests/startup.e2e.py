#!/usr/bin/env python3
"""
QARAR — STARTUP RELIABILITY E2E
اختبار موثوقية بدء التطبيق — متصفح حقيقي

يختبر الحالات العشر المطلوبة. في كل حالة:
  → اضغط «ابدأ التجربة الآن»
  → انتظر بحد أقصى 3 ثوانٍ
  → تأكد: splash مخفية · loading مخفية · لا prelaunch · Dashboard ظاهر

لا يُقبل أي Loading أبدي — إطلاقًا.
"""
import sys, os, threading, http.server, socketserver, functools, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__)) + '/..'
PORT = 8097
MAX_WAIT = 3.0   # الحد الأقصى المسموح للدخول

G,R,Y,C,B,X = '\033[32m','\033[31m','\033[33m','\033[36m','\033[1m','\033[0m'
passed = failed = 0

def ok(cond, label, detail=''):
    global passed, failed
    if cond:
        passed += 1; print(f'    {G}✓{X} {label}')
    else:
        failed += 1; print(f'    {R}✗ {label}{X}')
        if detail: print(f'      {R}{detail}{X}')
    return cond

def scenario(t):
    print(f'\n{B}{C}{t}{X}')
    print('  ' + '─'*64)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass

handler = functools.partial(Quiet, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
time.sleep(0.4)

BASE = f'http://127.0.0.1:{PORT}/index.html'


def check_entered(page, label_prefix=''):
    """⭐ الفحص الحاسم: هل دخل المستخدم فعلًا؟"""
    st = page.evaluate('''() => {
        const s = document.querySelector('#splash');
        const l = document.querySelector('#loading');
        const a = document.querySelector('.app-shell');
        const v = document.querySelector('#view');
        const vis = el => {
            if(!el) return false;
            const cs = getComputedStyle(el);
            return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
        };
        return {
            splashVisible:  vis(s),
            loadingVisible: vis(l),
            prelaunch:      !!a && a.classList.contains('prelaunch'),
            dashboardLen:   v ? v.innerHTML.trim().length : 0,
            entered:        !!window.__qararEntered
        };
    }''')
    p = label_prefix
    ok(not st['splashVisible'],  f'{p}شاشة البداية مخفية')
    ok(not st['loadingVisible'], f'{p}⭐ شاشة التحميل مخفية',
       'المستخدم عالق في Loading!' if st['loadingVisible'] else '')
    ok(not st['prelaunch'],      f'{p}prelaunch أُزيلت')
    ok(st['dashboardLen'] > 200, f'{p}لوحة التحكم ظاهرة ({st["dashboardLen"]} حرفًا)')
    return st


def press_start_and_wait(page):
    """اضغط الزر وانتظر حتى 3 ثوانٍ كحد أقصى"""
    t0 = time.time()
    page.click('.start-experience-btn')
    deadline = t0 + MAX_WAIT
    while time.time() < deadline:
        if page.evaluate('() => !!window.__qararEntered'):
            break
        time.sleep(0.05)
    elapsed = time.time() - t0
    time.sleep(0.35)   # هامش للرسم
    return elapsed


print(f'{B}══ QARAR — اختبار موثوقية البدء ══{X}')
print(f'{Y}القاعدة: الدخول خلال {MAX_WAIT} ثوانٍ كحد أقصى — في كل الحالات{X}')

with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-sandbox'])

    # ═══ A. التشغيل الطبيعي ═══
    scenario('A — التشغيل الطبيعي (HTTP)')
    pg = br.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE, wait_until='networkidle')
    el = press_start_and_wait(pg)
    ok(el < MAX_WAIT, f'دخل خلال {el:.2f}s (< {MAX_WAIT}s)')
    check_entered(pg)
    ok(len(errs) == 0, 'لا أخطاء JavaScript', errs[0] if errs else '')
    pg.close()

    # ═══ B. AI endpoint غير موجود ═══
    scenario('B — /api/assistant غير موجود (404)')
    pg = br.new_page()
    pg.route('**/api/**', lambda r: r.fulfill(status=404, body='Not Found'))
    pg.goto(BASE, wait_until='networkidle')
    el = press_start_and_wait(pg)
    ok(el < MAX_WAIT, f'دخل خلال {el:.2f}s رغم غياب AI')
    check_entered(pg)
    pg.close()

    # ═══ C. لا إنترنت ═══
    scenario('C — لا إنترنت إطلاقًا (كل الطلبات الخارجية تفشل)')
    ctx = br.new_context()
    pg = ctx.new_page()
    # نمنع كل شيء خارجي (خطوط، AI) ونسمح فقط بالملفات المحلية
    pg.route('**://fonts.googleapis.com/**', lambda r: r.abort())
    pg.route('**://fonts.gstatic.com/**',   lambda r: r.abort())
    pg.route('**/api/**', lambda r: r.abort())
    pg.goto(BASE, wait_until='domcontentloaded')
    time.sleep(0.6)
    el = press_start_and_wait(pg)
    ok(el < MAX_WAIT, f'دخل خلال {el:.2f}s بلا إنترنت')
    check_entered(pg)
    ctx.close()

    # ═══ D. localStorage معطّل ═══
    scenario('D — localStorage معطّل تمامًا')
    ctx = br.new_context()
    pg = ctx.new_page()
    pg.add_init_script('''
        Object.defineProperty(window, 'localStorage', {
            get(){ throw new Error('localStorage blocked'); },
            configurable: true
        });
    ''')
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE, wait_until='networkidle')
    el = press_start_and_wait(pg)
    ok(el < MAX_WAIT, f'دخل خلال {el:.2f}s بلا localStorage')
    check_entered(pg)
    ctx.close()

    # ═══ E. فشل Google Fonts ═══
    scenario('E — فشل تحميل الخطوط')
    ctx = br.new_context()
    pg = ctx.new_page()
    pg.route('**fonts.googleapis.com**', lambda r: r.abort())
    pg.route('**fonts.gstatic.com**',    lambda r: r.abort())
    pg.goto(BASE, wait_until='domcontentloaded')
    time.sleep(0.5)
    el = press_start_and_wait(pg)
    ok(el < MAX_WAIT, f'دخل خلال {el:.2f}s بلا خطوط')
    check_entered(pg)
    ctx.close()

    # ═══ F. الضغط مرتين بسرعة ═══
    scenario('F — الضغط مرتين بسرعة')
    pg = br.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE, wait_until='networkidle')
    pg.click('.start-experience-btn')
    try:
        pg.click('.start-experience-btn', timeout=400, force=True)
    except Exception:
        pass   # الزر معطّل — وهذا مطلوب
    time.sleep(1.6)
    st = check_entered(pg)
    ok(len(errs) == 0, 'لا أخطاء من الضغط المزدوج', errs[0] if errs else '')
    pg.close()

    # ═══ G. إعادة تحميل الصفحة ═══
    scenario('G — إعادة تحميل الصفحة بعد الدخول')
    pg = br.new_page()
    pg.goto(BASE, wait_until='networkidle')
    press_start_and_wait(pg)
    pg.reload(wait_until='networkidle')
    time.sleep(0.6)
    # بعد Refresh تعود شاشة البداية — وهذا طبيعي
    ld = pg.evaluate("() => { const l=document.querySelector('#loading'); "
                     "return getComputedStyle(l).display !== 'none'; }")
    ok(not ld, '⭐ شاشة التحميل مخفية بعد Refresh')
    el = press_start_and_wait(pg)
    ok(el < MAX_WAIT, f'دخل مجددًا خلال {el:.2f}s')
    check_entered(pg)
    pg.close()

    # ═══ H. file:// ═══
    scenario('H — فتح الملف مباشرة (file://)')
    pg = br.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.abspath(ROOT + '/index.html'))
    time.sleep(0.7)
    el = press_start_and_wait(pg)
    ok(el < MAX_WAIT, f'دخل خلال {el:.2f}s عبر file://')
    check_entered(pg)
    pg.close()

    # ═══ I. HTTP (مُغطّى في A) — نتحقق من التحليل يعمل ═══
    scenario('I — HTTP + المسار الكامل حتى التحليل')
    pg = br.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE, wait_until='networkidle')
    press_start_and_wait(pg)
    pg.click('[data-goto="decision"]'); time.sleep(1.2)
    pg.click('[data-action="simulateDecision"]'); time.sleep(1.8)
    res = pg.inner_text('#decisionResult')
    ok('٧٠' in res, '⭐ التحليل يعمل ويعرض ٧٠')
    # تأكد أن showLoading/hideLoading لا تترك الشاشة عالقة
    st = pg.evaluate("() => getComputedStyle(document.querySelector('#loading')).display")
    ok(st == 'none', '⭐ شاشة التحميل اختفت بعد التحليل (لا تعليق)')
    ok(len(errs) == 0, 'لا أخطاء', errs[0] if errs else '')
    pg.close()

    # ═══ J. تعطيل متعمّد لجزء غير أساسي ═══
    scenario('J — تخريب متعمّد: تعطيل QararAgent + تأخير startup')
    ctx = br.new_context()
    pg = ctx.new_page()
    pg.add_init_script('''
        // نُخرّب جزءًا غير أساسي عمدًا قبل التشغيل
        window.addEventListener('DOMContentLoaded', () => {
            window.QararAgent = undefined;       // المساعد معطّل
            window.__sabotaged = true;
        });
    ''')
    pg.route('**/api/**', lambda r: r.abort())
    pg.goto(BASE, wait_until='networkidle')
    el = press_start_and_wait(pg)
    ok(el < MAX_WAIT, f'⭐ دخل خلال {el:.2f}s رغم التخريب')
    check_entered(pg)
    ctx.close()

    # ═══ K. التخريب الأقصى: كل ملفات JS الخارجية تفشل ═══
    scenario('K — 🔴 التخريب الأقصى: كل ملفات src/*.js تفشل في التحميل')
    ctx = br.new_context()
    pg = ctx.new_page()
    pg.route('**/src/*.js', lambda r: r.abort())    # كل الملفات الخارجية ميتة
    pg.goto(BASE, wait_until='domcontentloaded')
    time.sleep(0.8)
    has_start = pg.evaluate('() => typeof window.startExperience')
    print(f'    {Y}startExperience: {has_start} (متوقع undefined){X}')
    el = press_start_and_wait(pg)
    ok(el < MAX_WAIT,
       f'⭐⭐ دخل خلال {el:.2f}s رغم فشل *كل* ملفات JS',
       'المستخدم عالق — شبكة الأمان لم تعمل!')
    st = pg.evaluate('''() => {
        const s=document.querySelector('#splash'), l=document.querySelector('#loading');
        const vis = el => el && getComputedStyle(el).display !== 'none';
        return { splash: vis(s), loading: vis(l) };
    }''')
    ok(not st['splash'],  'شاشة البداية مخفية (شبكة الأمان المستقلة)')
    ok(not st['loading'], '⭐ شاشة التحميل مخفية — لا Loading أبدي')
    ctx.close()

    br.close()

httpd.shutdown()

print('\n' + '═'*68)
total = passed + failed
if failed == 0:
    print(f'{B}{G}  ✓ نجحت جميع اختبارات موثوقية البدء: {passed}/{total}{X}')
    print('═'*68)
    print(f'\n{B}{G}  ⭐ لا يمكن أن يبقى المستخدم في Loading — في أي حالة{X}')
    print(f'{B}{G}  ⭐ يدخل خلال {MAX_WAIT} ثوانٍ حتى لو فشل كل شيء خارجي{X}\n')
    sys.exit(0)
else:
    print(f'{B}{R}  ✗ فشل {failed} من {total}{X}')
    print('═'*68 + '\n')
    sys.exit(1)
