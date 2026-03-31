function getLocalDateString(dateObj = new Date()) {
  const tzOffset = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() - tzOffset).toISOString().split('T')[0];
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function calculate1RM(weight, reps) {
  if (reps <= 1) return weight;
  // Epley Formula
  return weight * (1 + (reps / 30));
}