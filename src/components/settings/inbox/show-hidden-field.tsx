import { ToggleField } from '../shared/components/toggle-field';

export const ShowHiddenField = () => (
  <ToggleField
    name="inbox.showHidden"
    label="Show hidden pull requests"
    description="When off, hidden PRs disappear completely from every tab."
  />
);
