// ---------- Helpers ----------
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function todayDisplay() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function nowTimeStr() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
function fmtTimeDisplay(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function daysUntil(targetDateStr) {
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - todayOnly) / 86400000);
}
function notify(title, body) {
  try { new Notification(title, { body }); } catch (e) { console.error('Notification failed:', e); }
}

const dateKey = todayKey();
const statusText = document.getElementById('statusText');

let store = { days: {}, countdowns: [], events: [], reminders: [], pomodoro: { workMin: 25, breakMin: 5 } };
let day = { notes: '', calls: [], todos: [] };

let saveTimer = null;
function persist(hint) {
  if (hint) statusText.textContent = hint;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await window.quickNote.save(store);
      statusText.textContent = 'Saved · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.error('Save failed:', e);
      statusText.textContent = 'Save failed — see console; use Export Backup to be safe';
    }
  }, 300);
}

document.getElementById('revealFileLink').addEventListener('click', (e) => {
  e.preventDefault();
  window.quickNote.revealDataFile();
});

document.getElementById('headerDate').textContent = todayDisplay();
document.getElementById('todayLabel').textContent = 'Today · ' + todayDisplay();

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ---------- Clock ----------
function tickClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
tickClock();
setInterval(tickClock, 1000);

// ---------- Notes ----------
const notesArea = document.getElementById('notesArea');
const saveHint = document.getElementById('saveHint');
let notesSaveTimer = null;

notesArea.addEventListener('input', () => {
  day.notes = notesArea.value;
  saveHint.textContent = 'saving...';
  clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(async () => {
    try {
      await window.quickNote.save(store);
      saveHint.textContent = 'saved · ' + new Date().toLocaleTimeString();
    } catch (e) {
      console.error('Notes save failed:', e);
      saveHint.textContent = 'save failed — see console';
    }
  }, 400);
});

document.getElementById('copyNotesBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  try {
    await navigator.clipboard.writeText(notesArea.value);
    btn.textContent = 'Copied';
  } catch (err) {
    btn.textContent = 'Copy failed';
  }
  setTimeout(() => { btn.textContent = 'Copy Notes'; }, 2000);
});

// ---------- Calls ----------
const callDate = document.getElementById('callDate');
const callTime = document.getElementById('callTime');
const hasAction = document.getElementById('hasAction');
const actionField = document.getElementById('actionField');
const callList = document.getElementById('callList');
const callBadge = document.getElementById('callBadge');

callDate.value = dateKey;
callTime.value = nowTimeStr();

hasAction.addEventListener('change', () => {
  actionField.style.display = hasAction.checked ? 'block' : 'none';
});

