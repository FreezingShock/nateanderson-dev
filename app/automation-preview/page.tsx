import { notFound } from "next/navigation";
import { AutomationPreview } from "@/components/automation/preview";

export const metadata = {
  title: "Brasswork HUD preview",
  robots: { index: false, follow: false },
};

// Preview route for the Brasswork HUD. It is always a 404 in a production build, whatever
// AUTOMATION_PREVIEW says, so visitors never see it. Run it with `next dev`.
export default function AutomationPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <>
      {/* Preview only: hide the site chrome so the HUD is tested on its own. */}
      <style>{".cm-dock,.nv-top,.cm-pgauge,.cm-wipe,.sf-foot{display:none!important}"}</style>
      <AutomationPreview />
    </>
  );
}
