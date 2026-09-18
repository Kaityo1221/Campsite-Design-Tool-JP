/* Route existing KMZ buttons to the PRE-CHECK workspace. */
(function () {
  "use strict";

  function relabel(scope = document) {
    scope.querySelectorAll?.("[data-ak-review]").forEach(button => {
      button.textContent = "🔍 提出前チェック";
      button.setAttribute("aria-label", "このサイトの提出前チェックを開く");
    });
  }

  document.addEventListener("click", event => {
    const button = event.target?.closest?.("[data-ak-review]");
    if (!button || !window.AdminReviewWorkspace?.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.AdminReviewWorkspace.open(button.dataset.akReview);
  }, true);

  relabel();

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes || []) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.("[data-ak-review]")) relabel(node.parentElement || document);
        else if (node.querySelector?.("[data-ak-review]")) relabel(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
