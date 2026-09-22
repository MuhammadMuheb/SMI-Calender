import { useState, useCallback } from 'react';
import { formatDateRange, getDaysInRange, countWorkingDays, isValidDateRange } from '../utils/dateRangeUtils';
import { ShadButton } from './ui/ShadButton';
import { theme } from '../config/theme';

interface VacationDateRangeSelectorProps {
  onSelectRange: (startDate: string, endDate: string) => void;
  defaultStartDate?: string;
  defaultEndDate?: string;
  minDate?: string;
  maxDate?: string;
  maxDays?: number;
}

export default function VacationDateRangeSelector({
  onSelectRange,
  defaultStartDate = '',
  defaultEndDate = '',
  minDate,
  maxDate,
  maxDays = 30,
}: VacationDateRangeSelectorProps) {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [error, setError] = useState('');

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const addDaysToDate = (dateStr: string, days: number): string => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const handleQuickSelect = useCallback((days: number) => {
    const today = getTodayStr();
    const end = addDaysToDate(today, days);
    setStartDate(today);
    setEndDate(end);
    setError('');
    onSelectRange(today, end);
  }, [onSelectRange]);

  const handleStartDateChange = useCallback((newStart: string) => {
    setStartDate(newStart);
    setError('');

    if (newStart && endDate) {
      if (!isValidDateRange(newStart, endDate)) {
        setError('Start date must be before end date');
        return;
      }
      const totalDays = getDaysInRange(newStart, endDate);
      if (totalDays > maxDays) {
        setError(`Maximum ${maxDays} days allowed`);
        return;
      }
      onSelectRange(newStart, endDate);
    }
  }, [endDate, onSelectRange, maxDays]);

  const handleEndDateChange = useCallback((newEnd: string) => {
    setEndDate(newEnd);
    setError('');

    if (startDate && newEnd) {
      if (!isValidDateRange(startDate, newEnd)) {
        setError('End date must be after start date');
        return;
      }
      const totalDays = getDaysInRange(startDate, newEnd);
      if (totalDays > maxDays) {
        setError(`Maximum ${maxDays} days allowed`);
        return;
      }
      onSelectRange(startDate, newEnd);
    }
  }, [startDate, onSelectRange, maxDays]);

  const totalDays = startDate && endDate ? getDaysInRange(startDate, endDate) : 0;
  const workingDays = startDate && endDate ? countWorkingDays(startDate, endDate) : 0;
  const dateRangeLabel = startDate && endDate ? formatDateRange(startDate, endDate) : 'Select date range';
  const today = getTodayStr();

  return (
    <div className="space-y-4">
      {/* Quick Select Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <ShadButton
          variant="outline"
          size="sm"
          onClick={() => handleQuickSelect(7)}
          className="text-xs"
        >
          7 Days
        </ShadButton>
        <ShadButton
          variant="outline"
          size="sm"
          onClick={() => handleQuickSelect(10)}
          className="text-xs"
        >
          10 Days
        </ShadButton>
        <ShadButton
          variant="outline"
          size="sm"
          onClick={() => handleQuickSelect(15)}
          className="text-xs"
        >
          15 Days
        </ShadButton>
      </div>

      {/* Date Range Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            From
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            min={minDate || today}
            max={maxDate}
            aria-label="Vacation start date"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            To
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            min={startDate || (minDate || today)}
            max={maxDate}
            aria-label="Vacation end date"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-600/50 rounded-lg text-red-200 text-xs" role="alert">
          {error}
        </div>
      )}

      {/* Summary */}
      {startDate && endDate && !error && (
        <div className="p-3 bg-emerald-900/20 border border-emerald-600/50 rounded-lg space-y-2">
          <div className="text-xs text-slate-300">
            <strong>Range:</strong> {dateRangeLabel}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400">Total Days</span>
              <div className="font-semibold text-white mt-1">{totalDays}</div>
            </div>
            <div>
              <span className="text-slate-400">Working Days</span>
              <div className="font-semibold text-emerald-400 mt-1">{workingDays}</div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            * Weekends excluded from working days
          </p>
        </div>
      )}
    </div>
  );
}
