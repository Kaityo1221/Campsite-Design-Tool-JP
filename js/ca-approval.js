(() => {
  'use strict';

  const SUPABASE_URL = 'https://azkshxjgsbtjgwbapcfw.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rWbeIqdWJJHHBtphER8bdg__CaS_xGK';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const statusEl = document.getElementById('approvalStatus');
  const consoleEl = document.getElementById('approvalConsole');
  const loginButton = document.getElementById('discordLoginButton');
  const refreshButton = document.getElementById('refreshButton');
  const logoutButton = document.getElementById('logoutButton');
  const bootstrapBox = document.getElementById('bootstrapBox');
  const pendingList = document.getElementById('pendingList');
  const approvedList = document.getElementById('approvedList');
  const blockedList = document.getElementById('blockedList');

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function firstString(...values) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  function getDiscordIdentity(user) {
    const identities = Array.isArray(user?.identities) ? user.identities : [];
    const identity = identities.find(item => item?.provider === 'discord');
    const data = identity?.identity_data || {};
    const meta = user?.user_metadata || {};
    return {
      userId: firstString(data.provider_id, data.sub, identity?.id, meta.provider_id, meta.sub),
      name: firstString(data.user_name, data.username, meta.user_name, meta.preferred_username, meta.name, meta.full_name),
      globalName: firstString(data.global_name, data.full_name, meta.full_name, meta.name)
    };
  }

  async function signIn() {
    const redirectTo = new URL('ca-approval.html', window.location.href).href;
    const { error } = await client.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo }
    });
    if (error) setStatus(`Discordログインを開始できませんでした: ${error.message}`);
  }

  async function signOut() {
    await client.auth.signOut();
    location.reload();
  }

  async function invokeAdmin(body) {
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Discordログインが必要です');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/ca-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function formatTime(value) {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('ja-JP', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo'
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function displayName(row) {
    const globalName = String(row.discord_global_name || '').trim();
    const name = String(row.discord_name || '').trim();
    return globalName && globalName !== name ? `${globalName} (@${name})` : `@${name}`;
  }

  function statusLabel(status) {
    return ({
      pending: '承認待ち',
      approved: '利用中',
      rejected: '拒否',
      revoked: '停止中'
    })[status] || status;
  }

  function button(label, className, handler) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = label;
    el.className = className || '';
    el.addEventListener('click', handler);
    return el;
  }

  function requestCard(row) {
    const card = document.createElement('article');
    card.className = 'card';

    const head = document.createElement('div');
    head.className = 'card-head';
    const left = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = displayName(row);
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = `User ID: ${row.discord_user_id} ｜ 初回 ${formatTime(row.first_requested_at)} ｜ 最終 ${formatTime(row.last_requested_at)}`;
    left.append(name, sub);
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = statusLabel(row.status);
    head.append(left, badge);

    const actions = document.createElement('div');
    actions.className = 'actions';

    if (row.status === 'pending') {
      actions.append(
        button('許可', 'good', () => changeStatus(row.id, 'approve', displayName(row))),
        button('拒否', 'danger', () => changeStatus(row.id, 'reject', displayName(row)))
      );
    } else if (row.status === 'approved') {
      actions.append(button('利用停止', 'warn', () => changeStatus(row.id, 'revoke', displayName(row))));
    } else if (row.status === 'revoked') {
      actions.append(button('🔓 利用再開', 'good', () => changeStatus(row.id, 'restore', displayName(row))));
    } else if (row.status === 'rejected') {
      actions.append(button('再審査して許可', 'good', () => changeStatus(row.id, 'restore', displayName(row))));
    }

    card.append(head, actions);
    return card;
  }

  function renderList(container, rows) {
    container.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '対象者はいません。';
      container.appendChild(empty);
      return;
    }
    rows.forEach(row => container.appendChild(requestCard(row)));
  }

  async function loadRequests() {
    setStatus('申請一覧を読み込んでいます…');
    try {
      const payload = await invokeAdmin({ action: 'list' });
      const requests = Array.isArray(payload.requests) ? payload.requests : [];
      renderList(pendingList, requests.filter(row => row.status === 'pending'));
      renderList(approvedList, requests.filter(row => row.status === 'approved'));
      renderList(blockedList, requests.filter(row => row.status === 'rejected' || row.status === 'revoked'));
      consoleEl.classList.remove('hidden');
      refreshButton.classList.remove('hidden');
      setStatus(`管理者として認証済み：@${payload.admin}`);
    } catch (error) {
      consoleEl.classList.add('hidden');
      if (error.status === 403) {
        const { data } = await client.auth.getUser();
        const identity = getDiscordIdentity(data?.user);
        setStatus('Discordログインは成功していますが、このアカウントは承認管理者に登録されていません。');
        bootstrapBox.classList.remove('hidden');
        bootstrapBox.innerHTML = `会長登録に必要なDiscord User ID：<br><code>${identity.userId || '取得できませんでした'}</code><br><span class="muted">このIDだけを管理者リストへ登録します。</span>`;
      } else {
        setStatus(`承認画面を読み込めませんでした: ${error.message}`);
      }
    }
  }

  function emailResultMessage(result) {
    const mail = result?.approvalEmail;
    if (!mail || mail.reason === 'not_applicable') return '';
    if (mail.sent) return ' ｜ 📧 メール送信成功';
    const reasons = {
      smtp_not_configured: 'SMTP未設定',
      recipient_not_found: '宛先メールアドレス未取得',
      send_failed: '送信処理エラー'
    };
    return ` ｜ ⚠️ メール送信失敗（${reasons[mail.reason] || mail.reason || '原因不明'}）`;
  }

  async function changeStatus(requestId, action, name) {
    const labels = {
      approve: '許可',
      reject: '拒否',
      revoke: '利用停止',
      restore: '利用再開'
    };
    if (!confirm(`${name} を「${labels[action]}」にしますか？`)) return;
    setStatus(`${name} を更新しています…`);
    try {
      const result = await invokeAdmin({ action, requestId });
      await loadRequests();
      setStatus(`${name}：${labels[action]}しました${emailResultMessage(result)}`);
    } catch (error) {
      setStatus(`更新できませんでした: ${error.message}`);
    }
  }

  async function boot() {
    loginButton.addEventListener('click', signIn);
    logoutButton.addEventListener('click', signOut);
    refreshButton.addEventListener('click', loadRequests);

    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      setStatus('会長のDiscordアカウントでログインしてください。');
      loginButton.classList.remove('hidden');
      return;
    }

    logoutButton.classList.remove('hidden');
    await loadRequests();
  }

  boot().catch(error => setStatus(`初期化エラー: ${error.message}`));
})();
