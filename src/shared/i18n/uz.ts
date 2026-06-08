export default {
  // Timer modes
  focus: 'FOCUS',
  shortBreak: 'QISQA TANAFFUS',
  longBreak: 'UZUN TANAFFUS',
  // Timer controls
  start: 'Boshlash',
  pause: 'Pauza',
  skip: "O'tkazib yuborish",
  // Settings
  settings: 'Sozlamalar',
  close: 'Yopish',
  durations: 'Vaqtlar (daqiqa)',
  focusDuration: 'Focus',
  shortBreakDuration: 'Qisqa tanaffus',
  longBreakDuration: 'Uzun tanaffus',
  sessionsBeforeLongBreak: 'Sessiyalar soni',
  notifications: 'Bildirishnomalar',
  sound: 'Ovoz',
  notification: 'Notification',
  soundFile: 'Ovoz fayli',
  selectFile: 'Tanlash',
  defaultBell: 'bell.mp3 (standart)',
  app: 'Dastur',
  checkUpdates: 'Yangilanishni tekshirish',
  install: "O'rnatish",
  checking: 'Tekshirilmoqda...',
  downloading: 'Yuklanmoqda...',
  updateReady: 'tayyor — qayta ishga tushiring',
  upToDate: "Eng so'nggi versiyada ishlayapsiz ✓",
  updateError: 'Xatolik',
  // Tasks panel
  tasks: 'Ishlar',
  activeTask: 'Joriy ish',
  finish: 'Tugatish',
  cancel: 'Bekor qilish',
  newTask: 'Yangi ish',
  taskNamePlaceholder: 'Task nomi...',
  descPlaceholder: 'Tasnif (ixtiyoriy)...',
  addTask: "Qo'shish",
  completed: 'Bajarildi',
  emptyTitle: "Ishlar ro'yxati bo'sh",
  emptyStep1: 'Quyida ish nomini kiriting',
  emptyStep2: "Ro'yxatdan ishni tanlang",
  emptyStep3: 'Taymerini ishga tushiring',
  // Stats
  statistics: 'Statistika',
  today: 'Bugun',
  thisWeek: 'Bu hafta',
  allTime: 'Jami',
  sessionLabel: 'focus',
  timeLabel: 'vaqt',
  taskLabel: 'task',
  sessionUnit: 'session',
  // Focus mode
  focusModeOn: 'Focus mode: yoqiq',
  focusModeOff: "Focus mode: o'chiq",
  // Notifications
  focusDone: 'Focus tugadi!',
  breakDone: 'Dam olish tugadi!',
  focusDoneBody: 'Dam olish vaqti keldi.',
  breakDoneBody: 'Ishlash vaqti keldi.',
  // Music
  music: 'Musiqa',
  // Error boundary
  errorOccurred: 'Xatolik yuz berdi',
  retry: 'Qayta urinish',
  // Export/Import
  exportTasks: 'Eksport',
  importTasks: 'Import',
  // Language
  language: 'Til',
  // Auto-start
  autoStartBreaks: 'Tanaffusni avtomatik boshlash',
  autoStartFocus: 'Focusni avtomatik boshlash',
  // Always on top
  alwaysOnTop: 'Har doim ustda',
  // Mini mode
  miniMode: 'Mini rejim',
  // Daily goal
  dailyGoal: 'Kunlik maqsad (0 = yo\'q)',
  goalReached: 'Maqsadga yetdingiz!',
  // Streak
  streak: 'kun ketma-ket',
  // Animations
  animations: 'Animatsiyalar',
  // Break screen
  breakScreen: 'Dam olish ekrani',
  breakScreenTitle: 'Dam olin',
  skipBreak: 'O\'tkazib yuborish',
  breatheIn: 'Nafas oling',
  breatheHold: 'Ushlab turing',
  breatheOut: 'Nafas chiqaring',
  stretch: 'Cho\'zilish',
  hydration: 'Suv iching',
  eyeRest: 'Ko\'zni dam oldiring',
  // Task features
  priority: 'Muhimlik',
  priorityHigh: 'Yuqori',
  priorityMedium: 'O\'rta',
  priorityLow: 'Past',
  dueDate: 'Muddat',
  dueDateToday: 'Bugun',
  dueDateTomorrow: 'Ertaga',
  dueDateOverdue: 'Kechikdi',
  subtasks: 'Kichik ishlar',
  addSubtask: 'Kichik ish qo\'shish...',
  search: 'Qidirish',
  searchPlaceholder: 'Ish nomi...',
  // Radio
  radio: 'Radio',
  radioAddUrl: 'URL qo\'shish',
  radioUrlPlaceholder: 'Stream URL...',
  radioName: 'Stansiya nomi...',
  // Folders
  savedFolders: 'Saqlangan papkalar',
  addFolder: 'Papka qo\'shish',
  // Presets
  presets: 'Presetlar',
  // Music loading states
  loadingTrack: 'Yuklanmoqda...',
  noAudioFiles: 'Audio fayllar topilmadi',
} as const;

export type TranslationKey = keyof typeof import('./uz').default;
