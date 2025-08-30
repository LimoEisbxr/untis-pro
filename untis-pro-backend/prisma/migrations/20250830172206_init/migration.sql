-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT NOT NULL,
    "hashedPassword" TEXT,
    "untisSecretCiphertext" BYTEA,
    "untisSecretNonce" BYTEA,
    "untisSecretKeyVersion" INTEGER DEFAULT 1,
    "displayName" TEXT,
    "sharingEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Timetable" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "rangeStart" TIMESTAMP(3),
    "rangeEnd" TIMESTAMP(3),
    "payload" JSONB NOT NULL,

    CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SessionToken" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LessonColorSetting" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonName" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "offset" DOUBLE PRECISION NOT NULL DEFAULT 0.5,

    CONSTRAINT "LessonColorSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DefaultLessonColor" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lessonName" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "offset" DOUBLE PRECISION NOT NULL DEFAULT 0.5,

    CONSTRAINT "DefaultLessonColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TimetableShare" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "sharedWithId" TEXT NOT NULL,

    CONSTRAINT "TimetableShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppSettings" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "globalSharingEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Homework" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "untisId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" INTEGER,
    "date" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "remark" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Exam" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "untisId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "date" INTEGER NOT NULL,
    "startTime" INTEGER NOT NULL,
    "endTime" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT,
    "teachers" JSONB,
    "rooms" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WhitelistRule" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" TEXT NOT NULL,

    CONSTRAINT "WhitelistRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "SessionToken_token_key" ON "public"."SessionToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "LessonColorSetting_userId_lessonName_key" ON "public"."LessonColorSetting"("userId", "lessonName");

-- CreateIndex
CREATE UNIQUE INDEX "DefaultLessonColor_lessonName_key" ON "public"."DefaultLessonColor"("lessonName");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableShare_ownerId_sharedWithId_key" ON "public"."TimetableShare"("ownerId", "sharedWithId");

-- CreateIndex
CREATE UNIQUE INDEX "Homework_untisId_key" ON "public"."Homework"("untisId");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_untisId_key" ON "public"."Exam"("untisId");

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistRule_value_key" ON "public"."WhitelistRule"("value");

-- AddForeignKey
ALTER TABLE "public"."Timetable" ADD CONSTRAINT "Timetable_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionToken" ADD CONSTRAINT "SessionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LessonColorSetting" ADD CONSTRAINT "LessonColorSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimetableShare" ADD CONSTRAINT "TimetableShare_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimetableShare" ADD CONSTRAINT "TimetableShare_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Homework" ADD CONSTRAINT "Homework_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Exam" ADD CONSTRAINT "Exam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
