import { request, requestBlob } from "../../services/session";
import { createManagerApi } from "./managerApiContract.js";

export const managerApi = createManagerApi(request, requestBlob);
