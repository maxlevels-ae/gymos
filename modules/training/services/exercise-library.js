/**
 * GymOS Exercise Library — Arabic/English bilingual exercise database
 * Based on the open-source free-exercise-db (Unlicense)
 * Images hosted at: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/
 */

// ─── Arabic Translations ────────────────────────────────
const muscleTranslations = {
  'abdominals': 'البطن',
  'abductors': 'العضلات المبعدة',
  'adductors': 'العضلات المقربة',
  'biceps': 'البايسبس',
  'calves': 'السمانة',
  'chest': 'الصدر',
  'forearms': 'الساعد',
  'glutes': 'المؤخرة',
  'hamstrings': 'العضلات الخلفية',
  'lats': 'الظهر العريض',
  'lower back': 'أسفل الظهر',
  'middle back': 'وسط الظهر',
  'neck': 'الرقبة',
  'quadriceps': 'الفخذ الأمامي',
  'shoulders': 'الأكتاف',
  'traps': 'شبه المنحرفة',
  'triceps': 'الترايسبس',
};

const equipmentTranslations = {
  'barbell': 'بار حديد',
  'dumbbell': 'دمبل',
  'kettlebells': 'كيتل بيل',
  'cable': 'كيبل',
  'machine': 'جهاز',
  'body only': 'وزن الجسم',
  'bands': 'أحزمة مقاومة',
  'medicine ball': 'كرة طبية',
  'exercise ball': 'كرة تمارين',
  'foam roll': 'فوم رولر',
  'e-z curl bar': 'بار زجزاج',
  'other': 'أخرى',
  'null': 'بدون معدات',
};

const categoryTranslations = {
  'strength': 'قوة',
  'stretching': 'إطالة',
  'plyometrics': 'بليومتركس',
  'strongman': 'رجل قوي',
  'powerlifting': 'رفع أثقال',
  'cardio': 'كارديو',
  'olympic weightlifting': 'رفع أثقال أولمبي',
};

const levelTranslations = {
  'beginner': 'مبتدئ',
  'intermediate': 'متوسط',
  'expert': 'متقدم',
};

const forceTranslations = {
  'push': 'دفع',
  'pull': 'سحب',
  'static': 'ثابت',
};

// ─── Muscle Group Display Config ────────────────────────
const muscleGroups = [
  { id: 'chest', en: 'Chest', ar: 'الصدر', icon: '💪', color: '#ef4444' },
  { id: 'shoulders', en: 'Shoulders', ar: 'الأكتاف', icon: '🏋️', color: '#f59e0b' },
  { id: 'biceps', en: 'Biceps', ar: 'البايسبس', icon: '💪', color: '#10b981' },
  { id: 'triceps', en: 'Triceps', ar: 'الترايسبس', icon: '💪', color: '#3b82f6' },
  { id: 'forearms', en: 'Forearms', ar: 'الساعد', icon: '✊', color: '#8b5cf6' },
  { id: 'lats', en: 'Back (Lats)', ar: 'الظهر العريض', icon: '🔙', color: '#06b6d4' },
  { id: 'middle back', en: 'Middle Back', ar: 'وسط الظهر', icon: '🔙', color: '#0891b2' },
  { id: 'lower back', en: 'Lower Back', ar: 'أسفل الظهر', icon: '🔙', color: '#0d9488' },
  { id: 'abdominals', en: 'Abs', ar: 'البطن', icon: '🎯', color: '#ec4899' },
  { id: 'quadriceps', en: 'Quads', ar: 'الفخذ الأمامي', icon: '🦵', color: '#f97316' },
  { id: 'hamstrings', en: 'Hamstrings', ar: 'العضلات الخلفية', icon: '🦵', color: '#84cc16' },
  { id: 'glutes', en: 'Glutes', ar: 'المؤخرة', icon: '🍑', color: '#a855f7' },
  { id: 'calves', en: 'Calves', ar: 'السمانة', icon: '🦶', color: '#14b8a6' },
  { id: 'adductors', en: 'Adductors', ar: 'المقربة', icon: '🦵', color: '#64748b' },
  { id: 'abductors', en: 'Abductors', ar: 'المبعدة', icon: '🦵', color: '#475569' },
  { id: 'traps', en: 'Traps', ar: 'شبه المنحرفة', icon: '🏔️', color: '#b45309' },
  { id: 'neck', en: 'Neck', ar: 'الرقبة', icon: '🧣', color: '#78716c' },
];

const equipmentList = [
  { id: 'body only', en: 'Bodyweight', ar: 'وزن الجسم', icon: '🤸' },
  { id: 'dumbbell', en: 'Dumbbell', ar: 'دمبل', icon: '🏋️' },
  { id: 'barbell', en: 'Barbell', ar: 'بار حديد', icon: '🏋️‍♂️' },
  { id: 'kettlebells', en: 'Kettlebell', ar: 'كيتل بيل', icon: '🔔' },
  { id: 'cable', en: 'Cable', ar: 'كيبل', icon: '🔗' },
  { id: 'machine', en: 'Machine', ar: 'جهاز', icon: '⚙️' },
  { id: 'bands', en: 'Bands', ar: 'أحزمة مقاومة', icon: '🎗️' },
  { id: 'medicine ball', en: 'Medicine Ball', ar: 'كرة طبية', icon: '⚽' },
  { id: 'exercise ball', en: 'Exercise Ball', ar: 'كرة تمارين', icon: '🏐' },
  { id: 'foam roll', en: 'Foam Roller', ar: 'فوم رولر', icon: '🧴' },
  { id: 'e-z curl bar', en: 'EZ Curl Bar', ar: 'بار زجزاج', icon: '〰️' },
  { id: 'other', en: 'Other', ar: 'أخرى', icon: '🔧' },
];

module.exports = {
  muscleTranslations,
  equipmentTranslations,
  categoryTranslations,
  levelTranslations,
  forceTranslations,
  muscleGroups,
  equipmentList,
  IMAGE_BASE_URL: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/',
  EXERCISES_JSON_URL: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json',
};
