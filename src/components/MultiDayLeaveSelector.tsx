import { useState, useCallback } from 'react';
import { formatDateRange, getDaysInRange, countWorkingDays, isValidDateRange } from '../utils/dateRangeUtils';

interface MultiDayLeaveSelectorProps {
  onSelectRange: (startDate: string, endDate: string) => void;
  defaultStartDate?: string;
  defaultEndDate?: string;
  minDate?: string;
  maxDate?: string;
}

export default function MultiDayLeaveSelector({
  onSelectRange,
  defaultStartDate = '',
  defaultEndDate = '',
  minDate,
  maxDate,
}: MultiDayLeaveSelectorProps) {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [error, setError] = useState('');

  const handleStartDateChange = useCallback((newStart: string) => {
    setStartDate(newStart);
    setError('');

    if (newStart && endDate) {
      if (!isValidDateRange(newStart, endDate)) {
        setError('Start date must be before end date');
        return;
      }
      onSelectRange(newStart, endDate);
    }
  }, [endDate, onSelectRange]);

  const handleEndDateChange = useCallback((newEnd: string) => {
    setEndDate(newEnd);
    setError('');

    if (startDate && newEnd) {
      if (!isValidDateRange(startDate, newEnd)) {
        setError('End date must be after start date');
        return;
      }
      onSelectRange(startDate, newEnd);
    }
  }, [startDate, onSelectRange]);

  const totalDays = startDate && endDate ? getDaysInRange(startDate, endDate) : 0;
  const workingDays = startDate && endDate ? countWorkingDays(startDate, endDate) : 0;
  const dateRangeLabel = startDate && endDate ? formatDateRange(startDate, endDate) : 'Select date range';

  return (
    <div className="space-y-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Start Date
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => handleStartDateChange(e.target.value)}
          min={minDate}
          max={maxDate}
          aria-label="Leave request start date"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          End Date
        </label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => handleEndDateChange(e.target.value)}
          min={startDate || minDate}
          max={maxDate}
          aria-label="Leave request end date"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-900 text-red-200 rounded text-sm" role="alert">
          {error}
        </div>
      )}

      {startDate && endDate && !error && (
        <div className="p-3 bg-slate-800 rounded border border-slate-600 space-y-2">
          <div className="text-sm text-slate-300">
            <strong>Range:</strong> {dateRangeLabel}
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-slate-400">Total Days:</span>
              <span className="ml-2 font-semibold text-white">{totalDays}</span>
            </div>
            <div>
              <span className="text-slate-400">Working Days:</span>
              <span className="ml-2 font-semibold text-green-400">{workingDays}</span>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            (Working days exclude weekends)
          </p>
        </div>
      )}
    </div>
  );
}
