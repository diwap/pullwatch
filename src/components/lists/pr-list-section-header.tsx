interface PrListSectionHeaderProps {
  title: string;
  count?: number;
}

/** Shared subsection label for Today / To Review groupings. */
export const PrListSectionHeader = ({ title, count }: PrListSectionHeaderProps) => (
  <h3 className="px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
    {typeof count === 'number' ? `${title} (${count})` : title}
  </h3>
);
