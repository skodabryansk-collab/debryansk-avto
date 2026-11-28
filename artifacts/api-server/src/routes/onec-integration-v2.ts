import { timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { and, asc, count, eq, gt, inArray, isNull, max } from "drizzle-orm";
import {
  GetOneCDivisionWorksheetChangesInitialCursorResponse,
  GetOneCDivisionWorksheetChangesQueryParams,
  GetOneCDivisionWorksheetChangesResponse,
  GetOneCDivisionWorksheetsQueryParams,
  GetOneCDivisionWorksheetsResponse,
  UpdateOneCDivisionWorksheetMetadataBody,
  UpdateOneCDivisionWorksheetMetadataParams,
  UpdateOneCDivisionWorksheetMetadataResponse,
} from "@workspace/api-zod";
import {
  carsTable,
  db,
  managerClientCardOnecChangesTable,
  managerClientCardOnecWorksheetsTable,
  managerClientCardsTable,
  managersTable,
} from "@workspace/db";
import { getBrandLocationMappings, buildOneCClientCardFeedItem, type OneCCardFeedRow } from "./onec-integration";
import { recordOneCExchangeLog } from "../lib/onec-exchange-log";

const router = Router();

type FeedError = {
  ok: false;
  error: string;
  card_id?: number;
  missing_fields?: string[];
};

type RequestAudit = {
  afterId?: number | null;
  nextCursor?: number | null;
  itemCount?: number;
  hasMore?: boolean | null;
  errorCode?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  entityName?: string | null;
};

function setRequestAudit(res: Response, audit: RequestAudit): void {
  const current = ((res.locals as Record<string, unknown>)["onecRequestAudit"] ?? {}) as RequestAudit;
  (res.locals as Record<string, unknown>)["onecRequestAudit"] = { ...current, ...audit };
}

router.use((req: Request, res: Response, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const audit = ((res.locals as Record<string, unknown>)["onecRequestAudit"] ?? {}) as RequestAudit;
    const requestId = (req as Request & { id?: string | number }).id;
    recordOneCExchangeLog({
      eventType: "api_request",
      endpoint: req.path,
      method: req.method,
      httpStatus: res.statusCode,
      outcome: res.statusCode < 400 ? "success" : "error",
      afterId: audit.afterId ?? null,
      nextCursor: audit.nextCursor ?? null,
      itemCount: audit.itemCount ?? 0,
      hasMore: audit.hasMore ?? null,
      durationMs: Math.max(0, Date.now() - startedAt),
      errorCode: audit.errorCode ?? null,
      requestId: requestId == null ? null : String(requestId),
      entityType: audit.entityType ?? null,
      entityId: audit.entityId ?? null,
      entityName: audit.entityName ?? null,
      previousCode: null,
      newCode: null,
      actorLogin: null,
    }).catch(error => req.log.error({ err: error }, "1C v2 exchange journal write failed"));
  });
  next();
});

function isTokenMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

function tokenStatus(authorization: string | undefined): "not_configured" | "invalid" | "valid" {
  if (process.env["NODE_ENV"] !== "production") return "not_configured";
  const expected = process.env["ONEC_CLIENT_CARDS_TOKEN"]?.trim();
  if (!expected) return "not_configured";
  const match = authorization ? /^Bearer\s+(.+)$/i.exec(authorization.trim()) : null;
  const provided = match?.[1]?.trim();
  return provided && isTokenMatch(provided, expected) ? "valid" : "invalid";
}

function authorize(req: Request, res: Response): boolean {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Authorization");
  const status = tokenStatus(req.get("authorization"));
  if (status === "valid") return true;
  const error = status === "not_configured" ? "integration_not_configured" : "unauthorized";
  setRequestAudit(res, { errorCode: error });
  res.status(status === "not_configured" ? 503 : 401).json({ ok: false, error } satisfies FeedError);
  return false;
}