function renderCalls() {
  callBadge.textContent = day.calls.length;
  if (day.calls.length === 0) {
    callList.innerHTML = '<div class="empty-state">No calls logged today.</div>';
    return;
  }
  callList.innerHTML = '';
  [...day.calls].reverse().forEach((c) => {
    const idx = day.calls.indexOf(c);
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <div class="entry-top">
        <div class="entry-name">${escapeHtml(c.name || '(no name)')}</div>
        <div class="entry-time">${fmtTimeDisplay(c.time)} · ${c.date}</div>
      </div>
      <div class="entry-line"><strong>Callback:</strong> ${escapeHtml(c.number || '—')}</div>
      ${c.message ? `<div class="entry-msg">${escapeHtml(c.message)}</div>` : ''}
      ${c.action ? `<div class="entry-action">Action: ${escapeHtml(c.action)}</div>` : ''}
      <div class="entry-actions">
        <button class="small" data-action="email" data-idx="${idx}">Email via Outlook</button>
        <button class="small" data-action="copy" data-idx="${idx}">Copy Details</button>
        ${c.action ? `<button class="small" data-action="todoist" data-idx="${idx}">Add to Todoist</button>` : ''}
        <button class="small danger" data-action="delete" data-idx="${idx}">Delete</button>
      </div>
    `;
    callList.appendChild(div);
  });
}

document.getElementById('addCallBtn').addEventListener('click', () => {
  const name = document.getElementById('callerName').value.trim();
  const number = document.getElementById('callerNumber').value.trim();
  const date = callDate.value || dateKey;
  const time = callTime.value || nowTimeStr();
  const message = document.getElementById('callMessage').value.trim();
  const action = hasAction.checked ? document.getElementById('actionText').value.trim() : '';

  if (!name && !number && !message && !action) return;

  day.calls.push({ name, number, date, time, message, action });
  renderCalls();
  persist('saving call...');

  document.getElementById('callerName').value = '';
  document.getElementById('callerNumber').value = '';
  document.getElementById('callMessage').value = '';
  document.getElementById('actionText').value = '';
  hasAction.checked = false;
  actionField.style.display = 'none';
  callDate.value = todayKey();
  callTime.value = nowTimeStr();
});

callList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  const c = day.calls[idx];
  if (!c) return;
  const action = btn.dataset.action;

  if (action === 'delete') {
    day.calls.splice(idx, 1);
    renderCalls();
    persist('saving...');
  } else if (action === 'email') {
    const bodyText = `Caller: ${c.name || ''}\nCallback #: ${c.number || ''}\nDate: ${c.date}\nTime: ${fmtTimeDisplay(c.time)}\n\nMessage:\n${c.message || ''}` +
      (c.action ? `\n\nAction item: ${c.action}` : '');
    const subject = encodeURIComponent(`Message from ${c.name || 'caller'}`);
    const body = encodeURIComponent(bodyText);
    const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?subject=${subject}&body=${body}`;
    await window.quickNote.openExternal(outlookUrl);
  } else if (action === 'copy') {
    const bodyText = `Caller: ${c.name || ''}\nCallback #: ${c.number || ''}\nDate: ${c.date}\nTime: ${fmtTimeDisplay(c.time)}\n\nMessage:\n${c.message || ''}` +
      (c.action ? `\n\nAction item: ${c.action}` : '');
    try {
      await navigator.clipboard.writeText(bodyText);
      btn.textContent = 'Copied';
    } catch (err) {
      btn.textContent = 'Copy failed';
    }
    setTimeout(() => { btn.textContent = 'Copy Details'; }, 2000);
  } else if (action === 'todoist') {
    const details = [c.name, c.number].filter(Boolean).join(', ');
    const content = encodeURIComponent(`${c.action}${details ? ' (re: ' + details + ')' : ''}`);
    await window.quickNote.openExternal(`https://todoist.com/add?content=${content}`);
  }
});

// ---------- Reminders (today only) ----------
const reminderTextInput = document.getElementById('reminderText');
const reminderTimeInput = document.getElementById('reminderTime');
const reminderList = document.getElementById('reminderList');

function todaysReminders() {
  return store.reminders.filter(r => r.when.slice(0, 10) === dateKey).sort((a, b) => a.when.localeCompare(b.when));
}

function renderReminders() {
  const list = todaysReminders();
  if (list.length === 0) {
    reminderList.innerHTML = '<div class="empty-state">No reminders set for today.</div>';
    return;
  }
  reminderList.innerHTML = '';
  list.forEach((r) => {
    const idx = store.reminders.indexOf(r);
    const time = r.when.slice(11, 16);
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <div class="checkbox-row" style="margin-bottom:0;">
        <label style="flex:1;">${r.fired ? '✓ ' : ''}${escapeHtml(fmtTimeDisplay(time))} — ${escapeHtml(r.text)}</label>
        <button class="small danger" data-idx="${idx}">Remove</button>
      </div>
    `;
    reminderList.appendChild(div);
  });
}

document.getElementById('addReminderBtn').addEventListener('click', () => {
  const text = reminderTextInput.value.trim();
  const time = reminderTimeInput.value;
  if (!text || !time) return;
  store.reminders.push({ id: uid(), text, when: `${dateKey}T${time}`, fired: false });
  renderReminders();
  persist('saving reminder...');
  reminderTextInput.value = '';
  reminderTimeInput.value = '';
});

reminderList.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-idx]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  store.reminders.splice(idx, 1);
  renderReminders();
  persist('saving...');
});

function checkReminders() {
  const now = new Date();
  let changed = false;
  store.reminders.forEach((r) => {
    if (!r.fired && new Date(r.when) <= now) {
      r.fired = true;
      changed = true;
      notify('Reminder', r.text);
    }
  });
  if (changed) {
    renderReminders();
    persist();
  }
}
setInterval(checkReminders, 20000);

// ---------- To-Do (today) ----------
const todoInput = document.getElementById('todoInput');
const todoList = document.getElementById('todoList');
const todoBadge = document.getElementById('todoBadge');

function renderTodos() {
  todoBadge.textContent = day.todos.length;
  if (day.todos.length === 0) {
    todoList.innerHTML = '<div class="empty-state">Nothing sent to Todoist yet today.</div>';
    return;
  }
  todoList.innerHTML = '';
  day.todos.forEach((t, idx) => {
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <div class="checkbox-row" style="margin-bottom:0;">
        <label style="flex:1;">${escapeHtml(t.text)}</label>
        <button class="small danger" data-action="delete-todo" data-idx="${idx}">Remove from log</button>
      </div>
    `;
    todoList.appendChild(div);
  });
}

