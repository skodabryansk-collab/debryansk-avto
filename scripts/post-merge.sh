#!/bin/bash
set -e
pnpm install --frozen-lockfile
psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --file lib/db/migrations/20261120_customer_surveys.sql
psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --file lib/db/migrations/20261120_manager_client_cards.sql
psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --file lib/db/migrations/20261120_manager_client_cards_enhancements.sql
