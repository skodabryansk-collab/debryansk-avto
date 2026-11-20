import { Router, type IRouter, type Request } from "express";
import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import {
  GetOneCAdminLogsQueryParams,
  GetOneCAdminLogsResponse,
  GetOneCAdminMappingsResponse,
  GetOneCAdminStatusResponse,
  UpdateOneCDepartmentMappingBody,
  UpdateOneCDepartmentMappingParams,
  UpdateOneCDepartmentMappingResponse,
  UpdateOneCOrganizationMappingBody,
  UpdateOneCOrganizationMappingParams,
  UpdateOneCOrganizationMappingResponse,
} from "@workspace/api-zod";
import {
  brandsTable,
  db,
  locationsTable,
  locationBrandsTable,
  onecExchangeLogsTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import { pruneOneCExchangeLogsIfDue } from "../lib/onec-exchange-log";

const router: IRouter = Router();
router.use(requireAdmin);

function getActorLogin(req: Request): string | null {
  const payload = (req as Request & { adminPayload?: Record<string, unknown> }).adminPayload;
  return typeof payload?.["login"] === "string" ? payload["login"] : null;
}

function validateCode(code: string | null, confirmed: boolean): string | null {
  if (!code && confirmed) return "code_required_for_confirmation";
  if (code && /[\u0000-\u001f\u007f]/.test(code)) return "invalid_code";
  if (code?.startsWith("TMP1C-") && confirmed) return "temporary_code_cannot_be_confirmed";
  return null;
}

router.get("/status", async (req, res): Promise<void> => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totals, lastRequest, lastSuccess] = await Promise.all([
      db.select({
        requests: count(),
        failures: sql<number>`count(*) filter (where ${onecExchangeLogsTable.httpStatus} >= 400)`,
      })
        .from(onecExchangeLogsTable)
        .where(and(
          eq(onecExchangeLogsTable.eventType, "api_request"),
          gte(onecExchangeLogsTable.createdAt, cutoff),
        )),
      db.select({ createdAt: onecExchangeLogsTable.createdAt })
        .from(onecExchangeLogsTable)
        .where(eq(onecExchangeLogsTable.eventType, "api_request"))
        .orderBy(desc(onecExchangeLogsTable.createdAt))
        .limit(1),
      db.select({ createdAt: onecExchangeLogsTable.createdAt })
        .from(onecExchangeLogsTable)
        .where(and(
          eq(onecExchangeLogsTable.eventType, "api_request"),
          eq(onecExchangeLogsTable.outcome, "success"),
        ))
        .orderBy(desc(onecExchangeLogsTable.createdAt))
        .limit(1),
    ]);

    const tokenConfigured = Boolean(process.env["ONEC_CLIENT_CARDS_TOKEN"]?.trim());
    res.json(GetOneCAdminStatusResponse.parse({
      token_configured: tokenConfigured,
      token_active: tokenConfigured && process.env["NODE_ENV"] === "production",
      secret_name: "ONEC_CLIENT_CARDS_TOKEN",
      authentication: "Bearer",
      feed_path: "/api/integrations/1c/v1/client-cards",
      initial_cursor_path: "/api/integrations/1c/v1/client-cards/initial-cursor",
      last_request_at: lastRequest[0]?.createdAt ?? null,
      last_success_at: lastSuccess[0]?.createdAt ?? null,
      requests_24h: totals[0]?.requests ?? 0,
      failures_24h: Number(totals[0]?.failures ?? 0),
    }));
  } catch (error) {
    req.log.error({ err: error }, "1C admin status query failed");
    res.status(500).json({ ok: false, error: "onec_status_unavailable" });
  }
});

