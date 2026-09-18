/** `.NET`'s `DateOnly` wire format is `yyyy-MM-dd` -- formatted from LOCAL date parts (never `toISOString().slice(0, 10)`, which would silently shift the date across a UTC day boundary for any timezone behind UTC). */
export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
