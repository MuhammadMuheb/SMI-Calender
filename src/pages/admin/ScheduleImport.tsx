import { useState } from 'react';
import { Card, Button } from '../../components/ui';
import { theme } from '../../config/theme';
import { useAppData } from '../../context/AppDataContext';
import { augustSchedules, septemberSchedules } from '../../data/scheduleData';

interface ScheduleImportProps {
  onBack: () => void;
}

export default function ScheduleImport({ onBack }: ScheduleImportProps) {
  const { schedules, seedSchedules } = useAppData();
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<typeof augustSchedules>([]);

  const currentCount = schedules.length;

  const handlePreview = (month: number) => {
    const data = month === 8 ? augustSchedules : septemberSchedules;
    setPreview(data);
  };

  const handleImportAugust = async () => {
    setImporting(true);
    try {
      const existingSet = new Set(schedules.map(s => `${s.date}:${s.guide}`));
      const toImport = augustSchedules.filter(s => !existingSet.has(`${s.date}:${s.guide}`));
      if (toImport.length < augustSchedules.length) {
        console.warn(`Skipping ${augustSchedules.length - toImport.length} duplicate entries`);
      }
      if (toImport.length > 0) {
        await seedSchedules(toImport);
      }
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
      const existingSet = new Set(schedules.map(s => `${s.date}:${s.guide}`));
      const toImport = septemberSchedules.filter(s => !existingSet.has(`${s.date}:${s.guide}`));
      if (toImport.length < septemberSchedules.length) {
        console.warn(`Skipping ${septemberSchedules.length - toImport.length} duplicate entries`);
      }
      if (toImport.length > 0) {
        await seedSchedules(toImport);
      }
      setPreview([]);
    } catch (err) {
      console.error('Import error:', err);
    } finally {
      setImporting(false);
    }
  };

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
          {augustSchedules.length} entries extracted from PDF
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
          {septemberSchedules.length} entries extracted from PDF
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
