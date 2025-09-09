import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface Option {
  value: string;
  label: string;
}

interface VirtualizedSelectProps {
  options: Option[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

export function VirtualizedSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No option found.',
  className,
}: VirtualizedSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  const filteredOptions = React.useMemo(() => {
    console.log('VirtualizedSelect - options length:', options.length);
    console.log('VirtualizedSelect - searchValue:', searchValue);

    if (!options || options.length === 0) {
      return [];
    }

    const search = searchValue.toLowerCase().trim();

    if (!search) {
      // Return all options; virtualization keeps DOM light
      console.log('VirtualizedSelect - returning all options:', options.length);
      return options;
    }

    const filtered = options.filter(
      (option) =>
        option.value.toLowerCase().includes(search) || option.label.toLowerCase().includes(search),
    );
    console.log('VirtualizedSelect - filtered results:', filtered.length);
    return filtered;
  }, [options, searchValue]);

  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 5,
  });

  console.log('VirtualizedSelect - virtualItems:', virtualizer.getVirtualItems().length);

  const selectedOption = options.find((option) => option.value === value);

  // Force re-render when popover opens
  React.useEffect(() => {
    if (open && parentRef.current) {
      // Force virtualizer to recalculate when opened
      virtualizer.measure();
    }
  }, [open, virtualizer]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <div className="flex flex-col">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="flex h-10 w-full bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {options.length === 0 ? (
            <div className="py-6 text-center text-sm">Loading options...</div>
          ) : filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm">{emptyMessage}</div>
          ) : (
            <div ref={parentRef} className="max-h-[300px] overflow-auto p-1">
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const option = filteredOptions[virtualItem.index];
                  const isSelected = value === option.value;

                  return (
                    <div
                      key={option.value}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <button
                        type="button"
                        className={cn(
                          'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
                          'hover:bg-accent hover:text-accent-foreground',
                          'focus:bg-accent focus:text-accent-foreground',
                          isSelected && 'bg-accent text-accent-foreground',
                        )}
                        onClick={() => {
                          onValueChange?.(option.value);
                          setOpen(false);
                          setSearchValue('');
                        }}
                      >
                        <Check
                          className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
                        />
                        {option.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
