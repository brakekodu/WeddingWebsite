import { ui } from "@/components/ui/styles";
import type { SiteSection } from "@/content/site";
import { requireAdminPage } from "@/lib/auth/admin";
import { resolveSiteContent } from "@/lib/site/content";
import { SiteTextEditor } from "./site-text-editor";

export const metadata = { title: "Website text" };

export default async function WebsiteTextPage() {
  const { supabase } = await requireAdminPage();
  const { data, error } = await supabase.from("site_content").select("content").maybeSingle();
  if (error) console.error("site_content read failed:", error);
  const stored = (data?.content ?? {}) as Record<string, unknown>;
  const customized = Object.keys(stored).filter((k) => stored[k] && typeof stored[k] === "object") as SiteSection[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ui.h1}>Website text</h1>
        <p className="max-w-3xl text-sm text-stone-600">
          Edit the words guests read on the website. Each section saves on its own and goes live right away. Anything in{" "}
          <span className="font-mono">[square brackets]</span> is a placeholder still to be filled in. Event times and
          venues are in Events; photos are in Photos.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          Couldn&apos;t load the saved website text. Please refresh the page.
        </p>
      ) : (
        <SiteTextEditor initial={resolveSiteContent(stored)} customized={customized} />
      )}
    </div>
  );
}