function cardFeedProjection() {
  return {
    id: managerClientCardsTable.id,
    managerId: managerClientCardsTable.managerId,
    managerName: managersTable.name,
    clientName: managerClientCardsTable.clientName,
    clientPhone: managerClientCardsTable.clientPhone,
    clientGender: managerClientCardsTable.clientGender,
    desiredBrand: managerClientCardsTable.desiredBrand,
    desiredModel: managerClientCardsTable.desiredModel,
    desiredVehicleUndecided: managerClientCardsTable.desiredVehicleUndecided,
    budgetRange: managerClientCardsTable.budgetRange,
    currentCar: managerClientCardsTable.currentCar,
    currentCarBrand: managerClientCardsTable.currentCarBrand,
    currentCarModel: managerClientCardsTable.currentCarModel,
    currentCarYear: managerClientCardsTable.currentCarYear,
    currentCarMileage: managerClientCardsTable.currentCarMileage,
    currentCarGeneration: managerClientCardsTable.currentCarGeneration,
    currentCarBodyType: managerClientCardsTable.currentCarBodyType,
    currentCarOwnersCount: managerClientCardsTable.currentCarOwnersCount,
    tradeInPlan: managerClientCardsTable.tradeInPlan,
    needs: managerClientCardsTable.needs,
    currentCars: managerClientCardsTable.currentCars,
    commercialBrand: managerClientCardsTable.commercialBrand,
    commercialModel: managerClientCardsTable.commercialModel,
    commercialCarId: managerClientCardsTable.commercialCarId,
    commercialCarSnapshot: managerClientCardsTable.commercialCarSnapshot,
    paymentMethod: managerClientCardsTable.paymentMethod,
    comment: managerClientCardsTable.comment,
    createdAt: managerClientCardsTable.createdAt,
    commercialCarVin: carsTable.vin,
  };
}

async function getCardsByIds(cardIds: number[]) {
  if (cardIds.length === 0) return [];
  return db.select(cardFeedProjection())
    .from(managerClientCardsTable)
    .leftJoin(managersTable, eq(managersTable.id, managerClientCardsTable.managerId))
    .leftJoin(carsTable, eq(carsTable.id, managerClientCardsTable.commercialCarId))
    .where(inArray(managerClientCardsTable.id, cardIds));
}

function buildDivisionItem(
  card: OneCCardFeedRow,
  worksheet: {
    id: number;
    sourceKey: string;
    cardId: number;
    organizationCode: string;
    departmentCode: string;
    brandNames: string[];
  },
  mappings: Awaited<ReturnType<typeof getBrandLocationMappings>>,
) {
  const base = buildOneCClientCardFeedItem(card, mappings);
  const needs = base.needs.filter(
    need => need.organization_code === worksheet.organizationCode &&
      need.department_code === worksheet.departmentCode,
  );
  const commercialOffer = base.commercial_offer &&
    base.commercial_offer.organization_code === worksheet.organizationCode &&
    base.commercial_offer.department_code === worksheet.departmentCode
    ? base.commercial_offer
    : null;

  return {
    id: worksheet.id,
    source_key: worksheet.sourceKey,
    manager_worksheet_id: worksheet.cardId,
    created_at: base.created_at,
    manager_id: base.manager_id,
    manager_name: base.manager_name,
    organization_code: worksheet.organizationCode,
    department_code: worksheet.departmentCode,
    brand_names: worksheet.brandNames,
    client_name: base.client_name,
    client_phone: base.client_phone,
    client_gender: base.client_gender,
    needs,
    current_cars: base.current_cars,
    commercial_offer: commercialOffer,
    payment_method: base.payment_method,
    comment: base.comment,
  };
}

router.get("/client-cards", async (req, res): Promise<void> => {
  if (!authorize(req, res)) return;
  const parsed = GetOneCDivisionWorksheetsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    setRequestAudit(res, { errorCode: "invalid_query" });
    res.status(400).json({ ok: false, error: "invalid_query" } satisfies FeedError);
    return;
  }

  const { after_id: requestedAfterId, limit } = parsed.data;
  const afterId = requestedAfterId ?? 0;
  setRequestAudit(res, { afterId });
  try {
    const [pageRows, pendingRows] = await Promise.all([
      db.select({
        id: managerClientCardOnecWorksheetsTable.id,
        sourceKey: managerClientCardOnecWorksheetsTable.sourceKey,
        cardId: managerClientCardOnecWorksheetsTable.cardId,
        organizationCode: managerClientCardOnecWorksheetsTable.organizationCode,
        departmentCode: managerClientCardOnecWorksheetsTable.departmentCode,
        brandNames: managerClientCardOnecWorksheetsTable.brandNames,
      })
        .from(managerClientCardOnecWorksheetsTable)
        .where(and(
          gt(managerClientCardOnecWorksheetsTable.id, afterId),
          eq(managerClientCardOnecWorksheetsTable.isActive, true),
          isNull(managerClientCardOnecWorksheetsTable.worksheetStatus),
        ))
        .orderBy(asc(managerClientCardOnecWorksheetsTable.id))
        .limit(limit + 1),
      db.select({ total: count() })
        .from(managerClientCardsTable)
        .where(eq(managerClientCardsTable.onecSyncPending, true)),
    ]);

    const hasMore = pageRows.length > limit;
    const worksheets = pageRows.slice(0, limit);
    const cardIds = [...new Set(worksheets.map(worksheet => worksheet.cardId))];
    const cards = await getCardsByIds(cardIds);
    const cardById = new Map(cards.map(card => [card.id, card]));
    const mappings = worksheets.length ? await getBrandLocationMappings() : [];
    const items = worksheets.flatMap(worksheet => {
      const card = cardById.get(worksheet.cardId);
      return card ? [buildDivisionItem(card, worksheet, mappings)] : [];
    });

    const nextCursor = worksheets.length ? worksheets[worksheets.length - 1]!.id : afterId;
    setRequestAudit(res, { nextCursor, itemCount: items.length, hasMore });
    res.json(GetOneCDivisionWorksheetsResponse.parse({
      ok: true,
      data: {
        items,
        next_cursor: nextCursor,
        has_more: hasMore,
        pending_count: pendingRows[0]?.total ?? 0,
      },
    }));
  } catch (error) {
    setRequestAudit(res, { errorCode: "internal_error" });
    req.log.error({ err: error }, "1C v2 division worksheet feed failed");
    res.status(500).json({ ok: false, error: "internal_error" } satisfies FeedError);
  }
});

