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
    form: document.getElementById('person1-form'),
    input: document.getElementById('person1-input'),
    comments: document.getElementById('person1-comments'),
  },
  person2: {
    button: document.getElementById('person2-button'),
    count: document.getElementById('person2-count'),
    cooldown: document.getElementById('person2-cooldown'),
    form: document.getElementById('person2-form'),
    input: document.getElementById('person2-input'),
    comments: document.getElementById('person2-comments'),
  },
};

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
  const timestamp = comment.timestamp ? new Date(comment.timestamp) : new Date();
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
    return;
  }

  const remaining = BUTTON_LOCK_MS - (Date.now() - lastClick);
  if (remaining <= 0) {
    state[person].lastClick = null;
    enableButton(person);
    return;
  }

  disableButton(person);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  elements[person].cooldown.textContent = `Next click in ${minutes}:${seconds.toString().padStart(2, '0')} minutes`;
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
  state.person1.comments = await fetchComments('person1');
  state.person2.comments = await fetchComments('person2');
  updateCount('person1');
  updateCount('person2');
  renderComments('person1');
  renderComments('person2');
  updateCooldown('person1');
  updateCooldown('person2');
}

async function vote(person) {
  const remaining = state[person].lastClick ? BUTTON_LOCK_MS - (Date.now() - state[person].lastClick) : 0;
  if (remaining > 0) {
    return;
  }

  const fieldCount = person === 'person1' ? 'person1_count' : 'person2_count';
  const fieldLastClick = person === 'person1' ? 'person1_last_click' : 'person2_last_click';

  await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_STATE_TABLE}?id=eq.${STATE_ROW_ID}`, {
    method: 'PATCH',
    headers: { ...supabaseHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({
      [fieldCount]: state[person].count + 1,
      [fieldLastClick]: new Date().toISOString(),
    }),
  });

  await refreshData();
}

async function postComment(person, text) {
  await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_COMMENTS_TABLE}`, {
    method: 'POST',
    headers: { ...supabaseHeaders, Prefer: 'return=representation' },
    body: JSON.stringify([{ person, text, inserted_at: new Date().toISOString() }]),
  });

  await refreshData();
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
    startCooldownTimer(person);
  });

  try {
    await refreshData();
  } catch (error) {
    console.error(error);
  }
}

initialize();
