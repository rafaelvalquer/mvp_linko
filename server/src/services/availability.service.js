export function buildSlots({ dateISO, availability, durationMin }) {
  // dateISO: "2026-02-09" (local date)
  const [y, m, d] = dateISO.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const weekday = day.getUTCDay(); // ok p/ MVP (ajustar timezone depois)

  if (!availability.days.includes(weekday)) return [];

  const [sh, sm] = availability.startHour.split(":").map(Number);
  const [eh, em] = availability.endHour.split(":").map(Number);

  const start = new Date(Date.UTC(y, m - 1, d, sh, sm));
  const end = new Date(Date.UTC(y, m - 1, d, eh, em));

  const slots = [];
  for (
    let t = start.getTime();
    t + durationMin * 60000 <= end.getTime();
    t += durationMin * 60000
  ) {
    slots.push({
      startAt: new Date(t).toISOString(),
      endAt: new Date(t + durationMin * 60000).toISOString(),
    });
  }
  return slots;
}
