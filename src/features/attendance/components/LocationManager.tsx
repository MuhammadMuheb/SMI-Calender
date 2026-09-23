import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { fetchLocations } from '@/features/attendance/services/locationsService';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';

interface LocationRow {
  id: string;
  name: string;
  address: string | null;
  radius: number | null;
  allowedRoles: string[];
  isActive: boolean;
}

// Location docs have been written with both spellings over time.
function toRow(raw: Record<string, unknown>): LocationRow {
  const radius = raw.radius_meters ?? raw.radius;
  const roles = raw.allowed_roles ?? raw.allowedRoles;
  return {
    id: String(raw.id ?? ''),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Unnamed location',
    address: typeof raw.address === 'string' && raw.address ? raw.address : null,
    radius: typeof radius === 'number' ? radius : null,
    allowedRoles: Array.isArray(roles) ? roles.map(String) : [],
    isActive: raw.isActive === true,
  };
}

export default function LocationManager() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchLocations().then((data) => {
      if (cancelled) return;
      setLocations(data.map((l) => toRow(l as unknown as Record<string, unknown>)));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations"
        description="Places where staff can check in. Adding and editing locations isn’t available here yet."
      />

      {loading ? (
        <LoadingState label="Loading locations…" />
      ) : locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations yet"
          description="Check-in locations will be listed here once they’re set up."
        />
      ) : (
        <Card>
          <CardContent>
            <ItemGroup className="gap-1">
              {locations.map((loc) => (
                <Item key={loc.id} role="listitem" size="sm" className="px-0">
                  <ItemMedia variant="icon">
                    <MapPin className="text-muted-foreground" />
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle>{loc.name}</ItemTitle>
                    <ItemDescription>
                      {[loc.address, loc.radius != null ? `${loc.radius} m radius` : null].filter(Boolean).join(' · ') || 'No address'}
                    </ItemDescription>
                    {loc.allowedRoles.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {loc.allowedRoles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                      </div>
                    )}
                  </ItemContent>
                  <ItemActions>
                    <Badge variant={loc.isActive ? 'default' : 'outline'}>{loc.isActive ? 'Active' : 'Inactive'}</Badge>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
