const SUPABASE_URL = 'https://qksgqkmctjzmzhzmrbhj.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Hx1bN74JlwOKBW6wv0wRgQ_fkP9N-b5'; 
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


    let currentUser = null;
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let globalUserRole = '';
    let globalUserName = '';
    let globalRoleName = '';

    const TOAST_ICONS = {
        success: 'fa-circle-check',
        error: 'fa-circle-exclamation',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };
    const TOAST_DURATIONS = { success: 4000, info: 4500, warning: 6000, error: 8000 };

    function getToastRoot() {
        let root = document.getElementById('toast-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'toast-root';
            root.setAttribute('aria-live', 'polite');
            document.body.appendChild(root);
        }
        return root;
    }

    function showToast(message, type, options) {
        const text = String(message === undefined || message === null ? '' : message).trim();
        if (!text) return null;
        const kind = TOAST_ICONS[type] ? type : 'info';
        const opts = options || {};
        const root = getToastRoot();

        const duplicate = Array.from(root.children).find(el => el.dataset.msg === text && el.dataset.type === kind);
        if (duplicate) {
            duplicate.classList.remove('toast-pulse');
            void duplicate.offsetWidth;
            duplicate.classList.add('toast-pulse');
            return duplicate;
        }

        const el = document.createElement('div');
        el.className = `toast toast-${kind}`;
        el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        el.dataset.msg = text;
        el.dataset.type = kind;
        el.innerHTML = `
            <i class="fa-solid ${TOAST_ICONS[kind]} toast-icon"></i>
            <div class="toast-body"></div>
            <button type="button" class="toast-close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>`;
        el.querySelector('.toast-body').textContent = text;

        let timer = null;
        const dismiss = () => {
            clearTimeout(timer);
            el.classList.add('toast-out');
            setTimeout(() => el.remove(), 200);
        };
        el.querySelector('.toast-close').addEventListener('click', dismiss);
        el.addEventListener('mouseenter', () => clearTimeout(timer));
        el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 2000); });

        root.appendChild(el);
        while (root.children.length > 5) root.firstElementChild.remove();

        timer = setTimeout(dismiss, opts.duration || TOAST_DURATIONS[kind]);
        return el;
    }

    function trapDialogFocus(container, e) {
        const items = Array.from(container.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])'))
            .filter(el => !el.disabled);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    function buildDialog(opts) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay dialog-overlay';
        const icon = opts.danger ? 'fa-triangle-exclamation' : (opts.withInput ? 'fa-pen' : 'fa-circle-question');
        overlay.innerHTML = `
            <div class="dialog-card" role="${opts.withInput ? 'dialog' : 'alertdialog'}" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg">
                <div class="dialog-icon${opts.danger ? ' danger' : ''}"><i class="fa-solid ${icon}"></i></div>
                <h3 id="dlg-title"></h3>
                <p id="dlg-msg"></p>
                ${opts.withInput ? `
                    <label class="dialog-label" for="dlg-input"></label>
                    ${opts.multiline ? '<textarea id="dlg-input" rows="3"></textarea>' : '<input id="dlg-input" type="text">'}` : ''}
                <div class="dialog-actions">
                    <button type="button" class="dialog-btn" data-dlg="cancel"></button>
                    <button type="button" class="dialog-btn dialog-btn-primary${opts.danger ? ' danger' : ''}" data-dlg="ok"></button>
                </div>
            </div>`;
        overlay.querySelector('#dlg-title').textContent = opts.title;
        overlay.querySelector('#dlg-msg').textContent = opts.message;
        if (!opts.message) overlay.querySelector('#dlg-msg').style.display = 'none';
        overlay.querySelector('[data-dlg="cancel"]').textContent = opts.cancelLabel;
        overlay.querySelector('[data-dlg="ok"]').textContent = opts.confirmLabel;
        if (opts.withInput) {
            overlay.querySelector('.dialog-label').textContent = opts.label || '';
            overlay.querySelector('#dlg-input').placeholder = opts.placeholder || '';
        }
        return overlay;
    }

    function runDialog(opts, readValue) {
        return new Promise((resolve) => {
            const previous = document.activeElement;
            const overlay = buildDialog(opts);
            document.body.appendChild(overlay);
            const okBtn = overlay.querySelector('[data-dlg="ok"]');
            const cancelBtn = overlay.querySelector('[data-dlg="cancel"]');
            const input = overlay.querySelector('#dlg-input');

            const finish = (confirmed) => {
                document.removeEventListener('keydown', onKey, true);
                const value = readValue(confirmed, input);
                overlay.remove();
                if (previous && typeof previous.focus === 'function') previous.focus();
                resolve(value);
            };
            const onKey = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    finish(false);
                } else if (e.key === 'Tab') {
                    trapDialogFocus(overlay, e);
                } else if (e.key === 'Enter' && input && input.tagName === 'INPUT') {
                    e.preventDefault();
                    finish(true);
                }
            };
            document.addEventListener('keydown', onKey, true);
            okBtn.addEventListener('click', () => finish(true));
            cancelBtn.addEventListener('click', () => finish(false));
            overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) finish(false); });

            if (input) input.focus();
            else (opts.danger ? cancelBtn : okBtn).focus();
        });
    }

    function confirmDialog(options) {
        const opts = typeof options === 'string' ? { message: options } : (options || {});
        return runDialog({
            title: opts.title || 'Please confirm',
            message: opts.message || '',
            confirmLabel: opts.confirmLabel || 'Confirm',
            cancelLabel: opts.cancelLabel || 'Cancel',
            danger: !!opts.danger,
            withInput: false
        }, (confirmed) => confirmed);
    }

    function promptDialog(options) {
        const opts = options || {};
        return runDialog({
            title: opts.title || 'Enter a value',
            message: opts.message || '',
            label: opts.label || '',
            placeholder: opts.placeholder || '',
            confirmLabel: opts.confirmLabel || 'OK',
            cancelLabel: opts.cancelLabel || 'Cancel',
            danger: !!opts.danger,
            multiline: !!opts.multiline,
            withInput: true
        }, (confirmed, input) => (confirmed ? input.value : null));
    }

    function skeletonRows(count) {
        const row = `
            <div class="skeleton-row">
                <div class="skeleton skeleton-avatar"></div>
                <div class="skeleton-lines">
                    <div class="skeleton skeleton-line" style="width:55%;"></div>
                    <div class="skeleton skeleton-line" style="width:35%;"></div>
                </div>
            </div>`;
        return `<div class="skeleton-group" aria-hidden="true">${row.repeat(count || 3)}</div><span class="sr-only">Loading...</span>`;
    }

    function skeletonCards(count) {
        const card = `
            <div class="skeleton-card-row">
                <div class="skeleton skeleton-line" style="width:40%; height:16px;"></div>
                <div class="skeleton skeleton-line" style="width:70%;"></div>
                <div class="skeleton skeleton-line" style="width:50%;"></div>
            </div>`;
        return `<div class="skeleton-group" aria-hidden="true">${card.repeat(count || 3)}</div><span class="sr-only">Loading...</span>`;
    }

    function skeletonGrid(count) {
        const card = `
            <div class="skeleton-doc" aria-hidden="true">
                <div class="skeleton-row" style="padding:0; margin-bottom:18px;">
                    <div class="skeleton skeleton-avatar" style="border-radius:8px;"></div>
                    <div class="skeleton-lines">
                        <div class="skeleton skeleton-line" style="width:65%;"></div>
                        <div class="skeleton skeleton-line" style="width:30%;"></div>
                    </div>
                </div>
                <div class="skeleton skeleton-line" style="width:80%;"></div>
                <div class="skeleton skeleton-line" style="width:60%;"></div>
                <div class="skeleton skeleton-line" style="width:100%; height:34px; margin-top:16px;"></div>
            </div>`;
        return card.repeat(count || 4);
    }

    function showSkeletonIfEmpty(el, html) {
        if (el && el.children.length === 0) el.innerHTML = html;
    }

    function errorStateHtml(message, retryFn, icon) {
        const canRetry = typeof retryFn === 'string' && /^[A-Za-z_$][\w$]*$/.test(retryFn);
        return `
            <div class="state-error" role="alert">
                <i class="fa-solid ${escapeHtml(icon || 'fa-circle-exclamation')}"></i>
                <p>${escapeHtml(message)}</p>
                ${canRetry ? `<button type="button" class="state-retry" onclick="retryRender(this, '${retryFn}')"><i class="fa-solid fa-rotate-right"></i> Try again</button>` : ''}
            </div>`;
    }

    window.retryRender = function(btn, fnName) {
        const fn = window[fnName];
        if (typeof fn !== 'function') {
            window.location.reload();
            return;
        }
        const state = btn && btn.closest ? btn.closest('.state-error') : null;
        if (state && state.parentElement) state.parentElement.innerHTML = skeletonRows(3);
        fn();
    };

    function setupResponsiveShell() {
        const menuBtn = document.getElementById('mobile-menu-btn');
        const backdrop = document.getElementById('sidebar-backdrop');
        const close = () => {
            document.body.classList.remove('sidebar-open');
            if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
        };

        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                const open = document.body.classList.toggle('sidebar-open');
                menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        }
        if (backdrop) backdrop.addEventListener('click', close);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        window.addEventListener('resize', () => { if (window.innerWidth > 900) close(); });
        document.querySelectorAll('.sidebar .nav-links li, .sidebar .sidebar-footer').forEach(el => el.addEventListener('click', close));
    }

    function setupGlobalErrorHandling() {
        let lastReport = 0;
        const report = () => {
            const now = Date.now();
            if (now - lastReport < 5000) return;
            lastReport = now;
            showToast('Something went wrong. Please try again.', 'error');
        };

        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            report();
        });
        window.addEventListener('error', (e) => {
            if (!e.message || /ResizeObserver|^Script error/i.test(e.message)) return;
            console.error('Uncaught error:', e.error || e.message);
            report();
        });
        window.addEventListener('offline', () => showToast('You are offline. Changes cannot be saved until you reconnect.', 'warning', { duration: 8000 }));
        window.addEventListener('online', () => showToast('You are back online.', 'success'));
    }

    setupResponsiveShell();
    setupGlobalErrorHandling();

    function roleLabel(name) {
        const n = (name || '').toLowerCase();
        if (n === 'admin' || n === 'administrator') return 'Administrator';
        if (n === 'secretary') return 'Secretary';
        return 'Lawyer';
    }

    const CASE_TYPES = ['Civil', 'Criminal', 'Labor', 'Administrative'];
    const CASE_STAGES = ['For Filing', 'Filed', 'Pre-Trial', 'Mediation/JDR', 'Trial - Plaintiff', 'Trial - Prosecution', 'Trial - Defense', 'Demurrer', 'For Decision', 'Appeal'];
    const PARTY_TYPES = ['Plaintiff', 'Defendant', 'Petitioner', 'Respondent', 'Complainant', 'Accused'];

    function fillSelect(el, values, placeholder) {
        if (!el) return;
        el.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') +
            values.map(v => `<option value="${v}">${v}</option>`).join('');
    }

    function casesSelect(base, onlyMine) {
        const embed = (onlyMine ? 'case_lawyers!inner' : 'case_lawyers') + '(lawyer_id, is_lead, profiles(full_name))';
        return base ? `${base}, ${embed}` : embed;
    }
    function filterMyCases(query) {
        return query.eq('case_lawyers.lawyer_id', currentUser.id);
    }
    function getLeadLawyer(c) {
        const rows = (c && c.case_lawyers) || [];
        return rows.find(r => r.is_lead) || rows[0] || null;
    }
    function getLeadLawyerId(c) {
        const l = getLeadLawyer(c);
        return l ? l.lawyer_id : null;
    }
    function getLeadLawyerName(c) {
        const l = getLeadLawyer(c);
        return (l && l.profiles && l.profiles.full_name) || '';
    }
    function getCaseLawyerNames(c) {
        return ((c && c.case_lawyers) || [])
            .slice()
            .sort((a, b) => (b.is_lead ? 1 : 0) - (a.is_lead ? 1 : 0))
            .map(r => r.profiles && r.profiles.full_name)
            .filter(Boolean);
    }
    function caseHasLawyer(c, lawyerId) {
        return ((c && c.case_lawyers) || []).some(r => r.lawyer_id === lawyerId);
    }
    async function createCase({ title, caseType, description, clientId, dateFiled, leadLawyerId, courtBranch, courtCaseNo, jurisdiction, caseStage, partyType }) {
        const { data, error } = await supabaseClient.rpc('create_case', {
            p_title: title,
            p_case_type: caseType || null,
            p_description: description || null,
            p_client_id: clientId ? Number(clientId) : null,
            p_date_filed: dateFiled || null,
            p_lead_lawyer: leadLawyerId || null,
            p_court_branch: courtBranch || null,
            p_court_case_no: courtCaseNo || null,
            p_jurisdiction: jurisdiction || null,
            p_case_stage: caseStage || null,
            p_party_type: partyType || null
        });
const row = Array.isArray(data) ? data[0] : data;
        
        if (!error && row) {
            await logAuditActivity('INSERT', 'Cases', `Added new case: ${title}`, row.id);
        }
        
        return { data: row || null, error };
    }

    const monthNames = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];

    const IDLE_LIMIT_MS = 30 * 60 * 1000;

    const IDLE_KEY = 'jurisync-last-activity';

    function readLastActivity() {
        try { return Number(localStorage.getItem(IDLE_KEY)) || 0; } catch (e) { return 0; }
    }

    function idleExpired() {
        const last = readLastActivity();
        return last > 0 && Date.now() - last > IDLE_LIMIT_MS;
    }

    async function signOutForInactivity() {
        await supabaseClient.auth.signOut();
        try { localStorage.setItem('jurisync-login-notice', 'You were signed out after 30 minutes of inactivity.'); } catch (e) {}
        window.location.href = 'login.html';
    }

    function setupIdleTimeout() {
        let lastWrite = 0;
        const touch = () => {
            const now = Date.now();
            if (now - lastWrite < 15000) return;
            lastWrite = now;
            try { localStorage.setItem(IDLE_KEY, String(now)); } catch (e) {}
        };
        ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => window.addEventListener(evt, touch, { passive: true }));
        touch();

        const check = () => { if (idleExpired()) signOutForInactivity(); };
        setInterval(check, 30000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    }

    const MFA_REQUIRED_ROLES = ['admin'];

    function showMfaOverlay(innerHtml) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '10001';
        overlay.style.background = '#0f172a';
        overlay.innerHTML = `<div style="width: 90%; max-width: 420px; padding: 25px 30px; background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); max-height: 92vh; overflow-y: auto;">${innerHtml}</div>`;
        document.body.appendChild(overlay);
        return overlay;
    }

    const MFA_CODE_INPUT = 'width:100%; box-sizing:border-box; padding:12px; border:1px solid #cbd5e1; border-radius:6px; font-family:inherit; font-size:20px; letter-spacing:6px; text-align:center; margin-bottom:10px;';
    const MFA_PRIMARY_BTN = 'width:100%; padding:12px; background:#0f172a; color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer;';
    const MFA_SECONDARY_BTN = 'width:100%; margin-top:10px; padding:10px; background:white; border:1px solid #e2e8f0; border-radius:6px; font-weight:600; cursor:pointer; color:#475569;';

    async function promptMfaEnroll() {
        try {
            const { data: existing } = await supabaseClient.auth.mfa.listFactors();
            for (const f of ((existing && existing.all) || [])) {
                if (f.status === 'unverified') await supabaseClient.auth.mfa.unenroll({ factorId: f.id });
            }
        } catch (e) {}

        const { data, error } = await supabaseClient.auth.mfa.enroll({
            factorType: 'totp',
            friendlyName: 'JuriSync-' + Date.now()
        });
        if (error) throw error;

        return new Promise((resolve) => {
            const overlay = showMfaOverlay(`
                <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 6px 0;">Set up two-factor authentication</h2>
                <p style="color: #64748b; font-size: 13px; margin: 0 0 16px 0;">Administrator accounts require an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password).</p>
                <ol style="color:#334155; font-size:13px; margin:0 0 14px 18px; line-height:1.6;">
                    <li>Scan this QR code with your authenticator app.</li>
                    <li>Enter the 6-digit code the app shows.</li>
                </ol>
                <div style="text-align:center; margin-bottom:10px;"><img id="mfa-qr" alt="Authenticator QR code" style="width:180px; height:180px;"></div>
                <p style="font-size:11px; color:#64748b; margin:0 0 4px 0; text-align:center;">Can't scan? Enter this key manually:</p>
                <p id="mfa-secret" style="font-size:12px; font-family:monospace; word-break:break-all; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px; margin:0 0 16px 0; text-align:center; user-select:all;"></p>
                <form id="mfa-form" autocomplete="off">
                    <input type="text" id="mfa-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" style="${MFA_CODE_INPUT}">
                    <div id="mfa-error" style="color:#ef4444; font-size:12px; min-height:16px; margin-bottom:10px;"></div>
                    <button type="submit" id="mfa-submit" style="${MFA_PRIMARY_BTN}">Verify and enable</button>
                </form>
                <button type="button" id="mfa-logout" style="${MFA_SECONDARY_BTN}">Log out</button>
            `);
            overlay.querySelector('#mfa-qr').src = data.totp.qr_code;
            overlay.querySelector('#mfa-secret').textContent = data.totp.secret;

            const errEl = overlay.querySelector('#mfa-error');
            const submitBtn = overlay.querySelector('#mfa-submit');

            overlay.querySelector('#mfa-logout').addEventListener('click', async () => {
                await supabaseClient.auth.signOut();
                window.location.href = 'login.html';
            });

            overlay.querySelector('#mfa-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const code = overlay.querySelector('#mfa-code').value.replace(/\s+/g, '');
                if (!/^\d{6}$/.test(code)) {
                    errEl.textContent = 'Enter the 6-digit code from your app.';
                    return;
                }
                submitBtn.disabled = true;
                submitBtn.textContent = 'Verifying...';
                const { error: verifyError } = await supabaseClient.auth.mfa.challengeAndVerify({ factorId: data.id, code: code });
                if (verifyError) {
                    errEl.textContent = verifyError.message;
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Verify and enable';
                    return;
                }
                overlay.remove();
                resolve();
            });
        });
    }

    async function promptMfaVerify() {
        const { data: factors, error } = await supabaseClient.auth.mfa.listFactors();
        if (error) throw error;
        const factor = ((factors && factors.totp) || [])[0];
        if (!factor) return promptMfaEnroll();

        return new Promise((resolve) => {
            const overlay = showMfaOverlay(`
                <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 6px 0;">Two-factor verification</h2>
                <p style="color: #64748b; font-size: 13px; margin: 0 0 18px 0;">Enter the 6-digit code from your authenticator app to continue.</p>
                <form id="mfa-form" autocomplete="off">
                    <input type="text" id="mfa-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" style="${MFA_CODE_INPUT}">
                    <div id="mfa-error" style="color:#ef4444; font-size:12px; min-height:16px; margin-bottom:10px;"></div>
                    <button type="submit" id="mfa-submit" style="${MFA_PRIMARY_BTN}">Verify</button>
                </form>
                <button type="button" id="mfa-logout" style="${MFA_SECONDARY_BTN}">Log out</button>
            `);

            const input = overlay.querySelector('#mfa-code');
            const errEl = overlay.querySelector('#mfa-error');
            const submitBtn = overlay.querySelector('#mfa-submit');
            input.focus();

            overlay.querySelector('#mfa-logout').addEventListener('click', async () => {
                await supabaseClient.auth.signOut();
                window.location.href = 'login.html';
            });

            overlay.querySelector('#mfa-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const code = input.value.replace(/\s+/g, '');
                if (!/^\d{6}$/.test(code)) {
                    errEl.textContent = 'Enter the 6-digit code from your app.';
                    return;
                }
                submitBtn.disabled = true;
                submitBtn.textContent = 'Verifying...';
                const { error: verifyError } = await supabaseClient.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code });
                if (verifyError) {
                    errEl.textContent = verifyError.message;
                    input.value = '';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Verify';
                    return;
                }
                overlay.remove();
                resolve();
            });
        });
    }

    async function enforceMfaIfRequired() {
        const { data: roleName, error: roleError } = await supabaseClient.rpc('my_role_raw');
        if (roleError || !MFA_REQUIRED_ROLES.includes(roleName)) return;

        const { data: aal, error } = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
        if (error || !aal || aal.currentLevel === 'aal2') return;

        if (aal.nextLevel === 'aal2') {
            await promptMfaVerify();
        } else {
            await promptMfaEnroll();
        }
    }

    function promptForcedPasswordChange() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.zIndex = '10000';
            overlay.innerHTML = `
                <div style="width: 90%; max-width: 420px; padding: 25px 30px; background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                    <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 6px 0;">Set a new password</h2>
                    <p style="color: #64748b; font-size: 13px; margin: 0 0 18px 0;">Your account was created with a temporary password. Choose your own to continue.</p>
                    <form id="force-pw-form" autocomplete="off">
                        <label style="display:block; font-size:13px; font-weight:600; color:#0f172a; margin-bottom:6px;">New password</label>
                        <input type="password" id="force-pw-1" autocomplete="new-password" placeholder="Min. 8 characters, with a letter and a number" style="width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:14px; font-family:inherit;">
                        <label style="display:block; font-size:13px; font-weight:600; color:#0f172a; margin-bottom:6px;">Confirm password</label>
                        <input type="password" id="force-pw-2" autocomplete="new-password" style="width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:10px; font-family:inherit;">
                        <div id="force-pw-error" style="color:#ef4444; font-size:12px; min-height:16px; margin-bottom:10px;"></div>
                        <button type="submit" id="force-pw-submit" style="width:100%; padding:12px; background:#0f172a; color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Save password</button>
                    </form>
                    <button type="button" id="force-pw-logout" style="width:100%; margin-top:10px; padding:10px; background:white; border:1px solid #e2e8f0; border-radius:6px; font-weight:600; cursor:pointer; color:#475569;">Log out</button>
                </div>`;
            document.body.appendChild(overlay);

            const errEl = overlay.querySelector('#force-pw-error');
            const submitBtn = overlay.querySelector('#force-pw-submit');

            overlay.querySelector('#force-pw-logout').addEventListener('click', async () => {
                await supabaseClient.auth.signOut();
                window.location.href = 'login.html';
            });

            overlay.querySelector('#force-pw-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const pw1 = overlay.querySelector('#force-pw-1').value;
                const pw2 = overlay.querySelector('#force-pw-2').value;

                if (pw1.length < 8 || !/[A-Za-z]/.test(pw1) || !/\d/.test(pw1)) {
                    errEl.textContent = 'Use at least 8 characters, including a letter and a number.';
                    return;
                }
                if (pw1 !== pw2) {
                    errEl.textContent = 'The two passwords do not match.';
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
                const { error } = await supabaseClient.auth.updateUser({
                    password: pw1,
                    data: { must_change_password: false }
                });
                if (error) {
                    errEl.textContent = error.message;
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Save password';
                    return;
                }
                overlay.remove();
                resolve();
            });
        });
    }

    async function checkAuthAndInit() {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            
            if (error || !session) {
                window.location.href = 'login.html';
                return;
            }

            if (idleExpired()) {
                await signOutForInactivity();
                return;
            }

            currentUser = session.user;

            await enforceMfaIfRequired();

            if (currentUser.user_metadata && currentUser.user_metadata.must_change_password) {
                await promptForcedPasswordChange();
                const { data: refreshed } = await supabaseClient.auth.getUser();
                if (refreshed && refreshed.user) currentUser = refreshed.user;
            }

            setupIdleTimeout();

            await updateSidebarUserInfo();
            await initializeApp();
            document.body.classList.remove('app-loading');
            
            supabaseClient.auth.onAuthStateChange((event) => {
                if (event === 'SIGNED_OUT') {
                    window.location.href = 'login.html';
                }
            });

        } catch (err) {
            console.error('System Initialization error:', err);
            document.body.classList.remove('app-loading');
            showToast('The app could not finish loading. Please refresh the page.', 'error', { duration: 12000 });
        }
    }

    async function updateSidebarUserInfo() {
        if (!currentUser) return false;

        try {
            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('*, roles(name)')
                .eq('id', currentUser.id)
                .single();

            if (error) {
                console.error("Profile fetch error:", error.message);
                return false;
            }

            if (profile) {
                globalUserName = profile.full_name || 'User';
                globalRoleName = ((profile.roles && profile.roles.name) || 'lawyer').toLowerCase();
                globalUserRole = (globalRoleName === 'lawyer') ? 'lawyer' : 'administrator';

                const avatarSmall = document.querySelector('.avatar-small');
                if (avatarSmall) {
                    if (profile.avatar_url) {
                        avatarSmall.innerHTML = `<img src="${escapeHtml(profile.avatar_url)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%; display:block;">`;
                    } else {
                        avatarSmall.innerHTML = '';
                        avatarSmall.textContent = getInitials(globalUserName);
                    }
                }

                const userName = document.querySelector('.user-name');
                if (userName) userName.textContent = `Atty. ${globalUserName}`;

                const userRole = document.querySelector('.user-role');
                if (userRole) userRole.textContent = roleLabel(globalRoleName);

                const isLawyer = globalUserRole === 'lawyer';

                const lawyersCountEl = document.getElementById('stat-lawyers-val');
                if (lawyersCountEl) {
                    const lawyersCard = lawyersCountEl.closest('.stat-card') || lawyersCountEl.parentElement.parentElement;
                    const statsGrid = document.querySelector('.stats-grid');
                    
                    if (lawyersCard) {
                        lawyersCard.style.display = isLawyer ? 'none' : 'flex';
                        if (statsGrid) {
                            statsGrid.style.gridTemplateColumns = isLawyer ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)';
                        }
                    }
                }

                document.querySelectorAll('.calendar-sidebar-widgets .widget-card').forEach(card => {
                    const heading = card.querySelector('h4');
                    if (heading && heading.textContent.toLowerCase().includes('lawyers')) {
                        card.style.display = isLawyer ? 'none' : 'block';
                    }
                });

                const manageLawyersNav = document.getElementById('nav-manage-lawyers');
                if (manageLawyersNav) manageLawyersNav.style.display = isLawyer ? 'none' : 'flex';

                const manageClientsNav = document.getElementById('nav-manage-clients');
                if (manageClientsNav) manageClientsNav.style.display = (globalUserRole === 'administrator') ? 'flex' : 'none';

                const isAdminRole = globalRoleName === 'admin';
                const addLawyerBtnEl = document.getElementById('btn-open-add-lawyer-modal');
                if (addLawyerBtnEl) addLawyerBtnEl.style.display = isAdminRole ? '' : 'none';
                const archivedTabBtnEl = document.querySelector('[data-managetab="manage-archived-lawyers"]');
                if (archivedTabBtnEl) archivedTabBtnEl.style.display = isAdminRole ? '' : 'none';
                const secretariesTabBtnEl = document.querySelector('[data-managetab="manage-secretaries"]');
                if (secretariesTabBtnEl) secretariesTabBtnEl.style.display = isAdminRole ? '' : 'none';

                const isStaffRole = globalRoleName === 'admin' || globalRoleName === 'secretary';
                const navAudits = document.getElementById('nav-audits');
                if (navAudits) navAudits.style.display = isStaffRole ? 'flex' : 'none';
                const addClientBtnEl = document.getElementById('btn-add-client');
                if (addClientBtnEl) addClientBtnEl.style.display = isStaffRole ? '' : 'none';
                const clientsFilterEl = document.getElementById('clients-status-filter');
                if (clientsFilterEl) clientsFilterEl.style.display = isStaffRole ? '' : 'none';
                const portalWrapEl = document.getElementById('mc-portal-wrap');
                if (portalWrapEl) portalWrapEl.style.display = isAdminRole ? '' : 'none';
                const approvalNoteEl = document.getElementById('mc-approval-note');
                if (approvalNoteEl) approvalNoteEl.textContent = isAdminRole
                    ? 'Clients you add are approved right away.'
                    : 'The client is saved as pending until an administrator approves it.';
                const newCaseBtnEl = document.getElementById('btn-new-case');
                if (newCaseBtnEl) newCaseBtnEl.style.display = (isAdminRole || globalRoleName === 'lawyer') ? '' : 'none';

                const lawyersStatCard = document.getElementById('stat-card-lawyers');
                if (lawyersStatCard) lawyersStatCard.style.display = isLawyer ? 'none' : 'flex';

            const uploadDocBtn = document.getElementById('btn-upload-doc');
            if (uploadDocBtn) uploadDocBtn.style.display = 'flex';

            const addEventBtn = document.getElementById('btn-add-event-header');
            if (addEventBtn) addEventBtn.style.display = 'flex';

            const deadlinesCard = document.getElementById('dashboard-deadlines-card');
            if (deadlinesCard) {
                deadlinesCard.style.display = (globalUserRole === 'administrator') ? 'none' : 'block';
            }
            
            const deadlinesStatCard = document.getElementById('stat-card-deadlines');
            if (deadlinesStatCard) {
                deadlinesStatCard.style.display = (globalUserRole === 'administrator') ? 'none' : 'flex';
            }

            const myCasesTabBtn = document.getElementById('sched-tab-btn-cases');
            const myCasesPane = document.getElementById('sched-cases');
            if (myCasesTabBtn) {
                myCasesTabBtn.style.display = (globalUserRole === 'administrator') ? 'none' : 'inline-block';
            }
            if (globalUserRole === 'administrator' && myCasesPane) {
                myCasesPane.classList.add('hidden');
            }

            return true;
            }
            return false;
        } catch (error) {
            console.error('Error in updateSidebarUserInfo:', error);
            return false;
        }
    }

    function getInitials(name) {
        if (!name) return 'U';
        return name
            .trim()
            .split(/\s+/)
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    function setupRealtimeSubscriptions() {
        supabaseClient.channel('public-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
                generateCalendarGrid();
                renderDashboardContent();
                updateDashboardStats();
                renderScheduleSummaryWidget();
                renderLawyerStatusWidget();
                renderTimelineInSchedule();
                renderNotificationsList();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
                renderDocumentList();
                renderRecentDocumentsInSchedule();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, () => {
                renderMyCasesTab();
                updateDashboardStats();
                renderPerformanceTab();
                renderAdminAttention();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
                renderAdminAttention();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                renderManageLawyersList();
                renderLawyerStatusWidget();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, () => {
                renderNotificationsList();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, () => {
                renderEmailQueueList();
            })
            .subscribe();
    }

    async function initializeApp() {
        setupRealtimeSubscriptions();
        await updateDashboardStats();
        await renderDashboardContent();
        setupDashboardButtons();
        
        generateCalendarGrid();
        setupCalendarControls();
        
        prepareEventModal();
        setupAddEventModal();
        setupUploadModal(); 
        setupDocumentFilters();
        setupDayDetailsModal(); 
        setupStatDetailsModal(); 
        
        setupAddLawyerModal(); 
        setupEditLawyerModal();
        setupArchiveLawyerModal(); 
        setupMyProfileModal();
        setupManageClients();
        setupCasesTabControls();
        disableBrowserAutofill();
        setupCaseDetailModal();
        await renderManageLawyersList(); 

        await renderResourcesWidget();
        setupRoomBookingModal();
        await renderScheduleSummaryWidget();
        await renderLawyerStatusWidget(); 
        
        setupScheduleTabs();
        setupScheduleButtons();
        await renderMyScheduleContent();
        
        setupNotificationTabs();
        await renderNotificationsList();
        await renderEmailQueueList();
        setupNotificationActions(); 
        
        setupLogoutValidation();
    }

    const navItems = document.querySelectorAll('.nav-links li');

    navItems.forEach(item => {
        item.addEventListener('click', async function() {
            const target = this.getAttribute('data-target');
            if (!target) return;

            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.view-section').forEach(section => {
                section.classList.add('hidden');
            });

            const activeSection = document.getElementById(target);
            if (activeSection) {
                activeSection.classList.remove('hidden');
            }

            if (target === 'calendar-view') {
                generateCalendarGrid();
                await renderScheduleSummaryWidget();
                await renderLawyerStatusWidget();
                await renderResourcesWidget(); 
            }
            
            if (target === 'documents-view') {
                await renderDocumentList(); 
            }

            if (target === 'cases-view') {
                await renderCasesTabView();
            }
            
            if (target === 'dashboard-view') {
                await updateDashboardStats();
                await renderDashboardContent();
                await renderMyScheduleContent();
            }
            
            if (target === 'notifications-view') {
                await renderNotificationsList();
                await renderEmailQueueList();
            }

            if (target === 'manage-lawyers-view') {
                await renderManageLawyersList();
            }

            if (target === 'clients-view') {
                await renderClientsView();
            }
            if (target === 'audits-view') {
                await renderAuditsView();
            }
        });
    });

    async function updateDashboardStats() {
        try {
            const localDate = new Date();
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            const nextWeekDate = new Date(localDate);
            nextWeekDate.setDate(nextWeekDate.getDate() + 7);
            const nwYear = nextWeekDate.getFullYear();
            const nwMonth = String(nextWeekDate.getMonth() + 1).padStart(2, '0');
            const nwDay = String(nextWeekDate.getDate()).padStart(2, '0');
            const nextWeekStr = `${nwYear}-${nwMonth}-${nwDay}`;

            const myCasesOnly = globalUserRole === 'lawyer' && !!currentUser;
            let casesQuery = supabaseClient.from('cases').select(casesSelect('*', myCasesOnly), { count: 'exact', head: true }).eq('status', 'active');
            let eventsQuery = supabaseClient.from('calendar_events').select('*, profiles(full_name)').gte('start_date', todayStr).lte('start_date', nextWeekStr);
            let conflictsQuery = supabaseClient.from('calendar_events').select('*, profiles(full_name)').gte('start_date', todayStr);

            if (globalUserRole === 'lawyer' && currentUser) {
                casesQuery = filterMyCases(casesQuery);
                eventsQuery = eventsQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
                conflictsQuery = conflictsQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
            }

            let casesCount = 0;
            try {
                const res = await casesQuery;
                if (!res.error) casesCount = res.count;
            } catch(e) {}

            const { data: upcomingEvents } = await eventsQuery;
            const deadlinesCount = upcomingEvents ? upcomingEvents.length : 0;

            const { data: allUpcomingEvents } = await conflictsQuery;
            let conflictsCount = 0;
            if (allUpcomingEvents) {
                allUpcomingEvents.forEach(ev => {
                    if (ev.is_conflict) {
                        conflictsCount++;
                    }
                });
            }

            const { count: lawyersCount } = await supabaseClient
                .from('profiles')
                .select('*, roles!inner(name)', { count: 'exact', head: true })
                .eq('status', 'active')
                .eq('roles.name', 'lawyer');

            const casesEl = document.getElementById('stat-cases-val');
            const deadlinesEl = document.getElementById('stat-deadlines-val');
            const conflictsEl = document.getElementById('stat-conflicts-val');
            const lawyersEl = document.getElementById('stat-lawyers-val');

            if (casesEl) casesEl.innerText = casesCount || 0;
            if (deadlinesEl) deadlinesEl.innerText = deadlinesCount;
            if (conflictsEl) conflictsEl.innerText = conflictsCount;
            if (lawyersEl) lawyersEl.innerText = lawyersCount || 0;

        } catch (error) {
            console.error('Error updating dashboard stats:', error);
        }
    }

    async function renderDashboardContent() {
        const deadlineList = document.getElementById('deadline-list-inject');
        const timeframeLabel = document.getElementById('deadline-timeframe-label');
        
        if (!deadlineList) return;
        showSkeletonIfEmpty(deadlineList, skeletonRows(2));

        try {
            const localDate = new Date();
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            let dlQuery = supabaseClient
                .from('calendar_events')
                .select('*, profiles(full_name), cases(case_number, case_type, clients(client_name))')
                .eq('is_general', false)
                .gte('start_date', todayStr)
                .order('start_date', { ascending: true })
                .limit(50); 

            if (globalUserRole === 'lawyer' && currentUser) {
                dlQuery = dlQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
            }

            const { data: allDeadlines, error: dlError } = await dlQuery;
            
            if (dlError) console.error("Error fetching deadlines:", dlError);

            let visibleDeadlines = allDeadlines ? allDeadlines.slice(0, 5) : [];

            if (visibleDeadlines.length > 0) {
                if (timeframeLabel) {
                    const nearestDate = new Date(visibleDeadlines[0].start_date);
                    const todayDate = new Date(todayStr);
                    const diffTime = nearestDate - todayDate;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) {
                        timeframeLabel.innerText = "Today";
                        timeframeLabel.style.color = "#ef4444"; 
                    } else if (diffDays === 1) {
                        timeframeLabel.innerText = "Tomorrow";
                        timeframeLabel.style.color = "#f97316"; 
                    } else {
                        timeframeLabel.innerText = `In ${diffDays} days`;
                        timeframeLabel.style.color = "#64748b"; 
                    }
                }

                deadlineList.innerHTML = visibleDeadlines.map(d => {
                    const assignedName = d.is_general ? 'All Lawyers' : (d.profiles && d.profiles.full_name ? d.profiles.full_name : 'Unassigned');
                    const clientName = d.cases?.clients?.client_name || 'No Client';
                    const isGeneralBadge = d.is_general ? '<span style="background:#dbeafe; color:#1d4ed8; font-size:10px; padding:3px 8px; border-radius:10px; margin-left:8px;">Firm-wide</span>' : '';
                    const priorityBadge = d.priority === 'high' ? '<span style="background:#fee2e2; color:#ef4444; font-size:10px; padding:3px 8px; border-radius:10px; margin-left:8px;">High</span>' : '';
                    const statusInfo = getEventStatusInfo(d.start_date, d.end_date);
                    const statusBadge = `<span style="background:${statusInfo.bg}; color:${statusInfo.color}; font-size:10px; padding:3px 8px; border-radius:10px; margin-left:8px; font-weight:600;"><i class="fa-solid ${statusInfo.icon}" style="margin-right:3px;"></i>${statusInfo.label}</span>`;
                    
                    return `
                        <div style="background:#fff; border:1px solid #e2e8f0; border-left:4px solid ${statusInfo.color}; padding:18px 20px; border-radius:12px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; ${statusInfo.label === 'Completed' ? 'opacity:0.65;' : ''}">
                            <div>
                                <h4 style="font-size:15px;">
                                    ${escapeHtml(d.title || 'Untitled Event')} 
                                    ${priorityBadge}
                                    ${isGeneralBadge}
                                    ${statusBadge}
                                </h4>
                                <p style="font-size:13px; color:#64748b; margin-top:4px;"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(d.location || 'No location')} • Client: ${escapeHtml(clientName)} • Atty. ${escapeHtml(assignedName)}</p>
                                <div style="margin-top:10px; font-size:12px; color:#94a3b8;">
                                    <i class="fa-regular fa-calendar"></i> ${formatDate(d.start_date)} at ${formatEventRange(d.start_date, d.end_date)}
                                </div>
                            </div>
                            <button style="padding:10px 18px; border:1px solid #e2e8f0; background:white; border-radius:10px; cursor:pointer; font-weight:600;" onclick="document.querySelector('.nav-links li[data-target=\\'calendar-view\\']').click()">
                                View
                            </button>
                        </div>
                    `;
                }).join('');
            } else {
                if (timeframeLabel) {
                    timeframeLabel.innerText = "No events";
                    timeframeLabel.style.color = "#64748b";
                }
                deadlineList.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">No upcoming deadlines</p>';
            }

        } catch (error) {
            console.error('Error rendering dashboard content:', error);
            deadlineList.innerHTML = errorStateHtml('Could not load deadlines.', 'renderDashboardContent');
        }
    }

    function setupDashboardButtons() {
        const viewCalendarBtn = document.getElementById('btn-dash-view-calendar');
        if (viewCalendarBtn) {
            viewCalendarBtn.addEventListener('click', () => {
                const calendarNavLink = document.querySelector('.nav-links li[data-target="calendar-view"]');
                if (calendarNavLink) calendarNavLink.click();
            });
        }
    }

    function setupCalendarControls() {
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                currentMonth--;
                if (currentMonth < 0) {
                    currentMonth = 11;
                    currentYear--;
                }
                generateCalendarGrid();
                renderScheduleSummaryWidget();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentMonth++;
                if (currentMonth > 11) {
                    currentMonth = 0;
                    currentYear++;
                }
                generateCalendarGrid();
                renderScheduleSummaryWidget();
            });
        }

        const todayBtn = document.getElementById('todayBtn');
        if (todayBtn) {
            todayBtn.addEventListener('click', () => {
                const now = new Date();
                currentMonth = now.getMonth();
                currentYear = now.getFullYear();
                generateCalendarGrid();
                renderScheduleSummaryWidget();
            });
        }
    }

    async function generateCalendarGrid() {
        const grid = document.getElementById('calendar-days');
        const headerTitle = document.getElementById('currentMonthYear');
        
        if (!grid || !headerTitle) return;

        headerTitle.innerText = `${monthNames[currentMonth]} ${currentYear}`;
        grid.innerHTML = '';

        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const today = new Date();

        const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${daysInMonth}`;

        let eventsQuery = supabaseClient
            .from('calendar_events')
            .select('*, profiles(full_name), cases(case_number, case_type, clients(client_name))') 
            .gte('start_date', startDate)
            .lte('start_date', endDate);

        if (globalUserRole === 'lawyer' && currentUser) {
            eventsQuery = eventsQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
        }

        const { data: calendarEvents, error } = await eventsQuery;

        if (error) {
            console.error("Calendar fetch error:", error);
            showToast('Could not load calendar events.', 'error');
        }

        const eventsByDay = {};
        if (calendarEvents) {
            calendarEvents.forEach(event => {
                const day = new Date(event.start_date).getDate();
                if (!eventsByDay[day]) eventsByDay[day] = [];
                eventsByDay[day].push(event);
            });
        }

        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += '<div class="day-cell day-empty"></div>';
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const isCurrent = (i === today.getDate() && 
                            currentMonth === today.getMonth() && 
                            currentYear === today.getFullYear());
            
            const weekday = (firstDay + i - 1) % 7;
            const isWeekend = weekday === 0 || weekday === 6;
            let eventsHtml = '<div class="day-events-container">';
            
            if (eventsByDay[i]) {
                const dayEvents = eventsByDay[i];
                const maxVisible = 2;

                dayEvents.slice(0, maxVisible).forEach(ev => {
                    const styleClass = ev.is_conflict ? 'cal-event-conflict' : (ev.is_general ? 'cal-event-general' : 'cal-event-normal');
                    const iconHtml = ev.is_conflict ? '<i class="fa-solid fa-triangle-exclamation"></i>' : (ev.is_general ? '<i class="fa-solid fa-building"></i>' : '');

                    let lawyerName = '';
                    if (ev.is_general) {
                        lawyerName = 'All Lawyers';
                    } else if (ev.profiles && ev.profiles.full_name) {
                        lawyerName = ev.profiles.full_name.split(' ')[0]; 
                    } else {
                        lawyerName = 'Unassigned';
                    }

                    const clientNameStr = ev.cases?.clients?.client_name ? `Client: ${ev.cases.clients.client_name} | ` : '';
                    const priorityMark = ev.priority === 'high' ? '<i class="fa-solid fa-star" style="font-size:8px;"></i>' : '';
                    const timeRange = (formatEventTime(ev.start_date) || '') + (ev.end_date ? ' – ' + formatEventTime(ev.end_date) : '');
                    eventsHtml += `<div class="cal-event-tag ${styleClass}" title="${escapeHtml(clientNameStr + ev.title + ' - Atty. ' + lawyerName)}">
                        <span class="cal-event-tag-title">${iconHtml}${priorityMark}${escapeHtml(ev.title || 'Untitled')}</span>
                        <span class="cal-event-tag-time">${timeRange}</span>
                    </div>`;
                });

                if (dayEvents.length > maxVisible) {
                    eventsHtml += `<div class="cal-event-more">+${dayEvents.length - maxVisible} more</div>`;
                }
            }
            
            eventsHtml += '</div>';

            const dateStrParam = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            grid.innerHTML += `
                <div class="day-cell day-clickable${isCurrent ? ' today' : ''}${eventsByDay[i] ? ' has-events' : ''}${isWeekend ? ' weekend' : ''}" onclick="openDayDetails('${dateStrParam}')">
                    <div class="day-top">
                        <span class="day-number ${isCurrent ? 'highlight-blue' : ''}">${i}</span>
                        ${eventsByDay[i] ? `<span class="day-count">${eventsByDay[i].length}</span>` : ''}
                    </div>
                    ${eventsHtml}
                </div>
            `;
        }
    }

    function setupDayDetailsModal() {
        const closeBtn = document.getElementById('close-day-details-btn');
        const modal = document.getElementById('day-details-modal');

        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }
    }

    function setupStatDetailsModal() {
        const closeBtn = document.getElementById('close-stat-details-btn');
        const modal = document.getElementById('stat-details-modal');

        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }


        const cardMap = {
            'stat-card-cases': 'cases',
            'stat-card-deadlines': 'deadlines',
            'stat-card-completed': 'completed',
            'stat-card-clients': 'clients',
            'stat-card-lawyers': 'lawyers'
        };
        Object.entries(cardMap).forEach(([id, type]) => {
            const card = document.getElementById(id);
            if (card) card.addEventListener('click', () => openStatDetails(type));
        });
    }

    window.openStatDetails = async function(type) {
        const modal = document.getElementById('stat-details-modal');
        const titleEl = document.getElementById('stat-details-title');
        const listEl = document.getElementById('stat-details-list');
        if (!modal || !titleEl || !listEl || !currentUser) return;

        const titles = {
            cases: 'Active Cases',
            deadlines: 'Upcoming Deadlines',
            completed: 'Completed Events',
            clients: 'Active Clients',
            lawyers: 'Active Lawyers'
        };
        titleEl.textContent = titles[type] || 'Details';
        listEl.innerHTML = skeletonRows(4);
        modal.classList.remove('hidden');

        try {
            if (type === 'cases') {
                const isAdminView = globalUserRole !== 'lawyer';
                let casesListQuery = supabaseClient
                    .from('cases')
                    .select(casesSelect('*, clients(client_name)', !isAdminView))
                    .eq('status', 'active')
                    .order('created_at', { ascending: false });
                if (!isAdminView) casesListQuery = filterMyCases(casesListQuery);
                const { data: cases, error } = await casesListQuery;
                if (error) throw error;

                listEl.innerHTML = (cases && cases.length > 0)
                    ? cases.map(c => {
                        const clientName = c.clients ? c.clients.client_name : 'No Client';
                        return `
                            <div style="padding: 15px; border: 1px solid #f1f5f9; border-radius: 8px; background: #fafbfc;">
                                <h4 style="color: #0f172a; margin-bottom: 4px; font-size: 14px;">${escapeHtml(c.title)} <span style="color:#64748b; font-weight:normal; font-size:12px;">(${escapeHtml(clientName)})</span></h4>
                                <p style="color: #64748b; font-size: 11px;">${c.case_number ? `#${escapeHtml(c.case_number)} • ` : ''}Filed: ${formatDate(c.date_filed || c.created_at)}${isAdminView && getLeadLawyerName(c) ? ` • Atty. ${escapeHtml(getLeadLawyerName(c))}` : ''}</p>
                            </div>
                        `;
                    }).join('')
                    : '<p style="color:#64748b; text-align:center; padding:20px;">No active cases found.</p>';

            } else if (type === 'deadlines') {
                const localDate = new Date();
                const todayStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

                let deadlinesQuery = supabaseClient
                    .from('calendar_events')
                    .select('*, cases(case_number, clients(client_name))')
                    .eq('is_general', false)
                    .gte('start_date', todayStr)
                    .order('start_date', { ascending: true })
                    .limit(20);
                if (globalUserRole === 'lawyer') {
                    deadlinesQuery = deadlinesQuery.eq('assigned_to', currentUser.id);
                }
                const { data: deadlines, error } = await deadlinesQuery;
                if (error) throw error;

                listEl.innerHTML = (deadlines && deadlines.length > 0)
                    ? deadlines.map(dl => {
                        const dlDate = new Date(dl.start_date);
                        const daysUntil = Math.ceil((dlDate - new Date(todayStr)) / (1000 * 60 * 60 * 24));
                        const badgeColor = daysUntil <= 3 ? 'bg-red' : 'bg-gray';
                        const clientName = dl.cases?.clients?.client_name || 'No Client';
                        return `
                            <div class="upcoming-dl-item" style="cursor:pointer;" onclick="openEventDetails('${dl.id}')" title="Click to view full event details">
                                <div style="display:flex; justify-content:space-between;">
                                    <h4>${escapeHtml(dl.title)}</h4>
                                    <span class="badge-pill ${badgeColor}">${daysUntil}d</span>
                                </div>
                                <p>${escapeHtml(dl.location || 'Meeting')} • Client: ${escapeHtml(clientName)}</p>
                                <small><i class="fa-regular fa-calendar"></i> ${formatDate(dl.start_date)} at ${formatEventTime(dl.start_date)}</small>
                            </div>
                        `;
                    }).join('')
                    : '<p style="color:#64748b; text-align:center; padding:20px;">No upcoming deadlines.</p>';

            } else if (type === 'completed') {
                const localDate = new Date();
                const pastWindowDate = new Date(localDate);
                pastWindowDate.setDate(pastWindowDate.getDate() - 60);
                const pastWindowStr = pastWindowDate.toISOString().split('T')[0];

                const isAdminView = globalUserRole !== 'lawyer';
                let completedQuery = supabaseClient
                    .from('calendar_events')
                    .select('*, cases(case_number, clients(client_name))')
                    .order('start_date', { ascending: false });
                if (isAdminView) {
                    completedQuery = completedQuery.lte('start_date', new Date().toISOString()).limit(200);
                } else {
                    completedQuery = completedQuery
                        .gte('start_date', pastWindowStr)
                        .or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
                }
                const { data: recentEvents, error } = await completedQuery;
                if (error) throw error;

                const completed = (recentEvents || []).filter(ev => getEventStatusInfo(ev.start_date, ev.end_date).label === 'Completed');

                listEl.innerHTML = completed.length > 0
                    ? completed.map(ev => {
                        const clientName = ev.cases?.clients?.client_name || 'No Client';
                        return `
                            <div style="padding: 15px; border: 1px solid #f1f5f9; border-radius: 8px; background: #fafbfc; cursor:pointer;" onclick="openEventDetails('${ev.id}')" title="Click to view full event details">
                                <h4 style="color: #0f172a; margin-bottom: 4px; font-size: 14px;">${escapeHtml(ev.title)}</h4>
                                <p style="color: #64748b; font-size: 11px;">${escapeHtml(clientName)} • ${formatDate(ev.start_date)} at ${formatEventTime(ev.start_date)}</p>
                            </div>
                        `;
                    }).join('')
                    : '<p style="color:#64748b; text-align:center; padding:20px;">' + (isAdminView ? 'No completed events found.' : 'No completed events in the last 60 days.') + '</p>';

            } else if (type === 'clients') {
                const { clients } = await getActiveClientsData();
                const isAdminView = globalUserRole !== 'lawyer';

                listEl.innerHTML = clients.length > 0
                    ? clients.map(cl => {
                        const handledBy = (isAdminView && cl.lawyerNames.size > 0)
                            ? `<p style="color:#94a3b8; font-size:10px; margin-top:4px;"><i class="fa-solid fa-gavel"></i> ${Array.from(cl.lawyerNames).map(n => `Atty. ${escapeHtml(n)}`).join(', ')}</p>`
                            : '';
                        return `
                            <div style="padding: 15px; border: 1px solid #f1f5f9; border-radius: 8px; background: #fafbfc;">
                                <h4 style="color: #0f172a; margin-bottom: 4px; font-size: 14px;">${escapeHtml(cl.client_name || 'Unnamed Client')}</h4>
                                <p style="color: #64748b; font-size: 11px;">${escapeHtml(cl.client_email || 'No email on file')}</p>
                                ${handledBy}
                            </div>
                        `;
                    }).join('')
                    : '<p style="color:#64748b; text-align:center; padding:20px;">No active clients found.</p>';

            } else if (type === 'lawyers') {
                const lawyers = await getActiveLawyersData();

                const lawyerCards = lawyers.length > 0
                    ? lawyers.map(l => `
                        <div style="padding: 15px; border: 1px solid #f1f5f9; border-radius: 8px; background: #fafbfc;">
                            <h4 style="color: #0f172a; margin-bottom: 4px; font-size: 14px;">Atty. ${escapeHtml(l.full_name || 'Unnamed')}</h4>
                            <p style="color: #64748b; font-size: 11px;">${escapeHtml(l.specialization || 'General Practice')}${l.phone ? ' • ' + escapeHtml(l.phone) : ''}</p>
                        </div>
                    `).join('')
                    : '<p style="color:#64748b; text-align:center; padding:20px;">No active lawyers found.</p>';

                listEl.innerHTML = `
                    ${lawyerCards}
                    <button onclick="document.getElementById('stat-details-modal').classList.add('hidden'); document.querySelector('.nav-links li[data-target=\\'manage-lawyers-view\\']').click();" style="padding:10px; border:1px solid #e2e8f0; background:white; border-radius:8px; cursor:pointer; font-weight:600; font-size:12px; color:#0f172a;">
                        Manage Lawyers <i class="fa-solid fa-arrow-right"></i>
                    </button>
                `;
            }
        } catch (error) {
            console.error('Error loading stat details:', error);
            listEl.innerHTML = errorStateHtml("Could not load the details.", null);
        }
    }

    function getEventEndTime(startDateISO, endDateISO) {
        const start = new Date(startDateISO);
        const end = endDateISO ? new Date(endDateISO) : null;
        if (end && !isNaN(end.getTime()) && end > start) return end;
        return new Date(start.getTime() + 60 * 60 * 1000);
    }

    function isEventOngoing(startDateISO, endDateISO, nowDate) {
        const now = nowDate || new Date();
        const start = new Date(startDateISO);
        return now >= start && now < getEventEndTime(startDateISO, endDateISO);
    }

    function getEventStatusInfo(startDateISO, endDateISO) {
        const start = new Date(startDateISO);
        const end = getEventEndTime(startDateISO, endDateISO);
        const now = new Date();

        if (now >= end) return { label: 'Completed', color: '#16a34a', bg: '#dcfce7', icon: 'fa-circle-check' };
        if (now >= start && now < end) return { label: 'Ongoing', color: '#d97706', bg: '#fef3c7', icon: 'fa-hourglass-half' };
        return { label: 'Upcoming', color: '#2563eb', bg: '#dbeafe', icon: 'fa-clock' };
    }

   
    function buildEventDetailCard(ev) {
        const lawyerName = ev.is_general ? 'All Lawyers' : (ev.profiles?.full_name || 'Unassigned');
        const clientName = ev.cases?.clients?.client_name || 'No Client';
        const statusInfo = getEventStatusInfo(ev.start_date, ev.end_date);
        const isDone = statusInfo.label === 'Completed';
        const borderColor = ev.is_conflict ? '#ef4444' : (ev.is_general ? '#8b5cf6' : '#3b82f6');
        const bgColor = ev.is_conflict ? '#fef2f2' : (ev.is_general ? '#f5f3ff' : '#f8fafc');
        const conflictStyle = `border-left: 4px solid ${borderColor}; background: ${bgColor}; ${isDone ? 'opacity: 0.65;' : ''}`;
        const priorityBadge = ev.priority === 'high' ? '<span class="badge-pill bg-red">High Priority</span>' : '';
        const generalBadge = ev.is_general ? '<span style="background:#ede9fe; color:#7c3aed; font-size:11px; padding:2px 10px; border-radius:99px; margin-left:8px;">Firm-wide</span>' : '';
        const statusBadge = `<span style="background:${statusInfo.bg}; color:${statusInfo.color}; font-size:11px; padding:2px 10px; border-radius:99px; margin-left:8px; font-weight:600;"><i class="fa-solid ${statusInfo.icon}" style="margin-right:4px;"></i>${statusInfo.label}</span>`;

        let caseDetailsHtml = '';
        if (ev.cases) {
            caseDetailsHtml = `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 12px;">
                    <div style="display:flex; gap: 15px; margin-bottom: 6px;">
                        <span style="color:#475569;"><strong>Case No:</strong> ${escapeHtml(ev.cases.case_number || 'N/A')}</span>
                        <span style="color:#475569;"><strong>Type:</strong> ${escapeHtml(ev.cases.case_type || 'N/A')}</span>
                    </div>
                    <p style="color:#64748b; margin:0; line-height: 1.4;"><em>"${escapeHtml(ev.cases.case_description || 'No description provided.')}"</em></p>
                </div>
            `;
        }

        let attachmentHtml = '';
        if (ev.documents) {
            attachmentHtml = `
                <div style="margin-top: 10px;">
                    <a href="#" data-doc-path="${escapeHtml(ev.documents.file_path || '')}" data-doc-title="${escapeHtml(ev.documents.title || '')}" style="font-size:12px; color:#3b82f6; text-decoration:none;">
                        <i class="fa-solid fa-paperclip"></i> ${escapeHtml(ev.documents.title)}
                    </a>
                </div>
            `;
        }

        const rescheduleHtml = (statusInfo.label === 'Upcoming' && canRescheduleEvent(ev))
            ? `<div style="margin-top: 12px; display: flex; justify-content: flex-end;"><button type="button" class="ct-text-btn ct-blue" data-reschedule-id="${ev.id}"><i class="fa-solid fa-calendar-days"></i> Reschedule</button></div>`
            : '';

        return `
            <div style="${conflictStyle} border-radius: 8px; padding: 15px; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
                    <h4 style="margin:0; font-size:16px; color:#0f172a;">${escapeHtml(ev.title)} ${priorityBadge} ${generalBadge} ${statusBadge}</h4>
                    <span style="font-weight:600; color:#3b82f6; font-size:14px;">${formatEventRange(ev.start_date, ev.end_date)}</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; font-size:13px; color:#475569;">
                    <span><i class="fa-solid fa-location-dot" style="width:16px; color:#94a3b8;"></i> ${escapeHtml(ev.location || 'Office')}</span>
                    <span><i class="fa-solid fa-user" style="width:16px; color:#94a3b8;"></i> Client: <strong>${escapeHtml(clientName)}</strong></span>
                    <span><i class="fa-solid fa-gavel" style="width:16px; color:#94a3b8;"></i> ${ev.is_general ? '<strong>All Lawyers</strong>' : `Atty. ${escapeHtml(lawyerName)}`}</span>
                </div>
                ${caseDetailsHtml}
                ${attachmentHtml}
                ${rescheduleHtml}
            </div>
        `;
    }

    function canRescheduleEvent(ev) {
        if (!currentUser || !ev) return false;
        if (globalRoleName === 'admin') return true;
        return globalRoleName === 'lawyer' && !ev.is_general && ev.assigned_to === currentUser.id;
    }

    function pad2(n) { return String(n).padStart(2, '0'); }

    async function findRescheduleConflict(ev, startISO, endISO, dateVal) {
        const duration = new Date(endISO) - new Date(startISO);
        const start = new Date(startISO);
        const rangeStart = new Date(start.getTime() - duration + 1000).toISOString();
        const rangeEnd = new Date(start.getTime() + duration - 1000).toISOString();

        if (ev.client_id) {
            const clash = await checkClientDayConflict(ev.client_id, dateVal, ev.id);
            if (clash) {
                return `This client already has "${clash.conflictEvent.title}" at ${formatEventTime(clash.conflictEvent.start_date)} on ${formatDate(clash.conflictEvent.start_date)}. A client can only have one event per day.\n\nThe earliest free day for this client is ${formatDate(clash.nextFreeDate.toISOString())}.`;
            }
        }

        if (!ev.is_general && ev.assigned_to) {
            const { data, error } = await supabaseClient
                .from('calendar_events')
                .select('id, title, start_date')
                .eq('assigned_to', ev.assigned_to)
                .neq('id', ev.id)
                .gte('start_date', rangeStart)
                .lte('start_date', rangeEnd);
            if (error) throw error;
            if (data && data.length > 0) {
                return `This lawyer already has "${data[0].title}" at ${formatEventTime(data[0].start_date)} on ${formatDate(data[0].start_date)}. Events for the same lawyer need enough gap between them based on this event's duration.`;
            }
        }

        if (CONFERENCE_ROOMS.includes(ev.location)) {
            const { data, error } = await supabaseClient
                .from('calendar_events')
                .select('id, title, start_date')
                .eq('location', ev.location)
                .neq('id', ev.id)
                .gte('start_date', rangeStart)
                .lte('start_date', rangeEnd);
            if (error) throw error;
            if (data && data.length > 0) {
                return `"${ev.location}" is already booked for "${data[0].title}" at ${formatEventTime(data[0].start_date)} on ${formatDate(data[0].start_date)}. Bookings for the same location need enough gap between them based on this event's duration.`;
            }
        }
        return null;
    }

    async function openRescheduleModal(eventId) {
        let ev;
        try {
            const { data, error } = await supabaseClient
                .from('calendar_events')
                .select('id, title, start_date, end_date, location, assigned_to, is_general, client_id')
                .eq('id', eventId)
                .single();
            if (error) throw error;
            ev = data;
        } catch (err) {
            showToast('Could not load this event: ' + err.message, 'error');
            return;
        }

        if (!canRescheduleEvent(ev)) {
            showToast('You can only reschedule your own upcoming events.', 'warning');
            return;
        }
        if (getEventStatusInfo(ev.start_date, ev.end_date).label !== 'Upcoming') {
            showToast('Only upcoming events can be rescheduled.', 'warning');
            return;
        }

        const existing = document.getElementById('reschedule-modal');
        if (existing) existing.remove();

        const oldStart = new Date(ev.start_date);
        const todayKey = toLocalDateKey(new Date());
        const overlay = document.createElement('div');
        overlay.id = 'reschedule-modal';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content mc-modal">
                <div class="modal-header mc-modal-head">
                    <div>
                        <h2>Reschedule event</h2>
                        <p>${escapeHtml(ev.title)} • currently ${formatDate(ev.start_date)}, ${formatEventTime(ev.start_date)}</p>
                    </div>
                    <button type="button" class="btn-close" data-rs-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <form class="mc-form" id="reschedule-form" autocomplete="off">
                    <div class="mc-row">
                        <div class="mc-field">
                            <label for="rs-date">New date</label>
                            <input type="date" id="rs-date" required min="${todayKey}" value="${toLocalDateKey(oldStart)}">
                        </div>
                        <div class="mc-field">
                            <label for="rs-time">Start time</label>
                            <input type="time" id="rs-time" required value="${pad2(oldStart.getHours())}:${pad2(oldStart.getMinutes())}">
                        </div>
                    </div>
                    <div class="mc-row">
                        <div class="mc-field">
                            <label for="rs-end-date">End date <span class="mc-optional">(optional)</span></label>
                            <input type="date" id="rs-end-date" min="${todayKey}">
                        </div>
                        <div class="mc-field">
                            <label for="rs-end-time">End time <span class="mc-optional">(optional)</span></label>
                            <input type="time" id="rs-end-time">
                        </div>
                    </div>
                    <p class="cv-hint">Leave the end blank to keep the same duration.</p>
                    <button type="submit" class="mc-submit">Save new schedule</button>
                </form>
            </div>`;
        document.body.appendChild(overlay);

        const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('[data-rs-close]').addEventListener('click', close);

        const form = overlay.querySelector('#reschedule-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const val = id => (overlay.querySelector('#' + id)?.value || '').trim();
            const dateVal = val('rs-date');
            const timeVal = val('rs-time');
            const endDateVal = val('rs-end-date');
            const endTimeVal = val('rs-end-time');
            const submitBtn = form.querySelector('button[type="submit"]');
            const idle = submitBtn.textContent;

            if (!dateVal || !timeVal) {
                showToast('Please choose the new date and start time.', 'warning');
                return;
            }

            const startISO = combineDateAndTime(dateVal, timeVal);
            if (dateVal < todayKey) {
                showToast("You can't reschedule an event to a past date.", 'warning');
                return;
            }

            const oldEnd = ev.end_date ? new Date(ev.end_date) : null;
            let duration = oldEnd ? oldEnd - oldStart : 60 * 60 * 1000;
            if (!(duration > 0)) duration = 60 * 60 * 1000;

            let endISO;
            if (endDateVal || endTimeVal) {
                endISO = combineDateAndTime(endDateVal || dateVal, endTimeVal || timeVal);
                if (new Date(endISO) <= new Date(startISO)) {
                    showToast('The end date/time must be after the start date/time.', 'warning');
                    return;
                }
            } else {
                endISO = new Date(new Date(startISO).getTime() + duration).toISOString();
            }

            if (new Date(startISO).getTime() === oldStart.getTime() && oldEnd && new Date(endISO).getTime() === oldEnd.getTime()) {
                showToast('That is the same schedule as before. Choose a different date or time.', 'info');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Checking...';
            try {
                const conflict = await findRescheduleConflict(ev, startISO, endISO, dateVal);
                if (conflict) {
                    showToast('Cannot reschedule: ' + conflict, 'warning', { duration: 10000 });
                    return;
                }

                submitBtn.textContent = 'Saving...';
                const { data: updated, error } = await supabaseClient
                    .from('calendar_events')
                    .update({ start_date: startISO, end_date: endISO })
                    .eq('id', ev.id)
                    .select('id');
                if (error) throw error;
                if (!updated || updated.length === 0) {
                    throw new Error('The event was not updated. You may not have permission to change it.');
                }

                await logAuditActivity('RESCHEDULE', 'calendar_events', `Rescheduled event: ${ev.title} to ${formatDate(startISO)}, ${formatEventTime(startISO)}`, ev.id, { start_date: ev.start_date, end_date: ev.end_date }, { start_date: startISO, end_date: endISO });

                showToast(`"${ev.title}" was rescheduled to ${formatDate(startISO)}, ${formatEventTime(startISO)}.`, 'success');
                close();
                const dayModal = document.getElementById('day-details-modal');
                if (dayModal) dayModal.classList.add('hidden');

                generateCalendarGrid();
                renderResourcesWidget();
                renderScheduleSummaryWidget();
                renderLawyerStatusWidget();
                updateDashboardStats();
                renderDashboardContent();
                updateScheduleStats();
                const timeline = document.getElementById('timeline-inject');
                if (timeline && !timeline.parentElement.classList.contains('hidden')) {
                    if (typeof renderTimelineInSchedule === 'function') renderTimelineInSchedule();
                }
            } catch (err) {
                console.error('Reschedule failed:', err);
                showToast('Could not reschedule: ' + err.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = idle;
            }
        });
    }

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-reschedule-id]');
        if (btn) openRescheduleModal(btn.getAttribute('data-reschedule-id'));
    });

    setInterval(() => {
        const modal = document.getElementById('day-details-modal');
        const listEl = document.getElementById('day-details-list');
        if (!modal || !listEl || modal.classList.contains('hidden')) return;
        const evs = window.__openModalEvents;
        if (!evs || evs.length === 0) return;
        listEl.innerHTML = evs.map(buildEventDetailCard).join('');
    }, 30000);

    setInterval(() => {
        if (typeof renderLawyerStatusWidget === 'function') renderLawyerStatusWidget();
        if (typeof renderResourcesWidget === 'function') renderResourcesWidget();
    }, 60000);

    window.openDayDetails = async function(dateString) {
        const modal = document.getElementById('day-details-modal');
        const titleEl = document.getElementById('day-details-title');
        const listEl = document.getElementById('day-details-list');

        if (!modal || !titleEl || !listEl) return;

        const dateObj = new Date(dateString);
        titleEl.textContent = `Events for ${dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
        listEl.innerHTML = skeletonRows(3);
        
        modal.classList.remove('hidden');

        try {
            const { startISO: dayStart, endISO: dayEnd } = getDayRange(dateString);
            let eventsQuery = supabaseClient
                .from('calendar_events')
                .select('*, profiles(full_name), cases(case_number, case_type, case_description, clients(client_name)), documents(title, file_path)')
                .gte('start_date', dayStart)
                .lte('start_date', dayEnd)
                .order('start_date', { ascending: true });

            if (globalUserRole === 'lawyer' && currentUser) {
                eventsQuery = eventsQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
            }

            const { data: events, error } = await eventsQuery;

            if (error) throw error;

            window.__openModalEvents = events || [];

            if (events && events.length > 0) {
                let html = '';
                for (const ev of events) {
                    html += buildEventDetailCard(ev);
                }
                
                if (html === '') {
                    listEl.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">No events scheduled for this day.</p>';
                } else {
                    listEl.innerHTML = html;
                }
            } else {
                listEl.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">No events scheduled for this day.</p>';
            }
        } catch (error) {
            console.error("Error fetching day details:", error);
            listEl.innerHTML = errorStateHtml("Could not load the events for this day.", null);
        }
    };


    window.openEventDetails = async function(eventId) {
        const statModal = document.getElementById('stat-details-modal');
        if (statModal) statModal.classList.add('hidden');

        const modal = document.getElementById('day-details-modal');
        const titleEl = document.getElementById('day-details-title');
        const listEl = document.getElementById('day-details-list');
        if (!modal || !titleEl || !listEl) return;

        titleEl.textContent = 'Event Details';
        listEl.innerHTML = skeletonRows(2);
        modal.classList.remove('hidden');

        try {
            const { data: ev, error } = await supabaseClient
                .from('calendar_events')
                .select('*, profiles(full_name), cases(case_number, case_type, case_description, clients(client_name)), documents(title, file_path)')
                .eq('id', eventId)
                .single();

            if (error) throw error;

            window.__openModalEvents = ev ? [ev] : [];
            titleEl.textContent = ev.title || 'Event Details';
            listEl.innerHTML = ev ? buildEventDetailCard(ev) : '<p style="color:#64748b; text-align:center; padding:30px;">Event not found.</p>';
        } catch (error) {
            console.error('Error fetching event details:', error);
            listEl.innerHTML = errorStateHtml("Could not load this event.", null);
        }
    };

    async function renderScheduleSummaryWidget() {
        const summaryWidget = document.getElementById('widget-schedule-summary');
        if (!summaryWidget) return;

        const titleEl = document.getElementById('schedule-summary-title');
        const isLawyerView = (globalUserRole === 'lawyer' && currentUser);

        try {
            const pad = n => String(n).padStart(2, '0');
            const startDate = `${currentYear}-${pad(currentMonth + 1)}-01`;
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const endDate = `${currentYear}-${pad(currentMonth + 1)}-${pad(daysInMonth)}T23:59:59`;
            const monthLabel = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            let evQuery = supabaseClient
                .from('calendar_events')
                .select('id, title, start_date, end_date, assigned_to, is_general, profiles(full_name)')
                .gte('start_date', startDate)
                .lte('start_date', endDate)
                .order('start_date', { ascending: true });


            if (isLawyerView) {
                evQuery = evQuery.eq('assigned_to', currentUser.id);
            }

            const { data: events, error } = await evQuery;
            if (error) throw error;

            if (titleEl) titleEl.textContent = isLawyerView ? 'My Schedule Summary' : 'Lawyer Schedule Summary';

            if (!events || events.length === 0) {
                summaryWidget.innerHTML = `<p style="color:#64748b; padding:10px; font-size:13px;">No scheduled events for ${escapeHtml(monthLabel)}.</p>`;
                return;
            }

            const timeRange = ev => {
                const start = formatEventTime(ev.start_date);
                const end = ev.end_date ? formatEventTime(ev.end_date) : '';
                return end ? `${start} - ${end}` : start;
            };

            if (isLawyerView) {
  
                const rows = events.map(ev => `
                    <div style="padding:10px 0; border-bottom:1px solid #f1f5f9;">
                        <div style="font-size:13px; font-weight:600; color:#1e293b;">${escapeHtml(ev.title)}</div>
                        <div style="font-size:11px; color:#64748b; margin-top:2px;">${escapeHtml(formatDate(ev.start_date))} &middot; ${escapeHtml(timeRange(ev))}</div>
                    </div>
                `).join('');
                summaryWidget.innerHTML = `
                    <div style="font-size:11px; color:#64748b; margin-bottom:6px;">${escapeHtml(monthLabel)} &middot; ${events.length} event${events.length === 1 ? '' : 's'}</div>
                    <div style="max-height:360px; overflow-y:auto;">${rows}</div>
                `;
                return;
            }

            const rows = events.map(ev => {
                const lawyerName = ev.profiles?.full_name || (ev.is_general ? 'Firm-wide' : 'Unassigned');
                return `
                    <tr>
                        <td style="padding:8px 6px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#1e293b; vertical-align:top;">${escapeHtml(lawyerName)}</td>
                        <td style="padding:8px 6px; border-bottom:1px solid #e2e8f0; color:#475569; white-space:nowrap; vertical-align:top;">${escapeHtml(formatDate(ev.start_date))}<br><span style="color:#64748b;">${escapeHtml(timeRange(ev))}</span></td>
                        <td style="padding:8px 6px; border-bottom:1px solid #e2e8f0; color:#334155; vertical-align:top;">${escapeHtml(ev.title)}</td>
                    </tr>
                `;
            }).join('');

            summaryWidget.innerHTML = `
                <div style="font-size:11px; color:#64748b; margin-bottom:8px;">${escapeHtml(monthLabel)} &middot; ${events.length} scheduled event${events.length === 1 ? '' : 's'}</div>
                <div style="max-height:420px; overflow:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:11.5px; text-align:left;">
                        <thead>
                            <tr style="background:#f8fafc;">
                                <th style="padding:8px 6px; border-bottom:2px solid #cbd5e1; font-size:10.5px; text-transform:uppercase; letter-spacing:0.04em; color:#475569;">Lawyer</th>
                                <th style="padding:8px 6px; border-bottom:2px solid #cbd5e1; font-size:10.5px; text-transform:uppercase; letter-spacing:0.04em; color:#475569;">Date &amp; Time</th>
                                <th style="padding:8px 6px; border-bottom:2px solid #cbd5e1; font-size:10.5px; text-transform:uppercase; letter-spacing:0.04em; color:#475569;">Event</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering schedule summary:', error);
            summaryWidget.innerHTML = errorStateHtml("Could not load the schedule summary.", "renderScheduleSummaryWidget");
        }
    }

    async function renderLawyerStatusWidget() {
        const lawyerList = document.getElementById('lawyer-status-list-sidebar');
        if (!lawyerList) return;

        const isLawyer = globalUserRole === 'lawyer';
        if (isLawyer) return;

        try {
            const { data: lawyers } = await supabaseClient
                .from('profiles')
                .select('*, roles!inner(name)')
                .eq('roles.name', 'lawyer')
                .eq('status', 'active');

            if (!lawyers || lawyers.length === 0) return;

            const localDate = new Date();
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;
            const { startISO: todayStart, endISO: todayEnd } = getDayRange(todayStr);

            const { data: todaysEvents } = await supabaseClient
                .from('calendar_events')
                .select('assigned_to, title, is_general, start_date, end_date')
                .gte('start_date', todayStart)
                .lte('start_date', todayEnd);

            const lawyerEventMap = {};
            if (todaysEvents) {
                todaysEvents.filter(ev => isEventOngoing(ev.start_date, ev.end_date)).forEach(ev => {
                    if (ev.is_general) {
                        lawyers.forEach(l => {
                            if (!lawyerEventMap[l.id]) {
                                lawyerEventMap[l.id] = ev.title || 'Firm Event';
                            }
                        });
                    } else if (ev.assigned_to) {
                        if (!lawyerEventMap[ev.assigned_to]) {
                            lawyerEventMap[ev.assigned_to] = ev.title || 'Event';
                        }
                    }
                });
            }

            lawyerList.innerHTML = lawyers.map(l => {
                const eventTitle = lawyerEventMap[l.id];
                
                if (eventTitle) {
                    const displayTitle = eventTitle.length > 15 ? eventTitle.substring(0, 15) + '...' : eventTitle;
                    return `
                        <li style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:13px;">
                            <span title="${escapeHtml(eventTitle)}"><i class="fa-solid fa-circle" style="color:#ef4444; font-size:8px; margin-right:8px;"></i>${escapeHtml(l.full_name || 'Unknown')}</span>
                            <span class="tag" style="background:#fee2e2; color:#ef4444; font-size:10px; padding:3px 8px; border-radius:4px; font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;" title="${escapeHtml(eventTitle)}">${escapeHtml(displayTitle)}</span>
                        </li>
                    `;
                } else {
                    return `
                        <li style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:13px;">
                            <span><i class="fa-solid fa-circle" style="color:#22c55e; font-size:8px; margin-right:8px;"></i>${escapeHtml(l.full_name || 'Unknown')}</span>
                            <span class="tag tag-avail" style="background:#dcfce7; color:#22c55e; font-size:10px; padding:3px 8px; border-radius:4px; font-weight:bold;">Available</span>
                        </li>
                    `;
                }
            }).join('');

        } catch (error) {
            console.error('Error rendering lawyer status:', error);
        }
    }

    const OCR_LANG = 'eng';
    const OCR_MAX_PAGES = 25;
    const OCR_MAX_CHARS = 400000;
    const LIB_URLS = {
        pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
        tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js',
        mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
    };
    const scriptLoads = {};

    function loadScriptOnce(url) {
        if (!scriptLoads[url]) {
            scriptLoads[url] = new Promise((resolve, reject) => {
                const el = document.createElement('script');
                el.src = url;
                el.onload = () => resolve();
                el.onerror = () => {
                    delete scriptLoads[url];
                    reject(new Error('Could not load a text-reading library. Check your internet connection.'));
                };
                document.head.appendChild(el);
            });
        }
        return scriptLoads[url];
    }

    function fileKind(fileOrName) {
        const name = String((fileOrName && fileOrName.name) || fileOrName || '').toLowerCase();
        const ext = name.includes('.') ? name.split('.').pop() : '';
        if (ext === 'pdf') return 'pdf';
        if (ext === 'docx') return 'docx';
        if (ext === 'txt') return 'txt';
        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return 'image';
        const type = (fileOrName && fileOrName.type) || '';
        if (type === 'application/pdf') return 'pdf';
        if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
        if (type === 'text/plain') return 'txt';
        if (type === 'image/png' || type === 'image/jpeg') return 'image';
        return null;
    }

    function fileExtension(name) {
        const str = String(name || '');
        const i = str.lastIndexOf('.');
        return i > 0 && i >= str.length - 6 ? str.slice(i) : '';
    }

    function retitleForFile(oldTitle, file) {
        const oldExt = fileExtension(oldTitle);
        const newExt = fileExtension(file.name);
        const base = oldExt ? String(oldTitle).slice(0, String(oldTitle).length - oldExt.length) : (oldTitle || file.name);
        return base + newExt;
    }

    function keepExtension(newTitle, oldTitle) {
        const typed = String(newTitle || '').trim();
        const oldExt = fileExtension(oldTitle);
        if (!typed) return oldTitle;
        if (oldExt && !typed.toLowerCase().endsWith(oldExt.toLowerCase())) return typed + oldExt;
        return typed;
    }

    function cleanOcrText(text) {
        return String(text || '').replace(/\u0000/g, '').slice(0, OCR_MAX_CHARS);
    }

    function showIndexProgress(message) {
        let el = document.getElementById('index-progress');
        if (!el) {
            el = document.createElement('div');
            el.id = 'index-progress';
            el.style.cssText = 'position:fixed; right:20px; bottom:20px; z-index:10002; background:#0f172a; color:#ffffff; padding:12px 16px; border-radius:10px; font-size:12px; box-shadow:0 8px 20px rgba(0,0,0,0.2); max-width:320px;';
            document.body.appendChild(el);
        }
        el.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${escapeHtml(message)}`;
    }

    function hideIndexProgress() {
        const el = document.getElementById('index-progress');
        if (el) el.remove();
    }

    async function extractTextFromFile(file, onProgress) {
        const kind = fileKind(file);

        if (kind === 'txt') {
            return { text: await file.text(), pages: 1 };
        }

        if (kind === 'docx') {
            await loadScriptOnce(LIB_URLS.mammoth);
            const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
            return { text: result.value || '', pages: null };
        }

        if (kind === 'image') {
            await loadScriptOnce(LIB_URLS.tesseract);
            onProgress('Reading text from the image...');
            const worker = await window.Tesseract.createWorker(OCR_LANG);
            try {
                const { data } = await worker.recognize(file);
                return { text: data.text || '', pages: 1 };
            } finally {
                await worker.terminate();
            }
        }

        if (kind === 'pdf') {
            await loadScriptOnce(LIB_URLS.pdfjs);
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIB_URLS.pdfWorker;
            const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
            const total = pdf.numPages;
            const limit = Math.min(total, OCR_MAX_PAGES);
            let worker = null;
            let text = '';

            try {
                for (let i = 1; i <= limit; i++) {
                    onProgress(`Reading page ${i} of ${limit}...`);
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    let pageText = content.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();

                    if (pageText.length < 25) {
                        if (!worker) {
                            await loadScriptOnce(LIB_URLS.tesseract);
                            worker = await window.Tesseract.createWorker(OCR_LANG);
                        }
                        onProgress(`Scanning page ${i} of ${limit} (OCR)...`);
                        const viewport = page.getViewport({ scale: 2 });
                        const canvas = document.createElement('canvas');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
                        const { data } = await worker.recognize(canvas);
                        pageText = (data.text || '').replace(/\s+/g, ' ').trim();
                    }

                    text += pageText + '\n';
                    if (text.length >= OCR_MAX_CHARS) break;
                }
            } finally {
                if (worker) await worker.terminate();
            }
            return { text: text, pages: total };
        }

        throw new Error('This file type cannot be indexed.');
    }

    function refreshDocumentList() {
        const searchEl = document.getElementById('doc-search-input');
        const filterEl = document.getElementById('doc-filter');
        renderDocumentList(searchEl ? searchEl.value : '', filterEl ? filterEl.value : 'all');
    }

    async function indexDocumentFile(docId, versionNo, file, quiet) {
        if (!fileKind(file)) return false;
        if (!quiet) showIndexProgress(`Indexing "${file.name}"...`);

        let status = 'done';
        let result = { text: '', pages: null };
        try {
            result = await extractTextFromFile(file, showIndexProgress);
        } catch (err) {
            console.error('Indexing failed:', err);
            status = 'failed';
        }

        const { error } = await supabaseClient.rpc('index_document_text', {
            p_document_id: docId,
            p_version_no: versionNo,
            p_text: cleanOcrText(result.text),
            p_pages: result.pages,
            p_status: status
        });
        if (error) {
            console.error('Saving document text failed:', error.message);
            status = 'failed';
        }

        if (!quiet) hideIndexProgress();
        refreshDocumentList();
        return status === 'done';
    }

    window.indexExistingDocument = async function(docId, quiet) {
        const doc = (window.__docsRegistry || {})[docId];
        if (!doc || !doc.file_path) return false;

        if (!quiet) showIndexProgress('Downloading the file...');
        try {
            const url = await getDocumentSignedUrl(doc.file_path);
            if (!url) throw new Error('Could not open the file.');
            const res = await fetch(url);
            if (!res.ok) throw new Error('Could not download the file.');
            const blob = await res.blob();
            const file = new File([blob], doc.title || 'document', { type: blob.type });
            return await indexDocumentFile(doc.id, doc.version_no || 1, file, quiet);
        } catch (err) {
            console.error('Index existing document failed:', err);
            if (!quiet) {
                hideIndexProgress();
                showToast('Could not index this document: ' + err.message, 'error');
            }
            return false;
        }
    };

    window.indexAllPendingDocuments = async function() {
        if (!isStaffUser()) return;
        const { data, error } = await supabaseClient
            .from('documents')
            .select('id, title, file_path, version_no, ocr_status')
            .not('file_path', 'is', null)
            .or('ocr_status.is.null,ocr_status.eq.failed,ocr_status.eq.processing');
        if (error) {
            showToast('Could not check documents: ' + error.message, 'error');
            return;
        }

        const pending = (data || []).filter(d => fileKind(d.title));
        if (pending.length === 0) {
            showToast('Every document that can be indexed is already searchable.', 'info');
            return;
        }
        if (!(await confirmDialog({ title: 'Make documents searchable', confirmLabel: 'Start indexing', message: `Index ${pending.length} document${pending.length === 1 ? '' : 's'}? Each file is read in your browser, which can take several minutes. Keep this tab open.` }))) return;

        window.__docsRegistry = window.__docsRegistry || {};
        let done = 0;
        for (let i = 0; i < pending.length; i++) {
            const d = pending[i];
            window.__docsRegistry[d.id] = d;
            showIndexProgress(`Document ${i + 1} of ${pending.length}: ${d.title}`);
            if (await window.indexExistingDocument(d.id, true)) done++;
        }
        hideIndexProgress();
        showToast(`Finished. ${done} of ${pending.length} documents are now searchable.`, 'success');
        refreshDocumentList();
    };

    async function loadCaseOptions() {
        if (isStaffUser()) {
            const { data, error } = await supabaseClient
                .from('cases')
                .select('id, case_number, title, client_id')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        }
        const { data, error } = await supabaseClient
            .from('cases')
            .select(casesSelect('id, case_number, title, client_id', true))
            .eq('case_lawyers.lawyer_id', currentUser.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    function caseOptionsHtml(cases, selectedId) {
        return '<option value="">No case (general document)</option>' + cases.map(c =>
            `<option value="${escapeHtml(c.id)}" data-client-id="${escapeHtml(c.client_id || '')}"${c.id === selectedId ? ' selected' : ''}>${escapeHtml((c.case_number ? c.case_number + ' — ' : '') + (c.title || 'Untitled case'))}</option>`
        ).join('');
    }

    function docFieldLabel(text) {
        return `<label style="display:block; font-size:13px; font-weight:600; color:#0f172a; margin-bottom:6px;">${text}</label>`;
    }

    const DOC_INPUT_STYLE = 'width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #cbd5e1; border-radius:6px; font-family:inherit; background:#f8fafc; margin-bottom:14px;';

    window.openEditDocumentModal = async function(docId) {
        const doc = (window.__docsRegistry || {})[docId];
        if (!doc) return;

        const modal = openUserModal('Edit document details', escapeHtml(doc.title || ''), '<p style="color:#64748b; text-align:center; padding:20px;">Loading...</p>');
        try {
            const cases = await loadCaseOptions();
            const categoryHtml = document.getElementById('doc-category') ? document.getElementById('doc-category').innerHTML : '';

            modal.body.innerHTML = `
                ${docFieldLabel('File name')}
                <input type="text" id="ed-title" maxlength="200" value="${escapeHtml(doc.title || '')}" style="${DOC_INPUT_STYLE}">
                ${docFieldLabel('Category')}
                <select id="ed-category" style="${DOC_INPUT_STYLE}">${categoryHtml}</select>
                ${docFieldLabel('Tags <span style="font-weight:400; color:#94a3b8;">(comma-separated)</span>')}
                <input type="text" id="ed-tags" value="${escapeHtml(doc.tags || '')}" placeholder="e.g., motion, criminal, dismissal" style="${DOC_INPUT_STYLE}">
                ${docFieldLabel('Case')}
                <select id="ed-case" style="${DOC_INPUT_STYLE}">${caseOptionsHtml(cases, doc.case_id)}</select>
                ${modalButtonsHtml('Save changes', '#0f172a')}
            `;

            const catSel = modal.body.querySelector('#ed-category');
            catSel.value = (doc.type || '').toLowerCase();
            const errEl = modal.body.querySelector('#um-error');
            const confirmBtn = modal.body.querySelector('#um-confirm');
            modal.body.querySelector('#um-cancel').addEventListener('click', modal.close);

            confirmBtn.addEventListener('click', async () => {
                const caseSel = modal.body.querySelector('#ed-case');
                const caseId = caseSel.value || null;
                const patch = {
                    title: keepExtension(modal.body.querySelector('#ed-title').value, doc.title),
                    type: (catSel.value || doc.type || 'document').toLowerCase(),
                    tags: modal.body.querySelector('#ed-tags').value.trim()
                };
                if (caseId !== (doc.case_id || null)) {
                    const opt = caseSel.selectedOptions[0];
                    patch.case_id = caseId;
                    patch.client_id = caseId && opt && opt.dataset.clientId ? Number(opt.dataset.clientId) : null;
                }

                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Saving...';
                const { data: updated, error } = await supabaseClient
                    .from('documents')
                    .update(patch)
                    .eq('id', doc.id)
                    .select('id');
                if (error || !updated || updated.length === 0) {
                    errEl.textContent = error ? error.message : 'Nothing was saved. You may not have permission to edit this document.';
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Save changes';
                    return;
                }
                modal.close();
                refreshDocumentList();
            });
        } catch (err) {
            console.error('Edit document modal error:', err);
            modal.body.innerHTML = errorStateHtml("Could not load this document's details.", null);
        }
    };

    window.openNewVersionModal = function(docId) {
        const doc = (window.__docsRegistry || {})[docId];
        if (!doc) return;

        const modal = openUserModal('Upload a new version', escapeHtml(doc.title || ''), `
            <p style="font-size:13px; color:#475569; margin:0 0 14px 0;">The current file (version ${doc.version_no || 1}) is kept in the version history. You can restore it at any time.</p>
            ${docFieldLabel('New file')}
            <input type="file" id="nv-file" accept=".pdf,.docx,.jpg,.jpeg,.png,.txt" style="${DOC_INPUT_STYLE}">
            ${docFieldLabel('What changed? <span style="font-weight:400; color:#94a3b8;">(optional)</span>')}
            <input type="text" id="nv-note" maxlength="200" placeholder="e.g., Signed copy from the client" style="${DOC_INPUT_STYLE}">
            ${modalButtonsHtml('Upload version', '#0f172a')}
        `);

        const errEl = modal.body.querySelector('#um-error');
        const confirmBtn = modal.body.querySelector('#um-confirm');
        modal.body.querySelector('#um-cancel').addEventListener('click', modal.close);

        confirmBtn.addEventListener('click', async () => {
            const file = modal.body.querySelector('#nv-file').files[0];
            const note = modal.body.querySelector('#nv-note').value.trim();
            if (!file) {
                errEl.textContent = 'Choose the new file first.';
                return;
            }
            if (file.size > 20 * 1024 * 1024) {
                errEl.textContent = 'The file is larger than 20 MB.';
                return;
            }

            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Uploading...';

            const path = `${Date.now()}_${safeStorageName(file.name)}`;
            const { error: uploadError } = await supabaseClient.storage.from('documents').upload(path, file);
            if (uploadError) {
                errEl.textContent = 'Upload failed: ' + uploadError.message;
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Upload version';
                return;
            }

            const willIndex = !!fileKind(file);
            const { data: newNo, error } = await supabaseClient.rpc('add_document_version', {
                p_document_id: doc.id,
                p_file_path: path,
                p_size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
                p_title: retitleForFile(doc.title, file),
                p_note: note || null,
                p_index: willIndex
            });
            if (error) {
                errEl.textContent = error.message;
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Upload version';
                return;
            }

            modal.close();
            refreshDocumentList();
            showToast(`Version ${newNo} saved. The previous version is kept in the history.`, 'success');
            if (willIndex) indexDocumentFile(doc.id, newNo, file);
        });
    };

    window.openDocumentHistory = async function(docId) {
        const doc = (window.__docsRegistry || {})[docId];
        if (!doc) return;

        const canVersion = isStaffUser() || doc.uploaded_by === currentUser.id || !!doc.case_id;
        const modal = openUserModal('Version history', escapeHtml(doc.title || ''), '<p style="color:#64748b; text-align:center; padding:20px;">Loading versions...</p>');

        try {
            const { data: versions, error } = await supabaseClient
                .from('document_versions')
                .select('id, version_no, file_path, size, title, uploaded_by, uploaded_at, change_note')
                .eq('document_id', docId)
                .order('version_no', { ascending: false });
            if (error) throw error;

            const currentBy = doc.version_uploaded_by || doc.uploaded_by;
            const names = await fetchProfileNameMap([currentBy, ...(versions || []).map(v => v.uploaded_by)]);

            const items = [{
                id: null,
                version_no: doc.version_no || 1,
                file_path: doc.file_path,
                size: doc.size,
                title: doc.title,
                by: names[currentBy] || 'Unknown',
                uploaded_at: doc.version_uploaded_at || doc.created_at,
                note: doc.version_note,
                current: true
            }].concat((versions || []).map(v => ({
                id: v.id,
                version_no: v.version_no,
                file_path: v.file_path,
                size: v.size,
                title: v.title,
                by: names[v.uploaded_by] || 'Unknown',
                uploaded_at: v.uploaded_at,
                note: v.change_note,
                current: false
            })));

            const btnStyle = 'padding:6px 12px; border:1px solid #e2e8f0; background:white; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600; color:#334155;';
            modal.body.innerHTML = items.map(v => `
                <div style="border:1px solid ${v.current ? '#bfdbfe' : '#e2e8f0'}; background:${v.current ? '#eff6ff' : '#ffffff'}; border-radius:10px; padding:12px 14px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <strong style="font-size:13px; color:#0f172a;">Version ${v.version_no}${v.current ? ' <span style="background:#dbeafe; color:#1d4ed8; font-size:10px; padding:2px 8px; border-radius:99px; margin-left:6px;">Current</span>' : ''}</strong>
                        <span style="font-size:11px; color:#64748b;">${escapeHtml(v.size || '')}</span>
                    </div>
                    <p style="font-size:11px; color:#64748b; margin:4px 0 0 0;">${escapeHtml(formatStamp(v.uploaded_at))} by ${escapeHtml(v.by)}</p>
                    ${v.note ? `<p style="font-size:12px; color:#334155; margin:6px 0 0 0;">${escapeHtml(v.note)}</p>` : ''}
                    <div style="display:flex; gap:8px; margin-top:10px;">
                        ${v.file_path ? `
                            <button type="button" data-vh-action="view" data-path="${escapeHtml(v.file_path)}" data-title="${escapeHtml(v.title || 'document')}" style="${btnStyle}"><i class="fa-regular fa-eye"></i> View</button>
                            <button type="button" data-vh-action="download" data-path="${escapeHtml(v.file_path)}" data-title="${escapeHtml(v.title || 'document')}" style="${btnStyle}"><i class="fa-solid fa-download"></i> Download</button>` : ''}
                        ${!v.current && canVersion ? `<button type="button" data-vh-action="restore" data-id="${escapeHtml(v.id)}" data-no="${v.version_no}" style="${btnStyle} color:#0ea5e9;"><i class="fa-solid fa-rotate-left"></i> Restore</button>` : ''}
                    </div>
                </div>
            `).join('') + ((versions || []).length === 0 ? '<p style="font-size:12px; color:#94a3b8; text-align:center; margin:8px 0 0 0;">No earlier versions yet.</p>' : '');

            modal.body.addEventListener('click', async (e) => {
                const btn = e.target.closest('[data-vh-action]');
                if (!btn) return;
                const action = btn.dataset.vhAction;

                if (action === 'view') {
                    window.openStoredDocument(btn.dataset.path, btn.dataset.title, false);
                } else if (action === 'download') {
                    window.openStoredDocument(btn.dataset.path, btn.dataset.title, true);
                } else if (action === 'restore') {
                    if (!(await confirmDialog({ title: 'Restore this version', confirmLabel: 'Restore', message: `Make version ${btn.dataset.no} the current version? The current file stays in the history.` }))) return;
                    btn.disabled = true;
                    const { error: restoreError } = await supabaseClient.rpc('restore_document_version', {
                        p_document_id: docId,
                        p_version_id: btn.dataset.id
                    });
                    if (restoreError) {
                        showToast('Could not restore: ' + restoreError.message, 'error');
                        btn.disabled = false;
                        return;
                    }
                    modal.close();
                    showToast('The version was restored as the current version.', 'success');
                    refreshDocumentList();
                }
            });
        } catch (err) {
            console.error('Version history error:', err);
            modal.body.innerHTML = errorStateHtml("Could not load the version history.", null);
        }
    };

    function setupDocumentFilters() {
        const searchInput = document.getElementById('doc-search-input');
        const filterSelect = document.getElementById('doc-filter');

        if (searchInput && filterSelect) {
            searchInput.placeholder = 'Search by file name, tag, or text inside documents...';

            let timer = null;
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value;
                clearTimeout(timer);
                timer = setTimeout(() => renderDocumentList(searchTerm, filterSelect.value), 300);
            });

            filterSelect.addEventListener('change', (e) => {
                renderDocumentList(searchInput.value, e.target.value);
            });
        }

        const meta = document.querySelector('.results-metadata');
        if (meta && isStaffUser() && !document.getElementById('btn-index-all')) {
            meta.style.display = 'flex';
            meta.style.alignItems = 'center';
            meta.style.justifyContent = 'space-between';
            meta.style.gap = '12px';
            const btn = document.createElement('button');
            btn.id = 'btn-index-all';
            btn.type = 'button';
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Make older documents searchable';
            btn.style.cssText = 'padding:8px 14px; border:1px solid #e2e8f0; background:white; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; color:#334155;';
            btn.addEventListener('click', () => window.indexAllPendingDocuments());
            meta.appendChild(btn);
        }
    }

    
    function safeStorageName(name) {
        const cleaned = String(name || 'file')
            .normalize('NFKD')
            .replace(/[^\w.\-]+/g, '_')
            .replace(/_+/g, '_');
        return cleaned.slice(-120) || 'file';
    }

    async function getDocumentSignedUrl(path, seconds = 300) {
        if (!path) return null;
        const { data, error } = await supabaseClient.storage.from('documents').createSignedUrl(path, seconds);
        if (error) {
            console.error('Signed URL error:', error.message);
            return null;
        }
        return data.signedUrl;
    }

    window.openStoredDocument = async function(path, title, asDownload) {
        if (!path) {
            showToast('No file attached to this record in the database.', 'warning');
            return;
        }
        const popup = asDownload ? null : window.open('about:blank', '_blank');
        const url = await getDocumentSignedUrl(path);
        if (!url) {
            if (popup) popup.close();
            showToast('Could not open this file. It may have been removed, or you may not have access to it.', 'error');
            return;
        }
        if (asDownload) {
            await forceDownload(url, title || 'document');
            return;
        }
        if (popup) {
            popup.opener = null;
            popup.location.href = url;
        } else {
            window.open(url, '_blank', 'noopener');
        }
    };

    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-doc-path]');
        if (!el) return;
        e.preventDefault();
        window.openStoredDocument(el.dataset.docPath, el.dataset.docTitle, false);
    });

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }


    function resolveDocumentTitle(customName, file) {
        const original = file ? file.name : '';
        const typed = (customName || '').trim();
        if (!typed) return original;

        const dot = original.lastIndexOf('.');
        const ext = dot > 0 ? original.slice(dot) : '';
        if (ext && !typed.toLowerCase().endsWith(ext.toLowerCase())) return typed + ext;
        return typed;
    }

    function getCategoryColor(type) {
        const t = (type || '').toLowerCase();
        if (t === 'motion' || t === 'motions') return { bg: '#e0e7ff', text: '#2563eb' }; 
        if (t === 'memoranda') return { bg: '#e0f2fe', text: '#0369a1' }; 
        if (t === 'affidavits') return { bg: '#fef3c7', text: '#b45309' }; 
        if (t === 'agreements') return { bg: '#ccfbf1', text: '#0f766e' }; 
        if (t === 'legal opinions') return { bg: '#ede9fe', text: '#6d28d9' }; 
        if (t === 'invoices') return { bg: '#fce7f3', text: '#be185d' }; 
        if (t === 'contract' || t === 'contracts') return { bg: '#dcfce7', text: '#16a34a' }; 
        if (t === 'pleading' || t === 'pleadings') return { bg: '#f3e8ff', text: '#9333ea' }; 
        if (t === 'evidence' || t === 'documentary evidence') return { bg: '#fef08a', text: '#ea580c' }; 
        if (t === 'order') return { bg: '#fee2e2', text: '#dc2626' }; 
        if (t === 'transcript') return { bg: '#ffedd5', text: '#c2410c' }; 
        if (t === 'estate') return { bg: '#fae8ff', text: '#a855f7' }; 
        return { bg: '#f1f5f9', text: '#475569' }; 
    }

    function generateTagsHtml(tagsStr) {
        if (!tagsStr) return '';
        const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
        return tags.map(t => `<span style="border: 1px solid #e2e8f0; padding: 2px 10px; border-radius: 99px; font-size: 11px; color: #475569; font-weight: 500;">${escapeHtml(t)}</span>`).join('');
    }

