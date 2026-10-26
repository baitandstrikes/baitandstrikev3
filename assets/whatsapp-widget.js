(() => {
  'use strict';

  document.querySelectorAll('[data-whatsapp-widget]').forEach(widget => {
    const hint = widget.querySelector('[data-whatsapp-hint]');
    const dismiss = widget.querySelector('[data-whatsapp-dismiss]');
    if (!hint || !dismiss) return;
    dismiss.addEventListener('click', () => {
      hint.hidden = true;
    });
  });
})();
