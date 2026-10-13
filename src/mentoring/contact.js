// Keep the contact chooser available even when the live budget service is offline.
export function setupContact() {
  const trigger = document.querySelector('#contact-nicolas');
  const dialog = document.querySelector('#contact-dialog');
  const address = document.querySelector('#contact-email');
  const status = document.querySelector('#contact-status');
  trigger.addEventListener('click', event => {
    event.preventDefault();
    status.textContent = '';
    dialog.showModal();
  });
  document.querySelector('#copy-contact-email').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(address.value);
      status.textContent = 'Email address copied.';
    } catch {
      address.focus();
      address.select();
      address.setSelectionRange(0, address.value.length);
      status.textContent = 'Select and copy the email address above.';
    }
  });
}