async function renderDocumentList(searchQuery = '', filterType = 'all') {
    const container = document.getElementById('documents-grid-inject');
    const countEl = document.getElementById('docs-found-count');
    if (!container || !currentUser) return;
    showSkeletonIfEmpty(container, skeletonGrid(4));

    try {
        let query = supabaseClient
            .from('documents')
            .select('id, title, type, size, uploaded_by, created_at, file_url, file_path, tags, case_id, client_id, ocr_status, ocr_pages, version_no, version_uploaded_by, version_uploaded_at, version_note, profiles(full_name), cases(case_number, title)')
            .order('created_at', { ascending: false });

        if (filterType && filterType !== 'all') {
            query = query.eq('type', filterType.toLowerCase());
        }

        const { data: documents, error } = await query;
        if (error) throw error;

        window.__docsRegistry = {};
        (documents || []).forEach(d => { window.__docsRegistry[d.id] = d; });

        const term = (searchQuery || '').trim().toLowerCase();
        const contentHits = {};
        if (term.length >= 3) {
            const { data: hits, error: hitError } = await supabaseClient.rpc('search_documents', { p_query: term });
            if (!hitError) (hits || []).forEach(h => { contentHits[h.id] = h.snippet; });
        }

        const filteredDocs = (documents || []).filter(doc => {
            if (!term) return true;
            const searchFields = [
                doc.title || '',
                doc.type || '',
                doc.tags || '',
                doc.cases?.case_number || '',
                doc.cases?.title || '',
                doc.profiles?.full_name || ''
            ].join(' ').toLowerCase();
            return searchFields.includes(term) || (doc.id in contentHits);
        });

        if (filteredDocs.length === 0) {
            container.innerHTML = '<p style="color:#64748b; grid-column: 1 / -1; text-align:center; padding: 40px;">No documents match your search/filter.</p>';
            if (countEl) countEl.textContent = 'Found 0 documents';
            return;
        }

        const staff = isStaffUser();
        const smallBtn = 'padding:6px 10px; border:1px solid #e2e8f0; background:white; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600; color:#475569; display:inline-flex; align-items:center; gap:5px;';

        container.innerHTML = filteredDocs.map(doc => {
            const hasFile = !!doc.file_path;
            const idArg = jsArg(doc.id);
            const onBtnClick = hasFile
                ? `openStoredDocument(${escapeHtml(JSON.stringify(doc.file_path))}, ${escapeHtml(JSON.stringify(doc.title || 'document'))}, false)`
                : `showToast('No file is attached to this document.', 'warning')`;
            const onDownloadClick = hasFile
                ? `openStoredDocument(${escapeHtml(JSON.stringify(doc.file_path))}, ${escapeHtml(JSON.stringify(doc.title || 'document'))}, true)`
                : `showToast('No file is attached to this document.', 'warning')`;

            const canEdit = staff || doc.uploaded_by === currentUser.id;
            const canVersion = canEdit || !!doc.case_id;
            const supported = !!fileKind(doc.title);
            const stamp = new Date(doc.version_uploaded_at || doc.created_at).getTime();
            const staleProcessing = doc.ocr_status === 'processing' && Date.now() - stamp > 15 * 60 * 1000;
            const needsIndex = canVersion && hasFile && supported && doc.ocr_status !== 'done' && (doc.ocr_status !== 'processing' || staleProcessing);

            let chip = '';
            if (doc.ocr_status === 'done') {
                chip = '<span style="background:#dcfce7; color:#16a34a; padding:3px 8px; border-radius:12px; font-size:10px; font-weight:600;"><i class="fa-solid fa-magnifying-glass"></i> Searchable</span>';
            } else if (doc.ocr_status === 'processing' && !staleProcessing) {
                chip = '<span style="background:#dbeafe; color:#1d4ed8; padding:3px 8px; border-radius:12px; font-size:10px; font-weight:600;"><i class="fa-solid fa-spinner fa-spin"></i> Indexing</span>';
            } else if (doc.ocr_status === 'failed') {
                chip = '<span style="background:#fee2e2; color:#dc2626; padding:3px 8px; border-radius:12px; font-size:10px; font-weight:600;">Index failed</span>';
            } else if (supported) {
                chip = '<span style="background:#f1f5f9; color:#64748b; padding:3px 8px; border-radius:12px; font-size:10px; font-weight:600;">Not indexed</span>';
            }

            const versionBadge = (doc.version_no || 1) > 1
                ? `<span style="background:#ede9fe; color:#6d28d9; padding:3px 8px; border-radius:12px; font-size:10px; font-weight:700;">v${doc.version_no}</span>`
                : '';

            const hit = contentHits[doc.id];
            const snippetHtml = (hit && hit.includes('<<'))
                ? `<div style="font-size:11px; color:#475569; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:8px 10px; margin-bottom:14px; line-height:1.5;"><i class="fa-solid fa-magnifying-glass" style="color:#f59e0b; margin-right:6px;"></i>…${escapeHtml(hit).replace(/&lt;&lt;/g, '<mark style="background:#fde047; padding:0 2px; border-radius:2px;">').replace(/&gt;&gt;/g, '</mark>')}…</div>`
                : '';

            const extraButtons = [
                (doc.version_no || 1) > 1 ? `<button type="button" onclick="openDocumentHistory(${idArg})" style="${smallBtn}"><i class="fa-solid fa-clock-rotate-left"></i> History</button>` : '',
                canVersion && hasFile ? `<button type="button" onclick="openNewVersionModal(${idArg})" style="${smallBtn}"><i class="fa-solid fa-file-circle-plus"></i> New version</button>` : '',
                canEdit ? `<button type="button" onclick="openEditDocumentModal(${idArg})" style="${smallBtn}"><i class="fa-solid fa-pen"></i> Edit</button>` : '',
                needsIndex ? `<button type="button" onclick="indexExistingDocument(${idArg})" style="${smallBtn}"><i class="fa-solid fa-wand-magic-sparkles"></i> Index</button>` : ''
            ].filter(Boolean).join('');

            const typeColor = getCategoryColor(doc.type);

            return `
            <div class="doc-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-sizing: border-box;">
                <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
                    <div style="background: #eff6ff; color: #3b82f6; width: 42px; height: 42px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i class="fa-solid fa-file-lines" style="font-size: 18px;"></i>
                    </div>
                    <div>
                        <h4 style="font-size: 14px; font-weight: 600; color: #0f172a; margin: 0 0 6px 0; word-break: break-word;">${escapeHtml(doc.title || 'Untitled Document')}</h4>
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                            <span style="background: ${typeColor.bg}; color: ${typeColor.text}; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: lowercase;">${escapeHtml(doc.type || 'document')}</span>
                            <span style="font-size: 11px; color: #64748b;">${escapeHtml(doc.size || '0 KB')}</span>
                            ${versionBadge}
                            ${chip}
                        </div>
                    </div>
                </div>

                ${snippetHtml}

                <div style="font-size: 12px; color: #475569; margin-bottom: 15px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-tag" style="color: #94a3b8; width: 14px; text-align: center;"></i>
                        ${escapeHtml(doc.cases?.case_number || 'No Case Number')}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-regular fa-user" style="color: #94a3b8; width: 14px; text-align: center;"></i>
                        ${escapeHtml(doc.profiles?.full_name || 'System')}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-regular fa-calendar" style="color: #94a3b8; width: 14px; text-align: center;"></i>
                        ${formatDate(doc.created_at)}
                    </div>
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px;">
                    ${generateTagsHtml(doc.tags)}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                    <button onclick="${onBtnClick}" style="padding: 10px; border: 1px solid #e2e8f0; background: white; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; color: #0f172a; transition: 0.2s; display: flex; justify-content: center; align-items: center; gap: 6px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                        <i class="fa-regular fa-eye"></i> View
                    </button>
                    <button onclick="${onDownloadClick}" style="padding: 10px; border: 1px solid #e2e8f0; background: white; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; color: #0f172a; transition: 0.2s; display: flex; justify-content: center; align-items: center; gap: 6px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                        <i class="fa-solid fa-download"></i> Download
                    </button>
                </div>
                ${extraButtons ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">${extraButtons}</div>` : ''}
            </div>
        `;
        }).join('');

        if (countEl) countEl.textContent = `Found ${filteredDocs.length} document${filteredDocs.length > 1 ? 's' : ''}`;
    } catch (error) {
        console.error('Error rendering documents:', error);
        container.innerHTML = errorStateHtml('Could not load documents.', 'refreshDocumentList');
    }
}
    async function forceDownload(url, filename) {
        if (!url || url === '#') { 
            showToast('File URL is missing.', 'error'); 
            return; 
        }
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network response was not ok");
            
            const blob = await response.blob();
            
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = filename; 
            document.body.appendChild(a);
            
            a.click(); 
            
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
        } catch (e) {
            console.error('Download failed, opening in new tab instead', e);
            window.open(url, '_blank'); 
        }
    }

    async function renderMyScheduleContent() {
        if (!currentUser) return;

        await updateScheduleProfileHeader();
        await renderTimelineInSchedule();
        await renderRecentDocumentsInSchedule();
        await updateScheduleStats();
        
        await renderMyCasesTab();
        renderPerformanceTab();
        renderAdminAttention();
    }

    async function updateScheduleProfileHeader() {
        if (!currentUser) return;

        try {
            let displayName = "User";
            let role = "Lawyer";
            let specialization = "General Practice";

            if (currentUser.email) {
                const emailPrefix = currentUser.email.split('@')[0];
                displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
                
                const lowerEmail = currentUser.email.toLowerCase();
                if (lowerEmail.includes('secretary') || lowerEmail.includes('admin')) {
                    role = 'Administrator';
                    specialization = 'Firm Administration';
                }
            }

            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('*, roles(name)')
                .eq('id', currentUser.id)
                .single();

            if (profile) {
                if (profile.full_name) displayName = profile.full_name;
                if (profile.roles && profile.roles.name) role = roleLabel(profile.roles.name);
                if (profile.specialization) specialization = profile.specialization;
                
                const phoneEl = document.querySelector('.contact-text span:last-child');
                if (phoneEl) phoneEl.innerHTML = `<i class="fa-solid fa-phone"></i> ${escapeHtml(profile.phone || '(555) 000-0000')}`;
            } else if (currentUser.user_metadata) {
                if (currentUser.user_metadata.full_name) displayName = currentUser.user_metadata.full_name;
            }

            const avatarLarge = document.querySelector('.avatar-large');
            if (avatarLarge) {
                if (profile && profile.avatar_url) {
                    avatarLarge.innerHTML = `<img src="${escapeHtml(profile.avatar_url)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%; display:block;">`;
                } else {
                    avatarLarge.innerHTML = '';
                    avatarLarge.textContent = getInitials(displayName);
                }
            }

            const nameEl = document.querySelector('.profile-info-flex h2');
            const roleEl = document.querySelector('.role-text');
            const emailEl = document.querySelector('.contact-text span:first-child');

            if (nameEl) nameEl.textContent = `Atty. ${displayName}`;
            if (roleEl) roleEl.textContent = `${role.charAt(0).toUpperCase() + role.slice(1)} - ${specialization}`;
            if (emailEl) emailEl.innerHTML = `<i class="fa-regular fa-envelope"></i> ${escapeHtml(currentUser.email)}`;
            
        } catch (error) {
            console.error('Error updating profile header in My Schedule:', error);
        }
    }


    async function getActiveClientsData() {
        let clientsQuery = supabaseClient
            .from('clients')
            .select(`id, client_name, client_email, client_phone, cases!inner(status, ${(globalUserRole === 'lawyer' && currentUser) ? 'case_lawyers!inner' : 'case_lawyers'}(lawyer_id, is_lead, profiles(full_name)))`)
            .eq('cases.status', 'active');

        if (globalUserRole === 'lawyer' && currentUser) {
            clientsQuery = clientsQuery.eq('cases.case_lawyers.lawyer_id', currentUser.id);
        }

        const { data: rows, error } = await clientsQuery;
        if (error) throw error;

        const byId = new Map();
        (rows || []).forEach(row => {
            if (!byId.has(row.id)) {
                byId.set(row.id, {
                    id: row.id,
                    client_name: row.client_name,
                    client_email: row.client_email,
                    client_phone: row.client_phone,
                    lawyerNames: new Set()
                });
            }
            (row.cases || []).forEach(c => {
                (c.case_lawyers || []).forEach(cl => {
                    if (cl.profiles?.full_name) byId.get(row.id).lawyerNames.add(cl.profiles.full_name);
                });
            });
        });
        const clients = Array.from(byId.values());


        return { clients };
    }

    async function getActiveLawyersData() {
        const { data: lawyerRows, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name, specialization, phone, roles!inner(name)')
            .eq('roles.name', 'lawyer')
            .eq('status', 'active')
            .order('full_name', { ascending: true });
        if (error) throw error;
        return lawyerRows || [];
    }

    async function updateScheduleStats() {
        if (!currentUser) return;

        try {

            const isAdminView = globalUserRole !== 'lawyer';

            let activeCases = 0;
            try {
                let casesCountQuery = supabaseClient
                    .from('cases')
                    .select(casesSelect('*', !isAdminView), { count: 'exact', head: true })
                    .eq('status', 'active');
                if (!isAdminView) casesCountQuery = filterMyCases(casesCountQuery);
                const { count, error } = await casesCountQuery;
                if (!error) activeCases = count;
            } catch (e) {}

            const localDate = new Date();
            const todayStr = localDate.toISOString().split('T')[0];
            
            const nextWeekDate = new Date(localDate);
            nextWeekDate.setDate(nextWeekDate.getDate() + 7);
            const nextWeekStr = nextWeekDate.toISOString().split('T')[0];

            let upcomingQuery = supabaseClient
                .from('calendar_events')
                .select('*')
                .gte('start_date', todayStr)
                .lte('start_date', nextWeekStr);
            if (!isAdminView) upcomingQuery = upcomingQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
            const { data: upcomingEvents } = await upcomingQuery;

            const deadlinesCount = upcomingEvents ? upcomingEvents.length : 0;

            const pastWindowDate = new Date(localDate);
            pastWindowDate.setDate(pastWindowDate.getDate() - 60);
            const pastWindowStr = pastWindowDate.toISOString().split('T')[0];

            let completedCount = 0;
            if (isAdminView) {

                const nowISO = new Date().toISOString();
                const oneHourAgoISO = new Date(Date.now() - 60 * 60 * 1000).toISOString();
                const { count: completedTotal, error: completedErr } = await supabaseClient
                    .from('calendar_events')
                    .select('*', { count: 'exact', head: true })
                    .or(`end_date.lt.${nowISO},and(end_date.is.null,start_date.lt.${oneHourAgoISO})`);
                if (completedErr) console.error('Error counting completed events:', completedErr);
                completedCount = completedTotal || 0;
            } else {
                const { data: recentEvents } = await supabaseClient
                    .from('calendar_events')
                    .select('start_date, end_date')
                    .gte('start_date', pastWindowStr)
                    .or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
                completedCount = (recentEvents || []).filter(ev => getEventStatusInfo(ev.start_date, ev.end_date).label === 'Completed').length;
            }

            let activeClientsCount = 0;
            try {
                const { clients } = await getActiveClientsData();
                activeClientsCount = clients.length;
            } catch (e) {}

            let activeLawyersCount = null;
            if (globalUserRole !== 'lawyer') {
                try {
                    activeLawyersCount = (await getActiveLawyersData()).length;
                } catch (e) { activeLawyersCount = 0; }
            }

            const statCards = document.querySelectorAll('.sched-stat-card h3');
            if (statCards.length >= 4) {
                statCards[0].textContent = activeCases || '0';
                statCards[1].textContent = deadlinesCount || '0';
                statCards[2].textContent = completedCount || '0';
                statCards[3].textContent = activeClientsCount || '0';
            }
            if (statCards.length >= 5 && activeLawyersCount !== null) {
                statCards[4].textContent = activeLawyersCount || '0';
            }
        } catch (error) {
            console.error('Error updating schedule stats:', error);
        }
    }

    async function renderTimelineInSchedule() {
        const timeline = document.getElementById('timeline-inject');
        if (!timeline || !currentUser) return;
        showSkeletonIfEmpty(timeline, skeletonRows(2));

        try {
            const localDate = new Date();
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;
            const { startISO: todayStart, endISO: todayEnd } = getDayRange(todayStr);

            const { data: events } = await supabaseClient
                .from('calendar_events')
                .select('*')
                .gte('start_date', todayStart)
                .lte('start_date', todayEnd)
                .or(`assigned_to.eq.${currentUser.id},is_general.eq.true`)
                .order('start_date', { ascending: true });

            if (events && events.length > 0) {
                timeline.innerHTML = events.map(ev => {
                    const colorClass = ev.is_conflict ? 'bar-red' : (ev.is_general ? 'bar-purple' : 'bar-blue');
                    const priorityBadge = ev.priority === 'high' ? '<span class="badge-pill bg-red">High Priority</span>' : '';
                    const generalBadge = ev.is_general ? '<span class="badge-pill bg-purple">Firm-wide</span>' : '';
                    const statusInfo = getEventStatusInfo(ev.start_date, ev.end_date);
                    const isDone = statusInfo.label === 'Completed';
                    const statusBadge = `<span style="background:${statusInfo.bg}; color:${statusInfo.color}; font-size:10px; padding:2px 9px; border-radius:99px; font-weight:600;"><i class="fa-solid ${statusInfo.icon}" style="margin-right:3px;"></i>${statusInfo.label}</span>`;

                    return `
                        <div class="timeline-item ${colorClass}" style="${isDone ? 'opacity:0.65;' : ''}">
                            <div class="time-row">
                                <strong>${formatEventTime(ev.start_date) || 'All Day'}</strong> 
                                ${priorityBadge}
                                ${generalBadge}
                                ${statusBadge}
                            </div>
                            <h4>${escapeHtml(ev.title)}</h4>
                            <div class="timeline-meta">
                                <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(ev.location || 'Office')}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                timeline.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">No events scheduled for today</p>';
            }
        } catch (error) {
            console.error('Error rendering timeline:', error);
            timeline.innerHTML = errorStateHtml("Could not load today's schedule.", 'renderTimelineInSchedule');
        }
    }

    async function renderRecentDocumentsInSchedule() {
        const list = document.getElementById('recent-docs-inject');
        if (!list || !currentUser) return;
        showSkeletonIfEmpty(list, skeletonRows(2));

        try {

            const { data: documents } = await supabaseClient
                .from('documents')
                .select('id, title, type, created_at')
                .eq('uploaded_by', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(3);

            if (documents && documents.length > 0) {
                list.innerHTML = documents.map(doc => `
                    <div style="background:#f8fafc; border-radius:10px; padding:15px; margin-bottom:12px; display:flex; align-items:center; gap:15px;">
                        <div style="background:#eff6ff; color:#3b82f6; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                            <i class="fa-solid fa-file-lines"></i>
                        </div>
                        <div>
                            <h4 style="font-size:13px; color:#1e293b; margin-bottom:4px;">${escapeHtml(doc.title)}</h4>
                            <p style="font-size:11px; color:#64748b; text-transform:capitalize;">${escapeHtml(doc.type || 'Doc')}</p>
                        </div>
                    </div>
                `).join('');
            } else {
                list.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">No recent documents</p>';
            }
        } catch (error) {
            console.error('Error rendering recent documents:', error);
            list.innerHTML = errorStateHtml('Could not load recent documents.', 'renderRecentDocumentsInSchedule');
        }
    }

    async function renderMyCasesTab() {
        const container = document.querySelector('#sched-cases .content-card');
        if (!container || !currentUser) return;

        try {
            const { data: cases, error } = await supabaseClient
                .from('cases')
                .select(casesSelect('*, clients(client_name)', true))
                .eq('case_lawyers.lawyer_id', currentUser.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            if (cases && cases.length > 0) {
                let html = '<h3 style="margin-bottom: 20px; font-size: 16px;">My Active Cases</h3>';
                cases.forEach(c => {
                    const statusColor = c.status === 'active' ? '#3b82f6' : '#64748b';
                    const statusBg = c.status === 'active' ? '#eff6ff' : '#f1f5f9';
                    
                    const clientName = c.clients ? c.clients.client_name : 'No Client';

                    html += `
                        <div style="padding: 15px; border: 1px solid #f1f5f9; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; background: #fafbfc;">
                            <div>
                                <h4 style="color: #0f172a; margin-bottom: 4px; font-size: 14px;">${escapeHtml(c.title)} <span style="color:#64748b; font-weight:normal; font-size:12px;">(${escapeHtml(clientName)})</span></h4>
                                <p style="color: #64748b; font-size: 11px;"><i class="fa-regular fa-clock"></i> Filed: ${formatDate(c.date_filed || c.created_at)}</p>
                            </div>
                            <span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 10px; border-radius: 99px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                                ${c.status}
                            </span>
                        </div>
                    `;
                });
                container.innerHTML = html;
            } else {
                container.innerHTML = '<p style="color:#64748b; padding:20px; text-align:center;">No active cases found. Add an event to create a case automatically!</p>';
            }
        } catch (error) {
            console.warn("Could not load my cases tab.");
            container.innerHTML = errorStateHtml("Could not load your cases.", "renderMyCasesTab");
        }
    }

    function perfBarRow(label, value, max, color) {
        const pct = max > 0 ? Math.round((value / max) * 100) : 0;
        return `
            <div style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;">
                    <span style="color:#475569;">${escapeHtml(label)}</span>
                    <strong style="color:#0f172a;">${value}</strong>
                </div>
                <div style="background:#f1f5f9; height:8px; border-radius:4px; overflow:hidden;">
                    <div style="background:${color}; width:${pct}%; height:100%; border-radius:4px;"></div>
                </div>
            </div>`;
    }

    function perfKpi(label, value, color) {
        return `
            <div style="flex:1; min-width:140px; background:#f8fafc; border:1px solid #f1f5f9; border-radius:12px; padding:14px 16px;">
                <div style="font-size:24px; font-weight:800; color:${color};">${value}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">${escapeHtml(label)}</div>
            </div>`;
    }

    function perfPanel(title, bodyHtml) {
        return `
            <div style="border:1px solid #f1f5f9; border-radius:14px; padding:18px 20px; background:#ffffff;">
                <h4 style="margin:0 0 14px 0; font-size:13px; color:#0f172a;">${escapeHtml(title)}</h4>
                ${bodyHtml}
            </div>`;
    }

    function lastSixMonths() {
        const out = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            out.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleDateString('en-US', { month: 'short' })
            });
        }
        return out;
    }

    function perfMonthlyChart(months, opened, closed) {
        const max = Math.max(1, ...months.map(m => Math.max(opened[m.key] || 0, closed ? (closed[m.key] || 0) : 0)));
        const bar = (v, color) => `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:flex-end;">
                <span style="font-size:10px; color:#475569; margin-bottom:2px;">${v}</span>
                <div style="width:16px; height:${Math.max(2, Math.round((v / max) * 100))}px; background:${color}; border-radius:4px 4px 0 0;"></div>
            </div>`;
        const columns = months.map(m => `
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end;">
                <div style="display:flex; align-items:flex-end; gap:4px;">
                    ${bar(opened[m.key] || 0, '#3b82f6')}
                    ${closed ? bar(closed[m.key] || 0, '#22c55e') : ''}
                </div>
                <span style="font-size:10px; color:#64748b; margin-top:6px;">${escapeHtml(m.label)}</span>
            </div>`).join('');
        const legend = `
            <div style="display:flex; gap:14px; margin-top:12px; font-size:11px; color:#64748b;">
                <span><span style="display:inline-block; width:8px; height:8px; background:#3b82f6; border-radius:2px; margin-right:5px;"></span>Opened</span>
                ${closed ? '<span><span style="display:inline-block; width:8px; height:8px; background:#22c55e; border-radius:2px; margin-right:5px;"></span>Closed</span>' : ''}
            </div>`;
        return `<div style="display:flex; align-items:flex-end; gap:10px; height:150px;">${columns}</div>${legend}`;
    }

    async function fetchWorkloadData() {
        const nowIso = new Date().toISOString();
        const weekIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const [casesRes, eventsRes] = await Promise.all([
            supabaseClient.from('cases').select('id, status, case_lawyers(lawyer_id, is_lead)').eq('status', 'active'),
            supabaseClient.from('calendar_events').select('assigned_to').eq('is_general', false).gte('start_date', nowIso).lte('start_date', weekIso)
        ]);
        return { cases: casesRes.data || [], events: eventsRes.data || [] };
    }

    function computeWorkload(cases, events) {
        const map = {};
        const slot = id => map[id] || (map[id] = { active: 0, lead: 0, events: 0 });
        (cases || []).forEach(c => {
            if (c.status === 'closed') return;
            (c.case_lawyers || []).forEach(r => {
                const w = slot(r.lawyer_id);
                w.active++;
                if (r.is_lead) w.lead++;
            });
        });
        (events || []).forEach(e => { if (e.assigned_to) slot(e.assigned_to).events++; });
        return map;
    }

    function workloadLine(w) {
        const x = w || { active: 0, lead: 0, events: 0 };
        return `<p style="margin:4px 0 0 0; font-size:11px; color:#3b82f6;"><i class="fa-solid fa-briefcase" style="font-size:10px;"></i> ${x.active} active case${x.active === 1 ? '' : 's'} • ${x.lead} as lead • ${x.events} event${x.events === 1 ? '' : 's'} in the next 7 days</p>`;
    }

    async function renderPerformanceTab() {
        const container = document.querySelector('#sched-perf .content-card');
        if (!container || !currentUser) return;

        container.innerHTML = skeletonRows(4);

        try {
            const isLawyerView = globalUserRole === 'lawyer';
            const nowIso = new Date().toISOString();
            const weekIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            let casesQuery = supabaseClient.from('cases').select(casesSelect('*', isLawyerView));
            if (isLawyerView) casesQuery = filterMyCases(casesQuery);

            let eventsQuery = supabaseClient
                .from('calendar_events')
                .select('assigned_to')
                .eq('is_general', false)
                .gte('start_date', nowIso)
                .lte('start_date', weekIso);
            if (isLawyerView) eventsQuery = eventsQuery.eq('assigned_to', currentUser.id);

            const [casesRes, eventsRes] = await Promise.all([casesQuery, eventsQuery]);
            if (casesRes.error) throw casesRes.error;

            const cases = casesRes.data || [];
            const events = eventsRes.data || [];
            const active = cases.filter(c => c.status !== 'closed');
            const closed = cases.filter(c => c.status === 'closed');
            const closureRate = cases.length > 0 ? Math.round((closed.length / cases.length) * 100) : 0;

            const stageCounts = {};
            CASE_STAGES.forEach(st => { stageCounts[st] = 0; });
            active.forEach(c => { if (c.case_stage in stageCounts) stageCounts[c.case_stage]++; });
            const stageMax = Math.max(0, ...Object.values(stageCounts));

            const typeCounts = {};
            CASE_TYPES.forEach(t => { typeCounts[t] = 0; });
            active.forEach(c => { if (c.case_type in typeCounts) typeCounts[c.case_type]++; });
            const typeMax = Math.max(0, ...Object.values(typeCounts));

            const months = lastSixMonths();
            const openedByMonth = {};
            cases.forEach(c => {
                const key = toLocalDateKey(c.date_filed || c.created_at).slice(0, 7);
                openedByMonth[key] = (openedByMonth[key] || 0) + 1;
            });
            const tracksClosing = cases.length > 0 && 'closed_at' in cases[0];
            let closedByMonth = null;
            if (tracksClosing) {
                closedByMonth = {};
                closed.forEach(c => {
                    if (!c.closed_at) return;
                    const key = toLocalDateKey(c.closed_at).slice(0, 7);
                    closedByMonth[key] = (closedByMonth[key] || 0) + 1;
                });
            }

            const workload = computeWorkload(cases, events);
            let kpis = '';
            let workloadPanel = '';

            if (isLawyerView) {
                kpis = [
                    perfKpi('My active cases', active.length, '#3b82f6'),
                    perfKpi('My closed cases', closed.length, '#22c55e'),
                    perfKpi('Closure rate', closureRate + '%', '#a855f7'),
                    perfKpi('Events in the next 7 days', events.length, '#f97316')
                ].join('');
            } else {
                const lawyers = await getActiveLawyersData();
                const unassigned = active.filter(c => !(c.case_lawyers || []).length).length;
                const totalLoad = lawyers.reduce((sum, l) => sum + ((workload[l.id] || {}).active || 0), 0);
                const avgLoad = lawyers.length > 0 ? totalLoad / lawyers.length : 0;
                const maxLoad = Math.max(1, ...lawyers.map(l => (workload[l.id] || {}).active || 0));

                kpis = [
                    perfKpi('Active cases', active.length, '#3b82f6'),
                    perfKpi('Closed cases', closed.length, '#22c55e'),
                    perfKpi('Closure rate', closureRate + '%', '#a855f7'),
                    perfKpi('Avg. active cases per lawyer', avgLoad.toFixed(1), '#f97316'),
                    perfKpi('Active cases without a lawyer', unassigned, unassigned > 0 ? '#ef4444' : '#22c55e')
                ].join('');

                const rows = lawyers
                    .map(l => ({ l, w: workload[l.id] || { active: 0, lead: 0, events: 0 } }))
                    .sort((a, b) => b.w.active - a.w.active)
                    .map(({ l, w }) => {
                        const high = w.active >= 4 && w.active > avgLoad * 1.5;
                        const flag = high
                            ? '<span style="background:#fee2e2; color:#ef4444; font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px;">High load</span>'
                            : (w.active === 0 ? '<span style="background:#dcfce7; color:#16a34a; font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px;">Available</span>' : '');
                        return `
                            <tr>
                                <td style="padding:10px 8px; border-bottom:1px solid #f1f5f9; font-weight:600; color:#0f172a;">Atty. ${escapeHtml(l.full_name || 'Unnamed')}</td>
                                <td style="padding:10px 8px; border-bottom:1px solid #f1f5f9; width:34%;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <div style="flex:1; background:#f1f5f9; height:8px; border-radius:4px; overflow:hidden;">
                                            <div style="background:${high ? '#ef4444' : '#3b82f6'}; width:${Math.round((w.active / maxLoad) * 100)}%; height:100%;"></div>
                                        </div>
                                        <strong style="font-size:12px; color:#0f172a; min-width:18px;">${w.active}</strong>
                                    </div>
                                </td>
                                <td style="padding:10px 8px; border-bottom:1px solid #f1f5f9; color:#475569;">${w.lead}</td>
                                <td style="padding:10px 8px; border-bottom:1px solid #f1f5f9; color:#475569;">${w.events}</td>
                                <td style="padding:10px 8px; border-bottom:1px solid #f1f5f9;">${flag}</td>
                            </tr>`;
                    }).join('');

                workloadPanel = perfPanel('Lawyer workload', lawyers.length === 0
                    ? '<p style="color:#64748b; font-size:13px; margin:0;">No active lawyers yet.</p>'
                    : `
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
                                <thead>
                                    <tr style="color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:0.04em;">
                                        <th style="padding:8px;">Lawyer</th>
                                        <th style="padding:8px;">Active cases</th>
                                        <th style="padding:8px;">As lead</th>
                                        <th style="padding:8px;">Events (7 days)</th>
                                        <th style="padding:8px;"></th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>`);
            }

            const stagePanel = perfPanel('Active cases by stage',
                CASE_STAGES.map(st => perfBarRow(st, stageCounts[st], stageMax, '#3b82f6')).join(''));
            const typePanel = perfPanel('Active cases by type',
                CASE_TYPES.map(t => perfBarRow(t, typeCounts[t], typeMax, '#8b5cf6')).join(''));
            const monthPanel = perfPanel('Cases opened and closed (last 6 months)', perfMonthlyChart(months, openedByMonth, closedByMonth));

            container.innerHTML = `
                <h3 style="margin-bottom:18px; font-size:16px;">${isLawyerView ? 'My Performance' : 'Firm Performance'}</h3>
                <div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:20px;">${kpis}</div>
                ${workloadPanel ? `<div style="margin-bottom:20px;">${workloadPanel}</div>` : ''}
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
                    ${monthPanel}
                    ${stagePanel}
                    ${typePanel}
                </div>
                ${tracksClosing ? '' : '<p style="font-size:11px; color:#94a3b8; margin:14px 0 0 0;">Closed-per-month needs the closed_at column. Run dashboard_support.sql to enable it.</p>'}
            `;
        } catch (error) {
            console.error('Error rendering performance tab:', error);
            container.innerHTML = errorStateHtml("Could not load performance data.", "renderPerformanceTab");
        }
    }

    function setNavBadge(target, count) {
        const nav = document.querySelector(`.nav-links li[data-target="${target}"]`);
        if (!nav) return;
        let badge = nav.querySelector('.nav-badge');
        if (!count) {
            if (badge) badge.remove();
            return;
        }
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'nav-badge';
            badge.style.cssText = 'margin-left:auto; background:#ef4444; color:#ffffff; font-size:10px; font-weight:700; padding:2px 7px; border-radius:99px;';
            nav.appendChild(badge);
        }
        badge.textContent = count;
    }

    function setClientsNavBadge(count) {
        setNavBadge('clients-view', count);
    }

    async function renderAdminAttention() {
        const dash = document.getElementById('dashboard-view');
        if (!dash || !currentUser) return;

        let card = document.getElementById('admin-attention-card');
        if (!isStaffUser()) {
            if (card) card.remove();
            setClientsNavBadge(0);
            return;
        }

        const statsRow = dash.querySelector('.schedule-stats-row');
        if (!statsRow) return;
        if (!card) {
            card = document.createElement('div');
            card.id = 'admin-attention-card';
            card.className = 'content-card';
            card.style.marginBottom = '25px';
            statsRow.parentNode.insertBefore(card, statsRow);
            card.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-attn]');
                if (!btn) return;
                const action = btn.getAttribute('data-attn');
                const filterEl = document.getElementById('clients-status-filter');
                if (action === 'clients-pending' || action === 'clients-unassigned') {
                    if (filterEl) filterEl.value = action === 'clients-pending' ? 'pending' : 'approved';
                    const nav = document.querySelector('.nav-links li[data-target="clients-view"]');
                    if (nav) nav.click();
                } else if (action === 'cases-unassigned') {
                    const nav = document.querySelector('.nav-links li[data-target="cases-view"]');
                    if (nav) nav.click();
                }
            });
        }

        try {
            const [clientsRes, casesRes] = await Promise.all([
                supabaseClient.from('clients').select('id, approval_status, client_lawyers(lawyer_id)').in('approval_status', ['pending', 'approved']),
                supabaseClient.from('cases').select('id, case_lawyers(lawyer_id)').eq('status', 'active')
            ]);
            if (clientsRes.error) throw clientsRes.error;
            if (casesRes.error) throw casesRes.error;

            const clientRows = clientsRes.data || [];
            const pending = clientRows.filter(c => c.approval_status === 'pending').length;
            const clientsNoLawyer = clientRows.filter(c => c.approval_status === 'approved' && !(c.client_lawyers || []).length).length;
            const casesNoLawyer = (casesRes.data || []).filter(c => !(c.case_lawyers || []).length).length;

            setClientsNavBadge(pending);

            const admin = isAdminUser();
            const items = [];
            if (pending > 0) {
                items.push({ icon: 'fa-user-clock', color: '#f59e0b', bg: '#fffbeb', action: 'clients-pending',
                    text: `${pending} client${pending === 1 ? '' : 's'} waiting for approval`, button: admin ? 'Review' : 'View' });
            }
            if (clientsNoLawyer > 0) {
                items.push({ icon: 'fa-user-slash', color: '#ef4444', bg: '#fef2f2', action: 'clients-unassigned',
                    text: `${clientsNoLawyer} approved client${clientsNoLawyer === 1 ? ' has' : 's have'} no assigned lawyer`, button: admin ? 'Assign' : 'View' });
            }
            if (casesNoLawyer > 0) {
                items.push({ icon: 'fa-briefcase', color: '#ef4444', bg: '#fef2f2', action: 'cases-unassigned',
                    text: `${casesNoLawyer} active case${casesNoLawyer === 1 ? ' has' : 's have'} no lawyer`, button: 'View cases' });
            }

            const body = items.length === 0
                ? `<div style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; background:#f0fdf4; color:#16a34a; font-size:13px; font-weight:600;"><i class="fa-regular fa-circle-check"></i> Nothing needs your attention right now.</div>`
                : items.map(it => `
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border-radius:10px; background:${it.bg}; margin-bottom:10px;">
                        <span style="display:flex; align-items:center; gap:10px; font-size:13px; color:#0f172a;">
                            <i class="fa-solid ${it.icon}" style="color:${it.color};"></i> ${escapeHtml(it.text)}
                        </span>
                        <button type="button" data-attn="${it.action}" style="padding:7px 14px; border:1px solid #e2e8f0; background:#ffffff; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; color:#334155;">${escapeHtml(it.button)}</button>
                    </div>`).join('');

            card.innerHTML = `
                <div class="card-title-flex">
                    <h3><i class="fa-solid fa-bell-concierge"></i> Needs your attention</h3>
                </div>
                ${body}`;
        } catch (error) {
            console.error('Error rendering attention card:', error);
            card.innerHTML = errorStateHtml("Could not load pending items.", "renderAdminAttention");
        }
    }

    function setupScheduleTabs() {
        const schedTabs = document.querySelectorAll('.sched-tab-btn');
        
        schedTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const targetId = this.getAttribute('data-scheduletab');
                if(!targetId) return;

                schedTabs.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                document.querySelectorAll('.sched-tab-content').forEach(content => {
                    content.classList.add('hidden');
                });
                
                const activeContent = document.getElementById(targetId);
                if(activeContent) activeContent.classList.remove('hidden');
            });
        });
    }

    function setupScheduleButtons() {
        const viewAllDocsBtn = document.getElementById('btn-sched-view-docs');
        if (viewAllDocsBtn) {
            viewAllDocsBtn.addEventListener('click', () => {
                const docsNavLink = document.querySelector('.nav-links li[data-target="documents-view"]');
                if (docsNavLink) docsNavLink.click();
            });
        }
    }

    const NOTIF_STYLES = {
        client_pending: { icon: 'fa-solid fa-user-clock', color: '#f59e0b' },
        client_approved: { icon: 'fa-regular fa-circle-check', color: '#22c55e' },
        client_rejected: { icon: 'fa-regular fa-circle-xmark', color: '#ef4444' },
        case_assigned: { icon: 'fa-solid fa-briefcase', color: '#3b82f6' },
        client_assigned: { icon: 'fa-solid fa-user-tie', color: '#3b82f6' },
        conflict: { icon: 'fa-solid fa-triangle-exclamation', color: '#ef4444' },
        event_reminder: { icon: 'fa-regular fa-bell', color: '#a855f7' },
        email_failed: { icon: 'fa-solid fa-triangle-exclamation', color: '#ef4444' }
    };

    const EMAIL_STATUS = {
        pending: { label: 'Pending', bg: '#fef3c7', color: '#b45309' },
        processing: { label: 'Sending', bg: '#dbeafe', color: '#1d4ed8' },
        sent: { label: 'Sent', bg: '#dcfce7', color: '#16a34a' },
        failed: { label: 'Failed', bg: '#fee2e2', color: '#dc2626' }
    };

    function emailStatusBadge(status) {
        const st = EMAIL_STATUS[status] || EMAIL_STATUS.pending;
        return `<span style="background:${st.bg}; color:${st.color}; font-size:10px; padding:2px 8px; border-radius:99px; font-weight:700; white-space:nowrap;">${st.label}</span>`;
    }

    function emailTimeText(m) {
        if (m.status === 'sent') return `Sent ${formatStamp(m.sent_at)}`;
        if (m.status === 'failed') return `Failed after ${m.attempts} attempt${m.attempts === 1 ? '' : 's'}`;
        if (m.status === 'processing') return 'Sending now';
        if (m.attempts > 0 && m.next_attempt_at) return `Retry ${m.attempts} scheduled for ${formatStamp(m.next_attempt_at)}`;
        return `Queued ${formatTimeAgo(m.created_at)}`;
    }

    function updateNotificationCounters(unread, high) {
        const rows = document.querySelectorAll('.notif-sidebar-container .stat-row');
        if (rows[0] && rows[0].lastElementChild) rows[0].lastElementChild.textContent = unread;
        if (rows[1] && rows[1].lastElementChild) rows[1].lastElementChild.textContent = high;

        const headerBadge = document.getElementById('notif-header-badge');
        if (headerBadge) {
            if (unread > 0) {
                headerBadge.textContent = `${unread} unread`;
                headerBadge.style.display = 'inline-block';
            } else {
                headerBadge.style.display = 'none';
            }
        }
        setNavBadge('notifications-view', unread);
    }

    async function refreshNotificationBadge() {
        if (!currentUser) return;
        const base = () => supabaseClient.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('is_read', false);
        const [unreadRes, highRes] = await Promise.all([base(), base().eq('priority', 'high')]);
        if (!unreadRes.error) updateNotificationCounters(unreadRes.count || 0, highRes.count || 0);
    }

    async function renderNotificationsList() {
        const list = document.getElementById('notifications-list-inject');
        if (!list || !currentUser) return;
        showSkeletonIfEmpty(list, skeletonRows(3));

        try {
            const { data: notes, error } = await supabaseClient
                .from('notifications')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw error;

            window.__notifications = notes || [];
            const unread = window.__notifications.filter(n => !n.is_read);
            const high = unread.filter(n => n.priority === 'high');
            updateNotificationCounters(unread.length, high.length);

            if (window.__notifications.length === 0) {
                list.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">You have no notifications.</p>';
                return;
            }

            list.innerHTML = window.__notifications.map(n => {
                const style = NOTIF_STYLES[n.type] || { icon: 'fa-regular fa-bell', color: '#64748b' };
                const priorityBg = n.priority === 'high' ? '#ef4444' : (n.priority === 'low' ? '#94a3b8' : '#0f172a');
                const priorityLabel = n.priority === 'high' ? 'High Priority' : (n.priority === 'low' ? 'Low' : 'Medium');
                return `
                    <div class="notif-item-card" onclick="openNotification(${jsArg(n.id)})" style="cursor:pointer; background:${n.is_read ? '#ffffff' : '#eff6ff'}; border:1px solid ${n.is_read ? '#e2e8f0' : '#93c5fd'}; border-radius:8px; padding:20px; margin-bottom:15px;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                            <i class="${style.icon}" style="color:${style.color}; font-size:16px;"></i>
                            <h4 style="font-size:15px; color:#0f172a; margin:0; font-weight:${n.is_read ? '500' : '600'};">${escapeHtml(n.title)}</h4>
                            ${n.is_read ? '' : '<div class="notif-dot" style="width:8px; height:8px; background:#3b82f6; border-radius:50%;"></div>'}
                        </div>
                        <span style="background:${priorityBg}; color:white; padding:2px 10px; border-radius:99px; font-size:11px; font-weight:600; display:inline-block; margin-bottom:10px;">${priorityLabel}</span>
                        <p style="font-size:13px; color:#475569; margin:0 0 12px 0;">${escapeHtml(n.message || '')}</p>
                        <div style="font-size:12px; color:#64748b;">${escapeHtml(formatTimeAgo(n.created_at))}</div>
                    </div>`;
            }).join('');
        } catch (error) {
            console.error('Error rendering notifications:', error);
            list.innerHTML = errorStateHtml("Could not load notifications.", "renderNotificationsList");
        }
    }

    window.openNotification = async function(id) {
        const n = (window.__notifications || []).find(x => x.id === id);
        if (!n) return;

        if (!n.is_read) {
            await supabaseClient
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', id);
            n.is_read = true;
        }

        if (n.link_type === 'event' && n.link_id) {
            window.openEventDetails(n.link_id);
        } else {
            const target = { client: 'clients-view', case: 'cases-view' }[n.link_type];
            const nav = target ? document.querySelector(`.nav-links li[data-target="${target}"]`) : null;
            if (nav) nav.click();
        }
        renderNotificationsList();
    };

    async function renderEmailQueueList() {
        const list = document.getElementById('email-queue-list-inject');
        if (!list || !currentUser) return;
        showSkeletonIfEmpty(list, skeletonRows(3));

        try {
            const [listRes, sentRes] = await Promise.all([
                supabaseClient
                    .from('email_queue')
                    .select('id, subject, recipient_email, status, attempts, category, sent_at, created_at')
                    .order('created_at', { ascending: false })
                    .limit(100),
                supabaseClient
                    .from('email_queue')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'sent')
            ]);
            if (listRes.error) throw listRes.error;

            const rows = document.querySelectorAll('.notif-sidebar-container .stat-row');
            if (rows[2] && rows[2].lastElementChild) rows[2].lastElementChild.textContent = sentRes.count || 0;

            const emails = listRes.data || [];
            if (emails.length === 0) {
                list.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">No emails in queue</p>';
                return;
            }

            list.innerHTML = emails.map(m => `
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:20px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                    <div style="display:flex; gap:15px; min-width:0;">
                        <i class="fa-regular fa-envelope" style="color:#94a3b8; font-size:16px; margin-top:2px;"></i>
                        <div style="min-width:0;">
                            <h4 style="font-size:14px; color:#0f172a; margin:0 0 5px 0; font-weight:600; word-break:break-word;">${escapeHtml(m.subject)}</h4>
                            <p style="font-size:12px; color:#64748b; margin:0 0 8px 0;">${m.category === 'reminder' ? 'Reminder' : 'Case update'} • To: ${escapeHtml(m.recipient_email)}</p>
                            <p style="font-size:12px; color:#64748b; margin:0; font-weight:500;">${escapeHtml(emailTimeText(m))}</p>
                            ${m.last_error && m.status !== 'sent' ? `<p style="font-size:12px; color:#dc2626; margin:6px 0 0 0;">${escapeHtml(m.last_error)}</p>` : ''}
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px; flex-shrink:0;">
                        ${emailStatusBadge(m.status)}
                        ${m.status === 'failed' ? `<button type="button" onclick="retryEmail(${jsArg(m.id)})" style="padding:5px 12px; border:1px solid #e2e8f0; background:white; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600; color:#334155;"><i class="fa-solid fa-rotate-right"></i> Retry</button>` : ''}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error rendering email queue:', error);
            list.innerHTML = errorStateHtml("Could not load the email queue.", "renderEmailQueueList");
        }
    }

    window.retryEmail = async function(id) {
        const { error } = await supabaseClient.rpc('retry_email', { p_id: id });
        if (error) {
            showToast('Could not retry this email: ' + error.message, 'error');
            return;
        }
        await renderEmailQueueList();
    };

    function setupNotificationActions() {
        const btnMarkRead = document.getElementById('btn-mark-read');
        const btnClearRead = document.getElementById('btn-clear-read');
        const btnSendTest = document.getElementById('btn-send-test-email');

        if (btnMarkRead) {
            btnMarkRead.addEventListener('click', async () => {
                const { error } = await supabaseClient
                    .from('notifications')
                    .update({ is_read: true, read_at: new Date().toISOString() })
                    .eq('user_id', currentUser.id)
                    .eq('is_read', false);
                if (error) {
                    showToast('Could not mark notifications as read: ' + error.message, 'error');
                    return;
                }
                await renderNotificationsList();
            });
        }

        if (btnClearRead) {
            btnClearRead.addEventListener('click', async () => {
                if (!(await confirmDialog({ title: 'Clear read notifications', confirmLabel: 'Delete', danger: true, message: 'Delete all notifications you have already read?' }))) return;
                const { error } = await supabaseClient
                    .from('notifications')
                    .delete()
                    .eq('user_id', currentUser.id)
                    .eq('is_read', true);
                if (error) {
                    showToast('Could not clear notifications: ' + error.message, 'error');
                    return;
                }
                await renderNotificationsList();
            });
        }

        if (btnSendTest) {
            btnSendTest.addEventListener('click', async () => {
                const idleHtml = btnSendTest.innerHTML;
                btnSendTest.disabled = true;
                btnSendTest.textContent = 'Sending...';
                try {
                    const { data, error } = await supabaseClient.functions.invoke('send-test-email');
                    if (error) {
                        let message = error.message;
                        try {
                            const errBody = await error.context.json();
                            if (errBody && errBody.error) message = errBody.error;
                        } catch (e) {}
                        throw new Error(message);
                    }
                    showToast(`Test email sent to ${data.to}. Check your inbox.`, 'success');
                } catch (err) {
                    console.error('Test email error:', err);
                    showToast('The test email could not be sent: ' + err.message, 'error');
                } finally {
                    btnSendTest.disabled = false;
                    btnSendTest.innerHTML = idleHtml;
                }
            });
        }

        setInterval(() => {
            refreshNotificationBadge();
            const view = document.getElementById('notifications-view');
            if (view && !view.classList.contains('hidden')) {
                renderNotificationsList();
                renderEmailQueueList();
            }
        }, 60000);
    }

    function setupNotificationTabs() {
        const notifTabs = document.querySelectorAll('.notif-tab-btn');
        
        notifTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const targetId = this.getAttribute('data-notiftab');
                if(!targetId) return;

                notifTabs.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                document.querySelectorAll('.notif-content-pane').forEach(content => {
                    content.classList.add('hidden');
                });
                
                const activeContent = document.getElementById(targetId);
                if(activeContent) activeContent.classList.remove('hidden');
            });
        });
    }

    function formatDate(dateString) {
        if (!dateString) return 'No date';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    }

    function formatEventRange(startISO, endISO) {
        const startText = formatEventTime(startISO) || 'TBD';
        if (!endISO) return startText;
        const sameDay = toLocalDateKey(startISO) === toLocalDateKey(endISO);
        const endTime = formatEventTime(endISO);
        if (sameDay) return `${startText} - ${endTime}`;
        const endDay = new Date(endISO).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${startText} - ${endDay}, ${endTime}`;
    }

    function formatEventTime(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function combineDateAndTime(dateStr, timeStr) {
        if (!dateStr) return null;
        if (!timeStr) return new Date(`${dateStr}T00:00:00`).toISOString();
        return new Date(`${dateStr}T${timeStr}:00`).toISOString();
    }


    function toLocalDateKey(dateLike) {
        const d = new Date(dateLike);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }


    async function resolveExistingClientId(selectedClientId, email, phone) {
        if (selectedClientId) return selectedClientId;

        const filters = [];
        if (email) filters.push(`client_email.ilike.${email}`);
        if (phone) filters.push(`client_phone.eq.${phone}`);
        if (filters.length === 0) return null;

        const { data, error } = await supabaseClient
            .from('clients')
            .select('id')
            .or(filters.join(','));

        if (error) {
            console.error('Client lookup error:', error);
            return null;
        }
        return data && data.length > 0 ? data[0].id : null;
    }

    async function checkClientDayConflict(clientId, dateStr, excludeEventId = null) {
        const { startISO } = getDayRange(dateStr);


        const { data: clientCases } = await supabaseClient
            .from('cases')
            .select('id')
            .eq('client_id', clientId);

        let orFilter = `client_id.eq.${clientId}`;
        const caseIds = (clientCases || []).map(c => c.id);
        if (caseIds.length > 0) orFilter += `,case_id.in.(${caseIds.join(',')})`;


        const { data: events, error } = await supabaseClient
            .from('calendar_events')
            .select('id, title, start_date')
            .or(orFilter)
            .gte('start_date', startISO)
            .order('start_date', { ascending: true });

        if (error) throw new Error(error.message);

        const relevantEvents = (events || []).filter(e => !excludeEventId || e.id !== excludeEventId);
        const conflictEvent = relevantEvents.find(e => toLocalDateKey(e.start_date) === dateStr);
        if (!conflictEvent) return null;

        const busyDays = new Set(relevantEvents.map(e => toLocalDateKey(e.start_date)));
        const next = new Date(`${dateStr}T00:00:00`);
        do {
            next.setDate(next.getDate() + 1);
        } while (busyDays.has(toLocalDateKey(next)));

        return { conflictEvent, nextFreeDate: next };
    }

    function getDayRange(dateStr) {
        const startISO = new Date(`${dateStr}T00:00:00`).toISOString();
        const endISO = new Date(`${dateStr}T23:59:59.999`).toISOString();
        return { startISO, endISO };
    }

    function formatTimeAgo(dateString) {
        if (!dateString) return '';
        const now = new Date();
        const date = new Date(dateString);
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    }

    function setupLogoutValidation() {
        const logoutBtn = document.getElementById('logout-sidebar-btn');
        const logoutModal = document.getElementById('logout-modal');
        const cancelLogoutBtn = document.getElementById('btn-cancel-logout');
        const confirmLogoutBtn = document.getElementById('btn-confirm-logout');

        if (logoutBtn && logoutModal) {
            logoutBtn.addEventListener('click', () => {
                logoutModal.classList.remove('hidden');
            });

            if (cancelLogoutBtn) {
                cancelLogoutBtn.addEventListener('click', () => {
                    logoutModal.classList.add('hidden');
                });
            }

            if (confirmLogoutBtn) {
                confirmLogoutBtn.addEventListener('click', async () => {
                    try {
                        confirmLogoutBtn.innerText = "Logging out...";
                        confirmLogoutBtn.disabled = true;
                        
                        const { error } = await supabaseClient.auth.signOut();
                        
                        if (error) throw error;
                        
                        window.location.href = 'login.html';
                    } catch (error) {
                        console.error('Logout error:', error.message);
                        confirmLogoutBtn.innerText = "Logout Failed";
                        confirmLogoutBtn.disabled = false;
                        
                        setTimeout(() => {
                            confirmLogoutBtn.innerText = "Logout";
                        }, 2000);
                    }
                });
            }
        } else if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await supabaseClient.auth.signOut();
                window.location.href = 'login.html';
            });
        }
    }


    function parseClientNameParts(fullName) {
        const result = { first: '', mi: '', last: '' };
        if (!fullName) return result;

        const name = fullName.trim();

        if (name.includes(',')) {
            const [lastPart, restPart] = name.split(',').map(s => s.trim());
            result.last = lastPart || '';

            const restTokens = (restPart || '').split(/\s+/).filter(Boolean);
            if (restTokens.length > 0) {
                const lastToken = restTokens[restTokens.length - 1];
                if (/^[A-Za-z]\.?$/.test(lastToken)) {
                    result.mi = lastToken.replace('.', '');
                    result.first = restTokens.slice(0, -1).join(' ');
                } else {
                    result.first = restTokens.join(' ');
                }
            }
        } else {
            const tokens = name.split(/\s+/).filter(Boolean);
            if (tokens.length === 1) {
                result.first = tokens[0];
            } else {
                const lastToken = tokens[tokens.length - 1];
                const secondLast = tokens.length > 2 ? tokens[tokens.length - 2] : null;
                if (secondLast && /^[A-Za-z]\.?$/.test(secondLast)) {
                    result.mi = secondLast.replace('.', '');
                    result.last = lastToken;
                    result.first = tokens.slice(0, -2).join(' ');
                } else {
                    result.last = lastToken;
                    result.first = tokens.slice(0, -1).join(' ');
                }
            }
        }

        return result;
    }

    async function loadEventCasesForLawyer() {
        const caseSelect = document.getElementById('event-existing-case');
        const hint = document.getElementById('event-case-hint');
        if (!caseSelect || !currentUser) return;

        window.__eventCasesMap = {};
        caseSelect.innerHTML = '<option value="">Loading your cases...</option>';

        try {
            const { data: cases, error } = await supabaseClient
                .from('cases')
                .select(casesSelect('id, case_number, case_type, case_description, title, status, client_id, date_filed, court_case_no, court_branch, case_stage, clients(client_name)', true))
                .eq('status', 'active')
                .eq('case_lawyers.lawyer_id', currentUser.id)
                .order('created_at', { ascending: false });
            if (error) throw error;

            (cases || []).forEach(c => { window.__eventCasesMap[c.id] = c; });

            const hasCases = (cases || []).length > 0;
            caseSelect.innerHTML = `<option value="">${hasCases ? 'Select a case' : 'No active cases yet'}</option>` +
                (cases || []).map(c => {
                    const label = `${c.case_number ? '#' + c.case_number + ' — ' : ''}${c.title}${c.clients?.client_name ? ' (' + c.clients.client_name + ')' : ''}`;
                    return `<option value="${c.id}">${escapeHtml(label)}</option>`;
                }).join('');
            if (hint) {
                hint.textContent = hasCases
                    ? 'Choose one of the cases you entered. New cases are added on the Cases page.'
                    : 'You have no active cases. Add one on the Cases page first.';
            }
        } catch (err) {
            console.error('Error loading cases for the event form:', err);
            caseSelect.innerHTML = '<option value="">Could not load cases</option>';
        }
        handleEventCaseSelectChange();
    }

    const CONFERENCE_ROOMS = ['Conference Room A', 'Conference Room B'];

    function syncEventLocationWithCase(c) {
        const loc = document.getElementById('event-location');
        if (!loc) return;
        const previousCourt = loc.dataset.autoCourt || '';
        const wasAuto = previousCourt !== '' && loc.value === previousCourt;
        Array.from(loc.options).forEach(o => { if (o.dataset.court === '1') o.remove(); });
        loc.dataset.autoCourt = '';

        const court = c && c.court_branch ? String(c.court_branch).trim() : '';
        if (!court) {
            if (wasAuto) loc.value = '';
            return;
        }
        const opt = document.createElement('option');
        opt.value = court;
        opt.textContent = court + ' (Court)';
        opt.dataset.court = '1';
        loc.insertBefore(opt, loc.options[1] || null);
        loc.dataset.autoCourt = court;
        if (loc.value === '' || wasAuto) loc.value = court;
    }

    function handleEventCaseSelectChange() {
        const caseSelect = document.getElementById('event-existing-case');
        const info = document.getElementById('event-case-info');
        const c = caseSelect ? (window.__eventCasesMap || {})[caseSelect.value] : null;
        syncEventLocationWithCase(c);
        if (!info) return;
        if (!c) {
            info.classList.add('hidden');
            info.innerHTML = '';
            return;
        }
        info.innerHTML = `
            <div><strong>Client:</strong> ${escapeHtml(c.clients?.client_name || 'No client')}</div>
            ${c.court_case_no || c.court_branch ? `<div><strong>Court:</strong> ${escapeHtml([c.court_case_no, c.court_branch].filter(Boolean).join(' • '))}</div>` : ''}
            ${c.case_stage ? `<div><strong>Stage:</strong> ${escapeHtml(c.case_stage)}</div>` : ''}
            <div><strong>Type:</strong> ${escapeHtml(c.case_type || 'General')} • <strong>Filed:</strong> ${formatDate(c.date_filed || new Date().toISOString())}</div>
            ${c.case_description ? `<div><strong>Details:</strong> ${escapeHtml(c.case_description)}</div>` : ''}
        `;
        info.classList.remove('hidden');
    }

    async function prepareEventModal() {
        const lawyerSelect = document.getElementById('event-lawyer');
        const lawyerOnlySection = document.getElementById('event-lawyer-only');

        const eventDateInput = document.getElementById('event-date');
        const eventEndDateInput = document.getElementById('event-end-date');
        if (eventDateInput) {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            eventDateInput.min = todayStr;
            if (eventEndDateInput) eventEndDateInput.min = todayStr;
        }

        try {
            if (globalUserRole === 'administrator') {
                if (lawyerSelect) {
                    lawyerSelect.innerHTML = '<option value="all">All Lawyers (Firm-wide Event)</option>';
                    lawyerSelect.disabled = true;
                }
                if (lawyerOnlySection) lawyerOnlySection.style.display = 'none';
            } else if (globalUserRole === 'lawyer' && currentUser) {
                if (lawyerSelect) {
                    lawyerSelect.innerHTML = `<option value="${currentUser.id}">${escapeHtml(globalUserName || 'Me')}</option>`;
                    lawyerSelect.disabled = true;
                }
                if (lawyerOnlySection) lawyerOnlySection.style.display = 'block';
                const caseSelect = document.getElementById('event-existing-case');
                if (caseSelect) caseSelect.onchange = handleEventCaseSelectChange;
                await loadEventCasesForLawyer();
            }
        } catch (error) {
            console.error('Error loading modal:', error);
        }
    }

    async function uploadCaseDocument(file, { caseId = null, clientId = null, category = 'Attachment', tag = '', title = null } = {}) {
        if (!file) return null;

        const uniqueFileName = `${Date.now()}_${safeStorageName(file.name)}`;
        const { error: uploadError } = await supabaseClient
            .storage
            .from('documents')
            .upload(uniqueFileName, file);

        if (uploadError) {
            console.error('Storage Error:', uploadError);
            throw new Error("Failed to upload attachment. Please check if the 'documents' bucket exists and your account is allowed to upload to it.");
        }

        const fileSizeMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

        const docData = {
            title: title || file.name,
            type: category.toLowerCase(),
            size: fileSizeMb,
            file_path: uniqueFileName,
            tags: tag,
            uploaded_by: currentUser ? currentUser.id : null
        };
        if (caseId) docData.case_id = caseId;
        if (clientId) docData.client_id = clientId;

        const { data: newDoc, error: dbError } = await supabaseClient
            .from('documents')
            .insert([docData])
            .select('id, title, file_path')
            .single();

        if (dbError) {
            console.error('Database Error:', dbError);
            throw new Error('Attachment uploaded, but failed to save it to the documents table.');
        }

        return newDoc;
    }

    function setupAddEventModal() {
        const modal = document.getElementById('add-event-modal');
        const openBtn = document.getElementById('btn-add-event-header'); 
        const closeBtn = document.getElementById('close-modal-btn');
        const form = document.getElementById('add-event-form');
        
        const toggleClientBtn = document.getElementById('btn-toggle-client');
        const clientSection = document.getElementById('client-details-section');
        const clientIcon = document.getElementById('client-toggle-icon');

        const toggleCaseBtn = document.getElementById('btn-toggle-case');
        const caseSection = document.getElementById('case-details-section');
        const caseIcon = document.getElementById('case-toggle-icon');

        if (!modal) return;

        
        const attachInput = document.getElementById('event-attachment');
        const attachNameInput = document.getElementById('event-attachment-name');
        if (attachInput && attachNameInput) {
            attachInput.addEventListener('change', () => {
                attachNameInput.value = attachInput.files.length > 0 ? attachInput.files[0].name : '';
            });
        }

       
        function resetEventForm() {
            if (form) form.reset();
            clearEventFieldErrors();

            const existingCaseSelectReset = document.getElementById('event-existing-case');
            if (existingCaseSelectReset) existingCaseSelectReset.value = '';
            handleEventCaseSelectChange();

            [[clientSection, clientIcon], [caseSection, caseIcon]].forEach(([section, icon]) => {
                if (section && !section.classList.contains('hidden')) {
                    section.classList.add('hidden');
                    if (icon) {
                        icon.classList.remove('fa-chevron-up');
                        icon.classList.add('fa-chevron-down');
                    }
                }
            });
        }

  
        if (form) form.setAttribute('novalidate', '');

        function clearEventFieldErrors() {
            if (!form) return;
            form.querySelectorAll('.event-field-error').forEach(n => n.remove());
            form.querySelectorAll('[data-had-error]').forEach(el => {
                el.style.borderColor = el.dataset.prevBorder || '';
                el.removeAttribute('data-had-error');
            });
        }

        function markEventFieldInvalid(el, message) {
            el.dataset.prevBorder = el.style.borderColor || '';
            el.setAttribute('data-had-error', '1');
            el.style.borderColor = '#ef4444';

            const note = document.createElement('div');
            note.className = 'event-field-error';
            note.textContent = message;
            note.style.cssText = 'color:#ef4444; font-size:11px; margin-top:4px;';

    
            const wrapper = el.parentElement;
            const anchor = (el.tagName === 'SELECT' && wrapper && !wrapper.classList.contains('form-group')) ? wrapper : el;
            anchor.insertAdjacentElement('afterend', note);

            const clear = () => {
                el.style.borderColor = el.dataset.prevBorder || '';
                el.removeAttribute('data-had-error');
                note.remove();
                el.removeEventListener('input', clear);
                el.removeEventListener('change', clear);
            };
            el.addEventListener('input', clear);
            el.addEventListener('change', clear);
        }

      
        function validateEventForm() {
            clearEventFieldErrors();
            const problems = [];
            const val = id => (document.getElementById(id)?.value || '').trim();
            const need = (id, message) => {
                if (!val(id)) problems.push({ el: document.getElementById(id), message });
            };

            need('event-title', 'Event title is required.');
            need('event-date', 'Please pick a date.');
            need('event-time', 'Please pick a start time.');
            need('event-priority', 'Please choose a priority.');
            need('event-location', 'Please select a location.');

         
            const isAdmin = (typeof globalUserRole !== 'undefined' && globalUserRole === 'administrator');
            if (!isAdmin) {
                const pickedCase = document.getElementById('event-existing-case')?.value;
                if (!pickedCase) {
                    problems.push({
                        el: document.getElementById('event-existing-case'),
                        message: 'Select the case this event is for. Add cases on the Cases page.'
                    });
                }
            }

            if (problems.length === 0) return true;

            problems.forEach(p => { if (p.el) markEventFieldInvalid(p.el, p.message); });

            
            const first = problems.find(p => p.el)?.el;
            if (clientSection && clientSection.classList.contains('hidden') &&
                problems.some(p => p.el && clientSection.contains(p.el))) {
                clientSection.classList.remove('hidden');
                if (clientIcon) {
                    clientIcon.classList.remove('fa-chevron-down');
                    clientIcon.classList.add('fa-chevron-up');
                }
            }

            if (first) {
                first.scrollIntoView({ behavior: 'smooth', block: 'center' });
                first.focus({ preventScroll: true });
            }
            return false;
        }

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                resetEventForm();
                prepareEventModal();
                modal.classList.remove('hidden');
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
                resetEventForm();
            });
        }

        if (toggleClientBtn && clientSection) {
            toggleClientBtn.addEventListener('click', () => {
                clientSection.classList.toggle('hidden');
                if (clientSection.classList.contains('hidden')) {
                    clientIcon.classList.remove('fa-chevron-up');
                    clientIcon.classList.add('fa-chevron-down');
                } else {
                    clientIcon.classList.remove('fa-chevron-down');
                    clientIcon.classList.add('fa-chevron-up');
                }
            });
        }

        if (toggleCaseBtn && caseSection) {
            toggleCaseBtn.addEventListener('click', () => {
                caseSection.classList.toggle('hidden');
                if (caseSection.classList.contains('hidden')) {
                    caseIcon.classList.remove('fa-chevron-up');
                    caseIcon.classList.add('fa-chevron-down');
                } else {
                    caseIcon.classList.remove('fa-chevron-down');
                    caseIcon.classList.add('fa-chevron-up');
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault(); 

                
                if (!validateEventForm()) return;
                
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = "Saving...";
                }

                const title = document.getElementById('event-title').value;
                const date = document.getElementById('event-date').value;
                const timeInput = document.getElementById('event-time').value;
                const endDateInput = document.getElementById('event-end-date').value;
                const endTimeInput = document.getElementById('event-end-time').value;
                const priority = document.getElementById('event-priority').value;
                const location = document.getElementById('event-location').value;
                
                let isGeneral = (globalUserRole === 'administrator');
                let assignedLawyerId = isGeneral ? null : currentUser.id;

                const existingCaseSelect = document.getElementById('event-existing-case');
                const selectedExistingCaseId = existingCaseSelect ? existingCaseSelect.value : '';
                const linkedCase = (window.__eventCasesMap || {})[selectedExistingCaseId] || null;

                let formattedTime = timeInput; 
                if(timeInput) {
                    const [h, m] = timeInput.split(':');
                    const hour = parseInt(h);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const formattedH = hour % 12 || 12;
                    formattedTime = `${formattedH}:${m} ${ampm}`;
                }

                const eventDateTimeISO = combineDateAndTime(date, timeInput);

                
                let eventEndDateTimeISO = null;
                if (eventDateTimeISO) {
                    if (endDateInput || endTimeInput) {
                        const finalEndDate = endDateInput || date;
                        const finalEndTime = endTimeInput || timeInput;
                        eventEndDateTimeISO = combineDateAndTime(finalEndDate, finalEndTime);

                        if (eventEndDateTimeISO && new Date(eventEndDateTimeISO) <= new Date(eventDateTimeISO)) {
                            showToast('The end date/time must be after the start date/time.', 'warning');
                            if (submitBtn) {
                                submitBtn.disabled = false;
                                submitBtn.innerText = "Save Event";
                            }
                            return;
                        }
                    } else {
                        eventEndDateTimeISO = new Date(new Date(eventDateTimeISO).getTime() + 60 * 60 * 1000).toISOString();
                    }
                }

           
                if (eventDateTimeISO) {
                    const now = new Date();
                    const todayAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const eventDay = new Date(eventDateTimeISO);
                    const eventDayAtMidnight = new Date(eventDay.getFullYear(), eventDay.getMonth(), eventDay.getDate());

                    if (eventDayAtMidnight < todayAtMidnight) {
                        showToast("You can't schedule an event on a past date. Please choose today or a future date.", 'warning');
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerText = "Save Event";
                        }
                        return;
                    }
                }

               
                if (date) {
                    try {
                        const existingClientId = linkedCase ? linkedCase.client_id : null;
                        if (existingClientId) {
                            const clash = await checkClientDayConflict(existingClientId, date);
                            if (clash) {
                                const who = (linkedCase && linkedCase.clients && linkedCase.clients.client_name) || 'This client';
                                showToast(`Cannot schedule this event: ${who} already has "${clash.conflictEvent.title}" at ${formatEventTime(clash.conflictEvent.start_date)} on ${formatDate(clash.conflictEvent.start_date)}. A client can only have one event per day.\n\nThe earliest day you can schedule this client is ${formatDate(clash.nextFreeDate.toISOString())}.`, 'warning');
                                if (submitBtn) {
                                    submitBtn.disabled = false;
                                    submitBtn.innerText = "Create Event";
                                }
                                return;
                            }
                        }
                    } catch (clientDayErr) {
                        console.error('Client day check error:', clientDayErr);
                    }
                }

              
                if (!isGeneral && assignedLawyerId && eventDateTimeISO) {
                    const bufferMs = eventEndDateTimeISO ? (new Date(eventEndDateTimeISO) - new Date(eventDateTimeISO)) : (60 * 60 * 1000);
                    const newStart = new Date(eventDateTimeISO);
                    const rangeStart = new Date(newStart.getTime() - bufferMs + 1000).toISOString();
                    const rangeEnd = new Date(newStart.getTime() + bufferMs - 1000).toISOString();

                    const { data: nearbyLawyerEvents, error: bufferCheckError } = await supabaseClient
                        .from('calendar_events')
                        .select('id, title, start_date')
                        .eq('assigned_to', assignedLawyerId)
                        .gte('start_date', rangeStart)
                        .lte('start_date', rangeEnd);

                    if (bufferCheckError) {
                        console.error('Buffer check error:', bufferCheckError);
                    } else if (nearbyLawyerEvents && nearbyLawyerEvents.length > 0) {
                        const conflictEvent = nearbyLawyerEvents[0];
                        showToast(`Cannot schedule this event: this lawyer already has "${conflictEvent.title}" at ${formatEventTime(conflictEvent.start_date)} on ${formatDate(conflictEvent.start_date)}. Events for the same lawyer need enough gap between them based on this event's duration.`, 'warning');
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerText = "Save Event";
                        }
                        return;
                    }
                }

                
                if (CONFERENCE_ROOMS.includes(location) && eventDateTimeISO) {
                    const bufferMs = eventEndDateTimeISO ? (new Date(eventEndDateTimeISO) - new Date(eventDateTimeISO)) : (60 * 60 * 1000);
                    const newStart = new Date(eventDateTimeISO);
                    const rangeStart = new Date(newStart.getTime() - bufferMs + 1000).toISOString();
                    const rangeEnd = new Date(newStart.getTime() + bufferMs - 1000).toISOString();

                    const { data: nearbyRoomEvents, error: roomCheckError } = await supabaseClient
                        .from('calendar_events')
                        .select('id, title, start_date')
                        .eq('location', location)
                        .gte('start_date', rangeStart)
                        .lte('start_date', rangeEnd);

                    if (roomCheckError) {
                        console.error('Room check error:', roomCheckError);
                    } else if (nearbyRoomEvents && nearbyRoomEvents.length > 0) {
                        const conflictEvent = nearbyRoomEvents[0];
                        showToast(`Cannot schedule this event: "${location}" is already booked for "${conflictEvent.title}" at ${formatEventTime(conflictEvent.start_date)} on ${formatDate(conflictEvent.start_date)}. Bookings for the same room need enough gap between them based on this event's duration.`, 'warning');
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerText = "Save Event";
                        }
                        return;
                    }
                }

                try {
                    const newClientId = linkedCase ? linkedCase.client_id : null;
                    const newCaseId = linkedCase ? linkedCase.id : null;
                    const finalCaseNumber = linkedCase ? (linkedCase.case_number || '') : '';

                    const attachmentInput = document.getElementById('event-attachment');
                    const attachmentFile = attachmentInput && attachmentInput.files.length > 0 ? attachmentInput.files[0] : null;
                    let attachedDoc = null;
                    if (attachmentFile) {
                        if (submitBtn) submitBtn.innerText = 'Uploading attachment...';
                        attachedDoc = await uploadCaseDocument(attachmentFile, {
                            caseId: newCaseId,
                            clientId: newClientId,
                            category: 'Event Attachment',
                            tag: finalCaseNumber ? `Case #${finalCaseNumber}` : '',
                            title: resolveDocumentTitle(
                                document.getElementById('event-attachment-name')?.value,
                                attachmentFile
                            )
                        });
                    }

                    const eventData = { 
                        title: title, 
                        start_date: eventDateTimeISO, 
                        end_date: eventEndDateTimeISO,
                        priority: priority,
                        location: location,
                        is_general: isGeneral
                    };

                    if (!isGeneral) {
                        eventData.assigned_to = assignedLawyerId;
                    }

                    if (newClientId) eventData.client_id = newClientId;
                    if (newCaseId) eventData.case_id = newCaseId;
                    if (attachedDoc) eventData.document_id = attachedDoc.id;

                    const { error: eventError } = await supabaseClient.from('calendar_events').insert([eventData]);
                    if (eventError) throw new Error(eventError.message);

                    showToast(isGeneral
                        ? 'Firm-wide event successfully added!'
                        : 'Event successfully added' + (finalCaseNumber ? ` and linked to case #${finalCaseNumber}.` : '.'), 'success');
                    
                    form.reset(); 
                    handleEventCaseSelectChange();
                    
                    if (clientSection && !clientSection.classList.contains('hidden')) {
                        clientSection.classList.add('hidden');
                        if (clientIcon) {
                            clientIcon.classList.remove('fa-chevron-up');
                            clientIcon.classList.add('fa-chevron-down');
                        }
                    }
                    if (caseSection && !caseSection.classList.contains('hidden')) {
                        caseSection.classList.add('hidden');
                        if (caseIcon) {
                            caseIcon.classList.remove('fa-chevron-up');
                            caseIcon.classList.add('fa-chevron-down');
                        }
                    }

                    modal.classList.add('hidden'); 
                    
                    generateCalendarGrid(); 
                    renderResourcesWidget();
                    renderScheduleSummaryWidget();
                    renderLawyerStatusWidget();
                    
                    updateDashboardStats();
                    renderDashboardContent();
                    updateScheduleStats();
                    renderMyCasesTab(); 
                    
                    const timeline = document.getElementById('timeline-inject');
                    if (timeline && !timeline.parentElement.classList.contains('hidden')) {
                        if (typeof renderTimelineInSchedule === "function") renderTimelineInSchedule();
                    }

                } catch (error) {
                    console.error('Error saving:', error);
                    showToast('Error: \n' + error.message, 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = "Create Event";
                    }
                }
            });
        }
    }

    async function renderResourcesWidget() {
        const list = document.getElementById('widget-resources-list');
        if (!list) return;

        try {
            const localDate = new Date();
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;
            const { startISO: todayStart, endISO: todayEnd } = getDayRange(todayStr);

            const { data: events } = await supabaseClient
                .from('calendar_events')
                .select('id, title, location, start_date, end_date, is_general, assigned_to, profiles(full_name), cases(clients(client_name))')
                .gte('start_date', todayStart)
                .lte('start_date', todayEnd)
                .order('start_date', { ascending: true });

            const allRooms = CONFERENCE_ROOMS;
            const now = new Date();
            const roomBufferMs = 60 * 60 * 1000;

            window.__roomEventsRegistry = {};

            const roomsHtml = allRooms.map(room => {
                const roomEvents = (events || []).filter(e => (e.location || '').trim().toLowerCase() === room.toLowerCase());

                const currentBooking = roomEvents.find(e => {
                    return isEventOngoing(e.start_date, e.end_date, now);
                });

                const isBusy = !!currentBooking;
                const tagClass = isBusy ? 'tag-busy' : 'tag-avail';
                const tagText = isBusy ? 'Busy Now' : 'Available';
                const tagStyle = isBusy 
                    ? 'background:#fee2e2; color:#ef4444;' 
                    : 'background:#dcfce7; color:#22c55e;';

                let subText = '';
                let linkedEvent = null;

                if (currentBooking) {
                    const bookedBy = currentBooking.is_general ? 'Firm-wide' : (currentBooking.profiles?.full_name ? `Atty. ${currentBooking.profiles.full_name}` : 'a lawyer');
                    const untilTime = formatEventTime(getEventEndTime(currentBooking.start_date, currentBooking.end_date).toISOString());
                    subText = `Until ${untilTime} • ${currentBooking.title || 'Booked'} (${bookedBy})`;
                    linkedEvent = currentBooking;
                } else {
                    const nextBooking = roomEvents.find(e => new Date(e.start_date) > now);
                    if (nextBooking) {
                        subText = `Next: ${formatEventTime(nextBooking.start_date)} • ${nextBooking.title || 'Booked'}`;
                        linkedEvent = nextBooking;
                    }
                }

                let clickAttrs = '';
                if (linkedEvent) {
                    window.__roomEventsRegistry[linkedEvent.id] = { ...linkedEvent, roomName: room };
                    clickAttrs = `style="display:flex; flex-direction:column; margin-bottom:14px; font-size:13px; cursor:pointer;" onclick="openRoomBookingDetails('${linkedEvent.id}')" title="Click to view booking details"`;
                } else {
                    clickAttrs = `style="display:flex; flex-direction:column; margin-bottom:14px; font-size:13px;"`;
                }

                return `
                    <div class="resource-item" ${clickAttrs}>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#1e293b; font-weight:500;">${room}</span>
                            <span class="tag ${tagClass}" style="font-size:10px; padding:3px 8px; border-radius:4px; font-weight:bold; ${tagStyle}">
                                ${tagText}
                            </span>
                        </div>
                        ${subText ? `<span style="color:#94a3b8; font-size:11px; margin-top:3px;">${escapeHtml(subText)}${linkedEvent ? ' <i class="fa-solid fa-circle-info" style="margin-left:4px;"></i>' : ''}</span>` : ''}
                    </div>
                `;
            }).join('');

            const isLawyerView = globalUserRole === 'lawyer' && currentUser;
            let courtQuery = supabaseClient
                .from('calendar_events')
                .select('id, title, location, start_date, end_date, is_general, assigned_to, profiles(full_name), cases(clients(client_name))')
                .gte('start_date', todayStart)
                .not('location', 'is', null)
                .not('location', 'in', `(${CONFERENCE_ROOMS.map(r => `"${r}"`).join(',')})`)
                .order('start_date', { ascending: true })
                .limit(40);
            if (isLawyerView) courtQuery = courtQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
            const { data: courtData } = await courtQuery;
            const courtEvents = (courtData || []).filter(e => (e.location || '').trim() !== '');

            const courtGroups = {};
            courtEvents.forEach(e => {
                const key = e.location.trim().toLowerCase();
                if (!courtGroups[key]) courtGroups[key] = { name: e.location.trim(), events: [] };
                courtGroups[key].events.push(e);
            });

            const dateLabel = (iso) => toLocalDateKey(iso) === todayStr
                ? 'Today'
                : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            let courtsHtml = '<div class="loc-subhead">Courts and other locations</div>';
            const groups = Object.values(courtGroups);
            if (groups.length === 0) {
                courtsHtml += '<p class="loc-empty">No court locations scheduled yet.</p>';
            } else {
                courtsHtml += groups.map(g => {
                    const shown = g.events.slice(0, 4);
                    const rows = shown.map(e => {
                        window.__roomEventsRegistry[e.id] = { ...e, roomName: g.name };
                        const end = e.end_date ? new Date(e.end_date) : new Date(new Date(e.start_date).getTime() + roomBufferMs);
                        const done = now >= end;
                        const who = e.is_general ? 'Firm-wide' : (e.profiles?.full_name ? `Atty. ${e.profiles.full_name}` : 'Unassigned');
                        return `
                            <div class="loc-event${done ? ' loc-event-done' : ''}" onclick="openRoomBookingDetails('${e.id}')" title="Click to view details">
                                <span class="loc-event-date">
                                    <strong>${dateLabel(e.start_date)}</strong>
                                    <small>${formatEventTime(e.start_date)}</small>
                                </span>
                                <span class="loc-event-main">
                                    <span class="loc-event-title">${escapeHtml(e.title || 'Booked')}</span>
                                    <span class="loc-event-who"><i class="fa-solid fa-gavel"></i> ${escapeHtml(who)}</span>
                                </span>
                            </div>`;
                    }).join('');
                    const more = g.events.length > shown.length ? `<div class="loc-more">+${g.events.length - shown.length} more</div>` : '';
                    return `
                        <div class="loc-court">
                            <div class="loc-court-head">
                                <span class="loc-court-name"><i class="fa-solid fa-landmark"></i> ${escapeHtml(g.name)}</span>
                                <span class="loc-court-count">${g.events.length}</span>
                            </div>
                            ${rows}
                            ${more}
                        </div>`;
                }).join('');
            }

            list.innerHTML = roomsHtml + courtsHtml;

        } catch (error) {
            console.error('Error rendering resources:', error);
        }
    }

    window.openRoomBookingDetails = function(eventId) {
        const modal = document.getElementById('room-booking-modal');
        const titleEl = document.getElementById('room-booking-title');
        const bodyEl = document.getElementById('room-booking-body');
        if (!modal || !bodyEl) return;

        const ev = (window.__roomEventsRegistry || {})[eventId];
        if (!ev) return;

        const bookedBy = ev.is_general ? 'Firm-wide (All Lawyers)' : (ev.profiles?.full_name ? `Atty. ${ev.profiles.full_name}` : 'Unassigned');
        const clientName = ev.cases?.clients?.client_name || 'No Client';

        titleEl.textContent = ev.title || 'Booking Details';
        bodyEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid fa-location-dot" style="width:16px; color:#94a3b8;"></i>
                <span><strong>${ev.roomName}</strong></span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-regular fa-calendar" style="width:16px; color:#94a3b8;"></i>
                <span>${formatDate(ev.start_date)} at ${formatEventTime(ev.start_date)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid fa-gavel" style="width:16px; color:#94a3b8;"></i>
                <span>Booked by: <strong>${escapeHtml(bookedBy)}</strong></span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid fa-user" style="width:16px; color:#94a3b8;"></i>
                <span>Client: <strong>${escapeHtml(clientName)}</strong></span>
            </div>
        `;

        modal.classList.remove('hidden');
    };

    function setupRoomBookingModal() {
        const modal = document.getElementById('room-booking-modal');
        const closeBtn = document.getElementById('close-room-booking-btn');
        if (!modal || !closeBtn) return;

        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

  
    async function renderCasesTabView() {
        const casesList = document.getElementById('cases-list-inject');
                if (!casesList) return;

        casesList.innerHTML = skeletonCards(3);

        try {
            const isLawyer = globalUserRole === 'lawyer' && currentUser;

            let casesQuery = supabaseClient
                .from('cases')
                .select(casesSelect('*, clients(id, client_name, client_email, client_phone)', !!isLawyer))
                .order('created_at', { ascending: false });

            if (isLawyer) casesQuery = filterMyCases(casesQuery);

            const { data: cases, error } = await casesQuery;
            if (error) throw error;

            window.__casesRegistry = {};
            (cases || []).forEach(c => { window.__casesRegistry[c.id] = c; });
            paintCasesList();

        } catch (error) {
            console.error('Error loading cases tab:', error);
            casesList.innerHTML = errorStateHtml("Could not load cases.", "renderCasesTabView");
        }
    }

    function paintCasesList() {
        const casesList = document.getElementById('cases-list-inject');
        const countEl = document.getElementById('cases-count');
        const clearBtn = document.getElementById('cases-date-clear');
        if (!casesList) return;

        const from = document.getElementById('cases-date-from')?.value || '';
        const to = document.getElementById('cases-date-to')?.value || '';
        const term = (document.getElementById('cases-search')?.value || '').trim().toLowerCase();
        const fStatus = document.getElementById('cases-filter-status')?.value || 'all';
        const fType = document.getElementById('cases-filter-type')?.value || 'all';
        const fParty = document.getElementById('cases-filter-party')?.value || 'all';
        const fStage = document.getElementById('cases-filter-stage')?.value || 'all';
        const filtersOn = !!(from || to || term) || fStatus !== 'all' || fType !== 'all' || fParty !== 'all' || fStage !== 'all';
        if (clearBtn) clearBtn.classList.toggle('hidden', !filtersOn);

        const all = Object.values(window.__casesRegistry || {});

        const cases = all.filter(c => {
            const opened = toLocalDateKey(c.date_filed || c.created_at);
            if (from && opened < from) return false;
            if (to && opened > to) return false;
            if (fStatus !== 'all' && (c.status || 'active') !== fStatus) return false;
            if (fType !== 'all' && c.case_type !== fType) return false;
            if (fParty !== 'all' && c.party_type !== fParty) return false;
            if (fStage !== 'all' && c.case_stage !== fStage) return false;
            if (term) {
                const lawyers = (c.case_lawyers || []).map(r => r.profiles && r.profiles.full_name);
                const haystack = [
                    c.title, c.case_number, c.court_branch,
                    c.clients && c.clients.client_name, ...lawyers
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            return true;
        });

        if (countEl) countEl.textContent = filtersOn ? `${cases.length} of ${all.length} cases` : `Total: ${all.length}`;

        if (all.length === 0) {
            casesList.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">No cases yet.</p>';
            return;
        }
        if (cases.length === 0) {
            casesList.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">No cases match your search or filters.</p>';
            return;
        }

        const sort = window.__casesSort || { key: 'date_filed', dir: 'desc' };
        const sortValue = {
            title: c => (c.title || '').toLowerCase(),
            client: c => ((c.clients && c.clients.client_name) || '').toLowerCase(),
            case_type: c => (c.case_type || '').toLowerCase(),
            case_stage: c => (c.case_stage || '').toLowerCase(),
            date_filed: c => new Date(c.date_filed || c.created_at || 0).getTime(),
            status: c => (c.status || 'active')
        }[sort.key] || (() => 0);
        cases.sort((a, b) => {
            const x = sortValue(a), y = sortValue(b);
            const r = x < y ? -1 : (x > y ? 1 : 0);
            return sort.dir === 'asc' ? r : -r;
        });

        const th = (key, label) => {
            const active = sort.key === key;
            const arrow = active ? (sort.dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort';
            return `<th class="ct-sortable${active ? ' ct-sorted' : ''}" data-case-sort="${key}" tabindex="0" role="button" aria-label="Sort by ${label}">${label} <i class="fa-solid ${arrow}"></i></th>`;
        };

        const canEditCase = globalRoleName === 'admin' || globalRoleName === 'lawyer';

        const rows = cases.map(c => {
            const isClosed = c.status === 'closed';
            const clientName = escapeHtml(c.clients?.client_name || 'No Client');
            const lawyers = (c.case_lawyers || []).slice().sort((a, b) => (rowIsLead(b) ? 1 : 0) - (rowIsLead(a) ? 1 : 0));
            const lawyerCell = lawyers.length
                ? lawyers.map(r => `<div class="ct-lawyer">${rowIsLead(r) ? '<i class="fa-solid fa-gavel"></i> ' : ''}Atty. ${escapeHtml(rowName(r) || 'Unknown')}</div>`).join('')
                : '<span class="ct-muted">Not assigned</span>';

            const iconBtn = (onclick, icon, label, tone = '') =>
                `<button type="button" class="ct-icon-btn ${tone}" onclick="${onclick}" title="${label}" aria-label="${label}"><i class="fa-solid ${icon}"></i></button>`;
            const textBtn = (onclick, icon, label, tone) =>
                `<button type="button" class="ct-text-btn ${tone}" onclick="${onclick}"><i class="fa-solid ${icon}"></i> ${label}</button>`;

            const actions = [];
            if (canEditCase) {
                actions.push(isClosed
                    ? textBtn(`toggleCaseStatus('${c.id}', 'closed')`, 'fa-rotate-left', 'Reopen', 'ct-blue')
                    : textBtn(`toggleCaseStatus('${c.id}', '${c.status || 'active'}')`, 'fa-lock', 'Close case', 'ct-green'));
            }
            actions.push(iconBtn(`openCaseDetail('${c.id}')`, 'fa-envelope', 'Case emails'));
            if (globalRoleName === 'admin') actions.push(iconBtn(`openCaseTeam('${c.id}')`, 'fa-gavel', 'Assign lawyers'));
            if (canEditCase) actions.push(iconBtn(`openCaseForm('${c.id}')`, 'fa-pen', 'Edit case'));
            if (globalRoleName === 'admin') actions.push(iconBtn(`deleteCase('${c.id}')`, 'fa-trash', 'Delete case', 'ct-red'));

            return `
                <tr>
                    <td class="ct-name">
                        ${escapeHtml(c.title)}
                        <div class="ct-sub">${c.case_number ? '#' + escapeHtml(c.case_number) : ''}${c.court_branch ? (c.case_number ? ' • ' : '') + escapeHtml(c.court_branch) : ''}</div>
                    </td>
                    <td>${clientName}</td>
                    <td>${escapeHtml(c.case_type || 'General')}${c.party_type ? `<div class="ct-sub">${escapeHtml(c.party_type)}</div>` : ''}</td>
                    <td>${c.case_stage ? `<span class="ct-badge ct-badge-stage">${escapeHtml(c.case_stage)}</span>` : '<span class="ct-muted">-</span>'}</td>
                    <td>${formatDate(c.date_filed || c.created_at)}</td>
                    <td>${lawyerCell}</td>
                    <td><span class="ct-badge ${isClosed ? 'ct-badge-closed' : 'ct-badge-active'}">${isClosed ? 'Closed' : 'Active'}</span></td>
                    <td class="ct-actions"><div>${actions.join('')}</div></td>
                </tr>`;
        }).join('');

        casesList.innerHTML = `
            <div class="ct-wrap">
                <table class="ct-table ct-table-wide">
                    <thead>
                        <tr>
                            ${th('title', 'Case')}
                            ${th('client', 'Client')}
                            ${th('case_type', 'Type')}
                            ${th('case_stage', 'Stage')}
                            ${th('date_filed', 'Filed')}
                            <th>Lawyer</th>
                            ${th('status', 'Status')}
                            <th class="ct-actions-head"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }

    function setupCasesTabControls() {
        const tabs = document.querySelectorAll('.cases-tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    const active = t === tab;
                    t.classList.toggle('active', active);
                    t.setAttribute('aria-selected', active ? 'true' : 'false');
                });
                document.querySelectorAll('.cases-tab-content').forEach(panel => {
                    panel.classList.toggle('hidden', panel.id !== tab.getAttribute('data-casestab'));
                });
            });
        });

        const fromEl = document.getElementById('cases-date-from');
        const toEl = document.getElementById('cases-date-to');
        const clearBtn = document.getElementById('cases-date-clear');
        const searchEl = document.getElementById('cases-search');
        const statusEl = document.getElementById('cases-filter-status');
        const typeEl = document.getElementById('cases-filter-type');
        const partyEl = document.getElementById('cases-filter-party');
        const stageEl = document.getElementById('cases-filter-stage');

        const fillFilter = (el, allLabel, list) => {
            if (!el) return;
            el.innerHTML = `<option value="all">${allLabel}</option>` +
                list.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
        };
        fillFilter(typeEl, 'All case types', CASE_TYPES);
        fillFilter(partyEl, 'All party types', PARTY_TYPES);
        fillFilter(stageEl, 'All stages', CASE_STAGES);

        const casesListEl = document.getElementById('cases-list-inject');
        if (casesListEl) {
            const applySort = (th) => {
                const key = th.getAttribute('data-case-sort');
                const cur = window.__casesSort || { key: 'date_filed', dir: 'desc' };
                window.__casesSort = { key: key, dir: (cur.key === key && cur.dir === 'asc') ? 'desc' : 'asc' };
                paintCasesList();
            };
            casesListEl.addEventListener('click', (e) => {
                const th = e.target.closest('[data-case-sort]');
                if (th) applySort(th);
            });
            casesListEl.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const th = e.target.closest('[data-case-sort]');
                if (th) { e.preventDefault(); applySort(th); }
            });
        }

        let searchTimer = null;
        if (searchEl) searchEl.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(paintCasesList, 150);
        });
        [statusEl, typeEl, partyEl, stageEl].forEach(el => { if (el) el.addEventListener('change', paintCasesList); });

        const onDateChange = () => {
            if (toEl && fromEl) toEl.min = fromEl.value || '';
            if (fromEl && toEl) fromEl.max = toEl.value || '';
            paintCasesList();
        };
        if (fromEl) fromEl.addEventListener('change', onDateChange);
        if (toEl) toEl.addEventListener('change', onDateChange);
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (fromEl) { fromEl.value = ''; fromEl.max = ''; }
                if (toEl) { toEl.value = ''; toEl.min = ''; }
                if (searchEl) searchEl.value = '';
                if (statusEl) statusEl.value = 'all';
                if (typeEl) typeEl.value = 'all';
                if (partyEl) partyEl.value = 'all';
                if (stageEl) stageEl.value = 'all';
                paintCasesList();
            });
        }
    }
    async function getPendingCaseEvents(caseId) {
        const { data, error } = await supabaseClient
            .from('calendar_events')
            .select('id, title, start_date, end_date')
            .eq('case_id', caseId)
            .order('start_date', { ascending: true });
        if (error) throw error;

        const now = new Date();
        return (data || []).filter(ev => {
            const end = new Date(ev.end_date || ev.start_date);
            if (isNaN(end.getTime())) return false;
            if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
                end.setHours(23, 59, 59, 999);
            }
            return end > now;
        });
    }

    function pendingEventsMessage(events) {
        const shown = events.slice(0, 3).map(ev =>
            `\u2022 ${ev.title} (${formatDate(ev.start_date)}${formatEventTime(ev.start_date) ? ', ' + formatEventTime(ev.start_date) : ''})`
        ).join('\n');
        const more = events.length > 3 ? `\n...and ${events.length - 3} more.` : '';
        return `This case can't be closed yet. It still has ${events.length === 1 ? 'an event' : events.length + ' events'} that ${events.length === 1 ? "hasn't" : "haven't"} happened:\n\n${shown}${more}\n\nClose the case after ${events.length === 1 ? 'it is' : 'they are'} done, or remove the event from the calendar if it was cancelled.`;
    }

    window.toggleCaseStatus = async function(caseId, currentStatus) {
        const newStatus = currentStatus === 'closed' ? 'active' : 'closed';
        try {
            if (newStatus === 'closed') {
                const pending = await getPendingCaseEvents(caseId);
                if (pending.length > 0) {
                    showToast(pendingEventsMessage(pending), 'warning', { duration: 10000 });
                    return;
                }
            }
            const { error } = await supabaseClient
                .from('cases')
                .update({ status: newStatus })
                .eq('id', caseId);

            if (error) throw error;
            
            const c = (window.__casesRegistry || {})[caseId];
            const caseLabel = c ? ((c.case_number ? '#' + c.case_number + ' - ' : '') + c.title) : caseId;
            if (newStatus === 'closed') {
                await logAuditActivity('CLOSE', 'Cases', `Closed case: ${caseLabel}`, caseId, { status: currentStatus }, { status: newStatus });
            } else {
                await logAuditActivity('REOPEN', 'Cases', `Reopened case: ${caseLabel}`, caseId, { status: currentStatus }, { status: newStatus });
            }
            
            await renderCasesTabView();
        } catch (error) {
            showToast('Could not update case status: ' + error.message, 'error');
        }
    };

   
    function disableBrowserAutofill() {
        ['add-event-form', 'upload-doc-form', 'add-lawyer-form', 'admin-add-client-form', 'tag-lawyer-form', 'case-email-form']
            .forEach(id => {
                const f = document.getElementById(id);
                if (f) f.setAttribute('autocomplete', 'off');
            });

        const tempPw = document.getElementById('add-lawyer-password');
        if (tempPw) tempPw.setAttribute('autocomplete', 'new-password');
    }

   
    function formatClientFullName(fname, mi, lname) {
        const initial = (mi || '').replace(/\./g, '').trim();
        return [fname, initial ? initial + '.' : '', lname].filter(Boolean).join(' ');
    }

    
    function escapeLikePattern(value) {
        return String(value).replace(/[\\%_]/g, '\\$&');
    }

    async function fillLawyerSelect(selectEl, placeholder) {
        if (!selectEl) return [];
        const lawyers = await getActiveLawyersData();
        window.__mcLawyers = {};
        lawyers.forEach(l => { window.__mcLawyers[l.id] = l; });

        const emptyLabel = lawyers.length > 0 ? placeholder : 'No active lawyers. Register one in Manage Lawyers first.';
        selectEl.innerHTML = `<option value="">${emptyLabel}</option>` + lawyers.map(l =>
            `<option value="${l.id}">Atty. ${escapeHtml(l.full_name || 'Unnamed')}${l.specialization ? ' — ' + escapeHtml(l.specialization) : ''}</option>`
        ).join('');
        return lawyers;
    }

    function isAdminUser() { return globalRoleName === 'admin'; }
    function isStaffUser() { return globalRoleName === 'admin' || globalRoleName === 'secretary'; }

    function rowIsLead(r) { return r.lawyer_role ? r.lawyer_role === 'lead' : !!r.is_lead; }
    function rowName(r) { const p = r.lawyer || r.profiles; return (p && p.full_name) || ''; }

    function teamChipsHtml(rows) {
        const list = rows || [];
        if (list.length === 0) return '<span class="mc-tag mc-tag-unassigned">No lawyer assigned</span>';
        const chip = (r, label) => `<span class="mc-tag"><i class="fa-solid fa-gavel"></i> ${label}: Atty. ${escapeHtml(rowName(r) || 'Unknown')}</span>`;
        return list.filter(rowIsLead).map(r => chip(r, 'Lead')).join('') +
               list.filter(r => !rowIsLead(r)).map(r => chip(r, 'Co-lawyer')).join('');
    }

    function approvalBadge(status) {
        const styles = {
            pending: 'background:#fef3c7; color:#b45309;',
            approved: 'background:#dcfce7; color:#16a34a;',
            rejected: 'background:#fee2e2; color:#dc2626;'
        };
        const labels = { pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected' };
        return `<span style="font-size:10px; padding:3px 10px; border-radius:99px; font-weight:700; margin-left:8px; vertical-align:middle; ${styles[status] || ''}">${labels[status] || escapeHtml(status || '')}</span>`;
    }

    async function renderClientsView() {
        const listEl = document.getElementById('clients-list-inject');
        if (!listEl) return;
        listEl.innerHTML = skeletonRows(4);

        const subtitle = document.getElementById('clients-subtitle');
        if (subtitle) {
            subtitle.textContent = globalRoleName === 'lawyer'
                ? 'Clients assigned to you by the administrator.'
                : (isAdminUser() ? 'Approve new clients, assign lawyers and manage client records.'
                                 : 'Add new clients. The administrator approves them and assigns a lawyer.');
        }

        try {
            const select = 'id, client_name, client_email, client_phone, full_address, auth_user_id, created_at, registered_by, approval_status, rejection_reason, ' +
                'client_lawyers(lawyer_id, lawyer_role, lawyer:profiles!client_lawyers_lawyer_id_fkey(full_name)), ' +
                'cases(id, title, case_number, status, created_at)';
            const { data: clients, error } = await supabaseClient
                .from('clients')
                .select(select)
                .order('created_at', { ascending: false });
            if (error) throw error;

            window.__clientsDirectory = clients || [];
            paintClientsDirectory();
            renderAdminAttention();
        } catch (err) {
            console.error('Error loading clients:', err);
            const countEl = document.getElementById('clients-count');
            if (countEl) countEl.textContent = '';
            listEl.innerHTML = errorStateHtml("Could not load clients.", "renderClientsView");
        }
    }

    function paintClientsDirectory() {
        const listEl = document.getElementById('clients-list-inject');
        const countEl = document.getElementById('clients-count');
        if (!listEl) return;

        const term = (document.getElementById('clients-search')?.value || '').trim().toLowerCase();
        const statusFilter = isStaffUser() ? (document.getElementById('clients-status-filter')?.value || 'all') : 'all';
        const all = window.__clientsDirectory || [];

        const clients = all.filter(c => {
            if (statusFilter !== 'all' && c.approval_status !== statusFilter) return false;
            if (!term) return true;
            const haystack = [
                c.client_name, c.client_email, c.client_phone,
                ...(c.client_lawyers || []).map(rowName),
                ...(c.cases || []).map(cs => `${cs.title || ''} ${cs.case_number || ''}`)
            ].join(' ').toLowerCase();
            return haystack.includes(term);
        });

        const pending = all.filter(c => c.approval_status === 'pending').length;
        if (countEl) {
            const base = (term || statusFilter !== 'all') ? `${clients.length} of ${all.length}` : `Total: ${all.length}`;
            countEl.textContent = (isAdminUser() && pending > 0) ? `${base} • ${pending} pending approval` : base;
        }

        if (all.length === 0) {
            listEl.innerHTML = `<p class="mc-empty">${globalRoleName === 'lawyer' ? 'No clients have been assigned to you yet.' : 'No clients yet.'}</p>`;
            return;
        }
        if (clients.length === 0) {
            listEl.innerHTML = '<p class="mc-empty">No clients match your filters.</p>';
            return;
        }

        const staff = isStaffUser();
        const sort = window.__clientsSort || { key: 'created_at', dir: 'desc' };
        const sortValue = {
            client_name: c => (c.client_name || '').toLowerCase(),
            client_email: c => (c.client_email || '').toLowerCase(),
            client_phone: c => (c.client_phone || '').toLowerCase(),
            cases: c => (c.cases || []).length,
            created_at: c => new Date(c.created_at || 0).getTime()
        }[sort.key] || (c => 0);
        clients.sort((a, b) => {
            const x = sortValue(a), y = sortValue(b);
            const r = x < y ? -1 : (x > y ? 1 : 0);
            return sort.dir === 'asc' ? r : -r;
        });

        const btn = (action, id, icon, label, style = '') =>
            `<button type="button" class="mc-tag-btn" data-client-action="${action}" data-client-id="${id}" style="${style}"><i class="fa-solid ${icon}"></i> ${label}</button>`;

        const th = (key, label) => {
            const active = sort.key === key;
            const arrow = active ? (sort.dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort';
            return `<th class="ct-sortable${active ? ' ct-sorted' : ''}" data-client-sort="${key}" tabindex="0" role="button" aria-label="Sort by ${label}">${label} <i class="fa-solid ${arrow}"></i></th>`;
        };

        const rows = clients.map(c => {
            const cases = c.cases || [];
            const openCases = cases.filter(cs => cs.status !== 'closed').length;
            const lawyers = (c.client_lawyers || []).slice().sort((a, b) => (rowIsLead(b) ? 1 : 0) - (rowIsLead(a) ? 1 : 0));
            const lawyerCell = lawyers.length
                ? lawyers.map(r => `<div class="ct-lawyer">${rowIsLead(r) ? '<i class="fa-solid fa-gavel"></i> ' : ''}Atty. ${escapeHtml(rowName(r) || 'Unknown')}</div>`).join('')
                : '<span class="ct-muted">Not assigned</span>';

            const iconBtn = (action, icon, label, tone = '') =>
                `<button type="button" class="ct-icon-btn ${tone}" data-client-action="${action}" data-client-id="${c.id}" title="${label}" aria-label="${label}"><i class="fa-solid ${icon}"></i></button>`;
            const textBtn = (action, icon, label, tone) =>
                `<button type="button" class="ct-text-btn ${tone}" data-client-action="${action}" data-client-id="${c.id}"><i class="fa-solid ${icon}"></i> ${label}</button>`;

            const actions = [];
            if (isAdminUser()) {
                if (c.approval_status === 'pending') {
                    actions.push(textBtn('approve', 'fa-check', 'Approve', 'ct-green'));
                    actions.push(iconBtn('reject', 'fa-xmark', 'Reject', 'ct-red'));
                } else if (c.approval_status === 'rejected') {
                    actions.push(textBtn('approve', 'fa-check', 'Approve', 'ct-green'));
                } else {
                    actions.push(textBtn('assign', 'fa-gavel', 'Assign lawyers', 'ct-blue'));
                }
            }
            actions.push(iconBtn('view', 'fa-eye', 'View details'));
            if (isAdminUser()) {
                actions.push(iconBtn('edit', 'fa-pen', 'Edit client'));
                actions.push(iconBtn('delete', 'fa-trash', 'Delete client', 'ct-red'));
            }

            return `
                <tr>
                    <td class="ct-name"><a href="#" class="ct-name-link" data-client-action="view" data-client-id="${c.id}">${escapeHtml(c.client_name || 'Unnamed client')}</a></td>
                    <td>${c.client_email ? escapeHtml(c.client_email) : '<span class="ct-muted">No email</span>'}</td>
                    <td>${c.client_phone ? escapeHtml(c.client_phone) : '<span class="ct-muted">-</span>'}</td>
                    <td>${lawyerCell}</td>
                    <td>${cases.length}${openCases > 0 ? `<span class="ct-muted"> (${openCases} active)</span>` : ''}</td>
                    ${staff ? `<td>${approvalBadge(c.approval_status).replace('margin-left:8px;', '')}</td>` : ''}
                    <td class="ct-actions"><div>${actions.join('')}</div></td>
                </tr>`;
        }).join('');

        listEl.innerHTML = `
            <div class="ct-wrap">
                <table class="ct-table">
                    <thead>
                        <tr>
                            ${th('client_name', 'Name')}
                            ${th('client_email', 'Email address')}
                            ${th('client_phone', 'Phone')}
                            <th>Lawyer</th>
                            ${th('cases', 'Cases')}
                            ${staff ? '<th>Status</th>' : ''}
                            <th class="ct-actions-head"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }

    function openClientViewModal(client) {
        const existing = document.getElementById('view-client-modal');
        if (existing) existing.remove();

        const cases = (client.cases || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const caseLines = cases.length
            ? cases.map(cs => `<div class="mc-case-line"><strong>${escapeHtml(cs.title)}</strong>${cs.case_number ? `<span class="mc-case-no">#${escapeHtml(cs.case_number)}</span>` : ''}${cs.status === 'closed' ? '<span class="mc-tag mc-tag-closed">Closed</span>' : ''}</div>`).join('')
            : '<span class="ct-muted">No cases yet.</span>';
        const field = (label, html) => `<div class="cv-field"><span class="cv-label">${label}</span><div class="cv-value">${html}</div></div>`;
        const rejected = (client.approval_status === 'rejected' && client.rejection_reason)
            ? field('Rejection reason', `<span style="color:#dc2626;">${escapeHtml(client.rejection_reason)}</span>`) : '';

        const overlay = document.createElement('div');
        overlay.id = 'view-client-modal';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content mc-modal">
                <div class="modal-header mc-modal-head">
                    <div>
                        <h2>${escapeHtml(client.client_name || 'Unnamed client')}${isStaffUser() ? approvalBadge(client.approval_status) : ''}</h2>
                        <p>Client details${isAdminUser() ? '' : ' (read only)'}</p>
                    </div>
                    <button type="button" class="btn-close" data-cv-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="cv-grid">
                    ${field('Email address', client.client_email ? escapeHtml(client.client_email) : '<span class="ct-muted">No email</span>')}
                    ${field('Phone', client.client_phone ? escapeHtml(client.client_phone) : '<span class="ct-muted">-</span>')}
                    ${field('Address', client.full_address ? escapeHtml(client.full_address) : '<span class="ct-muted">No address</span>')}
                    ${field('Added on', formatDate(client.created_at))}
                    ${rejected}
                </div>
                <div class="cv-section"><span class="cv-label">Lawyers</span><div style="margin-top:6px;">${teamChipsHtml(client.client_lawyers)}</div></div>
                <div class="cv-section"><span class="cv-label">Cases (${cases.length})</span><div class="mc-case-list" style="margin-top:6px;">${caseLines}</div></div>
                ${isAdminUser() ? '<div class="cv-footer"><button type="button" class="mc-submit" data-cv-edit style="width:auto; padding:10px 22px;"><i class="fa-solid fa-pen"></i> Edit client</button></div>' : ''}
            </div>`;
        document.body.appendChild(overlay);

        const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('[data-cv-close]').addEventListener('click', close);
        const editBtn = overlay.querySelector('[data-cv-edit]');
        if (editBtn) editBtn.addEventListener('click', () => { close(); openEditClientModal(client); });
    }

    async function handleClientAction(action, clientId) {
        if (action !== 'view' && !isAdminUser()) return;
        const client = (window.__clientsDirectory || []).find(c => String(c.id) === String(clientId));
        if (!client) return;

        try {
            if (action === 'view') {
                openClientViewModal(client);
            } else if (action === 'approve' || action === 'assign') {
                await openTeamModal('client', client.id, { approve: action === 'approve' });
                } else if (action === 'reject') {
                const reason = (await promptDialog({ title: 'Reject client', message: `Reject ${client.client_name}?`, label: 'Reason (optional)', placeholder: 'e.g., Incomplete documents', confirmLabel: 'Reject', danger: true, multiline: true }));
                if (reason === null) return;
                const { error } = await supabaseClient
                    .from('clients')
                    .update({ approval_status: 'rejected', rejection_reason: reason.trim() || null })
                    .eq('id', client.id);
                if (error) throw error;
                await logAuditActivity('UPDATE', 'Clients', `Rejected client: ${client.client_name}`, client.id, client, { approval_status: 'rejected', rejection_reason: reason.trim() || null });
                await renderClientsView();
            } else if (action === 'edit') {
                openEditClientModal(client);
            } else if (action === 'delete') {
                if (!(await confirmDialog({ title: 'Delete client', confirmLabel: 'Delete', danger: true, message: `Delete ${client.client_name}? This cannot be undone.` }))) return;
                const { error } = await supabaseClient.from('clients').delete().eq('id', client.id);
                if (error) {
                    throw new Error(error.message + '\n\nA client that still has cases, documents or events cannot be deleted. Remove or reassign those first.');
                }
                await logAuditActivity('DELETE', 'Clients', `Deleted client: ${client.client_name}`, client.id, { id: client.id, client_name: client.client_name }, null);
                await renderClientsView();
            }
        } catch (err) {
            console.error('Client action failed:', err);
            showToast('Action failed: ' + err.message, 'error');
        }
    }

    function openEditClientModal(client) {
        const modal = document.getElementById('edit-client-modal');
        if (!modal) return;
        document.getElementById('ec-id').value = client.id;
        document.getElementById('ec-name').value = client.client_name || '';
        document.getElementById('ec-email').value = client.client_email || '';
        document.getElementById('ec-phone').value = client.client_phone || '';
        document.getElementById('ec-address').value = client.full_address || '';
        modal.classList.remove('hidden');
    }

    const teamModalState = { locked: false, syncCo: null };

    function hideTeamError() {
        const el = document.getElementById('team-error');
        if (el) el.classList.add('hidden');
    }

    function showTeamError(message) {
        const el = document.getElementById('team-error');
        if (!el) return;
        el.textContent = message;
        el.classList.remove('hidden');
    }

    function setTeamModalLocked(locked) {
        teamModalState.locked = !!locked;
        const leadSel = document.getElementById('team-lead');
        const submitBtn = document.getElementById('team-submit-btn');
        if (leadSel) leadSel.disabled = teamModalState.locked;
        if (submitBtn) submitBtn.disabled = teamModalState.locked;
        if (typeof teamModalState.syncCo === 'function') teamModalState.syncCo();
    }

    async function openTeamModal(kind, id, { approve = false } = {}) {
        if (!isAdminUser()) return;
        const modal = document.getElementById('team-modal');
        const leadSel = document.getElementById('team-lead');
        const coList = document.getElementById('team-co-list');
        if (!modal || !leadSel || !coList) return;

        let rows = [];
        let subtitle = '';
        if (kind === 'client') {
            const rec = (window.__clientsDirectory || []).find(c => String(c.id) === String(id));
            rows = (rec && rec.client_lawyers) || [];
            subtitle = rec ? rec.client_name : '';
        } else {
            const rec = (window.__casesRegistry || {})[id];
            rows = (rec && rec.case_lawyers) || [];
            subtitle = rec ? `${rec.case_number ? '#' + rec.case_number + ' — ' : ''}${rec.title}` : '';
        }

        let lawyers = [];
        try {
            lawyers = await getActiveLawyersData();
        } catch (err) {
            showToast('Could not load lawyers: ' + err.message, 'error');
            return;
        }

        const currentLead = (rows.find(rowIsLead) || {}).lawyer_id || '';
        const currentCo = rows.filter(r => !rowIsLead(r)).map(r => r.lawyer_id);
        const label = l => `Atty. ${escapeHtml(l.full_name || 'Unnamed')}${l.specialization ? ' — ' + escapeHtml(l.specialization) : ''}`;

        leadSel.innerHTML = '<option value="">— No lead lawyer —</option>' +
            lawyers.map(l => `<option value="${l.id}">${label(l)}</option>`).join('');
        leadSel.value = currentLead;

        coList.innerHTML = lawyers.length > 0
            ? lawyers.map(l => `
                <label class="team-co-item">
                    <input type="checkbox" value="${l.id}" ${currentCo.includes(l.id) ? 'checked' : ''}>
                    <span class="team-co-text">
                        <span class="team-co-name">Atty. ${escapeHtml(l.full_name || 'Unnamed')}</span>
                        ${l.specialization ? `<span class="team-co-spec">${escapeHtml(l.specialization)}</span>` : ''}
                    </span>
                </label>`).join('')
            : '<p class="team-co-empty">No active lawyers. Add one in Manage Lawyers first.</p>';

        teamModalState.syncCo = () => {
            coList.querySelectorAll('.team-co-item').forEach(item => {
                const cb = item.querySelector('input[type="checkbox"]');
                const isLead = cb.value === leadSel.value;
                if (isLead) cb.checked = false;
                cb.disabled = teamModalState.locked || isLead;
                item.classList.toggle('is-disabled', cb.disabled);
            });
        };
        leadSel.onchange = () => { hideTeamError(); teamModalState.syncCo(); };
        coList.onchange = hideTeamError;

        const isLocked = kind === 'client' && !approve && rows.length > 0;
        setTeamModalLocked(isLocked);
        const noticeEl = document.getElementById('team-lock-notice');
        if (noticeEl) noticeEl.classList.toggle('hidden', !isLocked);
        const authEl = document.getElementById('team-unlock-auth');
        if (authEl) authEl.classList.add('hidden');
        const unlockBtnEl = document.getElementById('team-unlock-btn');
        if (unlockBtnEl) unlockBtnEl.classList.remove('hidden');
        const pwEl = document.getElementById('team-unlock-password');
        if (pwEl) pwEl.value = '';
        hideTeamError();
        const unlockErr = document.getElementById('team-unlock-error');
        if (unlockErr) unlockErr.classList.add('hidden');

        document.getElementById('team-kind').value = kind;
        document.getElementById('team-target-id').value = id;
        document.getElementById('team-approve').value = approve ? '1' : '';
        document.getElementById('team-modal-title').textContent =
            approve ? 'Approve client' : (kind === 'client' ? 'Assign lawyers' : 'Case lawyers');
        document.getElementById('team-modal-subtitle').textContent = subtitle;
        document.getElementById('team-submit-btn').textContent = approve ? 'Approve & assign' : 'Save';
        modal.classList.remove('hidden');
    }

    function setupTeamModal() {
        const modal = document.getElementById('team-modal');
        const form = document.getElementById('team-form');
        const closeBtn = document.getElementById('close-team-modal-btn');
        if (!modal || !form) return;

        if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

        const unlockBtn = document.getElementById('team-unlock-btn');
        const authBox = document.getElementById('team-unlock-auth');
        const pwInput = document.getElementById('team-unlock-password');
        const confirmBtn = document.getElementById('team-unlock-confirm');
        const unlockError = document.getElementById('team-unlock-error');

        const showUnlockError = (msg) => {
            if (!unlockError) return;
            unlockError.textContent = msg;
            unlockError.classList.remove('hidden');
        };

        if (unlockBtn && authBox) {
            unlockBtn.addEventListener('click', () => {
                authBox.classList.remove('hidden');
                unlockBtn.classList.add('hidden');
                if (pwInput) pwInput.focus();
            });
        }

        const confirmUnlock = async () => {
            if (!isAdminUser() || !currentUser || !currentUser.email) {
                showUnlockError('Only an administrator can unlock this.');
                return;
            }
            const password = pwInput ? pwInput.value : '';
            if (!password) {
                showUnlockError('Enter your password.');
                return;
            }
            confirmBtn.disabled = true;
            const idleText = confirmBtn.textContent;
            confirmBtn.textContent = 'Checking...';
            if (unlockError) unlockError.classList.add('hidden');
            try {
                const { error } = await supabaseClient.auth.signInWithPassword({
                    email: currentUser.email,
                    password: password
                });
                if (error) {
                    showUnlockError('Incorrect password. Please try again.');
                    return;
                }
                if (pwInput) pwInput.value = '';
                setTeamModalLocked(false);
                const notice = document.getElementById('team-lock-notice');
                if (notice) notice.classList.add('hidden');
                showToast('Unlocked. You can now change the assigned lawyers.', 'success');
            } catch (err) {
                showUnlockError('Could not verify your password. Please try again.');
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = idleText;
            }
        };

        if (confirmBtn) confirmBtn.addEventListener('click', confirmUnlock);
        if (pwInput) {
            pwInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); confirmUnlock(); }
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (teamModalState.locked) {
                showTeamError('This assignment is locked. Unlock it with your password to make changes.');
                return;
            }
            const kind = document.getElementById('team-kind').value;
            const id = document.getElementById('team-target-id').value;
            const approve = !!document.getElementById('team-approve').value;
            const lead = document.getElementById('team-lead').value || null;
            const co = [...document.querySelectorAll('#team-co-list input[type="checkbox"]:checked')]
                .map(cb => cb.value)
                .filter(v => v !== lead);

            if (!lead) {
                showTeamError(co.length > 0
                    ? 'Choose a lead lawyer first. Co-lawyers cannot be saved without a lead lawyer.'
                    : 'Choose a lead lawyer before saving.');
                return;
            }
            hideTeamError();

            const submitBtn = document.getElementById('team-submit-btn');
            const idle = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
            try {
                    if (kind === 'client') {
                    const { error } = await supabaseClient.rpc('set_client_team', {
                        p_client_id: Number(id), p_lead: lead, p_co: co
                    });
                    if (error) throw error;
                    if (approve) {
                        const { error: approveError } = await supabaseClient
                            .from('clients')
                            .update({ approval_status: 'approved' })
                            .eq('id', Number(id));
                        if (approveError) throw approveError;
                        await logAuditActivity('UPDATE', 'Clients', `Approved client and assigned lawyer team`, id);
                    } else {
                        await logAuditActivity('UPDATE', 'Clients', `Updated assigned lawyer team`, id);
                    }
                } else {
                    const { error } = await supabaseClient.rpc('set_case_team', {
                        p_case_id: id, p_lead: lead, p_co: co
                    });
                    if (error) throw error;
                }

                modal.classList.add('hidden');
                if (kind === 'client') await renderClientsView();
                else await renderCasesTabView();
                updateDashboardStats();
            } catch (err) {
                console.error('Error saving lawyer team:', err);
                showToast('Could not save: ' + err.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = idle;
            }
        });
    }

    const CASE_REQUIRED_FIELDS = [
        ['cf-client', 'Please select a client.'],
        ['cf-title', 'Case title is required.'],
        ['cf-type', 'Please select a case type.'],
        ['cf-party', 'Please select a party type.'],
        ['cf-court', 'Court and Branch No. / Agency is required.'],
        ['cf-date', 'Date filed is required.'],
        ['cf-stage', 'Please select a case stage.']
    ];

    function clearCaseFormErrors() {
        const form = document.getElementById('case-form');
        if (!form) return;
        form.querySelectorAll('.cf-error').forEach(n => n.remove());
        form.querySelectorAll('.cf-invalid').forEach(el => el.classList.remove('cf-invalid'));
    }

    function validateCaseForm() {
        clearCaseFormErrors();
        let firstInvalid = null;

        const leadWrap = document.getElementById('cf-lead-wrap');
        const leadRequired = !!leadWrap && leadWrap.style.display !== 'none';
        const requiredFields = CASE_REQUIRED_FIELDS.slice();
        if (leadRequired) requiredFields.splice(1, 0, ['cf-lead', 'Please select a lead lawyer. A case cannot be saved without one.']);

        requiredFields.forEach(([id, message]) => {
            const el = document.getElementById(id);
            if (!el) return;
            if ((el.value || '').trim() !== '') return;

            el.classList.add('cf-invalid');
            const note = document.createElement('div');
            note.className = 'cf-error';
            note.textContent = message;
            const field = el.closest('.mc-field');
            (field || el.parentElement).appendChild(note);

            const clear = () => {
                el.classList.remove('cf-invalid');
                note.remove();
                el.removeEventListener('input', clear);
                el.removeEventListener('change', clear);
            };
            el.addEventListener('input', clear);
            el.addEventListener('change', clear);

            if (!firstInvalid) firstInvalid = el;
        });

        if (firstInvalid) {
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstInvalid.focus({ preventScroll: true });
            return false;
        }
        return true;
    }

    async function openCaseForm(caseId = null) {
        const modal = document.getElementById('case-form-modal');
        const form = document.getElementById('case-form');
        if (!modal || !form) return;

        const isEdit = !!caseId;
        const record = isEdit ? (window.__casesRegistry || {})[caseId] : null;

        form.reset();
        clearCaseFormErrors();
        fillSelect(document.getElementById('cf-type'), CASE_TYPES, 'Select case type');
        fillSelect(document.getElementById('cf-party'), PARTY_TYPES, 'Select party type');
        fillSelect(document.getElementById('cf-stage'), CASE_STAGES);
        document.getElementById('cf-id').value = caseId || '';
        document.getElementById('cf-heading').textContent = isEdit ? 'Edit Case' : 'New Case';
        document.getElementById('cf-submit-btn').textContent = isEdit ? 'Save changes' : 'Save case';

        const clientSel = document.getElementById('cf-client');
        clientSel.innerHTML = '<option value="">Loading clients...</option>';
        modal.classList.remove('hidden');

        try {
            const { data: clients, error } = await supabaseClient
                .from('clients')
                .select('id, client_name')
                .eq('approval_status', 'approved')
                .order('client_name', { ascending: true });
            if (error) throw error;

            const placeholder = (clients || []).length > 0
                ? 'Select a client'
                : (isAdminUser() ? 'No approved clients yet' : 'No clients assigned to you yet');
            clientSel.innerHTML = `<option value="">${placeholder}</option>` +
                (clients || []).map(c => `<option value="${c.id}">${escapeHtml(c.client_name)}</option>`).join('');
        } catch (err) {
            console.error('Error loading clients for case form:', err);
            clientSel.innerHTML = '<option value="">Could not load clients</option>';
        }

        const leadWrap = document.getElementById('cf-lead-wrap');
        const leadSel = document.getElementById('cf-lead');
        const showLead = isAdminUser() && !isEdit;
        if (leadWrap) leadWrap.style.display = showLead ? '' : 'none';
        if (showLead && leadSel) {
            try {
                const lawyers = await getActiveLawyersData();
                leadSel.innerHTML = '<option value="">Select a lead lawyer</option>' +
                    lawyers.map(l => `<option value="${l.id}">Atty. ${escapeHtml(l.full_name || 'Unnamed')}</option>`).join('');
            } catch (err) {
                leadSel.innerHTML = '<option value="">Could not load lawyers</option>';
            }
        }

        if (record) {
            clientSel.value = String(record.client_id || '');
            clientSel.disabled = true;
            document.getElementById('cf-title').value = record.title || '';
            document.getElementById('cf-type').value = record.case_type || '';
            document.getElementById('cf-party').value = record.party_type || '';
            document.getElementById('cf-court').value = record.court_branch || '';
            document.getElementById('cf-stage').value = record.case_stage || 'For Filing';
            document.getElementById('cf-desc').value = record.case_description || '';
            document.getElementById('cf-title').readOnly = true;
            document.getElementById('cf-type').disabled = !!record.case_type;
            document.getElementById('cf-party').disabled = !!record.party_type;
            document.getElementById('cf-stage').disabled = true;
            document.getElementById('cf-date').disabled = true;
            document.getElementById('cf-court').readOnly = !!record.court_branch;
            document.getElementById('cf-date').value = toLocalDateKey(record.date_filed || record.created_at);
        } else {
            clientSel.disabled = false;
            document.getElementById('cf-stage').value = 'For Filing';
            document.getElementById('cf-title').readOnly = false;
            document.getElementById('cf-type').disabled = false;
            document.getElementById('cf-party').disabled = false;
            document.getElementById('cf-stage').disabled = false;
            document.getElementById('cf-date').disabled = false;
            document.getElementById('cf-court').readOnly = false;
            document.getElementById('cf-date').value = toLocalDateKey(new Date().toISOString());
        }
    }

    function setupCaseForm() {
        const modal = document.getElementById('case-form-modal');
        const form = document.getElementById('case-form');
        const closeBtn = document.getElementById('close-case-form-btn');
        const newBtn = document.getElementById('btn-new-case');
        if (!modal || !form) return;

        form.setAttribute('novalidate', '');

        if (newBtn) newBtn.addEventListener('click', () => { if (globalRoleName !== 'secretary') openCaseForm(null); });
        if (closeBtn) closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            clearCaseFormErrors();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateCaseForm()) return;

            const val = id => (document.getElementById(id)?.value || '').trim();
            const caseId = val('cf-id');
            const clientId = val('cf-client');
            const title = val('cf-title');
            const type = val('cf-type');
            const desc = val('cf-desc');
            const dateVal = val('cf-date');
            const lead = val('cf-lead');
            const partyType = val('cf-party');
            const courtBranch = val('cf-court');
            const caseStage = val('cf-stage');
            const dateIso = dateVal ? new Date(dateVal + 'T00:00:00').toISOString() : null;

            const submitBtn = document.getElementById('cf-submit-btn');
            const idle = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
            try {
                if (caseId) {
                    const patch = {
                        title: title,
                        case_type: type || null,
                        party_type: partyType || null,
                        court_branch: courtBranch || null,
                        case_stage: caseStage || null,
                        case_description: desc || null
                    };
                    if (dateIso) patch.date_filed = dateIso;
                    if (isAdminUser()) patch.client_id = Number(clientId);
                    const { data: updated, error } = await supabaseClient
                        .from('cases').update(patch).eq('id', caseId).select('id');
                    if (error) throw error;
                    if (!updated || updated.length === 0) {
                        throw new Error('The case was not updated. You may not have permission to edit it.');
                    }

                    const oldCaseRecord = (window.__casesRegistry || {})[caseId];
                    await logAuditActivity('UPDATE', 'Cases', `Edited case: ${title}`, caseId, oldCaseRecord, patch);
                } else {
                    const { data, error } = await createCase({
                        title: title, caseType: type, description: desc,
                        clientId: clientId, dateFiled: dateIso, leadLawyerId: lead || null,
                        courtBranch: courtBranch,
                        caseStage: caseStage, partyType: partyType
                    });
                    if (error) throw error;
                    showToast('Case saved.' + (data && data.case_number ? `\n\nCase Number: ${data.case_number}` : ''), 'success');
                }

                modal.classList.add('hidden');
                await renderCasesTabView();
                updateDashboardStats();
                renderMyCasesTab();
            } catch (err) {
                console.error('Error saving case:', err);
                showToast('Could not save the case: ' + err.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = idle;
            }
        });
    }

    window.openCaseForm = openCaseForm;
    window.openCaseTeam = function(caseId) { openTeamModal('case', caseId); };
    window.deleteCase = async function(caseId) {
        if (!isAdminUser()) return;
        const c = (window.__casesRegistry || {})[caseId];
        if (!(await confirmDialog({ title: 'Delete case', confirmLabel: 'Delete', danger: true, message: `Delete case "${c ? c.title : ''}"? This cannot be undone.` }))) return;
        const { error } = await supabaseClient.from('cases').delete().eq('id', caseId);
        if (error) {
            showToast('Could not delete the case: ' + error.message + '\n\nA case that still has documents or events linked to it cannot be deleted.', 'error');
            return;
        }
        
        await logAuditActivity('DELETE', 'Cases', `Deleted case: ${c ? c.title : caseId}`, caseId, c, null);
        
        await renderCasesTabView();
        updateDashboardStats();
    };

    function setupManageClients() {
        const listEl = document.getElementById('clients-list-inject');
        const searchEl = document.getElementById('clients-search');
        const filterEl = document.getElementById('clients-status-filter');
        const openBtn = document.getElementById('btn-add-client');
        const addModal = document.getElementById('add-client-modal');
        const closeAddBtn = document.getElementById('close-add-client-btn');
        const form = document.getElementById('admin-add-client-form');
        const editModal = document.getElementById('edit-client-modal');
        const closeEditBtn = document.getElementById('close-edit-client-btn');
        const editForm = document.getElementById('edit-client-form');

        if (searchEl) searchEl.addEventListener('input', paintClientsDirectory);
        if (filterEl) filterEl.addEventListener('change', paintClientsDirectory);

        if (listEl) {
            listEl.addEventListener('click', (e) => {
                const sortTh = e.target.closest('[data-client-sort]');
                if (sortTh) {
                    const key = sortTh.getAttribute('data-client-sort');
                    const cur = window.__clientsSort || { key: 'created_at', dir: 'desc' };
                    window.__clientsSort = { key: key, dir: (cur.key === key && cur.dir === 'asc') ? 'desc' : 'asc' };
                    paintClientsDirectory();
                    return;
                }
                const btn = e.target.closest('[data-client-action]');
                if (btn) {
                    e.preventDefault();
                    handleClientAction(btn.getAttribute('data-client-action'), btn.getAttribute('data-client-id'));
                }
            });
            listEl.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const sortTh = e.target.closest('[data-client-sort]');
                if (sortTh) { e.preventDefault(); sortTh.click(); }
            });
        }

        if (openBtn && addModal) {
            openBtn.addEventListener('click', () => {
                if (!isStaffUser()) return;
                if (form) form.reset();
                addModal.classList.remove('hidden');
            });
        }
        if (closeAddBtn && addModal) closeAddBtn.addEventListener('click', () => addModal.classList.add('hidden'));
        if (closeEditBtn && editModal) closeEditBtn.addEventListener('click', () => editModal.classList.add('hidden'));

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!isStaffUser()) return;

                const submitBtn = form.querySelector('button[type="submit"]');
                const idleLabel = 'Add client';
                const setBusy = (label) => { submitBtn.disabled = true; submitBtn.textContent = label; };
                const val = id => (document.getElementById(id)?.value || '').trim();

                const clientName = formatClientFullName(val('mc-fname'), val('mc-mi'), val('mc-lname'));
                const email = val('mc-email');
                const phone = val('mc-phone');
                const address = val('mc-address');
                const wantsPortal = isAdminUser() && !!document.getElementById('mc-create-portal')?.checked;

                setBusy('Checking...');
                try {
                    const dupSelect = 'id, client_name, client_email';
                    const [byEmail, byPhone, byName] = await Promise.all([
                        supabaseClient.from('clients').select(dupSelect).ilike('client_email', escapeLikePattern(email)),
                        supabaseClient.from('clients').select(dupSelect).eq('client_phone', phone),
                        supabaseClient.from('clients').select(dupSelect).ilike('client_name', escapeLikePattern(clientName))
                    ]);
                    [byEmail, byPhone, byName].forEach(r => { if (r.error) throw r.error; });

                    const dup = byEmail.data?.[0] || byPhone.data?.[0] || byName.data?.[0];
                    if (dup) {
                        showToast(`A client with this name, email or phone already exists: "${dup.client_name}" (${dup.client_email || 'no email'}). Find them in the Client Directory instead of adding a duplicate.`, 'warning');
                        return;
                    }

                    setBusy('Saving client...');
                        const { data: newClient, error: clientError } = await supabaseClient
                        .from('clients')
                        .insert([{
                            client_name: clientName,
                            client_email: email,
                            client_phone: phone,
                            full_address: address || null,
                            registered_by: currentUser ? currentUser.id : null
                        }])
                        .select('id, approval_status')
                        .single();
                    if (clientError) throw clientError;

                    await logAuditActivity('INSERT', 'Clients', `Added new client: ${clientName}`, newClient.id);

                    let message = isAdminUser()
                        ? `${clientName} was added and approved. Use "Assign lawyers" to give them a lead lawyer.`
                        : `${clientName} was submitted. An administrator will approve or reject it.`;

                    if (wantsPortal && email) {
                        setBusy('Sending invite...');
                        const { error: inviteError } = await supabaseClient.functions.invoke('invite-client', {
                            body: {
                                client_id: newClient.id,
                                redirect_to: window.location.origin + window.location.pathname.replace('index.html', '') + 'client-portal.html'
                            }
                        });
                        if (inviteError) {
                            let detail = inviteError.message;
                            try {
                                const errBody = await inviteError.context.json();
                                if (errBody && errBody.error) detail = errBody.error;
                            } catch (e) {}
                            console.error('Portal invite error:', inviteError);
                            message += `\n\nThe portal invite could not be sent: ${detail}`;
                        } else {
                            message += `\n\nA portal invite was emailed to ${email}.`;
                        }
                    }

                    showToast(message, 'success');
                    form.reset();
                    if (addModal) addModal.classList.add('hidden');
                    await renderClientsView();
                } catch (error) {
                    console.error('Error adding client:', error);
                    showToast('Error adding client: ' + error.message, 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = idleLabel;
                }
            });
        }

        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!isAdminUser()) return;
                const val = id => (document.getElementById(id)?.value || '').trim();
                const submitBtn = editForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                try {
                    const clientId = Number(val('ec-id'));
                    const oldClient = (window.__clientsDirectory || []).find(c => c.id === clientId) || {};
                    const patch = {
                        client_name: val('ec-name'),
                        client_email: val('ec-email'),
                        client_phone: val('ec-phone'),
                        full_address: val('ec-address') || null
                    };

                    const { data: updated, error } = await supabaseClient
                        .from('clients')
                        .update(patch)
                        .eq('id', clientId)
                        .select('id');

                    if (error) throw error;
                    if (!updated || updated.length === 0) throw new Error('The client was not updated. Check your permissions.');
                    
                    await logAuditActivity('UPDATE', 'Clients', `Edited client profile: ${patch.client_name}`, clientId, oldClient, patch);

                    if (editModal) editModal.classList.add('hidden');
                    await renderClientsView();
                } catch (err) {
                    console.error('Error editing client:', err);
                    showToast('Could not save changes: ' + err.message, 'error');
                } finally {
                    submitBtn.disabled = false;
                }
            });
        }

        setupTeamModal();
        setupCaseForm();
    }

    window.openCaseDetail = async function(caseId) {
        const modal = document.getElementById('case-detail-modal');
        const titleEl = document.getElementById('case-detail-title');
        const subtitleEl = document.getElementById('case-detail-subtitle');
        const listEl = document.getElementById('case-emails-list');
        if (!modal || !listEl) return;

        const caseInfo = (window.__casesRegistry || {})[caseId];
        titleEl.textContent = caseInfo ? caseInfo.title : 'Case';
        subtitleEl.textContent = caseInfo
            ? `Client: ${caseInfo.clients?.client_name || 'No Client'}${caseInfo.clients?.client_email ? ' • ' + caseInfo.clients.client_email : ''}`
            : '';

        modal.setAttribute('data-active-case-id', caseId);
        modal.setAttribute('data-active-client-id', caseInfo?.clients?.id || '');
        modal.setAttribute('data-active-client-email', caseInfo?.clients?.client_email || '');
        const caseEmailForm = document.getElementById('case-email-form');
        if (caseEmailForm) caseEmailForm.reset();
        modal.classList.remove('hidden');
        listEl.innerHTML = skeletonRows(3);

        await loadCaseEmails(caseId);
    };

    async function loadCaseEmails(caseId) {
        const listEl = document.getElementById('case-emails-list');
        if (!listEl) return;

        try {
            const { data: emails, error } = await supabaseClient
                .from('email_queue')
                .select('*, documents(title, file_path)')
                .eq('case_id', caseId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!emails || emails.length === 0) {
                listEl.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:20px;">No emails sent for this case yet. Send an update below.</p>';
            } else {
                listEl.innerHTML = emails.map(m => {
                    const statusBadge = emailStatusBadge(m.status || (m.is_sent ? 'sent' : 'pending'));
                    const attachmentLink = m.documents
                        ? `<a href="#" data-doc-path="${escapeHtml(m.documents.file_path || '')}" data-doc-title="${escapeHtml(m.documents.title || '')}" style="display:inline-block; margin-top:6px; font-size:11px; color:#3b82f6; text-decoration:none;"><i class="fa-solid fa-paperclip"></i> ${escapeHtml(m.documents.title)}</a>`
                        : '';
                    return `
                        <div style="border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin-bottom:10px;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                                <p style="margin:0; font-size:13px; font-weight:700; color:#0f172a;">${escapeHtml(m.subject)}</p>
                                ${statusBadge}
                            </div>
                            <p style="margin:6px 0 0 0; font-size:12px; color:#475569; white-space:pre-wrap;">${escapeHtml(m.body || '')}</p>
                            ${attachmentLink}
                            <p style="margin:6px 0 0 0; font-size:10px; color:#94a3b8;">To: ${escapeHtml(m.recipient_email)} • ${escapeHtml(emailTimeText(m))}</p>
                            ${m.status === 'failed' ? `<p style="margin:6px 0 0 0; font-size:11px; color:#dc2626;">${escapeHtml(m.last_error || 'Sending failed.')} <a href="#" onclick="event.preventDefault(); retryEmail(${jsArg(m.id)}).then(() => loadCaseEmails(${jsArg(caseId)}));" style="color:#3b82f6; font-weight:600;">Retry</a></p>` : ''}
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Error loading case emails:', error);
            listEl.innerHTML = errorStateHtml("Could not load the emails for this case.", null);
        }
    }

    function setupCaseDetailModal() {
        const modal = document.getElementById('case-detail-modal');
        const closeBtn = document.getElementById('close-case-detail-btn');
        const form = document.getElementById('case-email-form');

        if (!modal) return;

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const caseId = modal.getAttribute('data-active-case-id');
                const clientId = modal.getAttribute('data-active-client-id');
                const recipientEmail = modal.getAttribute('data-active-client-email');
                const subjectInput = document.getElementById('case-email-subject');
                const bodyInput = document.getElementById('case-email-body');
                const attachmentInput = document.getElementById('case-email-attachment');
                const subject = subjectInput.value.trim();
                const body = bodyInput.value.trim();
                if (!subject || !body || !caseId) return;

                if (!recipientEmail) {
                    showToast('This case has no client email on file, so an update email cannot be sent.', 'warning');
                    return;
                }

                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;

                try {
                    const attachmentFile = attachmentInput && attachmentInput.files.length > 0 ? attachmentInput.files[0] : null;
                    let attachedDoc = null;
                    if (attachmentFile) {
                        if (submitBtn) submitBtn.innerText = 'Uploading attachment...';
                        attachedDoc = await uploadCaseDocument(attachmentFile, {
                            caseId: caseId,
                            clientId: clientId || null,
                            category: 'Email Attachment'
                        });
                    }

                    if (submitBtn) submitBtn.innerText = 'Sending...';

                    const emailRow = {
                        case_id: caseId,
                        client_id: clientId || null,
                        recipient_email: recipientEmail,
                        subject: subject,
                        body: body,
                        sent_by: currentUser ? currentUser.id : null,
                        scheduled_at: new Date().toISOString()
                    };
                    if (attachedDoc) emailRow.attachment_document_id = attachedDoc.id;

                    const { error } = await supabaseClient
                        .from('email_queue')
                        .insert([emailRow]);

                    if (error) throw error;
                    subjectInput.value = '';
                    bodyInput.value = '';
                    if (attachmentInput) attachmentInput.value = '';
                    await loadCaseEmails(caseId);
                } catch (error) {
                    showToast('Email could not be queued: ' + error.message, 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Email';
                    }
                }
            });
        }
    }

    function setupUploadModal() {
        const modal = document.getElementById('upload-doc-modal');
        const openBtn = document.getElementById('btn-upload-doc'); 
        const closeBtn = document.getElementById('close-upload-btn');
        const form = document.getElementById('upload-doc-form');

        const dropArea = document.getElementById('drag-drop-area');
        const fileInput = document.getElementById('doc-file-input');
        const dropText = document.getElementById('drag-drop-text');
        const fileNameInput = document.getElementById('doc-file-name');
        let selectedFile = null;

        if (!modal) return;

        
        async function populateDocCaseSelect() {
            const sel = document.getElementById('doc-case-select');
            if (!sel || !currentUser) return;
            sel.innerHTML = '';
            const none = document.createElement('option');
            none.value = '';
            none.textContent = 'No case (general document)';
            sel.appendChild(none);

            try {
                const myCases = await loadCaseOptions();

                (myCases || []).forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = `${c.case_number ? c.case_number + ' — ' : ''}${c.title || 'Untitled case'}`;
                    opt.dataset.caseNumber = c.case_number || '';
                    opt.dataset.clientId = c.client_id || '';
                    sel.appendChild(opt);
                });
            } catch (e) {
                console.error('Error loading cases for upload modal:', e);
            }
        }

        
        function resetUploadForm() {
            if (form) form.reset();
            if (fileInput) fileInput.value = '';
            if (dropArea && dropText) {
                dropArea.style.borderColor = '#cbd5e1';
                dropArea.style.backgroundColor = '#ffffff';
                dropText.innerText = "Drag and drop files here, or click to browse";
            }
            selectedFile = null;
            if (fileNameInput) fileNameInput.value = '';
        }

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                resetUploadForm();
                populateDocCaseSelect();
                modal.classList.remove('hidden');
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
                resetUploadForm();
            });
        }

        if (dropArea && fileInput) {
            dropArea.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    selectedFile = e.target.files[0];
                    dropText.innerText = selectedFile.name; 
                    if (fileNameInput) fileNameInput.value = selectedFile.name;
                    dropArea.style.borderColor = '#3b82f6'; 
                    dropArea.style.backgroundColor = '#eff6ff'; 
                }
            });

            dropArea.addEventListener('dragover', (e) => {
                e.preventDefault(); 
                dropArea.style.borderColor = '#3b82f6';
                dropArea.style.backgroundColor = '#eff6ff';
            });

            dropArea.addEventListener('dragleave', () => {
                if (!selectedFile) { 
                    dropArea.style.borderColor = '#cbd5e1';
                    dropArea.style.backgroundColor = '#ffffff';
                }
            });

            dropArea.addEventListener('drop', (e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length > 0) {
                    selectedFile = e.dataTransfer.files[0];
                    fileInput.files = e.dataTransfer.files; 
                    
                    dropText.innerText = selectedFile.name; 
                    if (fileNameInput) fileNameInput.value = selectedFile.name;
                    dropArea.style.borderColor = '#3b82f6';
                    dropArea.style.backgroundColor = '#eff6ff';
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault(); 
                
                if (!selectedFile) {
                    showToast("Please select or drag a file to upload first.", 'warning');
                    return;
                }

                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = "Uploading & Processing...";
                }

                const caseSel = document.getElementById('doc-case-select');
                const selectedCaseOpt = caseSel && caseSel.value ? caseSel.selectedOptions[0] : null;
                const matchedCaseId = selectedCaseOpt ? selectedCaseOpt.value : null;
                const matchedClientId = selectedCaseOpt && selectedCaseOpt.dataset.clientId ? selectedCaseOpt.dataset.clientId : null;
                const caseNum = selectedCaseOpt ? (selectedCaseOpt.dataset.caseNumber || '') : '';
                const category = document.getElementById('doc-category').value || 'Document';
                const tagsInput = document.getElementById('doc-tags').value || '';
                
                const finalTitle = resolveDocumentTitle(fileNameInput ? fileNameInput.value : '', selectedFile);
                const fileSizeMb = (selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB';

                try {
                    const uniqueFileName = `${Date.now()}_${safeStorageName(selectedFile.name)}`;
                    const { data: uploadData, error: uploadError } = await supabaseClient
                        .storage
                        .from('documents') 
                        .upload(uniqueFileName, selectedFile);

                    if (uploadError) {
                        console.error("Storage Error:", uploadError);
                        throw new Error("Failed to upload file to Storage. Please check if 'documents' bucket exists and your account is allowed to upload to it.");
                    }

                    const docData = { 
                        title: finalTitle, 
                        type: category.toLowerCase(), 
                        size: fileSizeMb,
                        file_path: uniqueFileName, 
                        case_id: matchedCaseId,
                        client_id: matchedClientId,
                        tags: caseNum ? `${tagsInput}${tagsInput ? ', ' : ''}Case #${caseNum}` : tagsInput,
                        uploaded_by: currentUser ? currentUser.id : null
                    };

                    docData.ocr_status = fileKind(selectedFile) ? 'processing' : null;

                    const { data: newDoc, error: dbError } = await supabaseClient
                        .from('documents')
                        .insert([docData])
                        .select('id, version_no')
                        .single();

                    if (dbError) {
                        console.error("Database Error:", dbError);
                        throw new Error("File uploaded, but failed to save details to database.");
                    }

                    await logAuditActivity('INSERT', 'Documents', `Uploaded document: ${finalTitle}`);

                    showToast('Document successfully uploaded and saved!', 'success');

                    const fileForIndex = selectedFile;
                    resetUploadForm();
                    modal.classList.add('hidden');

                    refreshDocumentList();
                    renderRecentDocumentsInSchedule();

                    if (newDoc && fileKind(fileForIndex)) {
                        indexDocumentFile(newDoc.id, newDoc.version_no || 1, fileForIndex);
                    }

                } catch (error) {
                    console.error('Error saving document:', error);
                    showToast('Error: \n' + error.message, 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = "Upload & Process";
                    }
                }
            });
        }
    }

    function setupAddLawyerModal() {
        const modal = document.getElementById('add-lawyer-modal');
        const openBtn = document.getElementById('btn-open-add-lawyer-modal'); 
        const closeBtn = document.getElementById('close-lawyer-modal-btn');
        const form = document.getElementById('add-lawyer-form');

        if (!modal) return;

        if (openBtn) {
            openBtn.addEventListener('click', async () => {
                if (globalRoleName !== 'admin') return;
                if (form) form.reset();
                const tempPwInput = document.getElementById('add-lawyer-password');
                if (tempPwInput) tempPwInput.placeholder = 'Min. 8 characters, with a letter and a number';
                modal.classList.remove('hidden');

                const roleSel = document.getElementById('add-lawyer-role');
                const specGroup = document.getElementById('add-lawyer-spec-group');
                if (!roleSel) return;
                try {
                    const { data: roles, error } = await supabaseClient
                        .from('roles')
                        .select('id, name')
                        .in('name', ['lawyer', 'secretary'])
                        .order('id', { ascending: true });
                    if (error) throw error;
                    roleSel.innerHTML = (roles || []).map(r =>
                        `<option value="${r.id}" data-name="${r.name}">${roleLabel(r.name)}</option>`).join('');
                } catch (err) {
                    console.error('Error loading roles:', err);
                    roleSel.innerHTML = '<option value="">Could not load roles</option>';
                }
                const syncSpec = () => {
                    const name = roleSel.options[roleSel.selectedIndex]?.dataset.name;
                    if (specGroup) specGroup.style.display = name === 'secretary' ? 'none' : '';
                };
                roleSel.onchange = syncSpec;
                syncSpec();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
                if (form) form.reset();
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault(); 
                
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = "Registering...";
                }

                const fname = document.getElementById('add-lawyer-fname').value.trim();
                const mi = document.getElementById('add-lawyer-mi').value.trim();
                const lname = document.getElementById('add-lawyer-lname').value.trim();
                const email = document.getElementById('add-lawyer-email').value.trim();
                const phone = document.getElementById('add-lawyer-phone').value.trim(); 
                const password = document.getElementById('add-lawyer-password').value;
                const roleSel = document.getElementById('add-lawyer-role');
                const roleId = Number(roleSel.value);
                const roleName = roleSel.options[roleSel.selectedIndex]?.dataset.name || 'lawyer';
                const isLawyerRole = roleName === 'lawyer';
                const spec = isLawyerRole ? document.getElementById('add-lawyer-spec').value : null;

                const formattedName = `${fname} ${mi ? mi + '. ' : ''}${lname}`.trim();

                try {
                    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
                        throw new Error('The password must be at least 8 characters and include a letter and a number.');
                    }

                    const { error } = await supabaseClient.functions.invoke('create-user', {
                        body: {
                            email: email,
                            password: password,
                            full_name: formattedName,
                            phone: phone,
                            specialization: spec,
                            role_id: roleId
                        }
                    });

                    if (error) {
                        let message = error.message;
                        try {
                            const body = await error.context.json();
                            if (body && body.error) message = body.error;
                        } catch (e) {}
                        throw new Error('Failed to register user: ' + message);
                    }

                    showToast(`${isLawyerRole ? 'Lawyer Atty.' : 'Secretary'} ${formattedName} successfully registered!`, 'success');
                    form.reset(); 
                    modal.classList.add('hidden'); 
                    
                    renderLawyerStatusWidget();
                    prepareEventModal();
                    renderManageLawyersList(); 
                    renderSecretariesList();

                } catch (error) {
                    console.error('Error adding user:', error);
                    showToast('Error: \n' + error.message, 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = "Register User";
                    }
                }
            });
        }
    }

    function setupMyProfileModal() {
        const modal = document.getElementById('my-profile-modal');
        const closeBtn = document.getElementById('close-my-profile-btn');
        const form = document.getElementById('my-profile-form');
        const trigger = document.getElementById('sidebar-profile-trigger');
        const photoBtn = document.getElementById('my-profile-photo-btn');
        const photoInput = document.getElementById('my-profile-photo-input');
        const avatarPreview = document.getElementById('my-profile-avatar-preview');

        if (!modal) return;

        let selectedPhotoFile = null;

        function renderAvatarPreview(imageUrl, initials) {
            if (!avatarPreview) return;
            if (imageUrl) {
                avatarPreview.style.backgroundImage = `url('${imageUrl}')`;
                avatarPreview.textContent = '';
            } else {
                avatarPreview.style.backgroundImage = 'none';
                avatarPreview.textContent = initials || '?';
            }
        }

        if (photoBtn && photoInput) {
            photoBtn.addEventListener('click', () => photoInput.click());

            photoInput.addEventListener('change', () => {
                const file = photoInput.files && photoInput.files[0];
                if (!file) return;

                if (file.size > 2 * 1024 * 1024) {
                    showToast('Please choose an image smaller than 2MB.', 'warning');
                    photoInput.value = '';
                    return;
                }

                selectedPhotoFile = file;
                const reader = new FileReader();
                reader.onload = (e) => renderAvatarPreview(e.target.result, null);
                reader.readAsDataURL(file);
            });
        }

        if (trigger) {
            trigger.addEventListener('click', async () => {
                if (!currentUser) return;
                selectedPhotoFile = null;
                if (photoInput) photoInput.value = '';

                try {
                    const { data: profile, error } = await supabaseClient
                        .from('profiles')
                        .select('*')
                        .eq('id', currentUser.id)
                        .single();

                    if (error) throw error;

                    document.getElementById('my-profile-email').value = currentUser.email || '';
                    document.getElementById('my-profile-fullname').value = profile?.full_name || '';
                    document.getElementById('my-profile-phone').value = profile?.phone || '';

                    renderAvatarPreview(profile?.avatar_url || null, getInitials(profile?.full_name));

                    const specGroup = document.getElementById('my-profile-spec-group');
                    const specSelect = document.getElementById('my-profile-spec');
                if (specGroup) specGroup.style.display = 'block';
                    if (specSelect) {
                        if (globalUserRole === 'administrator') {
                            specSelect.disabled = false;
                            specSelect.style.backgroundColor = '#f8fafc';
                            specSelect.style.color = '#0f172a';
                            specSelect.style.cursor = 'pointer';
                        } else {
                            specSelect.disabled = true;
                            specSelect.style.backgroundColor = '#f1f5f9';
                            specSelect.style.color = '#64748b';
                            specSelect.style.cursor = 'not-allowed';
                        }
                            if (profile?.specialization) {
                            for (let i = 0; i < specSelect.options.length; i++) {
                                if (specSelect.options[i].value === profile.specialization) {
                                    specSelect.selectedIndex = i;
                                    break;
                                }
                            }
                        }
                    }

                    modal.classList.remove('hidden');
                } catch (error) {
                    console.error('Error loading profile:', error);
                    showToast('Could not load your profile. Please try again.', 'error');
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!currentUser) return;

                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = "Saving...";
                }

                const newName = document.getElementById('my-profile-fullname').value.trim();
                const newPhone = document.getElementById('my-profile-phone').value.trim();

                const updatePayload = { full_name: newName, phone: newPhone };
                if (globalUserRole === 'administrator') {
                    const newSpec = document.getElementById('my-profile-spec').value;
                    updatePayload.specialization = newSpec;
                }
                try {
                    if (selectedPhotoFile) {
                        const fileExt = selectedPhotoFile.name.split('.').pop();
                        const filePath = `${currentUser.id}-${Date.now()}.${fileExt}`;

                        const { error: uploadError } = await supabaseClient.storage
                            .from('avatars')
                            .upload(filePath, selectedPhotoFile, { upsert: true });

                        if (uploadError) throw new Error('Photo upload failed: ' + uploadError.message);

                        const { data: publicUrlData } = supabaseClient.storage
                            .from('avatars')
                            .getPublicUrl(filePath);

                        updatePayload.avatar_url = publicUrlData.publicUrl;
                    }

                    const { error } = await supabaseClient
                        .from('profiles')
                        .update(updatePayload)
                        .eq('id', currentUser.id);

                    if (error) throw new Error(error.message);

                    modal.classList.add('hidden');
                    selectedPhotoFile = null;

                    await updateSidebarUserInfo();
                    await updateScheduleProfileHeader();

                    showToast('Profile successfully updated!', 'success');
                } catch (error) {
                    console.error('Error updating profile:', error);
                    showToast('Error updating profile: ' + error.message, 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = "Save Changes";
                    }
                }
            });
        }
    }

    function setupEditLawyerModal() {
        const modal = document.getElementById('edit-lawyer-modal');
        const closeBtn = document.getElementById('close-edit-lawyer-btn');
        const form = document.getElementById('edit-lawyer-form');

        if (!modal) return;

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = "Saving Changes...";
                }

                const lawyerId = document.getElementById('edit-lawyer-id').value;
                const newName = document.getElementById('edit-lawyer-fullname').value.trim();
                const newPhone = document.getElementById('edit-lawyer-phone').value.trim();
                const newSpec = document.getElementById('edit-lawyer-spec').value;
                const isSecretaryEdit = modal.dataset.role === 'secretary';
                const patch = isSecretaryEdit
                    ? { full_name: newName, phone: newPhone }
                    : { full_name: newName, phone: newPhone, specialization: newSpec };

                try {
                    const { data: oldData } = await supabaseClient.from('profiles').select('*').eq('id', lawyerId).single();

                    const { error } = await supabaseClient
                        .from('profiles')
                        .update(patch)
                        .eq('id', lawyerId);

                    if (error) throw new Error(error.message);

                    await logAuditActivity('UPDATE', 'Profiles', `Edited ${isSecretaryEdit ? 'secretary' : 'lawyer'} profile: ${newName}`, lawyerId, oldData, patch);

                    showToast(isSecretaryEdit ? 'Secretary profile successfully updated!' : 'Lawyer profile successfully updated!', 'success');
                    if (isSecretaryEdit) renderSecretariesList();
                    modal.classList.add('hidden');
                    
                    renderManageLawyersList();
                    renderLawyerStatusWidget();
                    prepareEventModal();

                } catch (error) {
                    console.error('Error updating lawyer:', error);
                    showToast('Error updating profile: ' + error.message, 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = "Save Changes";
                    }
                }
            });
        }
    }

    window.openEditLawyerModal = function(id, name, phone, spec, role) {
        const modal = document.getElementById('edit-lawyer-modal');
        if (!modal) return;

        const isSecretary = role === 'secretary';
        modal.dataset.role = isSecretary ? 'secretary' : 'lawyer';

        const heading = modal.querySelector('h2');
        if (heading) heading.textContent = isSecretary ? 'Edit Secretary Profile' : 'Edit Lawyer Profile';

        document.getElementById('edit-lawyer-id').value = id;
        document.getElementById('edit-lawyer-fullname').value = name || '';
        document.getElementById('edit-lawyer-phone').value = phone || '';

        const specSelect = document.getElementById('edit-lawyer-spec');
        const specGroup = specSelect ? specSelect.closest('.form-group') : null;
        if (specGroup) specGroup.style.display = isSecretary ? 'none' : '';
        if (specSelect && spec) {
            for (let i = 0; i < specSelect.options.length; i++) {
                if (specSelect.options[i].value === spec) {
                    specSelect.selectedIndex = i;
                    break;
                }
            }
        }

        modal.classList.remove('hidden');
    };

    function setupArchiveLawyerModal() {
        const modal = document.getElementById('archive-lawyer-modal');
        const cancelBtn = document.getElementById('btn-cancel-archive-lawyer');
        const confirmBtn = document.getElementById('btn-confirm-archive-lawyer');

        if (!modal) return;

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const lawyerId = document.getElementById('archive-lawyer-id').value;
                
                confirmBtn.disabled = true;
                confirmBtn.innerText = "Archiving...";

                try {
                    const { error } = await supabaseClient
                        .from('profiles')
                        .update({ status: 'inactive' })
                        .eq('id', lawyerId);

                    if (error) throw new Error(error.message);

                    const archiveName = document.getElementById('archive-lawyer-name-display').textContent;
                    await logAuditActivity('UPDATE', 'Profiles', `Archived lawyer: ${archiveName}`, lawyerId);

                    showToast('Lawyer successfully archived (set to inactive).', 'success');
                    modal.classList.add('hidden');
                    
                    renderManageLawyersList();
                    renderLawyerStatusWidget();
                    prepareEventModal(); 

                } catch (error) {
                    console.error('Error archiving lawyer:', error);
                    showToast('Error archiving lawyer: ' + error.message, 'error');
                } finally {
                    confirmBtn.disabled = false;
                    confirmBtn.innerText = "Archive Account";
                }
            });
        }
    }

    const SPECIALIZATIONS = ['General Practice', 'Criminal Law', 'Corporate Law', 'Family Law', 'Civil Litigation'];

    function jsArg(value) {
        return escapeHtml(JSON.stringify(value));
    }

    function formatStamp(iso) {
        return `${formatDate(iso)} at ${formatEventTime(iso)}`;
    }

    async function fetchProfileNameMap(ids) {
        const unique = [...new Set((ids || []).filter(Boolean))];
        const map = {};
        if (unique.length === 0) return map;
        const { data } = await supabaseClient.from('profiles').select('id, full_name').in('id', unique);
        (data || []).forEach(p => { map[p.id] = p.full_name; });
        return map;
    }

    function statusTrailHtml(p, names) {
        if (p.status === 'inactive' && p.archived_at) {
            const who = p.archived_by ? ' by ' + escapeHtml(names[p.archived_by] || 'Unknown') : '';
            return `<p style="margin:4px 0 0 0; font-size:11px; color:#94a3b8;"><i class="fa-solid fa-box-archive" style="font-size:10px;"></i> Archived ${escapeHtml(formatStamp(p.archived_at))}${who}</p>`;
        }
        if (p.status !== 'inactive' && p.restored_at) {
            const who = p.restored_by ? ' by ' + escapeHtml(names[p.restored_by] || 'Unknown') : '';
            return `<p style="margin:4px 0 0 0; font-size:11px; color:#94a3b8;"><i class="fa-solid fa-rotate-left" style="font-size:10px;"></i> Restored ${escapeHtml(formatStamp(p.restored_at))}${who}</p>`;
        }
        return '';
    }

    function userIconButton(onclick, icon, title, color) {
        return `<button onclick="${onclick}" style="background:none; border:none; cursor:pointer; color:${color}; padding:5px;" title="${escapeHtml(title)}"><i class="fa-solid ${icon}"></i></button>`;
    }

    function userManageButtons(p, role) {
        const id = jsArg(p.id);
        const name = jsArg(p.full_name || '');
        const phone = jsArg(p.phone || '');
        const spec = jsArg(p.specialization || '');
        const r = jsArg(role);
        return userIconButton(`openEditLawyerModal(${id}, ${name}, ${phone}, ${spec}, ${r})`, 'fa-pen-to-square', role === 'lawyer' ? 'Edit lawyer' : 'Edit secretary', '#3b82f6')
            + userIconButton(`openResetPasswordModal(${id}, ${name})`, 'fa-key', 'Reset password', '#8b5cf6')
            + userIconButton(`openChangeRoleModal(${id}, ${name}, ${r}, ${spec})`, 'fa-user-gear', 'Change role', '#0ea5e9');
    }

    function refreshUserDirectories() {
        renderManageLawyersList();
        renderSecretariesList();
        renderArchivedLawyersList();
        renderLawyerStatusWidget();
        prepareEventModal();
        updateDashboardStats();
        renderPerformanceTab();
        renderAdminAttention();
    }

    function openUserModal(title, subtitleHtml, bodyHtml) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div style="width:90%; max-width:480px; padding:25px 30px; background:#ffffff; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.1); max-height:90vh; overflow-y:auto;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #e2e8f0; padding-bottom:15px; margin-bottom:16px;">
                    <div>
                        <h2 style="font-size:18px; font-weight:700; color:#1e293b; margin:0;">${escapeHtml(title)}</h2>
                        <p style="font-size:12px; color:#64748b; margin:4px 0 0 0;">${subtitleHtml}</p>
                    </div>
                    <button type="button" data-um-close style="background:transparent; border:none; font-size:20px; cursor:pointer; color:#64748b; padding:0;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div data-um-body>${bodyHtml}</div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('[data-um-close]').addEventListener('click', close);
        return { overlay: overlay, body: overlay.querySelector('[data-um-body]'), close: close };
    }

    async function getLawyerWorkSummary(lawyerId) {
        const nowIso = new Date().toISOString();
        const [casesRes, clientsRes, eventsRes] = await Promise.all([
            supabaseClient.from('case_lawyers').select('case_id, cases!inner(status)', { count: 'exact', head: true }).eq('lawyer_id', lawyerId).eq('cases.status', 'active'),
            supabaseClient.from('client_lawyers').select('client_lawyer_id', { count: 'exact', head: true }).eq('lawyer_id', lawyerId),
            supabaseClient.from('calendar_events').select('id', { count: 'exact', head: true }).eq('assigned_to', lawyerId).gte('start_date', nowIso)
        ]);
        const failed = casesRes.error || clientsRes.error || eventsRes.error;
        if (failed) throw new Error(failed.message);
        return { cases: casesRes.count || 0, clients: clientsRes.count || 0, events: eventsRes.count || 0 };
    }

    function workSummaryHtml(work) {
        const row = (n, singular, plural) => `<li>${n} ${n === 1 ? singular : plural}</li>`;
        return `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; font-size:13px; color:#334155; margin-bottom:16px;">
                <strong>Currently assigned</strong>
                <ul style="margin:8px 0 0 18px; padding:0; line-height:1.7;">
                    ${row(work.cases, 'active case', 'active cases')}
                    ${row(work.clients, 'client', 'clients')}
                    ${row(work.events, 'upcoming event', 'upcoming events')}
                </ul>
            </div>`;
    }

    function replacementSelectHtml(lawyers) {
        return `
            <label style="display:block; font-size:13px; font-weight:600; color:#0f172a; margin-bottom:6px;">Transfer their work to</label>
            <div style="position:relative; margin-bottom:8px;">
                <select id="um-replacement" style="width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc; font-family:inherit; appearance:none;">
                    <option value="">Select a lawyer</option>
                    ${lawyers.map(l => `<option value="${escapeHtml(l.id)}">Atty. ${escapeHtml(l.full_name || 'Unnamed')}${l.specialization ? ' — ' + escapeHtml(l.specialization) : ''}</option>`).join('')}
                </select>
                <i class="fa-solid fa-chevron-down" style="position:absolute; right:12px; top:14px; color:#94a3b8; pointer-events:none; font-size:12px;"></i>
            </div>
            <p style="font-size:11px; color:#94a3b8; margin:0 0 16px 0;">Lead roles carry over. Closed cases keep their original lawyers. Upcoming events move too, so check the calendar for overlaps afterwards.</p>`;
    }

    function modalButtonsHtml(confirmLabel, confirmColor) {
        return `
            <div id="um-error" style="color:#ef4444; font-size:12px; min-height:16px; margin-bottom:10px;"></div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" id="um-cancel" style="padding:10px 18px; border:1px solid #cbd5e1; background:white; border-radius:6px; cursor:pointer; font-weight:600;">Cancel</button>
                <button type="button" id="um-confirm" style="padding:10px 18px; background:${confirmColor}; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:600;">${escapeHtml(confirmLabel)}</button>
            </div>`;
    }

    window.openArchiveLawyerModal = async function(id, name) {
        if (globalRoleName !== 'admin') return;
        const modal = openUserModal('Archive Lawyer', `Atty. ${escapeHtml(name)}`, '<p style="color:#64748b; text-align:center; padding:20px;">Checking assignments...</p>');

        try {
            const [work, allLawyers] = await Promise.all([getLawyerWorkSummary(id), getActiveLawyersData()]);
            const others = allLawyers.filter(l => l.id !== id);
            const hasWork = work.cases + work.clients + work.events > 0;

            let middle;
            if (!hasWork) {
                middle = `<p style="font-size:13px; color:#475569; margin:0 0 16px 0;">Atty. ${escapeHtml(name)} has no active assignments. Their account will be deactivated and their historical records will stay intact.</p>`;
            } else if (others.length === 0) {
                middle = `${workSummaryHtml(work)}<p style="font-size:13px; color:#ef4444; margin:0 0 16px 0;">There is no other active lawyer to take over this work. Add or restore a lawyer first.</p>`;
            } else {
                middle = workSummaryHtml(work) + replacementSelectHtml(others);
            }

            modal.body.innerHTML = middle + modalButtonsHtml(hasWork ? 'Transfer & archive' : 'Archive account', '#f59e0b');
            const confirmBtn = modal.body.querySelector('#um-confirm');
            const errEl = modal.body.querySelector('#um-error');
            modal.body.querySelector('#um-cancel').addEventListener('click', modal.close);
            if (hasWork && others.length === 0) confirmBtn.disabled = true;

            confirmBtn.addEventListener('click', async () => {
                const replacement = hasWork ? (modal.body.querySelector('#um-replacement') || {}).value : '';
                if (hasWork && !replacement) {
                    errEl.textContent = 'Choose the lawyer who will take over.';
                    return;
                }
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Working...';
                const { data, error } = await supabaseClient.rpc('archive_lawyer', {
                    p_lawyer_id: id,
                    p_replacement: replacement || null
                });
                if (error) {
                    errEl.textContent = error.message;
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = hasWork ? 'Transfer & archive' : 'Archive account';
                    return;
                }
                modal.close();
                showToast(hasWork
                    ? `Atty. ${name} was archived. Transferred ${data.cases} case(s), ${data.clients} client(s) and ${data.events} upcoming event(s).`
                    : `Atty. ${name} was archived.`, 'success');
                refreshUserDirectories();
            });
        } catch (err) {
            console.error('Archive modal error:', err);
            modal.body.innerHTML = errorStateHtml("Could not check this lawyer's assignments.", null);
        }
    };

    window.openChangeRoleModal = async function(id, name, currentRole) {
        if (globalRoleName !== 'admin') return;
        const toRole = currentRole === 'lawyer' ? 'secretary' : 'lawyer';
        const label = r => (r === 'lawyer' ? 'Lawyer' : 'Secretary');
        const modal = openUserModal('Change Role', `${escapeHtml(name)}: ${label(currentRole)} &rarr; ${label(toRole)}`, '<p style="color:#64748b; text-align:center; padding:20px;">Checking assignments...</p>');

        try {
            let hasWork = false;
            let others = [];
            let middle = '';

            if (currentRole === 'lawyer') {
                const [work, allLawyers] = await Promise.all([getLawyerWorkSummary(id), getActiveLawyersData()]);
                others = allLawyers.filter(l => l.id !== id);
                hasWork = work.cases + work.clients + work.events > 0;
                if (!hasWork) {
                    middle = '<p style="font-size:13px; color:#475569; margin:0 0 16px 0;">They have no active assignments. As a secretary they will no longer be assignable to cases or clients.</p>';
                } else if (others.length === 0) {
                    middle = `${workSummaryHtml(work)}<p style="font-size:13px; color:#ef4444; margin:0 0 16px 0;">There is no other active lawyer to take over this work. Add or restore a lawyer first.</p>`;
                } else {
                    middle = workSummaryHtml(work) + replacementSelectHtml(others);
                }
            } else {
                middle = `
                    <p style="font-size:13px; color:#475569; margin:0 0 14px 0;">As a lawyer they can be assigned clients and cases.</p>
                    <label style="display:block; font-size:13px; font-weight:600; color:#0f172a; margin-bottom:6px;">Specialization</label>
                    <div style="position:relative; margin-bottom:16px;">
                        <select id="um-spec" style="width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc; font-family:inherit; appearance:none;">
                            ${SPECIALIZATIONS.map(sp => `<option value="${escapeHtml(sp)}">${escapeHtml(sp)}</option>`).join('')}
                        </select>
                        <i class="fa-solid fa-chevron-down" style="position:absolute; right:12px; top:14px; color:#94a3b8; pointer-events:none; font-size:12px;"></i>
                    </div>`;
            }

            middle += '<p style="font-size:11px; color:#94a3b8; margin:0 0 12px 0;">The change applies immediately. If they are signed in, they should sign in again to see the right menus.</p>';

            modal.body.innerHTML = middle + modalButtonsHtml('Change role', '#0ea5e9');
            const confirmBtn = modal.body.querySelector('#um-confirm');
            const errEl = modal.body.querySelector('#um-error');
            modal.body.querySelector('#um-cancel').addEventListener('click', modal.close);
            if (currentRole === 'lawyer' && hasWork && others.length === 0) confirmBtn.disabled = true;

            confirmBtn.addEventListener('click', async () => {
                const replacement = (currentRole === 'lawyer' && hasWork) ? (modal.body.querySelector('#um-replacement') || {}).value : '';
                if (currentRole === 'lawyer' && hasWork && !replacement) {
                    errEl.textContent = 'Choose the lawyer who will take over.';
                    return;
                }
                const spec = toRole === 'lawyer' ? (modal.body.querySelector('#um-spec') || {}).value : null;
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Working...';
                const { error } = await supabaseClient.rpc('change_user_role', {
                    p_user_id: id,
                    p_new_role: toRole,
                    p_replacement: replacement || null,
                    p_specialization: spec
                });
                if (error) {
                    errEl.textContent = error.message;
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Change role';
                    return;
                }
                modal.close();
                showToast(`${name} is now a ${label(toRole).toLowerCase()}.`, 'success');
                refreshUserDirectories();
            });
        } catch (err) {
            console.error('Change role modal error:', err);
            modal.body.innerHTML = errorStateHtml("Could not check this account's assignments.", null);
        }
    };

    function generateTempPassword() {
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        const digits = '23456789';
        const all = letters + digits;
        const bytes = new Uint32Array(12);
        crypto.getRandomValues(bytes);
        let out = '';
        for (let i = 0; i < 10; i++) out += all[bytes[i] % all.length];
        out += letters[bytes[10] % letters.length];
        out += digits[bytes[11] % digits.length];
        return out;
    }

    window.openResetPasswordModal = function(id, name) {
        if (globalRoleName !== 'admin') return;
        const modal = openUserModal('Reset Password', escapeHtml(name), `
            <p style="font-size:13px; color:#475569; margin:0 0 14px 0;">Set a password. They will be asked to choose their own the next time they sign in.</p>
            <label style="display:block; font-size:13px; font-weight:600; color:#0f172a; margin-bottom:6px;">Password</label>
            <div style="display:flex; gap:8px; margin-bottom:6px;">
                <input type="text" id="um-pw" autocomplete="off" style="flex:1; padding:10px 12px; border:1px solid #cbd5e1; border-radius:6px; font-family:monospace; background:#f8fafc;">
                <button type="button" id="um-pw-generate" style="padding:10px 12px; border:1px solid #cbd5e1; background:white; border-radius:6px; cursor:pointer; font-weight:600; font-size:12px;">Generate</button>
                <button type="button" id="um-pw-copy" style="padding:10px 12px; border:1px solid #cbd5e1; background:white; border-radius:6px; cursor:pointer; font-weight:600; font-size:12px;">Copy</button>
            </div>
            <p style="font-size:11px; color:#94a3b8; margin:0 0 16px 0;">At least 8 characters with a letter and a number. Share it with them privately.</p>
            ${modalButtonsHtml('Reset password', '#8b5cf6')}
        `);

        const pwInput = modal.body.querySelector('#um-pw');
        const errEl = modal.body.querySelector('#um-error');
        const confirmBtn = modal.body.querySelector('#um-confirm');
        pwInput.value = generateTempPassword();

        modal.body.querySelector('#um-pw-generate').addEventListener('click', () => { pwInput.value = generateTempPassword(); });
        modal.body.querySelector('#um-pw-copy').addEventListener('click', async (e) => {
            try {
                await navigator.clipboard.writeText(pwInput.value);
                e.target.textContent = 'Copied';
                setTimeout(() => { e.target.textContent = 'Copy'; }, 1500);
            } catch (err) {
                pwInput.select();
            }
        });
        modal.body.querySelector('#um-cancel').addEventListener('click', modal.close);

        confirmBtn.addEventListener('click', async () => {
            const password = pwInput.value;
            if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
                errEl.textContent = 'Use at least 8 characters, including a letter and a number.';
                return;
            }
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Resetting...';
            const { error } = await supabaseClient.functions.invoke('admin-reset-password', {
                body: { user_id: id, password: password }
            });
            if (error) {
                let message = error.message;
                try {
                    const errBody = await error.context.json();
                    if (errBody && errBody.error) message = errBody.error;
                } catch (e) {}
                errEl.textContent = message;
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Reset password';
                return;
            }
            modal.close();
            showToast(`Password reset for ${name}. Give them the password privately.`, 'success');
        });
    };

    window.__people = {};
    window.__peopleSort = {};

    const PEOPLE_UI = {
        lawyers: { prefix: 'manage-lawyers', countLabel: n => `Total: ${n}` },
        secretaries: { prefix: 'manage-secretaries', countLabel: n => `Total: ${n}` },
        archived: { prefix: 'manage-archived', countLabel: n => `Total Archived: ${n}` }
    };

    function personIconBtn(onclick, icon, title, tone = '') {
        return `<button type="button" class="ct-icon-btn ${tone}" onclick="${onclick}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><i class="fa-solid ${icon}"></i></button>`;
    }

    function personActionsHtml(p, kind) {
        if (globalRoleName !== 'admin') return '';
        const id = jsArg(p.id);
        const name = jsArg(p.full_name || '');
        const phone = jsArg(p.phone || '');
        const spec = jsArg(p.specialization || '');

        if (kind === 'archived') {
            return personIconBtn(`restoreArchivedLawyer(${id}, ${name})`, 'fa-rotate-left', 'Restore lawyer', 'ct-green');
        }
        if (kind === 'secretaries' && p.status === 'inactive') {
            return personIconBtn(`toggleSecretaryStatus(${id})`, 'fa-rotate-left', 'Restore secretary', 'ct-green');
        }

        const role = kind === 'secretaries' ? 'secretary' : 'lawyer';
        const r = jsArg(role);
        const archive = kind === 'secretaries'
            ? personIconBtn(`toggleSecretaryStatus(${id})`, 'fa-box-archive', 'Archive secretary', 'ct-amber')
            : personIconBtn(`openArchiveLawyerModal(${id}, ${name})`, 'fa-box-archive', 'Archive lawyer', 'ct-amber');

        return personIconBtn(`openEditLawyerModal(${id}, ${name}, ${phone}, ${spec}, ${r})`, 'fa-pen', role === 'lawyer' ? 'Edit lawyer' : 'Edit secretary')
            + personIconBtn(`openResetPasswordModal(${id}, ${name})`, 'fa-key', 'Reset password', 'ct-purple')
            + personIconBtn(`openChangeRoleModal(${id}, ${name}, ${r}, ${spec})`, 'fa-user-gear', 'Change role', 'ct-sky')
            + archive;
    }

    function workloadChipsHtml(w) {
        const x = w || { active: 0, lead: 0, events: 0 };
        const chip = (value, label, icon, tone) =>
            `<span class="ml-chip ${tone}${value === 0 ? ' ml-chip-zero' : ''}"><i class="${icon}"></i> ${value} ${label}</span>`;
        return `<div class="ml-chips">${chip(x.active, x.active === 1 ? 'case' : 'cases', 'fa-solid fa-briefcase', 'ml-chip-cases')}${chip(x.lead, 'lead', 'fa-solid fa-gavel', 'ml-chip-lead')}${chip(x.events, x.events === 1 ? 'event (7d)' : 'events (7d)', 'fa-regular fa-calendar', 'ml-chip-events')}</div>`;
    }

    function paintPeople(kind) {
        const ui = PEOPLE_UI[kind];
        const listEl = document.getElementById(ui.prefix + '-list-inject');
        const countEl = document.getElementById(ui.prefix + '-count');
        const store = window.__people[kind];
        if (!listEl || !store) return;

        const term = (document.getElementById(ui.prefix + '-search')?.value || '').trim().toLowerCase();
        const sort = window.__peopleSort[kind] || { key: 'full_name', dir: 'asc' };
        const workload = store.workload || {};

        const rows = store.rows.filter(p => !term || [p.full_name, p.specialization, p.phone].filter(Boolean).join(' ').toLowerCase().includes(term));
        const sortValue = {
            full_name: p => (p.full_name || '').toLowerCase(),
            specialization: p => (p.specialization || 'General Practice').toLowerCase(),
            phone: p => (p.phone || '').toLowerCase(),
            active: p => (workload[p.id] ? workload[p.id].active : 0),
            status: p => (p.status === 'inactive' ? 1 : 0),
            archived_at: p => new Date(p.archived_at || 0).getTime()
        }[sort.key] || (() => 0);
        rows.sort((a, b) => {
            const x = sortValue(a), y = sortValue(b);
            const r = x < y ? -1 : (x > y ? 1 : 0);
            return sort.dir === 'asc' ? r : -r;
        });

        if (countEl) countEl.textContent = term ? `${rows.length} of ${store.rows.length}` : ui.countLabel(store.rows.length);

        if (rows.length === 0) {
            listEl.innerHTML = `<p class="mc-empty">${store.rows.length ? 'No matches for your search.' : store.empty}</p>`;
            return;
        }

        const th = (key, label) => {
            const active = sort.key === key;
            const arrow = active ? (sort.dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort';
            return `<th class="ct-sortable${active ? ' ct-sorted' : ''}" data-people-sort="${key}" tabindex="0" role="button" aria-label="Sort by ${label}">${label} <i class="fa-solid ${arrow}"></i></th>`;
        };

        const avatarTone = kind === 'secretaries' ? 'ct-avatar-purple' : (kind === 'archived' ? 'ct-avatar-grey' : 'ct-avatar-blue');
        const names = store.names || {};

        const body = rows.map(p => {
            const inactive = p.status === 'inactive';
            const display = kind === 'secretaries' ? (p.full_name || 'Unknown') : `Atty. ${p.full_name || 'Unknown'}`;
            const restored = (!inactive && p.restored_at)
                ? `<div class="ct-sub"><i class="fa-solid fa-rotate-left"></i> Restored ${escapeHtml(formatDate(p.restored_at))}${p.restored_by ? ' by ' + escapeHtml(names[p.restored_by] || 'Unknown') : ''}</div>`
                : '';
            const nameCell = `
                <td>
                    <div class="ct-person">
                        <span class="ct-avatar ${avatarTone}">${escapeHtml(getInitials(p.full_name))}</span>
                        <div class="ct-person-text">
                            <div class="ct-person-name">${escapeHtml(display)}</div>
                            ${restored}
                        </div>
                    </div>
                </td>`;
            const specCell = `<td>${escapeHtml(p.specialization || 'General Practice')}</td>`;
            const phoneCell = `<td>${p.phone ? escapeHtml(p.phone) : '<span class="ct-muted">N/A</span>'}</td>`;
            const statusCell = `<td><span class="ct-badge ${inactive ? 'ct-badge-closed' : 'ct-badge-active'}">${inactive ? 'Archived' : 'Active'}</span></td>`;
            const actionsCell = `<td class="ct-actions"><div>${personActionsHtml(p, kind)}</div></td>`;

            if (kind === 'lawyers') {
                return `<tr>${nameCell}${specCell}${phoneCell}<td>${workloadChipsHtml(workload[p.id])}</td>${statusCell}${actionsCell}</tr>`;
            }
            if (kind === 'secretaries') {
                return `<tr${inactive ? ' class="ct-row-muted"' : ''}>${nameCell}${phoneCell}${statusCell}${actionsCell}</tr>`;
            }
            const archivedBy = p.archived_by ? `<div class="ct-sub">by ${escapeHtml(names[p.archived_by] || 'Unknown')}</div>` : '';
            const archivedCell = `<td>${p.archived_at ? escapeHtml(formatDate(p.archived_at)) : '<span class="ct-muted">-</span>'}${archivedBy}</td>`;
            return `<tr class="ct-row-muted">${nameCell}${specCell}${phoneCell}${archivedCell}${statusCell}${actionsCell}</tr>`;
        }).join('');

        let head;
        if (kind === 'lawyers') {
            head = `${th('full_name', 'Lawyer')}${th('specialization', 'Specialization')}${th('phone', 'Phone')}${th('active', 'Workload')}${th('status', 'Status')}<th class="ct-actions-head"></th>`;
        } else if (kind === 'secretaries') {
            head = `${th('full_name', 'Secretary')}${th('phone', 'Phone')}${th('status', 'Status')}<th class="ct-actions-head"></th>`;
        } else {
            head = `${th('full_name', 'Lawyer')}${th('specialization', 'Specialization')}${th('phone', 'Phone')}${th('archived_at', 'Archived')}${th('status', 'Status')}<th class="ct-actions-head"></th>`;
        }

        listEl.innerHTML = `
            <div class="ct-wrap">
                <table class="ct-table ct-table-people">
                    <thead><tr>${head}</tr></thead>
                    <tbody>${body}</tbody>
                </table>
            </div>`;
    }

    function ensurePeopleControls(kind) {
        const ui = PEOPLE_UI[kind];
        const listEl = document.getElementById(ui.prefix + '-list-inject');
        const searchEl = document.getElementById(ui.prefix + '-search');

        if (listEl && !listEl.dataset.bound) {
            listEl.dataset.bound = '1';
            const applySort = (th) => {
                const key = th.getAttribute('data-people-sort');
                const cur = window.__peopleSort[kind] || { key: 'full_name', dir: 'asc' };
                window.__peopleSort[kind] = { key: key, dir: (cur.key === key && cur.dir === 'asc') ? 'desc' : 'asc' };
                paintPeople(kind);
            };
            listEl.addEventListener('click', (e) => {
                const th = e.target.closest('[data-people-sort]');
                if (th) applySort(th);
            });
            listEl.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const th = e.target.closest('[data-people-sort]');
                if (th) { e.preventDefault(); applySort(th); }
            });
        }
        if (searchEl && !searchEl.dataset.bound) {
            searchEl.dataset.bound = '1';
            searchEl.addEventListener('input', () => paintPeople(kind));
        }
    }

    async function renderManageLawyersList() {
        const listContainer = document.getElementById('manage-lawyers-list-inject');
        const countEl = document.getElementById('manage-lawyers-count');
        if (!listContainer) return;

        listContainer.innerHTML = skeletonRows(4);

        try {
            const { data: lawyers, error } = await supabaseClient
                .from('profiles')
                .select('*, roles!inner(name)')
                .eq('roles.name', 'lawyer')
                .eq('status', 'active')
                .order('full_name', { ascending: true });

            if (error) throw error;

            const list = lawyers || [];
            let workloadMap = {};
            let names = {};
            if (list.length > 0) {
                const workloadData = await fetchWorkloadData();
                workloadMap = computeWorkload(workloadData.cases, workloadData.events);
                names = await fetchProfileNameMap(list.map(l => l.restored_by));
            }

            window.__people.lawyers = { rows: list, workload: workloadMap, names: names, empty: 'No active lawyers found in the directory.' };
            ensurePeopleControls('lawyers');
            paintPeople('lawyers');
        } catch (err) {
            console.error('Error loading lawyer directory:', err);
            if (countEl) countEl.textContent = '';
            listContainer.innerHTML = errorStateHtml("Could not load the lawyer directory.", "renderManageLawyersList");
        }
    }

    async function renderSecretariesList() {
        const listContainer = document.getElementById('manage-secretaries-list-inject');
        const countEl = document.getElementById('manage-secretaries-count');
        if (!listContainer) return;

        if (globalRoleName !== 'admin') {
            listContainer.innerHTML = '<p class="mc-empty">Only administrators can manage secretaries.</p>';
            if (countEl) countEl.textContent = '';
            return;
        }

        listContainer.innerHTML = skeletonRows(4);
        try {
            const { data: people, error } = await supabaseClient
                .from('profiles')
                .select('id, full_name, phone, specialization, status, archived_at, archived_by, restored_at, restored_by, roles!inner(name)')
                .eq('roles.name', 'secretary')
                .order('full_name', { ascending: true });
            if (error) throw error;

            window.__secretaries = {};
            (people || []).forEach(p => { window.__secretaries[p.id] = p; });

            const names = await fetchProfileNameMap((people || []).flatMap(p => [p.archived_by, p.restored_by]));

            window.__people.secretaries = { rows: people || [], workload: {}, names: names, empty: 'No secretaries yet. Use Add New User to create one.' };
            ensurePeopleControls('secretaries');
            paintPeople('secretaries');
        } catch (err) {
            console.error('Error loading secretaries:', err);
            if (countEl) countEl.textContent = '';
            listContainer.innerHTML = errorStateHtml("Could not load secretaries.", "renderSecretariesList");
        }
    }

    window.toggleSecretaryStatus = async function(profileId) {
        if (globalRoleName !== 'admin') return;
        const p = (window.__secretaries || {})[profileId];
        if (!p) return;
        const next = p.status === 'inactive' ? 'active' : 'inactive';
        if (!(await confirmDialog({ title: next === 'inactive' ? 'Archive secretary' : 'Restore secretary', confirmLabel: next === 'inactive' ? 'Archive' : 'Restore', danger: next === 'inactive', message: `${next === 'inactive' ? 'Archive' : 'Restore'} ${p.full_name}?` }))) return;
        const { error } = await supabaseClient.from('profiles').update({ status: next }).eq('id', profileId);
        if (error) {
            showToast('Could not update: ' + error.message, 'error');
            return;
        }
        renderSecretariesList();
    };

    async function renderArchivedLawyersList() {
        const listContainer = document.getElementById('manage-archived-list-inject');
        const countEl = document.getElementById('manage-archived-count');
        if (!listContainer) return;

        listContainer.innerHTML = skeletonRows(4);

        try {
            const { data: lawyers, error } = await supabaseClient
                .from('profiles')
                .select('*, roles!inner(name)')
                .eq('roles.name', 'lawyer')
                .eq('status', 'inactive')
                .order('full_name', { ascending: true });

            if (error) throw error;

            const list = lawyers || [];
            const names = list.length > 0 ? await fetchProfileNameMap(list.map(l => l.archived_by)) : {};

            window.__people.archived = { rows: list, workload: {}, names: names, empty: 'No archived lawyers found.' };
            ensurePeopleControls('archived');
            paintPeople('archived');
        } catch (err) {
            console.error('Error loading archived lawyers:', err);
            if (countEl) countEl.textContent = '';
            listContainer.innerHTML = errorStateHtml("Could not load archived lawyers.", "renderArchivedLawyersList");
        }
    }

    window.restoreArchivedLawyer = async function(id, name) {
        if (!(await confirmDialog({ title: 'Restore lawyer', confirmLabel: 'Restore', message: `Are you sure you want to restore Atty. ${name}? Their account will be reactivated.` }))) return;

        try {
                const { error } = await supabaseClient
                .from('profiles')
                .update({ status: 'active' })
                .eq('id', id);

            if (error) throw new Error(error.message);

            await logAuditActivity('UPDATE', 'Profiles', `Restored lawyer: Atty. ${name}`, id);

            showToast(`Atty. ${name} has been successfully restored!`, 'success');
            
            renderManageLawyersList();
            renderArchivedLawyersList();
            renderLawyerStatusWidget();
            prepareEventModal();

        } catch (error) {
            console.error('Error restoring lawyer:', error);
            showToast('Error restoring lawyer: ' + error.message, 'error');
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const manageTabs = document.querySelectorAll('.manage-tab-btn');
        
        manageTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const targetId = this.getAttribute('data-managetab');
                if(!targetId) return;

                manageTabs.forEach(btn => {
                    btn.classList.remove('active');
                });
                
                this.classList.add('active');

                document.querySelectorAll('.manage-tab-content').forEach(content => {
                    content.classList.add('hidden');
                });
                
                const activeContent = document.getElementById(targetId);
                if(activeContent) {
                    activeContent.classList.remove('hidden');
                    
                    if (targetId === 'manage-archived-lawyers') {
                        renderArchivedLawyersList();
                    } else if (targetId === 'manage-secretaries') {
                        renderSecretariesList();
                    } else {
                        renderManageLawyersList();
                    }
                }
            });
        });

        checkAuthAndInit();
    });

