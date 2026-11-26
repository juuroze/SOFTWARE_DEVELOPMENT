(function () {
    'use strict';

    var rowMenu = null;
    var uid = 0;
    var scheduled = false;

    function byId(id) {
        return document.getElementById(id);
    }

    function role() {
        return typeof globalRoleName === 'string' ? globalRoleName : '';
    }

    function canEdit() {
        return role() === 'admin' || role() === 'lawyer';
    }

    function caseMenuItems(id) {
        var items = [
            { fn: 'openCaseReports', icon: 'fa-file-lines', label: 'Reports and history' },
            { fn: 'openCaseDetail', icon: 'fa-envelope', label: 'Case emails' }
        ];
        if (role() === 'admin') items.push({ fn: 'openCaseTeam', icon: 'fa-gavel', label: 'Assign lawyers' });
        if (canEdit()) items.push({ fn: 'openCaseForm', icon: 'fa-pen', label: 'Edit case' });
        if (role() === 'admin') items.push({ fn: 'deleteCase', icon: 'fa-trash', label: 'Delete case', danger: true, separator: true });
        items.forEach(function (it) {
            it.id = id;
        });
        return items;
    }

    function closeRowMenu(focusBack) {
        if (!rowMenu) return;
        var state = rowMenu;
        rowMenu = null;
        state.menu.remove();
        state.btn.setAttribute('aria-expanded', 'false');
        if (focusBack && state.btn.isConnected) state.btn.focus();
    }

    function sourceMenuItems(btn) {
        var src = btn.previousElementSibling;
        var items = [];
        if (!src || !src.classList.contains('row-actions-src')) return items;
        var buttons = src.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
            var b = buttons[i];
            var icon = b.querySelector('i[class*="fa-"]');
            var iconClass = 'fa-ellipsis';
            if (icon) {
                var parts = icon.className.split(/\s+/);
                for (var k = 0; k < parts.length; k++) {
                    if (parts[k].indexOf('fa-') === 0 && parts[k] !== 'fa-solid' && parts[k] !== 'fa-regular') iconClass = parts[k];
                }
            }
            var danger = b.classList.contains('ct-red');
            items.push({
                source: b,
                icon: iconClass,
                label: b.getAttribute('title') || b.textContent.trim(),
                danger: danger,
                separator: danger && items.length > 0
            });
        }
        return items;
    }

    function openRowMenu(btn) {
        closeRowMenu(false);
        var items = btn.hasAttribute('data-menu-src') ? sourceMenuItems(btn) : caseMenuItems(btn.getAttribute('data-row-menu'));
        if (!items.length) return;
        var menu = document.createElement('div');
        menu.className = 'row-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', btn.getAttribute('data-menu-label') || 'Case actions');
        menu.innerHTML = items
            .map(function (it, i) {
                return (
                    (it.separator ? '<div class="row-menu-sep" role="separator"></div>' : '') +
                    '<button type="button" role="menuitem" tabindex="-1" class="row-menu-item' +
                    (it.danger ? ' is-danger' : '') +
                    '" data-menu-index="' +
                    i +
                    '"><i class="fa-solid ' +
                    it.icon +
                    '" aria-hidden="true"></i><span>' +
                    escapeHtml(it.label) +
                    '</span></button>'
                );
            })
            .join('');
        document.body.appendChild(menu);
        var r = btn.getBoundingClientRect();
        var mw = menu.offsetWidth;
        var mh = menu.offsetHeight;
        var left = Math.min(Math.max(8, r.right - mw), window.innerWidth - mw - 8);
        var top = r.bottom + 6;
        if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
        btn.setAttribute('aria-expanded', 'true');
        rowMenu = { menu: menu, btn: btn, items: items };
        menu.querySelector('.row-menu-item').focus();
    }

    function moveMenuFocus(step) {
        var nodes = Array.from(rowMenu.menu.querySelectorAll('.row-menu-item'));
        var i = nodes.indexOf(document.activeElement);
        var next = step === 'first' ? 0 : step === 'last' ? nodes.length - 1 : (i + step + nodes.length) % nodes.length;
        nodes[next].focus();
    }

    function runMenuItem(index) {
        var state = rowMenu;
        var item = state.items[index];
        closeRowMenu(true);
        window.setTimeout(function () {
            if (!item) return;
            if (item.source) {
                if (item.source.isConnected) item.source.click();
            } else if (typeof window[item.fn] === 'function') {
                window[item.fn](item.id);
            }
        }, 0);
    }

    function labelCells() {
        var tables = document.querySelectorAll('.ct-table');
        for (var t = 0; t < tables.length; t++) {
            var table = tables[t];
            var body = table.tBodies[0];
            if (!body) continue;
            if (table.__lblRow === body.rows[0] && table.__lblCount === body.rows.length) continue;
            var labels = Array.from(table.querySelectorAll('thead th')).map(function (th) {
                return th.textContent.replace(/\s+/g, ' ').trim();
            });
            for (var r = 0; r < body.rows.length; r++) {
                var cells = body.rows[r].cells;
                for (var c = 0; c < cells.length; c++) {
                    if (labels[c] && !cells[c].hasAttribute('data-label')) cells[c].setAttribute('data-label', labels[c]);
                }
            }
            table.__lblRow = body.rows[0];
            table.__lblCount = body.rows.length;
        }
    }

    function addMobileTools() {
        var wraps = document.querySelectorAll('.ct-wrap');
        for (var w = 0; w < wraps.length; w++) {
            var wrap = wraps[w];
            var prev = wrap.previousElementSibling;
            if (prev && prev.classList.contains('ct-mobile-tools')) continue;
            var table = wrap.querySelector('.ct-table');
            if (!table) continue;
            var ths = Array.from(table.querySelectorAll('thead th'));
            var sortable = ths.filter(function (th) {
                return th.classList.contains('ct-sortable');
            });
            if (!sortable.length) continue;
            uid++;
            var options = sortable
                .map(function (th) {
                    var active = th.classList.contains('ct-sorted');
                    var up = th.querySelector('.fa-arrow-up');
                    return (
                        '<option value="' +
                        ths.indexOf(th) +
                        '"' +
                        (active ? ' selected' : '') +
                        '>' +
                        escapeHtml(th.textContent.replace(/\s+/g, ' ').trim()) +
                        (active ? (up ? ' (ascending)' : ' (descending)') : '') +
                        '</option>'
                    );
                })
                .join('');
            var bar = document.createElement('div');
            bar.className = 'ct-mobile-tools';
            bar.innerHTML =
                '<label for="ct-sort-' +
                uid +
                '" class="ct-mobile-label">Sort by</label><select id="ct-sort-' +
                uid +
                '" class="ui-select ct-mobile-sort">' +
                options +
                '</select><button type="button" class="ct-text-btn" data-mobile-reverse><i class="fa-solid fa-arrow-up-wide-short" aria-hidden="true"></i> Reverse</button>';
            wrap.parentNode.insertBefore(bar, wrap);
        }
    }

    function refocusMobileSort(containerId) {
        window.setTimeout(function () {
            var host = containerId ? byId(containerId) : null;
            var sel = host && host.querySelector('.ct-mobile-sort');
            if (sel) sel.focus();
        }, 60);
    }

    function pass() {
        scheduled = false;
        labelCells();
        addMobileTools();
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(pass);
    }

    document.addEventListener('click', function (e) {
        var menuBtn = e.target.closest('[data-row-menu]');
        if (menuBtn) {
            var wasOpen = rowMenu && rowMenu.btn === menuBtn;
            if (wasOpen) closeRowMenu(true);
            else openRowMenu(menuBtn);
            return;
        }
        var item = e.target.closest('.row-menu-item');
        if (item && rowMenu) {
            runMenuItem(Number(item.getAttribute('data-menu-index')));
            return;
        }
        if (rowMenu) closeRowMenu(false);

        var reverse = e.target.closest('[data-mobile-reverse]');
        if (reverse) {
            var tools = reverse.closest('.ct-mobile-tools');
            var wrap = tools && tools.nextElementSibling;
            var active = wrap && wrap.querySelector('thead th.ct-sorted');
            if (active) {
                var host = tools.parentElement && tools.parentElement.id;
                active.click();
                refocusMobileSort(host);
            }
        }
    });

    document.addEventListener('change', function (e) {
        var t = e.target;
        if (t.matches && t.matches('.ct-mobile-sort')) {
            var tools = t.closest('.ct-mobile-tools');
            var wrap = tools && tools.nextElementSibling;
            var th = wrap && wrap.querySelectorAll('thead th')[Number(t.value)];
            if (th) {
                var host = tools.parentElement && tools.parentElement.id;
                th.click();
                refocusMobileSort(host);
            }
        }
    });

    document.addEventListener('keydown', function (e) {
        if (!rowMenu) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeRowMenu(true);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveMenuFocus(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveMenuFocus(-1);
        } else if (e.key === 'Home') {
            e.preventDefault();
            moveMenuFocus('first');
        } else if (e.key === 'End') {
            e.preventDefault();
            moveMenuFocus('last');
        } else if (e.key === 'Tab') {
            closeRowMenu(false);
        }
    });

    window.addEventListener('resize', function () {
        closeRowMenu(false);
    });
    window.addEventListener(
        'scroll',
        function (e) {
            if (rowMenu && !(e.target && e.target.closest && e.target.closest('.row-menu'))) closeRowMenu(false);
        },
        true
    );

    function start() {
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
        schedule();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();