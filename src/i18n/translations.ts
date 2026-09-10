export type Lang = 'en' | 'it';

const translations: Record<Lang, Record<string, string>> = {
  en: {
    // Navigation & common
    'nav.home': 'Home',
    'nav.calendar': 'Calendar',
    'nav.settings': 'Settings',
    'common.back': '← Back',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.loading': 'Loading...',
    'common.noData': 'No data found',
    'common.search': 'Search',
    'common.all': 'All',
    'common.allStaff': 'All Staff',
    'common.send': 'Send',
    'common.close': 'Close',

    // Auth
    'auth.welcome': 'Welcome back',
    'auth.login': 'Log In',
    'auth.logout': 'Log Out',
    'auth.username': 'Username',
    'auth.pin': 'PIN',

    // Dashboard
    'dash.workingToday': 'Working Today',
    'dash.seeYouTomorrow': 'See You Tomorrow',
    'dash.pendingRequests': 'Pending Requests',
    'dash.totalStaff': 'Total Staff',
    'dash.daysOffLeft': 'Days Off Left',
    'dash.vacationDays': 'Vacation Days',
    'dash.ofThisCycle': 'of {n} this cycle',
    'dash.ofAccrued': 'of {n} accrued',
    'dash.quickActions': 'Quick Actions',
    'dash.manageTeam': 'Manage your team',
    'dash.recentRequests': 'Recent Requests',
    'dash.noRequests': 'No requests yet',
    'dash.noPending': 'No pending requests',
    'dash.checkInStreak': 'Check-in Streak',
    'dash.avgArrival': 'Avg Arrival',
    'dash.monthlyHours': 'Monthly Hours',
    'dash.target': 'Target: {n}h',
    'dash.days': 'days',

    // Check-in
    'checkin.button': 'Check In',
    'checkin.checkedIn': 'Checked In',
    'checkin.checkout': 'Check Out',
    'checkin.wfh': 'Work from Home',
    'checkin.refreshLocation': 'Refresh location',
    'checkin.away': 'away',
    'checkin.board': 'Check-In Board',
    'checkin.shiftStatus': 'Shift Responses',

    // Attendance
    'attendance.title': 'Attendance Summary',
    'attendance.exportCsv': 'Export CSV',
    'attendance.exporting': 'Exporting...',
    'attendance.noRecords': 'No attendance records for',
    'attendance.daysWorked': 'Days Worked',
    'attendance.grossHours': 'Gross Hours',
    'attendance.totalBreaks': 'Total Breaks',
    'attendance.netHours': 'Net Hours',
    'attendance.onSite': 'on-site',
    'attendance.wfh': 'WFH',
    'attendance.breakPerDay': 'Break: {n} min/day',
    'attendance.ongoing': 'ongoing',
    'attendance.auto': 'auto',
    'attendance.myAttendance': 'My Attendance',

    // Weekly report
    'weeklyReport.title': 'Weekly Report',
    'weeklyReport.thisWeek': 'This Week',
    'weeklyReport.generate': 'Generate Report',
    'weeklyReport.totalHours': 'Total Hours',
    'weeklyReport.avgDaily': 'Avg Daily',
    'weeklyReport.daysPresent': 'Days Present',
    'weeklyReport.lateArrivals': 'Late Arrivals',

    // Shift swap
    'swap.title': 'Shift Swap',
    'swap.propose': 'Propose Swap',
    'swap.pending': 'Pending',
    'swap.accepted': 'Accepted',
    'swap.declined': 'Declined',
    'swap.cancelled': 'Cancelled',
    'swap.accept': 'Accept',
    'swap.decline': 'Decline',
    'swap.noSwaps': 'No swap requests',
    'swap.selectStaff': 'Select staff member',
    'swap.selectDate': 'Select date',
    'swap.reason': 'Reason (optional)',
    'swap.yourShift': 'Your shift',
    'swap.theirShift': 'Their shift',
    'swap.proposeWith': 'Swap with',

    // Leave
    'leave.request': 'Request Time Off',
    'leave.regularDay': 'Regular Day Off',
    'leave.vacation': 'Vacation',
    'leave.sick': 'Sick Leave',
    'leave.personal': 'Personal',
    'leave.approved': 'Approved',
    'leave.pending': 'Pending',
    'leave.rejected': 'Rejected',
    'leave.viewAll': 'View All →',
    'leave.approve': 'Approve',
    'leave.reject': 'Reject',

    // WhatsApp / Tomorrow
    'whatsapp.sendSummary': 'Send Tomorrow Summary via WhatsApp',
    'whatsapp.sending': 'Sending...',
    'whatsapp.sent': 'Sent!',
    'whatsapp.tomorrowDuty': "Tomorrow's Duty",
    'whatsapp.onDuty': 'On Duty',
    'whatsapp.offDuty': 'Off',

    // Settings
    'settings.language': 'Language',
    'settings.english': 'English',
    'settings.italian': 'Italiano',

    // Roles
    'role.staff': 'Staff',
    'role.manager': 'Manager',
    'role.superAdmin': 'Super Admin',

    // Coffee
    'coffee.leaderboard': 'Coffee Leaderboard',

    // Admin
    'admin.panel': 'Admin Panel',
    'admin.approveRequests': 'Approve Requests',
  },
  it: {
    // Navigation & common
    'nav.home': 'Home',
    'nav.calendar': 'Calendario',
    'nav.settings': 'Impostazioni',
    'common.back': '← Indietro',
    'common.save': 'Salva',
    'common.cancel': 'Annulla',
    'common.confirm': 'Conferma',
    'common.loading': 'Caricamento...',
    'common.noData': 'Nessun dato trovato',
    'common.search': 'Cerca',
    'common.all': 'Tutti',
    'common.allStaff': 'Tutto il personale',
    'common.send': 'Invia',
    'common.close': 'Chiudi',

    // Auth
    'auth.welcome': 'Bentornato',
    'auth.login': 'Accedi',
    'auth.logout': 'Esci',
    'auth.username': 'Nome utente',
    'auth.pin': 'PIN',

    // Dashboard
    'dash.workingToday': 'Al Lavoro Oggi',
    'dash.seeYouTomorrow': 'A Domani',
    'dash.pendingRequests': 'Richieste in Attesa',
    'dash.totalStaff': 'Personale Totale',
    'dash.daysOffLeft': 'Giorni Liberi',
    'dash.vacationDays': 'Ferie',
    'dash.ofThisCycle': 'di {n} in questo ciclo',
    'dash.ofAccrued': 'di {n} maturati',
    'dash.quickActions': 'Azioni Rapide',
    'dash.manageTeam': 'Gestisci il tuo team',
    'dash.recentRequests': 'Richieste Recenti',
    'dash.noRequests': 'Nessuna richiesta',
    'dash.noPending': 'Nessuna richiesta in attesa',
    'dash.checkInStreak': 'Serie Check-in',
    'dash.avgArrival': 'Arrivo Medio',
    'dash.monthlyHours': 'Ore Mensili',
    'dash.target': 'Obiettivo: {n}h',
    'dash.days': 'giorni',

    // Check-in
    'checkin.button': 'Check In',
    'checkin.checkedIn': 'Registrato',
    'checkin.checkout': 'Check Out',
    'checkin.wfh': 'Lavoro da Casa',
    'checkin.refreshLocation': 'Aggiorna posizione',
    'checkin.away': 'di distanza',
    'checkin.board': 'Bacheca Check-In',
    'checkin.shiftStatus': 'Risposte Turni',

    // Attendance
    'attendance.title': 'Riepilogo Presenze',
    'attendance.exportCsv': 'Esporta CSV',
    'attendance.exporting': 'Esportazione...',
    'attendance.noRecords': 'Nessun dato di presenza per',
    'attendance.daysWorked': 'Giorni Lavorati',
    'attendance.grossHours': 'Ore Lorde',
    'attendance.totalBreaks': 'Pause Totali',
    'attendance.netHours': 'Ore Nette',
    'attendance.onSite': 'in sede',
    'attendance.wfh': 'da casa',
    'attendance.breakPerDay': 'Pausa: {n} min/giorno',
    'attendance.ongoing': 'in corso',
    'attendance.auto': 'auto',
    'attendance.myAttendance': 'Le Mie Presenze',

    // Weekly report
    'weeklyReport.title': 'Report Settimanale',
    'weeklyReport.thisWeek': 'Questa Settimana',
    'weeklyReport.generate': 'Genera Report',
    'weeklyReport.totalHours': 'Ore Totali',
    'weeklyReport.avgDaily': 'Media Giornaliera',
    'weeklyReport.daysPresent': 'Giorni Presenti',
    'weeklyReport.lateArrivals': 'Arrivi in Ritardo',

    // Shift swap
    'swap.title': 'Scambio Turno',
    'swap.propose': 'Proponi Scambio',
    'swap.pending': 'In Attesa',
    'swap.accepted': 'Accettato',
    'swap.declined': 'Rifiutato',
    'swap.cancelled': 'Annullato',
    'swap.accept': 'Accetta',
    'swap.decline': 'Rifiuta',
    'swap.noSwaps': 'Nessuno scambio',
    'swap.selectStaff': 'Seleziona personale',
    'swap.selectDate': 'Seleziona data',
    'swap.reason': 'Motivo (facoltativo)',
    'swap.yourShift': 'Il tuo turno',
    'swap.theirShift': 'Il loro turno',
    'swap.proposeWith': 'Scambia con',

    // Leave
    'leave.request': 'Richiedi Giorno Libero',
    'leave.regularDay': 'Giorno Libero',
    'leave.vacation': 'Ferie',
    'leave.sick': 'Malattia',
    'leave.personal': 'Personale',
    'leave.approved': 'Approvato',
    'leave.pending': 'In Attesa',
    'leave.rejected': 'Rifiutato',
    'leave.viewAll': 'Vedi Tutto →',
    'leave.approve': 'Approva',
    'leave.reject': 'Rifiuta',

    // WhatsApp / Tomorrow
    'whatsapp.sendSummary': 'Invia Riepilogo Domani via WhatsApp',
    'whatsapp.sending': 'Invio...',
    'whatsapp.sent': 'Inviato!',
    'whatsapp.tomorrowDuty': 'Turno di Domani',
    'whatsapp.onDuty': 'In Servizio',
    'whatsapp.offDuty': 'Libero',

    // Settings
    'settings.language': 'Lingua',
    'settings.english': 'English',
    'settings.italian': 'Italiano',

    // Roles
    'role.staff': 'Personale',
    'role.manager': 'Responsabile',
    'role.superAdmin': 'Super Admin',

    // Coffee
    'coffee.leaderboard': 'Classifica Caffè',

    // Admin
    'admin.panel': 'Pannello Admin',
    'admin.approveRequests': 'Approva Richieste',
  },
};

export default translations;
