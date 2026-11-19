document.getElementById('status').textContent = 'Please connect through the secure Deriv sign-in.';
const link = document.createElement('a'); link.href = '/api/deriv/login'; link.textContent = 'Connect Deriv'; document.body.append(link);
