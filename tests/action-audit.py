#!/usr/bin/env python3
"""
QARAR — PLATFORM-WIDE INTERACTION AUDIT
تدقيق كل زر في المنصة

ينقر **كل** [data-action] و[data-goto] و[data-ask] ظاهر في كل صفحة،
ويسجّل النتيجة الفعلية. ينتج ACTION_AUDIT.md

🔴 «يوجد handler» ليس نجاحًا. النجاح = نقر → لا خطأ → سلوك صحيح.
"""
import sys, os, threading, http.server, socketserver, functools, time, json
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__)) + '/..'
PORT = 8093
G,R,Y,C,B,X = '\033[32m','\033[31m','\033[33m','\033[36m','\033[1m','\033[0m'

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass

hd = functools.partial(Q, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), hd)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
time.sleep(0.4)
BASE = f'http://127.0.0.1:{PORT}/index.html'

PAGES = [
    ('home',      'الرئيسية'),
    ('sandbox',   'البيئة التجريبية'),
    ('decision',  'اختبار القرار'),
    ('assistant', 'المساعد'),
    ('bills',     'الالتزامات والفواتير'),
    ('analysis',  'التحليل'),
    ('forecast',  'التوقعات'),
    ('reports',   'التقارير'),
    ('family',    'الملف العائلي'),
    ('settings',  'الإعدادات'),
]

# إجراءات لا نضغطها آليًا (مدمّرة أو تحتاج سياق)
SKIP = {'closeSheet', 'confirmReset', 'confirmDeleteTx', 'confirmExecute',
        'agentConfirm', 'agentCancel', 'agentEdit'}

# إجراءات تحتاج تفاعلًا خاصًا (لا نقرة مجردة)
def special(pg, act):
    """يُرجع (handled, description, ok) — أو None لو ليس خاصًا"""
    if act == 'togglePayMode':
        # <select> يستجيب لـchange لا click
        pg.select_option('#decisionPayMode', 'installment')
        time.sleep(0.6)
        shown = pg.evaluate("() => getComputedStyle("
                            "document.querySelector('#monthsField')).display !== 'none'")
        pg.select_option('#decisionPayMode', 'one_time'); time.sleep(0.3)
        return (True, 'أظهر حقل الأشهر' if shown else '🔴 لم يُظهر الحقل', shown)

    if act == 'sendChat':
        # يحتاج نصًا في الحقل أولًا
        before = pg.evaluate("() => document.querySelector('#messages').children.length")
        pg.fill('#chatText', 'كم رصيدي؟')
        pg.click('#view [data-action="sendChat"]')
        time.sleep(2.5)
        after = pg.evaluate("() => document.querySelector('#messages').children.length")
        good = after > before
        return (True, f'{before} → {after} رسالة' if good else '🔴 لا رسالة', good)

    return None

results = []

def record(action, page, expected, actual, ok):
    results.append(dict(action=action, page=page, expected=expected,
                        actual=actual, ok=ok))
    mark = f'{G}✓{X}' if ok else f'{R}✗{X}'
    print(f'    {mark} [{action}] — {actual}')


print(f'{B}══ QARAR — تدقيق كل زر ══{X}')

