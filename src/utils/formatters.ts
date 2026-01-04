/**
 * Formats a date string into DD/MM/YYYY format.
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Fecha inválida';

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Normalizes a string for comparison.
 */
export function normalizeStringForComparison(str?: any): string {
  if (str === undefined || str === null) return '';
  if (typeof str === 'boolean') return str ? 'true' : 'false';

  const cleanValue = cleanDbValue(str);

  return String(cleanValue)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Returns visual style configuration based on the specialty area.
 */
export function getEspecialidadClasses(especialidad?: string | null) {
  const normalized = normalizeStringForComparison(especialidad);

  let config = {
    tag: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    gradient: 'from-slate-400 to-slate-600',
    headerBg: 'bg-slate-50 dark:bg-slate-800',
    headerText: 'text-slate-800 dark:text-slate-100',
    dot: 'bg-slate-400',
    leftBorder: 'border-l-slate-400 dark:border-l-slate-600'
  };

  if (normalized.includes('clinica')) {
    config = {
      tag: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
      gradient: 'from-emerald-400 to-teal-600',
      headerBg: 'bg-emerald-50 dark:bg-emerald-900/20',
      headerText: 'text-emerald-800 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      leftBorder: 'border-l-emerald-500 dark:border-l-emerald-400'
    };
  } else if (normalized.includes('educacional') || normalized.includes('educacion')) {
    config = {
      tag: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
      gradient: 'from-blue-400 to-indigo-600',
      headerBg: 'bg-blue-50 dark:bg-blue-900/20',
      headerText: 'text-blue-800 dark:text-blue-300',
      dot: 'bg-blue-500',
      leftBorder: 'border-l-blue-500 dark:border-l-blue-400'
    };
  } else if (normalized.includes('laboral') || normalized.includes('trabajo')) {
    config = {
      tag: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
      gradient: 'from-rose-500 to-red-700',
      headerBg: 'bg-rose-50 dark:bg-rose-900/20',
      headerText: 'text-rose-800 dark:text-rose-300',
      dot: 'bg-rose-500',
      leftBorder: 'border-l-rose-500 dark:border-l-rose-400'
    };
  } else if (normalized.includes('comunitaria') || normalized.includes('comunidad')) {
    config = {
      tag: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800',
      gradient: 'from-purple-400 to-fuchsia-600',
      headerBg: 'bg-purple-50 dark:bg-purple-900/20',
      headerText: 'text-purple-800 dark:text-blue-300',
      dot: 'bg-purple-500',
      leftBorder: 'border-l-purple-500 dark:border-l-purple-400'
    };
  }

  return config;
}

export function getStatusVisuals(status?: string | null) {
  const normalized = normalizeStringForComparison(status);

  if (normalized === 'en curso' || normalized === 'pendiente' || normalized === 'en proceso') {
    return {
      icon: 'sync',
      labelClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
      accentBg: 'bg-amber-500',
      iconContainerClass: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
    };
  }
  if (normalized === 'finalizada' || normalized === 'cargado' || normalized === 'realizada' || normalized === 'convenio realizado') {
    return {
      icon: 'verified',
      labelClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
      accentBg: 'bg-emerald-500',
      iconContainerClass: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
    };
  }
  if (normalized === 'realizando convenio' || normalized === 'en conversaciones') {
    return {
      icon: 'handshake',
      labelClass: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
      accentBg: 'bg-indigo-500',
      iconContainerClass: 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20'
    };
  }

  if (normalized === 'cancelada' || normalized === 'rechazada' || normalized === 'no se pudo concretar' || normalized === 'no seleccionado') {
    return {
      icon: 'cancel',
      labelClass: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
      accentBg: 'bg-rose-500',
      iconContainerClass: 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20'
    };
  }

  return {
    icon: 'help_outline',
    labelClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    accentBg: 'bg-slate-500',
    iconContainerClass: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
  };
}

export function safeGetId(val: any): string | null {
  if (!val) return null;
  return String(val).trim() || null;
}

export function parseToUTCDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

export function simpleNameSplit(fullName: string): { nombre: string; apellido: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { nombre: fullName, apellido: '' };
  const apellido = parts.pop() || '';
  const nombre = parts.join(' ');
  return { nombre, apellido };
}

export function cleanInstitutionName(input?: any): string {
  return cleanDbValue(input);
}

/**
 * Función Maestra de Limpieza (Post-SQL Migration Cleanup).
 * Ahora que la DB está limpia, esta función es liviana y solo asegura
 * que no haya nulos o arrays inesperados, confiando en los datos SQL.
 */
export function cleanDbValue(input?: any): string {
  if (input === null || input === undefined) return '';
  return String(input).trim();
}

/**
 * Adds business days to a date.
 */
export function addBusinessDays(date: Date | string, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (result.getUTCDay() !== 0 && result.getUTCDay() !== 6) {
      added++;
    }
  }
  return result;
}

/**
 * Calculates the difference in business days between two dates.
 */
export function getBusinessDaysDiff(start: Date | string, end: Date | string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  let count = 0;
  const curDate = new Date(startDate);

  const isForward = endDate >= startDate;

  if (isForward) {
    while (curDate < endDate) {
      curDate.setUTCDate(curDate.getUTCDate() + 1);
      if (curDate.getUTCDay() !== 0 && curDate.getUTCDay() !== 6) {
        count++;
      }
    }
    return count;
  } else {
    while (curDate > endDate) {
      curDate.setUTCDate(curDate.getUTCDate() - 1);
      if (curDate.getUTCDay() !== 0 && curDate.getUTCDay() !== 6) {
        count--;
      }
    }
    return count;
  }
}
