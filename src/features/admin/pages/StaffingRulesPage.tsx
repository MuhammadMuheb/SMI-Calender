import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Lock, Minus, Plus, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import { useAppData } from '@/app/AppDataContext';
import { useAuth } from '@/features/auth/AuthContext';
import type { StaffingEnforcement, StaffingRule } from '@/models/staffing';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle,
} from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** dayOfWeek on a rule: 0 = Monday … 6 = Sunday, null = every day. */
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ENFORCEMENT: Record<StaffingEnforcement, { label: string; description: string }> = {
  warning_only: {
    label: 'Warn only',
    description: 'Managers see a warning but can still approve the request.',
  },
  hard_block: {
    label: 'Block approval',
    description: 'Requests that would drop coverage below the minimum can’t be approved.',
  },
};

const dayLabel = (day: number | null) =>
  day === null ? 'Every day' : DAY_NAMES[day] ?? `Day ${day}`;

function EnforcementSelect({ rule, onChange }: { rule: StaffingRule; onChange: (e: StaffingEnforcement) => void }) {
  return (
    <Select value={rule.enforcement} onValueChange={(v) => onChange(v as StaffingEnforcement)}>
      <SelectTrigger size="sm" className="w-36" aria-label="Enforcement">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ENFORCEMENT) as StaffingEnforcement[]).map((e) => (
          <SelectItem key={e} value={e}>{ENFORCEMENT[e].label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface Props { onBack?: () => void }

export default function StaffingRulesPage({ onBack }: Props) {
  const { user } = useAuth();
  const { staffingRules, jobRoles, roleAssignments, addStaffingRule, updateStaffingRule, deleteStaffingRule } = useAppData();
  const [showAdd, setShowAdd] = useState(false);
  const [formRoleId, setFormRoleId] = useState('');
  const [formDay, setFormDay] = useState<number | null>(null);
  const [formMin, setFormMin] = useState(1);
  const [formEnf, setFormEnf] = useState<StaffingEnforcement>('warning_only');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StaffingRule | null>(null);

  const actorName = user?.displayName ?? 'Admin';

  const roleName = (id: string) => jobRoles.find((r) => r.id === id)?.name ?? id;
  const roleColor = (id: string) => jobRoles.find((r) => r.id === id)?.color;
  const headcountFor = (jobRoleId: string) => roleAssignments.filter((a) => a.jobRoleId === jobRoleId).length;

  const sortedRules = useMemo(() => {
    const nameOf = (id: string) => jobRoles.find((r) => r.id === id)?.name ?? id;
    return [...staffingRules].sort((a, b) =>
      nameOf(a.jobRoleId).localeCompare(nameOf(b.jobRoleId))
      || (a.dayOfWeek ?? -1) - (b.dayOfWeek ?? -1));
  }, [staffingRules, jobRoles]);

  // Roles that have at least one rule, in rule order, for the weekly overview.
  const coveredRoleIds = useMemo(
    () => Array.from(new Set(sortedRules.map((r) => r.jobRoleId))),
    [sortedRules],
  );

  /** All matching rules apply on a day, so the strictest minimum wins. */
  const coverageFor = (jobRoleId: string, day: number) => {
    const applicable = staffingRules.filter(
      (r) => r.jobRoleId === jobRoleId && (r.dayOfWeek === null || r.dayOfWeek === day),
    );
    if (applicable.length === 0) return null;
    return {
      min: Math.max(...applicable.map((r) => r.minimumRequired)),
      hard: applicable.some((r) => r.enforcement === 'hard_block'),
    };
  };

  const openAdd = () => {
    setFormRoleId(''); setFormDay(null); setFormMin(1); setFormEnf('warning_only');
    setShowAdd(true);
  };

  const closeAdd = () => {
    if (saving) return;
    setShowAdd(false);
  };

  const handleAdd = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!formRoleId) return;
    setSaving(true);
    try {
      await addStaffingRule({
        jobRoleId: formRoleId, dayOfWeek: formDay, minimumRequired: formMin, enforcement: formEnf,
      }, actorName);
      toast.success('Rule added');
      setShowAdd(false); setFormRoleId(''); setFormDay(null); setFormMin(1);
    } catch {
      toast.error('Couldn’t add the rule. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const changeEnforcement = async (rule: StaffingRule, enforcement: StaffingEnforcement) => {
    if (enforcement === rule.enforcement) return;
    try {
      await updateStaffingRule(rule.id, { enforcement }, actorName);
      toast.success(`Rule set to “${ENFORCEMENT[enforcement].label.toLowerCase()}”`);
    } catch {
      toast.error('Couldn’t update the rule. Try again.');
    }
  };

  const handleDelete = async (rule: StaffingRule) => {
    setConfirmDelete(null);
    try {
      await deleteStaffingRule(rule.id, actorName);
      toast.success('Rule deleted');
    } catch {
      toast.error('Couldn’t delete the rule. Try again.');
    }
  };

  const formHeadcount = formRoleId ? headcountFor(formRoleId) : 0;

  const addButton = (
    <Button onClick={openAdd} disabled={jobRoles.length === 0}>
      <Plus data-icon="inline-start" />
      Add rule
    </Button>
  );

  const renderRoleName = (id: string) => {
    const color = roleColor(id);
    return (
      <span className="flex items-center gap-2">
        <span
          className={cn('size-2.5 shrink-0 rounded-full', !color && 'bg-muted-foreground')}
          style={color ? { backgroundColor: color } : undefined}
          aria-hidden="true"
        />
        <span className="font-medium">{roleName(id)}</span>
      </span>
    );
  };

  const maxOff = (rule: StaffingRule) => Math.max(0, headcountFor(rule.jobRoleId) - rule.minimumRequired);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staffing rules"
        description="The minimum number of people each job role needs on a day. Leave requests are checked against these."
        onBack={onBack}
        actions={addButton}
      />

      {staffingRules.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No staffing rules yet"
          description={jobRoles.length === 0
            ? 'Add job roles first, then set how many people each one needs per day.'
            : 'Add a rule to make sure enough people stay on shift when others take time off.'}
          action={jobRoles.length > 0 ? addButton : undefined}
        />
      ) : (
        <>
          {/* Desktop: weekly overview */}
          <Card className="hidden gap-0 pb-0 md:flex">
            <CardHeader className="border-b">
              <CardTitle>Weekly minimums</CardTitle>
              <CardDescription>
                The strictest rule that applies on each day. <Lock className="inline size-3.5 align-[-2px]" aria-hidden="true" /> means approvals below it are blocked.
              </CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Job role</TableHead>
                  <TableHead className="text-right">People</TableHead>
                  {DAY_SHORT.map((d, i) => (
                    <TableHead key={d} className="w-16 text-center">
                      <abbr title={DAY_NAMES[i]} className="no-underline">{d}</abbr>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {coveredRoleIds.map((roleId) => {
                  const headcount = headcountFor(roleId);
                  return (
                    <TableRow key={roleId}>
                      <TableCell className="pl-4">{renderRoleName(roleId)}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">{headcount}</TableCell>
                      {DAY_SHORT.map((d, day) => {
                        const cov = coverageFor(roleId, day);
                        if (!cov) {
                          return (
                            <TableCell key={d} className="text-center text-muted-foreground">
                              <span aria-label="No rule">–</span>
                            </TableCell>
                          );
                        }
                        const impossible = cov.min > headcount;
                        return (
                          <TableCell key={d} className="text-center tabular-nums">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  tabIndex={0}
                                  className={cn(
                                    'inline-flex items-center justify-center gap-1 rounded-md px-1.5 py-0.5 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                                    impossible && 'bg-destructive/10 text-destructive',
                                  )}
                                >
                                  {cov.min}
                                  {cov.hard && <Lock className="size-3 text-muted-foreground" aria-label="Blocks approval" />}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {impossible
                                  ? `Needs ${cov.min}, but only ${headcount} ${headcount === 1 ? 'person has' : 'people have'} this role`
                                  : `At least ${cov.min} on ${DAY_NAMES[day]} · up to ${headcount - cov.min} can be off`}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Desktop: rules */}
          <Card className="hidden gap-0 pb-0 md:flex">
            <CardHeader className="border-b">
              <CardTitle>Rules</CardTitle>
              <CardDescription>Each rule applies to one day or to every day.</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Job role</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead className="text-right">Minimum</TableHead>
                  <TableHead className="text-right">Can be off at once</TableHead>
                  <TableHead>Enforcement</TableHead>
                  <TableHead className="w-12 pr-4"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="pl-4">{renderRoleName(rule.jobRoleId)}</TableCell>
                    <TableCell>{dayLabel(rule.dayOfWeek)}</TableCell>
                    <TableCell className="text-right tabular-nums">{rule.minimumRequired}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={cn(maxOff(rule) === 0 && 'text-warning')}>{maxOff(rule)}</span>
                      <span className="text-muted-foreground"> of {headcountFor(rule.jobRoleId)}</span>
                    </TableCell>
                    <TableCell>
                      <EnforcementSelect rule={rule} onChange={(e) => changeEnforcement(rule, e)} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDelete(rule)}
                        aria-label={`Delete rule for ${roleName(rule.jobRoleId)}, ${dayLabel(rule.dayOfWeek)}`}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: stacked rules */}
          <Card className="gap-0 divide-y py-0 md:hidden">
            {sortedRules.map((rule) => (
              <div key={rule.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  {renderRoleName(rule.jobRoleId)}
                  <p className="text-sm">
                    At least <span className="font-medium tabular-nums">{rule.minimumRequired}</span> · {dayLabel(rule.dayOfWeek)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {headcountFor(rule.jobRoleId)} in this role, so up to{' '}
                    <span className={cn('font-medium text-foreground', maxOff(rule) === 0 && 'text-warning')}>{maxOff(rule)}</span>{' '}
                    can be off at once.
                  </p>
                  <div className="pt-1">
                    <EnforcementSelect rule={rule} onChange={(e) => changeEnforcement(rule, e)} />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDelete(rule)}
                  aria-label={`Delete rule for ${roleName(rule.jobRoleId)}, ${dayLabel(rule.dayOfWeek)}`}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </Card>
        </>
      )}

      <ResponsiveDialog
        open={showAdd}
        onOpenChange={(open) => { if (!open) closeAdd(); }}
        title="Add staffing rule"
        description="Set how many people with a job role must stay on shift."
        footer={(
          <>
            <Button variant="outline" size="lg" onClick={closeAdd} disabled={saving}>Cancel</Button>
            <Button type="submit" form="staffing-rule-form" size="lg" disabled={!formRoleId || saving}>Add rule</Button>
          </>
        )}
      >
        <form id="staffing-rule-form" onSubmit={handleAdd} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rule-role">Job role</FieldLabel>
              <Select value={formRoleId} onValueChange={setFormRoleId}>
                <SelectTrigger id="rule-role" className="w-full data-[size=default]:h-10">
                  <SelectValue placeholder="Choose a job role" />
                </SelectTrigger>
                <SelectContent>
                  {jobRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden="true" />
                      {r.name}
                      {r.isHidden && <span className="text-muted-foreground">(hidden)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="rule-day">Day</FieldLabel>
              <Select
                value={formDay === null ? 'all' : String(formDay)}
                onValueChange={(v) => setFormDay(v === 'all' ? null : Number(v))}
              >
                <SelectTrigger id="rule-day" className="w-full data-[size=default]:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Every day</SelectItem>
                  {DAY_NAMES.map((name, d) => <SelectItem key={d} value={String(d)}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel id="rule-min-label">Minimum people</FieldLabel>
              <div className="flex items-center gap-3" role="group" aria-labelledby="rule-min-label">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  onClick={() => setFormMin(Math.max(1, formMin - 1))}
                  disabled={formMin <= 1}
                  aria-label="Decrease minimum"
                >
                  <Minus />
                </Button>
                <span className="w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">{formMin}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  onClick={() => setFormMin(formMin + 1)}
                  aria-label="Increase minimum"
                >
                  <Plus />
                </Button>
              </div>
              {formRoleId && (
                formMin > formHeadcount ? (
                  <p className="flex items-start gap-1.5 text-sm text-destructive">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    Only {formHeadcount} {formHeadcount === 1 ? 'person has' : 'people have'} this role, so nobody could ever take this day off.
                  </p>
                ) : (
                  <FieldDescription>
                    {formHeadcount} {formHeadcount === 1 ? 'person has' : 'people have'} this role, so up to{' '}
                    <span className="font-medium text-foreground">{Math.max(0, formHeadcount - formMin)}</span>{' '}
                    can take leave on the same day.
                  </FieldDescription>
                )
              )}
            </Field>

            <FieldSet>
              <FieldLegend variant="label">When a request would break this rule</FieldLegend>
              <RadioGroup value={formEnf} onValueChange={(v) => setFormEnf(v as StaffingEnforcement)}>
                {(Object.keys(ENFORCEMENT) as StaffingEnforcement[]).map((e) => (
                  <FieldLabel key={e} htmlFor={`rule-enf-${e}`}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{ENFORCEMENT[e].label}</FieldTitle>
                        <FieldDescription>{ENFORCEMENT[e].description}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={e} id={`rule-enf-${e}`} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
        </form>
      </ResponsiveDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && (
                <>
                  {roleName(confirmDelete.jobRoleId)} will no longer need at least {confirmDelete.minimumRequired}{' '}
                  {confirmDelete.minimumRequired === 1 ? 'person' : 'people'} on {confirmDelete.dayOfWeek === null ? 'every day' : DAY_NAMES[confirmDelete.dayOfWeek]}.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { if (confirmDelete) void handleDelete(confirmDelete); }}>
              Delete rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