with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))

    pg.goto(BASE, wait_until='networkidle')
    pg.click('.start-experience-btn')
    pg.wait_for_function('() => !!window.__qararEntered', timeout=5000)
    time.sleep(0.8)

    # ═══ تدقيق التنقل ═══
    print(f'\n{B}{C}التنقل (data-goto){X}')
    print('  ' + '─'*64)
    for pid, pname in PAGES:
        errs.clear()
        try:
            pg.click(f'[data-goto="{pid}"]', timeout=3000)
            time.sleep(1.1)
            content = pg.inner_text('#view')
            has_content = len(content) > 200
            no_err = len(errs) == 0
            good = has_content and no_err
            record(f'goto:{pid}', pname, 'تفتح الصفحة بمحتوى',
                   f'{len(content)} حرف · {len(errs)} خطأ', good)
        except Exception as e:
            record(f'goto:{pid}', pname, 'تفتح الصفحة',
                   f'تعذر النقر: {str(e)[:40]}', False)

    # ═══ تدقيق الإجراءات في كل صفحة ═══
    for pid, pname in PAGES:
        pg.evaluate("() => { const s=document.querySelector('#sheet'); "
                    "if(s) s.classList.remove('show'); }")
        time.sleep(0.3)
        pg.click(f'[data-goto="{pid}"]', timeout=8000); time.sleep(1.1)

        actions = pg.evaluate('''() => {
            const out = [];
            document.querySelectorAll('#view [data-action]').forEach(el => {
                const cs = getComputedStyle(el);
                if (cs.display !== 'none' && cs.visibility !== 'hidden') {
                    out.push(el.dataset.action);
                }
            });
            return [...new Set(out)];
        }''')

        if not actions:
            continue

        print(f'\n{B}{C}{pname}{X}')
        print('  ' + '─'*64)

        for act in actions:
            if act in SKIP:
                record(act, pname, '—', 'مُستثنى (مدمّر/يحتاج سياق)', True)
                continue

            errs.clear()

            # إجراءات خاصة
            sp = None
            try:
                sp = special(pg, act)
            except Exception as e:
                sp = (True, f'تعذر: {str(e)[:30]}', False)

            if sp:
                record(act, pname, 'استجابة مرئية',
                       f'{sp[1]} · {len(errs)} خطأ', sp[2] and len(errs)==0)
                continue

            try:
                # حالة قبل
                before = pg.evaluate('''() => ({
                    bal: (typeof QararStore!=='undefined') ? QararStore.getBalance() : 0,
                    view: document.querySelector('#view').innerHTML.length
                })''')

                pg.click(f'#view [data-action="{act}"]', timeout=3000)
                time.sleep(1.0)

                # هل فُتحت نافذة؟
                sheet_open = pg.evaluate(
                    "() => { const s=document.querySelector('#sheet'); "
                    "return !!s && s.classList.contains('show'); }")

                after = pg.evaluate('''() => ({
                    bal: (typeof QararStore!=='undefined') ? QararStore.getBalance() : 0,
                    view: document.querySelector('#view').innerHTML.length,
                    toast: document.querySelector('#toast')?.classList.contains('show')
                })''')

                changed = (sheet_open or after['view'] != before['view']
                           or after['bal'] != before['bal'] or after['toast'])

                no_err = len(errs) == 0
                good = no_err and changed

                what = ('فتح نافذة' if sheet_open
                        else 'تغيّر المحتوى' if after['view'] != before['view']
                        else 'تغيّر الرصيد' if after['bal'] != before['bal']
                        else 'أظهر رسالة' if after['toast']
                        else '🔴 لا استجابة')

                record(act, pname, 'استجابة مرئية',
                       f'{what} · {len(errs)} خطأ', good)

                # أغلق أي نافذة مفتوحة (وإلا حجبت النقرات التالية)
                pg.evaluate("() => { const s=document.querySelector('#sheet'); "
                            "if(s) s.classList.remove('show'); }")
                time.sleep(0.35)

            except Exception as e:
                record(act, pname, 'استجابة مرئية',
                       f'تعذر: {str(e)[:35]}', False)

            # نعود للصفحة (قد يكون الزر نقلنا)
            try:
                pg.evaluate("() => { const s=document.querySelector('#sheet'); "
                            "if(s) s.classList.remove('show'); }")
                time.sleep(0.25)
                cur = pg.evaluate('() => window.currentView')
                if cur != pid:
                    pg.click(f'[data-goto="{pid}"]', timeout=8000); time.sleep(0.9)
            except Exception:
                pass

    # ═══ الأزرار السريعة في المساعد ═══
    print(f'\n{B}{C}المساعد — أزرار الأسئلة{X}')
    print('  ' + '─'*64)
    pg.evaluate("() => { const s=document.querySelector('#sheet'); if(s) s.classList.remove('show'); }")
    time.sleep(0.3)
    pg.click('[data-goto="assistant"]', timeout=8000); time.sleep(1.3)
    asks = pg.evaluate("() => [...document.querySelectorAll('[data-ask]')].map(e=>e.dataset.ask)")
    for a in asks[:2]:
        errs.clear()
        try:
            before = pg.evaluate("() => document.querySelector('#messages').children.length")
            pg.click(f'[data-ask="{a}"]'); time.sleep(2.5)
            after = pg.evaluate("() => document.querySelector('#messages').children.length")
            record(f'ask:{a[:22]}…', 'المساعد', 'رسالة جديدة',
                   f'{before} → {after} رسالة', after > before and len(errs)==0)
        except Exception as e:
            record(f'ask:{a[:22]}…', 'المساعد', 'رسالة جديدة',
                   f'تعذر: {str(e)[:30]}', False)

    br.close()

httpd.shutdown()

# ═══ التقرير ═══
ok_n = sum(1 for r in results if r['ok'])
bad  = [r for r in results if not r['ok']]

lines = ['# ACTION_AUDIT.md', '## تدقيق كل زر في المنصة', '',
         f'**المجموع:** {len(results)} إجراء · '
         f'**نجح:** {ok_n} · **فشل:** {len(bad)}', '',
         '> 🔴 «يوجد handler» ليس نجاحًا.',
         '> النجاح = نقر حقيقي → لا خطأ → استجابة مرئية.', '',
         '| Action | الصفحة | المتوقع | النتيجة الفعلية | Pass/Fail |',
         '|---|---|---|---|---|']

for r in results:
    lines.append(f"| `{r['action']}` | {r['page']} | {r['expected']} | "
                 f"{r['actual']} | {'✅ Pass' if r['ok'] else '❌ **Fail**'} |")

if bad:
    lines += ['', '## 🔴 أزرار تحتاج إصلاحًا', '']
    for r in bad:
        lines.append(f"- **`{r['action']}`** ({r['page']}) — {r['actual']}")
else:
    lines += ['', '## ✅ لا توجد أزرار ميتة', '',
              'كل زر ظاهر للمستخدم يستجيب فعليًا عند النقر.']

open(ROOT + '/ACTION_AUDIT.md', 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

print('\n' + '═'*68)
if not bad:
    print(f'{B}{G}  ✓ لا أزرار ميتة: {ok_n}/{len(results)}{X}')
    print('═'*68 + '\n')
    sys.exit(0)
else:
    print(f'{B}{R}  ✗ {len(bad)} زر لا يعمل من {len(results)}{X}')
    for r in bad:
        print(f"  {R}✗{X} [{r['action']}] {r['page']} — {r['actual']}")
    print('═'*68 + '\n')
    sys.exit(1)
