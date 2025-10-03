import { notFound } from "next/navigation";
import ViewBuildClient from "@/components/ViewBuildClient";
import { getPublishedBuild, getRecentCommunityBuilds } from "@/lib/builds";

export async function generateMetadata({ searchParams }) {
  const buildId = searchParams?.id;
  if (!buildId) {
    return {
      title: "View a Build | Z-Build Order",
      description: "Preview published build orders migrated to Next.js.",
    };
  }

  const build = await getPublishedBuild(buildId);
  if (!build) {
    return {
      title: "Build not found | Z-Build Order",
      description: "The requested build could not be located.",
    };
  }

  return {
    title: `${build.title} | Z-Build Order`,
    description: `Match-up: ${build.matchup}. Authored by ${build.author}.`,
    openGraph: {
      title: build.title,
      description: `Match-up: ${build.matchup}. Authored by ${build.author}.`,
      type: "article",
    },
  };
}

export default async function ViewBuildPage({ searchParams }) {
  const buildId = searchParams?.id ?? null;

  const [build, recentBuilds] = await Promise.all([
    buildId ? getPublishedBuild(buildId) : Promise.resolve(null),
    getRecentCommunityBuilds({ limit: 5 }),
  ]);

  if (buildId && !build) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 pb-24 pt-12 text-slate-100">
      <ViewBuildClient build={build} recentBuilds={recentBuilds} />
    </main>
  );
}
