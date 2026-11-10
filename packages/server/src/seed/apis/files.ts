import { endpoint, official, path, query } from "../dsl.ts";

const file = {
  id: "file_5Rm2KdXa",
  name: "invoice-2026-10.pdf",
  content_type: "application/pdf",
  size: 184320,
  status: "available",
  checksum_sha256: "9f2c4a7be1d03856a2c91f0e77b4d8c35a60e1f92b7d4c8803ae15f6d2b9c740",
  created: 1793836800,
};

export const files = official({
  id: "files",
  name: "Files",
  summary: "Upload, store and share documents and images",
  description:
    "Files stores customer documents and generated assets. Uploads go through an upload session so large files travel directly to storage; downloads use short-lived signed URLs instead of long-lived public links.",
  category: "Storage",
  owner: "Storage platform",
  adapter: "rest",
  version: "1.3.0",
  stability: "stable",
  baseUrl: "https://api.tether.dev/files",
  auth: "bearer",
  rateLimit: 180,
  registeredAt: "2024-09-09T11:45:00Z",
  scopes: [
    { name: "files.read", description: "Read file metadata and request download URLs" },
    { name: "files.write", description: "Upload and delete files" },
  ],
  endpoints: [
    endpoint("files.create-upload", "POST", "/v1/uploads", "Start an upload session", {
      description: "Reserves a file id and returns a URL to PUT the bytes to. The session expires after 15 minutes.",
      scope: "files.write",
      body: { name: "invoice-2026-10.pdf", content_type: "application/pdf", size: 184320 },
      status: 201,
      response: { id: "file_5Rm2KdXa", upload_url: "https://uploads.tether.dev/u/file_5Rm2KdXa?sig=7c1e", expires: 1794269700, status: "pending" },
    }),
    endpoint("files.get-file", "GET", "/v1/files/{id}", "Retrieve a file", {
      description: "Returns file metadata. The bytes are served separately through a signed URL.",
      scope: "files.read",
      params: [path("id", "File id, starting with file_", "file_5Rm2KdXa")],
      response: file,
    }),
    endpoint("files.list-files", "GET", "/v1/files", "List files", {
      description: "Returns files, newest first.",
      scope: "files.read",
      params: [query("limit", "integer", "Number of files to return", { example: "2" }), query("content_type", "string", "Only files with this content type", { example: "application/pdf" })],
      response: {
        data: [file, { ...file, id: "file_2Jt8LnVq", name: "logo-dark.png", content_type: "image/png", size: 22841, created: 1793318400 }],
        has_more: true,
        next_cursor: "cur_file_2Jt8LnVq",
      },
    }),
    endpoint("files.delete-file", "DELETE", "/v1/files/{id}", "Delete a file", {
      description: "Deletes the file and invalidates every signed URL issued for it. Deleting an unknown id is not an error.",
      scope: "files.write",
      params: [path("id", "File id, starting with file_", "file_5Rm2KdXa")],
      status: 204,
      response: null,
    }),
    endpoint("files.create-signed-url", "POST", "/v1/files/{id}/signed-url", "Create a signed URL", {
      description: "Returns a download URL that works until it expires. Choose the lifetime in seconds, up to one day.",
      scope: "files.read",
      params: [path("id", "File id, starting with file_", "file_5Rm2KdXa")],
      body: { expires_in: 600 },
      status: 201,
      response: { url: "https://download.tether.dev/d/file_5Rm2KdXa?sig=b83f&exp=1794269400", expires: 1794269400 },
    }),
  ],
  changelog: [
    { version: "1.3.0", date: "2026-10-12", note: "Signed URLs can live up to 24 hours" },
    { version: "1.2.1", date: "2026-08-05", note: "Upload sessions report status pending until the bytes arrive" },
    { version: "1.2.0", date: "2026-05-20", note: "Added the content_type filter on list files" },
  ],
});
