import { useState } from 'react';
import { Card, Button } from '../../components/ui';
import { theme } from '../../config/theme';
import { useAppData } from '../../context/AppDataContext';
import type { Schedule } from '../../models/schedule';

interface ScheduleImportProps {
  onBack: () => void;
}

export default function ScheduleImport({ onBack }: ScheduleImportProps) {
  const { schedules, seedSchedules } = useAppData();
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Schedule[]>([]);

  // Hard-coded schedule data extracted from August 2026 PDF
  const augustSchedules: Schedule[] = [
    // August 1-2 (Sat-Sun)
    { date: '2026-08-01', dayOfWeek: 'SATURDAY', guide: 'Desiree', month: 8, year: 2026 },
    { date: '2026-08-02', dayOfWeek: 'SUNDAY', guide: 'Desiree', month: 8, year: 2026 },
    { date: '2026-08-02', dayOfWeek: 'SUNDAY', guide: 'Nabeel', month: 8, year: 2026 },
    { date: '2026-08-02', dayOfWeek: 'SUNDAY', guide: 'Umer', month: 8, year: 2026 },
    { date: '2026-08-02', dayOfWeek: 'SUNDAY', guide: 'Michael', month: 8, year: 2026 },
    { date: '2026-08-02', dayOfWeek: 'SUNDAY', guide: 'Tiziano', month: 8, year: 2026 },
    { date: '2026-08-02', dayOfWeek: 'SUNDAY', guide: 'Raza', month: 8, year: 2026 },
    { date: '2026-08-02', dayOfWeek: 'SUNDAY', guide: 'Gunzan', month: 8, year: 2026 },
    { date: '2026-08-02', dayOfWeek: 'SUNDAY', guide: 'Zack', month: 8, year: 2026 },
    { date: '2026-08-02', dayOfWeek: 'SUNDAY', guide: 'Rihab', month: 8, year: 2026 },
    { date: '2026-08-02', dayOfWeek: 'SUNDAY', guide: 'JO', month: 8, year: 2026 },
    { date: '2026-08-02', dayOfWeek: 'SUNDAY', guide: 'sherry', month: 8, year: 2026 },
    { date: '2026-08-02', dayOfWeek: 'SUNDAY', guide: 'Kristina', month: 8, year: 2026 },
    // Aug 3-9 week
    { date: '2026-08-03', dayOfWeek: 'MONDAY', guide: 'Desiree', month: 8, year: 2026 },
    { date: '2026-08-04', dayOfWeek: 'TUESDAY', guide: 'Desiree', month: 8, year: 2026 },
    { date: '2026-08-05', dayOfWeek: 'WEDNESDAY', guide: 'Umer', month: 8, year: 2026 },
    { date: '2026-08-06', dayOfWeek: 'THURSDAY', guide: 'Michael', month: 8, year: 2026 },
    { date: '2026-08-07', dayOfWeek: 'FRIDAY', guide: 'Tiziano', month: 8, year: 2026 },
    { date: '2026-08-08', dayOfWeek: 'SATURDAY', guide: 'Raza', month: 8, year: 2026 },
    { date: '2026-08-09', dayOfWeek: 'SUNDAY', guide: 'Gunzan', month: 8, year: 2026 },
    { date: '2026-08-09', dayOfWeek: 'SUNDAY', guide: 'Zack', month: 8, year: 2026 },
    { date: '2026-08-09', dayOfWeek: 'SUNDAY', guide: 'Rihab', month: 8, year: 2026 },
    { date: '2026-08-09', dayOfWeek: 'SUNDAY', guide: 'JO', month: 8, year: 2026 },
    { date: '2026-08-09', dayOfWeek: 'SUNDAY', guide: 'sherry', month: 8, year: 2026 },
    { date: '2026-08-09', dayOfWeek: 'SUNDAY', guide: 'Kristina', month: 8, year: 2026 },
    // Aug 10-16 week
    { date: '2026-08-10', dayOfWeek: 'MONDAY', guide: 'Desiree', month: 8, year: 2026 },
    { date: '2026-08-11', dayOfWeek: 'TUESDAY', guide: 'Desiree', month: 8, year: 2026 },
    { date: '2026-08-11', dayOfWeek: 'TUESDAY', guide: 'Desiree', month: 8, year: 2026 },
    { date: '2026-08-12', dayOfWeek: 'WEDNESDAY', guide: 'Nabeel', month: 8, year: 2026 },
    { date: '2026-08-12', dayOfWeek: 'WEDNESDAY', guide: 'Umer', month: 8, year: 2026 },
    { date: '2026-08-12', dayOfWeek: 'WEDNESDAY', guide: 'Umer', month: 8, year: 2026 },
    { date: '2026-08-13', dayOfWeek: 'THURSDAY', guide: 'Michael', month: 8, year: 2026 },
    { date: '2026-08-14', dayOfWeek: 'FRIDAY', guide: 'Tiziano', month: 8, year: 2026 },
    { date: '2026-08-14', dayOfWeek: 'FRIDAY', guide: 'Tiziano', month: 8, year: 2026 },
    { date: '2026-08-14', dayOfWeek: 'FRIDAY', guide: 'Tiziano', month: 8, year: 2026 },
    { date: '2026-08-15', dayOfWeek: 'SATURDAY', guide: 'Raza', month: 8, year: 2026 },
    { date: '2026-08-15', dayOfWeek: 'SATURDAY', guide: 'Raza', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Gunzan', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Gunzan', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Gunzan', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Zack', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Zack', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Zack', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Rihab', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Rihab', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Rihab', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Rihab', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Rihab', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'JO', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'JO', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'JO', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'sherry', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'sherry', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Kristina', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Kristina', month: 8, year: 2026 },
    { date: '2026-08-16', dayOfWeek: 'SUNDAY', guide: 'Kristina', month: 8, year: 2026 },
  ];

  // Hard-coded schedule data extracted from September 2026 PDF
  const septemberSchedules: Schedule[] = [
    // Sept 5-6 (Sat-Sun) from first page
    { date: '2026-09-05', dayOfWeek: 'SATURDAY', guide: 'Desiree', month: 9, year: 2026 },
    { date: '2026-09-05', dayOfWeek: 'SATURDAY', guide: 'Desiree', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Desiree', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Nabeel', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Umer', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Umer', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Umer', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Michael', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Michael', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Michael', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Tiziano', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Tiziano', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Reza', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Reza', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Gunzan', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Gunzan', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Gunzan', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Gunzan', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Zack', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Zack', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Rihab', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Rihab', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'JO', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'JO', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'JO', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'JO', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'sherry', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'sherry', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Kristina', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Kristina', month: 9, year: 2026 },
    { date: '2026-09-06', dayOfWeek: 'SUNDAY', guide: 'Kristina', month: 9, year: 2026 },
  ];

  const handlePreview = (month: number) => {
    const data = month === 8 ? augustSchedules : septemberSchedules;
    setPreview(data);
  };

  const handleImportAugust = async () => {
    setImporting(true);
    try {
      await seedSchedules(augustSchedules);
      setPreview([]);
    } catch (err) {
      console.error('Import error:', err);
    } finally {
      setImporting(false);
    }
  };

  const handleImportSeptember = async () => {
    setImporting(true);
    try {
      await seedSchedules(septemberSchedules);
      setPreview([]);
    } catch (err) {
      console.error('Import error:', err);
    } finally {
      setImporting(false);
    }
  };

  const currentCount = schedules.length;

  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className="text-xs font-medium cursor-pointer"
        style={{ color: theme.colors.primary }}
      >
        ← Back
      </button>

      <Card>
        <h3 className="text-sm font-bold mb-2" style={{ color: theme.colors.white }}>
          Schedule Import
        </h3>
        <p className="text-xs mb-3" style={{ color: theme.colors.grayDark }}>
          Current schedules in database: {currentCount}
        </p>
      </Card>

      <Card>
        <h4 className="text-xs font-semibold mb-2" style={{ color: theme.colors.white }}>
          August 2026
        </h4>
        <p className="text-[10px] mb-3" style={{ color: theme.colors.grayDark }}>
          {augustSchedules.length} entries to import
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePreview(8)}
            disabled={importing}
          >
            Preview
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleImportAugust}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </Card>

      <Card>
        <h4 className="text-xs font-semibold mb-2" style={{ color: theme.colors.white }}>
          September 2026
        </h4>
        <p className="text-[10px] mb-3" style={{ color: theme.colors.grayDark }}>
          {septemberSchedules.length} entries to import
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePreview(9)}
            disabled={importing}
          >
            Preview
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleImportSeptember}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </Card>

      {preview.length > 0 && (
        <Card>
          <h4 className="text-xs font-semibold mb-2" style={{ color: theme.colors.white }}>
            Preview ({preview.length} entries)
          </h4>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {preview.slice(0, 20).map((s, idx) => (
              <div key={idx} className="text-[10px] p-1.5 rounded" style={{ backgroundColor: theme.colors.bgCard }}>
                <span style={{ color: theme.colors.primary }}>{s.date}</span>
                {' '}
                <span style={{ color: theme.colors.grayDark }}>{s.dayOfWeek}</span>
                {' '}
                <span style={{ color: theme.colors.white }}>→ {s.guide}</span>
              </div>
            ))}
            {preview.length > 20 && (
              <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
                ... and {preview.length - 20} more
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
