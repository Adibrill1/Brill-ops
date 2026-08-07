'use client';

import { useEffect, useState } from 'react';

/**
 * Live countdown to a campaign's end date. Renders nothing without an end date —
 * which is the current state of Stars for Peace, since no real dates were supplied.
 */
export function Countdown({ endDate }: { endDate: string | null }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!endDate) return;
    const target = new Date(endDate).getTime();
    const tick = () => setRemaining(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  if (!endDate || remaining === null) return null;

  if (remaining <= 0) {
    return (
      <p className="text-sm font-medium text-ink-muted">
        This campaign has ended and is moving to the Archive.
      </p>
    );
  }

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  const units = [
    { value: days, label: 'days' },
    { value: hours, label: 'hours' },
    { value: minutes, label: 'min' },
    { value: seconds, label: 'sec' },
  ];

  return (
    <div className="flex gap-3" role="timer" aria-label="Time remaining in this campaign">
      {units.map((u) => (
        <div key={u.label} className="rounded-lg bg-white/10 px-3 py-2 text-center backdrop-blur">
          <p className="text-2xl font-semibold tabular-nums">{String(u.value).padStart(2, '0')}</p>
          <p className="text-[10px] uppercase tracking-wide opacity-70">{u.label}</p>
        </div>
      ))}
    </div>
  );
}
