import { useEffect, useState } from 'react';

export function useLatestActivity(timestamps: (string | null)[]): {
  isActive: boolean;
  secondsAgo: number;
  label: string;
} {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const validTimestamps = timestamps.filter((t): t is string => t !== null);
  const latest = validTimestamps.length > 0
    ? Math.max(...validTimestamps.map((t) => new Date(t).getTime()))
    : 0;

  const secondsAgo = latest > 0 ? Math.floor((now - latest) / 1000) : Infinity;
  const isActive = secondsAgo <= 60;

  let label: string;
  if (secondsAgo === Infinity || !latest) {
    label = 'Aguardando';
  } else if (secondsAgo < 60) {
    label = `há ${secondsAgo}s`;
  } else if (secondsAgo < 3600) {
    label = `há ${Math.floor(secondsAgo / 60)}min`;
  } else {
    label = `há ${Math.floor(secondsAgo / 3600)}h`;
  }

  return { isActive, secondsAgo, label };
}