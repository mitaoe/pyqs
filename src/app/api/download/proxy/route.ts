import { NextRequest, NextResponse } from "next/server";
import mime from "mime-types";
import crypto from "crypto";
import { rewritePdfUrl } from "@/utils/urlParser";

// Generate ETag based on paper URL for conditional requests
function generateETagFromUrl(url: string): string {
  return `"${crypto.createHash('md5').update(url).digest('hex')}"`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");
  const download = searchParams.get("download") === "true";

  if (!url) {
    return NextResponse.json(
      { error: "URL parameter is required" },
      { status: 400 }
    );
  }

  const resolvedUrl = rewritePdfUrl(url);

  const etag = generateETagFromUrl(resolvedUrl);
  
  // Check If-None-Match header for conditional requests
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, { 
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'CDN-Cache-Control': 'max-age=31536000',
      }
    });
  }

  try {
    const response = await fetch(resolvedUrl, {
      headers: {
        Accept: "application/pdf, application/octet-stream",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch from source URL: ${response.status} ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    // Get the filename from the URL or Content-Disposition header
    let fileName = "";
    const contentDisposition = response.headers.get("content-disposition");

    if (contentDisposition) {
      const match = contentDisposition.match(
        /filename="(.+?)"|filename=([^;]+)/
      );
      if (match) {
        fileName = match[1] || match[2] || "";
      }
    }

    if (!fileName) {
      const urlPath = new URL(resolvedUrl).pathname;
      const pathSegments = urlPath.split("/");
      fileName = pathSegments[pathSegments.length - 1];
    }

    // Clean up the filename
    fileName = fileName.replace(/[/\\?%*:|"<>]/g, "_");

    // If we still don't have a filename, use a default
    if (!fileName || fileName === "") {
      fileName = `download_${Date.now()}.pdf`;
    }

    // Ensure PDF extension for relevant content types
    if (
      response.headers.get("content-type")?.includes("pdf") &&
      !fileName.toLowerCase().endsWith(".pdf")
    ) {
      fileName += ".pdf";
    }

    // Determine content type using mime-types package
    const fileExt = fileName.split(".").pop() || "";
    const contentType =
      mime.lookup(fileExt) ||
      response.headers.get("content-type") ||
      "application/octet-stream";

    // Set Content-Disposition based on download parameter
    const contentDispositionValue = download
      ? `attachment; filename="${fileName}"`
      : "inline";

    // Stream the response body directly without loading into memory
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDispositionValue,
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
        "CDN-Cache-Control": "max-age=31536000", // Vercel edge cache optimization
        "Vary": "Accept-Encoding", // Vary on encoding for compression
        "ETag": etag, // ETag for conditional requests
        // Forward content-length if available for better download progress
        ...(response.headers.get("content-length") && {
          "Content-Length": response.headers.get("content-length")!,
        }),
      },
    });
  } catch (error) {
    console.error("Proxy fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to proxy the file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
