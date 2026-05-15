(function() {
  if (window.hasRemoteHandler) return;
  window.hasRemoteHandler = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'remote-action') {
      const { action, x, y, deltaX, deltaY } = message.payload;
      
      if (action === 'click') {
        simulateClick(x, y);
      } else if (action === 'scroll') {
        window.scrollBy({
            left: deltaX,
            top: deltaY,
            behavior: 'smooth'
        });
      }
    }
  });

  function simulateClick(xPercent, yPercent) {
    const x = xPercent * window.innerWidth;
    const y = yPercent * window.innerHeight;
    
    const el = document.elementFromPoint(x, y);
    if (el) {
      console.log('Simulating click on:', el);
      
      // Create and dispatch events
      const events = ['mousedown', 'mouseup', 'click'];
      events.forEach(type => {
        const ev = new MouseEvent(type, {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        });
        el.dispatchEvent(ev);
      });

      // Focus if it's an input
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
        el.focus();
      }
    }
  }
})();
