import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { tests as testsApi } from '@/lib/api';
import { RunTriggerModal } from './RunTriggerModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search } from 'lucide-react';

interface RunTestSelectorProps {
  trigger: React.ReactNode;
  align?: 'start' | 'end' | 'center';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
}

export function RunTestSelector({
  trigger,
  align = 'start',
  side = 'bottom',
  sideOffset = 8,
}: RunTestSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedTest, setSelectedTest] = useState<{
    id: string;
    name: string;
    mode: 'autonomous' | 'deterministic';
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data, isLoading } = useQuery({
    queryKey: ['tests-selector', debouncedQuery],
    queryFn: () => testsApi.list({ q: debouncedQuery || undefined }),
    enabled: isOpen,
    placeholderData: keepPreviousData,
  });

  const tests = data?.items ?? [];

  const handleSelectTest = (test: any) => {
    setSelectedTest({ id: test.id, name: test.name, mode: test.mode });
    setIsModalOpen(true);
  };

  return (
    <>
      <DropdownMenu
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) { setSearchQuery(''); setDebouncedQuery(''); }
        }}
      >
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-64 surface-subtle border-border text-foreground rounded-[8px]"
          align={align}
          side={side}
          sideOffset={sideOffset}
        >
          {/* Search */}
          <div className="p-1 mb-1 border-b border-border/10 pb-2">
            <div className="relative flex items-center">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search test to run..."
                autoFocus
                className="w-full bg-muted/50 border border-transparent rounded-[8px] pl-7 pr-2 py-1.5 text-[12px] focus:outline-none focus:bg-background focus:border-border transition-colors placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Scrollable test list */}
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
            {isLoading && (
              <div className="px-2 py-4 text-[12px] text-muted-foreground text-center">
                Loading…
              </div>
            )}
            {!isLoading && tests.length === 0 && (
              <div className="px-2 py-4 text-[12px] text-muted-foreground text-center">
                {searchQuery ? 'No tests found' : 'No tests defined yet'}
              </div>
            )}
            {!isLoading && tests.length > 0 && (
              <>
                <div className="text-[10px] font-medium text-muted-foreground px-2 py-1 mb-0.5 uppercase tracking-wider">
                  {searchQuery ? 'Results' : 'All Tests'}
                </div>
                {tests.map((test: any) => (
                  <DropdownMenuItem
                    key={test.id}
                    onClick={() => handleSelectTest(test)}
                    className="flex flex-col items-start gap-0.5 p-2 rounded-[8px] cursor-pointer hover:bg-muted focus:bg-muted transition-colors outline-none mt-0.5"
                  >
                    <span className="text-[13px] font-medium text-foreground">{test.name}</span>
                    <span className="text-[11px] text-muted-foreground capitalize">{test.mode}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedTest && (
        <RunTriggerModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTest(null);
          }}
          testId={selectedTest.id}
          testName={selectedTest.name}
          mode={selectedTest.mode}
        />
      )}
    </>
  );
}
