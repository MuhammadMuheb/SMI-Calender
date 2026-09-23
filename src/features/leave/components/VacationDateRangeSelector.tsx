import { useState, useCallback } from 'react';
import { formatDateRange, getDaysInRange, countWorkingDays, isValidDateRange } from '@/utils/dateRangeUtils';
import { formatDateLocal } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';

interface VacationDateRangeSelectorProps {
  onSelectRange: (startDate: string, endDate: string) => void;
  defaultStartDate?: string;
  defaultEndDate?: string;
  minDate?: string;
  maxDate?: string;
  maxDays?: number;
}

const QUICK_PICKS = [7, 10, 15];

/** `days` consecutive days starting on `dateStr`, as the inclusive end date. */
function endDateFor(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days - 1);
  return formatDateLocal(d);
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

  const today = formatDateLocal(new Date());

  const handleQuickSelect = useCallback((days: number) => {
    const start = formatDateLocal(new Date());
    const end = endDateFor(start, days);
    setStartDate(start);
    setEndDate(end);
    setError('');
    onSelectRange(start, end);
  }, [onSelectRange]);

  const handleStartDateChange = useCallback((newStart: string) => {
    setStartDate(newStart);
    setError('');

    if (newStart && endDate) {
      if (!isValidDateRange(newStart, endDate)) {
        setError('The first day has to be on or before the last day.');
        return;
      }
      if (getDaysInRange(newStart, endDate) > maxDays) {
        setError(`You can book up to ${maxDays} days at once. Shorten the range or send two requests.`);
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
        setError('The last day has to be on or after the first day.');
        return;
      }
      if (getDaysInRange(startDate, newEnd) > maxDays) {
        setError(`You can book up to ${maxDays} days at once. Shorten the range or send two requests.`);
        return;
      }
      onSelectRange(startDate, newEnd);
    }
  }, [startDate, onSelectRange, maxDays]);

  const hasRange = !!startDate && !!endDate && !error;
  const totalDays = hasRange ? getDaysInRange(startDate, endDate) : 0;
  const workingDays = hasRange ? countWorkingDays(startDate, endDate) : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Quick pick, starting today</p>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_PICKS.map((days) => (
            <Button key={days} type="button" variant="outline" size="lg" onClick={() => handleQuickSelect(days)}>
              {days} days
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="vacation-start">First day</FieldLabel>
          <Input
            id="vacation-start"
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            min={minDate || today}
            max={maxDate}
            aria-invalid={error ? true : undefined}
            className="h-10 dark:scheme-dark"
          />
        </Field>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="vacation-end">Last day</FieldLabel>
          <Input
            id="vacation-end"
            type="date"
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            min={startDate || minDate || today}
            max={maxDate}
            aria-invalid={error ? true : undefined}
            className="h-10 dark:scheme-dark"
          />
        </Field>
      </div>

      {error && <FieldError>{error}</FieldError>}

      {hasRange && (
        <div className="rounded-lg bg-muted px-3 py-2.5">
          <p className="text-sm font-medium">{formatDateRange(startDate, endDate)}</p>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Total days</dt>
              <dd className="font-medium tabular-nums">{totalDays}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Working days (Mon–Fri)</dt>
              <dd className="font-medium tabular-nums">{workingDays}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
