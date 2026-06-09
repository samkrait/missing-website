const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = window.SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_STATE_TABLE = 'shared_state';
const SUPABASE_COMMENTS_TABLE = 'comments';
const STATE_ROW_ID = 1;
const BUTTON_LOCK_MS = 5 * 60 * 1000;

const state = {
  person1: { count: 0, lastClick: null, comments: [] },
  person2: { count: 0, lastClick: null, comments: [] },
};

const elements = {
  person1: {
    button: document.getElementById('person1-button'),
    count: document.getElementById('person1-count'),
    cooldown: document.getElementById('person1-cooldown'),
    lastmsg: document.getElementById('person1-lastmsg'),
    form: document.getElementById('person1-form'),
    input: document.getElementById('person1-input'),
    comments: document.getElementById('person1-comments'),
    showButton: document.getElementById('person1-show-comments'),
  },
  person2: {
    button: document.getElementById('person2-button'),
    count: document.getElementById('person2-count'),
    cooldown: document.getElementById('person2-cooldown'),
    lastmsg: document.getElementById('person2-lastmsg'),
    form: document.getElementById('person2-form'),
    input: document.getElementById('person2-input'),
    comments: document.getElementById('person2-comments'),
    showButton: document.getElementById('person2-show-comments'),
  },
};

const commentsLoaded = { person1: false, person2: false };

const supabaseHeaders = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

function formatTimestamp(date) {
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function createCommentElement(comment) {
  const commentEl = document.createElement('div');
  commentEl.className = 'comment-item';

  const body = document.createElement('p');
  body.textContent = comment.text;

  const meta = document.createElement('div');
  meta.className = 'comment-meta';
  const timestamp = comment.inserted_at ? new Date(comment.inserted_at) : new Date();
  meta.textContent = `Posted on ${formatTimestamp(timestamp)}`;

  commentEl.appendChild(body);
  commentEl.appendChild(meta);
  return commentEl;
}

function renderComments(person) {
  elements[person].comments.innerHTML = '';
  state[person].comments.forEach((comment) => {
    elements[person].comments.appendChild(createCommentElement(comment));
  });
}

function updateCount(person) {
  elements[person].count.textContent = state[person].count;
}

function disableButton(person) {
  elements[person].button.disabled = true;
}

function enableButton(person) {
  elements[person].button.disabled = false;
  elements[person].cooldown.textContent = '';
}

function updateCooldown(person) {
  const lastClick = state[person].lastClick;
  if (!lastClick) {
    enableButton(person);
    updateLastClickMessage(person);
    return;
  }

  const elapsed = Date.now() - lastClick;
  // if elapsed >= lock duration, allow clicking again but keep lastClick timestamp
  if (elapsed >= BUTTON_LOCK_MS) {
    enableButton(person);
    updateLastClickMessage(person);
    return;
  }

  const remaining = BUTTON_LOCK_MS - elapsed;
  disableButton(person);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  elements[person].cooldown.textContent = `Next click in ${minutes}:${seconds.toString().padStart(2, '0')} minutes`;
  updateLastClickMessage(person);
}

const displayNames = {
  person1: 'Person1',
  person2: 'Person2',
};

function updateLastClickMessage(person) {
  const el = elements[person].lastmsg;
  if (!el) return;
  const last = state[person].lastClick;
  const own = person === 'person1' ? 'Prachu' : 'Kudler';
  const other = person === 'person1' ? 'Kudler' : 'Prachu';

  if (!last) {
    // show 0 mins when no click recorded
    el.textContent = `${own} did not miss ${other} for 0 mins`;
    // neutral color when no record
    el.style.color = 'var(--muted)';
    return;
  }

  const elapsed = Date.now() - last;
  const minutes = Math.floor(elapsed / 60000);
  el.textContent = `${own} did not miss ${other} for ${minutes} mins`;

  // Color interpolation from green -> red over 0..120 minutes.
  // 0 minutes => green (#10b981). 120+ minutes => red (#ef4444).
  const MAX_MINUTES = 120;
  const ratio = Math.min(elapsed / (MAX_MINUTES * 60000), 1);

  const green = { r: 16, g: 185, b: 129 }; // #10b981
  const red = { r: 239, g: 68, b: 68 }; // #ef4444

  // Interpolate from green to red as time increases
  const r = Math.round(green.r + (red.r - green.r) * ratio);
  const g = Math.round(green.g + (red.g - green.g) * ratio);
  const b = Math.round(green.b + (red.b - green.b) * ratio);
  el.style.color = `rgb(${r}, ${g}, ${b})`;

  // Add a sad tear emoji for each 30 minutes elapsed
  const tearCount = Math.floor(minutes / 30);
  if (tearCount > 0) {
    const tears = Array(tearCount).fill('😢').join(' ');
    el.textContent = `${el.textContent} ${tears}`;
  }
}

async function ensureStateRow() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${SUPABASE_STATE_TABLE}?id=eq.${STATE_ROW_ID}&select=*`,
    { headers: supabaseHeaders }
  );
  const rows = await response.json();

  if (!rows.length) {
    await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_STATE_TABLE}`, {
      method: 'POST',
      headers: { ...supabaseHeaders, Prefer: 'return=representation' },
      body: JSON.stringify([
        {
          id: STATE_ROW_ID,
          person1_count: 0,
          person2_count: 0,
          person1_last_click: null,
          person2_last_click: null,
        },
      ]),
    });
  }
}

