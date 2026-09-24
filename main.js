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
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) {
            console.error("Profile fetch error:", error.message);
            return false;
        }

        if (profile) {
            globalUserName = profile.full_name || 'User';
            globalUserRole = (profile.role || 'lawyer').toLowerCase();
            if (globalUserRole === 'secretary') globalUserRole = 'administrator';

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
            if (userRole) userRole.textContent = globalUserRole.charAt(0).toUpperCase() + globalUserRole.slice(1);

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

            const uploadDocBtn = document.getElementById('btn-upload-doc');
            if (uploadDocBtn) uploadDocBtn.style.display = (globalUserRole === 'administrator') ? 'none' : 'flex';

            const addEventBtn = document.getElementById('btn-add-event-header');
            if (addEventBtn) addEventBtn.style.display = 'flex';

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
            renderActiveConflictsWidget();
            renderLawyerStatusWidget();
            renderDeadlinesInSchedule();
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
    
    setupAddLawyerModal(); 
    setupEditLawyerModal();
    setupArchiveLawyerModal(); 
    setupMyProfileModal();
    setupAddClientModal();
    disableBrowserAutofill();
    setupCaseDetailModal();
    await renderManageLawyersList(); 

    await renderResourcesWidget();
    setupRoomBookingModal();
    await renderActiveConflictsWidget();
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
            await renderActiveConflictsWidget();
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

        let casesQuery = supabaseClient.from('cases').select('*', { count: 'exact', head: true }).eq('status', 'active');
        let eventsQuery = supabaseClient.from('calendar_events').select('*, profiles(role)').gte('start_date', todayStr).lte('start_date', nextWeekStr);
        let conflictsQuery = supabaseClient.from('calendar_events').select('*, profiles(role)').gte('start_date', todayStr);

        if (globalUserRole === 'lawyer' && currentUser) {
            casesQuery = casesQuery.eq('lawyer_id', currentUser.id);
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
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active')
            .eq('role', 'lawyer');

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
            .select('*, profiles(full_name, role), cases(case_number, case_type, clients(client_name))')
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
        .select('*, profiles(full_name, role), cases(case_number, case_type, clients(client_name))') 
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

function getEventStatusInfo(startDateISO, endDateISO) {
    const start = new Date(startDateISO);
    const end = endDateISO ? new Date(endDateISO) : new Date(start.getTime() + 60 * 60 * 1000); // fallback: assume 1-hour duration
    const now = new Date();

    if (now >= end) return { label: 'Completed', color: '#16a34a', bg: '#dcfce7', icon: 'fa-circle-check' };
    if (now >= start && now < end) return { label: 'Ongoing', color: '#d97706', bg: '#fef3c7', icon: 'fa-hourglass-half' };
    return { label: 'Upcoming', color: '#2563eb', bg: '#dbeafe', icon: 'fa-clock' };
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
            .select('*, profiles(full_name, role), cases(case_number, case_type, case_description, clients(client_name)), documents(title, file_url)')
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
                                <span style="color:#475569;"><strong>Case No:</strong> ${ev.cases.case_number || 'N/A'}</span>
                                <span style="color:#475569;"><strong>Type:</strong> ${ev.cases.case_type || 'N/A'}</span>
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

                html += `
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

async function renderActiveConflictsWidget() {
    const conflictsWidget = document.getElementById('widget-conflicts-list');
    if (!conflictsWidget) return;

    try {
        const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${daysInMonth}`;

        let evQuery = supabaseClient.from('calendar_events').select('*, profiles(role)').gte('start_date', startDate).lte('start_date', endDate).eq('is_conflict', true);
        if (globalUserRole === 'lawyer' && currentUser) {
            evQuery = evQuery.or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);
        }

        const { data: events } = await evQuery;

        if (!events || events.length === 0) {
            conflictsWidget.innerHTML = '<p style="color:#64748b; padding:10px;">No active conflicts</p>';
            return;
        }

        let conflictsHtml = '';
        let conflictCount = 0;

        events.forEach(ev => {
            if (conflictCount < 4) {
                conflictCount++;
                conflictsHtml += `
                    <div style="background:#fff5f5; border:1px solid #fed7d7; padding:15px; border-radius:10px; margin-bottom:12px;">
                        <h5 style="font-size:13px; color:#1e293b; margin-bottom:4px;">Double Booking!</h5>
                        <p style="font-size:11px; color:#64748b; margin-bottom:8px;">Conflict on ${formatDate(ev.start_date)} at ${formatEventTime(ev.start_date)}.</p>
                        <span style="background:#ef4444; color:white; padding:4px 8px; border-radius:6px; font-size:10px; font-weight:bold;">
                            Needs Resolution
                        </span>
                    </div>
                `;
            }
        });

        if (conflictCount > 0) {
            conflictsWidget.innerHTML = conflictsHtml;
        } else {
            conflictsWidget.innerHTML = '<p style="color:#64748b; padding:10px;">No active conflicts</p>';
        }

    } catch (error) {
        console.error('Error rendering conflicts:', error);
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
            .select('*')
            .eq('role', 'lawyer')
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

function getCategoryColor(type) {
    const t = (type || '').toLowerCase();
    if (t === 'motion') return { bg: '#e0e7ff', text: '#2563eb' }; 
    if (t === 'contract') return { bg: '#dcfce7', text: '#16a34a' }; 
    if (t === 'pleading') return { bg: '#f3e8ff', text: '#9333ea' }; 
    if (t === 'evidence') return { bg: '#fef08a', text: '#ea580c' }; 
    if (t === 'order') return { bg: '#fee2e2', text: '#dc2626' }; 
    if (t === 'transcript') return { bg: '#ffedd5', text: '#c2410c' }; 
    if (t === 'estate') return { bg: '#fae8ff', text: '#a855f7' }; 
    return { bg: '#f1f5f9', text: '#475569' }; 
}

function generateTagsHtml(tagsStr) {
    if (!tagsStr) return '';
    const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
    return tags.map(t => `<span style="border: 1px solid #e2e8f0; padding: 2px 10px; border-radius: 99px; font-size: 11px; color: #475569; font-weight: 500;">${t}</span>`).join('');
}

async function renderDocumentList(searchQuery = '', filterType = 'all') {
    const container = document.getElementById('documents-grid-inject');
    const countEl = document.getElementById('docs-found-count');
    if (!container || !currentUser) return;

    try {
        let query = supabaseClient
            .from('documents')
            .select('*, profiles(full_name)')
            .order('created_at', { ascending: false })
            .limit(50); 

        if (globalUserRole !== 'administrator') {
            query = query.eq('uploaded_by', currentUser.id); 
        }

        if (filterType && filterType !== 'all') {
            query = query.eq('type', filterType.toLowerCase());
        }

        if (searchQuery) {
            query = query.ilike('title', `%${searchQuery}%`); 
        }

        const { data: documents, error } = await query;

        if (error) throw error;

        if (documents && documents.length > 0) {
            container.innerHTML = documents.map(doc => {
                const actualUrl = doc.file_url ? doc.file_url : '#';
                const onBtnClick = doc.file_url 
                    ? `window.open('${doc.file_url}', '_blank')` 
                    : `alert('No file attached to this record in the database.')`;
                
                const onDownloadClick = doc.file_url 
                    ? `forceDownload('${doc.file_url}', '${doc.title.replace(/'/g, "\\'")}')` 
                    : `alert('No file attached to this record in the database.')`;

                const typeColor = getCategoryColor(doc.type);

                return `
                <div class="doc-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-sizing: border-box;">
                    <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
                        <div style="background: #eff6ff; color: #3b82f6; width: 42px; height: 42px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="fa-solid fa-file-lines" style="font-size: 18px;"></i>
                        </div>
                        <div>
                            <h4 style="font-size: 14px; font-weight: 600; color: #0f172a; margin: 0 0 6px 0; word-break: break-word;">${doc.title || 'Untitled Document'}</h4>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="background: ${typeColor.bg}; color: ${typeColor.text}; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: lowercase;">${doc.type || 'document'}</span>
                                <span style="font-size: 11px; color: #64748b;">${doc.size || '0 KB'}</span>
                            </div>
                        </div>
                    </div>

                    <div style="font-size: 12px; color: #475569; margin-bottom: 15px; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-tag" style="color: #94a3b8; width: 14px; text-align: center;"></i> 
                            ${doc.case_number || 'No Case Number'}
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-regular fa-user" style="color: #94a3b8; width: 14px; text-align: center;"></i> 
                            ${doc.profiles?.full_name || 'System'}
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

            if (countEl) countEl.textContent = `Found ${documents.length} document${documents.length > 1 ? 's' : ''}`;
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
    await renderDeadlinesInSchedule();
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
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (profile) {
            if (profile.full_name) displayName = profile.full_name;
            if (profile.role) role = profile.role.toLowerCase() === 'secretary' ? 'Administrator' : profile.role;
            if (profile.specialization) specialization = profile.specialization;
            
            const phoneEl = document.querySelector('.contact-text span:last-child');
            if (phoneEl) phoneEl.innerHTML = `<i class="fa-solid fa-phone"></i> ${profile.phone || '(555) 000-0000'}`;
        } else if (currentUser.user_metadata) {
            if (currentUser.user_metadata.full_name) displayName = currentUser.user_metadata.full_name;
            if (currentUser.user_metadata.role) {
                role = currentUser.user_metadata.role.toLowerCase() === 'secretary' ? 'Administrator' : currentUser.user_metadata.role;
            }
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

async function updateScheduleStats() {
    if (!currentUser) return;

    try {
        let activeCases = 0;
        try {
            const { count, error } = await supabaseClient
                .from('cases')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'active')
                .eq('lawyer_id', currentUser.id);
            if (!error) activeCases = count;
        } catch (e) {}

        const localDate = new Date();
        const todayStr = localDate.toISOString().split('T')[0];
        
        const nextWeekDate = new Date(localDate);
        nextWeekDate.setDate(nextWeekDate.getDate() + 7);
        const nextWeekStr = nextWeekDate.toISOString().split('T')[0];

        const { data: upcomingEvents } = await supabaseClient
            .from('calendar_events')
            .select('*')
            .gte('start_date', todayStr)
            .lte('start_date', nextWeekStr)
            .or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);

        const deadlinesCount = upcomingEvents ? upcomingEvents.length : 0;

        const pastWindowDate = new Date(localDate);
        pastWindowDate.setDate(pastWindowDate.getDate() - 60);
        const pastWindowStr = pastWindowDate.toISOString().split('T')[0];

        const { data: recentEvents } = await supabaseClient
            .from('calendar_events')
            .select('start_date, end_date')
            .gte('start_date', pastWindowStr)
            .or(`assigned_to.eq.${currentUser.id},is_general.eq.true`);

        const completedCount = (recentEvents || []).filter(ev => getEventStatusInfo(ev.start_date, ev.end_date).label === 'Completed').length;

        const statCards = document.querySelectorAll('.sched-stat-card h3');
        if (statCards.length >= 4) {
            statCards[0].textContent = activeCases || '0';
            statCards[1].textContent = deadlinesCount || '0';
            statCards[2].textContent = completedCount || '0';
            statCards[3].textContent = (activeCases * 4) + 12 || '32'; 
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
                        <h4 style="font-size:13px; color:#1e293b; margin-bottom:4px;">${doc.title}</h4>
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

async function renderDeadlinesInSchedule() {
    const list = document.getElementById('upcoming-dl-inject');
    if (!list || !currentUser) return;

    try {
        const localDate = new Date();
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        let deadlinesQuery = supabaseClient
            .from('calendar_events')
            .select('*, cases(case_number, clients(client_name))')
            .eq('is_general', false)
            .gte('start_date', todayStr)
            .order('start_date', { ascending: true })
            .limit(5);

        if (globalUserRole === 'lawyer') {
            deadlinesQuery = deadlinesQuery.eq('assigned_to', currentUser.id);
        }

        const { data: deadlines } = await deadlinesQuery;

        if (deadlines && deadlines.length > 0) {
            list.innerHTML = deadlines.map(dl => {
                const dlDate = new Date(dl.start_date);
                const daysUntil = Math.ceil((dlDate - new Date(todayStr)) / (1000 * 60 * 60 * 24));
                const badgeColor = daysUntil <= 3 ? 'bg-red' : 'bg-gray';
                
                const clientName = dl.cases?.clients?.client_name || 'No Client';

                return `
                    <div class="upcoming-dl-item">
                        <div style="display:flex; justify-content:space-between;">
                            <h4>${dl.title}</h4>
                            <span class="badge-pill ${badgeColor}">${daysUntil}d</span>
                        </div>
                        <p>${dl.location || 'Meeting'} • Client: ${clientName}</p>
                        <small><i class="fa-regular fa-calendar"></i> ${formatDate(dl.start_date)} at ${formatEventTime(dl.start_date)}</small>
                    </div>
                `;
            }).join('');
        } else {
            list.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">No upcoming events</p>';
        }
    } catch (error) {
        console.error('Error rendering deadlines:', error);
    }
}

async function renderMyCasesTab() {
    const container = document.querySelector('#sched-cases .content-card');
    if (!container || !currentUser) return;

    try {
        const { data: cases, error } = await supabaseClient
            .from('cases')
            .select('*, clients(client_name)')
            .eq('lawyer_id', currentUser.id)
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
                            <p style="color: #64748b; font-size: 11px;"><i class="fa-regular fa-clock"></i> Opened: ${formatDate(c.created_at)}</p>
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

// --- Client scheduling rule: a client can only have ONE event per day. ---
function toLocalDateKey(dateLike) {
    const d = new Date(dateLike);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Works out which existing client (if any) the event form is pointing at:
// either the one picked in the dropdown, or one that matches the typed email/phone.
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

// Returns null if the client is free on dateStr (YYYY-MM-DD, local time).
// Otherwise returns the clashing event and the next day the client is free.
async function checkClientDayConflict(clientId, dateStr) {
    const { startISO } = getDayRange(dateStr);

    // Include events linked through the client's cases, in case older events have no client_id.
    const { data: clientCases } = await supabaseClient
        .from('cases')
        .select('id')
        .eq('client_id', clientId);

    let orFilter = `client_id.eq.${clientId}`;
    const caseIds = (clientCases || []).map(c => c.id);
    if (caseIds.length > 0) orFilter += `,case_id.in.(${caseIds.join(',')})`;

    // Everything from that day onward, so we can also find the next open day.
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

// --- Best-effort split of a stored "Last, First M." style name back into parts ---
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

function setClientFieldsDisabled(disabled) {
    ['client-fname', 'client-mi', 'client-lname', 'client-email', 'client-phone'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = disabled;
        el.style.background = disabled ? '#e2e8f0' : '#ffffff';
        el.style.color = disabled ? '#64748b' : '#0f172a';
        el.style.cursor = disabled ? 'not-allowed' : 'text';
    });
}

function handleEventClientSelectChange() {
    const select = document.getElementById('event-existing-client');
    if (!select) return;

    const selectedId = select.value;
    const fnameEl = document.getElementById('client-fname');
    const miEl = document.getElementById('client-mi');
    const lnameEl = document.getElementById('client-lname');
    const emailEl = document.getElementById('client-email');
    const phoneEl = document.getElementById('client-phone');

    if (!selectedId) {
        // "+ Add New Client" — clear and unlock the fields for manual entry
        if (fnameEl) fnameEl.value = '';
        if (miEl) miEl.value = '';
        if (lnameEl) lnameEl.value = '';
        if (emailEl) emailEl.value = '';
        if (phoneEl) phoneEl.value = '';
        setClientFieldsDisabled(false);
        populateCasesForClient(null);
        return;
    }

    const client = (window.__eventClientsMap || {})[selectedId];
    if (!client) return;

    const parts = parseClientNameParts(client.client_name);
    if (fnameEl) fnameEl.value = parts.first;
    if (miEl) miEl.value = parts.mi;
    if (lnameEl) lnameEl.value = parts.last;
    if (emailEl) emailEl.value = client.client_email || '';
    if (phoneEl) phoneEl.value = client.client_phone || '';

    setClientFieldsDisabled(true);
    populateCasesForClient(selectedId);
}

// --- Case selection: once a client is picked, show that client's pending
// cases so the lawyer can attach the event to an existing one instead of
// always creating a new case. ---
function setCaseFieldsDisabled(disabled) {
    const numEl = document.getElementById('case-number-input');
    const typeEl = document.getElementById('case-type-select');
    const descEl = document.getElementById('case-desc-input');
    [numEl, descEl].forEach(el => {
        if (!el) return;
        el.disabled = disabled;
        el.style.background = disabled ? '#e2e8f0' : '#ffffff';
        el.style.color = disabled ? '#64748b' : '#0f172a';
        el.style.cursor = disabled ? 'not-allowed' : 'text';
    });
    if (typeEl) typeEl.disabled = disabled;
}

async function populateCasesForClient(clientId) {
    const caseSelect = document.getElementById('event-existing-case');
    const hint = document.getElementById('event-case-hint');
    if (!caseSelect) return;

    // Reset to "+ New Case" and unlock manual fields whenever the client changes.
    caseSelect.value = '';
    setCaseFieldsDisabled(false);
    document.getElementById('case-number-input').value = '';
    document.getElementById('case-desc-input').value = '';

    if (!clientId || !currentUser) {
        caseSelect.innerHTML = '<option value="">+ New Case</option>';
        caseSelect.disabled = true;
        if (hint) hint.textContent = 'Pick a client above to see their pending cases here, or type a case number below to look one up.';
        return;
    }

    try {
        const { data: clientCases } = await supabaseClient
            .from('cases')
            .select('id, case_number, case_type, case_description, title, status')
            .eq('client_id', clientId)
            .eq('lawyer_id', currentUser.id)
            .order('created_at', { ascending: false });

        window.__eventCasesMap = {};
        (clientCases || []).forEach(c => { window.__eventCasesMap[c.id] = c; });

        caseSelect.disabled = false;
        caseSelect.innerHTML = '<option value="">+ New Case</option>' +
            (clientCases || []).map(c => `<option value="${c.id}">${c.case_number ? '#' + c.case_number + ' — ' : ''}${c.title} (${c.status})</option>`).join('');

        if (hint) {
            hint.textContent = (clientCases && clientCases.length > 0)
                ? `This client has ${clientCases.length} case(s) on file — pick one, or leave "+ New Case" to start a new one.`
                : 'This client has no cases yet — a new one will be created.';
        }
    } catch (e) {
        console.error('Error loading cases for client:', e);
    }
}

function handleEventCaseSelectChange() {
    const select = document.getElementById('event-existing-case');
    if (!select) return;

    const selectedId = select.value;
    const numEl = document.getElementById('case-number-input');
    const typeEl = document.getElementById('case-type-select');
    const descEl = document.getElementById('case-desc-input');

    if (!selectedId) {
        if (numEl) numEl.value = '';
        if (descEl) descEl.value = '';
        setCaseFieldsDisabled(false);
        return;
    }

    const c = (window.__eventCasesMap || {})[selectedId];
    if (!c) return;

    if (numEl) numEl.value = c.case_number || '';
    if (typeEl && c.case_type) typeEl.value = c.case_type;
    if (descEl) descEl.value = c.case_description || '';

    setCaseFieldsDisabled(true);
}

// --- Secondary flow: typing an existing case number auto-fills the client too. ---
async function handleCaseNumberLookup() {
    const numEl = document.getElementById('case-number-input');
    const caseSelect = document.getElementById('event-existing-case');
    if (!numEl || !currentUser) return;

    const typedNumber = numEl.value.trim();
    if (!typedNumber || (caseSelect && caseSelect.disabled === false && caseSelect.value)) return;

    try {
        const { data: match } = await supabaseClient
            .from('cases')
            .select('id, case_number, case_type, case_description, title, status, client_id')
            .eq('lawyer_id', currentUser.id)
            .ilike('case_number', typedNumber)
            .maybeSingle();

        if (!match || !match.client_id) return;

        const clientSelect = document.getElementById('event-existing-client');
        if (clientSelect && (window.__eventClientsMap || {})[match.client_id]) {
            clientSelect.value = match.client_id;
            handleEventClientSelectChange();

            // populateCasesForClient runs async and resets the case dropdown —
            // wait for it, then select this specific case once its options exist.
            setTimeout(() => {
                if (caseSelect) {
                    caseSelect.value = match.id;
                    handleEventCaseSelectChange();
                }
            }, 300);
        }
    } catch (e) {
        console.error('Case number lookup error:', e);
    }
}

async function prepareEventModal() {
    const lawyerSelect = document.getElementById('event-lawyer');
    const toggleClientBtn = document.getElementById('btn-toggle-client');
    const toggleCaseBtn = document.getElementById('btn-toggle-case');
    const clientSection = document.getElementById('client-details-section');
    const caseSection = document.getElementById('case-details-section');

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
                lawyerSelect.innerHTML = `<option value="">All Lawyers (Firm-wide Event)</option>`;
                lawyerSelect.disabled = true;
                lawyerSelect.style.backgroundColor = '#e2e8f0';
            }
            if (toggleClientBtn) toggleClientBtn.style.display = 'none';
            if (toggleCaseBtn) toggleCaseBtn.style.display = 'none';
            if (clientSection) clientSection.classList.add('hidden');
            if (caseSection) caseSection.classList.add('hidden');

        } else if (globalUserRole === 'lawyer' && currentUser) {
            if (lawyerSelect) {
                lawyerSelect.innerHTML = `<option value="${currentUser.id}">Atty. ${globalUserName}</option>`;
                lawyerSelect.disabled = true;
                lawyerSelect.style.backgroundColor = '#e2e8f0';
            }
            if (toggleClientBtn) toggleClientBtn.style.display = 'block';
            if (toggleCaseBtn) toggleCaseBtn.style.display = 'block';

            // Only show clients this lawyer personally registered, and remember
            // their full records so selecting one can auto-fill the fields below.
            const existingClientSelect = document.getElementById('event-existing-client');
            const newClientFields = document.getElementById('event-new-client-fields');
            if (existingClientSelect) {
                try {
                    const { data: myClients } = await supabaseClient
                        .from('clients')
                        .select('id, client_name, client_email, client_phone')
                        .eq('registered_by', currentUser.id)
                        .order('client_name', { ascending: true });

                    window.__eventClientsMap = {};
                    (myClients || []).forEach(c => { window.__eventClientsMap[c.id] = c; });

                    existingClientSelect.innerHTML = '<option value="">+ Add New Client</option>' +
                        (myClients || []).map(c => `<option value="${c.id}">${c.client_name}${c.client_email ? ' (' + c.client_email + ')' : ''}</option>`).join('');

                    existingClientSelect.value = '';
                    // Reset the manual fields to a clean, editable state every time the modal opens
                    setClientFieldsDisabled(false);
                    ['client-fname', 'client-mi', 'client-lname', 'client-email', 'client-phone'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.value = '';
                    });

                    // Re-bind (not add-on-top) the change handler so autofill always works
                    existingClientSelect.onchange = handleEventClientSelectChange;

                    // Case dropdown starts empty/disabled until a client is picked
                    const existingCaseSelect = document.getElementById('event-existing-case');
                    if (existingCaseSelect) {
                        existingCaseSelect.onchange = handleEventCaseSelectChange;
                    }
                    setCaseFieldsDisabled(false);
                    populateCasesForClient(null);

                    const caseNumberInput = document.getElementById('case-number-input');
                    if (caseNumberInput) {
                        caseNumberInput.onblur = handleCaseNumberLookup;
                    }

                    if (newClientFields) newClientFields.style.display = 'block';
                } catch (e) {
                    console.error('Error loading clients for event modal:', e);
                }
            }
        }
    } catch (error) {
        console.error('Error loading modal:', error);
    }
}

// Shared helper: upload a file to the 'documents' storage bucket and log it
// in the documents table, optionally linked to a case/client. Returns the
// inserted document row ({id, title, file_url, ...}) or null if no file.
async function uploadCaseDocument(file, { caseId = null, clientId = null, category = 'Attachment', tag = '' } = {}) {
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
        title: file.name,
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

    // Puts the whole event form back to a blank state (fields, dropdowns, collapsible sections).
    function resetEventForm() {
        if (form) form.reset();
        clearEventFieldErrors();

        const existingClientSelect = document.getElementById('event-existing-client');
        if (existingClientSelect) existingClientSelect.value = '';
        setClientFieldsDisabled(false);
        setCaseFieldsDisabled(false);
        populateCasesForClient(null);

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

    // ---------- Required-field validation for the event form ----------
    // We validate in JS (instead of the browser's built-in `required` bubbles) because the
    // client fields live inside a collapsible section that may be closed.
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

        // Selects are wrapped in a positioned div (for the chevron icon) - put the note after the wrapper.
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

    // Returns true if the event form is complete. Case details, the attached file and the
    // optional end date/time are intentionally NOT required.
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

        // Firm-wide events made by administrators have no client section at all.
        const isAdmin = (typeof globalUserRole !== 'undefined' && globalUserRole === 'administrator');
        if (!isAdmin) {
            const pickedClient = document.getElementById('event-existing-client')?.value;
            if (!pickedClient) {
                // "+ Add New Client" is selected, so the client details must be typed in.
                need('client-fname', 'First name is required.');
                need('client-lname', 'Last name is required.');
                need('client-email', 'Email is required.');
                need('client-phone', 'Phone number is required.');

                const emailVal = val('client-email');
                if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
                    problems.push({ el: document.getElementById('client-email'), message: 'Enter a valid email address.' });
                }
            }
        }

        if (problems.length === 0) return true;

        problems.forEach(p => { if (p.el) markEventFieldInvalid(p.el, p.message); });

        // If any missing field is inside the collapsed client section, open it so it is visible.
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

            // Stop here (and highlight what's missing) if any required field is empty.
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

            const existingClientSelect = document.getElementById('event-existing-client');
            const selectedExistingClientId = existingClientSelect ? existingClientSelect.value : '';

            const existingCaseSelect = document.getElementById('event-existing-case');
            const selectedExistingCaseId = existingCaseSelect ? existingCaseSelect.value : '';
            
            const fname = document.getElementById('client-fname').value.trim();
            const mi = document.getElementById('client-mi').value.trim();
            const lname = document.getElementById('client-lname').value.trim();
            const cEmail = document.getElementById('client-email').value.trim();
            const cPhone = document.getElementById('client-phone').value.trim();

            let formattedClientName = '';
            if (lname || fname) {
                formattedClientName = `${lname ? lname + ', ' : ''}${fname} ${mi ? mi + '.' : ''}`.trim();
            }

            const caseNum = document.getElementById('case-number-input').value.trim();
            const caseType = document.getElementById('case-type-select').value;
            const caseDesc = document.getElementById('case-desc-input').value.trim();

            let formattedTime = timeInput; 
            if(timeInput) {
                const [h, m] = timeInput.split(':');
                const hour = parseInt(h);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const formattedH = hour % 12 || 12;
                formattedTime = `${formattedH}:${m} ${ampm}`;
            }

            const eventDateTimeISO = combineDateAndTime(date, timeInput);

            // --- Compute end_date: explicit end date/time if given, else default to +1 hour ---
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

            // --- Block past dates entirely ---
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

            // --- One event per client per day (runs BEFORE anything is saved) ---
            if (date) {
                try {
                    const existingClientId = await resolveExistingClientId(selectedExistingClientId, cEmail, cPhone);
                    if (existingClientId) {
                        const clash = await checkClientDayConflict(existingClientId, date);
                        if (clash) {
                            const knownName = (window.__eventClientsMap || {})[existingClientId]?.client_name;
                            const who = formattedClientName || knownName || 'This client';
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

            // --- Minimum buffer validation for the assigned lawyer, based on actual event duration (runs BEFORE anything is saved) ---
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

            // --- Minimum buffer validation for the booked conference room / location, based on actual event duration (runs BEFORE anything is saved) ---
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
                let newClientId = null;

                if (formattedClientName) {
                    if (selectedExistingClientId) {
                        // A client was picked from the dropdown — reuse it, never insert a copy.
                        newClientId = selectedExistingClientId;
                    } else {
                        // --- Duplicate validation: reuse an existing client instead of creating a copy ---
                        let matchedClient = null;
                        const dupFilters = [];
                        if (cEmail) dupFilters.push(`client_email.ilike.${cEmail}`);
                        if (cPhone) dupFilters.push(`client_phone.eq.${cPhone}`);

                        if (dupFilters.length > 0) {
                            const { data: existingMatches, error: dupError } = await supabaseClient
                                .from('clients')
                                .select('id, client_name, client_email, client_phone')
                                .or(dupFilters.join(','));

                            if (dupError) throw new Error(dupError.message);
                            if (existingMatches && existingMatches.length > 0) {
                                matchedClient = existingMatches[0];
                            }
                        }

                        if (matchedClient) {
                            newClientId = matchedClient.id;
                        } else {
                            const { data: clientData, error: clientErr } = await supabaseClient
                                .from('clients')
                                .insert([{
                                    client_name: formattedClientName,
                                    client_email: cEmail,
                                    client_phone: cPhone,
                                    registered_by: currentUser ? currentUser.id : null
                                }])
                                .select('id')
                                .single();

                            if (clientErr) throw new Error(clientErr.message);
                            if (clientData) newClientId = clientData.id;
                        }
                    }
                }

                let newCaseId = null;

                if (!isGeneral) {
                    if (selectedExistingCaseId) {
                        // A case was picked from the dropdown — reuse it, never insert a copy.
                        newCaseId = selectedExistingCaseId;
                    } else {
                        const caseData = { 
                            title: title, 
                            status: 'active',
                            case_number: caseNum,
                            case_type: caseType,
                            case_description: caseDesc,
                            lawyer_id: assignedLawyerId
                        };
                        
                        if (newClientId) caseData.client_id = newClientId;

                        const { data: insertedCase, error: caseError } = await supabaseClient
                            .from('cases')
                            .insert([caseData])
                            .select('id')
                            .single();

                        if (caseError) throw new Error(caseError.message);
                        if (insertedCase) newCaseId = insertedCase.id;
                    }
                }

                const attachmentInput = document.getElementById('event-attachment');
                const attachmentFile = attachmentInput && attachmentInput.files.length > 0 ? attachmentInput.files[0] : null;
                let attachedDoc = null;
                if (attachmentFile) {
                    if (submitBtn) submitBtn.innerText = 'Uploading attachment...';
                    attachedDoc = await uploadCaseDocument(attachmentFile, {
                        caseId: newCaseId,
                        clientId: newClientId,
                        category: 'Event Attachment',
                        tag: caseNum ? `Case #${caseNum}` : ''
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

                alert(isGeneral ? 'Firm-wide event successfully added!' : 'Event, Client, and Case successfully added!');
                
                form.reset(); 
                setClientFieldsDisabled(false);
                if (existingClientSelect) existingClientSelect.value = '';
                
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
                renderActiveConflictsWidget();
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
        const roomBufferMs = 60 * 60 * 1000; // assume each booking occupies the room for 1 hour

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
    const clientsList = document.getElementById('clients-list-inject');
    if (!casesList) return;

    casesList.innerHTML = '<p style="color:#64748b; text-align:center; padding:20px;">Loading cases...</p>';

    try {
        let casesQuery = supabaseClient
            .from('cases')
            .select('*, clients(id, client_name, client_email, client_phone), profiles(full_name)')
            .order('created_at', { ascending: false });

        if (globalUserRole === 'lawyer' && currentUser) {
            casesQuery = casesQuery.eq('lawyer_id', currentUser.id);
        }

        const { data: cases, error } = await casesQuery;
        if (error) throw error;

        window.__casesRegistry = {};

        if (!cases || cases.length === 0) {
            casesList.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">No cases yet. Cases are created from the "Schedule New Event" form on the Calendar tab.</p>';
        } else {
            casesList.innerHTML = cases.map(c => {
                window.__casesRegistry[c.id] = c;
                const isClosed = c.status === 'closed';
                const statusStyle = isClosed 
                    ? 'background:#f1f5f9; color:#64748b;' 
                    : 'background:#dcfce7; color:#16a34a;';
                const clientName = c.clients?.client_name || 'No Client';
                const lawyerName = c.profiles?.full_name ? `Atty. ${c.profiles.full_name}` : 'Unassigned';

                return `
                    <div class="content-card" style="padding: 18px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom: 0;">
                        <div>
                            <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                                <h4 style="margin:0; font-size:15px; color:#0f172a;">${c.title}</h4>
                                <span style="font-size:10px; padding:3px 10px; border-radius:99px; font-weight:700; text-transform:capitalize; ${statusStyle}">${c.status || 'active'}</span>
                            </div>
                            <p style="margin:0; font-size:12px; color:#64748b;">
                                ${c.case_number ? `#${c.case_number} • ` : ''}${c.case_type || 'General'} 
                                • <i class="fa-solid fa-user" style="font-size:10px;"></i> ${clientName}
                                ${globalUserRole !== 'lawyer' ? `• <i class="fa-solid fa-gavel" style="font-size:10px;"></i> ${lawyerName}` : ''}
                            </p>
                        </div>
                        <div style="display:flex; gap:8px; flex-shrink:0;">
                            <button onclick="toggleCaseStatus('${c.id}', '${c.status || 'active'}')" style="padding:8px 14px; border:1px solid #e2e8f0; background:white; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; color:#334155;">
                                ${isClosed ? 'Reopen' : 'Mark Closed'}
                            </button>
                            <button onclick="openCaseDetail('${c.id}')" style="padding:8px 14px; border:none; background:#0f172a; color:white; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600;">
                                <i class="fa-solid fa-envelope"></i> Emails
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        if (clientsList) {
            const { data: clients, error: clientsError } = await supabaseClient
                .from('clients')
                .select('*')
                .order('created_at', { ascending: false });

            if (clientsError) throw clientsError;

            if (!clients || clients.length === 0) {
                clientsList.innerHTML = '<p style="color:#64748b; text-align:center; padding:15px;">No clients yet.</p>';
            } else {
                clientsList.innerHTML = clients.map(cl => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #f1f5f9; font-size:13px;">
                        <div>
                            <strong style="color:#0f172a;">${cl.client_name}</strong>
                            <p style="margin:2px 0 0 0; color:#64748b; font-size:12px;">${cl.client_email || 'No email'} ${cl.client_phone ? '• ' + cl.client_phone : ''}</p>
                        </div>
                        <span style="font-size:11px; padding:3px 10px; border-radius:99px; font-weight:600; ${cl.auth_user_id ? 'background:#dbeafe; color:#2563eb;' : 'background:#f1f5f9; color:#94a3b8;'}">
                            ${cl.auth_user_id ? 'Portal Active' : 'No Portal Access'}
                        </span>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading cases tab:', error);
        casesList.innerHTML = '<p style="color:#ef4444; text-align:center; padding:30px;">Failed to load cases. Make sure supabase_setup.sql has been run.</p>';
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
        await renderCasesTabView();
    } catch (error) {
        alert('Could not update case status: ' + error.message);
    }
};

// Browsers remember what was typed into forms and offer it back as a suggestion
// (or re-fill it). Turn that off for the app's data-entry forms.
function disableBrowserAutofill() {
    ['add-event-form', 'upload-doc-form', 'add-lawyer-form', 'add-client-form', 'case-email-form']
        .forEach(id => {
            const f = document.getElementById(id);
            if (f) f.setAttribute('autocomplete', 'off');
        });

    const tempPw = document.getElementById('add-lawyer-password');
    if (tempPw) tempPw.setAttribute('autocomplete', 'new-password');
}

function setupAddClientModal() {
    const modal = document.getElementById('add-client-modal');
    const openBtn = document.getElementById('btn-add-client');
    const closeBtn = document.getElementById('close-add-client-btn');
    const form = document.getElementById('add-client-form');

    if (!modal || !form) return;

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            form.reset();
            modal.classList.remove('hidden');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            form.reset();
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Checking...';
        }

        const name = document.getElementById('client-name-input').value.trim();
        const email = document.getElementById('client-email-input').value.trim();
        const phone = document.getElementById('client-phone-input').value.trim();
        const address = document.getElementById('client-address-input').value.trim();
        const wantsPortal = document.getElementById('client-create-portal').checked;

        try {
            // --- Duplicate validation: block if name or email already exists ---
            const { data: existingClients, error: dupError } = await supabaseClient
                .from('clients')
                .select('id, client_name, client_email')
                .or(`client_name.ilike.${name},client_email.ilike.${email}`);

            if (dupError) throw dupError;

            if (existingClients && existingClients.length > 0) {
                const dup = existingClients[0];
                alert(`A client already exists with this name or email: "${dup.client_name}" (${dup.client_email || 'no email'}). Please check the Client Directory instead of adding a duplicate.`);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Add Client';
                }
                return;
            }

            if (submitBtn) submitBtn.innerText = 'Saving...';

            const { data: newClient, error: insertError } = await supabaseClient
                .from('clients')
                .insert([{
                    client_name: name,
                    client_email: email,
                    client_phone: phone,
                    full_address: address,
                    registered_by: currentUser ? currentUser.id : null
                }])
                .select('id')
                .single();

            if (insertError) throw insertError;

            if (wantsPortal && email) {
                if (submitBtn) submitBtn.innerText = 'Sending invite...';
                const { error: otpError } = await supabaseAdminActionsClient.auth.signInWithOtp({
                    email: email,
                    options: {
                        emailRedirectTo: window.location.origin + window.location.pathname.replace('index.html', '') + 'client-portal.html',
                        shouldCreateUser: true
                    }
                });

                if (otpError) {
                    console.error('Portal invite error:', otpError);
                    alert('Client was added, but the portal invite email could not be sent: ' + otpError.message);
                } else {
                    alert(`Client added! A portal login link was emailed to ${email}.`);
                }
            } else {
                alert('Client added successfully!');
            }

            form.reset();
            modal.classList.add('hidden');
            await renderCasesTabView();
        } catch (error) {
            console.error('Error adding client:', error);
            alert('Error adding client: ' + error.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Add Client';
            }
        }
    });
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
    let selectedFile = null;

    if (!modal) return;

    // Clears the text fields, the chosen file and the drag-and-drop box.
    function resetUploadForm() {
        if (form) form.reset();
        if (fileInput) fileInput.value = '';
        if (dropArea && dropText) {
            dropArea.style.borderColor = '#cbd5e1';
            dropArea.style.backgroundColor = '#ffffff';
            dropText.innerText = "Drag and drop files here, or click to browse";
        }
        selectedFile = null;
    }

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            if (globalUserRole === 'administrator') {
                alert('As an administrator, you can view all documents but cannot upload. Please use a lawyer account to upload documents.');
                return;
            }
            resetUploadForm();
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

            const caseNum = document.getElementById('doc-case-num').value || '';
            const category = document.getElementById('doc-category').value || 'Document';
            const tagsInput = document.getElementById('doc-tags').value || '';
            
            const finalTitle = selectedFile.name;
            const fileSizeMb = (selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB';

            try {
                const uniqueFileName = `${Date.now()}_${finalTitle}`;
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

                let matchedCaseId = null;
                if (caseNum) {
                    const { data: matchedCase } = await supabaseClient
                        .from('cases')
                        .select('id')
                        .eq('case_number', caseNum)
                        .limit(1)
                        .maybeSingle();
                    if (matchedCase) matchedCaseId = matchedCase.id;
                }

                const docData = { 
                    title: finalTitle, 
                    type: category.toLowerCase(), 
                    size: fileSizeMb,
                    file_url: fileUrl, 
                    case_id: matchedCaseId,
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
        openBtn.addEventListener('click', () => {
            if (form) form.reset();
            modal.classList.remove('hidden');
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
            const spec = document.getElementById('add-lawyer-spec').value;

            const formattedName = `${fname} ${mi ? mi + '. ' : ''}${lname}`.trim();

            try {
                const { data, error } = await supabaseAdminActionsClient.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: formattedName,
                            role: 'lawyer',
                            specialization: spec,
                            phone: phone
                        }
                    }
                });

                if (error) {
                    throw new Error("Failed to register lawyer: " + error.message);
                }

                 await supabaseClient.from('profiles').insert([{
                     id: data.user ? data.user.id : crypto.randomUUID(), 
                     full_name: formattedName,
                     role: 'lawyer',
                     specialization: spec,
                     phone: phone, 
                     status: 'active'
                 }]);

                alert(`Lawyer Atty. ${formattedName} successfully registered!`);
                form.reset(); 
                modal.classList.add('hidden'); 
                
                renderLawyerStatusWidget();
                prepareEventModal();
                renderManageLawyersList(); 

            } catch (error) {
                console.error('Error adding lawyer:', error);
                alert('Error: \n' + error.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = "Register Lawyer";
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

            try {
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({ 
                        full_name: newName, 
                        phone: newPhone, 
                        specialization: newSpec 
                    })
                    .eq('id', lawyerId);

                if (error) throw new Error(error.message);

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
            .select('*')
            .eq('role', 'lawyer')
            .eq('status', 'active') 
            .order('full_name', { ascending: true });

        if (error) throw error;

        if (lawyers && lawyers.length > 0) {
            if (countEl) countEl.textContent = `Total: ${lawyers.length}`;
            
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
                        <button onclick="openEditLawyerModal('${l.id}', '${l.full_name.replace(/'/g, "\\'")}', '${l.phone}', '${l.specialization}')" style="background:none; border:none; cursor:pointer; color:#3b82f6; padding: 5px;" title="Edit Lawyer">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="openArchiveLawyerModal('${l.id}', '${l.full_name.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; color:#f59e0b; padding: 5px;" title="Archive Lawyer">
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
async function renderArchivedLawyersList() {
    const listContainer = document.getElementById('manage-archived-list-inject');
    const countEl = document.getElementById('manage-archived-count');
    if (!listContainer) return;

    listContainer.innerHTML = '<p style="color:#64748b; text-align:center; padding:30px;">Loading archived lawyers...</p>';

    try {
        const { data: lawyers, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('role', 'lawyer')
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
                } else {
                    renderManageLawyersList();
                }
            }
        });
    });

    checkAuthAndInit();
});