router.get("/client-cards/changes/initial-cursor", async (req, res): Promise<void> => {
  if (!authorize(req, res)) return;
  try {
    const [row] = await db.select({ afterChangeId: max(managerClientCardOnecChangesTable.id) })
      .from(managerClientCardOnecChangesTable);
    const afterChangeId = Number(row?.afterChangeId ?? 0);
    setRequestAudit(res, { nextCursor: afterChangeId, hasMore: false });
    res.json(GetOneCDivisionWorksheetChangesInitialCursorResponse.parse({
      ok: true,
      data: { after_change_id: afterChangeId, as_of: new Date().toISOString() },
    }));
  } catch (error) {
    setRequestAudit(res, { errorCode: "internal_error" });
    req.log.error({ err: error }, "1C v2 division worksheet change cursor failed");
    res.status(500).json({ ok: false, error: "internal_error" } satisfies FeedError);
  }
});

router.get("/client-cards/changes", async (req, res): Promise<void> => {
  if (!authorize(req, res)) return;
  const parsed = GetOneCDivisionWorksheetChangesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    setRequestAudit(res, { errorCode: "invalid_query" });
    res.status(400).json({ ok: false, error: "invalid_query" } satisfies FeedError);
    return;
  }

  const { after_change_id: afterChangeId, limit } = parsed.data;
  setRequestAudit(res, { afterId: afterChangeId });
  try {
    const pageRows = await db.select({
      id: managerClientCardOnecChangesTable.id,
      worksheetId: managerClientCardOnecChangesTable.worksheetId,
      action: managerClientCardOnecChangesTable.action,
      createdAt: managerClientCardOnecChangesTable.createdAt,
    })
      .from(managerClientCardOnecChangesTable)
      .where(gt(managerClientCardOnecChangesTable.id, afterChangeId))
      .orderBy(asc(managerClientCardOnecChangesTable.id))
      .limit(limit + 1);

    const hasMore = pageRows.length > limit;
    const events = pageRows.slice(0, limit);
    const worksheetIds = [...new Set(events.map(event => event.worksheetId))];
    const worksheetRows = worksheetIds.length
      ? await db.select({
          id: managerClientCardOnecWorksheetsTable.id,
          sourceKey: managerClientCardOnecWorksheetsTable.sourceKey,
          cardId: managerClientCardOnecWorksheetsTable.cardId,
          organizationCode: managerClientCardOnecWorksheetsTable.organizationCode,
          departmentCode: managerClientCardOnecWorksheetsTable.departmentCode,
          brandNames: managerClientCardOnecWorksheetsTable.brandNames,
          isActive: managerClientCardOnecWorksheetsTable.isActive,
        })
          .from(managerClientCardOnecWorksheetsTable)
          .where(inArray(managerClientCardOnecWorksheetsTable.id, worksheetIds))
      : [];
    const worksheetById = new Map(worksheetRows.map(worksheet => [worksheet.id, worksheet]));
    const activeCardIds = [...new Set(
      worksheetRows.filter(worksheet => worksheet.isActive).map(worksheet => worksheet.cardId),
    )];
    const cards = await getCardsByIds(activeCardIds);
    const cardById = new Map(cards.map(card => [card.id, card]));
    const mappings = activeCardIds.length ? await getBrandLocationMappings() : [];

    const changeEvents = events.flatMap(event => {
      const worksheet = worksheetById.get(event.worksheetId);
      if (!worksheet) return [];
      const active = worksheet.isActive;
      const card = active ? cardById.get(worksheet.cardId) : undefined;
      const item = card ? buildDivisionItem(card, worksheet, mappings) : null;
      const action = item ? "upsert" : "delete";
      return [{
        change_id: event.id,
        action,
        worksheet_id: worksheet.id,
        manager_worksheet_id: worksheet.cardId,
        source_key: worksheet.sourceKey,
        changed_at: event.createdAt.toISOString(),
        item,
      }];
    });

    const nextCursor = events.length ? events[events.length - 1]!.id : afterChangeId;
    setRequestAudit(res, { nextCursor, itemCount: changeEvents.length, hasMore });
    res.json(GetOneCDivisionWorksheetChangesResponse.parse({
      ok: true,
      data: { events: changeEvents, next_cursor: nextCursor, has_more: hasMore },
    }));
  } catch (error) {
    setRequestAudit(res, { errorCode: "internal_error" });
    req.log.error({ err: error }, "1C v2 division worksheet changes failed");
    res.status(500).json({ ok: false, error: "internal_error" } satisfies FeedError);
  }
});

