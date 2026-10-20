import { createHash } from "node:crypto"
import { getCatalogResponse } from "@/features/catalog/server/catalog"

export const dynamic = "force-static"
export const revalidate = 86400

export async function GET() {
  const catalog = await getCatalogResponse()
  const etag = `"${createHash("md5").update(String(catalog.lastUpdated)).digest("hex")}"`

  return Response.json(catalog, {
    headers: {
      ETag: etag,
      "Cache-Control": "public, max-age=604800, s-maxage=2592000",
      "CDN-Cache-Control": "max-age=2592000",
      Vary: "Accept-Encoding",
    },
  })
}
