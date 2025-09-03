-- CreateTable
CREATE TABLE "public"."UserActivity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyStats" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "uniqueLogins" INTEGER NOT NULL DEFAULT 0,
    "totalLogins" INTEGER NOT NULL DEFAULT 0,
    "timetableViews" INTEGER NOT NULL DEFAULT 0,
    "searchQueries" INTEGER NOT NULL DEFAULT 0,
    "settingsOpened" INTEGER NOT NULL DEFAULT 0,
    "colorChanges" INTEGER NOT NULL DEFAULT 0,
    "avgSessionDuration" DOUBLE PRECISION,
    "peakHour" INTEGER,

    CONSTRAINT "DailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HourlyStats" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "logins" INTEGER NOT NULL DEFAULT 0,
    "timetableViews" INTEGER NOT NULL DEFAULT 0,
    "searchQueries" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HourlyStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserActivity_userId_createdAt_idx" ON "public"."UserActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_action_createdAt_idx" ON "public"."UserActivity"("action", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_createdAt_idx" ON "public"."UserActivity"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStats_date_key" ON "public"."DailyStats"("date");

-- CreateIndex
CREATE INDEX "DailyStats_date_idx" ON "public"."DailyStats"("date");

-- CreateIndex
CREATE INDEX "HourlyStats_date_hour_idx" ON "public"."HourlyStats"("date", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "HourlyStats_date_hour_key" ON "public"."HourlyStats"("date", "hour");

-- AddForeignKey
ALTER TABLE "public"."UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