router.patch("/client-cards/:id/onec-data", async (req, res): Promise<void> => {
  if (!authorize(req, res)) return;
  const params = UpdateOneCDivisionWorksheetMetadataParams.safeParse(req.params);
  if (!params.success) {
    setRequestAudit(res, { errorCode: "invalid_worksheet_id" });
    res.status(400).json({ ok: false, error: "invalid_worksheet_id" } satisfies FeedError);
    return;
  }

  const requestBody = req.body;
  const normalizedBody = typeof requestBody === "object" && requestBody !== null && !Array.isArray(requestBody)
    ? {
        ...requestBody,
        ...(typeof requestBody.worksheet_status === "string"
          ? { worksheet_status: requestBody.worksheet_status.trim() }
          : {}),
      }
    : requestBody;
  const body = UpdateOneCDivisionWorksheetMetadataBody.safeParse(normalizedBody);
  if (!body.success || Object.keys(body.data ?? {}).length === 0) {
    setRequestAudit(res, { errorCode: "invalid_update" });
    res.status(400).json({ ok: false, error: "invalid_update" } satisfies FeedError);
    return;
  }
  if (body.data.worksheet_status === "Архив" && !body.data.archive_reason?.trim()) {
    setRequestAudit(res, { errorCode: "archive_reason_required" });
    res.status(400).json({ ok: false, error: "archive_reason_required" } satisfies FeedError);
    return;
  }

  const worksheetId = params.data.id;
  setRequestAudit(res, {
    itemCount: 1,
    entityType: "division_worksheet",
    entityId: worksheetId,
    entityName: `Интеграционный лист №${worksheetId}`,
  });
  const update: Partial<typeof managerClientCardOnecWorksheetsTable.$inferInsert> = {
    onecUpdatedAt: new Date(),
    updatedAt: new Date(),
  };
  if (Object.hasOwn(body.data, "dealer_manager")) {
    update.dealerManager = body.data.dealer_manager?.trim() || null;
  }
  if (Object.hasOwn(body.data, "worksheet_status")) {
    update.worksheetStatus = body.data.worksheet_status?.trim() || null;
  }
  if (Object.hasOwn(body.data, "archive_reason")) {
    update.archiveReason = body.data.archive_reason?.trim() || null;
  }

  try {
    const [worksheet] = await db.update(managerClientCardOnecWorksheetsTable)
      .set(update)
      .where(and(
        eq(managerClientCardOnecWorksheetsTable.id, worksheetId),
        eq(managerClientCardOnecWorksheetsTable.isActive, true),
      ))
      .returning({
        id: managerClientCardOnecWorksheetsTable.id,
        cardId: managerClientCardOnecWorksheetsTable.cardId,
        dealerManager: managerClientCardOnecWorksheetsTable.dealerManager,
        worksheetStatus: managerClientCardOnecWorksheetsTable.worksheetStatus,
        archiveReason: managerClientCardOnecWorksheetsTable.archiveReason,
        receivedAt: managerClientCardOnecWorksheetsTable.onecUpdatedAt,
      });
    if (!worksheet) {
      setRequestAudit(res, { errorCode: "worksheet_not_found" });
      res.status(404).json({ ok: false, error: "worksheet_not_found" } satisfies FeedError);
      return;
    }
    res.json(UpdateOneCDivisionWorksheetMetadataResponse.parse({
      ok: true,
      data: {
        worksheet_id: worksheet.id,
        manager_worksheet_id: worksheet.cardId,
        dealer_manager: worksheet.dealerManager,
        worksheet_status: worksheet.worksheetStatus,
        archive_reason: worksheet.archiveReason,
        received_at: worksheet.receivedAt ?? new Date(),
      },
    }));
  } catch (error) {
    setRequestAudit(res, { errorCode: "internal_error" });
    req.log.error({ err: error, worksheetId }, "1C v2 division worksheet metadata update failed");
    res.status(500).json({ ok: false, error: "internal_error" } satisfies FeedError);
  }
});

export default router;
