(function () {
    'use strict';

    var ICON_LABELS = {
        'fa-xmark': 'Close',
        'fa-pen': 'Edit',
        'fa-pen-to-square': 'Edit',
        'fa-trash': 'Delete',
        'fa-trash-can': 'Delete',
        'fa-plus': 'Add',
        'fa-paper-plane': 'Send',
        'fa-paperclip': 'Attach file',
        'fa-download': 'Download',
        'fa-rotate-right': 'Retry',
        'fa-rotate-left': 'Restore',
        'fa-eye': 'Show',
        'fa-eye-slash': 'Hide',
        'fa-volume-high': 'Notification sound',
        'fa-bell': 'Notifications',
        'fa-chevron-left': 'Previous',
        'fa-chevron-right': 'Next',
        'fa-angle-left': 'Previous',
        'fa-angle-right': 'Next',
        'fa-angles-left': 'Collapse sidebar',
        'fa-angles-right': 'Expand sidebar',
        'fa-right-from-bracket': 'Log out',
        'fa-floppy-disk': 'Save',
        'fa-clock-rotate-left': 'History',
        'fa-check': 'Confirm',
        'fa-calendar-days': 'Calendar',
        'fa-ellipsis': 'More actions',
        'fa-ellipsis-vertical': 'More actions'
    };

    var ID_LABELS = [
        [/prev/i, 'Previous month'],
        [/next/i, 'Next month'],
        [/close/i, 'Close'],
        [/sound-toggle/i, 'Mute or unmute notification sound']
    ];

    var FOCUSABLE =
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    var CLOSE_SELECTOR =
        '[data-close], [data-rs-close], [data-cv-close], [data-cr-close], [data-um-close], .btn-close, .cm-close, .ev-close, .cr-close, .sd-close, .mc-modal-head .btn-close, [id^="close-"], [id$="-close"], [id^="btn-cancel"]';

    function isVisible(el) {
        if (!el || !el.isConnected) return false;
        if (el.classList.contains('hidden') || el.hasAttribute('hidden')) return false;
        var cs = window.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
    }

    function hasText(el) {
        var clone = el.cloneNode(true);
        var icons = clone.querySelectorAll('i, svg, .sr-only');
        for (var i = 0; i < icons.length; i++) icons[i].remove();
        return clone.textContent.replace(/\s+/g, '').length > 0;
    }

    function iconLabel(el) {
        var icon = el.querySelector('i[class*="fa-"]');
        if (icon) {
            var classes = icon.className.split(/\s+/);
            for (var i = 0; i < classes.length; i++) {
                if (ICON_LABELS[classes[i]]) return ICON_LABELS[classes[i]];
            }
        }
        var key = (el.id || '') + ' ' + (el.className && el.className.baseVal === undefined ? el.className : '');
        for (var j = 0; j < ID_LABELS.length; j++) {
            if (ID_LABELS[j][0].test(key)) return ID_LABELS[j][1];
        }
        return '';
    }

    function labelIconButton(btn) {
        var label = btn.getAttribute('aria-label');
        var iconOnly = !hasText(btn);
        if (!label && !btn.hasAttribute('aria-labelledby')) {
            var title = btn.getAttribute('title');
            var derived = title || (iconOnly ? iconLabel(btn) : '');
            if (derived) {
                btn.setAttribute('aria-label', derived);
                label = derived;
            }
        }
        if (label && iconOnly) {
            var current = btn.getAttribute('title');
            if (!current || btn.__a11yAutoTitle) {
                if (current !== label) btn.setAttribute('title', label);
                btn.__a11yAutoTitle = true;
            }
        }
        var icons = btn.querySelectorAll('i[class*="fa-"]');
        for (var i = 0; i < icons.length; i++) {
            if (icons[i].getAttribute('aria-hidden') !== 'true') icons[i].setAttribute('aria-hidden', 'true');
        }
    }

    function scanIconButtons(root) {
        var scope = root && root.querySelectorAll ? root : document;
        var list = scope.querySelectorAll('button, [role="button"], a.btn-close');
        for (var i = 0; i < list.length; i++) {
            var el = list[i];
            if (!el.querySelector('i[class*="fa-"], svg')) continue;
            if (hasText(el) && !el.hasAttribute('aria-label')) continue;
            labelIconButton(el);
        }
        if (scope !== document && scope.matches && scope.matches('button, [role="button"]')) {
            if (scope.querySelector('i[class*="fa-"], svg') && !hasText(scope)) labelIconButton(scope);
        }
    }

    function makeKeyboardClickable(root) {
        var scope = root && root.querySelectorAll ? root : document;
        var list = scope.querySelectorAll('[onclick]');
        for (var i = 0; i < list.length; i++) {
            var el = list[i];
            var tag = el.tagName;
            if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY|LABEL|OPTION)$/.test(tag)) continue;
            if (el.hasAttribute('tabindex') || el.closest('.modal-overlay.hidden')) continue;
            if (el.classList.contains('modal-overlay') || el.classList.contains('day-empty')) continue;
            el.setAttribute('tabindex', '0');
            if (!el.hasAttribute('role') && !el.querySelector('button, a[href], input, select, textarea')) {
                el.setAttribute('role', 'button');
            }
        }
        var nav = scope.querySelectorAll('.nav-links li, .day-clickable, .stat-card[data-stat], .stat-card[data-action]');
        for (var j = 0; j < nav.length; j++) {
            var n = nav[j];
            if (!n.hasAttribute('tabindex')) n.setAttribute('tabindex', '0');
            if (!n.hasAttribute('role') && !n.querySelector('button, a[href], input, select, textarea')) {
                n.setAttribute('role', 'button');
            }
        }
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var el = e.target;
        if (!el || el.nodeType !== 1) return;
        if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName) || el.isContentEditable) return;
        if (el.getAttribute('role') !== 'button' || el.getAttribute('tabindex') === null) return;
        if (e.defaultPrevented) return;
        e.preventDefault();
        el.click();
    });

    function topDialog() {
        var overlays = document.querySelectorAll('.modal-overlay');
        var top = null;
        for (var i = 0; i < overlays.length; i++) {
            if (isVisible(overlays[i])) top = overlays[i];
        }
        return top;
    }

    function dialogCard(overlay) {
        return (
            overlay.querySelector(':scope > [role="dialog"], :scope > [role="alertdialog"]') ||
            overlay.querySelector(':scope > .modal-content, :scope > .modal-card, :scope > .dialog-card, :scope > div') ||
            overlay.firstElementChild
        );
    }

    var lastFocus = new WeakMap();
    var openState = new WeakSet();

    function describeDialog(overlay) {
        var card = dialogCard(overlay);
        if (!card) return;
        if (!card.hasAttribute('role')) card.setAttribute('role', 'dialog');
        if (!card.hasAttribute('aria-modal')) card.setAttribute('aria-modal', 'true');
        if (!card.hasAttribute('aria-labelledby') && !card.hasAttribute('aria-label')) {
            var heading = card.querySelector('h1, h2, h3');
            if (heading) {
                if (!heading.id) heading.id = (overlay.id || 'dialog') + '-heading';
                card.setAttribute('aria-labelledby', heading.id);
            }
        }
    }

    function focusables(container) {
        var nodes = container.querySelectorAll(FOCUSABLE);
        var out = [];
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n.tabIndex < 0) continue;
            if (n.closest('[hidden], .hidden')) continue;
            if (!isVisible(n)) continue;
            if (n.offsetWidth === 0 && n.offsetHeight === 0 && n.getClientRects().length === 0) continue;
            out.push(n);
        }
        return out;
    }

    function onDialogOpened(overlay) {
        if (openState.has(overlay)) return;
        openState.add(overlay);
        lastFocus.set(overlay, document.activeElement);
        describeDialog(overlay);
        var card = dialogCard(overlay) || overlay;
        if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '-1');
        window.setTimeout(function () {
            if (!isVisible(overlay) || overlay.contains(document.activeElement)) return;
            var items = focusables(card);
            var preferred = null;
            for (var i = 0; i < items.length; i++) {
                if (items[i].matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select')) {
                    preferred = items[i];
                    break;
                }
            }
            (preferred || items[0] || card).focus({ preventScroll: true });
        }, 30);
    }

    function onDialogClosed(overlay) {
        if (!openState.has(overlay)) return;
        openState.delete(overlay);
        var back = lastFocus.get(overlay);
        lastFocus.delete(overlay);
        if (back && back.isConnected && typeof back.focus === 'function' && !topDialog()) {
            window.setTimeout(function () {
                if (!topDialog()) back.focus({ preventScroll: true });
            }, 0);
        }
    }

    function syncDialogs() {
        var overlays = document.querySelectorAll('.modal-overlay');
        for (var i = 0; i < overlays.length; i++) {
            if (isVisible(overlays[i])) onDialogOpened(overlays[i]);
            else onDialogClosed(overlays[i]);
        }
    }

    function closeDialog(overlay) {
        var card = dialogCard(overlay) || overlay;
        var closer = card.querySelector(CLOSE_SELECTOR) || overlay.querySelector(CLOSE_SELECTOR);
        if (closer && !closer.disabled) {
            closer.click();
            return;
        }
        if (overlay.id) overlay.classList.add('hidden');
        else overlay.remove();
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            var overlay = topDialog();
            if (!overlay) return;
            window.setTimeout(function () {
                if (isVisible(overlay) && overlay.isConnected) closeDialog(overlay);
            }, 0);
            return;
        }
        if (e.key !== 'Tab') return;
        var current = topDialog();
        if (!current) return;
        var card = dialogCard(current) || current;
        var items = focusables(card);
        if (items.length === 0) {
            e.preventDefault();
            card.focus();
            return;
        }
        var first = items[0];
        var last = items[items.length - 1];
        var active = document.activeElement;
        if (!card.contains(active)) {
            e.preventDefault();
            (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && (active === first || active === card)) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    });

    var pending = false;
    function schedule() {
        if (pending) return;
        pending = true;
        window.requestAnimationFrame(function () {
            pending = false;
            scanIconButtons(document);
            makeKeyboardClickable(document);
            syncDialogs();
        });
    }

    function start() {
        scanIconButtons(document);
        makeKeyboardClickable(document);
        syncDialogs();
        var observer = new MutationObserver(schedule);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'aria-label']
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();