document.getElementById('addTodoBtn').addEventListener('click', async () => {
  const text = todoInput.value.trim();
  if (!text) return;
  await window.quickNote.openExternal(`https://todoist.com/add?content=${encodeURIComponent(text)}`);
  day.todos.push({ text });
  renderTodos();
  persist('saving...');
  todoInput.value = '';
  const hint = document.getElementById('todoSaveHint');
  if (hint) { hint.textContent = 'sent to Todoist inbox'; }
});

todoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('addTodoBtn').click();
});

todoList.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="delete-todo"]');
  if (btn) {
    const idx = parseInt(btn.dataset.idx, 10);
    day.todos.splice(idx, 1);
    renderTodos();
    persist('saving...');
  }
});

// ---------- Pomodoro ----------
const pomoWorkInput = document.getElementById('pomoWork');
const pomoBreakInput = document.getElementById('pomoBreak');
const pomoDisplay = document.getElementById('pomoDisplay');
const pomoLabel = document.getElementById('pomoLabel');
const pomoStartBtn = document.getElementById('pomoStart');
const pomoResetBtn = document.getElementById('pomoReset');

let pomoMode = 'work';
let pomoRemaining = 25 * 60;
let pomoRunning = false;
let pomoIntervalId = null;

function pomoDurationSec() {
  const mins = pomoMode === 'work' ? Number(pomoWorkInput.value) || 25 : Number(pomoBreakInput.value) || 5;
  return mins * 60;
}

function renderPomoDisplay() {
  const m = Math.floor(pomoRemaining / 60);
  const s = pomoRemaining % 60;
  pomoDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  pomoLabel.textContent = pomoMode === 'work' ? 'Work' : 'Break';
  pomoStartBtn.textContent = pomoRunning ? 'Pause' : 'Start';
}

function resetPomo() {
  clearInterval(pomoIntervalId);
  pomoRunning = false;
  pomoRemaining = pomoDurationSec();
  renderPomoDisplay();
}

function tickPomo() {
  pomoRemaining--;
  if (pomoRemaining <= 0) {
    clearInterval(pomoIntervalId);
    pomoRunning = false;
    notify(pomoMode === 'work' ? 'Work session done' : 'Break over', pomoMode === 'work' ? 'Take a break.' : 'Back to work.');
    pomoMode = pomoMode === 'work' ? 'break' : 'work';
    pomoRemaining = pomoDurationSec();
    renderPomoDisplay();
    return;
  }
  renderPomoDisplay();
}

pomoStartBtn.addEventListener('click', () => {
  if (pomoRunning) {
    clearInterval(pomoIntervalId);
    pomoRunning = false;
  } else {
    pomoRunning = true;
    pomoIntervalId = setInterval(tickPomo, 1000);
  }
  renderPomoDisplay();
});

pomoResetBtn.addEventListener('click', resetPomo);

[pomoWorkInput, pomoBreakInput].forEach((input) => {
  input.addEventListener('change', () => {
    store.pomodoro = { workMin: Number(pomoWorkInput.value) || 25, breakMin: Number(pomoBreakInput.value) || 5 };
    persist('saving...');
    if (!pomoRunning) resetPomo();
  });
});

// ---------- Countdowns ----------
const countdownList = document.getElementById('countdownList');
const countdownBadge = document.getElementById('countdownBadge');

