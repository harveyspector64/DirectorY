import { readFileSync } from "fs";
import path from "path";
import type { Director } from "../../../lib/types";
import DirectorDetailClient from "../../../components/DirectorDetailClient";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  const filePath = path.join(process.cwd(), "public", "data", "atlas", "directors.json");
  const raw = readFileSync(filePath, "utf-8");
  const directors = JSON.parse(raw) as Director[];
  return directors.map((director) => ({
    id: director.id,
  }));
}

export default function DirectorDetailPage({ params }: { params: { id: string } }) {
  return <DirectorDetailClient directorId={decodeURIComponent(params.id)} />;
}
