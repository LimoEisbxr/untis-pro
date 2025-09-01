/*
  Warnings:

  - A unique constraint covering the columns `[userId,untisId]` on the table `Exam` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,untisId]` on the table `Homework` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Exam_untisId_key";

-- DropIndex
DROP INDEX "public"."Homework_untisId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Exam_userId_untisId_key" ON "public"."Exam"("userId", "untisId");

-- CreateIndex
CREATE UNIQUE INDEX "Homework_userId_untisId_key" ON "public"."Homework"("userId", "untisId");