const AUDIT_LOG_LIMIT = 200;
let auditRequestCounter = 0;
let auditFiltersReady = false;

function getAuditFilters() {
        const val = (id, fallback) => {
            const el = document.getElementById(id);
            return el ? el.value : fallback;
        };
        return {
            action: val('audit-filter-action', 'all'),
            period: val('audit-filter-period', 'all'),
            from: val('audit-filter-from', ''),
            to: val('audit-filter-to', ''),
            entity: val('audit-filter-entity', 'all')
        };
    }

    function auditFiltersActive(f) {
        return f.action !== 'all' || f.period !== 'all' || f.entity !== 'all';
    }

    function getAuditDateRange(f) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayMs = 24 * 60 * 60 * 1000;

        switch (f.period) {
            case 'today':
                return { from: startOfToday, to: new Date(startOfToday.getTime() + dayMs) };
            case '7d':
                return { from: new Date(startOfToday.getTime() - 6 * dayMs), to: null };
            case '30d':
                return { from: new Date(startOfToday.getTime() - 29 * dayMs), to: null };
            case 'this_month':
                return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
            case 'last_month':
                return {
                    from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                    to: new Date(now.getFullYear(), now.getMonth(), 1)
                };
            case 'custom': {
                let from = null, to = null;
                if (f.from) {
                    const [y, mo, d] = f.from.split('-').map(Number);
                    from = new Date(y, mo - 1, d);
                }
                if (f.to) {
                    const [y, mo, d] = f.to.split('-').map(Number);
                    to = new Date(y, mo - 1, d + 1);
                }
                return { from, to };
            }
            default:
                return { from: null, to: null };
        }
    }

    function initAuditFilters() {
        if (auditFiltersReady) return;
        const actionEl = document.getElementById('audit-filter-action');
        const periodEl = document.getElementById('audit-filter-period');
        const entityEl = document.getElementById('audit-filter-entity');
        const fromEl = document.getElementById('audit-filter-from');
        const toEl = document.getElementById('audit-filter-to');
        const clearBtn = document.getElementById('audit-filter-clear');
        if (!actionEl || !periodEl || !entityEl) return;
        auditFiltersReady = true;
        const searchEl = document.getElementById('audit-search');
        if (searchEl) searchEl.addEventListener('input', paintAudits);

        const sync = () => {
            const isCustom = periodEl.value === 'custom';
            document.querySelectorAll('.audit-custom-date').forEach(el => el.classList.toggle('hidden', !isCustom));
            if (clearBtn) clearBtn.classList.toggle('hidden', !auditFiltersActive(getAuditFilters()));
        };
        const refresh = () => { sync(); renderAuditsView(); };

        [actionEl, entityEl, periodEl].forEach(el => el.addEventListener('change', refresh));
        if (fromEl) fromEl.addEventListener('change', refresh);
        if (toEl) toEl.addEventListener('change', refresh);

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                actionEl.value = 'all';
                periodEl.value = 'all';
                entityEl.value = 'all';
                if (fromEl) fromEl.value = '';
                if (toEl) toEl.value = '';
                refresh();
            });
        }
    }

