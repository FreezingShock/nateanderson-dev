import { notFound } from "next/navigation";
import { AutomationPreview } from "@/components/automation/preview";

export const metadata = {
  title: "Brasswork HUD preview",
  robots: { index: false, follow: false },
};

// Preview route for the Brasswork HUD. It is hidden in production unless
// AUTOMATION_PREVIEW=1 is set at build time, so visitors never see it.
export default function AutomationPreviewPage() {
  if (process.env.NODE_ENV === "production" && process.env.AUTOMATION_PREVIEW !== "1") {
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
