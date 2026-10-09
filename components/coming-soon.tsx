import { PageHeader } from "@/components/page-header";
import { SectionChip } from "@/components/section-chip";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <SectionChip emoji="🌱">Coming soon:</SectionChip>
      <p className="mt-4 px-2 text-muted-foreground">
        This section is coming in a later phase.
      </p>
    </>
  );
}
