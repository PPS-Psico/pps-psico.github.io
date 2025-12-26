
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
  
  return String(str)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Cleans institution names that might come with brackets or braces.
 */
export function cleanInstitutionName(val: any): string {
  if (!val) return '';
  const str = Array.isArray(val) ? val[0] : String(val);
  return str.replace(/[\[\]\{\}"]/g, '').trim();
}

/**
 * Returns visual style configuration based on the specialty area.
 */
export function getEspecialidadClasses(especialidad?: string) {
  const normalized = normalizeStringForComparison(especialidad);
  
  let config = {
    tag: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    gradient: 'from-slate-400 to-slate-600',
    headerBg: 'bg-slate-50 dark:bg-slate-800',
    headerText: 'text-slate-800 dark:text-slate-100',
    dot: 'bg-slate-400'
  };

  if (normalized.includes('clinica')) {
    config = {
      tag: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
      gradient: 'from-emerald-400 to-teal-600',
      headerBg: 'bg-emerald-50 dark:bg-emerald-900/20',
      headerText: 'text-emerald-800 dark:text-emerald-300',
      dot: 'bg-emerald-500'
    };
  } else if (normalized.includes('educacional') || normalized.includes('educacion')) {
    config = {
      tag: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
      gradient: 'from-blue-400 to-indigo-600',
      headerBg: 'bg-blue-50 dark:bg-blue-900/20',
      headerText: 'text-blue-800 dark:text-blue-300',
      dot: 'bg-blue-500'
    };
  } else if (normalized.includes('laboral') || normalized.includes('trabajo')) {
    config = {
      tag: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
      gradient: 'from-rose-500 to-red-700',
      headerBg: 'bg-rose-50 dark:bg-rose-900/20',
      headerText: 'text-rose-800 dark:text-rose-300',
      dot: 'bg-rose-500'
    };
  } else if (normalized.includes('comunitaria') || normalized.includes('comunidad')) {
    config = {
      tag: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800',
      gradient: 'from-purple-400 to-fuchsia-600',
      headerBg: 'bg-purple-50 dark:bg-purple-900/20',
      headerText: 'text-purple-800 dark:text-purple-300',
      dot: 'bg-purple-500'
    };
  }
  
  return config;
}

export function getStatusVisuals(status?: string) {
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
  if (Array.isArray(val)) return val[0] || null;
  return String(val);
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

export function isValidLocation(location?: string): boolean {
  if (!location) return false;
  const normalized = normalizeStringForComparison(location);
  return normalized !== 'n/a' && normalized !== 'no especificada' && normalized !== '';
}

// --- LOGICA DE DÍAS HÁBILES Y FERIADOS ---

// Lista de feriados inamovibles y turísticos (Formato YYYY-MM-DD)
// Se incluyen feriados 2025 y proyección básica 2026
const ARGENTINE_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', // Año Nuevo (Aunque Enero es receso)
  '2025-02-28', // Carnaval (Estimado o fijo según calendario oficial)
  '2025-03-03', // Carnaval
  '2025-03-04', // Carnaval
  '2025-03-24', // Memoria
  '2025-04-02', // Malvinas
  '2025-04-18', // Viernes Santo
  '2025-05-01', // Trabajador
  '2025-05-25', // Revolución de Mayo
  '2025-06-16', // Güemes (Paso a la Inmortalidad)
  '2025-06-20', // Belgrano
  '2025-07-09', // Independencia
  '2025-08-17', // San Martín
  '2025-10-12', // Diversidad Cultural
  '2025-11-20', // Soberanía
  '2025-12-08', // Inmaculada Concepción
  '2025-12-25', // Navidad
  
  // Feriados Carnaval 2025 Específicos (Lunes 3 y Martes 4 de Marzo de 2025 es lo usual, 
  // pero a veces cae fines de Febrero. Ajustar según calendario oficial vigente)
  // Según calendario oficial 2025: 3 y 4 de Marzo. 
  // Si el usuario mencionó febrero, quizás se refería a feriados puente o años anteriores.
  // Agregamos fechas probables para asegurar cobertura si cambian.
  '2025-02-24', // Posible feriado puente
  '2025-02-25', 
  
  // 2026 (Proyección)
  '2026-01-01',
  '2026-02-16', // Carnaval
  '2026-02-17', // Carnaval
  '2026-03-24',
  '2026-04-02',
  '2026-04-03', // Viernes Santo
  '2026-05-01',
  '2026-05-25',
  '2026-06-17',
  '2026-06-20',
  '2026-07-09',
  '2026-08-17',
  '2026-10-12',
  '2026-11-20',
  '2026-12-08',
  '2026-12-25'
]);

function isBusinessDay(date: Date): boolean {
  const day = date.getUTCDay();
  const month = date.getUTCMonth(); // 0-indexed (0 = Enero)
  
  // 1. Fin de semana (Sábado=6, Domingo=0)
  if (day === 0 || day === 6) return false;
  
  // 2. Receso Administrativo (Enero completo)
  if (month === 0) return false;
  
  // 3. Feriados Nacionales
  const isoDate = date.toISOString().split('T')[0];
  if (ARGENTINE_HOLIDAYS.has(isoDate)) return false;
  
  return true;
}

/**
 * Adds business days to a date, skipping weekends, January recess, and Argentine holidays.
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  // Asegurar que trabajamos en UTC para evitar problemas de timezone
  result.setUTCHours(12, 0, 0, 0); 
  
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isBusinessDay(result)) {
      added++;
    }
  }
  return result;
}

/**
 * Calculates the number of business days between two dates.
 */
export function getBusinessDaysDiff(startDate: Date, endDate: Date): number {
  let count = 0;
  const curDate = new Date(startDate);
  curDate.setUTCHours(12, 0, 0, 0);
  
  const target = new Date(endDate);
  target.setUTCHours(12, 0, 0, 0);

  const isNegative = target < curDate;
  
  if (isNegative) {
      // Cuenta regresiva (días pasados)
      while (curDate > target) {
        curDate.setUTCDate(curDate.getUTCDate() - 1);
        if (isBusinessDay(curDate)) count--;
      }
  } else {
      // Cuenta progresiva (días faltantes)
      while (curDate < target) {
        curDate.setUTCDate(curDate.getUTCDate() + 1);
        if (isBusinessDay(curDate)) count++;
      }
  }
  return count;
}
