import { TranslatedText } from '@/i18n/LanguageContext';
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import type { StaffUser } from '@/models/user';

type DeleteMode = 'hard_delete' | 'soft_delete';

interface DeleteUserConfirmationModalProps {
  open: boolean;
  user: StaffUser | null;
  onClose: () => void;
  onConfirm: (option: DeleteMode) => Promise<void>;
  error?: string;
}

const OPTIONS: { value: DeleteMode; title: string; description: string }[] = [
  {
    value: 'soft_delete',
    title: 'Archive account',
    description: 'They can no longer sign in. Their requests, leave, check-ins and assignments are kept for records and auditing, but hidden from active views.',
  },
  {
    value: 'hard_delete',
    title: 'Delete permanently',
    description: 'Removes the account and all of its history: requests, leave, check-ins and assignments. This can’t be undone.',
  },
];

export default function DeleteUserConfirmationModal({
  open,
  user,
  onClose,
  onConfirm,
  error,
}: DeleteUserConfirmationModalProps) {
  const [selectedOption, setSelectedOption] = useState<DeleteMode>('soft_delete');
  const [isLoading, setIsLoading] = useState(false);

  // Start from the safer option each time a different person is picked.
  const [prevUserId, setPrevUserId] = useState(user?.id);
  if (user?.id !== prevUserId) {
    setPrevUserId(user?.id);
    setSelectedOption('soft_delete');
  }

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(selectedOption);
    } finally {
      setIsLoading(false);
    }
  };

  const isHard = selectedOption === 'hard_delete';

  return (
    <AlertDialog
      open={open && !!user}
      onOpenChange={(next) => { if (!next && !isLoading) onClose(); }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {user?.displayName ?? 'this person'}?</AlertDialogTitle>
          <AlertDialogDescription>
            Choose what happens to their account and history.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup
          value={selectedOption}
          onValueChange={(v) => setSelectedOption(v as DeleteMode)}
          disabled={isLoading}
          aria-label="What to do with this account"
        >
          {OPTIONS.map((opt) => (
            <FieldLabel key={opt.value} htmlFor={`delete-mode-${opt.value}`}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle className={opt.value === 'hard_delete' ? 'text-destructive' : undefined}>
                    {opt.title}
                  </FieldTitle>
                  <FieldDescription>{opt.description}</FieldDescription>
                </FieldContent>
                <RadioGroupItem value={opt.value} id={`delete-mode-${opt.value}`} />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>

        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}><TranslatedText text="Cancel" /></AlertDialogCancel>
          <Button
            variant={isHard ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading && <Spinner />}
            {isLoading
              ? (isHard ? 'Deleting…' : 'Archiving…')
              : (isHard ? 'Delete permanently' : 'Archive account')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