function renderCountdowns() {
  countdownBadge.textContent = store.countdowns.length;
  if (store.countdowns.length === 0) {
    countdownList.innerHTML = '<div class="empty-state">No countdowns yet.</div>';
    return;
  }
  const sorted = [...store.countdowns].sort((a, b) => daysUntil(a.targetDate) - daysUntil(b.targetDate));
  countdownList.innerHTML = '';
  sorted.forEach((c) => {
    const idx = store.countdowns.indexOf(c);
    const n = daysUntil(c.targetDate);
    const unit = n === 0 ? 'Today!' : (n === 1 ? 'day left' : n === -1 ? 'day ago' : n > 0 ? 'days left' : 'days ago');
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <div class="countdown-entry">
        <div class="countdown-days">${n === 0 ? '★' : Math.abs(n)}<span class="unit">${unit}</span></div>
        <div class="countdown-info">
          <div class="countdown-label">${escapeHtml(c.label)}</div>
          <div class="countdown-date">${c.targetDate}</div>
        </div>
        <button class="small danger" data-idx="${idx}">Delete</button>
      </div>
    `;
    countdownList.appendChild(div);
  });
}

document.getElementById('addCountdownBtn').addEventListener('click', () => {
  const label = document.getElementById('countdownLabel').value.trim();
  const targetDate = document.getElementById('countdownDate').value;
  if (!label || !targetDate) return;
  store.countdowns.push({ id: uid(), label, targetDate });
  renderCountdowns();
  persist('saving countdown...');
  document.getElementById('countdownLabel').value = '';
  document.getElementById('countdownDate').value = '';
});

countdownList.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-idx]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  store.countdowns.splice(idx, 1);
  renderCountdowns();
  persist('saving...');
});

// ---------- Calendar ----------
const calState = { view: 'day', anchor: new Date() };
const eventAllDay = document.getElementById('eventAllDay');
const eventStart = document.getElementById('eventStart');
const eventEnd = document.getElementById('eventEnd');

document.getElementById('eventDate').value = dateKey;

eventAllDay.addEventListener('change', () => {
  eventStart.disabled = eventAllDay.checked;
  eventEnd.disabled = eventAllDay.checked;
});

document.getElementById('addEventBtn').addEventListener('click', () => {
  const title = document.getElementById('eventTitle').value.trim();
  const date = document.getElementById('eventDate').value;
  if (!title || !date) return;
  const allDay = eventAllDay.checked;
  store.events.push({
    id: uid(),
    title,
    date,
    startTime: allDay ? '' : eventStart.value,
    endTime: allDay ? '' : eventEnd.value,
    allDay
  });
  renderCalendar();
  persist('saving event...');
  document.getElementById('eventTitle').value = '';
  eventStart.value = '';
  eventEnd.value = '';
  eventAllDay.checked = false;
  eventStart.disabled = false;
  eventEnd.disabled = false;
});

function eventsOn(dateStr) {
  return store.events.filter(ev => ev.date === dateStr).sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });
}

function fmtEventTime(ev) {
  if (ev.allDay) return 'All day';
  const start = fmtTimeDisplay(ev.startTime);
  const end = fmtTimeDisplay(ev.endTime);
  return end ? `${start} – ${end}` : start;
}

function eventEntryHtml(ev) {
  const idx = store.events.indexOf(ev);
  return `
    <div class="entry">
      <div class="entry-top">
        <div class="entry-name">${escapeHtml(ev.title)}</div>
        <div class="entry-time">${fmtEventTime(ev)}</div>
      </div>
      <div class="entry-actions"><button class="small danger" data-idx="${idx}">Delete</button></div>
    </div>
  `;
}

function setActiveView(view) {
  calState.view = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
}

document.querySelectorAll('.view-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setActiveView(btn.dataset.view);
    renderCalendar();
  });
});

document.getElementById('calPrev').addEventListener('click', () => navigateCal(-1));
document.getElementById('calNext').addEventListener('click', () => navigateCal(1));
document.getElementById('calToday').addEventListener('click', () => {
  calState.anchor = new Date();
  renderCalendar();
});

function navigateCal(dir) {
  const a = calState.anchor;
  if (calState.view === 'month') {
    calState.anchor = new Date(a.getFullYear(), a.getMonth() + dir, 1);
  } else if (calState.view === 'week') {
    calState.anchor = new Date(a.getFullYear(), a.getMonth(), a.getDate() + dir * 7);
  } else {
    calState.anchor = new Date(a.getFullYear(), a.getMonth(), a.getDate() + dir);
  }
  renderCalendar();
}

document.getElementById('calendarBody').addEventListener('click', (e) => {
  const delBtn = e.target.closest('button[data-idx]');
  if (delBtn) {
    const idx = parseInt(delBtn.dataset.idx, 10);
    store.events.splice(idx, 1);
    renderCalendar();
    persist('saving...');
    return;
  }
  const cell = e.target.closest('.cal-cell');
  if (cell) {
    const [y, m, dd] = cell.dataset.date.split('-').map(Number);
    calState.anchor = new Date(y, m - 1, dd);
    setActiveView('day');
    renderCalendar();
  }
});

function renderCalendar() {
  const body = document.getElementById('calendarBody');
  const label = document.getElementById('calLabel');
  body.innerHTML = '';

  if (calState.view === 'month') {
    const anchor = calState.anchor;
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    label.textContent = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay();
    const gridStart = new Date(year, month, 1 - startDay);

    const weekdays = document.createElement('div');
    weekdays.className = 'cal-weekdays';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((w) => {
      const el = document.createElement('div');
      el.textContent = w;
      weekdays.appendChild(el);
    });
    body.appendChild(weekdays);

    const grid = document.createElement('div');
    grid.className = 'cal-grid';
    const today = new Date();
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const dStr = ymd(d);
      const cell = document.createElement('div');
      cell.className = 'cal-cell' + (d.getMonth() !== month ? ' other-month' : '') + (isSameDay(d, today) ? ' today' : '');
      cell.dataset.date = dStr;
      const dayEvents = eventsOn(dStr);
      cell.innerHTML = `<div class="cal-daynum">${d.getDate()}</div>` +
        dayEvents.slice(0, 3).map(ev => `<div class="cal-event">${escapeHtml(ev.title)}</div>`).join('') +
        (dayEvents.length > 3 ? `<div class="cal-event">+${dayEvents.length - 3} more</div>` : '');
      grid.appendChild(cell);
    }
    body.appendChild(grid);
  } else if (calState.view === 'week') {
    const anchor = calState.anchor;
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - anchor.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const end = days[6];
    label.textContent = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

    days.forEach((d) => {
      const dStr = ymd(d);
      const dayEvents = eventsOn(dStr);
      const section = document.createElement('div');
      section.className = 'agenda-day';
      const header = document.createElement('div');
      header.className = 'agenda-day-header';
      header.textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      section.appendChild(header);
      if (dayEvents.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.style.padding = '12px 0';
        empty.textContent = 'No events.';
        section.appendChild(empty);
      } else {
        section.innerHTML += dayEvents.map(eventEntryHtml).join('');
      }
      body.appendChild(section);
    });
  } else {
    const d = calState.anchor;
    const dStr = ymd(d);
    label.textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const dayEvents = eventsOn(dStr);
    const section = document.createElement('div');
    section.className = 'agenda-day';
    section.innerHTML = dayEvents.length === 0
      ? '<div class="empty-state">No events for this day.</div>'
      : dayEvents.map(eventEntryHtml).join('');
    body.appendChild(section);
  }
}

// ---------- Export / Import ----------
document.getElementById('exportBtn').addEventListener('click', async () => {
  const result = await window.quickNote.exportBackup(store);
  if (!result.canceled) {
    statusText.textContent = 'Backup exported';
  }
});

document.getElementById('importBtn').addEventListener('click', async () => {
  const result = await window.quickNote.importBackup();
  if (result.canceled) return;
  const data = result.data;

  if (data && data.days) {
    store.days = Object.assign({}, store.days, data.days);
    if (Array.isArray(data.countdowns)) store.countdowns = data.countdowns;
    if (Array.isArray(data.events)) store.events = data.events;
    if (Array.isArray(data.reminders)) store.reminders = data.reminders;
    if (data.pomodoro) store.pomodoro = data.pomodoro;
  } else if (data && (typeof data.notes === 'string' || Array.isArray(data.calls) || Array.isArray(data.todos))) {
    const importDate = data.date || dateKey;
    store.days[importDate] = {
      notes: typeof data.notes === 'string' ? data.notes : '',
      calls: Array.isArray(data.calls) ? data.calls : [],
      todos: Array.isArray(data.todos) ? data.todos : []
    };
  }

  day = store.days[dateKey] || { notes: '', calls: [], todos: [] };
  store.days[dateKey] = day;

  notesArea.value = day.notes || '';
  pomoWorkInput.value = store.pomodoro.workMin;
  pomoBreakInput.value = store.pomodoro.breakMin;
  resetPomo();
  renderCalls();
  renderTodos();
  renderReminders();
  renderCountdowns();
  renderCalendar();

  await window.quickNote.save(store);
  statusText.textContent = 'Import complete';
});

// ---------- Startup ----------
(async () => {
  store = await window.quickNote.load();
  day = store.days[dateKey] || { notes: '', calls: [], todos: [] };
  store.days[dateKey] = day;

  notesArea.value = day.notes || '';
  pomoWorkInput.value = store.pomodoro.workMin;
  pomoBreakInput.value = store.pomodoro.breakMin;
  pomoRemaining = pomoDurationSec();
  renderPomoDisplay();

  renderCalls();
  renderTodos();
  renderReminders();
  renderCountdowns();
  renderCalendar();

  statusText.textContent = 'Saved';
  checkReminders();
})();
