import { createClient } from "./supabase/client";

export async function uploadMedia(
  file: File,
  userId: string,
  folder: string
) {
  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${userId}/${folder}-${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("media")
    .upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (error) throw error;

  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return data.publicUrl;
}
