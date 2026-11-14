import { redirect } from "next/navigation";

type ShareSearchParams = {
  title?: string | string[];
  text?: string | string[];
  url?: string | string[];
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export const dynamic = "force-dynamic";

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<ShareSearchParams>;
}) {
  const parameters = await searchParams;
  const sharedText = [
    firstValue(parameters.title),
    firstValue(parameters.text),
    firstValue(parameters.url),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);

  if (!sharedText.trim()) {
    redirect("/analyze");
  }

  const query = new URLSearchParams({
    text: sharedText,
    autoAnalyze: "1",
  });
  redirect(`/analyze?${query.toString()}`);
}
