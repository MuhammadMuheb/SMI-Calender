import { theme } from '../config/theme';
import { alpha } from '../utils/themeColor';
import { Icons } from '../components/ui';

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: alpha(theme.colors.secondary, '20'), color: theme.colors.secondary }}
      >
        {Icons.shield}
      </div>
      <h2 className="text-base font-bold mb-1" style={{ color: theme.colors.white }}>
        Access Restricted
      </h2>
      <p className="text-xs max-w-[250px]" style={{ color: theme.colors.grayDark }}>
        You don't have permission to view this page. Contact your administrator if you believe this is an error.
      </p>
    </div>
  );
}
