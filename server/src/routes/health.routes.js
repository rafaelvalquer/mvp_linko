import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getSystemHealthSnapshot } from "../services/systemStatus.service.js";
const r = Router();

r.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const health = await getSystemHealthSnapshot();
    res.json(health);
  }),
);

export default r;
