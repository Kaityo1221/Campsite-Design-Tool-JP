(() => {
  'use strict';

  const STORAGE_KEY = 'campsiteWorkflowResumeV1';
  const VERSION = 1;

  const STEP_LABELS = {
    prepare: '準備',
    csv: 'CSV読込',
    kmz: 'KMZ生成',
    mymaps: 'My Maps設計',
    'finished-kmz': '完成KMZ読込',
    distance: '距離確認',
    check: '提出前確認'
  };

  const TAB_LABELS = {
    tool: 'キャンプサイト作成',
    howto: '使い方',
    script: 'スクリプト導入',
    guide: '設計ガイド',
    distance: '距離チェック',
    check: 'チェックリスト',
    'circle-tools': '円だけ生成',
    'deduplicate-poi': '重複POI整理'
  };

  let isRestoring = false;
  let resumeCard = null;

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const state = JSON.parse(raw);
      if (!state || state.version !== VERSION) return null;
      if (!state.updatedAt) return null;

      return state;
    } catch (_) {
      return null;
    }
  }

  function writeState(patch) {
    if (isRestoring) return;

    const current = readState() || { version: VERSION };
    const next = {
      ...current,
      ...patch,
      version: VERSION,
      updatedAt: Date.now()
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}

    renderResumeCard();
  }

  function clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function getActiveWorkflowStep() {
    return document.querySelector('.workflow-step.active')?.dataset.workflowStep || null;
  }

  function getModeLabel(mode) {
    if (mode === 'custom') return '自作CSV';
    if (mode === 'extracted') return '抽出済みCSV';
    if (mode === 'wayfarer') return 'Wayfarer Map';
    return '';
  }

  function describeState(state) {
    const step = STEP_LABELS[state.workflowStep] || '作業途中';
    const tab = TAB_LABELS[state.lastTab] || '';
    const mode = getModeLabel(state.mode);

    if (tab && mode) return `${step}・${tab}（${mode}）`;
    if (tab) return `${step}・${tab}`;
    if (mode) return `${step}（${mode}）`;
    return step;
  }

  function needsFileReselection(state) {
    return ['csv', 'kmz', 'mymaps', 'finished-kmz', 'distance', 'check']
      .includes(state.workflowStep);
  }

  function ensureStyles() {
    if (document.getElementById('workflowResumeStyles')) return;

    const style = document.createElement('style');
    style.id = 'workflowResumeStyles';
    style.textContent = `
      .workflow-resume-card {
        position: absolute;
        z-index: 40;
        top: max(14px, calc(env(safe-area-inset-top) + 8px));
        left: 50%;
        width: min(92vw, 430px);
        transform: translateX(-50%);
        box-sizing: border-box;
        padding: 13px;
        border: 1px solid rgba(186,230,253,.74);
        border-radius: 16px;
        background: rgba(8,15,30,.90);
        box-shadow: 0 14px 40px rgba(2,6,23,.38), inset 0 1px 0 rgba(255,255,255,.08);
        color: #f8fafc;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }

      .workflow-resume-head {
        display: flex;
        align-items: center;
        gap: 9px;
        margin-bottom: 10px;
      }

      .workflow-resume-sheep {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        flex: 0 0 auto;
        border-radius: 12px;
        background: rgba(56,189,248,.13);
        font-size: 21px;
      }

      .workflow-resume-copy {
        min-width: 0;
      }

      .workflow-resume-copy strong {
        display: block;
        color: #f8fafc;
        font-size: 13px;
        line-height: 1.4;
      }

      .workflow-resume-copy small {
        display: block;
        margin-top: 2px;
        color: #bae6fd;
        font-size: 10px;
        font-weight: 800;
        line-height: 1.45;
      }

      .workflow-resume-note {
        margin: 0 0 10px;
        color: #94a3b8;
        font-size: 10px;
        line-height: 1.5;
      }

      .workflow-resume-actions {
        display: grid;
        grid-template-columns: 1.35fr 1fr;
        gap: 8px;
      }

      .workflow-resume-actions button {
        min-height: 40px;
        padding: 9px 11px;
        border-radius: 11px;
        font: inherit;
        font-size: 11px;
        font-weight: 900;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      .workflow-resume-continue {
        border: 1px solid rgba(125,211,252,.72);
        background: linear-gradient(135deg, rgba(37,99,235,.88), rgba(124,58,237,.82));
        color: #fff;
        box-shadow: 0 7px 18px rgba(37,99,235,.25);
      }

      .workflow-resume-new {
        border: 1px solid rgba(148,163,184,.40);
        background: rgba(30,41,59,.88);
        color: #e2e8f0;
      }

      @media (max-width: 520px) {
        .workflow-resume-card {
          top: max(10px, calc(env(safe-area-inset-top) + 6px));
          padding: 11px;
          border-radius: 14px;
        }

        .workflow-resume-head {
          margin-bottom: 8px;
        }

        .workflow-resume-sheep {
          width: 33px;
          height: 33px;
          font-size: 19px;
        }

        .workflow-resume-actions button {
          min-height: 38px;
          padding: 8px 7px;
          font-size: 10px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function renderResumeCard() {
    const openingWrap = document.querySelector('.opening-scene-wrap');
    if (!openingWrap) return;

    const state = readState();

    if (!state) {
      resumeCard?.remove();
      resumeCard = null;
      return;
    }

    ensureStyles();

    if (!resumeCard || !resumeCard.isConnected) {
      resumeCard = document.createElement('div');
      resumeCard.className = 'workflow-resume-card';
      resumeCard.setAttribute('role', 'region');
      resumeCard.setAttribute('aria-label', '前回の作業を再開');
      openingWrap.appendChild(resumeCard);
    }

    const fileNote = needsFileReselection(state)
      ? '<p class="workflow-resume-note">※ CSV・KMZなどのファイルは、再開後に端末からもう一度選択してください。</p>'
      : '';

    resumeCard.innerHTML = `
      <div class="workflow-resume-head">
        <span class="workflow-resume-sheep" aria-hidden="true">🐏</span>
        <span class="workflow-resume-copy">
          <strong>前回のつづき、覚えています。</strong>
          <small>${describeState(state)}</small>
        </span>
      </div>
      ${fileNote}
      <div class="workflow-resume-actions">
        <button type="button" class="workflow-resume-continue">▶ 前回のつづきから</button>
        <button type="button" class="workflow-resume-new">＋ 新しく始める</button>
      </div>
    `;

    resumeCard.querySelector('.workflow-resume-continue')
      ?.addEventListener('click', resumePreviousWork);

    resumeCard.querySelector('.workflow-resume-new')
      ?.addEventListener('click', startNewWork);
  }

  function startNewWork() {
    clearState();
    window._campsiteCsvMode = null;
    resumeCard?.remove();
    resumeCard = null;

    if (typeof window.openCampsiteStartModal === 'function') {
      window.openCampsiteStartModal();
    }
  }

  function restoreTabAndMode(state) {
    const tabId = state.lastTab || 'tool';

    if (typeof window.openTab === 'function') {
      window.openTab(tabId);
    }

    if (state.mode && typeof window.applyCampsiteCsvMode === 'function') {
      window._campsiteCsvMode = state.mode;
      window.applyCampsiteCsvMode(state.mode);
    }

    if (state.workflowStep && typeof window.setWorkflowStep === 'function') {
      window.setWorkflowStep(state.workflowStep);
    }
  }

  function resumePreviousWork() {
    const state = readState();
    if (!state) return;

    isRestoring = true;

    if (typeof window.startAdventure === 'function') {
      window.startAdventure();
    }

    window.setTimeout(() => {
      try {
        if (state.workflowStep === 'mymaps') {
          restoreTabAndMode({ ...state, lastTab: 'tool' });

          if (typeof window.openReturnModal === 'function') {
            window.openReturnModal();
          }
        } else {
          restoreTabAndMode(state);
        }
      } finally {
        isRestoring = false;
      }
    }, 430);
  }

  function wrapGlobalFunction(name, after) {
    const original = window[name];
    if (typeof original !== 'function' || original.__workflowResumeWrapped) return;

    const wrapped = function (...args) {
      const result = original.apply(this, args);
      after(args, result);
      return result;
    };

    wrapped.__workflowResumeWrapped = true;
    wrapped.__workflowResumeOriginal = original;
    window[name] = wrapped;
  }

  function installHooks() {
    wrapGlobalFunction('openTab', args => {
      const tabId = args[0];
      if (!tabId) return;

      window.requestAnimationFrame(() => {
        writeState({
          lastTab: tabId,
          workflowStep: getActiveWorkflowStep() || undefined,
          mode: window._campsiteCsvMode || undefined
        });
      });
    });

    wrapGlobalFunction('selectCampsiteCsvMode', args => {
      const mode = args[0];
      if (!mode) return;

      window.setTimeout(() => {
        writeState({
          mode,
          lastTab: 'tool',
          workflowStep: 'csv'
        });
      }, 0);
    });

    wrapGlobalFunction('openKmzCompleteModal', () => {
      writeState({
        lastTab: 'tool',
        workflowStep: 'kmz',
        mode: window._campsiteCsvMode || undefined
      });
    });

    document.addEventListener('change', event => {
      if (isRestoring) return;

      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.id === 'distanceFile') {
        writeState({ lastTab: 'distance', workflowStep: 'finished-kmz' });
      }

      if (target.closest('#check')) {
        writeState({ lastTab: 'check', workflowStep: 'check' });
      }
    }, true);

    document.addEventListener('click', event => {
      if (isRestoring) return;

      const target = event.target instanceof Element
        ? event.target.closest('button, a')
        : null;

      if (!target) return;

      if (target.matches('.kmz-complete-action-button.maps')) {
        writeState({
          lastTab: 'tool',
          workflowStep: 'mymaps',
          mode: window._campsiteCsvMode || undefined
        });
        return;
      }

      if (target.matches('.return-action-button.distance')) {
        writeState({ lastTab: 'distance', workflowStep: 'distance' });
        return;
      }

      if (target.matches('.return-action-button.checklist')) {
        writeState({ lastTab: 'check', workflowStep: 'check' });
        return;
      }

      const onclick = target.getAttribute('onclick') || '';
      if (onclick.includes('runDistanceCheck')) {
        writeState({ lastTab: 'distance', workflowStep: 'distance' });
      }
    }, true);

    const workflowNav = document.querySelector('.workflow-nav');
    if (workflowNav) {
      const observer = new MutationObserver(() => {
        if (isRestoring) return;
        const activeStep = getActiveWorkflowStep();
        if (activeStep) writeState({ workflowStep: activeStep });
      });

      observer.observe(workflowNav, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  function setup() {
    ensureStyles();
    installHooks();
    renderResumeCard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
