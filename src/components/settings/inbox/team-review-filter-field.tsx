import { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { chromeExtensionService } from '@common/chrome-extension-service';
import { collectRequestedTeamSlugs, normalizeTeamSlug } from '@common/review-request-kind';
import { isExtensionContext } from '@src/utils/is-extension-context';
import { useAssignedPRs } from '@src/hooks/use-assigned-prs';
import { useTodayPRs } from '@src/hooks/use-today-prs';
import { normalizeTeamReviewSlugs } from '@common/extension-settings-defaults';
import type { ExtensionSettings } from '../types';

type ViewerTeam = { slug: string; name: string };

/**
 * Allowlist which org teams appear when the popup Teams toggle is on.
 * Empty `inbox.teamReviewSlugs` = all teams (default).
 */
export const TeamReviewFilterField = () => {
  const { watch, setValue } = useFormContext<ExtensionSettings>();
  const selected = normalizeTeamReviewSlugs(watch('inbox.teamReviewSlugs'));
  const allTeams = selected.length === 0;

  const { data: assigned = [] } = useAssignedPRs();
  const { data: today = [] } = useTodayPRs();
  const [viewerTeams, setViewerTeams] = useState<ViewerTeam[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!isExtensionContext()) {
      setLoadState('ready');
      return;
    }
    let cancelled = false;
    setLoadState('loading');
    void chromeExtensionService.githubToken
      .listViewerTeams()
      .then((teams) => {
        if (cancelled) return;
        setViewerTeams(
          teams
            .map((team) => ({
              slug: normalizeTeamSlug(team.slug) ?? '',
              name: team.name?.trim() || team.slug,
            }))
            .filter((team) => Boolean(team.slug))
        );
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fallbackSlugs = useMemo(
    () => collectRequestedTeamSlugs([...assigned, ...today]),
    [assigned, today]
  );

  const options = useMemo(() => {
    const bySlug = new Map<string, ViewerTeam>();
    for (const team of viewerTeams) bySlug.set(team.slug, team);
    for (const slug of fallbackSlugs) {
      if (!bySlug.has(slug)) bySlug.set(slug, { slug, name: slug });
    }
    for (const slug of selected) {
      if (!bySlug.has(slug)) bySlug.set(slug, { slug, name: slug });
    }
    return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  }, [viewerTeams, fallbackSlugs, selected]);

  const setAllTeams = () => {
    setValue('inbox.teamReviewSlugs', [], { shouldDirty: true });
  };

  const toggleTeam = (slug: string, checked: boolean) => {
    const normalized = normalizeTeamSlug(slug);
    if (!normalized) return;
    if (allTeams) {
      // Leaving "all" → start allowlist with this one team (or every other if unchecking).
      if (checked) {
        setValue('inbox.teamReviewSlugs', [normalized], { shouldDirty: true });
        return;
      }
      const others = options.map((t) => t.slug).filter((s) => s !== normalized);
      setValue('inbox.teamReviewSlugs', others, { shouldDirty: true });
      return;
    }
    const next = checked
      ? normalizeTeamReviewSlugs([...selected, normalized])
      : selected.filter((s) => s !== normalized);
    // Selecting every known team collapses back to "all".
    if (options.length > 0 && next.length >= options.length) {
      setValue('inbox.teamReviewSlugs', [], { shouldDirty: true });
      return;
    }
    setValue('inbox.teamReviewSlugs', next, { shouldDirty: true });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-base-content">Team reviews</span>
        <span className="text-xs text-base-content/60">
          When the popup Teams toggle is on, only these teams appear in Today and To Review. Default
          is all teams. Needs a token with <code className="text-[11px]">read:org</code> to list
          memberships.
        </span>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          className="checkbox checkbox-sm checkbox-primary"
          checked={allTeams}
          onChange={(event) => {
            if (event.target.checked) setAllTeams();
            else if (options[0]) toggleTeam(options[0].slug, true);
          }}
          aria-label="All teams"
        />
        <span>All teams</span>
      </label>

      {loadState === 'loading' && (
        <span className="text-xs text-base-content/50">Loading your teams…</span>
      )}
      {loadState === 'error' && options.length === 0 && (
        <span className="text-xs text-base-content/50">
          Could not load teams. Save a token with org access, or wait until team PRs appear.
        </span>
      )}
      {options.length > 0 && (
        <ul className="flex flex-col gap-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
          {options.map((team) => {
            const checked = allTeams || selected.includes(team.slug);
            return (
              <li key={team.slug}>
                <label className="flex items-start gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm mt-0.5"
                    checked={checked}
                    onChange={(event) => toggleTeam(team.slug, event.target.checked)}
                    aria-label={team.slug}
                  />
                  <span className="flex flex-col min-w-0">
                    <span className="truncate">{team.name}</span>
                    {team.name.toLowerCase() !== team.slug && (
                      <span className="text-xs text-base-content/50 truncate">{team.slug}</span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {!allTeams && selected.length > 0 && (
        <button
          type="button"
          className="btn btn-ghost btn-xs self-start text-base-content/60"
          onClick={setAllTeams}
        >
          Reset to all teams
        </button>
      )}
    </div>
  );
};
