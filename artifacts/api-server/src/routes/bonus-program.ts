import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

/* ── PUBLIC: GET /api/bonus-program ─────────────────────────────────────── */
router.get("/bonus-program", async (_req, res) => {
  try {
    const result = await db.execute(
      sql`SELECT * FROM bonus_program_content WHERE id = 1 LIMIT 1`
    );
    const row = result.rows[0] ?? null;
    return res.json({ ok: true, data: row });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── ADMIN ──────────────────────────────────────────────────────────────── */
const adminRouter: IRouter = Router();
adminRouter.use(requireAdmin);

/* GET /api/admin/bonus-program */
adminRouter.get("/", async (_req, res) => {
  try {
    const result = await db.execute(
      sql`SELECT * FROM bonus_program_content WHERE id = 1 LIMIT 1`
    );
    return res.json({ ok: true, data: result.rows[0] ?? null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* PUT /api/admin/bonus-program — upsert singleton */
adminRouter.put("/", async (req, res) => {
  try {
    const {
      heroTitle,
      heroDescription,
      perks,
      discountLevels,
      redemptionRules,
      bonusActions,
      importantNotes,
      fullRulesSections,
    } = req.body as {
      heroTitle?: string;
      heroDescription?: string;
      perks?: unknown[];
      discountLevels?: unknown[];
      redemptionRules?: unknown[];
      bonusActions?: unknown[];
      importantNotes?: string;
      fullRulesSections?: unknown[];
    };

    await db.execute(sql`
      INSERT INTO bonus_program_content
        (id, hero_title, hero_description, perks, discount_levels, redemption_rules,
         bonus_actions, important_notes, full_rules_sections, updated_at)
      VALUES
        (1,
         ${heroTitle ?? ""},
         ${heroDescription ?? ""},
         ${JSON.stringify(perks ?? [])}::jsonb,
         ${JSON.stringify(discountLevels ?? [])}::jsonb,
         ${JSON.stringify(redemptionRules ?? [])}::jsonb,
         ${JSON.stringify(bonusActions ?? [])}::jsonb,
         ${importantNotes ?? ""},
         ${JSON.stringify(fullRulesSections ?? [])}::jsonb,
         NOW())
      ON CONFLICT (id) DO UPDATE SET
        hero_title         = EXCLUDED.hero_title,
        hero_description   = EXCLUDED.hero_description,
        perks              = EXCLUDED.perks,
        discount_levels    = EXCLUDED.discount_levels,
        redemption_rules   = EXCLUDED.redemption_rules,
        bonus_actions      = EXCLUDED.bonus_actions,
        important_notes    = EXCLUDED.important_notes,
        full_rules_sections = EXCLUDED.full_rules_sections,
        updated_at         = NOW()
    `);

    const updated = await db.execute(
      sql`SELECT * FROM bonus_program_content WHERE id = 1 LIMIT 1`
    );
    return res.json({ ok: true, data: updated.rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export { router as publicBonusProgramRouter, adminRouter as adminBonusProgramRouter };
