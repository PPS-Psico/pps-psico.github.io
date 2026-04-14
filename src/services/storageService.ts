import { supabase } from "../lib/supabaseClient";
import { cleanDbValue } from "../utils/formatters";

export const uploadInstitutionLogo = async (
  file: File,
  institutionName: string
): Promise<string> => {
  try {
    const safeName = cleanDbValue(institutionName)
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const fileExt = file.name.split(".").pop();
    const fileName = `logos/${safeName}_${Date.now()}.${fileExt}`;

    const BUCKET_NAME = "institution-logos";

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, { upsert: true });

    if (error) {
      console.error("Upload Error (institution-logos):", error);
      throw new Error(`Error subiendo logo: ${error.message}`);
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (error: any) {
    throw new Error(error.message || "Error desconocido al subir logo");
  }
};
