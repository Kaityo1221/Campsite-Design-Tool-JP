/* Chairman-only viewer for CA geo/IP block diagnostics. */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://azkshxjgsbtjgwbapcfw.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rWbeIqdWJJHHBtphER8bdg__CaS_xGK';
  const client = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const section = document.getElementById('geoLogSection');
  const statusEl = document.getElementById('geoLogStatus');
  const listEl = document.getElementById('geoLogList');
  const refreshButton = document.getElementById('geoLogRefreshButton');

  if (!client || !section || !statusEl || !listEl || !refreshButton) return;

  function formatTime(value) {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('ja-JP', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Tokyo'
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function reasonLabel(reason) {
    return ({
      foreign_ip: '海外IP',
      gps_overseas: '位置情報が海外',
      gps_low_accuracy: '位置情報の精度不足',
      location_permission_denied: '位置情報拒否',
      ip_country_unknown: 'IP国判定不能',
      test_bypass: 'テスト続行'
    })[reason] || reason || '-';
  }

  function gpsLabel(result) {
    return ({
      japan: '日本国内',
      japan_buffer_500m: '日本国内（海岸500m猶予）',
      overseas: '海外',
      permission_denied: '取得拒否',
      test_bypass: 'テスト続行'
    })[result] || result || '-';
  }

  function valueOrDash(value) {
    return value === null || value === undefined || value === '' ? '-' : String(value);
  }

  function render(items) {
    listEl.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
      listEl.innerHTML = '<div class="empty">直近30日間のブロックログはありません。</div>';
      return;
    }

    for (const row of items) {
      const card = document.createElement('article');
      card.className = 'card';

      const head = document.createElement('div');
      head.className = 'card-head';

      const identity = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = row.discord_name ? `@${row.discord_name}` : 'CA';
      const sub = document.createElement('div');
      sub.className = 'sub';
      sub.textContent = `${formatTime(row.occurred_at)} / Discord ID: ${valueOrDash(row.discord_user_id)}`;
      identity.append(name, sub);

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = row.test_bypass ? 'TEST BYPASS' : (row.test_scenario ? 'TEST' : 'BLOCK');
      head.append(identity, badge);
      card.appendChild(head);

      const details = document.createElement('div');
      details.className = 'sub';
      details.style.cssText = 'margin-top:10px;line-height:1.8;font-size:13px;';
      const accuracy = row.gps_accuracy_m === null || row.gps_accuracy_m === undefined
        ? '-'
        : `${Math.round(Number(row.gps_accuracy_m))}m`;
      const coords = row.latitude === null || row.longitude === null
        ? '-'
        : `${Number(row.latitude).toFixed(6)}, ${Number(row.longitude).toFixed(6)}`;
      details.textContent = [
        `理由: ${reasonLabel(row.block_reason)}`,
        `IP国: ${valueOrDash(row.ip_country)}`,
        `位置判定: ${gpsLabel(row.gps_result)}`,
        `GPS精度: ${accuracy}`,
        `座標: ${coords}`,
        row.test_scenario ? `テスト: ${row.test_scenario}` : ''
      ].filter(Boolean).join(' / ');
      card.appendChild(details);
      listEl.appendChild(card);
    }
  }

  async function loadLogs() {
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) {
      section.classList.add('hidden');
      return;
    }

    refreshButton.disabled = true;
    statusEl.textContent = '位置判定ログを読み込んでいます…';
    try {
      const { data, error } = await client.functions.invoke('ca-geo-admin', {
        body: { action: 'list', limit: 100 }
      });
      if (error) throw error;
      section.classList.remove('hidden');
      statusEl.textContent = 'ブロック時のみ記録します。ログは30日後に自動削除されます。';
      render(data?.items || []);
    } catch (error) {
      const status = error?.context?.status;
      if (status === 401 || status === 403) {
        section.classList.add('hidden');
        return;
      }
      section.classList.remove('hidden');
      statusEl.textContent = `ログを読み込めませんでした: ${error?.message || '不明なエラー'}`;
      render([]);
    } finally {
      refreshButton.disabled = false;
    }
  }

  refreshButton.addEventListener('click', loadLogs);
  client.auth.onAuthStateChange((_event, session) => {
    if (session) setTimeout(loadLogs, 0);
    else section.classList.add('hidden');
  });
  loadLogs();
})();
