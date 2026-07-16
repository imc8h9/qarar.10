#!/usr/bin/env python3
"""
GOLDEN_PATH — يشغّل المسار الذهبي كاملًا في متصفح حقيقي بعد التلميع،
مع تغيير الحالة، ويؤكّد أن نتائج المحرك مطابقة 100%:
  أساس 70  →  +مصروف200 = −130  →  حذف = 70  →  كهرباء 900 = −180
"""
import time, threading, http.server, socketserver, functools, json
ROOT="/home/claude/qarar"; PORT=8110
def serve():
    socketserver.TCPServer.allow_reuse_address=True
    h=functools.partial(http.server.SimpleHTTPRequestHandler,directory=ROOT)
    socketserver.TCPServer(("127.0.0.1",PORT),h).serve_forever()
threading.Thread(target=serve,daemon=True).start(); time.sleep(1)
from playwright.sync_api import sync_playwright

def run_analysis(pg):
    """Reset to a clean decision view, run laptop-3000 analysis, return minimumBalance (riyal)."""
    pg.evaluate("() => { window.__forceNav=true; navigate('decision'); window.__forceNav=false; }")
    pg.wait_for_function("() => (typeof currentView!=='undefined'&&currentView==='decision') && document.getElementById('decisionAmount')", timeout=5000)
    pg.wait_for_timeout(300)
    pg.eval_on_selector("#decisionAmount","el=>el.value='3000'")
    pg.eval_on_selector("#decisionName","el=>el.value='لابتوب'")
    pg.eval_on_selector("#decisionType","el=>el.value='purchase'")
    pg.click('[data-action="simulateDecision"]')
    pg.wait_for_function("() => (typeof lastAnalysis!=='undefined' && lastAnalysis)", timeout=5000)
    pg.wait_for_timeout(200)
    minor = pg.evaluate("() => lastAnalysis.minimumBalance")
    return minor/100.0

steps=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":900})
    pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.wait_for_timeout(1200)
    pg.query_selector('[data-action="startExperience"]').click(); pg.wait_for_timeout(1200)

    # ensure a clean baseline
    pg.evaluate("() => QararStore.reset()")
    pg.wait_for_timeout(200)

    # STEP 1 — baseline: expect 70
    r1 = run_analysis(pg)
    steps.append(["baseline_laptop_3000", r1, 70, r1==70])

    # STEP 2 — add expense 200 (as the sandbox 'add transaction' does): expect -130
    pg.evaluate("""() => QararStore.addTransaction({
        type:'expense', amountMinor:20000, title:'مصروف اختبار',
        merchantOrSource:'اختبار', category:'أخرى',
        transactionDate: QararStore.getProfile().asOfDate, source:'manual'
    })""")
    pg.wait_for_timeout(200)
    r2 = run_analysis(pg)
    steps.append(["after_expense_200", r2, -130, r2==-130])

    # STEP 3 — delete that expense: expect back to 70
    pg.evaluate("""() => {
        const txs = QararStore.getSnapshot().transactions || QararStore.getAllTransactions?.() || [];
        const t = (txs||[]).find(x => x.title==='مصروف اختبار');
        if(t) QararStore.deleteTransaction(t.id);
    }""")
    pg.wait_for_timeout(200)
    r3 = run_analysis(pg)
    steps.append(["after_delete_expense", r3, 70, r3==70])

    # STEP 4 — set electricity manual forecast to 900: expect -180
    pg.evaluate("() => QararStore.setBillManualForecast('vb_electricity', 90000)")
    pg.wait_for_timeout(200)
    r4 = run_analysis(pg)
    steps.append(["after_electricity_900", r4, -180, r4==-180])

    b.close()

print(json.dumps({"golden_path": steps}, ensure_ascii=False, indent=2))
allpass = all(s[3] for s in steps)
print("\nGOLDEN_PATH_ALL_PASS:", allpass)
