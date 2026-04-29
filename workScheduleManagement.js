// ═══════════════════════════════════════════════════════════════════════════
// ÇALIŞMA ZAMANLAMASI YÖNETİMİ
// Kullanıcı: "Haftada 2 gün" veya "Ayda 6 gün hafta sonları" tanımlayabilir
// ═══════════════════════════════════════════════════════════════════════════

// field.workSchedule = {
//   type: 'weekly' | 'monthly',
//   pattern: [1,3,5] (haftalık: pazartesi=0, salı=1, ..., pazar=6)
//   monthlyDays: [6, 13, 20, 27] (aylık belirli günler)
//   startDate: '2025-01-15',
// }

window.setWorkSchedule = (fieldId, scheduleType, pattern) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field) return;
  
  if (scheduleType === 'weekly') {
    field.workSchedule = {
      type: 'weekly',
      pattern: pattern, // [0,2,4] = Pazartesi, Çarşamba, Cuma
      startDate: tstr(),
    };
  } else if (scheduleType === 'monthly') {
    field.workSchedule = {
      type: 'monthly',
      monthlyDays: pattern, // [6, 13, 20, 27]
      startDate: tstr(),
    };
  }
  
  saveFieldToDB(field);
};

// ─── VERILEN TARİH, ÇALIŞMA GÜNÜ MÜ? ──────────────────────────────
window.isFieldWorkDay = (fieldId, dateStr) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field || !field.workSchedule) return true; // Zamanlamadıysasız, her gün çalış
  
  const date = new Date(dateStr + 'T00:00:00');
  const sched = field.workSchedule;
  
  if (sched.type === 'weekly') {
    const dayOfWeek = date.getDay();
    return sched.pattern.includes(dayOfWeek);
  } else if (sched.type === 'monthly') {
    const dayOfMonth = date.getDate();
    return sched.monthlyDays.includes(dayOfMonth);
  }
  
  return true;
};

// ─── SONRAKI N ÇALIŞMA GÜNÜ ───────────────────────────────────────
window.getNextWorkDays = (fieldId, fromDate, count = 5) => {
  const workDays = [];
  const field = DB.fields.find(f => f.id === fieldId);
  
  let current = new Date(fromDate + 'T00:00:00');
  
  while (workDays.length < count) {
    const dateStr = current.toISOString().split('T')[0];
    if (window.isFieldWorkDay(fieldId, dateStr)) {
      workDays.push({
        date: dateStr,
        dayName: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][current.getDay()],
      });
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workDays;
};

// ─── ÖNERILERI ÇALIŞMA ZAMANLAMASINA GÖRE DÜZENLE ─────────────────
window.planTasksWithWorkSchedule = (fieldId, recommendedTasks = []) => {
  const plannedTasks = [];
  
  recommendedTasks.forEach(task => {
    // Task tarihinden sonraki ilk çalışma gününe taşı
    const taskDate = new Date(task.date || tstr());
    let plannedDate = new Date(taskDate);
    
    while (!window.isFieldWorkDay(fieldId, plannedDate.toISOString().split('T')[0])) {
      plannedDate.setDate(plannedDate.getDate() + 1);
    }
    
    plannedTasks.push({
      ...task,
      originalDate: task.date,
      plannedDate: plannedDate.toISOString().split('T')[0],
      adjusted: task.date !== plannedDate.toISOString().split('T')[0],
    });
  });
  
  return plannedTasks;
};

// ─── HAFTALIK ÇALIŞMA SAATLERI TAHMINI ────────────────────────────
window.estimateWeeklyWorkload = (fieldId) => {
  const field = DB.fields.find(f => f.id === fieldId);
  if (!field || !field.workSchedule) return null;
  
  const sched = field.workSchedule;
  let workDaysPerWeek = 0;
  
  if (sched.type === 'weekly') {
    workDaysPerWeek = sched.pattern.length;
  } else if (sched.type === 'monthly') {
    // Ortalama
    workDaysPerWeek = (sched.monthlyDays.length / 4.33).toFixed(1);
  }
  
  return {
    fieldId,
    workDaysPerWeek,
    averageFieldSize: field.area,
    estimatedHoursPerDay: 4, // Varsayılan
    totalHoursPerWeek: (workDaysPerWeek * 4).toFixed(1),
  };
};

// ─── TAKVIMDE ÇALIŞMA GÜNLERINI GÖSTERİŞ ──────────────────────────
window.renderWorkScheduleOnCalendar = (fieldId, year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  const workDays = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (window.isFieldWorkDay(fieldId, dateStr)) {
      workDays.push(day);
    }
  }
  
  return {
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    workDaysInMonth: workDays,
    totalWorkDays: workDays.length,
    calendarMarkup: workDays.map(d => 
      `<div style="background:var(--glt);border-radius:4px;padding:3px;text-align:center;font-weight:700;color:var(--green2);">${d}</div>`
    ).join(''),
  };
};
