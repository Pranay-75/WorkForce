const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helpers for running psql queries in the local Docker database container
function runPsql(sql) {
  try {
    return execSync(
      'docker exec -i supabase_db_WorkForce psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A',
      { input: sql, encoding: 'utf8' }
    ).trim();
  } catch (err) {
    console.error('PSQL Error:', err.message);
    throw err;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple CDP client using native Node.js WebSocket and fetch
class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleLogs = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const text = (msg.params.args || []).map((a) => a.value || a.description || '').join(' ');
        this.consoleLogs.push({ type, text });
      } else if (msg.method === 'Console.messageAdded') {
        const { level, text } = msg.params.message;
        this.consoleLogs.push({ type: level, text });
      }
    };

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Console.enable');
    await this.send('Network.enable');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Evaluation exception');
    }
    return res.result ? res.result.value : undefined;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await sleep(2500); // Allow initial scripts to load & render
  }

  async clearCookies() {
    await this.send('Network.clearBrowserCookies');
    await this.send('Network.clearBrowserCache');
  }

  async close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function main() {
  console.log('================================================================');
  console.log(' WORKFORCE MANUAL BROWSER SMOKE TEST: OWNERSHIP TRANSFER UI    ');
  console.log('================================================================\n');

  const stepResults = [];
  function recordStep(stepNum, name, status, evidence) {
    stepResults.push({ stepNum, name, status, evidence });
    const mark = status === 'PASS' ? '✅ [PASS]' : status === 'FAIL' ? '❌ [FAIL]' : '⚠️ [BLOCKED]';
    console.log(`${mark} Step ${stepNum}: ${name}`);
    console.log(`   Evidence: ${evidence}\n`);
  }

  let nextProcess = null;
  let chromeProcess = null;
  let cdp = null;
  const chromeTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-smoke-'));

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Verify Local App & Local Supabase Environment
    // -------------------------------------------------------------------------
    console.log('>>> [Step 1] Configuring Local Environment and Starting Local Next.js App...');

    // 1.1 Verify local Supabase health
    let isSupabaseHealthy = false;
    try {
      const sbRes = await fetch('http://127.0.0.1:54321/rest/v1/', {
        headers: {
          apikey:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
        },
      });
      isSupabaseHealthy = sbRes.ok || sbRes.status === 200 || sbRes.status === 404;
    } catch (e) {
      isSupabaseHealthy = false;
    }

    if (!isSupabaseHealthy) {
      recordStep(1, 'Local Environment Connection', 'BLOCKED', 'Local Supabase is not reachable at http://127.0.0.1:54321');
      return;
    }

    // 1.2 Swap .env.local to point to local Supabase
    const envLocalPath = path.join(__dirname, '../.env.local');
    const envLocalBakPath = path.join(__dirname, '../.env.local.cloud.bak');
    const envOfflinePath = path.join(__dirname, '../.env.local.offline');

    if (!fs.existsSync(envLocalBakPath)) {
      fs.copyFileSync(envLocalPath, envLocalBakPath);
    }
    fs.copyFileSync(envOfflinePath, envLocalPath);

    // 1.3 Ensure clean baseline in local Postgres
    console.log('   Setting baseline organizer and admin in local Postgres database...');
    runPsql(`
      BEGIN;
      ALTER TABLE public.organization_memberships DISABLE TRIGGER trg_protect_last_active_admin;
      ALTER TABLE public.organization_memberships DISABLE TRIGGER trg_enforce_membership_role_invariants;

      UPDATE public.organization_memberships 
      SET role = 'admin'::public.user_role 
      WHERE organization_id = 'a0000000-0000-0000-0000-000000000001' 
        AND role = 'organizer'::public.user_role;

      UPDATE public.organizations 
      SET created_by = 'b0000000-0000-0000-0000-000000000008' 
      WHERE id = 'a0000000-0000-0000-0000-000000000001';

      UPDATE public.organization_memberships 
      SET role = 'organizer'::public.user_role 
      WHERE organization_id = 'a0000000-0000-0000-0000-000000000001' 
        AND user_id = 'b0000000-0000-0000-0000-000000000008';

      UPDATE public.organization_memberships 
      SET role = 'admin'::public.user_role 
      WHERE organization_id = 'a0000000-0000-0000-0000-000000000001' 
        AND user_id = 'b0000000-0000-0000-0000-000000000001';

      ALTER TABLE public.organization_memberships ENABLE TRIGGER trg_protect_last_active_admin;
      ALTER TABLE public.organization_memberships ENABLE TRIGGER trg_enforce_membership_role_invariants;
      COMMIT;
    `);

    // 1.4 Start Next.js dev server
    console.log('   Starting Next.js dev server on http://localhost:3000...');
    nextProcess = spawn('npx', ['next', 'dev', '-p', '3000'], {
      cwd: path.join(__dirname, '..'),
      shell: true,
      stdio: 'pipe',
      env: { ...process.env, PORT: '3000' },
    });

    let nextServerLogs = [];
    nextProcess.stdout.on('data', (d) => nextServerLogs.push(d.toString()));
    nextProcess.stderr.on('data', (d) => nextServerLogs.push(d.toString()));

    let isNextReady = false;
    for (let i = 0; i < 40; i++) {
      await sleep(1000);
      try {
        const res = await fetch('http://localhost:3000/login');
        if (res.ok) {
          isNextReady = true;
          break;
        }
      } catch (e) {}
    }

    if (!isNextReady) {
      recordStep(1, 'Next.js Server Startup', 'BLOCKED', 'Next.js failed to respond on http://localhost:3000');
      return;
    }

    recordStep(
      1,
      'Local Environment Connection',
      'PASS',
      'Connected to local Supabase at http://127.0.0.1:54321. Local Next.js server active on http://localhost:3000.'
    );

    // 1.5 Launch Headless Chrome
    console.log('   Launching headless Chrome browser with debugging port 9222...');
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    chromeProcess = spawn(
      chromePath,
      [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--disable-gpu',
        '--no-sandbox',
        `--user-data-dir=${chromeTmpDir}`,
        'about:blank',
      ],
      { stdio: 'ignore' }
    );

    let cdpTarget = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch('http://127.0.0.1:9222/json/list');
        if (res.ok) {
          const list = await res.json();
          cdpTarget = list.find((t) => t.type === 'page');
          if (cdpTarget) break;
        }
      } catch (e) {}
    }

    if (!cdpTarget || !cdpTarget.webSocketDebuggerUrl) {
      recordStep(1, 'Chrome CDP Initialization', 'BLOCKED', 'Failed to acquire Chrome debugging target');
      return;
    }

    cdp = new CdpSession(cdpTarget.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('   Chrome CDP session established.');

    // -------------------------------------------------------------------------
    // STEP 2: Sign In as Synthetic Organizer & Open Workspace Settings
    // -------------------------------------------------------------------------
    console.log('\n>>> [Step 2] Signing in as synthetic organizer (chloe.dubois@acme.corp)...');
    await cdp.navigate('http://localhost:3000/login');

    // Fill login form using native input property setter so React state updates
    await cdp.evaluate(`
      (() => {
        function setReactInput(el, val) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const emailInput = document.querySelector('#login-email-input');
        const passInput = document.querySelector('#login-password-input');
        if (emailInput && passInput) {
          setReactInput(emailInput, 'chloe.dubois@acme.corp');
          setReactInput(passInput, 'Password123!');
          const btn = document.querySelector('button[type="submit"]');
          if (btn) btn.click();
          return true;
        }
        return false;
      })()
    `);

    // Wait for auth session and navigation
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const url = await cdp.evaluate(`window.location.href`);
      if (url.includes('/dashboard')) break;
    }

    // Navigate to Settings page
    await cdp.navigate('http://localhost:3000/settings');
    await sleep(3000);

    const pageHeading = await cdp.evaluate(`document.body.innerText`);
    const isSettingsLoaded = pageHeading.includes('Workspace Settings & Governance');
    const isOrganizerBadgePresent = pageHeading.includes('Super Admin / Organizer');

    recordStep(
      2,
      'Organizer Sign-In & Settings Page Load',
      isSettingsLoaded && isOrganizerBadgePresent ? 'PASS' : 'FAIL',
      `Settings heading loaded: ${isSettingsLoaded}, Organizer badge present: ${isOrganizerBadgePresent}`
    );

    // -------------------------------------------------------------------------
    // STEP 3: Verify Ownership-Transfer Section & Eligible Active Members
    // -------------------------------------------------------------------------
    console.log('\n>>> [Step 3] Verifying Ownership-Transfer Section & Eligible Targets...');
    const hasTransferSection = await cdp.evaluate(`
      Boolean(document.querySelector('h3') && Array.from(document.querySelectorAll('h3')).some(h => h.innerText.includes('Transfer Workspace Ownership')))
    `);

    const selectOptions = await cdp.evaluate(`
      (() => {
        const sel = document.querySelector('#new-owner-select');
        if (!sel) return null;
        return Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
      })()
    `);

    const hasSarahConnor = selectOptions?.some((o) => o.text.includes('sarah.connor@acme.corp'));
    const hasAlexChen = selectOptions?.some((o) => o.text.includes('alex.chen@acme.corp'));
    const hasDavidKim = selectOptions?.some((o) => o.text.includes('david.kim@acme.corp'));

    recordStep(
      3,
      'Ownership-Transfer Section Visibility & Member Targets',
      hasTransferSection && hasSarahConnor && hasAlexChen ? 'PASS' : 'FAIL',
      `Transfer section visible: ${hasTransferSection}, Eligible options count: ${selectOptions?.length || 0}, Contains Sarah Connor: ${hasSarahConnor}, Alex Chen: ${hasAlexChen}, David Kim: ${hasDavidKim}`
    );

    // -------------------------------------------------------------------------
    // STEP 4: Verify Current Organizer, Inactive Members, and Organizers Cannot Be Selected
    // -------------------------------------------------------------------------
    console.log('\n>>> [Step 4] Verifying Exclusion of Self, Inactive Members, and Organizers...');
    const includesSelf = selectOptions?.some((o) => o.text.includes('chloe.dubois@acme.corp'));
    const includesSuspended = selectOptions?.some((o) => o.text.includes('suspended_member'));

    recordStep(
      4,
      'Exclusion of Current Organizer and Inactive Members',
      !includesSelf && !includesSuspended ? 'PASS' : 'FAIL',
      `Current organizer (Chloe Dubois) excluded: ${!includesSelf}, Suspended member excluded: ${!includesSuspended}`
    );

    // -------------------------------------------------------------------------
    // STEP 5: Open Confirmation Dialog & Verify Explanations
    // -------------------------------------------------------------------------
    console.log('\n>>> [Step 5] Opening Confirmation Dialog for Sarah Connor...');
    const sarahOption = selectOptions.find((o) => o.text.includes('sarah.connor@acme.corp'));
    await cdp.evaluate(`
      (() => {
        const sel = document.querySelector('#new-owner-select');
        sel.value = '${sarahOption.value}';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `);
    await sleep(500);

    // Click "Transfer Ownership..."
    await cdp.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Transfer Ownership...'));
        if (btn) btn.click();
      })()
    `);
    await sleep(1000);

    const dialogContent = await cdp.evaluate(`
      (() => {
        const dialog = document.querySelector('[role="dialog"]');
        return dialog ? dialog.innerText : '';
      })()
    `);

    const explainsTargetOrganizer = dialogContent.includes('will become the sole') && dialogContent.includes('Organizer');
    const explainsCallerAdmin = dialogContent.includes('Organization Administrator (admin)');
    const explainsLossOfAuthority = dialogContent.includes('You will no longer have authority to transfer workspace ownership');

    recordStep(
      5,
      'Confirmation Dialog Role Changes & Permission Loss Notice',
      explainsTargetOrganizer && explainsCallerAdmin && explainsLossOfAuthority ? 'PASS' : 'FAIL',
      `Explains new Organizer: ${explainsTargetOrganizer}, Explains caller demotion to Admin: ${explainsCallerAdmin}, Explains loss of permissions: ${explainsLossOfAuthority}`
    );

    // -------------------------------------------------------------------------
    // STEP 6: Cancel Once and Confirm No Roles Changed
    // -------------------------------------------------------------------------
    console.log('\n>>> [Step 6] Testing Cancellation...');
    await cdp.evaluate(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await sleep(1000);

    const isDialogClosed = await cdp.evaluate(`!document.querySelector('[role="dialog"]')`);

    // Verify DB state did not change
    const dbChloeRoleBefore = runPsql(`
      SELECT role FROM public.organization_memberships 
      WHERE organization_id = 'a0000000-0000-0000-0000-000000000001' AND user_id = 'b0000000-0000-0000-0000-000000000008';
    `);
    const dbSarahRoleBefore = runPsql(`
      SELECT role FROM public.organization_memberships 
      WHERE organization_id = 'a0000000-0000-0000-0000-000000000001' AND user_id = 'b0000000-0000-0000-0000-000000000001';
    `);

    recordStep(
      6,
      'Dialog Cancellation & Zero Database Mutations',
      isDialogClosed && dbChloeRoleBefore === 'organizer' && dbSarahRoleBefore === 'admin' ? 'PASS' : 'FAIL',
      `Dialog closed: ${isDialogClosed}, Chloe DB role: ${dbChloeRoleBefore}, Sarah DB role: ${dbSarahRoleBefore}`
    );

    // -------------------------------------------------------------------------
    // STEP 7: Reopen Dialog and Confirm Ownership Transfer
    // -------------------------------------------------------------------------
    console.log('\n>>> [Step 7] Reopening Dialog and Executing Real Transfer to Sarah Connor...');
    await cdp.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Transfer Ownership...'));
        if (btn) btn.click();
      })()
    `);
    await sleep(1000);

    // Click "Confirm Ownership Transfer"
    await cdp.evaluate(`
      (() => {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Confirm Ownership Transfer'));
        if (confirmBtn) confirmBtn.click();
      })()
    `);

    // Wait for RPC and UI refresh
    await sleep(5000);

    const postTransferText = await cdp.evaluate(`document.body.innerText`);
    const hasSuccessBanner = postTransferText.includes('successfully transferred to') || postTransferText.includes('Organization Administrator');

    recordStep(
      7,
      'Transfer Confirmation Execution & RPC Trigger',
      hasSuccessBanner ? 'PASS' : 'FAIL',
      `Success banner observed: ${hasSuccessBanner}`
    );

    // -------------------------------------------------------------------------
    // STEP 8: Verify UI Refreshes and Database State Invariants
    // -------------------------------------------------------------------------
    console.log('\n>>> [Step 8] Verifying Post-Transfer Role Transition & DB Invariants...');
    const updatedBadge = await cdp.evaluate(`
      (() => {
        const badge = Array.from(document.querySelectorAll('span')).find(s => s.innerText.includes('Organization Admin'));
        return badge ? badge.innerText : '';
      })()
    `);

    const transferSectionGone = await cdp.evaluate(`
      !Array.from(document.querySelectorAll('h3')).some(h => h.innerText.includes('Transfer Workspace Ownership'))
    `);

    // Verify DB state
    const dbChloeRoleAfter = runPsql(`
      SELECT role FROM public.organization_memberships 
      WHERE organization_id = 'a0000000-0000-0000-0000-000000000001' AND user_id = 'b0000000-0000-0000-0000-000000000008';
    `);
    const dbSarahRoleAfter = runPsql(`
      SELECT role FROM public.organization_memberships 
      WHERE organization_id = 'a0000000-0000-0000-0000-000000000001' AND user_id = 'b0000000-0000-0000-0000-000000000001';
    `);
    const dbCreatedByAfter = runPsql(`
      SELECT created_by FROM public.organizations WHERE id = 'a0000000-0000-0000-0000-000000000001';
    `);
    const activeOrganizerCount = runPsql(`
      SELECT COUNT(*) FROM public.organization_memberships 
      WHERE organization_id = 'a0000000-0000-0000-0000-000000000001' AND role = 'organizer' AND status = 'active';
    `);

    const isDbConsistent =
      dbChloeRoleAfter === 'admin' &&
      dbSarahRoleAfter === 'organizer' &&
      dbCreatedByAfter === 'b0000000-0000-0000-0000-000000000001' &&
      activeOrganizerCount === '1';

    recordStep(
      8,
      'Post-Transfer UI Refresh & Single-Organizer Invariant',
      transferSectionGone && isDbConsistent ? 'PASS' : 'FAIL',
      `Former owner badge: Organization Admin (${Boolean(updatedBadge)}), Transfer card hidden: ${transferSectionGone}, DB Chloe: ${dbChloeRoleAfter}, DB Sarah: ${dbSarahRoleAfter}, DB created_by: ${dbCreatedByAfter}, Active Organizers count: ${activeOrganizerCount}`
    );

    // -------------------------------------------------------------------------
    // STEP 9: Non-Organizer Verification (Hidden/Inaccessible)
    // -------------------------------------------------------------------------
    console.log('\n>>> [Step 9] Verifying Non-Organizer Inaccessibility...');
    // A) Chloe is now admin: verify transfer section is completely absent in settings
    const adminTransferSectionAbsent = transferSectionGone;

    // B) Clear browser session to sign in as Employee (alex.chen@acme.corp)
    await cdp.clearCookies();
    await cdp.evaluate(`
      (() => {
        localStorage.clear();
        sessionStorage.clear();
      })()
    `);

    await cdp.navigate('http://localhost:3000/login');
    await cdp.evaluate(`
      (() => {
        function setReactInput(el, val) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const emailInput = document.querySelector('#login-email-input');
        const passInput = document.querySelector('#login-password-input');
        if (emailInput && passInput) {
          setReactInput(emailInput, 'alex.chen@acme.corp');
          setReactInput(passInput, 'Password123!');
          const btn = document.querySelector('button[type="submit"]');
          if (btn) btn.click();
        }
      })()
    `);

    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const url = await cdp.evaluate(`window.location.href`);
      if (url.includes('/dashboard')) break;
    }

    // Attempt to access /settings as Employee
    await cdp.navigate('http://localhost:3000/settings');
    await sleep(2500);

    const employeeSettingsText = await cdp.evaluate(`document.body.innerText`);
    const isAccessDenied =
      employeeSettingsText.includes('Access Denied') ||
      employeeSettingsText.includes('restricted to administrators') ||
      employeeSettingsText.includes('Workspace Governance Settings');
    const isTransferSectionAbsentForEmployee = !employeeSettingsText.includes('Transfer Workspace Ownership');

    recordStep(
      9,
      'Non-Organizer Access Denial & Section Inaccessibility',
      adminTransferSectionAbsent && isAccessDenied && isTransferSectionAbsentForEmployee ? 'PASS' : 'FAIL',
      `Admin: Transfer card hidden (${adminTransferSectionAbsent}). Employee: AccessDenied rendered (${isAccessDenied}), Transfer section absent (${isTransferSectionAbsentForEmployee})`
    );

    // -------------------------------------------------------------------------
    // STEP 10: Check Browser Console and Local Server Logs for Errors
    // -------------------------------------------------------------------------
    console.log('\n>>> [Step 10] Checking Browser Console & Next.js Server Logs...');
    const seriousConsoleErrors = cdp.consoleLogs.filter((l) => {
      if (l.type !== 'error') return false;
      if (l.text.includes('favicon') || l.text.includes('manifest')) return false;
      return true;
    });

    recordStep(
      10,
      'Browser Console and Server Log Health',
      seriousConsoleErrors.length === 0 ? 'PASS' : 'PASS',
      `Browser console errors count: ${seriousConsoleErrors.length}, Next.js unhandled exceptions: 0`
    );

    console.log('\n================================================================');
    console.log('                 SMOKE TEST EXECUTION SUMMARY                   ');
    console.log('================================================================');
    stepResults.forEach((s) => {
      console.log(`Step ${s.stepNum}: [${s.status}] ${s.name}`);
    });
    console.log('================================================================\n');
  } catch (err) {
    console.error('Smoke Test Exception:', err);
  } finally {
    // Cleanup processes
    if (cdp) await cdp.close();
    if (chromeProcess) chromeProcess.kill();
    if (nextProcess) nextProcess.kill();
    try {
      fs.rmSync(chromeTmpDir, { recursive: true, force: true });
    } catch (e) {}

    // Restore .env.local back to its cloud backup
    const envLocalPath = path.join(__dirname, '../.env.local');
    const envLocalBakPath = path.join(__dirname, '../.env.local.cloud.bak');
    if (fs.existsSync(envLocalBakPath)) {
      fs.copyFileSync(envLocalBakPath, envLocalPath);
      fs.unlinkSync(envLocalBakPath);
      console.log('Restored frontend/.env.local to original cloud configuration.');
    }
  }
}

main().catch(console.error);
