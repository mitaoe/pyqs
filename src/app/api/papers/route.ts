import { getCatalogResponse } from "@/features/catalog/server/catalog"

export const dynamic = "force-static"
export const revalidate = 86400

export async function GET() {
  return Response.json(await getCatalogResponse())
}
