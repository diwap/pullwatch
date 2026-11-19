---
name: pullwatch-map
description: >-
  Map of the Pullwatch Chrome extension (popup, settings, service worker,
  storage, org filter, hidden PRs, token API, Today tab, row actions). Use when
  changing Pullwatch UI, inbox filters, hide/show, settings, badges,
  notifications, parsers, background fetch, or GitHub API actions — before
  searching the repo.
---

# Pullwatch map

Fork of `dragosdev-code/pullwatch`. `origin` is `diwap/pullwatch`, `upstream` is the original. Chrome MV3 extension: React popup plus a service worker.

HTML scrape (session cookies) fills To Review / Authored / Merged. Today seeds from those lists (authored created today + pending assigned touched today), then merges GraphQL search when a token is present. Review search must use `user-review-requested:@me` (not `review-requested:@me`, which includes every team you are on). Token also powers check status and write actions. PR details GraphQL reads `viewerDefaultMergeMethod` from Repository (not PullRequest) or the whole details sync fails and ⋯ only shows Hide. `GET /user` can pass while private-org search returns [] if SAML SSO is not authorized on the token — local seed covers that.

Reload unpacked `dist/` after `npm run build`. `npm run dev` is popup-only. Tests: `npm run test:run`.

## Data flow

Alarm → HTML scrape → local PR list keys. After each wave: rebuild Today from scrape + optional GraphQL; if token: batch PR details → `github_today_prs` / `pr_details`. Popup never calls GitHub; it reads storage and sends RPC for actions.

Store full scraped lists. Filter only at display, badge, and notification time (`extension/common/pr-visibility.ts`). Today seed helpers live in `extension/common/today-prs.ts`.

## Where to edit

| Change | Go here |
| --- | --- |
| Tabs (Today first) | `src/app.tsx`, `src/constants/tabs.ts` |
| Today list | `src/components/lists/today-list.tsx`, `src/hooks/use-today-prs.ts` |
| To Review / Authored / Merged | `src/components/lists/assigned-list.tsx`, `authored-list.tsx`, `merged-list.tsx` |
| Hidden section | `src/components/lists/hidden-pr-section.tsx` (only when `inbox.showHidden`) |
| PR row, checks, labels, ⋯ menu | `src/components/pr-item/pr-item-shell.tsx`, `components/pr-item-labels.tsx`, `components/pr-row-menu.tsx`, `components/check-status-icon.tsx` |
| Menu visibility rules | `extension/common/pr-menu-actions.ts` (`getPrMenuActions`) |
| Org / date / showHidden / token state | `src/hooks/inbox-preferences.tsx` |
| Settings page | `src/components/settings/shell/settings-page.tsx` |
| Org / date / show-hidden controls | `src/components/settings/inbox/*` |
| Token field | `src/components/settings/github-token/github-token-field.tsx` |
| Settings form shape | `src/components/settings/types.ts` |
| Stored settings merge | `extension/common/types.ts`, `extension/common/extension-settings-defaults.ts` |
| Org/date/hidden helpers | `extension/common/pr-visibility.ts` |
| PR URL parse | `extension/common/pr-url.ts` |
| Storage keys | `extension/common/constants.ts` |
| Runtime actions | `extension/common/runtime-actions.ts` (`SETTINGS_ACTION`, `GITHUB_TOKEN_ACTION`, `PR_ACTION`) |
| Popup RPC clients | `extension/common/chrome/clients/*`, `chrome-extension-service.ts` |
| HTML fetch | `extension/background/services/GitHubService.ts` |
| Token API / Today / details / actions | `extension/background/services/GitHubApiService.ts` |
| Wire services | `extension/background/core/ServiceContainer.ts`, `ServiceMap.ts` |
| Message handlers + post-wave enrich | `extension/background/services/EventService.ts` |
| Badge count | `extension/background/services/PRService.ts` |
| Notification filter | `extension/background/services/NotificationService.ts` |

Popup must not import `extension/background`. Shared logic goes in `extension/common`.

## Inbox behavior

- **Org filter** `settings.inbox.orgFilter` (sync). Empty / `"all"` = every org.
- **Date range** `settings.inbox.dateRange`: `all` \| `7d` \| `30d` \| `1y` on `createdAt`. Today tab skips this.
- **Show hidden** `settings.inbox.showHidden` default `false`. Hidden ids in local `hidden_pr_ids`. When off, hidden rows are gone (no Hidden section).
- **Token** local `github_api_token`. Needed for checks, mentions in Today, and ⋯ actions beyond Hide. Today still fills from scraped Authored / To Review without a token.
- **Today empty + Authored > 0**: usually SSO-unauthorized token search, or scrape timestamps not “today”; authorize the org on the token page, then refresh.
- Tab counts use org + date + hidden (Today skips date). Toolbar badge = visible Today ∪ pending To Review.

## Storage

| Area | Keys |
| --- | --- |
| local | `github_assigned_prs`, `github_authored_prs`, `github_merged_prs`, `github_today_prs`, `hidden_pr_ids`, `pr_details`, `github_api_token` |
| sync | `settings` |

`PullRequest.id` is the GitHub permalink URL.
