
  // iPhone Safari recovery: keep one Receiver tab while it is alive, and open a
  // fresh one when the previous Campsite tab has been closed. Also clear the
  // previous successful-send UI before every new send attempt.
  const sendToCampsiteBeforeReceiverRecovery = sendToCampsite;
  let iphoneReceiverWindow = null;

  sendToCampsite = async function (...args) {
    if (sendWorkflowActive) {
      return sendToCampsiteBeforeReceiverRecovery.apply(this, args);
    }

    if (sendSucceeded) {
      sendSucceeded = false;
      setSendStatus('');
      scheduleRender();
    }

    const originalOpen = window.open;
    let pending;

    window.open = function (url, target, features) {
      const href = String(url || '');
      if (target !== RECEIVER_WINDOW_NAME || !href.startsWith(RECEIVER_ORIGIN)) {
        return originalOpen.apply(this, arguments);
      }

      try {
        if (iphoneReceiverWindow && !iphoneReceiverWindow.closed) {
          try { iphoneReceiverWindow.location.href = href; } catch (_) {}
          return iphoneReceiverWindow;
        }
      } catch (_) {
        iphoneReceiverWindow = null;
      }

      let handshakeId = '';
      try { handshakeId = new URL(href).searchParams.get('handshake') || ''; } catch (_) {}
      const safeHandshake = handshakeId.replace(/[^a-z0-9_-]/gi, '').slice(0, 80);
      const windowName = `${RECEIVER_WINDOW_NAME}_${safeHandshake || Date.now().toString(36)}`;

      let popup = null;
      try { popup = originalOpen.call(window, 'about:blank', windowName, features); } catch (_) {}
      if (!popup) return null;

      iphoneReceiverWindow = popup;
      try { popup.location.replace(href); }
      catch (_) {
        try { popup.location.href = href; } catch (_) {}
      }
      return popup;
    };

    try {
      pending = sendToCampsiteBeforeReceiverRecovery.apply(this, args);
    } finally {
      window.open = originalOpen;
    }

    return await pending;
  };
