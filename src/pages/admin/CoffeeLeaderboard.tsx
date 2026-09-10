
import { Card, Badge } from '../../components/ui';
import { theme } from '../../config/theme';
import { useNotifications } from '../../context/NotificationContext';
import { useAppData } from '../../context/AppDataContext';

interface Props { onBack: () => void }

interface CoffeeStats {
  userId: string;
  name: string;
  offered: number;
  accepted: number;
  received: number;
  receivedAccepted: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function CoffeeLeaderboard({ onBack }: Props) {
  const { notifications } = useNotifications();
  const { users } = useAppData();

  // Compute stats from notifications
  const stats: CoffeeStats[] = users.filter((u) => u.isActive).map((u) => {
    // Coffees this user OFFERED (they created coffee_offer notifications for others)
    const offered = notifications.filter(
      (n) => n.type === 'coffee_offer' && n.entityId === u.id,
    ).length;

    // Of those, how many were accepted
    const accepted = notifications.filter(
      (n) => n.type === 'coffee_offer' && n.entityId === u.id && n.confirmStatus === 'confirmed',
    ).length;

    // Coffees this user RECEIVED
    const received = notifications.filter(
      (n) => n.type === 'coffee_offer' && n.userId === u.id,
    ).length;

    // Of those, how many they accepted
    const receivedAccepted = notifications.filter(
      (n) => n.type === 'coffee_offer' && n.userId === u.id && n.confirmStatus === 'confirmed',
    ).length;

    return { userId: u.id, name: u.displayName, offered, accepted, received, receivedAccepted };
  });

  // Sort by total coffees shared (offered+accepted + received+accepted)
  const sorted = [...stats]
    .filter((s) => s.offered > 0 || s.received > 0)
    .sort((a, b) => (b.accepted + b.receivedAccepted) - (a.accepted + a.receivedAccepted));

  const totalCoffees = notifications.filter(
    (n) => n.type === 'coffee_offer' && n.confirmStatus === 'confirmed',
  ).length;

  const totalOffered = notifications.filter((n) => n.type === 'coffee_offer').length;
  const totalPending = notifications.filter(
    (n) => n.type === 'coffee_offer' && n.confirmStatus === 'pending',
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
        <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>☕ Coffee Leaderboard</h2>
        
      </div>

      <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
        Team coffee stats — who's buying the most rounds?
      </p>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}>
          <p className="text-lg font-bold" style={{ color: theme.colors.warning }}>{totalOffered}</p>
          <p className="text-[9px]" style={{ color: theme.colors.grayDark }}>Offered</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}>
          <p className="text-lg font-bold" style={{ color: theme.colors.primary }}>{totalCoffees}</p>
          <p className="text-[9px]" style={{ color: theme.colors.grayDark }}>Accepted</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}>
          <p className="text-lg font-bold" style={{ color: theme.colors.grayDark }}>{totalPending}</p>
          <p className="text-[9px]" style={{ color: theme.colors.grayDark }}>Pending</p>
        </div>
      </div>

      {/* Leaderboard */}
      {sorted.length === 0 ? (
        <Card>
          <div className="h-20 flex items-center justify-center rounded-lg" style={{ border: `1px dashed ${theme.colors.border}` }}>
            <p className="text-xs" style={{ color: theme.colors.grayDark }}>No coffees yet. The team needs to warm up ☕</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((s, i) => (
            <Card key={s.userId}>
              <div className="flex items-center gap-3">
                <div className="text-lg w-7 text-center flex-shrink-0">
                  {i < 3 ? MEDALS[i] : <span className="text-xs" style={{ color: theme.colors.grayDark }}>#{i + 1}</span>}
                </div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: theme.colors.warning + '20', color: theme.colors.warning }}>
                  {s.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>{s.name}</p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-[9px]" style={{ color: theme.colors.grayDark }}>
                      Gave: <span style={{ color: theme.colors.warning }}>{s.offered}</span> ({s.accepted} accepted)
                    </span>
                    <span className="text-[9px]" style={{ color: theme.colors.grayDark }}>
                      Got: <span style={{ color: theme.colors.primary }}>{s.received}</span> ({s.receivedAccepted} accepted)
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: theme.colors.warning }}>
                    {s.accepted + s.receivedAccepted}
                  </p>
                  <p className="text-[8px]" style={{ color: theme.colors.grayDark }}>shared</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Recent activity */}
      {notifications.filter((n) => n.type === 'coffee_offer' || n.type === 'coffee_response').length > 0 && (
        <>
          <h3 className="text-xs font-semibold mt-4" style={{ color: theme.colors.white }}>Recent Coffee Activity</h3>
          <div className="space-y-1">
            {notifications
              .filter((n) => n.type === 'coffee_offer' || n.type === 'coffee_response')
              .slice(0, 15)
              .map((n) => (
                <div key={n.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                  style={{ backgroundColor: theme.colors.bgCard }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]">
                      {n.type === 'coffee_offer' ? '☕' : n.confirmStatus === 'confirmed' ? '✓' : '✕'}
                    </span>
                    <p className="text-[10px]" style={{ color: theme.colors.gray }}>{n.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {n.confirmStatus === 'confirmed' && <Badge color="success" size="xs">Accepted</Badge>}
                    {n.confirmStatus === 'rejected' && <Badge color="danger" size="xs">Passed</Badge>}
                    {n.confirmStatus === 'pending' && <Badge color="warning" size="xs">Waiting</Badge>}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