router.get("/logs", async (req, res): Promise<void> => {
  const parsed = GetOneCAdminLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "invalid_query" });
    return;
  }

  try {
    const { page, page_size: pageSize, event_type: eventType, outcome } = parsed.data;
    const conditions = [];
    if (eventType) conditions.push(eq(onecExchangeLogsTable.eventType, eventType));
    if (outcome) conditions.push(eq(onecExchangeLogsTable.outcome, outcome));
    const where = conditions.length ? and(...conditions) : undefined;
    const [items, totalRows] = await Promise.all([
      db.select({
        id: onecExchangeLogsTable.id,
        event_type: onecExchangeLogsTable.eventType,
        endpoint: onecExchangeLogsTable.endpoint,
        method: onecExchangeLogsTable.method,
        http_status: onecExchangeLogsTable.httpStatus,
        outcome: onecExchangeLogsTable.outcome,
        after_id: onecExchangeLogsTable.afterId,
        next_cursor: onecExchangeLogsTable.nextCursor,
        item_count: onecExchangeLogsTable.itemCount,
        has_more: onecExchangeLogsTable.hasMore,
        duration_ms: onecExchangeLogsTable.durationMs,
        error_code: onecExchangeLogsTable.errorCode,
        request_id: onecExchangeLogsTable.requestId,
        entity_type: onecExchangeLogsTable.entityType,
        entity_id: onecExchangeLogsTable.entityId,
        entity_name: onecExchangeLogsTable.entityName,
        previous_code: onecExchangeLogsTable.previousCode,
        new_code: onecExchangeLogsTable.newCode,
        actor_login: onecExchangeLogsTable.actorLogin,
        created_at: onecExchangeLogsTable.createdAt,
      })
        .from(onecExchangeLogsTable)
        .where(where)
        .orderBy(desc(onecExchangeLogsTable.createdAt), desc(onecExchangeLogsTable.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() }).from(onecExchangeLogsTable).where(where),
    ]);
    const total = totalRows[0]?.total ?? 0;
    res.json(GetOneCAdminLogsResponse.parse({
      items,
      total,
      page,
      page_size: pageSize,
      pages: Math.ceil(total / pageSize),
    }));
  } catch (error) {
    req.log.error({ err: error }, "1C admin exchange journal query failed");
    res.status(500).json({ ok: false, error: "onec_logs_unavailable" });
  }
});

router.get("/mappings", async (req, res): Promise<void> => {
  try {
    const [organizations, departmentRows] = await Promise.all([
      db.select({
        id: locationsTable.id,
        title: locationsTable.title,
        organization_code: locationsTable.onecOrganizationCode,
        confirmed: locationsTable.onecOrganizationCodeConfirmed,
      })
        .from(locationsTable)
        .orderBy(asc(locationsTable.title), asc(locationsTable.id)),
      db.select({
        id: brandsTable.id,
        brand_name: brandsTable.name,
        department_code: brandsTable.onecDepartmentCode,
        confirmed: brandsTable.onecDepartmentCodeConfirmed,
        location_name: locationsTable.title,
      })
        .from(brandsTable)
        .leftJoin(locationBrandsTable, eq(locationBrandsTable.brandId, brandsTable.id))
        .leftJoin(locationsTable, eq(locationsTable.id, locationBrandsTable.locationId))
        .orderBy(asc(brandsTable.name), asc(locationsTable.title)),
    ]);

    const departmentsById = new Map<number, {
      id: number;
      brand_name: string;
      department_code: string | null;
      confirmed: boolean;
      location_names: string[];
      location_count: number;
    }>();
    for (const row of departmentRows) {
      let department = departmentsById.get(row.id);
      if (!department) {
        department = {
          id: row.id,
          brand_name: row.brand_name,
          department_code: row.department_code,
          confirmed: row.confirmed,
          location_names: [],
          location_count: 0,
        };
        departmentsById.set(row.id, department);
      }
      if (row.location_name && !department.location_names.includes(row.location_name)) {
        department.location_names.push(row.location_name);
      }
    }
    for (const department of departmentsById.values()) {
      department.location_count = department.location_names.length;
    }

    res.json(GetOneCAdminMappingsResponse.parse({
      organizations,
      departments: [...departmentsById.values()],
    }));
  } catch (error) {
    req.log.error({ err: error }, "1C admin code mapping query failed");
    res.status(500).json({ ok: false, error: "onec_mappings_unavailable" });
  }
});

