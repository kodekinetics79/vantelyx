export const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

export const shortDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));

export const daysUntil = (value: string) => {
  const now = new Date();
  const then = new Date(value);
  return Math.ceil((then.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');
