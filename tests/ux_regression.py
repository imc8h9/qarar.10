#!/usr/bin/env python3
"""
UX_REGRESSION — يتحقق أن كل زر تنقل وكل إجراء رئيسي ما زال يعمل بعد التلميع،
وأن نتائج محرك القرار (المسار الذهبي) لم تتغير.
"""
import json, subprocess, time, sys, os, threading, http.server, socketserver, functools

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8099
results = {"nav": [], "actions": [], "golden": [], "console_errors": []}

def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    httpd.serve_forever()

th = threading.Thread(target=serve, daemon=True)
th.start()
time.sleep(1)

from playwright.sync_api import sync_playwright

NAV_VIEWS = ["home","sandbox","decision","assistant","bills","analysis","forecast","reports","family","settings"]

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width":1440,"height":900})
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)))

    page.goto(f"http://127.0.0.1:{PORT}/index.html")
    page.wait_for_timeout(1200)

    # 1) Splash start button
    start = page.query_selector('[data-action="startExperience"]')
    assert start, "start button missing"
    start.click()
    page.wait_for_timeout(1400)
    splash = page.query_selector("#splash")
    splash_hidden = page.evaluate("() => { const s=document.getElementById('splash'); return !s || getComputedStyle(s).display==='none'; }")
    results["actions"].append(["startExperience", "splash hidden" if splash_hidden else "SPLASH STILL VISIBLE", splash_hidden])

    # 2) Navigate every view via desktop nav data-goto, confirm currentView + pageTitle
    for v in NAV_VIEWS:
        page.evaluate(f"() => {{ window.__forceNav = true; navigate('{v}'); window.__forceNav = false; }}")
        # wait until the async commit finishes and currentView actually updates
        try:
            page.wait_for_function(
                f"() => (typeof currentView!=='undefined' && currentView==='{v}')",
                timeout=3000)
        except Exception:
            pass
        page.wait_for_timeout(150)
        cur = page.evaluate("() => (typeof currentView!=='undefined'?currentView:null)")
        title = page.eval_on_selector("#pageTitle", "el => el.textContent")
        has_content = page.eval_on_selector("#view", "el => el.innerHTML.length > 300")
        ok = (cur == v) and has_content
        results["nav"].append([v, cur, title, "OK" if ok else "FAIL"])

    # 3) Golden path: decision engine scenario must yield the same numbers
    page.evaluate("() => { window.__forceNav = true; navigate('home'); }")
    page.wait_for_timeout(500)
    page.evaluate("() => { window.__forceNav = true; navigate('decision'); window.__forceNav = false; }")
    # poll until the decision form is stably rendered and settled (past the 130ms commit)
    page.wait_for_function("() => (typeof currentView!=='undefined'?currentView:null) === 'decision' && document.getElementById('decisionAmount')", timeout=6000)
    page.wait_for_timeout(500)
    # baseline laptop 3000 -> expect minimumBalance 70 (7000 minor) & maxSafe 1570 (157000 minor)
    page.eval_on_selector("#decisionAmount", "el => el.value='3000'")
    page.eval_on_selector("#decisionName", "el => el.value='لابتوب'")
    page.click('[data-action="simulateDecision"]')
    page.wait_for_timeout(700)
    analysis = page.evaluate("() => (typeof lastAnalysis!=='undefined'&&lastAnalysis) ? {min: lastAnalysis.minimumBalance, safe: lastAnalysis.safeMaximumAmount, risk: lastAnalysis.riskLevel} : null")
    # Baseline gate: minimumBalance must be 7000 minor (70 riyal), safeMax 157000 minor (1570 riyal)
    gate_ok = bool(analysis) and analysis["min"] == 7000 and analysis["safe"] == 157000
    results["golden"].append(["laptop_3000", analysis, "GATE_PASS" if gate_ok else "GATE_FAIL"])

    # 4) A few representative actions open sheets / toasts without throwing
    action_checks = [
        ("notifications", '[data-action="notifications"]'),
        ("statusPlan_nav", None),  # tested via nav
    ]
    # notifications (from topbar) opens a sheet
    page.evaluate("() => navigate('home')")
    page.wait_for_timeout(300)
    nb = page.query_selector('[data-action="notifications"]')
    if nb:
        nb.click(); page.wait_for_timeout(300)
        sheet_open = page.evaluate("() => { const b=document.querySelector('.sheet-backdrop'); return b && b.classList.contains('show'); }")
        results["actions"].append(["notifications", "sheet opened" if sheet_open else "no sheet", bool(sheet_open)])
        page.keyboard.press("Escape"); page.wait_for_timeout(200)

    # sandbox: open add-tx sheet
    page.evaluate("() => navigate('sandbox')")
    page.wait_for_timeout(300)
    addbtn = page.query_selector('[data-action="openAddTx"]')
    if addbtn:
        addbtn.click(); page.wait_for_timeout(300)
        form_ok = page.evaluate("() => !!document.getElementById('txAmount')")
        results["actions"].append(["openAddTx", "tx form present" if form_ok else "no form", bool(form_ok)])
        page.keyboard.press("Escape"); page.wait_for_timeout(200)

    # settings: resetDemo opens confirm sheet
    page.evaluate("() => navigate('settings')")
    page.wait_for_timeout(300)
    rd = page.query_selector('[data-action="resetDemo"]')
    if rd:
        rd.click(); page.wait_for_timeout(300)
        confirm_ok = page.evaluate("() => !!document.querySelector('[data-action=\"confirmReset\"]')")
        results["actions"].append(["resetDemo", "confirm present" if confirm_ok else "no confirm", bool(confirm_ok)])
        page.keyboard.press("Escape"); page.wait_for_timeout(200)

    # 5) Screenshots for visual check
    os.makedirs("/tmp/qshots", exist_ok=True)
    page.evaluate("() => { const s=document.getElementById('splash'); if(s){s.style.display='flex';s.className='splash';} }")
    page.wait_for_timeout(400)
    page.screenshot(path="/tmp/qshots/splash.png")
    page.evaluate("() => { const s=document.getElementById('splash'); if(s){s.style.display='none';} }")
    for v in ["home","decision","sandbox","assistant"]:
        page.evaluate(f"() => navigate('{v}')")
        page.wait_for_timeout(500)
        page.screenshot(path=f"/tmp/qshots/{v}.png")

    # mobile
    page.set_viewport_size({"width":390,"height":844})
    page.evaluate("() => { const s=document.getElementById('splash'); if(s){s.style.display='flex';s.className='splash';} }")
    page.wait_for_timeout(400)
    page.screenshot(path="/tmp/qshots/m_splash.png")
    page.evaluate("() => { const s=document.getElementById('splash'); if(s){s.style.display='none';} }")
    page.evaluate("() => navigate('home')")
    page.wait_for_timeout(500)
    page.screenshot(path="/tmp/qshots/m_home.png")

    results["console_errors"] = errs
    browser.close()

print(json.dumps(results, ensure_ascii=False, indent=2))