async function fetchSharedState() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${SUPABASE_STATE_TABLE}?id=eq.${STATE_ROW_ID}&select=*`,
    { headers: supabaseHeaders }
  );

  if (!response.ok) {
    throw new Error('Failed to load shared state');
  }

  const rows = await response.json();
  if (!rows.length) {
    throw new Error('Shared state row not found');
  }

  const row = rows[0];
  console.log('fetched shared_state row:', row);
  state.person1.count = Number(row.person1_count || 0);
  state.person2.count = Number(row.person2_count || 0);
  state.person1.lastClick = row.person1_last_click ? new Date(row.person1_last_click).getTime() : null;
  state.person2.lastClick = row.person2_last_click ? new Date(row.person2_last_click).getTime() : null;
}

async function fetchComments(person) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${SUPABASE_COMMENTS_TABLE}?person=eq.${person}&order=inserted_at.desc&select=text,inserted_at`,
    { headers: supabaseHeaders }
  );

  if (!response.ok) {
    throw new Error(`Failed to load comments for ${person}`);
  }

  return await response.json();
}

async function refreshData() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.warn('Supabase config not set. Fill in supabase-config.js.');
    return;
  }

  await ensureStateRow();
  await fetchSharedState();
  updateCount('person1');
  updateCount('person2');
  // Comments are loaded on demand by clicking the Show Comments button.
  updateCooldown('person1');
  updateCooldown('person2');
}

/* comments are loaded on refresh; deferred loading removed */

async function vote(person) {
  const remaining = state[person].lastClick ? BUTTON_LOCK_MS - (Date.now() - state[person].lastClick) : 0;
  if (remaining > 0) {
    return;
  }

  const fieldCount = person === 'person1' ? 'person1_count' : 'person2_count';
  const fieldLastClick = person === 'person1' ? 'person1_last_click' : 'person2_last_click';

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_STATE_TABLE}?id=eq.${STATE_ROW_ID}`, {
    method: 'PATCH',
    headers: { ...supabaseHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({
      [fieldCount]: state[person].count + 1,
      [fieldLastClick]: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    console.error('vote PATCH failed', response.status, await response.text());
    return;
  }

  // Optimistically update local state so the UI reflects the change immediately
  state[person].count = state[person].count + 1;
  state[person].lastClick = Date.now();
  updateCount(person);
  updateLastClickMessage(person);

  await refreshData();
}


async function postComment(person, text) {
  await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_COMMENTS_TABLE}`, {
    method: 'POST',
    headers: { ...supabaseHeaders, Prefer: 'return=representation' },
    body: JSON.stringify([{ person, text, inserted_at: new Date().toISOString() }]),
  });

  // After posting, if comments are already loaded for this person, refresh the list.
  if (commentsLoaded[person]) {
    state[person].comments = await fetchComments(person);
    renderComments(person);
  } else {
    // If comments weren't loaded yet, load them now and show the panel.
    await loadComments(person);
  }
}

async function loadComments(person) {
  try {
    const comments = await fetchComments(person);
    state[person].comments = comments;
    commentsLoaded[person] = true;
    renderComments(person);
    elements[person].comments.classList.remove('hidden');
    // update show button label
    if (elements[person].showButton) elements[person].showButton.textContent = 'Hide comments';
  } catch (err) {
    console.error('Failed to load comments for', person, err);
  }
}

function toggleCommentsVisibility(person) {
  const el = elements[person].comments;
  if (!el) return;
  const isHidden = el.classList.contains('hidden');
  if (isHidden) {
    // If not yet loaded, load first
    if (!commentsLoaded[person]) {
      loadComments(person);
    } else {
      el.classList.remove('hidden');
      if (elements[person].showButton) elements[person].showButton.textContent = 'Hide comments';
    }
  } else {
    el.classList.add('hidden');
    if (elements[person].showButton) elements[person].showButton.textContent = 'Show comments';
  }
}

function setupShowComments(person) {
  const btn = elements[person].showButton;
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleCommentsVisibility(person);
  });
}

function setupCounter(person) {
  elements[person].button.addEventListener('click', async () => {
    try {
      await vote(person);
    } catch (error) {
      console.error(error);
    }
  });
}

function setupComments(person) {
  elements[person].form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = elements[person].input.value.trim();
    if (!text) {
      return;
    }

    try {
      await postComment(person, text);
      elements[person].input.value = '';
    } catch (error) {
      console.error(error);
    }
  });
}

function startCooldownTimer(person) {
  updateCooldown(person);
  return setInterval(() => updateCooldown(person), 1000);
}

async function initialize() {
  ['person1', 'person2'].forEach((person) => {
    setupCounter(person);
    setupComments(person);
    setupShowComments(person);
    startCooldownTimer(person);
    // hide comment lists by default to speed up initial load
    if (elements[person].comments) elements[person].comments.classList.add('hidden');
    if (elements[person].showButton) elements[person].showButton.textContent = 'Show comments';
  });

  try {
    await refreshData();
  } catch (error) {
    console.error(error);
  }
}

initialize();
