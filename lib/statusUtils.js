export function getStatusBadgeStyle(status) {
  if (!status) return 'bg-white/10 text-white/70 border-white/20';
  const s = status.toLowerCase();

  if (s.includes('pack')) {
    return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
  }
  if (s.includes('plats') || s.includes('location')) {
    return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  }
  if (s.includes('bekräft') || s.includes('confirm')) {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  }
  if (s.includes('förslag') || s.includes('pend')) {
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  }
  if (s.includes('förfråg') || s.includes('inquir')) {
    return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
  }
  if (s.includes('retur') || s.includes('return')) {
    return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
  }
  if (s.includes('lager') || s.includes('ej check')) {
    return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
  }
  if (s.includes('koncept') || s.includes('concept')) {
    return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  }
  if (s.includes('annull') || s.includes('cancel')) {
    return 'bg-red-500/20 text-red-300 border-red-500/30';
  }

  return 'bg-white/10 text-white/70 border-white/20';
}