const AUDIT_ACTIONS = {
    INSERT: { label: 'Added', color: '#16a34a', icon: 'fa-plus' },
    UPDATE: { label: 'Updated', color: '#2563eb', icon: 'fa-pen' },
    DELETE: { label: 'Deleted', color: '#dc2626', icon: 'fa-trash' },
    CLOSE: { label: 'Closed', color: '#d97706', icon: 'fa-lock' },
    REOPEN: { label: 'Reopened', color: '#0284c7', icon: 'fa-rotate-left' },
    RESCHEDULE: { label: 'Rescheduled', color: '#7c3aed', icon: 'fa-calendar-days' }
};

const AUDIT_ENTITIES = {
    cases: 'Case',
    clients: 'Client',
    calendar_events: 'Calendar event',
    profiles: 'User',
    email_queue: 'Email',
    case_lawyers: 'Case lawyer',
    client_lawyers: 'Client lawyer',
    notifications: 'Notification'
};

function auditEntityLabel(table) {
    const key = String(table || '').toLowerCase();
    if (AUDIT_ENTITIES[key]) return AUDIT_ENTITIES[key];
    const text = (key || 'record').replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function paintAudits() {
    const listEl = document.getElementById('audits-list-inject');
    const countEl = document.getElementById('audits-count');
    const data = window.__auditData;
    if (!listEl || !data) return;

    const term = (document.getElementById('audit-search')?.value || '').trim().toLowerCase();

    const rows = data.logs.map(log => {
        const action = AUDIT_ACTIONS[log.action] || { label: log.action || 'Changed', color: '#2563eb', icon: 'fa-pen' };
        const entity = auditEntityLabel(log.table_name);
        const userName = data.profileMap[log.changed_by] || 'System';
        const recordId = String(log.record_id || (log.new_data && log.new_data.original_int_id) || '');
        const summary = log.new_data && log.new_data.summary ? String(log.new_data.summary) : '';
        const details = summary || `${entity} ${action.label.toLowerCase()}`;
        return { log, action, entity, userName, recordId, summary, details };
    }).filter(r => !term || `${r.details} ${r.userName} ${r.entity} ${r.action.label}`.toLowerCase().includes(term));

    if (countEl) {
        countEl.textContent = term ? `${rows.length} of ${data.logs.length} shown` : data.countText;
    }

    if (rows.length === 0) {
        listEl.innerHTML = '<p class="mc-empty">No activity matches your search.</p>';
        return;
    }

    const body = rows.map(r => {
        const idHint = !r.summary && r.recordId
            ? `<div class="ct-sub" title="${escapeHtml(r.recordId)}">ID ${escapeHtml(r.recordId.slice(0, 8))}${r.recordId.length > 8 ? '...' : ''}</div>`
            : '';
        return `
            <tr>
                <td><span class="au-pill" style="background:${r.action.color}1a; color:${r.action.color};"><i class="fa-solid ${r.action.icon}"></i> ${escapeHtml(r.action.label)}</span></td>
                <td>${escapeHtml(r.entity)}</td>
                <td class="au-details">${escapeHtml(r.details)}${idHint}</td>
                <td>
                    <div class="ct-person">
                        <span class="ct-avatar ct-avatar-sm ct-avatar-blue">${escapeHtml(getInitials(r.userName))}</span>
                        <span class="ct-person-name">${escapeHtml(r.userName)}</span>
                    </div>
                </td>
                <td class="au-when">${escapeHtml(formatDate(r.log.changed_at))}<div class="ct-sub">${escapeHtml(formatEventTime(r.log.changed_at))}</div></td>
            </tr>`;
    }).join('');

    listEl.innerHTML = `
        <div class="ct-wrap">
            <table class="ct-table ct-table-audit">
                <thead>
                    <tr>
                        <th>Action</th>
                        <th>Record</th>
                        <th>Details</th>
                        <th>Done by</th>
                        <th>When</th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        </div>`;
}

async function renderAuditsView() {
        const listEl = document.getElementById('audits-list-inject');
        const countEl = document.getElementById('audits-count');
        if (!listEl) return;

        if (globalRoleName !== 'admin' && globalRoleName !== 'secretary') {
            listEl.innerHTML = errorStateHtml("You do not have access to this page.", null, "fa-lock");
            return;
        }

        listEl.innerHTML = skeletonRows(5);

        try {
            initAuditFilters();
            const filters = getAuditFilters();
            const range = getAuditDateRange(filters);
            const hasFilters = auditFiltersActive(filters);
            const requestId = ++auditRequestCounter;

            let query = supabaseClient
                .from('audit_logs')
                .select('*')
                .order('changed_at', { ascending: false })
                .limit(AUDIT_LOG_LIMIT);

            if (filters.action !== 'all') query = query.eq('action', filters.action);
            if (filters.entity !== 'all') query = query.ilike('table_name', filters.entity);
            query = query.neq('table_name', 'documents');
            if (range.from) query = query.gte('changed_at', range.from.toISOString());
            if (range.to) query = query.lt('changed_at', range.to.toISOString());

            const { data: logs, error: logsError } = await query;

            if (requestId !== auditRequestCounter) return;
            if (logsError) throw logsError;

            if (countEl) {
                const n = logs ? logs.length : 0;
                const capped = n >= AUDIT_LOG_LIMIT ? ` (latest ${AUDIT_LOG_LIMIT} shown)` : '';
                countEl.textContent = hasFilters
                    ? `${n} matching ${n === 1 ? 'activity' : 'activities'}${capped}`
                    : `Showing last ${n} activities`;
            }

            if (!logs || logs.length === 0) {
                listEl.innerHTML = hasFilters
                    ? '<p style="color:#64748b; text-align:center; padding:20px;">No activity matches these filters.</p>'
                    : '<p style="color:#64748b; text-align:center; padding:20px;">No recent activity found.</p>';
                return;
            }

            const userIds = [...new Set(logs.map(log => log.changed_by).filter(Boolean))];
            let profileMap = {};
            
            if (userIds.length > 0) {
                const { data: profiles, error: profilesError } = await supabaseClient
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);
                    
                if (!profilesError && profiles) {
                    profiles.forEach(p => {
                        profileMap[p.id] = p.full_name;
                    });
                }
            }
            window.__auditData = { logs: logs, profileMap: profileMap, countText: countEl ? countEl.textContent : '' };
            paintAudits();

        } catch (err) {
            console.error('Error loading audit logs:', err);
            listEl.innerHTML = errorStateHtml("Could not load the audit logs.", "renderAuditsView");
        }
    }

    const APP_LOGGED_EVENTS = ['cases:CLOSE', 'cases:REOPEN', 'clients:DELETE', 'calendar_events:RESCHEDULE'];

    async function logAuditActivity(action, entity, summary, recordId, oldData, newData) {
        try {
            const key = String(entity || '').toLowerCase() + ':' + action;
            if (!APP_LOGGED_EVENTS.includes(key)) return;
            if (!currentUser || !recordId) return;
            const { error } = await supabaseClient.from('audit_logs').insert([{
                table_name: String(entity).toLowerCase(),
                record_id: String(recordId),
                action: action,
                old_data: oldData || null,
                new_data: Object.assign({}, newData || {}, { summary: summary }),
                changed_by: currentUser.id
            }]);
            if (error) console.warn('Audit log was not saved:', error.message);
        } catch (err) {
            console.warn('Audit log was not saved:', err);
        }
    }