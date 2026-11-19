import { useFormContext } from 'react-hook-form';
import type { InboxDateRange } from '@common/types';
import {
  SegmentedControl,
  type SegmentedOption,
} from '../../ui/segmented-control/segmented-control';
import type { ExtensionSettings } from '../types';

const OPTIONS: readonly SegmentedOption<InboxDateRange>[] = [
  { value: 'all', label: 'All' },
  { value: '1y', label: '1 year' },
  { value: '30d', label: '30 days' },
  { value: '7d', label: '7 days' },
];

export const DateRangeField = () => {
  const { watch, setValue } = useFormContext<ExtensionSettings>();
  const value = (watch('inbox.dateRange') ?? 'all') as InboxDateRange;

  return (
    <SegmentedControl<InboxDateRange>
      label="Created within"
      hint="Hide older pull requests from every tab except Today"
      options={OPTIONS}
      value={value}
      onChange={(next) => setValue('inbox.dateRange', next, { shouldDirty: true })}
    />
  );
};
