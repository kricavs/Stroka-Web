import "server-only";
import { getPepper } from "@/lib/portal/access-code.js";
import * as core from "@/lib/files/files-core.js";
import { getStorage } from "@/lib/files/server/storage";
import { InputError } from "../errors.js";
import { bindDb } from "./bind";

const bound = bindDb(core);
export const { setFinal, archiveFile, setVisibility, listClientFiles, getFileForAdmin } = bound;
export { authorizeUploadToken } from "@/lib/files/files-core.js";

export const prepareUpload = (input) => bound.prepareUpload(input, { secret: getPepper() });
export const completeUpload = (input) => {
  const storage = getStorage();
  if (!storage) throw new InputError("Los archivos no están disponibles: falta configurar el store privado.", 503);
  return bound.completeUpload(storage, input, { secret: getPepper() });
};
