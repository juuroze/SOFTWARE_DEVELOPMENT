const SUPABASE_URL = 'https://qksgqkmctjzmzhzmrbhj.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Hx1bN74JlwOKBW6wv0wRgQ_fkP9N-b5'; 
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


    const supabaseAdminActionsClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { storageKey: 'jurisync-admin-actions', persistSession: false }
    });

    let currentUser = null;
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let globalUserRole = '';
    let globalUserName = '';
    let globalRoleName = '';

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

    async function checkAuthAndInit() {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            
            if (error || !session) {
                window.location.href = 'login.html';
                return;
            }

            currentUser = session.user;
            
            await updateSidebarUserInfo();
            await initializeApp();
            
            supabaseClient.auth.onAuthStateChange((event) => {
                if (event === 'SIGNED_OUT') {
                    window.location.href = 'login.html';
                }
            });

        } catch (err) {
            console.error('System Initialization error:', err);
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
                        avatarSmall.innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%; display:block;">`;
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
            if (uploadDocBtn) uploadDocBtn.style.display = (globalUserRole === 'administrator') ? 'none' : 'flex';

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
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                renderManageLawyersList();
                renderLawyerStatusWidget();
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
                        <div style="background:#fff; border:1px solid #f1f5f9; padding:20px; border-radius:15px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; ${statusInfo.label === 'Completed' ? 'opacity:0.65;' : ''}">
                            <div>
                                <h4 style="font-size:15px;">
                                    ${d.title || 'Untitled Event'} 
                                    ${priorityBadge}
                                    ${isGeneralBadge}
                                    ${statusBadge}
                                </h4>
                                <p style="font-size:13px; color:#64748b; margin-top:4px;"><i class="fa-solid fa-location-dot"></i> ${d.location || 'No location'} • Client: ${clientName} • Atty. ${assignedName}</p>
                                <div style="margin-top:10px; font-size:12px; color:#94a3b8;">
                                    <i class="fa-regular fa-calendar"></i> ${formatDate(d.start_date)} at ${formatEventTime(d.start_date) || 'TBD'}${d.end_date ? ' - ' + formatEventTime(d.end_date) : ''}
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

        if (error) console.error("Calendar fetch error:", error);

        const eventsByDay = {};
        if (calendarEvents) {
            calendarEvents.forEach(event => {
                const day = new Date(event.start_date).getDate();
                if (!eventsByDay[day]) eventsByDay[day] = [];
                eventsByDay[day].push(event);
            });
        }

        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div class="day-cell" style="background:transparent; border:none; box-shadow:none;"></div>`;
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const isCurrent = (i === today.getDate() && 
                            currentMonth === today.getMonth() && 
                            currentYear === today.getFullYear());
            
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
                    eventsHtml += `<div class="cal-event-tag ${styleClass}" title="${clientNameStr}${ev.title} - Atty. ${lawyerName}">
                        <span class="cal-event-tag-title">${iconHtml}${priorityMark}${ev.title || 'Untitled'}</span>
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
                <div class="day-cell ${isCurrent ? 'today' : ''}" onclick="openDayDetails('${dateStrParam}')" style="cursor: pointer; transition: 0.2s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='white'">
                    <span class="day-number ${isCurrent ? 'highlight-blue' : ''}">${i}</span>
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
        listEl.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">Loading...</p>';
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
            listEl.innerHTML = '<p style="color:#ef4444; text-align:center; padding:20px;">Could not load details.</p>';
        }
    }

    function getEventStatusInfo(startDateISO, endDateISO) {
        const start = new Date(startDateISO);
        const end = endDateISO ? new Date(endDateISO) : new Date(start.getTime() + 60 * 60 * 1000);
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
                    <p style="color:#64748b; margin:0; line-height: 1.4;"><em>"${ev.cases.case_description || 'No description provided.'}"</em></p>
                </div>
            `;
        }

        let attachmentHtml = '';
        if (ev.documents) {
            attachmentHtml = `
                <div style="margin-top: 10px;">
                    <a href="${ev.documents.file_url}" target="_blank" rel="noopener" style="font-size:12px; color:#3b82f6; text-decoration:none;">
                        <i class="fa-solid fa-paperclip"></i> ${ev.documents.title}
                    </a>
                </div>
            `;
        }

        return `
            <div style="${conflictStyle} border-radius: 8px; padding: 15px; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
                    <h4 style="margin:0; font-size:16px; color:#0f172a;">${ev.title} ${priorityBadge} ${generalBadge} ${statusBadge}</h4>
                    <span style="font-weight:600; color:#3b82f6; font-size:14px;">${formatEventTime(ev.start_date) || 'TBD'}${ev.end_date ? ' - ' + formatEventTime(ev.end_date) : ''}</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; font-size:13px; color:#475569;">
                    <span><i class="fa-solid fa-location-dot" style="width:16px; color:#94a3b8;"></i> ${ev.location || 'Office'}</span>
                    <span><i class="fa-solid fa-user" style="width:16px; color:#94a3b8;"></i> Client: <strong>${clientName}</strong></span>
                    <span><i class="fa-solid fa-gavel" style="width:16px; color:#94a3b8;"></i> ${ev.is_general ? '<strong>All Lawyers</strong>' : `Atty. ${lawyerName}`}</span>
                </div>
                ${caseDetailsHtml}
                ${attachmentHtml}
            </div>
        `;
    }

    window.openDayDetails = async function(dateString) {
        const modal = document.getElementById('day-details-modal');
        const titleEl = document.getElementById('day-details-title');
        const listEl = document.getElementById('day-details-list');

        if (!modal || !titleEl || !listEl) return;

        const dateObj = new Date(dateString);
        titleEl.textContent = `Events for ${dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
        listEl.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">Loading events...</p>';
        
        modal.classList.remove('hidden');

        try {
            const { startISO: dayStart, endISO: dayEnd } = getDayRange(dateString);
            let eventsQuery = supabaseClient
                .from('calendar_events')
                .select('*, profiles(full_name), cases(case_number, case_type, case_description, clients(client_name)), documents(title, file_url)')
                .gte('start_date', dayStart)
                .lte('start_date', dayEnd)
                .order('start_date', { ascending: true });

            if (globalUserRole === 'lawyer' && currentUser) {
                eventsQuery = eventsQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
            }

            const { data: events, error } = await eventsQuery;

            if (error) throw error;

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
            listEl.innerHTML = '<p style="color:#ef4444; text-align:center; padding:30px;">Failed to load events.</p>';
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
        listEl.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">Loading event...</p>';
        modal.classList.remove('hidden');

        try {
            const { data: ev, error } = await supabaseClient
                .from('calendar_events')
                .select('*, profiles(full_name), cases(case_number, case_type, case_description, clients(client_name)), documents(title, file_url)')
                .eq('id', eventId)
                .single();

            if (error) throw error;

            titleEl.textContent = ev.title || 'Event Details';
            listEl.innerHTML = ev ? buildEventDetailCard(ev) : '<p style="color:#64748b; text-align:center; padding:30px;">Event not found.</p>';
        } catch (error) {
            console.error('Error fetching event details:', error);
            listEl.innerHTML = '<p style="color:#ef4444; text-align:center; padding:30px;">Failed to load this event.</p>';
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
            summaryWidget.innerHTML = '<p style="color:#ef4444; padding:10px; font-size:13px;">Unable to load the schedule summary.</p>';
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
                .select('assigned_to, title, is_general')
                .gte('start_date', todayStart)
                .lte('start_date', todayEnd);

            const lawyerEventMap = {};
            if (todaysEvents) {
                todaysEvents.forEach(ev => {
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
                            <span title="${eventTitle}"><i class="fa-solid fa-circle" style="color:#ef4444; font-size:8px; margin-right:8px;"></i>${l.full_name || 'Unknown'}</span>
                            <span class="tag" style="background:#fee2e2; color:#ef4444; font-size:10px; padding:3px 8px; border-radius:4px; font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;" title="${eventTitle}">${displayTitle}</span>
                        </li>
                    `;
                } else {
                    return `
                        <li style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:13px;">
                            <span><i class="fa-solid fa-circle" style="color:#22c55e; font-size:8px; margin-right:8px;"></i>${l.full_name || 'Unknown'}</span>
                            <span class="tag tag-avail" style="background:#dcfce7; color:#22c55e; font-size:10px; padding:3px 8px; border-radius:4px; font-weight:bold;">Available</span>
                        </li>
                    `;
                }
            }).join('');

        } catch (error) {
            console.error('Error rendering lawyer status:', error);
        }
    }

    function setupDocumentFilters() {
        const searchInput = document.getElementById('doc-search-input');
        const filterSelect = document.getElementById('doc-filter');

        if (searchInput && filterSelect) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value;
                const filterVal = filterSelect.value;
                renderDocumentList(searchTerm, filterVal);
            });

            filterSelect.addEventListener('change', (e) => {
                const filterVal = e.target.value;
                const searchTerm = searchInput.value;
                renderDocumentList(searchTerm, filterVal);
            });
        }
    }

    
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

    try {
        let query = supabaseClient
            .from('documents')
            .select('*, profiles(full_name), cases(case_number, title)')
            .order('created_at', { ascending: false });

        if (globalUserRole !== 'administrator') {
            query = query.eq('uploaded_by', currentUser.id); 
        }

        if (filterType && filterType !== 'all') {
            query = query.eq('type', filterType.toLowerCase());
        }

        const { data: documents, error } = await query;

        if (error) throw error;

        const term = (searchQuery || '').trim().toLowerCase();
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

            return searchFields.includes(term);
        });

        if (filteredDocs && filteredDocs.length > 0) {
            container.innerHTML = filteredDocs.map(doc => {
                const onBtnClick = doc.file_url 
                    ? `window.open(${escapeHtml(JSON.stringify(doc.file_url))}, '_blank')` 
                    : `alert('No file attached to this record in the database.')`;
                
                const onDownloadClick = doc.file_url 
                    ? `forceDownload(${escapeHtml(JSON.stringify(doc.file_url))}, ${escapeHtml(JSON.stringify(doc.title || 'document'))})` 
                    : `alert('No file attached to this record in the database.')`;

                const typeColor = getCategoryColor(doc.type);

                return `
                <div class="doc-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-sizing: border-box;">
                    <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
                        <div style="background: #eff6ff; color: #3b82f6; width: 42px; height: 42px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="fa-solid fa-file-lines" style="font-size: 18px;"></i>
                        </div>
                        <div>
                            <h4 style="font-size: 14px; font-weight: 600; color: #0f172a; margin: 0 0 6px 0; word-break: break-word;">${escapeHtml(doc.title || 'Untitled Document')}</h4>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="background: ${typeColor.bg}; color: ${typeColor.text}; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: lowercase;">${escapeHtml(doc.type || 'document')}</span>
                                <span style="font-size: 11px; color: #64748b;">${doc.size || '0 KB'}</span>
                            </div>
                        </div>
                    </div>

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
                </div>
            `}).join('');

            if (countEl) countEl.textContent = `Found ${filteredDocs.length} document${filteredDocs.length > 1 ? 's' : ''}`;
        } else {
            container.innerHTML = '<p style="color:#64748b; grid-column: 1 / -1; text-align:center; padding: 40px;">No documents match your search/filter.</p>';
            if (countEl) countEl.textContent = `Found 0 documents`;
        }
    } catch (error) {
        console.error('Error rendering documents:', error);
    }
}
    async function forceDownload(url, filename) {
        if (!url || url === '#') { 
            alert('File URL is missing.'); 
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
                if (phoneEl) phoneEl.innerHTML = `<i class="fa-solid fa-phone"></i> ${profile.phone || '(555) 000-0000'}`;
            } else if (currentUser.user_metadata) {
                if (currentUser.user_metadata.full_name) displayName = currentUser.user_metadata.full_name;
            }

            const avatarLarge = document.querySelector('.avatar-large');
            if (avatarLarge) {
                if (profile && profile.avatar_url) {
                    avatarLarge.innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%; display:block;">`;
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
            if (emailEl) emailEl.innerHTML = `<i class="fa-regular fa-envelope"></i> ${currentUser.email}`;
            
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
                            <h4>${ev.title}</h4>
                            <div class="timeline-meta">
                                <span><i class="fa-solid fa-location-dot"></i> ${ev.location || 'Office'}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                timeline.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">No events scheduled for today</p>';
            }
        } catch (error) {
            console.error('Error rendering timeline:', error);
        }
    }

    async function renderRecentDocumentsInSchedule() {
        const list = document.getElementById('recent-docs-inject');
        if (!list || !currentUser) return;

        try {

            const { data: documents } = await supabaseClient
                .from('documents')
                .select('*')
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
                            <p style="font-size:11px; color:#64748b; text-transform:capitalize;">${doc.type || 'Doc'}</p>
                        </div>
                    </div>
                `).join('');
            } else {
                list.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">No recent documents</p>';
            }
        } catch (error) {
            console.error('Error rendering recent documents:', error);
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
                                <h4 style="color: #0f172a; margin-bottom: 4px; font-size: 14px;">${c.title} <span style="color:#64748b; font-weight:normal; font-size:12px;">(${clientName})</span></h4>
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
            container.innerHTML = '<p style="color:#ef4444; padding:20px; text-align:center;">Setup Note: Ensure foreign keys are correct.</p>';
        }
    }

    function renderPerformanceTab() {
        const container = document.querySelector('#sched-perf .content-card');
        if (!container) return;
        
        container.innerHTML = `
            <h3 style="margin-bottom: 25px; font-size: 16px;">Monthly Performance Overview</h3>
            
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                    <span style="font-weight: 500; color: #475569;">Cases Resolved</span>
                    <strong style="color: #22c55e;">85%</strong>
                </div>
                <div style="background: #f1f5f9; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="background: #22c55e; width: 85%; height: 100%; border-radius: 4px;"></div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                    <span style="font-weight: 500; color: #475569;">Client Satisfaction</span>
                    <strong style="color: #3b82f6;">92%</strong>
                </div>
                <div style="background: #f1f5f9; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="background: #3b82f6; width: 92%; height: 100%; border-radius: 4px;"></div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                    <span style="font-weight: 500; color: #475569;">Billable Hours Target</span>
                    <strong style="color: #a855f7;">78%</strong>
                </div>
                <div style="background: #f1f5f9; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="background: #a855f7; width: 78%; height: 100%; border-radius: 4px;"></div>
                </div>
            </div>
        `;
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

    async function renderNotificationsList() {
        const list = document.getElementById('notifications-list-inject');
        if (!list || !currentUser) return;

        try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);
            const nextWeekStr = nextWeek.toISOString().split('T')[0];

            const { data: events } = await supabaseClient
                .from('calendar_events')
                .select('*, profiles(full_name)')
                .gte('start_date', todayStr)
                .or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);

            let notifications = [];

            if (events && events.length > 0) {
                const seen = {};
                events.forEach(ev => {
                    if (!ev.location) return;
                    const key = `${ev.start_date}_${ev.location}`;
                    if (seen[key]) {
                        notifications.push({
                            type: 'conflict',
                            title: 'Scheduling Conflict Detected',
                            priority: 'High Priority',
                            priorityColor: '#ef4444',
                            message: `${ev.location} double-booked on ${formatDate(ev.start_date)} at ${formatEventTime(ev.start_date)}`,
                            recipient: ev.is_general ? 'All Lawyers' : (ev.profiles?.full_name || 'You'),
                            timeAgo: 'Just now',
                            icon: 'fa-solid fa-triangle-exclamation',
                            iconColor: '#ef4444',
                            unread: true,
                            cardBorder: '#93c5fd',
                            cardBg: '#eff6ff'
                        });
                    } else {
                        seen[key] = true;
                    }
                });

                events.forEach(ev => {
                    if (ev.start_date >= todayStr && ev.start_date <= nextWeekStr) {
                        const evDate = new Date(ev.start_date);
                        const diffDays = Math.ceil((evDate - today) / (1000 * 60 * 60 * 24));
                        
                        const lawyerName = ev.is_general ? 'All Lawyers' : (ev.profiles?.full_name || 'You');

                        if (diffDays <= 3) {
                            notifications.push({
                                type: 'deadline',
                                title: ev.is_general ? 'Firm-wide Event Approaching' : 'Critical Deadline Approaching',
                                priority: 'High Priority',
                                priorityColor: '#ef4444',
                                message: `${ev.title} due in ${diffDays} days (${formatDate(ev.start_date)})`,
                                recipient: lawyerName,
                                timeAgo: '2 hours ago',
                                icon: ev.is_general ? 'fa-solid fa-building' : 'fa-regular fa-calendar',
                                iconColor: ev.is_general ? '#7c3aed' : '#f97316',
                                unread: true,
                                cardBorder: '#93c5fd',
                                cardBg: '#eff6ff'
                            });
                        } else {
                            notifications.push({
                                type: 'reminder',
                                title: ev.is_general ? 'Firm-wide Reminder' : 'Court Appearance Reminder',
                                priority: 'Medium',
                                priorityColor: '#0f172a',
                                message: `${ev.title} scheduled on ${formatDate(ev.start_date)} at ${formatEventTime(ev.start_date)}`,
                                recipient: lawyerName,
                                timeAgo: '5 hours ago',
                                icon: 'fa-regular fa-bell',
                                iconColor: '#a855f7',
                                unread: false,
                                cardBorder: '#e2e8f0',
                                cardBg: '#ffffff'
                            });
                        }
                    }
                });
            }

            const unreadCount = notifications.filter(n => n.unread).length;
            const highCount = notifications.filter(n => n.priority === 'High Priority').length;
            
            const statUnread = document.querySelector('.notif-sidebar-container .stat-row:nth-child(2) span:nth-child(2)');
            const statHigh = document.querySelector('.notif-sidebar-container .stat-row:nth-child(3) span:nth-child(2)');
            if (statUnread) statUnread.textContent = unreadCount;
            if (statHigh) statHigh.textContent = highCount;

            const headerBadge = document.getElementById('notif-header-badge');
            if (headerBadge) {
                if (unreadCount > 0) {
                    headerBadge.textContent = `${unreadCount} unread`;
                    headerBadge.style.display = 'inline-block';
                } else {
                    headerBadge.style.display = 'none';
                }
            }

            if (notifications.length > 0) {
                list.innerHTML = notifications.map(n => `
                    <div class="notif-item-card" style="background: ${n.cardBg}; border: 1px solid ${n.cardBorder}; border-radius: 8px; padding: 20px; margin-bottom: 15px;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <i class="${n.icon}" style="color: ${n.iconColor}; font-size: 16px;"></i>
                            <h4 style="font-size: 15px; color: #0f172a; margin: 0; font-weight: 600;">${n.title}</h4>
                            ${n.unread ? `<div class="notif-dot" style="width: 8px; height: 8px; background: #3b82f6; border-radius: 50%;"></div>` : ''}
                        </div>
                        <span style="background: ${n.priorityColor}; color: white; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; display: inline-block; margin-bottom: 10px;">
                            ${n.priority}
                        </span>
                        <p style="font-size: 13px; color: #475569; margin-bottom: 12px;">${n.message}</p>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b;">
                            <span>To: ${n.recipient}</span>
                            <div style="display: flex; gap: 15px;">
                                <span style="color: #22c55e;"><i class="fa-regular fa-circle-check"></i> Email sent</span>
                                <span>${n.timeAgo}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                list.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">No new notifications</p>';
            }
        } catch (error) {
            console.error('Error rendering notifications:', error);
        }
    }

    async function renderEmailQueueList() {
        const list = document.getElementById('email-queue-list-inject');
        if (!list || !currentUser) return;

        try {
            const todayDate = new Date();
            todayDate.setHours(0,0,0,0);
            
            const { data: events } = await supabaseClient
                .from('calendar_events')
                .select('*, profiles(full_name)')
                .or(`assigned_to.eq.${currentUser.id},is_general.eq.true`)
                .order('start_date', { ascending: true });

            let emails = [];

            if (events && events.length > 0) {
                events.forEach(ev => {
                    const evDate = new Date(ev.start_date);
                    evDate.setHours(0,0,0,0);

                    const isSent = evDate <= todayDate;
                    const lawyerName = ev.is_general ? 'All Lawyers' : (ev.profiles?.full_name || 'user');
                    const emailAddress = ev.is_general ? 'all.lawyers@lawfirm.com' : lawyerName.toLowerCase().replace(' ', '.') + '@lawfirm.com';

                    if (isSent) {
                        emails.push({
                            subject: `Sent: Reminder for ${ev.title}`,
                            recipient: emailAddress,
                            isSent: true,
                            timeText: `Sent at ${formatDate(ev.start_date)} 08:00 AM`,
                            status: 'sent',
                            icon: 'fa-regular fa-circle-check',
                            iconColor: '#22c55e'
                        });
                    } else {
                        emails.push({
                            subject: `Upcoming Reminder - ${ev.title}`,
                            recipient: emailAddress,
                            isSent: false,
                            timeText: `Scheduled for ${formatDate(ev.start_date)} 08:00 AM`,
                            status: 'pending',
                            icon: 'fa-regular fa-calendar',
                            iconColor: '#f97316'
                        });
                    }
                });
            }

            const sentCount = emails.filter(e => e.isSent).length;
            const statSent = document.querySelector('.notif-sidebar-container .stat-row:nth-child(4) span:nth-child(2)');
            if (statSent) statSent.textContent = sentCount; 

            if (emails.length > 0) {
                list.innerHTML = emails.map(e => `
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="display: flex; gap: 15px;">
                            <i class="fa-regular fa-envelope" style="color: #94a3b8; font-size: 16px; margin-top: 2px;"></i>
                            <div>
                                <h4 style="font-size: 14px; color: #0f172a; margin: 0 0 5px 0; font-weight: 600;">${e.subject}</h4>
                                <p style="font-size: 12px; color: #64748b; margin: 0 0 8px 0;">To: ${e.recipient}</p>
                                <p style="font-size: 12px; color: ${e.iconColor}; margin: 0; font-weight: 500;">
                                    <i class="${e.icon}"></i> ${e.timeText}
                                </p>
                            </div>
                        </div>
                        <span style="${e.isSent ? 'background: #ffffff; border: 1px solid #e2e8f0; color: #475569;' : 'background: #0f172a; border: 1px solid #0f172a; color: #ffffff;'} padding: 3px 12px; border-radius: 99px; font-size: 11px; font-weight: 600; text-transform: lowercase;">
                            ${e.status}
                        </span>
                    </div>
                `).join('');
            } else {
                list.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">No emails in queue</p>';
            }
        } catch (error) {
            console.error('Error rendering email queue:', error);
        }
    }

    function setupNotificationActions() {
        const btnMarkRead = document.getElementById('btn-mark-read');
        const btnClearRead = document.getElementById('btn-clear-read');
        const btnSendTest = document.getElementById('btn-send-test-email');
        
        if (btnMarkRead) {
            btnMarkRead.addEventListener('click', () => {
                document.querySelectorAll('.notif-dot').forEach(dot => dot.remove());
                
                const statUnread = document.querySelector('.notif-sidebar-container .stat-row:nth-child(2) span:nth-child(2)');
                if (statUnread) statUnread.textContent = '0';
                
                const headerBadge = document.getElementById('notif-header-badge');
                if (headerBadge) headerBadge.style.display = 'none';
                
                alert("All notifications marked as read.");
            });
        }

        if (btnClearRead) {
            btnClearRead.addEventListener('click', () => {
                const list = document.getElementById('notifications-list-inject');
                if (list) {
                    const cards = list.querySelectorAll('.notif-item-card'); 
                    cards.forEach(card => {
                        if (!card.querySelector('.notif-dot')) {
                            card.remove(); 
                        }
                    });
                    alert("Read notifications cleared from view.");
                }
            });
        }

        if (btnSendTest) {
            btnSendTest.addEventListener('click', () => {
                const list = document.getElementById('email-queue-list-inject');
                if (list) {
                    const newEmail = `
                        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; gap: 15px;">
                                <i class="fa-regular fa-envelope" style="color: #94a3b8; font-size: 16px; margin-top: 2px;"></i>
                                <div>
                                    <h4 style="font-size: 14px; color: #0f172a; margin: 0 0 5px 0; font-weight: 600;">TEST EMAIL: System Check</h4>
                                    <p style="font-size: 12px; color: #64748b; margin: 0 0 8px 0;">To: ${currentUser ? currentUser.email : 'you@lawfirm.com'}</p>
                                    <p style="font-size: 12px; color: #22c55e; margin: 0; font-weight: 500;">
                                        <i class="fa-regular fa-circle-check"></i> Sent Just Now
                                    </p>
                                </div>
                            </div>
                            <span style="background: #ffffff; border: 1px solid #e2e8f0; color: #475569; padding: 3px 12px; border-radius: 99px; font-size: 11px; font-weight: 600; text-transform: lowercase;">
                                sent
                            </span>
                        </div>
                    `;
                    
                    if (list.innerHTML.includes('No emails in queue')) {
                        list.innerHTML = '';
                    }
                    list.insertAdjacentHTML('afterbegin', newEmail);
                    
                    const statSent = document.querySelector('.notif-sidebar-container .stat-row:nth-child(4) span:nth-child(2)');
                    if (statSent) statSent.textContent = parseInt(statSent.textContent || 0) + 1;

                    alert("Test email sent and added to queue!");
                }
            });
        }
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

    async function checkClientDayConflict(clientId, dateStr) {
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

        const conflictEvent = (events || []).find(e => toLocalDateKey(e.start_date) === dateStr);
        if (!conflictEvent) return null;

        const busyDays = new Set((events || []).map(e => toLocalDateKey(e.start_date)));
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

    function handleEventCaseSelectChange() {
        const caseSelect = document.getElementById('event-existing-case');
        const info = document.getElementById('event-case-info');
        if (!info) return;
        const c = caseSelect ? (window.__eventCasesMap || {})[caseSelect.value] : null;
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

        const uniqueFileName = `${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabaseClient
            .storage
            .from('documents')
            .upload(uniqueFileName, file);

        if (uploadError) {
            console.error('Storage Error:', uploadError);
            throw new Error("Failed to upload attachment. Please check if the 'documents' bucket exists and is public.");
        }

        const { data: publicUrlData } = supabaseClient
            .storage
            .from('documents')
            .getPublicUrl(uniqueFileName);

        const fileUrl = publicUrlData.publicUrl;
        const fileSizeMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

        const docData = {
            title: title || file.name,
            type: category.toLowerCase(),
            size: fileSizeMb,
            file_url: fileUrl,
            tags: tag,
            uploaded_by: currentUser ? currentUser.id : null
        };
        if (caseId) docData.case_id = caseId;
        if (clientId) docData.client_id = clientId;

        const { data: newDoc, error: dbError } = await supabaseClient
            .from('documents')
            .insert([docData])
            .select('id, title, file_url')
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
                            alert('The end date/time must be after the start date/time.');
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
                        alert("You can't schedule an event on a past date. Please choose today or a future date.");
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
                                alert(`Cannot schedule this event: ${who} already has "${clash.conflictEvent.title}" at ${formatEventTime(clash.conflictEvent.start_date)} on ${formatDate(clash.conflictEvent.start_date)}. A client can only have one event per day.\n\nThe earliest day you can schedule this client is ${formatDate(clash.nextFreeDate.toISOString())}.`);
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
                        alert(`Cannot schedule this event: this lawyer already has "${conflictEvent.title}" at ${formatEventTime(conflictEvent.start_date)} on ${formatDate(conflictEvent.start_date)}. Events for the same lawyer need enough gap between them based on this event's duration.`);
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerText = "Save Event";
                        }
                        return;
                    }
                }

                
                if (location && location.trim() !== '' && eventDateTimeISO) {
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
                        alert(`Cannot schedule this event: "${location}" is already booked for "${conflictEvent.title}" at ${formatEventTime(conflictEvent.start_date)} on ${formatDate(conflictEvent.start_date)}. Bookings for the same room need enough gap between them based on this event's duration.`);
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
                        is_general: isGeneral,
                        is_conflict: false
                    };

                    if (!isGeneral) {
                        eventData.assigned_to = assignedLawyerId;
                    }

                    if (newClientId) eventData.client_id = newClientId;
                    if (newCaseId) eventData.case_id = newCaseId;
                    if (attachedDoc) eventData.document_id = attachedDoc.id;

                    const { error: eventError } = await supabaseClient.from('calendar_events').insert([eventData]);
                    if (eventError) throw new Error(eventError.message);

                    alert(isGeneral
                        ? 'Firm-wide event successfully added!'
                        : 'Event successfully added' + (finalCaseNumber ? ` and linked to case #${finalCaseNumber}.` : '.'));
                    
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
                    alert('Error: \n' + error.message);
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
                .select('id, title, location, start_date, is_general, is_conflict, profiles(full_name), cases(clients(client_name))')
                .gte('start_date', todayStart)
                .lte('start_date', todayEnd)
                .order('start_date', { ascending: true });

            const allRooms = ["Conference Room A", "Conference Room B", "Courtroom 3B"];
            const now = new Date();
            const roomBufferMs = 60 * 60 * 1000;

            window.__roomEventsRegistry = {};

            list.innerHTML = allRooms.map(room => {
                const roomEvents = (events || []).filter(e => (e.location || '').trim().toLowerCase() === room.toLowerCase());

                const currentBooking = roomEvents.find(e => {
                    const start = new Date(e.start_date);
                    const end = new Date(start.getTime() + roomBufferMs);
                    return now >= start && now < end;
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
                    const untilTime = formatEventTime(new Date(new Date(currentBooking.start_date).getTime() + roomBufferMs).toISOString());
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
                        ${subText ? `<span style="color:#94a3b8; font-size:11px; margin-top:3px;">${subText}${linkedEvent ? ' <i class="fa-solid fa-circle-info" style="margin-left:4px;"></i>' : ''}</span>` : ''}
                    </div>
                `;
            }).join('');

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
                <span>Booked by: <strong>${bookedBy}</strong></span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid fa-user" style="width:16px; color:#94a3b8;"></i>
                <span>Client: <strong>${clientName}</strong></span>
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

        casesList.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">Loading cases...</p>';

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
            casesList.innerHTML = '<p style="color:#ef4444; text-align:center; padding:30px;">Failed to load cases. Make sure supabase_setup.sql has been run.</p>';
        }
    }

    function paintCasesList() {
        const casesList = document.getElementById('cases-list-inject');
        const countEl = document.getElementById('cases-count');
        const clearBtn = document.getElementById('cases-date-clear');
        if (!casesList) return;

        const from = document.getElementById('cases-date-from')?.value || '';
        const to = document.getElementById('cases-date-to')?.value || '';
        if (clearBtn) clearBtn.classList.toggle('hidden', !from && !to);

        const all = Object.values(window.__casesRegistry || {});

  
        const cases = all.filter(c => {
            const opened = toLocalDateKey(c.date_filed || c.created_at);
            if (from && opened < from) return false;
            if (to && opened > to) return false;
            return true;
        });

        if (countEl) countEl.textContent = (from || to) ? `${cases.length} of ${all.length} cases` : `Total: ${all.length}`;

        if (all.length === 0) {
            casesList.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">No cases yet.</p>';
            return;
        }
        if (cases.length === 0) {
            casesList.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">No cases were opened in this date range.</p>';
            return;
        }

        casesList.innerHTML = cases.map(c => {
            const isClosed = c.status === 'closed';
            const statusStyle = isClosed
                ? 'background:#f1f5f9; color:#64748b;'
                : 'background:#dcfce7; color:#16a34a;';
            const clientName = escapeHtml(c.clients?.client_name || 'No Client');
            const canEditCase = globalRoleName === 'admin' || globalRoleName === 'lawyer';
            const outline = 'padding:8px 14px; border:1px solid #e2e8f0; background:white; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; color:#334155;';

            const buttons = [];
            if (globalRoleName === 'admin') {
                buttons.push(`<button onclick="openCaseTeam('${c.id}')" style="${outline}"><i class="fa-solid fa-gavel"></i> Lawyers</button>`);
            }
            if (canEditCase) {
                buttons.push(`<button onclick="openCaseForm('${c.id}')" style="${outline}"><i class="fa-solid fa-pen"></i> Edit</button>`);
                buttons.push(`<button onclick="toggleCaseStatus('${c.id}', '${c.status || 'active'}')" style="${outline}">${isClosed ? 'Reopen' : 'Mark Closed'}</button>`);
            }
            buttons.push(`<button onclick="openCaseDetail('${c.id}')" style="padding:8px 14px; border:none; background:#0f172a; color:white; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600;"><i class="fa-solid fa-envelope"></i> Emails</button>`);
            if (globalRoleName === 'admin') {
                buttons.push(`<button onclick="deleteCase('${c.id}')" style="${outline} color:#dc2626;"><i class="fa-solid fa-trash"></i></button>`);
            }

            return `
                <div class="content-card" style="padding: 18px 20px; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom: 0;">
                    <div>
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                            <h4 style="margin:0; font-size:15px; color:#0f172a;">${escapeHtml(c.title)}</h4>
                            <span style="font-size:10px; padding:3px 10px; border-radius:99px; font-weight:700; text-transform:capitalize; ${statusStyle}">${c.status || 'active'}</span>
                            ${c.case_stage ? `<span style="font-size:10px; padding:3px 10px; border-radius:99px; font-weight:700; background:#eff6ff; color:#2563eb;">${escapeHtml(c.case_stage)}</span>` : ''}
                        </div>
                        <p style="margin:0; font-size:12px; color:#64748b;">
                            ${c.case_number ? `#${escapeHtml(c.case_number)} • ` : ''}${escapeHtml(c.case_type || 'General')}${c.party_type ? ' • ' + escapeHtml(c.party_type) : ''}
                            • <i class="fa-solid fa-user" style="font-size:10px;"></i> ${clientName}
                            • Filed ${formatDate(c.date_filed || c.created_at)}
                        </p>
                        ${(c.court_case_no || c.court_branch || c.jurisdiction) ? `<p style="margin:4px 0 0 0; font-size:12px; color:#64748b;">
                            ${[c.court_case_no ? 'Case No. ' + escapeHtml(c.court_case_no) : '', c.court_branch ? escapeHtml(c.court_branch) : '', c.jurisdiction ? 'Jurisdiction: ' + escapeHtml(c.jurisdiction) : ''].filter(Boolean).join(' • ')}
                        </p>` : ''}
                        <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;">${teamChipsHtml(c.case_lawyers)}</div>
                        ${c.case_description ? `<p style="margin:8px 0 0 0; font-size:12px; color:#475569;">${escapeHtml(c.case_description)}</p>` : ''}
                    </div>
                    <div style="display:flex; gap:8px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end;">${buttons.join('')}</div>
                </div>
            `;
        }).join('');
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
                paintCasesList();
            });
        }
    }

        window.toggleCaseStatus = async function(caseId, currentStatus) {
        const newStatus = currentStatus === 'closed' ? 'active' : 'closed';
        try {
            const { error } = await supabaseClient
                .from('cases')
                .update({ status: newStatus })
                .eq('id', caseId);

            if (error) throw error;
            
            const c = (window.__casesRegistry || {})[caseId];
            await logAuditActivity('UPDATE', 'Cases', `Changed case status to ${newStatus}: ${c ? c.title : caseId}`, caseId, {status: currentStatus}, {status: newStatus});
            
            await renderCasesTabView();
        } catch (error) {
            alert('Could not update case status: ' + error.message);
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
        return `${lname ? lname + ', ' : ''}${fname} ${initial ? initial + '.' : ''}`.trim();
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
        listEl.innerHTML = '<p class="mc-empty">Loading clients...</p>';

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
        } catch (err) {
            console.error('Error loading clients:', err);
            const countEl = document.getElementById('clients-count');
            if (countEl) countEl.textContent = '';
            listEl.innerHTML = '<p class="mc-empty" style="color:#ef4444;">Could not load clients. Check your connection and database permissions.</p>';
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

        const btn = (action, id, icon, label, style = '') =>
            `<button type="button" class="mc-tag-btn" data-client-action="${action}" data-client-id="${id}" style="${style}"><i class="fa-solid ${icon}"></i> ${label}</button>`;

        listEl.innerHTML = clients.map(c => {
            const cases = (c.cases || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const caseLines = cases.map(cs => {
                const closedTag = cs.status === 'closed' ? '<span class="mc-tag mc-tag-closed">Closed</span>' : '';
                const caseNo = cs.case_number ? `<span class="mc-case-no">#${escapeHtml(cs.case_number)}</span>` : '';
                return `<div class="mc-case-line"><strong>${escapeHtml(cs.title)}</strong>${caseNo}${closedTag}</div>`;
            }).join('');

            const rejectedNote = (c.approval_status === 'rejected' && c.rejection_reason)
                ? `<div class="mc-case-line" style="color:#dc2626;">Reason: ${escapeHtml(c.rejection_reason)}</div>` : '';

            const actions = [];
            if (isAdminUser()) {
                if (c.approval_status !== 'approved') actions.push(btn('approve', c.id, 'fa-check', 'Approve', 'color:#16a34a; border-color:#bbf7d0;'));
                if (c.approval_status === 'pending') actions.push(btn('reject', c.id, 'fa-xmark', 'Reject', 'color:#dc2626; border-color:#fecaca;'));
                if (c.approval_status === 'approved') actions.push(btn('assign', c.id, 'fa-gavel', 'Assign lawyers'));
                actions.push(btn('edit', c.id, 'fa-pen', 'Edit'));
                actions.push(btn('delete', c.id, 'fa-trash', 'Delete', 'color:#dc2626;'));
            }

            return `
                <div class="mc-client-row">
                    <div>
                        <h4 class="mc-client-name">${escapeHtml(c.client_name || 'Unnamed client')}${isStaffUser() ? approvalBadge(c.approval_status) : ''}</h4>
                        <p class="mc-client-meta">${escapeHtml(c.client_email || 'No email')}${c.client_phone ? ' • ' + escapeHtml(c.client_phone) : ''}${c.full_address ? ' • ' + escapeHtml(c.full_address) : ''}</p>
                        <div class="mc-case-list">
                            <div class="mc-case-line">${c.approval_status === 'approved' || globalRoleName === 'lawyer' ? teamChipsHtml(c.client_lawyers) : ''}</div>
                            ${rejectedNote}
                            ${caseLines}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; align-content:flex-start;">${actions.join('')}</div>
                </div>
            `;
        }).join('');
    }

    async function handleClientAction(action, clientId) {
        if (!isAdminUser()) return;
        const client = (window.__clientsDirectory || []).find(c => String(c.id) === String(clientId));
        if (!client) return;

        try {
            if (action === 'approve' || action === 'assign') {
                await openTeamModal('client', client.id, { approve: action === 'approve' });
                } else if (action === 'reject') {
                const reason = prompt(`Reject ${client.client_name}?\n\nReason (optional):`);
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
                if (!confirm(`Delete ${client.client_name}? This cannot be undone.`)) return;
                const { error } = await supabaseClient.from('clients').delete().eq('id', client.id);
                if (error) {
                    throw new Error(error.message + '\n\nA client that still has cases, documents or events cannot be deleted. Remove or reassign those first.');
                }
                await logAuditActivity('DELETE', 'Clients', `Deleted client: ${client.client_name}`, client.id, client, null);
                await renderClientsView();
            }
        } catch (err) {
            console.error('Client action failed:', err);
            alert('Action failed: ' + err.message);
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
            alert('Could not load lawyers: ' + err.message);
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
                <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:#334155; cursor:pointer;">
                    <input type="checkbox" value="${l.id}" ${currentCo.includes(l.id) ? 'checked' : ''}> ${label(l)}
                </label>`).join('')
            : '<p style="color:#94a3b8; font-size:12px; margin:0;">No active lawyers. Add one in Manage Lawyers first.</p>';

        const syncCo = () => {
            coList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                const isLead = cb.value === leadSel.value;
                if (isLead) cb.checked = false;
                cb.disabled = isLead;
            });
        };
        leadSel.onchange = syncCo;
        syncCo();

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

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const kind = document.getElementById('team-kind').value;
            const id = document.getElementById('team-target-id').value;
            const approve = !!document.getElementById('team-approve').value;
            const lead = document.getElementById('team-lead').value || null;
            const co = [...document.querySelectorAll('#team-co-list input[type="checkbox"]:checked')]
                .map(cb => cb.value)
                .filter(v => v !== lead);

            if (approve && !lead) {
                alert('Choose a lead lawyer before approving. The lead lawyer is who the client is assigned to.');
                return;
            }

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
                alert('Could not save: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = idle;
            }
        });
    }

    async function openCaseForm(caseId = null) {
        const modal = document.getElementById('case-form-modal');
        const form = document.getElementById('case-form');
        if (!modal || !form) return;

        const isEdit = !!caseId;
        const record = isEdit ? (window.__casesRegistry || {})[caseId] : null;

        form.reset();
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
                leadSel.innerHTML = '<option value="">Use the client\'s assigned lawyers</option>' +
                    lawyers.map(l => `<option value="${l.id}">Atty. ${escapeHtml(l.full_name || 'Unnamed')}</option>`).join('');
            } catch (err) {
                leadSel.innerHTML = '<option value="">Could not load lawyers</option>';
            }
        }

        if (record) {
            clientSel.value = String(record.client_id || '');
            clientSel.disabled = !isAdminUser();
            document.getElementById('cf-title').value = record.title || '';
            document.getElementById('cf-type').value = record.case_type || '';
            document.getElementById('cf-party').value = record.party_type || '';
            document.getElementById('cf-court').value = record.court_branch || '';
            document.getElementById('cf-jurisdiction').value = record.jurisdiction || '';
            document.getElementById('cf-court-no').value = record.court_case_no || '';
            document.getElementById('cf-stage').value = record.case_stage || 'For Filing';
            document.getElementById('cf-status').value = record.status || 'active';
            document.getElementById('cf-status').disabled = false;
            document.getElementById('cf-desc').value = record.case_description || '';
            document.getElementById('cf-date').value = toLocalDateKey(record.date_filed || record.created_at);
        } else {
            clientSel.disabled = false;
            document.getElementById('cf-stage').value = 'For Filing';
            document.getElementById('cf-status').value = 'active';
            document.getElementById('cf-status').disabled = true;
            document.getElementById('cf-date').value = toLocalDateKey(new Date().toISOString());
        }
    }

    function setupCaseForm() {
        const modal = document.getElementById('case-form-modal');
        const form = document.getElementById('case-form');
        const closeBtn = document.getElementById('close-case-form-btn');
        const newBtn = document.getElementById('btn-new-case');
        if (!modal || !form) return;

        if (newBtn) newBtn.addEventListener('click', () => { if (globalRoleName !== 'secretary') openCaseForm(null); });
        if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
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
            const jurisdiction = val('cf-jurisdiction');
            const courtCaseNo = val('cf-court-no');
            const caseStage = val('cf-stage');
            const caseStatus = val('cf-status');
            const dateIso = dateVal ? new Date(dateVal + 'T00:00:00').toISOString() : null;

            if (!clientId) { alert('Select a client for this case.'); return; }
            if (!type) { alert('Select the case type.'); return; }

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
                        jurisdiction: jurisdiction || null,
                        court_case_no: courtCaseNo || null,
                        case_stage: caseStage || null,
                        status: caseStatus || 'active',
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
                        courtBranch: courtBranch, courtCaseNo: courtCaseNo, jurisdiction: jurisdiction,
                        caseStage: caseStage, partyType: partyType
                    });
                    if (error) throw error;
                    alert('Case saved.' + (data && data.case_number ? `\n\nCase Number: ${data.case_number}` : ''));
                }

                modal.classList.add('hidden');
                await renderCasesTabView();
                updateDashboardStats();
                renderMyCasesTab();
            } catch (err) {
                console.error('Error saving case:', err);
                alert('Could not save the case: ' + err.message);
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
        if (!confirm(`Delete case "${c ? c.title : ''}"? This cannot be undone.`)) return;
        const { error } = await supabaseClient.from('cases').delete().eq('id', caseId);
        if (error) {
            alert('Could not delete the case: ' + error.message + '\n\nA case that still has documents or events linked to it cannot be deleted.');
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
                const btn = e.target.closest('[data-client-action]');
                if (btn) handleClientAction(btn.getAttribute('data-client-action'), btn.getAttribute('data-client-id'));
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
                        alert(`A client with this name, email or phone already exists: "${dup.client_name}" (${dup.client_email || 'no email'}). Find them in the Client Directory instead of adding a duplicate.`);
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
                        const { error: otpError } = await supabaseAdminActionsClient.auth.signInWithOtp({
                            email: email,
                            options: {
                                emailRedirectTo: window.location.origin + window.location.pathname.replace('index.html', '') + 'client-portal.html',
                                shouldCreateUser: true
                            }
                        });
                        if (otpError) {
                            console.error('Portal invite error:', otpError);
                            message += `\n\nThe portal invite email could not be sent: ${otpError.message}`;
                        } else {
                            message += `\n\nA portal login link was emailed to ${email}.`;
                        }
                    }

                    alert(message);
                    form.reset();
                    if (addModal) addModal.classList.add('hidden');
                    await renderClientsView();
                } catch (error) {
                    console.error('Error adding client:', error);
                    alert('Error adding client: ' + error.message);
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
                    alert('Could not save changes: ' + err.message);
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
        listEl.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:20px;">Loading emails...</p>';

        await loadCaseEmails(caseId);
    };

    async function loadCaseEmails(caseId) {
        const listEl = document.getElementById('case-emails-list');
        if (!listEl) return;

        try {
            const { data: emails, error } = await supabaseClient
                .from('email_queue')
                .select('*, documents(title, file_url)')
                .eq('case_id', caseId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!emails || emails.length === 0) {
                listEl.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:20px;">No emails sent for this case yet. Send an update below.</p>';
            } else {
                listEl.innerHTML = emails.map(m => {
                    const statusBadge = m.is_sent
                        ? '<span style="background:#dcfce7; color:#16a34a; font-size:10px; padding:2px 8px; border-radius:99px; font-weight:700;">Sent</span>'
                        : '<span style="background:#fef3c7; color:#b45309; font-size:10px; padding:2px 8px; border-radius:99px; font-weight:700;">Pending</span>';
                    const attachmentLink = m.documents
                        ? `<a href="${m.documents.file_url}" target="_blank" rel="noopener" style="display:inline-block; margin-top:6px; font-size:11px; color:#3b82f6; text-decoration:none;"><i class="fa-solid fa-paperclip"></i> ${m.documents.title}</a>`
                        : '';
                    return `
                        <div style="border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin-bottom:10px;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                                <p style="margin:0; font-size:13px; font-weight:700; color:#0f172a;">${m.subject}</p>
                                ${statusBadge}
                            </div>
                            <p style="margin:6px 0 0 0; font-size:12px; color:#475569; white-space:pre-wrap;">${m.body || ''}</p>
                            ${attachmentLink}
                            <p style="margin:6px 0 0 0; font-size:10px; color:#94a3b8;">To: ${m.recipient_email} • ${m.is_sent ? 'Sent ' + formatEventTime(m.sent_at) : 'Queued'}</p>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Error loading case emails:', error);
            listEl.innerHTML = '<p style="color:#ef4444; text-align:center; padding:20px;">Failed to load emails. Make sure the email_queue table has case_id/client_id/body columns (see migration).</p>';
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
                    alert('This case has no client email on file, so an update email cannot be sent.');
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
                    alert('Email could not be queued: ' + error.message);
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
                const { data: myCases, error } = await supabaseClient
                    .from('cases')
                    .select(casesSelect('id, case_number, title, client_id', true))
                    .eq('case_lawyers.lawyer_id', currentUser.id)
                    .order('created_at', { ascending: false });
                if (error) throw error;

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
                if (globalUserRole === 'administrator') {
                    alert('As an administrator, you can view all documents but cannot upload. Please use a lawyer account to upload documents.');
                    return;
                }
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
                
                if (globalUserRole === 'administrator') {
                    alert("Administrators are not allowed to upload documents.");
                    return;
                }
                
                if (!selectedFile) {
                    alert("Please select or drag a file to upload first.");
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
                    const uniqueFileName = `${Date.now()}_${selectedFile.name}`;
                    const { data: uploadData, error: uploadError } = await supabaseClient
                        .storage
                        .from('documents') 
                        .upload(uniqueFileName, selectedFile);

                    if (uploadError) {
                        console.error("Storage Error:", uploadError);
                        throw new Error("Failed to upload file to Storage. Please check if 'documents' bucket exists and is public.");
                    }

                    const { data: publicUrlData } = supabaseClient
                        .storage
                        .from('documents')
                        .getPublicUrl(uniqueFileName);
                    
                    const fileUrl = publicUrlData.publicUrl;

                    const docData = { 
                        title: finalTitle, 
                        type: category.toLowerCase(), 
                        size: fileSizeMb,
                        file_url: fileUrl, 
                        case_id: matchedCaseId,
                        client_id: matchedClientId,
                        tags: caseNum ? `${tagsInput}${tagsInput ? ', ' : ''}Case #${caseNum}` : tagsInput,
                        uploaded_by: currentUser ? currentUser.id : null
                    };

                    const { error: dbError } = await supabaseClient
                        .from('documents')
                        .insert([docData]);

                    if (dbError) {
                        console.error("Database Error:", dbError);
                        throw new Error("File uploaded, but failed to save details to database.");
                    }

                    await logAuditActivity('INSERT', 'Documents', `Uploaded document: ${finalTitle}`);

                    alert('Document successfully uploaded and saved!');
                    
                    resetUploadForm();
                    modal.classList.add('hidden'); 
                    
                    renderDocumentList();
                    renderRecentDocumentsInSchedule();

                } catch (error) {
                    console.error('Error saving document:', error);
                    alert('Error: \n' + error.message);
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
                    const { data, error } = await supabaseAdminActionsClient.auth.signUp({
                        email: email,
                        password: password,
                        options: {
                            data: {
                                full_name: formattedName,
                                specialization: spec,
                                phone: phone
                            }
                        }
                    });

                    if (error) {
                        throw new Error("Failed to register user: " + error.message);
                    }

                    if (data.user) {
                        const { error: profileError } = await supabaseClient
                            .from('profiles')
                            .update({
                                full_name: formattedName,
                                role_id: roleId,
                                specialization: spec,
                                phone: phone,
                                status: 'active'
                            })
                            .eq('id', data.user.id);
                        if (profileError) {
                            throw new Error('The account was created but its profile could not be saved: ' + profileError.message);
                        }
                        
                        await logAuditActivity('INSERT', 'Profiles', `Registered new ${roleName}: ${formattedName}`, data.user.id);
                    }

                    alert(`${isLawyerRole ? 'Lawyer Atty.' : 'Secretary'} ${formattedName} successfully registered!`);
                    form.reset(); 
                    modal.classList.add('hidden'); 
                    
                    renderLawyerStatusWidget();
                    prepareEventModal();
                    renderManageLawyersList(); 
                    renderSecretariesList();

                } catch (error) {
                    console.error('Error adding user:', error);
                    alert('Error: \n' + error.message);
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
                    alert('Please choose an image smaller than 2MB.');
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
                    alert('Could not load your profile. Please try again.');
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

                    alert('Profile successfully updated!');
                } catch (error) {
                    console.error('Error updating profile:', error);
                    alert('Error updating profile: ' + error.message);
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
                const patch = { full_name: newName, phone: newPhone, specialization: newSpec };

                try {
                    const { data: oldData } = await supabaseClient.from('profiles').select('*').eq('id', lawyerId).single();

                    const { error } = await supabaseClient
                        .from('profiles')
                        .update(patch)
                        .eq('id', lawyerId);

                    if (error) throw new Error(error.message);

                    await logAuditActivity('UPDATE', 'Profiles', `Edited lawyer profile: Atty. ${newName}`, lawyerId, oldData, patch);

                    alert('Lawyer profile successfully updated!');
                    modal.classList.add('hidden');
                    
                    renderManageLawyersList();
                    renderLawyerStatusWidget();
                    prepareEventModal();

                } catch (error) {
                    console.error('Error updating lawyer:', error);
                    alert('Error updating profile: ' + error.message);
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = "Save Changes";
                    }
                }
            });
        }
    }

    window.openEditLawyerModal = function(id, name, phone, spec) {
        const modal = document.getElementById('edit-lawyer-modal');
        if (!modal) return;

        document.getElementById('edit-lawyer-id').value = id;
        document.getElementById('edit-lawyer-fullname').value = name || '';
        document.getElementById('edit-lawyer-phone').value = phone || '';
        
        const specSelect = document.getElementById('edit-lawyer-spec');
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

                    alert('Lawyer successfully archived (set to inactive).');
                    modal.classList.add('hidden');
                    
                    renderManageLawyersList();
                    renderLawyerStatusWidget();
                    prepareEventModal(); 

                } catch (error) {
                    console.error('Error archiving lawyer:', error);
                    alert('Error archiving lawyer: ' + error.message);
                } finally {
                    confirmBtn.disabled = false;
                    confirmBtn.innerText = "Archive Account";
                }
            });
        }
    }

    window.openArchiveLawyerModal = function(id, name) {
        const modal = document.getElementById('archive-lawyer-modal');
        const nameDisplay = document.getElementById('archive-lawyer-name-display');
        const idInput = document.getElementById('archive-lawyer-id');

        if (!modal || !nameDisplay || !idInput) return;

        idInput.value = id;
        nameDisplay.textContent = `Atty. ${name}`;
        
        modal.classList.remove('hidden');
    };

    async function renderManageLawyersList() {
        const listContainer = document.getElementById('manage-lawyers-list-inject');
        const countEl = document.getElementById('manage-lawyers-count');
        if (!listContainer) return;

        listContainer.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">Loading directory...</p>';

        try {
            const { data: lawyers, error } = await supabaseClient
                .from('profiles')
                .select('*, roles!inner(name)')
                .eq('roles.name', 'lawyer')
                .eq('status', 'active') 
                .order('full_name', { ascending: true });

            if (error) throw error;

            if (lawyers && lawyers.length > 0) {
                if (countEl) countEl.textContent = `Total: ${lawyers.length}`;
                const canManageLawyers = globalRoleName === 'admin';
                
                listContainer.innerHTML = lawyers.map(l => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 15px; border-bottom: 1px solid #f1f5f9;">
                        <div style="display:flex; align-items:center; gap: 15px;">
                            <div style="background:#eff6ff; color:#3b82f6; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">
                                ${getInitials(l.full_name)}
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:14px; color:#0f172a;">Atty. ${l.full_name || 'Unknown'}</h4>
                                <p style="margin:4px 0 0 0; font-size:12px; color:#64748b;">${l.specialization || 'General Practice'} • <i class="fa-solid fa-phone" style="font-size:10px;"></i> ${l.phone || 'N/A'}</p>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap: 12px;">
                            <span class="tag" style="background:#dcfce7; color:#22c55e; font-size:11px; padding:4px 10px; border-radius:99px; font-weight:600;">Active</span>
                            <button ${canManageLawyers ? '' : 'hidden'} onclick="openEditLawyerModal('${l.id}', '${l.full_name.replace(/'/g, "\\'")}', '${l.phone}', '${l.specialization}')" style="background:none; border:none; cursor:pointer; color:#3b82f6; padding: 5px;" title="Edit Lawyer">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button ${canManageLawyers ? '' : 'hidden'} onclick="openArchiveLawyerModal('${l.id}', '${l.full_name.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; color:#f59e0b; padding: 5px;" title="Archive Lawyer">
                                <i class="fa-solid fa-box-archive"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                if (countEl) countEl.textContent = `Total: 0`;
                listContainer.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">No active lawyers found in the directory.</p>';
            }
        } catch (err) {
            console.error('Error loading lawyer directory:', err);
            listContainer.innerHTML = '<p style="color:#ef4444; text-align:center; padding:30px;">Error loading directory.</p>';
        }
    }
    async function renderSecretariesList() {
        const listContainer = document.getElementById('manage-secretaries-list-inject');
        const countEl = document.getElementById('manage-secretaries-count');
        if (!listContainer) return;

        if (globalRoleName !== 'admin') {
            listContainer.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">Only administrators can manage secretaries.</p>';
            if (countEl) countEl.textContent = '';
            return;
        }

        listContainer.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">Loading secretaries...</p>';
        try {
            const { data: people, error } = await supabaseClient
                .from('profiles')
                .select('id, full_name, phone, status, roles!inner(name)')
                .eq('roles.name', 'secretary')
                .order('full_name', { ascending: true });
            if (error) throw error;

            window.__secretaries = {};
            (people || []).forEach(p => { window.__secretaries[p.id] = p; });

            if (countEl) countEl.textContent = `Total: ${(people || []).length}`;
            if (!people || people.length === 0) {
                listContainer.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">No secretaries yet. Use Add New User to create one.</p>';
                return;
            }

            listContainer.innerHTML = people.map(p => {
                const active = p.status !== 'inactive';
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 15px; border-bottom: 1px solid #f1f5f9;${active ? '' : ' background:#fafafa;'}">
                        <div style="display:flex; align-items:center; gap: 15px;">
                            <div style="background:#f5f3ff; color:#8b5cf6; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">
                                ${getInitials(p.full_name)}
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:14px; color:#0f172a;">${escapeHtml(p.full_name || 'Unknown')}</h4>
                                <p style="margin:4px 0 0 0; font-size:12px; color:#64748b;">Secretary • <i class="fa-solid fa-phone" style="font-size:10px;"></i> ${escapeHtml(p.phone || 'N/A')}</p>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap: 12px;">
                            <span style="background:${active ? '#dcfce7' : '#f1f5f9'}; color:${active ? '#22c55e' : '#94a3b8'}; font-size:11px; padding:4px 10px; border-radius:99px; font-weight:600;">${active ? 'Active' : 'Archived'}</span>
                            <button onclick="toggleSecretaryStatus('${p.id}')" style="background:none; border:none; cursor:pointer; color:${active ? '#f59e0b' : '#22c55e'}; padding: 5px;" title="${active ? 'Archive' : 'Restore'}">
                                <i class="fa-solid ${active ? 'fa-box-archive' : 'fa-rotate-left'}"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Error loading secretaries:', err);
            listContainer.innerHTML = '<p style="color:#ef4444; text-align:center; padding:30px;">Error loading secretaries.</p>';
        }
    }

    window.toggleSecretaryStatus = async function(profileId) {
        if (globalRoleName !== 'admin') return;
        const p = (window.__secretaries || {})[profileId];
        if (!p) return;
        const next = p.status === 'inactive' ? 'active' : 'inactive';
        if (!confirm(`${next === 'inactive' ? 'Archive' : 'Restore'} ${p.full_name}?`)) return;
        const { error } = await supabaseClient.from('profiles').update({ status: next }).eq('id', profileId);
        if (error) {
            alert('Could not update: ' + error.message);
            return;
        }
        renderSecretariesList();
    };

    async function renderArchivedLawyersList() {
        const listContainer = document.getElementById('manage-archived-list-inject');
        const countEl = document.getElementById('manage-archived-count');
        if (!listContainer) return;

        listContainer.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">Loading archived lawyers...</p>';

        try {
            const { data: lawyers, error } = await supabaseClient
                .from('profiles')
                .select('*, roles!inner(name)')
                .eq('roles.name', 'lawyer')
                .eq('status', 'inactive')
                .order('full_name', { ascending: true });

            if (error) throw error;

            if (lawyers && lawyers.length > 0) {
                if (countEl) countEl.textContent = `Total Archived: ${lawyers.length}`;
                
                listContainer.innerHTML = lawyers.map(l => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 15px; border-bottom: 1px solid #f1f5f9; background: #fafafa;">
                        <div style="display:flex; align-items:center; gap: 15px;">
                            <div style="background:#f1f5f9; color:#94a3b8; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">
                                ${getInitials(l.full_name)}
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:14px; color:#64748b;">Atty. ${l.full_name || 'Unknown'}</h4>
                                <p style="margin:4px 0 0 0; font-size:12px; color:#94a3b8;">${l.specialization || 'General Practice'} • <i class="fa-solid fa-phone" style="font-size:10px;"></i> ${l.phone || 'N/A'}</p>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap: 12px;">
                            <span class="tag" style="background:#f1f5f9; color:#94a3b8; font-size:11px; padding:4px 10px; border-radius:99px; font-weight:600;">Archived</span>
                            <button onclick="restoreArchivedLawyer('${l.id}', '${l.full_name.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; color:#22c55e; padding: 5px;" title="Restore Lawyer">
                                <i class="fa-solid fa-rotate-left"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                if (countEl) countEl.textContent = `Total Archived: 0`;
                listContainer.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">No archived lawyers found.</p>';
            }
        } catch (err) {
            console.error('Error loading archived lawyers:', err);
            listContainer.innerHTML = '<p style="color:#ef4444; text-align:center; padding:30px;">Error loading archived lawyers.</p>';
        }
    }

    window.restoreArchivedLawyer = async function(id, name) {
        if (!confirm(`Are you sure you want to restore Atty. ${name}? Their account will be reactivated.`)) return;

        try {
                const { error } = await supabaseClient
                .from('profiles')
                .update({ status: 'active' })
                .eq('id', id);

            if (error) throw new Error(error.message);

            await logAuditActivity('UPDATE', 'Profiles', `Restored lawyer: Atty. ${name}`, id);

            alert(`Atty. ${name} has been successfully restored!`);
            
            renderManageLawyersList();
            renderArchivedLawyersList();
            renderLawyerStatusWidget();
            prepareEventModal();

        } catch (error) {
            console.error('Error restoring lawyer:', error);
            alert('Error restoring lawyer: ' + error.message);
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
                    btn.style.borderBottom = '2px solid transparent';
                    btn.style.color = '#64748b';
                    btn.style.fontWeight = '500';
                });
                
                this.classList.add('active');
                this.style.borderBottom = '2px solid #0f172a';
                this.style.color = '#0f172a';
                this.style.fontWeight = '600';

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

async function renderAuditsView() {
        const listEl = document.getElementById('audits-list-inject');
        const countEl = document.getElementById('audits-count');
        if (!listEl) return;

        if (globalRoleName !== 'admin' && globalRoleName !== 'secretary') {
            listEl.innerHTML = '<p style="color:#ef4444; text-align:center; padding:20px;">Unauthorized access.</p>';
            return;
        }

        listEl.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">Loading audit logs...</p>';

        try {
            const { data: logs, error: logsError } = await supabaseClient
                .from('audit_logs')
                .select('*')
                .order('changed_at', { ascending: false })
                .limit(100);

            if (logsError) throw logsError;

            if (countEl) countEl.textContent = `Showing last ${logs.length} activities`;

            if (!logs || logs.length === 0) {
                listEl.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">No recent activity found.</p>';
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
            listEl.innerHTML = logs.map(log => {
                const userName = profileMap[log.changed_by] || 'System';
                
                let actionColor = '#3b82f6'; 
                let actionLabel = 'Updated';
                if (log.action === 'DELETE') { actionColor = '#ef4444'; actionLabel = 'Deleted'; }
                if (log.action === 'INSERT') { actionColor = '#22c55e'; actionLabel = 'Added'; }

                const entityName = (log.table_name || 'record').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                const displayRecordId = log.record_id || log.new_data?.original_int_id || 'Unknown';
                const logDetails = log.new_data?.summary || `Record ID: ${displayRecordId}`;

                return `
                    <div style="padding: 15px; border: 1px solid #f1f5f9; border-radius: 8px; background: #fafbfc; display: flex; align-items: flex-start; gap: 12px;">
                        <div style="background: ${actionColor}20; color: ${actionColor}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                            <i class="fa-solid fa-clock-rotate-left"></i>
                        </div>
                        <div>
                            <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #0f172a;">
                                <strong style="color: ${actionColor};">[${actionLabel}]</strong> 
                                ${entityName}
                            </h4>
                            <p style="margin: 0 0 6px 0; font-size: 13px; color: #334155;">
                                ${escapeHtml(logDetails)}
                            </p>
                            <p style="margin: 0; font-size: 11px; color: #64748b;">
                                By: <strong>${escapeHtml(userName)}</strong> 
                                • ${formatDate(log.changed_at)} at ${formatEventTime(log.changed_at)}
                            </p>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (err) {
            console.error('Error loading audit logs:', err);
            listEl.innerHTML = '<p style="color:#ef4444; text-align:center; padding:20px;">Error loading logs. Check the console for details.</p>';
        }
    }

    async function logAuditActivity(action, entityType, summaryText, recordId = null, oldData = null, newData = null) {
    if (!currentUser) return;
    try {
        let detailsText = summaryText;
        
        const safeOldData = oldData ? JSON.parse(JSON.stringify(oldData)) : null;
        const safeNewData = newData ? JSON.parse(JSON.stringify(newData)) : null;
        
        if (action === 'UPDATE' && safeOldData && safeNewData) {
            const changes = [];
            for (const key in safeNewData) {
                if (key !== 'id' && key !== 'updated_at' && safeNewData[key] !== undefined) {
                    const oldVal = safeOldData[key] ? String(safeOldData[key]) : '(empty)';
                    const newVal = safeNewData[key] ? String(safeNewData[key]) : '(empty)';
                    
                    if (oldVal !== newVal && typeof safeNewData[key] !== 'object') {
                        const niceKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        changes.push(`${niceKey}: "${oldVal}" ➔ "${newVal}"`);
                    }
                }
            }
            if (changes.length > 0) {
                detailsText += ` | Changes: ${changes.join(', ')}`;
            }
        }

        const payloadNewData = safeNewData ? { summary: detailsText, ...safeNewData } : { summary: detailsText };

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recordId);
        const validUuidRecordId = isUUID ? recordId : null;
        
        if (!isUUID && recordId) {
            payloadNewData.original_int_id = recordId;
        }

        await supabaseClient.from('audit_logs').insert([{
            action: action,
            table_name: entityType.toLowerCase().replace(' ', '_'),
            new_data: payloadNewData,
            old_data: safeOldData,
            record_id: validUuidRecordId, 
            changed_by: currentUser.id
        }]);
    } catch (err) {
        console.error('Failed to log activity:', err);
    }
}