router.patch("/mappings/organizations/:locationId", async (req, res): Promise<void> => {
  const params = UpdateOneCOrganizationMappingParams.safeParse(req.params);
  const body = UpdateOneCOrganizationMappingBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ ok: false, error: "invalid_mapping" });
    return;
  }

  const code = body.data.code?.trim() || null;
  const codeError = validateCode(code, body.data.confirmed);
  if (codeError) {
    res.status(400).json({ ok: false, error: codeError });
    return;
  }

  try {
    const locationId = params.data.locationId;
    const result = await db.transaction(async tx => {
      const [current] = await tx.select({
        title: locationsTable.title,
        code: locationsTable.onecOrganizationCode,
        confirmed: locationsTable.onecOrganizationCodeConfirmed,
      }).from(locationsTable).where(eq(locationsTable.id, locationId)).limit(1);
      if (!current) return null;

      await tx.update(locationsTable)
        .set({
          onecOrganizationCode: code,
          onecOrganizationCodeConfirmed: body.data.confirmed,
        })
        .where(eq(locationsTable.id, locationId));

      if (current.code !== code || current.confirmed !== body.data.confirmed) {
        const payload = (req as Request & { adminPayload?: Record<string, unknown> }).adminPayload;
        await tx.insert(onecExchangeLogsTable).values({
          eventType: "settings_change",
          endpoint: null,
          method: "ADMIN",
          httpStatus: 200,
          outcome: "settings_updated",
          afterId: null,
          nextCursor: null,
          itemCount: 0,
          hasMore: null,
          durationMs: null,
          errorCode: null,
          requestId: null,
          entityType: "organization",
          entityId: locationId,
          entityName: current.title,
          previousCode: current.code,
          newCode: code,
          actorLogin: typeof payload?.["login"] === "string" ? payload["login"] : null,
        });
      }
      return { code, confirmed: body.data.confirmed };
    });
    if (!result) {
      res.status(404).json({ ok: false, error: "location_not_found" });
      return;
    }
    void pruneOneCExchangeLogsIfDue().catch(error =>
      req.log.error({ err: error }, "1C exchange journal retention cleanup failed"),
    );
    res.json(UpdateOneCOrganizationMappingResponse.parse({ ok: true, ...result }));
  } catch (error) {
    req.log.error({ err: error }, "1C organization mapping update failed");
    res.status(500).json({ ok: false, error: "onec_mapping_update_failed" });
  }
});

router.patch("/mappings/departments/:brandId", async (req, res): Promise<void> => {
  const params = UpdateOneCDepartmentMappingParams.safeParse(req.params);
  const body = UpdateOneCDepartmentMappingBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ ok: false, error: "invalid_mapping" });
    return;
  }

  const code = body.data.code?.trim() || null;
  const codeError = validateCode(code, body.data.confirmed);
  if (codeError) {
    res.status(400).json({ ok: false, error: codeError });
    return;
  }

  try {
    const brandId = params.data.brandId;
    const result = await db.transaction(async tx => {
      const [current] = await tx.select({
        name: brandsTable.name,
        code: brandsTable.onecDepartmentCode,
        confirmed: brandsTable.onecDepartmentCodeConfirmed,
      }).from(brandsTable).where(eq(brandsTable.id, brandId)).limit(1);
      if (!current) return null;

      await tx.update(brandsTable)
        .set({
          onecDepartmentCode: code,
          onecDepartmentCodeConfirmed: body.data.confirmed,
        })
        .where(eq(brandsTable.id, brandId));

      if (current.code !== code || current.confirmed !== body.data.confirmed) {
        const payload = (req as Request & { adminPayload?: Record<string, unknown> }).adminPayload;
        await tx.insert(onecExchangeLogsTable).values({
          eventType: "settings_change",
          endpoint: null,
          method: "ADMIN",
          httpStatus: 200,
          outcome: "settings_updated",
          afterId: null,
          nextCursor: null,
          itemCount: 0,
          hasMore: null,
          durationMs: null,
          errorCode: null,
          requestId: null,
          entityType: "department",
          entityId: brandId,
          entityName: current.name,
          previousCode: current.code,
          newCode: code,
          actorLogin: typeof payload?.["login"] === "string" ? payload["login"] : null,
        });
      }
      return { code, confirmed: body.data.confirmed };
    });
    if (!result) {
      res.status(404).json({ ok: false, error: "brand_not_found" });
      return;
    }
    void pruneOneCExchangeLogsIfDue().catch(error =>
      req.log.error({ err: error }, "1C exchange journal retention cleanup failed"),
    );
    res.json(UpdateOneCDepartmentMappingResponse.parse({ ok: true, ...result }));
  } catch (error) {
    req.log.error({ err: error }, "1C department mapping update failed");
    res.status(500).json({ ok: false, error: "onec_mapping_update_failed" });
  }
});

export default router;
