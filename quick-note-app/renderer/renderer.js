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
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

const dateKey = todayKey();
const statusLine = document.getElementById('statusLine');

// The full on-disk store is keyed by date so history isn't thrown away,
// but the UI only ever shows today's entry.
let store = {};
let day = { notes: '', calls: [], todos: [] };
let saveTimer = null;

function scheduleSave(hint) {
  if (hint) statusLine.textContent = hint;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    store[dateKey] = day;
    try {
      await window.quickNote.save(store);
      statusLine.textContent = 'saved locally · ' + new Date().toLocaleTimeString();
    } catch (e) {
      console.error('Save failed:', e);
      statusLine.textContent = 'save failed — see console; use Export Backup to be safe';
    }
  }, 300);
}

document.getElementById('headerDate').textContent = todayDisplay();

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ---------- Notes ----------
const notesArea = document.getElementById('notesArea');
const saveHint = document.getElementById('saveHint');
let notesSaveTimer = null;

notesArea.addEventListener('input', () => {
  day.notes = notesArea.value;
  saveHint.textContent = 'saving...';
  clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(async () => {
    store[dateKey] = day;
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
  scheduleSave('saving call...');

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
    scheduleSave('saving...');
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

// ---------- To-Do ----------
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
  scheduleSave('saving...');
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
    scheduleSave('saving...');
  }
});

// ---------- Export / Import ----------
document.getElementById('exportBtn').addEventListener('click', async () => {
  store[dateKey] = day;
  const result = await window.quickNote.exportBackup(store);
  if (!result.canceled) {
    statusLine.textContent = 'backup exported to ' + result.filePath;
  }
});

document.getElementById('importBtn').addEventListener('click', async () => {
  const result = await window.quickNote.importBackup();
  if (result.canceled) return;
  const data = result.data;
  // Support both a full multi-day store export and an old single-day export.
  if (data && (typeof data.notes === 'string' || Array.isArray(data.calls) || Array.isArray(data.todos))) {
    const importDate = data.date || dateKey;
    store[importDate] = {
      notes: typeof data.notes === 'string' ? data.notes : '',
      calls: Array.isArray(data.calls) ? data.calls : [],
      todos: Array.isArray(data.todos) ? data.todos : []
    };
  } else if (data && typeof data === 'object') {
    store = Object.assign({}, store, data);
  }
  if (store[dateKey]) {
    day = store[dateKey];
    notesArea.value = day.notes || '';
    renderCalls();
    renderTodos();
  }
  await window.quickNote.save(store);
  statusLine.textContent = 'import complete';
});

// ---------- Startup ----------
(async () => {
  store = await window.quickNote.load();
  day = store[dateKey] || { notes: '', calls: [], todos: [] };
  notesArea.value = day.notes || '';
  renderCalls();
  renderTodos();
  const path = await window.quickNote.getPath();
  statusLine.textContent = 'saved locally to ' + path;
})();
