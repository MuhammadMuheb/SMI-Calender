export interface Schedule {
  id?: string;
  date: string; // YYYY-MM-DD format
  dayOfWeek: string; // MONDAY, TUESDAY, etc.
  guide: string; // Staff/guide name
  month: number;
  year: number;
  createdAt?: Date;
}
