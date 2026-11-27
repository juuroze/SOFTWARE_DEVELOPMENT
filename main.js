(function () {
    if (window.JuriSyncSound) return;
    var STORAGE_KEY = 'jurisync-sound-muted';
    var MIN_GAP_MS = 1500;
    var ctx = null;
    var lastPlayed = 0;
    var buttons = [];

    function isMuted() {
        try {
            return localStorage.getItem(STORAGE_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function getContext() {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!ctx) ctx = new AudioCtx();
        return ctx;
    }

    function unlock() {
        var c = getContext();
        if (c && c.state === 'suspended') c.resume().catch(function () {});
    }

    ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
        window.addEventListener(evt, unlock, { passive: true });
    });

    function note(c, frequency, startAt, duration, volume) {
        var osc = c.createOscillator();
        var overtone = c.createOscillator();
        var gain = c.createGain();
        osc.type = 'sine';
        overtone.type = 'triangle';
        osc.frequency.value = frequency;
        overtone.frequency.value = frequency * 2;
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        osc.connect(gain);
        overtone.connect(gain);
        gain.connect(c.destination);
        osc.start(startAt);
        overtone.start(startAt);
        osc.stop(startAt + duration + 0.05);
        overtone.stop(startAt + duration + 0.05);
    }

    function schedule(c) {
        var t = c.currentTime + 0.02;
        note(c, 784, t, 0.45, 0.16);
        note(c, 988, t + 0.15, 0.45, 0.16);
        note(c, 1175, t + 0.3, 0.7, 0.18);
    }

    function play(force) {
        if (!force && isMuted()) return false;
        var now = Date.now();
        if (!force && now - lastPlayed < MIN_GAP_MS) return false;
        lastPlayed = now;
        var c = getContext();
        if (!c) return false;
        if (c.state === 'running') {
            schedule(c);
        } else {
            c.resume().then(function () {
                if (c.state === 'running') schedule(c);
                else console.warn('Notification sound is blocked until you click or press a key on this page.');
            }).catch(function () {
                console.warn('Notification sound is blocked until you click or press a key on this page.');
            });
        }
        return true;
    }

    function paint(btn) {
        var muted = isMuted();
        var icon = btn.querySelector('i');
        if (icon) icon.className = muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
        btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
        btn.setAttribute('aria-label', muted ? 'Turn notification sound on' : 'Turn notification sound off');
        btn.title = muted ? 'Notification sound is off' : 'Notification sound is on';
    }

    function setMuted(value) {
        try {
            localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
        } catch (e) {}
        buttons.forEach(paint);
    }

    function bindToggle(btn) {
        if (!btn || btn.dataset.soundBound) return;
        btn.dataset.soundBound = '1';
        buttons.push(btn);
        paint(btn);
        btn.addEventListener('click', function () {
            var nowMuted = !isMuted();
            setMuted(nowMuted);
            if (!nowMuted) play(true);
        });
    }

    window.JuriSyncSound = { play: play, isMuted: isMuted, setMuted: setMuted, bindToggle: bindToggle };
})();

const SUPABASE_URL = 'https://qksgqkmctjzmzhzmrbhj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Hx1bN74JlwOKBW6wv0wRgQ_fkP9N-b5';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let globalUserRole = '';
let globalUserName = '';
let globalRoleName = '';
let calendarFilter = 'all';

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

    const duplicate = Array.from(root.children).find((el) => el.dataset.msg === text && el.dataset.type === kind);
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
    el.addEventListener('mouseleave', () => {
        timer = setTimeout(dismiss, 2000);
    });

    root.appendChild(el);
    while (root.children.length > 5) root.firstElementChild.remove();

    timer = setTimeout(dismiss, opts.duration || TOAST_DURATIONS[kind]);
    return el;
}

function trapDialogFocus(container, e) {
    const items = Array.from(
        container.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled);
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
    const icon = opts.danger ? 'fa-triangle-exclamation' : opts.withInput ? 'fa-pen' : 'fa-circle-question';
    overlay.innerHTML = `
            <div class="dialog-card" role="${opts.withInput ? 'dialog' : 'alertdialog'}" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg">
                <div class="dialog-icon${opts.danger ? ' danger' : ''}"><i class="fa-solid ${icon}"></i></div>
                <h3 id="dlg-title"></h3>
                <p id="dlg-msg"></p>
                ${
                    opts.withInput
                        ? `
                    <label class="dialog-label" for="dlg-input"></label>
                    ${opts.multiline ? '<textarea id="dlg-input" rows="3"></textarea>' : '<input id="dlg-input" type="text">'}`
                        : ''
                }
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
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) finish(false);
        });

        if (input) input.focus();
        else (opts.danger ? cancelBtn : okBtn).focus();
    });
}

function confirmDialog(options) {
    const opts = typeof options === 'string' ? { message: options } : options || {};
    return runDialog(
        {
            title: opts.title || 'Please confirm',
            message: opts.message || '',
            confirmLabel: opts.confirmLabel || 'Confirm',
            cancelLabel: opts.cancelLabel || 'Cancel',
            danger: !!opts.danger,
            withInput: false
        },
        (confirmed) => confirmed
    );
}

function promptDialog(options) {
    const opts = options || {};
    return runDialog(
        {
            title: opts.title || 'Enter a value',
            message: opts.message || '',
            label: opts.label || '',
            placeholder: opts.placeholder || '',
            confirmLabel: opts.confirmLabel || 'OK',
            cancelLabel: opts.cancelLabel || 'Cancel',
            danger: !!opts.danger,
            multiline: !!opts.multiline,
            withInput: true
        },
        (confirmed, input) => (confirmed ? input.value : null)
    );
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

window.retryRender = function (btn, fnName) {
    const fn = window[fnName];
    if (typeof fn !== 'function') {
        window.location.reload();
        return;
    }
    const state = btn && btn.closest ? btn.closest('.state-error') : null;
    if (state && state.parentElement) state.parentElement.innerHTML = skeletonRows(3);
    fn();
};

function setupSidebarAndTheme() {
    const root = document.documentElement;
    const store = {
        get(k) {
            try {
                return localStorage.getItem(k);
            } catch (e) {
                return null;
            }
        },
        set(k, v) {
            try {
                localStorage.setItem(k, v);
            } catch (e) {}
        }
    };

    const themeBtn = document.getElementById('theme-toggle-btn');
    const applyTheme = (theme) => {
        root.setAttribute('data-theme', theme);
        if (!themeBtn) return;
        const dark = theme === 'dark';
        const icon = themeBtn.querySelector('i');
        const label = themeBtn.querySelector('span');
        if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        if (label) label.textContent = dark ? 'Light mode' : 'Dark mode';
        themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
        refreshNavTitles();
    };
    const toggleTheme = (e) => {
        if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        store.set('jurisync-theme', next);
        applyTheme(next);
    };

    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    const isCollapsed = () => root.getAttribute('data-sidebar') === 'collapsed';

    function refreshNavTitles() {
        const collapsed = isCollapsed();
        document.querySelectorAll('.sidebar .nav-links li').forEach((li) => {
            const label = li.querySelector('span:not(.nav-badge)');
            if (collapsed && label) li.setAttribute('title', label.textContent.trim());
            else li.removeAttribute('title');
        });
    }

    const applyCollapsed = (collapsed) => {
        if (collapsed) root.setAttribute('data-sidebar', 'collapsed');
        else root.removeAttribute('data-sidebar');
        if (collapseBtn) {
            const text = collapsed ? 'Expand sidebar' : 'Minimize sidebar';
            collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            collapseBtn.setAttribute('aria-label', text);
            collapseBtn.setAttribute('title', text);
        }
        refreshNavTitles();
    };

    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
        themeBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleTheme(e);
            }
        });
    }
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
            const next = !isCollapsed();
            store.set('jurisync-sidebar', next ? 'collapsed' : 'expanded');
            applyCollapsed(next);
        });
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'jurisync-theme' && (e.newValue === 'dark' || e.newValue === 'light')) applyTheme(e.newValue);
        if (e.key === 'jurisync-sidebar') applyCollapsed(e.newValue === 'collapsed');
    });

    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    applyCollapsed(store.get('jurisync-sidebar') === 'collapsed');
}

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
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) close();
    });
    document
        .querySelectorAll('.sidebar .nav-links li, .sidebar .sidebar-footer')
        .forEach((el) => el.addEventListener('click', close));
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
    window.addEventListener('offline', () =>
        showToast('You are offline. Changes cannot be saved until you reconnect.', 'warning', { duration: 8000 })
    );
    window.addEventListener('online', () => showToast('You are back online.', 'success'));
}

setupSidebarAndTheme();
setupResponsiveShell();
setupGlobalErrorHandling();

function roleLabel(name) {
    const n = (name || '').toLowerCase();
    if (n === 'admin' || n === 'administrator') return 'Administrator';
    if (n === 'secretary') return 'Secretary';
    return 'Lawyer';
}

const CASE_TYPES = ['Civil', 'Criminal', 'Labor', 'Administrative'];
const CASE_STAGES = [
    'For Filing',
    'Filed',
    'Pre-Trial',
    'Mediation/JDR',
    'Trial - Plaintiff',
    'Trial - Prosecution',
    'Trial - Defense',
    'Demurrer',
    'For Decision',
    'Appeal'
];
const PARTY_TYPES = ['Plaintiff', 'Defendant', 'Petitioner', 'Respondent', 'Complainant', 'Accused'];

function fillSelect(el, values, placeholder) {
    if (!el) return;
    el.innerHTML =
        (placeholder ? `<option value="">${placeholder}</option>` : '') +
        values.map((v) => `<option value="${v}">${v}</option>`).join('');
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
    return rows.find((r) => r.is_lead) || rows[0] || null;
}
function getLeadLawyerId(c) {
    const l = getLeadLawyer(c);
    return l ? l.lawyer_id : null;
}
function getLeadLawyerName(c) {
    const l = getLeadLawyer(c);
    return (l && l.profiles && l.profiles.full_name) || '';
}

async function createCase({
    title,
    caseType,
    description,
    clientId,
    dateFiled,
    leadLawyerId,
    courtBranch,
    courtCaseNo,
    jurisdiction,
    caseStage,
    partyType
}) {
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
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];

const MFA_REQUIRED_ROLES = ['admin', 'lawyer', 'secretary'];

function showMfaOverlay(innerHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '10001';
    overlay.style.background = '#101b2d';
    overlay.innerHTML = `<div style="width: 90%; max-width: 420px; padding: 25px 30px; background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); max-height: 92vh; overflow-y: auto;">${innerHtml}</div>`;
    document.body.appendChild(overlay);
    return overlay;
}

const MFA_CODE_INPUT =
    'width:100%; box-sizing:border-box; padding:12px; border:1px solid #d5cfc2; border-radius:6px; font-family:inherit; font-size:20px; letter-spacing:6px; text-align:center; margin-bottom:10px;';
const MFA_PRIMARY_BTN =
    'width:100%; padding:12px; background:#101b2d; color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer;';
const MFA_SECONDARY_BTN =
    'width:100%; margin-top:10px; padding:10px; background:white; border:1px solid #e5e1d8; border-radius:6px; font-weight:600; cursor:pointer; color:#4f5b6d;';

async function promptMfaEnroll() {
    try {
        const { data: existing } = await supabaseClient.auth.mfa.listFactors();
        for (const f of (existing && existing.all) || []) {
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
                <h2 style="font-size: 20px; font-weight: 700; color: #252d3a; margin: 0 0 6px 0;">Set up two-factor authentication</h2>
                <p style="color: #64748b; font-size: 13px; margin: 0 0 16px 0;">Staff accounts require an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password).</p>
                <ol style="color:#3b4656; font-size:13px; margin:0 0 14px 18px; line-height:1.6;">
                    <li>Scan this QR code with your authenticator app.</li>
                    <li>Enter the 6-digit code the app shows.</li>
                </ol>
                <div style="text-align:center; margin-bottom:10px;"><img id="mfa-qr" alt="Authenticator QR code" style="width:180px; height:180px;"></div>
                <p style="font-size:12px; color:#64748b; margin:0 0 4px 0; text-align:center;">Can't scan? Enter this key manually:</p>
                <p id="mfa-secret" style="font-size:12px; font-family:monospace; word-break:break-all; background:#f7f5f0; border:1px solid #e5e1d8; border-radius:6px; padding:8px; margin:0 0 16px 0; text-align:center; user-select:all;"></p>
                <form id="mfa-form" autocomplete="off">
                    <input type="text" id="mfa-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" style="${MFA_CODE_INPUT}">
                    <div id="mfa-error" style="color:#d64545; font-size:12px; min-height:16px; margin-bottom:10px;"></div>
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
            const { error: verifyError } = await supabaseClient.auth.mfa.challengeAndVerify({
                factorId: data.id,
                code: code
            });
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
                <h2 style="font-size: 20px; font-weight: 700; color: #252d3a; margin: 0 0 6px 0;">Two-factor verification</h2>
                <p style="color: #64748b; font-size: 13px; margin: 0 0 18px 0;">Enter the 6-digit code from your authenticator app to continue.</p>
                <form id="mfa-form" autocomplete="off">
                    <input type="text" id="mfa-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" style="${MFA_CODE_INPUT}">
                    <div id="mfa-error" style="color:#d64545; font-size:12px; min-height:16px; margin-bottom:10px;"></div>
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
            const { error: verifyError } = await supabaseClient.auth.mfa.challengeAndVerify({
                factorId: factor.id,
                code: code
            });
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
                    <h2 style="font-size: 20px; font-weight: 700; color: #252d3a; margin: 0 0 6px 0;">Set a new password</h2>
                    <p style="color: #64748b; font-size: 13px; margin: 0 0 18px 0;">Your account was created with a temporary password. Choose your own to continue.</p>
                    <form id="force-pw-form" autocomplete="off">
                        <label style="display:block; font-size:13px; font-weight:600; color:#101b2d; margin-bottom:6px;">New password</label>
                        <input type="password" id="force-pw-1" autocomplete="new-password" placeholder="Min. 8 characters, with a letter and a number" style="width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #d5cfc2; border-radius:6px; margin-bottom:14px; font-family:inherit;">
                        <label style="display:block; font-size:13px; font-weight:600; color:#101b2d; margin-bottom:6px;">Confirm password</label>
                        <input type="password" id="force-pw-2" autocomplete="new-password" style="width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #d5cfc2; border-radius:6px; margin-bottom:10px; font-family:inherit;">
                        <div id="force-pw-error" style="color:#d64545; font-size:12px; min-height:16px; margin-bottom:10px;"></div>
                        <button type="submit" id="force-pw-submit" style="width:100%; padding:12px; background:#101b2d; color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Save password</button>
                    </form>
                    <button type="button" id="force-pw-logout" style="width:100%; margin-top:10px; padding:10px; background:white; border:1px solid #e5e1d8; border-radius:6px; font-weight:600; cursor:pointer; color:#4f5b6d;">Log out</button>
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
            await logSystemEvent('PASSWORD_CHANGE', 'auth', `${globalUserName || 'User'} set a new password`, null, {
                role: globalRoleName
            });
            overlay.remove();
            resolve();
        });
    });
}

async function checkAuthAndInit() {
    try {
        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error || !session) {
            window.location.href = 'login.html';
            return;
        }

        currentUser = session.user;

        await enforceMfaIfRequired();

        if (currentUser.user_metadata && currentUser.user_metadata.must_change_password) {
            await promptForcedPasswordChange();
            const { data: refreshed } = await supabaseClient.auth.getUser();
            if (refreshed && refreshed.user) currentUser = refreshed.user;
        }

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
            console.error('Profile fetch error:', error.message);
            return false;
        }

        if (profile) {
            globalUserName = profile.full_name || 'User';
            globalRoleName = ((profile.roles && profile.roles.name) || 'lawyer').toLowerCase();
            globalUserRole = globalRoleName === 'lawyer' ? 'lawyer' : 'administrator';

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

            document.querySelectorAll('.calendar-sidebar-widgets .widget-card').forEach((card) => {
                const heading = card.querySelector('h4');
                if (heading && heading.textContent.toLowerCase().includes('lawyers')) {
                    card.style.display = isLawyer ? 'none' : 'block';
                }
            });

            const manageLawyersNav = document.getElementById('nav-manage-lawyers');
            if (manageLawyersNav) manageLawyersNav.style.display = isLawyer ? 'none' : 'flex';

            const manageClientsNav = document.getElementById('nav-manage-clients');
            if (manageClientsNav) manageClientsNav.style.display = globalUserRole === 'administrator' ? 'flex' : 'none';

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
            if (approvalNoteEl)
                approvalNoteEl.textContent = isAdminRole
                    ? 'Clients you add are approved right away.'
                    : 'The client is saved as pending until an administrator approves it.';
            const newCaseBtnEl = document.getElementById('btn-new-case');
            if (newCaseBtnEl) newCaseBtnEl.style.display = isAdminRole || globalRoleName === 'lawyer' ? '' : 'none';

            const lawyersStatCard = document.getElementById('stat-card-lawyers');
            if (lawyersStatCard) lawyersStatCard.style.display = isLawyer ? 'none' : 'flex';

            const uploadDocBtn = document.getElementById('btn-upload-doc');
            if (uploadDocBtn) uploadDocBtn.style.display = 'flex';

            const addEventBtn = document.getElementById('btn-add-event-header');
            if (addEventBtn) addEventBtn.style.display = 'flex';

            const deadlinesCard = document.getElementById('dashboard-deadlines-card');
            if (deadlinesCard) {
                deadlinesCard.style.display = globalUserRole === 'administrator' ? 'none' : 'block';
            }

            const deadlinesStatCard = document.getElementById('stat-card-deadlines');
            if (deadlinesStatCard) {
                deadlinesStatCard.style.display = globalUserRole === 'administrator' ? 'none' : 'flex';
            }

            const myCasesTabBtn = document.getElementById('sched-tab-btn-cases');
            const myCasesPane = document.getElementById('sched-cases');
            if (myCasesTabBtn) {
                myCasesTabBtn.style.display = globalUserRole === 'administrator' ? 'none' : 'inline-block';
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
        .map((word) => word.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function setupRealtimeSubscriptions() {
    supabaseClient
        .channel('public-changes')
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
            refreshDocumentList();
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
            renderPerformanceTab();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
            renderManageLawyersList();
            renderLawyerStatusWidget();
        })
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` },
            () => {
                renderNotificationsList();
            }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_requests' }, () => {
            renderAppointmentRequests();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, () => {
            renderEmailQueueList();
            const caseModal = document.getElementById('case-detail-modal');
            if (caseModal && !caseModal.classList.contains('hidden')) {
                const openCaseId = caseModal.getAttribute('data-active-case-id');
                if (openCaseId) loadCaseEmails(openCaseId);
            }
        })
        .subscribe();
}

const APPT_ERROR_TEXT = {
    slot_taken: 'You already have an event at that time. Decline this request or move the other event first.',
    room_taken: 'That room is already booked at that time. Choose the other room.',
    in_the_past: 'This appointment time has already passed. Please decline the request.',
    invalid_location: 'Please choose a location for the appointment.',
    already_decided: 'This request was already answered.',
    not_allowed: 'You are not allowed to answer this request.',
    request_not_found: 'This request no longer exists.',
    invalid_note: 'Your message is too long.'
};

let apptRequestsCache = [];
let apptRenderPending = false;

function appointmentErrorText(err) {
    const key = err && err.message ? String(err.message).trim() : '';
    return APPT_ERROR_TEXT[key] || 'Could not update this request. Please try again.';
}

async function renderAppointmentRequests(force) {
    const card = document.getElementById('widget-appointment-requests');
    const list = document.getElementById('appt-requests-list');
    const badge = document.getElementById('appt-count');
    if (!card || !list || !currentUser) return;
    if (globalRoleName !== 'lawyer' && globalRoleName !== 'admin') {
        card.style.display = 'none';
        return;
    }
    card.style.display = '';

    if (!force && list.querySelector('.appt-panel')) {
        apptRenderPending = true;
        return;
    }
    apptRenderPending = false;
    if (!list.innerHTML.trim()) showSkeletonIfEmpty(list, skeletonRows(2));

    try {
        let query = supabaseClient
            .from('appointment_requests')
            .select(
                'id, case_id, requested_start, requested_end, topic, notes, lawyer_id, created_at, clients(client_name), cases(title, case_number), profiles!appointment_requests_lawyer_id_fkey(full_name)'
            )
            .eq('status', 'pending')
            .order('requested_start', { ascending: true })
            .limit(50);
        if (globalRoleName === 'lawyer') query = query.eq('lawyer_id', currentUser.id);
        const { data, error } = await query;
        if (error) throw error;

        apptRequestsCache = data || [];
        if (badge) {
            badge.textContent = String(apptRequestsCache.length);
            badge.style.display = apptRequestsCache.length ? '' : 'none';
        }

        if (apptRequestsCache.length === 0) {
            list.innerHTML = '<p class="appt-empty">No pending appointment requests.</p>';
            return;
        }

        list.innerHTML = apptRequestsCache
            .map((r) => {
                const clientName = (r.clients && r.clients.client_name) || 'Client';
                const caseLabel = r.cases ? r.cases.title + (r.cases.case_number ? ' (#' + r.cases.case_number + ')' : '') : '';
                const lawyerLine =
                    globalRoleName === 'admin' && r.profiles && r.profiles.full_name
                        ? `<div class="appt-lawyer">For Atty. ${escapeHtml(r.profiles.full_name)}</div>`
                        : '';
                return `
                    <div class="appt-item" data-appt-id="${escapeHtml(r.id)}">
                        <div class="appt-top">
                            <div>
                                <div class="appt-client">${escapeHtml(clientName)}</div>
                                <div class="appt-when">${escapeHtml(formatDate(r.requested_start))}, ${escapeHtml(formatEventRange(r.requested_start, r.requested_end))}</div>
                            </div>
                        </div>
                        <div class="appt-sub"><strong>${escapeHtml(r.topic)}</strong>${caseLabel ? '<br>' + escapeHtml(caseLabel) : ''}</div>
                        ${r.notes ? `<div class="appt-notes">${escapeHtml(r.notes)}</div>` : ''}
                        ${lawyerLine}
                        <div class="appt-actions">
                            <button type="button" class="appt-btn approve" data-appt-act="approve">Approve</button>
                            <button type="button" class="appt-btn decline" data-appt-act="decline">Decline</button>
                        </div>
                        <div class="appt-panel-slot"></div>
                    </div>`;
            })
            .join('');
    } catch (error) {
        console.error('Error loading appointment requests:', error);
        list.innerHTML = errorStateHtml('Could not load appointment requests.', 'renderAppointmentRequests');
    }
}

function openAppointmentPanel(item, action) {
    const slot = item.querySelector('.appt-panel-slot');
    if (!slot) return;
    if (item.dataset.apptPanel === action) {
        slot.innerHTML = '';
        delete item.dataset.apptPanel;
        item.classList.remove('appt-open');
        if (apptRenderPending) renderAppointmentRequests();
        return;
    }
    item.dataset.apptPanel = action;
    item.classList.add('appt-open');
    const isApprove = action === 'approve';
    slot.innerHTML = `
        <div class="appt-panel">
            ${
                isApprove
                    ? `<label for="appt-loc-${escapeHtml(item.dataset.apptId)}">Location</label>
                       <select id="appt-loc-${escapeHtml(item.dataset.apptId)}" data-appt-field="location">
                           <option value="Conference Room A">Conference Room A</option>
                           <option value="Conference Room B">Conference Room B</option>
                       </select>`
                    : ''
            }
            <label for="appt-note-${escapeHtml(item.dataset.apptId)}">${isApprove ? 'Message to client (optional)' : 'Reason for declining (optional)'}</label>
            <textarea id="appt-note-${escapeHtml(item.dataset.apptId)}" data-appt-field="note" maxlength="500" placeholder="${isApprove ? 'e.g. Please bring your ID.' : 'e.g. I am in court that day. Please pick another time.'}"></textarea>
            <div class="appt-actions">
                <button type="button" class="appt-btn ${isApprove ? 'approve' : 'decline'}" data-appt-confirm="${action}">${isApprove ? 'Confirm approval' : 'Confirm decline'}</button>
            </div>
        </div>`;
}

async function respondToAppointment(item, action, btn) {
    const id = item.dataset.apptId;
    const locEl = item.querySelector('[data-appt-field="location"]');
    const noteEl = item.querySelector('[data-appt-field="note"]');
    const location = locEl ? locEl.value : null;
    const note = noteEl ? noteEl.value.trim() : '';

    item.querySelectorAll('button').forEach((b) => (b.disabled = true));
    const { error } = await supabaseClient.rpc('staff_respond_appointment', {
        p_id: id,
        p_action: action,
        p_location: location,
        p_note: note || null
    });

    if (error) {
        console.error('Appointment response failed:', error);
        showToast(appointmentErrorText(error), 'warning');
        if (error.message === 'already_decided' || error.message === 'request_not_found') {
            renderAppointmentRequests(true);
        } else {
            item.querySelectorAll('button').forEach((b) => (b.disabled = false));
        }
        return;
    }

    showToast(
        action === 'approve'
            ? 'Appointment approved and added to the calendar.'
            : 'Appointment request declined.',
        'success'
    );
    await renderAppointmentRequests(true);
    generateCalendarGrid();
    renderScheduleSummaryWidget();
    renderResourcesWidget();
    renderLawyerStatusWidget();
    updateDashboardStats();
}

function setupAppointmentRequests() {
    const list = document.getElementById('appt-requests-list');
    if (list && !list.dataset.bound) {
        list.dataset.bound = '1';
        list.addEventListener('click', (e) => {
            const item = e.target.closest('.appt-item');
            if (!item) return;
            const actBtn = e.target.closest('[data-appt-act]');
            if (actBtn) {
                openAppointmentPanel(item, actBtn.dataset.apptAct);
                return;
            }
            const confirmBtn = e.target.closest('[data-appt-confirm]');
            if (confirmBtn) respondToAppointment(item, confirmBtn.dataset.apptConfirm, confirmBtn);
        });
    }
    renderAppointmentRequests();
}

window.focusAppointmentRequest = async function (id) {
    const nav = document.querySelector('.nav-links li[data-target="calendar-view"]');
    if (nav) nav.click();
    await renderAppointmentRequests(true);
    const item = document.querySelector(`#appt-requests-list .appt-item[data-appt-id="${CSS.escape(String(id))}"]`);
    const card = document.getElementById('widget-appointment-requests');
    const target = item || card;
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (item) {
        item.classList.add('appt-flash');
        setTimeout(() => item.classList.remove('appt-flash'), 2500);
    } else if (id) {
        showToast('This appointment request was already answered.', 'info');
    }
};

const TEMPLATE_FIELDS = [
    { key: 'client_name', label: 'Client name', fallback: 'Client Name', group: 'Client' },
    { key: 'client_email', label: 'Email', fallback: 'Client Email', group: 'Client' },
    { key: 'client_phone', label: 'Phone', fallback: 'Client Phone', group: 'Client' },
    { key: 'client_address', label: 'Address', fallback: 'Client Address', group: 'Client' },
    { key: 'case_number', label: 'Case number', fallback: 'Case Number', group: 'Case' },
    { key: 'case_title', label: 'Case title', fallback: 'Case Title', group: 'Case' },
    { key: 'case_type', label: 'Case type', fallback: 'Case Type', group: 'Case' },
    { key: 'case_stage', label: 'Case stage', fallback: 'Case Stage', group: 'Case' },
    { key: 'party_type', label: 'Party type', fallback: 'Party Type', group: 'Case' },
    { key: 'court_branch', label: 'Court branch', fallback: 'Court Branch', group: 'Court' },
    { key: 'court_case_no', label: 'Court case no.', fallback: 'Court Case No.', group: 'Court' },
    { key: 'lawyer_name', label: 'Lawyer name', fallback: 'Lawyer Name', group: 'Other' },
    { key: 'date', label: "Today's date", fallback: 'Date', group: 'Other' }
];

const PLACEHOLDER_SOURCE = '\\[[^\\]\\n]{2,80}\\]';

let templatesCache = null;
let templateEditId = null;
let templateLastField = null;
let templateSearchTerm = '';

async function loadTemplates(force) {
    if (templatesCache && !force) return templatesCache;
    const { data, error } = await supabaseClient
        .from('document_templates')
        .select('id, name, kind, subject, body, created_by, updated_at')
        .eq('kind', 'email')
        .order('name', { ascending: true });
    if (error) throw error;
    templatesCache = data || [];
    return templatesCache;
}

function buildTemplateContext(caseId) {
    const c = (window.__casesRegistry || {})[caseId] || {};
    const cl = c.clients || {};
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const lawyer = globalUserName ? (globalRoleName === 'lawyer' ? 'Atty. ' : '') + globalUserName : '';
    return {
        client_name: cl.client_name || '',
        client_email: cl.client_email || '',
        client_phone: cl.client_phone || '',
        client_address: cl.full_address || '',
        case_number: c.case_number || '',
        case_title: c.title || '',
        case_type: c.case_type || '',
        case_stage: c.case_stage || '',
        party_type: c.party_type || '',
        court_branch: c.court_branch || '',
        court_case_no: c.court_case_no || '',
        lawyer_name: lawyer,
        date: today
    };
}

function applyTemplate(text, ctx) {
    return String(text || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key) => {
        const field = TEMPLATE_FIELDS.find((f) => f.key === key.toLowerCase());
        if (!field) return match;
        const value = ctx[field.key];
        return value ? String(value) : '[' + field.fallback + ']';
    });
}

function placeholderTokens(text) {
    const found = String(text || '').match(new RegExp(PLACEHOLDER_SOURCE, 'g')) || [];
    return Array.from(new Set(found));
}

function countPlaceholders(text) {
    const found = String(text || '').match(new RegExp(PLACEHOLDER_SOURCE, 'g'));
    return found ? found.length : 0;
}

function canManageTemplate() {
    return globalRoleName === 'admin' || globalRoleName === 'lawyer';
}

async function populateEmailTemplateSelect() {
    const select = document.getElementById('case-email-template');
    if (!select) return;
    select.innerHTML = '<option value="">Use an email template</option>';
    try {
        const list = await loadTemplates(false);
        list.filter((t) => t.kind === 'email').forEach((t) => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

function applyEmailTemplateFromSelect() {
    const select = document.getElementById('case-email-template');
    const modal = document.getElementById('case-detail-modal');
    const subjectInput = document.getElementById('case-email-subject');
    const bodyInput = document.getElementById('case-email-body');
    if (!select || !modal || !subjectInput || !bodyInput || !select.value) return;
    const tpl = (templatesCache || []).find((t) => t.id === select.value);
    if (!tpl) return;
    if (
        (subjectInput.value.trim() || bodyInput.value.trim()) &&
        !confirm('Replace the current subject and message with this template?')
    ) {
        select.value = '';
        return;
    }
    const ctx = buildTemplateContext(modal.getAttribute('data-active-case-id'));
    subjectInput.value = applyTemplate(tpl.subject || tpl.name, ctx);
    bodyInput.value = applyTemplate(tpl.body, ctx);
    bodyInput.rows = Math.min(12, Math.max(4, bodyInput.value.split('\n').length));
    select.value = '';
    const open = countPlaceholders(subjectInput.value + '\n' + bodyInput.value);
    if (open > 0) {
        showToast(
            open + (open === 1 ? ' placeholder' : ' placeholders') + ' in [brackets] still need to be filled in before sending.',
            'info'
        );
    }
    bodyInput.focus();
}

function setTemplateStatus(text, kind) {
    const el = document.getElementById('tpl-status');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'tpl-status' + (kind ? ' ' + kind : '');
}

function renderTemplateList() {
    const listEl = document.getElementById('tpl-list');
    if (!listEl) return;
    const term = templateSearchTerm.trim().toLowerCase();
    const items = (templatesCache || []).filter((t) => !term || t.name.toLowerCase().includes(term));
    if (items.length === 0) {
        listEl.innerHTML = `<p class="tpl-empty">${term ? 'No templates match your search.' : 'No templates yet.'}</p>`;
        return;
    }
    listEl.innerHTML =
        `<div class="tpl-group">Emails<span>${items.length}</span></div>` +
        items
            .map(
                (t) =>
                    `<button type="button" class="tpl-item ${t.id === templateEditId ? 'active' : ''}" data-tpl-id="${escapeHtml(t.id)}">
                        <i class="fa-regular fa-envelope"></i>
                        <span class="tpl-item-name">${escapeHtml(t.name)}</span>
                        ${canManageTemplate(t) ? '' : '<i class="fa-solid fa-lock tpl-lock" title="Read-only"></i>'}
                    </button>`
            )
            .join('');
}

function fillTemplateForm(tpl) {
    const editable = canManageTemplate(tpl);
    templateEditId = tpl ? tpl.id : null;
    document.getElementById('tpl-name').value = tpl ? tpl.name : '';
    document.getElementById('tpl-subject').value = tpl ? tpl.subject || '' : '';
    document.getElementById('tpl-body').value = tpl ? tpl.body : '';
    ['tpl-name', 'tpl-subject', 'tpl-body'].forEach((id) => {
        document.getElementById(id).disabled = !editable;
    });
    document.getElementById('tpl-save-btn').style.display = editable ? '' : 'none';
    document.getElementById('tpl-delete-btn').style.display = editable && tpl ? '' : 'none';
    document.getElementById('tpl-fields-wrap').style.display = editable ? '' : 'none';
    document.getElementById('tpl-form-title').textContent = !tpl ? 'New template' : editable ? 'Edit template' : 'View template';
    const badge = document.getElementById('tpl-badge');
    badge.style.display = tpl && !editable ? '' : 'none';
    badge.innerHTML = '<i class="fa-solid fa-lock"></i> Read-only';
    setTemplateStatus(editable ? '' : 'Only lawyers and administrators can change templates.', editable ? '' : 'info');
    renderTemplateList();
}

async function openTemplateManager() {
    const modal = document.getElementById('tpl-manage-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    templateSearchTerm = '';
    document.getElementById('tpl-search').value = '';
    try {
        await loadTemplates(true);
    } catch (error) {
        console.error('Error loading templates:', error);
        showToast('Templates could not be loaded. Please try again.', 'error');
    }
    document.getElementById('tpl-new-btn').style.display = canManageTemplate() ? '' : 'none';
    fillTemplateForm((templatesCache || [])[0] || null);
}

async function saveTemplateForm(e) {
    e.preventDefault();
    const name = document.getElementById('tpl-name').value.trim();
    const subject = document.getElementById('tpl-subject').value.trim();
    const body = document.getElementById('tpl-body').value;
    const btn = document.getElementById('tpl-save-btn');
    if (!name || !body.trim()) {
        setTemplateStatus('Please enter a name and the content.', 'err');
        return;
    }
    if (!subject) {
        setTemplateStatus('Please enter a subject for the email template.', 'err');
        return;
    }
    btn.disabled = true;
    setTemplateStatus('Saving...', 'busy');
    const row = { name, kind: 'email', subject, body, updated_by: currentUser ? currentUser.id : null };
    let result;
    if (templateEditId) {
        result = await supabaseClient.from('document_templates').update(row).eq('id', templateEditId).select('id').single();
    } else {
        row.created_by = currentUser ? currentUser.id : null;
        result = await supabaseClient.from('document_templates').insert([row]).select('id').single();
    }
    btn.disabled = false;
    if (result.error) {
        console.error('Error saving template:', result.error);
        const duplicate = result.error.code === '23505';
        setTemplateStatus(
            duplicate ? 'A template with this name already exists.' : 'The template could not be saved.',
            'err'
        );
        return;
    }
    await loadTemplates(true);
    const saved = templatesCache.find((t) => t.id === result.data.id) || null;
    fillTemplateForm(saved);
    setTemplateStatus('Template saved.', 'ok');
    populateEmailTemplateSelect();
}

async function deleteTemplateForm() {
    if (!templateEditId) return;
    const tpl = (templatesCache || []).find((t) => t.id === templateEditId);
    if (!tpl || !confirm('Delete the template "' + tpl.name + '"? This cannot be undone.')) return;
    const { error } = await supabaseClient.from('document_templates').delete().eq('id', templateEditId);
    if (error) {
        console.error('Error deleting template:', error);
        setTemplateStatus('The template could not be deleted.', 'err');
        return;
    }
    await loadTemplates(true);
    fillTemplateForm((templatesCache || [])[0] || null);
    populateEmailTemplateSelect();
    setTemplateStatus('Template deleted.', 'ok');
}

function insertTemplateField(key) {
    const target =
        templateLastField && !templateLastField.disabled && document.body.contains(templateLastField)
            ? templateLastField
            : document.getElementById('tpl-body');
    const token = '{{' + key + '}}';
    const start = target.selectionStart === null ? target.value.length : target.selectionStart;
    const end = target.selectionEnd === null ? start : target.selectionEnd;
    target.value = target.value.slice(0, start) + token + target.value.slice(end);
    const pos = start + token.length;
    target.focus();
    target.setSelectionRange(pos, pos);
}

function renderTemplateFieldChips() {
    const groups = ['Client', 'Case', 'Court', 'Other'];
    document.getElementById('tpl-fields').innerHTML = groups
        .map((group) => {
            const chips = TEMPLATE_FIELDS.filter((f) => f.group === group)
                .map((f) => `<button type="button" class="tpl-chip" data-field="${f.key}">${escapeHtml(f.label)}</button>`)
                .join('');
            return `<div class="tpl-chip-group"><span>${group}</span><div>${chips}</div></div>`;
        })
        .join('');
}

function setupTemplates() {
    const caseModal = document.getElementById('case-detail-modal');
    const manageModal = document.getElementById('tpl-manage-modal');
    if (!caseModal || !manageModal) return;

    document.getElementById('case-email-template').addEventListener('change', applyEmailTemplateFromSelect);
    document.getElementById('case-manage-templates').addEventListener('click', openTemplateManager);

    document.getElementById('tpl-manage-close').addEventListener('click', () => manageModal.classList.add('hidden'));
    manageModal.addEventListener('mousedown', (e) => {
        if (e.target === manageModal) manageModal.classList.add('hidden');
    });
    document.getElementById('tpl-new-btn').addEventListener('click', () => {
        fillTemplateForm(null);
        document.getElementById('tpl-name').focus();
    });
    document.getElementById('tpl-search').addEventListener('input', (e) => {
        templateSearchTerm = e.target.value;
        renderTemplateList();
    });
    document.getElementById('tpl-list').addEventListener('click', (e) => {
        const item = e.target.closest('[data-tpl-id]');
        if (!item) return;
        const tpl = (templatesCache || []).find((t) => t.id === item.dataset.tplId);
        if (tpl) fillTemplateForm(tpl);
    });
    document.getElementById('tpl-form').addEventListener('submit', saveTemplateForm);
    document.getElementById('tpl-delete-btn').addEventListener('click', deleteTemplateForm);
    ['tpl-subject', 'tpl-body'].forEach((id) => {
        document.getElementById(id).addEventListener('focus', (e) => {
            templateLastField = e.target;
        });
    });
    renderTemplateFieldChips();
    document.getElementById('tpl-fields').addEventListener('mousedown', (e) => e.preventDefault());
    document.getElementById('tpl-fields').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-field]');
        if (chip) insertTemplateField(chip.dataset.field);
    });
}

async function pollNewNotifications() {
    if (!currentUser || !window.__notifSeen) return;
    const { data, error } = await supabaseClient
        .from('notifications')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50);
    if (error || !data) return;
    if (data.some((n) => !window.__notifSeen.has(n.id))) renderNotificationsList();
}

async function initializeApp() {
    if (window.JuriSyncSound) {
        window.JuriSyncSound.bindToggle(document.getElementById('notif-sound-toggle'));
        const soundTest = document.getElementById('notif-sound-test');
        if (soundTest) soundTest.addEventListener('click', () => window.JuriSyncSound.play(true));
    }
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
    setupAppointmentRequests();
    setupTemplates();

    setupScheduleTabs();
    setupScheduleButtons();
    await renderMyScheduleContent();

    setupNotificationTabs();
    await renderNotificationsList();
    setInterval(pollNewNotifications, 20000);
    await renderEmailQueueList();
    setupNotificationActions();

    setupLogoutValidation();
}

const navItems = document.querySelectorAll('.nav-links li');

navItems.forEach((item) => {
    item.addEventListener('click', async function () {
        const target = this.getAttribute('data-target');
        if (!target) return;

        navItems.forEach((i) => i.classList.remove('active'));
        this.classList.add('active');

        document.querySelectorAll('.view-section').forEach((section) => {
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
        let casesQuery = supabaseClient
            .from('cases')
            .select(casesSelect('*', myCasesOnly), { count: 'exact', head: true })
            .eq('status', 'active');
        let eventsQuery = supabaseClient
            .from('calendar_events')
            .select('*, profiles(full_name)')
            .gte('start_date', todayStr)
            .lte('start_date', nextWeekStr);
        let conflictsQuery = supabaseClient
            .from('calendar_events')
            .select('*, profiles(full_name)')
            .gte('start_date', todayStr);

        if (globalUserRole === 'lawyer' && currentUser) {
            casesQuery = filterMyCases(casesQuery);
            eventsQuery = eventsQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
            conflictsQuery = conflictsQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
        }

        let casesCount = 0;
        try {
            const res = await casesQuery;
            if (!res.error) casesCount = res.count;
        } catch (e) {}

        const { data: upcomingEvents } = await eventsQuery;
        const deadlinesCount = upcomingEvents ? upcomingEvents.length : 0;

        const { data: allUpcomingEvents } = await conflictsQuery;
        let conflictsCount = 0;
        if (allUpcomingEvents) {
            allUpcomingEvents.forEach((ev) => {
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

        if (dlError) console.error('Error fetching deadlines:', dlError);

        let visibleDeadlines = allDeadlines ? allDeadlines.slice(0, 5) : [];

        if (visibleDeadlines.length > 0) {
            if (timeframeLabel) {
                const nearestDate = new Date(visibleDeadlines[0].start_date);
                const todayDate = new Date(todayStr);
                const diffTime = nearestDate - todayDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                    timeframeLabel.innerText = 'Today';
                    timeframeLabel.style.color = '#d64545';
                } else if (diffDays === 1) {
                    timeframeLabel.innerText = 'Tomorrow';
                    timeframeLabel.style.color = '#d69b2d';
                } else {
                    timeframeLabel.innerText = `In ${diffDays} days`;
                    timeframeLabel.style.color = 'var(--text-muted)';
                }
            }

            deadlineList.innerHTML = visibleDeadlines
                .map((d) => {
                    const assignedName = d.is_general
                        ? 'All Lawyers'
                        : d.profiles && d.profiles.full_name
                          ? d.profiles.full_name
                          : 'Unassigned';
                    const clientName = d.cases?.clients?.client_name || 'No Client';
                    const isGeneralBadge = d.is_general
                        ? '<span style="background:#d7e5f6; color:#285791; font-size:12px; padding:3px 8px; border-radius:10px; margin-left:8px;">Firm-wide</span>'
                        : '';
                    const priorityBadge =
                        d.priority === 'high'
                            ? '<span style="background:#f9e1e1; color:#d64545; font-size:12px; padding:3px 8px; border-radius:10px; margin-left:8px;">High</span>'
                            : '';
                    const statusInfo = getEventStatusInfo(d.start_date, d.end_date);
                    const statusBadge = `<span style="background:${statusInfo.bg}; color:${statusInfo.color}; font-size:12px; padding:3px 8px; border-radius:10px; margin-left:8px; font-weight:600;"><i class="fa-solid ${statusInfo.icon}" style="margin-right:3px;"></i>${statusInfo.label}</span>`;

                    return `
                        <div style="background:#fff; border:1px solid #e5e1d8; border-left:4px solid ${statusInfo.color}; padding:18px 20px; border-radius:12px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; ${statusInfo.label === 'Completed' ? 'opacity:0.65;' : ''}">
                            <div>
                                <h4 style="font-size:15px;">
                                    ${escapeHtml(d.title || 'Untitled Event')} 
                                    ${priorityBadge}
                                    ${isGeneralBadge}
                                    ${statusBadge}
                                </h4>
                                <p style="font-size:13px; color:#64748b; margin-top:4px;"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(d.location || 'No location')} • Client: ${escapeHtml(clientName)} • Atty. ${escapeHtml(assignedName)}</p>
                                <div style="margin-top:10px; font-size:12px; color:#64748b;">
                                    <i class="fa-regular fa-calendar"></i> ${formatDate(d.start_date)} at ${formatEventRange(d.start_date, d.end_date)}
                                </div>
                            </div>
                            <button style="padding:10px 18px; border:1px solid #e5e1d8; background:white; border-radius:10px; cursor:pointer; font-weight:600;" onclick="document.querySelector('.nav-links li[data-target=\\'calendar-view\\']').click()">
                                View
                            </button>
                        </div>
                    `;
                })
                .join('');
        } else {
            if (timeframeLabel) {
                timeframeLabel.innerText = 'No events';
                timeframeLabel.style.color = 'var(--text-muted)';
            }
            deadlineList.innerHTML =
                '<p style="color:#64748b; text-align:center; padding:20px;">No upcoming deadlines</p>';
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

    const filterBar = document.getElementById('calendar-filters');
    if (filterBar) {
        filterBar.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-calfilter]');
            if (!chip) return;
            calendarFilter = chip.getAttribute('data-calfilter');
            filterBar.querySelectorAll('[data-calfilter]').forEach((el) => {
                const on = el === chip;
                el.classList.toggle('active', on);
                el.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            generateCalendarGrid();
        });
    }
}

const CALENDAR_FILTER_PATTERNS = {
    hearing: /hearing|trial|arraignment|pre-?trial|court/i,
    appointment: /appointment|consultation|meeting|conference|interview/i
};

function eventMatchesCalendarFilter(ev) {
    if (calendarFilter === 'all') return true;
    if (calendarFilter === 'general') return !!ev.is_general;
    if (calendarFilter === 'high') return ev.priority === 'high';
    const pattern = CALENDAR_FILTER_PATTERNS[calendarFilter];
    return pattern ? pattern.test(ev.title || '') : true;
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

    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const startDate = getDayRange(`${monthPrefix}-01`).startISO;
    const endDate = getDayRange(`${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`).endISO;

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
        console.error('Calendar fetch error:', error);
        showToast('Could not load calendar events.', 'error');
    }

    const eventsByDay = {};
    if (calendarEvents) {
        calendarEvents.filter(eventMatchesCalendarFilter).forEach((event) => {
            const day = new Date(event.start_date).getDate();
            if (!eventsByDay[day]) eventsByDay[day] = [];
            eventsByDay[day].push(event);
        });
    }

    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += '<div class="day-cell day-empty"></div>';
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const isCurrent =
            i === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

        const weekday = (firstDay + i - 1) % 7;
        const isWeekend = weekday === 0 || weekday === 6;
        let eventsHtml = '<div class="day-events-container">';

        if (eventsByDay[i]) {
            const dayEvents = eventsByDay[i];
            const maxVisible = 2;

            dayEvents.slice(0, maxVisible).forEach((ev) => {
                const styleClass = ev.is_general ? 'cal-event-general' : 'cal-event-normal';
                const iconHtml = ev.is_general ? '<i class="fa-solid fa-building"></i>' : '';

                let lawyerName = '';
                if (ev.is_general) {
                    lawyerName = 'All Lawyers';
                } else if (ev.profiles && ev.profiles.full_name) {
                    lawyerName = ev.profiles.full_name.split(' ')[0];
                } else {
                    lawyerName = 'Unassigned';
                }

                const clientNameStr = ev.cases?.clients?.client_name
                    ? `Client: ${ev.cases.clients.client_name} | `
                    : '';
                const priorityMark =
                    ev.priority === 'high' ? '<i class="fa-solid fa-star" style="font-size:12px;"></i>' : '';
                const timeRange =
                    (formatEventTime(ev.start_date) || '') + (ev.end_date ? ' – ' + formatEventTime(ev.end_date) : '');
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
        if (card)
            card.addEventListener('click', () =>
                type === 'cases' ? window.openCasesDashboard() : window.openStatDetails(type)
            );
    });
}

const SD_COLORS = ['#2f65ad', '#3d5a80', '#16835d', '#b9811f', '#a83030', '#3d5a80'];

function sdAvatar(name, url) {
    const clean = String(name || '').replace(/^Atty\.?\s*/i, '').trim();
    const text = (getInitials(clean) || '?').slice(0, 2).toUpperCase();
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = (hash + clean.charCodeAt(i)) % SD_COLORS.length;
    const color = SD_COLORS[hash];
    if (url) {
        return `<span class="sd-avatar"><img src="${escapeHtml(url)}" alt="" onerror="this.replaceWith(document.createTextNode(this.dataset.fallback))" data-fallback="${escapeHtml(text)}"></span>`;
    }
    return `<span class="sd-avatar" style="background:${color}22; color:${color};">${escapeHtml(text)}</span>`;
}

function sdIconTile(icon, tone) {
    return `<span class="sd-avatar sd-tile ${tone}"><i class="fa-solid ${icon}"></i></span>`;
}

window.openStatDetails = async function (type) {
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

            listEl.innerHTML =
                cases && cases.length > 0
                    ? cases
                          .map((c) => {
                              const clientName = c.clients ? c.clients.client_name : 'No Client';
                              const leadName = isAdminView ? getLeadLawyerName(c) : '';
                              return `
                            <div class="sd-card">
                                ${sdIconTile('fa-briefcase', 'blue')}
                                <div class="sd-body">
                                    <div class="sd-name">${escapeHtml(c.title)}</div>
                                    <div class="sd-sub"><i class="fa-regular fa-user"></i> ${escapeHtml(clientName)}</div>
                                    <div class="sd-chips">
                                        ${c.case_number ? `<span class="sd-chip">#${escapeHtml(c.case_number)}</span>` : ''}
                                        <span class="sd-chip"><i class="fa-regular fa-calendar"></i> Filed ${formatDate(c.date_filed || c.created_at)}</span>
                                        ${leadName ? `<span class="sd-chip"><i class="fa-solid fa-gavel"></i> Atty. ${escapeHtml(leadName)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                          })
                          .join('')
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

            listEl.innerHTML =
                deadlines && deadlines.length > 0
                    ? deadlines
                          .map((dl) => {
                              const dlDate = new Date(dl.start_date);
                              const daysUntil = Math.ceil((dlDate - new Date(todayStr)) / (1000 * 60 * 60 * 24));
                              const badgeColor = daysUntil <= 3 ? 'bg-red' : 'bg-gray';
                              const clientName = dl.cases?.clients?.client_name || 'No Client';
                              return `
                            <div class="upcoming-dl-item" style="cursor:pointer;" onclick="openEventDetails('${dl.id}')" title="Click to view full event details">
                                <div style="display:flex; justify-content:space-between;">
                                    <h4>${escapeHtml(dl.title)}</h4>
                                    <span class="badge-pill ${badgeColor}" title="Due in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}">${daysUntil <= 3 ? '<i class="fa-solid fa-triangle-exclamation"></i>' : ''}${daysUntil}d</span>
                                </div>
                                <p>${escapeHtml(dl.location || 'Meeting')} • Client: ${escapeHtml(clientName)}</p>
                                <small><i class="fa-regular fa-calendar"></i> ${formatDate(dl.start_date)} at ${formatEventTime(dl.start_date)}</small>
                            </div>
                        `;
                          })
                          .join('')
                    : '<p style="color:#64748b; text-align:center; padding:20px;">No upcoming deadlines.</p>';
        } else if (type === 'completed') {
            const localDate = new Date();
            const pastWindowDate = new Date(localDate);
            pastWindowDate.setDate(pastWindowDate.getDate() - 60);
            const pastWindowStr = pastWindowDate.toISOString().split('T')[0];

            const isAdminView = globalUserRole !== 'lawyer';
            const buildCompletedQuery = () => {
                let completedQuery = supabaseClient
                    .from('calendar_events')
                    .select('*, cases(case_number, clients(client_name))')
                    .order('start_date', { ascending: false })
                    .order('id', { ascending: true });
                if (isAdminView) {
                    completedQuery = completedQuery.lte('start_date', new Date().toISOString());
                } else {
                    completedQuery = completedQuery
                        .gte('start_date', pastWindowStr)
                        .or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
                }
                return completedQuery;
            };
            const { data: recentEvents, error } = await fetchAllRows(buildCompletedQuery);
            if (error) throw error;

            const completed = (recentEvents || []).filter(
                (ev) => getEventStatusInfo(ev.start_date, ev.end_date).label === 'Completed'
            );

            pagerGet('events-completed').page = 1;
            const paintCompleted = () => {
            const completedInfo = pagerSlice('events-completed', completed);
            listEl.innerHTML =
                completedInfo.total > 0
                    ? completedInfo.rows
                          .map((ev) => {
                              const clientName = ev.cases?.clients?.client_name || 'No Client';
                              return `
                            <div class="sd-card sd-clickable" onclick="openEventDetails('${ev.id}')" title="Click to view full event details">
                                ${sdIconTile('fa-check', 'green')}
                                <div class="sd-body">
                                    <div class="sd-name">${escapeHtml(ev.title)}</div>
                                    <div class="sd-sub"><i class="fa-regular fa-user"></i> ${escapeHtml(clientName)}</div>
                                    <div class="sd-chips">
                                        <span class="sd-chip"><i class="fa-regular fa-calendar"></i> ${formatDate(ev.start_date)}</span>
                                        <span class="sd-chip"><i class="fa-regular fa-clock"></i> ${formatEventTime(ev.start_date)}</span>
                                        ${ev.is_general ? '<span class="sd-chip purple">Firm-wide</span>' : ''}
                                    </div>
                                </div>
                                <i class="fa-solid fa-chevron-right sd-arrow"></i>
                            </div>
                        `;
                          })
                          .join('')
                    : '<p style="color:#64748b; text-align:center; padding:20px;">' +
                      (isAdminView ? 'No completed events found.' : 'No completed events in the last 60 days.') +
                      '</p>';
            listEl.insertAdjacentHTML(
                'beforeend',
                pagerHtml('events-completed', completedInfo, completedInfo.total === 1 ? 'event' : 'events')
            );
            };
            pagerBind('events-completed', paintCompleted, '');
            paintCompleted();
        } else if (type === 'clients') {
            const { clients } = await getActiveClientsData();
            const isAdminView = globalUserRole !== 'lawyer';

            listEl.innerHTML =
                clients.length > 0
                    ? clients
                          .map((cl) => {
                              const handledBy =
                                  isAdminView && cl.lawyerNames.size > 0
                                      ? `<div class="sd-chips">${Array.from(cl.lawyerNames)
                                            .map(
                                                (n) =>
                                                    `<span class="sd-chip"><i class="fa-solid fa-gavel"></i> Atty. ${escapeHtml(n)}</span>`
                                            )
                                            .join('')}</div>`
                                      : '';
                              return `
                            <div class="sd-card">
                                ${sdAvatar(cl.client_name || 'Client', null)}
                                <div class="sd-body">
                                    <div class="sd-name">${escapeHtml(cl.client_name || 'Unnamed Client')}</div>
                                    <div class="sd-sub"><i class="fa-regular fa-envelope"></i> ${escapeHtml(cl.client_email || 'No email on file')}</div>
                                    ${handledBy}
                                </div>
                            </div>
                        `;
                          })
                          .join('')
                    : '<p style="color:#64748b; text-align:center; padding:20px;">No active clients found.</p>';
        } else if (type === 'lawyers') {
            const lawyers = await getActiveLawyersData();

            const lawyerCards =
                lawyers.length > 0
                    ? lawyers
                          .map(
                              (l) => `
                        <div class="sd-card">
                            ${sdAvatar(l.full_name || 'Lawyer', l.avatar_url)}
                            <div class="sd-body">
                                <div class="sd-name">Atty. ${escapeHtml(l.full_name || 'Unnamed')}</div>
                                <div class="sd-sub"><i class="fa-solid fa-scale-balanced"></i> ${escapeHtml(l.specialization || 'General Practice')}</div>
                                ${l.phone ? `<div class="sd-chips"><span class="sd-chip"><i class="fa-solid fa-phone"></i> ${escapeHtml(l.phone)}</span></div>` : ''}
                            </div>
                            <span class="sd-status"><i></i> Active</span>
                        </div>
                    `
                          )
                          .join('')
                    : '<p style="color:#64748b; text-align:center; padding:20px;">No active lawyers found.</p>';

            listEl.innerHTML = `
                    ${lawyerCards}
                    <button onclick="document.getElementById('stat-details-modal').classList.add('hidden'); document.querySelector('.nav-links li[data-target=\\'manage-lawyers-view\\']').click();" class="sd-link-btn">
                        Manage Lawyers <i class="fa-solid fa-arrow-right"></i>
                    </button>
                `;
        }
        const sdNouns = { cases: 'active cases', completed: 'completed events', clients: 'active clients', lawyers: 'active lawyers' };
        const sdTotal = listEl.querySelectorAll('.sd-card').length;
        if (sdTotal > 0 && sdNouns[type]) {
            listEl.insertAdjacentHTML('afterbegin', `<div class="sd-count">${sdTotal} ${sdNouns[type]}</div>`);
        }
    } catch (error) {
        console.error('Error loading stat details:', error);
        listEl.innerHTML = errorStateHtml('Could not load the details.', null);
    }
};

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

    if (now >= end) return { label: 'Completed', color: '#16835d', bg: '#dff1e9', icon: 'fa-circle-check' };
    if (now >= start && now < end)
        return { label: 'Ongoing', color: '#b9811f', bg: '#f8edd2', icon: 'fa-hourglass-half' };
    return { label: 'Upcoming', color: '#2f65ad', bg: '#d7e5f6', icon: 'fa-clock' };
}

window.__eventResponses = window.__eventResponses || {};
window.__rsvpLawyers = window.__rsvpLawyers || [];

async function loadEventResponses(events) {
    const ids = (events || []).filter((e) => e.is_general).map((e) => e.id);
    if (ids.length === 0 || !currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from('event_responses')
            .select('event_id, lawyer_id, response, responded_at, profiles(full_name, avatar_url)')
            .in('event_id', ids);
        if (error) throw error;
        ids.forEach((id) => {
            window.__eventResponses[id] = [];
        });
        (data || []).forEach((row) => {
            if (window.__eventResponses[row.event_id]) window.__eventResponses[row.event_id].push(row);
        });
        if (globalRoleName !== 'lawyer') {
            window.__rsvpLawyers = await getActiveLawyersData();
        }
    } catch (err) {
        console.warn('Could not load event responses:', err.message || err);
    }
}

function rsvpInitials(name) {
    const parts = String(name || '')
        .replace(/^Atty\.?\s*/i, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function rsvpStatusPill(status) {
    if (status === 'attending')
        return '<span class="rsvp-pill green"><i class="fa-solid fa-circle-check"></i> Attending</span>';
    if (status === 'not_attending')
        return '<span class="rsvp-pill red"><i class="fa-solid fa-circle-xmark"></i> Not attending</span>';
    return '<span class="rsvp-pill amber"><i class="fa-regular fa-clock"></i> No response</span>';
}

function buildRsvpHtml(ev, statusInfo) {
    if (!ev.is_general || !currentUser) return '';
    const rows = window.__eventResponses[ev.id] || [];
    const isDone = statusInfo.label === 'Completed';

    if (globalRoleName === 'lawyer') {
        const mine = rows.find((r) => r.lawyer_id === currentUser.id);
        const current = mine ? mine.response : '';
        if (isDone && !mine) return '';

        const respondedAt =
            mine && mine.responded_at ? `${formatDate(mine.responded_at)}, ${formatEventTime(mine.responded_at)}` : '';
        const hint = isDone
            ? 'This event has ended.'
            : current
              ? `Answered ${respondedAt}. Tap the other option to change it.`
              : 'Let the firm know if you can make it.';

        const btn = (value, label, icon, cls) => {
            const active = current === value;
            return `<button type="button" class="rsvp-btn ${cls}${active ? ' is-active' : ''}" data-rsvp-event="${ev.id}" data-rsvp-value="${value}" aria-pressed="${active}"${isDone ? ' disabled' : ''}>
                <i class="fa-solid ${active ? 'fa-check' : icon}"></i><span>${label}</span></button>`;
        };

        return `
            <div class="rsvp-box">
                <div class="rsvp-head">
                    <div class="rsvp-title"><i class="fa-solid fa-calendar-check"></i> Your attendance</div>
                    ${rsvpStatusPill(current)}
                </div>
                <div class="rsvp-actions">
                    ${btn('attending', "I'll attend", 'fa-circle-check', 'attend')}
                    ${btn('not_attending', "Can't attend", 'fa-circle-xmark', 'decline')}
                </div>
                <div class="rsvp-hint">${hint}</div>
            </div>`;
    }

    const byLawyer = {};
    rows.forEach((r) => {
        byLawyer[r.lawyer_id] = r;
    });
    const people = [];
    const seen = new Set();
    (window.__rsvpLawyers || []).forEach((l) => {
        seen.add(l.id);
        const r = byLawyer[l.id];
        people.push({ name: `Atty. ${l.full_name || 'Unnamed'}`, status: r ? r.response : 'none', avatar: l.avatar_url || '' });
    });
    rows.forEach((r) => {
        if (seen.has(r.lawyer_id)) return;
        people.push({
            name: `Atty. ${(r.profiles && r.profiles.full_name) || 'Unnamed'}`,
            status: r.response,
            avatar: (r.profiles && r.profiles.avatar_url) || ''
        });
    });

    const order = { attending: 0, not_attending: 1, none: 2 };
    people.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));

    const total = people.length;
    const yes = people.filter((p) => p.status === 'attending').length;
    const no = people.filter((p) => p.status === 'not_attending').length;
    const pending = total - yes - no;
    const pct = (n) => (total ? (n / total) * 100 : 0);

    if (total === 0) {
        return `
            <div class="rsvp-box">
                <div class="rsvp-head"><div class="rsvp-title"><i class="fa-solid fa-users"></i> Lawyer responses</div></div>
                <div class="rsvp-hint">No active lawyers to respond yet.</div>
            </div>`;
    }

    return `
        <div class="rsvp-box">
            <div class="rsvp-head">
                <div class="rsvp-title"><i class="fa-solid fa-users"></i> Lawyer responses</div>
                <span class="rsvp-count">${yes + no} of ${total} responded</span>
            </div>
            <div class="rsvp-bar" role="img" aria-label="${yes} attending, ${no} not attending, ${pending} no response">
                <span class="green" style="width:${pct(yes)}%"></span>
                <span class="red" style="width:${pct(no)}%"></span>
            </div>
            <div class="rsvp-summary">
                <span class="green"><i></i>${yes} attending</span>
                <span class="red"><i></i>${no} not attending</span>
                <span class="amber"><i></i>${pending} no response</span>
            </div>
            <div class="rsvp-list">
                ${people
                    .map(
                        (p) => `
                    <div class="rsvp-row">
                        <span class="rsvp-avatar ${p.status}">${
                            p.avatar
                                ? `<img src="${escapeHtml(p.avatar)}" alt="" onerror="this.replaceWith(document.createTextNode(this.dataset.fallback))" data-fallback="${escapeHtml(rsvpInitials(p.name))}">`
                                : escapeHtml(rsvpInitials(p.name))
                        }</span>
                        <span class="rsvp-name">${escapeHtml(p.name)}</span>
                        ${rsvpStatusPill(p.status)}
                    </div>`
                    )
                    .join('')}
            </div>
        </div>`;
}

async function submitEventResponse(eventId, value, btn) {
    if (!currentUser || globalRoleName !== 'lawyer') return;
    if (value !== 'attending' && value !== 'not_attending') return;
    const ev = (window.__openModalEvents || []).find((e) => String(e.id) === String(eventId));
    if (!ev || !ev.is_general) return;

    const holder = btn.parentElement;
    const buttons = holder ? holder.querySelectorAll('button') : [btn];
    buttons.forEach((b) => {
        b.disabled = true;
    });

    try {
        const row = {
            event_id: eventId,
            lawyer_id: currentUser.id,
            response: value,
            responded_at: new Date().toISOString()
        };
        const { error } = await supabaseClient.from('event_responses').upsert(row, { onConflict: 'event_id,lawyer_id' });
        if (error) throw error;

        const list = (window.__eventResponses[eventId] || []).filter((r) => r.lawyer_id !== currentUser.id);
        list.push(row);
        window.__eventResponses[eventId] = list;

        const listEl = document.getElementById('day-details-list');
        if (listEl) listEl.innerHTML = window.__openModalEvents.map(buildEventDetailCard).join('');
        showToast(
            value === 'attending' ? `You will attend "${ev.title}".` : `You will not attend "${ev.title}".`,
            'success'
        );
    } catch (err) {
        console.error('Could not save response:', err);
        showToast('Could not save your response: ' + (err.message || 'unknown error'), 'error');
        buttons.forEach((b) => {
            b.disabled = false;
        });
    }
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rsvp-event]');
    if (!btn) return;
    submitEventResponse(btn.getAttribute('data-rsvp-event'), btn.getAttribute('data-rsvp-value'), btn);
});

function buildEventDetailCard(ev) {
    const lawyerName = ev.is_general ? 'All Lawyers' : ev.profiles?.full_name || 'Unassigned';
    const clientName = ev.cases?.clients?.client_name || 'No Client';
    const statusInfo = getEventStatusInfo(ev.start_date, ev.end_date);
    const isDone = statusInfo.label === 'Completed';
    const borderColor = ev.is_conflict ? '#d64545' : ev.is_general ? '#3d5a80' : '#3976c5';
    const bgColor = ev.is_conflict ? '#fbeeee' : ev.is_general ? '#f5f3ff' : '#f7f5f0';
    const conflictStyle = `border-left: 4px solid ${borderColor}; background: ${bgColor}; ${isDone ? 'opacity: 0.65;' : ''}`;
    const priorityBadge = ev.priority === 'high' ? '<span class="badge-pill bg-red"><i class="fa-solid fa-star"></i> High Priority</span>' : '';
    const generalBadge = ev.is_general
        ? '<span style="background:#e6ecf4; color:#3d5a80; font-size:12px; padding:2px 10px; border-radius:99px; margin-left:8px;">Firm-wide</span>'
        : '';
    const statusBadge = `<span style="background:${statusInfo.bg}; color:${statusInfo.color}; font-size:12px; padding:2px 10px; border-radius:99px; margin-left:8px; font-weight:600;"><i class="fa-solid ${statusInfo.icon}" style="margin-right:4px;"></i>${statusInfo.label}</span>`;

    let caseDetailsHtml = '';
    if (ev.cases) {
        caseDetailsHtml = `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e1d8; font-size: 12px;">
                    <div style="display:flex; gap: 15px; margin-bottom: 6px;">
                        <span style="color:#4f5b6d;"><strong>Case No:</strong> ${escapeHtml(ev.cases.case_number || 'N/A')}</span>
                        <span style="color:#4f5b6d;"><strong>Type:</strong> ${escapeHtml(ev.cases.case_type || 'N/A')}</span>
                    </div>
                    <p style="color:#64748b; margin:0; line-height: 1.4;"><em>"${escapeHtml(ev.cases.case_description || 'No description provided.')}"</em></p>
                </div>
            `;
    }

    let attachmentHtml = '';
    if (ev.documents) {
        attachmentHtml = `
                <div style="margin-top: 10px;">
                    <a href="#" data-doc-path="${escapeHtml(ev.documents.file_path || '')}" data-doc-title="${escapeHtml(ev.documents.title || '')}" style="font-size:12px; color:#3976c5; text-decoration:none;">
                        <i class="fa-solid fa-paperclip"></i> ${escapeHtml(ev.documents.title)}
                    </a>
                </div>
            `;
    }

    const rescheduleHtml =
        statusInfo.label === 'Upcoming' && canRescheduleEvent(ev)
            ? `<div style="margin-top: 12px; display: flex; justify-content: flex-end;"><button type="button" class="ct-text-btn ct-blue" data-reschedule-id="${ev.id}"><i class="fa-solid fa-calendar-days"></i> Reschedule</button></div>`
            : '';

    const rsvpHtml = buildRsvpHtml(ev, statusInfo);

    return `
            <div style="${conflictStyle} border-radius: 8px; padding: 15px; border-top: 1px solid #e5e1d8; border-right: 1px solid #e5e1d8; border-bottom: 1px solid #e5e1d8; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
                    <h4 style="margin:0; font-size:16px; color:#101b2d;">${escapeHtml(ev.title)} ${priorityBadge} ${generalBadge} ${statusBadge}</h4>
                    <span style="font-weight:600; color:#3976c5; font-size:14px;">${formatEventRange(ev.start_date, ev.end_date)}</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; font-size:13px; color:#4f5b6d;">
                    <span><i class="fa-solid fa-location-dot" style="width:16px; color:#64748b;"></i> ${escapeHtml(ev.location || 'Office')}</span>
                    <span><i class="fa-solid fa-user" style="width:16px; color:#64748b;"></i> Client: <strong>${escapeHtml(clientName)}</strong></span>
                    <span><i class="fa-solid fa-gavel" style="width:16px; color:#64748b;"></i> ${ev.is_general ? '<strong>All Lawyers</strong>' : `Atty. ${escapeHtml(lawyerName)}`}</span>
                </div>
                ${caseDetailsHtml}
                ${attachmentHtml}
                ${rescheduleHtml}
                ${rsvpHtml}
            </div>
        `;
}

function canRescheduleEvent(ev) {
    if (!currentUser || !ev) return false;
    if (globalRoleName === 'admin') return true;
    return globalRoleName === 'lawyer' && !ev.is_general && ev.assigned_to === currentUser.id;
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

async function findRescheduleConflict(ev, startISO, endISO, dateVal) {
    const duration = new Date(endISO) - new Date(startISO);
    const start = new Date(startISO);
    const rangeStart = new Date(start.getTime() - duration + 1000).toISOString();
    const rangeEnd = new Date(start.getTime() + duration - 1000).toISOString();

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
            .select(
                'id, title, start_date, end_date, location, assigned_to, is_general, client_id, priority, case_id, document_id, documents(title)'
            )
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

    let cases = [];
    try {
        cases = await loadCaseOptions();
    } catch (e) {
        console.error('Failed to load cases', e);
    }

    const existing = document.getElementById('reschedule-modal');
    if (existing) existing.remove();

    const oldStart = new Date(ev.start_date);
    const todayKey = toLocalDateKey(new Date());

    let oldEndHtml = '';
    let oldEndTimeHtml = '';
    if (ev.end_date) {
        const oldEnd = new Date(ev.end_date);
        oldEndHtml = `value="${toLocalDateKey(oldEnd)}"`;
        oldEndTimeHtml = `value="${pad2(oldEnd.getHours())}:${pad2(oldEnd.getMinutes())}"`;
    }

    const overlay = document.createElement('div');
    overlay.id = 'reschedule-modal';
    overlay.className = 'modal-overlay';

    const isHighPriority = ev.priority === 'high';
    const priorityOptions = `
            <option value="normal" ${!isHighPriority ? 'selected' : ''}>Normal</option>
            <option value="high" ${isHighPriority ? 'selected' : ''}>High Priority</option>
        `;

    const standardLocations = ['Conference Room A', 'Conference Room B'];
    let locOptions = '<option value="">Select location</option>';
    let locFound = false;
    standardLocations.forEach((loc) => {
        const isSelected = (ev.location || '') === loc;
        if (isSelected) locFound = true;
        locOptions += `<option value="${loc}" ${isSelected ? 'selected' : ''}>${loc}</option>`;
    });
    locOptions += `<option value="other" ${!locFound && ev.location ? 'selected' : ''}>Others (type below)</option>`;

    const caseOpts = caseOptionsHtml(cases, ev.case_id);
    const existingDocTitle = ev.documents ? escapeHtml(ev.documents.title) : '';

    overlay.innerHTML = `
            <div class="modal-content mc-modal rs-modal">
                <div class="modal-header mc-modal-head rs-head">
                    <span class="rs-head-icon"><i class="fa-solid fa-calendar-check"></i></span>
                    <div class="rs-head-text">
                        <h2>Reschedule & Edit event</h2>
                        <p class="rs-event-title">${escapeHtml(ev.title)}</p>
                        <p class="rs-current"><i class="fa-regular fa-clock"></i> Currently ${formatDate(ev.start_date)}, ${formatEventTime(ev.start_date)}</p>
                    </div>
                    <button type="button" class="btn-close" data-rs-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <form class="mc-form rs-form" id="reschedule-form" autocomplete="off">
                    <div class="rs-body">
                        <section class="rs-section">
                            <div class="rs-section-title"><i class="fa-regular fa-calendar"></i> Schedule</div>
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
                                    <input type="date" id="rs-end-date" min="${todayKey}" ${oldEndHtml}>
                                </div>
                                <div class="mc-field">
                                    <label for="rs-end-time">End time <span class="mc-optional">(optional)</span></label>
                                    <input type="time" id="rs-end-time" ${oldEndTimeHtml}>
                                </div>
                            </div>
                            <p class="rs-note"><i class="fa-solid fa-circle-info"></i> Clear the end date/time to keep the default 1-hour duration.</p>
                        </section>

                        <section class="rs-section">
                            <div class="rs-section-title"><i class="fa-solid fa-sliders"></i> Details</div>
                            <div class="mc-row">
                                <div class="mc-field">
                                    <label for="rs-priority">Priority</label>
                                    <select id="rs-priority">
                                        ${priorityOptions}
                                    </select>
                                </div>
                                <div class="mc-field">
                                    <label for="rs-location">Location</label>
                                    <select id="rs-location">
                                        ${locOptions}
                                    </select>
                                    <input type="text" id="rs-location-custom" class="rs-custom-location" style="display:${!locFound && ev.location ? 'block' : 'none'};" placeholder="Type custom location..." value="${!locFound && ev.location ? escapeHtml(ev.location) : ''}">
                                </div>
                            </div>
                            <div class="mc-row">
                                <div class="mc-field">
                                    <label for="rs-case">Linked Case <span class="mc-optional">(optional)</span></label>
                                    <select id="rs-case">
                                        ${caseOpts}
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section class="rs-section">
                            <div class="rs-section-title"><i class="fa-solid fa-paperclip"></i> Attachment <span class="mc-optional">(optional)</span></div>
                            <div id="rs-existing-attachment" class="rs-existing" style="display:${ev.document_id ? 'flex' : 'none'};">
                                <span class="rs-existing-label"><i class="fa-solid fa-file-lines"></i><span id="rs-existing-name">${existingDocTitle}</span></span>
                                <button type="button" id="rs-remove-existing-doc" class="rs-chip-btn" title="Remove attachment"><i class="fa-solid fa-xmark"></i> Remove</button>
                            </div>
                            <input type="hidden" id="rs-remove-doc-flag" value="false">
                            <div id="rs-new-attachment-wrap" style="display:${ev.document_id ? 'none' : 'block'};">
                                <div class="mc-field">
                                    <label for="rs-attachment">Attach file</label>
                                    <input type="file" id="rs-attachment" accept=".pdf,.docx,.jpg,.jpeg,.png,.txt">
                                </div>
                                <div class="mc-field rs-name-field">
                                    <label for="rs-attachment-name">File name</label>
                                    <div class="rs-name-wrap">
                                        <input type="text" id="rs-attachment-name" placeholder="Auto-fills when you choose a file (you can edit it)">
                                        <button type="button" id="rs-attach-clear" class="rs-chip-btn rs-clear" style="display:none;"><i class="fa-solid fa-xmark"></i> Remove</button>
                                    </div>
                                </div>
                                <p class="rs-note"><i class="fa-solid fa-circle-info"></i> Saved to Documents and linked to this event/case. ${ev.document_id ? 'Uploading a new file overrides the current attachment.' : ''}</p>
                            </div>
                        </section>
                    </div>
                    <div class="rs-footer">
                        <button type="button" id="rs-remove-btn" class="rs-danger"><i class="fa-solid fa-trash"></i> Remove schedule</button>
                        <button type="submit" class="mc-submit rs-save"><i class="fa-solid fa-check"></i> Save changes</button>
                    </div>
                </form>
            </div>`;
    document.body.appendChild(overlay);

    const close = () => {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay) close();
    });
    overlay.querySelector('[data-rs-close]').addEventListener('click', close);

    const removeExistingBtn = overlay.querySelector('#rs-remove-existing-doc');
    const existingWrap = overlay.querySelector('#rs-existing-attachment');
    const newWrap = overlay.querySelector('#rs-new-attachment-wrap');
    const removeFlag = overlay.querySelector('#rs-remove-doc-flag');

    if (removeExistingBtn) {
        removeExistingBtn.addEventListener('click', () => {
            removeFlag.value = 'true';
            existingWrap.style.display = 'none';
            newWrap.style.display = 'block';
        });
    }

    const attachInput = overlay.querySelector('#rs-attachment');
    const attachNameInput = overlay.querySelector('#rs-attachment-name');
    const attachClearBtn = overlay.querySelector('#rs-attach-clear');

    if (attachInput && attachNameInput && attachClearBtn) {
        attachInput.addEventListener('change', () => {
            const hasFile = attachInput.files.length > 0;
            attachNameInput.value = hasFile ? attachInput.files[0].name : '';
            attachClearBtn.style.display = hasFile ? 'block' : 'none';
        });

        attachClearBtn.addEventListener('click', () => {
            attachInput.value = '';
            attachNameInput.value = '';
            attachClearBtn.style.display = 'none';
        });
    }

    overlay.querySelector('#rs-remove-btn').addEventListener('click', async () => {
        if (
            !(await confirmDialog({
                title: 'Remove Schedule',
                confirmLabel: 'Remove',
                danger: true,
                message: 'Are you sure you want to completely remove this event from the schedule?'
            }))
        )
            return;

        try {
            const { error } = await supabaseClient.from('calendar_events').delete().eq('id', ev.id);
            if (error) throw error;

            await logAuditActivity('DELETE', 'calendar_events', `Deleted event: ${ev.title}`, ev.id, ev, null);

            showToast('Schedule removed successfully.', 'success');
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
            console.error('Failed to remove schedule:', err);
            showToast('Could not remove schedule: ' + err.message, 'error');
        }
    });

    const rsLoc = overlay.querySelector('#rs-location');
    const rsLocCustom = overlay.querySelector('#rs-location-custom');
    rsLoc.addEventListener('change', () => {
        if (rsLoc.value === 'other') {
            rsLocCustom.style.display = 'block';
            rsLocCustom.required = true;
        } else {
            rsLocCustom.style.display = 'none';
            rsLocCustom.required = false;
        }
    });

    const form = overlay.querySelector('#reschedule-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const val = (id) => (overlay.querySelector('#' + id)?.value || '').trim();
        const dateVal = val('rs-date');
        const timeVal = val('rs-time');
        const endDateVal = val('rs-end-date');
        const endTimeVal = val('rs-end-time');

        const locationSelectVal = val('rs-location');
        let locationVal = locationSelectVal;
        if (locationSelectVal === 'other') {
            locationVal = val('rs-location-custom');
            if (!locationVal) {
                showToast('Please type the custom location.', 'warning');
                return;
            }
        }

        const priorityVal = val('rs-priority');
        const caseSel = overlay.querySelector('#rs-case');
        const caseIdVal = caseSel.value || null;

        const opt = caseSel.selectedOptions[0];
        const clientIdVal = caseIdVal && opt && opt.dataset.clientId ? Number(opt.dataset.clientId) : null;

        const submitBtn = form.querySelector('button[type="submit"]');
        const idle = submitBtn.textContent;

        if (!dateVal || !timeVal) {
            showToast('Please choose the new date and start time.', 'warning');
            return;
        }

        const startISO = combineDateAndTime(dateVal, timeVal);
        if (dateVal < todayKey) {
            showToast("You can't schedule an event to a past date.", 'warning');
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

        const testConflictEv = { ...ev, location: locationVal, client_id: clientIdVal };

        submitBtn.disabled = true;
        submitBtn.textContent = 'Checking...';
        try {
            const conflict = await findRescheduleConflict(testConflictEv, startISO, endISO, dateVal);
            if (conflict) {
                showToast('Cannot reschedule: ' + conflict, 'warning', { duration: 10000 });
                return;
            }

            submitBtn.textContent = 'Saving...';

            const patch = {
                start_date: startISO,
                end_date: endISO,
                location: locationVal,
                priority: priorityVal,
                case_id: caseIdVal,
                client_id: clientIdVal
            };

            const isDocRemoved = removeFlag && removeFlag.value === 'true';
            const attachmentFile = attachInput && attachInput.files.length > 0 ? attachInput.files[0] : null;

            if (attachmentFile) {
                submitBtn.textContent = 'Uploading attachment...';
                const attachedDoc = await uploadCaseDocument(attachmentFile, {
                    caseId: caseIdVal,
                    clientId: clientIdVal,
                    category: 'Event Attachment',
                    title: resolveDocumentTitle(attachNameInput?.value, attachmentFile)
                });
                if (attachedDoc) patch.document_id = attachedDoc.id;
            } else if (isDocRemoved) {
                patch.document_id = null;
            }

            const { data: updated, error } = await supabaseClient
                .from('calendar_events')
                .update(patch)
                .eq('id', ev.id)
                .select('id');

            if (error) throw error;
            if (!updated || updated.length === 0) {
                throw new Error('The event was not updated. You may not have permission to change it.');
            }

            await logAuditActivity(
                'RESCHEDULE',
                'calendar_events',
                `Rescheduled & updated event: ${ev.title} to ${formatDate(startISO)}, ${formatEventTime(startISO)}`,
                ev.id,
                {
                    start_date: ev.start_date,
                    end_date: ev.end_date,
                    location: ev.location,
                    priority: ev.priority,
                    case_id: ev.case_id
                },
                patch
            );

            showToast(`"${ev.title}" was updated successfully.`, 'success');
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
            showToast('Could not save changes: ' + err.message, 'error');
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

window.openDayDetails = async function (dateString) {
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
            .select(
                '*, profiles(full_name), cases(case_number, case_type, case_description, clients(client_name)), documents(title, file_path)'
            )
            .gte('start_date', dayStart)
            .lte('start_date', dayEnd)
            .order('start_date', { ascending: true });

        if (globalUserRole === 'lawyer' && currentUser) {
            eventsQuery = eventsQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
        }

        const { data: events, error } = await eventsQuery;

        if (error) throw error;

        window.__openModalEvents = events || [];
        await loadEventResponses(events);

        if (events && events.length > 0) {
            let html = '';
            for (const ev of events) {
                html += buildEventDetailCard(ev);
            }

            if (html === '') {
                listEl.innerHTML =
                    '<p style="color:#64748b; text-align:center; padding:30px;">No events scheduled for this day.</p>';
            } else {
                listEl.innerHTML = html;
            }
        } else {
            listEl.innerHTML =
                '<p style="color:#64748b; text-align:center; padding:30px;">No events scheduled for this day.</p>';
        }
    } catch (error) {
        console.error('Error fetching day details:', error);
        listEl.innerHTML = errorStateHtml('Could not load the events for this day.', null);
    }
};

window.openEventDetails = async function (eventId) {
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
            .select(
                '*, profiles(full_name), cases(case_number, case_type, case_description, clients(client_name)), documents(title, file_path)'
            )
            .eq('id', eventId)
            .single();

        if (error) throw error;

        window.__openModalEvents = ev ? [ev] : [];
        if (ev) await loadEventResponses([ev]);
        titleEl.textContent = ev.title || 'Event Details';
        listEl.innerHTML = ev
            ? buildEventDetailCard(ev)
            : '<p style="color:#64748b; text-align:center; padding:30px;">Event not found.</p>';
    } catch (error) {
        console.error('Error fetching event details:', error);
        listEl.innerHTML = errorStateHtml('Could not load this event.', null);
    }
};

async function renderScheduleSummaryWidget() {
    const summaryWidget = document.getElementById('widget-schedule-summary');
    if (!summaryWidget) return;

    const titleEl = document.getElementById('schedule-summary-title');
    const isLawyerView = globalUserRole === 'lawyer' && currentUser;

    try {
        const pad = (n) => String(n).padStart(2, '0');
        const startDate = `${currentYear}-${pad(currentMonth + 1)}-01`;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const endDate = `${currentYear}-${pad(currentMonth + 1)}-${pad(daysInMonth)}T23:59:59`;
        const monthLabel = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

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

        const timeRange = (ev) => {
            const start = formatEventTime(ev.start_date);
            const end = ev.end_date ? formatEventTime(ev.end_date) : '';
            return end ? `${start} - ${end}` : start;
        };

        if (isLawyerView) {
            const rows = events
                .map(
                    (ev) => `
                    <div style="padding:13px 0; border-bottom:1px solid #eeebe3;">
                        <div style="font-size:14.5px; font-weight:600; color:#252d3a;">${escapeHtml(ev.title)}</div>
                        <div style="font-size:12.5px; color:#64748b; margin-top:3px;">${escapeHtml(formatDate(ev.start_date))} &middot; ${escapeHtml(timeRange(ev))}</div>
                    </div>
                `
                )
                .join('');
            summaryWidget.innerHTML = `
                    <div style="font-size:12.5px; color:#64748b; margin-bottom:8px;">${escapeHtml(monthLabel)} &middot; ${events.length} event${events.length === 1 ? '' : 's'}</div>
                    <div style="">${rows}</div>
                `;
            return;
        }

        const rows = events
            .map((ev) => {
                const lawyerName = ev.profiles?.full_name
                    ? 'Atty. ' + ev.profiles.full_name
                    : ev.is_general
                      ? 'Firm-wide'
                      : 'Unassigned';
                return `
                    <tr>
                        <td style="padding:13px 8px; border-bottom:1px solid #e5e1d8; line-height:1.45; font-weight:600; color:#252d3a; vertical-align:top;">${escapeHtml(lawyerName)}</td>
                        <td style="padding:13px 8px; border-bottom:1px solid #e5e1d8; line-height:1.45; color:#4f5b6d; white-space:nowrap; vertical-align:top;">${escapeHtml(formatDate(ev.start_date))}<br><span style="color:#64748b;">${escapeHtml(timeRange(ev))}</span></td>
                        <td style="padding:13px 8px; border-bottom:1px solid #e5e1d8; line-height:1.45; color:#3b4656; vertical-align:top;">${escapeHtml(ev.title)}</td>
                    </tr>
                `;
            })
            .join('');

        summaryWidget.innerHTML = `
                <div style="font-size:12.5px; color:#64748b; margin-bottom:10px;">${escapeHtml(monthLabel)} &middot; ${events.length} scheduled event${events.length === 1 ? '' : 's'}</div>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:13.5px; text-align:left;">
                        <thead>
                            <tr style="background:#f7f5f0;">
                                <th style="padding:10px 8px; border-bottom:2px solid #d5cfc2; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:#4f5b6d;">Lawyer</th>
                                <th style="padding:10px 8px; border-bottom:2px solid #d5cfc2; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:#4f5b6d;">Date &amp; Time</th>
                                <th style="padding:10px 8px; border-bottom:2px solid #d5cfc2; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:#4f5b6d;">Event</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
    } catch (error) {
        console.error('Error rendering schedule summary:', error);
        summaryWidget.innerHTML = errorStateHtml('Could not load the schedule summary.', 'renderScheduleSummaryWidget');
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

        if (!lawyers) return;

        const localDate = new Date();
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        const { startISO: todayStart, endISO: todayEnd } = getDayRange(todayStr);

        const earliestStart = new Date(new Date(todayStart).getTime() - 24 * 60 * 60 * 1000).toISOString();
        const { data: todaysEvents } = await supabaseClient
            .from('calendar_events')
            .select('assigned_to, title, is_general, start_date, end_date')
            .gte('start_date', earliestStart)
            .lte('start_date', todayEnd);

        const lawyerEventMap = {};
        if (todaysEvents) {
            todaysEvents
                .filter((ev) => isEventOngoing(ev.start_date, ev.end_date))
                .forEach((ev) => {
                    if (ev.is_general) {
                        lawyers.forEach((l) => {
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

        const availableLawyers = lawyers.filter((l) => !lawyerEventMap[l.id]);

        if (availableLawyers.length === 0) {
            lawyerList.innerHTML =
                '<li style="padding:10px 0; font-size:13px; color:#64748b;">No lawyers are available right now.</li>';
            return;
        }

        lawyerList.innerHTML = availableLawyers
            .map(
                (l) => `
                    <li style="padding:10px 0; border-bottom:1px solid #eeebe3; font-size:13px;">
                        <span>Atty. ${escapeHtml(l.full_name || 'Unknown')}</span>
                    </li>
                `
            )
            .join('');
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
    const base = oldExt ? String(oldTitle).slice(0, String(oldTitle).length - oldExt.length) : oldTitle || file.name;
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
    return String(text || '')
        .replace(/\u0000/g, '')
        .slice(0, OCR_MAX_CHARS);
}

function showIndexProgress(message) {
    let el = document.getElementById('index-progress');
    if (!el) {
        el = document.createElement('div');
        el.id = 'index-progress';
        el.style.cssText =
            'position:fixed; right:20px; bottom:20px; z-index:10002; background:#101b2d; color:#ffffff; padding:12px 16px; border-radius:10px; font-size:12px; box-shadow:0 8px 20px rgba(0,0,0,0.2); max-width:320px;';
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
                let pageText = content.items
                    .map((item) => item.str)
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();

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

window.indexExistingDocument = async function (docId, quiet) {
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

window.indexAllPendingDocuments = async function () {
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

    const pending = (data || []).filter((d) => fileKind(d.title));
    if (pending.length === 0) {
        showToast('Every document that can be indexed is already searchable.', 'info');
        return;
    }
    if (
        !(await confirmDialog({
            title: 'Make documents searchable',
            confirmLabel: 'Start indexing',
            message: `Index ${pending.length} document${pending.length === 1 ? '' : 's'}? Each file is read in your browser, which can take several minutes. Keep this tab open.`
        }))
    )
        return;

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
    return (
        '<option value="">No case (general document)</option>' +
        cases
            .map(
                (c) =>
                    `<option value="${escapeHtml(c.id)}" data-client-id="${escapeHtml(c.client_id || '')}"${c.id === selectedId ? ' selected' : ''}>${escapeHtml((c.case_number ? c.case_number + ' — ' : '') + (c.title || 'Untitled case'))}</option>`
            )
            .join('')
    );
}

function docFieldLabel(text) {
    return `<label style="display:block; font-size:13px; font-weight:600; color:#101b2d; margin-bottom:6px;">${text}</label>`;
}

const DOC_INPUT_STYLE =
    'width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #d5cfc2; border-radius:6px; font-family:inherit; background:#f7f5f0; margin-bottom:14px;';

window.openEditDocumentModal = async function (docId) {
    const doc = (window.__docsRegistry || {})[docId];
    if (!doc) return;

    const modal = openUserModal(
        'Edit document details',
        escapeHtml(doc.title || ''),
        '<p style="color:#64748b; text-align:center; padding:20px;">Loading...</p>'
    );
    try {
        const cases = await loadCaseOptions();
        const categoryHtml = document.getElementById('doc-category')
            ? document.getElementById('doc-category').innerHTML
            : '';

        modal.body.innerHTML = `
                ${docFieldLabel('File name')}
                <input type="text" id="ed-title" maxlength="200" value="${escapeHtml(doc.title || '')}" style="${DOC_INPUT_STYLE}">
                ${docFieldLabel('Category')}
                <select id="ed-category" style="${DOC_INPUT_STYLE}">${categoryHtml}</select>
                ${docFieldLabel('Tags <span style="font-weight:400; color:#64748b;">(comma-separated)</span>')}
                <input type="text" id="ed-tags" value="${escapeHtml(doc.tags || '')}" placeholder="e.g., motion, criminal, dismissal" style="${DOC_INPUT_STYLE}">
                ${docFieldLabel('Case')}
                <select id="ed-case" style="${DOC_INPUT_STYLE}">${caseOptionsHtml(cases, doc.case_id)}</select>
                ${modalButtonsHtml('Save changes', '#101b2d')}
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
            if (patch.title !== doc.title) {
                const nameProblem = fileNameProblem(patch.title);
                if (nameProblem) {
                    errEl.textContent = nameProblem;
                    return;
                }
            }
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
                errEl.textContent = error
                    ? error.message
                    : 'Nothing was saved. You may not have permission to edit this document.';
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

window.openNewVersionModal = function (docId) {
    const doc = (window.__docsRegistry || {})[docId];
    if (!doc) return;

    const modal = openUserModal(
        'Upload a new version',
        escapeHtml(doc.title || ''),
        `
            <p style="font-size:13px; color:#4f5b6d; margin:0 0 14px 0;">The current file (version ${doc.version_no || 1}) is kept in the version history. You can restore it at any time.</p>
            ${docFieldLabel('New file')}
            <input type="file" id="nv-file" accept=".pdf,.docx,.jpg,.jpeg,.png,.txt" style="${DOC_INPUT_STYLE}">
            ${docFieldLabel('What changed? <span style="font-weight:400; color:#64748b;">(optional)</span>')}
            <input type="text" id="nv-note" maxlength="200" placeholder="e.g., Signed copy from the client" style="${DOC_INPUT_STYLE}">
            ${modalButtonsHtml('Upload version', '#101b2d')}
        `
    );

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
        const blockedReason = await validateUploadFile(file);
        if (blockedReason) {
            errEl.textContent = blockedReason;
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

window.openDocumentHistory = async function (docId) {
    const doc = (window.__docsRegistry || {})[docId];
    if (!doc) return;

    const canVersion = isStaffUser() || doc.uploaded_by === currentUser.id || !!doc.case_id;
    const modal = openUserModal(
        'Version history',
        escapeHtml(doc.title || ''),
        '<p style="color:#64748b; text-align:center; padding:20px;">Loading versions...</p>'
    );

    try {
        const { data: versions, error } = await supabaseClient
            .from('document_versions')
            .select('id, version_no, file_path, size, title, uploaded_by, uploaded_at, change_note')
            .eq('document_id', docId)
            .order('version_no', { ascending: false });
        if (error) throw error;

        const currentBy = doc.version_uploaded_by || doc.uploaded_by;
        const names = await fetchProfileNameMap([currentBy, ...(versions || []).map((v) => v.uploaded_by)]);

        const items = [
            {
                id: null,
                version_no: doc.version_no || 1,
                file_path: doc.file_path,
                size: doc.size,
                title: doc.title,
                by: names[currentBy] || 'Unknown',
                uploaded_at: doc.version_uploaded_at || doc.created_at,
                note: doc.version_note,
                current: true
            }
        ].concat(
            (versions || []).map((v) => ({
                id: v.id,
                version_no: v.version_no,
                file_path: v.file_path,
                size: v.size,
                title: v.title,
                by: names[v.uploaded_by] || 'Unknown',
                uploaded_at: v.uploaded_at,
                note: v.change_note,
                current: false
            }))
        );

        modal.body.innerHTML =
            items
                .map(
                    (v) => `
                <div style="border:1px solid ${v.current ? '#d7e5f6' : '#e5e1d8'}; background:${v.current ? '#eaf1fa' : '#ffffff'}; border-radius:10px; padding:12px 14px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <strong style="font-size:13px; color:#101b2d;">Version ${v.version_no}${v.current ? ' <span style="background:#d7e5f6; color:#285791; font-size:12px; padding:2px 8px; border-radius:99px; margin-left:6px;">Current</span>' : ''}</strong>
                        <span style="font-size:12px; color:#64748b;">${escapeHtml(v.size || '')}</span>
                    </div>
                    <p style="font-size:12px; color:#64748b; margin:4px 0 0 0;">${escapeHtml(formatStamp(v.uploaded_at))} by ${escapeHtml(v.by)}</p>
                    ${v.note ? `<p style="font-size:12px; color:#3b4656; margin:6px 0 0 0;">${escapeHtml(v.note)}</p>` : ''}
                    <div style="display:flex; gap:8px; margin-top:10px;">
                        ${
                            v.file_path
                                ? `
                            <button type="button" data-vh-action="view" data-path="${escapeHtml(v.file_path)}" data-title="${escapeHtml(v.title || 'document')}" class="doc-small-btn"><i class="fa-regular fa-eye"></i> View</button>
                            <button type="button" data-vh-action="download" data-path="${escapeHtml(v.file_path)}" data-title="${escapeHtml(v.title || 'document')}" class="doc-small-btn"><i class="fa-solid fa-download"></i> Download</button>`
                                : ''
                        }
                        ${!v.current && canVersion ? `<button type="button" data-vh-action="restore" data-id="${escapeHtml(v.id)}" data-no="${v.version_no}" class="doc-small-btn" style="color:#3976c5;"><i class="fa-solid fa-rotate-left"></i> Restore</button>` : ''}
                    </div>
                </div>
            `
                )
                .join('') +
            ((versions || []).length === 0
                ? '<p style="font-size:12px; color:#64748b; text-align:center; margin:8px 0 0 0;">No earlier versions yet.</p>'
                : '');

        modal.body.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-vh-action]');
            if (!btn) return;
            const action = btn.dataset.vhAction;

            if (action === 'view') {
                window.openStoredDocument(btn.dataset.path, btn.dataset.title, false);
            } else if (action === 'download') {
                window.openStoredDocument(btn.dataset.path, btn.dataset.title, true);
            } else if (action === 'restore') {
                if (
                    !(await confirmDialog({
                        title: 'Restore this version',
                        confirmLabel: 'Restore',
                        message: `Make version ${btn.dataset.no} the current version? The current file stays in the history.`
                    }))
                )
                    return;
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
        modal.body.innerHTML = errorStateHtml('Could not load the version history.', null);
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
        btn.style.cssText =
            'padding:8px 14px; border:1px solid var(--border-soft); background:var(--surface); border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; color:var(--text-main);';
        btn.addEventListener('click', () => window.indexAllPendingDocuments());
        meta.appendChild(btn);
    }
}

function safeStorageName(name) {
    const cleaned = String(name || 'file')
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '_')
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

window.openStoredDocument = async function (path, title, asDownload) {
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

const BLOCKED_UPLOAD_EXTENSIONS = new Set([
    'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'dll', 'jar', 'vbs', 'vbe', 'ps1', 'sh', 'apk', 'app', 'pif', 'cpl', 'msc', 'reg', 'lnk', 'hta', 'wsf', 'bin',
    'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'tbz2', 'xz', 'lz', 'lzma', 'z', 'cab', 'iso', 'dmg', 'zst'
]);

const ZIP_BASED_OK = /\.(docx|xlsx|pptx|odt|ods)$/i;
const FILE_NAME_ALLOWED = /^[A-Za-z0-9._-]+$/;

async function hasBlockedSignature(file) {
    try {
        const buf = new Uint8Array(await file.slice(0, 8).arrayBuffer());
        const starts = (...bytes) => bytes.every((b, i) => buf[i] === b);
        if (starts(0x4d, 0x5a)) return true;
        if (starts(0x7f, 0x45, 0x4c, 0x46)) return true;
        if (starts(0x52, 0x61, 0x72, 0x21)) return true;
        if (starts(0x37, 0x7a, 0xbc, 0xaf)) return true;
        if (starts(0x1f, 0x8b)) return true;
        if (starts(0x42, 0x5a, 0x68)) return true;
        if (starts(0xfd, 0x37, 0x7a, 0x58, 0x5a)) return true;
        if (starts(0x50, 0x4b, 0x03, 0x04) && !ZIP_BASED_OK.test(file.name || '')) return true;
    } catch (e) {
        console.warn('Could not inspect file signature:', e);
    }
    return false;
}

async function validateUploadFile(file) {
    if (!file) return '';
    const name = String(file.name || '');
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    const refusal = `"${name}" can't be uploaded. Executable files (.exe, .msi, .bat and similar) and compressed files (.zip, .rar, .7z and similar) are not allowed.`;
    if (BLOCKED_UPLOAD_EXTENSIONS.has(ext)) return refusal;
    if (await hasBlockedSignature(file)) return refusal;
    return '';
}

function fileNameProblem(name) {
    const value = String(name || '').trim();
    if (!value) return 'Enter a file name.';
    if (!FILE_NAME_ALLOWED.test(value)) {
        return 'File names can only contain letters, numbers, periods (.), underscores (_) and hyphens (-). Spaces and other special characters are not allowed.';
    }
    if (!/[A-Za-z0-9]/.test(value)) return 'The file name must contain at least one letter or number.';
    return '';
}

function sanitizeFileName(name) {
    return String(name || '')
        .trim()
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/_+\./g, '.')
        .replace(/^_+|_+$/g, '');
}

async function findDuplicateDocuments(title) {
    const pattern = String(title || '').replace(/[\\%_]/g, '\\$&');
    const { data, error } = await supabaseClient
        .from('documents')
        .select('id, title, size, created_at, case_id, cases(case_number), profiles(full_name)')
        .ilike('title', pattern)
        .order('created_at', { ascending: false })
        .limit(5);
    if (error) {
        console.error('Duplicate check failed:', error.message);
        return [];
    }
    return data || [];
}

async function confirmDuplicateUpload(file, title) {
    const matches = await findDuplicateDocuments(title);
    if (!matches.length) return true;
    const sizeText = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    const sameSize = matches.some((m) => m.size === sizeText);
    const first = matches[0];
    const where = first.cases && first.cases.case_number ? 'Case ' + first.cases.case_number : 'general documents';
    const by = first.profiles && first.profiles.full_name ? ' by ' + first.profiles.full_name : '';
    const when = new Date(first.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const lead = sameSize
        ? 'A document with the same name and file size is already in the system.'
        : 'A document with the same name is already in the system, but the file size is different.';
    return confirmDialog({
        title: 'Possible duplicate document',
        message: `${lead} "${first.title}" was uploaded${by} on ${when} (${where}). If this is an updated copy, cancel and use "New version" on the existing document instead. Upload this file anyway?`,
        confirmLabel: 'Upload anyway',
        cancelLabel: 'Cancel'
    });
}

function getCategoryColor(type) {
    const t = (type || '').toLowerCase();
    if (t === 'motion' || t === 'motions') return { bg: '#e0e7ff', text: '#2f65ad' };
    if (t === 'memoranda') return { bg: '#e0f2fe', text: '#2f65ad' };
    if (t === 'affidavits') return { bg: '#f8edd2', text: '#a2711a' };
    if (t === 'agreements') return { bg: '#dff1e9', text: '#116b4b' };
    if (t === 'legal opinions') return { bg: '#e6ecf4', text: '#2f4a6b' };
    if (t === 'invoices') return { bg: '#f9e1e1', text: '#a83030' };
    if (t === 'contract' || t === 'contracts') return { bg: '#dff1e9', text: '#16835d' };
    if (t === 'pleading' || t === 'pleadings') return { bg: '#f3e8ff', text: '#3d5a80' };
    if (t === 'evidence' || t === 'documentary evidence') return { bg: '#f1dba0', text: '#b9811f' };
    if (t === 'order') return { bg: '#f9e1e1', text: '#c23a3a' };
    if (t === 'transcript') return { bg: '#f8edd2', text: '#b9811f' };
    if (t === 'estate') return { bg: '#eef2f8', text: '#3d5a80' };
    return { bg: '#eeebe3', text: '#4f5b6d' };
}

function generateTagsHtml(tagsStr) {
    if (!tagsStr) return '';
    const tags = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t);
    return tags
        .map(
            (t) =>
                `<span style="border: 1px solid #e5e1d8; padding: 2px 10px; border-radius: 99px; font-size: 12px; color: #4f5b6d; font-weight: 500;">${escapeHtml(t)}</span>`
        )
        .join('');
}

async function updateClientDocsBanner(activeFilter) {
    const banner = document.getElementById('docs-client-banner');
    if (!banner) return;
    try {
        const { count, error } = await supabaseClient
            .from('documents')
            .select('id', { count: 'exact', head: true })
            .not('uploaded_by_client_id', 'is', null)
            .is('reviewed_at', null);
        if (error || !count || activeFilter === 'source:client-new') {
            banner.classList.add('hidden');
            return;
        }
        document.getElementById('docs-client-banner-text').textContent =
            `${count} new document${count > 1 ? 's' : ''} from clients waiting for your review.`;
        const allBtn = document.getElementById('docs-client-banner-all');
        if (allBtn) {
            allBtn.onclick = async () => {
                allBtn.disabled = true;
                const { data: pending } = await supabaseClient
                    .from('documents')
                    .select('id')
                    .not('uploaded_by_client_id', 'is', null)
                    .is('reviewed_at', null);
                const ids = (pending || []).map((d) => d.id);
                const done = ids.length > 0 && (await markDocsReviewed(ids));
                allBtn.disabled = false;
                if (done) {
                    showToast(`${ids.length} document${ids.length > 1 ? 's' : ''} marked as reviewed.`, 'success');
                    refreshDocumentList();
                } else {
                    showToast('Could not mark them as reviewed.', 'error');
                }
            };
        }
        const btn = document.getElementById('docs-client-banner-btn');
        btn.onclick = () => {
            const select = document.getElementById('doc-filter');
            if (!select) return;
            select.value = 'source:client-new';
            select.dispatchEvent(new Event('change'));
        };
        banner.classList.remove('hidden');
    } catch (err) {
        banner.classList.add('hidden');
    }
}

async function markDocsReviewed(ids) {
    if (!ids || ids.length === 0) return true;
    const { error } = await supabaseClient.rpc('mark_client_documents_reviewed', { p_ids: ids });
    if (!error) return true;
    const { data, error: updateError } = await supabaseClient
        .from('documents')
        .update({ reviewed_at: new Date().toISOString(), reviewed_by_id: currentUser ? currentUser.id : null })
        .in('id', ids)
        .is('reviewed_at', null)
        .select('id');
    if (updateError || !data || data.length === 0) {
        console.error('Could not mark as reviewed:', updateError || error);
        return false;
    }
    return true;
}

window.markClientDocReviewed = async function (id, silent) {
    const ok = await markDocsReviewed([id]);
    if (!ok) {
        if (!silent) showToast('Could not mark this document as reviewed.', 'error');
        return;
    }
    if (window.__docsRegistry && window.__docsRegistry[id]) window.__docsRegistry[id].reviewed_at = new Date().toISOString();
    const filterEl = document.getElementById('doc-filter');
    const filterVal = filterEl ? filterEl.value : 'all';
    if (filterVal === 'source:client-new') {
        refreshDocumentList();
        return;
    }
    const card = document.querySelector('.doc-card[data-doc-id="' + String(id).replace(/"/g, '') + '"]');
    if (card) {
        card.classList.remove('doc-card-new');
        card.querySelectorAll('.doc-new-badge, .doc-review-btn').forEach((el) => el.remove());
    }
    updateClientDocsBanner(filterVal);
    if (!silent) showToast('Marked as reviewed.', 'success');
};

async function renderDocumentList(searchQuery = '', filterType = 'all') {
    const container = document.getElementById('documents-grid-inject');
    const countEl = document.getElementById('docs-found-count');
    if (!container || !currentUser) return;
    showSkeletonIfEmpty(container, skeletonGrid(4));

    try {
        const buildDocsQuery = () => {
            let query = supabaseClient
                .from('documents')
                .select(
                    'id, title, type, size, uploaded_by, uploaded_by_client_id, ' + (window.__docsNoReviewCol ? '' : 'reviewed_at, ') + 'created_at, file_url, file_path, tags, case_id, client_id, ocr_status, ocr_pages, version_no, version_uploaded_by, version_uploaded_at, version_note, profiles(full_name), cases(case_number, title)'
                )
                .order('created_at', { ascending: false })
                .order('id', { ascending: true });

            if (filterType && filterType.startsWith('source:')) {
                if (filterType === 'source:firm') {
                    query = query.is('uploaded_by_client_id', null);
                } else {
                    query = query.not('uploaded_by_client_id', 'is', null);
                    if (filterType === 'source:client-new' && !window.__docsNoReviewCol) query = query.is('reviewed_at', null);
                }
            } else if (filterType && filterType !== 'all') {
                query = query.eq('type', filterType.toLowerCase());
            }

            return query;
        };

        const { data: documents, error } = await fetchAllRows(buildDocsQuery);
        if (error) {
            if (!window.__docsNoReviewCol && /reviewed_at/i.test(error.message || '')) {
                window.__docsNoReviewCol = true;
                return renderDocumentList(searchQuery, filterType);
            }
            throw error;
        }

        window.__docsRegistry = {};
        (documents || []).forEach((d) => {
            window.__docsRegistry[d.id] = d;
        });

        const term = (searchQuery || '').trim().toLowerCase();
        const contentHits = {};
        if (term.length >= 3) {
            const { data: hits, error: hitError } = await supabaseClient.rpc('search_documents', { p_query: term });
            if (!hitError)
                (hits || []).forEach((h) => {
                    contentHits[h.id] = h.snippet;
                });
        }

        const filteredDocs = (documents || []).filter((doc) => {
            if (!term) return true;
            const searchFields = [
                doc.title || '',
                doc.type || '',
                doc.tags || '',
                doc.cases?.case_number || '',
                doc.cases?.title || '',
                doc.profiles?.full_name || ''
            ]
                .join(' ')
                .toLowerCase();
            return searchFields.includes(term) || doc.id in contentHits;
        });

        if (filteredDocs.length === 0) {
            container.innerHTML =
                '<p style="color:#64748b; grid-column: 1 / -1; text-align:center; padding: 40px;">No documents match your search/filter.</p>';
            if (countEl) countEl.textContent = 'Found 0 documents';
            pagerClear('documents-pager');
            return;
        }

        const staff = isStaffUser();

        pagerBind('documents', refreshDocumentList, 'documents-grid-inject');
        const docInfo = pagerSlice('documents', filteredDocs, JSON.stringify([filterType, term]));
        let pagerEl = document.getElementById('documents-pager');
        if (!pagerEl) {
            pagerEl = document.createElement('div');
            pagerEl.id = 'documents-pager';
            container.insertAdjacentElement('afterend', pagerEl);
        }

        container.innerHTML = docInfo.rows
            .map((doc) => {
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
                const needsIndex =
                    canVersion &&
                    hasFile &&
                    supported &&
                    doc.ocr_status !== 'done' &&
                    (doc.ocr_status !== 'processing' || staleProcessing);

                let chip = '';
                if (doc.ocr_status === 'done') {
                    chip =
                        '<span style="background:#dff1e9; color:#16835d; padding:3px 8px; border-radius:12px; font-size:12px; font-weight:600;"><i class="fa-solid fa-magnifying-glass"></i> Searchable</span>';
                } else if (doc.ocr_status === 'processing' && !staleProcessing) {
                    chip =
                        '<span style="background:#d7e5f6; color:#285791; padding:3px 8px; border-radius:12px; font-size:12px; font-weight:600;"><i class="fa-solid fa-spinner fa-spin"></i> Indexing</span>';
                } else if (doc.ocr_status === 'failed') {
                    chip =
                        '<span style="background:#f9e1e1; color:#c23a3a; padding:3px 8px; border-radius:12px; font-size:12px; font-weight:600;">Index failed</span>';
                } else if (supported) {
                    chip =
                        '<span style="background:#eeebe3; color:#64748b; padding:3px 8px; border-radius:12px; font-size:12px; font-weight:600;">Not indexed</span>';
                }

                const versionBadge =
                    (doc.version_no || 1) > 1
                        ? `<span style="background:#e6ecf4; color:#2f4a6b; padding:3px 8px; border-radius:12px; font-size:12px; font-weight:700;">v${doc.version_no}</span>`
                        : '';

                const hit = contentHits[doc.id];
                const snippetHtml =
                    hit && hit.includes('<<')
                        ? `<div style="font-size:12px; color:#4f5b6d; background:#fbf4e3; border:1px solid #f1dba0; border-radius:8px; padding:8px 10px; margin-bottom:14px; line-height:1.5;"><i class="fa-solid fa-magnifying-glass" style="color:#d69b2d; margin-right:6px;"></i>…${escapeHtml(
                              hit
                          )
                              .replace(
                                  /&lt;&lt;/g,
                                  '<mark style="background:#e8b552; padding:0 2px; border-radius:2px;">'
                              )
                              .replace(/&gt;&gt;/g, '</mark>')}…</div>`
                        : '';

                const isClientDoc = !!doc.uploaded_by_client_id;
                const isNewClientDoc = isClientDoc && !doc.reviewed_at;
                const clientBadge = isClientDoc
                    ? `<span class="doc-from-client"><i class="fa-solid fa-user"></i> From client</span>${isNewClientDoc ? '<span class="doc-new-badge">New</span>' : ''}`
                    : '';

                const extraButtons = [
                    isNewClientDoc
                        ? `<button type="button" onclick="markClientDocReviewed(${idArg})" class="doc-small-btn doc-review-btn"><i class="fa-solid fa-circle-check"></i> Mark reviewed</button>`
                        : '',
                    (doc.version_no || 1) > 1
                        ? `<button type="button" onclick="openDocumentHistory(${idArg})" class="doc-small-btn"><i class="fa-solid fa-clock-rotate-left"></i> History</button>`
                        : '',
                    canVersion && hasFile
                        ? `<button type="button" onclick="openNewVersionModal(${idArg})" class="doc-small-btn"><i class="fa-solid fa-file-circle-plus"></i> New version</button>`
                        : '',
                    canEdit
                        ? `<button type="button" onclick="openEditDocumentModal(${idArg})" class="doc-small-btn"><i class="fa-solid fa-pen"></i> Edit</button>`
                        : '',
                    needsIndex
                        ? `<button type="button" onclick="indexExistingDocument(${idArg})" class="doc-small-btn"><i class="fa-solid fa-wand-magic-sparkles"></i> Index</button>`
                        : ''
                ]
                    .filter(Boolean)
                    .join('');

                const typeColor = getCategoryColor(doc.type);

                return `
            <div class="doc-card${isClientDoc ? ' doc-card-client' : ''}${isNewClientDoc ? ' doc-card-new' : ''}" data-doc-id="${escapeHtml(String(doc.id))}" style="background: #ffffff; border: 1px solid #e5e1d8; border-radius: 12px; padding: 20px; box-sizing: border-box;">
                <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
                    <div style="background: #eaf1fa; color: #3976c5; width: 42px; height: 42px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i class="fa-solid fa-file-lines" style="font-size: 18px;"></i>
                    </div>
                    <div>
                        <h4 style="font-size: 14px; font-weight: 600; color: #101b2d; margin: 0 0 6px 0; word-break: break-word;">${escapeHtml(doc.title || 'Untitled Document')}</h4>
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                            ${isClientDoc ? '' : `<span style="background: ${typeColor.bg}; color: ${typeColor.text}; padding: 3px 8px; border-radius: 12px; font-size:12px; font-weight: 600; text-transform: lowercase;">${escapeHtml(doc.type || 'document')}</span>`}
                            <span style="font-size: 12px; color: #64748b;">${escapeHtml(doc.size || '0 KB')}</span>
                            ${versionBadge}
                            ${chip}
                            ${clientBadge}
                        </div>
                    </div>
                </div>

                ${snippetHtml}

                <div style="font-size: 12px; color: #4f5b6d; margin-bottom: 15px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-tag" style="color: #64748b; width: 14px; text-align: center;"></i>
                        ${escapeHtml(doc.cases?.case_number || 'No Case Number')}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-regular fa-user" style="color: #64748b; width: 14px; text-align: center;"></i>
                        ${escapeHtml(doc.profiles?.full_name || (doc.uploaded_by_client_id ? 'Client (portal upload)' : 'System'))}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-regular fa-calendar" style="color: #64748b; width: 14px; text-align: center;"></i>
                        ${formatDate(doc.created_at)}
                    </div>
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px;">
                    ${generateTagsHtml(isClientDoc ? String(doc.tags || '').split(',').map((t) => t.trim()).filter((t) => t && t.toLowerCase() !== 'client upload').join(', ') : doc.tags)}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px solid #eeebe3; padding-top: 15px;">
                    <button type="button" class="doc-action-btn" onclick="${isNewClientDoc ? `markClientDocReviewed(${idArg}, true); ` : ''}${onBtnClick}">
                        <i class="fa-regular fa-eye"></i> View
                    </button>
                    <button type="button" class="doc-action-btn" onclick="${isNewClientDoc ? `markClientDocReviewed(${idArg}, true); ` : ''}${onDownloadClick}">
                        <i class="fa-solid fa-download"></i> Download
                    </button>
                </div>
                ${extraButtons ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">${extraButtons}</div>` : ''}
            </div>
        `;
            })
            .join('');

        if (countEl) countEl.textContent = `Found ${filteredDocs.length} document${filteredDocs.length > 1 ? 's' : ''}`;
        pagerEl.innerHTML = pagerHtml('documents', docInfo, filteredDocs.length === 1 ? 'document' : 'documents');
        updateClientDocsBanner(filterType);
    } catch (error) {
        console.error('Error rendering documents:', error);
        container.innerHTML = errorStateHtml('Could not load documents.', 'refreshDocumentList');
        pagerClear('documents-pager');
    }
}
async function forceDownload(url, filename) {
    if (!url || url === '#') {
        showToast('File URL is missing.', 'error');
        return;
    }
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');

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
        let displayName = 'User';
        let role = 'Lawyer';
        let specialization = 'General Practice';

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
            if (phoneEl)
                phoneEl.innerHTML = `<i class="fa-solid fa-phone"></i> ${escapeHtml(profile.phone || '(555) 000-0000')}`;
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
        .select(
            `id, client_name, client_email, client_phone, cases!inner(status, ${globalUserRole === 'lawyer' && currentUser ? 'case_lawyers!inner' : 'case_lawyers'}(lawyer_id, is_lead, profiles(full_name)))`
        )
        .eq('cases.status', 'active')
        .is('archived_at', null);

    if (globalUserRole === 'lawyer' && currentUser) {
        clientsQuery = clientsQuery.eq('cases.case_lawyers.lawyer_id', currentUser.id);
    }

    const { data: rows, error } = await clientsQuery;
    if (error) throw error;

    const byId = new Map();
    (rows || []).forEach((row) => {
        if (!byId.has(row.id)) {
            byId.set(row.id, {
                id: row.id,
                client_name: row.client_name,
                client_email: row.client_email,
                client_phone: row.client_phone,
                lawyerNames: new Set()
            });
        }
        (row.cases || []).forEach((c) => {
            (c.case_lawyers || []).forEach((cl) => {
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
        .select('id, full_name, specialization, phone, avatar_url, roles!inner(name)')
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
            completedCount = (recentEvents || []).filter(
                (ev) => getEventStatusInfo(ev.start_date, ev.end_date).label === 'Completed'
            ).length;
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
            } catch (e) {
                activeLawyersCount = 0;
            }
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
            timeline.innerHTML = events
                .map((ev) => {
                    const colorClass = ev.is_conflict ? 'bar-red' : ev.is_general ? 'bar-purple' : 'bar-blue';
                    const priorityBadge =
                        ev.priority === 'high' ? '<span class="badge-pill bg-red"><i class="fa-solid fa-star"></i> High Priority</span>' : '';
                    const generalBadge = ev.is_general ? '<span class="badge-pill bg-purple">Firm-wide</span>' : '';
                    const conflictBadge = ev.is_conflict
                        ? '<span class="badge-pill bg-red"><i class="fa-solid fa-triangle-exclamation"></i> Conflict</span>'
                        : '';
                    const statusInfo = getEventStatusInfo(ev.start_date, ev.end_date);
                    const isDone = statusInfo.label === 'Completed';
                    const statusBadge = `<span style="background:${statusInfo.bg}; color:${statusInfo.color}; font-size:12px; padding:2px 9px; border-radius:99px; font-weight:600;"><i class="fa-solid ${statusInfo.icon}" style="margin-right:3px;"></i>${statusInfo.label}</span>`;

                    return `
                        <div class="timeline-item ${colorClass}" style="${isDone ? 'opacity:0.65;' : ''}">
                            <div class="time-row">
                                <strong>${formatEventTime(ev.start_date) || 'All Day'}</strong> 
                                ${priorityBadge}
                                ${conflictBadge}
                                ${generalBadge}
                                ${statusBadge}
                            </div>
                            <h4>${escapeHtml(ev.title)}</h4>
                            <div class="timeline-meta">
                                <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(ev.location || 'Office')}</span>
                            </div>
                        </div>
                    `;
                })
                .join('');
        } else {
            timeline.innerHTML =
                '<p style="color:#64748b; text-align:center; padding:20px;">No events scheduled for today</p>';
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
            list.innerHTML = documents
                .map(
                    (doc) => `
                    <div style="background:#f7f5f0; border-radius:10px; padding:15px; margin-bottom:12px; display:flex; align-items:center; gap:15px;">
                        <div style="background:#eaf1fa; color:#3976c5; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                            <i class="fa-solid fa-file-lines"></i>
                        </div>
                        <div>
                            <h4 style="font-size:13px; color:#252d3a; margin-bottom:4px;">${escapeHtml(doc.title)}</h4>
                            <p style="font-size:12px; color:#64748b; text-transform:capitalize;">${escapeHtml(doc.type || 'Doc')}</p>
                        </div>
                    </div>
                `
                )
                .join('');
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
            cases.forEach((c) => {
                const statusColor = c.status === 'active' ? '#3976c5' : '#64748b';
                const statusBg = c.status === 'active' ? '#eaf1fa' : '#eeebe3';

                const clientName = c.clients ? c.clients.client_name : 'No Client';

                html += `
                        <div style="padding: 15px; border: 1px solid #eeebe3; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; background: #f7f5f0;">
                            <div>
                                <h4 style="color: #101b2d; margin-bottom: 4px; font-size: 14px;">${escapeHtml(c.title)} <span style="color:#64748b; font-weight:normal; font-size:12px;">(${escapeHtml(clientName)})</span></h4>
                                <p style="color: #64748b; font-size: 12px;"><i class="fa-regular fa-clock"></i> Filed: ${formatDate(c.date_filed || c.created_at)}</p>
                            </div>
                            <span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 10px; border-radius: 99px; font-size:12px; font-weight: bold; text-transform: uppercase;">
                                ${c.status}
                            </span>
                        </div>
                    `;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML =
                '<p style="color:#64748b; padding:20px; text-align:center;">No active cases found. Add an event to create a case automatically!</p>';
        }
    } catch (error) {
        console.warn('Could not load my cases tab.');
        container.innerHTML = errorStateHtml('Could not load your cases.', 'renderMyCasesTab');
    }
}

function perfBarRow(label, value, max, color) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return `
            <div style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;">
                    <span style="color:#4f5b6d;">${escapeHtml(label)}</span>
                    <strong style="color:#101b2d;">${value}</strong>
                </div>
                <div style="background:#eeebe3; height:8px; border-radius:4px; overflow:hidden;">
                    <div style="background:${color}; width:${pct}%; height:100%; border-radius:4px;"></div>
                </div>
            </div>`;
}

function perfKpi(label, value, color) {
    return `
            <div style="flex:1; min-width:140px; background:#f7f5f0; border:1px solid #eeebe3; border-radius:12px; padding:14px 16px;">
                <div style="font-size:24px; font-weight:800; color:${color};">${value}</div>
                <div style="font-size:12px; color:#64748b; margin-top:2px;">${escapeHtml(label)}</div>
            </div>`;
}

function perfPanel(title, bodyHtml) {
    return `
            <div style="border:1px solid #eeebe3; border-radius:14px; padding:18px 20px; background:#ffffff;">
                <h4 style="margin:0 0 14px 0; font-size:13px; color:#101b2d;">${escapeHtml(title)}</h4>
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
    const max = Math.max(1, ...months.map((m) => Math.max(opened[m.key] || 0, closed ? closed[m.key] || 0 : 0)));
    const dense = months.length > 12;
    const bar = (v, color) => `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:flex-end;">
                ${dense ? '' : `<span style="font-size:12px; color:#4f5b6d; margin-bottom:2px;">${v}</span>`}
                <div title="${v}" style="width:${dense ? 6 : 16}px; height:${Math.max(2, Math.round((v / max) * 100))}px; background:${color}; border-radius:3px 3px 0 0;"></div>
            </div>`;
    const columns = months
        .map(
            (m) => `
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end;">
                <div style="display:flex; align-items:flex-end; gap:4px;">
                    ${bar(opened[m.key] || 0, '#3976c5')}
                    ${closed ? bar(closed[m.key] || 0, '#16835d') : ''}
                </div>
                <span style="font-size:12px; color:#64748b; margin-top:6px; white-space:nowrap;">${escapeHtml(m.label)}</span>
            </div>`
        )
        .join('');
    const legend = `
            <div style="display:flex; gap:14px; margin-top:12px; font-size:12px; color:#64748b;">
                <span><span style="display:inline-block; width:8px; height:8px; background:#3976c5; border-radius:2px; margin-right:5px;"></span>Opened</span>
                ${closed ? '<span><span style="display:inline-block; width:8px; height:8px; background:#16835d; border-radius:2px; margin-right:5px;"></span>Closed</span>' : ''}
            </div>`;
    return `<div style="display:flex; align-items:flex-end; gap:10px; height:150px;">${columns}</div>${legend}`;
}

async function fetchWorkloadData() {
    const nowIso = new Date().toISOString();
    const weekIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const [casesRes, eventsRes] = await Promise.all([
        supabaseClient.from('cases').select('id, status, case_lawyers(lawyer_id, is_lead)').eq('status', 'active'),
        supabaseClient
            .from('calendar_events')
            .select('assigned_to')
            .eq('is_general', false)
            .gte('start_date', nowIso)
            .lte('start_date', weekIso)
    ]);
    return { cases: casesRes.data || [], events: eventsRes.data || [] };
}

function computeWorkload(cases, events) {
    const map = {};
    const slot = (id) => map[id] || (map[id] = { active: 0, lead: 0, events: 0 });
    (cases || []).forEach((c) => {
        if (c.status === 'closed') return;
        (c.case_lawyers || []).forEach((r) => {
            const w = slot(r.lawyer_id);
            w.active++;
            if (r.is_lead) w.lead++;
        });
    });
    (events || []).forEach((e) => {
        if (e.assigned_to) slot(e.assigned_to).events++;
    });
    return map;
}

let perfRange = '6';

const PERF_RANGES = [
    { value: '3', option: 'Last 3 months', title: 'last 3 months' },
    { value: '6', option: 'Last 6 months', title: 'last 6 months' },
    { value: '12', option: 'Last 12 months', title: 'last 12 months' },
    { value: '24', option: 'Last 24 months', title: 'last 24 months' },
    { value: 'ytd', option: 'This year so far', title: 'this year' }
];

function perfMonthCount() {
    return perfRange === 'ytd' ? new Date().getMonth() + 1 : Number(perfRange) || 6;
}

function perfRangeTitle() {
    const found = PERF_RANGES.find((r) => r.value === perfRange);
    return found ? found.title : 'last 6 months';
}

function lastNMonths(n) {
    const out = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        const showYear = n > 6 && (d.getMonth() === 0 || i === n - 1);
        const hidden = n > 12 && i % 2 === 1;
        out.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: hidden ? '' : showYear ? `${month} '${String(d.getFullYear()).slice(2)}` : month,
            full: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        });
    }
    return out;
}

function perfDaysBetween(fromLike, toLike) {
    const ms = new Date(toLike).getTime() - new Date(fromLike).getTime();
    return Math.max(0, ms / 86400000);
}

function perfAvg(list) {
    return list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : null;
}

function perfFmtDays(value) {
    return value === null || value === undefined ? '–' : value.toFixed(1);
}

function perfValueChart(months, values, color, legendText) {
    const present = months.map((m) => values[m.key]).filter((v) => v !== undefined && v !== null);
    const max = Math.max(1, ...present);
    const columns = months
        .map((m) => {
            const v = values[m.key];
            const has = v !== undefined && v !== null;
            const shown = has ? (months.length > 12 ? Math.round(v) : Number.isInteger(v) ? v : v.toFixed(1)) : '–';
            const h = has ? Math.max(2, Math.round((v / max) * 100)) : 2;
            return `
            <div style="flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:flex-end;">
                <span style="font-size:12px; color:#4f5b6d; margin-bottom:2px;">${shown}</span>
                <div style="width:70%; max-width:22px; height:${h}px; background:${has ? color : '#e5e1d8'}; border-radius:4px 4px 0 0;"></div>
                <span style="font-size:12px; color:#64748b; margin-top:6px; white-space:nowrap;">${escapeHtml(m.label)}</span>
            </div>`;
        })
        .join('');
    return `
            <div style="display:flex; align-items:flex-end; gap:6px; height:150px;">${columns}</div>
            <div style="display:flex; gap:14px; margin-top:12px; font-size:12px; color:#64748b;">
                <span><span style="display:inline-block; width:8px; height:8px; background:${color}; border-radius:2px; margin-right:5px;"></span>${escapeHtml(legendText)}</span>
            </div>`;
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

        const clientsQuery = isLawyerView
            ? supabaseClient.from('client_lawyers').select('client_id, clients(created_at)').eq('lawyer_id', currentUser.id)
            : supabaseClient.from('clients').select('id, created_at');

        const [casesRes, eventsRes, clientsRes] = await Promise.all([casesQuery, eventsQuery, clientsQuery]);
        if (casesRes.error) throw casesRes.error;

        const cases = casesRes.data || [];
        const events = eventsRes.data || [];
        const clientDates = clientsRes.error
            ? null
            : (clientsRes.data || [])
                  .map((r) => (isLawyerView ? r.clients && r.clients.created_at : r.created_at))
                  .filter(Boolean);

        const active = cases.filter((c) => c.status !== 'closed');
        const closed = cases.filter((c) => c.status === 'closed');
        const closureRate = cases.length > 0 ? Math.round((closed.length / cases.length) * 100) : 0;

        const stageCounts = {};
        CASE_STAGES.forEach((st) => {
            stageCounts[st] = 0;
        });
        active.forEach((c) => {
            if (c.case_stage in stageCounts) stageCounts[c.case_stage]++;
        });
        const stageMax = Math.max(0, ...Object.values(stageCounts));

        const typeCounts = {};
        CASE_TYPES.forEach((t) => {
            typeCounts[t] = 0;
        });
        active.forEach((c) => {
            if (c.case_type in typeCounts) typeCounts[c.case_type]++;
        });
        const typeMax = Math.max(0, ...Object.values(typeCounts));

        const months = lastNMonths(perfMonthCount());
        const currentMonthKey = months[months.length - 1].key;

        const openedByMonth = {};
        cases.forEach((c) => {
            const key = toLocalDateKey(c.date_filed || c.created_at).slice(0, 7);
            openedByMonth[key] = (openedByMonth[key] || 0) + 1;
        });

        const tracksClosing = cases.length === 0 || 'closed_at' in cases[0];
        let closedByMonth = null;
        const closeDaysByMonthList = {};
        const closeDaysAll = [];
        const closeStats = {};
        if (tracksClosing) {
            closedByMonth = {};
            closed.forEach((c) => {
                const hasDate = !!c.closed_at;
                const days = hasDate ? perfDaysBetween(c.date_filed || c.created_at, c.closed_at) : null;
                if (hasDate) {
                    const key = toLocalDateKey(c.closed_at).slice(0, 7);
                    closedByMonth[key] = (closedByMonth[key] || 0) + 1;
                    (closeDaysByMonthList[key] = closeDaysByMonthList[key] || []).push(days);
                    closeDaysAll.push(days);
                }
                (c.case_lawyers || []).forEach((r) => {
                    const s = closeStats[r.lawyer_id] || (closeStats[r.lawyer_id] = { closed: 0, days: [] });
                    s.closed++;
                    if (hasDate) s.days.push(days);
                });
            });
        }
        const closeDaysByMonth = {};
        Object.keys(closeDaysByMonthList).forEach((key) => {
            closeDaysByMonth[key] = perfAvg(closeDaysByMonthList[key]);
        });
        const avgCloseDays = perfAvg(closeDaysAll);

        const newClientsByMonth = {};
        (clientDates || []).forEach((iso) => {
            const key = toLocalDateKey(iso).slice(0, 7);
            newClientsByMonth[key] = (newClientsByMonth[key] || 0) + 1;
        });
        const newClientsThisMonth = clientDates ? newClientsByMonth[currentMonthKey] || 0 : '–';

        const workload = computeWorkload(cases, events);
        let kpis = '';
        let workloadPanel = '';

        if (isLawyerView) {
            kpis = [
                perfKpi('My active cases', active.length, '#3976c5'),
                perfKpi('My closed cases', closed.length, '#16835d'),
                perfKpi('Avg. days to close', perfFmtDays(avgCloseDays), '#3d5a80'),
                perfKpi('My new clients this month', newClientsThisMonth, '#3976c5'),
                perfKpi('Events in the next 7 days', events.length, '#d69b2d')
            ].join('');
        } else {
            const lawyers = await getActiveLawyersData();
            const unassigned = active.filter((c) => !(c.case_lawyers || []).length).length;
            const totalLoad = lawyers.reduce((sum, l) => sum + ((workload[l.id] || {}).active || 0), 0);
            const avgLoad = lawyers.length > 0 ? totalLoad / lawyers.length : 0;
            const maxLoad = Math.max(1, ...lawyers.map((l) => (workload[l.id] || {}).active || 0));

            kpis = [
                perfKpi('Active cases', active.length, '#3976c5'),
                perfKpi('Closed cases', closed.length, '#16835d'),
                perfKpi('Closure rate', closureRate + '%', '#3d5a80'),
                perfKpi('Avg. days to close', perfFmtDays(avgCloseDays), '#3d5a80'),
                perfKpi('New clients this month', newClientsThisMonth, '#3976c5'),
                perfKpi('Avg. active cases per lawyer', avgLoad.toFixed(1), '#d69b2d'),
                perfKpi('Active cases without a lawyer', unassigned, unassigned > 0 ? '#d64545' : '#16835d')
            ].join('');

            const rows = lawyers
                .map((l) => ({
                    l,
                    w: workload[l.id] || { active: 0, lead: 0, events: 0 },
                    c: closeStats[l.id] || { closed: 0, days: [] }
                }))
                .sort((a, b) => b.w.active - a.w.active)
                .map(({ l, w, c }) => {
                    const high = w.active >= 4 && w.active > avgLoad * 1.5;
                    const flag = high
                        ? '<span class="ct-badge tag-busy" style="background:var(--status-danger-bg); color:var(--status-danger-text);">High load</span>'
                        : w.active === 0
                          ? '<span class="ct-badge ct-badge-active">Available</span>'
                          : '';
                    return `
                            <tr>
                                <td style="padding:10px 8px; border-bottom:1px solid #eeebe3; font-weight:600; color:#101b2d;">Atty. ${escapeHtml(l.full_name || 'Unnamed')}</td>
                                <td style="padding:10px 8px; border-bottom:1px solid #eeebe3; width:30%;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <div style="flex:1; background:#eeebe3; height:8px; border-radius:4px; overflow:hidden;">
                                            <div style="background:${high ? '#d64545' : '#3976c5'}; width:${Math.round((w.active / maxLoad) * 100)}%; height:100%;"></div>
                                        </div>
                                        <strong style="font-size:12px; color:#101b2d; min-width:18px;">${w.active}</strong>
                                    </div>
                                </td>
                                <td style="padding:10px 8px; border-bottom:1px solid #eeebe3; color:#4f5b6d;">${w.lead}</td>
                                <td style="padding:10px 8px; border-bottom:1px solid #eeebe3; color:#4f5b6d;">${c.closed}</td>
                                <td style="padding:10px 8px; border-bottom:1px solid #eeebe3; color:#4f5b6d;">${perfFmtDays(perfAvg(c.days))}</td>
                                <td style="padding:10px 8px; border-bottom:1px solid #eeebe3; color:#4f5b6d;">${w.events}</td>
                                <td style="padding:10px 8px; border-bottom:1px solid #eeebe3;">${flag}</td>
                            </tr>`;
                })
                .join('');

            workloadPanel = perfPanel(
                'Active cases and time to close, per lawyer',
                lawyers.length === 0
                    ? '<p style="color:#64748b; font-size:13px; margin:0;">No active lawyers yet.</p>'
                    : `
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
                                <thead>
                                    <tr style="color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:0.04em;">
                                        <th style="padding:8px;">Lawyer</th>
                                        <th style="padding:8px;">Active cases</th>
                                        <th style="padding:8px;">As lead</th>
                                        <th style="padding:8px;">Closed</th>
                                        <th style="padding:8px;">Avg. days to close</th>
                                        <th style="padding:8px;">Events (7 days)</th>
                                        <th style="padding:8px;"></th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>`
            );
        }

        const stagePanel = perfPanel(
            'Active cases by stage',
            CASE_STAGES.map((st) => perfBarRow(st, stageCounts[st], stageMax, '#3976c5')).join('')
        );
        const typePanel = perfPanel(
            'Active cases by type',
            CASE_TYPES.map((t) => perfBarRow(t, typeCounts[t], typeMax, '#3d5a80')).join('')
        );
        const monthPanel = perfPanel(
            `Cases opened and closed (${perfRangeTitle()})`,
            perfMonthlyChart(months, openedByMonth, closedByMonth)
        );
        const closeTimePanel = perfPanel(
            'Average days to close a case, by month closed',
            tracksClosing
                ? perfValueChart(months, closeDaysByMonth, '#3d5a80', 'Average days from filing to closing')
                : '<p style="color:#64748b; font-size:13px; margin:0;">Closing dates are not available yet.</p>'
        );
        const clientsPanel = perfPanel(
            isLawyerView ? 'My new clients per month' : 'New clients per month',
            clientDates
                ? perfValueChart(months, newClientsByMonth, '#3976c5', 'New clients')
                : '<p style="color:#64748b; font-size:13px; margin:0;">Client data could not be loaded.</p>'
        );

        container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:18px;">
                    <h3 style="margin:0; font-size:16px;">${isLawyerView ? 'My Performance' : 'Firm Performance'}</h3>
                    <label style="font-size:12px; color:#64748b; display:flex; align-items:center; gap:8px;">Chart range
                        <select id="perf-range" style="padding:6px 10px; border:1px solid #e5e1d8; border-radius:8px; font-size:12px; font-family:inherit; background:#ffffff; color:#101b2d;">
                            ${PERF_RANGES.map((r) => `<option value="${r.value}" ${perfRange === r.value ? 'selected' : ''}>${r.option}</option>`).join('')}
                        </select>
                    </label>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:20px;">${kpis}</div>
                ${workloadPanel ? `<div style="margin-bottom:20px;">${workloadPanel}</div>` : ''}
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
                    ${monthPanel}
                    ${closeTimePanel}
                    ${clientsPanel}
                    ${stagePanel}
                    ${typePanel}
                </div>
                ${tracksClosing ? '' : '<p style="font-size:12px; color:#64748b; margin:14px 0 0 0;">Closed-per-month needs the closed_at column. Run dashboard_support.sql to enable it.</p>'}
            `;

        const rangeSelect = document.getElementById('perf-range');
        if (rangeSelect) {
            rangeSelect.addEventListener('change', () => {
                perfRange = PERF_RANGES.some((r) => r.value === rangeSelect.value) ? rangeSelect.value : '6';
                renderPerformanceTab();
            });
        }
    } catch (error) {
        console.error('Error rendering performance tab:', error);
        container.innerHTML = errorStateHtml('Could not load performance data.', 'renderPerformanceTab');
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
        badge.style.cssText =
            'margin-left:auto; background:#d64545; color:#ffffff; font-size:12px; font-weight:700; padding:2px 7px; border-radius:99px;';
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
            supabaseClient
                .from('clients')
                .select('id, approval_status, client_lawyers(lawyer_id)')
                .is('archived_at', null)
                .in('approval_status', ['pending', 'approved']),
            supabaseClient.from('cases').select('id, case_lawyers(lawyer_id)').eq('status', 'active')
        ]);
        if (clientsRes.error) throw clientsRes.error;
        if (casesRes.error) throw casesRes.error;

        const clientRows = clientsRes.data || [];
        const pending = clientRows.filter((c) => c.approval_status === 'pending').length;
        const clientsNoLawyer = clientRows.filter(
            (c) => c.approval_status === 'approved' && !(c.client_lawyers || []).length
        ).length;
        const casesNoLawyer = (casesRes.data || []).filter((c) => !(c.case_lawyers || []).length).length;

        setClientsNavBadge(pending);

        const admin = isAdminUser();
        const items = [];
        if (pending > 0) {
            items.push({
                icon: 'fa-user-clock',
                tone: 'warn',
                action: 'clients-pending',
                text: `${pending} client${pending === 1 ? '' : 's'} waiting for approval`,
                button: admin ? 'Review' : 'View'
            });
        }
        if (clientsNoLawyer > 0) {
            items.push({
                icon: 'fa-user-slash',
                tone: 'danger',
                action: 'clients-unassigned',
                text: `${clientsNoLawyer} approved client${clientsNoLawyer === 1 ? ' has' : 's have'} no assigned lawyer`,
                button: admin ? 'Assign' : 'View'
            });
        }
        if (casesNoLawyer > 0) {
            items.push({
                icon: 'fa-briefcase',
                tone: 'danger',
                action: 'cases-unassigned',
                text: `${casesNoLawyer} active case${casesNoLawyer === 1 ? ' has' : 's have'} no lawyer`,
                button: 'View cases'
            });
        }

        const body =
            items.length === 0
                ? `<div class="attn-list"><div class="attn-row is-ok"><span class="attn-text"><i class="fa-regular fa-circle-check"></i> Nothing needs your attention right now.</span></div></div>`
                : `<div class="attn-list">${items
                      .map(
                          (it) => `
                    <div class="attn-row ${it.tone === 'danger' ? 'is-danger' : ''}">
                        <span class="attn-text">
                            <i class="fa-solid ${it.icon}"></i> ${escapeHtml(it.text)}
                        </span>
                        <button type="button" class="attn-btn" data-attn="${it.action}">${escapeHtml(it.button)}</button>
                    </div>`
                      )
                      .join('')}</div>`;

        card.innerHTML = `
                <div class="card-title-flex">
                    <h3><i class="fa-solid fa-scale-balanced"></i> Needs your attention</h3>
                </div>
                ${body}`;
    } catch (error) {
        console.error('Error rendering attention card:', error);
        card.innerHTML = errorStateHtml('Could not load pending items.', 'renderAdminAttention');
    }
}

function setupScheduleTabs() {
    const schedTabs = document.querySelectorAll('.sched-tab-btn');

    schedTabs.forEach((tab) => {
        tab.addEventListener('click', function () {
            const targetId = this.getAttribute('data-scheduletab');
            if (!targetId) return;

            schedTabs.forEach((btn) => btn.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.sched-tab-content').forEach((content) => {
                content.classList.add('hidden');
            });

            const activeContent = document.getElementById(targetId);
            if (activeContent) activeContent.classList.remove('hidden');
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
    client_pending: { icon: 'fa-solid fa-user-clock', color: '#d69b2d' },
    client_approved: { icon: 'fa-regular fa-circle-check', color: '#16835d' },
    client_rejected: { icon: 'fa-regular fa-circle-xmark', color: '#d64545' },
    case_assigned: { icon: 'fa-solid fa-briefcase', color: '#3976c5' },
    client_assigned: { icon: 'fa-solid fa-user-tie', color: '#3976c5' },
    conflict: { icon: 'fa-solid fa-triangle-exclamation', color: '#d64545' },
    event_reminder: { icon: 'fa-regular fa-bell', color: '#3d5a80' },
    client_upload: { icon: 'fa-solid fa-file-arrow-up', color: '#3976c5' },
    appointment_request: { icon: 'fa-solid fa-calendar-plus', color: '#d69b2d' },
    email_failed: { icon: 'fa-solid fa-triangle-exclamation', color: '#d64545' }
};

const EMAIL_STATUS = {
    pending: { label: 'Pending', bg: '#f8edd2', color: '#a2711a' },
    processing: { label: 'Sending', bg: '#d7e5f6', color: '#285791' },
    sent: { label: 'Sent', bg: '#dff1e9', color: '#16835d' },
    failed: { label: 'Failed', bg: '#f9e1e1', color: '#c23a3a' }
};

function emailStatusBadge(status) {
    const st = EMAIL_STATUS[status] || EMAIL_STATUS.pending;
    return `<span style="background:${st.bg}; color:${st.color}; font-size:12px; padding:2px 8px; border-radius:99px; font-weight:700; white-space:nowrap;">${st.label}</span>`;
}

function emailStatusPill(status) {
    const st = EMAIL_STATUS[status] ? status : 'pending';
    return `<span class="nt-status nt-status--${st}">${EMAIL_STATUS[st].label}</span>`;
}

function emailTimeText(m) {
    if (m.status === 'sent') return `Sent ${formatStamp(m.sent_at)}`;
    if (m.status === 'failed') return `Failed after ${m.attempts} attempt${m.attempts === 1 ? '' : 's'}`;
    if (m.status === 'processing') return 'Sending now';
    if (m.attempts > 0 && m.next_attempt_at)
        return `Retry ${m.attempts} scheduled for ${formatStamp(m.next_attempt_at)}`;
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
    const base = () =>
        supabaseClient
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);
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
        if (window.__notifSeen) {
            const hasNew = window.__notifications.some((n) => !n.is_read && !window.__notifSeen.has(n.id));
            if (hasNew && window.JuriSyncSound) window.JuriSyncSound.play();
        }
        window.__notifSeen = new Set(window.__notifications.map((n) => n.id));
        const unread = window.__notifications.filter((n) => !n.is_read);
        const high = unread.filter((n) => n.priority === 'high');
        updateNotificationCounters(unread.length, high.length);

        paintNotifications();
    } catch (error) {
        console.error('Error rendering notifications:', error);
        list.innerHTML = errorStateHtml('Could not load notifications.', 'renderNotificationsList');
    }
}

function notifDayLabel(dateString) {
    const d = new Date(dateString);
    const today = new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOf(today) - startOf(d)) / 86400000);
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return 'Earlier';
}

function notifEntryHtml(n) {
    const style = NOTIF_STYLES[n.type] || { icon: 'fa-regular fa-bell', color: '#64748b' };
    const prio = n.priority === 'high' ? 'high' : n.priority === 'low' ? 'low' : 'medium';
    return `
        <article class="nt-entry prio-${prio}${n.is_read ? '' : ' unread'}" role="button" tabindex="0"
            onclick="openNotification(${jsArg(n.id)})"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openNotification(${jsArg(n.id)});}">
            <span class="nt-icon" style="--c:${style.color};"><i class="${style.icon}" aria-hidden="true"></i></span>
            <div class="nt-body">
                <div class="nt-top">
                    <h4 class="nt-title">${escapeHtml(n.title)}</h4>
                    ${n.is_read ? '' : '<span class="nt-dot" role="img" aria-label="Unread" title="Unread"></span>'}
                </div>
                <p class="nt-msg">${escapeHtml(n.message || '')}</p>
                <div class="nt-meta">
                    ${prio === 'high' ? '<span class="nt-prio"><span class="nt-pdot" aria-hidden="true"></span>High priority</span>' : ''}
                    <span class="nt-time">${escapeHtml(formatTimeAgo(n.created_at))}</span>
                </div>
            </div>
        </article>`;
}

function paintNotifications() {
    const list = document.getElementById('notifications-list-inject');
    if (!list) return;
    const all = window.__notifications || [];
    const filter = window.__notifFilter || 'all';

    if (all.length === 0) {
        list.innerHTML = `
            <div class="nt-empty">
                <i class="fa-regular fa-bell" aria-hidden="true"></i>
                <p>You have no notifications.</p>
                <span>New case assignments and reminders will appear here.</span>
            </div>`;
        return;
    }

    const shown = all.filter((n) =>
        filter === 'unread' ? !n.is_read : filter === 'high' ? n.priority === 'high' : true
    );
    if (shown.length === 0) {
        const msg = filter === 'unread' ? 'You are all caught up.' : 'No high priority notifications.';
        list.innerHTML = `
            <div class="nt-empty">
                <i class="fa-regular fa-circle-check" aria-hidden="true"></i>
                <p>${msg}</p>
                <span>Choose All to see every notification.</span>
            </div>`;
        return;
    }

    const groups = [];
    shown.forEach((n) => {
        const label = notifDayLabel(n.created_at);
        let g = groups.find((x) => x.label === label);
        if (!g) groups.push((g = { label, items: [] }));
        g.items.push(n);
    });

    list.innerHTML = groups
        .map(
            (g) => `
            <section class="nt-group">
                <div class="nt-group-head"><h5>${g.label}</h5><span>${g.items.length}</span></div>
                ${g.items.map(notifEntryHtml).join('')}
            </section>`
        )
        .join('');
}

function setupNotificationFilters() {
    const wrap = document.querySelector('.nt-filters');
    if (!wrap) return;
    wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('.nt-filter');
        if (!btn) return;
        window.__notifFilter = btn.dataset.nfilter;
        wrap.querySelectorAll('.nt-filter').forEach((b) => {
            const on = b === btn;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        paintNotifications();
    });
}

window.openNotification = async function (id) {
    const n = (window.__notifications || []).find((x) => x.id === id);
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
    } else if (n.link_type === 'appointment' && n.link_id) {
        window.focusAppointmentRequest(n.link_id);
    } else {
        const target = { client: 'clients-view', case: 'cases-view', document: 'documents-view' }[n.link_type];
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
                .select('id, subject, secure_subject, recipient_email, status, attempts, category, sent_at, created_at')
                .neq('kind', 'client_message')
                .order('created_at', { ascending: false })
                .limit(100),
            supabaseClient
                .from('email_queue')
                .select('id', { count: 'exact', head: true })
                .neq('kind', 'client_message')
                .eq('status', 'sent')
        ]);
        if (listRes.error) throw listRes.error;

        const rows = document.querySelectorAll('.notif-sidebar-container .stat-row');
        if (rows[2] && rows[2].lastElementChild) rows[2].lastElementChild.textContent = sentRes.count || 0;

        const emails = listRes.data || [];
        if (emails.length === 0) {
            list.innerHTML = `
                <div class="nt-empty">
                    <i class="fa-regular fa-envelope" aria-hidden="true"></i>
                    <p>No emails in the queue.</p>
                    <span>Client updates and reminders you send will be listed here.</span>
                </div>`;
            return;
        }

        list.innerHTML = emails
            .map(
                (m) => `
                <div class="nt-entry nt-email${m.status === 'failed' ? ' is-failed' : ''}">
                    <span class="nt-icon" style="--c:${m.status === 'failed' ? '#c23a3a' : '#64748b'};"><i class="fa-regular fa-envelope" aria-hidden="true"></i></span>
                    <div class="nt-body">
                        <div class="nt-top">
                            <h4 class="nt-title">${escapeHtml(m.secure_subject != null ? m.secure_subject : m.subject)}</h4>
                        </div>
                        <p class="nt-msg">${m.category === 'reminder' ? 'Reminder' : 'Case update'} to ${escapeHtml(m.recipient_email)}</p>
                        <div class="nt-meta"><span class="nt-time">${escapeHtml(emailTimeText(m))}</span></div>
                        ${m.last_error && m.status !== 'sent' ? `<p class="nt-error">${escapeHtml(m.last_error)}</p>` : ''}
                    </div>
                    <div class="nt-side">
                        ${emailStatusPill(m.status)}
                        ${m.status === 'failed' ? `<button type="button" class="nt-retry" onclick="retryEmail(${jsArg(m.id)})"><i class="fa-solid fa-rotate-right"></i> Retry</button>` : ''}
                    </div>
                </div>`
            )
            .join('');
    } catch (error) {
        console.error('Error rendering email queue:', error);
        list.innerHTML = errorStateHtml('Could not load the email queue.', 'renderEmailQueueList');
    }
}

window.retryEmail = async function (id) {
    const { error } = await supabaseClient.rpc('retry_email', { p_id: id });
    if (error) {
        showToast('Could not retry this email: ' + error.message, 'error');
        return;
    }
    await renderEmailQueueList();
};

function setupNotificationActions() {
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
    setupNotificationFilters();
    const notifTabs = document.querySelectorAll('.notif-tab-btn');

    notifTabs.forEach((tab) => {
        tab.addEventListener('click', function () {
            const targetId = this.getAttribute('data-notiftab');
            if (!targetId) return;

            notifTabs.forEach((btn) => btn.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.notif-content-pane').forEach((content) => {
                content.classList.add('hidden');
            });

            const activeContent = document.getElementById(targetId);
            if (activeContent) activeContent.classList.remove('hidden');
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
    const unit = (n, word) => `${n} ${word}${n === 1 ? '' : 's'} ago`;

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return unit(Math.floor(seconds / 60), 'minute');
    if (seconds < 86400) return unit(Math.floor(seconds / 3600), 'hour');
    return unit(Math.floor(seconds / 86400), 'day');
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
                    confirmLogoutBtn.innerText = 'Logging out...';
                    confirmLogoutBtn.disabled = true;

                    await logSystemEvent('LOGOUT', 'auth', `${globalUserName || 'User'} signed out`, null, {
                        role: globalRoleName
                    });
                    const { error } = await supabaseClient.auth.signOut();

                    if (error) throw error;

                    window.location.href = 'login.html';
                } catch (error) {
                    console.error('Logout error:', error.message);
                    confirmLogoutBtn.innerText = 'Logout Failed';
                    confirmLogoutBtn.disabled = false;

                    setTimeout(() => {
                        confirmLogoutBtn.innerText = 'Logout';
                    }, 2000);
                }
            });
        }
    } else if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await logSystemEvent('LOGOUT', 'auth', `${globalUserName || 'User'} signed out`, null, {
                role: globalRoleName
            });
            await supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        });
    }
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
            .select(
                casesSelect(
                    'id, case_number, case_type, case_description, title, status, client_id, date_filed, court_case_no, court_branch, case_stage, clients(client_name)',
                    true
                )
            )
            .eq('status', 'active')
            .eq('case_lawyers.lawyer_id', currentUser.id)
            .order('created_at', { ascending: false });
        if (error) throw error;

        (cases || []).forEach((c) => {
            window.__eventCasesMap[c.id] = c;
        });

        const hasCases = (cases || []).length > 0;
        caseSelect.innerHTML =
            `<option value="">${hasCases ? 'Select a case' : 'No active cases yet'}</option>` +
            (cases || [])
                .map((c) => {
                    const label = `${c.case_number ? '#' + c.case_number + ' — ' : ''}${c.title}${c.clients?.client_name ? ' (' + c.clients.client_name + ')' : ''}`;
                    return `<option value="${c.id}">${escapeHtml(label)}</option>`;
                })
                .join('');
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

function setEventLocationHint(loc, message) {
    let hint = document.getElementById('event-location-hint');
    if (!message) {
        if (hint) hint.remove();
        return;
    }
    if (!hint) {
        hint = document.createElement('p');
        hint.id = 'event-location-hint';
        hint.className = 'ev-hint ev-hint-tight';
        loc.parentNode.insertAdjacentElement('afterend', hint);
    }
    hint.innerHTML = '<i class="fa-solid fa-lock"></i> ' + escapeHtml(message);
}

function syncEventLocationWithCase(c) {
    const loc = document.getElementById('event-location');
    if (!loc) return;
    const wasLocked = loc.dataset.locked === '1';
    Array.from(loc.options).forEach((o) => {
        if (o.dataset.court === '1') o.remove();
    });

    const court = c && c.court_branch ? String(c.court_branch).trim() : '';
    if (!court) {
        loc.disabled = false;
        loc.dataset.locked = '';
        if (wasLocked) loc.value = '';
        setEventLocationHint(loc, '');
        loc.dispatchEvent(new Event('change'));
        return;
    }
    const opt = document.createElement('option');
    opt.value = court;
    opt.textContent = court + ' (Court)';
    opt.dataset.court = '1';
    loc.insertBefore(opt, loc.options[1] || null);
    loc.value = court;
    loc.disabled = true;
    loc.dataset.locked = '1';
    setEventLocationHint(loc, "Location is set from this case's court and can't be changed.");
    loc.dispatchEvent(new Event('change'));
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
            ${c.defendant_name || c.defendant_counsel ? `<div><strong>Defendant:</strong> ${escapeHtml([c.defendant_name, c.defendant_counsel ? 'Lawyer: ' + c.defendant_counsel : ''].filter(Boolean).join(' • '))}</div>` : ''}
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

    const locSelect = document.getElementById('event-location');
    if (locSelect) {
        if (!Array.from(locSelect.options).some((o) => o.value === 'other')) {
            const opt = document.createElement('option');
            opt.value = 'other';
            opt.textContent = 'Others (type below)';
            locSelect.appendChild(opt);
        }

        let customInput = document.getElementById('event-location-custom');
        if (!customInput) {
            customInput = document.createElement('input');
            customInput.type = 'text';
            customInput.id = 'event-location-custom';
            customInput.placeholder = 'Type custom location...';
            customInput.style.cssText =
                'width:100%; padding:10px 12px; border:1px solid #d5cfc2; border-radius:6px; background:#f7f5f0; font-family:inherit; margin-top:8px; display:none; box-sizing:border-box;';
            locSelect.parentNode.appendChild(customInput);
        }

        locSelect.removeEventListener('change', window.__locSelectHandler);
        window.__locSelectHandler = () => {
            if (locSelect.value === 'other') {
                customInput.style.display = 'block';
            } else {
                customInput.style.display = 'none';
                customInput.value = '';
            }
        };
        locSelect.addEventListener('change', window.__locSelectHandler);
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

async function uploadCaseDocument(
    file,
    { caseId = null, clientId = null, category = 'Attachment', tag = '', title = null } = {}
) {
    if (!file) return null;

    const blockedReason = await validateUploadFile(file);
    if (blockedReason) throw new Error(blockedReason);

    const uniqueFileName = `${Date.now()}_${safeStorageName(file.name)}`;
    const { error: uploadError } = await supabaseClient.storage.from('documents').upload(uniqueFileName, file);

    if (uploadError) {
        console.error('Storage Error:', uploadError);
        throw new Error(
            "Failed to upload attachment. Please check if the 'documents' bucket exists and your account is allowed to upload to it."
        );
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

    let clearBtn = document.getElementById('add-event-attach-clear');
    if (attachInput && attachNameInput && !clearBtn) {
        clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.id = 'add-event-attach-clear';
        clearBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Remove attachment';
        clearBtn.style.cssText =
            'display:none; margin-top:8px; font-size:12px; padding:6px 10px; background:#f9e1e1; color:#c23a3a; border:none; border-radius:4px; cursor:pointer; font-weight:600;';
        attachNameInput.parentElement.appendChild(clearBtn);

        attachInput.addEventListener('change', () => {
            const hasFile = attachInput.files.length > 0;
            attachNameInput.value = hasFile ? attachInput.files[0].name : '';
            clearBtn.style.display = hasFile ? 'inline-block' : 'none';
        });

        clearBtn.addEventListener('click', () => {
            attachInput.value = '';
            attachNameInput.value = '';
            clearBtn.style.display = 'none';
        });
    }

    function resetEventForm() {
        if (form) form.reset();
        clearEventFieldErrors();

        const customInput = document.getElementById('event-location-custom');
        if (customInput) {
            customInput.style.display = 'none';
            customInput.value = '';
        }

        if (clearBtn) clearBtn.style.display = 'none';

        const existingCaseSelectReset = document.getElementById('event-existing-case');
        if (existingCaseSelectReset) existingCaseSelectReset.value = '';
        handleEventCaseSelectChange();

        [
            [clientSection, clientIcon],
            [caseSection, caseIcon]
        ].forEach(([section, icon]) => {
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
        form.querySelectorAll('.event-field-error').forEach((n) => n.remove());
        form.querySelectorAll('[data-had-error]').forEach((el) => {
            el.style.borderColor = el.dataset.prevBorder || '';
            el.removeAttribute('data-had-error');
        });
    }

    function markEventFieldInvalid(el, message) {
        el.dataset.prevBorder = el.style.borderColor || '';
        el.setAttribute('data-had-error', '1');
        el.style.borderColor = '#d64545';

        const note = document.createElement('div');
        note.className = 'event-field-error';
        note.textContent = message;
        note.style.cssText = 'color:#d64545; font-size:12px; margin-top:4px;';

        const wrapper = el.parentElement;
        const anchor = el.tagName === 'SELECT' && wrapper && !wrapper.classList.contains('form-group') ? wrapper : el;
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
        const val = (id) => (document.getElementById(id)?.value || '').trim();
        const need = (id, message) => {
            if (!val(id)) problems.push({ el: document.getElementById(id), message });
        };

        need('event-title', 'Event title is required.');
        need('event-date', 'Please pick a date.');
        need('event-time', 'Please pick a start time.');
        need('event-priority', 'Please choose a priority.');

        let locVal = val('event-location');
        if (locVal === 'other') locVal = val('event-location-custom');
        if (!locVal) {
            problems.push({
                el: document.getElementById('event-location'),
                message: 'Please select or type a location.'
            });
        }

        const isAdmin = typeof globalUserRole !== 'undefined' && globalUserRole === 'administrator';
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

        problems.forEach((p) => {
            if (p.el) markEventFieldInvalid(p.el, p.message);
        });

        const first = problems.find((p) => p.el)?.el;
        if (
            clientSection &&
            clientSection.classList.contains('hidden') &&
            problems.some((p) => p.el && clientSection.contains(p.el))
        ) {
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
                submitBtn.innerText = 'Saving...';
            }

            const title = document.getElementById('event-title').value;
            const date = document.getElementById('event-date').value;
            const timeInput = document.getElementById('event-time').value;
            const endDateInput = document.getElementById('event-end-date').value;
            const endTimeInput = document.getElementById('event-end-time').value;
            const priority = document.getElementById('event-priority').value;

            const locationSelectVal = document.getElementById('event-location').value;
            let location = locationSelectVal;
            if (locationSelectVal === 'other') {
                location = document.getElementById('event-location-custom')?.value.trim() || '';
            }

            let isGeneral = globalUserRole === 'administrator';
            let assignedLawyerId = isGeneral ? null : currentUser.id;

            const existingCaseSelect = document.getElementById('event-existing-case');
            const selectedExistingCaseId = existingCaseSelect ? existingCaseSelect.value : '';
            const linkedCase = (window.__eventCasesMap || {})[selectedExistingCaseId] || null;

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
                            submitBtn.innerText = 'Save Event';
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
                    showToast(
                        "You can't schedule an event on a past date. Please choose today or a future date.",
                        'warning'
                    );
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = 'Save Event';
                    }
                    return;
                }
            }

            if (!isGeneral && assignedLawyerId && eventDateTimeISO) {
                const bufferMs = eventEndDateTimeISO
                    ? new Date(eventEndDateTimeISO) - new Date(eventDateTimeISO)
                    : 60 * 60 * 1000;
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
                    showToast(
                        `Cannot schedule this event: this lawyer already has "${conflictEvent.title}" at ${formatEventTime(conflictEvent.start_date)} on ${formatDate(conflictEvent.start_date)}. Events for the same lawyer need enough gap between them based on this event's duration.`,
                        'warning'
                    );
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = 'Save Event';
                    }
                    return;
                }
            }

            if (CONFERENCE_ROOMS.includes(location) && eventDateTimeISO) {
                const bufferMs = eventEndDateTimeISO
                    ? new Date(eventEndDateTimeISO) - new Date(eventDateTimeISO)
                    : 60 * 60 * 1000;
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
                    showToast(
                        `Cannot schedule this event: "${location}" is already booked for "${conflictEvent.title}" at ${formatEventTime(conflictEvent.start_date)} on ${formatDate(conflictEvent.start_date)}. Bookings for the same room need enough gap between them based on this event's duration.`,
                        'warning'
                    );
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = 'Save Event';
                    }
                    return;
                }
            }

            try {
                const newClientId = linkedCase ? linkedCase.client_id : null;
                const newCaseId = linkedCase ? linkedCase.id : null;
                const finalCaseNumber = linkedCase ? linkedCase.case_number || '' : '';

                const attachmentInput = document.getElementById('event-attachment');
                const attachmentFile =
                    attachmentInput && attachmentInput.files.length > 0 ? attachmentInput.files[0] : null;
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

                showToast(
                    isGeneral
                        ? 'Firm-wide event successfully added!'
                        : 'Event successfully added' +
                              (finalCaseNumber ? ` and linked to case #${finalCaseNumber}.` : '.'),
                    'success'
                );

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
                    if (typeof renderTimelineInSchedule === 'function') renderTimelineInSchedule();
                }
            } catch (error) {
                console.error('Error saving:', error);
                showToast('Error: \n' + error.message, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Create Event';
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
            .select(
                'id, title, location, start_date, end_date, is_general, assigned_to, profiles(full_name), cases(clients(client_name))'
            )
            .gte('start_date', todayStart)
            .lte('start_date', todayEnd)
            .order('start_date', { ascending: true });

        const allRooms = CONFERENCE_ROOMS;
        const now = new Date();
        const roomBufferMs = 60 * 60 * 1000;

        window.__roomEventsRegistry = {};

        const roomsHtml = allRooms
            .map((room) => {
                const roomEvents = (events || []).filter(
                    (e) => (e.location || '').trim().toLowerCase() === room.toLowerCase()
                );

                const currentBooking = roomEvents.find((e) => {
                    return isEventOngoing(e.start_date, e.end_date, now);
                });

                const isBusy = !!currentBooking;
                const tagClass = isBusy ? 'tag-busy' : 'tag-avail';
                const tagText = isBusy ? 'Busy Now' : 'Available';
                const tagStyle = '';

                let subText = '';
                let linkedEvent = null;

                if (currentBooking) {
                    const bookedBy = currentBooking.is_general
                        ? 'Firm-wide'
                        : currentBooking.profiles?.full_name
                          ? `Atty. ${currentBooking.profiles.full_name}`
                          : 'a lawyer';
                    const untilTime = formatEventTime(
                        getEventEndTime(currentBooking.start_date, currentBooking.end_date).toISOString()
                    );
                    subText = `Until ${untilTime} • ${currentBooking.title || 'Booked'} (${bookedBy})`;
                    linkedEvent = currentBooking;
                } else {
                    const nextBooking = roomEvents.find((e) => new Date(e.start_date) > now);
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
                            <span style="color:#252d3a; font-weight:500;">${room}</span>
                            <span class="tag ${tagClass}" style="font-size:12px; padding:3px 8px; border-radius:4px; font-weight:bold; ${tagStyle}">
                                ${tagText}
                            </span>
                        </div>
                        ${subText ? `<span style="color:#64748b; font-size:12px; margin-top:3px;">${escapeHtml(subText)}${linkedEvent ? ' <i class="fa-solid fa-circle-info" style="margin-left:4px;"></i>' : ''}</span>` : ''}
                    </div>
                `;
            })
            .join('');

        const isLawyerView = globalUserRole === 'lawyer' && currentUser;
        let courtQuery = supabaseClient
            .from('calendar_events')
            .select(
                'id, title, location, start_date, end_date, is_general, assigned_to, profiles(full_name), cases(clients(client_name))'
            )
            .gte('start_date', todayStart)
            .not('location', 'is', null)
            .not('location', 'in', `(${CONFERENCE_ROOMS.map((r) => `"${r}"`).join(',')})`)
            .order('start_date', { ascending: true })
            .limit(40);
        if (isLawyerView) courtQuery = courtQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
        const { data: courtData } = await courtQuery;
        const courtEvents = (courtData || []).filter((e) => (e.location || '').trim() !== '');

        const courtGroups = {};
        courtEvents.forEach((e) => {
            const key = e.location.trim().toLowerCase();
            if (!courtGroups[key]) courtGroups[key] = { name: e.location.trim(), events: [] };
            courtGroups[key].events.push(e);
        });

        const dateLabel = (iso) =>
            toLocalDateKey(iso) === todayStr
                ? 'Today'
                : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        let courtsHtml = '<div class="loc-subhead">Courts and other locations</div>';
        const groups = Object.values(courtGroups);
        if (groups.length === 0) {
            courtsHtml += '<p class="loc-empty">No court locations scheduled yet.</p>';
        } else {
            courtsHtml += groups
                .map((g) => {
                    const shown = g.events.slice(0, 4);
                    const rows = shown
                        .map((e) => {
                            window.__roomEventsRegistry[e.id] = { ...e, roomName: g.name };
                            const end = e.end_date
                                ? new Date(e.end_date)
                                : new Date(new Date(e.start_date).getTime() + roomBufferMs);
                            const done = now >= end;
                            const who = e.is_general
                                ? 'Firm-wide'
                                : e.profiles?.full_name
                                  ? `Atty. ${e.profiles.full_name}`
                                  : 'Unassigned';
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
                        })
                        .join('');
                    const more =
                        g.events.length > shown.length
                            ? `<div class="loc-more">+${g.events.length - shown.length} more</div>`
                            : '';
                    return `
                        <div class="loc-court">
                            <div class="loc-court-head">
                                <span class="loc-court-name"><i class="fa-solid fa-landmark"></i> ${escapeHtml(g.name)}</span>
                                <span class="loc-court-count">${g.events.length}</span>
                            </div>
                            ${rows}
                            ${more}
                        </div>`;
                })
                .join('');
        }

        list.innerHTML = roomsHtml + courtsHtml;
    } catch (error) {
        console.error('Error rendering resources:', error);
    }
}

window.openRoomBookingDetails = function (eventId) {
    const modal = document.getElementById('room-booking-modal');
    const titleEl = document.getElementById('room-booking-title');
    const bodyEl = document.getElementById('room-booking-body');
    if (!modal || !bodyEl) return;

    const ev = (window.__roomEventsRegistry || {})[eventId];
    if (!ev) return;

    const bookedBy = ev.is_general
        ? 'Firm-wide (All Lawyers)'
        : ev.profiles?.full_name
          ? `Atty. ${ev.profiles.full_name}`
          : 'Unassigned';
    const clientName = ev.cases?.clients?.client_name || 'No Client';

    titleEl.textContent = ev.title || 'Booking Details';
    bodyEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid fa-location-dot" style="width:16px; color:#64748b;"></i>
                <span><strong>${ev.roomName}</strong></span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-regular fa-calendar" style="width:16px; color:#64748b;"></i>
                <span>${formatDate(ev.start_date)} at ${formatEventTime(ev.start_date)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid fa-gavel" style="width:16px; color:#64748b;"></i>
                <span>Booked by: <strong>${escapeHtml(bookedBy)}</strong></span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid fa-user" style="width:16px; color:#64748b;"></i>
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

const PAGER_SIZES = [10, 25, 50, 100];
const pagerState = {};

function pagerGet(key) {
    if (!pagerState[key]) pagerState[key] = { page: 1, size: 25, sig: '', redraw: null, anchor: '' };
    return pagerState[key];
}

function pagerBind(key, redraw, anchorId) {
    const st = pagerGet(key);
    st.redraw = redraw;
    st.anchor = anchorId || '';
    return st;
}

function pagerSlice(key, items, signature) {
    const st = pagerGet(key);
    if (signature !== undefined && st.sig !== signature) {
        st.sig = signature;
        st.page = 1;
    }
    const pages = Math.max(1, Math.ceil(items.length / st.size));
    if (st.page > pages) st.page = pages;
    const start = (st.page - 1) * st.size;
    return {
        rows: items.slice(start, start + st.size),
        page: st.page,
        pages: pages,
        total: items.length,
        start: start,
        size: st.size
    };
}

function pagerHtml(key, info, noun) {
    if (!info || info.total <= PAGER_SIZES[0]) return '';
    const end = Math.min(info.start + info.size, info.total);
    const sizeOptions = PAGER_SIZES.map(
        (n) => `<option value="${n}" ${n === info.size ? 'selected' : ''}>${n}</option>`
    ).join('');
    const btn = (nav, label, disabled, aria) =>
        `<button type="button" class="pg-btn" data-pg-nav="${nav}" aria-label="${aria}" ${disabled ? 'disabled' : ''}>${label}</button>`;
    return `
        <div class="pg-bar" data-pager="${escapeHtml(key)}" data-pages="${info.pages}">
            <span class="pg-info">Showing ${info.start + 1}-${end} of ${info.total} ${escapeHtml(noun)}</span>
            <div class="pg-controls">
                <label class="pg-size">Rows per page
                    <select data-pg-size aria-label="Rows per page">${sizeOptions}</select>
                </label>
                ${btn('first', '<i class="fa-solid fa-angles-left"></i>', info.page <= 1, 'First page')}
                ${btn('prev', '<i class="fa-solid fa-angle-left"></i> Previous', info.page <= 1, 'Previous page')}
                <span class="pg-page">Page ${info.page} of ${info.pages}</span>
                ${btn('next', 'Next <i class="fa-solid fa-angle-right"></i>', info.page >= info.pages, 'Next page')}
                ${btn('last', '<i class="fa-solid fa-angles-right"></i>', info.page >= info.pages, 'Last page')}
            </div>
        </div>`;
}

function pagerClear(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
}

function pagerRedraw(st) {
    if (typeof st.redraw === 'function') st.redraw();
    const anchor = st.anchor ? document.getElementById(st.anchor) : null;
    if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pg-nav]');
    if (!btn || btn.disabled) return;
    const bar = btn.closest('[data-pager]');
    if (!bar) return;
    const st = pagerGet(bar.dataset.pager);
    const pages = Number(bar.dataset.pages) || 1;
    const nav = btn.dataset.pgNav;
    if (nav === 'first') st.page = 1;
    else if (nav === 'prev') st.page = Math.max(1, st.page - 1);
    else if (nav === 'next') st.page = Math.min(pages, st.page + 1);
    else if (nav === 'last') st.page = pages;
    pagerRedraw(st);
});

document.addEventListener('change', (e) => {
    const select = e.target.closest('[data-pg-size]');
    if (!select) return;
    const bar = select.closest('[data-pager]');
    if (!bar) return;
    const st = pagerGet(bar.dataset.pager);
    const size = Number(select.value);
    st.size = PAGER_SIZES.includes(size) ? size : 25;
    st.page = 1;
    pagerRedraw(st);
});

async function fetchAllRows(buildQuery, batchSize = 1000, maxRows = 20000) {
    const all = [];
    for (let from = 0; from < maxRows; from += batchSize) {
        const { data, error } = await buildQuery().range(from, from + batchSize - 1);
        if (error) return { data: null, error: error };
        all.push(...(data || []));
        if (!data || data.length < batchSize) break;
    }
    return { data: all, error: null };
}

async function renderCasesTabView() {
    const casesList = document.getElementById('cases-list-inject');
    if (!casesList) return;

    casesList.innerHTML = skeletonCards(3);

    try {
        const isLawyer = globalUserRole === 'lawyer' && currentUser;

        const buildCasesQuery = () => {
            let casesQuery = supabaseClient
                .from('cases')
                .select(casesSelect('*, clients(id, client_name, client_email, client_phone, full_address)', !!isLawyer))
                .order('created_at', { ascending: false })
                .order('id', { ascending: true });
            if (isLawyer) casesQuery = filterMyCases(casesQuery);
            return casesQuery;
        };

        const { data: cases, error } = await fetchAllRows(buildCasesQuery);
        if (error) throw error;

        window.__casesRegistry = {};
        (cases || []).forEach((c) => {
            window.__casesRegistry[c.id] = c;
        });
        paintCasesList();
    } catch (error) {
        console.error('Error loading cases tab:', error);
        casesList.innerHTML = errorStateHtml('Could not load cases.', 'renderCasesTabView');
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
    const filtersOn =
        !!(from || to || term) || fStatus !== 'all' || fType !== 'all' || fParty !== 'all' || fStage !== 'all';
    if (clearBtn) clearBtn.classList.toggle('hidden', !filtersOn);

    const all = Object.values(window.__casesRegistry || {});

    const cases = all.filter((c) => {
        const opened = toLocalDateKey(c.date_filed || c.created_at);
        if (from && opened < from) return false;
        if (to && opened > to) return false;
        if (fStatus !== 'all' && (c.status || 'active') !== fStatus) return false;
        if (fType !== 'all' && c.case_type !== fType) return false;
        if (fParty !== 'all' && c.party_type !== fParty) return false;
        if (fStage !== 'all' && c.case_stage !== fStage) return false;
        if (term) {
            const lawyers = (c.case_lawyers || []).map((r) => r.profiles && r.profiles.full_name);
            const haystack = [c.title, c.case_number, c.court_branch, c.defendant_name, c.defendant_counsel, c.clients && c.clients.client_name, ...lawyers]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            if (!haystack.includes(term)) return false;
        }
        return true;
    });

    if (countEl) countEl.textContent = filtersOn ? `${cases.length} of ${all.length} cases` : `Total: ${all.length}`;
    window.__casesFiltered = cases;

    if (all.length === 0) {
        casesList.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">No cases yet.</p>';
        return;
    }
    if (cases.length === 0) {
        casesList.innerHTML =
            '<p style="color:#64748b; text-align:center; padding:30px;">No cases match your search or filters.</p>';
        return;
    }

    const sort = window.__casesSort || { key: 'date_filed', dir: 'desc' };
    const sortValue =
        {
            title: (c) => (c.title || '').toLowerCase(),
            client: (c) => ((c.clients && c.clients.client_name) || '').toLowerCase(),
            case_type: (c) => (c.case_type || '').toLowerCase(),
            case_stage: (c) => (c.case_stage || '').toLowerCase(),
            date_filed: (c) => new Date(c.date_filed || c.created_at || 0).getTime(),
            status: (c) => c.status || 'active'
        }[sort.key] || (() => 0);
    cases.sort((a, b) => {
        const x = sortValue(a),
            y = sortValue(b);
        const r = x < y ? -1 : x > y ? 1 : 0;
        return sort.dir === 'asc' ? r : -r;
    });

    const th = (key, label) => {
        const active = sort.key === key;
        const arrow = active ? (sort.dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort';
        return `<th class="ct-sortable${active ? ' ct-sorted' : ''}" data-case-sort="${key}" tabindex="0" role="button" aria-label="Sort by ${label}">${label} <i class="fa-solid ${arrow}"></i></th>`;
    };

    const canEditCase = globalRoleName === 'admin' || globalRoleName === 'lawyer';

    pagerBind('cases', paintCasesList, 'cases-list-inject');
    const pageInfo = pagerSlice(
        'cases',
        cases,
        JSON.stringify([from, to, term, fStatus, fType, fParty, fStage, sort.key, sort.dir])
    );

    const rows = pageInfo.rows
        .map((c) => {
            const isClosed = c.status === 'closed';
            const clientName = escapeHtml(c.clients?.client_name || (c.client_id ? 'Linked client' : 'No Client'));
            const linkClientBtn =
                !c.client_id && canEditCase
                    ? `<button type="button" class="cr-plus-btn" onclick="openLinkClient('${c.id}')" title="Link a client" aria-label="Link a client"><i class="fa-solid fa-plus"></i></button>`
                    : '';
            const lawyers = (c.case_lawyers || [])
                .slice()
                .sort((a, b) => (rowIsLead(b) ? 1 : 0) - (rowIsLead(a) ? 1 : 0));
            const lawyerCell = lawyers.length
                ? lawyers
                      .map(
                          (r) =>
                              `<div class="ct-lawyer">${rowIsLead(r) ? '<i class="fa-solid fa-gavel"></i> ' : ''}Atty. ${escapeHtml(rowName(r) || 'Unknown')}</div>`
                      )
                      .join('')
                : '<span class="ct-muted">Not assigned</span>';

            const textBtn = (onclick, icon, label, tone) =>
                `<button type="button" class="ct-text-btn ${tone}" style="width:132px;justify-content:center;white-space:nowrap;" onclick="${onclick}"><i class="fa-solid ${icon}"></i> ${label}</button>`;

            const actions = [];
            if (canEditCase) {
                actions.push(
                    isClosed
                        ? textBtn(`toggleCaseStatus('${c.id}', 'closed')`, 'fa-rotate-left', 'Reopen', 'ct-blue')
                        : textBtn(
                              `toggleCaseStatus('${c.id}', '${c.status || 'active'}')`,
                              'fa-lock',
                              'Close case',
                              'ct-green'
                          )
                );
            }
            actions.push(
                `<button type="button" class="ct-icon-btn ct-menu-btn" data-row-menu="${c.id}" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${escapeHtml(c.title)}" title="More actions"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button>`
            );

            return `
                <tr>
                    <td class="ct-name">
                        ${escapeHtml(c.title)}
                        <div class="ct-sub">${c.case_number ? '#' + escapeHtml(c.case_number) : ''}${c.court_branch ? (c.case_number ? ' • ' : '') + escapeHtml(c.court_branch) : ''}</div>
                    </td>
                    <td>${clientName}${linkClientBtn}</td>
                    <td>${escapeHtml(c.case_type || 'General')}${c.party_type ? `<div class="ct-sub">${escapeHtml(c.party_type)}</div>` : ''}</td>
                    <td>${c.case_stage ? `<span class="ct-badge ct-badge-stage">${escapeHtml(c.case_stage)}</span>` : '<span class="ct-muted">-</span>'}</td>
                    <td>${formatDate(c.date_filed || c.created_at)}</td>
                    <td>${lawyerCell}</td>
                    <td><span class="ct-badge ${isClosed ? 'ct-badge-closed' : 'ct-badge-active'}">${isClosed ? 'Closed' : 'Active'}</span></td>
                    <td class="ct-actions"><div>${actions.join('')}</div></td>
                </tr>`;
        })
        .join('');

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
            </div>
            ${pagerHtml('cases', pageInfo, cases.length === 1 ? 'case' : 'cases')}`;
}

function setupCasesTabControls() {
    const tabs = document.querySelectorAll('.cases-tab-btn');
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach((t) => {
                const active = t === tab;
                t.classList.toggle('active', active);
                t.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            document.querySelectorAll('.cases-tab-content').forEach((panel) => {
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
        el.innerHTML =
            `<option value="all">${allLabel}</option>` +
            list.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    };
    fillFilter(typeEl, 'All case types', CASE_TYPES);
    fillFilter(partyEl, 'All party types', PARTY_TYPES);
    fillFilter(stageEl, 'All stages', CASE_STAGES);

    const casesListEl = document.getElementById('cases-list-inject');
    if (casesListEl) {
        const applySort = (th) => {
            const key = th.getAttribute('data-case-sort');
            const cur = window.__casesSort || { key: 'date_filed', dir: 'desc' };
            window.__casesSort = { key: key, dir: cur.key === key && cur.dir === 'asc' ? 'desc' : 'asc' };
            paintCasesList();
        };
        casesListEl.addEventListener('click', (e) => {
            const th = e.target.closest('[data-case-sort]');
            if (th) applySort(th);
        });
        casesListEl.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const th = e.target.closest('[data-case-sort]');
            if (th) {
                e.preventDefault();
                applySort(th);
            }
        });
    }

    let searchTimer = null;
    if (searchEl)
        searchEl.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(paintCasesList, 150);
        });
    [statusEl, typeEl, partyEl, stageEl].forEach((el) => {
        if (el) el.addEventListener('change', paintCasesList);
    });

    const onDateChange = () => {
        if (toEl && fromEl) toEl.min = fromEl.value || '';
        if (fromEl && toEl) fromEl.max = toEl.value || '';
        paintCasesList();
    };
    if (fromEl) fromEl.addEventListener('change', onDateChange);
    if (toEl) toEl.addEventListener('change', onDateChange);
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (fromEl) {
                fromEl.value = '';
                fromEl.max = '';
            }
            if (toEl) {
                toEl.value = '';
                toEl.min = '';
            }
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
    return (data || []).filter((ev) => {
        const end = new Date(ev.end_date || ev.start_date);
        if (isNaN(end.getTime())) return false;
        if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
            end.setHours(23, 59, 59, 999);
        }
        return end > now;
    });
}

function pendingEventsMessage(events) {
    const shown = events
        .slice(0, 3)
        .map(
            (ev) =>
                `\u2022 ${ev.title} (${formatDate(ev.start_date)}${formatEventTime(ev.start_date) ? ', ' + formatEventTime(ev.start_date) : ''})`
        )
        .join('\n');
    const more = events.length > 3 ? `\n...and ${events.length - 3} more.` : '';
    return `This case can't be closed yet. It still has ${events.length === 1 ? 'an event' : events.length + ' events'} that ${events.length === 1 ? "hasn't" : "haven't"} happened:\n\n${shown}${more}\n\nClose the case after ${events.length === 1 ? 'it is' : 'they are'} done, or remove the event from the calendar if it was cancelled.`;
}

window.toggleCaseStatus = async function (caseId, currentStatus) {
    const newStatus = currentStatus === 'closed' ? 'active' : 'closed';
    try {
        if (newStatus === 'closed') {
            const pending = await getPendingCaseEvents(caseId);
            if (pending.length > 0) {
                showToast(pendingEventsMessage(pending), 'warning', { duration: 10000 });
                return;
            }
        }
        const { error } = await supabaseClient.from('cases').update({ status: newStatus }).eq('id', caseId);

        if (error) throw error;

        const c = (window.__casesRegistry || {})[caseId];
        const caseLabel = c ? (c.case_number ? '#' + c.case_number + ' - ' : '') + c.title : caseId;
        if (newStatus === 'closed') {
            await logAuditActivity(
                'CLOSE',
                'Cases',
                `Closed case: ${caseLabel}`,
                caseId,
                { status: currentStatus },
                { status: newStatus }
            );
        } else {
            await logAuditActivity(
                'REOPEN',
                'Cases',
                `Reopened case: ${caseLabel}`,
                caseId,
                { status: currentStatus },
                { status: newStatus }
            );
        }

        await renderCasesTabView();
    } catch (error) {
        showToast('Could not update case status: ' + error.message, 'error');
    }
};

function disableBrowserAutofill() {
    [
        'add-event-form',
        'upload-doc-form',
        'add-lawyer-form',
        'admin-add-client-form',
        'tag-lawyer-form',
        'case-email-form'
    ].forEach((id) => {
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

function isAdminUser() {
    return globalRoleName === 'admin';
}
function isStaffUser() {
    return globalRoleName === 'admin' || globalRoleName === 'secretary';
}
function canInviteClients() {
    return globalRoleName === 'admin' || globalRoleName === 'lawyer';
}
function clientNeedsPortalInvite(c) {
    return c.approval_status === 'approved' && !!c.client_email && !c.auth_user_id;
}

function rowIsLead(r) {
    return r.lawyer_role ? r.lawyer_role === 'lead' : !!r.is_lead;
}
function rowName(r) {
    const p = r.lawyer || r.profiles;
    return (p && p.full_name) || '';
}

function teamChipsHtml(rows) {
    const list = rows || [];
    if (list.length === 0) return '<span class="mc-tag mc-tag-unassigned">No lawyer assigned</span>';
    const chip = (r, label) =>
        `<span class="mc-tag"><i class="fa-solid fa-gavel"></i> ${label}: Atty. ${escapeHtml(rowName(r) || 'Unknown')}</span>`;
    return (
        list
            .filter(rowIsLead)
            .map((r) => chip(r, 'Lead'))
            .join('') +
        list
            .filter((r) => !rowIsLead(r))
            .map((r) => chip(r, 'Co-lawyer'))
            .join('')
    );
}

function approvalBadge(status) {
    const styles = {
        pending: 'background:#f8edd2; color:#a2711a;',
        approved: 'background:#dff1e9; color:#16835d;',
        rejected: 'background:#f9e1e1; color:#c23a3a;'
    };
    const labels = { pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected' };
    return `<span style="font-size:12px; padding:3px 10px; border-radius:99px; font-weight:700; margin-left:8px; vertical-align:middle; ${styles[status] || ''}">${labels[status] || escapeHtml(status || '')}</span>`;
}

async function renderClientsView() {
    const listEl = document.getElementById('clients-list-inject');
    if (!listEl) return;
    listEl.innerHTML = skeletonRows(4);

    const subtitle = document.getElementById('clients-subtitle');
    if (subtitle) {
        subtitle.textContent =
            globalRoleName === 'lawyer'
                ? 'Clients assigned to you by the administrator.'
                : isAdminUser()
                  ? 'Approve new clients, assign lawyers and manage client records.'
                  : 'Add new clients. The administrator approves them and assigns a lawyer.';
    }

    try {
        const select =
            'id, client_name, client_email, client_phone, full_address, auth_user_id, created_at, registered_by, approval_status, rejection_reason, archived_at, ' +
            'client_lawyers(lawyer_id, lawyer_role, lawyer:profiles!client_lawyers_lawyer_id_fkey(full_name)), ' +
            'cases(id, title, case_number, status, created_at)';
        const { data: clients, error } = await fetchAllRows(() =>
            supabaseClient
                .from('clients')
                .select(select)
                .order('created_at', { ascending: false })
                .order('id', { ascending: true })
        );
        if (error) throw error;

        window.__clientsDirectory = clients || [];
        paintClientsDirectory();
        renderAdminAttention();
    } catch (err) {
        console.error('Error loading clients:', err);
        const countEl = document.getElementById('clients-count');
        if (countEl) countEl.textContent = '';
        listEl.innerHTML = errorStateHtml('Could not load clients.', 'renderClientsView');
    }
}

function paintClientsDirectory() {
    const listEl = document.getElementById('clients-list-inject');
    const countEl = document.getElementById('clients-count');
    if (!listEl) return;

    const term = (document.getElementById('clients-search')?.value || '').trim().toLowerCase();
    const statusFilter = isStaffUser() ? document.getElementById('clients-status-filter')?.value || 'all' : 'all';
    const all = window.__clientsDirectory || [];
    const live = all.filter((c) => !c.archived_at);

    const clients = all.filter((c) => {
        if (statusFilter === 'archived') {
            if (!c.archived_at) return false;
        } else {
            if (c.archived_at) return false;
            if (statusFilter !== 'all' && c.approval_status !== statusFilter) return false;
        }
        if (!term) return true;
        const haystack = [
            c.client_name,
            c.client_email,
            c.client_phone,
            ...(c.client_lawyers || []).map(rowName),
            ...(c.cases || []).map((cs) => `${cs.title || ''} ${cs.case_number || ''}`)
        ]
            .join(' ')
            .toLowerCase();
        return haystack.includes(term);
    });

    const pending = live.filter((c) => c.approval_status === 'pending').length;
    if (countEl) {
        if (statusFilter === 'archived') {
            countEl.textContent = `Archived: ${clients.length}`;
        } else {
            const base = term || statusFilter !== 'all' ? `${clients.length} of ${live.length}` : `Total: ${live.length}`;
            countEl.textContent = isAdminUser() && pending > 0 ? `${base} • ${pending} pending approval` : base;
        }
    }

    if (all.length === 0) {
        listEl.innerHTML = `<p class="mc-empty">${globalRoleName === 'lawyer' ? 'No clients have been assigned to you yet.' : 'No clients yet.'}</p>`;
        return;
    }
    if (clients.length === 0) {
        listEl.innerHTML =
            statusFilter === 'archived' && !term
                ? '<p class="mc-empty">No archived clients.</p>'
                : '<p class="mc-empty">No clients match your filters.</p>';
        return;
    }

    const staff = isStaffUser();
    const sort = window.__clientsSort || { key: 'created_at', dir: 'desc' };
    const sortValue =
        {
            client_name: (c) => (c.client_name || '').toLowerCase(),
            client_email: (c) => (c.client_email || '').toLowerCase(),
            client_phone: (c) => (c.client_phone || '').toLowerCase(),
            cases: (c) => (c.cases || []).length,
            created_at: (c) => new Date(c.created_at || 0).getTime()
        }[sort.key] || ((c) => 0);
    clients.sort((a, b) => {
        const x = sortValue(a),
            y = sortValue(b);
        const r = x < y ? -1 : x > y ? 1 : 0;
        return sort.dir === 'asc' ? r : -r;
    });

    const th = (key, label) => {
        const active = sort.key === key;
        const arrow = active ? (sort.dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort';
        return `<th class="ct-sortable${active ? ' ct-sorted' : ''}" data-client-sort="${key}" tabindex="0" role="button" aria-label="Sort by ${label}">${label} <i class="fa-solid ${arrow}"></i></th>`;
    };

    const hasInviteSlot = clients.some((c) => !c.archived_at && canInviteClients() && clientNeedsPortalInvite(c));
    const hasMainSlot = isAdminUser();

    pagerBind('clients', paintClientsDirectory, 'clients-list-inject');
    const pageInfo = pagerSlice('clients', clients, JSON.stringify([term, statusFilter, sort.key, sort.dir]));

    const rows = pageInfo.rows
        .map((c) => {
            const cases = c.cases || [];
            const openCases = cases.filter((cs) => cs.status !== 'closed').length;
            const lawyers = (c.client_lawyers || [])
                .slice()
                .sort((a, b) => (rowIsLead(b) ? 1 : 0) - (rowIsLead(a) ? 1 : 0));
            const shownLawyers = lawyers.slice(0, 2);
            const hiddenLawyers = lawyers.slice(2);
            const lawyerCell = lawyers.length
                ? `<div class="ct-lawyer-stack">${shownLawyers
                      .map(
                          (r) =>
                              `<span class="ct-lawyer-chip${rowIsLead(r) ? ' lead' : ''}">${rowIsLead(r) ? '<i class="fa-solid fa-gavel"></i>' : ''}Atty. ${escapeHtml(rowName(r) || 'Unknown')}</span>`
                      )
                      .join('')}${
                      hiddenLawyers.length
                          ? `<span class="ct-lawyer-chip more" title="${escapeHtml(hiddenLawyers.map((r) => 'Atty. ' + (rowName(r) || 'Unknown')).join(', '))}">+${hiddenLawyers.length} more</span>`
                          : ''
                  }</div>`
                : '<span class="ct-muted">Not assigned</span>';
            const isArchived = !!c.archived_at;
            const avatarTone =
                isArchived
                    ? 'ct-avatar-grey'
                    : c.approval_status === 'pending'
                    ? 'ct-avatar-purple'
                    : c.approval_status === 'rejected'
                      ? 'ct-avatar-grey'
                      : 'ct-avatar-blue';
            const clientInitials = (getInitials(String(c.client_name || '').trim()) || '?').slice(0, 2).toUpperCase();

            const iconBtn = (action, icon, label, tone = '') =>
                `<button type="button" class="ct-icon-btn ${tone}" data-client-action="${action}" data-client-id="${c.id}" title="${label}" aria-label="${label}"><i class="fa-solid ${icon}"></i></button>`;
            const textBtn = (action, icon, label, tone) =>
                `<button type="button" class="ct-text-btn ${tone}" data-client-action="${action}" data-client-id="${c.id}"><i class="fa-solid ${icon}"></i> ${label}</button>`;

            const actions = [];
            const menuButtons = [];
            if (hasInviteSlot) {
                actions.push(
                    `<span class="ct-slot ct-slot-invite">${
                        !isArchived && canInviteClients() && clientNeedsPortalInvite(c)
                            ? textBtn('invite', 'fa-paper-plane', 'Send invite', 'ct-amber')
                            : ''
                    }</span>`
                );
            }
            if (hasMainSlot) {
                let mainHtml = '';
                if (isArchived) {
                    mainHtml = textBtn('restore', 'fa-rotate-left', 'Restore', 'ct-green');
                } else if (c.approval_status === 'pending') {
                    mainHtml = textBtn('approve', 'fa-check', 'Approve', 'ct-green');
                    menuButtons.push(iconBtn('reject', 'fa-xmark', 'Reject', 'ct-red'));
                } else if (c.approval_status === 'rejected') {
                    mainHtml = textBtn('approve', 'fa-check', 'Approve', 'ct-green');
                } else {
                    mainHtml = textBtn('assign', 'fa-gavel', 'Assign lawyers', 'ct-blue');
                }
                actions.push(`<span class="ct-slot ct-slot-main">${mainHtml}</span>`);
            }
            menuButtons.unshift(iconBtn('view', 'fa-eye', 'View details'));
            if (isAdminUser()) {
                menuButtons.push(iconBtn('edit', 'fa-pen', 'Edit client'));
                menuButtons.push(
                    isArchived
                        ? iconBtn('delete', 'fa-trash', 'Delete permanently', 'ct-red')
                        : iconBtn('archive', 'fa-box-archive', 'Archive client', 'ct-amber')
                );
            }
            actions.push(rowMenuHtml(menuButtons.join(''), 'Client actions'));

            return `
                <tr>
                    <td class="ct-name">
                        <div class="ct-person">
                            <span class="ct-avatar ${avatarTone}">${escapeHtml(clientInitials)}</span>
                            <div class="ct-person-text">
                                <a href="#" class="ct-name-link" data-client-action="view" data-client-id="${c.id}">${escapeHtml(c.client_name || 'Unnamed client')}</a>
                                <div class="ct-email">${c.client_email ? escapeHtml(c.client_email) : 'No email'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="ct-nowrap">${c.client_phone ? escapeHtml(c.client_phone) : '<span class="ct-muted">-</span>'}</td>
                    <td>${lawyerCell}</td>
                    <td class="ct-nowrap"><span class="ct-count">${cases.length}</span>${openCases > 0 ? `<span class="ct-count-open">${openCases} active</span>` : ''}</td>
                    ${staff ? `<td>${isArchived ? '<span class="ct-badge ct-badge-closed">Archived</span>' : approvalBadge(c.approval_status).replace('margin-left:8px;', '')}</td>` : ''}
                    <td class="ct-actions"><div>${actions.join('')}</div></td>
                </tr>`;
        })
        .join('');

    listEl.innerHTML = `
            <div class="ct-wrap">
                <table class="ct-table ct-clients">
                    <thead>
                        <tr>
                            ${th('client_name', 'Client')}
                            ${th('client_phone', 'Phone')}
                            <th>Lawyer</th>
                            ${th('cases', 'Cases')}
                            ${staff ? '<th>Status</th>' : ''}
                            <th class="ct-actions-head"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${pagerHtml('clients', pageInfo, clients.length === 1 ? 'client' : 'clients')}`;
}

function openClientViewModal(client) {
    const existing = document.getElementById('view-client-modal');
    if (existing) existing.remove();

    const cases = (client.cases || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const caseLines = cases.length
        ? cases
              .map(
                  (cs) =>
                      `<div class="mc-case-line"><strong>${escapeHtml(cs.title)}</strong>${cs.case_number ? `<span class="mc-case-no">#${escapeHtml(cs.case_number)}</span>` : ''}${cs.status === 'closed' ? '<span class="mc-tag mc-tag-closed">Closed</span>' : ''}</div>`
              )
              .join('')
        : '<span class="ct-muted">No cases yet.</span>';
    const field = (label, html) =>
        `<div class="cv-field"><span class="cv-label">${label}</span><div class="cv-value">${html}</div></div>`;
    const rejected =
        client.approval_status === 'rejected' && client.rejection_reason
            ? field('Rejection reason', `<span style="color:#c23a3a;">${escapeHtml(client.rejection_reason)}</span>`)
            : '';

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

    const close = () => {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay) close();
    });
    overlay.querySelector('[data-cv-close]').addEventListener('click', close);
    const editBtn = overlay.querySelector('[data-cv-edit]');
    if (editBtn)
        editBtn.addEventListener('click', () => {
            close();
            openEditClientModal(client);
        });
}

async function handleClientAction(action, clientId) {
    if (action === 'invite') {
        if (!canInviteClients()) return;
    } else if (action !== 'view' && !isAdminUser()) {
        return;
    }
    const client = (window.__clientsDirectory || []).find((c) => String(c.id) === String(clientId));
    if (!client) return;

    try {
        if (action === 'view') {
            openClientViewModal(client);
        } else if (action === 'invite') {
            await sendPortalInviteToClient(client);
        } else if (action === 'approve' || action === 'assign') {
            await openTeamModal('client', client.id, { approve: action === 'approve' });
        } else if (action === 'reject') {
            const reason = await promptDialog({
                title: 'Reject client',
                message: `Reject ${client.client_name}?`,
                label: 'Reason (optional)',
                placeholder: 'e.g., Incomplete documents',
                confirmLabel: 'Reject',
                danger: true,
                multiline: true
            });
            if (reason === null) return;
            const { error } = await supabaseClient
                .from('clients')
                .update({ approval_status: 'rejected', rejection_reason: reason.trim() || null })
                .eq('id', client.id);
            if (error) throw error;
            await logAuditActivity('UPDATE', 'Clients', `Rejected client: ${client.client_name}`, client.id, client, {
                approval_status: 'rejected',
                rejection_reason: reason.trim() || null
            });
            await renderClientsView();
        } else if (action === 'edit') {
            openEditClientModal(client);
        } else if (action === 'archive') {
            const okArchive = await confirmDialog({
                title: 'Archive client',
                confirmLabel: 'Archive',
                message: `Archive ${client.client_name}? They will be hidden from the Client Directory and from new case and event pickers. Their cases, documents and history are kept, and you can restore them anytime from the Archived filter.`
            });
            if (!okArchive) return;
            const { error } = await supabaseClient
                .from('clients')
                .update({ archived_at: new Date().toISOString(), archived_by_id: currentUser ? currentUser.id : null })
                .eq('id', client.id);
            if (error) throw error;
            await logSystemEvent('ARCHIVE', 'clients', `Archived client: ${client.client_name}`, client.id);
            showToast(`${client.client_name} was archived.`, 'success');
            await renderClientsView();
        } else if (action === 'restore') {
            const { error } = await supabaseClient
                .from('clients')
                .update({ archived_at: null, archived_by_id: null })
                .eq('id', client.id);
            if (error) throw error;
            await logSystemEvent('RESTORE', 'clients', `Restored client: ${client.client_name}`, client.id);
            showToast(`${client.client_name} was restored.`, 'success');
            await renderClientsView();
        } else if (action === 'delete') {
            if (
                !(await confirmDialog({
                    title: 'Delete client permanently',
                    confirmLabel: 'Delete permanently',
                    danger: true,
                    message: `Permanently delete ${client.client_name}? This cannot be undone.`
                }))
            )
                return;
            const { error } = await supabaseClient.from('clients').delete().eq('id', client.id);
            if (error) {
                throw new Error(
                    error.message +
                        '\n\nA client that still has cases, documents or events cannot be deleted. Remove or reassign those first.'
                );
            }
            await logAuditActivity(
                'DELETE',
                'Clients',
                `Deleted client: ${client.client_name}`,
                client.id,
                { id: client.id, client_name: client.client_name },
                null
            );
            await renderClientsView();
        }
    } catch (err) {
        console.error('Client action failed:', err);
        showToast('Action failed: ' + err.message, 'error');
    }
}

async function sendPortalInviteToClient(client) {
    if (window.__portalInviteBusy) return;
    if (!client.client_email) {
        showToast('This client has no email address. Add one first, then send the invite.', 'warning');
        return;
    }
    if (client.approval_status !== 'approved') {
        showToast('Only approved clients can be invited to the portal.', 'warning');
        return;
    }
    const ok = await confirmDialog({
        title: 'Send portal invite',
        confirmLabel: 'Send invite',
        message: `Email a client portal invite to ${client.client_email}?`
    });
    if (!ok) return;

    window.__portalInviteBusy = true;
    showToast(`Sending invite to ${client.client_email}...`, 'info');
    try {
        const { error: inviteError } = await supabaseClient.functions.invoke('invite-client', {
            body: {
                client_id: client.id,
                redirect_to:
                    window.location.origin + window.location.pathname.replace('index.html', '') + 'client-login.html'
            }
        });
        if (inviteError) {
            let detail = inviteError.message;
            try {
                const errBody = await inviteError.context.json();
                if (errBody && errBody.error) detail = errBody.error;
            } catch (e) {}
            console.error('Portal invite error:', inviteError);
            showToast(`The portal invite could not be sent: ${detail}`, 'error');
            return;
        }
        await logAuditActivity('UPDATE', 'Clients', `Sent portal invite to client: ${client.client_name}`, client.id);
        showToast(`A portal invite was emailed to ${client.client_email}.`, 'success');
        await renderClientsView();
    } finally {
        window.__portalInviteBusy = false;
    }
}

function openEditClientModal(client) {
    const modal = document.getElementById('edit-client-modal');
    if (!modal) return;
    document.getElementById('ec-id').value = client.id;
    document.getElementById('ec-name').value = client.client_name || '';
    document.getElementById('ec-email').value = client.client_email || '';
    document.getElementById('ec-phone').value = client.client_phone || '';
    clearPhoneError('ec-phone');
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
        const rec = (window.__clientsDirectory || []).find((c) => String(c.id) === String(id));
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
    const currentCo = rows.filter((r) => !rowIsLead(r)).map((r) => r.lawyer_id);
    const label = (l) =>
        `Atty. ${escapeHtml(l.full_name || 'Unnamed')}${l.specialization ? ' — ' + escapeHtml(l.specialization) : ''}`;

    leadSel.innerHTML =
        '<option value="">— No lead lawyer —</option>' +
        lawyers.map((l) => `<option value="${l.id}">${label(l)}</option>`).join('');
    leadSel.value = currentLead;

    coList.innerHTML =
        lawyers.length > 0
            ? lawyers
                  .map(
                      (l) => `
                <label class="team-co-item">
                    <input type="checkbox" value="${l.id}" ${currentCo.includes(l.id) ? 'checked' : ''}>
                    <span class="team-co-text">
                        <span class="team-co-name">Atty. ${escapeHtml(l.full_name || 'Unnamed')}</span>
                        ${l.specialization ? `<span class="team-co-spec">${escapeHtml(l.specialization)}</span>` : ''}
                    </span>
                </label>`
                  )
                  .join('')
            : '<p class="team-co-empty">No active lawyers. Add one in Manage Lawyers first.</p>';

    teamModalState.syncCo = () => {
        coList.querySelectorAll('.team-co-item').forEach((item) => {
            const cb = item.querySelector('input[type="checkbox"]');
            const isLead = cb.value === leadSel.value;
            if (isLead) cb.checked = false;
            cb.disabled = teamModalState.locked || isLead;
            item.classList.toggle('is-disabled', cb.disabled);
        });
    };
    leadSel.onchange = () => {
        hideTeamError();
        teamModalState.syncCo();
    };
    coList.onchange = hideTeamError;

    setTeamModalLocked(false);
    hideTeamError();

    document.getElementById('team-kind').value = kind;
    document.getElementById('team-target-id').value = id;
    document.getElementById('team-approve').value = approve ? '1' : '';
    document.getElementById('team-modal-title').textContent = approve
        ? 'Approve client'
        : kind === 'client'
          ? 'Assign lawyers'
          : 'Case lawyers';
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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const kind = document.getElementById('team-kind').value;
        const id = document.getElementById('team-target-id').value;
        const approve = !!document.getElementById('team-approve').value;
        const lead = document.getElementById('team-lead').value || null;
        const co = [...document.querySelectorAll('#team-co-list input[type="checkbox"]:checked')]
            .map((cb) => cb.value)
            .filter((v) => v !== lead);

        if (!lead) {
            showTeamError(
                co.length > 0
                    ? 'Choose a lead lawyer first. Co-lawyers cannot be saved without a lead lawyer.'
                    : 'Choose a lead lawyer before saving.'
            );
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
                    p_client_id: Number(id),
                    p_lead: lead,
                    p_co: co
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
                    p_case_id: id,
                    p_lead: lead,
                    p_co: co
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
    form.querySelectorAll('.cf-error').forEach((n) => n.remove());
    form.querySelectorAll('.cf-invalid').forEach((el) => el.classList.remove('cf-invalid'));
}

function validateCaseForm() {
    clearCaseFormErrors();
    let firstInvalid = null;

    const leadWrap = document.getElementById('cf-lead-wrap');
    const leadRequired = !!leadWrap && leadWrap.style.display !== 'none';
    const requiredFields = CASE_REQUIRED_FIELDS.slice();
    if (leadRequired)
        requiredFields.splice(1, 0, ['cf-lead', 'Please select a lead lawyer. A case cannot be saved without one.']);

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
            .is('archived_at', null)
            .order('client_name', { ascending: true });
        if (error) throw error;

        const placeholder =
            (clients || []).length > 0
                ? 'Select a client'
                : isAdminUser()
                  ? 'No approved clients yet'
                  : 'No clients assigned to you yet';
        clientSel.innerHTML =
            `<option value="">${placeholder}</option>` +
            (clients || []).map((c) => `<option value="${c.id}">${escapeHtml(c.client_name)}</option>`).join('');
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
            leadSel.innerHTML =
                '<option value="">Select a lead lawyer</option>' +
                lawyers
                    .map((l) => `<option value="${l.id}">Atty. ${escapeHtml(l.full_name || 'Unnamed')}</option>`)
                    .join('');
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
        document.getElementById('cf-def-name').value = record.defendant_name || '';
        document.getElementById('cf-def-counsel').value = record.defendant_counsel || '';
        document.getElementById('cf-stage').value = record.case_stage || 'For Filing';
        document.getElementById('cf-desc').value = record.case_description || '';
        document.getElementById('cf-title').readOnly = true;
        document.getElementById('cf-type').disabled = !!record.case_type;
        document.getElementById('cf-party').disabled = !!record.party_type;
        document.getElementById('cf-stage').disabled = false;
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

    const clientPick = document.getElementById('cf-client');
    if (clientPick)
        clientPick.addEventListener('change', async () => {
            const leadSel = document.getElementById('cf-lead');
            const leadWrap = document.getElementById('cf-lead-wrap');
            const clientId = clientPick.value;
            if (!leadSel || !leadWrap || leadWrap.style.display === 'none' || document.getElementById('cf-id').value) return;
            leadSel.value = '';
            if (!clientId) return;
            try {
                const { data, error } = await supabaseClient.from('client_lawyers').select('*').eq('client_id', clientId);
                if (error) throw error;
                if (clientPick.value !== clientId) return;
                const lead = (data || []).find((r) => (r.lawyer_role ? r.lawyer_role === 'lead' : !!r.is_lead));
                if (lead && Array.from(leadSel.options).some((o) => o.value === String(lead.lawyer_id))) {
                    leadSel.value = String(lead.lawyer_id);
                    leadSel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } catch (err) {
                console.error('Error loading client lead lawyer:', err);
            }
        });

    if (newBtn)
        newBtn.addEventListener('click', () => {
            if (globalRoleName !== 'secretary') openCaseForm(null);
        });
    if (closeBtn)
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            clearCaseFormErrors();
        });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateCaseForm()) return;

        const val = (id) => (document.getElementById(id)?.value || '').trim();
        const caseId = val('cf-id');
        const clientId = val('cf-client');
        const title = val('cf-title');
        const type = val('cf-type');
        const desc = val('cf-desc');
        const dateVal = val('cf-date');
        const lead = val('cf-lead');
        const partyType = val('cf-party');
        const courtBranch = val('cf-court');
        const defName = val('cf-def-name');
        const defCounsel = val('cf-def-counsel');
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
                    defendant_name: defName || null,
                    defendant_counsel: defCounsel || null,
                    case_stage: caseStage || null,
                    case_description: desc || null
                };
                if (dateIso) patch.date_filed = dateIso;
                if (isAdminUser()) patch.client_id = Number(clientId);
                const { data: updated, error } = await supabaseClient
                    .from('cases')
                    .update(patch)
                    .eq('id', caseId)
                    .select('id');
                if (error) throw error;
                if (!updated || updated.length === 0) {
                    throw new Error('The case was not updated. You may not have permission to edit it.');
                }

                const oldCaseRecord = (window.__casesRegistry || {})[caseId];
                await logAuditActivity('UPDATE', 'Cases', `Edited case: ${title}`, caseId, oldCaseRecord, patch);
            } else {
                const { data, error } = await createCase({
                    title: title,
                    caseType: type,
                    description: desc,
                    clientId: clientId,
                    dateFiled: dateIso,
                    leadLawyerId: lead || null,
                    courtBranch: courtBranch,
                    caseStage: caseStage,
                    partyType: partyType
                });
                if (error) throw error;
                if (data && data.id && (defName || defCounsel)) {
                    const { error: defError } = await supabaseClient
                        .from('cases')
                        .update({
                            defendant_name: defName || null,
                            defendant_counsel: defCounsel || null
                        })
                        .eq('id', data.id);
                    if (defError) {
                        console.error('Error saving defendant details:', defError);
                        showToast('The case was saved, but the defendant details were not. Please edit the case to add them.', 'error');
                    }
                }
                showToast(
                    'Case saved.' + (data && data.case_number ? `\n\nCase Number: ${data.case_number}` : ''),
                    'success'
                );
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

const CR_HEARING_TYPES = ['Hearing', 'Pre-Trial', 'Mediation/JDR', 'Filing', 'Conference', 'Decision', 'Other'];
const CR_EVENT_ICONS = {
    case_opened: 'fa-folder-open',
    stage_changed: 'fa-flag',
    case_closed: 'fa-lock',
    case_reopened: 'fa-rotate-left',
    client_linked: 'fa-user-plus'
};

function crPad(n) {
    return String(n).padStart(2, '0');
}

function crDate(value) {
    if (!value) return '';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00') : new Date(value);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function crDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d)) return '';
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function crToDateTimeInput(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d)) return '';
    return `${d.getFullYear()}-${crPad(d.getMonth() + 1)}-${crPad(d.getDate())}T${crPad(d.getHours())}:${crPad(d.getMinutes())}`;
}

function crManilaToday() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

function crOpenOverlay(innerHtml, options) {
    const opts = options || {};
    const cls = opts.cls || 'cr-overlay';
    document.querySelectorAll('.' + cls).forEach((el) => el.remove());
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay ' + cls;
    overlay.innerHTML = innerHtml;
    document.body.appendChild(overlay);

    function onKey(e) {
        if (e.key !== 'Escape' || document.querySelector('.dialog-overlay')) return;
        if (cls !== 'cr-overlay' && document.querySelector('.cr-overlay')) return;
        close();
    }
    function close() {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
    }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay && (!opts.backdrop || opts.backdrop())) close();
    });
    overlay.querySelectorAll('[data-cr-close]').forEach((btn) => btn.addEventListener('click', close));
    return { overlay, close };
}

async function crRefreshCases() {
    try {
        await renderCasesTabView();
        updateDashboardStats();
        renderMyCasesTab();
    } catch (err) {
        console.warn('Could not refresh the cases view:', err);
    }
}

async function crSyncHearingEvent(record, reportId, nextIso) {
    const { data: existing, error: findErr } = await supabaseClient
        .from('calendar_events')
        .select('id, assigned_to')
        .eq('report_id', reportId)
        .maybeSingle();
    if (findErr) throw findErr;

    if (!nextIso) {
        if (!existing) return { action: 'none' };
        const { data: gone, error: delErr } = await supabaseClient
            .from('calendar_events')
            .delete()
            .eq('id', existing.id)
            .select('id');
        if (delErr) throw delErr;
        return { action: gone && gone.length ? 'removed' : 'blocked' };
    }

    const start = new Date(nextIso);
    const fields = {
        title: 'Hearing: ' + record.title,
        start_date: start.toISOString(),
        end_date: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
        location: record.court_branch || null,
        priority: 'high'
    };

    if (existing) {
        const { data: upd, error: updErr } = await supabaseClient
            .from('calendar_events')
            .update(fields)
            .eq('id', existing.id)
            .select('id');
        if (updErr) throw updErr;
        if (!upd || upd.length === 0) return { action: 'blocked' };
        return { action: 'updated', assignedTo: existing.assigned_to };
    }

    const assignedTo = globalRoleName === 'lawyer' ? currentUser.id : getLeadLawyerId(record) || currentUser.id;
    const row = Object.assign(
        {
            is_general: false,
            assigned_to: assignedTo,
            case_id: record.id,
            report_id: reportId
        },
        fields
    );
    if (record.client_id) row.client_id = record.client_id;

    const { error: insErr } = await supabaseClient.from('calendar_events').insert([row]);
    if (insErr) {
        if (insErr.code === '23505') return { action: 'blocked' };
        throw insErr;
    }
    return { action: 'created', assignedTo };
}

async function crHearingClash(assignedTo, startIso, reportId) {
    if (!assignedTo || !startIso) return null;
    const start = new Date(startIso).getTime();
    const { data, error } = await supabaseClient
        .from('calendar_events')
        .select('id, title, start_date, report_id')
        .eq('assigned_to', assignedTo)
        .gte('start_date', new Date(start - 59 * 60 * 1000).toISOString())
        .lte('start_date', new Date(start + 59 * 60 * 1000).toISOString());
    if (error || !data) return null;
    return data.find((e) => e.report_id !== reportId) || null;
}

function crRefreshCalendar() {
    [
        typeof generateCalendarGrid === 'function' ? generateCalendarGrid : null,
        typeof renderResourcesWidget === 'function' ? renderResourcesWidget : null,
        typeof updateDashboardStats === 'function' ? updateDashboardStats : null
    ].forEach((fn) => {
        if (!fn) return;
        try {
            Promise.resolve(fn()).catch(() => {});
        } catch (e) {}
    });
}

window.openCaseReports = async function (caseId, initialTab) {
    const record = (window.__casesRegistry || {})[caseId];
    if (!record) {
        showToast('Could not find that case. Please refresh the page.', 'error');
        return;
    }

    const isAdmin = globalRoleName === 'admin';
    const canWrite = isAdmin || globalRoleName === 'lawyer';
    const hasClient = !!record.client_id;
    const clientLabel = record.clients?.client_name || (hasClient ? 'Linked client' : 'No client linked');
    const state = { tab: 'reports', reports: [], timeline: null, formOpen: false, editingId: null };

    const ui = crOpenOverlay(
        `
            <div class="modal-content cr-modal" role="dialog" aria-modal="true" aria-labelledby="cr-title">
                <div class="cr-head">
                    <span class="cr-head-icon"><i class="fa-solid fa-file-lines"></i></span>
                    <div class="cr-head-text">
                        <h2 id="cr-title">${escapeHtml(record.title)}</h2>
                        <p>${record.case_number ? '#' + escapeHtml(record.case_number) + ' &bull; ' : ''}Client: ${escapeHtml(clientLabel)}</p>
                    </div>
                    <button type="button" class="cr-close" data-cr-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="cr-tabs" role="tablist">
                    <button type="button" class="cr-tab active" role="tab" data-tab="reports">Reports</button>
                    <button type="button" class="cr-tab" role="tab" data-tab="history">History</button>
                </div>
                <div class="cr-body" id="cr-body"></div>
            </div>`,
        { backdrop: () => !state.formOpen }
    );

    const overlay = ui.overlay;
    const body = overlay.querySelector('#cr-body');

    const byId = (id) => state.reports.find((r) => r.id === id);

    async function loadReports() {
        const { data, error } = await supabaseClient
            .from('case_reports')
            .select('*, author:profiles!case_reports_created_by_fkey(full_name)')
            .eq('case_id', caseId)
            .order('report_date', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) throw error;
        state.reports = data || [];
    }

    function formIsDirty() {
        if (!state.formOpen) return false;
        const t = overlay.querySelector('#cr-f-title');
        const s = overlay.querySelector('#cr-f-summary');
        return !!((t && t.value.trim()) || (s && s.value.trim()));
    }

    function renderReportsTab() {
        body.innerHTML = `
                <div class="cr-toolbar">
                    <span class="cr-count" id="cr-count"></span>
                    ${canWrite ? '<button type="button" class="cr-add-btn" data-act="add"><i class="fa-solid fa-plus"></i> Add report</button>' : ''}
                </div>
                <div id="cr-form-wrap"></div>
                <div id="cr-list-wrap"></div>`;
        renderList();
        renderForm();
    }

    function renderList() {
        const wrap = overlay.querySelector('#cr-list-wrap');
        const count = overlay.querySelector('#cr-count');
        if (!wrap) return;
        const n = state.reports.length;
        if (count) count.textContent = n === 1 ? '1 report' : `${n} reports`;

        if (n === 0) {
            wrap.innerHTML = `<div class="cr-empty"><i class="fa-regular fa-file-lines"></i><p>No reports yet.</p><small>${canWrite ? 'Use "Add report" to record what happened at a hearing or update.' : 'Reports added by the lawyers on this case will appear here.'}</small></div>`;
            return;
        }

        const rows = state.reports
            .map((r) => {
                const shared = r.visible_to_client;
                const authorName = r.author && r.author.full_name ? r.author.full_name : '';
                const actions = [];
                if (canWrite) {
                    actions.push(
                        `<button type="button" class="cr-icon-btn" data-act="edit" data-id="${r.id}" title="Edit report" aria-label="Edit report"><i class="fa-solid fa-pen"></i></button>`
                    );
                    if (hasClient) {
                        actions.push(
                            `<button type="button" class="cr-icon-btn ${shared ? 'is-on' : ''}" data-act="share" data-id="${r.id}" title="${shared ? 'Hide from client' : 'Share with client'}" aria-label="${shared ? 'Hide from client' : 'Share with client'}"><i class="fa-solid ${shared ? 'fa-eye-slash' : 'fa-eye'}"></i></button>`
                        );
                    }
                }
                if (isAdmin) {
                    actions.push(
                        `<button type="button" class="cr-icon-btn is-danger" data-act="delete" data-id="${r.id}" title="Delete report" aria-label="Delete report"><i class="fa-solid fa-trash"></i></button>`
                    );
                }
                return `
                    <tr class="cr-row">
                        <td class="cr-nowrap">${escapeHtml(crDate(r.report_date))}</td>
                        <td><span class="cr-pill">${escapeHtml(r.hearing_type || 'Report')}</span></td>
                        <td class="cr-title-cell">
                            <button type="button" class="cr-link" data-act="toggle" data-id="${r.id}" aria-expanded="false">${escapeHtml(r.title)} <i class="fa-solid fa-chevron-down"></i></button>
                        </td>
                        <td>${r.outcome ? escapeHtml(r.outcome) : '<span class="cr-muted">-</span>'}</td>
                        <td class="cr-nowrap">${r.next_hearing_date ? '<i class="fa-solid fa-calendar-check cr-cal-ico" title="On the calendar"></i> ' + escapeHtml(crDateTime(r.next_hearing_date)) : '<span class="cr-muted">-</span>'}</td>
                        <td>${shared ? '<span class="cr-badge cr-badge-shared"><i class="fa-solid fa-eye"></i> Shared</span>' : '<span class="cr-badge cr-badge-private"><i class="fa-solid fa-lock"></i> Private</span>'}</td>
                        <td class="cr-actions-cell"><div>${actions.join('')}</div></td>
                    </tr>
                    <tr class="cr-detail" id="cr-detail-${r.id}" hidden>
                        <td colspan="7">
                            <div class="cr-detail-grid">
                                <div><div class="cr-detail-label">What happened</div><div class="cr-pre">${escapeHtml(r.summary)}</div></div>
                                ${r.next_steps ? `<div><div class="cr-detail-label">Next steps</div><div class="cr-pre">${escapeHtml(r.next_steps)}</div></div>` : ''}
                                <div class="cr-detail-meta">${authorName ? 'Added by Atty. ' + escapeHtml(authorName) + ' &bull; ' : ''}${escapeHtml(crDateTime(r.created_at))}</div>
                            </div>
                        </td>
                    </tr>`;
            })
            .join('');

        wrap.innerHTML = `
                <div class="cr-table-wrap">
                    <table class="cr-table">
                        <thead><tr>
                            <th>Date</th><th>Type</th><th>Report</th><th>Outcome</th><th>Next hearing</th><th>Client</th><th class="cr-actions-head"></th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
    }

    function renderForm() {
        const wrap = overlay.querySelector('#cr-form-wrap');
        if (!wrap) return;
        if (!state.formOpen) {
            wrap.innerHTML = '';
            return;
        }

        const r = state.editingId ? byId(state.editingId) || {} : {};
        const typeOptions =
            '<option value="">Select type</option>' +
            CR_HEARING_TYPES.map(
                (t) =>
                    `<option value="${escapeHtml(t)}"${r.hearing_type === t ? ' selected' : ''}>${escapeHtml(t)}</option>`
            ).join('');

        wrap.innerHTML = `
                <form class="cr-form" id="cr-form" novalidate>
                    <div class="cr-form-title">${state.editingId ? 'Edit report' : 'New report'}</div>
                    <div class="cr-row2">
                        <label class="cr-field"><span>Date</span>
                            <span class="cr-locked">
                                <input type="text" id="cr-f-date" class="cr-input cr-input-locked" value="${escapeHtml(crDate(r.report_date || crManilaToday()))}" readonly aria-readonly="true" tabindex="-1" title="The report date is set automatically and cannot be changed">
                                <i class="fa-solid fa-lock" aria-hidden="true"></i>
                            </span></label>
                        <label class="cr-field"><span>Type</span>
                            <select id="cr-f-type" class="cr-input">${typeOptions}</select></label>
                    </div>
                    <label class="cr-field"><span>Title</span>
                        <input type="text" id="cr-f-title" class="cr-input" maxlength="150" placeholder="e.g., Pre-trial conference" value="${escapeHtml(r.title || '')}"></label>
                    <label class="cr-field"><span>What happened</span>
                        <textarea id="cr-f-summary" class="cr-input cr-textarea" rows="4" maxlength="5000" placeholder="Describe what happened in this hearing or update">${escapeHtml(r.summary || '')}</textarea></label>
                    <label class="cr-field"><span>Outcome <em>(optional)</em></span>
                        <input type="text" id="cr-f-outcome" class="cr-input" maxlength="300" placeholder="e.g., Reset to next month" value="${escapeHtml(r.outcome || '')}"></label>
                    <div class="cr-row2">
                        <label class="cr-field"><span>Next hearing <em>(optional)</em></span>
                            <input type="datetime-local" id="cr-f-next" class="cr-input" value="${escapeHtml(crToDateTimeInput(r.next_hearing_date))}"></label>
                        <label class="cr-field"><span>Next steps <em>(optional)</em></span>
                            <input type="text" id="cr-f-steps" class="cr-input" maxlength="500" placeholder="e.g., Submit position paper" value="${escapeHtml(r.next_steps || '')}"></label>
                    </div>
                    <div class="cr-help"><i class="fa-regular fa-calendar-check" aria-hidden="true"></i><span>A next hearing is added to the Calendar automatically.</span></div>
                    <label class="cr-share${hasClient ? '' : ' is-disabled'}">
                        <input type="checkbox" id="cr-f-share"${r.visible_to_client ? ' checked' : ''}${hasClient ? '' : ' disabled'}>
                        <span><strong>Share with client</strong>
                        <small>${hasClient ? escapeHtml(clientLabel) + ' will see this report in their portal.' : 'Link a client to this case first.'}</small></span>
                    </label>
                    <div class="cr-form-actions">
                        <button type="button" class="cr-btn-ghost" data-act="cancel">Cancel</button>
                        <button type="submit" class="cr-btn-primary" id="cr-save">${state.editingId ? 'Save changes' : 'Save report'}</button>
                    </div>
                </form>`;
        const first = wrap.querySelector('#cr-f-title');
        if (first) first.focus();
    }

    async function renderHistoryTab() {
        body.innerHTML = '<div class="cr-loading">Loading history...</div>';
        try {
            if (!state.timeline) {
                const { data, error } = await supabaseClient
                    .from('case_timeline')
                    .select('*')
                    .eq('case_id', caseId)
                    .order('event_at', { ascending: false });
                if (error) throw error;
                state.timeline = data || [];
            }
        } catch (err) {
            console.error('Error loading case history:', err);
            body.innerHTML =
                '<div class="cr-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>Could not load the history.</p><small>' +
                escapeHtml(err.message || '') +
                '</small></div>';
            return;
        }
        if (state.tab !== 'history') return;

        if (state.timeline.length === 0) {
            body.innerHTML = '<div class="cr-empty"><i class="fa-regular fa-clock"></i><p>No history yet.</p></div>';
            return;
        }

        const items = state.timeline
            .map((e) => {
                const isReport = e.source === 'report';
                const icon = isReport ? 'fa-file-lines' : CR_EVENT_ICONS[e.event_type] || 'fa-circle';
                const when = isReport ? crDate(String(e.event_at).slice(0, 10)) : crDateTime(e.event_at);
                let detail = '';
                if (isReport) {
                    const parts = [];
                    if (e.event_type) parts.push(e.event_type);
                    if (e.outcome) parts.push('Outcome: ' + e.outcome);
                    if (e.next_hearing_date) parts.push('Next hearing: ' + crDateTime(e.next_hearing_date));
                    detail = parts.join(' \u2022 ');
                }
                const badge = isReport
                    ? e.visible_to_client
                        ? '<span class="cr-badge cr-badge-shared"><i class="fa-solid fa-eye"></i> Shared</span>'
                        : '<span class="cr-badge cr-badge-private"><i class="fa-solid fa-lock"></i> Private</span>'
                    : '';
                return `
                    <li class="cr-tl-item">
                        <span class="cr-tl-dot${isReport ? ' is-report' : ''}"><i class="fa-solid ${icon}"></i></span>
                        <div class="cr-tl-main">
                            <div class="cr-tl-title">${escapeHtml(e.title)} ${badge}</div>
                            ${detail ? `<div class="cr-tl-detail">${escapeHtml(detail)}</div>` : ''}
                            <div class="cr-tl-date">${escapeHtml(when)}</div>
                        </div>
                    </li>`;
            })
            .join('');
        body.innerHTML = `<ol class="cr-timeline">${items}</ol>`;
    }

    async function saveReport() {
        const val = (id) => (overlay.querySelector('#' + id)?.value || '').trim();
        const title = val('cr-f-title');
        const summary = val('cr-f-summary');
        if (!title || !summary) {
            showToast('Please enter a title and describe what happened.', 'error');
            overlay.querySelector(!title ? '#cr-f-title' : '#cr-f-summary')?.focus();
            return;
        }

        const nextRaw = val('cr-f-next');
        const nextDate = nextRaw ? new Date(nextRaw) : null;
        const payload = {
            hearing_type: val('cr-f-type') || null,
            title: title,
            summary: summary,
            outcome: val('cr-f-outcome') || null,
            next_hearing_date: nextDate && !isNaN(nextDate) ? nextDate.toISOString() : null,
            next_steps: val('cr-f-steps') || null,
            visible_to_client: hasClient && !!overlay.querySelector('#cr-f-share')?.checked
        };

        const saveBtn = overlay.querySelector('#cr-save');
        const idle = saveBtn ? saveBtn.textContent : '';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }
        try {
            let result;
            if (state.editingId) {
                result = await supabaseClient
                    .from('case_reports')
                    .update(payload)
                    .eq('id', state.editingId)
                    .select('id');
            } else {
                result = await supabaseClient
                    .from('case_reports')
                    .insert([Object.assign({ case_id: caseId }, payload)])
                    .select('id');
            }
            if (result.error) throw result.error;
            if (!result.data || result.data.length === 0) {
                throw new Error('The report was not saved. You may not have permission to edit it.');
            }
            const savedId = result.data[0].id;
            let note = '';
            let syncFailed = false;
            try {
                const sync = await crSyncHearingEvent(record, savedId, payload.next_hearing_date);
                if (sync.action === 'created') note = ' The next hearing was added to the calendar.';
                else if (sync.action === 'updated') note = ' The calendar hearing was updated.';
                else if (sync.action === 'removed') note = ' The hearing was removed from the calendar.';
                else if (sync.action === 'blocked')
                    note = ' The calendar hearing belongs to another lawyer, so it was not changed.';
                if (sync.action === 'created' || sync.action === 'updated') {
                    const clash = await crHearingClash(sync.assignedTo, payload.next_hearing_date, savedId);
                    if (clash) note += ' Heads up: "' + clash.title + '" is also scheduled around that time.';
                }
                crRefreshCalendar();
            } catch (syncErr) {
                console.error('Error adding the hearing to the calendar:', syncErr);
                note = ' The hearing could not be added to the calendar: ' + syncErr.message;
                syncFailed = true;
            }
            showToast(
                (payload.visible_to_client ? 'Report saved and shared with the client.' : 'Report saved.') + note,
                syncFailed ? 'error' : 'success'
            );
            state.formOpen = false;
            state.editingId = null;
            state.timeline = null;
            await loadReports();
            renderForm();
            renderList();
        } catch (err) {
            console.error('Error saving report:', err);
            showToast('Could not save the report: ' + err.message, 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = idle;
            }
        }
    }

    async function toggleShare(id) {
        const r = byId(id);
        if (!r || !hasClient) return;
        const makeVisible = !r.visible_to_client;
        if (makeVisible) {
            const ok = await confirmDialog({
                title: 'Share with client',
                confirmLabel: 'Share',
                message: `Share "${r.title}" with ${clientLabel}? They will be able to read it in their portal.`
            });
            if (!ok) return;
        }
        const { data, error } = await supabaseClient
            .from('case_reports')
            .update({ visible_to_client: makeVisible })
            .eq('id', id)
            .select('id');
        if (error || !data || data.length === 0) {
            showToast('Could not update sharing: ' + (error ? error.message : 'permission denied'), 'error');
            return;
        }
        showToast(makeVisible ? 'Report shared with the client.' : 'Report hidden from the client.', 'success');
        state.timeline = null;
        await loadReports();
        renderList();
    }

    async function deleteReport(id) {
        const r = byId(id);
        if (!r || !isAdmin) return;
        const ok = await confirmDialog({
            title: 'Delete report',
            confirmLabel: 'Delete',
            danger: true,
            message: `Delete the report "${r.title}"? This cannot be undone.`
        });
        if (!ok) return;
        const { data, error } = await supabaseClient.from('case_reports').delete().eq('id', id).select('id');
        if (error || !data || data.length === 0) {
            if (error) console.error('Error deleting report:', error);
            showToast('The report could not be deleted. ' + readableDbError(error, 'You do not have permission to do this.'), 'error');
            return;
        }
        showToast('Report deleted.', 'success');
        state.timeline = null;
        await loadReports();
        renderList();
    }

    async function switchTab(tab) {
        if (tab === state.tab) return;
        if (formIsDirty()) {
            const ok = await confirmDialog({
                title: 'Discard this report?',
                confirmLabel: 'Discard',
                danger: true,
                message: 'You have an unsaved report. Switching tabs will discard it.'
            });
            if (!ok) return;
        }
        state.formOpen = false;
        state.editingId = null;
        state.tab = tab;
        overlay.querySelectorAll('.cr-tab').forEach((t) => {
            const on = t.dataset.tab === tab;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        if (tab === 'reports') renderReportsTab();
        else renderHistoryTab();
    }

    overlay.addEventListener('click', async (e) => {
        const tabBtn = e.target.closest('.cr-tab');
        if (tabBtn) {
            switchTab(tabBtn.dataset.tab);
            return;
        }

        const el = e.target.closest('[data-act]');
        if (!el) return;
        const id = el.dataset.id;
        switch (el.dataset.act) {
            case 'add':
                state.formOpen = true;
                state.editingId = null;
                renderForm();
                break;
            case 'edit':
                state.formOpen = true;
                state.editingId = id;
                renderForm();
                overlay.querySelector('#cr-form-wrap')?.scrollIntoView({ block: 'nearest' });
                break;
            case 'cancel':
                if (
                    formIsDirty() &&
                    !(await confirmDialog({
                        title: 'Discard this report?',
                        confirmLabel: 'Discard',
                        danger: true,
                        message: 'Your changes will be lost.'
                    }))
                )
                    break;
                state.formOpen = false;
                state.editingId = null;
                renderForm();
                break;
            case 'toggle': {
                const detail = overlay.querySelector('#cr-detail-' + id);
                if (detail) {
                    detail.hidden = !detail.hidden;
                    el.setAttribute('aria-expanded', detail.hidden ? 'false' : 'true');
                    el.classList.toggle('is-open', !detail.hidden);
                }
                break;
            }
            case 'share':
                toggleShare(id);
                break;
            case 'delete':
                deleteReport(id);
                break;
            default:
                break;
        }
    });

    overlay.addEventListener('submit', (e) => {
        if (e.target && e.target.id === 'cr-form') {
            e.preventDefault();
            saveReport();
        }
    });

    body.innerHTML = '<div class="cr-loading">Loading reports...</div>';
    try {
        await loadReports();
        renderReportsTab();
        if (initialTab === 'history') await switchTab('history');
    } catch (err) {
        console.error('Error loading case reports:', err);
        body.innerHTML =
            '<div class="cr-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>Could not load the reports.</p><small>' +
            escapeHtml(err.message || '') +
            '</small></div>';
    }
};

window.openLinkClient = async function (caseId) {
    const record = (window.__casesRegistry || {})[caseId];
    if (!record) {
        showToast('Could not find that case. Please refresh the page.', 'error');
        return;
    }
    if (record.client_id && globalRoleName !== 'admin') {
        showToast('A client is already linked to this case.', 'info');
        return;
    }

    let selected = null;
    let clients = [];

    const ui = crOpenOverlay(`
            <div class="modal-content cr-modal cr-modal-sm" role="dialog" aria-modal="true" aria-labelledby="cr-link-title">
                <div class="cr-head">
                    <span class="cr-head-icon"><i class="fa-solid fa-user-plus"></i></span>
                    <div class="cr-head-text">
                        <h2 id="cr-link-title">Link a client</h2>
                        <p>${escapeHtml(record.title)}</p>
                    </div>
                    <button type="button" class="cr-close" data-cr-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="cr-body">
                    <p class="cr-hint">Choose the client for this case. Once linked, only an admin can change it, and the case will appear in the client's portal.</p>
                    <input type="search" id="cr-client-search" class="cr-input" placeholder="Search clients" autocomplete="off" aria-label="Search clients">
                    <div class="cr-client-list" id="cr-client-list" role="radiogroup" aria-label="Clients"><div class="cr-loading">Loading clients...</div></div>
                    <div class="cr-form-actions">
                        <button type="button" class="cr-btn-ghost" data-cr-close>Cancel</button>
                        <button type="button" class="cr-btn-primary" id="cr-link-confirm" disabled>Link client</button>
                    </div>
                </div>
            </div>`);

    const overlay = ui.overlay;
    const listEl = overlay.querySelector('#cr-client-list');
    const confirmBtn = overlay.querySelector('#cr-link-confirm');
    const searchEl = overlay.querySelector('#cr-client-search');

    function paint() {
        const term = (searchEl.value || '').trim().toLowerCase();
        const shown = clients.filter(
            (c) =>
                !term ||
                String(c.client_name || '')
                    .toLowerCase()
                    .includes(term)
        );
        if (clients.length === 0) {
            const emptyText =
                globalRoleName === 'admin'
                    ? 'No approved clients in the system yet.'
                    : 'No clients are assigned to you yet. Ask an administrator to assign you to a client.';
            listEl.innerHTML = `<div class="cr-empty"><p>${escapeHtml(emptyText)}</p></div>`;
            return;
        }
        if (shown.length === 0) {
            listEl.innerHTML = '<div class="cr-empty"><p>No clients match your search.</p></div>';
            return;
        }
        listEl.innerHTML = shown
            .map(
                (c) => `
                <button type="button" class="cr-client-opt${selected && selected.id === c.id ? ' is-selected' : ''}" role="radio" aria-checked="${selected && selected.id === c.id ? 'true' : 'false'}" data-id="${c.id}">
                    <span class="cr-client-avatar">${escapeHtml(
                        String(c.client_name || '?')
                            .trim()
                            .charAt(0)
                            .toUpperCase()
                    )}</span>
                    <span class="cr-client-name">${escapeHtml(c.client_name || 'Unnamed client')}</span>
                    <i class="fa-solid fa-circle-check"></i>
                </button>`
            )
            .join('');
    }

    searchEl.addEventListener('input', paint);
    listEl.addEventListener('click', (e) => {
        const opt = e.target.closest('.cr-client-opt');
        if (!opt) return;
        selected = clients.find((c) => String(c.id) === opt.dataset.id) || null;
        confirmBtn.disabled = !selected;
        paint();
    });

    confirmBtn.addEventListener('click', async () => {
        if (!selected) return;
        const ok = await confirmDialog({
            title: 'Link client',
            confirmLabel: 'Link client',
            message: `Link ${selected.client_name} to "${record.title}"? Once linked, only an admin can change the client, and this case will appear in the client's portal.`
        });
        if (!ok) return;

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Linking...';
        const { error } = await supabaseClient.rpc('link_case_client', {
            p_case_id: caseId,
            p_client_id: Number(selected.id)
        });
        if (error) {
            console.error('Error linking client:', error);
            showToast('Could not link the client: ' + error.message, 'error');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Link client';
            return;
        }
        showToast("Client linked. The case now appears in the client's portal.", 'success');
        ui.close();
        await crRefreshCases();
    });

    try {
        const { data, error } = await supabaseClient.rpc('list_linkable_clients');
        if (error) throw error;
        clients = data || [];
        paint();
    } catch (err) {
        console.error('Error loading clients:', err);
        listEl.innerHTML =
            '<div class="cr-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>Could not load clients.</p><small>' +
            escapeHtml(err.message || '') +
            '</small></div>';
    }
};

const CD_STAGES = [
    'For Filing',
    'Filed',
    'Pre-Trial',
    'Mediation/JDR',
    'Trial - Plaintiff',
    'Trial - Prosecution',
    'Trial - Defense',
    'Demurrer',
    'For Decision',
    'Appeal'
];
const CD_TYPES = ['Civil', 'Criminal', 'Labor', 'Administrative'];

window.openCasesDashboard = async function () {
    if (!currentUser) return;
    const isLawyer = globalUserRole === 'lawyer';
    const state = {
        tab: 'dashboard',
        cases: [],
        upcoming: [],
        activity: [],
        closedAt: {},
        filter: 'all',
        search: '',
        partial: false
    };

    const ui = crOpenOverlay(
        `
            <div class="modal-content cr-modal cr-modal-lg" role="dialog" aria-modal="true" aria-labelledby="cd-title">
                <div class="cr-head">
                    <span class="cr-head-icon"><i class="fa-solid fa-briefcase"></i></span>
                    <div class="cr-head-text">
                        <h2 id="cd-title">Cases</h2>
                        <p>${isLawyer ? 'Your cases' : 'All cases in the firm'}</p>
                    </div>
                    <button type="button" class="cr-close" data-cr-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="cr-tabs" role="tablist">
                    <button type="button" class="cr-tab active" role="tab" data-tab="dashboard" aria-selected="true">Dashboard</button>
                    <button type="button" class="cr-tab" role="tab" data-tab="history" aria-selected="false">History of cases</button>
                </div>
                <div class="cr-body" id="cd-body"><div class="cr-loading">Loading cases...</div></div>
            </div>`,
        { cls: 'cr-dash-overlay' }
    );

    const overlay = ui.overlay;
    const body = overlay.querySelector('#cd-body');

    const isClosed = (c) => c.status === 'closed';
    const clientOf = (c) => (c.clients && c.clients.client_name) || (c.client_id ? 'Linked client' : 'No client');
    const filedOf = (c) => c.date_filed || c.created_at;
    const closedOn = (c) => c.closed_at || state.closedAt[c.id] || '';
    const caseById = (id) => state.cases.find((x) => x.id === id);
    const caseTitleById = (id) => {
        const c = caseById(id);
        return c ? c.title : 'Case';
    };

    async function load() {
        let query = supabaseClient
            .from('cases')
            .select(casesSelect('*, clients(id, client_name, client_email, client_phone, full_address)', isLawyer))
            .order('created_at', { ascending: false });
        if (isLawyer) query = filterMyCases(query);
        const { data, error } = await query;
        if (error) throw error;

        state.cases = data || [];
        window.__casesRegistry = window.__casesRegistry || {};
        state.cases.forEach((c) => {
            window.__casesRegistry[c.id] = c;
        });

        const [rep, tl, closed] = await Promise.all([
            supabaseClient
                .from('case_reports')
                .select('id, case_id, title, hearing_type, next_hearing_date')
                .gte('next_hearing_date', new Date().toISOString())
                .order('next_hearing_date', { ascending: true })
                .limit(50),
            supabaseClient.from('case_timeline').select('*').order('event_at', { ascending: false }).limit(10),
            supabaseClient
                .from('case_history')
                .select('case_id, created_at')
                .eq('event_type', 'case_closed')
                .order('created_at', { ascending: false })
        ]);

        state.partial = !!(rep.error || tl.error || closed.error);
        const activeIds = new Set(state.cases.filter((c) => !isClosed(c)).map((c) => c.id));
        state.upcoming = (rep.data || []).filter((r) => activeIds.has(r.case_id));
        state.activity = tl.data || [];
        state.closedAt = {};
        (closed.data || []).forEach((row) => {
            if (!state.closedAt[row.case_id]) state.closedAt[row.case_id] = row.created_at;
        });
    }

    function renderDashboard() {
        const active = state.cases.filter((c) => !isClosed(c));
        const closedCount = state.cases.length - active.length;

        const stageCounts = {};
        const typeCounts = {};
        active.forEach((c) => {
            const s = c.case_stage || 'Not set';
            const t = c.case_type || 'Other';
            stageCounts[s] = (stageCounts[s] || 0) + 1;
            typeCounts[t] = (typeCounts[t] || 0) + 1;
        });
        const stageKeys = CD_STAGES.filter((k) => stageCounts[k]).concat(
            Object.keys(stageCounts).filter((k) => !CD_STAGES.includes(k))
        );
        const typeKeys = CD_TYPES.filter((k) => typeCounts[k]).concat(
            Object.keys(typeCounts).filter((k) => !CD_TYPES.includes(k))
        );
        const maxStage = Math.max(1, ...stageKeys.map((k) => stageCounts[k]));

        const stageHtml = stageKeys.length
            ? stageKeys
                  .map(
                      (k) => `
                    <div class="cd-bar-row">
                        <span class="cd-bar-label">${escapeHtml(k)}</span>
                        <span class="cd-bar-track"><span class="cd-bar-fill" style="width:${Math.round((stageCounts[k] / maxStage) * 100)}%"></span></span>
                        <span class="cd-bar-num">${stageCounts[k]}</span>
                    </div>`
                  )
                  .join('')
            : '<div class="cr-muted">No active cases.</div>';

        const typeHtml = typeKeys.length
            ? `<div class="cd-chips">${typeKeys.map((k) => `<span class="cd-chip">${escapeHtml(k)} <strong>${typeCounts[k]}</strong></span>`).join('')}</div>`
            : '<div class="cr-muted">No active cases.</div>';

        const upcomingHtml = state.upcoming.length
            ? state.upcoming
                  .slice(0, 5)
                  .map((r) => {
                      const c = caseById(r.case_id);
                      return `
                        <button type="button" class="cd-row" data-case-id="${escapeHtml(r.case_id)}">
                            <span class="cd-row-icon"><i class="fa-solid fa-gavel"></i></span>
                            <span class="cd-row-main">
                                <span class="cd-row-title">${escapeHtml(caseTitleById(r.case_id))}</span>
                                <span class="cd-row-sub">${escapeHtml(r.title)}${c ? ' &bull; ' + escapeHtml(clientOf(c)) : ''}</span>
                            </span>
                            <span class="cd-row-date">${escapeHtml(crDateTime(r.next_hearing_date))}</span>
                        </button>`;
                  })
                  .join('')
            : '<div class="cr-muted">No upcoming hearings. Add a "Next hearing" to a report and it will show here.</div>';

        const activityHtml = state.activity.length
            ? state.activity
                  .map((e) => {
                      const isReport = e.source === 'report';
                      const icon = isReport ? 'fa-file-lines' : CR_EVENT_ICONS[e.event_type] || 'fa-circle';
                      const when = isReport ? crDate(String(e.event_at).slice(0, 10)) : crDateTime(e.event_at);
                      return `
                        <button type="button" class="cd-row" data-case-id="${escapeHtml(e.case_id)}" data-tab="history">
                            <span class="cd-row-icon"><i class="fa-solid ${icon}"></i></span>
                            <span class="cd-row-main">
                                <span class="cd-row-title">${escapeHtml(caseTitleById(e.case_id))}</span>
                                <span class="cd-row-sub">${escapeHtml(e.title)}</span>
                            </span>
                            <span class="cd-row-date">${escapeHtml(when)}</span>
                        </button>`;
                  })
                  .join('')
            : '<div class="cr-muted">No activity yet.</div>';

        body.innerHTML = `
                ${state.partial ? '<div class="cr-note">Some details could not be loaded. Counts may be incomplete.</div>' : ''}
                <div class="cd-tiles">
                    <div class="cd-tile"><span class="cd-tile-icon blue"><i class="fa-solid fa-folder-open"></i></span><div><div class="cd-tile-num">${active.length}</div><div class="cd-tile-label">Active cases</div></div></div>
                    <div class="cd-tile"><span class="cd-tile-icon slate"><i class="fa-solid fa-lock"></i></span><div><div class="cd-tile-num">${closedCount}</div><div class="cd-tile-label">Closed cases</div></div></div>
                    <div class="cd-tile"><span class="cd-tile-icon green"><i class="fa-solid fa-briefcase"></i></span><div><div class="cd-tile-num">${state.cases.length}</div><div class="cd-tile-label">Total cases</div></div></div>
                    <div class="cd-tile"><span class="cd-tile-icon amber"><i class="fa-solid fa-gavel"></i></span><div><div class="cd-tile-num">${state.upcoming.length}</div><div class="cd-tile-label">Upcoming hearings</div></div></div>
                </div>
                <div class="cd-grid2">
                    <section class="cd-card"><h3>Active cases by stage</h3>${stageHtml}</section>
                    <section class="cd-card"><h3>Active cases by type</h3>${typeHtml}</section>
                </div>
                <div class="cd-grid2">
                    <section class="cd-card"><h3>Upcoming hearings</h3><div class="cd-list">${upcomingHtml}</div></section>
                    <section class="cd-card"><h3>Recent activity</h3><div class="cd-list">${activityHtml}</div></section>
                </div>`;
    }

    function renderHistoryTab() {
        const total = state.cases.length;
        const closedN = state.cases.filter(isClosed).length;
        const filters = [
            ['all', 'All', total],
            ['active', 'Active', total - closedN],
            ['closed', 'Closed', closedN]
        ];
        body.innerHTML = `
                <div class="cd-toolbar">
                    <input type="search" id="cd-search" class="cr-input" placeholder="Search by title, case number, client or court" value="${escapeHtml(state.search)}" aria-label="Search cases" autocomplete="off">
                    <div class="cd-filters" role="group" aria-label="Filter cases">
                        ${filters.map((f) => `<button type="button" class="cd-filter${state.filter === f[0] ? ' active' : ''}" data-filter="${f[0]}">${f[1]} <span>${f[2]}</span></button>`).join('')}
                    </div>
                </div>
                <div id="cd-list"></div>`;
        renderHistoryList();
    }

    function renderHistoryList() {
        const listEl = overlay.querySelector('#cd-list');
        if (!listEl) return;
        const term = state.search.trim().toLowerCase();
        const rows = state.cases
            .filter((c) => {
                if (state.filter === 'active' && isClosed(c)) return false;
                if (state.filter === 'closed' && !isClosed(c)) return false;
                if (!term) return true;
                return [c.title, c.case_number, c.court_case_no, c.court_branch, c.defendant_name, c.defendant_counsel, clientOf(c)].some((v) =>
                    String(v || '')
                        .toLowerCase()
                        .includes(term)
                );
            })
            .sort((a, b) => new Date(filedOf(b)) - new Date(filedOf(a)));

        if (rows.length === 0) {
            listEl.innerHTML = `<div class="cr-empty"><i class="fa-regular fa-folder-open"></i><p>${state.cases.length === 0 ? 'No cases yet.' : 'No cases match your search.'}</p></div>`;
            return;
        }

        const dash = '<span class="cr-muted">-</span>';
        listEl.innerHTML = `
                <div class="cr-table-wrap">
                    <table class="cr-table">
                        <thead><tr><th>Case</th><th>Client</th><th>Type</th><th>Stage</th><th>Filed</th><th>Closed</th><th>Status</th><th class="cr-actions-head"></th></tr></thead>
                        <tbody>${rows
                            .map(
                                (c) => `
                            <tr class="cr-row">
                                <td class="cr-title-cell"><div class="cd-case-title">${escapeHtml(c.title)}</div>${c.case_number ? `<div class="cd-case-sub">#${escapeHtml(c.case_number)}</div>` : ''}</td>
                                <td>${escapeHtml(clientOf(c))}</td>
                                <td>${c.case_type ? escapeHtml(c.case_type) : dash}</td>
                                <td>${c.case_stage ? escapeHtml(c.case_stage) : dash}</td>
                                <td class="cr-nowrap">${filedOf(c) ? escapeHtml(crDate(filedOf(c))) : dash}</td>
                                <td class="cr-nowrap">${closedOn(c) ? escapeHtml(crDate(closedOn(c))) : dash}</td>
                                <td>${isClosed(c) ? '<span class="cr-badge cr-badge-private">Closed</span>' : '<span class="cr-badge cr-badge-shared">Active</span>'}</td>
                                <td class="cr-actions-cell"><div><button type="button" class="cd-link-btn" data-case-id="${escapeHtml(c.id)}" data-tab="history">View history</button></div></td>
                            </tr>`
                            )
                            .join('')}
                        </tbody>
                    </table>
                </div>`;
    }

    function showTab(tab) {
        state.tab = tab;
        overlay.querySelectorAll('.cr-tab').forEach((t) => {
            const on = t.dataset.tab === tab;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        if (tab === 'dashboard') renderDashboard();
        else renderHistoryTab();
    }

    overlay.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.cr-tab');
        if (tabBtn) {
            if (tabBtn.dataset.tab !== state.tab) showTab(tabBtn.dataset.tab);
            return;
        }

        const filterBtn = e.target.closest('[data-filter]');
        if (filterBtn) {
            state.filter = filterBtn.dataset.filter;
            overlay.querySelectorAll('.cd-filter').forEach((b) => b.classList.toggle('active', b === filterBtn));
            renderHistoryList();
            return;
        }

        const caseBtn = e.target.closest('[data-case-id]');
        if (caseBtn && typeof window.openCaseReports === 'function') {
            window.openCaseReports(caseBtn.dataset.caseId, caseBtn.dataset.tab || 'reports');
        }
    });

    overlay.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'cd-search') {
            state.search = e.target.value;
            renderHistoryList();
        }
    });

    try {
        await load();
        if (!document.body.contains(overlay)) return;
        renderDashboard();
    } catch (err) {
        console.error('Error loading the cases dashboard:', err);
        if (document.body.contains(overlay)) {
            body.innerHTML =
                '<div class="cr-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>Could not load the cases.</p><small>' +
                escapeHtml(err.message || '') +
                '</small></div>';
        }
    }
};

window.openCaseForm = openCaseForm;
window.openCaseTeam = function (caseId) {
    openTeamModal('case', caseId);
};
function readableDbError(error, fallback) {
    const raw = error && error.message ? String(error.message) : '';
    const code = error && error.code ? String(error.code) : '';
    if (code === '23503' || /foreign key|violates/i.test(raw)) {
        return 'It is still linked to other records.';
    }
    if (/permission denied|row-level security|not authorized|not allowed/i.test(raw)) {
        return 'You do not have permission to do this.';
    }
    if (/duplicate key|unique constraint|already exists/i.test(raw)) {
        return 'This already exists.';
    }
    if (/failed to fetch|network|timeout/i.test(raw)) {
        return 'There is a connection problem. Please check your internet and try again.';
    }
    return fallback || 'Something went wrong. Please try again.';
}

window.deleteCase = async function (caseId) {
    if (!isAdminUser()) return;
    const c = (window.__casesRegistry || {})[caseId];
    if (
        !(await confirmDialog({
            title: 'Delete case',
            confirmLabel: 'Delete',
            danger: true,
            message: `Delete case "${c ? c.title : ''}"? This cannot be undone.`
        }))
    )
        return;
    const { error } = await supabaseClient.from('cases').delete().eq('id', caseId);
    if (error) {
        console.error('Error deleting case:', error);
        const linked = error.code === '23503' || /foreign key|violates/i.test(error.message || '');
        showToast(
            linked
                ? 'This case cannot be deleted because it still has calendar events, documents or other records linked to it. Remove those first, or close the case instead.'
                : 'The case could not be deleted. ' + readableDbError(error),
            'error'
        );
        return;
    }

    await logAuditActivity('DELETE', 'Cases', `Deleted case: ${c ? c.title : caseId}`, caseId, c, null);

    await renderCasesTabView();
    updateDashboardStats();
};

function checkPhoneNumber(raw, required) {
    const value = String(raw || '').trim();
    if (!value) return required ? { ok: false, message: 'Enter a phone number.' } : { ok: true, clean: '' };
    if (!/^\+?[0-9\s()-]+$/.test(value)) {
        return { ok: false, message: 'Use numbers only. Letters and symbols are not allowed.' };
    }
    const digits = value.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
        return { ok: false, message: 'Enter a phone number with 7 to 15 digits.' };
    }
    return { ok: true, clean: (value.startsWith('+') ? '+' : '') + digits };
}

function clearPhoneError(inputId) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(inputId + '-error');
    const field = input ? input.closest('.mc-field') : null;
    if (field) field.classList.remove('invalid');
    if (err) err.textContent = '';
}

function showPhoneError(inputId, message, inlineOnly) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(inputId + '-error');
    const field = input ? input.closest('.mc-field') : null;
    if (err) {
        err.textContent = message;
        if (field) field.classList.add('invalid');
        if (input && !inlineOnly) input.focus();
        return;
    }
    if (!inlineOnly) showToast(message, 'error');
}

function bindPhoneField(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.phoneBound) return;
    input.dataset.phoneBound = '1';
    input.setAttribute('inputmode', 'tel');
    input.setAttribute('maxlength', '20');
    input.addEventListener('input', () => {
        const cleaned = input.value.replace(/[^0-9+\s()-]/g, '');
        if (cleaned !== input.value) input.value = cleaned;
        clearPhoneError(inputId);
    });
    input.addEventListener('blur', () => {
        if (!input.value.trim()) return;
        const result = checkPhoneNumber(input.value, false);
        if (!result.ok) showPhoneError(inputId, result.message, true);
    });
}

function initPhoneFields() {
    ['mc-phone', 'ec-phone', 'add-lawyer-phone', 'edit-lawyer-phone', 'my-profile-phone'].forEach(bindPhoneField);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPhoneFields);
else initPhoneFields();

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
                window.__clientsSort = { key: key, dir: cur.key === key && cur.dir === 'asc' ? 'desc' : 'asc' };
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
            if (sortTh) {
                e.preventDefault();
                sortTh.click();
            }
        });
    }

    if (openBtn && addModal) {
        openBtn.addEventListener('click', () => {
            if (!isStaffUser()) return;
            if (form) form.reset();
            clearPhoneError('mc-phone');
            addModal.classList.remove('hidden');
        });
    }
    if (closeAddBtn && addModal) closeAddBtn.addEventListener('click', () => addModal.classList.add('hidden'));
    if (closeEditBtn && editModal) closeEditBtn.addEventListener('click', () => editModal.classList.add('hidden'));
    const cancelAddBtn = document.getElementById('mc-cancel');
    const cancelEditBtn = document.getElementById('ec-cancel');
    if (cancelAddBtn && addModal) cancelAddBtn.addEventListener('click', () => addModal.classList.add('hidden'));
    if (cancelEditBtn && editModal) cancelEditBtn.addEventListener('click', () => editModal.classList.add('hidden'));

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isStaffUser()) return;

            const submitBtn = form.querySelector('button[type="submit"]');
            const idleLabel = 'Add client';
            const setBusy = (label) => {
                submitBtn.disabled = true;
                submitBtn.textContent = label;
            };
            const val = (id) => (document.getElementById(id)?.value || '').trim();

            const clientName = formatClientFullName(val('mc-fname'), val('mc-mi'), val('mc-lname'));
            const email = val('mc-email');
            const phoneCheck = checkPhoneNumber(val('mc-phone'), true);
            if (!phoneCheck.ok) {
                showPhoneError('mc-phone', phoneCheck.message);
                return;
            }
            const phone = phoneCheck.clean;
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
                [byEmail, byPhone, byName].forEach((r) => {
                    if (r.error) throw r.error;
                });

                const dup = byEmail.data?.[0] || byPhone.data?.[0] || byName.data?.[0];
                if (dup) {
                    showToast(
                        `A client with this name, email or phone already exists: "${dup.client_name}" (${dup.client_email || 'no email'}). Find them in the Client Directory instead of adding a duplicate.`,
                        'warning'
                    );
                    return;
                }

                setBusy('Saving client...');
                const { data: newClient, error: clientError } = await supabaseClient
                    .from('clients')
                    .insert([
                        {
                            client_name: clientName,
                            client_email: email,
                            client_phone: phone,
                            full_address: address || null,
                            registered_by: currentUser ? currentUser.id : null
                        }
                    ])
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
                            redirect_to:
                                window.location.origin +
                                window.location.pathname.replace('index.html', '') +
                                'client-login.html'
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
            const val = (id) => (document.getElementById(id)?.value || '').trim();
            const submitBtn = editForm.querySelector('button[type="submit"]');
            const editPhone = checkPhoneNumber(val('ec-phone'), true);
            if (!editPhone.ok) {
                showPhoneError('ec-phone', editPhone.message);
                return;
            }
            submitBtn.disabled = true;
            try {
                const clientId = Number(val('ec-id'));
                const oldClient = (window.__clientsDirectory || []).find((c) => c.id === clientId) || {};
                const patch = {
                    client_name: val('ec-name'),
                    client_email: val('ec-email'),
                    client_phone: editPhone.clean,
                    full_address: val('ec-address') || null
                };

                const { data: updated, error } = await supabaseClient
                    .from('clients')
                    .update(patch)
                    .eq('id', clientId)
                    .select('id');

                if (error) throw error;
                if (!updated || updated.length === 0)
                    throw new Error('The client was not updated. Check your permissions.');

                await logAuditActivity(
                    'UPDATE',
                    'Clients',
                    `Edited client profile: ${patch.client_name}`,
                    clientId,
                    oldClient,
                    patch
                );

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

window.openCaseDetail = async function (caseId) {
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
    syncCaseAttachment();
    const noteEl = document.getElementById('case-email-note');
    if (noteEl) {
        const clientEmail = caseInfo?.clients?.client_email;
        noteEl.textContent = clientEmail
            ? `Sent to ${clientEmail} by email and shown in the client's portal.`
            : 'This client has no email on file, so updates cannot be sent.';
    }
    delete listEl.dataset.loadedFor;
    modal.classList.remove('hidden');
    populateEmailTemplateSelect();
    listEl.innerHTML = skeletonRows(3);

    await loadCaseEmails(caseId);
};

function caseThreadInitials(name) {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function syncCaseAttachment() {
    const input = document.getElementById('case-email-attachment');
    const nameEl = document.getElementById('case-attach-name');
    const clearBtn = document.getElementById('case-attach-clear');
    if (!input || !nameEl || !clearBtn) return;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    nameEl.textContent = file ? file.name : '';
    clearBtn.classList.toggle('cm-hidden', !file);
}

const SECURE_EMAIL_REF_LENGTH = 4;

function clientLoginUrl() {
    return window.location.origin + window.location.pathname.replace('index.html', '') + 'client-login.html';
}

function buildSecureEmailContent(caseNumber) {
    const ref = String(caseNumber || '')
        .trim()
        .slice(-SECURE_EMAIL_REF_LENGTH);
    const refText = ref ? ' Case reference ending in ' + ref + '.' : '';
    return {
        subject: 'Message sent',
        body:
            'Message sent.' +
            refText +
            '\n\nFor your privacy, the message is not shown in this email. Please sign in to your JuriSync client portal to read it.' +
            '\n\nSign in here: ' +
            clientLoginUrl()
    };
}

async function resolveCaseNumber(caseId) {
    const cached = (window.__casesRegistry || {})[caseId];
    if (cached && cached.case_number) return cached.case_number;
    const { data } = await supabaseClient.from('cases').select('case_number').eq('id', caseId).maybeSingle();
    return data ? data.case_number : '';
}

async function loadCaseEmails(caseId) {
    const listEl = document.getElementById('case-emails-list');
    if (!listEl) return;

    try {
        const { data: emails, error } = await supabaseClient
            .from('email_queue')
            .select(
                '*, legacy_doc:documents!attachment_document_id(title, file_path), documents:documents!secure_attachment_document_id(title, file_path)'
            )
            .eq('case_id', caseId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const firstLoad = listEl.dataset.loadedFor !== String(caseId);
        const nearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 80;
        const caseInfo = (window.__casesRegistry || {})[caseId];
        const clientName = caseInfo?.clients?.client_name || 'Client';

        if (!emails || emails.length === 0) {
            listEl.innerHTML = `
                    <div class="cm-empty">
                        <i class="fa-regular fa-comments"></i>
                        <strong>No conversation yet</strong>
                        <span>Send the first update below. Your client's replies will show up here.</span>
                    </div>`;
        } else {
            let lastDay = '';
            listEl.innerHTML = emails
                .map((m) => {
                    const when = new Date(m.created_at);
                    const dayKeyText = when.toDateString();
                    let separator = '';
                    if (dayKeyText !== lastDay) {
                        lastDay = dayKeyText;
                        const today = new Date();
                        const yesterday = new Date();
                        yesterday.setDate(today.getDate() - 1);
                        const label =
                            dayKeyText === today.toDateString()
                                ? 'Today'
                                : dayKeyText === yesterday.toDateString()
                                  ? 'Yesterday'
                                  : when.toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    });
                        separator = `<div class="cm-day">${escapeHtml(label)}</div>`;
                    }
                    const timeText = when.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });

                    if (m.kind === 'client_message') {
                        return `${separator}
                            <div class="cm-row theirs">
                                <span class="cm-avatar" aria-hidden="true">${escapeHtml(caseThreadInitials(clientName))}</span>
                                <div class="cm-wrap">
                                    <span class="cm-who">${escapeHtml(clientName)}</span>
                                    <div class="cm-bubble"><div class="cm-text">${escapeHtml(m.body || '')}</div></div>
                                    <div class="cm-meta">${escapeHtml(timeText)}</div>
                                </div>
                            </div>`;
                    }

                    const status = m.status || (m.is_sent ? 'sent' : 'pending');
                    const attachedDocRow = m.documents || m.legacy_doc;
                    const attachment = attachedDocRow
                        ? `<a href="#" class="cm-attach-chip" data-doc-path="${escapeHtml(attachedDocRow.file_path || '')}" data-doc-title="${escapeHtml(attachedDocRow.title || '')}"><i class="fa-solid fa-paperclip"></i> ${escapeHtml(attachedDocRow.title)}</a>`
                        : '';
                    const shownSubject = m.secure_subject != null ? m.secure_subject : m.subject;
                    const shownBody = m.secure_body != null ? m.secure_body : m.body;
                    const metaStatus =
                        status === 'sent'
                            ? '<span class="cm-sent"><i class="fa-solid fa-check"></i> Emailed</span>'
                            : `${emailStatusBadge(status)} <span>${escapeHtml(emailTimeText(m))}</span>`;
                    const failed =
                        status === 'failed'
                            ? `<p class="cm-failed">${escapeHtml(m.last_error || 'Sending failed.')} <a href="#" onclick="event.preventDefault(); retryEmail(${jsArg(m.id)}).then(() => loadCaseEmails(${jsArg(caseId)}));">Retry</a></p>`
                            : '';
                    return `${separator}
                        <div class="cm-row mine">
                            <div class="cm-wrap">
                                <div class="cm-bubble">
                                    ${shownSubject ? `<span class="cm-subject">${escapeHtml(shownSubject)}</span>` : ''}
                                    <div class="cm-text">${escapeHtml(shownBody || '')}</div>
                                    ${attachment}
                                </div>
                                <div class="cm-meta" title="To: ${escapeHtml(m.recipient_email || '')}">${escapeHtml(timeText)} ${metaStatus}</div>
                                ${failed}
                            </div>
                        </div>`;
                })
                .join('');
        }

        listEl.dataset.loadedFor = String(caseId);
        if (firstLoad || nearBottom) listEl.scrollTop = listEl.scrollHeight;
    } catch (error) {
        console.error('Error loading case emails:', error);
        listEl.innerHTML = errorStateHtml('Could not load the conversation for this case.', null);
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

    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    const attachInput = document.getElementById('case-email-attachment');
    const attachClear = document.getElementById('case-attach-clear');
    if (attachInput) attachInput.addEventListener('change', syncCaseAttachment);
    if (attachClear) {
        attachClear.addEventListener('click', () => {
            if (attachInput) attachInput.value = '';
            syncCaseAttachment();
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

            if (
                countPlaceholders(subject + '\n' + body) > 0 &&
                !confirm('This message still has text in [brackets] that looks like a placeholder. Send it anyway?')
            ) {
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            try {
                const attachmentFile =
                    attachmentInput && attachmentInput.files.length > 0 ? attachmentInput.files[0] : null;
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

                const secure = buildSecureEmailContent(await resolveCaseNumber(caseId));
                const emailRow = {
                    case_id: caseId,
                    client_id: clientId || null,
                    recipient_email: recipientEmail,
                    subject: secure.subject,
                    body: secure.body,
                    secure_subject: subject,
                    secure_body: body,
                    sent_by: currentUser ? currentUser.id : null,
                    scheduled_at: new Date().toISOString()
                };
                if (attachedDoc) emailRow.secure_attachment_document_id = attachedDoc.id;

                const { error } = await supabaseClient.from('email_queue').insert([emailRow]);

                if (error) throw error;
                subjectInput.value = '';
                bodyInput.value = '';
                if (attachmentInput) attachmentInput.value = '';
                syncCaseAttachment();
                const threadEl = document.getElementById('case-emails-list');
                if (threadEl) delete threadEl.dataset.loadedFor;
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

    const nameError = document.createElement('p');
    nameError.id = 'doc-file-name-error';
    nameError.setAttribute('role', 'alert');
    nameError.style.cssText = 'color:#c23a3a; font-size:12px; margin:6px 0 0 0; display:none;';
    if (fileNameInput) {
        fileNameInput.insertAdjacentElement('afterend', nameError);
        fileNameInput.setAttribute('aria-describedby', 'doc-file-name-error');
        fileNameInput.addEventListener('input', () => {
            const typed = fileNameInput.value.trim();
            showNameError(typed ? fileNameProblem(typed) : '');
        });
    }

    function showNameError(message) {
        nameError.textContent = message || '';
        nameError.style.display = message ? 'block' : 'none';
        if (fileNameInput) fileNameInput.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    async function acceptFile(file) {
        const problem = await validateUploadFile(file);
        if (problem) {
            showToast(problem, 'error');
            resetUploadForm();
            return;
        }
        selectedFile = file;
        dropText.innerText = file.name;
        if (fileNameInput) fileNameInput.value = sanitizeFileName(file.name);
        showNameError('');
        dropArea.style.borderColor = '#3976c5';
        dropArea.style.backgroundColor = 'var(--accent-soft)';
    }

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

            (myCases || []).forEach((c) => {
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
            dropArea.style.borderColor = 'var(--border-strong)';
            dropArea.style.backgroundColor = 'var(--surface)';
            dropText.innerText = 'Drag and drop files here, or click to browse';
        }
        selectedFile = null;
        if (fileNameInput) fileNameInput.value = '';
        showNameError('');
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
            if (e.target.files.length > 0) acceptFile(e.target.files[0]);
        });

        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = '#3976c5';
            dropArea.style.backgroundColor = 'var(--accent-soft)';
        });

        dropArea.addEventListener('dragleave', () => {
            if (!selectedFile) {
                dropArea.style.borderColor = 'var(--border-strong)';
                dropArea.style.backgroundColor = 'var(--surface)';
            }
        });

        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) acceptFile(e.dataTransfer.files[0]);
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!selectedFile) {
                showToast('Please select or drag a file to upload first.', 'warning');
                return;
            }

            const blockedReason = await validateUploadFile(selectedFile);
            if (blockedReason) {
                showToast(blockedReason, 'error');
                resetUploadForm();
                return;
            }

            const finalTitle = resolveDocumentTitle(fileNameInput ? fileNameInput.value : '', selectedFile);
            const nameProblem = fileNameProblem(finalTitle);
            if (nameProblem) {
                showNameError(nameProblem);
                if (fileNameInput) fileNameInput.focus();
                return;
            }
            showNameError('');

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Checking...';
            }

            let proceed = true;
            try {
                proceed = await confirmDuplicateUpload(selectedFile, finalTitle);
            } catch (dupError) {
                console.error('Duplicate check error:', dupError);
            }
            if (!proceed) {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Upload & Process';
                }
                return;
            }
            if (submitBtn) submitBtn.innerText = 'Uploading & Processing...';

            const caseSel = document.getElementById('doc-case-select');
            const selectedCaseOpt = caseSel && caseSel.value ? caseSel.selectedOptions[0] : null;
            const matchedCaseId = selectedCaseOpt ? selectedCaseOpt.value : null;
            const matchedClientId =
                selectedCaseOpt && selectedCaseOpt.dataset.clientId ? selectedCaseOpt.dataset.clientId : null;
            const caseNum = selectedCaseOpt ? selectedCaseOpt.dataset.caseNumber || '' : '';
            const category = document.getElementById('doc-category').value || 'Document';
            const tagsInput = document.getElementById('doc-tags').value || '';

            const fileSizeMb = (selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB';

            try {
                const uniqueFileName = `${Date.now()}_${safeStorageName(selectedFile.name)}`;
                const { error: uploadError } = await supabaseClient.storage
                    .from('documents')
                    .upload(uniqueFileName, selectedFile);

                if (uploadError) {
                    console.error('Storage Error:', uploadError);
                    throw new Error(
                        "Failed to upload file to Storage. Please check if 'documents' bucket exists and your account is allowed to upload to it."
                    );
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
                    console.error('Database Error:', dbError);
                    throw new Error('File uploaded, but failed to save details to database.');
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
                    submitBtn.innerText = 'Upload & Process';
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
                roleSel.innerHTML = (roles || [])
                    .map((r) => `<option value="${r.id}" data-name="${r.name}">${roleLabel(r.name)}</option>`)
                    .join('');
            } catch (err) {
                console.error('Error loading roles:', err);
                roleSel.innerHTML = '<option value="">Could not load roles</option>';
            }
            const syncSpec = () => {
                const name = roleSel.options[roleSel.selectedIndex]?.dataset.name;
                if (specGroup) specGroup.style.display = name === 'secretary' ? 'none' : '';
                const pwInput = document.getElementById('add-lawyer-password');
                const pwGroup = pwInput ? pwInput.closest('.form-group') : null;
                const invite = name === 'lawyer';
                if (pwGroup) pwGroup.style.display = invite ? 'none' : '';
                if (pwInput) pwInput.required = !invite;
                const submit = form ? form.querySelector('button[type="submit"]') : null;
                if (submit) submit.textContent = invite ? 'Send Invitation' : 'Register User';
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

            const lawyerPhoneCheck = checkPhoneNumber(document.getElementById('add-lawyer-phone').value, true);
            if (!lawyerPhoneCheck.ok) {
                showToast(lawyerPhoneCheck.message, 'error');
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Registering...';
            }

            const fname = document.getElementById('add-lawyer-fname').value.trim();
            const mi = document.getElementById('add-lawyer-mi').value.trim();
            const lname = document.getElementById('add-lawyer-lname').value.trim();
            const email = document.getElementById('add-lawyer-email').value.trim();
            const phone = lawyerPhoneCheck.clean;
            const password = document.getElementById('add-lawyer-password').value;
            const roleSel = document.getElementById('add-lawyer-role');
            const roleId = Number(roleSel.value);
            const roleName = roleSel.options[roleSel.selectedIndex]?.dataset.name || 'lawyer';
            const isLawyerRole = roleName === 'lawyer';
            const spec = isLawyerRole ? document.getElementById('add-lawyer-spec').value : null;

            const formattedName = `${fname} ${mi ? mi + '. ' : ''}${lname}`.trim();

            try {
                if (isLawyerRole) {
                    const { data, error } = await supabaseClient.functions.invoke('invite-lawyer', {
                        body: {
                            action: 'create',
                            email: email,
                            full_name: formattedName,
                            phone: phone,
                            specialization: spec
                        }
                    });
                    if (error) throw new Error(await readFunctionError(error));
                    if (data && data.invitation_sent === false) {
                        showToast(
                            `Atty. ${formattedName} was created as Pending, but the invitation email could not be sent. Use Resend Invitation.`,
                            'warning'
                        );
                    } else {
                        showToast(
                            `Invitation sent to ${email}. Atty. ${formattedName} is Pending until they accept.`,
                            'success'
                        );
                    }
                } else {
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
                    if (error) throw new Error('Failed to register user: ' + (await readFunctionError(error)));
                    showToast(`Secretary ${formattedName} successfully registered!`, 'success');
                }

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
                    submitBtn.innerText = 'Register User';
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
                        specSelect.style.backgroundColor = '#f7f5f0';
                        specSelect.style.color = '#101b2d';
                        specSelect.style.cursor = 'pointer';
                    } else {
                        specSelect.disabled = true;
                        specSelect.style.backgroundColor = '#eeebe3';
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

            const profilePhoneCheck = checkPhoneNumber(document.getElementById('my-profile-phone').value, false);
            if (!profilePhoneCheck.ok) {
                showToast(profilePhoneCheck.message, 'error');
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Saving...';
            }

            const newName = document.getElementById('my-profile-fullname').value.trim();
            const newPhone = profilePhoneCheck.clean;

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

                    const { data: publicUrlData } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);

                    updatePayload.avatar_url = publicUrlData.publicUrl;
                }

                const { error } = await supabaseClient.from('profiles').update(updatePayload).eq('id', currentUser.id);

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
                    submitBtn.innerText = 'Save Changes';
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

            const editLawyerPhoneCheck = checkPhoneNumber(document.getElementById('edit-lawyer-phone').value, true);
            if (!editLawyerPhoneCheck.ok) {
                showToast(editLawyerPhoneCheck.message, 'error');
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Saving Changes...';
            }

            const lawyerId = document.getElementById('edit-lawyer-id').value;
            const newName = document.getElementById('edit-lawyer-fullname').value.trim();
            const newPhone = editLawyerPhoneCheck.clean;
            const newSpec = document.getElementById('edit-lawyer-spec').value;
            const isSecretaryEdit = modal.dataset.role === 'secretary';
            const patch = isSecretaryEdit
                ? { full_name: newName, phone: newPhone }
                : { full_name: newName, phone: newPhone, specialization: newSpec };

            try {
                const { data: oldData } = await supabaseClient.from('profiles').select('*').eq('id', lawyerId).single();

                const { error } = await supabaseClient.from('profiles').update(patch).eq('id', lawyerId);

                if (error) throw new Error(error.message);

                await logAuditActivity(
                    'UPDATE',
                    'Profiles',
                    `Edited ${isSecretaryEdit ? 'secretary' : 'lawyer'} profile: ${newName}`,
                    lawyerId,
                    oldData,
                    patch
                );

                showToast(
                    isSecretaryEdit
                        ? 'Secretary profile successfully updated!'
                        : 'Lawyer profile successfully updated!',
                    'success'
                );
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
                    submitBtn.innerText = 'Save Changes';
                }
            }
        });
    }
}

window.openEditLawyerModal = function (id, name, phone, spec, role) {
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
            confirmBtn.innerText = 'Archiving...';

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
                confirmBtn.innerText = 'Archive Account';
            }
        });
    }
}

const SPECIALIZATIONS = ['General Practice', 'Criminal Law', 'Corporate Law', 'Family Law', 'Civil Litigation'];

async function readFunctionError(error) {
    let message = error.message;
    try {
        const body = await error.context.json();
        if (body && body.error) message = body.error;
    } catch (e) {}
    return message;
}

function invitationState(invites, id) {
    const inv = (invites || {})[id];
    if (!inv || inv.used_at || inv.invalidated_at || new Date(inv.expires_at) <= new Date()) return 'expired';
    return 'pending';
}

window.resendLawyerInvitation = async function (id, name) {
    if (globalRoleName !== 'admin') return;
    const ok = await confirmDialog({
        title: 'Resend invitation',
        confirmLabel: 'Resend',
        message: `Send a new invitation to Atty. ${name}? The previous link will stop working.`
    });
    if (!ok) return;
    const { error } = await supabaseClient.functions.invoke('invite-lawyer', {
        body: { action: 'resend', user_id: id }
    });
    if (error) {
        showToast('Could not resend the invitation: ' + (await readFunctionError(error)), 'error');
        return;
    }
    showToast(`A new invitation was emailed to Atty. ${name}.`, 'success');
    renderManageLawyersList();
};

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
    (data || []).forEach((p) => {
        map[p.id] = p.full_name;
    });
    return map;
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
                <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #e5e1d8; padding-bottom:15px; margin-bottom:16px;">
                    <div>
                        <h2 style="font-size:18px; font-weight:700; color:#252d3a; margin:0;">${escapeHtml(title)}</h2>
                        <p style="font-size:12px; color:#64748b; margin:4px 0 0 0;">${subtitleHtml}</p>
                    </div>
                    <button type="button" data-um-close aria-label="Close" title="Close" style="background:transparent; border:none; font-size:20px; cursor:pointer; color:#64748b; padding:0;"><i class="fa-solid fa-xmark"></i></button>
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
        supabaseClient
            .from('case_lawyers')
            .select('case_id, cases!inner(status)', { count: 'exact', head: true })
            .eq('lawyer_id', lawyerId)
            .eq('cases.status', 'active'),
        supabaseClient
            .from('client_lawyers')
            .select('client_lawyer_id', { count: 'exact', head: true })
            .eq('lawyer_id', lawyerId),
        supabaseClient
            .from('calendar_events')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', lawyerId)
            .gte('start_date', nowIso)
    ]);
    const failed = casesRes.error || clientsRes.error || eventsRes.error;
    if (failed) throw new Error(failed.message);
    return { cases: casesRes.count || 0, clients: clientsRes.count || 0, events: eventsRes.count || 0 };
}

function workSummaryHtml(work) {
    const row = (n, singular, plural) => `<li>${n} ${n === 1 ? singular : plural}</li>`;
    return `
            <div style="background:#f7f5f0; border:1px solid #e5e1d8; border-radius:8px; padding:12px 14px; font-size:13px; color:#3b4656; margin-bottom:16px;">
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
            <label style="display:block; font-size:13px; font-weight:600; color:#101b2d; margin-bottom:6px;">Transfer their work to</label>
            <div style="position:relative; margin-bottom:8px;">
                <select id="um-replacement" style="width:100%; padding:10px 12px; border:1px solid #d5cfc2; border-radius:6px; background:#f7f5f0; font-family:inherit; appearance:none;">
                    <option value="">Select a lawyer</option>
                    ${lawyers.map((l) => `<option value="${escapeHtml(l.id)}">Atty. ${escapeHtml(l.full_name || 'Unnamed')}${l.specialization ? ' — ' + escapeHtml(l.specialization) : ''}</option>`).join('')}
                </select>
                <i class="fa-solid fa-chevron-down" style="position:absolute; right:12px; top:14px; color:#64748b; pointer-events:none; font-size:12px;"></i>
            </div>
            <p style="font-size:12px; color:#64748b; margin:0 0 16px 0;">Lead roles carry over. Closed cases keep their original lawyers. Upcoming events move too, so check the calendar for overlaps afterwards.</p>`;
}

function modalButtonsHtml(confirmLabel, confirmColor) {
    return `
            <div id="um-error" style="color:#d64545; font-size:12px; min-height:16px; margin-bottom:10px;"></div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" id="um-cancel" style="padding:10px 18px; border:1px solid #d5cfc2; background:white; border-radius:6px; cursor:pointer; font-weight:600;">Cancel</button>
                <button type="button" id="um-confirm" style="padding:10px 18px; background:${confirmColor}; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:600;">${escapeHtml(confirmLabel)}</button>
            </div>`;
}

window.openArchiveLawyerModal = async function (id, name) {
    if (globalRoleName !== 'admin') return;
    const modal = openUserModal(
        'Archive Lawyer',
        `Atty. ${escapeHtml(name)}`,
        '<p style="color:#64748b; text-align:center; padding:20px;">Checking assignments...</p>'
    );

    try {
        const [work, allLawyers] = await Promise.all([getLawyerWorkSummary(id), getActiveLawyersData()]);
        const others = allLawyers.filter((l) => l.id !== id);
        const hasWork = work.cases + work.clients + work.events > 0;

        let middle;
        if (!hasWork) {
            middle = `<p style="font-size:13px; color:#4f5b6d; margin:0 0 16px 0;">Atty. ${escapeHtml(name)} has no active assignments. Their account will be deactivated and their historical records will stay intact.</p>`;
        } else if (others.length === 0) {
            middle = `${workSummaryHtml(work)}<p style="font-size:13px; color:#d64545; margin:0 0 16px 0;">There is no other active lawyer to take over this work. Add or restore a lawyer first.</p>`;
        } else {
            middle = workSummaryHtml(work) + replacementSelectHtml(others);
        }

        modal.body.innerHTML = middle + modalButtonsHtml(hasWork ? 'Transfer & archive' : 'Archive account', '#d69b2d');
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
            showToast(
                hasWork
                    ? `Atty. ${name} was archived. Transferred ${data.cases} case(s), ${data.clients} client(s) and ${data.events} upcoming event(s).`
                    : `Atty. ${name} was archived.`,
                'success'
            );
            refreshUserDirectories();
        });
    } catch (err) {
        console.error('Archive modal error:', err);
        modal.body.innerHTML = errorStateHtml("Could not check this lawyer's assignments.", null);
    }
};

window.openChangeRoleModal = async function (id, name, currentRole) {
    if (globalRoleName !== 'admin') return;
    const toRole = currentRole === 'lawyer' ? 'secretary' : 'lawyer';
    const label = (r) => (r === 'lawyer' ? 'Lawyer' : 'Secretary');
    const modal = openUserModal(
        'Change Role',
        `${escapeHtml(name)}: ${label(currentRole)} &rarr; ${label(toRole)}`,
        '<p style="color:#64748b; text-align:center; padding:20px;">Checking assignments...</p>'
    );

    try {
        let hasWork = false;
        let others = [];
        let middle = '';

        if (currentRole === 'lawyer') {
            const [work, allLawyers] = await Promise.all([getLawyerWorkSummary(id), getActiveLawyersData()]);
            others = allLawyers.filter((l) => l.id !== id);
            hasWork = work.cases + work.clients + work.events > 0;
            if (!hasWork) {
                middle =
                    '<p style="font-size:13px; color:#4f5b6d; margin:0 0 16px 0;">They have no active assignments. As a secretary they will no longer be assignable to cases or clients.</p>';
            } else if (others.length === 0) {
                middle = `${workSummaryHtml(work)}<p style="font-size:13px; color:#d64545; margin:0 0 16px 0;">There is no other active lawyer to take over this work. Add or restore a lawyer first.</p>`;
            } else {
                middle = workSummaryHtml(work) + replacementSelectHtml(others);
            }
        } else {
            middle = `
                    <p style="font-size:13px; color:#4f5b6d; margin:0 0 14px 0;">As a lawyer they can be assigned clients and cases.</p>
                    <label style="display:block; font-size:13px; font-weight:600; color:#101b2d; margin-bottom:6px;">Specialization</label>
                    <div style="position:relative; margin-bottom:16px;">
                        <select id="um-spec" style="width:100%; padding:10px 12px; border:1px solid #d5cfc2; border-radius:6px; background:#f7f5f0; font-family:inherit; appearance:none;">
                            ${SPECIALIZATIONS.map((sp) => `<option value="${escapeHtml(sp)}">${escapeHtml(sp)}</option>`).join('')}
                        </select>
                        <i class="fa-solid fa-chevron-down" style="position:absolute; right:12px; top:14px; color:#64748b; pointer-events:none; font-size:12px;"></i>
                    </div>`;
        }

        middle +=
            '<p style="font-size:12px; color:#64748b; margin:0 0 12px 0;">The change applies immediately. If they are signed in, they should sign in again to see the right menus.</p>';

        modal.body.innerHTML = middle + modalButtonsHtml('Change role', '#3976c5');
        const confirmBtn = modal.body.querySelector('#um-confirm');
        const errEl = modal.body.querySelector('#um-error');
        modal.body.querySelector('#um-cancel').addEventListener('click', modal.close);
        if (currentRole === 'lawyer' && hasWork && others.length === 0) confirmBtn.disabled = true;

        confirmBtn.addEventListener('click', async () => {
            const replacement =
                currentRole === 'lawyer' && hasWork ? (modal.body.querySelector('#um-replacement') || {}).value : '';
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

window.openResetPasswordModal = function (id, name) {
    if (globalRoleName !== 'admin') return;
    const modal = openUserModal(
        'Reset Password',
        escapeHtml(name),
        `
            <p style="font-size:13px; color:#4f5b6d; margin:0 0 14px 0;">Set a password. They will be asked to choose their own the next time they sign in.</p>
            <label style="display:block; font-size:13px; font-weight:600; color:#101b2d; margin-bottom:6px;">Password</label>
            <div style="display:flex; gap:8px; margin-bottom:6px;">
                <input type="text" id="um-pw" autocomplete="off" style="flex:1; padding:10px 12px; border:1px solid #d5cfc2; border-radius:6px; font-family:monospace; background:#f7f5f0;">
                <button type="button" id="um-pw-generate" style="padding:10px 12px; border:1px solid #d5cfc2; background:white; border-radius:6px; cursor:pointer; font-weight:600; font-size:12px;">Generate</button>
                <button type="button" id="um-pw-copy" style="padding:10px 12px; border:1px solid #d5cfc2; background:white; border-radius:6px; cursor:pointer; font-weight:600; font-size:12px;">Copy</button>
            </div>
            <p style="font-size:12px; color:#64748b; margin:0 0 16px 0;">At least 8 characters with a letter and a number. Share it with them privately.</p>
            ${modalButtonsHtml('Reset password', '#3d5a80')}
        `
    );

    const pwInput = modal.body.querySelector('#um-pw');
    const errEl = modal.body.querySelector('#um-error');
    const confirmBtn = modal.body.querySelector('#um-confirm');
    pwInput.value = generateTempPassword();

    modal.body.querySelector('#um-pw-generate').addEventListener('click', () => {
        pwInput.value = generateTempPassword();
    });
    modal.body.querySelector('#um-pw-copy').addEventListener('click', async (e) => {
        try {
            await navigator.clipboard.writeText(pwInput.value);
            e.target.textContent = 'Copied';
            setTimeout(() => {
                e.target.textContent = 'Copy';
            }, 1500);
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
        await logSystemEvent('PASSWORD_RESET', 'auth', `Reset the password of ${name}`, id);
        modal.close();
        showToast(`Password reset for ${name}. Give them the password privately.`, 'success');
    });
};

window.resetStaffMfa = async function (id, name) {
    if (globalRoleName !== 'admin') return;
    const ok = await confirmDialog({
        title: 'Reset two-factor sign-in',
        confirmLabel: 'Reset 2FA',
        message: `Remove the authenticator app linked to ${name}? They will be asked to set up a new one the next time they sign in.`
    });
    if (!ok) return;
    const { error } = await supabaseClient.functions.invoke('admin-reset-mfa', { body: { user_id: id } });
    if (error) {
        let message = error.message;
        try {
            const errBody = await error.context.json();
            if (errBody && errBody.error) message = errBody.error;
        } catch (e) {}
        showToast('Could not reset 2FA: ' + message, 'error');
        return;
    }
    await logSystemEvent('MFA_RESET', 'auth', `Reset the two-factor sign-in of ${name}`, id);
    showToast(`Two-factor sign-in reset for ${name}.`, 'success');
};

window.__people = {};
window.__peopleSort = {};

const PEOPLE_UI = {
    lawyers: { prefix: 'manage-lawyers', countLabel: (n) => `Total: ${n}` },
    secretaries: { prefix: 'manage-secretaries', countLabel: (n) => `Total: ${n}` },
    archived: { prefix: 'manage-archived', countLabel: (n) => `Total Archived: ${n}` }
};

function rowMenuHtml(buttonsHtml, label) {
    return `<span class="row-actions-src" hidden>${buttonsHtml}</span><button type="button" class="ct-icon-btn ct-menu-btn" data-row-menu="" data-menu-src="1" data-menu-label="${escapeHtml(label)}" aria-haspopup="menu" aria-expanded="false" aria-label="More actions" title="More actions"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button>`;
}

function personIconBtn(onclick, icon, title, tone = '') {
    return `<button type="button" class="ct-icon-btn ${tone}" onclick="${onclick}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><i class="fa-solid ${icon}"></i></button>`;
}

function personTextBtn(onclick, icon, label, tone = '') {
    return `<button type="button" class="ct-text-btn ${tone}" onclick="${onclick}"><i class="fa-solid ${icon}"></i> ${label}</button>`;
}

function personActionsHtml(p, kind) {
    if (globalRoleName !== 'admin') return '';
    const id = jsArg(p.id);
    const name = jsArg(p.full_name || '');
    const phone = jsArg(p.phone || '');
    const spec = jsArg(p.specialization || '');

    if (kind === 'archived') {
        return personTextBtn(`restoreArchivedLawyer(${id}, ${name})`, 'fa-rotate-left', 'Restore', 'ct-green');
    }
    if (kind === 'secretaries' && p.status === 'inactive') {
        return personTextBtn(`toggleSecretaryStatus(${id})`, 'fa-rotate-left', 'Restore', 'ct-green');
    }

    const role = kind === 'secretaries' ? 'secretary' : 'lawyer';
    const r = jsArg(role);
    const archive =
        kind === 'secretaries'
            ? personIconBtn(`toggleSecretaryStatus(${id})`, 'fa-box-archive', 'Archive secretary', 'ct-amber')
            : personIconBtn(`openArchiveLawyerModal(${id}, ${name})`, 'fa-box-archive', 'Archive lawyer', 'ct-amber');

    const resend =
        kind === 'lawyers' && p.status === 'pending'
            ? personIconBtn(`resendLawyerInvitation(${id}, ${name})`, 'fa-paper-plane', 'Resend invitation', 'ct-blue')
            : '';
    const buttons =
        resend +
        personIconBtn(
            `openEditLawyerModal(${id}, ${name}, ${phone}, ${spec}, ${r})`,
            'fa-pen',
            role === 'lawyer' ? 'Edit lawyer' : 'Edit secretary'
        ) +
        personIconBtn(`openResetPasswordModal(${id}, ${name})`, 'fa-key', 'Reset password', 'ct-purple') +
        personIconBtn(`resetStaffMfa(${id}, ${name})`, 'fa-user-shield', 'Reset two-factor sign-in', 'ct-sky') +
        personIconBtn(`openChangeRoleModal(${id}, ${name}, ${r}, ${spec})`, 'fa-user-gear', 'Change role', 'ct-sky') +
        archive;
    return rowMenuHtml(buttons, role === 'lawyer' ? 'Lawyer actions' : 'Secretary actions');
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

    const rows = store.rows.filter(
        (p) => !term || [p.full_name, p.specialization, p.phone].filter(Boolean).join(' ').toLowerCase().includes(term)
    );
    const sortValue =
        {
            full_name: (p) => (p.full_name || '').toLowerCase(),
            specialization: (p) => (p.specialization || 'General Practice').toLowerCase(),
            phone: (p) => (p.phone || '').toLowerCase(),
            active: (p) => (workload[p.id] ? workload[p.id].active : 0),
            status: (p) => (p.status === 'inactive' ? 1 : 0),
            archived_at: (p) => new Date(p.archived_at || 0).getTime()
        }[sort.key] || (() => 0);
    rows.sort((a, b) => {
        const x = sortValue(a),
            y = sortValue(b);
        const r = x < y ? -1 : x > y ? 1 : 0;
        return sort.dir === 'asc' ? r : -r;
    });

    if (countEl)
        countEl.textContent = term ? `${rows.length} of ${store.rows.length}` : ui.countLabel(store.rows.length);

    if (rows.length === 0) {
        listEl.innerHTML = `<p class="mc-empty">${store.rows.length ? 'No matches for your search.' : store.empty}</p>`;
        return;
    }

    const th = (key, label) => {
        const active = sort.key === key;
        const arrow = active ? (sort.dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort';
        return `<th class="ct-sortable${active ? ' ct-sorted' : ''}" data-people-sort="${key}" tabindex="0" role="button" aria-label="Sort by ${label}">${label} <i class="fa-solid ${arrow}"></i></th>`;
    };

    const avatarTone =
        kind === 'secretaries' ? 'ct-avatar-purple' : kind === 'archived' ? 'ct-avatar-grey' : 'ct-avatar-blue';
    const names = store.names || {};

    const body = rows
        .map((p) => {
            const inactive = p.status === 'inactive';
            const display = kind === 'secretaries' ? p.full_name || 'Unknown' : `Atty. ${p.full_name || 'Unknown'}`;
            const restored =
                !inactive && p.restored_at
                    ? `<div class="ct-sub"><i class="fa-solid fa-rotate-left"></i> Restored ${escapeHtml(formatDate(p.restored_at))}${p.restored_by ? ' by ' + escapeHtml(names[p.restored_by] || 'Unknown') : ''}</div>`
                    : '';
            const nameCell = `
                <td>
                    <div class="ct-person">
                        <span class="ct-avatar ${avatarTone}">${
                            p.avatar_url
                                ? `<img src="${escapeHtml(p.avatar_url)}" alt="" onerror="this.replaceWith(document.createTextNode(this.dataset.fallback))" data-fallback="${escapeHtml(getInitials(p.full_name))}">`
                                : escapeHtml(getInitials(p.full_name))
                        }</span>
                        <div class="ct-person-text">
                            <div class="ct-person-name">${escapeHtml(display)}</div>
                            ${restored}
                        </div>
                    </div>
                </td>`;
            const specCell = `<td>${escapeHtml(p.specialization || 'General Practice')}</td>`;
            const phoneCell = `<td>${p.phone ? escapeHtml(p.phone) : '<span class="ct-muted">N/A</span>'}</td>`;
            let statusCell = `<td><span class="ct-badge ${inactive ? 'ct-badge-closed' : 'ct-badge-active'}">${inactive ? 'Archived' : 'Active'}</span></td>`;
            if (kind === 'lawyers' && p.status === 'pending') {
                const st = invitationState(store.invites, p.id);
                const tone = st === 'expired' ? 'danger' : 'pending';
                statusCell = `<td><span class="ct-badge" style="background:var(--status-${tone}-bg); color:var(--status-${tone}-text);">${st === 'expired' ? 'Expired' : 'Pending'}</span></td>`;
            }
            const actionsCell = `<td class="ct-actions"><div>${personActionsHtml(p, kind)}</div></td>`;

            if (kind === 'lawyers') {
                return `<tr>${nameCell}${specCell}${phoneCell}<td>${workloadChipsHtml(workload[p.id])}</td>${statusCell}${actionsCell}</tr>`;
            }
            if (kind === 'secretaries') {
                return `<tr${inactive ? ' class="ct-row-muted"' : ''}>${nameCell}${phoneCell}${statusCell}${actionsCell}</tr>`;
            }
            const archivedBy = p.archived_by
                ? `<div class="ct-sub">by ${escapeHtml(names[p.archived_by] || 'Unknown')}</div>`
                : '';
            const archivedCell = `<td>${p.archived_at ? escapeHtml(formatDate(p.archived_at)) : '<span class="ct-muted">-</span>'}${archivedBy}</td>`;
            return `<tr class="ct-row-muted">${nameCell}${specCell}${phoneCell}${archivedCell}${statusCell}${actionsCell}</tr>`;
        })
        .join('');

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
            window.__peopleSort[kind] = { key: key, dir: cur.key === key && cur.dir === 'asc' ? 'desc' : 'asc' };
            paintPeople(kind);
        };
        listEl.addEventListener('click', (e) => {
            const th = e.target.closest('[data-people-sort]');
            if (th) applySort(th);
        });
        listEl.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const th = e.target.closest('[data-people-sort]');
            if (th) {
                e.preventDefault();
                applySort(th);
            }
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
            .in('status', ['active', 'pending'])
            .order('full_name', { ascending: true });

        if (error) throw error;

        const list = lawyers || [];
        const invites = {};
        const { data: inviteRows } = await supabaseClient.rpc('lawyer_invitation_status');
        (inviteRows || []).forEach((r) => {
            invites[r.user_id] = r;
        });
        let workloadMap = {};
        let names = {};
        if (list.length > 0) {
            const workloadData = await fetchWorkloadData();
            workloadMap = computeWorkload(workloadData.cases, workloadData.events);
            names = await fetchProfileNameMap(list.map((l) => l.restored_by));
        }

        window.__people.lawyers = {
            rows: list,
            workload: workloadMap,
            names: names,
            invites: invites,
            empty: 'No active lawyers found in the directory.'
        };
        ensurePeopleControls('lawyers');
        paintPeople('lawyers');
    } catch (err) {
        console.error('Error loading lawyer directory:', err);
        if (countEl) countEl.textContent = '';
        listContainer.innerHTML = errorStateHtml('Could not load the lawyer directory.', 'renderManageLawyersList');
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
            .select(
                'id, full_name, phone, specialization, avatar_url, status, archived_at, archived_by, restored_at, restored_by, roles!inner(name)'
            )
            .eq('roles.name', 'secretary')
            .order('full_name', { ascending: true });
        if (error) throw error;

        window.__secretaries = {};
        (people || []).forEach((p) => {
            window.__secretaries[p.id] = p;
        });

        const names = await fetchProfileNameMap((people || []).flatMap((p) => [p.archived_by, p.restored_by]));

        window.__people.secretaries = {
            rows: people || [],
            workload: {},
            names: names,
            empty: 'No secretaries yet. Use Add New User to create one.'
        };
        ensurePeopleControls('secretaries');
        paintPeople('secretaries');
    } catch (err) {
        console.error('Error loading secretaries:', err);
        if (countEl) countEl.textContent = '';
        listContainer.innerHTML = errorStateHtml('Could not load secretaries.', 'renderSecretariesList');
    }
}

window.toggleSecretaryStatus = async function (profileId) {
    if (globalRoleName !== 'admin') return;
    const p = (window.__secretaries || {})[profileId];
    if (!p) return;
    const next = p.status === 'inactive' ? 'active' : 'inactive';
    if (
        !(await confirmDialog({
            title: next === 'inactive' ? 'Archive secretary' : 'Restore secretary',
            confirmLabel: next === 'inactive' ? 'Archive' : 'Restore',
            danger: next === 'inactive',
            message: `${next === 'inactive' ? 'Archive' : 'Restore'} ${p.full_name}?`
        }))
    )
        return;
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
        const names = list.length > 0 ? await fetchProfileNameMap(list.map((l) => l.archived_by)) : {};

        window.__people.archived = { rows: list, workload: {}, names: names, empty: 'No archived lawyers found.' };
        ensurePeopleControls('archived');
        paintPeople('archived');
    } catch (err) {
        console.error('Error loading archived lawyers:', err);
        if (countEl) countEl.textContent = '';
        listContainer.innerHTML = errorStateHtml('Could not load archived lawyers.', 'renderArchivedLawyersList');
    }
}

window.restoreArchivedLawyer = async function (id, name) {
    if (
        !(await confirmDialog({
            title: 'Restore lawyer',
            confirmLabel: 'Restore',
            message: `Are you sure you want to restore Atty. ${name}? Their account will be reactivated.`
        }))
    )
        return;

    try {
        const { error } = await supabaseClient.from('profiles').update({ status: 'active' }).eq('id', id);

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

    manageTabs.forEach((tab) => {
        tab.addEventListener('click', function () {
            const targetId = this.getAttribute('data-managetab');
            if (!targetId) return;

            manageTabs.forEach((btn) => {
                btn.classList.remove('active');
            });

            this.classList.add('active');

            document.querySelectorAll('.manage-tab-content').forEach((content) => {
                content.classList.add('hidden');
            });

            const activeContent = document.getElementById(targetId);
            if (activeContent) {
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
            let from = null,
                to = null;
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
    let auditSearchTimer = null;
    if (searchEl) {
        searchEl.addEventListener('input', () => {
            clearTimeout(auditSearchTimer);
            auditSearchTimer = setTimeout(renderAuditsView, 350);
        });
    }

    const sync = () => {
        const isCustom = periodEl.value === 'custom';
        document.querySelectorAll('.audit-custom-date').forEach((el) => el.classList.toggle('hidden', !isCustom));
        if (clearBtn) clearBtn.classList.toggle('hidden', !auditFiltersActive(getAuditFilters()));
    };
    const refresh = () => {
        sync();
        renderAuditsView();
    };

    [actionEl, entityEl, periodEl].forEach((el) => el.addEventListener('change', refresh));
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
    INSERT: { label: 'Added', color: '#16835d', icon: 'fa-plus' },
    UPDATE: { label: 'Updated', color: '#2f65ad', icon: 'fa-pen' },
    DELETE: { label: 'Deleted', color: '#c23a3a', icon: 'fa-trash' },
    CLOSE: { label: 'Closed', color: '#b9811f', icon: 'fa-lock' },
    REOPEN: { label: 'Reopened', color: '#3976c5', icon: 'fa-rotate-left' },
    RESCHEDULE: { label: 'Rescheduled', color: '#3d5a80', icon: 'fa-calendar-days' },
    ARCHIVE: { label: 'Archived', color: '#a2711a', icon: 'fa-box-archive' },
    RESTORE: { label: 'Restored', color: '#116b4b', icon: 'fa-rotate-left' },
    LOGIN: { label: 'Signed in', color: '#16835d', icon: 'fa-right-to-bracket' },
    LOGIN_FAILED: { label: 'Failed sign-in', color: '#c23a3a', icon: 'fa-triangle-exclamation' },
    ACCOUNT_LOCKED: { label: 'Account locked', color: '#a83030', icon: 'fa-lock' },
    MFA_RESET: { label: '2FA reset', color: '#a83030', icon: 'fa-user-shield' },
    LOGOUT: { label: 'Signed out', color: '#64748b', icon: 'fa-right-from-bracket' },
    PASSWORD_CHANGE: { label: 'Password changed', color: '#a83030', icon: 'fa-key' },
    PASSWORD_RESET: { label: 'Password reset', color: '#a83030', icon: 'fa-key' },
    EXPORT: { label: 'Exported', color: '#4f5b6d', icon: 'fa-file-export' },
    APPROVE: { label: 'Approved', color: '#116b4b', icon: 'fa-circle-check' },
    DECLINE: { label: 'Declined', color: '#c23a3a', icon: 'fa-circle-xmark' }
};

const AUDIT_ENTITIES = {
    cases: 'Case',
    clients: 'Client',
    calendar_events: 'Calendar event',
    profiles: 'User',
    email_queue: 'Email',
    case_lawyers: 'Case lawyer',
    client_lawyers: 'Client lawyer',
    notifications: 'Notification',
    auth: 'Account',
    documents: 'Document',
    document_versions: 'Document version',
    case_reports: 'Case report',
    case_history: 'Case history',
    event_responses: 'Event response',
    appointment_requests: 'Appointment request',
    roles: 'Role'
};

function auditEntityLabel(table) {
    const key = String(table || '').toLowerCase();
    if (AUDIT_ENTITIES[key]) return AUDIT_ENTITIES[key];
    const text = (key || 'record').replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function auditFriendlyFields(fields) {
    const seen = new Set();
    const out = [];
    String(fields)
        .split(';')
        .map((f) => f.trim())
        .forEach((f) => {
            let text = f;
            if (/^is read: false to true$/.test(f)) text = 'marked as read';
            else if (/^read date$/.test(f)) text = '';
            else if (/^reviewed date$/.test(f)) text = 'marked as reviewed';
            else if (/^reviewed by id$/.test(f)) text = '';
            else if (/^archived date$/.test(f)) text = 'archived';
            else if (/^archived by id$/.test(f)) text = '';
            else if (/^closed date$/.test(f)) text = 'closed';
            else if (/^auth user( id)?$/.test(f)) text = '';
            else if (/^status: pending to active$/.test(f)) text = 'account activated';
            else if (/^status: active to pending$/.test(f)) text = 'waiting for activation';
            else if (/^status: active to inactive$/.test(f)) text = 'account archived';
            else if (/^status: inactive to active$/.test(f)) text = 'account restored';
            else if (/^phone$/.test(f)) text = 'phone number';
            else if (/^specialization: (.+) to (.+)$/.test(f)) text = f.replace(/^specialization: (.+) to (.+)$/, 'specialization changed from $1 to $2');
            else if (/^is sent: false to true$/.test(f)) text = 'delivered';
            else if (/^sent date$/.test(f)) text = '';
            else if (/^status: [a-z]+ to sent$/.test(f)) text = 'delivered';
            else if (/^status: [a-z]+ to processing$/.test(f)) text = 'being sent';
            else if (/^status: [a-z]+ to failed$/.test(f)) text = 'could not be delivered';
            else if (/^status: processing to pending$/.test(f)) text = 'will try again';
            else if (/^(attempts|last attempt date|next attempt date|last error)(: .+)?$/.test(f)) text = '';
            else text = f.replace(/ id$/, '');
            if (text && !seen.has(text)) {
                seen.add(text);
                out.push(text);
            }
        });
    return out.join('; ');
}

function auditFriendlyDetails(text) {
    const m = String(text).match(/^(Updated [a-z ]+: .+?) - ([a-z][A-Za-z ;:_,.\-0-9]*)$/);
    if (!m) return text;
    const parts = m[2].split(';').map((p) => p.trim());
    if (!parts.every((p) => /^[a-z ]+( date)?(: [^;]+ to [^;]+)?$/.test(p))) return text;
    const fields = auditFriendlyFields(m[2]);
    return fields ? `${m[1]} - ${fields}` : m[1];
}

function auditPrettySummary(summary, table) {
    const raw = auditFriendlyDetails(String(summary || ''));
    const key = String(table || '').toLowerCase();
    const m = raw.match(/^(Added|Updated|Deleted) ([a-z ]+): (.*?)(?: \(([a-z_ ,]+)\))?$/);
    if (!m || m[2] !== key.replace(/_/g, ' ')) return raw;
    let label = key.replace(/_/g, ' ');
    if (key === 'email_queue') label = 'email';
    else if (/ies$/.test(label)) label = label.replace(/ies$/, 'y');
    else if (/[^s]s$/.test(label)) label = label.replace(/s$/, '');
    const fields = m[4]
        ? m[4]
              .split(',')
              .map((f) => f.trim().replace(/_at$/, ' date').replace(/_/g, ' '))
              .join(', ')
        : '';
    return `${m[1]} ${label}: ${m[3]}${fields ? ' - changed ' + fields : ''}`;
}

function paintAudits() {
    const listEl = document.getElementById('audits-list-inject');
    const countEl = document.getElementById('audits-count');
    const data = window.__auditData;
    if (!listEl || !data) return;

    const term = '';

    const rows = data.logs
        .map((log) => {
            const action = AUDIT_ACTIONS[log.action] || {
                label: log.action || 'Changed',
                color: '#2f65ad',
                icon: 'fa-pen'
            };
            const entity = auditEntityLabel(log.table_name);
            const userName = data.profileMap[log.changed_by] || 'System';
            const recordId = String(log.record_id || (log.new_data && log.new_data.original_int_id) || '');
            const summary =
                log.new_data && log.new_data.summary
                    ? auditPrettySummary(log.new_data.summary, log.table_name)
                    : '';
            const details = summary || `${entity} ${action.label.toLowerCase()}`;
            const avatarUrl = (data.avatarMap && data.avatarMap[log.changed_by]) || '';
            return { log, action, entity, userName, avatarUrl, recordId, summary, details };
        })
        .filter(
            (r) => !term || `${r.details} ${r.userName} ${r.entity} ${r.action.label}`.toLowerCase().includes(term)
        );

    if (countEl) {
        countEl.textContent = term ? `${rows.length} of ${data.logs.length} shown` : data.countText;
    }

    if (rows.length === 0) {
        listEl.innerHTML = '<p class="mc-empty">No activity matches your search.</p>';
        return;
    }

    const body = rows
        .map((r) => {
            return `
            <tr>
                <td><span class="au-pill" style="background:${r.action.color}1a; color:${r.action.color};"><i class="fa-solid ${r.action.icon}"></i> ${escapeHtml(r.action.label)}</span></td>
                <td>${escapeHtml(r.entity)}</td>
                <td class="au-details">${escapeHtml(r.details)}</td>
                <td>
                    <div class="ct-person">
                        <span class="ct-avatar ct-avatar-sm ct-avatar-blue">${
                            r.avatarUrl
                                ? `<img src="${escapeHtml(r.avatarUrl)}" alt="" onerror="this.replaceWith(document.createTextNode(this.dataset.fallback))" data-fallback="${escapeHtml(getInitials(r.userName))}">`
                                : escapeHtml(getInitials(r.userName))
                        }</span>
                        <span class="ct-person-name">${escapeHtml(r.userName)}</span>
                    </div>
                </td>
                <td class="au-when">${escapeHtml(formatDate(r.log.changed_at))}<div class="ct-sub">${escapeHtml(formatEventTime(r.log.changed_at))}</div></td>
            </tr>`;
        })
        .join('');

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
        </div>
        ${pagerHtml('audits', data.pager, 'activities')}`;
}

async function auditSearchClause(rawTerm) {
    const clean = rawTerm.replace(/[,()*%\\"']/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    const lower = clean.toLowerCase();
    const parts = [`new_data->>summary.ilike.*${clean}*`, `table_name.ilike.*${clean}*`, `action.ilike.*${clean}*`];
    const actionKeys = Object.keys(AUDIT_ACTIONS).filter((k) => AUDIT_ACTIONS[k].label.toLowerCase().includes(lower));
    if (actionKeys.length) parts.push(`action.in.(${actionKeys.join(',')})`);
    const entityKeys = Object.keys(AUDIT_ENTITIES).filter((k) => AUDIT_ENTITIES[k].toLowerCase().includes(lower));
    if (entityKeys.length) parts.push(`table_name.in.(${entityKeys.join(',')})`);
    const { data: people } = await supabaseClient
        .from('profiles')
        .select('id')
        .ilike('full_name', `%${clean}%`)
        .limit(100);
    const ids = (people || []).map((p) => p.id);
    if (ids.length) parts.push(`changed_by.in.(${ids.join(',')})`);
    return parts.join(',');
}

async function renderAuditsView() {
    const listEl = document.getElementById('audits-list-inject');
    const countEl = document.getElementById('audits-count');
    if (!listEl) return;

    if (globalRoleName !== 'admin' && globalRoleName !== 'secretary') {
        listEl.innerHTML = errorStateHtml('You do not have access to this page.', null, 'fa-lock');
        return;
    }

    listEl.innerHTML = skeletonRows(5);

    try {
        initAuditFilters();
        const filters = getAuditFilters();
        const range = getAuditDateRange(filters);
        const hasFilters = auditFiltersActive(filters);
        const requestId = ++auditRequestCounter;
        const term = (document.getElementById('audit-search')?.value || '').trim();
        const st = pagerBind('audits', renderAuditsView, 'audits-list-inject');
        const signature = JSON.stringify([filters, term]);
        if (st.sig !== signature) {
            st.sig = signature;
            st.page = 1;
        }
        const searchClause = term ? await auditSearchClause(term) : '';
        if (requestId !== auditRequestCounter) return;

        const fromRow = (st.page - 1) * st.size;
        let query = supabaseClient
            .from('audit_logs')
            .select('*', { count: 'exact' })
            .order('changed_at', { ascending: false })
            .order('id', { ascending: false })
            .range(fromRow, fromRow + st.size - 1);

        if (filters.action !== 'all') query = query.eq('action', filters.action);
        if (filters.entity !== 'all') query = query.ilike('table_name', filters.entity);
        if (range.from) query = query.gte('changed_at', range.from.toISOString());
        if (range.to) query = query.lt('changed_at', range.to.toISOString());
        if (searchClause) query = query.or(searchClause);

        const { data: logs, count, error: logsError } = await query;

        if (requestId !== auditRequestCounter) return;
        if (logsError) throw logsError;

        const total = count || 0;
        const pages = Math.max(1, Math.ceil(total / st.size));
        if (st.page > pages) {
            st.page = pages;
            return renderAuditsView();
        }
        const pagerInfo = { total: total, page: st.page, pages: pages, start: fromRow, size: st.size };
        const narrowed = hasFilters || !!searchClause;
        const countText = narrowed
            ? `${total} matching ${total === 1 ? 'activity' : 'activities'}`
            : `${total} ${total === 1 ? 'activity' : 'activities'} in total`;

        if (countEl) countEl.textContent = countText;

        if (!logs || logs.length === 0) {
            listEl.innerHTML = hasFilters
                ? '<p style="color:#64748b; text-align:center; padding:20px;">No activity matches these filters.</p>'
                : '<p style="color:#64748b; text-align:center; padding:20px;">No recent activity found.</p>';
            return;
        }

        const userIds = [...new Set(logs.map((log) => log.changed_by).filter(Boolean))];
        let profileMap = {};
        let avatarMap = {};

        if (userIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabaseClient
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', userIds);

            if (!profilesError && profiles) {
                profiles.forEach((p) => {
                    profileMap[p.id] = p.full_name;
                    avatarMap[p.id] = p.avatar_url || '';
                });
            }
        }
        window.__auditData = { logs: logs, profileMap: profileMap, avatarMap: avatarMap, countText: countText, pager: pagerInfo };
        paintAudits();
    } catch (err) {
        console.error('Error loading audit logs:', err);
        listEl.innerHTML = errorStateHtml('Could not load the audit logs.', 'renderAuditsView');
    }
}

const APP_LOGGED_EVENTS = ['cases:CLOSE', 'cases:REOPEN', 'clients:DELETE', 'calendar_events:RESCHEDULE'];

async function logSystemEvent(action, entity, summary, recordId, extra) {
    try {
        if (!currentUser) return;
        const { error } = await supabaseClient.from('audit_logs').insert([
            {
                table_name: String(entity).toLowerCase(),
                record_id: String(recordId || currentUser.id),
                action: action,
                old_data: null,
                new_data: Object.assign({}, extra || {}, { summary: summary }),
                changed_by: currentUser.id
            }
        ]);
        if (error) console.warn('Audit log was not saved:', error.message);
    } catch (err) {
        console.warn('Audit log was not saved:', err);
    }
}

async function logAuditActivity(action, entity, summary, recordId, oldData, newData) {
    try {
        const key = String(entity || '').toLowerCase() + ':' + action;
        if (!APP_LOGGED_EVENTS.includes(key)) return;
        if (!currentUser || !recordId) return;
        const { error } = await supabaseClient.from('audit_logs').insert([
            {
                table_name: String(entity).toLowerCase(),
                record_id: String(recordId),
                action: action,
                old_data: oldData || null,
                new_data: Object.assign({}, newData || {}, { summary: summary }),
                changed_by: currentUser.id
            }
        ]);
        if (error) console.warn('Audit log was not saved:', error.message);
    } catch (err) {
        console.warn('Audit log was not saved:', err);
    }
}


const AUDIT_EXPORT_PAGE = 1000;
const AUDIT_EXPORT_MAX = 20000;
let auditExporting = false;

function auditSelectText(id) {
    const el = document.getElementById(id);
    return el && el.selectedOptions && el.selectedOptions[0] ? el.selectedOptions[0].textContent.trim() : '';
}

function auditExportFilterText(filters, term) {
    const parts = [];
    if (filters.action !== 'all') parts.push(`Action: ${auditSelectText('audit-filter-action')}`);
    if (filters.entity !== 'all') parts.push(`Record type: ${auditSelectText('audit-filter-entity')}`);
    if (filters.period === 'custom') {
        parts.push(`Date: ${filters.from || 'start'} to ${filters.to || 'today'}`);
    } else if (filters.period !== 'all') {
        parts.push(`Date: ${auditSelectText('audit-filter-period')}`);
    }
    if (term) parts.push(`Search: "${term}"`);
    return parts.length ? parts.join('  |  ') : 'None (all records)';
}

async function fetchAllAuditLogs(filters) {
    const range = getAuditDateRange(filters);
    const logs = [];
    for (let from = 0; from < AUDIT_EXPORT_MAX; from += AUDIT_EXPORT_PAGE) {
        let query = supabaseClient
            .from('audit_logs')
            .select('*')
            .order('changed_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, from + AUDIT_EXPORT_PAGE - 1);
        if (filters.action !== 'all') query = query.eq('action', filters.action);
        if (filters.entity !== 'all') query = query.ilike('table_name', filters.entity);
        if (range.from) query = query.gte('changed_at', range.from.toISOString());
        if (range.to) query = query.lt('changed_at', range.to.toISOString());
        const { data, error } = await query;
        if (error) throw error;
        logs.push(...(data || []));
        if (!data || data.length < AUDIT_EXPORT_PAGE) break;
    }
    return logs;
}

async function fetchAuditUserNames(logs) {
    const ids = [...new Set(logs.map((l) => l.changed_by).filter(Boolean))];
    const names = {};
    for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name')
            .in('id', ids.slice(i, i + 100));
        if (error) throw error;
        (data || []).forEach((p) => {
            names[p.id] = p.full_name;
        });
    }
    return names;
}

function buildAuditExportRows(logs, names, term) {
    return logs
        .map((log) => {
            const action = AUDIT_ACTIONS[log.action] ? AUDIT_ACTIONS[log.action].label : log.action || 'Changed';
            const entity = auditEntityLabel(log.table_name);
            const user = names[log.changed_by] || (log.changed_by ? 'Unknown user' : 'System');
            const summary =
                log.new_data && log.new_data.summary ? auditPrettySummary(log.new_data.summary, log.table_name) : '';
            const details = summary || `${entity} ${action.toLowerCase()}`;
            const d = new Date(log.changed_at);
            const when = isNaN(d.getTime())
                ? ''
                : d.toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                  });
            return {
                when,
                iso: isNaN(d.getTime()) ? '' : d.toISOString(),
                action,
                color: (AUDIT_ACTIONS[log.action] && AUDIT_ACTIONS[log.action].color) || '#3b4656',
                entity,
                details,
                user,
                table: log.table_name || '',
                recordId: String(log.record_id || (log.new_data && log.new_data.original_int_id) || ''),
                logId: log.id
            };
        })
        .filter((r) => !term || `${r.details} ${r.user} ${r.entity} ${r.action}`.toLowerCase().includes(term));
}

function auditStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function downloadAuditBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadAuditScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[data-audit-lib="${src}"]`)) {
            resolve();
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.dataset.auditLib = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Could not load the PDF library.'));
        document.head.appendChild(s);
    });
}

async function ensureAuditPdfLibs() {
    if (!(window.jspdf && window.jspdf.jsPDF)) {
        await loadAuditScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    const probe = new window.jspdf.jsPDF();
    if (typeof probe.autoTable !== 'function') {
        await loadAuditScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    }
}

function auditPdfText(value) {
    return String(value === undefined || value === null ? '' : value)
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, '?');
}

async function ensureAuditExcelLib() {
    if (!window.ExcelJS) {
        await loadAuditScript('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js');
    }
}

function auditLocalAsUtc(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
}

let auditLogoCache = null;

async function loadAuditLogo() {
    if (auditLogoCache !== null) return auditLogoCache || null;
    try {
        const img = document.querySelector('img[alt="JuriSync Logo"]');
        const src = (img && img.getAttribute('src')) || 'logo11.png';
        const res = await fetch(src);
        if (!res.ok) throw new Error('logo unavailable');
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = reject;
            fr.readAsDataURL(blob);
        });
        const dims = await new Promise((resolve, reject) => {
            const im = new Image();
            im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
            im.onerror = reject;
            im.src = dataUrl;
        });
        const isJpeg = /jpe?g/i.test(blob.type);
        auditLogoCache = {
            dataUrl,
            base64: dataUrl.split(',')[1],
            ext: isJpeg ? 'jpeg' : 'png',
            pdfFormat: isJpeg ? 'JPEG' : 'PNG',
            ratio: dims.w / dims.h
        };
    } catch (err) {
        auditLogoCache = false;
    }
    return auditLogoCache || null;
}

function auditReportInfo(rows, meta) {
    const now = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const reference = `AL-${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}`;
    const fmt = (iso) =>
        new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const dated = rows.filter((r) => r.iso);
    let period = 'Not available';
    if (dated.length) {
        const latest = fmt(dated[0].iso);
        const earliest = fmt(dated[dated.length - 1].iso);
        period = latest === earliest ? latest : `${earliest} to ${latest}`;
    }
    const actionMap = new Map();
    const userMap = new Map();
    rows.forEach((r) => {
        const a = actionMap.get(r.action) || { label: r.action, color: r.color, count: 0 };
        a.count += 1;
        actionMap.set(r.action, a);
        userMap.set(r.user, (userMap.get(r.user) || 0) + 1);
    });
    return {
        reference,
        period,
        total: rows.length,
        byAction: [...actionMap.values()].sort((x, y) => y.count - x.count),
        byUser: [...userMap.entries()].sort((x, y) => y[1] - x[1]),
        filters: meta.filters,
        user: meta.user,
        generatedAt: meta.generatedAt
    };
}

async function exportAuditPdf(rows, meta) {
    await ensureAuditPdfLibs();
    const logo = await loadAuditLogo();
    const info = auditReportInfo(rows, meta);
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;
    const NAVY = [31, 42, 68];
    const GOLD = [176, 141, 87];
    const INK = [30, 41, 59];
    const MUTED = [100, 116, 139];
    const CREAM = [248, 245, 238];
    const RULE = [214, 206, 190];

    let textX = M;
    if (logo) {
        const lh = 44;
        const lw = lh * logo.ratio;
        doc.addImage(logo.dataUrl, logo.pdfFormat, M, 36, lw, lh);
        textX = M + lw + 14;
    }
    doc.setTextColor(...NAVY);
    doc.setFont('times', 'bold');
    doc.setFontSize(24);
    doc.text('JURISYNC', textX, 58);
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text('LAW FIRM MANAGEMENT', textX, 72, { charSpace: 2 });

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.rect(W - M - 118, 42, 118, 26);
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text('CONFIDENTIAL', W - M - 59, 59, { align: 'center', charSpace: 1.5 });

    doc.setLineWidth(1.6);
    doc.line(M, 84, W - M, 84);
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.5);
    doc.line(M, 88, W - M, 88);

    doc.setFont('times', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...NAVY);
    doc.text('Audit Log Report', M, 118);

    doc.autoTable({
        startY: 138,
        margin: { left: M, right: M },
        theme: 'plain',
        body: [
            ['Report reference', info.reference, 'Records included', String(info.total)],
            ['Date generated', auditPdfText(info.generatedAt), 'Period covered', auditPdfText(info.period)],
            ['Prepared by', auditPdfText(info.user), 'Filters applied', auditPdfText(info.filters)]
        ],
        styles: { font: 'times', fontSize: 9.5, cellPadding: { top: 3, bottom: 3, left: 6, right: 6 }, textColor: INK, valign: 'top' },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: NAVY, cellWidth: 100, fillColor: CREAM },
            1: { cellWidth: 230 },
            2: { fontStyle: 'bold', textColor: NAVY, cellWidth: 100, fillColor: CREAM },
            3: { cellWidth: 'auto' }
        },
        tableLineColor: RULE,
        tableLineWidth: 0.5
    });

    let y = doc.lastAutoTable.finalY + 26;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text('Summary of Activity', M, y);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(M, y + 5, M + 130, y + 5);

    doc.autoTable({
        startY: y + 14,
        margin: { left: M, right: M },
        theme: 'grid',
        head: [[...info.byAction.map((a) => auditPdfText(a.label)), 'Total']],
        body: [[...info.byAction.map((a) => String(a.count)), String(info.total)]],
        styles: { font: 'times', fontSize: 9.5, halign: 'center', cellPadding: 5, textColor: INK, lineColor: RULE, lineWidth: 0.5 },
        headStyles: { fillColor: CREAM, textColor: NAVY, fontStyle: 'bold' },
        didParseCell: (d) => {
            if (d.section === 'body' && d.column.index === info.byAction.length) d.cell.styles.fontStyle = 'bold';
        }
    });

    y = doc.lastAutoTable.finalY + 28;
    let startY = y + 12;
    if (y + 90 > H - 60) {
        doc.addPage();
        y = 62;
        startY = y + 12;
    }
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text('Detailed Record of Activity', M, y);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(M, y + 5, M + 160, y + 5);

    doc.autoTable({
        startY,
        margin: { left: M, right: M, top: 54, bottom: 50 },
        theme: 'striped',
        head: [['Date & Time', 'Action', 'Record', 'Details', 'Done By', 'Record ID']],
        body: rows.map((r) => [
            auditPdfText(r.when),
            auditPdfText(r.action),
            auditPdfText(r.entity),
            auditPdfText(r.details),
            auditPdfText(r.user),
            auditPdfText(r.recordId)
        ]),
        styles: { font: 'times', fontSize: 9, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 }, overflow: 'linebreak', valign: 'top', textColor: INK, lineColor: RULE },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 9.5 },
        alternateRowStyles: { fillColor: CREAM },
        columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 66, fontStyle: 'bold' },
            2: { cellWidth: 76 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 90 },
            5: { cellWidth: 118 }
        },
        didParseCell: (d) => {
            if (d.section === 'body' && d.column.index === 5) {
                d.cell.styles.font = 'courier';
                d.cell.styles.fontSize = 6.5;
                d.cell.styles.textColor = MUTED;
            }
        }
    });

    y = doc.lastAutoTable.finalY + 30;
    if (y + 130 > H - 50) {
        doc.addPage();
        y = 70;
    }
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text('Certification', M, y);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(M, y + 5, M + 78, y + 5);
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const cert = doc.splitTextToSize(
        'This report was generated from the JuriSync audit trail on the date stated above and reflects the records that match the filters shown. The generation of this report is itself recorded in the audit trail.',
        W - M * 2
    );
    doc.text(cert, M, y + 22);

    const sy = y + 22 + cert.length * 12 + 46;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.6);
    const blocks = [
        { x: M, label: 'Prepared by (signature over printed name)' },
        { x: M + 300, label: 'Reviewed by (signature over printed name)' }
    ];
    blocks.forEach((b) => {
        doc.line(b.x, sy, b.x + 230, sy);
        doc.line(b.x + 250, sy, b.x + 340, sy);
        doc.setFont('times', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(b.label, b.x, sy + 11);
        doc.text('Date', b.x + 250, sy + 11);
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        if (i > 1) {
            doc.setFont('times', 'italic');
            doc.setFontSize(8.5);
            doc.setTextColor(...MUTED);
            doc.text('JuriSync Audit Log Report', M, 30);
            doc.text(info.reference, W - M, 30, { align: 'right' });
            doc.setDrawColor(...GOLD);
            doc.setLineWidth(0.8);
            doc.line(M, 36, W - M, 36);
        }
        doc.setDrawColor(...NAVY);
        doc.setLineWidth(0.5);
        doc.line(M, H - 34, W - M, H - 34);
        doc.setFont('times', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text('JuriSync Law Firm Management  |  Confidential - for authorized firm use only', M, H - 21);
        doc.text(`${info.reference}  |  Page ${i} of ${pages}`, W - M, H - 21, { align: 'right' });
    }

    doc.save(`jurisync-audit-logs-${auditStamp()}.pdf`);
}

async function exportAuditXlsx(rows, meta) {
    await ensureAuditExcelLib();
    const logo = await loadAuditLogo();
    const info = auditReportInfo(rows, meta);
    const NAVY = 'FF1F2A44';
    const GOLD = 'FFB08D57';
    const CREAM = 'FFF8F5EE';
    const SAND = 'FFF1ECE0';
    const RULE = 'FFD6CEBE';
    const INK = 'FF1E293B';
    const MUTED = 'FF64748B';
    const SERIF = 'Cambria';
    const SANS = 'Calibri';
    const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const hair = { style: 'thin', color: { argb: RULE } };
    const rowBorder = { top: hair, bottom: hair };
    const goldBottom = { bottom: { style: 'medium', color: { argb: GOLD } } };

    const wb = new ExcelJS.Workbook();
    wb.creator = info.user;
    wb.created = new Date();
    wb.title = 'JuriSync Audit Log Report';

    const sm = wb.addWorksheet('Summary', {
        views: [{ showGridLines: false }],
        pageSetup: {
            paperSize: 9,
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.7, right: 0.7, top: 0.7, bottom: 0.8, header: 0.3, footer: 0.3 }
        },
        headerFooter: { oddFooter: '&L&8JuriSync Law Firm Management - Confidential&R&8Page &P of &N' }
    });
    sm.columns = [{ width: 34 }, { width: 16 }, { width: 16 }, { width: 8 }, { width: 22 }];
    const SC = 5;

    const putMerged = (ws, r, c1, c2, value, font, alignment, fill, border) => {
        if (c2 > c1) ws.mergeCells(r, c1, r, c2);
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            if (fill) cell.fill = fill;
            if (border) cell.border = border;
        }
        const cell = ws.getCell(r, c1);
        cell.value = value;
        cell.font = font;
        cell.alignment = alignment;
        return cell;
    };

    putMerged(sm, 1, 1, SC, 'JURISYNC  |  LAW FIRM MANAGEMENT', { name: SERIF, size: 10, bold: true, color: { argb: GOLD } }, { vertical: 'middle', horizontal: 'left' });
    sm.getRow(1).height = 20;
    putMerged(sm, 2, 1, SC, 'Audit Log Report', { name: SERIF, size: 26, bold: true, color: { argb: NAVY } }, { vertical: 'middle', horizontal: 'left' }, null, goldBottom);
    sm.getRow(2).height = 40;
    sm.getRow(3).height = 10;

    const details = [
        ['Report reference', info.reference],
        ['Date generated', info.generatedAt],
        ['Prepared by', info.user],
        ['Period covered', info.period],
        ['Records included', info.total],
        ['Filters applied', info.filters]
    ];
    details.forEach((pair, i) => {
        const r = 5 + i;
        putMerged(sm, r, 1, 1, pair[0], { name: SERIF, size: 11, bold: true, color: { argb: NAVY } }, { vertical: 'middle', horizontal: 'left', indent: 1 }, solid(SAND), rowBorder);
        putMerged(sm, r, 2, SC, pair[1], { name: SANS, size: 11, color: { argb: INK } }, { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 }, null, rowBorder);
        sm.getRow(r).height = pair[0] === 'Filters applied' ? 34 : 22;
    });

    const sectionTitle = (r, text) => {
        putMerged(sm, r, 1, SC, text, { name: SERIF, size: 14, bold: true, color: { argb: NAVY } }, { vertical: 'middle', horizontal: 'left' }, null, goldBottom);
        sm.getRow(r).height = 26;
    };
    const tableHead = (r, labels) => {
        labels.forEach((text, i) => {
            const c = sm.getCell(r, i + 1);
            c.value = text;
            c.font = { name: SERIF, size: 11, bold: true, color: { argb: NAVY } };
            c.fill = solid(SAND);
            c.border = { top: hair, bottom: { style: 'thin', color: { argb: GOLD } } };
            c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
        });
        sm.getRow(r).height = 22;
    };

    let r = 12;
    sectionTitle(r, 'Activity by Action');
    r += 2;
    tableHead(r, ['Action', 'Records', 'Share']);
    r += 1;
    info.byAction.forEach((a, i) => {
        const vals = [a.label, a.count, a.count / info.total];
        vals.forEach((v, idx) => {
            const c = sm.getCell(r, idx + 1);
            c.value = v;
            c.border = rowBorder;
            c.font = idx === 0
                ? { name: SANS, size: 11, bold: true, color: { argb: 'FF' + String(a.color).replace('#', '').toUpperCase() } }
                : { name: SANS, size: 11, color: { argb: INK } };
            c.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'center', indent: idx === 0 ? 1 : 0 };
            if (i % 2 === 1) c.fill = solid(CREAM);
        });
        sm.getCell(r, 3).numFmt = '0.0%';
        sm.getRow(r).height = 20;
        r += 1;
    });
    ['Total', info.total, 1].forEach((v, idx) => {
        const c = sm.getCell(r, idx + 1);
        c.value = v;
        c.font = { name: SERIF, size: 11, bold: true, color: { argb: NAVY } };
        c.border = { top: { style: 'thin', color: { argb: GOLD } }, bottom: { style: 'double', color: { argb: GOLD } } };
        c.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'center', indent: idx === 0 ? 1 : 0 };
    });
    sm.getCell(r, 3).numFmt = '0.0%';
    sm.getRow(r).height = 22;

    r += 3;
    sectionTitle(r, 'Activity by User');
    r += 2;
    tableHead(r, ['Done by', 'Records', 'Share']);
    r += 1;
    info.byUser.forEach(([name, count], i) => {
        [name, count, count / info.total].forEach((v, idx) => {
            const c = sm.getCell(r, idx + 1);
            c.value = v;
            c.border = rowBorder;
            c.font = { name: SANS, size: 11, color: { argb: INK } };
            c.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'center', indent: idx === 0 ? 1 : 0 };
            if (i % 2 === 1) c.fill = solid(CREAM);
        });
        sm.getCell(r, 3).numFmt = '0.0%';
        sm.getRow(r).height = 20;
        r += 1;
    });

    r += 2;
    sectionTitle(r, 'Certification');
    r += 1;
    putMerged(
        sm,
        r,
        1,
        SC,
        'This report was generated from the JuriSync audit trail on the date stated above and reflects the records that match the filters shown. The generation of this report is itself recorded in the audit trail.',
        { name: SANS, size: 10.5, color: { argb: INK } },
        { vertical: 'top', horizontal: 'left', wrapText: true }
    );
    sm.getRow(r).height = 48;

    r += 3;
    ['Prepared by', 'Reviewed by'].forEach((label) => {
        const ln = { bottom: { style: 'thin', color: { argb: INK } } };
        sm.getCell(r, 1).value = '';
        putMerged(sm, r, 1, 3, '', { name: SANS, size: 11 }, { vertical: 'bottom' }, null, ln);
        putMerged(sm, r, 5, 5, '', { name: SANS, size: 11 }, { vertical: 'bottom' }, null, ln);
        putMerged(sm, r + 1, 1, 3, `${label} (signature over printed name)`, { name: SANS, size: 9, italic: true, color: { argb: MUTED } }, { vertical: 'top', horizontal: 'left' });
        putMerged(sm, r + 1, 5, 5, 'Date', { name: SANS, size: 9, italic: true, color: { argb: MUTED } }, { vertical: 'top', horizontal: 'left' });
        sm.getRow(r).height = 34;
        r += 3;
    });

    const HEADER_ROW = 6;
    const LAST_COL = 8;
    const ws = wb.addWorksheet('Audit Log', {
        views: [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }],
        pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.7, header: 0.3, footer: 0.3 },
            printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`
        },
        headerFooter: {
            oddFooter: '&L&8JuriSync Law Firm Management - Confidential&C&8Audit Log Report&R&8Page &P of &N'
        }
    });
    ws.columns = [{ width: 7 }, { width: 25 }, { width: 16 }, { width: 18 }, { width: 62 }, { width: 24 }, { width: 38 }, { width: 38 }];

    putMerged(ws, 1, 1, LAST_COL, 'JURISYNC  |  LAW FIRM MANAGEMENT', { name: SERIF, size: 10, bold: true, color: { argb: GOLD } }, { vertical: 'middle', horizontal: 'left' });
    ws.getRow(1).height = 20;
    putMerged(ws, 2, 1, LAST_COL, 'Audit Log Register', { name: SERIF, size: 22, bold: true, color: { argb: NAVY } }, { vertical: 'middle', horizontal: 'left' }, null, goldBottom);
    ws.getRow(2).height = 34;
    putMerged(ws, 3, 1, LAST_COL, `Reference ${info.reference}   |   Generated ${info.generatedAt}   |   ${info.total} records`, { name: SANS, size: 10, italic: true, color: { argb: MUTED } }, { vertical: 'middle', horizontal: 'left' });
    ws.getRow(3).height = 20;
    putMerged(ws, 4, 1, LAST_COL, `Filters applied: ${info.filters}`, { name: SANS, size: 10, italic: true, color: { argb: MUTED } }, { vertical: 'middle', horizontal: 'left' });
    ws.getRow(4).height = 20;
    ws.getRow(5).height = 8;

    const headers = ['No.', 'Date & Time', 'Action', 'Record Type', 'Details', 'Done By', 'Record ID', 'Log ID'];
    const headRow = ws.getRow(HEADER_ROW);
    headers.forEach((text, i) => {
        const c = headRow.getCell(i + 1);
        c.value = text;
        c.font = { name: SERIF, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = solid(NAVY);
        c.border = goldBottom;
        c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'center' : 'left', indent: i === 0 ? 0 : 1 };
    });
    headRow.height = 28;

    rows.forEach((rec, i) => {
        const row = ws.getRow(HEADER_ROW + 1 + i);
        const when = auditLocalAsUtc(rec.iso);
        const values = [i + 1, when || rec.when, rec.action, rec.entity, rec.details, rec.user, rec.recordId, String(rec.logId || '')];
        values.forEach((v, idx) => {
            const c = row.getCell(idx + 1);
            c.value = v;
            c.border = rowBorder;
            c.font = { name: SANS, size: 10, color: { argb: INK } };
            c.alignment = { vertical: 'top', horizontal: idx === 0 ? 'center' : 'left', wrapText: idx === 4, indent: idx === 0 ? 0 : 1 };
            if (i % 2 === 1) c.fill = solid(CREAM);
        });
        row.getCell(2).numFmt = 'mmm d, yyyy  h:mm AM/PM';
        row.getCell(3).font = { name: SANS, size: 10, bold: true, color: { argb: 'FF' + String(rec.color).replace('#', '').toUpperCase() } };
        [7, 8].forEach((n) => {
            row.getCell(n).font = { name: 'Consolas', size: 9, color: { argb: MUTED } };
        });
    });

    ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + rows.length, column: LAST_COL } };

    if (logo) {
        const placeLogo = (sheet, colIndex, colPx, heightPx) => {
            const widthPx = heightPx * logo.ratio;
            const frac = Math.max(0, (colPx - widthPx - 8) / colPx);
            const id = wb.addImage({ base64: logo.base64, extension: logo.ext });
            sheet.addImage(id, {
                tl: { col: colIndex + frac, row: 0.15 },
                ext: { width: widthPx, height: heightPx },
                editAs: 'oneCell'
            });
        };
        placeLogo(sm, 4, 159, 54);
        placeLogo(ws, 7, 271, 46);
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadAuditBlob(blob, `jurisync-audit-logs-${auditStamp()}.xlsx`);
}

async function runAuditExport(format) {
    if (auditExporting) return;
    if (globalRoleName !== 'admin' && globalRoleName !== 'secretary') {
        showToast('You do not have access to export audit logs.', 'error');
        return;
    }
    auditExporting = true;
    const btn = document.getElementById('audit-export-btn');
    const original = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing...';
    }
    try {
        const filters = getAuditFilters();
        const term = (document.getElementById('audit-search')?.value || '').trim().toLowerCase();
        const logs = await fetchAllAuditLogs(filters);
        const names = await fetchAuditUserNames(logs);
        const rows = buildAuditExportRows(logs, names, term);
        if (rows.length === 0) {
            showToast('There are no audit records to export for these filters.', 'info');
            return;
        }
        const filterText = auditExportFilterText(filters, term);
        const meta = {
            filters: filterText,
            user: globalUserName || 'User',
            generatedAt: new Date().toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })
        };
        if (format === 'pdf') {
            await exportAuditPdf(rows, meta);
        } else {
            await exportAuditXlsx(rows, meta);
        }
        const label = format === 'pdf' ? 'PDF' : 'Excel';
        const capped = logs.length >= AUDIT_EXPORT_MAX ? ` (limited to the latest ${AUDIT_EXPORT_MAX.toLocaleString()})` : '';
        showToast(`Exported ${rows.length} audit ${rows.length === 1 ? 'record' : 'records'} as ${label}${capped}.`, 'success');
        logSystemEvent(
            'EXPORT',
            'audit_logs',
            `${globalUserName || 'User'} exported ${rows.length} audit ${rows.length === 1 ? 'record' : 'records'} as ${label}`,
            null,
            { format: format, record_count: rows.length, filters: filterText }
        );
    } catch (err) {
        console.error('Audit export failed:', err);
        showToast('Could not export the audit logs. Please try again.', 'error');
    } finally {
        auditExporting = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }
}

function setAuditExportMenu(open) {
    const menu = document.getElementById('audit-export-menu');
    const btn = document.getElementById('audit-export-btn');
    if (!menu || !btn) return;
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('audit-export-menu');
    if (!menu) return;
    const toggle = e.target.closest('#audit-export-btn');
    const item = e.target.closest('#audit-export-dropdown [data-export]');
    if (toggle) {
        setAuditExportMenu(!menu.classList.contains('open'));
    } else if (item) {
        setAuditExportMenu(false);
        runAuditExport(item.dataset.export);
    } else {
        setAuditExportMenu(false);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setAuditExportMenu(false);
});