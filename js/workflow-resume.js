(() => {
  'use strict';

  const STORAGE_KEY = 'campsiteWorkflowResumeV1';

  function cleanup() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}

    document.querySelectorAll('.workflow-resume-card').forEach(card => card.remove());
    document.getElementById('workflowResumeStyles')?.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanup, { once: true });
  } else {
    cleanup();
  }
})();
