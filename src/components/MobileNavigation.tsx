import { Link } from '@tanstack/react-router';
import { ChevronRight, Menu, Shield } from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '~/components/ui/sheet';
import { useAuth } from '~/hooks/useAuth';
import { signOut, useSession } from '~/lib/auth-client';
import { cn } from '~/lib/utils';

export function MobileNavigation() {
  const { data: session, isPending: isLoading } = useSession();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const navItems = [
    { to: '/', label: 'Dashboard', exact: true },
    { to: '/models', label: 'Models' },
    { to: '/rebalancing-groups', label: 'Rebalancing Groups' },
    { to: '/sleeves', label: 'Sleeves' },
    { to: '/planning', label: 'Planning' },
  ];

  const handleLinkClick = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col space-y-4 mt-8">
          {/* Main Navigation */}
          <nav className="flex flex-col space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={handleLinkClick}
                className={cn(
                  'text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                )}
                activeOptions={item.exact ? { exact: true } : undefined}
                activeProps={{
                  className: 'bg-blue-50 text-blue-600 border-l-4 border-blue-500',
                }}
              >
                {item.label}
              </Link>
            ))}

            {/* Settings Menu */}
            <div>
              <button
                type="button"
                onClick={() => setSettingsOpen(!settingsOpen)}
                className={cn(
                  'w-full flex items-center justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                )}
              >
                Settings
                <ChevronRight
                  className={cn('h-4 w-4 transition-transform', settingsOpen && 'rotate-90')}
                />
              </button>
              {settingsOpen && (
                <div className="ml-4 mt-2 space-y-1">
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={handleLinkClick}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Shield className="h-4 w-4" />
                      Admin
                    </Link>
                  )}
                  <Link
                    to="/data-feeds"
                    onClick={handleLinkClick}
                    className="block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    Data Feeds
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* Divider */}
          <div className="border-t border-gray-200 my-4" />

          {/* Authentication Section */}
          <div className="flex flex-col space-y-4">
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
            ) : session?.user ? (
              <div className="space-y-4">
                <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
                  <div className="text-sm text-gray-600">Welcome</div>
                  <div className="text-sm font-medium text-gray-900">
                    {session.user.name || session.user.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    handleLinkClick();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/login"
                  search={{ reset: '' }}
                  onClick={handleLinkClick}
                  className="block w-full px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  onClick={handleLinkClick}
                  className="block w-full px-3 py-2 text-sm text-center bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
