import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { useAssignedPRs } from '@src/hooks/use-assigned-prs';
import { useAuthoredPRs } from '@src/hooks/use-authored-prs';
import { useMergedPRs } from '@src/hooks/use-merged-prs';
import { collectOrgNames, normalizedOrgFilter } from '@common/pr-visibility';
import type { ExtensionSettings } from '../types';

export const OrgFilterField = () => {
  const { watch, setValue } = useFormContext<ExtensionSettings>();
  const { data: assigned = [] } = useAssignedPRs();
  const { data: authored = [] } = useAuthoredPRs();
  const { data: merged = [] } = useMergedPRs();
  const raw = watch('inbox.orgFilter') ?? '';
  const selected = normalizedOrgFilter(raw);

  const orgs = useMemo(
    () => collectOrgNames([...assigned, ...authored, ...merged]),
    [assigned, authored, merged]
  );

  const setOrg = (next: string) => {
    setValue('inbox.orgFilter', normalizedOrgFilter(next), { shouldDirty: true });
  };

  const selectValue =
    orgs.find((org) => org.toLowerCase() === selected.toLowerCase()) ?? selected;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-base-content">Organization</span>
        <span className="text-xs text-base-content/60">
          Only show pull requests from this GitHub organization. All shows every org.
        </span>
      </div>

      <select
        aria-label="Organization filter"
        className="select select-bordered select-sm w-full bg-base-200"
        value={selectValue}
        onChange={(event) => setOrg(event.target.value)}
      >
        <option value="">All</option>
        {orgs.map((org) => (
          <option key={org} value={org}>
            {org}
          </option>
        ))}
        {selected && !orgs.some((org) => org.toLowerCase() === selected.toLowerCase()) && (
          <option value={selected}>{selected}</option>
        )}
      </select>

      <input
        aria-label="Custom organization"
        className="input input-bordered input-sm w-full bg-base-200"
        placeholder="Or type an organization"
        value={raw}
        onChange={(event) =>
          setValue('inbox.orgFilter', event.target.value, { shouldDirty: true })
        }
        onBlur={() => {
          if (raw !== selected) setOrg(raw);
        }}
      />
    </div>
  );
};
